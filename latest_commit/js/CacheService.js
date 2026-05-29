/**
 * A service class for caching data in IndexedDB.
 * Cached data expires after CACHE_TTL_MS milliseconds to ensure fresh commits
 * are always loaded after a push, merge, rebase, or any other repository event.
 */
class CacheService {
    #dbName = 'CommitCacheDB';
    #storeName = 'commits';
    #dbVersion = 1;
    #db = null;
    #initPromise = null;

    /** Cache time-to-live: 5 minutes. */
    static #CACHE_TTL_MS = 5 * 60 * 1000;

    /** Special key used to store cache metadata (not a real commit SHA). */
    static #METADATA_KEY = '_metadata';

    constructor() {
        this.#initPromise = this.#openDB();
    }

    /**
     * Opens and initializes the IndexedDB database.
     * @private
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
     */
    async #openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.#dbName, this.#dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.#storeName)) {
                    db.createObjectStore(this.#storeName, { keyPath: 'sha' });
                }
            };

            request.onsuccess = (event) => {
                this.#db = event.target.result;
                resolve(this.#db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Ensures the database is initialized before proceeding.
     * @private
     */
    async #ensureDb() {
        if (!this.#db) {
            await this.#initPromise;
        }
    }

    /**
     * Retrieves cached commits from the database if the cache has not expired.
     * @returns {Promise<Array<CommitData>|null>} Cached data, or null if expired / not found.
     */
    async getCachedCommits() {
        await this.#ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readonly');
            const store = transaction.objectStore(this.#storeName);

            // Check the metadata entry first to enforce TTL.
            const metaRequest = store.get(CacheService.#METADATA_KEY);
            metaRequest.onsuccess = (event) => {
                const meta = event.target.result;
                if (!meta || (Date.now() - meta.cachedAt) > CacheService.#CACHE_TTL_MS) {
                    resolve(null); // cache is missing or expired
                    return;
                }

                const allRequest = store.getAll();
                allRequest.onsuccess = (allEvent) => {
                    const results = (allEvent.target.result || []).filter(
                        r => r.sha !== CacheService.#METADATA_KEY
                    );
                    resolve(results.length > 0 ? results : null);
                };
                allRequest.onerror = (allEvent) => reject(allEvent.target.error);
            };
            metaRequest.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Caches an array of commits in the database, replacing any previously cached data.
     * @param {Array<CommitData>} commits - The commits to cache.
     * @returns {Promise<void>} A promise that resolves when the data has been cached.
     */
    async cacheCommits(commits) {
        await this.#ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readwrite');
            const store = transaction.objectStore(this.#storeName);

            // Clear stale entries before writing new data.
            store.clear();

            commits.forEach(commit => store.put(commit));

            // Write a metadata record with the current timestamp for TTL tracking.
            store.put({ sha: CacheService.#METADATA_KEY, cachedAt: Date.now() });

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Clears all cached commits and metadata from the database.
     * @returns {Promise<void>}
     */
    async clearCache() {
        await this.#ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readwrite');
            const store = transaction.objectStore(this.#storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }
}
