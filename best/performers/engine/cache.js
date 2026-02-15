/**
 * @file IndexedDB Cache Management for performers, settings, and snippets.
 * @description Singleton CacheManager for database operations including snippet storage.
 */

const CacheManager = (() => {
    'use strict';

    let _db = null;
    const { DB_NAME, DB_VERSION, PERFORMER_STORE, SETTINGS_STORE, SNIPPETS_STORE, RECORDINGS_STORE } = AppConfig;

    /**
     * Initialize the IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    const _initDB = () => {
        return new Promise((resolve, reject) => {
            if (_db) {
                return resolve(_db);
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error('Database error:', event.target.error);
                reject('Error opening database.');
            };

            request.onsuccess = (event) => {
                _db = event.target.result;
                resolve(_db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Performers store
                if (!db.objectStoreNames.contains(PERFORMER_STORE)) {
                    db.createObjectStore(PERFORMER_STORE, { keyPath: 'username' });
                }
                
                // Settings store
                if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                    db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
                }
                
                // Snippets store
                if (!db.objectStoreNames.contains(SNIPPETS_STORE)) {
                    const snippetStore = db.createObjectStore(SNIPPETS_STORE, { keyPath: 'id', autoIncrement: true });
                    snippetStore.createIndex('text', 'text', { unique: true });
                }

                // Screen recordings store
                if (!db.objectStoreNames.contains(RECORDINGS_STORE)) {
                    const recordingStore = db.createObjectStore(RECORDINGS_STORE, { keyPath: 'id', autoIncrement: true });
                    recordingStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    };

    /**
     * Wrapper for database transactions
     * @param {string} storeName 
     * @param {IDBTransactionMode} mode 
     * @param {Function} callback 
     * @returns {Promise<any>}
     */
    const _withStore = async (storeName, mode, callback) => {
        const db = await _initDB();
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const result = callback(store);
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error);
        });
    };

    const publicInterface = {
        // ==================== Performer Methods ====================
        
        /**
         * Save performers to cache
         * @param {Array<Object>} performers 
         * @returns {Promise<void>}
         */
        savePerformers: (performers) => _withStore(PERFORMER_STORE, 'readwrite', (store) => {
            performers.forEach(performer => store.put(performer));
        }),

        /**
         * Get all cached performers
         * @returns {Promise<Array<Object>>}
         */
        getPerformers: () => _withStore(PERFORMER_STORE, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }),

        /**
         * Clear all cached performers
         * @returns {Promise<void>}
         */
        clearPerformers: () => _withStore(PERFORMER_STORE, 'readwrite', (store) => {
            store.clear();
        }),

        // ==================== Settings Methods ====================
        
        /**
         * Save a setting
         * @param {string} key 
         * @param {*} value 
         * @returns {Promise<void>}
         */
        saveSetting: (key, value) => _withStore(SETTINGS_STORE, 'readwrite', (store) => {
            store.put({ key, value });
        }),

        /**
         * Get a setting
         * @param {string} key 
         * @returns {Promise<*>}
         */
        getSetting: (key) => _withStore(SETTINGS_STORE, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result ? request.result.value : undefined);
                request.onerror = () => reject(request.error);
            });
        }),

        /**
         * Get all settings
         * @returns {Promise<Object>}
         */
        getAllSettings: () => _withStore(SETTINGS_STORE, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    const settings = {};
                    (request.result || []).forEach(item => {
                        settings[item.key] = item.value;
                    });
                    resolve(settings);
                };
                request.onerror = () => reject(request.error);
            });
        }),

        // ==================== Snippet Methods ====================
        
        /**
         * Add a new snippet
         * @param {string} text 
         * @returns {Promise<number>} The ID of the new snippet
         */
        addSnippet: async (text) => {
            const trimmedText = text.trim();
            if (!trimmedText) {
                throw new Error('Snippet text cannot be empty');
            }

            const db = await _initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(SNIPPETS_STORE, 'readwrite');
                const store = transaction.objectStore(SNIPPETS_STORE);
                
                const snippet = {
                    text: trimmedText,
                    createdAt: Date.now(),
                    usageCount: 0
                };
                
                const request = store.add(snippet);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    if (request.error.name === 'ConstraintError') {
                        reject(new Error('Snippet already exists'));
                    } else {
                        reject(request.error);
                    }
                };
            });
        },

        /**
         * Get all snippets
         * @returns {Promise<Array<Object>>}
         */
        getAllSnippets: () => _withStore(SNIPPETS_STORE, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        }),

        /**
         * Delete a snippet by ID
         * @param {number} id 
         * @returns {Promise<void>}
         */
        deleteSnippet: (id) => _withStore(SNIPPETS_STORE, 'readwrite', (store) => {
            store.delete(id);
        }),

        /**
         * Search snippets by text
         * @param {string} query 
         * @returns {Promise<Array<Object>>}
         */
        searchSnippets: async (query) => {
            const allSnippets = await publicInterface.getAllSnippets();
            const lowerQuery = query.toLowerCase();
            return allSnippets.filter(s => s.text.toLowerCase().includes(lowerQuery));
        },

        /**
         * Update snippet usage count
         * @param {number} id 
         * @returns {Promise<void>}
         */
        incrementSnippetUsage: async (id) => {
            const db = await _initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(SNIPPETS_STORE, 'readwrite');
                const store = transaction.objectStore(SNIPPETS_STORE);
                
                const getRequest = store.get(id);
                getRequest.onsuccess = () => {
                    const snippet = getRequest.result;
                    if (snippet) {
                        snippet.usageCount = (snippet.usageCount || 0) + 1;
                        snippet.lastUsed = Date.now();
                        store.put(snippet);
                    }
                };
                
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        },

        // ==================== Screen Recording Methods ====================

        /**
         * Save a new screen recording
         * @param {Object} recording
         * @returns {Promise<number>} The ID of the new recording
         */
        addRecording: async (recording) => {
            const db = await _initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
                const store = transaction.objectStore(RECORDINGS_STORE);

                const payload = {
                    createdAt: recording.createdAt || Date.now(),
                    durationMs: recording.durationMs || 0,
                    mimeType: recording.mimeType || 'video/webm',
                    byteSize: recording.byteSize || (recording.blob?.size || 0),
                    filename: recording.filename || `screen_recording_${Date.now()}.webm`,
                    blob: recording.blob
                };

                const request = store.add(payload);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },

        /**
         * Get all recordings (newest first)
         * @returns {Promise<Array<Object>>}
         */
        getAllRecordings: () => _withStore(RECORDINGS_STORE, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    const items = request.result || [];
                    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    resolve(items);
                };
                request.onerror = () => reject(request.error);
            });
        }),

        /**
         * Get recording by ID
         * @param {number} id
         * @returns {Promise<Object|undefined>}
         */
        getRecordingById: (id) => _withStore(RECORDINGS_STORE, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }),

        /**
         * Delete recording by ID
         * @param {number} id
         * @returns {Promise<void>}
         */
        deleteRecording: (id) => _withStore(RECORDINGS_STORE, 'readwrite', (store) => {
            store.delete(id);
        }),

        // ==================== Favorites/History Methods ====================
        
        /**
         * Save favorites
         * @param {Array<string>} usernames 
         * @returns {Promise<void>}
         */
        saveFavorites: (usernames) => publicInterface.saveSetting('favorites', usernames),

        /**
         * Get favorites
         * @returns {Promise<Array<string>>}
         */
        getFavorites: async () => {
            const favorites = await publicInterface.getSetting('favorites');
            return favorites || [];
        },

        /**
         * Add to history
         * @param {string} username 
         * @returns {Promise<void>}
         */
        addToHistory: async (username) => {
            const history = await publicInterface.getSetting('viewHistory') || [];
            const filtered = history.filter(h => h.username !== username);
            filtered.unshift({ username, timestamp: Date.now() });
            // Keep only last 100 entries
            const trimmed = filtered.slice(0, 100);
            await publicInterface.saveSetting('viewHistory', trimmed);
        },

        /**
         * Get view history
         * @returns {Promise<Array<Object>>}
         */
        getHistory: async () => {
            const history = await publicInterface.getSetting('viewHistory');
            return history || [];
        },

        /**
         * Clear all history
         * @returns {Promise<void>}
         */
        clearHistory: () => publicInterface.saveSetting('viewHistory', []),

        // ==================== Filter Preferences ====================
        
        /**
         * Save filter preferences
         * @param {Object} filters 
         * @returns {Promise<void>}
         */
        saveFilters: (filters) => publicInterface.saveSetting('filterPrefs', filters),

        /**
         * Get filter preferences
         * @returns {Promise<Object>}
         */
        getFilters: async () => {
            const filters = await publicInterface.getSetting('filterPrefs');
            return filters || AppConfig.DEFAULT_FILTERS;
        }
    };

    return Object.freeze(publicInterface);
})();