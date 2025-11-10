/**
 * A service class for caching data in IndexedDB.
 * Manages caching both the list of latest commit SHAs and individual commit details.
 */
class CacheService {
    #dbName = 'CommitCacheDB';
    #dbVersion = 2; // Incremented version to handle schema change
    #commitStoreName = 'commit_details';
    #listStoreName = 'commit_list';
    #db = null;
    #initPromise = null;

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
                if (!db.objectStoreNames.contains(this.#commitStoreName)) {
                    db.createObjectStore(this.#commitStoreName, { keyPath: 'sha' });
                }
                if (!db.objectStoreNames.contains(this.#listStoreName)) {
                    // This store will hold the list of latest commit SHAs
                    db.createObjectStore(this.#listStoreName, { keyPath: 'id' });
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
     * Retrieves a cached commit from the database by its SHA.
     * @param {string} sha - The SHA of the commit to retrieve.
     * @returns {Promise<object|null>} A promise that resolves with the cached commit data, or null if not found.
     */
    async getCachedCommits(sha) {
        await this.#ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#commitStoreName], 'readonly');
            const store = transaction.objectStore(this.#commitStoreName);
            const request = store.get(sha);

            request.onsuccess = (event) => {
                resolve(event.target.result || null);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Caches a single commit's detailed data.
     * @param {string} sha - The SHA of the commit.
     * @param {object} commitData - The detailed commit data to cache.
     * @returns {Promise<void>}
     */
    async cacheCommits(sha, commitData) {
        await this.#ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#commitStoreName], 'readwrite');
            const store = transaction.objectStore(this.#commitStoreName);
            store.put(commitData);

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    }
}
