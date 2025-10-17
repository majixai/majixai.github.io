/**
 * @file IndexedDB Cache Management for performers and settings.
 * @author Jules
 * @description This module uses the revealing module pattern (via an IIFE) to create a singleton CacheManager.
 * This prevents multiple simultaneous connections to the database and provides a single point of interaction.
 */

const CacheManager = (() => {
    'use strict';

    // Private members, encapsulated within the IIFE scope
    let _db = null;
    const { DB_NAME, DB_VERSION, PERFORMER_STORE, SETTINGS_STORE } = AppConfig;

    /**
     * @private
     * Initializes the IndexedDB database connection and creates object stores.
     * This is a private method, part of the internal workings of the module.
     * It's a classic example of an asynchronous operation needed for setup.
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
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

            // This event is only fired when the DB_VERSION changes.
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(PERFORMER_STORE)) {
                    // Use 'username' as the keyPath for unique identification and indexing.
                    db.createObjectStore(PERFORMER_STORE, { keyPath: 'username' });
                }
                if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                    db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
                }
            };
        });
    };

    /**
     * A higher-order function to wrap transaction logic, reducing boilerplate.
     * @param {string} storeName The name of the object store.
     * @param {IDBTransactionMode} mode The transaction mode ('readonly', 'readwrite').
     * @param {(store: IDBObjectStore) => Promise<any>} callback The operation to perform.
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

    // Public interface exposed by the module
    const publicInterface = {
        /**
         * Saves an array of performer objects to the cache.
         * Uses a 'readwrite' transaction to put each performer in the store.
         * @param {Array<Object>} performers - The performer objects to save.
         * @returns {Promise<void>}
         */
        savePerformers: (performers) => _withStore(PERFORMER_STORE, 'readwrite', (store) => {
            performers.forEach(performer => store.put(performer));
        }),

        /**
         * Retrieves all performers from the cache.
         * @returns {Promise<Array<Object>>} A promise that resolves with an array of performers.
         */
        getPerformers: () => _withStore(PERFORMER_STORE, 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }),

        /**
         * Clears all performers from the cache.
         * @returns {Promise<void>}
         */
        clearPerformers: () => _withStore(PERFORMER_STORE, 'readwrite', (store) => {
            store.clear();
        }),

        /**
         * Saves a key-value pair to the settings store.
         * @param {string} key
         * @param {*} value
         * @returns {Promise<void>}
         */
        saveSetting: (key, value) => _withStore(SETTINGS_STORE, 'readwrite', (store) => {
            store.put({ key, value });
        }),

        /**
         * Retrieves a setting by its key.
         * @param {string} key
         * @returns {Promise<*>} The value of the setting, or undefined.
         */
        getSetting: (key) => _withStore(SETTINGS_STORE, 'readonly', (store) => {
             return new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result ? request.result.value : undefined);
                request.onerror = () => reject(request.error);
            });
        })
    };

    return Object.freeze(publicInterface);
})();