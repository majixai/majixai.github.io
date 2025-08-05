class StorageManager {
    #dbName;
    #dbVersion;
    #db; // Stores the IndexedDB database instance
    #isInitializing = false;
    #initSuccessfullyCompleted = false;
    #initPromise = null;
    #indexedDBFailed = false;

    constructor(dbName = 'UserDatabase', dbVersion = 1) {
        this.#dbName = dbName;
        this.#dbVersion = dbVersion;
        this.#db = null;
    }

    async init() {
        if (this.#initSuccessfullyCompleted && this.#db) {
            console.log("StorageManager already initialized successfully.");
            return;
        }

        if (this.#isInitializing && this.#initPromise) {
            console.log("StorageManager initialization already in progress, awaiting existing promise.");
            return this.#initPromise;
        }

        this.#isInitializing = true;
        this.#initPromise = (async () => {
            try {
                this.#db = await this.#openDB();
                this.#initSuccessfullyCompleted = true;
                console.log("StorageManager initialized and database opened.");
            } catch (error) {
                console.error("IndexedDB initialization failed within StorageManager.init():", error);
                // Log specific details if available (already done by #openDB's onerror)
                console.warn("StorageManager: IndexedDB failed to initialize. Attempting to use fallback (localStorage) for critical operations.");
                this.#indexedDBFailed = true;
                this.#initSuccessfullyCompleted = false; // Ensure this is false
                // DO NOT re-throw the error here, to allow the app to continue with fallback.
                // App.start() will no longer see this specific error if we don't re-throw.
            } finally {
                this.#isInitializing = false;
            }
        })();
        return this.#initPromise;
    }

    // Add this getter inside the StorageManager class
    get isIndexedDBFailed() {
        return this.#indexedDBFailed;
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
                const error = event.target.error;
                console.error("IndexedDB Open Error:", error);
                if (error) {
                    console.error(`IndexedDB Open Error Name: ${error.name}`);
                    console.error(`IndexedDB Open Error Message: ${error.message}`);
                }
                reject(error);
            };
        });
    }

    async #getStore(mode = 'readonly') {
        if (!this.#initSuccessfullyCompleted || !this.#db) {
            if (this.#isInitializing && this.#initPromise) {
                console.warn("StorageManager.init() in progress. Awaiting its completion before getting store.");
                await this.#initPromise; // Wait for the ongoing initialization
            } else if (!this.#isInitializing) {
                // Not initialized and no initialization in progress, attempt to init.
                console.warn("Database not initialized and no init in progress. Attempting to initialize StorageManager now via #getStore.");
                await this.init(); // This will either use existing promise or start a new one.
            }
        }

        // After potentially awaiting or calling init, check again.
        if (!this.#initSuccessfullyCompleted || !this.#db) {
            console.error("StorageManager critical error: Database is not available even after init attempts in #getStore.");
            throw new Error("Database not initialized. Call init() first and ensure it succeeds.");
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
        let storageToUse = window.storageType;
        let usingForcedFallback = false;

        if (this.#indexedDBFailed) {
            console.warn(`StorageManager.loadUsers: IndexedDB previously failed. Forcing use of localStorage for key '${key}'.`);
            storageToUse = "local"; // Force localStorage
            usingForcedFallback = true;
        }

        console.log(`Loading data for key '${key}'. Chosen storage: ${storageToUse}${usingForcedFallback ? ' (forced fallback)' : ''}. Original window.storageType: ${window.storageType}`);

        if (storageToUse === "indexedClicked" || storageToUse?.startsWith('IndexedDB:')) {
            // This block will now only be entered if IndexedDB did NOT fail.
            try {
                const idbKey = storageToUse.startsWith('IndexedDB:') ? storageToUse.substring(11) : key;
                console.log(`Using IndexedDB key: ${idbKey}`);
                const data = await this.#loadFromDB(idbKey);
                console.log(`Loaded ${data ? data.length : 0} items from IndexedDB for key '${idbKey}'.`);
                return Array.isArray(data) ? data : [];
            } catch (error) {
                console.error(`Failed to load from IndexedDB for key '${key}' (storage type: ${storageToUse}).`, error);
                if (usingForcedFallback) { // Should not happen if logic is correct, but as safeguard
                    console.error("Error during forced fallback to IndexedDB load, this indicates a logic issue. Defaulting to empty array.");
                    return [];
                }
                // If IndexedDB failed here, and it wasn't a forced fallback, perhaps try localStorage as a secondary fallback?
                // For now, keeping original behavior of returning [] for this specific failure.
                return [];
            }
        } else { // local or session
            const storage = storageToUse === "local" ? localStorage : sessionStorage;
            try {
                const storedUsers = storage.getItem(key);
                const data = storedUsers ? JSON.parse(storedUsers) : [];
                if (!Array.isArray(data)) {
                    console.warn(`Data loaded from ${storageToUse} storage for key '${key}' is not an array. Returning []. Data:`, data);
                    storage.removeItem(key);
                    return [];
                }
                console.log(`Loaded ${data.length} items from ${storageToUse} storage for key '${key}'.`);
                return data;
            } catch (error) {
                console.error(`Error loading or parsing from ${storageToUse} storage key '${key}':`, error);
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

        let storageToUse = window.storageType;
        let usingForcedFallback = false;

        if (this.#indexedDBFailed) {
            console.warn(`StorageManager.saveUsers: IndexedDB previously failed. Forcing use of localStorage for key '${key}'.`);
            storageToUse = "local"; // Force localStorage
            usingForcedFallback = true;
        }

        console.log(`Saving ${usersArray.length} items for key '${key}'. Chosen storage: ${storageToUse}${usingForcedFallback ? ' (forced fallback)' : ''}. Original window.storageType: ${window.storageType}`);

        if (storageToUse === "indexedClicked" || storageToUse?.startsWith('IndexedDB:')) {
            // This block will now only be entered if IndexedDB did NOT fail.
            try {
                const idbKey = storageToUse.startsWith('IndexedDB:') ? storageToUse.substring(11) : key;
                console.log(`Saving to IndexedDB key: ${idbKey}`);
                await this.#saveToDB(idbKey, usersArray);
                console.log(`Saved to IndexedDB for key '${idbKey}'.`);
            } catch (error) {
                console.error(`Failed to save to IndexedDB for key '${key}' (storage type: ${storageToUse}).`, error);
                if (usingForcedFallback) { // Should not happen
                     console.error("Error during forced fallback to IndexedDB save. Data may not be saved.");
                }
                throw error; // Re-throw to indicate save failure
            }
        } else { // local or session
            const storage = storageToUse === "local" ? localStorage : sessionStorage;
            try {
                storage.setItem(key, JSON.stringify(usersArray));
                console.log(`Saved to ${storageToUse} storage for key '${key}'.`);
            } catch (error) {
                console.error(`Error saving to ${storageToUse} storage key '${key}':`, error);
                // Not re-throwing for localStorage/sessionStorage to maintain previous behavior,
                // but if it's a forced fallback, the user needs to know the save might have failed.
                if (usingForcedFallback) throw error;
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
        const storageTypeSelector = document.getElementById("storageType");
        if (!storageTypeSelector) {
            console.warn("Storage type selector element (#storageType) not found. Cannot populate options.");
            return;
        }
        console.log("Populating storage options...");
        const currentSelectedValue = storageTypeSelector.value;
        storageTypeSelector.innerHTML = ''; // Clear existing options

        storageTypeSelector.add(new Option('Local Storage', 'local'));
        storageTypeSelector.add(new Option('Session Storage', 'session'));
        // Only add IndexedDB options if it hasn't failed
        if (!this.#indexedDBFailed) {
            storageTypeSelector.add(new Option('IndexedDB (Default History)', 'indexedClicked'));
            try {
                const idbKeys = await this.getIndexedDBKeys(); // getIndexDBKeys calls #getStore, which now handles init states
                console.log("Found IndexedDB keys:", idbKeys);
                idbKeys.forEach(key => {
                    if (key !== 'previousUsers' && key !== 'removedUsers' && key !== 'indexedClicked' && key !== 'snippetList') {
                        storageTypeSelector.add(new Option(`IndexedDB: ${key}`, `IndexedDB:${key}`));
                    }
                });
            } catch (error) {
                console.warn("Could not populate custom IndexedDB keys. This is expected if IndexedDB failed to initialize:", error);
            }
        } else {
            console.warn("IndexedDB failed to initialize. Not populating IndexedDB storage options.");
        }

        let valueToSet = this.#indexedDBFailed ? 'local' : (currentSelectedValue || window.storageType);

        if (storageTypeSelector.querySelector(`option[value="${valueToSet}"]`)) {
            storageTypeSelector.value = valueToSet;
        } else {
            // If the desired valueToSet (e.g. an IDB option) isn't there because IDB failed, default to 'local'
            console.warn(`Storage type '${valueToSet}' not found in options or IDB failed. Defaulting to 'local'.`);
            storageTypeSelector.value = 'local';
        }
        window.storageType = storageTypeSelector.value;
        console.log(`Storage options populated. Current selection: ${window.storageType}`);
        if (this.#indexedDBFailed && storageTypeSelector.value.startsWith("IndexedDB")) {
             console.error("CRITICAL WARNING: IndexedDB failed, but an IndexedDB option is still selected. Forcing to local.");
             storageTypeSelector.value = 'local';
             window.storageType = 'local';
        }
    }

    async addTextSnippet(newSnippetText) {
        if (this.#indexedDBFailed) {
            console.log('StorageManager.addTextSnippet: Using localStorage due to IndexedDB failure.');
            try {
                let snippetList = [];
                const storedSnippets = localStorage.getItem('snippetList_fallback');
                if (storedSnippets) {
                    snippetList = JSON.parse(storedSnippets);
                    if (!Array.isArray(snippetList)) snippetList = [];
                }
                if (!snippetList.includes(newSnippetText)) {
                    snippetList.push(newSnippetText);
                    localStorage.setItem('snippetList_fallback', JSON.stringify(snippetList));
                    console.log('Snippet list updated in localStorage (fallback).');
                } else {
                    console.log('Snippet already exists in localStorage (fallback). Not adding duplicate.');
                }
            } catch (error) {
                console.error('Error adding text snippet to localStorage (fallback):', error);
                throw error; // Re-throw so UI can be notified
            }
        } else {
            try {
                let snippetList = await this.#loadFromDB('snippetList');
                if (!Array.isArray(snippetList)) {
                    snippetList = []; // Initialize if not an array or undefined
                }
                if (!snippetList.includes(newSnippetText)) {
                    snippetList.push(newSnippetText);
                    await this.#saveToDB('snippetList', snippetList);
                    console.log('Snippet list updated in IndexedDB.');
                } else {
                     console.log('Snippet already exists in IndexedDB. Not adding duplicate.');
                }
            } catch (error) {
                console.error('Error adding text snippet to IndexedDB:', error);
                throw error;
            }
        }
    }

    async loadAllTextSnippets() {
        if (this.#indexedDBFailed) {
            console.log('StorageManager.loadAllTextSnippets: Using localStorage due to IndexedDB failure.');
            try {
                const storedSnippets = localStorage.getItem('snippetList_fallback');
                if (storedSnippets) {
                    const snippetList = JSON.parse(storedSnippets);
                    return Array.isArray(snippetList) ? snippetList : [];
                }
                return [];
            } catch (error) {
                console.error('Error loading text snippets from localStorage (fallback):', error);
                return []; // Return empty array on error
            }
        } else {
            try {
                const snippets = await this.#loadFromDB('snippetList');
                console.log('Snippets loaded from IndexedDB.');
                return Array.isArray(snippets) ? snippets : [];
            } catch (error) {
                console.error('Error loading all text snippets from IndexedDB:', error);
                return [];
            }
        }
    }

    async deleteTextSnippet(snippetTextToDelete) {
        if (this.#indexedDBFailed) {
            console.log('StorageManager.deleteTextSnippet: Using localStorage due to IndexedDB failure.');
            try {
                let snippetList = [];
                const storedSnippets = localStorage.getItem('snippetList_fallback');
                if (storedSnippets) {
                    snippetList = JSON.parse(storedSnippets);
                    if (!Array.isArray(snippetList)) snippetList = [];
                }
                const initialLength = snippetList.length;
                snippetList = snippetList.filter(snippet => snippet !== snippetTextToDelete);
                if (snippetList.length < initialLength) {
                    localStorage.setItem('snippetList_fallback', JSON.stringify(snippetList));
                    console.log('Snippet list updated (after deletion) in localStorage (fallback).');
                } else {
                    console.warn(`Snippet to delete ("${snippetTextToDelete}") not found in localStorage (fallback).`);
                }
            } catch (error) {
                console.error('Error deleting text snippet from localStorage (fallback):', error);
                throw error; // Re-throw so UI can be notified
            }
        } else {
            try {
                let snippetList = await this.#loadFromDB('snippetList');
                if (!Array.isArray(snippetList)) {
                    snippetList = [];
                }
                const initialLength = snippetList.length;
                snippetList = snippetList.filter(snippet => snippet !== snippetTextToDelete);
                if (snippetList.length < initialLength) {
                    await this.#saveToDB('snippetList', snippetList);
                    console.log('Snippet list updated (after deletion) in IndexedDB.');
                } else {
                    console.warn(`Snippet to delete ("${snippetTextToDelete}") not found in IndexedDB list.`);
                }
            } catch (error) {
                console.error('Error deleting text snippet from IndexedDB:', error);
                throw error;
            }
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
