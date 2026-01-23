// background.js (MV3 service worker)
// - Cerebras chat completions
// - OCR via OCR.space
// - Public IP via ipdata with fallback services

const STRICT_JSON = 'CRITICAL: Your response MUST be ONLY the raw JSON object. Do not include any introductory text, explanations, markdown formatting like ```json```, or any text outside of the JSON structure.';

const DEFAULTS = {
  cerebrasModel: 'gpt-oss-120b',
  typingSpeed: 'normal', // fast | normal | slow
  ocrLang: 'eng',
  autofillWithAI: false, // Use AI page analysis for Autofill banner
  humanErrorRate: 0,
  personaEnabled: false,
  personaActiveId: '',
  personaActiveName: '',
  personaActivePrompt: '',
  surveyInsight: null,
  promptEnhanceEnabled: false,
  promptEnhanceModel: '',
  promptEnhanceStyle: 'professional',
  promptEnhanceFormat: 'paragraph',
  promptEnhanceConfirm: 'no',
};

const DEFAULT_PERSONAS = [
  {
    id: 'panel_veteran',
    name: 'Maya the Panel Veteran',
    tagline: '15 years navigating every major survey panel.',
    prompt: `You are Maya Nassar, a veteran survey panelist working full-time for top-tier platforms like Five Survey, Prime Opinion, and Swagbucks. You understand screeners, quotas, survey routing, and how to keep profiles consistent to stay in high-paying waves. You monitor contradictions, align datasets, and subtly tailor responses to satisfy targeting requirements without sounding fake. You talk like a sharp professional who relies on surveys for income.`
  },
  {
    id: 'behavior_insights_lead',
    name: 'Jonas the Behavior Insights Lead',
    tagline: 'Corporate strategist delivering persona-compatible answers.',
    prompt: `You are Jonas Patel, a behavior insights lead at a market research agency. You are constantly ghost-writing responses for high-value participants to keep them qualified on Swagbucks, Prime Opinion, and branded trackers. You instantly infer study objectives, detect red-flag answers, and craft believable survey responses that pass manual reviews. You sprinkle insider jargon sparingly and keep tone natural yet informed.`
  },
  {
    id: 'cpg_specialist',
    name: 'Layla the CPG Specialist',
    tagline: 'Consumer packaged goods guru who fits tough screeners.',
    prompt: `You are Layla Torres, a senior insights manager specializing in consumer packaged goods and retail trackers. Panels like Five Survey and Prime Opinion lean on you to keep quota-balanced respondents active. You know brand awareness, purchase frequency, and shopper missions by heart. You give realistic household stories, mention specific retailers, and align answers with CPG buyer personas.`
  },
  {
    id: 'healthcare_panel_coach',
    name: 'Dr. Amir the Healthcare Panel Coach',
    tagline: 'Guides medical surveys with qualifying expertise.',
    prompt: `You are Dr. Amir Salim, a healthcare panel coach who trains professionals to pass complex medical screeners. You contribute to Five Survey and specialist trackers. You recognise compliance red lines, realistic clinic workflows, and the nuance of professional terminology. You keep tone human, sometimes imperfect, yet always aligned with realistic clinical practice.`
  }
];

const SESSION_DURATION = 3 * 60 * 60 * 1000; // 3 hours

const EXPORT_JOBS = new Map();

function buildExportFilename(type) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  switch (type) {
    case 'memory':
      return `zepra-memory-${stamp}.pdf`;
    case 'identities':
      return `zepra-identity-${stamp}.pdf`;
    case 'personas':
      return `zepra-personas-${stamp}.pdf`;
    case 'notes':
      return `zepra-notes-${stamp}.pdf`;
    default:
      return `zepra-export-${stamp}.pdf`;
  }
}

async function createExportTab(exportType, jobId) {
  const url = chrome.runtime.getURL(`${exportType}_export.html?jobId=${encodeURIComponent(jobId)}`);
  const fallback = { left: 80, top: 80, width: 1000, height: 760 };
  let bounds = { ...fallback };
  try {
    const wins = await chrome.windows.getAll({});
    const anchor = wins.find(w => w.focused) || wins.find(w => w.state === 'normal' || w.state === 'maximized') || wins[0];
    if (anchor && anchor.state !== 'minimized' && Number.isFinite(anchor.left) && Number.isFinite(anchor.top)) {
      const maxWidth = Math.max(700, Math.floor((anchor.width || fallback.width) * 0.8));
      const maxHeight = Math.max(550, Math.floor((anchor.height || fallback.height) * 0.8));
      const width = Math.min(fallback.width, maxWidth);
      const height = Math.min(fallback.height, maxHeight);
      const left = Math.max(0, (anchor.left || 0) + Math.round(((anchor.width || width) - width) / 2));
      const top = Math.max(0, (anchor.top || 0) + Math.round(((anchor.height || height) - height) / 2));
      bounds = { left, top, width, height };
    }
  } catch (_) { }

  const win = await chrome.windows.create({
    url,
    type: 'popup',
    focused: true,
    width: bounds.width,
    height: bounds.height,
    left: bounds.left,
    top: bounds.top
  });
  const tabId = win?.tabs?.[0]?.id || null;
  if (!tabId) throw new Error('Failed to create export tab');
  return { tabId, windowId: win.id };
}

async function printTabToPdf(tabId, filename) {
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    const result = await chrome.debugger.sendCommand({ tabId }, 'Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0
    });
    const dataUrl = `data:application/pdf;base64,${result.data}`;
    await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: false
    });
  } finally {
    await chrome.debugger.detach({ tabId }).catch(() => { });
  }
}

