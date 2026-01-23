
// clipboard.js

const STATE = {
    items: [],
    filter: 'all',
    search: '',
    activeItem: null,
    chatHistory: [],
    clipboardModel: ''
};

// Start
document.addEventListener('DOMContentLoaded', async () => {
    await loadClipboardHistory();
    await loadClipboardModel();
    setupEventListeners();
    renderGrid();
});

async function loadClipboardHistory() {
    const { zepraClipboard = [] } = await chrome.storage.local.get('zepraClipboard');
    STATE.items = zepraClipboard;
    updateEmptyState();
}

async function loadClipboardModel() {
    const { clipboardModel = '' } = await chrome.storage.local.get('clipboardModel');
    STATE.clipboardModel = clipboardModel;
    const modelSelect = document.getElementById('clipboardModel');
    if (modelSelect) {
        modelSelect.value = clipboardModel;
    }
}

function setupEventListeners() {
    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        STATE.search = e.target.value.toLowerCase();
        renderGrid();
    });

    // Filters
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            STATE.filter = e.target.dataset.filter;
            renderGrid();
        });
    });

    // Clear All
    document.getElementById('clearAllBtn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear your clipboard history?')) {
            STATE.items = [];
            await chrome.storage.local.set({ zepraClipboard: [] });
            renderGrid();
            showToast('History cleared');
        }
    });

    const modelSelect = document.getElementById('clipboardModel');
    if (modelSelect) {
        modelSelect.addEventListener('change', async (e) => {
            const value = e.target.value;
            STATE.clipboardModel = value;
            await chrome.storage.local.set({ clipboardModel: value });
            showToast('AI model updated');
        });
    }

    // Modal Close
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.getElementById('detailModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailModal') closeModal();
    });

    // Copy from Modal
    document.getElementById('modalCopyBtn').addEventListener('click', () => {
        const text = document.getElementById('modalText').textContent;
        copyToClipboard(text);
        showToast('Copied to clipboard');
    });

    // Ask AI Button (Toggle Drawer)
    const askAiBtn = document.getElementById('askAiBtn');
    if (askAiBtn) {
        askAiBtn.addEventListener('click', () => {
            const drawer = document.getElementById('chatDrawer');
            drawer.classList.remove('collapsed');
            // Check if mobile or small screen? Maybe handled by CSS
        });
    }

    // Chat Close
    document.getElementById('closeChatBtn').addEventListener('click', () => {
        document.getElementById('chatDrawer').classList.add('collapsed');
    });

    // Chat Send
    document.getElementById('sendChatBtn').addEventListener('click', sendChatMessage);
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    // Copy Inner Code
    const innerCopy = document.getElementById('innerCopyBtn');
    if (innerCopy) {
        innerCopy.addEventListener('click', () => {
            const text = document.getElementById('modalText').textContent;
            copyToClipboard(text);
            showToast('Content Copied!');
        });
    }

    // Resize Handle Logic
    const resizeHandle = document.getElementById('resizeHandle');
    const chatDrawer = document.getElementById('chatDrawer');
    const modalContent = document.querySelector('.modal-content');
    let isResizing = false;

    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizeHandle.classList.add('active');
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            // Calculate new width for chat drawer
            // Total width - Mouse X relative to modal
            const modalRect = modalContent.getBoundingClientRect();
            const newWidth = modalRect.right - e.clientX;

            // Constraints
            if (newWidth > 300 && newWidth < 800) {
                chatDrawer.style.width = newWidth + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizeHandle.classList.remove('active');
                document.body.style.cursor = '';
            }
        });
    }
}

