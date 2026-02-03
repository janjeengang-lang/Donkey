// DEFAULTS
const DEFAULTS = {
  // Theme & API
  cerebrasApiKey: '',
  cerebrasModel: 'gpt-oss-120b',
  ocrApiKey: '',
  ipdataApiKey: '',
  primaryColor: '#39ff14',

  // Typing
  typingSpeed: 'normal',

  // Voice & Translation (NEW)
  voiceInputLanguage: 'ar-EG',
  enableTranslation: false,
  translationTargetLanguage: 'English',

  // Reasoning
  showReasoning: false,
  reasonLang: 'English',
  humanErrorRate: 0,

  // Features
  autofillWithAI: false,
  clipboardMemoryEnabled: true,
  enableAdditionalNote: false,

  // OCR
  ocrLang: 'eng',

  // Prompt Enhancer
  enhancementFramework: 'standard',
  promptEnhanceConfirm: false,
  customFrameworkPrompt: '',

  // Window Size
  customWebSize: { width: 1000, height: 800 },

  // Ask Zepra
  askZepraEnabled: true,
  askZepraIcon: true,
  askZepraShortcut: 'F1',

  // Personas
  personaEnabled: false,
  personaActiveId: '',
  personaActiveName: '',
  personaActivePrompt: '',
  personas: [
    { id: 'marketing_pro', name: 'Marketing Pro', prompt: 'You are a Marketing Expert. Focus on ROI, branding, and engagement.' },
    { id: 'senior_dev', name: 'Senior Developer', prompt: 'You are a Senior Developer. Provide clean, efficient, and well-documented code.' },
    { id: 'casual_friend', name: 'Casual Friend', prompt: 'You are a helpful friend. Speak naturally, use emojis, and be supportive.' }
  ]
};

// DOM Elements
const els = {
  // Theme & API
  primaryColor: document.getElementById('primaryColor'),
  cerebrasKey: document.getElementById('cerebrasKey'),
  ocrKey: document.getElementById('ocrKey'),
  ipdataKey: document.getElementById('ipdataKey'),
  testIpdata: document.getElementById('testIpdata'),

  // Model & Typing
  cerebrasModel: document.getElementById('cerebrasModel'),
  typingSpeed: document.getElementById('typingSpeed'),

  // Voice & Translation
  voiceInputLanguage: document.getElementById('voiceInputLanguage'),
  enableTranslation: document.getElementById('enableTranslation'),
  translationTargetLanguage: document.getElementById('translationTargetLanguage'),
  targetLangGroup: document.getElementById('targetLangGroup'),

  // Reasoning
  showReasoning: document.getElementById('showReasoning'),
  reasonLang: document.getElementById('reasonLang'),
  humanErrorRate: document.getElementById('humanErrorRate'),
  humanErrorValue: document.getElementById('humanErrorValue'),
  openPersonas: document.getElementById('openPersonas'),

  // Features
  autofillWithAI: document.getElementById('autofillWithAI'),
  clipboardMemoryEnabled: document.getElementById('clipboardMemoryEnabled'),
  enableAdditionalNote: document.getElementById('enableAdditionalNote'),

  // OCR
  ocrLang: document.getElementById('ocrLang'),

  // Enhancer
  promptEnhanceConfirm: document.getElementById('promptEnhanceConfirm'),
  enhancementFramework: document.getElementById('enhancementFramework'),
  customFrameworkPrompt: document.getElementById('customFrameworkPrompt'),
  customPromptContainer: document.getElementById('customPromptContainer'),

  // Custom Web
  webWidth: document.getElementById('webWidth'),
  webHeight: document.getElementById('webHeight'),

  // Ask Zepra
  askZepraEnabled: document.getElementById('askZepraEnabled'),
  askZepraIcon: document.getElementById('askZepraIcon'),
  askZepraShortcut: document.getElementById('askZepraShortcut'),

  // Custom Prompts Logic
  promptName: document.getElementById('promptName'),
  promptTags: document.getElementById('promptTags'),
  promptHotkey: document.getElementById('promptHotkey'),
  promptText: document.getElementById('promptText'),
  savePrompt: document.getElementById('savePrompt'),
  cancelPrompt: document.getElementById('cancelPrompt'),
  promptTableBody: document.querySelector('#promptTable tbody'),
  promptForm: document.getElementById('promptForm'),

  // Custom Sites Logic
  siteName: document.getElementById('siteName'),
  siteUrl: document.getElementById('siteUrl'),
  addSite: document.getElementById('addSite'),
  sitesList: document.getElementById('sitesList'),

  // General UI
  navLinks: document.querySelectorAll('.nav-link'),
  sections: document.querySelectorAll('.content-section'),
  saveBar: document.getElementById('saveBar'),
  saveChanges: document.getElementById('saveChanges'),
  resetChanges: document.getElementById('resetChanges'),
  statusMessage: document.getElementById('statusMessage'),
  closeModal: document.getElementById('closeModal'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  navIndicator: document.querySelector('.nav-indicator')
};

// State
let initialSettings = {};
let currentSettings = {};
let hasUnsavedChanges = false;

// ---------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSettings();
  setupNavigation();
  setupEventListeners();
  loadCustomPrompts();
  loadCustomSites();
  updateSaveBar();
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  currentSettings = { ...DEFAULTS, ...stored };
  initialSettings = JSON.parse(JSON.stringify(currentSettings));
  applySettingsToUI();
}

