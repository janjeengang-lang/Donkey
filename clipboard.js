const els = {
  app: document.querySelector('.clipboard-app'),
  list: document.getElementById('clipboardList'),
  emptyListState: document.getElementById('emptyListState'),
  detailPanel: document.getElementById('detailPanel'),
  detailPlaceholder: document.getElementById('detailPlaceholder'),
  detailView: document.getElementById('detailView'),
  detailMeta: document.getElementById('detailMeta'),
  detailTitle: document.getElementById('detailTitle'),
  detailTags: document.getElementById('detailTags'),
  detailSummary: document.getElementById('detailSummary'),
  detailInsight: document.getElementById('detailInsight'),
  insightText: document.getElementById('insightText'),
  sourceCode: document.getElementById('sourceCode'),
  sourceCharCount: document.getElementById('sourceCharCount'),
  btnCopySource: document.getElementById('btnCopySource'),
  searchInput: document.getElementById('searchInput'),
  filterChips: document.querySelectorAll('.filter-chip'),
  assistantPanel: document.getElementById('assistantPanel'),
  btnToggleAssistant: document.getElementById('btnToggleAssistant'),
  assistantChat: document.getElementById('assistantChat'),
  chatLog: document.getElementById('chatLog'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  listTemplate: document.getElementById('clipListItemTemplate'),
  chatTemplate: document.getElementById('chatMessageTemplate'),
  gptPrimaryButton: document.querySelector('.style-blob-btn'),
  gptMagicButton: document.querySelector('.style-sparkle-btn'),
  dragDivider: document.getElementById('dragDivider'),
  leftPanel: document.querySelector('.detail-panel'),
};

const STATE = {
  items: [],
  filtered: [],
  activeId: null,
  filter: 'all',
  query: '',
  loading: false,
  assistantOpen: false,
  assistantBusy: false,
};

const CATEGORY_ICONS = {
  Development: '💻',
  Design: '🎨',
  Business: '📈',
  Personal: '👤',
  Security: '🔐',
};

const TYPE_ICONS = {
  'Code Snippet': '🧩',
  'Web Link': '🌐',
  'Email Address': '✉️',
  'Plain Text': '📝',
  Credentials: '🔑',
};

init().catch((err) => console.error('Clipboard Memory init failed:', err));

async function init() {
  await loadInitialState();
  bindEvents();
  renderList();
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
}

async function loadInitialState() {
  STATE.loading = true;
  toggleLoading(true);
  try {
    const { clipboardMemoryEnabled = true } = await chrome.storage.local.get('clipboardMemoryEnabled');
    if (!clipboardMemoryEnabled) {
      showDisabledState();
      return;
    }
    const response = await chrome.runtime.sendMessage({ type: 'GET_CLIPBOARD_MEMORY' });
    if (response?.ok) {
      STATE.items = Array.isArray(response.items) ? response.items : [];
      STATE.filtered = STATE.items.slice();
    } else {
      console.warn('Failed to fetch clipboard memory:', response?.error);
      STATE.items = [];
      STATE.filtered = [];
    }
  } finally {
    STATE.loading = false;
    toggleLoading(false);
  }
}

function bindEvents() {
  els.btnCopySource?.addEventListener('click', copySourceText);
  els.searchInput?.addEventListener('input', handleSearchInput);
  els.filterChips?.forEach((chip) => {
    chip.addEventListener('click', () => applyFilter(chip.dataset.filter));
  });
  els.btnToggleAssistant?.addEventListener('click', toggleAssistantPanel);
  els.chatForm?.addEventListener('submit', handleChatSubmit);

  // RTL/LTR Toggle
  const toggleRTL = document.getElementById('toggleRTL');
  if (toggleRTL) {
    toggleRTL.addEventListener('click', () => {
      const chatLog = els.chatLog;
      const isRTL = chatLog.getAttribute('dir') === 'rtl';
      chatLog.setAttribute('dir', isRTL ? 'ltr' : 'rtl');
      toggleRTL.innerHTML = isRTL
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M21 4H3"></path><path d="M21 12H3"></path><path d="M21 20H3"></path>
             <path d="M17 4l-4 4 4 4"></path>
           </svg> RTL`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M3 4H21"></path><path d="M3 12H21"></path><path d="M3 20H21"></path>
             <path d="M7 4l4 4-4 4"></path>
           </svg> LTR`;
    });
  }

  // GPT-style action buttons -> open Ask AI on current or first snippet
  const triggerAskAI = () => {
    if (!STATE.activeId && STATE.filtered.length) {
      selectItem(STATE.filtered[0].id);
    } else if (!STATE.activeId && STATE.items.length) {
      selectItem(STATE.items[0].id);
    }
    if (els.detailPanel) {
      els.detailPanel.classList.remove('hidden');
    }
    STATE.assistantOpen = true;
    els.assistantChat?.classList.remove('hidden');
    els.chatInput?.focus();
  };

  els.gptPrimaryButton?.addEventListener('click', triggerAskAI);
  els.gptMagicButton?.addEventListener('click', triggerAskAI);

  // Drag divider resize
  setupDragDivider();

  // Close detail modal when clicking backdrop
  els.detailPanel?.addEventListener('click', (event) => {
    if (event.target === els.detailPanel) {
      closeDetailPanel();
    }
  });

  // Close on Escape key
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.detailPanel.classList.contains('hidden')) {
      closeDetailPanel();
    }
  });
}

