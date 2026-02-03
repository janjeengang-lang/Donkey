// =========================================
// ASK ZEPRA - V3.0 JSON SYSTEM
// =========================================

(function () {
    if (window.hasZepraAssistant) return;
    window.hasZepraAssistant = true;

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

    // Core State
    let chatHistory = [];
    let cachedSelection = '';
    let currentContext = { type: 'page', text: '', title: '', url: '' };
    let isOpen = false;
    let selectionTimer = null;
    let isRTL = false;

    // --- ICONS ---
    const ICONS = {
        sparkle: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>`,
        send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>`,
        close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>`,
        list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"></path></svg>`,
        brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44 2.5 2.5 0 01-2.96-3.08 3 3 0 01-.34-5.58 2.5 2.5 0 011.32-4.24 2.5 2.5 0 012.96-3.08A2.5 2.5 0 019.5 2zM14.5 2A2.5 2.5 0 0012 4.5v15a2.5 2.5 0 004.96.44 2.5 2.5 0 002.96-3.08 3 3 0 00.34-5.58 2.5 2.5 0 00-1.32-4.24 2.5 2.5 0 00-2.96-3.08A2.5 2.5 0 0014.5 2z"></path></svg>`,
        globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"></path></svg>`,
        doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path><path d="M14 2v6h6"></path><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>`,
        rtl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19h11M4 13h11M6 6h12M18 19v-2M18 13v-2M18 6v12"></path></svg>`
    };

    // =========================================
    // JSON RENDERER - THE NEW SYSTEM
    // =========================================

    class ZepraJSONRenderer {
        constructor() {
            this.errorCount = 0;
        }

        render(jsonResponse) {
            try {
                // Try to parse JSON
                const data = JSON.parse(jsonResponse);

                // Validate structure
                if (data.type !== 'response' || !Array.isArray(data.content)) {
                    throw new Error('Invalid response structure');
                }

                // Render all blocks
                const html = data.content.map(block => this.renderBlock(block)).join('\n');
                this.errorCount = 0; // Reset on success
                return html;

            } catch (e) {
                this.errorCount++;
                console.error('JSON Parse Error:', e);

                // Show error message
                return `
                    <div class="zepra-error">
                        <h3>⚠️ خطأ في تحليل الرد</h3>
                        <p>النموذج لم يرد بصيغة JSON صحيحة.</p>
                        <details>
                            <summary>تفاصيل الخطأ</summary>
                            <pre>${this.escapeHtml(e.message)}</pre>
                            <pre>${this.escapeHtml(jsonResponse.substring(0, 500))}</pre>
                        </details>
                    </div>
                `;
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
                    return '<hr class="zepra-divider">';
                default:
                    console.warn('Unknown block type:', block.type);
                    return '';
            }
        }

        renderHeading(block) {
            const level = Math.min(Math.max(parseInt(block.level) || 2, 1), 3);
            const text = this.escapeHtml(block.text || '');
            return `<h${level} class="zepra-heading">${text}</h${level}>`;
        }

        renderParagraph(block) {
            const text = this.formatInline(block.text || '');
            return `<p class="zepra-paragraph">${text}</p>`;
        }

        renderList(block) {
            const style = block.style || 'bullet';
            const items = block.items || [];

            if (items.length === 0) return '';

            const tag = style === 'number' ? 'ol' : 'ul';
            const className = style === 'check' ? 'zepra-task-list' : 'zepra-list';

            const itemsHtml = items.map(item => {
                const text = this.formatInline(item);
                if (style === 'check') {
                    return `<li class="zepra-task-item"><input type="checkbox" disabled> <span>${text}</span></li>`;
                }
                return `<li>${text}</li>`;
            }).join('');

            return `<${tag} class="${className}">${itemsHtml}</${tag}>`;
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
                    const content = cell === '' ? '<span class="cell-empty">—</span>' : this.formatInline(cell);
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
                        <button class="zepra-copy-btn" onclick="navigator.clipboard.writeText(this.closest('.zepra-code-wrapper').querySelector('code').textContent)">Copy</button>
                    </div>
                    <pre><code class="language-${lang}">${code}</code></pre>
                </div>
            `;
        }

        renderAlert(block) {
            const style = block.style || 'info';
            const text = this.formatInline(block.text || '');
            return `<div class="zepra-alert zepra-alert-${style}">${text}</div>`;
        }

        renderQuote(block) {
            const text = this.formatInline(block.text || '');
            return `<blockquote class="zepra-quote">${text}</blockquote>`;
        }

        formatInline(text) {
            if (!text) return '';

            let result = this.escapeHtml(text);

            // Format inline elements
            result = result.replace(/&lt;bold&gt;(.*?)&lt;\/bold&gt;/g, '<strong>$1</strong>');
            result = result.replace(/&lt;italic&gt;(.*?)&lt;\/italic&gt;/g, '<em>$1</em>');
            result = result.replace(/&lt;highlight&gt;(.*?)&lt;\/highlight&gt;/g, '<span class="zepra-highlight">$1</span>');
            result = result.replace(/&lt;strikethrough&gt;(.*?)&lt;\/strikethrough&gt;/g, '<del>$1</del>');
            result = result.replace(/&lt;underline&gt;(.*?)&lt;\/underline&gt;/g, '<u>$1</u>');
            result = result.replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/g, '<code class="zepra-inline-code">$1</code>');

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

    // =========================================
    // SYSTEM PROMPT LOADER
    // =========================================

    function getSystemPrompt() {
        // Load from ZEPRA_JSON_SYSTEM_PROMPT.txt
        return fetch(chrome.runtime.getURL('ZEPRA_JSON_SYSTEM_PROMPT.txt'))
            .then(r => r.text())
            .catch(() => {
                // Fallback inline version
                return `
═══════════════════════════════════════════════════════════════════════════════
🎯 ZEPRA JSON RESPONSE SYSTEM - MANDATORY FORMAT
═══════════════════════════════════════════════════════════════════════════════

⚠️ CRITICAL: You MUST respond ONLY in valid JSON format. NO markdown, NO plain text.

RESPONSE STRUCTURE:
{
  "type": "response",
  "language": "ar|en",
  "content": [
    // Array of content blocks
  ]
}

AVAILABLE BLOCKS:
1. heading: {"type": "heading", "level": 1-3, "text": "..."}
2. paragraph: {"type": "paragraph", "text": "... with <bold>tags</bold>"}
3. list: {"type": "list", "style": "bullet|number|check", "items": [...]}
4. table: {"type": "table", "headers": [...], "rows": [[...]]}
5. code: {"type": "code", "language": "...", "code": "..."}
6. alert: {"type": "alert", "style": "info|warning|success|error", "text": "..."}
7. quote: {"type": "quote", "text": "..."}
8. divider: {"type": "divider"}

CRITICAL RULES:
- ALWAYS respond with valid JSON
- Use Arabic if user writes in Arabic
- Keep paragraphs SHORT (2-3 lines)
- Tables: NO separator lines (|---|---|), NO dashes in cells
- Code: always specify language
- Match user's question length (short question → short answer, detailed question → detailed answer)

EXAMPLE:
{
  "type": "response",
  "language": "ar",
  "content": [
    {"type": "heading", "level": 2, "text": "الملخص"},
    {"type": "paragraph", "text": "هذا مثال على <bold>نص عريض</bold>."},
    {"type": "list", "style": "bullet", "items": ["نقطة 1", "نقطة 2"]},
    {"type": "alert", "style": "info", "text": "💡 نصيحة مهمة"}
  ]
}

IF YOU VIOLATE THIS FORMAT, THE RESPONSE WILL BE REJECTED.
═══════════════════════════════════════════════════════════════════════════════
                `;
            });
    }

    // =========================================
    // INIT
    // =========================================

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
        if (typeof data.askZepraEnabled !== 'undefined') SETTINGS.enabled = data.askZepraEnabled;
        if (typeof data.askZepraIcon !== 'undefined') SETTINGS.showIcon = data.askZepraIcon;
        if (data.askZepraShortcut) SETTINGS.shortcut = data.askZepraShortcut;
    }

    // =========================================
    // UI CREATION
    // =========================================

    function createUI() {
        const host = document.createElement('div');
        host.id = 'zepra-host-root';
        host.style.display = 'none';
        host.style.opacity = '0';
        host.style.transition = 'opacity 0.2s ease';

        document.body.appendChild(host);
        shadowRoot = host.attachShadow({ mode: 'open' });

        // CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('ask_zepra_v3.css');
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
                <button id="zBtnRTL" class="zepra-icon-btn" title="RTL Mode">${ICONS.rtl}</button>
                <button id="zBtnHistory" class="zepra-icon-btn" title="History">${ICONS.list}</button>
                <button id="zBtnClose" class="zepra-icon-btn" title="Close">${ICONS.close}</button>
            </div>
        </div>

        <div id="zContent" class="zepra-content">
            <div id="zWelcome" class="zepra-welcome">
                <div class="zepra-welcome-icon">${ICONS.brain}</div>
                <h2>مرحباً بك في Zepra PRO</h2>
                <p>أنا مساعدك الذكي. اسألني أي شيء عن هذه الصفحة!</p>
                <div class="zepra-suggestions">
                    <button class="zepra-suggestion" data-q="لخص هذه الصفحة">📄 لخص الصفحة</button>
                    <button class="zepra-suggestion" data-q="ما النقاط الرئيسية؟">💡 النقاط الرئيسية</button>
                    <button class="zepra-suggestion" data-q="اشرح بالتفصيل">📚 شرح مفصل</button>
                </div>
            </div>
            <div id="zMessages" class="zepra-messages"></div>
        </div>

        <div id="zFooter" class="zepra-footer">
            <div class="zepra-input-wrapper">
                <textarea id="zInput" class="zepra-input" placeholder="اسأل Zepra..." rows="1"></textarea>
                <button id="zSend" class="zepra-send-btn">${ICONS.send}</button>
            </div>
            <div class="zepra-context-info">
                <span id="zContextIcon">${ICONS.globe}</span>
                <span id="zContextText">جاهز للإجابة</span>
            </div>
        </div>
      </div>
    `;

        shadowRoot.appendChild(wrapper);

        // References
        triggerBtn = shadowRoot.getElementById('zTrigger');
        modal = shadowRoot.getElementById('zModal');
        inputField = shadowRoot.getElementById('zInput');
        sendBtn = shadowRoot.getElementById('zSend');
        contentArea = shadowRoot.getElementById('zMessages');

        // Show trigger
        setTimeout(() => {
            host.style.display = 'block';
            setTimeout(() => host.style.opacity = '1', 50);
        }, 100);

        // Setup resizer
        setupResizer();
    }

    // =========================================
    // EVENT LISTENERS
    // =========================================

    function attachListeners() {
        // Trigger
        triggerBtn.addEventListener('click', openModal);

        // Close
        shadowRoot.getElementById('zBtnClose').addEventListener('click', closeModal);

        // RTL
        shadowRoot.getElementById('zBtnRTL').addEventListener('click', toggleRTL);

        // Send
        sendBtn.addEventListener('click', handleSend);
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Auto-resize textarea
        inputField.addEventListener('input', () => {
            inputField.style.height = 'auto';
            inputField.style.height = Math.min(inputField.scrollHeight, 120) + 'px';
        });

        // Suggestions
        shadowRoot.querySelectorAll('.zepra-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                inputField.value = btn.dataset.q;
                handleSend();
            });
        });

        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.key === SETTINGS.shortcut && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                if (isOpen) closeModal();
                else openModal();
            }
        });

        // Selection tracking
        document.addEventListener('mouseup', () => {
            clearTimeout(selectionTimer);
            selectionTimer = setTimeout(() => {
                const sel = window.getSelection().toString().trim();
                if (sel && sel.length > 10 && sel.length < 5000) {
                    cachedSelection = sel;
                    currentContext.text = sel;
                    updateContextInfo('Selected text');
                }
            }, 300);
        });
    }

    // =========================================
    // MODAL CONTROLS
    // =========================================

    function openModal() {
        if (!SETTINGS.enabled) return;

        isOpen = true;
        modal.classList.add('visible');
        modal.classList.remove('initial-view');

        // Update context
        currentContext.url = window.location.href;
        currentContext.title = document.title;

        if (!currentContext.text) {
            currentContext.text = document.body.innerText.substring(0, 3000);
            updateContextInfo('Page content');
        }

        inputField.focus();
    }

    function closeModal() {
        isOpen = false;
        modal.classList.remove('visible');
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

    function updateContextInfo(text) {
        const contextText = shadowRoot.getElementById('zContextText');
        if (contextText) contextText.textContent = text;
    }

    // =========================================
    // MESSAGE HANDLING
    // =========================================

    async function handleSend() {
        const question = inputField.value.trim();
        if (!question) return;

        // UI
        const welcome = shadowRoot.getElementById('zWelcome');
        if (welcome) welcome.style.display = 'none';

        appendMessage('user', question);
        inputField.value = '';
        sendBtn.disabled = true;
        inputField.style.height = 'auto';

        const loaderId = appendLoader();

        // Get system prompt
        const systemPrompt = await getSystemPrompt();

        // Build prompt
        const historyStr = chatHistory.slice(-6).map(msg =>
            `${msg.role === 'user' ? 'USER' : 'ZEPRA'}: ${msg.text}`
        ).join('\n---\n');

        const fullPageText = document.body.innerText.substring(0, 15000);

        const prompt = `${systemPrompt}

[PAGE CONTEXT]
URL: ${currentContext.url}
Title: ${currentContext.title}

User's Focus Area:
${currentContext.text || 'No specific selection - analyzing full page.'}

Full Page Content (for reference):
"""
${fullPageText}
"""

[CONVERSATION HISTORY]
${historyStr || 'No previous conversation.'}

[USER QUESTION]
${question}

[RESPONSE INSTRUCTIONS]
- Respond in VALID JSON format ONLY
- Match question length: short question → short answer, detailed question → detailed answer
- Use Arabic if user writes in Arabic, English if English
- Follow the JSON schema exactly as specified above

RESPOND NOW IN JSON:`;

        try {
            // Call AI
            const response = await chrome.runtime.sendMessage({
                action: 'askAI',
                prompt: prompt
            });

            removeLoader(loaderId);

            if (response.error) {
                appendMessage('error', `خطأ: ${response.error}`);
            } else {
                // Use JSON Renderer
                const renderer = new ZepraJSONRenderer();
                const html = renderer.render(response.text);
                appendMessage('ai', html, true); // true = already HTML

                // Save to history
                chatHistory.push({ role: 'user', text: question });
                chatHistory.push({ role: 'assistant', text: response.text });
            }

        } catch (err) {
            removeLoader(loaderId);
            appendMessage('error', `خطأ في الاتصال: ${err.message}`);
        }

        sendBtn.disabled = false;
        inputField.focus();
    }

    function appendMessage(role, content, isHTML = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `zepra-msg ${role}`;

        if (role === 'user') {
            msgDiv.innerHTML = `
                <div class="zepra-msg-avatar">👤</div>
                <div class="zepra-msg-body">${escapeHtml(content)}</div>
            `;
        } else if (role === 'ai') {
            msgDiv.innerHTML = `
                <div class="zepra-msg-avatar">${ICONS.sparkle}</div>
                <div class="zepra-msg-body">${isHTML ? content : escapeHtml(content)}</div>
            `;
        } else if (role === 'error') {
            msgDiv.innerHTML = `
                <div class="zepra-msg-avatar">⚠️</div>
                <div class="zepra-msg-body">${escapeHtml(content)}</div>
            `;
        }

        contentArea.appendChild(msgDiv);
        contentArea.scrollTop = contentArea.scrollHeight;
    }

    function appendLoader() {
        const id = 'loader-' + Date.now();
        const loaderDiv = document.createElement('div');
        loaderDiv.id = id;
        loaderDiv.className = 'zepra-msg ai';
        loaderDiv.innerHTML = `
            <div class="zepra-msg-avatar">${ICONS.sparkle}</div>
            <div class="zepra-msg-body">
                <div class="zepra-loader">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        contentArea.appendChild(loaderDiv);
        contentArea.scrollTop = contentArea.scrollHeight;
        return id;
    }

    function removeLoader(id) {
        const loader = shadowRoot.getElementById(id);
        if (loader) loader.remove();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // =========================================
    // RESIZER
    // =========================================

    function setupResizer() {
        const handle = shadowRoot.getElementById('zResizeHandle');
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = modal.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const dx = startX - e.clientX;
            const dy = startY - e.clientY;

            const newWidth = Math.max(400, Math.min(900, startWidth + dx));
            const newHeight = Math.max(500, Math.min(800, startHeight + dy));

            modal.style.width = newWidth + 'px';
            modal.style.height = newHeight + 'px';
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }

    // =========================================
    // START
    // =========================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
