const els = {
  insightCard: document.getElementById('insightCard'),
  memoryStream: document.getElementById('memoryStream'),
  refreshInsight: document.getElementById('refreshInsight'),
  exportMemory: document.getElementById('exportMemory'),
  exportMemoryPdf: document.getElementById('exportMemoryPdf'),
  clearMemory: document.getElementById('clearMemory'),
  totalEntries: document.getElementById('totalEntries'),
  confidenceLevel: document.getElementById('confidenceLevel'),
};

const STATE = {
  entries: [],
  insight: null,
  loadingInsight: false,
};

init();

async function init() {
  await loadData();
  attachEvents();
  chrome.storage.onChanged.addListener(handleStorageChange);
}

async function loadData() {
  const { contextQA = [], surveyInsight = null } = await chrome.storage.local.get(['contextQA', 'surveyInsight']);
  STATE.entries = Array.isArray(contextQA) ? contextQA.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)) : [];
  STATE.insight = surveyInsight || null;
  updateStats();
  renderInsight();
  renderEntries();
}

function updateStats() {
  if (els.totalEntries) els.totalEntries.textContent = STATE.entries.length;
  if (els.confidenceLevel) {
    const conf = STATE.insight?.analysis?.confidence;
    els.confidenceLevel.textContent = conf ? formatConfidence(conf) : '—';
  }
}

function attachEvents() {
  els.refreshInsight?.addEventListener('click', refreshInsight);
  els.exportMemory?.addEventListener('click', exportMemory);
  els.exportMemoryPdf?.addEventListener('click', exportMemoryPdf);
  els.clearMemory?.addEventListener('click', clearMemory);
}

async function refreshInsight() {
  if (!STATE.entries.length) {
    toast('No entries to analyze yet.');
    return;
  }
  if (STATE.entries.length < 8) {
    toast('Answer at least 8 questions to generate insights.', 'warn');
    return;
  }
  if (STATE.loadingInsight) return;
  STATE.loadingInsight = true;
  renderInsight(true);
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'ANALYZE_SURVEY_MEMORY', entries: STATE.entries.slice(-200).reverse() });
    if (!resp?.ok) throw new Error(resp?.error || 'Analysis unavailable');
    STATE.insight = resp.analysis || null;
    updateStats();
    renderInsight();
    toast('Insight updated successfully.');
  } catch (err) {
    renderInsight(false, err.message || 'Analysis failed');
    toast('Failed to refresh insight: ' + (err.message || err), 'error');
  } finally {
    STATE.loadingInsight = false;
  }
}

async function exportMemory() {
  if (!STATE.entries.length) {
    toast('No entries available for export.', 'warn');
    return;
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    totalEntries: STATE.entries.length,
    insight: STATE.insight,
    entries: STATE.entries.map(normalizeEntry)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zepra-memory-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Memory exported successfully.');
}

async function exportMemoryPdf() {
  if (!STATE.entries.length) {
    toast('No entries available for export.', 'warn');
    return;
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    totalEntries: STATE.entries.length,
    insight: STATE.insight,
    entries: STATE.entries.map(normalizeEntry)
  };
  showExportOverlay('Rendering your PDF...');
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'EXPORT_PDF',
      exportType: 'memory',
      payload
    });
    if (!resp?.ok) throw new Error(resp?.error || 'PDF export failed');
    toast('Memory PDF downloaded.');
  } catch (err) {
    toast(`Failed to export PDF: ${err.message || err}`, 'error');
  } finally {
    hideExportOverlay();
  }
}

async function clearMemory() {
  if (!confirm('Clear the entire AI memory? This action cannot be undone.')) return;
  await chrome.storage.local.set({ contextQA: [], surveyInsight: null });
  STATE.entries = [];
  STATE.insight = null;
  updateStats();
  renderInsight();
  renderEntries();
  toast('All memory entries removed.', 'warn');
}