function renderGrid() {
    const grid = document.getElementById('clipGrid');
    const empty = document.querySelector('.empty-state');

    // Filter logic
    let filtered = STATE.items.filter(item => {
        if (STATE.filter !== 'all') {
            if (STATE.filter === 'favorites') return item.favorite;
            if (STATE.filter === 'link') return item.type === 'link';
            if (STATE.filter === 'code') return item.type === 'code';
            if (STATE.filter === 'email') return item.type === 'email';
            if (STATE.filter === 'text') return item.type === 'text';
        }
        return true;
    });

    // Search logic
    if (STATE.search) {
        filtered = filtered.filter(item =>
            item.text.toLowerCase().includes(STATE.search) ||
            (item.title && item.title.toLowerCase().includes(STATE.search)) ||
            (item.tags && item.tags.some(t => t.toLowerCase().includes(STATE.search)))
        );
    }

    // Clear existing
    Array.from(grid.children).forEach(c => {
        if (!c.classList.contains('empty-state')) c.remove();
    });

    if (filtered.length === 0) {
        empty.style.display = 'flex';
        if (STATE.items.length > 0) {
            empty.querySelector('h2').textContent = 'No matches found';
        } else {
            empty.querySelector('h2').textContent = 'Your clipboard history is empty';
        }
        return;
    }

    empty.style.display = 'none';

    // Sort by newest
    filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    filtered.forEach(item => {
        const card = createCard(item);
        grid.appendChild(card);
    });
}

function createCard(item) {
    const el = document.createElement('div');
    el.className = 'clip-card';

    const title = item.title || item.text.slice(0, 50).trim() || 'Untitled';
    const isCode = item.type === 'code';

    // Tag pills for card
    let tagsHtml = '';
    if (item.tags && item.tags.length) {
        tagsHtml = `<div class="card-tags">` +
            item.tags.slice(0, 3).map(t => `<span class="tag-pill">#${t}</span>`).join('') +
            `</div>`;
    }

    const favIconFill = item.favorite ? 'fill="#fbbf24" color="#fbbf24"' : 'fill="none"';

    const analysisHtml = buildCardAnalysis(item);

    el.innerHTML = `
    <div class="card-header">
      <span class="card-type ${item.type}">${item.type || 'TEXT'}</span>
      <div class="card-actions">
        <button class="icon-btn fav-btn" title="Favorite">
          <svg viewBox="0 0 24 24" ${favIconFill} stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </button>
        <button class="icon-btn delete-btn" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
    <div class="card-body ${isCode ? 'is-code' : ''}">${htmlEscape(item.text.slice(0, 300))}</div>
    ${tagsHtml}
    ${analysisHtml}
    <div class="card-footer">
      <a href="${item.sourceUrl || '#'}" class="source-link" target="_blank">${item.sourceTitle || item.sourceUrl || 'Unknown Source'}</a>
      <span>${timeAgo(item.timestamp)}</span>
    </div>
  `;

    el.querySelector('.card-body').addEventListener('click', () => openDetail(item));

    el.querySelector('.fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(item.id);
    });

    el.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteItem(item.id);
    });

    return el;
}

function buildCardAnalysis(item) {
    if (!item.aiSummary && (!item.keyPoints || !item.keyPoints.length)) return '';
    const summary = item.aiSummary ? `<div class="card-analysis-summary">${formatInline(item.aiSummary)}</div>` : '';
    const points = (item.keyPoints || []).slice(0, 3).map(pt => `<li>${formatInline(pt)}</li>`).join('');
    const list = points ? `<ul class="card-analysis-list">${points}</ul>` : '';
    return `
        <div class="card-analysis">
            <div class="card-analysis-title">✨ AI Analysis</div>
            ${summary}
            ${list}
        </div>
    `;
}

