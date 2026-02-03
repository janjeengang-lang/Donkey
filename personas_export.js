const ROOT = document.getElementById('render-area');
const SAFE_HEIGHT = 900;

let pageNum = 0;
let currentContainer = null;
let currentH = 0;

const escapeHTML = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function addPage(dateLabel) {
  pageNum++;
  const page = document.createElement('div');
  page.className = 'sheet';
  page.innerHTML = `
    <div class="header">
      <div class="brand"><i class="fas fa-layer-group"></i> ZEPRA HUB</div>
      <div class="meta">
        CONFIDENTIAL<br>
        ${dateLabel}
      </div>
    </div>
    <div class="content"></div>
    <div class="footer">
      <span>AI Generated Manifest</span>
      <span>Page ${String(pageNum).padStart(2, '0')}</span>
    </div>
  `;
  ROOT.appendChild(page);
  currentContainer = page.querySelector('.content');
  currentH = 0;
}

const measureBox = document.createElement('div');
measureBox.style.cssText = "position:absolute; visibility:hidden; width:180mm; font-family:'Inter', sans-serif;";
document.body.appendChild(measureBox);

const params = new URLSearchParams(window.location.search);
const exportJobId = params.get('jobId') || '';

async function requestJobPayload() {
  if (!exportJobId || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return null;
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'EXPORT_PAYLOAD_REQUEST', jobId: exportJobId }, (response) => {
      resolve(response?.payload || null);
    });
  });
}

async function readPayload() {
  const jobPayload = await requestJobPayload();
  if (jobPayload) return jobPayload;
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const { personaPdfPayload = [] } = await chrome.storage.local.get('personaPdfPayload');
    return personaPdfPayload;
  }
  return [];
}

async function render() {
  const personaPdfPayload = await readPayload();
  const personas = Array.isArray(personaPdfPayload) ? personaPdfPayload : [];
  const dateLabel = new Date().toLocaleDateString('en-GB');

  addPage(dateLabel);

  personas.forEach((p, idx) => {
    const cardHTML = `
      <div class="persona-card">
        <div class="card-head">
          <div class="role-info">
            <h2><i class="fas fa-user-circle card-icon"></i> ${escapeHTML(p.name || `Persona ${idx + 1}`)}</h2>
            <span class="role-desc">${escapeHTML(p.tagline || '')}</span>
          </div>
        </div>
        <div class="prompt-container">
          <span class="prompt-tag">SYSTEM PROMPT</span>
          <div class="prompt-text">${escapeHTML(p.prompt || '')}</div>
        </div>
      </div>`;

    measureBox.innerHTML = cardHTML;
    const elHeight = measureBox.offsetHeight + 15;

    if (currentH + elHeight > SAFE_HEIGHT) {
      addPage(dateLabel);
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = cardHTML;
    currentContainer.appendChild(wrapper.firstElementChild);
    currentH += elHeight;
  });
}

async function notifyRendered() {
  if (!exportJobId || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => {});
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  chrome.runtime.sendMessage({ type: 'EXPORT_RENDERED', jobId: exportJobId });
}

render().then(notifyRendered);
