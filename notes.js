const state = {
  notes: [],
  selectionMode: false,
  selected: new Set(),
  search: '',
  filterType: 'all',
  filterTag: 'all',
  dir: 'ltr'
};

const els = {
  grid: document.getElementById('notesGrid'),
  empty: document.getElementById('emptyState'),
  total: document.getElementById('totalNotes'),
  selected: document.getElementById('selectedNotes'),
  lastUpdated: document.getElementById('lastUpdated'),
  search: document.getElementById('searchInput'),
  filterType: document.getElementById('filterType'),
  filterTag: document.getElementById('filterTag'),
  toggleDir: document.getElementById('toggleDir'),
  exportBar: document.getElementById('exportBar'),
  exportCount: document.querySelector('.export-count'),
  exportStyle: document.getElementById('exportStyle'),
  generateModel: document.getElementById('generateModel'),
  exportPrompt: document.getElementById('exportPrompt'),
  savePrompt: document.getElementById('savePrompt'),
  promptLibrary: document.getElementById('promptLibrary'),
  exportModel: document.getElementById('exportModel'),
  exportTone: document.getElementById('exportTone'),
  btnExportMode: document.getElementById('btnExportMode'),
  btnGenerateExport: document.getElementById('btnGenerateExport'),
  btnCancelExport: document.getElementById('btnCancelExport'),
  btnOpenHub: document.getElementById('btnOpenHub'),
  loading: document.getElementById('loadingOverlay')
};

init();

function init() {
  document.documentElement.dir = state.dir;
  els.toggleDir.textContent = state.dir.toUpperCase();
  loadNotes();
  bindEvents();
  bindNotesPreferences();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.zepraNotes) {
      state.notes = changes.zepraNotes.newValue || [];
      render();
    }
  });
}

function bindEvents() {
  els.search.addEventListener('input', (e) => {
    state.search = e.target.value.trim().toLowerCase();
    render();
  });
  els.filterType.addEventListener('change', (e) => {
    state.filterType = e.target.value;
    render();
  });
  els.filterTag.addEventListener('change', (e) => {
    state.filterTag = e.target.value;
    render();
  });
  els.toggleDir.addEventListener('click', () => {
    state.dir = state.dir === 'rtl' ? 'ltr' : 'rtl';
    document.documentElement.dir = state.dir;
    els.toggleDir.textContent = state.dir.toUpperCase();
  });
  els.btnExportMode.addEventListener('click', toggleSelectionMode);
  els.btnCancelExport.addEventListener('click', () => setSelectionMode(false));
  els.btnGenerateExport.addEventListener('click', generateExport);
  els.btnOpenHub.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_NOTES_PANEL' });
  });
}

async function bindNotesPreferences() {
  const prefs = await chrome.storage.local.get([
    'notesGenerateModel',
    'notesDesignPresets',
    'notesDesignPrompt'
  ]);
  if (els.generateModel) els.generateModel.value = prefs.notesGenerateModel || '';
  if (els.exportPrompt) els.exportPrompt.value = prefs.notesDesignPrompt || '';
  hydratePresets(Array.isArray(prefs.notesDesignPresets) ? prefs.notesDesignPresets : []);

  els.generateModel?.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ notesGenerateModel: e.target.value || '' });
  });
  els.savePrompt?.addEventListener('click', async () => {
    const value = (els.exportPrompt?.value || '').trim();
    if (!value) return;
    const { notesDesignPresets = [] } = await chrome.storage.local.get('notesDesignPresets');
    const list = Array.isArray(notesDesignPresets) ? notesDesignPresets : [];
    const next = list.includes(value) ? list : [value, ...list];
    const trimmed = next.slice(0, 12);
    await chrome.storage.local.set({
      notesDesignPresets: trimmed,
      notesDesignPrompt: value
    });
    hydratePresets(trimmed);
  });
  els.promptLibrary?.addEventListener('change', async (e) => {
    const value = e.target.value || '';
    if (els.exportPrompt) els.exportPrompt.value = value;
    await chrome.storage.local.set({ notesDesignPrompt: value });
  });
}