function applySettingsToUI() {
  // Theme & API
  els.primaryColor.value = currentSettings.primaryColor || DEFAULTS.primaryColor;
  els.cerebrasKey.value = currentSettings.cerebrasApiKey || '';
  els.ocrKey.value = currentSettings.ocrApiKey || '';
  els.ipdataKey.value = currentSettings.ipdataApiKey || '';

  // Model & Typing
  els.cerebrasModel.value = currentSettings.cerebrasModel || DEFAULTS.cerebrasModel;
  els.typingSpeed.value = currentSettings.typingSpeed || DEFAULTS.typingSpeed;

  // Voice & Translation
  els.voiceInputLanguage.value = currentSettings.voiceInputLanguage || DEFAULTS.voiceInputLanguage;
  els.enableTranslation.checked = currentSettings.enableTranslation || false;
  els.translationTargetLanguage.value = currentSettings.translationTargetLanguage || DEFAULTS.translationTargetLanguage;
  // Visibility Logic
  if (els.targetLangGroup) {
    els.targetLangGroup.style.display = els.enableTranslation.checked ? 'block' : 'none';
  }

  // Reasoning
  els.showReasoning.checked = currentSettings.showReasoning;
  els.reasonLang.value = currentSettings.reasonLang || '';
  els.humanErrorRate.value = currentSettings.humanErrorRate || 0;
  els.humanErrorValue.textContent = (currentSettings.humanErrorRate || 0) + '%';

  // Features
  els.autofillWithAI.checked = currentSettings.autofillWithAI;
  els.clipboardMemoryEnabled.checked = currentSettings.clipboardMemoryEnabled;
  els.enableAdditionalNote.checked = currentSettings.enableAdditionalNote || false;

  // OCR
  els.ocrLang.value = currentSettings.ocrLang || 'eng';

  // Enhancer
  els.promptEnhanceConfirm.checked = currentSettings.promptEnhanceConfirm;
  els.enhancementFramework.value = currentSettings.enhancementFramework || 'standard';
  els.customFrameworkPrompt.value = currentSettings.customFrameworkPrompt || '';
  toggleCustomPromptContainer();

  // Window Size
  els.webWidth.value = currentSettings.customWebSize?.width || 1000;
  els.webHeight.value = currentSettings.customWebSize?.height || 800;

  // Ask Zepra
  els.askZepraEnabled.checked = currentSettings.askZepraEnabled;
  els.askZepraIcon.checked = currentSettings.askZepraIcon;
  els.askZepraShortcut.value = currentSettings.askZepraShortcut || 'F1';

  // Apply visual theme immediately
  document.documentElement.style.setProperty('--primary-color', currentSettings.primaryColor);
}

// ---------------------------------------------------------
// UI LOGIC
// ---------------------------------------------------------

function setupNavigation() {
  els.navLinks.forEach((link, index) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      els.navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const itemHeight = 56;
      els.navIndicator.style.transform = `translateY(${index * itemHeight}px)`;
      const targetId = link.getAttribute('data-section');
      els.sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === targetId) {
          setTimeout(() => section.classList.add('active'), 100);
        }
      });
    });
  });
}