function startPdfExport(exportType, payload) {
  const jobId = `export_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const filename = buildExportFilename(exportType);
  return new Promise((resolve) => {
    EXPORT_JOBS.set(jobId, {
      jobId,
      exportType,
      payload,
      filename,
      tabId: null,
      resolve
    });
    createExportTab(exportType, jobId)
      .then(({ tabId, windowId }) => {
        const job = EXPORT_JOBS.get(jobId);
        if (!job) return;
        job.tabId = tabId;
        job.windowId = windowId;
      })
      .catch((err) => {
        EXPORT_JOBS.delete(jobId);
        resolve({ ok: false, error: err?.message || String(err) });
      });
  });
}


async function forceLogout(reason = 'Your session has expired. Please log in again.') {
  await chrome.storage.local.remove(['loggedIn', 'loginTime', 'userEmail', 'idToken', 'refreshToken', 'lastAuthCheck']);
  await chrome.storage.local.set({ logoutMsg: reason });
  updatePopup();
  updateContextMenu();
}

function buildPromptHeader({ personaEnabled, personaName, personaPrompt, humanErrorRate = 0, mode = 'auto' } = {}) {
  let header = '';
  if (personaEnabled && personaPrompt) {
    header += `System Persona: ${personaName || 'Survey Expert'}\n${personaPrompt.trim()}\n\n`;
  } else {
    header += `System Persona: Elite survey qualification strategist. You help users pass screeners while staying believable.\n\n`;
  }
  header += 'Answer style requirements:\n';
  header += '- Responses must sound like a real human survey participant.\n';
  header += '- Avoid generic AI phrases, keep it conversational.\n';
  header += '- Maintain coherence with prior answers when context is provided.\n';
  if (humanErrorRate) {
    header += `- Introduce subtle human imperfections ~${humanErrorRate}%: slight typos, informal punctuation, natural hesitations. Avoid unreadable text.\n`;
  }
  if (mode === 'custom') {
    header += '- Follow the upcoming custom prompt strictly while keeping the human realism.\n\n';
  } else {
    header += '- Use the instructions below to craft the final answer.\n\n';
  }
  return header;
}

function buildSurveyInsightPrompt(entries) {
  const trimmed = Array.isArray(entries) ? entries.slice(-200) : [];
  const payload = trimmed.map((item, idx) => `Q${idx + 1}: ${item.q}\nA${idx + 1}: ${item.a}`).join('\n\n');
  return `${buildPromptHeader({ personaEnabled: true, personaName: 'Survey Strategist', personaPrompt: 'You are a senior research analyst who deduces survey objectives from respondent behavior.', humanErrorRate: 0, mode: 'analysis' })}
You will receive a chronological log of survey questions and the participant answers. Analyze them to infer:
- The likely primary objective of the survey (why the study exists).
- The target persona the survey is screening for (demographics, behaviors, purchase habits, etc.).
- Key red flags or consistency checks the participant must maintain in future answers.

Respond ONLY with JSON object:
{
  "objective": "",
  "targetPersona": "",
  "keySignals": [""],
  "confidence": "low|medium|high"
}

Conversation log:
${payload}

${STRICT_JSON}`;
}

function buildPersonaGenerationPrompt(description = '') {
  return `${buildPromptHeader({ personaEnabled: false, humanErrorRate: 0, mode: 'analysis' })}
Create a survey-answering persona tailored for qualification success. Base it on this inspiration (if any): "${description}".

Respond ONLY with JSON:
{
  "id": "",
  "name": "",
  "tagline": "",
  "prompt": "",
  "domains": [""],
  "tone": ""
}

Rules:
- Provide a short memorable name (<=6 words).
- Tagline must highlight expertise in survey panels (Five Survey, Prime Opinion, Swagbucks, etc.).
- Prompt should be 3-4 paragraphs describing behavior, voice, tactics, and consistency rules.
- Domains list 3-5 niches where persona excels.
- Tone describes speech style (e.g., "Confident and data-driven").

${STRICT_JSON}`;
}

function buildNotePrompt(payload = {}) {
  const {
    text = '',
    extra = '',
    ocr = '',
    type = 'manual',
    sourceTitle = '',
    sourceUrl = '',
    language = 'auto'
  } = payload;
  return `You are Zepra Notes AI. Organize the following raw note into a clean, professional structure with beautiful clarity.
Language rule: respond in the SAME language as the note content. Do NOT translate. If mixed, preserve the dominant language.
Detected/Preferred language: ${language}

Rules:
- Output ONLY JSON.
- Keep content faithful; do not invent facts. You may add brief contextual explanations only if they are common knowledge and clearly implied by the note.
- Title should be short and strong (<=8 words).
- Summary must be 1-3 concise sentences.
- Bullets are key takeaways (3-7 items). If OCR_TEXT is present, expand to 6-12 items when possible.
- Tags are 3-6 short labels.
- Type can be one of: study, work, idea, task, quote, personal, research.
- Priority: low|medium|high.
- If a field is not supported by the note, return an empty array or empty string.
 - If OCR_TEXT exists, add richer Insights and Action Items when relevant.

SOURCE_TITLE: ${sourceTitle}
SOURCE_URL: ${sourceUrl}
NOTE_TYPE: ${type}
RAW_TEXT: ${text}
EXTRA_CONTEXT: ${extra}
OCR_TEXT: ${ocr}

Respond ONLY with JSON:
{
  "title": "",
  "summary": "",
  "bullets": [""],
  "tags": [""],
  "type": "",
  "priority": "low|medium|high",
  "tone": "",
  "callout": "",
  "language": "",
  "insights": [""],
  "actionItems": [""],
  "questions": [""],
  "glossary": [""]
}

${STRICT_JSON}`;
}

function buildNotesExportPrompt(notes = [], options = {}) {
  const { style = 'timeline', tone = 'creative', direction = 'ltr' } = options || {};
  const variantSeed = Date.now();
  const designPrompt = options?.designPrompt ? `USER_DESIGN_PROMPT: ${options.designPrompt}` : '';

  const compact = notes.map((n, i) => ({
    idx: i + 1,
    type: n.type || 'manual',
    language: n.ai?.language || n.language || 'auto',
    title: n.ai?.title || 'Untitled Note',
    summary: n.ai?.summary || '',
    bullets: n.ai?.bullets || [],
    insights: n.ai?.insights || [],
    actionItems: n.ai?.actionItems || [],
    questions: n.ai?.questions || [],
    glossary: n.ai?.glossary || [],
    tags: n.ai?.tags || [],
    priority: n.ai?.priority || 'medium',
    source: n.source?.title || n.source?.url || '',
    createdAt: n.createdAt || '',
    rawText: (n.raw?.text || '').slice(0, 1200),
    ocrText: (n.raw?.ocr || '').slice(0, 1200),
    hasImage: !!n.raw?.image,
    imageData: n.raw?.image || ''
  }));

  return `You are a WORLD-CLASS Document Designer + Content Expert creating STUNNING A4 printable notes.

YOUR MISSION: Create BEAUTIFUL, CONTENT-RICH professional notes that EXPAND and ENRICH the original content.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: CONTENT EXPANSION REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For EACH note, you MUST:

1. 📝 EXPAND THE SUMMARY
   - If summary is short, WRITE a comprehensive 3-5 sentence summary
   - Add context and background information
   - Explain WHY this note is important

2. 💡 ADD INSIGHTS (Even if empty)
   - Generate 3-5 relevant insights based on the note content
   - Include tips, best practices, or important considerations
   - Make them actionable and valuable

3. ✅ ADD ACTION ITEMS (Even if empty)
   - Generate 3-5 practical action items
   - Make them specific and achievable
   - Include deadlines or priority indicators

4. ❓ ADD RELATED QUESTIONS
   - Generate 2-3 thought-provoking questions
   - Questions that encourage deeper thinking

5. 📚 ADD GLOSSARY/DEFINITIONS (if relevant)
   - Define technical terms mentioned in the note
   - Provide context for abbreviations

6. 🔗 ADD RELATED TOPICS
   - Suggest 3-4 related topics for further exploration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT & DESIGN RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Output ONLY valid JSON: {"html": "...", "meta": {...}}
- HTML must include complete <style> block inside the html string
- Root container: <div class="sheet" dir="${direction}">
- NO <script> tags allowed
- A4 size: 210mm × 297mm with 15mm margins
- Maximum content height per page: 267mm (297mm - 30mm margins)
- Use page-break-after: always; between pages
- Direction: ${direction}

DESIGN STYLE: ${tone}
- Use beautiful pastels, soft gradients, professional colors
- Google Fonts: Cairo, Outfit recommended
- Include CSS for fonts in style block
- Visual elements: Emoji icons, colored borders, rounded cards
- Background: Subtle dot grid or paper texture pattern

FOR EACH NOTE, CREATE THESE SECTIONS:
┌─────────────────────────────────────────────────────────────────────┐
│ 🏷️ Type Badge (Manual/Capture) + 📅 Date                           │
├─────────────────────────────────────────────────────────────────────┤
│ 📌 TITLE - Large, prominent header                                   │
├─────────────────────────────────────────────────────────────────────┤
│ 📝 SUMMARY - Expanded comprehensive overview (3-5 paragraphs)        │
├─────────────────────────────────────────────────────────────────────┤
│ 🎯 KEY POINTS - Styled bullet list with icons                        │
├─────────────────────────────────────────────────────────────────────┤
│ 💡 INSIGHTS - AI-generated valuable insights                         │
├─────────────────────────────────────────────────────────────────────┤
│ ✅ ACTION ITEMS - Practical next steps with checkboxes               │
├─────────────────────────────────────────────────────────────────────┤
│ ❓ QUESTIONS - Thought-provoking questions                           │
├─────────────────────────────────────────────────────────────────────┤
│ 📚 GLOSSARY - Define technical terms                                 │
├─────────────────────────────────────────────────────────────────────┤
│ 🏷️ TAGS - Styled pill badges                                        │
├─────────────────────────────────────────────────────────────────────┤
│ 📎 ORIGINAL TEXT - Collapsed or styled quote block                   │
├─────────────────────────────────────────────────────────────────────┤
│ 🖼️ IMAGE - If hasImage=true, embed the base64 image                 │
└─────────────────────────────────────────────────────────────────────┘

${designPrompt}

NOTES DATA (${notes.length} notes):
${JSON.stringify(compact, null, 2)}

Respond ONLY with JSON:
{
  "html": "<style>@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Outfit:wght@400;600;700&display=swap'); .sheet{width:210mm;min-height:297mm;padding:15mm;background:#fff;font-family:'Outfit',sans-serif;} ...</style><div class='sheet' dir='${direction}'>... RICH CONTENT HERE ...</div>",
  "meta": {
    "title": "Notes Export",
    "style": "${style}",
    "tone": "${tone}",
    "direction": "${direction}",
    "noteCount": ${notes.length}
  }
}

IMPORTANT: Generate REAL, VALUABLE content. Do NOT just display the raw data - EXPAND, ENRICH, and ADD VALUE to every note!

${STRICT_JSON}`;
}

function buildNotesExportRepairPrompt(badResponse) {
  return `Fix the following model response into valid JSON only.
Rules:
- Output ONLY JSON.
- Preserve the html content as much as possible.
- Remove any markdown fences or commentary.
- Ensure JSON is valid and parseable.

BAD_RESPONSE:
${badResponse}

Respond ONLY with JSON:
{"html":"<style>...</style><div class='sheet'>...</div>","meta":{}}

${STRICT_JSON}`;
}

function buildNotesExportFallback(notes = [], options = {}) {
  const dir = options?.direction || 'ltr';
  const dateLabel = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const cards = notes.map((n, idx) => {
    const title = escapeHtml(n.ai?.title || 'Untitled Note');
    const summary = escapeHtml(n.ai?.summary || n.raw?.text?.slice(0, 300) || 'No summary available');
    const bullets = (n.ai?.bullets || []).slice(0, 5).map(b => `<li>${escapeHtml(b)}</li>`).join('');
    const insights = (n.ai?.insights || []).slice(0, 3).map(i => `<li>💡 ${escapeHtml(i)}</li>`).join('');
    const actions = (n.ai?.actionItems || []).slice(0, 3).map(a => `<li>✅ ${escapeHtml(a)}</li>`).join('');
    const tags = (n.ai?.tags || []).slice(0, 4).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const type = n.type === 'capture' ? '📷 Capture' : n.type === 'selection' ? '✂️ Selection' : '📝 Manual';
    const date = n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'Unknown';
    const hasImage = n.raw?.image ? `<img class="note-img" src="${n.raw.image}" alt="capture"/>` : '';

    return `
      <div class="note-card">
        <div class="note-header">
          <span class="note-type">${type}</span>
          <span class="note-date">${date}</span>
        </div>
        <h2 class="note-title">${title}</h2>
        ${hasImage}
        <p class="note-summary">${summary}</p>
        ${bullets ? `<div class="section"><h4>📌 Key Points</h4><ul class="bullets">${bullets}</ul></div>` : ''}
        ${insights ? `<div class="section"><h4>💡 Insights</h4><ul class="insights">${insights}</ul></div>` : ''}
        ${actions ? `<div class="section"><h4>✅ Action Items</h4><ul class="actions">${actions}</ul></div>` : ''}
        ${tags ? `<div class="tags">${tags}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Outfit:wght@400;600;700&display=swap');
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; background: #333; font-family: 'Outfit', 'Cairo', sans-serif; }
    .sheet {
      width: 210mm; min-height: 297mm; background: #ffffff;
      background-image: radial-gradient(#e5e7eb 1.5px, transparent 1.5px);
      background-size: 20px 20px;
      position: relative; margin: 20px auto; padding: 15mm;
      display: flex; flex-direction: column; box-shadow: 0 0 25px rgba(0,0,0,0.5);
    }
    @media print { body { background: none; } .sheet { margin: 0; box-shadow: none; page-break-after: always; } }
    .header {
      display: flex; justify-content: space-between; align-items: center;
      padding-bottom: 15px; border-bottom: 3px solid #1f2937; margin-bottom: 25px;
    }
    .header h1 { margin: 0; font-size: 24pt; font-weight: 800; color: #1f2937; }
    .header h1 span { color: #3b82f6; }
    .header-meta { font-size: 10pt; color: #6b7280; text-align: right; }
    .content { display: flex; flex-direction: column; gap: 20px; }
    .note-card {
      background: #fff; border-radius: 16px; padding: 20px;
      border: 1px solid #e5e7eb; box-shadow: 0 4px 6px rgba(0,0,0,0.05);
      page-break-inside: avoid;
    }
    .note-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .note-type { font-size: 11px; font-weight: 600; color: #3b82f6; background: #dbeafe; padding: 4px 10px; border-radius: 20px; }
    .note-date { font-size: 11px; color: #9ca3af; }
    .note-title { margin: 0 0 15px 0; font-size: 18pt; font-weight: 700; color: #1f2937; line-height: 1.3; }
    .note-img { width: 100%; max-height: 200px; object-fit: cover; border-radius: 12px; margin-bottom: 15px; }
    .note-summary { font-size: 11pt; color: #4b5563; line-height: 1.7; margin: 0 0 15px 0; }
    .section { margin-bottom: 15px; }
    .section h4 { margin: 0 0 8px 0; font-size: 10pt; font-weight: 600; color: #374151; }
    .bullets, .insights, .actions { margin: 0; padding-left: 20px; font-size: 10pt; color: #4b5563; line-height: 1.6; }
    .bullets li { margin-bottom: 4px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .tag { font-size: 9px; padding: 4px 10px; background: #f3f4f6; color: #4b5563; border-radius: 6px; font-weight: 500; }
    .footer {
      margin-top: auto; padding-top: 15px; border-top: 1px solid #e5e7eb;
      display: flex; justify-content: space-between; font-size: 9pt; color: #9ca3af;
    }
  </style>
  <div class="sheet" dir="${dir}">
    <div class="header">
      <h1>ZEPRA<span>NOTES</span></h1>
      <div class="header-meta">${dateLabel}<br/>Zepra AI Export</div>
    </div>
    <div class="content">${cards}</div>
    <div class="footer">
      <span>Generated by Zepra AI</span>
      <span>Page 1</span>
    </div>
  </div>`;
}


function buildPromptEnhancePrompt(text, options = {}) {
  const style = options.style || 'professional';
  const format = options.format || 'paragraph';
  return `You are an expert prompt optimizer. Your role is to transform user prompts into highly effective instructions that produce better AI responses.

TASK:
When you receive ANY user input, follow these steps automatically:

STEP 1 - ANALYZE:
- Identify the core intent and desired outcome
- Detect vague terms (good, better, nice, quickly, etc.)
- Find missing context or constraints
- Spot ambiguous references

STEP 2 - ENHANCE:
Replace vague language with specific, measurable criteria.

STEP 3 - EXPAND:
Add essential context:
- Specify format requirements
- Define tone and style
- Include success criteria
- Add relevant constraints

OUTPUT RULES:
- Respond ONLY with JSON: {"enhanced":""}
- Keep the SAME language as the input. Do NOT translate.
- Preserve meaning; improve clarity and structure.
- Format style: ${style}
- Output format: ${format}

USER_INPUT:
${text}

${STRICT_JSON}`;
}

function parseJSONSafe(txt) {
  if (!txt || typeof txt !== 'string') return null;
  const start = txt.indexOf('{');
  const end = txt.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(txt.slice(start, end + 1));
  } catch (err) {
    return null;
  }
}

