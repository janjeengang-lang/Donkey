/*
    Zepra Dub Bridge
    - Links Scout (audio capture) with Main window (subtitle + dubbing)
    - Handles timed subtitle delivery based on video timestamps
*/

const ZEPRA_BRIDGE_CONFIG = {
    PULL_INTERVAL_MS: 350,
    DISPLAY_TOLERANCE_S: 0.6,
    MIN_DISPLAY_MS: 1400,
    MAX_DISPLAY_MS: 6500,
    WORDS_PER_SECOND: 2.8
};

class ZepraDubBridge {
    constructor() {
        this.isScout = this._detectScout();
        this.activeVideo = null;
        this.overlay = null;
        this._pullTimer = null;
        this._clearTimer = null;
        this._ttsQueue = [];
        this._isSpeaking = false;
        this._boundTranslation = null;
        this._boundScoutStart = null;

        if (this.isScout) {
            this._awaitScoutStart();
        }
    }

    _detectScout() {
        const params = new URLSearchParams(window.location.search);
        return params.get('zepra_scout') === '1';
    }

    startSession({ sourceLang, targetLang } = {}) {
        this.activeVideo = document.querySelector('video');
        this.overlay = window.zepraDubStudio?.overlay || null;

        if (this.isScout) return;

        this._startMainLoop(sourceLang, targetLang);
    }

    stopSession() {
        if (this.isScout) {
            if (this._boundTranslation && window.ZepraEngine) {
                window.ZepraEngine.listeners?.translation?.splice(
                    window.ZepraEngine.listeners.translation.indexOf(this._boundTranslation),
                    1
                );
            }
            if (this._boundScoutStart) {
                chrome.runtime.onMessage.removeListener(this._boundScoutStart);
            }
            if (window.ZepraEngine?.stop) window.ZepraEngine.stop();
            return;
        }

        if (this._pullTimer) clearInterval(this._pullTimer);
        if (this._clearTimer) clearTimeout(this._clearTimer);
        this._pullTimer = null;
        this._clearTimer = null;
        this._ttsQueue = [];
        this._isSpeaking = false;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        chrome.runtime.sendMessage({ type: 'DUB_SESSION_STOP' });
    }

    _awaitScoutStart(defaultSource, defaultTarget) {
        if (this._boundScoutStart) return;
        this._boundScoutStart = (msg) => {
            if (msg.type !== 'DUB_SCOUT_START') return;
            this.activeVideo = document.querySelector('video');
            this._startScoutEngine(msg.sourceLang || defaultSource, msg.targetLang || defaultTarget);
        };
        chrome.runtime.onMessage.addListener(this._boundScoutStart);
    }

    _startScoutEngine(sourceLang, targetLang) {
        if (!window.ZepraEngine) return;
        const engine = window.ZepraEngine;
        if (this._boundTranslation) {
            return;
        }
        this._boundTranslation = (data) => {
            if (!data || data.status !== 'complete' || data.type !== 'final') return;
            const text = String(data.text || '').trim();
            if (!text) return;
            const scoutTime = this.activeVideo?.currentTime || 0;
            chrome.runtime.sendMessage({
                type: 'DUB_SCOUT_TRANSLATION',
                text,
                scoutTime
            });
        };

        engine.on('translation', this._boundTranslation);
        engine.start(sourceLang || 'ar-SA', targetLang || 'English');

        const scoutTime = this.activeVideo?.currentTime || 0;
        chrome.runtime.sendMessage({ type: 'DUB_SCOUT_READY', scoutTime });
    }

    _startMainLoop(sourceLang, targetLang) {
        if (!this.activeVideo) return;
        chrome.runtime.sendMessage({
            type: 'DUB_SESSION_START',
            sourceLang: sourceLang || 'ar-SA',
            targetLang: targetLang || 'English',
            mainTime: this.activeVideo.currentTime || 0
        });

        if (this._pullTimer) clearInterval(this._pullTimer);
        this._pullTimer = setInterval(() => {
            if (!this.activeVideo) return;
            const currentTime = this.activeVideo.currentTime || 0;
            chrome.runtime.sendMessage({
                type: 'DUB_PULL_READY',
                currentTime,
                tolerance: ZEPRA_BRIDGE_CONFIG.DISPLAY_TOLERANCE_S
            }, (res) => {
                if (!res || !res.items || res.items.length === 0) return;
                res.items.forEach((item) => this._showSubtitle(item.text));
            });
        }, ZEPRA_BRIDGE_CONFIG.PULL_INTERVAL_MS);
    }

    _showSubtitle(text) {
        if (!text || !this.overlay) return;
        this.overlay.show();
        this.overlay.update(text, false);

        if (this._clearTimer) clearTimeout(this._clearTimer);
        const duration = this._estimateDuration(text);
        this._clearTimer = setTimeout(() => {
            this.overlay.update('', false);
        }, duration);

        this._enqueueSpeech(text);
    }

    _estimateDuration(text) {
        const words = text.split(/\s+/).filter(Boolean).length;
        const base = (words / ZEPRA_BRIDGE_CONFIG.WORDS_PER_SECOND) * 1000;
        return Math.max(ZEPRA_BRIDGE_CONFIG.MIN_DISPLAY_MS, Math.min(ZEPRA_BRIDGE_CONFIG.MAX_DISPLAY_MS, base));
    }

    _enqueueSpeech(text) {
        this._ttsQueue.push(text);
        this._processSpeechQueue();
    }

    _processSpeechQueue() {
        if (this._isSpeaking || this._ttsQueue.length === 0) return;
        const text = this._ttsQueue.shift();
        this._isSpeaking = true;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.onend = () => {
            this._isSpeaking = false;
            this._processSpeechQueue();
        };
        utterance.onerror = () => {
            this._isSpeaking = false;
            this._processSpeechQueue();
        };
        window.speechSynthesis.speak(utterance);
    }
}

if (!window.ZepraDubBridge) {
    window.ZepraDubBridge = new ZepraDubBridge();
}
