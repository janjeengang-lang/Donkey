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
  clipboardMemoryEnabled: true
};

const FRAMEWORK_PROMPTS = {
  standard: `🔥 **CORE OPTIMIZATION PROTOCOL (CO-STAR):**
1. **C (Context):** Define role and context.
2. **O (Objective):** Define clear goal.
3. **S (Style):** Define output style.
4. **T (Tone):** Set attitude.
5. **A (Audience):** Define reader.
6. **R (Response):** Define format.`,

  reasoning: `🧠 **REASONING OPTIMIZATION:**
1. Force the model to think step-by-step.
2. Demand clear logical deduction.
3. Ask for pros/cons analysis if applicable.
4. Require evidence or justification for claims.`,

  race: `🏎️ **RACE FRAMEWORK:**
1. **R (Role):** Specify the persona.
2. **A (Action):** What exactly should be done?
3. **C (Context):** The situation/background.
4. **E (Explanation):** Why is this needed?`,

  care: `❤️ **CARE FRAMEWORK:**
1. **C (Context):** The situation.
2. **A (Action):** What to do.
3. **R (Result):** Desired outcome.
4. **E (Example):** Provide an example if possible.`,

  ape: `🦍 **APE FRAMEWORK:**
1. **A (Action):** Define the task.
2. **P (Purpose):** Why are we doing this?
3. **E (Execution):** How should it be done?`,

  create: `🎨 **CREATE FRAMEWORK:**
1. **C (Character):** Role.
2. **R (Request):** Task.
3. **E (Examples):** Give examples.
4. **A (Adjustments):** Constraint/Refinement.
5. **T (Type):** Format.
6. **E (Extras):** Any other details.`,

  tag: `🏷️ **TAG FRAMEWORK:**
1. **T (Task):** The specific assignment.
2. **A (Action):** The verb/method.
3. **G (Goal):** The end result.`,

  creo: `💡 **CREO FRAMEWORK:**
1. **C (Context):** Background.
2. **R (Request):** Task.
3. **E (Explanation):** Logic/Reasoning.
4. **O (Outcome):** Final deliverable.`,

  rise: `🌅 **RISE FRAMEWORK:**
1. **R (Role):** Who is acting?
2. **I (Input):** What data is provided?
3. **S (Steps):** Process to follow.
4. **E (Execution):** Final output generation.`,

  pain: `😣 **PAIN FRAMEWORK:**
1. **P (Problem):** What is wrong?
2. **A (Action):** How to fix it?
3. **I (Information):** Data needed.
4. **N (Next Steps):** Follow-up.`,

  coast: `🌊 **COAST FRAMEWORK:**
1. **C (Context):** Situation.
2. **O (Objective):** Goal.
3. **A (Actions):** Steps.
4. **S (Scenario):** Hypothetical/Real case.
5. **T (Task):** Specific instruction.`,

  roses: `🌹 **ROSES FRAMEWORK:**
1. **R (Role):** Persona.
2. **O (Objective):** Goal.
3. **S (Scenario):** Context.
4. **E (Expected Solution):** Desired output.
5. **S (Steps):** Execution path.`
};

const CLIPBOARD_STORAGE_KEY = 'clipboardMemory';
const CLIPBOARD_MAX_ITEMS = 120;
const CLIPBOARD_TYPES = new Set(['Code Snippet', 'Web Link', 'Email Address', 'Plain Text', 'Credentials']);
const CLIPBOARD_CATEGORIES = new Set(['Development', 'Design', 'Business', 'Personal', 'Security']);

async function getClipboardState() {
  const stored = await chrome.storage.local.get(CLIPBOARD_STORAGE_KEY);
  const state = stored?.[CLIPBOARD_STORAGE_KEY];
  if (!state || typeof state !== 'object') {
    return { items: [], updatedAt: Date.now() };
  }
  const items = Array.isArray(state.items) ? state.items : [];
  return { items, updatedAt: state.updatedAt || Date.now() };
}

async function saveClipboardState(state) {
  const payload = {
    items: Array.isArray(state.items) ? state.items : [],
    updatedAt: state.updatedAt || Date.now()
  };
  await chrome.storage.local.set({ [CLIPBOARD_STORAGE_KEY]: payload });
  try {
    chrome.runtime.sendMessage({ type: 'CLIPBOARD_MEMORY_SYNC', items: payload.items, updatedAt: payload.updatedAt });
  } catch (_) {
    // ignore when no listeners are available
  }
}

async function findClipboardItem(id) {
  const state = await getClipboardState();
  const item = state.items.find((entry) => entry.id === id);
  return item ? { item, state } : { item: null, state };
}

async function updateClipboardItem(id, updater) {
  const { item, state } = await findClipboardItem(id);
  if (!item) return null;
  const idx = state.items.findIndex((entry) => entry.id === id);
  const next = { ...item };
  const patch = typeof updater === 'function' ? updater({ ...item }) : updater;
  if (patch && typeof patch === 'object') Object.assign(next, patch);
  state.items[idx] = next;
  state.updatedAt = Date.now();
  await saveClipboardState(state);
  return next;
}

async function appendClipboardChat(id, ...messages) {
  return updateClipboardItem(id, (item) => {
    const history = Array.isArray(item.chat) ? item.chat.slice() : [];
    for (const message of messages) {
      if (message && message.role && message.content) {
        history.push({ role: message.role, content: message.content, ts: message.ts || Date.now() });
      }
    }
    if (history.length > 60) history.splice(0, history.length - 60);
    return { chat: history };
  });
}

function inferClipboardHints(raw = '') {
  const text = (raw || '').trim();
  const tokens = text.split(/\s+/).slice(0, 120).join(' ');
  const looksUrl = /^https?:\/\//i.test(text) || /https?:\/\//i.test(tokens);
  const looksEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) || /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(tokens);
  const looksCode = /[{}();<>]/.test(text) && /\b(function|const|let|class|return|if|else|for|while|import|export)\b/.test(text);
  const looksCredentials = /password|passwd|secret|api[_-]?key|token|username|login/i.test(text);
  const length = text.length;
  return { looksUrl, looksEmail, looksCode, looksCredentials, length };
}

function buildClipboardAnalysisPrompt(raw = '', hints = {}) {
  return `You are Zepra Clipboard Curator. Analyze the clipboard snippet and return structured JSON.

SNIPPET (may include code or text):
${raw.slice(0, 4000)}

OBSERVED_HINTS:
${JSON.stringify(hints)}

Respond ONLY with JSON matching:
{
  "title": "Catchy descriptive title (5-7 words)",
  "summary": "Two or three sentences summarizing the clipboard content and why it matters",
  "type": "Code Snippet" | "Web Link" | "Email Address" | "Plain Text" | "Credentials",
  "category": "Development" | "Design" | "Business" | "Personal" | "Security",
  "tags": ["#tag"],
  "actionable_insight": "One short practical suggestion referencing the clipboard"
}

Rules:
- Always return valid JSON.
- Choose the most appropriate type and category.
- Tags should be 1-3 succinct keywords prefixed with #.
- Actionable insight must be specific to the content.

${STRICT_JSON}`;
}