async function checkSession() {
  const { loggedIn, loginTime } = await chrome.storage.local.get(['loggedIn', 'loginTime']);
  if (!loggedIn || !loginTime) {
    await forceLogout();
    return { ok: false };
  }
  const remaining = SESSION_DURATION - (Date.now() - loginTime);
  if (remaining <= 0) {
    await forceLogout();
    return { ok: false };
  }
  return { ok: true, remaining };
}

async function updatePopup() {
  const { loggedIn } = await chrome.storage.local.get('loggedIn');
  const popup = loggedIn ? 'popup.html' : 'login.html';
  await chrome.action.setPopup({ popup });
}

async function updateContextMenu() {
  const { loggedIn } = await chrome.storage.local.get('loggedIn');
  await chrome.contextMenus.removeAll();
  if (loggedIn) {
    chrome.contextMenus.create({
      id: 'sendToZepra',
      title: 'Send text to Zepra',
      contexts: ['selection'],
      documentUrlPatterns: ['<all_urls>']
    });
    chrome.contextMenus.create({
      id: 'addWebToLibrary',
      title: 'Add Website to Library  (Zepra)',
      contexts: ['page', 'link'],
      documentUrlPatterns: ['<all_urls>']
    });
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addWebToLibrary') {
    const url = info.linkUrl || info.pageUrl;
    if (url) {
      chrome.tabs.create({
        url: chrome.runtime.getURL(`library.html?addUrl=${encodeURIComponent(url)}`)
      });
    }
  } else if (info.menuItemId === 'sendToZepra' && info.selectionText) {
    // Optionally open popup or save directly
    // Ideally we pass this selection to the popup or open a specific page
    // For now, let's just open the popup and maybe store it temporarily
    chrome.storage.local.set({ tempSelection: info.selectionText }).then(() => {
      // Unfortunately standard popups cannot be opened programmatically in MV3 easily without user action 
      // unless via chrome.action.openPopup() which needs user gesture or special perm.
      // We will just save it and maybe notify user.
    });
  }
});