function hydratePresets(presets) {
  if (!els.promptLibrary) return;
  const opts = ['<option value="">Design presets</option>']
    .concat(presets.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`));
  els.promptLibrary.innerHTML = opts.join('');
}

async function loadNotes() {
  const { zepraNotes = [] } = await chrome.storage.local.get('zepraNotes');
  state.notes = Array.isArray(zepraNotes) ? zepraNotes : [];
  render();
}

function render() {
  const filtered = filterNotes(state.notes);
  els.grid.innerHTML = filtered.map(renderCard).join('');
  els.empty.style.display = filtered.length ? 'none' : 'block';
  els.total.textContent = String(state.notes.length);
  els.selected.textContent = String(state.selected.size);
  els.lastUpdated.textContent = state.notes.length ? formatDate(state.notes[0]?.createdAt) : '--';
  hydrateCardEvents();
  updateTagOptions();
  updateExportCount();
}

function filterNotes(notes) {
  return notes.filter((note) => {
    if (state.filterType !== 'all' && note.type !== state.filterType) return false;
    if (state.filterTag !== 'all') {
      const tags = note.ai?.tags || [];
      if (!tags.includes(state.filterTag)) return false;
    }
    if (state.search) {
      const hay = [
        note.ai?.title,
        note.ai?.summary,
        note.raw?.text,
        note.raw?.extra,
        (note.ai?.tags || []).join(' ')
      ].join(' ').toLowerCase();
      if (!hay.includes(state.search)) return false;
    }
    return true;
  });
}

function renderCard(note) {
  const tags = (note.ai?.tags || []).slice(0, 4);
  const chip = note.type === 'capture' ? 'Capture' : note.type === 'selection' ? 'Select' : 'Manual';
  const createdAt = formatDate(note.createdAt);
  const title = escapeHtml(note.ai?.title || 'Untitled Note');
  const summary = escapeHtml(note.ai?.summary || note.raw?.text || '');
  const thumb = note.raw?.image ? `<img class="note-thumb" src="${note.raw.image}" alt="capture" />` : '';
  const source = note.source?.title || note.source?.url || '';
  const sourceLabel = source ? `- ${escapeHtml(source)}` : '';
  const lang = (note.ai?.language || note.language || 'auto').toLowerCase();
  const selectedClass = state.selected.has(note.id) ? 'selected' : '';
  return `
    <article class="note-card ${selectedClass}" data-id="${note.id}">
      <div class="note-select">OK</div>
      <div class="note-chip">${chip} - ${lang.toUpperCase()}</div>
      <div class="note-title">${title}</div>
      ${thumb}
      <div class="note-summary">${summary}</div>
      <div class="note-tags">
        ${tags.map(tag => `<span class="note-tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div class="note-footer">
        <span>${createdAt}</span>
        <span>${sourceLabel}</span>
      </div>
      <div class="note-actions">
        <button data-action="expand">Open</button>
        <button data-action="copy">Copy</button>
      </div>
    </article>
  `;
}

function hydrateCardEvents() {
  els.grid.querySelectorAll('.note-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="expand"]')) {
        const note = getNote(card.dataset.id);
        if (note) showDetail(note);
        return;
      }
      if (e.target.closest('[data-action="copy"]')) {
        const note = getNote(card.dataset.id);
        if (note) copyNote(note);
        return;
      }
      if (state.selectionMode) {
        toggleSelect(card.dataset.id);
      }
    });
  });
}

function updateTagOptions() {
  const tags = new Set();
  state.notes.forEach((note) => (note.ai?.tags || []).forEach(t => tags.add(t)));
  const opts = ['all', ...Array.from(tags)];
  els.filterTag.innerHTML = opts.map(tag => `<option value="${tag}">${tag === 'all' ? 'All tags' : escapeHtml(tag)}</option>`).join('');
  els.filterTag.value = state.filterTag;
}