function renderInsight(forceLoading = false, errorMsg = null) {
  if (!els.insightCard) return;
  els.insightCard.innerHTML = '';

  if (forceLoading || STATE.loadingInsight) {
    els.insightCard.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚙️</div>
        <div>Running survey analysis...</div>
      </div>
    `;
    return;
  }

  if (errorMsg) {
    els.insightCard.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div style="color:#f87171;">${escapeHTML(errorMsg)}</div>
      </div>
    `;
    return;
  }

  const insight = STATE.insight?.analysis;
  if (!insight || typeof insight !== 'object') {
    els.insightCard.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <div>Not enough data yet.<br>Answer more questions to unlock insights.</div>
      </div>
    `;
    return;
  }

  const sampleSize = STATE.insight?.sampleSize || STATE.entries.length;
  const confidence = formatConfidence(insight.confidence);

  els.insightCard.innerHTML = `
    <div style="background:rgba(0,220,130,0.1);border:1px solid rgba(0,220,130,0.3);border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="font-size:0.85rem;color:#00dc82;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">✨ Automated Analysis</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-left:3px solid #00dc82;border-radius:12px;padding:16px;">
        <div style="font-size:0.85rem;color:#00dc82;font-weight:600;margin-bottom:8px;">🎯 Survey Objective</div>
        <div style="color:#f8fafc;line-height:1.6;">${escapeHTML(insight.objective || 'Not identified yet')}</div>
      </div>
      <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-left:3px solid #38bdf8;border-radius:12px;padding:16px;">
        <div style="font-size:0.85rem;color:#38bdf8;font-weight:600;margin-bottom:8px;">👤 Target Persona</div>
        <div style="color:#f8fafc;line-height:1.6;">${escapeHTML(insight.targetPersona || 'Not identified yet')}</div>
      </div>
      <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-left:3px solid #a78bfa;border-radius:12px;padding:16px;">
        <div style="font-size:0.85rem;color:#a78bfa;font-weight:600;margin-bottom:8px;">🔑 Key Signals</div>
        ${renderSignals(insight.keySignals)}
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);font-size:0.85rem;color:#94a3b8;">
      <span>Total answers: <strong style="color:#00dc82;">${sampleSize}</strong></span>
      <span>Confidence: <strong style="color:#a78bfa;">${confidence}</strong></span>
    </div>
  `;
}

function renderEntries() {
  if (!els.memoryStream) return;
  els.memoryStream.innerHTML = '';

  if (!STATE.entries.length) {
    els.memoryStream.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div>No responses stored yet.<br>Generate answers and they'll appear here.</div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  STATE.entries.forEach((entry, index) => {
    const card = document.createElement('article');
    card.className = 'memory-card';
    const ts = entry.ts ? formatDate(entry.ts) : 'Unknown';
    const question = entry.q || '';
    // Show only first 5 words
    const words = question.split(' ');
    const truncated = words.length > 5 ? words.slice(0, 5).join(' ') + '...' : question;

    card.innerHTML = `
      <div class="memory-header">
        <div class="memory-index">ENTRY ${String(index + 1).padStart(3, '0')}</div>
        <div class="memory-time">🕐 ${ts}</div>
      </div>
      <div class="memory-question">${escapeHTML(truncated)}</div>
      <div class="memory-footer">
        <button class="view-btn" data-index="${index}">
          <span>👁️</span> View Details
        </button>
      </div>
    `;

    card.querySelector('.view-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      showModal(entry, index);
    });

    fragment.appendChild(card);
  });

  els.memoryStream.appendChild(fragment);
}

function showModal(entry, index) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">ENTRY ${String(index + 1).padStart(3, '0')}</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-section">
        <div class="modal-label">❓ Question</div>
        <div class="modal-text">${escapeHTML(entry.q || '')}</div>
      </div>
      <div class="modal-section">
        <div class="modal-label">💬 Answer</div>
        <div class="modal-text">${escapeHTML(entry.a || '')}</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" data-copy="${encodeURIComponent(entry.a || '')}">
          <span>📋</span> Copy Answer
        </button>
        <button class="btn modal-close-btn">
          <span>✕</span> Close
        </button>
      </div>
    </div>
  `;

  modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-close-btn')?.addEventListener('click', () => modal.remove());
  modal.querySelector('[data-copy]')?.addEventListener('click', () => {
    copyAnswer(entry.a || '');
    modal.remove();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
}

function renderSignals(signals) {
  if (!Array.isArray(signals) || !signals.length) {
    return '<div style="color:#94a3b8;">No specific signals yet.</div>';
  }
  return `<ul style="margin:0;padding-left:20px;color:#f8fafc;line-height:1.7;">${signals.map(sig => `<li>${escapeHTML(sig)}</li>`).join('')}</ul>`;
}

function formatConfidence(val) {
  const normalized = String(val || '').toLowerCase();
  switch (normalized) {
    case 'low': return 'Low';
    case 'medium': return 'Medium';
    case 'high': return 'High';
    default: return 'Unknown';
  }
}

function formatDate(ts) {
  try {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Unknown';
  }
}

function normalizeEntry(entry) {
  return {
    q: entry.q || '',
    a: entry.a || '',
    promptName: entry.promptName || '',
    personaId: entry.personaId || '',
    ts: entry.ts || null
  };
}

function copyAnswer(text) {
  if (!text) return;
  navigator.clipboard.writeText(text)
    .then(() => toast('Answer copied to clipboard.'))
    .catch(() => toast('Failed to copy answer.', 'error'));
}

function toast(message, type = 'info') {
  const existing = document.getElementById('memory-toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'memory-toast';
  el.style.cssText = `
    position: fixed;
    bottom: 32px;
    right: 32px;
    padding: 16px 24px;
    border-radius: 16px;
    backdrop-filter: blur(20px);
    background: rgba(15,20,25,0.95);
    border: 1px solid ${typeColor(type)};
    color: #f8fafc;
    font-family: 'Poppins', sans-serif;
    font-size: 0.95rem;
    font-weight: 500;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    z-index: 9999;
    animation: slideIn 0.3s ease;
  `;

  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function typeColor(type) {
  switch (type) {
    case 'error': return 'rgba(244,63,94,0.6)';
    case 'warn': return 'rgba(250,204,21,0.6)';
    default: return 'rgba(0,220,130,0.6)';
  }
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showExportOverlay(label) {
  let overlay = document.getElementById('memory-export-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'memory-export-overlay';
    overlay.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:20px;background:rgba(15,20,25,0.95);padding:48px 64px;border-radius:24px;border:1px solid rgba(0,220,130,0.3);backdrop-filter:blur(20px);">
        <div style="width:60px;height:60px;border:4px solid rgba(148,163,184,0.2);border-top-color:#00dc82;border-radius:50%;animation:spin 1s linear infinite;"></div>
        <div style="font-weight:700;color:#f8fafc;font-size:1.2rem;">${label}</div>
        <div style="font-size:0.95rem;color:#94a3b8;">Please wait...</div>
      </div>
    `;
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(12px);
    `;
    const style = document.createElement('style');
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    overlay.appendChild(style);
    document.body.appendChild(overlay);
  }
}

function hideExportOverlay() {
  const overlay = document.getElementById('memory-export-overlay');
  if (overlay) overlay.remove();
}

async function handleStorageChange(changes, area) {
  if (area !== 'local') return;
  if (changes.contextQA || changes.surveyInsight) {
    await loadData();
  }
}