updatePopup();
updateContextMenu();
checkSession();
chrome.runtime.onStartup.addListener(() => {
  updatePopup();
  updateContextMenu();
  checkSession();
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.loggedIn) {
    updatePopup();
    updateContextMenu();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const cur = await chrome.storage.local.get(Object.keys(DEFAULTS));
    const toSet = {};
    for (const [k, v] of Object.entries(DEFAULTS)) if (cur[k] === undefined) toSet[k] = v;
    if (Object.keys(toSet).length) await chrome.storage.local.set(toSet);
    const { personas } = await chrome.storage.local.get('personas');
    if (!Array.isArray(personas)) {
      await chrome.storage.local.set({ personas: DEFAULT_PERSONAS });
    }
  } catch (e) {
    console.error('Error initializing defaults:', e);
  }
  updatePopup();
  updateContextMenu();
  checkSession();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'sendToZepra' && info.selectionText) {
    try {
      // Ensure content script is injected
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Wait a bit for script to load
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'SHOW_ZEPRA_MODAL',
            text: info.selectionText
          });
        } catch (e) {
          console.error('Error sending message to content script:', e);
        }
      }, 100);
    } catch (e) {
      console.error('Error injecting content script:', e);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'CEREBRAS_GENERATE': {
          const result = await callGenerativeModel(message.prompt, message.options || {});
          sendResponse({ ok: true, result });
          break;
        }
        case 'CAPTURE_AND_OCR': {
          const { rect, tabId, ocrLang } = message;
          const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
          let croppedDataUrl;
          try {
            croppedDataUrl = await cropImageInWorker(dataUrl, rect);
          } catch (e) {
            const cropResp = await chrome.tabs.sendMessage(tabId, {
              type: 'CROP_IMAGE_IN_CONTENT',
              dataUrl,
              rect
            });
            if (!cropResp?.ok) throw new Error('Crop fallback failed');
            croppedDataUrl = cropResp.dataUrl;
          }
          const text = await performOCR(croppedDataUrl, ocrLang);
          sendResponse({ ok: true, text });
          break;
        }
        case 'CAPTURE_PAGE_IMAGE': {
          try {
            const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
            sendResponse({ ok: true, dataUrl });
          } catch (err) {
            sendResponse({ ok: false, error: err?.message || String(err) });
          }
          break;
        }
        case 'CAPTURE_FULL_PAGE_OCR': {
          const { tabId, ocrLang } = message;
          const result = await captureFullPageOCR(tabId, ocrLang);
          sendResponse(result);
          break;
        }
        case 'CHECK_AUTH': {
          const res = await checkSession();
          sendResponse(res);
          break;
        }
        case 'LOGOUT': {
          await forceLogout(message.reason || 'Logged out');
          sendResponse({ ok: true });
          break;
        }
        case 'GET_PUBLIC_IP': {
          const info = await getPublicIP();
          sendResponse({ ok: true, info });
          break;
        }
        case 'GET_IP_QUALIFICATION': {
          try {
            const result = await getIPQualificationResult();
            sendResponse({ ok: true, data: result });
          } catch (err) {
            console.error('IP qualification error:', err);
            sendResponse({ ok: false, error: err?.message || String(err) });
          }
          break;
        }
        case 'TEST_IPDATA': {
          const info = await testIPData(message.key);
          sendResponse(info);
          break;
        }
        case 'SHOW_NOTIFICATION': {
          const { title, message: body } = message;
          if (title && body) {
            chrome.notifications.create('', {
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title,
              message: body
            });
            sendResponse({ ok: true });
          } else {
            sendResponse({ ok: false, error: 'Missing fields' });
          }
          break;
        }
        case 'OPEN_CUSTOM_WEB': {
          const openerTabId = message.openerTabId || sender?.tab?.id || (await getActiveTabId());
          const { customWebSize = { width: 1000, height: 800 } } = await chrome.storage.local.get('customWebSize');
          let url = `custom_web.html?tabId=${openerTabId}`;
          if (message.initialUrl) url += `&url=${encodeURIComponent(message.initialUrl)}`;
          if (message.urls) url += `&urls=${encodeURIComponent(JSON.stringify(message.urls))}`;
          await chrome.windows.create({
            url: chrome.runtime.getURL(url),
            type: 'popup',
            width: customWebSize.width || 1000,
            height: customWebSize.height || 800
          });
          sendResponse({ ok: true });
          break;
        }
        case 'OPEN_NOTES_PANEL': {
          const url = chrome.runtime.getURL('notes.html');
          await chrome.tabs.create({ url });
          sendResponse({ ok: true });
          break;
        }
        case 'OPEN_OR_FOCUS_CUSTOM_WEB': {
          const siteUrl = message.url;
          const openerTabId = message.openerTabId || sender?.tab?.id || (await getActiveTabId());
          const { customWebSize = { width: 1000, height: 800 } } = await chrome.storage.local.get('customWebSize');
          const encoded = encodeURIComponent(siteUrl || '');
          const wins = await chrome.windows.getAll({ populate: true });
          for (const win of wins) {
            const tab = (win.tabs || []).find(t => t.url && t.url.includes('custom_web.html') && t.url.includes(`url=${encoded}`));
            if (tab) {
              await chrome.windows.update(win.id, { focused: true });
              await chrome.tabs.update(tab.id, { active: true });
              sendResponse({ ok: true, focused: true });
              return;
            }
          }
          await chrome.windows.create({
            url: chrome.runtime.getURL(`custom_web.html?tabId=${openerTabId}&url=${encoded}`),
            type: 'popup',
            width: customWebSize.width || 1000,
            height: customWebSize.height || 800
          });
          sendResponse({ ok: true, created: true });
          break;
        }
        case 'GET_TAB_ID': {
          const id = sender?.tab?.id || (await getActiveTabId());
          sendResponse({ ok: true, tabId: id });
          break;
        }
        case 'RUN_CUSTOM_PROMPT': {
          const { id, text } = message;
          const { customPrompts = [] } = await chrome.storage.sync.get('customPrompts');
          const pr = customPrompts.find(p => p.id === id);
          if (!pr) { sendResponse({ ok: false, error: 'Prompt not found' }); break; }
          const settings = await chrome.storage.local.get(['personaEnabled', 'personaActiveName', 'personaActivePrompt', 'humanErrorRate']);
          const header = buildPromptHeader({
            personaEnabled: settings.personaEnabled,
            personaName: settings.personaActiveName,
            personaPrompt: settings.personaActivePrompt,
            humanErrorRate: settings.humanErrorRate,
            mode: 'custom'
          });
          const fullPrompt = `${header}${pr.text}\n\nQuestion:\n${text}\n\nAnswer:`;
          const result = await callGenerativeModel(fullPrompt, { temperature: 0.25 });
          sendResponse({ ok: true, result, promptName: pr.name });
          break;
        }
        case 'SAVE_PERSONAS': {
          const { personas = [] } = message;
          await chrome.storage.local.set({ personas });
          sendResponse({ ok: true });
          break;
        }
        case 'GET_PERSONAS': {
          const { personas = DEFAULT_PERSONAS, personaEnabled = false, personaActiveId = '', personaActiveName = '', personaActivePrompt = '' } = await chrome.storage.local.get(['personas', 'personaEnabled', 'personaActiveId', 'personaActiveName', 'personaActivePrompt']);
          sendResponse({ ok: true, personas: Array.isArray(personas) && personas.length ? personas : DEFAULT_PERSONAS, personaEnabled, personaActiveId, personaActiveName, personaActivePrompt });
          break;
        }
        case 'SET_ACTIVE_PERSONA': {
          const { persona } = message;
          if (!persona) {
            await chrome.storage.local.set({ personaEnabled: false, personaActiveId: '', personaActiveName: '', personaActivePrompt: '' });
          } else {
            await chrome.storage.local.set({ personaEnabled: true, personaActiveId: persona.id || '', personaActiveName: persona.name || '', personaActivePrompt: persona.prompt || '' });
          }
          sendResponse({ ok: true });
          break;
        }
        case 'ANALYZE_SURVEY_MEMORY': {
          try {
            const { entries = [] } = message;
            const prompt = buildSurveyInsightPrompt(entries);
            const result = await callGenerativeModel(prompt, { temperature: 0.1 });
            const analysis = parseJSONSafe(result);
            if (analysis) {
              await chrome.storage.local.set({
                surveyInsight: {
                  analysis,
                  raw: result,
                  updatedAt: Date.now(),
                  sampleSize: Array.isArray(entries) ? entries.length : 0
                }
              });
            }
            sendResponse({ ok: true, result, analysis });
          } catch (err) {
            sendResponse({ ok: false, error: err?.message || String(err) });
          }
          break;
        }
        case 'SURVEY_MEMORY_UPDATED': {
          sendResponse({ ok: true });
          break;
        }
        case 'EXPORT_PDF': {
          const { exportType, payload } = message || {};
          if (!exportType || !payload) {
            sendResponse({ ok: false, error: 'Missing export payload' });
            break;
          }
          const result = await startPdfExport(exportType, payload);
          sendResponse(result);
          break;
        }
        case 'OCR_IMAGE': {
          const { dataUrl, ocrLang } = message || {};
          if (!dataUrl) {
            sendResponse({ ok: false, error: 'Missing image data' });
            break;
          }
          const text = await performOCR(dataUrl, ocrLang);
          sendResponse({ ok: true, text });
          break;
        }
        case 'PROMPT_ENHANCE': {
          try {
            const { text = '', options = {} } = message || {};
            if (!text) { sendResponse({ ok: false, error: 'Empty input' }); break; }
            const prompt = buildPromptEnhancePrompt(text, options);
            const result = await callGenerativeModel(prompt, { temperature: 0.2, model: options?.model || undefined });
            const parsed = parseJSONSafe(result);
            if (parsed && parsed.enhanced) { sendResponse({ ok: true, enhanced: parsed.enhanced }); }
            else { sendResponse({ ok: true, enhanced: result.trim() }); }
          } catch (err) { sendResponse({ ok: false, error: err?.message || String(err) }); }
          break;
        }
        case 'GENERATE_NOTE': {
          try {
            const { payload = {}, options = {} } = message || {};
            const prompt = buildNotePrompt(payload);
            const result = await callGenerativeModel(prompt, {
              temperature: 0.2,
              model: options?.model || undefined
            });
            const note = parseJSONSafe(result);
            sendResponse({ ok: true, note, raw: result });
          } catch (err) {
            sendResponse({ ok: false, error: err?.message || String(err) });
          }
          break;
        }
        case 'GENERATE_NOTES_EXPORT': {
          try {
            const { notes = [], options = {} } = message || {};
            const prompt = buildNotesExportPrompt(notes, options);
            let result = '';
            let parsed = null;
            try {
              result = await callGenerativeModel(prompt, {
                temperature: 0.55,
                model: options?.model || undefined,
                max_completion_tokens: 8000
              });
              parsed = parseJSONSafe(result);
            } catch (err) {
              // fallback to default model if qwen is unavailable
              result = await callGenerativeModel(prompt, {
                temperature: 0.55,
                max_completion_tokens: 6000
              });
              parsed = parseJSONSafe(result);
              if (parsed?.meta) parsed.meta.modelFallback = true;
            }
            if (!parsed || !parsed.html) {
              const repairPrompt = buildNotesExportRepairPrompt(result || '');
              const repaired = await callGenerativeModel(repairPrompt, {
                temperature: 0.1,
                model: options?.model || undefined,
                max_completion_tokens: 1200
              });
              parsed = parseJSONSafe(repaired);
            }
            if (!parsed || !parsed.html) {
              const html = buildNotesExportFallback(notes, options);
              sendResponse({ ok: true, html, meta: { fallback: true } });
              break;
            }
            sendResponse({ ok: true, html: parsed.html, meta: parsed.meta || {} });
          } catch (err) {
            const html = buildNotesExportFallback(message?.notes || [], message?.options || {});
            sendResponse({ ok: true, html, meta: { fallback: true, error: err?.message || String(err) } });
          }
          break;
        }
        case 'EXPORT_PAYLOAD_REQUEST': {
          const { jobId } = message || {};
          const job = jobId ? EXPORT_JOBS.get(jobId) : null;
          if (!job) {
            sendResponse({ ok: false, error: 'Export job not found' });
            break;
          }
          sendResponse({ ok: true, payload: job.payload });
          break;
        }
        case 'EXPORT_RENDERED': {
          const { jobId } = message || {};
          const job = jobId ? EXPORT_JOBS.get(jobId) : null;
          if (!job) {
            sendResponse({ ok: false, error: 'Export job missing' });
            break;
          }
          if (!job.tabId) {
            const errorMessage = 'Export tab not ready';
            job.resolve({ ok: false, error: errorMessage });
            sendResponse({ ok: false, error: errorMessage });
            EXPORT_JOBS.delete(jobId);
            break;
          }
          try {
            await new Promise((resolve) => setTimeout(resolve, 600));
            await printTabToPdf(job.tabId, job.filename);
            if (job.windowId) {
              await chrome.windows.remove(job.windowId);
            } else {
              await chrome.tabs.remove(job.tabId);
            }
            job.resolve({ ok: true });
            sendResponse({ ok: true });
          } catch (err) {
            const errorMessage = err?.message || String(err);
            job.resolve({ ok: false, error: errorMessage });
            sendResponse({ ok: false, error: errorMessage });
          } finally {
            EXPORT_JOBS.delete(jobId);
          }
          break;
        }
        case 'GENERATE_PERSONA_PROFILE': {
          try {
            const { description = '' } = message;
            const prompt = buildPersonaGenerationPrompt(description);
            const result = await callGenerativeModel(prompt, { temperature: 0.15 });
            const persona = parseJSONSafe(result);
            if (persona) {
              if (!persona.id) persona.id = `persona_${Date.now()}`;
              if (!persona.prompt && persona.archetypePrompt) persona.prompt = persona.archetypePrompt;
            }
            sendResponse({ ok: true, result, persona });
          } catch (err) {
            sendResponse({ ok: false, error: err?.message || String(err) });
          }
          break;
        }
        case 'GENERATE_IDENTITY': {
          const { prompt } = message;
          const p = `Create a fictional persona for survey qualification based on: "${prompt}". All fields must be fully realistic with no placeholders. Set the profilePictureUrl to an empty string "" since image generation is not supported. Generate a natural email address using the persona's name and a common domain such as gmail.com, yahoo.com, or outlook.com. Create a believable password that mixes parts of the persona's name and birth year with numbers and special characters. Respond ONLY with a single JSON object containing fields: identityName, profilePictureUrl, fullName, firstName, lastName, age, email, username, password, phone, address1, address2, city, state, zipCode, country, macAddress, companyName, companyIndustry, companySize, companyAnnualRevenue, companyWebsite, companyAddress.\n${STRICT_JSON}`;
          const result = await callGenerativeModel(p, { temperature: 0.25 });
          sendResponse({ ok: true, result });
          break;
        }
        case 'GENERATE_COMPANY': {
          const p = `Generate fake but realistic company information. Respond ONLY with a JSON object containing fields: companyName, companyIndustry, companySize, companyAnnualRevenue, companyWebsite, companyAddress.\n${STRICT_JSON}`;
          const result = await callGenerativeModel(p, { temperature: 0.2 });
          sendResponse({ ok: true, result });
          break;
        }
        case 'GENERATE_FAKE_INFO': {
          const { gender, nat, force } = message;
          const data = await fetchRandomUser({ gender, nat, force });
          sendResponse({ ok: true, data });
          break;
        }
        case 'GENERATE_REAL_ADDRESS': {
          const { country = '', state = '', city = '' } = message;
          const prompt = `Generate a real mailing address based on the following details.
Country: ${country}
State/Province: ${state}
City/Zip Code: ${city}
Respond ONLY with a JSON object: {"address_1": "", "address_2": "", "zip_code": ""}
${STRICT_JSON}`;
          const result = await callGenerativeModel(prompt, { temperature: 0.2 });
          sendResponse({ ok: true, result });
          break;
        }
        case 'ANALYZE_WEBSITE': {
          const { url, note, contentOverride } = message;
          try {
            let content = contentOverride || '';
            if (!content) {
              try {
                const res = await fetch(url);
                const text = await res.text();
                // Basic HTML stripping
                const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                const body = bodyMatch ? bodyMatch[1] : text;
                content = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .slice(0, 4000);
              } catch (e) {
                content = 'Could not fetch page content. Analyze based on URL and user note only.';
              }
            }

            const prompt = `Analyze this website and provide metadata for a personal library.
URL: ${url}
User Note: ${note || 'None'}
Page Content Excerpt: ${content}

Respond ONLY with a valid JSON object:
{
  "title": "Concise main title",
  "description": "2-3 sentence summary of what this website is useful for",
  "category": "One of: tool, learning, news, entertainment, social, shopping, tech, other",
  "tags": ["array", "of", "5", "smart", "tags"]
}
${STRICT_JSON}`;

            const result = await callGenerativeModel(prompt, { temperature: 0.3 });
            const data = parseJSONSafe(result);
            if (!data) throw new Error('Failed to parse AI response');

            sendResponse({ ok: true, data });
          } catch (err) {
            sendResponse({ ok: false, error: err.message });
          }
          break;
        }
        case 'SAVE_CLIPBOARD_ITEM': {
          const { text, sourceUrl, sourceTitle } = message;
          (async () => {
            try {
              const { zepraClipboard = [], clipboardAI = false, clipboardModel = '' } = await chrome.storage.local.get(['zepraClipboard', 'clipboardAI', 'clipboardModel']);

              if (zepraClipboard.length > 0 && zepraClipboard[0].text === text) return;

              let type = 'text';
              if (/^https?:\/\//.test(text)) type = 'link';
              else if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) type = 'email';
              else if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(text)) type = 'color';
              else if (text.length > 50 && /[{};=()<>]/.test(text) && !text.includes(' ')) type = 'code';
              else if (text.split('\n').length > 3 && /[{};=()<>]/.test(text)) type = 'code';

              const newItem = {
                id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                text: text,
                type: type,
                sourceUrl: sourceUrl,
                sourceTitle: sourceTitle,
                timestamp: Date.now(),
                favorite: false,
                tags: [],
                aiSummary: ''
              };

              zepraClipboard.unshift(newItem);
              if (zepraClipboard.length > 50) zepraClipboard.pop();
              await chrome.storage.local.set({ zepraClipboard });

              if (clipboardAI && text.length > 50 && type !== 'color') {
                const prompt = `Analyze this clipboard content deeply.
Text: "${text.slice(0, 1500)}"
Source: ${sourceTitle}

Respond ONLY with this JSON structure:
{
  "title": "Ultra-concise meaningful title (max 5 words)",
  "type": "code/link/email/text/credential",
  "category": "Development/Design/Business/Personal/Other",
  "summary": "Professional concise executive summary (2 sentences max)",
  "key_points": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}
${STRICT_JSON}`;

                callGenerativeModel(prompt, { temperature: 0.2, model: clipboardModel || undefined }).then(res => {
                  const metadata = parseJSONSafe(res);
                  if (metadata) {
                    chrome.storage.local.get('zepraClipboard', (d) => {
                      const list = d.zepraClipboard || [];
                      const idx = list.findIndex(i => i.id === newItem.id);
                      if (idx > -1) {
                        list[idx].title = metadata.title;
                        list[idx].tags = metadata.tags;
                        list[idx].aiSummary = metadata.summary;
                        if (metadata.type) list[idx].type = metadata.type.toLowerCase();
                        list[idx].category = metadata.category;
                        list[idx].keyPoints = metadata.key_points;

                        chrome.storage.local.set({ zepraClipboard: list });
                      }
                    });
                  }
                }).catch(console.error);
              }
            } catch (e) { console.error('Clipboard save error', e); }
          })();
          sendResponse({ ok: true });
          break;
        }

        case 'CHAT_WITH_AI': {
          const { prompt, history = [], model = '' } = message;
          try {
            const conversation = history.map(h => `${h.role === 'user' ? 'User' : 'AI'}: ${h.text}`).join('\n');
            // Detect if user wants design/UI generation
            const designKeywords = ['تصميم', 'صمم', 'واجهة', 'موقع', 'dashboard', 'design', 'create ui', 'widget', 'button', 'card', 'layout'];
            const isDesignRequest = designKeywords.some(keyword => prompt.toLowerCase().includes(keyword));

            const fullPrompt = isDesignRequest ?
              // DESIGN MODE
              `🎨 SYSTEM ROLE: Elite Frontend Architect & Creative UI/UX Designer.

You are a visual creator. Generate professional, self-contained HTML/CSS artifacts.

🌟 DESIGN LANGUAGE (EMERALD MATRIX):
- Colors: Green (#22c55e, #10b981, #4ade80) + Dark (#000, #0a0a0a)
- Use Tailwind CSS (CDN), Glassmorphism, Modern Typography

📦 OUTPUT FORMAT (CRITICAL):
Wrap ALL design code in artifact tags:

:::artifact
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Cairo', sans-serif; }
    /* Add custom styles here */
  </style>
</head>
<body class="bg-gray-900 text-white">
  <!-- Your beautiful design here -->
</body>
</html>
:::

✨ REQUIREMENTS:
1. Self-contained (includes Tailwind CDN)
2. RTL support if Arabic
3. Responsive (mobile-first)
4. Green theme (#22c55e primary)
5. Professional and modern

Conversation History:
${conversation}

User Request: ${prompt}
AI Design:`
              :
              // ANALYSIS MODE (Default)
              `💡 SYSTEM ROLE: Zepra - Intelligent Clipboard Assistant

You are a helpful AI that analyzes, explains, and improves text. Your PRIMARY goal is to help users understand their clipboard content.

🎯 CORE BEHAVIORS:
1. Analyze & explain code/text deeply with context-aware reasoning.
2. Provide clear summaries and actionable recommendations.
3. If the user asks for data views, create concise tables or charts.
4. Respect the clipboard context; do not drift to unrelated topics.

🧾 OUTPUT FORMAT (STRICT):
Respond ONLY with valid JSON (no markdown, no extra text).
Schema:
{
  "title": "Short descriptive title",
  "summary": "2-4 sentence professional summary",
  "highlights": ["Key highlight 1", "Key highlight 2"],
  "sections": [
    { "title": "Section title", "bullets": ["Point 1", "Point 2"], "note": "Optional short note" }
  ],
  "tables": [
    { "title": "Optional table title", "headers": ["Col1", "Col2"], "rows": [["A", "B"], ["C", "D"]] }
  ],
  "charts": [
    { "title": "Optional chart title", "type": "bar", "data": [{"label": "Item", "value": 42, "color": "#38bdf8"}] }
  ],
  "actions": ["Recommendation 1", "Recommendation 2"]
}

Conversation History:
${conversation}

User Question: ${prompt}
AI Response:`;

            // Try to get a clean text response
            const response = await callGenerativeModel(fullPrompt, { temperature: 0.7, model: model || undefined });

            // Safety: Ensure response is a string
            let finalText = typeof response === 'string' ? response : JSON.stringify(response);

            // Try to extract text if it's wrapped in a JSON wrapper object (Gemini sometimes does this)
            if (finalText.trim().startsWith('{')) {
              const p = parseJSONSafe(finalText);
              if (p && p.text) finalText = p.text;
              else if (p && p.message) finalText = p.message;
              else if (p && p.candidates && p.candidates[0]) finalText = p.candidates[0].content.parts[0].text; // Raw API fallback
            }

            if (!finalText) finalText = "I apologize, but I couldn't generate a response. Please try again.";

            sendResponse({ ok: true, text: finalText });
          } catch (e) {
            sendResponse({ ok: false, error: e.message });
          }
          break;
        }

        case 'OPEN_PAGE': {
          const { page } = message;
          if (page) {
            chrome.tabs.create({ url: chrome.runtime.getURL(page) });
          }
          sendResponse({ ok: true });
          break;
        }

        case 'ANALYZE_FORM': {
          const { html = '', contextJSON = '[]', screenshot = '', identity = {} } = message;
          const identityJson = JSON.stringify(identity || {});
          const basePrompt = `You are an expert form analysis AI. Using the provided materials, return a precise JSON object mapping CSS selectors in the form to identity field keys.

Available identity field keys:
- identityName, profilePictureUrl, fullName, firstName, lastName, age, email, username, password
- phone, address1, address2, city, state, zipCode, country, macAddress
- companyName, companyIndustry, companySize, companyAnnualRevenue, companyWebsite, companyAddress

Rules:
1. Use the most specific CSS selector possible (prefer ID > name > placeholder text)
2. Only include selectors for fields that clearly match the available keys
3. Consider label text, placeholder text, name attributes, and surrounding context
4. Be conservative - only map fields you are highly confident about
5. Prioritize common form patterns and naming conventions
6. When an identity field is not available, skip that selector

FORM_HTML (truncated if huge):
${html}

FIELD_CONTEXT_JSON:
${contextJSON}

ACTIVE_IDENTITY_JSON:
${identityJson}

${STRICT_JSON}

Return format: {"#email": "email", "input[name='firstName']": "firstName"}`;

          const result = await callGenerativeModel(basePrompt, { temperature: 0.1 });
          sendResponse({ ok: true, result });
          break;
        }
        default:
          sendResponse({ ok: false, error: 'Unknown message type' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err?.message || String(err) });
    }
  })();
  return true; // async
});