function handleRuntimeMessage(message) {
  if (message?.type === 'CLIPBOARD_MEMORY_SYNC') {
    STATE.items = Array.isArray(message.items) ? message.items : [];
    applySearchAndFilter();
  }
}

function toggleLoading(on) {
  if (!els.app) return;
  els.app.dataset.state = on ? 'loading' : 'ready';
}

function showDisabledState() {
  if (!els.app) return;
  els.app.dataset.state = 'disabled';
  els.list.innerHTML = '';
  els.emptyListState.innerHTML = `
    <div class="empty-glow"></div>
    <h2>Clipboard Memory is disabled</h2>
    <p>Enable the feature from Zepra Settings → Clipboard Memory to start capturing snippets.</p>
  `;
  els.detailPlaceholder.querySelector('h2').textContent = 'Clipboard Memory is turned off';
  els.detailPlaceholder.querySelector('p').textContent = 'Re-enable the feature to browse saved snippets and insights.';
}

function applyFilter(filter) {
  STATE.filter = filter;
  els.filterChips.forEach((chip) => chip.classList.toggle('active', chip.dataset.filter === filter));
  applySearchAndFilter();
}

function handleSearchInput(event) {
  STATE.query = event.target.value.trim().toLowerCase();
  applySearchAndFilter();
}

