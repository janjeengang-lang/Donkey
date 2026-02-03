const ROOT = document.getElementById('export-root');
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
  if (!payload || !payload.html) {
    ROOT.innerHTML = '<div style="padding:40px;color:#999;font-family:Arial;">No export payload.</div>';
    return;
  }
  ROOT.innerHTML = payload.html;
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