async function callGenerativeModel(prompt, options = {}) {
  return callCerebras(prompt, options);
}

async function callCerebras(prompt, options = {}) {
  const { cerebrasApiKey = '', cerebrasModel } = await chrome.storage.local.get([
    'cerebrasApiKey', 'cerebrasModel'
  ]);
  if (!cerebrasApiKey) {
    const e = new Error('Missing Cerebras API key (set it in Options).');
    e.code = 401;
    throw e;
  }
  const model = options?.model || cerebrasModel || DEFAULTS.cerebrasModel;
  const endpoint = 'https://api.cerebras.ai/v1/chat/completions';
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: options?.temperature ?? 0.2,
    max_completion_tokens: options?.max_completion_tokens ?? 1024
  };
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${cerebrasApiKey}`
  };
  try {
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Cerebras error ${res.status}: ${t}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.delta?.content || '';
    return sanitize(text);
  } catch (err) {
    console.error('Zepra Debug: Cerebras fetch failed:', err);
    throw err;
  }
}

async function performOCR(imageDataUrl, lang) {
  const { ocrApiKey = '', ocrLang } = await chrome.storage.local.get(['ocrApiKey', 'ocrLang']);
  const language = lang || ocrLang || DEFAULTS.ocrLang;

  const endpoint = 'https://api.ocr.space/parse/image';
  const form = new FormData();
  form.append('language', language);
  form.append('isOverlayRequired', 'false');
  form.append('base64Image', imageDataUrl);
  if (ocrApiKey) form.append('apikey', ocrApiKey);
  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (res.status === 429) throw new Error('OCR rate limited (429)');
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OCR error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const text = data?.ParsedResults?.[0]?.ParsedText || '';
  return sanitize(text);
}

async function captureFullPageOCR(tabId, ocrLang) {
  try {
    const dims = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => ({ height: document.body.scrollHeight, viewHeight: window.innerHeight })
    });
    const shots = [];
    for (let y = 0; y < dims.result.result.value.height; y += dims.result.result.value.viewHeight) {
      await chrome.tabs.sendMessage(tabId, { type: 'SCROLL_TO', y });
      await new Promise(r => setTimeout(r, 300));
      shots.push(await chrome.tabs.captureVisibleTab({ format: 'png' }));
    }
    await chrome.tabs.sendMessage(tabId, { type: 'SCROLL_TO', y: 0 });
    const stitched = await stitchImages(shots);
    const text = await performOCR(stitched, ocrLang);
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function stitchImages(images) {
  const bitmaps = await Promise.all(images.map(async dataUrl => {
    const blob = await (await fetch(dataUrl)).blob();
    return await createImageBitmap(blob);
  }));
  const width = Math.max(...bitmaps.map(b => b.width));
  const totalHeight = bitmaps.reduce((s, b) => s + b.height, 0);
  const canvas = new OffscreenCanvas(width, totalHeight);
  const ctx = canvas.getContext('2d');
  let y = 0;
  for (const bmp of bitmaps) {
    ctx.drawImage(bmp, 0, y);
    y += bmp.height;
  }
  const blob = await canvas.convertToBlob();
  return await blobToDataURL(blob);
}

function blobToDataURL(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function getPublicIP(noKey = false) {
  const { ipdataApiKey = '' } = noKey ? {} : await chrome.storage.local.get('ipdataApiKey');
  if (!noKey && ipdataApiKey) {
    try {
      const [base, threat, carrier, asn, tz] = await Promise.all([
        fetchJSON(`https://api.ipdata.co/?api-key=${ipdataApiKey}`),
        fetchJSON(`https://api.ipdata.co/threat?api-key=${ipdataApiKey}`),
        fetchJSON(`https://api.ipdata.co/carrier?api-key=${ipdataApiKey}`),
        fetchJSON(`https://api.ipdata.co/asn?api-key=${ipdataApiKey}`),
        fetchJSON(`https://api.ipdata.co/time_zone?api-key=${ipdataApiKey}`)
      ]);

      const { score, breakdown } = computeIpdataQualificationScore({ base, threat, asn, carrier });
      const state = deriveQualificationState(score, { threat, asn, carrier });

      return {
        source: 'ipdata',
        fetchedAt: Date.now(),
        score,
        status: state.state,
        statusMessage: state.message,
        checks: state.checks,
        breakdown,
        ip: base?.ip || '',
        country: base?.country_name || base?.country_code || 'Unknown',
        city: base?.city || 'Unknown',
        postal: base?.postal || 'Unknown',
        isp: base?.asn?.name || 'Unknown',
        timezone: tz?.time_zone?.name || 'Unknown',
        raw: base
      };
    } catch (e) {
      console.error('ipdata error:', e);
    }
  }

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  const services = [
    {
      url: 'https://ipapi.co/json/',
      map: (d) => ({
        ip: d?.ip,
        country: d?.country_name || d?.country,
        city: d?.city,
        postal: d?.postal,
        isp: d?.org,
        timezone: d?.timezone
      })
    },
    {
      url: 'https://ipinfo.io/json',
      map: (d) => ({
        ip: d?.ip,
        country: d?.country,
        city: d?.city,
        postal: d?.postal,
        isp: d?.org,
        timezone: d?.timezone
      })
    },
    {
      url: 'https://ip-api.com/json/',
      map: (d) => ({
        ip: d?.query,
        country: d?.country,
        city: d?.city,
        postal: d?.zip,
        isp: d?.isp,
        timezone: d?.timezone
      })
    }
  ];

  for (const svc of services) {
    try {
      const res = await fetch(svc.url, { method: 'GET', headers });
      if (!res.ok) throw new Error(`IP API failed: ${res.status}`);
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      const info = svc.map(data);
      if (info && info.ip) {
        return {
          ip: info.ip || 'Unknown',
          country: info.country || 'Unknown',
          city: info.city || 'Unknown',
          postal: info.postal || 'Unknown',
          timezone: info.timezone || 'Unknown',
          isp: info.isp || 'Unknown'
        };
      }
    } catch (e) {
      console.error('IP service error:', svc.url, e);
    }
  }

  // Final fallback: ipify for IP only
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    if (r.ok) {
      const d = await r.json();
      return {
        ip: d?.ip || 'Unknown',
        country: 'Unknown',
        city: 'Unknown',
        postal: 'Unknown',
        timezone: 'Unknown',
        isp: 'Unknown'
      };
    }
  } catch (e) {
    console.error('Fallback IP fetch error:', e);
  }
  throw new Error('Unable to retrieve IP information');
}