function applySearchAndFilter() {
  const query = STATE.query;
  const filter = STATE.filter;
  const filtered = STATE.items.filter((item) => {
    const matchesFilter = filter === 'all' || item.analysis?.category === filter;
    if (!matchesFilter) return false;
    if (!query) return true;
    const haystack = [
      item.analysis?.title,
      item.analysis?.summary,
      item.raw,
      (item.analysis?.tags || []).join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
  STATE.filtered = filtered;
  renderList();
  if (STATE.activeId) {
    const stillExists = STATE.filtered.some((item) => item.id === STATE.activeId);
    if (!stillExists) {
      clearActiveSelection();
    }
  }
}

function renderList() {
  els.list.innerHTML = '';
  const items = STATE.filtered;

  // Always show the list, hide empty state only if there are items
  els.emptyListState.style.display = items.length > 0 ? 'none' : 'block';
  els.list.style.display = 'grid'; // Always show grid

  if (!items.length) return;

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const clone = els.listTemplate.content.firstElementChild.cloneNode(true);
    clone.dataset.id = item.id;
    clone.classList.toggle('selected', STATE.activeId === item.id);
    const iconSlot = clone.querySelector('.clip-card-icon');
    const contentTitle = clone.querySelector('h3');
    const snippet = clone.querySelector('.clip-snippet');
    const category = clone.querySelector('.clip-category');
    const timestamp = clone.querySelector('.clip-timestamp');

    const typeIcon = TYPE_ICONS[item.analysis?.type] || '📋';
    const categoryIcon = CATEGORY_ICONS[item.analysis?.category] || '';

    iconSlot.textContent = typeIcon;
    contentTitle.textContent = item.analysis?.title || 'Clipboard Snippet';
    snippet.textContent = (item.analysis?.summary || item.raw || '').slice(0, 140);
    category.textContent = `${categoryIcon} ${item.analysis?.category || 'General'}`.trim();
    timestamp.textContent = formatTimestamp(item.updatedAt || item.createdAt);

    clone.addEventListener('click', () => selectItem(item.id));
    fragment.appendChild(clone);
  });
  els.list.appendChild(fragment);
}

function setupDragDivider() {
  if (!els.dragDivider || !els.leftPanel) return;

  let isDragging = false;
  let startX = 0;
  let startWidth = 0;

  els.dragDivider.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startWidth = els.leftPanel.offsetWidth;
    els.dragDivider.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const newWidth = startWidth + deltaX;
    const container = els.leftPanel.parentElement;
    const containerWidth = container.offsetWidth;
    const minWidth = 300;
    const maxWidth = containerWidth - 400;

    if (newWidth >= minWidth && newWidth <= maxWidth) {
      const percentage = (newWidth / containerWidth) * 100;
      els.leftPanel.style.flex = `0 0 ${percentage}%`;
      els.leftPanel.style.width = `${percentage}%`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      els.dragDivider.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

function selectItem(id) {
  if (STATE.activeId === id) return;
  STATE.activeId = id;
  renderList();
  const item = STATE.items.find((entry) => entry.id === id);
  if (!item) {
    clearActiveSelection();
    return;
  }
  // Show the full-screen detail + chat modal when a card is selected
  if (els.detailPanel) {
    els.detailPanel.classList.remove('hidden');
  }
  renderDetail(item);
}

function clearActiveSelection() {
  STATE.activeId = null;
  els.detailView.classList.add('hidden');
  els.detailPlaceholder.classList.remove('hidden');
  els.assistantChat.classList.add('hidden');
  STATE.assistantOpen = false;
}

function closeDetailPanel() {
  if (!els.detailPanel) return;
  els.detailPanel.classList.add('hidden');
  clearActiveSelection();
}

function renderDetail(item) {
  els.detailPlaceholder.classList.add('hidden');
  els.detailView.classList.remove('hidden');
  els.detailMeta.textContent = `${item.analysis?.type || 'Snippet'} • ${formatTimestamp(item.updatedAt || item.createdAt)}`;
  els.detailTitle.textContent = item.analysis?.title || 'Clipboard Snippet';
  els.detailSummary.textContent = item.analysis?.summary || 'No summary provided.';
  els.detailInsight.classList.toggle('hidden', !item.analysis?.actionable_insight);
  els.insightText.textContent = item.analysis?.actionable_insight || '';

  renderTags(item.analysis?.tags || []);

  els.sourceCode.querySelector('code').textContent = item.raw || '';
  els.sourceCharCount.textContent = `${(item.raw || '').length} chars`;

  const history = Array.isArray(item.chat) ? item.chat : [];
  renderChat(history);
  els.assistantChat.classList.toggle('hidden', !STATE.assistantOpen);
}

function renderTags(tags) {
  els.detailTags.innerHTML = '';
  if (!tags.length) return;
  tags.forEach((tag) => {
    const span = document.createElement('span');
    span.className = 'tag-pill';
    span.textContent = tag.startsWith('#') ? tag : `#${tag}`;
    span.addEventListener('click', () => {
      STATE.query = tag.replace(/^#/, '').toLowerCase();
      if (els.searchInput) {
        els.searchInput.value = STATE.query;
      }
      applySearchAndFilter();
    });
    els.detailTags.appendChild(span);
  });
}

async function copySourceText() {
  if (!STATE.activeId) return;
  const item = STATE.items.find((entry) => entry.id === STATE.activeId);
  if (!item || !item.raw) return;
  try {
    await navigator.clipboard.writeText(item.raw);
    toast('Copied original clipboard text.');
  } catch (err) {
    toast('Copy failed: ' + (err?.message || err), 'error');
  }
}

function toggleAssistantPanel() {
  STATE.assistantOpen = !STATE.assistantOpen;
  els.assistantChat.classList.toggle('hidden', !STATE.assistantOpen);
  if (STATE.assistantOpen) {
    els.chatInput.focus();
  }
}

async function handleChatSubmit(event) {
  event.preventDefault();
  if (STATE.assistantBusy || !STATE.activeId) return;
  const question = els.chatInput.value.trim();
  if (!question) return;
  const item = STATE.items.find((entry) => entry.id === STATE.activeId);
  if (!item) return;

  STATE.assistantBusy = true;
  const timestamp = Date.now();
  appendChatBubble('user', question, timestamp);
  els.chatInput.value = '';
  scrollChatToBottom();

  // Show loading indicator
  const loaderId = appendLoadingBubble();

  try {
    const response = await chrome.runtime.sendMessage({ type: 'CLIPBOARD_ASSISTANT_ASK', id: item.id, question });

    // Remove loader
    removeLoadingBubble(loaderId);

    if (!response?.ok) throw new Error(response?.error || 'Assistant unavailable');
    appendChatBubble('assistant', response.answer, Date.now());
  } catch (err) {
    removeLoadingBubble(loaderId);
    toast(err?.message || 'Assistant failed to respond', 'error');
    appendChatBubble('assistant', `⚠️ ${err?.message || 'Failed to respond.'}`, Date.now());
  } finally {
    STATE.assistantBusy = false;
    scrollChatToBottom();
  }
}

function appendChatBubble(role, markdown, ts) {
  if (!els.chatTemplate) return;
  const bubble = els.chatTemplate.content.firstElementChild.cloneNode(true);
  bubble.dataset.role = role;

  // Add avatar
  const avatar = bubble.querySelector('.chat-avatar');
  if (avatar) {
    if (role === 'user') {
      avatar.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
      </svg>`;
    } else {
      avatar.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-3 12H7c-.55 0-1-.45-1-1s.45-1 1-1h10c.55 0 1 .45 1 1s-.45 1-1 1zm0-3H7c-.55 0-1-.45-1-1s.45-1 1-1h10c.55 0 1 .45 1 1s-.45 1-1 1zm0-3H7c-.55 0-1-.45-1-1s.45-1 1-1h10c.55 0 1 .45 1 1s-.45 1-1 1z"/>
      </svg>`;
    }
  }

  const bubbleBody = bubble.querySelector('.chat-md');
  const bubbleTime = bubble.querySelector('.chat-time');
  bubbleBody.innerHTML = renderAdvancedMarkdown(markdown);
  hydrateMarkdownBubble(bubbleBody);
  bubbleTime.textContent = formatTimestamp(ts);
  els.chatLog.appendChild(bubble);
}

function appendLoadingBubble() {
  const loaderId = `loader_${Date.now()}`;
  const loaderDiv = document.createElement('div');
  loaderDiv.id = loaderId;
  loaderDiv.className = 'chat-message';
  loaderDiv.dataset.role = 'assistant';
  loaderDiv.innerHTML = `
    <div class="chat-avatar">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-3 12H7c-.55 0-1-.45-1-1s.45-1 1-1h10c.55 0 1 .45 1 1s-.45 1-1 1zm0-3H7c-.55 0-1-.45-1-1s.45-1 1-1h10c.55 0 1 .45 1 1s-.45 1-1 1zm0-3H7c-.55 0-1-.45-1-1s.45-1 1-1h10c.55 0 1 .45 1 1s-.45 1-1 1z"/>
      </svg>
    </div>
    <div class="chat-bubble">
      <div class="chat-md">
        <div class="typing-loader">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  `;
  els.chatLog.appendChild(loaderDiv);
  scrollChatToBottom();
  return loaderId;
}

function removeLoadingBubble(loaderId) {
  const loader = document.getElementById(loaderId);
  if (loader) loader.remove();
}

function renderChat(history) {
  els.chatLog.innerHTML = '';
  if (!Array.isArray(history) || !history.length) return;
  history.forEach((msg) => appendChatBubble(msg.role, msg.content, msg.ts));
  scrollChatToBottom();
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    els.chatLog.scrollTop = els.chatLog.scrollHeight;
  });
}

function renderAdvancedMarkdown(markdown = '') {
  const raw = (markdown ?? '').trim();
  if (!raw) {
    return '<p class="ai-empty">No answer yet.</p>';
  }

  const codeBlocks = [];
  const tableBlocks = [];
  let text = raw.replace(/\r\n/g, '\n');

  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang = 'plaintext', code = '') => {
    const id = codeBlocks.length;
    codeBlocks.push({
      lang: (lang || 'plaintext').toLowerCase(),
      code: code.replace(/\s+$/g, '')
    });
    return `__CODE_BLOCK_${id}__`;
  });

  text = text.replace(/((?:^\|.*\|\s*$\n?){2,})/gm, (match) => {
    const id = tableBlocks.length;
    tableBlocks.push(createTableHTML(match.trim()));
    return `__TABLE_BLOCK_${id}__`;
  });

  const lines = text.split('\n');
  const htmlParts = [];
  let paragraphBuffer = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      htmlParts.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      htmlParts.push('</ol>');
      inOl = false;
    }
  };

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const paragraphText = paragraphBuffer.join(' ').trim();
    if (paragraphText) {
      htmlParts.push(`<p class="ai-paragraph">${decorateInline(escapeHtml(paragraphText))}</p>`);
    }
    paragraphBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeLists();
      continue;
    }

    if (/^__CODE_BLOCK_\d+__$/.test(trimmed)) {
      flushParagraph();
      closeLists();
      htmlParts.push(trimmed);
      continue;
    }

    if (/^__TABLE_BLOCK_\d+__$/.test(trimmed)) {
      flushParagraph();
      closeLists();
      htmlParts.push(trimmed);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeLists();
      const level = headingMatch[1].length;
      const content = decorateInline(escapeHtml(headingMatch[2].trim()));
      if (level === 1) {
        htmlParts.push(`<h2 class="ai-headline">${content}</h2>`);
      } else if (level === 2) {
        htmlParts.push(`<h2 class="ai-title">${content}</h2>`);
      } else {
        htmlParts.push(`<h3 class="ai-subheading">${content}</h3>`);
      }
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      if (!inOl) {
        closeLists();
        htmlParts.push('<ol class="ai-list numbered">');
        inOl = true;
      }
      const item = trimmed.replace(/^\d+\.\s+/, '');
      htmlParts.push(`<li>${decorateInline(escapeHtml(item))}</li>`);
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      flushParagraph();
      if (!inUl) {
        closeLists();
        htmlParts.push('<ul class="ai-list">');
        inUl = true;
      }
      const item = trimmed.replace(/^[-*+]\s+/, '');
      htmlParts.push(`<li>${decorateInline(escapeHtml(item))}</li>`);
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  closeLists();

  let html = htmlParts.join('');
  html = html.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => renderCodeBlock(codeBlocks[Number(idx)]));
  html = html.replace(/__TABLE_BLOCK_(\d+)__/g, (_, idx) => tableBlocks[Number(idx)]);

  return html;
}

