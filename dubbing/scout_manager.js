/**
 * ZEPRA SCOUT v4.0 - Ahead-of-Playback Audio Scout
 * Runs a muted mirror video to feed VB-CABLE without captions.
 */
console.log("[ZEPRA SCOUT] v4.0 Loaded for: " + window.location.href);

class ZepraScoutManager {
    constructor() {
        this.video = null;
        this.isActive = false;
        this.mainVideoStartTime = 0; // Reserved for future sync calibration

        // Listen for activation & sync messages
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.type === 'FORCE_ACTIVATE_SCOUT') {
                console.log("[SCOUT] Activation received!");
                if (!this.isActive && this.isVideoPage()) {
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
            if (!this.isActive && this.isVideoPage()) {
                if (window.innerWidth < 600 || window.innerHeight < 400) {
                    console.log("[SCOUT] Auto-activating (popup detected)");
                    this.activate();
                }
            }
        }, 2000);
    }

    isVideoPage() {
        return !!document.querySelector('video');
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
            position: fixed;
            top: 16px;
            left: 16px;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 10px 14px;
            border-radius: 12px;
            background: rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(6px);
            color: #e2e8f0;
            font-family: 'Segoe UI', system-ui, sans-serif;
            font-size: 12px;
            letter-spacing: 1px;
            text-transform: uppercase;
            pointer-events: none;
        `;
        div.innerHTML = `
            <div style="font-weight: 700; color: #00ff88;">ZEPRA ENGINE</div>
            <div id="z-scout-time" style="font-size: 14px; color: #f8fafc;">00:00</div>
            <div id="z-scout-log" style="color: rgba(226,232,240,0.7); font-size: 10px; max-width: 180px; word-wrap: break-word;">Listening...</div>
        `;
        document.body.appendChild(div);
        this.logEl = document.getElementById('z-scout-log');
        this.timeEl = document.getElementById('z-scout-time');
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

        // Keep real-time playback (no fixed lead)
        this.video.playbackRate = 1.0;

        // Keep muted
        setInterval(() => {
            if (this.video && this.isActive) {
                this.video.muted = true;
                this.video.volume = 0;
            }
        }, 500);

        // Update time display
        setInterval(() => this.updateTime(), 200);

        // Force play
        this.video.play().then(() => {
            this.log('Audio capture active...');
        }).catch(e => {
            this.log('Autoplay issue: ' + e.message);
        });

        // Keep playing
        this.video.onpause = () => {
            if (this.isActive) this.video.play();
        };

    }

    stop() {
        this.isActive = false;
    }
}

// Singleton
if (!window.ZepraScoutManagerInstance) {
    window.ZepraScoutManagerInstance = new ZepraScoutManager();
}
