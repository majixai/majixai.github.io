class StorageManager {
    #dbName;
    #dbVersion;
    #db; // Stores the IndexedDB database instance

    constructor(dbName = 'UserDatabase', dbVersion = 1) {
        this.#dbName = dbName;
        this.#dbVersion = dbVersion;
        this.#db = null;
    }

    async init() {
        if (this.#db) {
            return; // Already initialized
        }
        try {
            this.#db = await this.#openDB();
            console.log("StorageManager initialized and database opened.");
        } catch (error) {
            console.error("Error initializing StorageManager:", error);
            throw error; // Rethrow to allow caller to handle
        }
    }

    async #openDB() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                console.warn("IndexedDB not supported by this browser.");
                return reject(new Error("IndexedDB not supported."));
            }
            const request = indexedDB.open(this.#dbName, this.#dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log("IndexedDB upgrade needed or creating database.");
                if (!db.objectStoreNames.contains('users')) {
                    db.createObjectStore('users', { keyPath: 'key' });
                    console.log("Created object store: 'users'");
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                db.onerror = (errEvent) => console.error("IndexedDB Database Error:", errEvent.target.error);
                console.log("Database opened successfully.");
                resolve(db);
            };

            request.onerror = (event) => {
                console.error("IndexedDB Open Error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    async #getStore(mode = 'readonly') {
        if (!this.#db) {
            // Attempt to re-initialize if db is not available.
            // This could happen if init() wasn't called or failed silently.
            console.warn("Database not initialized. Attempting to initialize StorageManager now.");
            await this.init();
            if (!this.#db) { // If still not initialized after attempt, throw error.
                 throw new Error("Database not initialized. Call init() first.");
            }
        }
        return this.#db.transaction('users', mode).objectStore('users');
    }
    
    async #loadFromDB(key) {
        try {
            const store = await this.#getStore('readonly');
            return new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = (event) => {
                    const result = event.target.result;
                    resolve(result ? result.value : undefined); // Return undefined if key not found, to distinguish from empty array
                };
                request.onerror = (event) => {
                    console.error(`IndexedDB Load Error for key '${key}':`, event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error(`Error in #loadFromDB for key '${key}':`, error);
            throw error;
        }
    }

    async #saveToDB(key, value) {
        try {
            const store = await this.#getStore('readwrite');
            return new Promise((resolve, reject) => {
                const request = store.put({ key: key, value: value });
                request.onsuccess = () => {
                    resolve();
                };
                request.onerror = (event) => {
                    console.error(`IndexedDB Put Error for key '${key}':`, event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error(`Error in #saveToDB for key '${key}':`, error);
            throw error;
        }
    }

    async loadUsers(key) {
        // Note: The `storageType` global variable is from script.js.
        // This method's logic for choosing between IndexedDB and localStorage/sessionStorage
        // relies on that global. This is a bit of a workaround to keep script.js changes minimal for now.
        console.log(`Loading data for key '${key}' using storage type: ${window.storageType}`);
        if (window.storageType === "indexedClicked" || window.storageType?.startsWith('IndexedDB:')) {
            try {
                const idbKey = window.storageType.startsWith('IndexedDB:') ? window.storageType.substring(11) : key;
                console.log(`Using IndexedDB key: ${idbKey}`);
                const data = await this.#loadFromDB(idbKey);
                console.log(`Loaded ${data ? data.length : 0} items from IndexedDB for key '${idbKey}'.`);
                return Array.isArray(data) ? data : [];
            } catch (error) {
                console.error(`Failed to load from IndexedDB for key '${key}' (storage type: ${window.storageType}).`, error);
                return [];
            }
        } else {
            const storage = window.storageType === "local" ? localStorage : sessionStorage;
            try {
                const storedUsers = storage.getItem(key);
                const data = storedUsers ? JSON.parse(storedUsers) : [];
                if (!Array.isArray(data)) {
                    console.warn(`Data loaded from ${window.storageType} storage for key '${key}' is not an array. Returning []. Data:`, data);
                    storage.removeItem(key);
                    return [];
                }
                console.log(`Loaded ${data.length} items from ${window.storageType} storage for key '${key}'.`);
                return data;
            } catch (error) {
                console.error(`Error loading or parsing from ${window.storageType} storage key '${key}':`, error);
                try { storage.removeItem(key); } catch (e) { /* ignore */ }
                return [];
            }
        }
    }

    async saveUsers(key, usersArray) {
        if (!Array.isArray(usersArray)) {
            console.error(`Attempted to save non-array data for key '${key}'. Aborting save.`);
            return Promise.reject(new Error("Invalid data type: Expected an array."));
        }
        console.log(`Saving ${usersArray.length} items for key '${key}' using storage type: ${window.storageType}`);
        if (window.storageType === "indexedClicked" || window.storageType?.startsWith('IndexedDB:')) {
            try {
                const idbKey = window.storageType.startsWith('IndexedDB:') ? window.storageType.substring(11) : key;
                console.log(`Saving to IndexedDB key: ${idbKey}`);
                await this.#saveToDB(idbKey, usersArray);
                console.log(`Saved to IndexedDB for key '${idbKey}'.`);
            } catch (error) {
                console.error(`Failed to save to IndexedDB for key '${key}' (storage type: ${window.storageType}).`, error);
                throw error;
            }
        } else {
            const storage = window.storageType === "local" ? localStorage : sessionStorage;
            try {
                storage.setItem(key, JSON.stringify(usersArray));
                console.log(`Saved to ${window.storageType} storage for key '${key}'.`);
            } catch (error) {
                console.error(`Error saving to ${window.storageType} storage key '${key}':`, error);
                // Not re-throwing for localStorage/sessionStorage to maintain previous behavior
            }
        }
    }

    async getIndexedDBKeys() {
        try {
            const store = await this.#getStore('readonly');
            return new Promise((resolve, reject) => {
                const request = store.getAllKeys();
                request.onsuccess = (event) => {
                    resolve(event.target.result || []);
                };
                request.onerror = (event) => {
                    console.error("IndexedDB getAllKeys Error:", event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error("Error in getIndexedDBKeys:", error);
            return []; // Return empty on error, consistent with previous behavior
        }
    }

    async populateStorageOptions() {
        const storageTypeSelector = document.getElementById("storageType"); // Query internally
        if (!storageTypeSelector) {
            console.warn("Storage type selector element (#storageType) not found. Cannot populate options.");
            return;
        }
        console.log("Populating storage options...");
        const currentSelectedValue = storageTypeSelector.value;
        storageTypeSelector.innerHTML = '';

        storageTypeSelector.add(new Option('Local Storage', 'local'));
        storageTypeSelector.add(new Option('Session Storage', 'session'));
        storageTypeSelector.add(new Option('IndexedDB (Default History)', 'indexedClicked'));

        try {
            const idbKeys = await this.getIndexedDBKeys();
            console.log("Found IndexedDB keys:", idbKeys);
            idbKeys.forEach(key => {
                if (key !== 'previousUsers' && key !== 'removedUsers' && key !== 'indexedClicked' && key !== 'snippetList') { // Avoid duplicates
                    const optionValue = `IndexedDB:${key}`;
                    const optionText = `IndexedDB: ${key}`;
                    storageTypeSelector.add(new Option(optionText, optionValue));
                }
            });
        } catch (error) {
            console.warn("Could not populate custom IndexedDB keys:", error);
        }

        let valueToSet = currentSelectedValue || window.storageType; // window.storageType is from script.js
        if (storageTypeSelector.querySelector(`option[value="${valueToSet}"]`)) {
            storageTypeSelector.value = valueToSet;
        } else {
            console.warn(`Storage type '${valueToSet}' not found in options. Defaulting to 'local'.`);
            storageTypeSelector.value = 'local';
        }
        window.storageType = storageTypeSelector.value; // Update global variable in script.js
        console.log(`Storage options populated. Current selection: ${window.storageType}`);
    }

    async addTextSnippet(newSnippetText) {
        try {
            let snippetList = await this.#loadFromDB('snippetList');
            if (!Array.isArray(snippetList)) {
                snippetList = []; // Initialize if not an array or undefined
            }
            snippetList.push(newSnippetText);
            await this.#saveToDB('snippetList', snippetList);
            console.log('Snippet list updated in IndexedDB.');
        } catch (error) {
            console.error('Error adding text snippet:', error);
            throw error;
        }
    }

    async loadAllTextSnippets() {
        try {
            const snippets = await this.#loadFromDB('snippetList');
            return Array.isArray(snippets) ? snippets : [];
        } catch (error) {
            console.error('Error loading all text snippets:', error);
            return [];
        }
    }

    async deleteTextSnippet(snippetTextToDelete) {
         try {
            let snippetList = await this.#loadFromDB('snippetList');
            if (!Array.isArray(snippetList)) {
                snippetList = [];
            }
            const initialLength = snippetList.length;
            snippetList = snippetList.filter(snippet => snippet !== snippetTextToDelete);
            if (snippetList.length === initialLength) {
                console.warn(`Snippet to delete ("${snippetTextToDelete}") not found in list.`);
            }
            await this.#saveToDB('snippetList', snippetList);
            console.log('Snippet list updated (after potential deletion) in IndexedDB.');
        } catch (error) {
            console.error('Error deleting text snippet:', error);
            throw error;
        }
    }
    
    // Option 1: Takes previousUsersArray as argument
    async incrementUserClickCount(username, previousUsersArray) {
        if (!Array.isArray(previousUsersArray)) {
             console.warn("previousUsersArray not provided or not an array. Cannot increment click count.");
             return;
        }
        const user = previousUsersArray.find(u => u.username === username);
        if (user) {
            user.clickCount = (user.clickCount || 0) + 1;
            console.log(`User ${username} click count incremented to ${user.clickCount}`);
            // This assumes 'previousUsers' is the correct key for this array in storage.
            // And that previousUsersArray is THE array that script.js manages.
            await this.saveUsers("previousUsers", previousUsersArray); 
        }
    }

    // Option 1: Takes previousUsersArray as argument
    getUserClickCount(username, previousUsersArray) {
        if (!Array.isArray(previousUsersArray)) {
            console.warn("previousUsersArray not provided or not an array. Cannot get click count.");
            return 0;
        }
        const user = previousUsersArray.find(u => u.username === username);
        return (user && user.clickCount) ? user.clickCount : 0;
    }
}

// The class is now defined. If not using ES modules, it will be available globally.
// To make it explicitly available on the window:
// window.StorageManager = StorageManager;
// However, script.js will create an instance directly.
