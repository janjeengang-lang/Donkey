const escapeHTML = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '-';
};

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
    const { identityPdfPayload = null } = await chrome.storage.local.get('identityPdfPayload');
    return identityPdfPayload;
  }
  return null;
}

async function hydrate() {
  const identityPdfPayload = await readPayload();
  if (!identityPdfPayload) return;

  const fullName = identityPdfPayload.fullName || identityPdfPayload.identityName || 'Unknown';
  setText('val-header-name', fullName.toUpperCase());
  setText('val-header-username', identityPdfPayload.username ? `@${identityPdfPayload.username}` : '@unknown');
  setText('val-fullname', fullName);
  setText('val-firstname', identityPdfPayload.firstName);
  setText('val-lastname', identityPdfPayload.lastName);
  setText('val-age', identityPdfPayload.age ? `${identityPdfPayload.age} Years` : '');
  setText('val-country', identityPdfPayload.country);
  setText('val-username', identityPdfPayload.username);
  setText('val-password', identityPdfPayload.password);
  setText('val-mac', identityPdfPayload.macAddress);
  setText('val-email', identityPdfPayload.email);
  setText('val-phone', identityPdfPayload.phone);
  setText('val-address', identityPdfPayload.address1);
  const cityStateZip = [identityPdfPayload.city, identityPdfPayload.state, identityPdfPayload.zipCode].filter(Boolean).join(', ');
  setText('val-citystate', cityStateZip);
  setText('val-company', identityPdfPayload.companyName);
  setText('val-industry', identityPdfPayload.companyIndustry);
  setText('val-compsize', identityPdfPayload.companySize);
  setText('val-revenue', identityPdfPayload.companyAnnualRevenue);
  setText('val-website', identityPdfPayload.companyWebsite);
  setText('val-hq', identityPdfPayload.companyAddress);
  setText('val-unique-id', identityPdfPayload.id || identityPdfPayload.identityName);

  const image = document.getElementById('val-profile-pic');
  const fallbackAvatar = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('icons/zepra.svg')
    : '';
  if (image) {
    if (identityPdfPayload.profilePictureUrl) {
      image.src = identityPdfPayload.profilePictureUrl;
    } else if (fallbackAvatar) {
      image.src = fallbackAvatar;
    }
  }
}

async function notifyRendered() {
  if (!exportJobId || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => {});
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  chrome.runtime.sendMessage({ type: 'EXPORT_RENDERED', jobId: exportJobId });
}

hydrate().then(notifyRendered);