function setupEventListeners() {
  // Generic input listeners
  const inputs = [
    els.primaryColor, els.cerebrasKey, els.ocrKey, els.ipdataKey,
    els.cerebrasModel, els.typingSpeed, els.reasonLang,
    els.webWidth, els.webHeight, els.askZepraShortcut,
    els.ocrLang, els.enhancementFramework, els.customFrameworkPrompt,
    els.voiceInputLanguage, els.translationTargetLanguage
  ];

  const checkboxes = [
    els.showReasoning, els.autofillWithAI, els.clipboardMemoryEnabled,
    els.promptEnhanceConfirm, els.askZepraEnabled, els.askZepraIcon,
    els.enableAdditionalNote, els.enableTranslation
  ];

  inputs.forEach(input => {
    if (!input) return;
    input.addEventListener('input', () => {
      updateStateFromUI();
      checkForChanges();
    });
  });

  checkboxes.forEach(box => {
    if (!box) return;
    box.addEventListener('change', () => {
      updateStateFromUI();
      checkForChanges();
    });
  });

  // Toggle Visibility for Translation
  if (els.enableTranslation) {
    els.enableTranslation.addEventListener('change', () => {
      if (els.targetLangGroup) {
        els.targetLangGroup.style.display = els.enableTranslation.checked ? 'block' : 'none';
      }
    });
  }

  // Specific listeners
  if (els.humanErrorRate) {
    els.humanErrorRate.addEventListener('input', (e) => {
      els.humanErrorValue.textContent = e.target.value + '%';
      updateStateFromUI();
      checkForChanges();
    });
  }

  if (els.enhancementFramework) {
    els.enhancementFramework.addEventListener('change', toggleCustomPromptContainer);
  }

  if (els.saveChanges) els.saveChanges.addEventListener('click', saveSettings);

  if (els.resetChanges) {
    els.resetChanges.addEventListener('click', () => {
      currentSettings = JSON.parse(JSON.stringify(initialSettings));
      applySettingsToUI();
      checkForChanges();
      showStatus('Changes reset.', 'success');
    });
  }

  if (els.closeModal) els.closeModal.addEventListener('click', () => window.close());

  // API Tests
  if (els.testIpdata) {
    els.testIpdata.addEventListener('click', async () => {
      const key = els.ipdataKey.value.trim();
      if (!key) return showStatus('Enter an API key first.', 'error');
      showLoading(true);
      try {
        const res = await chrome.runtime.sendMessage({ type: 'TEST_IPDATA', key });
        if (res.ok || res.ip) showStatus('Connection Successful!', 'success');
        else showStatus('Connection Failed: ' + (res.error || 'Unknown'), 'error');
      } catch (e) { showStatus('Error: ' + e.message, 'error'); }
      showLoading(false);
    });
  }

  if (els.openPersonas) els.openPersonas.addEventListener('click', () => {
    alert('Advance Persona Manager coming soon! Use the JSON edit in background.js for now if needed.');
  });

  // Custom Prompts
  if (els.savePrompt) els.savePrompt.addEventListener('click', saveCustomPrompt);
  if (els.cancelPrompt) els.cancelPrompt.addEventListener('click', clearPromptForm);

  // Custom Sites
  if (els.addSite) els.addSite.addEventListener('click', addCustomSite);
}