function setSelectionMode(val) {
  state.selectionMode = val;
  document.body.classList.toggle('selection-mode', val);
  els.exportBar.classList.toggle('hidden', !val);
  if (!val) {
    state.selected.clear();
    updateExportCount();
  }
}

function toggleSelectionMode() {
  setSelectionMode(!state.selectionMode);
}

function toggleSelect(id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  updateExportCount();
  render();
}

function updateExportCount() {
  els.exportCount.textContent = String(state.selected.size);
  els.selected.textContent = String(state.selected.size);
}

async function generateExport() {
  if (!state.selected.size) {
    alert('Select at least one note');
    return;
  }
  const selectedNotes = state.notes.filter(n => state.selected.has(n.id));
  const dir = detectDirection(selectedNotes);
  const style = resolveExportStyle(els.exportStyle.value);
  const options = {
    style,
    tone: els.exportTone.value,
    direction: dir,
    model: els.exportModel?.value || '',
    designPrompt: (els.exportPrompt?.value || '').trim()
  };
  showLoading(true);
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'GENERATE_NOTES_EXPORT',
      notes: selectedNotes,
      options
    });
    if (!res?.ok) throw new Error(res?.error || 'Export generation failed');
    const payload = {
      html: res.html || '',
      meta: res.meta || {},
      generatedAt: Date.now()
    };
    await chrome.storage.local.set({ notesExportPayload: payload });
    const exportRes = await chrome.runtime.sendMessage({
      type: 'EXPORT_PDF',
      exportType: 'notes',
      payload
    });
    if (!exportRes?.ok) throw new Error(exportRes?.error || 'PDF export failed');
    setSelectionMode(false);
  } catch (err) {
    alert(`Export failed: ${err.message || err}`);
  } finally {
    showLoading(false);
  }
}

function detectDirection(notes) {
  const hasArabic = notes.some(n => ['ar', 'mixed'].includes(n.ai?.language || n.language));
  return hasArabic ? 'rtl' : 'ltr';
}

function resolveExportStyle(selected) {
  if (selected && selected !== 'auto') return selected;
  const styles = ['timeline', 'scrapbook', 'split-columns', 'dashboard', 'card-mosaic', 'journal', 'board', 'mindmap'];
  return styles[Math.floor(Math.random() * styles.length)];
}

