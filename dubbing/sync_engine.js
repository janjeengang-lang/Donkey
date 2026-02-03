/**
 * ZEPRA TIME MACHINE - SYNC ENGINE v4.0
 * Professional subtitle synchronization with timestamp-based queue
 */

class ZepraSyncEngine {
    constructor() {
        // Queue of translations with timestamps
        this.queue = [];
        this.spokenSet = new Set(); // Track what we've already spoken
        this.displayedSet = new Set(); // Track what we've already displayed

        // Timing config
        this.LEAD_TIME = 12; // Scout is 12 seconds ahead
        this.TOLERANCE = 2; // Show subtitle within ±2 seconds of target

        console.log("[SYNC ENGINE] Initialized");
    }

    /**
     * Add a translation to the queue
     * @param {string} text - Translated text
     * @param {number} videoTime - The video timestamp when this should appear
     */
    push(text, videoTime) {
        const id = `${videoTime.toFixed(1)}-${text.substring(0, 10)}`;

        // Avoid duplicates
        if (this.queue.some(q => q.id === id)) {
            console.log("[SYNC] Duplicate ignored:", id);
            return;
        }

        this.queue.push({
            id: id,
            text: text,
            displayAt: videoTime,
            createdAt: Date.now()
        });

        // Sort by display time
        this.queue.sort((a, b) => a.displayAt - b.displayAt);

        console.log(`[SYNC] Queued at ${videoTime.toFixed(1)}s: "${text.substring(0, 30)}..."`);
        console.log(`[SYNC] Queue size: ${this.queue.length}`);
    }

    /**
     * Get items ready to display at the given video time
     * @param {number} currentTime - Current video playback time
     * @returns {Array} Items to display now
     */
    pull(currentTime) {
        const ready = [];

        for (const item of this.queue) {
            // Check if it's time to show this item (within tolerance window)
            const timeDiff = currentTime - item.displayAt;

            // Show if we're within the display window
            if (timeDiff >= -0.5 && timeDiff <= this.TOLERANCE) {
                // Haven't displayed this yet?
                if (!this.displayedSet.has(item.id)) {
                    ready.push({
                        ...item,
                        needsSpeak: !this.spokenSet.has(item.id)
                    });
                    this.displayedSet.add(item.id);
                }
            }
        }

        return ready;
    }

    /**
     * Mark an item as spoken (to avoid repeating TTS)
     */
    markSpoken(id) {
        this.spokenSet.add(id);
    }

    /**
     * Clear old items from the queue
     */
    cleanup(currentTime) {
        // Remove items that are too old (more than 10s behind current time)
        this.queue = this.queue.filter(item => {
            return item.displayAt > currentTime - 10;
        });
    }

    /**
     * Get queue stats for debugging
     */
    getStats() {
        return {
            queueSize: this.queue.length,
            displayedCount: this.displayedSet.size,
            spokenCount: this.spokenSet.size,
            nextItem: this.queue[0] || null
        };
    }

    /**
     * Reset the engine
     */
    reset() {
        this.queue = [];
        this.spokenSet.clear();
        this.displayedSet.clear();
        console.log("[SYNC] Engine reset");
    }
}

// Export for use
window.ZepraSyncEngine = ZepraSyncEngine;
