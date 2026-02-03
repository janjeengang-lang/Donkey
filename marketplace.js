document.addEventListener('DOMContentLoaded', async () => {
    // State
    let currentCategory = 'all';
    let searchQuery = '';
    let favoriteIds = [];

    // DOM Elements
    const grid = document.getElementById('toolsGrid');
    const toolCountLabel = document.getElementById('toolCount');
    const categoryTitle = document.getElementById('currentCategoryTitle');
    const searchInput = document.getElementById('searchInput');
    const categoryList = document.getElementById('categoryList');
    const backBtn = document.getElementById('backToCommand');

    // Modal Elements
    const modal = document.getElementById('previewModal');
    const closeModalBtn = modal.querySelector('.close-modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDesc = document.getElementById('modalDesc');
    const modalImg = document.getElementById('modalPreviewImg');
    const modalIcon = document.getElementById('modalIcon');
    const modalCategory = document.getElementById('modalCategory');
    const modalLaunchBtn = document.getElementById('modalLaunchBtn');
    const modalFavBtn = document.getElementById('modalFavoriteBtn');

    // Load Favorites
    try {
        const result = await chrome.storage.local.get('zepraFavorites');
        favoriteIds = result.zepraFavorites || [];
    } catch (e) {
        console.error("Error loading favorites", e);
    }

    // --- Initialization ---
    renderTools();
    // setupEventListeners(); // Removed to prevent crash, code runs linearly below

    // --- Rendering ---
    function renderTools() {
        grid.innerHTML = '';

        let filtered = toolsData.filter(tool => {
            const matchesCategory = currentCategory === 'all'
                ? true
                : currentCategory === 'favorites'
                    ? favoriteIds.includes(tool.id)
                    : tool.category === currentCategory;

            const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tool.description.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesCategory && matchesSearch;
        });

        toolCountLabel.textContent = `${filtered.length} results`;

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                <h3>No tools found matching your criteria.</h3>
            </div>`;
            return;
        }

        // --- Grouped Layout for 'All' View ---
        if (currentCategory === 'all' && !searchQuery) {
            // Group by Category
            const categories = {};
            filtered.forEach(tool => {
                if (!categories[tool.category]) categories[tool.category] = [];
                categories[tool.category].push(tool);
            });

            // Render specific order or alphabetical
            // User requested "Arrange them... offering same feature next to each other"

            Object.keys(categories).sort().forEach(cat => {
                // Section Header
                const sectionHeader = document.createElement('div');
                sectionHeader.className = 'section-divider';
                sectionHeader.innerHTML = `
                    <h3>${cat}</h3>
                    <div class="divider-line"></div>
                `;
                sectionHeader.style.gridColumn = "1 / -1";
                sectionHeader.style.display = "flex";
                sectionHeader.style.alignItems = "center";
                sectionHeader.style.gap = "16px";
                sectionHeader.style.margin = "32px 0 16px 0";

                // Style for h3
                const h3 = sectionHeader.querySelector('h3');
                h3.style.color = "#fff";
                h3.style.fontSize = "18px";
                h3.style.whiteSpace = "nowrap";

                // Style for line
                const line = sectionHeader.querySelector('.divider-line');
                line.style.height = "1px";
                line.style.background = "rgba(255,255,255,0.2)";
                line.style.flex = "1";

                grid.appendChild(sectionHeader);

                // Render Tools for this Category
                // Note: The Grid CSS needs to handle this mix of full-width items and cards.
                // Actually, CSS Grid auto-flow might be tricky with full-width headers inserted mid-stream if we just append them.
                // A better approach depends on CSS. If displays grid, inserting a full width items works if we set grid-column: 1/-1.

                categories[cat].forEach(tool => {
                    grid.appendChild(createToolCard(tool));
                });
            });
        } else {
            // Flat List for Search or Specific Category
            filtered.sort((a, b) => b.popularity - a.popularity);
            filtered.forEach(tool => {
                grid.appendChild(createToolCard(tool));
            });
        }
    }

    function createToolCard(tool) {
        const isFav = favoriteIds.includes(tool.id);
        const card = document.createElement('div');
        const iconUrl = `https://www.google.com/s2/favicons?domain=${new URL(tool.url).hostname}&sz=128`;

        card.className = 'tool-card';
        card.innerHTML = `
            <div class="card-badges">
                ${tool.badges.map(b => `<span class="badge ${b}">${b}</span>`).join('')}
            </div>
            <div class="card-header">
                <img src="${iconUrl}" class="card-icon" alt="${tool.name}" onerror="this.src='icons/icon128.png'">
                <div class="card-actions">
                    <button class="btn-icon-small ${isFav ? 'active' : ''} fav-trigger" data-id="${tool.id}">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    <!-- Small add to workflow button on card too? -->
                </div>
            </div>
            <h3 class="tool-name">${tool.name}</h3>
            <p class="tool-desc">${tool.description}</p>
            <div class="card-footer">
                <span class="category-pill">${tool.category}</span>
                <span class="btn-text" style="font-size: 12px; opacity: 0.7;">Details →</span>
            </div>
        `;

        // Card Click (Open Modal)
        card.addEventListener('click', (e) => {
            // Don't open if clicking actions
            if (e.target.closest('.card-actions')) return;
            openModal(tool);
        });

        // Favorite Click
        const favBtn = card.querySelector('.fav-trigger');
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop card click
            toggleFavorite(tool.id, favBtn);
        });

        return card;
    }

    // --- Modal Logic ---
    async function openModal(tool) {
        modalTitle.textContent = tool.name;
        modalDesc.textContent = tool.description;
        modalCategory.textContent = tool.category;

        const iconUrl = `https://www.google.com/s2/favicons?domain=${new URL(tool.url).hostname}&sz=128`;
        modalIcon.src = iconUrl;

        // Docking Station Logic
        if (tool.preview_img) {
            modalImg.style.display = 'block';
            modalImg.src = tool.preview_img;
            // Clean up any existing dock station
            const existingDock = modalImg.parentElement.querySelector('.dock-station');
            if (existingDock) existingDock.remove();
        } else {
            modalImg.style.display = 'none';

            // Fetch Profiles & Render Docking Station
            const { zepraProfiles = [] } = await chrome.storage.local.get('zepraProfiles');

            // FILTER: Remove "Work" and "Research" if user considers them garbage/defaults
            // Ensure "My Favorites" is preserved and always shown first
            let profilesToRender = zepraProfiles.filter(p => !['Work', 'Research'].includes(p.name));

            if (!profilesToRender.find(p => p.name === 'My Favorites')) {
                profilesToRender.unshift({ name: 'My Favorites', urls: [] });
            }

            // Check/Create Dock Station Container
            let dockStation = modalImg.parentElement.querySelector('.dock-station');
            if (!dockStation) {
                dockStation = document.createElement('div');
                dockStation.className = 'dock-station';
                modalImg.parentElement.appendChild(dockStation);
            }

            dockStation.innerHTML = `
                <div class="dock-header">
                    <h3>🚀 Add to Profile</h3>
                    <p>Select a profile to save <b>${tool.name}</b>:</p>
                </div>
                <div class="dock-slots" style="display: flex; flex-direction: column; gap: 8px;">
                    ${profilesToRender.map(p => `
                        <button class="dock-slot" data-profile="${p.name}" style="justify-content: flex-start; padding: 12px;">
                            <span class="slot-icon">⚡</span>
                            <span class="slot-name">${p.name} <small style="opacity:0.6; margin-left:8px;">(${p.urls ? p.urls.length : 0}/4)</small></span>
                        </button>
                    `).join('')}
                </div>
            `;

            // Explicitly re-bind Close Button inside this async flow to ensure it works
            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeModal();
                };
            }

            // Function to handle profile add logic with capacity check
            const handleProfileAdd = async (btn, profileName) => {
                btn.classList.add('loading');

                // 1. Refetch to get latest state
                const { zepraProfiles = [] } = await chrome.storage.local.get('zepraProfiles');
                // Ensure initial default exists in storage if needed, logic handled in BG usually but safe to check
                let targetProfile = zepraProfiles.find(p => p.name === profileName);

                // Fallback for default profile if not yet saved in array
                if (!targetProfile && profileName === 'My Favorites') {
                    targetProfile = { name: 'My Favorites', urls: [] };
                }

                if (targetProfile && targetProfile.urls.length >= 4) {
                    btn.classList.remove('loading');
                    // Show Replacement UI
                    showReplacementUI(dockStation, targetProfile, tool, btn);
                    return;
                }

                // 2. Normal Add
                const res = await chrome.runtime.sendMessage({
                    type: 'ADD_TO_PROFILE',
                    url: tool.url,
                    title: tool.name,
                    profile: profileName
                });

                btn.classList.remove('loading');
                if (res && res.ok) {
                    btn.classList.add('success');
                    btn.innerHTML = `<span>✅ Saved to ${profileName}!</span>`;
                    setTimeout(() => {
                        // Reset button text
                        btn.innerHTML = `
                            <span class="slot-icon">⚡</span>
                            <span class="slot-name">${profileName}</span>
                        `;
                        btn.classList.remove('success');
                        closeModal(); // UX: Close modal on success for smoother flow? Or keep open? User preference implies "Success" notification so keeping open briefly might be better. 
                        // Actually user said "appear successful notification", implies staying or closing.
                    }, 1500);
                } else {
                    btn.textContent = '❌ Failed';
                    console.error(res.error);
                }
            };

            // Bind Events
            dockStation.querySelectorAll('.dock-slot').forEach(btn => {
                btn.addEventListener('click', () => handleProfileAdd(btn, btn.dataset.profile));
            });
        }

        // New Helper: Replacement UI
        function showReplacementUI(container, profile, newTool, triggerBtn) {
            container.innerHTML = `
            <div class="dock-header">
                <h3 style="color:#ff4444">Profile Full!</h3>
                <p>Select a tool to replace with <b>${newTool.name}</b>:</p>
            </div>
            <div class="dock-replacement-list" style="display:flex; flex-direction:column; gap:8px; width:100%; max-width:300px;">
                ${profile.urls.map((u, i) => `
                    <button class="replace-item-btn" data-index="${i}" style="
                        background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); 
                        padding:10px; color:white; border-radius:8px; cursor:pointer; text-align:left;
                        display:flex; align-items:center; gap:10px;">
                        <img src="https://www.google.com/s2/favicons?domain=${new URL(u).hostname}" style="width:16px;height:16px;">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${u}</span>
                    </button>
                `).join('')}
                <button class="cancel-replace" style="background:transparent; border:none; color:#888; margin-top:8px; cursor:pointer;">Cancel</button>
            </div>
        `;

            container.querySelectorAll('.replace-item-btn').forEach(b => {
                b.onclick = async () => {
                    const idx = parseInt(b.dataset.index);
                    // Perform replacement
                    profile.urls[idx] = newTool.url;

                    // Save updated profile list
                    const { zepraProfiles = [] } = await chrome.storage.local.get('zepraProfiles');
                    const pIndex = zepraProfiles.findIndex(p => p.name === profile.name);

                    // Logic to update or push
                    let newProfiles = [...zepraProfiles];
                    if (pIndex !== -1) {
                        newProfiles[pIndex] = profile;
                    } else {
                        // Should not happen for replacement but safe fallback
                        newProfiles.push(profile);
                    }

                    await chrome.storage.local.set({ zepraProfiles: newProfiles });

                    // Restore UI with Success
                    container.innerHTML = `
                         <div class="dock-header"><h3>✅ Replaced!</h3></div>
                    `;
                    setTimeout(() => {
                        // Re-open modal logic to reset View? 
                        // Or just simplistic reset to initial state
                        openModal(newTool);
                    }, 1000);
                };
            });

            container.querySelector('.cancel-replace').onclick = () => {
                openModal(newTool); // Reset view
            };
        }

        // Setup Launch Button
        // Setup Launch Button
        modalLaunchBtn.onclick = () => {
            chrome.runtime.sendMessage({ type: 'OPEN_MARKET_TOOL', url: tool.url });
        };

        // Setup Add to Workflow (Legacy Button - Hidden or Synced)
        const workflowBtn = modalLaunchBtn.nextElementSibling;
        if (workflowBtn) {
            workflowBtn.style.display = 'none'; // Hide legacy button in favor of Docking Station
        }

        // Setup Fav Button state
        updateModalFavButton(tool.id);
        modalFavBtn.onclick = () => {
            toggleFavorite(tool.id, null);
            updateModalFavButton(tool.id);
            renderTools();
        };

        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.add('visible');
        });
    }

    function closeModal() {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }



    function updateModalFavButton(id) {
        const isFav = favoriteIds.includes(id);
        modalFavBtn.textContent = isFav ? '❤️' : '🤍';
        modalFavBtn.style.color = isFav ? '#00ff88' : 'white';
    }

    // --- Actions ---
    async function toggleFavorite(id, btnElement) {
        if (favoriteIds.includes(id)) {
            favoriteIds = favoriteIds.filter(fId => fId !== id);
            if (btnElement) {
                btnElement.textContent = '🤍';
                btnElement.classList.remove('active');
            }
        } else {
            favoriteIds.push(id);
            if (btnElement) {
                btnElement.textContent = '❤️';
                btnElement.classList.add('active');
            }
        }
        await chrome.storage.local.set({ zepraFavorites: favoriteIds });
    }

    // --- Event Listeners ---

    // Category Selection
    categoryList.addEventListener('click', (e) => {
        const li = e.target.closest('li'); // Fix: Use closest to capture clicks on children
        if (li) {
            // Remove active class from all
            document.querySelectorAll('.categories-nav li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');

            currentCategory = li.dataset.category;
            categoryTitle.textContent = li.textContent;
            renderTools();
        }
    });

    // Favorites Filter (Sidebar)
    const favLink = document.querySelector('.personal-nav li[data-category="favorites"]');
    if (favLink) {
        favLink.addEventListener('click', () => {
            document.querySelectorAll('.categories-nav li').forEach(li => li.classList.remove('active'));
            favLink.classList.add('active');
            currentCategory = 'favorites';
            categoryTitle.textContent = "My Favorites";
            renderTools();
        });
    }

    // Search
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderTools();
    });

    // Modal Close - Delegated
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('.close-modal')) {
            closeModal();
        }
    });

    // Explicit close button listener just in case (though delegation covers it)
    if (closeModalBtn) {
        closeModalBtn.onclick = closeModal;
    }

    // Navigation
    backBtn.addEventListener('click', () => {
        // Use direct location change for reliable navigation within the extension tab context
        window.location.href = 'command_center.html';
    });

});