function normalizeClipboardAnalysis(rawAnalysis = {}) {
  const output = {
    title: 'Clipboard Snippet',
    summary: '',
    type: 'Plain Text',
    category: 'Personal',
    tags: [],
    actionable_insight: ''
  };
  if (!rawAnalysis || typeof rawAnalysis !== 'object') return output;
  if (rawAnalysis.title) output.title = String(rawAnalysis.title).trim().slice(0, 120) || output.title;
  if (rawAnalysis.summary) output.summary = String(rawAnalysis.summary).trim().slice(0, 600);
  if (rawAnalysis.actionable_insight) output.actionable_insight = String(rawAnalysis.actionable_insight).trim().slice(0, 200);
  if (rawAnalysis.type && CLIPBOARD_TYPES.has(rawAnalysis.type)) output.type = rawAnalysis.type;
  if (rawAnalysis.category && CLIPBOARD_CATEGORIES.has(rawAnalysis.category)) output.category = rawAnalysis.category;
  if (Array.isArray(rawAnalysis.tags)) {
    output.tags = rawAnalysis.tags
      .map((tag) => String(tag || '').trim())
      .filter(Boolean)
      .slice(0, 6);
  }
  return output;
}

async function analyzeClipboardItem(raw, hints) {
  try {
    const prompt = buildClipboardAnalysisPrompt(raw, hints);
    const result = await callGenerativeModel(prompt, { temperature: 0.2, max_completion_tokens: 800 });
    const parsed = parseJSONSafe(result);
    if (!parsed) return null;
    return normalizeClipboardAnalysis(parsed);
  } catch (err) {
    console.error('Clipboard analysis failed:', err);
    return null;
  }
}