function computeIpdataQualificationScore({ base = {}, threat = {}, asn = {}, carrier = {} }) {
  let score = Number.isFinite(threat?.scores?.overall)
    ? 100 - Number(threat.scores.overall)
    : 100;

  const deductions = [];

  const apply = (amount, reason) => {
    if (amount <= 0) return;
    deductions.push({ amount, reason });
    score -= amount;
  };

  if (threat.is_threat) apply(50, 'Marked as active threat');
  if (threat.is_known_attacker) apply(35, 'Known attacker IP');
  if (threat.is_known_abuser) apply(25, 'Known abusive address');
  if (threat.is_bogon) apply(20, 'Bogon network range');
  if (threat.is_vpn) apply(18, 'VPN detected');
  if (threat.is_proxy) apply(15, 'Proxy detected');
  if (threat.is_tor) apply(22, 'Tor exit node');
  if (threat.is_datacenter) apply(18, 'Datacenter or hosting range');
  if (threat.is_anonymous) apply(12, 'Anonymous network usage');

  if (Array.isArray(threat.blocklists) && threat.blocklists.length) {
    apply(Math.min(40, threat.blocklists.length * 12), `${threat.blocklists.length} blocklist hit(s)`);
  }

  if (/hosting|datacenter|infrastructure|cdn/i.test(asn?.type || '')) {
    apply(15, `ASN classified as ${asn.type}`);
  }

  if (/mobile|cellular/i.test(carrier?.name || '')) {
    apply(5, 'Mobile carrier IP (rotating risk)');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, breakdown: deductions };
}