function decorateInline(str) {
  if (!str) return '';
  return str
    .replace(/`([^`]+)`/g, (_, code) => `<code class="inline-code">${code}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(https?:\/\/[^\s<]+)(?![^<]*>)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function createTableHTML(block) {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return '';

  const parseRow = (line) => {
    return line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => decorateInline(escapeHtml(cell.trim())));
  };

  const headerCells = parseRow(lines[0]);
  let bodyLines = lines.slice(1);
  if (bodyLines.length && /^[:\-\s|]+$/.test(bodyLines[0])) {
    bodyLines = bodyLines.slice(1);
  }
  const bodyRows = bodyLines.map(parseRow);

  const headHtml = `<thead><tr>${headerCells.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead>`;
  const bodyHtml = bodyRows.length
    ? `<tbody>${bodyRows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>`
    : '<tbody></tbody>';

  return `<table class="ai-table">${headHtml}${bodyHtml}</table>`;
}

function renderCodeBlock(block) {
  if (!block) return '';
  const language = block.lang && block.lang !== 'text' ? block.lang : 'plaintext';
  const escaped = escapeHtml(block.code || '');
  return `<pre class="ai-code"><code class="language-${language}">${escaped}</code></pre>`;
}

function hydrateMarkdownBubble(container) {
  if (!container) return;
  ensurePrism();
  const codeBlocks = container.querySelectorAll('pre code');
  codeBlocks.forEach((block) => {
    if (window.Prism && typeof window.Prism.highlightElement === 'function') {
      window.Prism.highlightElement(block);
    } else if (window.hljs && typeof window.hljs.highlightElement === 'function') {
      window.hljs.highlightElement(block);
    }
  });
}

