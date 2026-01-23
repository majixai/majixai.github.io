/**
 * IndexedDB Manager for Persistent Data Storage
 * Provides offline data caching and synchronization
 */

class IndexedDBManager {
    constructor(dbName = 'YFinanceDB', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.initialized = false;
    }

    /**
     * Initialize database connection
     * @returns {Promise<IDBDatabase>} Database instance
     */
    async init() {
        if (this.initialized && this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.initialized = true;
                console.log('✓ IndexedDB initialized:', this.dbName);
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('Upgrading IndexedDB schema...');

                // Ticker data store
                if (!db.objectStoreNames.contains('ticker_data')) {
                    const tickerStore = db.createObjectStore('ticker_data', { keyPath: 'ticker' });
                    tickerStore.createIndex('ticker', 'ticker', { unique: true });
                    tickerStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                    console.log('✓ Created object store: ticker_data');
                }

                // Analysis results store
                if (!db.objectStoreNames.contains('analysis_results')) {
                    const analysisStore = db.createObjectStore('analysis_results', { keyPath: 'id', autoIncrement: true });
                    analysisStore.createIndex('ticker', 'ticker', { unique: false });
                    analysisStore.createIndex('analysisType', 'analysisType', { unique: false });
                    analysisStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('✓ Created object store: analysis_results');
                }

                // User preferences store
                if (!db.objectStoreNames.contains('preferences')) {
                    const prefsStore = db.createObjectStore('preferences', { keyPath: 'key' });
                    console.log('✓ Created object store: preferences');
                }

                // Cache metadata store
                if (!db.objectStoreNames.contains('cache_metadata')) {
                    const cacheStore = db.createObjectStore('cache_metadata', { keyPath: 'key' });
                    cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
                    console.log('✓ Created object store: cache_metadata');
                }

                // Watchlist store
                if (!db.objectStoreNames.contains('watchlist')) {
                    const watchlistStore = db.createObjectStore('watchlist', { keyPath: 'ticker' });
                    watchlistStore.createIndex('addedAt', 'addedAt', { unique: false });
                    console.log('✓ Created object store: watchlist');
                }

                // Export history store
                if (!db.objectStoreNames.contains('export_history')) {
                    const exportStore = db.createObjectStore('export_history', { keyPath: 'id', autoIncrement: true });
                    exportStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('✓ Created object store: export_history');
                }
            };
        });
    }

    /**
     * Store ticker data
     * @param {string} ticker - Ticker symbol
     * @param {Object} data - Ticker data
     * @param {number} ttl - Time to live in seconds
     * @returns {Promise<void>}
     */
    async storeTickerData(ticker, data, ttl = 3600) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['ticker_data', 'cache_metadata'], 'readwrite');
            const tickerStore = transaction.objectStore('ticker_data');
            const cacheStore = transaction.objectStore('cache_metadata');

            const tickerData = {
                ticker,
                data,
                lastUpdated: Date.now(),
                version: 1
            };

            const cacheMetadata = {
                key: `ticker_${ticker}`,
                createdAt: Date.now(),
                expiresAt: Date.now() + (ttl * 1000),
                size: JSON.stringify(data).length
            };

            tickerStore.put(tickerData);
            cacheStore.put(cacheMetadata);

            transaction.oncomplete = () => {
                console.log(`✓ Stored ticker data: ${ticker} (TTL: ${ttl}s)`);
                resolve();
            };

            transaction.onerror = () => {
                console.error('Failed to store ticker data:', transaction.error);
                reject(transaction.error);
            };
        });
    }

    /**
     * Retrieve ticker data
     * @param {string} ticker - Ticker symbol
     * @returns {Promise<Object|null>} Ticker data or null if not found/expired
     */
    async getTickerData(ticker) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['ticker_data', 'cache_metadata'], 'readonly');
            const tickerStore = transaction.objectStore('ticker_data');
            const cacheStore = transaction.objectStore('cache_metadata');

            const tickerRequest = tickerStore.get(ticker);
            const cacheRequest = cacheStore.get(`ticker_${ticker}`);

            transaction.oncomplete = () => {
                const tickerData = tickerRequest.result;
                const cacheMetadata = cacheRequest.result;

                if (!tickerData || !cacheMetadata) {
                    console.log(`Cache miss: ${ticker}`);
                    resolve(null);
                    return;
                }

                // Check if cache is expired
                if (cacheMetadata.expiresAt < Date.now()) {
                    console.log(`Cache expired: ${ticker}`);
                    this.deleteTickerData(ticker);
                    resolve(null);
                    return;
                }

                console.log(`✓ Retrieved ticker data: ${ticker}`);
                resolve(tickerData.data);
            };

            transaction.onerror = () => {
                console.error('Failed to retrieve ticker data:', transaction.error);
                reject(transaction.error);
            };
        });
    }

    /**
     * Delete ticker data
     * @param {string} ticker - Ticker symbol
     * @returns {Promise<void>}
     */
    async deleteTickerData(ticker) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['ticker_data', 'cache_metadata'], 'readwrite');
            const tickerStore = transaction.objectStore('ticker_data');
            const cacheStore = transaction.objectStore('cache_metadata');

            tickerStore.delete(ticker);
            cacheStore.delete(`ticker_${ticker}`);

            transaction.oncomplete = () => {
                console.log(`✓ Deleted ticker data: ${ticker}`);
                resolve();
            };

            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }

    /**
     * Store analysis result
     * @param {string} ticker - Ticker symbol
     * @param {string} analysisType - Type of analysis
     * @param {Object} result - Analysis result
     * @returns {Promise<number>} Record ID
     */
    async storeAnalysisResult(ticker, analysisType, result) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('analysis_results', 'readwrite');
            const store = transaction.objectStore('analysis_results');

            const record = {
                ticker,
                analysisType,
                result,
                timestamp: Date.now()
            };

            const request = store.add(record);

            request.onsuccess = () => {
                console.log(`✓ Stored analysis result: ${ticker} - ${analysisType}`);
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get analysis results for ticker
     * @param {string} ticker - Ticker symbol
     * @param {string} analysisType - Optional analysis type filter
     * @returns {Promise<Array>} Analysis results
     */
    async getAnalysisResults(ticker, analysisType = null) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('analysis_results', 'readonly');
            const store = transaction.objectStore('analysis_results');
            const index = store.index('ticker');

            const request = index.getAll(ticker);

            request.onsuccess = () => {
                let results = request.result;

                if (analysisType) {
                    results = results.filter(r => r.analysisType === analysisType);
                }

                console.log(`✓ Retrieved ${results.length} analysis results for ${ticker}`);
                resolve(results);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Store user preference
     * @param {string} key - Preference key
     * @param {*} value - Preference value
     * @returns {Promise<void>}
     */
    async setPreference(key, value) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('preferences', 'readwrite');
            const store = transaction.objectStore('preferences');

            const record = {
                key,
                value,
                updatedAt: Date.now()
            };

            store.put(record);

            transaction.oncomplete = () => {
                console.log(`✓ Set preference: ${key}`);
                resolve();
            };

            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }

    /**
     * Get user preference
     * @param {string} key - Preference key
     * @param {*} defaultValue - Default value if not found
     * @returns {Promise<*>} Preference value
     */
    async getPreference(key, defaultValue = null) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('preferences', 'readonly');
            const store = transaction.objectStore('preferences');

            const request = store.get(key);

            request.onsuccess = () => {
                const record = request.result;
                resolve(record ? record.value : defaultValue);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Add ticker to watchlist
     * @param {string} ticker - Ticker symbol
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<void>}
     */
    async addToWatchlist(ticker, metadata = {}) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('watchlist', 'readwrite');
            const store = transaction.objectStore('watchlist');

            const record = {
                ticker,
                addedAt: Date.now(),
                ...metadata
            };

            store.put(record);

            transaction.oncomplete = () => {
                console.log(`✓ Added to watchlist: ${ticker}`);
                resolve();
            };

            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }

    /**
     * Get watchlist
     * @returns {Promise<Array>} Watchlist items
     */
    async getWatchlist() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('watchlist', 'readonly');
            const store = transaction.objectStore('watchlist');

            const request = store.getAll();

            request.onsuccess = () => {
                console.log(`✓ Retrieved watchlist (${request.result.length} items)`);
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Remove from watchlist
     * @param {string} ticker - Ticker symbol
     * @returns {Promise<void>}
     */
    async removeFromWatchlist(ticker) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('watchlist', 'readwrite');
            const store = transaction.objectStore('watchlist');

            store.delete(ticker);

            transaction.oncomplete = () => {
                console.log(`✓ Removed from watchlist: ${ticker}`);
                resolve();
            };

            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }

    /**
     * Clear all expired cache entries
     * @returns {Promise<number>} Number of entries deleted
     */
    async clearExpiredCache() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache_metadata', 'ticker_data'], 'readwrite');
            const cacheStore = transaction.objectStore('cache_metadata');
            const tickerStore = transaction.objectStore('ticker_data');
            const index = cacheStore.index('expiresAt');

            const range = IDBKeyRange.upperBound(Date.now());
            const request = index.openCursor(range);

            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;

                if (cursor) {
                    const key = cursor.value.key;
                    const ticker = key.replace('ticker_', '');

                    cacheStore.delete(key);
                    tickerStore.delete(ticker);
                    deletedCount++;

                    cursor.continue();
                }
            };

            transaction.oncomplete = () => {
                console.log(`✓ Cleared ${deletedCount} expired cache entries`);
                resolve(deletedCount);
            };

            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }

    /**
     * Get database statistics
     * @returns {Promise<Object>} Database stats
     */
    async getStats() {
        await this.init();

        const stats = {
            tickerDataCount: 0,
            analysisResultsCount: 0,
            watchlistCount: 0,
            totalSize: 0
        };

        const storeNames = ['ticker_data', 'analysis_results', 'watchlist'];
        
        for (const storeName of storeNames) {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            
            const count = await new Promise((resolve) => {
                const request = store.count();
                request.onsuccess = () => resolve(request.result);
            });

            switch(storeName) {
                case 'ticker_data':
                    stats.tickerDataCount = count;
                    break;
                case 'analysis_results':
                    stats.analysisResultsCount = count;
                    break;
                case 'watchlist':
                    stats.watchlistCount = count;
                    break;
            }
        }

        console.log('✓ Database stats:', stats);
        return stats;
    }

    /**
     * Export all data
     * @returns {Promise<Object>} All data from database
     */
    async exportAll() {
        await this.init();

        const exported = {
            ticker_data: await this.getAllFromStore('ticker_data'),
            analysis_results: await this.getAllFromStore('analysis_results'),
            preferences: await this.getAllFromStore('preferences'),
            watchlist: await this.getAllFromStore('watchlist'),
            exportedAt: new Date().toISOString()
        };

        console.log('✓ Exported all data');
        return exported;
    }

    /**
     * Import data
     * @param {Object} data - Data to import
     * @returns {Promise<void>}
     */
    async importAll(data) {
        await this.init();

        for (const storeName of Object.keys(data)) {
            if (storeName === 'exportedAt') continue;

            const items = data[storeName];
            if (!Array.isArray(items)) continue;

            for (const item of items) {
                await this.putToStore(storeName, item);
            }
        }

        console.log('✓ Imported all data');
    }

    /**
     * Clear all data
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.init();

        const storeNames = ['ticker_data', 'analysis_results', 'preferences', 'cache_metadata', 'watchlist', 'export_history'];

        for (const storeName of storeNames) {
            await this.clearStore(storeName);
        }

        console.log('✓ Cleared all data');
    }

    // Helper methods

    async getAllFromStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async putToStore(storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log(`✓ Cleared store: ${storeName}`);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
}

// Create global instance
window.DB = new IndexedDBManager();

console.log('✓ IndexedDB Manager loaded');
