/**
 * @fileoverview A wrapper for IndexedDB to handle game state persistence.
 */

class DBHelper {
    /** @private {string} */
    #dbName;
    /** @private {string} */
    #storeName;
    /** @private {number} */
    #version;
    /** @private {?IDBDatabase} */
    #db = null;

    constructor(dbName = 'DiceGolfDB', storeName = 'games', version = 1) {
        this.#dbName = dbName;
        this.#storeName = storeName;
        this.#version = version;
    }

    /**
     * Opens and initializes the IndexedDB database.
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
     * @private
     */
    async #open() {
        if (this.#db) {
            return Promise.resolve(this.#db);
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.#dbName, this.#version);
            request.onerror = () => reject("Error opening IndexedDB.");
            request.onsuccess = (event) => {
                this.#db = event.target.result;
                resolve(this.#db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.#storeName)) {
                    db.createObjectStore(this.#storeName, { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    /**
     * Saves an item to the object store.
     * @param {Object} item The item to save.
     * @returns {Promise<number>} A promise that resolves with the ID of the saved item.
     */
    async put(item) {
        await this.#open();
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readwrite');
            const store = transaction.objectStore(this.#storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("Error putting item into DB.");
        });
    }

    /**
     * Retrieves all items from the object store.
     * @returns {Promise<Array<Object>>} A promise that resolves with all items.
     */
    async getAll() {
        await this.#open();
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readonly');
            const store = transaction.objectStore(this.#storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("Error getting all items from DB.");
        });
    }

    /**
     * Clears the entire object store.
     * @returns {Promise<void>}
     */
    async clear() {
        await this.#open();
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([this.#storeName], 'readwrite');
            const store = transaction.objectStore(this.#storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject("Error clearing the object store.");
        });
    }
}
