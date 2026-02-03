/* 
   Zepra Voice Manager - Enterprise Edition
   Version: 5.0.0 (Final Stable Release)
*/

class ZepraVoiceManager {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.isTranslating = false;
        this.overlay = null;

        // Settings
        this.language = 'en-US';
        this.enableTranslation = false;
        this.targetLanguage = 'English';

        // Diff Engine State
        this.lastFinal = "";
        this.currentInterim = "";
        this.opQueue = [];
        this.isProcessing = false;

        this.init();
    }

    async init() {
        await this.syncSettings();
        if ('webkitSpeechRecognition' in window) {
            this.setupRecognition();
        }

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local') {
                if (changes.voiceInputLanguage) this.language = changes.voiceInputLanguage.newValue;
                if (changes.enableTranslation) this.enableTranslation = changes.enableTranslation.newValue;
                if (changes.translationTargetLanguage) this.targetLanguage = changes.translationTargetLanguage.newValue;

                if (this.recognition && changes.voiceInputLanguage) {
                    this.recognition.lang = this.language;
                }

                if (this.overlay) {
                    const btn = this.overlay.querySelector('.z-trans-btn');
                    if (btn) btn.style.display = this.enableTranslation ? 'flex' : 'none';
                }
            }
        });
    }

    async syncSettings() {
        try {
            const data = await chrome.storage.local.get([
                'voiceInputLanguage',
                'enableTranslation',
                'translationTargetLanguage'
            ]);
            this.language = data.voiceInputLanguage || 'en-US';
            this.enableTranslation = data.enableTranslation || false;
            this.targetLanguage = data.translationTargetLanguage || 'English';
        } catch (e) {
            console.error("Zepra Settings Sync Error:", e);
        }
    }

    // ============================================================
    // ⚡ ENHANCE PROMPT LOGIC (CORE REPLACEMENT)
    // ============================================================
    replaceFieldValue(field, newText) {
        field.focus();
        if (typeof field.select === 'function') {
            field.select();
        } else {
            try {
                const range = document.createRange();
                range.selectNodeContents(field);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            } catch (e) { }
        }

        let success = false;
        try {
            success = document.execCommand('insertText', false, newText);
        } catch (e) { }

        if (!success || (field.value !== undefined && field.value !== newText)) {
            if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
                this.setNativeValue(field, newText);
            } else {
                field.innerText = newText;
            }
        }
    }

    setNativeValue(el, value) {
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value") ||
            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
        if (descriptor && descriptor.set) descriptor.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // ============================================================
    // 🌐 TRANSLATION LOGIC (PERSISTENT & SURGICAL)
    // ============================================================
    async translateLastDictation() {
        if (!this.enableTranslation) return;

        // 1. FREEZE UI (Prevent disappearance)
        this.isTranslating = true;
        this.stop();
        this.opQueue = [];

        const el = this.getActiveElement();
        if (!el) {
            this.finishTranslation(false);
            return;
        }

        // 2. INDICATE LOADING
        const orb = this.overlay ? this.overlay.querySelector('.z-radical-orb') : null;
        if (orb) { orb.classList.remove('recording'); orb.classList.add('loading'); }

        // 3. GET CONTENT (Enhance Logic)
        let text = "";
        let isInput = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

        if (isInput) text = el.value;
        else text = el.innerText || el.textContent;

        const userSelection = window.getSelection().toString();
        if (userSelection && userSelection.trim().length > 0) text = userSelection;

        if (!text || text.trim().length < 2) {
            this.finishTranslation(false);
            return;
        }

        // 4. TRANSLATE & REFINE (Enterprise Prompt)
        const fullPrompt = `You are an expert linguistic engine. Your task is to rewrite the text below into perfect, professional ${this.targetLanguage}.

STRICT RULES:
1. Translate everything into ${this.targetLanguage}. If text is already in ${this.targetLanguage}, refine its grammar and style.
2. Fix any speech-to-text errors, typos, or broken sentence structures.
3. Merge mixed language inputs (e.g., English + Arabic) into a single, flowing ${this.targetLanguage} text.
4. Add professional punctuation.
5. VIOLATION PENALTY: Do NOT write "The user said", "Thinking...", or any explanation. Output ONLY the final text.

INPUT TEXT:
${text}`;

        try {
            chrome.runtime.sendMessage({
                type: "CEREBRAS_GENERATE",
                prompt: fullPrompt,
                options: { model: 'llama-3.3-70b', max_completion_tokens: 2048, temperature: 0.3 }
            }, async (res) => {
                if (res && res.result) {
                    const translatedText = res.result;

                    if (userSelection && userSelection.trim().length > 0) {
                        document.execCommand('insertText', false, translatedText);
                    } else {
                        this.replaceFieldValue(el, translatedText);
                    }
                    this.finishTranslation(true);
                } else {
                    this.finishTranslation(false);
                }
            });
        } catch (e) {
            console.error(e);
            this.finishTranslation(false);
        }
    }

    finishTranslation(success) {
        this.isTranslating = false;
        const orb = this.overlay ? this.overlay.querySelector('.z-radical-orb') : null;
        if (orb) {
            orb.classList.remove('loading');
            if (success) {
                orb.style.background = "#22c55e";
                setTimeout(() => {
                    orb.style.background = "";
                    this.start(); // Auto-restart listening
                }, 800);
            } else {
                orb.classList.add('error');
                setTimeout(() => {
                    orb.classList.remove('error');
                    this.start(); // Auto-restart even on error
                }, 1000);
            }
        } else {
            this.start();
        }
    }

    // ============================================================
    // 🧠 UTILITIES
    // ============================================================
    getActiveElement() {
        let el = document.activeElement;
        try {
            while (el && el.nodeName === "IFRAME") {
                if (el.contentWindow && el.contentWindow.document) {
                    el = el.contentWindow.document.activeElement || el.contentWindow.document.body;
                } else break;
            }
        } catch (e) { }
        if (el && el.shadowRoot) {
            while (el && el.shadowRoot) el = el.shadowRoot.activeElement || el.shadowRoot;
        }
        return el;
    }

    isGoogleDocs(el) {
        return (el && el.className && typeof el.className.match === 'function' && el.className.match(/docs-texteventtarget-iframe/i));
    }

    // ============================================================
    // 🎤 SPEECH & VISUALIZER (FIXED)
    // ============================================================

    updateTextTarget(finalText, interimText) {
        if (!this.isListening) return;
        this.opQueue.push({ final: finalText, interim: interimText });
        this.processQueue();
        this.updateVisualizer(interimText || finalText);
    }

    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        try {
            let el = this.getActiveElement();
            if (!el) return;
            while (this.opQueue.length > 0) {
                if (!this.isListening) { this.opQueue = []; break; }
                el = this.getActiveElement();
                if (!el) break;
                const op = this.opQueue.shift();

                if (this.isGoogleDocs(el)) {
                    if (op.final !== this.lastFinal) {
                        const diff = op.final.substring(this.lastFinal.length);
                        if (diff) await this.pasteViaClipboardHijack(diff);
                        this.lastFinal = op.final;
                    }
                    this.currentInterim = ""; continue;
                }

                const currentVisual = this.lastFinal + this.currentInterim;
                const targetVisual = op.final + op.interim;
                if (currentVisual === targetVisual) continue;

                let prefixLen = 0;
                const minLen = Math.min(currentVisual.length, targetVisual.length);
                while (prefixLen < minLen && currentVisual[prefixLen] === targetVisual[prefixLen]) prefixLen++;
                const backspacesNeeded = currentVisual.length - prefixLen;
                const contextToAdd = targetVisual.substring(prefixLen);

                if (backspacesNeeded > 0) {
                    for (let i = 0; i < backspacesNeeded; i++) document.execCommand('delete', false, null);
                }
                if (contextToAdd.length > 0) {
                    document.execCommand('insertText', false, contextToAdd);
                }
                this.lastFinal = op.final;
                this.currentInterim = op.interim;
                if (this.opQueue.length > 2) await new Promise(r => setTimeout(r, 0));
            }
        } catch (err) { } finally { this.isProcessing = false; }
    }

    async pasteViaClipboardHijack(text) {
        try {
            const el = this.getActiveElement(); el.focus();
            const copyHandler = (e) => { e.preventDefault(); e.clipboardData.setData('text/plain', text); };
            document.addEventListener('copy', copyHandler); document.execCommand('copy');
            document.removeEventListener('copy', copyHandler); document.execCommand('paste');
        } catch (e) { }
    }

    setupRecognition() {
        if (!('webkitSpeechRecognition' in window)) return;
        this.recognition = new webkitSpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.language;

        this.recognition.onstart = () => {
            if (this.isTranslating) return;
            this.isListening = true;
            this.lastFinal = ""; this.currentInterim = ""; this.opQueue = [];

            // CRITICAL FIX: Calls showVisualizer (which triggers CSS injection)
            this.showVisualizer();

            if (this.overlay) {
                const orb = this.overlay.querySelector('.z-radical-orb');
                if (orb) orb.classList.add('recording');
            }
            this.syncSettings();
        };

        this.recognition.onend = () => {
            if (this.isListening && !this.isTranslating) {
                try { this.recognition.start(); } catch (e) { this.stop(); }
            } else {
                if (this.overlay) {
                    const orb = this.overlay.querySelector('.z-radical-orb');
                    if (orb) orb.classList.remove('recording');
                }
            }
        };

        this.recognition.onresult = (e) => {
            if (!this.isListening) return;
            let fullFinal = "", fullInterim = "";
            for (let i = 0; i < e.results.length; ++i) {
                if (e.results[i].isFinal) fullFinal += e.results[i][0].transcript;
                else fullInterim += e.results[i][0].transcript;
            }
            this.updateTextTarget(fullFinal, fullInterim);
        };

        this.recognition.onerror = (e) => { if (e.error === 'not-allowed') this.stop(); };
    }

    toggle() { if (this.isTranslating) return; this.isListening ? this.stop() : this.start(); }
    start() { if (!this.recognition) this.setupRecognition(); this.syncSettings().then(() => { this.recognition.lang = this.language; try { this.recognition.start(); } catch (e) { } }); }
    stop() {
        this.isListening = false; try { this.recognition.stop(); } catch (e) { } this.opQueue = []; this.updateVisualizer("");
        if (this.overlay) { const orb = this.overlay.querySelector('.z-radical-orb'); if (orb) orb.classList.remove('recording'); }
        if (!this.isTranslating) { setTimeout(() => { if (!this.isListening && !this.isTranslating) this.hideVisualizer(); }, 3000); }
    }

    createOverlay() {
        const dock = document.createElement('div'); dock.className = 'zepra-voice-dock';
        const pill = document.createElement('div'); pill.className = 'z-text-pill'; pill.textContent = 'Speak now...';
        const controls = document.createElement('div'); controls.className = 'z-controls';
        const orb = document.createElement('div'); orb.className = 'z-radical-orb';
        orb.onclick = () => { if (!this.isTranslating) this.stop(); };

        const transBtn = document.createElement('div'); transBtn.className = 'z-trans-btn';
        transBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" class="z-icon"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;
        transBtn.title = "Translate Content";
        transBtn.style.display = this.enableTranslation ? 'flex' : 'none';
        transBtn.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
        transBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.translateLastDictation(); };

        controls.appendChild(orb); controls.appendChild(transBtn); dock.appendChild(pill); dock.appendChild(controls);
        return dock;
    }

    // ⚡ RESTORED METHOD with CSS INJECTION
    showVisualizer() {
        if (!this.overlay) {
            this.overlay = this.createOverlay();
            document.body.appendChild(this.overlay);
            const style = document.createElement('style');
            style.textContent = `
                .zepra-voice-dock { 
                    position: fixed; bottom: 50px; left: 50%; transform: translateX(-50%); 
                    display: flex; flex-direction: column; align-items: center; gap: 12px; 
                    z-index: 2147483647; pointer-events: none; font-family: Inter, system-ui, sans-serif; 
                }
                .z-text-pill { 
                    background: rgba(16, 185, 129, 0.95); 
                    color: #fff; padding: 8px 16px; border-radius: 20px; 
                    font-size: 15px; font-weight: 500; 
                    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); 
                    max-width: 400px; text-align: center; 
                    opacity: 0; transform: translateY(10px); transition: all 0.2s ease;
                }
                .z-text-pill.visible { opacity: 1; transform: translateY(0); }
                .z-controls { 
                    display: flex; align-items: center; gap: 16px; 
                    pointer-events: auto; background: rgba(0, 0, 0, 0.85); 
                    padding: 8px 16px; border-radius: 50px; 
                    backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.15); 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
                }
                .z-radical-orb { 
                    width: 36px; height: 36px; border-radius: 50%; 
                    background: #94a3b8; /* Silver */
                    box-shadow: 0 2px 10px rgba(148, 163, 184, 0.3);
                    cursor: pointer; transition: all 0.3s ease; position: relative;
                }
                .z-radical-orb.recording {
                    background: #22c55e; /* Green */
                    box-shadow: 0 0 15px rgba(34, 197, 94, 0.6);
                    animation: orbPulse 1.5s infinite;
                }
                .z-radical-orb.loading {
                    animation: colorCycle 1.5s infinite linear;
                }
                .z-radical-orb.error {
                    background: #ef4444; /* Red */
                    animation: shake 0.4s ease;
                }
                @keyframes colorCycle {
                    0% { background: #ffffff; } 50% { background: #22c55e; } 100% { background: #000000; }
                }
                @keyframes orbPulse { 
                    0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } 
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .z-trans-btn { 
                    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; 
                    color: #e2e8f0; border-radius: 50%; cursor: pointer; transition: all 0.2s;
                }
                .z-trans-btn:hover { color: #22c55e; background: rgba(255,255,255,0.1); }
                .z-icon { width: 20px; height: 20px; }
            `;
            this.overlay.appendChild(style);
        }
    }

    updateVisualizer(text) {
        if (!this.overlay) return;
        const pill = this.overlay.querySelector('.z-text-pill');
        if (text && text.trim().length > 0) {
            const display = text.length > 50 ? "..." + text.slice(-50) : text;
            pill.textContent = display; pill.classList.add('visible');
        } else { pill.classList.remove('visible'); }
    }
    hideVisualizer() { if (this.overlay) { this.overlay.remove(); this.overlay = null; } }
}

const zepraVoice = new ZepraVoiceManager();
document.addEventListener('keydown', (e) => { if (e.altKey && e.shiftKey && (e.key === 'v' || e.key === 'V')) zepraVoice.toggle(); });
chrome.runtime.onMessage.addListener((msg) => { if (msg.type === 'TOGGLE_VOICE') zepraVoice.toggle(); });
