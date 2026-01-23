// Website Library State
const state = {
    websites: [],
    search: '',
    filterCategory: 'all',
    viewMode: 'grid',
    currentAnalysis: null
};

const els = {
    grid: document.getElementById('websitesGrid'),
    empty: document.getElementById('emptyState'),
    total: document.getElementById('totalSites'),
    favorites: document.getElementById('favoritesCount'),
    lastAdded: document.getElementById('lastAdded'),
    search: document.getElementById('searchInput'),
    filterCategory: document.getElementById('filterCategory'),
    toggleView: document.getElementById('toggleView'),
    btnAddWebsite: document.getElementById('btnAddWebsite'),
    addModal: document.getElementById('addModal'),
    closeModal: document.getElementById('closeModal'),
    inputUrl: document.getElementById('inputUrl'),
    inputNote: document.getElementById('inputNote'),
    aiPreview: document.getElementById('aiPreview'),
    aiContent: document.getElementById('aiContent'),
    aiStatus: document.getElementById('aiStatus'),
    btnAnalyze: document.getElementById('btnAnalyze'),
    btnSaveWebsite: document.getElementById('btnSaveWebsite'),
    detailModal: document.getElementById('detailModal'),
    closeDetailModal: document.getElementById('closeDetailModal'),
    detailTitle: document.getElementById('detailTitle'),
    detailContent: document.getElementById('detailContent'),
    btnOpenSite: document.getElementById('btnOpenSite'),
    btnDeleteSite: document.getElementById('btnDeleteSite')
};

let currentDetailId = null;

init();

function init() {
    loadWebsites();
    bindEvents();

    // Check if opened with URL parameter
    const params = new URLSearchParams(window.location.search);
    const addUrl = params.get('addUrl');
    if (addUrl) {
        openAddModal(addUrl);
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.zepraSites) {
            state.websites = changes.zepraSites.newValue || [];
            render();
        }
    });
}

function bindEvents() {
    els.search.addEventListener('input', (e) => {
        state.search = e.target.value.trim().toLowerCase();
        render();
    });

    els.filterCategory.addEventListener('change', (e) => {
        state.filterCategory = e.target.value;
        render();
    });

    els.toggleView.addEventListener('click', () => {
        state.viewMode = state.viewMode === 'grid' ? 'list' : 'grid';
        els.toggleView.textContent = state.viewMode === 'grid' ? '⊞ Grid' : '≡ List';
        render();
    });

    els.btnAddWebsite.addEventListener('click', () => openAddModal());
    els.closeModal.addEventListener('click', closeAddModal);
    els.btnAnalyze.addEventListener('click', analyzeCurrentPage);
    els.btnSaveWebsite.addEventListener('click', saveWebsite);

    els.closeDetailModal.addEventListener('click', closeDetailModal);
    els.btnOpenSite.addEventListener('click', () => {
        const site = state.websites.find(s => s.id === currentDetailId);
        if (site) window.open(site.url, '_blank');
    });
    els.btnDeleteSite.addEventListener('click', deleteSite);

    // Close modals on backdrop click
    els.addModal.addEventListener('click', (e) => {
        if (e.target === els.addModal) closeAddModal();
    });
    els.detailModal.addEventListener('click', (e) => {
        if (e.target === els.detailModal) closeDetailModal();
    });
}

async function loadWebsites() {
    const { zepraSites = [] } = await chrome.storage.local.get('zepraSites');
    state.websites = Array.isArray(zepraSites) ? zepraSites : [];
    render();
}

function render() {
    const filtered = filterWebsites(state.websites);
    els.grid.innerHTML = filtered.map(renderCard).join('');
    els.empty.style.display = filtered.length ? 'none' : 'block';
    els.grid.style.display = filtered.length ? 'grid' : 'none';

    // Stats
    els.total.textContent = state.websites.length;
    els.favorites.textContent = state.websites.filter(s => s.favorite).length;
    els.lastAdded.textContent = state.websites.length
        ? formatDate(state.websites[0]?.createdAt)
        : '--';

    hydrateCardEvents();
}