function openDetail(item) {
    STATE.activeItem = item;
    STATE.chatHistory = []; // Reset chat history for new item

    const modal = document.getElementById('detailModal');

    // Header Info
    document.getElementById('modalTitle').textContent = item.title || 'Clip Detail';
    document.getElementById('modalId').textContent = 'ID: #' + (item.id || '---').slice(0, 4).toUpperCase();
    document.getElementById('modalType').textContent = (item.type || 'TEXT').toUpperCase();
    document.getElementById('modalDate').textContent = timeAgo(item.timestamp);

    // Source
    const sourceEl = document.getElementById('modalSource');
    if (item.sourceUrl) {
        try {
            const url = new URL(item.sourceUrl);
            sourceEl.textContent = url.hostname + ' ↗';
            sourceEl.href = item.sourceUrl;
            sourceEl.style.display = 'inline-block';
        } catch {
            sourceEl.textContent = 'Unknown Source';
            sourceEl.href = '#';
        }
    } else {
        sourceEl.textContent = 'Local Clip';
        sourceEl.href = '#';
    }

    document.getElementById('modalText').textContent = item.text;

    // Tags Container
    const tagsContainer = document.getElementById('tagsContainer');
    tagsContainer.innerHTML = '';
    if (item.tags && item.tags.length) {
        item.tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag-chip';
            span.textContent = '#' + tag;
            tagsContainer.appendChild(span);
        });
    }

    // AI Info
    const aiBox = document.getElementById('aiAnalysisBox');
    const summaryEl = document.getElementById('aiSummary');
    const pointsEl = document.getElementById('aiKeyPoints');

    if (item.aiSummary || (item.keyPoints && item.keyPoints.length)) {
        aiBox.style.display = 'block';
        summaryEl.innerHTML = renderSafeText(item.aiSummary || (item.description || 'No summary available.'));

        pointsEl.innerHTML = '';
        if (item.keyPoints && item.keyPoints.length) {
            item.keyPoints.forEach(pt => {
                const li = document.createElement('li');
                li.className = 'point-item';
                li.innerHTML = renderSafeText(pt);
                pointsEl.appendChild(li);
            });
        }
    } else {
        aiBox.style.display = 'none';
    }

    // Reset Chat Drawer
    const chatDrawer = document.getElementById('chatDrawer');
    chatDrawer.classList.add('collapsed'); // Always start collapsed

    document.getElementById('chatMessages').innerHTML = `
    <div class="message-bubble ai">
        <div class="avatar">⚡</div>
        <div class="message-content">
            <div class="message-text">Hello! I'm ready to analyze this content or answer any questions about it.</div>
        </div>
    </div>
  `;

    modal.classList.add('visible');
}

function closeModal() {
    document.getElementById('detailModal').classList.remove('visible');
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    // Add user message
    addChatMessage('user', msg);
    input.value = '';

    // Create & Show Loading Bubble
    const loadingId = 'loading-' + Date.now();
    addLoadingBubble(loadingId);

    // Build context
    const context = `Context Clip Content:\n${STATE.activeItem.text}\n\n`;
    const prompt = context + msg;

    STATE.chatHistory.push({ role: 'user', text: msg });

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'CHAT_WITH_AI',
            prompt: prompt,
            history: STATE.chatHistory.slice(0, -1), // Send previous history
            model: STATE.clipboardModel
        });

        // Remove loading bubble
        removeLoadingBubble(loadingId);

        if (response.ok) {
            const text = response.text || 'I apologize, I received an empty response.';
            addChatMessage('ai', text);
            STATE.chatHistory.push({ role: 'ai', text: text });
        } else {
            addChatMessage('ai', 'Error: ' + (response.error || 'Unknown error'));
        }

    } catch (e) {
        removeLoadingBubble(loadingId);
        addChatMessage('ai', 'Connection failed.');
    }
}

function addLoadingBubble(id) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.id = id;
    div.className = 'message-bubble ai';
    div.innerHTML = `
        <div class="avatar">⚡</div>
        <div class="message-content">
             <div class="loading-dots"><span></span><span></span><span></span></div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeLoadingBubble(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// ============================================
// SMART RENDERER (Mixed Markdown + JSON)
// ============================================

function smartRender(fullText) {
    if (!fullText) return '';

    // Split by JSON/Code blocks to handle them separately
    // We look for ```keyword ... ``` blocks
    const parts = fullText.split(/(```[\w:.-]*\n[\s\S]*?```)/g);

    return parts.map(part => {
        if (part.startsWith('```')) {
            // It's a block
            const match = part.match(/```([\w:.-]*)\n([\s\S]*?)```/);
            if (!match) return part; // Fallback

            const type = match[1].toLowerCase();
            const content = match[2];

            if (type === 'json:table') {
                return renderTableJSON(content);
            } else if (type === 'json:chart') {
                return renderChartJSON(content);
            } else {
                // Standard Code Block
                return renderCodeBlock(content, type);
            }
        } else {
            // It's standard Markdown text
            return renderMarkdown(part);
        }
    }).join('');
}