function showDetail(note) {
  const lang = note.ai?.language || note.language || 'auto';
  const isRtl = lang === 'ar' || lang === 'mixed';
  const modal = document.createElement('div');
  modal.className = 'note-modal';
  const tags = (note.ai?.tags || []).slice(0, 6).map(t => `<span class="nm-tag">${escapeHtml(t)}</span>`).join('');
  const bullets = (note.ai?.bullets || []).slice(0, 6).map(b => `<li>${escapeHtml(b)}</li>`).join('');
  const insights = (note.ai?.insights || []).slice(0, 6).map(i => `<li>${escapeHtml(i)}</li>`).join('');
  const actions = (note.ai?.actionItems || []).slice(0, 6).map(i => `<li>${escapeHtml(i)}</li>`).join('');
  const questions = (note.ai?.questions || []).slice(0, 6).map(i => `<li>${escapeHtml(i)}</li>`).join('');
  const glossary = (note.ai?.glossary || []).slice(0, 6).map(i => `<li>${escapeHtml(i)}</li>`).join('');
  modal.innerHTML = `
    <div class="note-modal-card">
      <div class="note-modal-header">
        <div>
          <div class="nm-title">${escapeHtml(note.ai?.title || 'Note')}</div>
          <div class="nm-meta">${formatDate(note.createdAt)} - ${escapeHtml(note.source?.title || note.source?.url || '')}</div>
        </div>
        <button class="note-modal-close">X</button>
      </div>
      <div class="note-modal-body ${isRtl ? 'rtl' : 'ltr'}">
        <div class="nm-left">
          <div class="nm-summary">${escapeHtml(note.ai?.summary || '')}</div>
          ${bullets ? `<ul class="nm-bullets">${bullets}</ul>` : ''}
          ${tags ? `<div class="nm-tags">${tags}</div>` : ''}
          ${insights ? `<div class="nm-section"><div class="nm-label">Insights</div><ul>${insights}</ul></div>` : ''}
          ${actions ? `<div class="nm-section"><div class="nm-label">Action Items</div><ul>${actions}</ul></div>` : ''}
          ${questions ? `<div class="nm-section"><div class="nm-label">Open Questions</div><ul>${questions}</ul></div>` : ''}
          ${glossary ? `<div class="nm-section"><div class="nm-label">Glossary</div><ul>${glossary}</ul></div>` : ''}
          ${note.raw?.text ? `<div class="nm-raw"><span>Original</span>${escapeHtml(note.raw.text)}</div>` : ''}
          ${note.raw?.ocr ? `<div class="nm-raw"><span>OCR</span>${escapeHtml(note.raw.ocr)}</div>` : ''}
        </div>
        <div class="nm-right">
          ${note.raw?.image ? `<img class="nm-image" src="${note.raw.image}" alt="capture" />` : '<div class="nm-image placeholder">No image</div>'}
        </div>
      </div>
    </div>
  `;
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.86);display:flex;align-items:center;justify-content:center;z-index:50;padding:20px;';
  const cardStyle = `
    background:linear-gradient(160deg,rgba(15,23,42,.98),rgba(6,10,16,.95));
    border-radius:20px;padding:22px;max-width:980px;width:100%;color:#fff;position:relative;
    border:1px solid rgba(255,255,255,0.08);box-shadow:0 25px 60px rgba(0,0,0,.45);
  `;
  modal.querySelector('.note-modal-card').style.cssText = cardStyle;
  const extraStyles = document.createElement('style');
  extraStyles.textContent = `
    .note-modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
    .nm-title{font-size:22px;font-weight:800}
    .nm-meta{font-size:12px;color:#9fb0c7;margin-top:4px}
    .note-modal-close{background:rgba(255,255,255,0.08);border:none;color:#fff;width:34px;height:34px;border-radius:10px;font-size:20px;cursor:pointer}
    .note-modal-body{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}
    .nm-summary{font-size:14px;color:#e2e8f0;line-height:1.7;margin-bottom:12px}
    .nm-bullets{margin:0 0 12px;padding-left:18px;color:#cbd5e1;font-size:13px;line-height:1.6}
    .nm-section{margin-bottom:12px}
    .nm-section .nm-label{font-size:11px;color:#8ea0b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
    .nm-section ul{margin:0;padding-left:18px;color:#cbd5e1;font-size:13px;line-height:1.6}
    .nm-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
    .nm-tag{background:rgba(0,220,130,.12);color:#7df5b7;padding:4px 8px;border-radius:999px;font-size:11px;border:1px solid rgba(0,220,130,.25)}
    .nm-raw{background:rgba(255,255,255,0.04);border:1px solid rgba(148,163,184,.2);border-radius:10px;padding:10px;font-size:12px;color:#cbd5e1;margin-bottom:10px}
    .nm-raw span{display:block;font-size:10px;color:#8ea0b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
    .nm-image{width:100%;border-radius:14px;object-fit:cover;min-height:220px;border:1px solid rgba(255,255,255,0.08)}
    .nm-image.placeholder{display:flex;align-items:center;justify-content:center;color:#94a3b8;background:rgba(255,255,255,0.03)}
    .note-modal-body.rtl{direction:rtl;text-align:right}
    .note-modal-body.ltr{direction:ltr;text-align:left}
    @media(max-width:900px){.note-modal-body{grid-template-columns:1fr}}
  `;
  modal.appendChild(extraStyles);
  modal.querySelector('.note-modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function copyNote(note) {
  const text = [
    note.ai?.title,
    note.ai?.summary,
    note.raw?.text,
    note.raw?.ocr
  ].filter(Boolean).join('\n');
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {}
}

function getNote(id) {
  return state.notes.find(n => n.id === id);
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showLoading(val) {
  els.loading.classList.toggle('hidden', !val);
}
