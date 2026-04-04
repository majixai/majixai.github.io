/**
 * @file IndexedDB Cache Management for performers, settings, and snippets.
 * @description Singleton CacheManager for database operations including snippet storage.
 */

const CacheManager = (() => {
    'use strict';

    let _db = null;
    const { DB_NAME, DB_VERSION, PERFORMER_STORE, SETTINGS_STORE, SNIPPETS_STORE, RECORDINGS_STORE, LABELS_STORE, ANALYTICS_STORE, IMAGE_RECOGNITION_STORE } = AppConfig;

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

                // Image labels store for user annotations
                if (!db.objectStoreNames.contains(LABELS_STORE)) {
                    const labelStore = db.createObjectStore(LABELS_STORE, { keyPath: 'id', autoIncrement: true });
                    labelStore.createIndex('imageUrl', 'imageUrl', { unique: false });
                    labelStore.createIndex('username', 'username', { unique: false });
                    labelStore.createIndex('labelId', 'labelId', { unique: false });
                    labelStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Analytics store for click and rating tracking
                if (!db.objectStoreNames.contains(ANALYTICS_STORE)) {
                    const analyticsStore = db.createObjectStore(ANALYTICS_STORE, { keyPath: 'id', autoIncrement: true });
                    analyticsStore.createIndex('username', 'username', { unique: false });
                    analyticsStore.createIndex('eventType', 'eventType', { unique: false });
                    analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Image recognition store for background GPU analysis results
                if (!db.objectStoreNames.contains(IMAGE_RECOGNITION_STORE)) {
                    const recognitionStore = db.createObjectStore(IMAGE_RECOGNITION_STORE, { keyPath: 'username' });
                    recognitionStore.createIndex('analyzedAt', 'analyzedAt', { unique: false });
                    recognitionStore.createIndex('feedbackScore', 'feedbackScore', { unique: false });
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
        },

        // ==================== Image Label Methods ====================

        /**
         * Add a label to an image at specific coordinates
         * @param {Object} labelData - { imageUrl, username, labelId, customText, x, y, slotNumber }
         * @returns {Promise<number>} The ID of the new label
         */
        addImageLabel: async (labelData) => {
            const db = await _initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(LABELS_STORE, 'readwrite');
                const store = transaction.objectStore(LABELS_STORE);

                const payload = {
                    imageUrl: labelData.imageUrl || '',
                    username: labelData.username || '',
                    labelId: labelData.labelId,
                    customText: labelData.customText || '',
                    x: labelData.x || 0,
                    y: labelData.y || 0,
                    slotNumber: labelData.slotNumber || null,
                    createdAt: Date.now()
                };

                const request = store.add(payload);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },

        /**
         * Get all labels for a specific username
         * @param {string} username
         * @returns {Promise<Array<Object>>}
         */
        getLabelsByUsername: async (username) => {
            const db = await _initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(LABELS_STORE, 'readonly');
                const store = transaction.objectStore(LABELS_STORE);
                const index = store.index('username');
                const request = index.getAll(username);
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        },

        /**
         * Get all labels
         * @returns {Promise<Array<Object>>}
         */
        getAllLabels: () => _withStore(LABELS_STORE, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        }),

        /**
         * Delete a label by ID
         * @param {number} id
         * @returns {Promise<void>}
         */
        deleteLabel: (id) => _withStore(LABELS_STORE, 'readwrite', (store) => {
            store.delete(id);
        }),

        /**
         * Get label statistics (counts per label type)
         * @returns {Promise<Object>}
         */
        getLabelStats: async () => {
            const allLabels = await publicInterface.getAllLabels();
            const stats = {};
            for (const label of allLabels) {
                stats[label.labelId] = (stats[label.labelId] || 0) + 1;
            }
            return stats;
        },

        // ==================== Analytics Methods ====================

        /**
         * Track a performer event (click, view, rating)
         * @param {Object} eventData - { username, eventType, rating?, metadata? }
         * @returns {Promise<void>}
         */
        trackEvent: async (eventData) => {
            const event = {
                username: eventData.username,
                eventType: eventData.eventType, // 'click', 'view', 'rating', 'iframe_open'
                timestamp: Date.now(),
                rating: eventData.rating || null,
                metadata: eventData.metadata || {}
            };
            
            return _withStore(ANALYTICS_STORE, 'readwrite', (store) => {
                store.add(event);
            });
        },

        /**
         * Get all events for a performer
         * @param {string} username
         * @returns {Promise<Array<Object>>}
         */
        getPerformerEvents: async (username) => {
            const db = await _initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(ANALYTICS_STORE, 'readonly');
                const store = transaction.objectStore(ANALYTICS_STORE);
                const index = store.index('username');
                const request = index.getAll(username);
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        },

        /**
         * Get performer statistics (clicks, views, ratings)
         * @param {string} username
         * @returns {Promise<Object>}
         */
        getPerformerStats: async (username) => {
            const events = await publicInterface.getPerformerEvents(username);
            const stats = {
                totalClicks: 0,
                totalViews: 0,
                totalRatings: 0,
                averageRating: 0,
                lastInteraction: null,
                clickScore: 0 // Score based on interactions
            };

            let ratingSum = 0;
            let similarityScore = 0;
            for (const event of events) {
                if (event.eventType === 'click') stats.totalClicks++;
                if (event.eventType === 'view' || event.eventType === 'iframe_open') stats.totalViews++;
                if (event.eventType === 'rating' && event.rating) {
                    stats.totalRatings++;
                    ratingSum += event.rating;
                }
                if (event.eventType === 'similarity_award' && event.metadata?.weight) {
                    similarityScore += event.metadata.weight;
                }
                if (!stats.lastInteraction || event.timestamp > stats.lastInteraction) {
                    stats.lastInteraction = event.timestamp;
                }
            }

            stats.averageRating = stats.totalRatings > 0 ? ratingSum / stats.totalRatings : 0;
            // Calculate click score (higher = more interactions).
            // similarity_award weights are summed as received (no per-cycle cap).
            stats.clickScore = (stats.totalClicks * 3) + (stats.totalViews * 2) + (stats.totalRatings * stats.averageRating * 5) + similarityScore;

            return stats;
        },

        /**
         * Get all analytics events (for reporting)
         * @param {number} limit - Max events to return
         * @returns {Promise<Array<Object>>}
         */
        getAllEvents: async (limit = 100) => {
            const db = await _initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(ANALYTICS_STORE, 'readonly');
                const store = transaction.objectStore(ANALYTICS_STORE);
                const index = store.index('timestamp');
                const request = index.openCursor(null, 'prev'); // Most recent first
                const results = [];
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor && results.length < limit) {
                        results.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        },

        /**
         * Clear old analytics events (keep recent ones)
         * @param {number} daysToKeep - Number of days of history to keep
         * @returns {Promise<number>} - Number of deleted events
         */
        clearOldEvents: async (daysToKeep = 30) => {
            const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
            const db = await _initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(ANALYTICS_STORE, 'readwrite');
                const store = transaction.objectStore(ANALYTICS_STORE);
                const index = store.index('timestamp');
                const request = index.openCursor();
                let deletedCount = 0;
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        if (cursor.value.timestamp < cutoffTime) {
                            cursor.delete();
                            deletedCount++;
                        }
                        cursor.continue();
                    } else {
                        resolve(deletedCount);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        },

        // ==================== Image Recognition Methods ====================

        /**
         * Save GPU image recognition result for a performer
         * @param {Object} result - { username, predictions, featureVector, analyzedAt, feedbackScore }
         * @returns {Promise<void>}
         */
        saveRecognitionResult: async (result) => {
            const record = {
                username: result.username,
                predictions: result.predictions || [],
                featureVector: result.featureVector || null,
                analyzedAt: result.analyzedAt || Date.now(),
                feedbackScore: result.feedbackScore || 0,
                imageUrl: result.imageUrl || ''
            };

            return _withStore(IMAGE_RECOGNITION_STORE, 'readwrite', (store) => {
                store.put(record);
            });
        },

        /**
         * Get recognition result for a performer
         * @param {string} username
         * @returns {Promise<Object|null>}
         */
        getRecognitionResult: async (username) => {
            const db = await _initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(IMAGE_RECOGNITION_STORE, 'readonly');
                const store = transaction.objectStore(IMAGE_RECOGNITION_STORE);
                const request = store.get(username);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        },

        /**
         * Get all recognition results sorted by feedback score
         * @param {number} limit - Max results to return
         * @returns {Promise<Array<Object>>}
         */
        getAllRecognitionResults: async (limit = 100) => {
            const db = await _initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(IMAGE_RECOGNITION_STORE, 'readonly');
                const store = transaction.objectStore(IMAGE_RECOGNITION_STORE);
                const index = store.index('feedbackScore');
                const request = index.openCursor(null, 'prev');
                const results = [];

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor && results.length < limit) {
                        results.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        },

        /**
         * Update feedback score for a performer's recognition result
         * @param {string} username
         * @param {number} scoreDelta - Amount to add to feedback score
         * @returns {Promise<void>}
         */
        updateRecognitionFeedback: async (username, scoreDelta) => {
            const existing = await publicInterface.getRecognitionResult(username);
            if (!existing) return;

            existing.feedbackScore = (existing.feedbackScore || 0) + scoreDelta;
            return _withStore(IMAGE_RECOGNITION_STORE, 'readwrite', (store) => {
                store.put(existing);
            });
        },

        /**
         * Prune old recognition results beyond max cache size
         * @param {number} maxEntries - Maximum entries to keep
         * @returns {Promise<number>} - Number of pruned entries
         */
        pruneRecognitionResults: async (maxEntries = 500) => {
            const db = await _initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(IMAGE_RECOGNITION_STORE, 'readwrite');
                const store = transaction.objectStore(IMAGE_RECOGNITION_STORE);
                const index = store.index('analyzedAt');
                const countRequest = store.count();

                countRequest.onsuccess = () => {
                    const totalCount = countRequest.result;
                    if (totalCount <= maxEntries) {
                        resolve(0);
                        return;
                    }

                    const toDelete = totalCount - maxEntries;
                    let deletedCount = 0;
                    const cursorRequest = index.openCursor();

                    cursorRequest.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor && deletedCount < toDelete) {
                            cursor.delete();
                            deletedCount++;
                            cursor.continue();
                        } else {
                            resolve(deletedCount);
                        }
                    };
                    cursorRequest.onerror = () => reject(cursorRequest.error);
                };
                countRequest.onerror = () => reject(countRequest.error);
            });
        }
    };

    return Object.freeze(publicInterface);
})();