function ensurePrism() {
  if (window.Prism && typeof window.Prism.highlightElement === 'function') return;
  window.Prism = {
    highlightElement(element) {
      if (!element) return;
      const language = (element.className.match(/language-([\w+-]+)/) || [])[1] || 'plaintext';
      const original = element.textContent || '';
      let html = escapeHtml(original);

      const applySimpleHighlight = (patterns) => {
        patterns.forEach(({ regex, cls }) => {
          html = html.replace(regex, (match) => `<span class="token ${cls}">${match}</span>`);
        });
      };

      if (/^(javascript|typescript|js|ts|tsx|jsx)$/.test(language)) {
        applySimpleHighlight([
          { regex: /(\b(?:const|let|var|function|return|if|else|for|while|await|async|class|extends|new|import|from|export|switch|case|break|continue|throw|try|catch)\b)/g, cls: 'keyword' },
          { regex: /(\/\/[^\n]*)/g, cls: 'comment' },
          { regex: /(\/\*[\s\S]*?\*\/)/g, cls: 'comment' },
          { regex: /('[^']*'|"[^"]*"|`[^`]*`)/g, cls: 'string' },
          { regex: /(\b\d+(?:\.\d+)?\b)/g, cls: 'number' }
        ]);
      } else if (/^(json)$/.test(language)) {
        applySimpleHighlight([
          { regex: /("[^"]*"\s*:)/g, cls: 'property' },
          { regex: /("[^"]*")/g, cls: 'string' },
          { regex: /(\btrue\b|\bfalse\b|null)/g, cls: 'keyword' },
          { regex: /(\b\d+(?:\.\d+)?\b)/g, cls: 'number' }
        ]);
      }

      element.innerHTML = html;
    }
  };
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const date = new Date(ts);
    return date.toLocaleString();
  } catch {
    return '—';
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toast(message, type = 'info') {
  const existing = document.getElementById('clipboard-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'clipboard-toast';
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('visible'));
  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

