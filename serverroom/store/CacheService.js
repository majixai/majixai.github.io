class CacheService {
    constructor(dbName = 'JinxGenCache', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    async openDb(stores) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                stores.forEach(store => {
                    if (!this.db.objectStoreNames.contains(store)) {
                        this.db.createObjectStore(store);
                    }
                });
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject('Error opening IndexedDB: ' + event.target.errorCode);
            };
        });
    }

    async get(storeName, key) {
        if (!this.db) {
            await this.openDb([storeName]);
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                reject('Error getting data from IndexedDB: ' + event.target.errorCode);
            };
        });
    }

    async set(storeName, key, value) {
        if (!this.db) {
            await this.openDb([storeName]);
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(value, key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                reject('Error setting data in IndexedDB: ' + event.target.errorCode);
            };
        });
    }

    async clear(storeName) {
        if (!this.db) {
            await this.openDb([storeName]);
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                reject('Error clearing store in IndexedDB: ' + event.target.errorCode);
            };
        });
    }
}
