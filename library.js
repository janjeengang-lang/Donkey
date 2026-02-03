// ===================================
// LIBRARY.JS - Website Library Logic
// ===================================

let allSites = [];
let filteredSites = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadSites();
    setupEventListeners();
});

// Load sites from storage
async function loadSites() {
    try {
        const { zepraSites = [] } = await chrome.storage.local.get('zepraSites');
        allSites = zepraSites;
        filteredSites = [...allSites];
        renderSites();
    } catch (error) {
        console.error('Failed to load sites:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');

    searchInput.addEventListener('input', (e) => {
        filterSites(e.target.value, categoryFilter.value);
    });

    categoryFilter.addEventListener('change', (e) => {
        filterSites(searchInput.value, e.target.value);
    });
}

// Filter sites
function filterSites(searchTerm = '', category = '') {
    filteredSites = allSites.filter(site => {
        const matchesSearch = !searchTerm ||
            site.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            site.brief.toLowerCase().includes(searchTerm.toLowerCase()) ||
            site.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory = !category || site.category === category;

        return matchesSearch && matchesCategory;
    });

    renderSites();
}

// Render sites
function renderSites() {
    const emptyState = document.getElementById('emptyState');
    const sitesGrid = document.getElementById('sitesGrid');

    if (filteredSites.length === 0) {
        emptyState.classList.remove('hidden');
        sitesGrid.innerHTML = '';
        return;
    }

    emptyState.classList.add('hidden');
    sitesGrid.innerHTML = '';

    filteredSites.forEach((site, index) => {
        const card = createSiteCard(site, index);
        sitesGrid.appendChild(card);
    });
}

// Create site card
function createSiteCard(site, index) {
    const template = document.getElementById('siteCardTemplate');
    const card = template.content.cloneNode(true);

    const article = card.querySelector('.site-card');
    article.style.animationDelay = `${index * 0.05}s`;

    // Image
    const img = card.querySelector('.cover-image');
    img.src = site.imageUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%230f172a" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2310b981" font-size="24"%3ENo Image%3C/text%3E%3C/svg%3E';
    img.alt = site.title;

    // Handle broken images
    img.onerror = () => {
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%230f172a" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2310b981" font-size="24"%3E' + encodeURIComponent(site.title.substring(0, 20)) + '%3C/text%3E%3C/svg%3E';
    };

    // Title & Brief
    card.querySelector('.card-title').textContent = site.title;
    card.querySelector('.card-brief').textContent = site.brief;

    // AI Analysis
    card.querySelector('.ai-analysis-text').textContent = site.ai_analysis;

    // Tags
    const tagsContainer = card.querySelector('.tags-container');
    if (site.tags && site.tags.length > 0) {
        site.tags.slice(0, 3).forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
        });
    }

    // Rating
    const ratingContainer = card.querySelector('.rating-stars');
    const rating = site.rating || 3;
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = i <= rating ? 'star' : 'star empty';
        star.textContent = '★';
        ratingContainer.appendChild(star);
    }

    // Visit button
    card.querySelector('.btn-visit').addEventListener('click', () => {
        window.open(site.url, '_blank');
    });

    // Delete button
    card.querySelector('.btn-delete').addEventListener('click', async () => {
        if (confirm(`Delete "${site.title}" from library?`)) {
            await deleteSite(site.id);
        }
    });

    return card;
}

// Delete site
async function deleteSite(siteId) {
    try {
        const { zepraSites = [] } = await chrome.storage.local.get('zepraSites');
        const updatedSites = zepraSites.filter(s => s.id !== siteId);
        await chrome.storage.local.set({ zepraSites: updatedSites });

        // Update local state
        allSites = updatedSites;
        filteredSites = filteredSites.filter(s => s.id !== siteId);

        renderSites();
    } catch (error) {
        console.error('Failed to delete site:', error);
        alert('Failed to delete site');
    }
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.zepraSites) {
        loadSites();
    }
});
