/**
 * ZEPRA SCOUT v4.0 - Time Machine Caption Extractor
 * Runs 12 seconds ahead, extracts captions, sends with precise timestamps
 */
console.log("[ZEPRA SCOUT] v4.0 Loaded for: " + window.location.href);

class ZepraScoutManager {
    constructor() {
        this.video = null;
        this.isActive = false;
        this.lastCaption = '';
        this.captionInterval = null;
        this.mainVideoStartTime = 0; // The time the main video should start at

        // Listen for activation & sync messages
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.type === 'FORCE_ACTIVATE_SCOUT') {
                console.log("[SCOUT] Activation received!");
                if (!this.isActive && this.isYouTubeVideoPage()) {
                    this.activate();
                    sendResponse({ ok: true, activated: true });
                } else {
                    sendResponse({ ok: true, activated: false });
                }
            }
            return true;
        });

        // Auto-activate for popup windows
        setTimeout(() => {
            if (!this.isActive && this.isYouTubeVideoPage()) {
                if (window.innerWidth < 600 || window.innerHeight < 400) {
                    console.log("[SCOUT] Auto-activating (popup detected)");
                    this.activate();
                }
            }
        }, 2000);
    }

    isYouTubeVideoPage() {
        return window.location.hostname.includes('youtube.com') &&
            window.location.pathname.includes('/watch');
    }

    activate() {
        if (this.isActive) return;
        this.isActive = true;
        console.log('[SCOUT] 🕵️ ACTIVATED - v4.0 Precise Sync Mode');
        this.injectStatusUI();
        this.init();
    }

    injectStatusUI() {
        if (document.getElementById('zepra-scout-ui')) return;

        const div = document.createElement('div');
        div.id = 'zepra-scout-ui';
        div.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #00ff88; z-index: 2147483647;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: 'Segoe UI', monospace; font-size: 14px; text-align: center;
            pointer-events: none;
        `;
        div.innerHTML = `
            <div style="font-size: 36px; margin-bottom: 15px;">🕵️ ZEPRA SCOUT</div>
            <div style="color: #888; font-size: 12px;">Time Machine Sync v4.0</div>
            <div id="z-scout-time" style="color: #0ff; margin-top: 20px; font-size: 24px;">00:00</div>
            <div id="z-scout-log" style="color: #0f0; margin-top: 10px; font-size: 13px; max-width: 90%; word-wrap: break-word; min-height: 40px;">Initializing...</div>
            <div id="z-scout-queue" style="color: #666; margin-top: 10px; font-size: 11px;">Queue: 0</div>
            <div style="color: #333; font-size: 9px; margin-top: 20px;">DO NOT CLOSE • Running ahead of main video</div>
        `;
        document.body.appendChild(div);
        this.logEl = document.getElementById('z-scout-log');
        this.timeEl = document.getElementById('z-scout-time');
        this.queueEl = document.getElementById('z-scout-queue');
    }

    log(msg) {
        if (this.logEl) this.logEl.textContent = msg;
        console.log(`[SCOUT] ${msg}`);
    }

    updateTime() {
        if (this.video && this.timeEl) {
            const t = this.video.currentTime;
            const m = Math.floor(t / 60);
            const s = Math.floor(t % 60);
            this.timeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
    }

    init() {
        const check = setInterval(() => {
            const v = document.querySelector('video');
            if (v && v.readyState >= 1) {
                clearInterval(check);
                this.attach(v);
            }
        }, 300);
    }

    attach(video) {
        this.video = video;

        // FORCE MUTE
        this.video.muted = true;
        this.video.volume = 0;

        // Run 1.5x faster to build lead time
        this.video.playbackRate = 1.5;

        // Keep muted
        setInterval(() => {
            if (this.video && this.isActive) {
                this.video.muted = true;
                this.video.volume = 0;
            }
        }, 500);

        // Update time display
        setInterval(() => this.updateTime(), 200);

        // Enable captions
        this.enableCaptions();

        // Start from beginning
        this.video.currentTime = 0;

        // Force play
        this.video.play().then(() => {
            this.log('Running ahead, extracting captions...');
        }).catch(e => {
            this.log('Autoplay issue: ' + e.message);
        });

        // Keep playing
        this.video.onpause = () => {
            if (this.isActive) this.video.play();
        };

        // Start extraction
        this.startCaptionExtraction();
    }

    enableCaptions() {
        setTimeout(() => {
            const ccButton = document.querySelector('.ytp-subtitles-button');
            if (ccButton) {
                const isActive = ccButton.getAttribute('aria-pressed') === 'true';
                if (!isActive) {
                    ccButton.click();
                    this.log('Captions enabled');
                }
            }
        }, 1500);
    }

    startCaptionExtraction() {
        this.log('Starting caption extraction...');
        let queueCount = 0;

        this.captionInterval = setInterval(() => {
            const caption = this.extractCaption();

            if (caption && caption !== this.lastCaption && caption.length > 5) {
                this.lastCaption = caption;

                // CRITICAL: Record the exact video time for this caption
                const videoTime = this.video.currentTime;

                this.log(`Found @ ${videoTime.toFixed(1)}s: "${caption.substring(0, 35)}..."`);

                // Send for translation with the timestamp
                this.translateAndQueue(caption, videoTime);
                queueCount++;
                if (this.queueEl) this.queueEl.textContent = `Queued: ${queueCount}`;
            }
        }, 400);
    }

    extractCaption() {
        // Try YouTube's caption container
        const captionWindow = document.querySelector('.ytp-caption-window-container');
        if (captionWindow) {
            const segments = captionWindow.querySelectorAll('.ytp-caption-segment');
            if (segments.length > 0) {
                return Array.from(segments).map(s => s.textContent).join(' ').trim();
            }
        }
        return null;
    }

    translateAndQueue(text, videoTime) {
        console.log(`[SCOUT] >>> Sending TRANSLATE_FOR_SYNC: t=${videoTime.toFixed(1)}s`);

        // Send to background for translation
        chrome.runtime.sendMessage({
            type: 'TRANSLATE_FOR_SYNC',
            text: text,
            videoTime: videoTime,
            source: 'ar',
            target: 'en'
        }, (res) => {
            if (chrome.runtime.lastError) {
                console.error("[SCOUT] !!! Message FAILED:", chrome.runtime.lastError.message);
                this.log(`Error: ${chrome.runtime.lastError.message}`);
                return;
            }

            if (res && res.ok) {
                console.log(`[SCOUT] ✓ Queued for ${videoTime.toFixed(1)}s (Buffer: ${res.bufferSize || '?'})`);
            } else {
                console.log("[SCOUT] Response:", res);
            }
        });
    }

    stop() {
        this.isActive = false;
        if (this.captionInterval) clearInterval(this.captionInterval);
    }
}

// Singleton
if (!window.ZepraScoutManagerInstance) {
    window.ZepraScoutManagerInstance = new ZepraScoutManager();
}
