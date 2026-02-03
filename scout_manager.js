/**
 * ZEPRA SCOUT MANAGER v3.0 - Caption Extraction Method
 * Instead of audio capture (which fails), we extract YouTube's captions directly!
 */
console.log("[ZEPRA SCOUT] Script Loaded for: " + window.location.href);

class ZepraScoutManager {
    constructor() {
        this.video = null;
        this.isActive = false;
        this.lastCaption = '';
        this.captionInterval = null;

        // Listen for activation
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            console.log("[ZEPRA SCOUT] Message received:", msg.type);
            if (msg.type === 'FORCE_ACTIVATE_SCOUT') {
                console.log("[ZEPRA SCOUT] Forced Activation received!");
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
                if (window.innerWidth < 600) {
                    console.log("[ZEPRA SCOUT] Auto-activating (popup detected)");
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
        console.log('[ZEPRA SCOUT] 🕵️ ACTIVATED - Caption Extraction Mode');
        this.injectStatusUI();
        this.init();
    }

    injectStatusUI() {
        if (document.getElementById('zepra-scout-ui')) return;

        const div = document.createElement('div');
        div.id = 'zepra-scout-ui';
        div.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #000; color: #00ff00; z-index: 2147483647;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: monospace; font-size: 16px; text-align: center;
            opacity: 0.95; pointer-events: none;
        `;
        div.innerHTML = `
            <div style="font-size: 40px; margin-bottom: 20px;">🕵️ ZEPRA SCOUT</div>
            <div>Extracting Captions...</div>
            <div id="z-scout-log" style="color: #0f0; margin-top: 10px; font-size: 14px; max-width: 80%; word-wrap: break-word;">Waiting for captions...</div>
            <br>
            <div style="color: #444; font-size: 10px;">DO NOT CLOSE THIS WINDOW</div>
        `;
        document.body.appendChild(div);
        this.logEl = document.getElementById('z-scout-log');
    }

    log(msg) {
        if (this.logEl) this.logEl.textContent = msg;
        console.log(`[SCOUT] ${msg}`);
    }

    init() {
        // Wait for video
        const check = setInterval(() => {
            const v = document.querySelector('video');
            if (v && v.readyState >= 1) {
                clearInterval(check);
                this.attach(v);
            }
        }, 500);
    }

    attach(video) {
        this.video = video;
        this.video.muted = true;
        this.video.playbackRate = 1.5; // Faster to build buffer

        // Enable captions if not already
        this.enableCaptions();

        // Force play
        this.video.play().then(() => {
            this.log('Video playing, watching for captions...');
        }).catch(e => {
            this.log('Autoplay issue: ' + e.message);
        });

        // Keep playing
        this.video.onpause = () => {
            if (this.isActive) this.video.play();
        };

        // Start caption extraction
        this.startCaptionExtraction();
    }

    enableCaptions() {
        // Try to enable YouTube's auto-captions
        setTimeout(() => {
            // Click the CC button if it exists
            const ccButton = document.querySelector('.ytp-subtitles-button');
            if (ccButton) {
                const isActive = ccButton.getAttribute('aria-pressed') === 'true';
                if (!isActive) {
                    ccButton.click();
                    this.log('Enabled captions');
                }
            }
        }, 2000);
    }

    startCaptionExtraction() {
        this.log('Starting caption extraction...');

        // Poll for captions every 500ms
        this.captionInterval = setInterval(() => {
            const caption = this.extractCaption();
            if (caption && caption !== this.lastCaption && caption.length > 3) {
                this.lastCaption = caption;
                const time = this.video.currentTime;
                this.log(`Found: "${caption.substring(0, 30)}..."`);
                this.processCaption(caption, time);
            }
        }, 500);
    }

    extractCaption() {
        // Method 1: YouTube's caption container
        const captionWindow = document.querySelector('.ytp-caption-window-container');
        if (captionWindow) {
            const segments = captionWindow.querySelectorAll('.ytp-caption-segment');
            if (segments.length > 0) {
                return Array.from(segments).map(s => s.textContent).join(' ').trim();
            }
        }

        // Method 2: Alternative selector
        const altCaption = document.querySelector('.captions-text');
        if (altCaption) {
            return altCaption.textContent.trim();
        }

        // Method 3: Any caption-like element
        const ytp = document.querySelector('[class*="caption"]');
        if (ytp && ytp.textContent) {
            return ytp.textContent.trim();
        }

        return null;
    }

    processCaption(text, time) {
        // Send to background for translation
        chrome.runtime.sendMessage({
            type: 'TRANSLATE_INSTANT',
            text: text,
            source: 'ar',
            target: 'en'
        }, (res) => {
            if (res && res.ok && res.text) {
                // Push translated text to buffer
                chrome.runtime.sendMessage({
                    type: 'BUFFER_PUSH',
                    text: res.text,
                    startTime: time
                });
                this.log(`Buffered: "${res.text.substring(0, 25)}..." @${time.toFixed(1)}s`);
            } else if (res && res.error) {
                this.log(`Error: ${res.error}`);
            } else {
                // If translation fails, still push original
                chrome.runtime.sendMessage({
                    type: 'BUFFER_PUSH',
                    text: text,
                    startTime: time
                });
                this.log(`Buffered (original): "${text.substring(0, 25)}..." @${time.toFixed(1)}s`);
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
