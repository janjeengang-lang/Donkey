// =========================================
// ASK ZEPRA - PRO EDITION (CORE 2.0)
// =========================================

(function () {
    if (window.hasZepraAssistant) return;
    window.hasZepraAssistant = true;

    // Prevent initialization inside iframes
    if (window !== window.top) return;

    // --- CONFIG ---
    let SETTINGS = {
        enabled: true,
        showIcon: true,
        shortcut: 'F1'
    };

    // --- STATE ---
    let shadowRoot = null;
    let triggerBtn = null;
    let modal = null;
    let inputField = null;
    let sendBtn = null;
    let contentArea = null;

    // Core 2.0 State
    let chatHistory = []; // Memory Stream
    let cachedSelection = '';
    let currentContext = { type: 'page', text: '', title: '', url: '' };
    let isOpen = false;
    let selectionTimer = null;
    let isRTL = false;
    let activeConversationId = null;

    // Magic Vision State
    let magicVisionActive = false;
    let magicVisionOverlay = null;
    let capturedRegionText = '';
    let captureRect = null;

    // --- MEMORY CLIENT ---
    const ZepraMemoryClient = {
        async save(conversation) {
            return new Promise(resolve => {
                chrome.runtime.sendMessage({
                    type: 'MEMORY_SAVE',
                    conversation
                }, response => resolve(response));
            });
        },
        async load(id) {
            return new Promise(resolve => {
                chrome.runtime.sendMessage({ type: 'MEMORY_GET', id }, response => resolve(response));
            });
        },
        async list(limit = 20) {
            return new Promise(resolve => {
                chrome.runtime.sendMessage({ type: 'MEMORY_LIST', limit }, response => resolve(response));
            });
        }
    };

    // --- ICONS (Clean SVG) ---
    const ICONS = {
        sparkle: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>`,
        send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>`,
        close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>`,
        list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"></path></svg>`,
        brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44 2.5 2.5 0 01-2.96-3.08 3 3 0 01-.34-5.58 2.5 2.5 0 011.32-4.24 2.5 2.5 0 012.96-3.08A2.5 2.5 0 019.5 2zM14.5 2A2.5 2.5 0 0012 4.5v15a2.5 2.5 0 004.96.44 2.5 2.5 0 002.96-3.08 3 3 0 00.34-5.58 2.5 2.5 0 00-1.32-4.24 2.5 2.5 0 00-2.96-3.08A2.5 2.5 0 0014.5 2z"></path></svg>`,
        globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"></path></svg>`,
        doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path><path d="M14 2v6h6"></path><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>`,
        rtl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19h11M4 13h11M6 6h12M18 19v-2M18 13v-2M18 6v12"></path></svg>`,
        scissors: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>`,
        camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`
    };

    // --- INIT ---
    async function init() {
        await loadSettings();
        createUI();
        attachListeners();

        chrome.storage.onChanged.addListener((changes) => {
            if (changes.askZepraEnabled) SETTINGS.enabled = changes.askZepraEnabled.newValue;
            if (changes.askZepraIcon) SETTINGS.showIcon = changes.askZepraIcon.newValue;
            if (changes.askZepraShortcut) SETTINGS.shortcut = changes.askZepraShortcut.newValue;
        });
    }

    async function loadSettings() {
        const data = await chrome.storage.local.get(['askZepraEnabled', 'askZepraIcon', 'askZepraShortcut']);
        // Default to true if not explicitly set to false
        SETTINGS.enabled = data.askZepraEnabled !== false;
        SETTINGS.showIcon = data.askZepraIcon !== false;
        if (data.askZepraShortcut) SETTINGS.shortcut = data.askZepraShortcut;
    }

    // --- UI CREATION (ZERO-FLICKER) ---
    function createUI() {
        const host = document.createElement('div');
        host.id = 'zepra-host-root';

        // Critical: Set display none initially to ensure absolute physical invisibility
        host.style.display = 'none';
        host.style.opacity = '0';
        host.style.transition = 'opacity 0.2s ease';

        document.body.appendChild(host);
        shadowRoot = host.attachShadow({ mode: 'open' });

        // CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('ask_zepra.css');

        // Anti-Flash: Wait for CSS to load before revealing host
        link.onload = () => {
            requestAnimationFrame(() => {
                host.style.display = 'block';
                // Allow browser to register 'display: block' before transitioning opacity
                requestAnimationFrame(() => {
                    host.style.opacity = '1';
                });
            });
        };

        shadowRoot.appendChild(link);

        // Template
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
      <!-- Trigger -->
      <div id="zTrigger" class="zepra-trigger">${ICONS.sparkle}</div>

      <!-- Modal -->
      <div id="zModal" class="zepra-modal initial-view">
        <div id="zResizeHandle" class="zepra-resize-handle"></div>
        <div id="zHeader" class="zepra-header">
            <div class="zepra-brand-wrapper">
                 <div class="zepra-brand-icon">${ICONS.sparkle}</div>
                 <div class="zepra-brand-info">
                    <span class="zepra-brand-title">Ask Zepra <span class="zepra-badge">PRO</span></span>
                    <span class="zepra-brand-subtitle">Smart Vision &bull; Memory</span>
                 </div>
            </div>
            <div class="zepra-actions">
               <button id="zHistoryToggle" class="zepra-action-btn" title="Toggle History">${ICONS.list}</button>
               <button id="zRTL" class="zepra-action-btn" title="Toggle RTL">${ICONS.rtl}</button>
               <button id="zClose" class="zepra-action-btn">${ICONS.close}</button>
            </div>
        </div>
        
        <div class="zepra-layout">
            <!-- Main Column (Now First) -->
            <div class="zepra-main-column">
                <!-- Main Content (Welcome + Messages) -->
                <div id="zContent" class="zepra-content">
                    <!-- Welcome View -->
                    <div id="zWelcome" class="zepra-welcome">
                        <div class="zepra-video-header">
                             <video class="zepra-mascot-video" src="${chrome.runtime.getURL('src/cutezepra.webm')}" autoplay loop muted playsinline></video>
                        </div>
                        
                        <div class="zepra-greeting">
                           <h1>Hello, <span class="text-gradient">Creator</span></h1>
                           <p>I can see this page. Ask me anything.</p>
                        </div>

                        <div class="zepra-actions-grid">
                            <div class="zepra-action-card" data-prompt="Summarize the visible content of this page.">
                                <div class="action-icon">${ICONS.list}</div>
                                <div class="action-content">
                                    <div class="action-title">Summarize</div>
                                    <div class="action-desc">What's on screen</div>
                                </div>
                            </div>
                            <div class="zepra-action-card" data-prompt="Analyze the tone and sentiment of this text.">
                                <div class="action-icon">${ICONS.brain}</div>
                                <div class="action-content">
                                    <div class="action-title">Analyze</div>
                                    <div class="action-desc">Detect sentiment</div>
                                </div>
                            </div>
                            <div class="zepra-action-card" data-prompt="Translate this content to professional Arabic.">
                                <div class="action-icon">${ICONS.globe}</div>
                                <div class="action-content">
                                    <div class="action-title">Translate</div>
                                    <div class="action-desc">To Arabic</div>
                                </div>
                            </div>
                            <div class="zepra-action-card" data-prompt="Extract key data points (dates, emails, prices).">
                                <div class="action-icon">${ICONS.doc}</div>
                                <div class="action-content">
                                    <div class="action-title">Extract</div>
                                    <div class="action-desc">Key details</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Messages -->
                    <div id="zMessages" class="zepra-messages"></div>
                </div>

                <!-- Input Area (Clean) -->
                <div class="zepra-input-area">
                  <div class="zepra-input-wrapper">
                     <div class="zepra-input-tools">
                        <button id="zMagicVision" class="zepra-tool-btn" title="Capture Snippet - Cut & Analyze">
                            ${ICONS.scissors}
                        </button>
                     </div>
                     <textarea id="zInput" class="zepra-input" placeholder="Ask a question..." rows="1"></textarea>
                     <div class="zepra-input-actions">
                        <button id="zSend" class="zepra-send-btn" disabled>${ICONS.send}</button>
                     </div>
                  </div>
                  <div id="zCapturePreview" class="zepra-capture-preview" style="display:none;">
                      <div class="capture-preview-content">
                          <span class="capture-preview-label">📷 Region Captured</span>
                          <button id="zClearCapture" class="capture-clear-btn">✕</button>
                      </div>
                  </div>
                  <div class="zepra-disclaimer">AI has access to visible page content.</div>
                </div>
            </div>

            <!-- Sidebar (Now Last = Right Side) -->
            <div id="zSidebar" class="zepra-sidebar">
                <div class="zepra-sidebar-header">
                    <div class="zepra-search-box">
                        <div class="zepra-search-icon">${ICONS.doc}</div>
                        <input type="text" id="zHistorySearch" class="zepra-search-input" placeholder="Search history...">
                    </div>
                </div>
                <div id="zHistoryList" class="zepra-history-list">
                    <!-- Items injected here -->
                </div>
            </div>
        </div>
      </div>
    `;
        shadowRoot.appendChild(wrapper);

        // Fallback: If CSS fails or takes too long (e.g. 1s), show anyway to ensure functionality
        setTimeout(() => {
            if (host.style.opacity === '0') {
                host.style.display = 'block';
                requestAnimationFrame(() => host.style.opacity = '1');
            }
        }, 1000);

        // Refs
        triggerBtn = shadowRoot.getElementById('zTrigger');
        modal = shadowRoot.getElementById('zModal');
        inputField = shadowRoot.getElementById('zInput');
        sendBtn = shadowRoot.getElementById('zSend');
        contentArea = shadowRoot.getElementById('zContent');

        setupDraggable(modal, shadowRoot.getElementById('zHeader'));
        setupResizer(modal, shadowRoot.getElementById('zResizeHandle'));
    }

    // --- SIDEBAR LOGIC ---
    async function toggleSidebar() {
        const sidebar = shadowRoot.getElementById('zSidebar');
        const isActive = sidebar.classList.toggle('visible');
        if (isActive) {
            await loadHistoryList();
        }
    }

    async function loadHistoryList() {
        const list = shadowRoot.getElementById('zHistoryList');
        // Add "New Chat" button at the top
        let html = `
            <div class="zepra-history-item" id="zNewChatBtn">
                <div class="zepra-history-title" style="color: var(--z-accent);">+ New Chat</div>
            </div>
        `;

        const res = await ZepraMemoryClient.list(50);
        if (res.ok && res.conversations) {
            res.conversations.forEach(conv => {
                const date = new Date(conv.timestamp).toLocaleDateString();
                const activeClass = conv.id === activeConversationId ? 'active' : '';
                const title = conv.title || conv.messages[0]?.text?.substring(0, 30) || 'Untitled Chat';

                html += `
                    <div class="zepra-history-item ${activeClass}" data-id="${conv.id}">
                        <div class="zepra-history-title">${title}</div>
                        <div class="zepra-history-meta">
                            <span>${date}</span>
                            <span>${conv.messages.length} msgs</span>
                        </div>
                    </div>
                `;
            });
        } else {
            html += `<div style="padding:10px; color:var(--z-dim); font-size:12px; text-align:center;">No history yet</div>`;
        }

        list.innerHTML = html;

        // Attach events
        list.querySelector('#zNewChatBtn').addEventListener('click', startNewChat);
        list.querySelectorAll('.zepra-history-item[data-id]').forEach(el => {
            el.addEventListener('click', () => loadConversation(el.dataset.id));
        });
    }

    async function loadConversation(id) {
        const res = await ZepraMemoryClient.load(id);
        if (res.ok && res.conversation) {
            activeConversationId = id;
            chatHistory = res.conversation.messages || [];

            // UI: Switch to Messages
            shadowRoot.getElementById('zWelcome').style.display = 'none';
            const msgsDiv = shadowRoot.getElementById('zMessages');
            msgsDiv.style.display = 'flex';
            msgsDiv.classList.add('visible');
            msgsDiv.innerHTML = '';

            // Render messages
            chatHistory.forEach(msg => appendMessage(msg.role, msg.text));

            // Update UI (Sidebar selection)
            loadHistoryList(); // Refresh to show active state
        }
    }

    function startNewChat() {
        activeConversationId = null;
        chatHistory = [];

        // UI: Switch to Welcome
        const msgs = shadowRoot.getElementById('zMessages');
        msgs.innerHTML = '';
        msgs.style.display = 'none';

        shadowRoot.getElementById('zWelcome').style.display = 'flex';

        loadHistoryList();
    }

    function searchHistory(query) {
        const items = shadowRoot.querySelectorAll('.zepra-history-item[data-id]');
        const lowerQuery = query.toLowerCase();
        items.forEach(item => {
            const title = item.querySelector('.zepra-history-title').textContent.toLowerCase();
            if (title.includes(lowerQuery)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    function attachListeners() {
        document.addEventListener('mouseup', handleMouseUp);

        triggerBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Ensure we have the cached selection before opening
            // The selection might be lost when clicking the trigger
            if (!cachedSelection) {
                const sel = window.getSelection();
                if (sel) cachedSelection = sel.toString().trim();
            }
            openModal('selection');
        });

        shadowRoot.getElementById('zClose').addEventListener('click', closeModal);
        shadowRoot.getElementById('zRTL').addEventListener('click', toggleRTL);
        shadowRoot.getElementById('zHistoryToggle').addEventListener('click', toggleSidebar);

        shadowRoot.getElementById('zHistorySearch').addEventListener('input', (e) => {
            searchHistory(e.target.value);
        });

        shadowRoot.querySelectorAll('.zepra-action-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                if (prompt) {
                    inputField.value = prompt;
                    handleSend();
                }
            });
        });

        // Magic Vision button
        const magicVisionBtn = shadowRoot.getElementById('zMagicVision');
        if (magicVisionBtn) {
            magicVisionBtn.addEventListener('click', () => {
                startMagicVision();
            });
        }

        // Clear capture button
        const clearCaptureBtn = shadowRoot.getElementById('zClearCapture');
        if (clearCaptureBtn) {
            clearCaptureBtn.addEventListener('click', () => {
                clearMagicCapture();
            });
        }

        sendBtn.addEventListener('click', handleSend);
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });
        inputField.addEventListener('input', () => {
            sendBtn.disabled = !inputField.value.trim();
            inputField.style.height = 'auto';
            inputField.style.height = Math.min(inputField.scrollHeight, 150) + 'px';
        });

        document.addEventListener('keydown', (e) => {
            if (!SETTINGS.enabled) return;
            const key = e.key.toUpperCase();
            const setKey = SETTINGS.shortcut.toUpperCase();
            let match = false;
            if (setKey.startsWith('F') && key === setKey) match = true;
            else if (e.ctrlKey && setKey === 'CTRL+' + key) match = true;

            if (match) {
                e.preventDefault();
                const sel = window.getSelection().toString().trim();
                if (sel) {
                    cachedSelection = sel;
                    showTriggerNearSelection();
                    setTimeout(() => openModal('selection'), 100);
                } else {
                    openModal('page');
                }
            }
        });
    }

    // --- CORE 2.0 LOGIC (SMART CONTEXT) ---

    function getSmartContext(mode) {
        // Essential Metadata
        const meta = {
            title: document.title || 'Untitled Page',
            url: window.location.href,
            description: document.querySelector('meta[name="description"]')?.content || ''
        };

        // Case 1: Active Selection (Most specific)
        if (mode === 'selection') {
            // Priority: cachedSelection > window.getSelection()
            let rawSel = cachedSelection;
            if (!rawSel) {
                const sel = window.getSelection();
                rawSel = sel ? sel.toString().trim() : '';
            }

            console.log('[Zepra] Selection captured:', rawSel ? rawSel.substring(0, 100) + '...' : 'EMPTY');

            return {
                type: 'Selection',
                text: rawSel,
                ...meta
            };
        }

        // Case 2: Viewport Extraction (The "Eye")
        // We only scrape what is VISIBLE to the user + small buffer
        const buffer = 500; // px
        const viewHeight = window.innerHeight;
        const textNodes = [];

        // Heuristic: Scan meaningful text blocks
        // We scan: P, H1-H6, LI, ARTICLE, PRE, CODE, BLOCKQUOTE
        // We ignore: NAV, FOOTER, SCRIPTS (implicitly by tag choice)
        const candidates = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, article, pre, blockquote, span');

        candidates.forEach(el => {
            // 1. Visibility Check
            if (el.offsetParent === null) return; // Hidden

            // 2. Geometry Check (Is it in/near Viewport?)
            const rect = el.getBoundingClientRect();
            if (rect.bottom < -buffer || rect.top > viewHeight + buffer) return; // Out of view

            // 3. Density/Garbage Check
            const text = el.innerText.trim();
            if (text.length < 15) return; // Ignore tiny crumbs like "Menu", "Date"

            // 4. Content is valid. Push it.
            // Note: We might duplicate parent/child text. innerText handles children. 
            // Better to prefer leaf nodes, but for V1, getting full blocks is safer context.
            // We'll clean duplicates roughly.
            textNodes.push(text);
        });

        const uniqueText = [...new Set(textNodes)].join('\n\n');

        return {
            type: 'Visible Viewport',
            text: uniqueText.substring(0, 15000), // Safety cap
            ...meta
        };
    }

    function handleMouseUp(e) {
        if (!SETTINGS.enabled) return;
        if (e.target.id === 'zepra-host-root') return;
        clearTimeout(selectionTimer);
        selectionTimer = setTimeout(() => {
            const sel = window.getSelection();
            const text = sel ? sel.toString().trim() : '';
            if (text.length > 1 && SETTINGS.showIcon) {
                cachedSelection = text;
                console.log('[Zepra] Selection cached:', text.substring(0, 50) + '...');
                showTriggerNearSelection(e);
            } else {
                hideTrigger();
                // Don't clear cache here - keep it for when trigger is clicked
            }
        }, 150);
    }

    function showTriggerNearSelection(e) {
        if (!triggerBtn) return;
        const sel = window.getSelection();
        let rect;
        try {
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const rects = range.getClientRects();
                // Use the last rect for better positioning at end of selection
                if (rects.length > 0) rect = rects[rects.length - 1];
                else rect = range.getBoundingClientRect();
            }
        } catch (err) { }

        if (!rect || rect.width === 0) {
            if (e && e.clientX) rect = { left: e.clientX, top: e.clientY, right: e.clientX, height: 20, width: 0 };
            else return;
        }

        // Position above the selection end, using fixed positioning (no scroll offset needed)
        const top = rect.top - 40; // 40px above the selection
        const left = rect.right - 16; // Centered on the end of selection

        triggerBtn.style.position = 'fixed';
        triggerBtn.style.top = `${Math.max(10, top)}px`;
        triggerBtn.style.left = `${Math.min(window.innerWidth - 50, Math.max(10, left))}px`;
        triggerBtn.classList.add('visible');
    }

    function hideTrigger() {
        if (triggerBtn) triggerBtn.classList.remove('visible');
    }

    function openModal(mode) {
        if (!modal) return;
        hideTrigger();
        isOpen = true;
        modal.classList.add('visible');

        // Capture Context NOW (Snapshot)
        currentContext = getSmartContext(mode);

        setTimeout(() => inputField.focus(), 200);
    }

    function closeModal() {
        isOpen = false;
        modal.classList.remove('visible');
        // Clear cached selection when modal closes
        cachedSelection = '';
        // Clear Magic Vision capture
        capturedRegionText = '';
        captureRect = null;
        const preview = shadowRoot.getElementById('zCapturePreview');
        if (preview) preview.style.display = 'none';
    }

    function toggleRTL() {
        isRTL = !isRTL;
        const msgs = shadowRoot.getElementById('zMessages');
        const input = shadowRoot.getElementById('zInput');

        if (isRTL) {
            msgs.style.direction = 'rtl';
            input.style.direction = 'rtl';
            msgs.classList.add('rtl-mode');
        } else {
            msgs.style.direction = 'ltr';
            input.style.direction = 'ltr';
            msgs.classList.remove('rtl-mode');
        }
    }

    // ==========================================
    // 🪄 MAGIC VISION SYSTEM
    // ==========================================

    function startMagicVision() {
        if (magicVisionActive) return;
        magicVisionActive = true;

        // Hide modal temporarily
        if (modal) modal.style.opacity = '0.3';

        // Create overlay
        magicVisionOverlay = document.createElement('div');
        magicVisionOverlay.id = 'zepra-magic-overlay';
        magicVisionOverlay.innerHTML = `
            <div class="magic-overlay-bg"></div>
            <div class="magic-selection-box" id="zMagicSelection"></div>
            <div class="magic-instructions">
                <div class="magic-instruction-icon">✨</div>
                <div class="magic-instruction-text">Drag to select a region</div>
                <div class="magic-instruction-hint">Press ESC to cancel</div>
            </div>
            <div class="magic-sparkles" id="zMagicSparkles"></div>
        `;

        // Style the overlay
        magicVisionOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483646;
            cursor: crosshair;
        `;

        document.body.appendChild(magicVisionOverlay);

        // Add styles
        const styleEl = document.createElement('style');
        styleEl.id = 'zepra-magic-styles';
        styleEl.textContent = `
            #zepra-magic-overlay .magic-overlay-bg {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: radial-gradient(ellipse at center, rgba(0, 50, 30, 0.7) 0%, rgba(0, 30, 20, 0.85) 100%);
                animation: magicFadeIn 0.3s ease;
            }
            
            @keyframes magicFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            #zepra-magic-overlay .magic-selection-box {
                position: absolute;
                border: 2px dashed #00ff88;
                background: rgba(0, 255, 136, 0.1);
                box-shadow: 0 0 20px rgba(0, 255, 136, 0.4), inset 0 0 30px rgba(0, 255, 136, 0.1);
                border-radius: 4px;
                display: none;
                pointer-events: none;
            }
            
            #zepra-magic-overlay .magic-selection-box.active {
                display: block;
                animation: selectionPulse 1s ease infinite;
            }
            
            @keyframes selectionPulse {
                0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.4), inset 0 0 30px rgba(0, 255, 136, 0.1); }
                50% { box-shadow: 0 0 40px rgba(0, 255, 136, 0.6), inset 0 0 50px rgba(0, 255, 136, 0.2); }
            }
            
            #zepra-magic-overlay .magic-instructions {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #00ff88;
                font-family: 'Inter', sans-serif;
                animation: floatInstructions 2s ease-in-out infinite;
                pointer-events: none;
            }
            
            @keyframes floatInstructions {
                0%, 100% { transform: translate(-50%, -50%) translateY(0); }
                50% { transform: translate(-50%, -50%) translateY(-10px); }
            }
            
            #zepra-magic-overlay .magic-instruction-icon {
                font-size: 48px;
                margin-bottom: 16px;
                animation: sparkleRotate 3s linear infinite;
            }
            
            @keyframes sparkleRotate {
                0% { transform: rotate(0deg) scale(1); }
                25% { transform: rotate(5deg) scale(1.1); }
                50% { transform: rotate(0deg) scale(1); }
                75% { transform: rotate(-5deg) scale(1.1); }
                100% { transform: rotate(0deg) scale(1); }
            }
            
            #zepra-magic-overlay .magic-instruction-text {
                font-size: 24px;
                font-weight: 600;
                text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
                margin-bottom: 8px;
            }
            
            #zepra-magic-overlay .magic-instruction-hint {
                font-size: 14px;
                opacity: 0.7;
            }
            
            #zepra-magic-overlay .magic-instructions.hidden {
                display: none;
            }
            
            .magic-sparkle {
                position: absolute;
                width: 8px;
                height: 8px;
                background: #00ff88;
                border-radius: 50%;
                pointer-events: none;
                animation: sparkleFloat 1s ease-out forwards;
            }
            
            @keyframes sparkleFloat {
                0% {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
                100% {
                    opacity: 0;
                    transform: scale(0) translateY(-50px) rotate(180deg);
                }
            }
            
            .magic-glow-burst {
                position: absolute;
                border-radius: 8px;
                background: radial-gradient(ellipse at center, rgba(0, 255, 136, 0.8) 0%, transparent 70%);
                animation: glowBurst 0.6s ease-out forwards;
                pointer-events: none;
            }
            
            @keyframes glowBurst {
                0% {
                    opacity: 1;
                    transform: scale(0.8);
                }
                50% {
                    opacity: 0.8;
                    transform: scale(1.2);
                }
                100% {
                    opacity: 0;
                    transform: scale(1.5);
                }
            }
        `;
        document.head.appendChild(styleEl);

        // Selection state
        let isSelecting = false;
        let startX = 0, startY = 0;
        const selectionBox = magicVisionOverlay.querySelector('#zMagicSelection');
        const instructions = magicVisionOverlay.querySelector('.magic-instructions');

        // Mouse events
        const handleMouseDown = (e) => {
            if (e.target.closest('.magic-instructions')) return;
            isSelecting = true;
            startX = e.clientX;
            startY = e.clientY;
            instructions.classList.add('hidden');
            selectionBox.classList.add('active');
            selectionBox.style.left = startX + 'px';
            selectionBox.style.top = startY + 'px';
            selectionBox.style.width = '0';
            selectionBox.style.height = '0';
        };

        const handleMouseMove = (e) => {
            if (!isSelecting) return;
            const currentX = e.clientX;
            const currentY = e.clientY;

            const left = Math.min(startX, currentX);
            const top = Math.min(startY, currentY);
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);

            selectionBox.style.left = left + 'px';
            selectionBox.style.top = top + 'px';
            selectionBox.style.width = width + 'px';
            selectionBox.style.height = height + 'px';
        };

        const handleMouseUp = async (e) => {
            if (!isSelecting) return;
            isSelecting = false;

            const rect = selectionBox.getBoundingClientRect();
            if (rect.width < 20 || rect.height < 20) {
                cancelMagicVision();
                return;
            }

            captureRect = {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                x: rect.left,
                y: rect.top,
                dpr: window.devicePixelRatio || 1
            };

            // Create sparkle burst effect
            createSparkleEffect(rect);

            // Capture and OCR
            await performMagicCapture(captureRect);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                cancelMagicVision();
            }
        };

        magicVisionOverlay.addEventListener('mousedown', handleMouseDown);
        magicVisionOverlay.addEventListener('mousemove', handleMouseMove);
        magicVisionOverlay.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('keydown', handleKeyDown);

        // Store cleanup function
        magicVisionOverlay._cleanup = () => {
            magicVisionOverlay.removeEventListener('mousedown', handleMouseDown);
            magicVisionOverlay.removeEventListener('mousemove', handleMouseMove);
            magicVisionOverlay.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }

    function createSparkleEffect(rect) {
        const sparklesContainer = magicVisionOverlay.querySelector('#zMagicSparkles');
        const numSparkles = 30;

        // Create glow burst
        const glowBurst = document.createElement('div');
        glowBurst.className = 'magic-glow-burst';
        glowBurst.style.left = rect.left + 'px';
        glowBurst.style.top = rect.top + 'px';
        glowBurst.style.width = rect.width + 'px';
        glowBurst.style.height = rect.height + 'px';
        sparklesContainer.appendChild(glowBurst);

        // Create sparkles
        for (let i = 0; i < numSparkles; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'magic-sparkle';

            // Random position around the selection
            const edge = Math.floor(Math.random() * 4);
            let x, y;

            switch (edge) {
                case 0: // top
                    x = rect.left + Math.random() * rect.width;
                    y = rect.top;
                    break;
                case 1: // right
                    x = rect.left + rect.width;
                    y = rect.top + Math.random() * rect.height;
                    break;
                case 2: // bottom
                    x = rect.left + Math.random() * rect.width;
                    y = rect.top + rect.height;
                    break;
                case 3: // left
                    x = rect.left;
                    y = rect.top + Math.random() * rect.height;
                    break;
            }

            sparkle.style.left = x + 'px';
            sparkle.style.top = y + 'px';
            sparkle.style.animationDelay = (Math.random() * 0.3) + 's';
            sparkle.style.background = Math.random() > 0.5 ? '#00ff88' : '#ffffff';

            sparklesContainer.appendChild(sparkle);
        }
    }

    async function performMagicCapture(rect) {
        try {
            // Show loading state in selection
            const selectionBox = magicVisionOverlay.querySelector('#zMagicSelection');
            selectionBox.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:8px;">
                     <div class="zepra-loader" style="width:24px;height:24px;border-width:2px;border-color:#00ff88;border-bottom-color:transparent;"></div>
                     <span style="color:#00ff88;font-size:12px;font-weight:600;text-shadow:0 0 10px rgba(0,255,136,0.5);">Analyzing Region...</span>
                </div>`;

            // Request screenshot from background
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({
                    type: 'CAPTURE_AND_OCR',
                    rect: rect,
                    tabId: null // Let background detect active tab
                }, resolve);
            });

            if (response && response.ok) {
                // If text is empty (no text found), we handle gracefully
                capturedRegionText = response.text ? response.text.trim() : '[Image Capture Only - No Text Detected]';
                console.log('[Zepra Magic Vision] OCR Result:', capturedRegionText.substring(0, 100) + '...');

                // Show success and close with sparkle
                selectionBox.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#00ff88;font-size:24px;">✨</div>';

                setTimeout(() => {
                    finishMagicVision(true);
                }, 500);
            } else {
                console.error('[Zepra Magic Vision] OCR failed:', response);
                const errMsg = response && response.error ? response.error : 'Capture failed';
                selectionBox.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff6b6b;font-size:12px;padding:4px;text-align:center;">❌ ${errMsg}</div>`;

                setTimeout(() => {
                    cancelMagicVision();
                }, 1000);
            }
        } catch (err) {
            console.error('[Zepra Magic Vision] Error:', err);
            cancelMagicVision();
        }
    }

    function finishMagicVision(success) {
        if (!magicVisionOverlay) return;

        magicVisionOverlay._cleanup?.();
        magicVisionOverlay.remove();
        document.getElementById('zepra-magic-styles')?.remove();

        magicVisionOverlay = null;
        magicVisionActive = false;

        // Restore modal
        if (modal) modal.style.opacity = '1';

        if (success && capturedRegionText) {
            // Show capture BADGE instead of text preview
            const preview = shadowRoot.getElementById('zCapturePreview');
            if (preview) {
                preview.style.display = 'block';
                const content = preview.querySelector('.capture-preview-content');
                // Remove old label if exists
                const oldLabel = content.querySelector('.capture-preview-label');
                if (oldLabel) oldLabel.remove();

                // Add badge if needed
                let badge = content.querySelector('.magic-capture-badge');
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'magic-capture-badge';
                    const clearBtn = content.querySelector('.capture-clear-btn');
                    if (clearBtn) content.insertBefore(badge, clearBtn);
                    else content.appendChild(badge);
                }

                badge.innerHTML = `
                    ${ICONS.scissors}
                    <span>Specific Part Captured</span>
                `;
            }

            // Update context
            currentContext = {
                type: 'Magic Vision Capture',
                text: capturedRegionText,
                title: document.title,
                url: window.location.href
            };

            // Focus input
            setTimeout(() => inputField?.focus(), 100);
        }
    }

    function cancelMagicVision() {
        capturedRegionText = '';
        captureRect = null;
        finishMagicVision(false);
    }

    function clearMagicCapture() {
        capturedRegionText = '';
        captureRect = null;
        const preview = shadowRoot.getElementById('zCapturePreview');
        if (preview) preview.style.display = 'none';

        // Reset context
        currentContext = { type: 'page', text: '', title: document.title, url: window.location.href };
    }

    async function handleSend() {
        const question = inputField.value.trim();
        if (!question) return;

        // UI: Switch to Messages View
        const welcome = shadowRoot.getElementById('zWelcome');
        const msgs = shadowRoot.getElementById('zMessages');

        if (welcome) welcome.style.display = 'none';
        if (msgs) {
            msgs.style.display = 'flex';
            msgs.classList.add('visible');
        }

        appendMessage('user', question);
        inputField.value = '';
        sendBtn.disabled = true;
        inputField.style.height = 'auto';

        const loaderId = appendLoader();

        // --- ENHANCED PROMPT ENGINEERING ---

        // 1. Memory Serialization (Last 6 messages)
        const historyStr = chatHistory.slice(-6).map(msg =>
            `${msg.role === 'user' ? 'USER' : 'ZEPRA'}: ${msg.text}`
        ).join('\n---\n');

        // 2. Context Extraction
        const hasSelection = currentContext.text && currentContext.text.length > 0;
        const isMagicVision = currentContext.type === 'Magic Vision Capture';
        const fullPageText = document.body.innerText.substring(0, 15000);

        // Build prompt with clear selection emphasis
        let contextSection = '';

        if (isMagicVision) {
            contextSection = `
🪄 MAGIC VISION CAPTURE 🪄
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The user captured a SPECIFIC REGION of the screen using Magic Vision.
The OCR-extracted text from that region is:

"""
${currentContext.text}
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FOCUS ON THIS CAPTURED CONTENT ONLY!
`;
        } else if (hasSelection) {
            contextSection = `
⚠️ IMPORTANT: USER HAS SELECTED SPECIFIC TEXT ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The user has highlighted/selected the following text:

"""
${currentContext.text}
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Apply the user's instruction SPECIFICALLY to this text!
`;
        } else {
            contextSection = `
**Full Page Content** (reference):
"""
${fullPageText.substring(0, 8000)}
"""
`;
        }

        const prompt = `[SYSTEM ROLE]
You are Zepra, an elite AI browser assistant.

[PAGE CONTEXT]
URL: ${currentContext.url}
Title: ${currentContext.title}
${contextSection}

[CONVERSATION HISTORY]
${historyStr || 'No previous conversation.'}

[USER INSTRUCTION]
${question}
${(hasSelection || isMagicVision) ? `\n(Apply this to the ${isMagicVision ? 'captured content' : 'selected text'} above!)` : ''}

[RESPONSE GUIDELINES]
${aiFormatter.getSystemInstruction()}
`;

        // Store User Msg in Memory
        chatHistory.push({ role: 'user', text: question });

        // MEMORY SAVE (User)
        ZepraMemoryClient.save({
            id: activeConversationId,
            title: chatHistory.length === 1 ? question.substring(0, 50) : undefined,
            messages: chatHistory,
            tags: ['general']
        }).then(res => { if (res && res.id) activeConversationId = res.id; });

        try {
            chrome.runtime.sendMessage({
                type: 'CEREBRAS_GENERATE',
                prompt: prompt,
                options: { temperature: 1, max_completion_tokens: 32768 }
            }, (response) => {
                removeLoader(loaderId);
                let reply = '';
                if (response && response.result) {
                    reply = response.result;
                } else {
                    reply = 'Connection error. Please try again.';
                }

                // Pre-process and Parse handled by appendMessage calling parseMarkdown which calls aiFormatter
                appendMessage('ai', reply);
                chatHistory.push({ role: 'ai', text: reply });

                // MEMORY SAVE (AI)
                if (activeConversationId) {
                    ZepraMemoryClient.save({
                        id: activeConversationId,
                        messages: chatHistory
                    });
                }
            });
        } catch (e) {
            removeLoader(loaderId);
            appendMessage('ai', 'Error: ' + e.message);
        }
    }

    // --- HELPERS ---
    function appendMessage(role, text) {
        const div = document.createElement('div');
        div.className = `zepra - msg ${role} `;
        if (isRTL) div.style.direction = 'rtl'; // Apply current dir

        const roleLabel = document.createElement('div');
        roleLabel.className = 'zepra-msg-role';
        roleLabel.textContent = role === 'user' ? 'You' : 'Zepra';

        const body = document.createElement('div');
        body.className = 'zepra-msg-body';

        if (role === 'ai') {
            // HYBRID RENDERING: Try JSON first, fallback to Markdown
            const jsonRenderer = new ZepraJSONRenderer();
            let html = jsonRenderer.render(text);

            if (!html) {
                // JSON failed, use Markdown parser
                html = parseMarkdown(text);
            }

            body.innerHTML = html;
        } else {
            body.textContent = text;
        }

        div.appendChild(roleLabel);
        div.appendChild(body);

        const msgContainer = shadowRoot.getElementById('zMessages');
        if (msgContainer) {
            msgContainer.appendChild(div);
            msgContainer.scrollTop = msgContainer.scrollHeight;
        } else {
            contentArea.appendChild(div);
            scrollToBottom();
        }
    }

    function appendLoader() {
        const id = 'loader-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'zepra-msg ai';
        div.innerHTML = `
            <div class="zepra-msg-role">Zepra</div>
            <div class="zepra-msg-body">
                <div class="zepra-loader">
                    <div class="zepra-loader-ring"></div>
                    <span class="zepra-loader-text">Thinking...</span>
                </div>
            </div>
        `;
        const msgContainer = shadowRoot.getElementById('zMessages');
        if (msgContainer) {
            msgContainer.appendChild(div);
            msgContainer.scrollTop = msgContainer.scrollHeight;
        } else {
            contentArea.appendChild(div);
        }
        return id;
    }

    function removeLoader(id) {
        const el = shadowRoot.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        const msgContainer = shadowRoot.getElementById('zMessages');
        if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
        else contentArea.scrollTop = contentArea.scrollHeight;
    }

    function setupDraggable(el, handle) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            const rect = el.getBoundingClientRect();
            startLeft = rect.left; startTop = rect.top;
            el.style.right = 'auto'; el.style.bottom = 'auto';
            el.style.top = startTop + 'px'; el.style.left = startLeft + 'px';
            handle.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX; const dy = e.clientY - startY;
            el.style.top = (startTop + dy) + 'px'; el.style.left = (startLeft + dx) + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) { isDragging = false; handle.style.cursor = 'grab'; document.body.style.userSelect = ''; }
        });
    }

    function setupResizer(el, handle) {
        let isResizing = false;
        let startX, startY, startW, startH, startLeft, startTop;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startW = parseInt(window.getComputedStyle(el).width, 10);
            startH = parseInt(window.getComputedStyle(el).height, 10);
            const rect = el.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            document.body.style.cursor = 'nwse-resize';
            handle.style.cursor = 'nwse-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            // Top-Left Resize Logic
            // Moving Left (negative delta) should INCREASE width
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const newW = startW - deltaX;
            const newH = startH - deltaY;

            if (newW > 300 && newW < window.innerWidth - 50) {
                el.style.width = newW + 'px';
                el.style.left = (startLeft + deltaX) + 'px';
            }
            if (newH > 400 && newH < window.innerHeight - 50) {
                el.style.height = newH + 'px';
                el.style.top = (startTop + deltaY) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
            }
        });
    }

    // 1. Zepra AI FORMATTER (Restored)
    class ZepraAIFormatter {
        constructor() {
            this.systemPromptFragment = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
� ZEPRA AI - ELITE CREATIVE ASSISTANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

أنت "Zepra" - مساعد ذكي استثنائي، خبير في كل المجالات، ودود ومبدع.
شخصيتك: ذكي، مفيد، مبدع، صديق يمكن الاعتماد عليه، يحب المساعدة بالتفصيل.

🎯 مهمتك: قدم إجابات شاملة، مفصلة، غنية بالمعلومات والأمثلة.
لا تختصر أبداً! المستخدم يريد فهماً عميقاً وإجابات كاملة.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 OUTPUT FORMAT (JSON REQUIRED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ أجب دائماً بـ JSON فقط. هذا ضروري لعمل النظام.

{
  "type": "response",
  "language": "ar|en",
  "content": [/* مصفوفة من الكتل */],
  "suggestions": ["سؤال متابعة 1", "سؤال متابعة 2", "سؤال متابعة 3"]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 CONTENT BLOCKS (استخدمها بإبداع!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. HEADING (عناوين):
{ "type": "heading", "level": 1|2|3, "text": "📌 العنوان هنا" }

2. PARAGRAPH (فقرات - استخدم التنسيق الغني):
{ "type": "paragraph", "text": "نص مع <bold>عريض</bold> و<italic>مائل</italic> و<highlight>مميز</highlight> و<code>كود</code>" }

3. LIST (قوائم):
{ "type": "list", "style": "bullet|number", "items": ["✨ عنصر 1", "🔥 عنصر 2", "💡 عنصر 3"] }

4. TABLE (جداول للمقارنات):
{ "type": "table", "headers": ["العمود 1", "العمود 2"], "rows": [["قيمة", "قيمة"]] }

5. CODE (أكواد مع تلوين):
{ "type": "code", "language": "javascript|python|html|css|bash", "code": "// الكود هنا" }

6. ALERT (تنبيهات ملونة):
{ "type": "alert", "style": "info|warning|success|tip", "text": "💡 رسالة مهمة" }
- info: معلومة (أزرق)
- warning: تحذير (أصفر)  
- success: نجاح (أخضر)
- tip: نصيحة (بنفسجي)

7. QUOTE (اقتباسات):
{ "type": "quote", "text": "الاقتباس هنا", "author": "المؤلف (اختياري)" }

8. DIVIDER (فاصل بصري):
{ "type": "divider" }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 CREATIVE GUIDELINES (اتبعها!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ استخدم الإيموجي بذكاء في العناوين والقوائم: 🔥 💡 ✨ 📌 🎯 ⚡ 🚀 ✅ ❌ ⚠️
✅ اجعل الإجابة شاملة ومفصلة - لا تختصر أبداً!
✅ استخدم الجداول للمقارنات (بدون خطوط فاصلة |---|)
✅ استخدم التنبيهات للنصائح المهمة والتحذيرات
✅ قسّم الإجابة لأقسام بعناوين واضحة
✅ أضف أمثلة عملية كلما أمكن
✅ استخدم <bold> للمصطلحات المهمة
✅ استخدم <highlight> للنقاط الرئيسية
✅ أضف اقتراحات أسئلة متابعة في نهاية كل رد

🎯 طول الإجابة:
- سؤال بسيط: 5-8 كتل محتوى على الأقل
- سؤال متوسط: 10-15 كتلة محتوى
- سؤال معقد: 15-25 كتلة محتوى أو أكثر

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ EXAMPLE (مثال كامل)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USER: "ما هو JavaScript؟"

RESPONSE:
{
  "type": "response",
  "language": "ar",
  "content": [
    { "type": "heading", "level": 2, "text": "🚀 JavaScript - لغة الويب الأقوى" },
    { "type": "paragraph", "text": "<bold>JavaScript</bold> هي لغة البرمجة <highlight>الأكثر استخداماً في العالم</highlight>، وهي العمود الفقري للويب الحديث." },
    { "type": "alert", "style": "info", "text": "💡 97% من المواقع تستخدم JavaScript!" },
    { "type": "heading", "level": 3, "text": "⚡ الاستخدامات الرئيسية" },
    { "type": "list", "style": "bullet", "items": ["✨ تطوير واجهات المستخدم التفاعلية", "🔥 برمجة الخوادم مع Node.js", "📱 تطبيقات الموبايل مع React Native", "🎮 تطوير الألعاب"] },
    { "type": "heading", "level": 3, "text": "📊 مقارنة سريعة" },
    { "type": "table", "headers": ["الميزة", "JavaScript", "Python"], "rows": [["السرعة", "سريعة جداً", "متوسطة"], ["الاستخدام", "الويب", "AI/Data"]] },
    { "type": "code", "language": "javascript", "code": "// مثال بسيط\\nconsole.log('Hello, Zepra! 🎉');" },
    { "type": "alert", "style": "tip", "text": "💜 نصيحة: ابدأ بتعلم أساسيات HTML/CSS أولاً!" }
  ],
  "suggestions": ["كيف أبدأ تعلم JavaScript؟", "ما الفرق بين JavaScript و TypeScript؟", "ما أفضل مشاريع للمبتدئين؟"]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. أجب بنفس لغة المستخدم (عربي ← عربي، إنجليزي ← إنجليزي)
2. JSON فقط - لا نص عادي أو Markdown
3. لا تستخدم |---| في الجداول
4. أضف suggestions دائماً (2-3 أسئلة متابعة)
5. كن مفيداً، مفصلاً، ومبدعاً!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        }

        getSystemInstruction() {
            return this.systemPromptFragment;
        }

        preProcess(text) {
            if (!text) return '';
            let processed = text;
            // Fix escaped newlines
            processed = processed.replace(/\\n/g, '\n');
            // Ensure headers have newlines
            processed = processed.replace(/([^\n])(#{1,6}\s)/g, '$1\n$2');
            // Ensure code blocks have newlines
            processed = processed.replace(/([^\n])(```)/g, '$1\n$2');
            processed = processed.replace(/(```[\w-]*)([^\n])/g, '$1\n$2');
            // Clean up excessive pipes in tables
            processed = processed.replace(/\|{3,}/g, '|');
            // Remove any stray separator lines that AI might add
            processed = processed.split('\n').filter(line => {
                const trim = line.trim();
                // Remove lines that are ONLY separators
                return !trim.match(/^[|\-:\s]+$/);
            }).join('\n');
            return processed;
        }
    }

    // =========================================
    // JSON RENDERER - NEW SYSTEM
    // =========================================

    class ZepraJSONRenderer {
        render(jsonResponse) {
            try {
                const data = JSON.parse(jsonResponse);

                if (data.type !== 'response' || !Array.isArray(data.content)) {
                    return null; // Invalid JSON, fallback to Markdown
                }

                const html = data.content.map(block => this.renderBlock(block)).join('\n');
                return html;

            } catch (e) {
                return null; // JSON parse failed, fallback to Markdown
            }
        }

        renderBlock(block) {
            if (!block || !block.type) return '';

            switch (block.type) {
                case 'heading':
                    return this.renderHeading(block);
                case 'paragraph':
                    return this.renderParagraph(block);
                case 'list':
                    return this.renderList(block);
                case 'table':
                    return this.renderTable(block);
                case 'code':
                    return this.renderCode(block);
                case 'alert':
                    return this.renderAlert(block);
                case 'quote':
                    return this.renderQuote(block);
                case 'divider':
                    return '<div class="zepra-divider"></div>';
                default:
                    return '';
            }
        }

        renderHeading(block) {
            const level = Math.min(Math.max(parseInt(block.level) || 2, 1), 3);
            const text = this.escapeHtml(block.text || '');
            return `<h${level}>${text}</h${level}>`;
        }

        renderParagraph(block) {
            const text = this.formatInline(block.text || '');
            return `<p>${text}</p>`;
        }

        renderList(block) {
            const style = block.style || 'bullet';
            const items = block.items || [];

            if (items.length === 0) return '';

            const tag = style === 'number' ? 'ol' : 'ul';
            const itemsHtml = items.map(item => {
                const text = this.formatInline(item);
                return `<li>${text}</li>`;
            }).join('');

            return `<${tag}>${itemsHtml}</${tag}>`;
        }

        renderTable(block) {
            const headers = block.headers || [];
            const rows = block.rows || [];

            if (headers.length === 0) return '';

            // Detect RTL
            const isRTL = this.detectRTL(headers.join(' '));

            let html = `<div class="zepra-table-wrapper"><table class="zepra-table" dir="${isRTL ? 'rtl' : 'ltr'}">`;

            // Headers
            html += '<thead><tr>';
            headers.forEach(h => {
                html += `<th>${this.formatInline(h)}</th>`;
            });
            html += '</tr></thead><tbody>';

            // Rows
            rows.forEach(row => {
                if (!Array.isArray(row)) return;

                html += '<tr>';
                for (let i = 0; i < headers.length; i++) {
                    const cell = row[i] !== undefined ? row[i] : '';
                    const content = cell === '' ? '<span style="opacity:0.5">—</span>' : this.formatInline(cell);
                    html += `<td>${content}</td>`;
                }
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            return html;
        }

        renderCode(block) {
            const lang = block.language || 'text';
            const code = this.escapeHtml(block.code || '');

            return `
                <div class="zepra-code-wrapper">
                    <div class="zepra-code-header">
                        <span class="zepra-lang-tag">${lang}</span>
                        <button class="zepra-copy-btn">Copy</button>
                    </div>
                    <pre><code class="language-${lang}">${code}</code></pre>
                </div>
            `;
        }

        renderAlert(block) {
            const style = block.style || 'info';
            const text = this.formatInline(block.text || '');
            const icons = { info: '💡', warning: '⚠️', success: '✅', tip: '💜' };
            const icon = icons[style] || '💡';
            return `<div class="alert alert-${style}">${icon} ${text}</div>`;
        }

        renderQuote(block) {
            const text = this.formatInline(block.text || '');
            const author = block.author ? `<cite>— ${this.escapeHtml(block.author)}</cite>` : '';
            return `<blockquote class="zepra-quote">${text}${author}</blockquote>`;
        }

        formatInline(text) {
            if (!text) return '';

            let result = this.escapeHtml(text);

            // Format inline elements
            result = result.replace(/&lt;bold&gt;(.*?)&lt;\/bold&gt;/g, '<strong>$1</strong>');
            result = result.replace(/&lt;italic&gt;(.*?)&lt;\/italic&gt;/g, '<em>$1</em>');
            result = result.replace(/&lt;highlight&gt;(.*?)&lt;\/highlight&gt;/g, '<span class="highlight">$1</span>');
            result = result.replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/g, '<code class="inline-code">$1</code>');

            return result;
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        detectRTL(text) {
            return /[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/.test(text);
        }
    }

    class ZepraMarkdownRenderer {
        constructor() { this.reset(); }
        reset() {
            this.inTable = false; this.tableBuffer = [];
            this.inCode = false; this.codeBuffer = []; this.codeLang = '';
            this.inList = false;
        }
        parse(text) {
            if (!text) return '';
            const lines = text.split(/\r?\n/);
            let htmlChunks = [];
            this.reset();
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                const trimmed = line.trim();
                // CODE
                if (trimmed.startsWith('```')) {
                    if (this.inCode) {
                        htmlChunks.push(this.renderCode(this.codeBuffer, this.codeLang));
                        this.inCode = false; this.codeBuffer = []; this.codeLang = '';
                    } else {
                        this.inCode = true; this.codeLang = trimmed.replace(/```/, '').trim();
                    }
                    continue;
                }
                if (this.inCode) { this.codeBuffer.push(line); continue; }
                // TABLE (Lenient Detection)
                // Accepts lines with | anywhere, as long as it looks tabular
                if (trimmed.includes('|') && trimmed.length > 5) {
                    if (!this.inTable) { this.inTable = true; }
                    this.tableBuffer.push(line);
                    continue;
                } else if (this.inTable) {
                    this.flushTable(htmlChunks);
                }

                // ... (Rest of parsing)
                // LIST
                const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
                if (listMatch) {
                    if (!this.inList) { htmlChunks.push('<ul>'); this.inList = true; }
                    htmlChunks.push(`<li>${this.formatInline(listMatch[3])}</li>`); continue;
                } else if (this.inList) { this.flushList(htmlChunks); }
                // HEADER
                const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
                if (headerMatch) {
                    const level = headerMatch[1].length;
                    htmlChunks.push(`<h${level}>${this.formatInline(headerMatch[2])}</h${level}>`); continue;
                }
                // QUOTE
                if (trimmed.startsWith('>')) {
                    htmlChunks.push(`<blockquote>${this.formatInline(trimmed.replace(/^>\s*/, ''))}</blockquote>`); continue;
                }
                if (trimmed === '') continue;
                htmlChunks.push(`<p>${this.formatInline(line)}</p>`);
            }
            this.flushAll(htmlChunks);
            return htmlChunks.join('\n');
        }
        flushAll(chunks) {
            this.flushTable(chunks); this.flushList(chunks);
            if (this.inCode) chunks.push(this.renderCode(this.codeBuffer, this.codeLang));
        }
        flushTable(chunks) {
            if (!this.inTable || this.tableBuffer.length === 0) return;
            if (this.tableBuffer.length < 2) chunks.push(`<p>${this.tableBuffer.map(l => this.formatInline(l)).join('<br>')}</p>`);
            else chunks.push(this.renderTable(this.tableBuffer));
            this.inTable = false; this.tableBuffer = [];
        }
        flushList(chunks) { if (this.inList) { chunks.push('</ul>'); this.inList = false; } }
        renderTable(rows) {
            // SMART TABLE PARSER - State Machine Approach
            const analysis = this.analyzeTableStructure(rows);

            // Validate it's a real table
            if (!this.isValidTable(analysis)) {
                return `<p>${rows.map(l => this.formatInline(l)).join('<br>')}</p>`;
            }

            // Extract clean data
            const data = this.extractTableData(rows, analysis);

            // Detect RTL (Arabic)
            const isRTL = this.detectRTL(data.header.join(' '));

            // Render with intelligence
            let html = `<div class="zepra-table-wrapper"><table class="zepra-table" dir="${isRTL ? 'rtl' : 'ltr'}">`;

            // Header
            html += '<thead><tr>';
            data.header.forEach(h => {
                const content = this.formatTableCell(h);
                html += `<th>${content}</th>`;
            });
            html += '</tr></thead><tbody>';

            // Data rows
            data.rows.forEach(row => {
                html += '<tr>';
                row.forEach(cell => {
                    const content = this.formatTableCell(cell);
                    html += `<td>${content}</td>`;
                });
                html += '</tr>';
            });

            return html + '</tbody></table></div>';
        }

        analyzeTableStructure(rows) {
            const analysis = {
                headerRow: null,
                separatorRows: [],
                dataRows: [],
                columnCount: 0
            };

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i].trim();

                // Skip empty
                if (!row) continue;

                // Detect separator (ULTIMATE REGEX)
                if (this.isSeparatorLine(row)) {
                    analysis.separatorRows.push(i);
                    continue;
                }

                // Skip if not a table row
                if (!row.includes('|')) continue;

                // Count columns
                const cols = row.split('|').filter(c => c.trim()).length;

                // First valid row = header
                if (analysis.headerRow === null && cols >= 2) {
                    analysis.headerRow = i;
                    analysis.columnCount = cols;
                } else if (cols === analysis.columnCount || cols === analysis.columnCount - 1 || cols === analysis.columnCount + 1) {
                    // Allow ±1 column flexibility
                    analysis.dataRows.push(i);
                }
            }

            return analysis;
        }

        isSeparatorLine(row) {
            // ULTIMATE SEPARATOR DETECTION
            // Matches: |---|---|, --------, | --- | --- |, |:---:|:---:|, etc.
            return /^[\s|:\-]+$/.test(row) ||
                /^\|[\s:\-|]+\|$/.test(row) ||
                /^[\s]*\|?[\s]*:?-{2,}:?[\s]*\|/.test(row) ||
                row.match(/^[-\s]+$/) && row.length > 3;
        }

        isValidTable(analysis) {
            return analysis.headerRow !== null &&
                analysis.columnCount >= 2 &&
                analysis.dataRows.length >= 1;
        }

        extractTableData(rows, analysis) {
            const header = this.extractTableRow(rows[analysis.headerRow], analysis.columnCount);
            const dataRows = analysis.dataRows.map(i =>
                this.extractTableRow(rows[i], analysis.columnCount)
            );

            return { header, rows: dataRows };
        }

        extractTableRow(rowText, expectedCols) {
            const cells = rowText.split('|')
                .map(c => c.trim())
                .filter(c => c !== '');

            // Normalize: ensure exact column count
            while (cells.length < expectedCols) cells.push('');
            return cells.slice(0, expectedCols);
        }

        formatTableCell(text) {
            // Clean cell content
            if (!text) return '&nbsp;';

            // Replace common "empty" indicators
            if (text === '-' || text === '–' || text === '—' || text === 'N/A' || text === 'n/a') {
                return '<span class="cell-empty">—</span>';
            }

            // Truncate if too long
            if (text.length > 60) {
                text = text.substring(0, 57) + '...';
            }

            return this.formatInline(text);
        }

        detectRTL(text) {
            // Detect Arabic/Hebrew characters
            return /[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/.test(text);
        }

        renderCode(lines, lang) {
            const content = lines.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            // Wrapper with Header (Language + Copy Button)
            return `<div class="zepra-code-wrapper">
                <div class="zepra-code-header">
                    <span class="zepra-lang-tag">${lang || 'Code'}</span>
                    <button class="zepra-copy-btn">Copy</button>
                </div>
                <pre><code class="language-${lang}">${content}</code></pre>
            </div>`;
        }

        formatInline(text) {
            // 1. Protect Allowed HTML Tags (Added blockquote, a)
            const protectedTags = [];
            // We use a broader regex to capture attributes like href, class within the tag
            // Supported: span, div, button, br, blockquote, a
            let p = text.replace(/<(\/?)(span|div|button|br|blockquote|a)([^>]*)>/gi, (m) => { protectedTags.push(m); return `__TAG${protectedTags.length - 1}__`; });

            // 2. Escape Everything Else
            p = p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            // 3. Markdowns
            p = p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
            p = p.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

            // 4. Restore Protected Tags
            return p.replace(/__TAG(\d+)__/g, (m, id) => protectedTags[id]);
        }
    }

    const markdownEngine = new ZepraMarkdownRenderer();
    const aiFormatter = new ZepraAIFormatter();

    function parseMarkdown(text) {
        // Pre-process (Fix Blob) -> Parse
        const processed = aiFormatter.preProcess(text);
        return markdownEngine.parse(processed);
    }

    // Event Delegation for Copy Buttons
    function setupCopyListener() {
        // ShadowRoot might not be ready if init called immediately, but we can try attaching to document or waiting
        // Ideally attach to shadowRoot after creation.
        // But since we are inside the closure, we can't easily access shadowRoot *before* init creates it.
        // HACK: We'll put this logic inside createUI/init strictly.
        // Wait... `setupResizer` etc are defined here.
        // I will add a global click listener to doc (or rely on later attachment).
        // ACTUALLY: `shadowRoot` is defined at the top level of this IIFE (Line 29: let shadowRoot;).
        // BUT it is null until `createUI` runs.
        // So I should wrap this in a function called by `createUI`.
    }

    // Let's overwite init to include this setup
    const originalInit = init;
    // ... No, that's messy.

    // Simpler: Just put the listener function here and call it inside createUI?
    // I can't edit createUI easily (it's way up).
    // I can put a document-level listener? No, Shadow DOM blocks events usually? 
    // Actually, events retarget. But if I click button in shadow, target is shadowHost?
    // I need to attach to shadowRoot.

    // ALTERNATIVE: Use `onclick` attribute string in HTML? 
    // `<button onclick="this.getRootNode().host.copyCode(this)">`
    // And define `copyCode` on the host? Too complex.

    // BEST WAY: Add a MutationObserver or poller? No.
    // I will append the listener logic to the end of `parseMarkdown`? No.

    // Let's Look at `init`.
    // Line 727 is `init();`.
    // I will replace `init();` with logic that waits for shadowRoot?

    // Wait, `createUI` sets `shadowRoot`.
    // I will replace `init();` with:
    /*
    init();
    // After init, shadowRoot exists?
    // init calls createUI immediately.
    if (shadowRoot) {
        shadowRoot.addEventListener('click', (e) => {
            if (e.target.matches('.zepra-copy-btn')) {
                const text = e.target.closest('.zepra-code-wrapper').querySelector('code').innerText;
                navigator.clipboard.writeText(text);
                const original = e.target.textContent;
                e.target.textContent = 'Copied!';
                setTimeout(() => e.target.textContent = original, 2000);
            }
        });
    }
    */
    init();

    // Post-Init Setup
    setTimeout(() => {
        if (shadowRoot) {
            shadowRoot.addEventListener('click', (e) => {
                if (e.target && e.target.classList && e.target.classList.contains('zepra-copy-btn')) {
                    const wrapper = e.target.closest('.zepra-code-wrapper');
                    if (wrapper) {
                        const code = wrapper.querySelector('code');
                        if (code) {
                            navigator.clipboard.writeText(code.innerText).then(() => {
                                e.target.textContent = 'Copied!';
                                e.target.classList.add('copied');
                                setTimeout(() => {
                                    e.target.textContent = 'Copy';
                                    e.target.classList.remove('copied');
                                }, 2000);
                            });
                        }
                    }
                }
            });
        }
    }, 500);
})();
