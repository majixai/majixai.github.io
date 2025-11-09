/**
 * A service class for caching data in IndexedDB.
 */
class CacheService {
    #dbName = 'CommitCacheDB';
    #storeName = 'commits';
    #dbVersion = 1;
    #db = null;

    constructor() {
        this.#openDB().then(db => {
            this.#db = db;
        });
    }

    /**
     * Opens and initializes the IndexedDB database.
     * @private
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
     */
    #openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.#dbName, this.#dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.#storeName)) {
                    db.createObjectStore(this.#storeName, { keyPath: 'sha' });
                }
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Retrieves cached commits from the database.
     * @returns {Promise<Array<CommitData>|null>} A promise that resolves with the cached data, or null if not found.
     */
    async getCachedCommits() {
        if (!this.#db) {
            this.#db = await this.#openDB();
        }
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readonly');
            const store = transaction.objectStore(this.#storeName);
            const request = store.getAll();

            request.onsuccess = (event) => {
                if (event.target.result && event.target.result.length > 0) {
                    resolve(event.target.result);
                } else {
                    resolve(null);
                }
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Caches an array of commits in the database.
     * @param {Array<CommitData>} commits - The commits to cache.
     * @returns {Promise<void>} A promise that resolves when the data has been cached.
     */
    async cacheCommits(commits) {
        if (!this.#db) {
            this.#db = await this.#openDB();
        }
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readwrite');
            const store = transaction.objectStore(this.#storeName);
            commits.forEach(commit => store.put(commit));

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
}