function updateStateFromUI() {
  currentSettings.primaryColor = els.primaryColor.value;
  currentSettings.cerebrasApiKey = els.cerebrasKey.value.trim();
  currentSettings.ocrApiKey = els.ocrKey.value.trim();
  currentSettings.ipdataApiKey = els.ipdataKey.value.trim();

  currentSettings.cerebrasModel = els.cerebrasModel.value;
  currentSettings.typingSpeed = els.typingSpeed.value;

  currentSettings.voiceInputLanguage = els.voiceInputLanguage.value;
  currentSettings.enableTranslation = els.enableTranslation.checked;
  currentSettings.translationTargetLanguage = els.translationTargetLanguage.value;

  currentSettings.showReasoning = els.showReasoning.checked;
  currentSettings.reasonLang = els.reasonLang.value.trim();
  currentSettings.humanErrorRate = parseInt(els.humanErrorRate.value, 10);

  currentSettings.autofillWithAI = els.autofillWithAI.checked;
  currentSettings.clipboardMemoryEnabled = els.clipboardMemoryEnabled.checked;
  currentSettings.enableAdditionalNote = els.enableAdditionalNote.checked;

  currentSettings.ocrLang = els.ocrLang.value;

  currentSettings.promptEnhanceConfirm = els.promptEnhanceConfirm.checked;
  currentSettings.enhancementFramework = els.enhancementFramework.value;
  currentSettings.customFrameworkPrompt = els.customFrameworkPrompt.value;

  currentSettings.customWebSize = {
    width: parseInt(els.webWidth.value) || 1000,
    height: parseInt(els.webHeight.value) || 800
  };

  currentSettings.askZepraEnabled = els.askZepraEnabled.checked;
  currentSettings.askZepraIcon = els.askZepraIcon.checked;
  currentSettings.askZepraShortcut = els.askZepraShortcut.value.trim();

  document.documentElement.style.setProperty('--primary-color', currentSettings.primaryColor);
}

function checkForChanges() {
  const keys = Object.keys(currentSettings);
  let changed = false;
  for (const key of keys) {
    if (JSON.stringify(currentSettings[key]) !== JSON.stringify(initialSettings[key])) {
      changed = true;
      break;
    }
  }
  hasUnsavedChanges = changed;
  updateSaveBar();
}

function updateSaveBar() {
  if (hasUnsavedChanges) els.saveBar.classList.add('visible');
  else els.saveBar.classList.remove('visible');
}

async function saveSettings() {
  showLoading(true);
  try {
    await chrome.storage.local.set(currentSettings);
    initialSettings = JSON.parse(JSON.stringify(currentSettings));
    hasUnsavedChanges = false;
    updateSaveBar();
    showStatus('Settings saved successfully!', 'success');
  } catch (e) {
    showStatus('Failed to save: ' + e.message, 'error');
  }
  showLoading(false);
}

function toggleCustomPromptContainer() {
  if (!els.customPromptContainer) return;
  els.customPromptContainer.style.display = (els.enhancementFramework.value === 'custom') ? 'block' : 'none';
}

function showStatus(msg, type = 'success') {
  els.statusMessage.textContent = msg;
  els.statusMessage.className = `status-message ${type}`;
  els.statusMessage.style.display = 'block';
  setTimeout(() => els.statusMessage.style.display = 'none', 3000);
}

function showLoading(show) {
  if (show) els.loadingOverlay.classList.add('visible');
  else els.loadingOverlay.classList.remove('visible');
}

// ---------------------------------------------------------
// CUSTOM PROMPTS (Sync Storage)
// ---------------------------------------------------------

async function loadCustomPrompts() {
  const { customPrompts = [] } = await chrome.storage.sync.get('customPrompts');
  renderPromptsTable(customPrompts);
}

