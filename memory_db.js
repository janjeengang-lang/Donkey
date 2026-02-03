// =========================================
// ZEPRA SMART MEMORY (IndexedDB Wrapper)
// =========================================

const MEMORY_DB_NAME = 'ZepraMemory';
const MEMORY_DB_VERSION = 1;
const MEMORY_STORE_NAME = 'conversations';

const ZepraMemory = {
    db: null,

    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(MEMORY_DB_NAME, MEMORY_DB_VERSION);

            request.onerror = (event) => {
                console.error("ZepraMemory: Database error", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("ZepraMemory: Database initialized");
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Create object store for conversations
                // keyPath is 'id' (UUID)
                if (!db.objectStoreNames.contains(MEMORY_STORE_NAME)) {
                    const objectStore = db.createObjectStore(MEMORY_STORE_NAME, { keyPath: 'id' });
                    // Indexes for searching and sorting
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    objectStore.createIndex('title', 'title', { unique: false });
                    objectStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
                }
            };
        });
    },

    async saveConversation(conversation) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([MEMORY_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(MEMORY_STORE_NAME);

            // Generate ID if missing
            if (!conversation.id) {
                conversation.id = crypto.randomUUID();
            }
            // Update timestamp if missing
            if (!conversation.timestamp) {
                conversation.timestamp = Date.now();
            }

            const request = store.put(conversation);

            request.onsuccess = () => resolve(conversation.id);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async getConversation(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([MEMORY_STORE_NAME], 'readonly');
            const store = transaction.objectStore(MEMORY_STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async getAllConversations(limit = 20, offset = 0) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([MEMORY_STORE_NAME], 'readonly');
            const store = transaction.objectStore(MEMORY_STORE_NAME);
            const index = store.index('timestamp');

            // Get in reverse chronological order (newest first)
            const request = index.openCursor(null, 'prev');
            const results = [];
            let hasSkipped = false;
            let count = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) {
                    resolve(results);
                    return;
                }

                if (offset > 0 && !hasSkipped) {
                    hasSkipped = true;
                    cursor.advance(offset);
                    return;
                }

                results.push(cursor.value);
                count++;

                if (count < limit) {
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = (e) => reject(e.target.error);
        });
    },

    async searchConversations(query) {
        await this.init();
        // Simple search implementation (client-side filtering for now)
        // For production, we might want a full-text search index like FlexSearch
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([MEMORY_STORE_NAME], 'readonly');
            const store = transaction.objectStore(MEMORY_STORE_NAME);
            const request = store.openCursor();
            const results = [];
            const lowerQuery = query.toLowerCase();

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) {
                    resolve(results);
                    return;
                }

                const conv = cursor.value;
                // Check title
                let match = conv.title && conv.title.toLowerCase().includes(lowerQuery);

                // Check messages if title didn't match
                if (!match && conv.messages) {
                    match = conv.messages.some(msg =>
                        msg.text && msg.text.toLowerCase().includes(lowerQuery)
                    );
                }

                if (match) {
                    results.push(conv);
                }

                // Limit results to 50 for performance
                if (results.length < 50) {
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async deleteConversation(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([MEMORY_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(MEMORY_STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
};

// Expose globally for background.js
self.ZepraMemory = ZepraMemory;