async function saveClipboardSnippet(rawText, meta = {}) {
  const { clipboardMemoryEnabled } = await chrome.storage.local.get('clipboardMemoryEnabled');
  if (clipboardMemoryEnabled === false) {
    return { ok: false, error: 'Clipboard Memory is disabled.' };
  }
  const text = (rawText ?? '').toString().trim();
  if (!text) {
    return { ok: false, error: 'Clipboard text is empty.' };
  }
  const state = await getClipboardState();
  const latest = state.items[0];
  if (latest && latest.raw === text) {
    return { ok: true, duplicate: true, item: latest, items: state.items, updatedAt: state.updatedAt };
  }
  const hints = inferClipboardHints(text);
  let analysis = await analyzeClipboardItem(text, hints);
  if (!analysis) {
    analysis = normalizeClipboardAnalysis({});
  }
  const entry = {
    id: `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    raw: text,
    analysis,
    meta: {
      source: meta.source || 'auto',
      pageUrl: meta.pageUrl || '',
      title: meta.title || '',
      hints
    },
    chat: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const duplicateIdx = state.items.findIndex((item) => item.raw === text);
  if (duplicateIdx !== -1) {
    state.items.splice(duplicateIdx, 1);
  }
  state.items.unshift(entry);
  if (state.items.length > CLIPBOARD_MAX_ITEMS) {
    state.items.splice(CLIPBOARD_MAX_ITEMS);
  }
  state.updatedAt = Date.now();
  await saveClipboardState(state);
  return { ok: true, item: entry, items: state.items, updatedAt: state.updatedAt };
}

async function deleteClipboardItemById(id) {
  if (!id) return { ok: false, error: 'Missing clipboard id' };
  const state = await getClipboardState();
  const nextItems = state.items.filter((item) => item.id !== id);
  if (nextItems.length === state.items.length) {
    return { ok: false, error: 'Clipboard item not found' };
  }
  state.items = nextItems;
  state.updatedAt = Date.now();
  await saveClipboardState(state);
  return { ok: true, items: state.items, updatedAt: state.updatedAt };
}

async function clearClipboardItems() {
  const state = { items: [], updatedAt: Date.now() };
  await saveClipboardState(state);
  return { ok: true, items: [], updatedAt: state.updatedAt };
}

function buildClipboardAssistantPrompt(item, history = [], question = '') {
  const trimmedHistory = Array.isArray(history) ? history.slice(-6) : [];
  const convo = trimmedHistory.map((msg, idx) => {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    return `${idx + 1}. ${role}: ${msg.content}`;
  }).join('\n');
  const analysis = item.analysis || {};

  const systemPersona = `أنت "Zepra Vision"، مبدع رقمي وخبير تقني فائق. مهمتك ليست مجرد الإجابة، بل **الإبهار**.

**بروتوكول الإبداع (إلزامي):**
1. **لا للاختصار:** قدم إجابات شاملة، مفصلة، وغنية بالمعلومات. خذ وقتك كاملاً (الحد الأقصى للتوكنز هو 32768).
2. **الإخراج البصري أولاً:** حوّل أي بيانات أو مفاهيم إلى شكل بصري (جداول، قوائم منسقة، كتل كود) كلما أمكن ذلك.
3. **استخدم Markdown المتقدم:** يجب عليك استخدام Markdown بجميع إمكانياته:
   - العناوين (مثال: \`## 💡 التحليل العميق\`).
   - القوائم النقطية والرقمية.
   - الجداول (\`| Feature | Benefit |\`).
   - كتل الكود الملونة (استخدم \`\`\`javascript\`\`\`, \`\`\`python\`\`\`, وغيرها).
   - النصوص العريضة والمائلة.
4. **كن مرناً:** إذا طلب المستخدم شيئاً خارج سياق الكليبورد، نفذه بإبداع كامل.

اتّبع الدليل المرجعي التالي عند صياغة الردود النهائية.`;

  return `${systemPersona}

المادة الأصلية المنسوخة (Raw Clipboard):
---
${item.raw || ''}
---

الرؤية التحليلية الحالية:
- العنوان: ${analysis.title || 'Clipboard Snippet'}
- الملخص: ${analysis.summary || 'N/A'}
- النوع: ${analysis.type || 'Plain Text'}
- الفئة: ${analysis.category || 'Personal'}
- الوسوم: ${(Array.isArray(analysis.tags) ? analysis.tags.join(', ') : 'None')}
- النصيحة العملية: ${analysis.actionable_insight || 'N/A'}

سجل المحادثة (آخر ${trimmedHistory.length} تبادلات):
${convo || 'None'}

سؤال المستخدم الحالي:
${question}

قواعد الإخراج:
- أعد فقط JSON بالصيغة {"answer": "..."}.
- يجب أن يكون المحتوى داخل "answer" Markdown متقدمًا مع العناوين، القوائم، الجداول، وأي كتل كود مناسبة.
- اربط الرد بالمادة المنسوخة ووسّعها بخيال مبدع دون اختلاق حقائق غير منطقية.

${STRICT_JSON}`;
}

function sanitizeAssistantAnswer(payload) {
  const parsed = parseJSONSafe(payload);
  if (!parsed || typeof parsed !== 'object') {
    return (payload || '').toString().trim();
  }
  let answer = parsed.answer || '';
  if (typeof answer !== 'string') answer = String(answer || '');
  return answer.replace(/\\n/g, '\n').trim();
}

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
  const win = await chrome.windows.create({
    url,
    type: 'popup',
    focused: false,
    width: 1,
    height: 1,
    left: -10000,
    top: -10000
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
- Bullets are key takeaways (3-7 items).
- Tags are 3-6 short labels.
- Type can be one of: study, work, idea, task, quote, personal, research.
- Priority: low|medium|high.
 - If a field is not supported by the note, return an empty array or empty string.

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
  const singleNoteHint = notes.length === 1
    ? 'Single note: expand into a full-page layout with a hero section, detailed breakdown, and visual callouts.'
    : '';
  const compact = notes.map((n, i) => ({
    idx: i + 1,
    type: n.type,
    title: n.ai?.title || '',
    summary: n.ai?.summary || '',
    bullets: n.ai?.bullets || [],
    tags: n.ai?.tags || [],
    priority: n.ai?.priority || '',
    source: n.source?.title || n.source?.url || '',
    createdAt: n.createdAt || ''
  }));
  return `You are Zepra Export Architect: a creative thinker, system designer, and expert layout engineer.
You will build a visually stunning A4 Notes layout similar to a premium journal/timeline.

Requirements:
- Output ONLY JSON with "html" and "meta".
- HTML must be self-contained: include a <style> block and a single root container.
- Do NOT include any <script> tags.
- Use A4 size (210mm x 297mm). Support multiple pages by using page containers with page-break-after.
- Direction: ${direction}. Always match the direction in your layout.
- Style: ${style}. Tone: ${tone}.
- Use a clean pastel palette and a subtle paper texture; avoid heavy dark themes.
- The layout MUST vary per export. Choose a distinct visual layout every time (timeline, scrapbook, split-columns, dashboard, or card mosaic). Do not reuse a single template.
- Always keep a smart pagination system: A4 pages with consistent margins and page-breaks.
- Each note should be styled for its meaning (priority/tags/type) with icons, accents, and a distinct card look.
- Include header, date, and a compact summary or highlights section.
- Make it modern, premium, and readable.
- Keep each note in its original language; do NOT translate content.

Design guidance (use as inspiration, not a fixed template):
- A4 sheet with tasteful texture
- Header with title + date
- Multi-section layout that fits content density
- Use visual hierarchy and consistent spacing
${singleNoteHint}

VARIANT_SEED: ${variantSeed}

NOTES_JSON:
${JSON.stringify(compact)}

Respond ONLY with JSON:
{
  "html": "<style>...</style><div class='sheet'>...</div>",
  "meta": {
    "title": "",
    "style": "${style}",
    "tone": "${tone}",
    "direction": "${direction}"
  }
}
 
${STRICT_JSON}`;
}

function buildNotesExportFallback(notes = [], options = {}) {
  const dir = options?.direction || 'ltr';
  const dateLabel = new Date().toLocaleDateString('en-US');
  const themeMap = {
    study: { cls: 'theme-study', icon: 'S', tag: 'Study' },
    work: { cls: 'theme-work', icon: 'W', tag: 'Work' },
    idea: { cls: 'theme-idea', icon: 'I', tag: 'Idea' },
    task: { cls: 'theme-task', icon: 'T', tag: 'Task' },
    quote: { cls: 'theme-quote', icon: 'Q', tag: 'Quote' },
    personal: { cls: 'theme-personal', icon: 'P', tag: 'Personal' },
    research: { cls: 'theme-research', icon: 'R', tag: 'Research' }
  };
  const cards = notes.map((n) => {
    const t = themeMap[n.ai?.type] || themeMap.idea;
    const title = (n.ai?.title || 'Untitled').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const summary = (n.ai?.summary || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
      <div class="note-card ${t.cls}">
        <div class="card-head">
          <div class="card-title">${t.icon} ${title}</div>
          <span class="tag">${t.tag}</span>
        </div>
        <div class="card-body">${summary}</div>
      </div>
    `;
  }).join('');
  return `
  <style>
    :root{
      --bg-paper:#fffcf8;--line:#e0e0e0;--text:#2d3436;--muted:#636e72;
      --study-bg:#e3f2fd;--study-border:#64b5f6;
      --work-bg:#e8f5e9;--work-border:#81c784;
      --idea-bg:#fff3e0;--idea-border:#ffb74d;
      --task-bg:#f1f8e9;--task-border:#aed581;
      --quote-bg:#f3e5f5;--quote-border:#ba68c8;
      --personal-bg:#fce4ec;--personal-border:#f48fb1;
      --research-bg:#ede7f6;--research-border:#9575cd;
    }
    @page{size:A4;margin:0;}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
    body{margin:0;padding:0;background:#444;font-family:'Inter',sans-serif;}
    .sheet{width:210mm;height:297mm;background:var(--bg-paper);background-image:radial-gradient(#e0e0e0 1px,transparent 1px);background-size:20px 20px;position:relative;margin:20px auto;padding:15mm;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 0 15px rgba(0,0,0,0.5);}
    @media print{body{background:none}.sheet{margin:0;width:210mm;height:297mm;box-shadow:none;page-break-after:always;}}
    .header{height:70px;border-bottom:3px dashed #ddd;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;}
    .header h1{margin:0;font-size:22pt;color:#6c5ce7;}
    .header-meta{font-size:9pt;color:var(--muted);text-align:${dir === 'rtl' ? 'right' : 'left'};}
    .footer{height:30px;margin-top:auto;border-top:2px solid var(--line);padding-top:5px;display:flex;justify-content:space-between;font-size:8pt;color:#888;}
    .content{position:relative;display:flex;flex-direction:column;gap:15px;}
    .timeline-line{position:absolute;top:0;bottom:0;width:2px;background:var(--line);}
    .rtl .timeline-line{right:15px;}
    .ltr .timeline-line{left:15px;}
    .note-card{position:relative;background:#fff;border-radius:10px;padding:12px 15px;box-shadow:2px 2px 5px rgba(0,0,0,0.05);z-index:1;}
    .rtl .note-card{margin-right:35px;border-right:5px solid #ccc;}
    .ltr .note-card{margin-left:35px;border-left:5px solid #ccc;}
    .rtl .note-card::after{content:'';position:absolute;right:-42px;top:15px;width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid #ccc;}
    .ltr .note-card::after{content:'';position:absolute;left:-42px;top:15px;width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid #ccc;}
    .card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;}
    .card-title{font-weight:700;font-size:11pt;color:var(--text);display:flex;align-items:center;gap:8px;}
    .card-body{font-size:10pt;color:var(--muted);line-height:1.4;}
    .tag{font-size:7pt;background:rgba(255,255,255,0.7);padding:2px 6px;border-radius:4px;font-weight:bold;}
    .theme-study{background:var(--study-bg);border-color:var(--study-border)!important;}
    .theme-study::after{border-color:var(--study-border)!important;}
    .theme-work{background:var(--work-bg);border-color:var(--work-border)!important;}
    .theme-work::after{border-color:var(--work-border)!important;}
    .theme-idea{background:var(--idea-bg);border-color:var(--idea-border)!important;}
    .theme-idea::after{border-color:var(--idea-border)!important;}
    .theme-task{background:var(--task-bg);border-color:var(--task-border)!important;}
    .theme-task::after{border-color:var(--task-border)!important;}
    .theme-quote{background:var(--quote-bg);border-color:var(--quote-border)!important;}
    .theme-quote::after{border-color:var(--quote-border)!important;}
    .theme-personal{background:var(--personal-bg);border-color:var(--personal-border)!important;}
    .theme-personal::after{border-color:var(--personal-border)!important;}
    .theme-research{background:var(--research-bg);border-color:var(--research-border)!important;}
    .theme-research::after{border-color:var(--research-border)!important;}
  </style>
  <div class="sheet ${dir}">
    <div class="header">
      <h1>Zepra Notes Export</h1>
      <div class="header-meta">Date: ${dateLabel}<br/>Zepra AI Notes</div>
    </div>
    <div class="content ${dir}">
      <div class="timeline-line"></div>
      ${cards}
    </div>
    <div class="footer">
      <span>Generated by Zepra AI</span>
      <span>Page 1</span>
    </div>
  </div>`;
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
  const { loggedIn, clipboardMemoryEnabled } = await chrome.storage.local.get(['loggedIn', 'clipboardMemoryEnabled']);
  await chrome.contextMenus.removeAll();
  if (loggedIn) {
    chrome.contextMenus.create({
      id: 'sendToZepra',
      title: 'Send to Zepra',
      contexts: ['selection'],
      documentUrlPatterns: ['<all_urls>']
    });
    if (clipboardMemoryEnabled !== false) {
      chrome.contextMenus.create({
        id: 'clipboardMemorySave',
        title: 'Save to Clipboard Memory',
        contexts: ['selection'],
        documentUrlPatterns: ['<all_urls>']
      });
    }
  }
}

updatePopup();
updateContextMenu();
checkSession();
chrome.runtime.onStartup.addListener(() => {
  updatePopup();
  updateContextMenu();
  checkSession();
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.loggedIn || changes.clipboardMemoryEnabled) {
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
    return;
  }
  if (info.menuItemId === 'clipboardMemorySave' && info.selectionText) {
    try {
      const meta = {
        source: 'context-menu',
        pageUrl: tab?.url || '',
        title: tab?.title || ''
      };
      const result = await saveClipboardSnippet(info.selectionText, meta);
      if (!result?.ok) {
        console.warn('Clipboard Memory save failed:', result?.error);
      } else {
        chrome.notifications.create('', {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Clipboard Memory',
          message: 'Snippet saved successfully.'
        });
      }
    } catch (err) {
      console.error('Clipboard Memory context save failed:', err);
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
        case 'OPEN_CLIPBOARD_MEMORY': {
          const url = chrome.runtime.getURL('clipboard.html');
          await chrome.tabs.create({ url });
          sendResponse({ ok: true });
          break;
        }
        case 'OPEN_WEBSITE_LIBRARY': {
          const url = chrome.runtime.getURL('library.html');
          await chrome.tabs.create({ url });
          sendResponse({ ok: true });
          break;
        }
        case 'ANALYZE_WEBSITE': {
          try {
            const { url, title, description, imageUrl, textContent, additionalNote = '' } = message;

            // Build AI analysis prompt
            const prompt = `Analyze this website and return ONLY valid JSON:

WEBSITE DATA:
URL: ${url}
Title: ${title}
Description: ${description}
Content Preview: ${textContent.substring(0, 500)}
${additionalNote ? `User Note: ${additionalNote}` : ''}

Respond with this EXACT JSON structure:
{
  "title": "Clean website name",
  "brief": "2-sentence description of what this site does",
  "ai_analysis": "Detailed analysis: What makes this site useful? Key features? Best use cases?",
  "category": "Tools|News|Dev|Design|Learning|Other",
  "tags": ["tag1", "tag2", "tag3"],
  "rating": 1-5
}

STRICT JSON ONLY:`;

            const result = await callGenerativeModel(prompt, {
              temperature: 0.3,
              max_completion_tokens: 500
            });

            // Parse AI response
            let analysis = {};
            try {
              const cleaned = result.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
              analysis = JSON.parse(cleaned);
            } catch (e) {
              // Fallback
              analysis = {
                title: title,
                brief: description || 'No description available',
                ai_analysis: 'Analysis unavailable',
                category: 'Other',
                tags: [],
                rating: 3
              };
            }

            // Save to storage
            const { zepraSites = [] } = await chrome.storage.local.get('zepraSites');
            const newSite = {
              id: `site_${Date.now()}`,
              url,
              imageUrl,
              additionalNote,
              savedAt: Date.now(),
              ...analysis
            };

            zepraSites.unshift(newSite);

            // Keep max 100 sites
            if (zepraSites.length > 100) {
              zepraSites.length = 100;
            }

            await chrome.storage.local.set({ zepraSites });

            sendResponse({ ok: true });
          } catch (error) {
            sendResponse({ ok: false, error: error.message });
          }
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
        case 'GENERATE_NOTE': {
          try {
            const { payload = {} } = message || {};
            const prompt = buildNotePrompt(payload);
            const result = await callGenerativeModel(prompt, { temperature: 0.2 });
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
                temperature: 0.35,
                model: options?.model || undefined,
                max_completion_tokens: 2300
              });
              parsed = parseJSONSafe(result);
            } catch (err) {
              // fallback to default model if qwen is unavailable
              result = await callGenerativeModel(prompt, {
                temperature: 0.35,
                max_completion_tokens: 1800
              });
              parsed = parseJSONSafe(result);
              if (parsed?.meta) parsed.meta.modelFallback = true;
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
        case 'SAVE_CLIPBOARD_ITEM': {
          try {
            const { text = '', meta = {} } = message;
            const result = await saveClipboardSnippet(text, meta);
            sendResponse(result);
          } catch (err) {
            sendResponse({ ok: false, error: err?.message || String(err) });
          }
          break;
        }
        case 'GET_CLIPBOARD_MEMORY': {
          try {
            const { items, updatedAt } = await getClipboardState();
            sendResponse({ ok: true, items, updatedAt });
          } catch (err) {
            sendResponse({ ok: false, error: err?.message || String(err) });
          }
          break;
        }
        case 'DELETE_CLIPBOARD_ITEM': {
          try {
            const { id } = message;
            const result = await deleteClipboardItemById(id);
            sendResponse(result);
          } catch (err) {
            sendResponse({ ok: false, error: err?.message || String(err) });
          }
          break;
        }
        case 'CLEAR_CLIPBOARD_MEMORY': {
          try {
            const result = await clearClipboardItems();
            sendResponse(result);
          } catch (err) {
            sendResponse({ ok: false, error: err?.message || String(err) });
          }
          break;
        }
        case 'CLIPBOARD_ASSISTANT_ASK': {
          try {
            const { id, question = '' } = message;
            if (!id || !question.trim()) {
              sendResponse({ ok: false, error: 'Missing clipboard id or question.' });
              break;
            }
            const { item } = await findClipboardItem(id);
            if (!item) {
              sendResponse({ ok: false, error: 'Clipboard item not found.' });
              break;
            }

            // Build conversation history
            const history = Array.isArray(item.chat) ? item.chat : [];
            const conversationContext = history.slice(-6).map(msg =>
              `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
            ).join('\n\n');

            // Build ULTRA STRICT prompt
            const isThanks = /^(thanks|thank you|شكر|شكراً|تسلم|ممتاز|جميل|ok|okay|good|great)$/i.test(question.trim());

            const prompt = `Respond with JSON: {"answer": "markdown text"}

CLIPBOARD: ${(item.raw || '').substring(0, 1000)}

${conversationContext ? `CHAT:\n${conversationContext}\n` : ''}

QUESTION: ${question}

FORMATTING RULES:
${isThanks ? '- Say ONLY "You\'re welcome!" or "العفو!"' : `- Use **bold** for important terms
- Use \`code\` for technical terms
- Use lists when appropriate
- Use tables when comparing data
- Use code blocks for code examples
- Be detailed and helpful
- Max 500 words`}
- NO decorative emojis (🚀🎯📋)
- Functional emojis OK (✓, •, →)

JSON:`;

            const result = await callGenerativeModel(prompt, {
              temperature: 0.5,
              max_completion_tokens: 8000
            });

            // Parse JSON response
            let answer = '';
            try {
              const cleaned = result.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
              const parsed = JSON.parse(cleaned);
              answer = parsed.answer || result;
            } catch (e) {
              // Fallback if not JSON
              answer = result;
            }

            // Clean only decorative emojis (keep functional ones like ✓, •, →)
            answer = answer
              .replace(/^#{1,6}\s+/gm, '')  // Remove headers
              .replace(/[🚀🎯📋🗂️🛠️📊🌟💡🔧🎨💬📝🎉🔥💪👍👏🙌]/g, '')  // Remove decorative emojis only
              .trim();

            const finalAnswer = sanitizeAssistantAnswer(answer);
            const timestamp = Date.now();

            // Save to history
            await appendClipboardChat(id,
              { role: 'user', content: question, ts: timestamp - 1 },
              { role: 'assistant', content: finalAnswer, ts: timestamp }
            );

            sendResponse({ ok: true, answer: finalAnswer });
          } catch (err) {
            sendResponse({ ok: false, error: err?.message || String(err) });
          }
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
        case 'PROMPT_ENHANCE': {
          const { text } = message;
          const { enhancementFramework = 'standard', customFrameworkPrompt = '' } = await chrome.storage.local.get(['enhancementFramework', 'customFrameworkPrompt']);

          let frameworkRules = FRAMEWORK_PROMPTS[enhancementFramework] || FRAMEWORK_PROMPTS.standard;

          if (enhancementFramework === 'custom' && customFrameworkPrompt.trim()) {
            frameworkRules = `✨ **CUSTOM USER FRAMEWORK:**\n${customFrameworkPrompt}`;
          }

          const systemPrompt = `You are Zepra, a World-Class Prompt Engineering Expert.

🌍 **CRITICAL INSTRUCTION: LANGUAGE & TERMINOLOGY**
1. **Language:** Output in the **EXACT SAME LANGUAGE** as the user's intent (Arabic -> Arabic, English -> English).
2. **Terminology:** If input is Arabic + Tech Terms, keep Tech Terms in **ENGLISH**.

🚀 **EXPANSION RULE (NO SUMMARIZATION)**
- **NEVER summarize**.
- **EXPAND** and **ELABORATE**.
- Make it **STRUCTURED** and **DETAILED**.

${frameworkRules}

🚨 **OUTPUT RULE:** 
Return ONLY a JSON object.
Format: { "enhanced": "THE_FULL_NEW_PROMPT_HERE" }`;

          const fullPrompt = `${systemPrompt}\n\nUSER INPUT:\n"${text}"\n\nENHANCED PROMPT (JSON):`;

          try {
            const result = await callGenerativeModel(fullPrompt, {
              temperature: 0.7, // Higher creativity for enhancement
              max_completion_tokens: 4096
            });

            let enhanced = '';
            try {
              const cleaned = result.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
              const parsed = JSON.parse(cleaned);
              enhanced = parsed.enhanced;
            } catch (e) {
              console.error('JSON Parse Error:', e);
              enhanced = result; // Fallback
            }
            sendResponse({ ok: true, enhanced });
          } catch (error) {
            console.error('Enhancement failed:', error);
            sendResponse({ ok: false, error: 'Enhancement failed' });
          }
          break;
        }
        case 'ADD_TO_PROFILE': {
          const { url, title, profile } = message;
          try {
            const { zepraProfiles = [] } = await chrome.storage.local.get('zepraProfiles');
            let targetProfileIndex = zepraProfiles.findIndex(p => p.name === profile);

            // Create if missing
            if (targetProfileIndex === -1) {
              zepraProfiles.push({
                name: profile,
                urls: [],
                incognito: false
              });
              targetProfileIndex = zepraProfiles.length - 1;
            }

            // Add URL if not full and not exists
            const target = zepraProfiles[targetProfileIndex];
            if (target.urls.length < 4) { // Max 4 restriction from dashboard
              if (!target.urls.includes(url)) {
                target.urls.push(url);
                await chrome.storage.local.set({ zepraProfiles });
                sendResponse({ ok: true, message: 'Added to profile' });
              } else {
                sendResponse({ ok: false, error: 'Already in profile' });
              }
            } else {
              sendResponse({ ok: false, error: 'Profile full' });
            }
          } catch (e) {
            sendResponse({ ok: false, error: e.message });
          }
          break;
        }
        case 'TRANSLATE_INSTANT': {
          try {
            const text = message.text;
            const source = message.source ? message.source.split('-')[0] : 'auto';
            const target = message.target ? message.target.split('-')[0] : 'en';

            // User's Personal Google Script Proxy
            const scriptId = "AKfycbwr_wUJRVy1c0o6buTMlRLRgq1rFTsgNGKJD4hv6KUv6VHcprx7l1GtkkHHzhQ9d8fFRQ";
            const scriptUrl = `https://script.google.com/macros/s/${scriptId}/exec`;
            const finalUrl = `${scriptUrl}?text=${encodeURIComponent(text)}&source=${source}&target=${target}`;

            const res = await fetch(finalUrl);
            if (res.ok) {
              const translatedText = await res.text();
              if (translatedText.includes("<!DOCTYPE html>") || translatedText.includes("Error")) {
                sendResponse({ ok: false, error: 'Script Deployment Error' });
              } else {
                sendResponse({ ok: true, text: translatedText });
              }
            } else {
              sendResponse({ ok: false, error: 'Network Error' });
            }
          } catch (e) {
            sendResponse({ ok: false, error: e.message });
          }
          break;
        }

        // --- SMART DUBBING ---
        case 'OPEN_SCOUT': {
          chrome.windows.create({
            url: message.url,
            type: 'popup',
            width: 400,
            height: 300,
            left: 0,
            top: 0
          });
          sendResponse({ ok: true });
          break;
        }

        case 'BUFFER_PUSH': {
          const entry = {
            text: message.text,
            startTime: message.startTime,
            id: Date.now() + Math.random()
          };
          // Use a global buffer (defined at top or attached to window) - strictly dealing with variable scope later
          if (!globalThis.translationBuffer) globalThis.translationBuffer = [];
          globalThis.translationBuffer.push(entry);
          if (globalThis.translationBuffer.length > 200) globalThis.translationBuffer.shift();
          sendResponse({ ok: true });
          break;
        }

        case 'BUFFER_PULL': {
          if (!globalThis.translationBuffer) globalThis.translationBuffer = [];
          const currentTime = message.currentTime;
          const matches = globalThis.translationBuffer.filter(t => Math.abs(t.startTime - currentTime) < 0.8);
          globalThis.translationBuffer = globalThis.translationBuffer.filter(t => Math.abs(t.startTime - currentTime) >= 0.8);
          sendResponse({ matches: matches });
          break;
        }

        // NO DEFAULT CASE - Allow other listeners to handle other messages
      }
    } catch (err) {
      sendResponse({ ok: false, error: err?.message || String(err) });
    }
  })();
  return true; // async
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_MARKET_TOOL') {
    const { url } = message;
    // Open in standalone popup window (Focus Mode)
    chrome.windows.create({
      url,
      type: 'popup',
      state: 'maximized'
    }, (win) => {
      if (win && win.tabs && win.tabs.length > 0) {
        managedMarketTabs.add(win.tabs[0].id);
      }
    });
  }
});

// Watch for Managed Tabs Loading to inject Header
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (managedMarketTabs.has(tabId) && changeInfo.status === 'complete') {
    // Inject the Header logic
    // We send a message to content.js. 
    // Note: content.js is already injected by manifest, so we just signal it.
    chrome.tabs.sendMessage(tabId, { type: 'SHOW_ZEPRA_HEADER' }).catch(err => {
      console.log("Could not send header message (maybe restricted domain):", err);
    });
  }
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  if (managedMarketTabs.has(tabId)) {
    managedMarketTabs.delete(tabId);
  }
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

  // Build messages array with optional system prompt
  const messages = [];
  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    messages: messages,
    temperature: options?.temperature ?? 0.2,
    max_completion_tokens: options?.maxTokens || options?.max_completion_tokens || 500
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

// ============================================
// ZEPRA LIVE DUBBING COORDINATOR
// ============================================

class DubbingAPIService {
  constructor() {
    this.apiKey = null;
    this.apiUrl = "https://api.cerebras.ai/v1/chat/completions";
    this.init();
  }

  async init() {
    // Try to get key from storage, else use default if user set it elsewhere
    const data = await chrome.storage.local.get(['cerebras_key', 'api_key']);
    if (data.cerebras_key) this.apiKey = data.cerebras_key;
    else if (data.api_key) this.apiKey = data.api_key;
  }

  async sendRequest(messages) {
    if (!this.apiKey) await this.init();
    if (!this.apiKey) throw new Error("API Key not found");

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b', messages: messages, temperature: 0.3, max_completion_tokens: 250 })
    });
    if (!response.ok) throw new Error("API Request Failed");
    return await response.json();
  }
}

class DubbingCoordinator {
  constructor() {
    this.apiService = new DubbingAPIService();
    this.setupListeners();
    this.activeTabId = null;
    this.targetLanguage = 'Arabic';
  }

  setupListeners() {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'START_DUBBING_SESSION') {
        const tabId = sender.tab ? sender.tab.id : null;
        if (tabId) this.startSession(tabId, msg.language);
      }
      if (msg.type === 'STOP_DUBBING_SESSION') this.stopSession();

      // Step 1: Receive Raw Text from Offscreen -> Forward to Content Script for Batching
      if (msg.type === 'TRANSCRIPTION_RESULT') {
        this.broadcast({ type: 'RAW_TRANSCRIPT', text: msg.text });
      }

      // Step 2: Receive Batched Text from Content Script -> Translate via API
      if (msg.type === 'TRANSLATE_BATCH') {
        this.processBatchTranslation(msg.text, msg.targetLanguage)
          .then(translated => this.broadcast({ type: 'BATCH_TRANSLATED', original: msg.text, translated: translated }))
          .catch(err => console.error("Batch Translation Failed:", err));
      }

      if (msg.type === 'AI_MODEL_STATUS') {
        this.broadcast({ type: 'DUB_STATUS', status: msg.status, progress: msg.progress, state: msg.status });
      }
    });
  }

  async startSession(tabId, language) {
    this.activeTabId = tabId;
    this.targetLanguage = language || 'Arabic';
    try {
      await this.setupOffscreen();
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
        if (!streamId) return;
        chrome.runtime.sendMessage({ type: 'START_PROCESSING', streamId: streamId, language: 'auto' });
        this.broadcast({ type: 'DUB_STATUS', status: 'Listening (Buffered)...', state: 'PLAYING' });
        this.broadcast({ type: 'DUB_AUDIO_START' });
      });
    } catch (e) { console.error("Dubbing Start Error:", e); }
  }

  async setupOffscreen() {
    const existingContexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (existingContexts.length > 0) return;
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK', 'USER_MEDIA'],
      justification: 'Zepra Live Dubbing Processing'
    });
    await new Promise(r => setTimeout(r, 500));
    chrome.runtime.sendMessage({ type: 'INIT_AI' });
  }

  // New: Process Validated Batch
  async processBatchTranslation(text, targetLang) {
    if (!text || text.length < 2) return "";
    try {
      const systemPrompt = `You are a professional Simultaneous Interpreter. Translate the following text into ${targetLang || "Arabic"}. output ONLY the translated text. Do not add idioms or explanations. Output pure translation.`;
      const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }];
      const response = await this.apiService.sendRequest(messages);
      return response?.choices?.[0]?.message?.content || "";
    } catch (e) {
      console.error("API Error in Batch:", e);
      return "[Translation Error]";
    }
  }

  stopSession() {
    chrome.runtime.sendMessage({ type: 'STOP_PROCESSING' });
    this.broadcast({ type: 'DUB_AUDIO_END' });
  }

  broadcast(msg) {
    if (this.activeTabId) chrome.tabs.sendMessage(this.activeTabId, msg).catch(() => { });
  }

  mapLangCode(langName) {
    // Kept for fallback, but main mapping should happen in TTS logic in Manager
    if (!langName) return 'ar-SA';
    if (langName.includes('Arabic')) return 'ar-SA';
    if (langName.includes('English')) return 'en-US';
    return 'ar-SA';
  }
}