function renderPromptsTable(prompts) {
  els.promptTableBody.innerHTML = '';
  prompts.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#e2e8f0;font-weight:500;">${p.name}</td>
      <td style="color:#94a3b8;">${p.tags.join(', ')}</td>
      <td style="color:#fbbf24;font-family:monospace;">${p.hotkey || '-'}</td>
      <td>
        <button class="btn btn-icon edit-prompt" data-id="${p.id}" style="background:none;border:none;cursor:pointer;">✏️</button>
        <button class="btn btn-icon delete-prompt" data-id="${p.id}" style="background:none;border:none;cursor:pointer;">🗑️</button>
      </td>
    `;
    els.promptTableBody.appendChild(tr);
  });
  document.querySelectorAll('.edit-prompt').forEach(b => b.addEventListener('click', (e) => editPrompt(e, prompts)));
  document.querySelectorAll('.delete-prompt').forEach(b => b.addEventListener('click', (e) => deletePrompt(e.target.closest('.delete-prompt').dataset.id)));
}

async function saveCustomPrompt() {
  const name = els.promptName.value.trim();
  const tags = els.promptTags.value.split(',').map(t => t.trim()).filter(Boolean);
  const hotkey = els.promptHotkey.value.trim();
  const text = els.promptText.value.trim();
  const idInput = els.promptForm.querySelector('input[name="id"]');
  const id = idInput.value;

  if (!name || !text) return showStatus('Name and Prompt are required.', 'error');
  const { customPrompts = [] } = await chrome.storage.sync.get('customPrompts');
  if (id) {
    const idx = customPrompts.findIndex(p => p.id === id);
    if (idx !== -1) customPrompts[idx] = { id, name, tags, hotkey, text, updatedAt: Date.now() };
  } else {
    customPrompts.push({ id: `prompt_${Date.now()}`, name, tags, hotkey, text, createdAt: Date.now() });
  }
  await chrome.storage.sync.set({ customPrompts });
  loadCustomPrompts();
  clearPromptForm();
  showStatus('Prompt saved.', 'success');
}

function editPrompt(e, prompts) {
  const id = e.target.closest('.edit-prompt').dataset.id;
  const p = prompts.find(pr => pr.id === id);
  if (!p) return;
  els.promptName.value = p.name;
  els.promptTags.value = p.tags.join(', ');
  els.promptHotkey.value = p.hotkey || '';
  els.promptText.value = p.text;
  els.promptForm.querySelector('input[name="id"]').value = p.id;
  els.promptForm.scrollIntoView({ behavior: 'smooth' });
}

async function deletePrompt(id) {
  if (!confirm('Delete this prompt?')) return;
  const { customPrompts = [] } = await chrome.storage.sync.get('customPrompts');
  const filtered = customPrompts.filter(p => p.id !== id);
  await chrome.storage.sync.set({ customPrompts: filtered });
  loadCustomPrompts();
  showStatus('Prompt deleted.', 'success');
}

function clearPromptForm() {
  els.promptName.value = '';
  els.promptTags.value = '';
  els.promptHotkey.value = '';
  els.promptText.value = '';
  els.promptForm.querySelector('input[name="id"]').value = '';
}

// ---------------------------------------------------------
// CUSTOM SITES (Local Storage)
// ---------------------------------------------------------

async function loadCustomSites() {
  const { zepraSites = [] } = await chrome.storage.local.get('zepraSites');
  renderSitesList(zepraSites);
}

function renderSitesList(sites) {
  if (!els.sitesList) return;
  els.sitesList.innerHTML = '';
  if (sites.length === 0) {
    els.sitesList.innerHTML = '<div style="color:#94a3b8;font-style:italic;">No custom sites added yet.</div>';
    return;
  }
  sites.slice(0, 10).forEach(site => {
    const div = document.createElement('div');
    div.className = 'site-item';
    div.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 8px; margin-bottom: 8px; background: rgba(0,0,0,0.2); transition: all 0.3s ease;`;
    div.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px;">
        <span style="color:#e2e8f0;font-weight:500;">${site.title || site.url}</span>
        <span style="color:#94a3b8;font-size:12px;">${site.brief || site.url}</span>
      </div>
      <button class="btn btn-icon delete-site" data-id="${site.id}" style="color:#ef4444;background:none;border:none;cursor:pointer;">×</button>
    `;
    els.sitesList.appendChild(div);
  });
  els.sitesList.querySelectorAll('.delete-site').forEach(btn => btn.addEventListener('click', (e) => deleteCustomSite(e.target.dataset.id)));
}

async function addCustomSite() {
  const name = els.siteName.value.trim();
  const url = els.siteUrl.value.trim();
  if (!url) return showStatus('URL is required.', 'error');
  const { zepraSites = [] } = await chrome.storage.local.get('zepraSites');
  zepraSites.unshift({ id: `site_${Date.now()}`, title: name || new URL(url).hostname, url: url, brief: 'Added manually', savedAt: Date.now() });
  await chrome.storage.local.set({ zepraSites });
  loadCustomSites();
  els.siteName.value = '';
  els.siteUrl.value = '';
  showStatus('Site added to library.', 'success');
}

async function deleteCustomSite(id) {
  if (!confirm('Remove this site?')) return;
  const { zepraSites = [] } = await chrome.storage.local.get('zepraSites');
  const filtered = zepraSites.filter(s => s.id !== id);
  await chrome.storage.local.set({ zepraSites: filtered });
  loadCustomSites();
}
