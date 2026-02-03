/*
    ZEPRA AUDIO WORKER (Offscreen)
    ------------------------------
    Responsible for:
    1. access Microphone (Navigator UserMedia).
    2. Continuous Speech Recognition (webkitSpeechRecognition).
    3. Sending raw transcripts to Core.
*/

console.log("[ZEPRA OFFSCREEN] Loaded.");

let recognition = null;
let isCapturing = false;
let targetLang = 'ar-SA';
let watchdogTimer = null;

// --- Message Handler ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'CMD_OFFSCREEN_START') {
        startCapture(msg.lang || 'ar-SA');
        sendResponse({ ok: true });
        return true;
    }
    else if (msg.type === 'CMD_OFFSCREEN_STOP') {
        stopCapture();
        sendResponse({ ok: true });
        return true;
    }
    else if (msg.type === 'CMD_OFFSCREEN_PING') {
        sendResponse({ type: 'OFFSCREEN_PONG', active: isCapturing });
    }
});

// --- Core Logic ---

// --- Audio Analysis State ---
let audioContext = null;
let scriptProcessor = null;
let mediaStreamSource = null;

async function startCapture(lang) {
    if (isCapturing && recognition) return;

    console.log(`[ZEPRA OFFSCREEN] Starting Capture in ${lang}`);
    targetLang = lang;
    isCapturing = true;

    try {
        if (!('webkitSpeechRecognition' in window)) {
            throw new Error("Speech API not supported in this browser version.");
        }

        // 1. Start Speech Recognition
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = targetLang;

        recognition.onstart = () => {
            console.log("[ZEPRA OFFSCREEN] Recognition Service Started.");
            resetWatchdog();
        };

        recognition.onerror = (event) => {
            console.error("[ZEPRA OFFSCREEN] Speech Error:", event.error);
            resetWatchdog();

            if (event.error === 'not-allowed') {
                notifyError("Microphone Permission Denied - Please allow microphone access");
                stopCapture();
            } else if (event.error === 'network') {
                notifyError("Network Error - Speech API unreachable");
                // Auto-restart on network error
                setTimeout(() => {
                    if (isCapturing && recognition) {
                        try { recognition.start(); } catch (e) { }
                    }
                }, 2000);
            } else if (event.error === 'no-speech') {
                // No speech detected - this is normal, just continue
                console.log("[ZEPRA OFFSCREEN] No speech detected, continuing...");
            } else if (event.error === 'aborted') {
                // Recognition aborted - likely page navigation, just stop
                console.log("[ZEPRA OFFSCREEN] Recognition aborted");
                isCapturing = false;
            } else {
                notifyError("Speech Error: " + event.error);
            }
        };

        recognition.onend = () => { /* ... existing restart handler ... */
            console.log("[ZEPRA OFFSCREEN] Recognition Ended.");
            if (isCapturing) {
                console.log("[ZEPRA OFFSCREEN] Auto-restarting...");
                try { recognition.start(); } catch (e) { }
            }
        };

        recognition.onresult = (event) => { /* ... existing result handler ... */
            resetWatchdog();
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
                chrome.runtime.sendMessage({ type: 'OFFSCREEN_TRANSCRIPT', final: finalChunk, interim: interimChunk });
            }
        };

        recognition.start();

        // 2. Start Audio Analysis (VU Meter)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setupAudioAnalysis(stream);
            console.log("[ZEPRA OFFSCREEN] Microphone access granted");
        } catch (err) {
            console.warn("[ZEPRA OFFSCREEN] Microphone access denied or failed:", err);
            // Don't notify error here - speech recognition still works without audio analysis
            // The speech API handles its own microphone access
        }

    } catch (e) {
        console.error("[ZEPRA OFFSCREEN] Critical:", e);
        notifyError(e.message);
        isCapturing = false;
    }
}

function setupAudioAnalysis(stream) {
    if (audioContext) audioContext.close();

    audioContext = new AudioContext();
    mediaStreamSource = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    mediaStreamSource.connect(analyser); // Just to analyser, not destination (avoid feedback)

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Throttle volume updates (10fps is enough)
    const updateVolume = () => {
        if (!isCapturing) return;
        analyser.getByteFrequencyData(dataArray);

        // Calculate Average Volume
        let values = 0;
        for (let i = 0; i < dataArray.length; i++) values += dataArray[i];
        const average = values / dataArray.length;

        // Send normalized volume (0-100)
        if (average > 5) { // Noise gate
            chrome.runtime.sendMessage({
                type: 'OFFSCREEN_VOLUME',
                level: Math.round(average)
            });
        }

        if (isCapturing) setTimeout(updateVolume, 100);
    };
    updateVolume();
}

function stopCapture() {
    isCapturing = false;
    if (recognition) {
        try { recognition.stop(); } catch (e) { }
        recognition = null;
    }
    if (audioContext) { try { audioContext.close(); } catch (e) { } audioContext = null; }
    if (watchdogTimer) clearTimeout(watchdogTimer);
    console.log("[ZEPRA OFFSCREEN] Stopped.");
}

function notifyError(msg) {
    chrome.runtime.sendMessage({
        type: 'OFFSCREEN_ERROR',
        error: msg
    });
}

function resetWatchdog() {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    // If no result for 10 seconds, maybe dead?
    watchdogTimer = setTimeout(() => {
        if (isCapturing) {
            console.warn("[ZEPRA OFFSCREEN] Watchdog: No audio for 10s. Restarting...");
            if (recognition) try { recognition.stop(); } catch (e) { } // Will trigger onend -> auto-restart
        }
    }, 10000);
}

// Keep connection alive hack (optional, mostly handled by runtime port in complex apps, here simplified)
setInterval(() => {
    if (isCapturing) console.debug("[ZEPRA OFFSCREEN] Heartbeat");
}, 5000);
