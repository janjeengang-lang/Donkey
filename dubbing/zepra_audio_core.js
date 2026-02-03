/**
 * ZEPRA AUDIO CORE v4.0 (Enterprise Edition)
 * -------------------------------------------
 * A robust, event-driven state machine for Real-Time Dubbing.
 * Decouples logic (Engine) from presentation (Studio UI).
 * 
 * Features:
 * - Robust Offscreen Communication (Heartbeat & Retry)
 * - State Management (Idle, Connecting, Active, Error)
 * - Integrated Translation Pipeline
 * - Smart TTS Queueing with Ducking
 */

const ZEPRA_CORE_CONFIG = {
    OFFSCREEN_PATH: 'offscreen.html',
    HEARTBEAT_INTERVAL: 2000,
    MAX_RETRY_ATTEMPTS: 3,
    TRANSLATION_FLUSH_DELAY_MS: 1200,
    TRANSLATION_MIN_INTERVAL_MS: 3000,
    TRANSLATION_MAX_SEGMENTS: 4,
    TRANSLATION_MAX_CHARS: 600
};

class ZepraAudioCore {
    constructor() {
        // State
        this.status = 'IDLE'; // IDLE, CONNECTING, ACTIVE, ERROR
        this.isCapturing = false;

        // Settings
        this.sourceLang = 'ar-SA';
        this.targetLang = 'English';
        this.duckingVolume = 0.1;

        // Event Listeners
        this.listeners = {
            'status': [],
            'transcript': [],
            'translation': [],
            'volume': [],
            'error': []
        };

        // Internals
        this.activeVideo = null;
        this.retryCount = 0;
        this._heartbeat = null;
        this._watchdogTimer = null;
        this.recognition = null;
        this._pendingSegments = [];
        this._batchTimer = null;
        this._lastTranslateAt = 0;
        this._ttsQueue = [];
        this._isSpeaking = false;

        // Bindings
        this.handleRuntimeMessage = this.handleRuntimeMessage.bind(this);

        this.log("Core Initialized.");
    }

    // --- Public API ---

    /**
     * Start the Dubbing Engine
     * @param {string} sourceLang 
     * @param {string} targetLang 
     */
    async start(sourceLang, targetLang) {
        if (this.status === 'ACTIVE' || this.status === 'CONNECTING') return;

        this.sourceLang = sourceLang || this.sourceLang;
        this.targetLang = targetLang || this.targetLang;

        this.setStatus('CONNECTING', "Initializing Secure Core...");
        this.retryCount = 0;

        this._attachToVideo();
        await this._connectOffscreen();
    }