// 1. Chart Renderer (CSS-Only Bar Charts)
function renderChartJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString); // {type, title, data: [{label, value, color}]}
        if (!data || !data.data) return '<div class="error-block">Invalid Chart Data</div>';

        // Find Max for scaling
        const maxValue = Math.max(...data.data.map(d => d.value));

        const barsHtml = data.data.map(item => {
            const percent = (item.value / maxValue) * 100;
            return `
                <div class="chart-item">
                    <div class="chart-label-row">
                        <span class="chart-label">${htmlEscape(item.label)}</span>
                        <span class="chart-value">${item.value}</span>
                    </div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${percent}%; background-color: ${item.color || 'var(--primary)'};"></div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="chart-container">
                <div class="chart-title">${htmlEscape(data.title || 'Data Visualization')}</div>
                <div class="chart-body">${barsHtml}</div>
            </div>
        `;
    } catch (e) {
        return `<div class="error-block">Chart Error: ${e.message}</div>`;
    }
}

// 2. Table Renderer (JSON to HTML)
function renderTableJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString); // {headers: [], rows: [[]]}

        const headersHtml = data.headers.map(h => `<th>${parseMarkdownInline(h)}</th>`).join('');

        const rowsHtml = data.rows.map(row => {
            const cells = row.map(cell => `<td>${parseMarkdownInline(cell)}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        return `
            <div class="table-container">
                <table>
                    <thead><tr>${headersHtml}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    } catch (e) {
        return `<div class="error-block">Table Error: ${e.message}</div>`;
    }
}

// 3. Standard Code Block Renderer
function renderCodeBlock(code, lang) {
    // Basic Lang cleaning
    lang = lang.replace('json:table', '').replace('json:chart', '') || 'text';

    return `
        <div class="code-block-wrapper">
            <div class="code-header">
                <span class="code-lang">${lang}</span>
                <button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.dataset.code); this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy',2000);" data-code="${htmlEscape(code)}">Copy</button>
            </div>
            <pre><code class="language-${lang}">${htmlEscape(code)}</code></pre>
        </div>
    `;
}

// 4. Text Markdown Parser (Stable)
function renderMarkdown(text) {
    if (!text) return '';

    // Escape HTML first (except we will inject HTML later, but this cleans raw input)
    // Actually, we must process formatting first, but careful with HTML injection.
    // For simplicity safely, we escape first? No, replace operations need raw text.
    // We will assume AI output is benign text.

    let html = text;

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    // Highlights
    html = html.replace(/!!(.*?)!!/g, '<span class="highlight-red">$1</span>');
    html = html.replace(/==(.*?)==/g, '<span class="highlight-yellow">$1</span>');

    // Bold/Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    html = html.replace(/__(.*?)__/g, '<span class="text-underline">$1</span>');
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Lists (Basic)
    // Since we handle line breaks above, list regex needs to handle <br>
    // but <br> makes Regex hard. Let's do simple line parsing if needed. 
    // For now, simple text replacement for bullets to visual bullets
    html = html.replace(/(<br>|^)\s*-\s+(.*?)((?=<br>)|$)/g, '$1• $2');

    return `<div class="md-text">${html}</div>`;
}

// Helper for inside tables
function parseMarkdownInline(text) {
    if (!text) return '';
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    return text;
}
// Helper for inline styles within recursive contexts (like tables)
function parseInlineStyle(text) {
    text = text.replace(/!!(.*?)!!/g, '<span class="highlight-red">$1</span>');
    text = text.replace(/==(.*?)==/g, '<span class="highlight-yellow">$1</span>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    return text;
}

function detectDirection(text) {
    const arabicPattern = /[\u0600-\u06FF]/;
    return arabicPattern.test(text) ? 'rtl' : 'ltr';
}

// ============================================
// HTML CARD RENDERER (Safe HTML + Markdown)
// ============================================

function htmlCardRender(fullText) {
    if (!fullText) return '';

    // Check for artifact blocks
    if (fullText.includes(':::artifact')) {
        return renderArtifact(fullText);
    }

    // Check if response contains HTML cards
    if (fullText.includes('<div class="ai-card">') || fullText.includes('<div class="ai-widget">')) {
        return sanitizeHTML(fullText);
    }

    // Otherwise, use markdown for regular text
    return renderMarkdownSimple(fullText);
}

// Render artifact with special container
function renderArtifact(text) {
    const artifactMatch = text.match(/:::artifact\s*([\s\S]*?):::/);

    if (!artifactMatch) return renderMarkdownSimple(text);

    const htmlContent = artifactMatch[1].trim();
    const beforeArtifact = text.substring(0, artifactMatch.index);
    const afterArtifact = text.substring(artifactMatch.index + artifactMatch[0].length);

    const artifactId = 'artifact-' + Date.now();

    return `
        ${renderMarkdownSimple(beforeArtifact)}
        <div class="artifact-container" id="${artifactId}">
            <div class="artifact-header">
                <span class="artifact-title">🎨 UI Preview</span>
                <div class="artifact-actions">
                    <button onclick="maximizeArtifact('${artifactId}')" class="artifact-btn">⛶ Maximize</button>
                    <button onclick="downloadArtifact('${artifactId}')" class="artifact-btn">💾 Download HTML</button>
                </div>
            </div>
            <div class="artifact-body">
                <iframe srcdoc="${htmlEscape(htmlContent)}" style="width: 100%; height: 500px; border: none; background: white;"></iframe>
            </div>
            <script>
                window.maximizeArtifact = function(id) {
                    const container = document.getElementById(id);
                    container.classList.toggle('maximized');
                    const iframe = container.querySelector('iframe');
                    if (container.classList.contains('maximized')) {
                        iframe.style.height = 'calc(100vh - 80px)';
                    } else {
                        iframe.style.height = '500px';
                    }
                };
                window.downloadArtifact = function(id) {
                    const container = document.getElementById(id);
                    const iframe = container.querySelector('iframe');
                    const htmlContent = iframe.getAttribute('srcdoc');
                    const blob = new Blob([htmlContent], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'design-' + Date.now() + '.html';
                    a.click();
                    URL.revokeObjectURL(url);
                };
            </script>
        </div>
        ${renderMarkdownSimple(afterArtifact)}
    `;
}

// Simple HTML sanitizer (allows only safe tags)
function sanitizeHTML(html) {
    const allowedTags = ['div', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'h1', 'h2', 'h3', 'p', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'br'];
    const allowedAttrs = ['class', 'style'];

    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove script tags and dangerous attributes
    temp.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove());
    temp.querySelectorAll('*').forEach(el => {
        // Remove dangerous attributes
        Array.from(el.attributes).forEach(attr => {
            if (!allowedAttrs.includes(attr.name.toLowerCase())) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return temp.innerHTML;
}

// Simple Markdown renderer for text responses
function renderMarkdownSimple(text) {
    if (!text) return '';

    let html = text;

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<div class="code-block-wrapper">
            <div class="code-header"><span class="code-lang">${lang || 'text'}</span>
            <button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.dataset.code); this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy',2000);" data-code="${htmlEscape(code.trim())}">Copy</button></div>
            <pre><code>${htmlEscape(code.trim())}</code></pre>
        </div>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Highlights
    html = html.replace(/!!(.*?)!!/g, '<span class="highlight-red">$1</span>');
    html = html.replace(/==(.*?)==/g, '<span class="highlight-yellow">$1</span>');

    // Bold/Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

    // Lists
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
}


function addChatMessage(role, text) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `message-bubble ${role}`;

    // Avatar logic with Icons
    let avatarHtml = '';
    if (role === 'ai') {
        // Robot Icon
        avatarHtml = `<div class="avatar">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
        </div>`;
    } else {
        // User Icon
        avatarHtml = `<div class="avatar user-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>`;
    }

    const dir = detectDirection(text);
    const formattedText = role === 'ai' ? renderChatPayload(text) : htmlEscape(text).replace(/\n/g, '<br>');

    div.innerHTML = `
        ${avatarHtml}
        <div class="message-content" dir="${dir}">
            <div class="message-text">${formattedText}</div>
        </div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function renderChatPayload(text) {
    const parsed = extractJsonPayload(text);
    if (parsed) {
        return renderChatJson(parsed);
    }
    if (text && text.includes(':::artifact')) {
        return htmlCardRender(text);
    }
    return renderMarkdownSimple(text);
}

function extractJsonPayload(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (_) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) return null;
        try {
            return JSON.parse(text.slice(start, end + 1));
        } catch (_) {
            return null;
        }
    }
}

function renderChatJson(payload) {
    const sections = [];
    if (payload.title || payload.summary) {
        sections.push(`
            <div class="chat-section">
                <div class="chat-section-title"><span>🧠</span> ${htmlEscape(payload.title || 'AI Summary')}</div>
                <div>${renderSafeText(payload.summary || '')}</div>
            </div>
        `);
    }

    if (Array.isArray(payload.highlights) && payload.highlights.length) {
        const badges = payload.highlights.map(h => `<span class="chat-badge">${htmlEscape(h)}</span>`).join('');
        sections.push(`
            <div class="chat-section">
                <div class="chat-section-title"><span>✨</span> Highlights</div>
                <div class="chat-badges">${badges}</div>
            </div>
        `);
    }

    if (Array.isArray(payload.sections) && payload.sections.length) {
        payload.sections.forEach(section => {
            const title = htmlEscape(section.title || 'Details');
            const bullets = (section.bullets || []).map(b => `<li>${renderSafeText(b)}</li>`).join('');
            const list = bullets ? `<ul class="card-analysis-list">${bullets}</ul>` : '';
            const note = section.note ? `<div class="card-analysis-summary">${renderSafeText(section.note)}</div>` : '';
            sections.push(`
                <div class="chat-section">
                    <div class="chat-section-title"><span>📌</span> ${title}</div>
                    ${note}
                    ${list}
                </div>
            `);
        });
    }

    if (Array.isArray(payload.tables) && payload.tables.length) {
        payload.tables.forEach(table => {
            sections.push(`
                <div class="chat-section">
                    <div class="chat-section-title"><span>📋</span> ${htmlEscape(table.title || 'Table')}</div>
                    ${renderTableFromObject(table)}
                </div>
            `);
        });
    }

    if (Array.isArray(payload.charts) && payload.charts.length) {
        payload.charts.forEach(chart => {
            sections.push(`
                <div class="chat-section">
                    <div class="chat-section-title"><span>📊</span> ${htmlEscape(chart.title || 'Chart')}</div>
                    ${renderChartJSON(JSON.stringify(chart))}
                </div>
            `);
        });
    }

    if (Array.isArray(payload.actions) && payload.actions.length) {
        const actions = payload.actions.map(a => `<li>${renderSafeText(a)}</li>`).join('');
        sections.push(`
            <div class="chat-section">
                <div class="chat-section-title"><span>✅</span> Recommendations</div>
                <ul class="card-analysis-list">${actions}</ul>
            </div>
        `);
    }

    if (!sections.length) {
        return htmlCardRender(JSON.stringify(payload, null, 2));
    }

    return `<div class="chat-json">${sections.join('')}</div>`;
}

function renderTableFromObject(table) {
    if (!table || !Array.isArray(table.headers)) return '<div class="error-block">Invalid Table Data</div>';
    const headersHtml = table.headers.map(h => `<th>${htmlEscape(String(h))}</th>`).join('');
    const rowsHtml = (table.rows || []).map(row => {
        const cells = (row || []).map(cell => `<td>${htmlEscape(String(cell))}</td>`).join('');
        return `<tr>${cells}</tr>`;
    }).join('');
    return `
        <div class="table-container">
            <table>
                <thead><tr>${headersHtml}</tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;
}

function renderSafeText(text) {
    return formatInline(text).replace(/\n/g, '<br>');
}

function formatInline(text) {
    if (!text) return '';
    let safe = htmlEscape(String(text));
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/__(.*?)__/g, '<span class="text-underline">$1</span>');
    safe = safe.replace(/==(.*?)==/g, '<span class="text-highlight">$1</span>');
    safe = safe.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    return safe;
}

async function toggleFavorite(id) {
    const idx = STATE.items.findIndex(i => i.id === id);
    if (idx > -1) {
        STATE.items[idx].favorite = !STATE.items[idx].favorite;
        await chrome.storage.local.set({ zepraClipboard: STATE.items });
        renderGrid();
    }
}

async function deleteItem(id) {
    STATE.items = STATE.items.filter(i => i.id !== id);
    await chrome.storage.local.set({ zepraClipboard: STATE.items });
    renderGrid();
    showToast('Item deleted');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(err => console.error('Copy failed', err));
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('active');
    setTimeout(() => t.classList.remove('active'), 2500);
}

function updateEmptyState() {
    // handled in renderGrid
}

// Helpers
function timeAgo(ts) {
    if (!ts) return 'Unknown date';
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'Just now';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    return Math.floor(sec / 86400) + 'd ago';
}

function htmlEscape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
