import { pipeline, env } from './transformers.min.js';

// Configuration
env.allowLocalModels = false; // Allow loading weights from HuggingFace
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = {
    'ort-wasm.wasm': 'dubbing/ort-wasm.wasm',
    'ort-wasm-simd.wasm': 'dubbing/ort-wasm-simd.wasm',
    'ort-wasm-threaded.wasm': 'dubbing/ort-wasm-threaded.wasm'
};
env.backends.onnx.wasm.numThreads = 1; // Disable multi-threading to avoid Worker blob issues

class ZepraAudioProcessor {
    constructor() {
        this.transcriber = null;
        this.modelId = 'Xenova/whisper-tiny';
        this.isReady = false;
        this.audioContext = null;
        this.processor = null;
        this.stream = null;

        // chunking
        this.audioChunks = [];
        this.isProcessing = false;
        this.recordingLength = 0;
        this.MAX_CHUNK_DURATION = 4000; // 4 seconds (Rolling buffer)
    }

    async loadModel(callback) {
        if (this.isReady) return;
        try {
            console.log("Loading Whisper Model...");
            if (callback) callback('LOADING', 10);

            // Allocate pipeline
            this.transcriber = await pipeline('automatic-speech-recognition', this.modelId, {
                progress_callback: (d) => {
                    if (callback && d.status === 'progress') {
                        callback('LOADING', Math.round(d.progress));
                    }
                }
            });

            this.isReady = true;
            console.log("Whisper Model Loaded!");
            if (callback) callback('READY', 100);
        } catch (e) {
            console.error("Model Load Error:", e);
            if (callback) callback('ERROR', 0);
        }
    }

    async startProcessing(streamId, language, onResultCallback) {
        if (!this.isReady) throw new Error("Model not ready");

        // 1. Get Stream
        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            }
        });

        // 2. Playback Context (High Quality for User)
        this.playContext = new AudioContext();
        const playSource = this.playContext.createMediaStreamSource(this.stream);
        playSource.connect(this.playContext.destination);

        // 3. Capture Context (16kHz for Whisper)
        this.captureContext = new AudioContext({ sampleRate: 16000 });
        const captureSource = this.captureContext.createMediaStreamSource(this.stream);

        this.processor = this.captureContext.createScriptProcessor(4096, 1, 1);
        captureSource.connect(this.processor);
        this.processor.connect(this.captureContext.destination); // Keep graph alive

        this.processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            this.handleAudioChunk(inputData, onResultCallback, language);
        };
    }

    handleAudioChunk(data, callback, lang) {
        // Simple accumulation strategy
        const newChunk = new Float32Array(data);
        this.audioChunks.push(newChunk);
        this.recordingLength += data.length; // samples

        // Process every ~4 seconds of audio (16k * 4 = 64k samples)
        if (this.recordingLength >= 16000 * 4) {
            this.runInference(callback, lang);
        }
    }

    async runInference(callback, lang) {
        if (this.isProcessing) return; // Drop frame if busy (simple realtime logic)
        this.isProcessing = true;

        // Flatten chunks
        const fullBuffer = new Float32Array(this.recordingLength);
        let offset = 0;
        for (const chunk of this.audioChunks) {
            fullBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        // Reset buffer (Rolling)
        this.audioChunks = [];
        this.recordingLength = 0;

        try {
            // Run Whisper
            // Force language if specified, or auto
            const options = {
                chunk_length_s: 30,
                stride_length_s: 5,
                language: (lang && lang !== 'auto') ? lang.split('-')[0] : null,
                task: 'transcribe'
            };

            const output = await this.transcriber(fullBuffer, options);

            if (output && output.text && output.text.trim().length > 1) {
                console.log("Transcribed:", output.text);
                callback(output.text);
            }
        } catch (e) {
            console.error("Inference Error:", e);
        } finally {
            this.isProcessing = false;
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.playContext) {
            this.playContext.close();
            this.playContext = null;
        }
        if (this.captureContext) {
            this.captureContext.close();
            this.captureContext = null;
        }
        this.audioChunks = [];
        this.recordingLength = 0;
    }
}

// Export instance
window.ZepraAI = new ZepraAudioProcessor();
