const ROOT = document.getElementById('render-target') || document.getElementById('export-root');
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
    const { notesExportPayload = null } = await chrome.storage.local.get('notesExportPayload');
    return notesExportPayload;
  }
  return null;
}

async function render() {
  const payload = await readPayload();

  // If AI generated HTML, render it directly
  if (payload?.html) {
    ROOT.innerHTML = payload.html;
    return;
  }

  // Fallback message if no content
  ROOT.innerHTML = '<div style="padding:40px;color:#999;font-family:Arial;text-align:center;">No export content available. Please try generating again.</div>';
}

function showLoader() {
  const loader = document.createElement('div');
  loader.id = 'exportLoader';
  loader.innerHTML = `
    <style>
      #exportLoader {
        position: fixed; inset: 0; background: rgba(8,10,14,0.95);
        display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999;
        font-family: 'Inter', sans-serif; color: #fff;
      }
      .loader-box {
        padding: 32px 40px; border-radius: 20px;
        border: 1px solid rgba(0,220,130,0.3);
        background: linear-gradient(135deg, rgba(15,20,26,0.98), rgba(10,15,20,0.95));
        box-shadow: 0 24px 60px rgba(0,0,0,0.5);
        display: flex; flex-direction: column; align-items: center; gap: 20px;
        text-align: center;
      }
      .loader-spinner {
        width: 50px; height: 50px; border-radius: 50%;
        border: 4px solid rgba(0,220,130,0.2);
        border-top-color: #00dc82;
        animation: spin 1s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .loader-text { font-size: 16px; font-weight: 600; color: #f8fafc; }
      .loader-sub { font-size: 13px; color: #94a3b8; }
    </style>
    <div class="loader-box">
      <div class="loader-spinner"></div>
      <div class="loader-text">Preparing your export...</div>
      <div class="loader-sub">AI is designing your beautiful notes</div>
    </div>
  `;
  document.body.insertBefore(loader, document.body.firstChild);
}

function hideLoader() {
  const loader = document.getElementById('exportLoader');
  if (loader) loader.remove();
}

async function notifyRendered() {
  if (!exportJobId || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => { });
  }
  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 500);
        });
      });
    });
  });
  hideLoader();
  chrome.runtime.sendMessage({ type: 'EXPORT_RENDERED', jobId: exportJobId });
}

showLoader();
render().then(notifyRendered);