// Initialize
const dubbingCoordinator = new DubbingCoordinator();

// --- ZEPRA v2.0 ENGINE HANDLERS ---

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Live Speech Recognition for Dubbing'
  });
}

// --- ZEPRA TIME MACHINE: BROKER & BUFFER ---
// Global Buffer for Lookahead Subtitles
let timeMachineBuffer = [];
let scoutWindowId = null; // Track open Scout window to prevent duplicates

// Clean buffer every 30 seconds
setInterval(() => {
  const now = Date.now();
  // Remove items older than 5 minutes to prevent memory leaks
  if (timeMachineBuffer.length > 500) {
    timeMachineBuffer = timeMachineBuffer.slice(-200);
  }
}, 30000);

// Unified Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Wrap in async IIFE to support await
  (async () => {
    try {
      switch (message.type) {
        // --- SCOUT & BUFFER LOGIC ---
        case 'OPEN_SCOUT': {
          // Prevent duplicate Scout windows
          if (scoutWindowId !== null) {
            console.log("[BROKER] Scout already open, ignoring request");
            sendResponse({ ok: true, existing: true });
            break;
          }

          try {
            const originalUrl = message.url;
            console.log("[BROKER] Opening Scout for:", originalUrl);

            // Create window (hidden off-screen)
            const win = await chrome.windows.create({
              url: originalUrl,
              type: 'popup',
              width: 400,
              height: 300,
              left: -2000,  // Hidden off-screen
              top: -2000,
              focused: false
            });

            if (win && win.tabs && win.tabs.length > 0) {
              scoutWindowId = win.id; // Track the window
              const tabId = win.tabs[0].id;
              console.log("[BROKER] Scout window created, ID:", win.id, "Tab:", tabId);

              // Clean up when Scout window is closed
              chrome.windows.onRemoved.addListener((closedId) => {
                if (closedId === scoutWindowId) {
                  scoutWindowId = null;
                  console.log("[BROKER] Scout window closed");
                }
              });

              // Wait for page to load, then activate
              const activateScout = (tid, changeInfo, tab) => {
                if (tid === tabId && changeInfo.status === 'complete') {
                  console.log("[BROKER] Scout page loaded, sending activation...");
                  chrome.tabs.onUpdated.removeListener(activateScout);
                  chrome.tabs.sendMessage(tabId, { type: 'FORCE_ACTIVATE_SCOUT' })
                    .then(() => console.log("[BROKER] Activation sent OK"))
                    .catch(e => console.log("[BROKER] Activation send failed:", e));
                }
              };
              chrome.tabs.onUpdated.addListener(activateScout);

              // Fallback activation
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { type: 'FORCE_ACTIVATE_SCOUT' }).catch(() => { });
              }, 5000);
            }
            sendResponse({ ok: true });
          } catch (e) {
            console.error("[BROKER] OPEN_SCOUT Error:", e);
            sendResponse({ ok: false, error: e.message });
          }
          break;
        }

        case 'BUFFER_PUSH': {
          // Scout sending future subtitle
          const entry = {
            text: message.text,
            startTime: message.startTime,
            id: Date.now() + Math.random()
          };
          timeMachineBuffer.push(entry);
          timeMachineBuffer.sort((a, b) => a.startTime - b.startTime);
          sendResponse({ ok: true });
          break;
        }

        case 'BUFFER_CLEAR': {
          console.log("[BROKER] Buffer cleared. Was:", timeMachineBuffer.length, "items");
          timeMachineBuffer = [];
          sendResponse({ ok: true });
          break;
        }

        case 'CLOSE_SCOUT': {
          if (scoutWindowId !== null) {
            console.log("[BROKER] Closing Scout window:", scoutWindowId);
            chrome.windows.remove(scoutWindowId).catch(() => { });
            scoutWindowId = null;
          }
          sendResponse({ ok: true });
          break;
        }

        case 'BUFFER_PULL': {
          // Old method - keep for compatibility
          const currentTime = message.currentTime;
          const matches = [];
          for (const item of timeMachineBuffer) {
            const timeDiff = currentTime - item.displayAt;
            if (timeDiff >= -0.3 && timeDiff <= 1.5 && !item.displayed) {
              matches.push({ text: item.text, id: item.id, needsSpeak: !item.spoken });
              item.displayed = true;
            }
          }
          timeMachineBuffer = timeMachineBuffer.filter(item => item.displayAt > (currentTime - 5));
          sendResponse({ matches: matches, bufferSize: timeMachineBuffer.length });
          break;
        }

        case 'BUFFER_PULL_NEXT': {
          // Simple FIFO - get next undelivered item
          let nextItem = null;
          for (const item of timeMachineBuffer) {
            if (!item.delivered) {
              nextItem = { text: item.text, id: item.id };
              item.delivered = true;
              break;
            }
          }
          // Cleanup old delivered items (keep last 20)
          if (timeMachineBuffer.length > 30) {
            timeMachineBuffer = timeMachineBuffer.slice(-20);
          }
          sendResponse({ item: nextItem, bufferSize: timeMachineBuffer.length });
          break;
        }

        // --- LEGACY / UTILITY LOGIC ---
        case 'TRANSLATE_INSTANT': {
          // Google Apps Script Proxy (fast but basic)
          try {
            const { text, source, target } = message;
            const s = source ? source.split('-')[0] : 'auto';
            const t = target ? target.split('-')[0] : 'en';

            const scriptId = "AKfycbwr_wUJRVy1c0o6buTMlRLRgq1rFTsgNGKJD4hv6KUv6VHcprx7l1GtkkHHzhQ9d8fFRQ";
            const finalUrl = `https://script.google.com/macros/s/${scriptId}/exec?text=${encodeURIComponent(text)}&source=${s}&target=${t}`;

            const res = await fetch(finalUrl);
            if (res.ok) {
              const txt = await res.text();
              if (txt.includes('<!DOCTYPE html>') || txt.includes('Error')) {
                sendResponse({ ok: false, error: 'Proxy Deployment Error' });
              } else {
                sendResponse({ ok: true, text: txt });
              }
            } else {
              sendResponse({ ok: false, error: 'Network Error' });
            }
          } catch (e) {
            sendResponse({ ok: false, error: e.message });
          }
          break;
        }

        case 'TRANSLATE_FOR_SYNC': {
          // LLM Translation with timestamp tracking (Cerebras - fast!)
          try {
            const { text, videoTime, source, target } = message;

            if (!text || videoTime === undefined) {
              console.error("[BROKER] Invalid TRANSLATE_FOR_SYNC payload");
              sendResponse({ ok: false, error: 'Invalid payload' });
              break;
            }

            console.log(`[BROKER] LLM Translate @ ${videoTime.toFixed(1)}s: "${text.substring(0, 40)}..."`);

            // Use Cerebras LLM for professional translation
            const prompt = `Translate this to English. Return ONLY the translation:\n"${text}"`;

            const translatedText = await callGenerativeModel(prompt, {
              systemPrompt: 'You are a subtitle translator. Translate to English. Return ONLY the translation, nothing else.',
              maxTokens: 200
            });

            // Clean up result
            let cleanText = (translatedText || text).trim();
            cleanText = cleanText.replace(/^["']|["']$/g, ''); // Remove quotes
            cleanText = cleanText.replace(/^Translation:\s*/i, ''); // Remove prefix

            // Store in buffer
            const entry = {
              text: cleanText,
              displayAt: videoTime,
              id: `sync-${videoTime.toFixed(2)}-${Date.now()}`,
              spoken: false,
              displayed: false,
              delivered: false
            };
            timeMachineBuffer.push(entry);
            timeMachineBuffer.sort((a, b) => a.displayAt - b.displayAt);

            console.log(`[BROKER] ✓ Buffered @ ${videoTime.toFixed(1)}s: "${cleanText.substring(0, 30)}..." (Queue: ${timeMachineBuffer.length})`);

            sendResponse({ ok: true, queued: true, bufferSize: timeMachineBuffer.length });
          } catch (e) {
            console.error("[BROKER] LLM Error:", e.message);
            // Fallback: queue original text so user at least sees something
            if (message.text && message.videoTime !== undefined) {
              timeMachineBuffer.push({
                text: message.text,
                displayAt: message.videoTime,
                id: `fallback-${message.videoTime.toFixed(2)}-${Date.now()}`,
                spoken: false,
                displayed: false,
                delivered: false
              });
              console.log(`[BROKER] Fallback queued original text`);
            }
            sendResponse({ ok: true, fallback: true, error: e.message });
          }
          break;
        }

        case 'CEREBRAS_GENERATE': {
          const result = await callGenerativeModel(message.prompt, message.options || {});
          sendResponse({ ok: true, result });
          break;
        }

        case 'TRANSLATE_BATCH': {
          const targetLanguage = message.targetLanguage || 'English';
          const rawSegments = Array.isArray(message.segments) ? message.segments : [];
          if (rawSegments.length > 0) {
            const segments = rawSegments.map((segment) => String(segment || '').trim()).filter(Boolean);
            if (segments.length === 0) {
              sendResponse({ translatedSegments: [], translated: '' });
              break;
            }
            const prompt = `Translate each line into ${targetLanguage}. Return ONLY the translations, one per line, same order, no numbering or extra text.\n\n${segments.join('\n')}`;
            const result = await callGenerativeModel(prompt, {
              temperature: 0.2,
              max_completion_tokens: 500,
              model: 'llama-3.3-70b'
            });
            const cleanResult = result.replace(/^[`'"]+|[`'"]+$/g, '').trim();
            let lines = cleanResult.split(/\r?\n/).map((line) => line.replace(/^(Translation:|Answer:)\s*/i, '').trim()).filter(Boolean);
            if (lines.length === 1 && segments.length > 1) {
              lines = [cleanResult.trim()];
            }
            const translatedSegments = segments.map((_, index) => lines[index] || lines[0] || '');
            sendResponse({ translatedSegments, translated: translatedSegments.join(' ') });
            break;
          }

          const prompt = `Translate the following subtitle text to ${targetLanguage}. Return ONLY the translation, no quotes, no explanation. Text: ${message.text}`;
          const result = await callGenerativeModel(prompt, { temperature: 0.3, max_completion_tokens: 250, model: 'llama-3.3-70b' });
          let clean = result.replace(/^(Here is|Translation:|Answer:)/i, '').replace(/^[\`'\""]+|[\`'\""]+$/g, '').trim();
          if (clean.startsWith('{')) { try { clean = JSON.parse(clean).answer || clean; } catch (e) { } }
          sendResponse({ translated: clean });
          break;
        }

        case 'CMD_OFFSCREEN_START': {
          try {
            await ensureOffscreen();
            setTimeout(() => { chrome.runtime.sendMessage(message).catch(() => { }); }, 500);
            sendResponse({ ok: true });
          } catch (e) {
            sendResponse({ ok: false, error: e.message });
          }
          break;
        }

        case 'CMD_OFFSCREEN_STOP': {
          chrome.runtime.sendMessage(message).catch(() => { });
          sendResponse({ ok: true });
          break;
        }

        case 'OFFSCREEN_TRANSCRIPT':
        case 'OFFSCREEN_VOLUME':
        case 'OFFSCREEN_ERROR': {
          // Forward to all tabs
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.id && tab.url && tab.url.startsWith('http')) {
              chrome.tabs.sendMessage(tab.id, message).catch(() => { });
            }
          }
          // No sendResponse needed usually, but good to close
          sendResponse({ ok: true });
          break;
        }

        default:
          return; // Ignore unknown messages
      }
    } catch (e) {
      console.error("BG Listener Error:", e);
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // Keep channel open
});

// End of Zepra Background Script