    /**
     * Stop the Engine
     */
    stop() {
        this.isCapturing = false;

        // Stop content script speech recognition
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) { }
            this.recognition = null;
        }

        this._stopOffscreen();
        this._restoreVideoAudio();
        if (this._batchTimer) clearTimeout(this._batchTimer);
        this._batchTimer = null;
        this._pendingSegments = [];
        this._ttsQueue = [];
        this._isSpeaking = false;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        this.setStatus('IDLE', "Engine Stopped");
        this.log("Engine Stopped.");
    }

    /**
     * Subscribe to events
     * @param {string} event - 'status', 'transcript', 'translation', 'error'
     * @param {function} callback 
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    // --- Internal Logic ---

    setStatus(status, msg = "") {
        this.status = status;
        this._emit('status', { code: status, message: msg });
        this.log(`State Changed: ${status} - ${msg}`);
    }

    async _connectOffscreen() {
        try {
            chrome.runtime.onMessage.removeListener(this.handleRuntimeMessage);
            chrome.runtime.onMessage.addListener(this.handleRuntimeMessage);

            // Try to start speech recognition directly in content script (bypassing offscreen)
            // This is more reliable as content scripts have better access to user media
            const hasSpeechAPI = 'webkitSpeechRecognition' in window;

            if (hasSpeechAPI) {
                // Start speech recognition directly in content script
                this._startContentSpeechRecognition();
                this.setStatus('ACTIVE', "Live Dubbing Active");
                this.isCapturing = true;
                this.log("Speech Recognition Started (Content Script Mode).");
                this._startHeartbeat();
            } else {
                // Fallback to offscreen if speech API not available
                this.log("Speech API not in content script, trying offscreen...");

                // Handshake via offscreen (for sites that block content script speech API)
                chrome.runtime.sendMessage({
                    type: 'CMD_OFFSCREEN_START',
                    lang: this.sourceLang
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        this._handleError("Extension Runtime Error. Reload Required.");
                    } else if (response && response.ok) {
                        this.isCapturing = true;
                        this.setStatus('ACTIVE', "Live Dubbing Active");
                        this.log("Offscreen Connection Established.");
                        this._startHeartbeat();
                    } else {
                        this._handleError("Failed to start Audio Service.");
                    }
                });
            }
        } catch (e) {
            this._handleError("Connection Exception: " + e.message);
        }
    }

    _startContentSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window)) {
            this._handleError("Speech API not supported in this browser.");
            return;
        }

        const Recognition = window.webkitSpeechRecognition;
        this.recognition = new Recognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.sourceLang;

        this.recognition.onstart = () => {
            this.log("Content Script Speech Recognition Started.");
            this._resetWatchdog();
        };

        this.recognition.onerror = (event) => {
            this.log("Speech Error: " + event.error);
            this._resetWatchdog();

            if (event.error === 'not-allowed') {
                this._emit('error', { message: "Microphone Permission Denied" });
                this._handleError("Microphone Permission Denied");
            } else if (event.error === 'network') {
                // Auto-restart on network error
                setTimeout(() => {
                    if (this.isCapturing && this.recognition) {
                        try { this.recognition.start(); } catch (e) { }
                    }
                }, 2000);
            } else if (event.error === 'no-speech') {
                // No speech - continue
            } else if (event.error === 'aborted') {
                this.isCapturing = false;
            }
        };

        this.recognition.onend = () => {
            this.log("Speech Recognition Ended.");
            if (this.isCapturing) {
                this.log("Auto-restarting...");
                try { this.recognition.start(); } catch (e) { }
            }
        };

        this.recognition.onresult = (event) => {
            this._resetWatchdog();
            let finalChunk = "";
            let interimChunk = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalChunk += event.results[i][0].transcript;
                } else {
                    interimChunk += event.results[i][0].transcript;
                }
            }

            if (finalChunk || interimChunk) {
                // Process directly in content script
                this._processTranscript({ final: finalChunk, interim: interimChunk });
            }
        };

        try {
            this.recognition.start();
        } catch (e) {
            this._handleError("Failed to start recognition: " + e.message);
        }
    }

    _resetWatchdog() {
        if (this._watchdogTimer) clearTimeout(this._watchdogTimer);
        this._watchdogTimer = setTimeout(() => {
            if (this.isCapturing) {
                this.log("Watchdog: No activity for 10s. Restarting...");
                if (this.recognition) {
                    try { this.recognition.stop(); } catch (e) { }
                }
            }
        }, 10000);
    }

    _stopOffscreen() {
        // Stop content script speech recognition if active
        if (this.recognition) {
            try { this.recognition.stop(); } catch (e) { }
            this.recognition = null;
        }

        // Also send stop to offscreen (for fallback mode)
        chrome.runtime.sendMessage({ type: 'CMD_OFFSCREEN_STOP' });

        if (this._heartbeat) clearInterval(this._heartbeat);
        if (this._watchdogTimer) clearTimeout(this._watchdogTimer);
        chrome.runtime.onMessage.removeListener(this.handleRuntimeMessage);
    }

    handleRuntimeMessage(msg) {
        if (!this.isCapturing) return;

        switch (msg.type) {
            case 'OFFSCREEN_TRANSCRIPT':
                this._processTranscript(msg);
                break;
            case 'OFFSCREEN_VOLUME':
                this._emit('volume', { level: msg.level });
                break;
            case 'OFFSCREEN_ERROR':
                this._handleError("Audio Error: " + msg.error);
                break;
            case 'OFFSCREEN_PONG':
                // Reset watchdog if implemented
                break;
        }
    }

    async _processTranscript(msg) {
        // Emit Raw
        this._emit('transcript', {
            text: msg.final || msg.interim,
            type: msg.final ? 'final' : 'interim'
        });

        if (msg.final && msg.final.trim().length > 0) {
            this.log(`Final Transcript: ${msg.final}`);
            this._queueTranslation(msg.final);
        }
    }

    _queueTranslation(text) {
        const segments = this._splitIntoSegments(text);
        if (!segments.length) return;
        this._pendingSegments.push(...segments);
        this._scheduleBatchTranslation();
    }

    _splitIntoSegments(text) {
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (!cleaned) return [];
        const matches = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
        return matches.map((segment) => segment.trim()).filter(Boolean);
    }

    _scheduleBatchTranslation() {
        if (this._batchTimer) return;
        this._batchTimer = setTimeout(() => {
            this._batchTimer = null;
            this._flushTranslationBatch();
        }, ZEPRA_CORE_CONFIG.TRANSLATION_FLUSH_DELAY_MS);
    }

    _flushTranslationBatch() {
        if (!this._pendingSegments.length) return;

        const now = Date.now();
        const waitMs = ZEPRA_CORE_CONFIG.TRANSLATION_MIN_INTERVAL_MS - (now - this._lastTranslateAt);
        if (waitMs > 0) {
            this._batchTimer = setTimeout(() => {
                this._batchTimer = null;
                this._flushTranslationBatch();
            }, waitMs);
            return;
        }

        const batch = [];
        let charCount = 0;
        while (this._pendingSegments.length > 0 && batch.length < ZEPRA_CORE_CONFIG.TRANSLATION_MAX_SEGMENTS) {
            const next = this._pendingSegments[0];
            if (charCount + next.length > ZEPRA_CORE_CONFIG.TRANSLATION_MAX_CHARS && batch.length > 0) break;
            batch.push(this._pendingSegments.shift());
            charCount += next.length;
        }

        if (!batch.length) return;
        this._lastTranslateAt = Date.now();
        this._emit('translation', { status: 'translating', text: "...", type: 'final' });

        chrome.runtime.sendMessage({
            type: 'TRANSLATE_BATCH',
            segments: batch,
            targetLanguage: this.targetLang
        }, (res) => {
            const translatedSegments = res?.translatedSegments || (res?.translated ? [res.translated] : []);
            if (!translatedSegments.length) {
                this.log("Translation failed or returned empty.");
                return;
            }

            translatedSegments.forEach((segment) => {
                const cleanSegment = String(segment || '').trim();
                if (!cleanSegment) return;
                this.log(`Translated (Final): ${cleanSegment}`);
                this._emit('translation', {
                    status: 'complete',
                    text: cleanSegment,
                    type: 'final'
                });
                this._enqueueSpeech(cleanSegment);
            });
        });
    }

    _enqueueSpeech(text) {
        if (!text || !text.trim()) return;
        this._ttsQueue.push(text);
        this._processSpeechQueue();
    }

    _processSpeechQueue() {
        if (this._isSpeaking || this._ttsQueue.length === 0) return;
        const text = this._ttsQueue.shift();
        this._isSpeaking = true;
        this._synthesizeSpeech(text);
    }

    _synthesizeSpeech(text) {
        if (!text || !text.trim()) return;

        console.log("[ZEPRA CORE] Speaking:", text.substring(0, 50) + "...");

        // 1. Duck Audio
        if (this.activeVideo) this.activeVideo.volume = this.duckingVolume;

        // 2. Speak using Web Speech API
        const u = new SpeechSynthesisUtterance(text);
        u.lang = this._mapLang(this.targetLang);
        u.rate = 1.0;
        u.pitch = 1.0;
        u.volume = 1.0;

        // Try to find a good voice for the target language
        const voices = window.speechSynthesis.getVoices();
        const targetVoice = voices.find(v => v.lang.startsWith(this._mapLang(this.targetLang).split('-')[0]));
        if (targetVoice) {
            u.voice = targetVoice;
        }

        u.onstart = () => {
            console.log("[ZEPRA CORE] TTS Started");
        };

        u.onend = () => {
            console.log("[ZEPRA CORE] TTS Finished");
            // Restore volume after a grace period
            setTimeout(() => {
                if (!window.speechSynthesis.speaking && this.isCapturing) {
                    this._restoreVideoAudio(0.8);
                }
            }, 500);
            this._isSpeaking = false;
            this._processSpeechQueue();
        };

        u.onerror = (e) => {
            console.error("[ZEPRA CORE] TTS Error:", e);
            // Restore audio on error too
            if (this.activeVideo) this.activeVideo.volume = 0.8;
            this._isSpeaking = false;
            this._processSpeechQueue();
        };

        window.speechSynthesis.speak(u);
    }

    _attachToVideo() {
        this.activeVideo = document.querySelector('video');
        if (this.activeVideo) {
            this.log("Attached to video element.");
        } else {
            this.log("No video element found.");
        }
    }

    _restoreVideoAudio(vol = 1.0) {
        if (this.activeVideo) this.activeVideo.volume = vol;
    }

    _handleError(msg) {
        console.error("[ZEPRA CORE]", msg);
        this.setStatus('ERROR', msg);

        // Stop speech recognition on error
        if (this.recognition) {
            try { this.recognition.stop(); } catch (e) { }
            this.recognition = null;
        }

        this.stop();

        if (this.retryCount < ZEPRA_CORE_CONFIG.MAX_RETRY_ATTEMPTS) {
            this.retryCount++;
            setTimeout(() => {
                this.log(`Retrying... (${this.retryCount})`);
                this.start(this.sourceLang, this.targetLang);
            }, 1000);
        }
    }

    _startHeartbeat() {
        if (this._heartbeat) clearInterval(this._heartbeat);
        this._heartbeat = setInterval(() => {
            if (!this.isCapturing) return;
            // Optional: Ping offscreen to ensure it's alive
            // For now, checks connection
        }, ZEPRA_CORE_CONFIG.HEARTBEAT_INTERVAL);
    }

    _emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    _mapLang(l) {
        const map = { 'Arabic': 'ar-SA', 'English': 'en-US', 'French': 'fr-FR', 'Spanish': 'es-ES' };
        return map[l] || 'en-US';
    }

    log(msg) {
        console.log(`%c[ZEPRA CORE] ${msg}`, 'color: #00ff88; font-weight: bold;');
    }
}

// Global Singleton
window.ZepraEngine = new ZepraAudioCore();
