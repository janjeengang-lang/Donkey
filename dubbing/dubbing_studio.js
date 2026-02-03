/*
    Zepra Live Dub - Visual Studio Component (ZepraEngine UI)
*/

class SubtitleOverlay {
    constructor() {
        this.element = null;
        this.timerEl = null;
        this.init();
    }

    init() {
        if (document.getElementById('zepra-subtitle-overlay')) return;
        this.element = document.createElement('div');
        this.element.id = 'zepra-subtitle-overlay';
        this.element.innerHTML = `
            <div class="z-sub-text">Waiting for translation...</div>
            <div class="z-sub-timer">00:00</div>
            <div class="z-sub-handle">⋮</div>
        `;
        document.body.appendChild(this.element);
        this.timerEl = this.element.querySelector('.z-sub-timer');
        this.injectStyles();
        this.makeDraggable();
    }

    injectStyles() {
        if (document.getElementById('zepra-sub-styles')) return;
        const style = document.createElement('style');
        style.id = 'zepra-sub-styles';
        style.textContent = `
            #zepra-subtitle-overlay {
                position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
                width: 80%; max-width: 900px; min-height: 100px;
                background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(12px);
                border-radius: 16px; padding: 24px 48px;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                z-index: 2147483647; pointer-events: auto; opacity: 0; transition: opacity 0.3s;
                text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                border: 1px solid rgba(255,255,255,0.05);
            }
            #zepra-subtitle-overlay.visible { opacity: 1; pointer-events: auto; }
            
            .z-sub-text {
                color: #ffffff; font-family: 'Inter', system-ui, sans-serif;
                font-size: 28px; font-weight: 700; line-height: 1.4;
                text-shadow: 0 2px 4px rgba(0,0,0,0.8);
                direction: ltr; transition: color 0.2s;
            }

            .z-sub-timer {
                margin-top: 10px;
                font-size: 12px;
                letter-spacing: 2px;
                text-transform: uppercase;
                color: rgba(255,255,255,0.6);
            }
            
            .z-sub-handle {
                position: absolute; top: 10px; right: 10px; color: rgba(255,255,255,0.2);
                cursor: grab; font-size: 24px; user-select: none; width: 30px; height: 30px;
                display:flex; align-items:center; justify-content:center;
            }
            .z-sub-handle:hover { color: #fff; background: rgba(255,255,255,0.1); border-radius: 4px; }
            .z-sub-handle:active { color: #fff; cursor: grabbing; }
        `;
        document.head.appendChild(style);
    }

    update(text, isInterim = false) {
        if (!this.element) return;

        // Limit text to maximum 15 words
        let displayText = text;
        if (text && text.trim().length > 0) {
            const words = text.split(/\s+/);
            if (words.length > 15) {
                displayText = "..." + words.slice(-15).join(" ");
            }
        }

        const txt = this.element.querySelector('.z-sub-text');
        txt.textContent = displayText;
        if (isInterim) {
            txt.style.color = '#94a3b8'; // Slate 400 (Gray)
            txt.style.fontStyle = 'italic';
        } else {
            txt.style.color = '#ffffff';
            txt.style.fontStyle = 'normal';
        }
    }

    setTime(seconds) {
        if (!this.timerEl || Number.isNaN(seconds)) return;
        const safeSeconds = Math.max(0, seconds);
        const minutes = Math.floor(safeSeconds / 60);
        const secs = Math.floor(safeSeconds % 60);
        this.timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    show() { this.element.classList.add('visible'); }
    hide() { this.element.classList.remove('visible'); }

    makeDraggable() {
        const handle = this.element.querySelector('.z-sub-handle');
        let isDown = false;
        let startX, startY;
        let initialLeft, initialTop;

        handle.onmousedown = (e) => {
            isDown = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = this.element.getBoundingClientRect();
            this.element.style.bottom = 'auto';
            this.element.style.transform = 'none';
            this.element.style.left = rect.left + 'px';
            this.element.style.top = rect.top + 'px';
            initialLeft = rect.left;
            initialTop = rect.top;
        };

        document.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            this.element.style.left = (initialLeft + dx) + 'px';
            this.element.style.top = (initialTop + dy) + 'px';
        });