function filterWebsites(websites) {
    return websites.filter((site) => {
        if (state.filterCategory !== 'all' && site.category !== state.filterCategory) return false;
        if (state.search) {
            const hay = [
                site.title,
                site.description,
                site.url,
                (site.tags || []).join(' ')
            ].join(' ').toLowerCase();
            if (!hay.includes(state.search)) return false;
        }
        return true;
    });
}

function renderCard(site) {
    const tags = (site.tags || []).slice(0, 3).map(t =>
        `<span class="website-tag">${escapeHtml(t)}</span>`
    ).join('');

    const categoryLabels = {
        tool: '🔧 Tool',
        learning: '📚 Learning',
        news: '📰 News',
        entertainment: '🎬 Entertainment',
        social: '👥 Social',
        shopping: '🛒 Shopping',
        tech: '💻 Tech',
        other: '📁 Other'
    };

    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(site.url)}&sz=64`;

    return `
    <article class="website-card" data-id="${site.id}">
      <div class="website-header">
        <div class="website-favicon">
          <img src="${faviconUrl}" alt="" onerror="this.parentElement.innerHTML='🌐'" />
        </div>
        <div class="website-info">
          <h3 class="website-title">${escapeHtml(site.title || 'Untitled')}</h3>
          <div class="website-url">${escapeHtml(site.url)}</div>
        </div>
        <span class="website-category">${categoryLabels[site.category] || '📁 Other'}</span>
      </div>
      <p class="website-description">${escapeHtml(site.description || 'No description')}</p>
      ${tags ? `<div class="website-tags">${tags}</div>` : ''}
      <div class="website-footer">
        <span>${formatDate(site.createdAt)}</span>
        <div class="website-actions">
          <button class="favorite-btn ${site.favorite ? 'active' : ''}" data-action="favorite">
            ${site.favorite ? '⭐' : '☆'}
          </button>
          <button data-action="open">🔗 Open</button>
          <button data-action="view">👁️ Details</button>
        </div>
      </div>
    </article>
  `;
}

function hydrateCardEvents() {
    els.grid.querySelectorAll('.website-card').forEach((card) => {
        card.addEventListener('click', (e) => {
            const id = card.dataset.id;

            if (e.target.closest('[data-action="favorite"]')) {
                toggleFavorite(id);
                return;
            }
            if (e.target.closest('[data-action="open"]')) {
                const site = state.websites.find(s => s.id === id);
                if (site) window.open(site.url, '_blank');
                return;
            }
            if (e.target.closest('[data-action="view"]')) {
                showDetail(id);
                return;
            }

            // Click on card itself opens detail
            showDetail(id);
        });
    });
}

async function toggleFavorite(id) {
    const site = state.websites.find(s => s.id === id);
    if (!site) return;

    site.favorite = !site.favorite;
    await chrome.storage.local.set({ zepraSites: state.websites });
    render();
}

function showDetail(id) {
    const site = state.websites.find(s => s.id === id);
    if (!site) return;

    currentDetailId = id;
    els.detailTitle.textContent = site.title || 'Website Details';

    const tags = (site.tags || []).map(t =>
        `<span class="website-tag">${escapeHtml(t)}</span>`
    ).join('');

    els.detailContent.innerHTML = `
    <div style="display:flex;gap:16px;margin-bottom:20px;">
      <div class="website-favicon" style="width:60px;height:60px;font-size:30px;">
        <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(site.url)}&sz=64" 
             alt="" style="width:40px;height:40px;" 
             onerror="this.parentElement.innerHTML='🌐'" />
      </div>
      <div style="flex:1;">
        <h3 style="margin:0 0 8px;font-size:20px;">${escapeHtml(site.title)}</h3>
        <a href="${site.url}" target="_blank" style="color:var(--accent);font-size:13px;">${escapeHtml(site.url)}</a>
      </div>
    </div>
    
    <div style="margin-bottom:16px;">
      <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">Description</label>
      <p style="margin:8px 0;color:#e2e8f0;line-height:1.7;">${escapeHtml(site.description || 'No description')}</p>
    </div>
    
    ${site.note ? `
    <div style="margin-bottom:16px;">
      <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">Your Note</label>
      <p style="margin:8px 0;color:#cbd5e1;font-style:italic;background:var(--panel);padding:12px;border-radius:10px;">${escapeHtml(site.note)}</p>
    </div>
    ` : ''}
    
    ${tags ? `
    <div style="margin-bottom:16px;">
      <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">Tags</label>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">${tags}</div>
    </div>
    ` : ''}
    
    <div style="display:flex;gap:20px;font-size:12px;color:var(--muted);">
      <span>📅 Added: ${formatDate(site.createdAt)}</span>
      <span>📁 Category: ${site.category || 'Other'}</span>
    </div>
  `;

    els.detailModal.classList.remove('hidden');
}

function closeDetailModal() {
    els.detailModal.classList.add('hidden');
    currentDetailId = null;
}

async function deleteSite() {
    if (!currentDetailId) return;
    if (!confirm('Delete this website from your library?')) return;

    state.websites = state.websites.filter(s => s.id !== currentDetailId);
    await chrome.storage.local.set({ zepraSites: state.websites });
    closeDetailModal();
    render();
}

function openAddModal(url = '') {
    state.currentAnalysis = null;
    els.inputUrl.value = url;
    els.inputNote.value = '';
    els.aiPreview.classList.add('hidden');
    els.btnSaveWebsite.disabled = true;
    els.addModal.classList.remove('hidden');

    if (!url) {
        // Get current tab URL
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.url && !tabs[0].url.startsWith('chrome')) {
                els.inputUrl.value = tabs[0].url;
            }
        });
    }
}

function closeAddModal() {
    els.addModal.classList.add('hidden');
    state.currentAnalysis = null;
}

async function analyzeCurrentPage() {
    const url = els.inputUrl.value.trim();
    if (!url) {
        alert('Please enter a URL');
        return;
    }

    els.aiPreview.classList.remove('hidden');
    els.aiStatus.textContent = 'Analyzing...';
    els.aiContent.innerHTML = '<div style="text-align:center;padding:20px;">🔄 Analyzing website...</div>';
    els.btnSaveWebsite.disabled = true;

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'ANALYZE_WEBSITE',
            url: url,
            note: els.inputNote.value.trim()
        });

        if (!response?.ok) throw new Error(response?.error || 'Analysis failed');

        state.currentAnalysis = response.data;
        els.aiStatus.textContent = '✓ Analysis complete';

        els.aiContent.innerHTML = `
      <div class="ai-title">${escapeHtml(response.data.title)}</div>
      <div class="ai-description">${escapeHtml(response.data.description)}</div>
      <div class="ai-tags">
        ${(response.data.tags || []).map(t => `<span class="ai-tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--muted);">
        Category: ${response.data.category || 'Other'}
      </div>
    `;

        els.btnSaveWebsite.disabled = false;
    } catch (err) {
        els.aiStatus.textContent = '✗ Analysis failed';
        els.aiContent.innerHTML = `<div style="color:#fca5a5;">${escapeHtml(err.message)}</div>`;
    }
}

async function saveWebsite() {
    if (!state.currentAnalysis) {
        alert('Please analyze the page first');
        return;
    }

    const newSite = {
        id: `site_${Date.now()}`,
        url: els.inputUrl.value.trim(),
        title: state.currentAnalysis.title,
        description: state.currentAnalysis.description,
        category: state.currentAnalysis.category || 'other',
        tags: state.currentAnalysis.tags || [],
        note: els.inputNote.value.trim(),
        favorite: false,
        createdAt: Date.now()
    };

    state.websites.unshift(newSite);
    await chrome.storage.local.set({ zepraSites: state.websites });

    closeAddModal();
    render();
}

function formatDate(ts) {
    if (!ts) return '--';
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
