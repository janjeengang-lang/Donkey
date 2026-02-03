/**
 * ZEPRA DUBBING ENGINE v4.0 - Universal Live Dubbing
 * Works on ANY video on ANY website using microphone capture
 * 
 * How it works:
 * 1. User plays video (audio comes from speakers)
 * 2. Microphone captures the audio
 * 3. Speech Recognition transcribes it
 * 4. We translate and display + TTS
 */

class ZepraDubbingEngine {
    constructor() {
        this.recognition = null;
        this.isRunning = false;
        this.targetLang = 'en';
        this.sourceLang = 'ar-SA';

        // Callbacks
        this.onTranscript = null;
        this.onTranslation = null;
        this.onError = null;
        this.onStatus = null;

        console.log("[DUBBING ENGINE] v4.0 Initialized");
    }

    setLanguages(source, target) {
        this.sourceLang = source;
        this.targetLang = target;
    }

    on(event, callback) {
        if (event === 'transcript') this.onTranscript = callback;
        if (event === 'translation') this.onTranslation = callback;
        if (event === 'error') this.onError = callback;
        if (event === 'status') this.onStatus = callback;
    }

    emit(event, data) {
        if (event === 'transcript' && this.onTranscript) this.onTranscript(data);
        if (event === 'translation' && this.onTranslation) this.onTranslation(data);
        if (event === 'error' && this.onError) this.onError(data);
        if (event === 'status' && this.onStatus) this.onStatus(data);
    }

    async start() {
        if (this.isRunning) return;

        if (!('webkitSpeechRecognition' in window)) {
            this.emit('error', { message: 'Speech Recognition not supported' });
            return;
        }

        this.isRunning = true;
        this.emit('status', { code: 'CONNECTING', message: 'Starting microphone...' });

        try {
            // Request microphone permission
            await navigator.mediaDevices.getUserMedia({ audio: true });

            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = this.sourceLang;

            this.recognition.onstart = () => {
                console.log("[ENGINE] Speech recognition started");
                this.emit('status', { code: 'ACTIVE', message: '● Listening...' });
            };

            this.recognition.onresult = (event) => {
                const result = event.results[event.results.length - 1];
                const text = result[0].transcript.trim();

                if (result.isFinal) {
                    console.log("[ENGINE] Final:", text);
                    this.emit('transcript', { text, type: 'final' });
                    if (text.length > 2) {
                        this.translate(text);
                    }
                } else {
                    this.emit('transcript', { text, type: 'interim' });
                }
            };

            this.recognition.onerror = (e) => {
                console.log("[ENGINE] Error:", e.error);
                if (e.error === 'no-speech') {
                    // Ignore, will restart
                } else if (e.error === 'not-allowed') {
                    this.emit('error', { message: 'Microphone access denied' });
                    this.isRunning = false;
                }
            };

            this.recognition.onend = () => {
                if (this.isRunning) {
                    // Auto-restart
                    try {
                        this.recognition.start();
                    } catch (e) { }
                }
            };

            this.recognition.start();

        } catch (e) {
            this.emit('error', { message: 'Microphone access failed: ' + e.message });
            this.isRunning = false;
        }
    }

    stop() {
        this.isRunning = false;
        if (this.recognition) {
            this.recognition.stop();
            this.recognition = null;
        }
        this.emit('status', { code: 'IDLE', message: 'Stopped' });
    }

    translate(text) {
        this.emit('translation', { text: 'Translating...', status: 'translating', type: 'interim' });

        chrome.runtime.sendMessage({
            type: 'TRANSLATE_INSTANT',
            text: text,
            source: this.sourceLang.split('-')[0],
            target: this.targetLang
        }, (res) => {
            if (chrome.runtime.lastError) {
                this.emit('translation', { text: 'Translation failed', status: 'error', type: 'final' });
                return;
            }

            if (res && res.ok && res.text) {
                console.log("[ENGINE] Translated:", res.text);
                this.emit('translation', { text: res.text, status: 'complete', type: 'final' });
                this.speak(res.text);
            } else if (res && res.error) {
                this.emit('translation', { text: 'Error: ' + res.error, status: 'error', type: 'final' });
            }
        });
    }

    speak(text) {
        if (!text) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.targetLang === 'ar' ? 'ar-SA' :
            this.targetLang === 'fr' ? 'fr-FR' : 'en-US';
        utterance.rate = 1.1;

        window.speechSynthesis.speak(utterance);
    }
}

// Create global instance
if (!window.ZepraDubbingEngine) {
    window.ZepraDubbingEngine = new ZepraDubbingEngine();
}

// Also expose as ZepraEngine for backward compatibility
window.ZepraEngine = window.ZepraDubbingEngine;