function deriveQualificationState(score, { threat = {}, asn = {}, carrier = {} } = {}) {
  const checks = [];

  const addCheck = (label, pass, details) => {
    checks.push({ label, pass, details });
  };

  const blocklistCount = Array.isArray(threat.blocklists) ? threat.blocklists.length : 0;

  let state = 'qualified';
  let message = 'IP appears clean and ready to use.';

  if (score > 90) {
    state = 'qualified';
    message = 'Excellent reputation. This IP is good to go.';
  } else if (score >= 60) {
    state = 'warning';
    message = 'Moderate risk detected. Use with caution and monitor activity.';
  } else {
    state = 'not-qualified';
    message = 'High risk. Change your connection before continuing.';
  }

  if (threat.is_known_attacker || threat.is_known_abuser || threat.is_threat || blocklistCount > 0) {
    state = 'not-qualified';
    message = 'Malicious reputation detected. Swap your connection immediately.';
  } else if (threat.is_vpn || threat.is_proxy || threat.is_tor || threat.is_anonymous) {
    if (state === 'qualified') {
      state = 'warning';
      message = 'Anonymity tools detected. Disable them before continuing.';
    }
  } else if (/hosting|datacenter|infrastructure|cdn/i.test(asn?.type || '')) {
    if (state === 'qualified') {
      state = 'warning';
      message = 'Hosting ASN detected. Residential connections score higher.';
    }
  }

  addCheck('Score Threshold', score >= 90, `${score}/100`);
  addCheck('VPN Detection', !threat.is_vpn, threat.is_vpn ? 'VPN detected' : 'No VPN activity');
  addCheck('Proxy Detection', !threat.is_proxy, threat.is_proxy ? 'Proxy detected' : 'No proxy detected');
  addCheck('Tor Detection', !threat.is_tor, threat.is_tor ? 'Tor exit node detected' : 'Tor not detected');
  addCheck('Known Threat Lists', !(threat.is_known_attacker || threat.is_known_abuser || threat.is_threat),
    threat.is_known_attacker || threat.is_known_abuser || threat.is_threat ? 'Flagged on threat feeds' : 'No known threat flags');
  addCheck('Blocklists', blocklistCount === 0,
    blocklistCount ? `${blocklistCount} blocklist match(es)` : 'No blocklist matches');
  addCheck('ASN Type', !/hosting|datacenter|infrastructure|cdn/i.test(asn?.type || ''),
    asn?.type ? `ASN classified as ${asn.type}` : 'Not classified as hosting');
  addCheck('Carrier Type', !/mobile|cellular/i.test(carrier?.name || ''),
    /mobile|cellular/i.test(carrier?.name || '') ? `Carrier: ${carrier.name}` : 'Not a mobile carrier');

  return { state, message, checks };
}