        document.addEventListener('mouseup', () => { isDown = false; });
    }
}

class ZepraDubbingStudio {
    constructor() {
        this.studio = null;
        this.overlay = null;
        this.activeVideo = null;
        this.engine = null; // Will bind to ZepraEngine
        this._timerInterval = null;
    }

    init() {
        if (document.getElementById('zepra-dubbing-studio')) return;
        this.injectStyles();
        this.studio = this.createStudioElement();
        document.body.appendChild(this.studio);
        this.setupDrag(this.studio);
        this.setupShortcut();

        // Init Overlay
        this.overlay = new SubtitleOverlay();

        // Bind to Engine
        this.connectToEngine();
    }

    setupShortcut() {
        document.addEventListener('keydown', (e) => {
            if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
                if (!this.activeVideo) {
                    const video = document.querySelector('video');
                    if (video) this.activeVideo = video;
                }
                if (this.activeVideo) this.toggleStudio();
            }
        });
    }

    async startDubbing() {
        if (!this.activeVideo) {
            const fallback = document.querySelector('video');
            if (fallback) {
                this.activeVideo = fallback;
                if (this.engine) this.engine.activeVideo = fallback;
            } else {
                console.log('[DUBBING] No video found');
                return;
            }
        }
        if (this.isDubbing) return;

        const btn = this.studio.querySelector('#z-dub-play');
        this.isDubbing = true;

        // Update button
        if (btn) {
            btn.innerHTML = '⏹ Stop Dubbing';
            btn.classList.add('z-danger', 'stop');
            btn.classList.remove('z-primary');
        }

        const sourceLang = this.studio.querySelector('#z-dub-source-lang')?.value || 'ar-SA';
        const targetLang = this.studio.querySelector('#z-dub-target-lang')?.value || 'English';

        chrome.runtime.sendMessage({ type: 'OPEN_SCOUT', url: window.location.href });
        if (window.ZepraDubBridge) {
            window.ZepraDubBridge.startSession({ sourceLang, targetLang });
        }
        this.startTimer();
    }

    stopDubbing() {
        this.isDubbing = false;

        const btn = this.studio.querySelector('#z-dub-play');
        if (btn) {
            btn.innerHTML = '▶ Start Dubbing';
            btn.classList.remove('z-danger', 'stop');
            btn.classList.add('z-primary');
        }

        if (window.ZepraDubBridge) {
            window.ZepraDubBridge.stopSession();
        }

        // Hide Overlay
        if (this.overlay) this.overlay.hide();

        // Cancel any pending speech
        if (window.speechSynthesis) window.speechSynthesis.cancel();

        chrome.runtime.sendMessage({ type: 'CLOSE_SCOUT' });
        this.stopTimer();
    }

    startTimer() {
        if (!this.activeVideo || !this.overlay) return;
        if (this._timerInterval) clearInterval(this._timerInterval);
        this._timerInterval = setInterval(() => {
            if (!this.activeVideo || !this.overlay) return;
            this.overlay.setTime(this.activeVideo.currentTime || 0);
        }, 500);
    }

    stopTimer() {
        if (this._timerInterval) clearInterval(this._timerInterval);
        this._timerInterval = null;
    }
    createStudioElement() {
        const div = document.createElement('div');
        div.id = 'zepra-dubbing-studio';
        div.innerHTML = `
            <div class="z-dub-header">
                <div class="z-dub-status text-pulse">🎙️ Zepra Core <span style="font-size:9px; opacity:0.6; margin-left:5px;">v4.0</span></div>
                <div class="z-dub-close">✕</div>
            </div>
            
            <div class="z-dub-content">
                <div class="z-dub-info" id="z-dub-status-text">Ready</div>
                
                <div class="z-dub-lang-grid">
                    <div class="z-group">
                        <label>Video Language</label>
                        <select id="z-dub-source-lang" class="z-dub-select">
                            <option value="ar-SA" selected>🇸🇦 Arabic</option>
                            <option value="en-US">🇺🇸 English</option>
                            <option value="fr-FR">🇫🇷 French</option>
                        </select>
                    </div>
                    <div class="z-arrow">➡</div>
                    <div class="z-group">
                        <label>Target</label>
                        <select id="z-dub-target-lang" class="z-dub-select">
                            <option value="English" selected>🇺🇸 English</option>
                            <option value="Arabic">🇸🇦 Arabic</option>
                            <option value="French">🇫🇷 French</option>
                        </select>
                    </div>
                </div>

                <div class="z-dub-visualizer">
                   <div id="z-live-text" style="font-size:11px; color:#64748b; height:20px; overflow:hidden; white-space:nowrap; text-align:center;">...</div>
                </div>

                <button id="z-dub-play" class="z-dub-btn primary large">▶ Start Dubbing</button>

                <div class="z-dub-controls fa-row footer-mode">
                    <button id="z-dub-speed" class="z-dub-btn small">⚡ 1.0x</button>
                    <button id="z-dub-settings" class="z-dub-btn small">⚙️</button>
                </div>
            </div>
        `;

        div.querySelector('.z-dub-close').onclick = () => this.toggleStudio(false);
        div.querySelector('#z-dub-play').onclick = () => this.toggleDubbing();
        div.querySelector('#z-dub-speed').onclick = () => this.cycleSpeed();

        return div;
    }

    injectStyles() {
        if (document.getElementById('zepra-dub-styles')) return;
        const style = document.createElement('style');
        style.id = 'zepra-dub-styles';
        style.textContent = `
            #zepra-dubbing-studio {
                position: fixed; bottom: 85px; right: 20px; transform: none; left: auto;
                width: 320px; background: rgba(12, 12, 12, 0.98);
                backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 18px; padding: 0;
                box-shadow: 0 40px 80px rgba(0,0,0,0.6);
                z-index: 2147483647; font-family: 'Inter', system-ui, sans-serif;
                color: #fff; opacity: 0; pointer-events: none; transform: translateY(10px);
                transition: opacity 0.3s, transform 0.3s;
            }
            #zepra-dubbing-studio.visible { opacity: 1; pointer-events: all; transform: translateY(0); }
            
            .z-dub-header {
                padding: 14px 20px; background: rgba(255,255,255,0.02);
                border-bottom: 1px solid rgba(255,255,255,0.05);
                display: flex; justify-content: space-between; align-items: center;
                cursor: grab;
            }
            .z-dub-status { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #00ff88; }
            .z-dub-close { cursor: pointer; opacity: 0.5; } .z-dub-close:hover { opacity: 1; }

            .z-dub-content { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
            .z-dub-info { text-align: center; font-size: 13px; color: #94a3b8; height: 18px; font-weight: 500; }
            
            .z-dub-lang-grid { display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 10px; align-items: center; }
            .z-group { display: flex; flex-direction: column; }
            .z-group label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px;}
            .z-dub-select { background: none; border: none; color: #e2e8f0; font-size: 13px; font-weight: 600; outline: none; width: 90px; }
            .z-dub-select option { background: #000; }
            
            .z-dub-btn {
                background: #222; color: #fff; border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;
                display: flex; justify-content: center; align-items: center;
            }
            .z-dub-btn.primary { background: #00ff88; color: #000; border: none; padding: 14px; font-size: 14px; width: 100%; letter-spacing: 0.5px; }
            .z-dub-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(0,255,136,0.3); }
            .z-dub-btn.stop { background: #ff4444; color: #fff; border: none; padding: 14px; width: 100%; }
            .z-dub-btn.small { padding: 6px 10px; font-size: 11px; }

            .footer-mode { justify-content: space-between; display: flex; }
        `;
        document.head.appendChild(style);
    }

    toggleStudio(force) {
        if (!this.studio) this.init();
        if (!this.studio) return;
        const isVisible = this.studio.classList.contains('visible');
        const shouldShow = force !== undefined ? force : !isVisible;

        if (shouldShow) {
            this.studio.classList.add('visible');
        } else {
            this.studio.classList.remove('visible');
        }
    }

    setupDrag(el) {
        const header = el.querySelector('.z-dub-header');
        let isDown = false, startX, startY;
        let initialLeft, initialTop;

        header.onmousedown = (e) => {
            isDown = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = el.getBoundingClientRect();
            el.style.left = rect.left + 'px';
            el.style.top = rect.top + 'px';
            initialLeft = rect.left;
            initialTop = rect.top;
            el.style.transform = 'none';
        };
        document.onmousemove = (e) => {
            if (!isDown) return;
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = (initialLeft + dx) + 'px';
            el.style.top = (initialTop + dy) + 'px';
        };
        document.onmouseup = () => { isDown = false; };
    }

    // --- Core Logic Binding ---

    connectToEngine() {
        if (!window.ZepraEngine) {
            console.warn("ZepraEngine not found. Retrying in 500ms");
            setTimeout(() => this.connectToEngine(), 500);
            return;
        }
        this.engine = window.ZepraEngine;

        // Listen to Engine Events
        this.engine.on('status', (s) => this.handleCoreStatus(s));
        this.engine.on('transcript', (t) => this.handleTranscript(t));
        this.engine.on('translation', (t) => this.handleTranslation(t));
        this.engine.on('volume', (v) => this.handleVolume(v));
        this.engine.on('error', (e) => this.handleError(e));

        console.log("UI Connected to Zepra Audio Core.");
    }

    handleVolume(data) {
        const fill = this.studio.querySelector('.z-dub-progress-fill');
        const status = this.studio.querySelector('#z-dub-status-text');

        // Normalize 0-100 to percentage width
        const width = Math.min(100, data.level * 2.5); // Boost visual sensitivity

        if (fill) {
            fill.style.width = width + '%';
            fill.style.backgroundColor = width > 80 ? '#fbbf24' : '#00ff88'; // Amber if loud
        }

        // Audio Recovery Logic
        if (data.level > 10 && this._silenceTimer) {
            clearTimeout(this._silenceTimer);
            this._silenceTimer = null;
            if (status && status.textContent.includes('No Audio')) {
                status.textContent = "● Live";
                status.style.color = '#00ff88';
            }
        }

        if (data.level < 5 && !this._silenceTimer) {
            this._silenceTimer = setTimeout(() => {
                if (status) {
                    status.textContent = "⚠ No Input Audio";
                    status.style.color = '#fbbf24';
                }
            }, 5000); // 5s silence warning
        }
    }

    toggleDubbing() {
        if (this.isDubbing) {
            this.stopDubbing();
        } else {
            this.startDubbing();
        }
    }

    // --- Event Handlers ---

    handleCoreStatus(data) {
        const btn = this.studio.querySelector('#z-dub-play');
        const statusEl = this.studio.querySelector('#z-dub-status-text');

        // 1. Update Text
        this.updateStatus(data.message);

        // 2. Update Button Logic
        if (data.code === 'ACTIVE') {
            btn.textContent = '⏹ Stop Dubbing';
            btn.className = 'z-dub-btn stop large';
            statusEl.style.color = '#00ff88';
            // Ensure overlay is visible when active
            if (this.overlay) this.overlay.show();
        } else if (data.code === 'IDLE') {
            btn.textContent = '▶ Start Dubbing';
            btn.className = 'z-dub-btn primary large';
            statusEl.style.color = '#94a3b8';
            if (this.overlay) this.overlay.hide();
        } else if (data.code === 'CONNECTING') {
            btn.textContent = '⏳ Starting...';
            btn.className = 'z-dub-btn primary large';
            statusEl.style.color = '#fbbf24'; // Amber
            if (this.overlay) this.overlay.show();
        } else if (data.code === 'ERROR') {
            btn.textContent = '⚠ Retry';
            btn.className = 'z-dub-btn primary large';
            statusEl.style.color = '#ef4444';
        }
    }

    handleTranscript(data) {
        const liveText = this.studio.querySelector('#z-live-text');

        // Show raw text in the mini-visualizer (Bottom Right Box)
        if (liveText && data.text) {
            liveText.textContent = data.text;
            liveText.style.color = data.type === 'interim' ? '#94a3b8' : '#fff';
            if (data.type === 'final') {
                liveText.style.opacity = '0.5';
                setTimeout(() => liveText.style.opacity = '1', 100);
            }
        }

        // CRITICAL FIX: Do NOT update the main overlay with raw transcript.
        // The overlay is reserved for TRANSLATED text only.
        // We do nothing here for this.overlay.
    }

    handleTranslation(data) {
        if (data.status === 'translating' && data.type === 'interim') {
            // Show Instant Translation
            if (this.overlay) {
                this.overlay.show();
                this.overlay.update(data.text, true);
            }
        }
        else if (data.status === 'error') {
            // Show Error
            if (this.overlay) {
                this.overlay.show();
                this.overlay.update(data.text, true);
                const txt = this.overlay.element.querySelector('.z-sub-text');
                if (txt) txt.style.color = '#ef4444'; // RED
            }
        }
        else if (data.status === 'complete' && data.type === 'final') {
            // Show Final Translation
            if (this.overlay) {
                this.overlay.show();
                this.overlay.update(data.text, false); // False = looks solid/final
            }
        }
    }

    handleError(data) {
        const statusEl = this.studio ? this.studio.querySelector('#z-dub-status-text') : null;
        if (statusEl) {
            statusEl.textContent = "⚠ " + (data.message || "Unknown Error");
            statusEl.style.color = '#ef4444';
        }
        if (this.overlay) {
            this.overlay.show();
            this.overlay.update("Error: " + (data.message || "Check microphone permissions"), true);
        }
    }

    cycleSpeed() {
        if (!this.activeVideo) return;
        const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
        let current = this.activeVideo.playbackRate;
        let nextIndex = speeds.findIndex(s => Math.abs(s - current) < 0.1) + 1;
        if (nextIndex >= speeds.length) nextIndex = 0;
        let next = speeds[nextIndex];
        this.activeVideo.playbackRate = next;

        const btn = this.studio.querySelector('#z-dub-speed');
        if (btn) btn.textContent = `⚡ ${next}x`;
    }

    updateStatus(msg) {
        if (!this.studio) return;
        const status = this.studio.querySelector('#z-dub-status-text');
        status.textContent = msg;
    }

    scanForVideos() {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (video.closest('#zepra-sidebar-root') ||
                video.closest('.zepra-extension-root') ||
                video.offsetWidth < 200 ||
                video.dataset.zepraDubbed) return;

            const parent = video.parentElement;
            if (!parent) return;
            video.dataset.zepraDubbed = 'true';

            const btn = document.createElement('div');
            btn.className = 'zepra-video-trigger';
            btn.innerHTML = '🎙️ Dub';
            btn.title = 'Start Zepra Dubbing (Core v4)';

            Object.assign(btn.style, {
                position: 'absolute', top: '15px', right: '15px', zIndex: '2147483647',
                background: 'rgba(0,0,0,0.85)', color: '#00ff88', border: 'none',
                borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '700',
                cursor: 'pointer', backdropFilter: 'blur(8px)', display: 'flex', gap: '6px',
                transition: 'all 0.2s', opacity: '0', pointerEvents: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            });

            parent.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
            parent.addEventListener('mouseleave', () => { btn.style.opacity = '0'; });

            btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; btn.style.color = '#fff'; };
            btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.color = '#00ff88'; };

            btn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.activeVideo = video;
                if (this.engine) this.engine.activeVideo = video; // Link video to engine
                this.toggleStudio(true);
            };

            const comp = getComputedStyle(parent);
            if (comp.position === 'static') parent.style.position = 'relative';
            parent.appendChild(btn);
        });
    }

    startAutoDetection() {
        this.scanForVideos();
        if (this._scanInterval) clearInterval(this._scanInterval);
        this._scanInterval = setInterval(() => this.scanForVideos(), 2000);
    }
}

if (!window.zepraDubStudio) {
    if (window.top === window.self) {
        window.zepraDubStudio = new ZepraDubbingStudio();
        window.zepraDubStudio.startAutoDetection();
    }
}
