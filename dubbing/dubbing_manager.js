/*
    ZEPRA DUBBING ENGINE v3.0 (Hybrid Offscreen)
    - Uses Offscreen Document for Audio Capture (Bypasses YouTube Policy)
    - Content Script handles UI & Playback
*/

const ENGINE_CONFIG = {
    MAX_OVERLAY_WORDS: 20,
    DUCKING_VOLUME: 0.15,
};

class SubtitleDeck {
    constructor() {
        this.overlay = null;
        this.timer = null;
    }

    init(studioOverlay) {
        this.overlay = studioOverlay;
    }

    update(text, type = 'interim') {
        if (!this.overlay) return;
        // Truncate for visual sanity
        let content = text;
        if (type === 'interim' && content.length > 100) content = "..." + content.slice(-100);

        this.overlay.update(content, type === 'interim');

        if (this.timer) clearTimeout(this.timer);
        if (type === 'final') {
            this.timer = setTimeout(() => this.overlay.update(""), 6000);
        }
    }
}

class TranslationAgent {
    constructor(callback) {
        this.callback = callback;
    }

    translate(text, targetLang) {
        chrome.runtime.sendMessage({
            type: 'TRANSLATE_BATCH',
            text: text,
            targetLanguage: targetLang
        }, (response) => {
            if (response && response.translated) {
                this.callback(response.translated);
            }
        });
    }
}

class ZepraDubbingManager {
    constructor() {
        this.studio = window.zepraDubStudio;
        this.deck = new SubtitleDeck();
        this.agent = new TranslationAgent(this.onTranslationReceived.bind(this));

        this.activeVideo = null;
        this.isCapturing = false;

        this.init();
    }

    init() {
        if (!window.zepraDubStudio) {
            setTimeout(() => this.init(), 100);
            return;
        }
        this.studio = window.zepraDubStudio;
        this.deck.init(this.studio.overlay);

        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    }

    startCapture() {
        this.activeVideo = this.studio.activeVideo || document.querySelector('video');
        if (!this.activeVideo && this.studio.scanForVideos) {
            this.studio.scanForVideos();
            this.activeVideo = document.querySelector('video');
        }

        const sourceLang = this.studio.sourceLanguage || 'ar-SA';
        this.deck.update("Connecting to Secure Audio...", 'interim');

        // Command Offscreen to Start
        chrome.runtime.sendMessage({
            type: 'CMD_OFFSCREEN_START',
            lang: sourceLang
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Runtime Error:", chrome.runtime.lastError);
                this.deck.update("⚠ Extension Error: Reload Page", 'final');
            } else if (response && response.ok) {
                this.isCapturing = true;
                this.studio.setPlayingState();
                this.deck.update("● Listening (Secure Mode)", 'interim');
                if (this.activeVideo) this.activeVideo.volume = 1.0;
            } else {
                this.deck.update("⚠ Failed to Start Audio Engine", 'final');
            }
        });
    }

    stopCapture() {
        this.isCapturing = false;
        chrome.runtime.sendMessage({ type: 'CMD_OFFSCREEN_STOP' });
        this.deck.update("Stopped", 'final');
        if (this.activeVideo) this.activeVideo.volume = 1.0;
    }

    handleMessage(msg) {
        if (msg.type === 'OFFSCREEN_TRANSCRIPT') {
            // Received Text from Offscreen
            if (msg.interim) {
                this.deck.update(msg.interim, 'interim');
            }
            if (msg.final) {
                console.log("[Original]", msg.final);
                this.deck.update("Translating...", 'interim');
                this.agent.translate(msg.final, this.studio.targetLanguage);
            }
        }
        else if (msg.type === 'OFFSCREEN_ERROR') {
            this.deck.update("⚠ Audio Error: " + msg.error, 'final');
        }
        else if (msg.type === 'SHOW_DUBBING_STUDIO') {
            this.studio.init();
        }
    }

    onTranslationReceived(text) {
        this.deck.update(text, 'final');
        this.speak(text);
    }

    speak(text) {
        if (!text) return;

        // News Caster Ducking
        if (this.activeVideo) {
            this.activeVideo.volume = ENGINE_CONFIG.DUCKING_VOLUME;
        }

        const u = new SpeechSynthesisUtterance(text);
        u.lang = this.mapLang(this.studio.targetLanguage);
        u.rate = 1.0;

        u.onend = () => {
            if (this.activeVideo) this.activeVideo.volume = 0.8;
        };

        window.speechSynthesis.speak(u);
    }

    mapLang(l) {
        if (l === 'Arabic') return 'ar-SA';
        if (l === 'French') return 'fr-FR';
        return 'en-US';
    }
}

if (!window.zepraDubManager) {
    window.zepraDubManager = new ZepraDubbingManager();
}