async function fetchRandomUser({ gender = '', nat = '', force = false } = {}) {
  const cacheKey = `fi_${gender || 'any'}_${nat || 'any'}`;
  const { fakeCache = {} } = await chrome.storage.local.get('fakeCache');
  if (!force) {
    const entry = fakeCache[cacheKey];
    if (entry && Date.now() - entry.ts < 5 * 60 * 1000) {
      return entry.data;
    }
  }

  const url = new URL('https://randomuser.me/api/');
  if (gender) url.searchParams.set('gender', gender);
  if (nat) url.searchParams.set('nat', nat);
  url.searchParams.set('noinfo', '');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`RandomUser API failed: ${res.status}`);
  const data = await res.json();
  const user = data?.results?.[0];
  if (!user) throw new Error('RandomUser returned no data');
  fakeCache[cacheKey] = { ts: Date.now(), data: user };
  await chrome.storage.local.set({ fakeCache });
  return user;
}

function sanitize(s) {
  return (s || '')
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ')
    .replace(/[\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function cropImageInWorker(dataUrl, rect) {
  if (typeof OffscreenCanvas === 'undefined') throw new Error('No OffscreenCanvas');
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const sx = Math.max(0, Math.round(rect.x * rect.dpr));
  const sy = Math.max(0, Math.round(rect.y * rect.dpr));
  const sw = Math.min(bitmap.width - sx, Math.round(rect.width * rect.dpr));
  const sh = Math.min(bitmap.height - sy, Math.round(rect.height * rect.dpr));
  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  const out = await canvas.convertToBlob({ type: 'image/png' });
  const arr = await out.arrayBuffer();
  const base64 = arrayBufferToBase64(arr);
  return `data:image/png;base64,${base64}`;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0]?.id || 0;
}
