// --- Storage Functions ---

/**
 * Opens the IndexedDB database. Creates/upgrades the object store if needed.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance or rejects on error.
 */
function openIndexedDB() {
    return new Promise((resolve, reject) => {
         if (!('indexedDB' in window)) {
             console.warn("IndexedDB not supported by this browser.");
             reject(new Error("IndexedDB not supported."));
             return;
         }
        const request = indexedDB.open('UserDatabase', 1); // DB name and version

        request.onupgradeneeded = function(event) {
            const db = event.target.result;
             console.log("IndexedDB upgrade needed or creating database.");
             if (!db.objectStoreNames.contains('users')) { // Use a consistent object store name
                  const objectStore = db.createObjectStore('users', { keyPath: 'key' }); // Store key-value pairs
                 console.log("Created object store: 'users'");
                 // Example: Add index if needed for querying later
                 // objectStore.createIndex('username', 'value.username', { unique: false });
             } else {
                 console.log("Object store 'users' already exists.");
             }
        };

        request.onsuccess = function(event) {
            const db = event.target.result;
             // Generic DB error handler for errors not caught by specific requests
             db.onerror = (errEvent) => console.error("IndexedDB Database Error:", errEvent.target.error);
            resolve(db);
        };

        request.onerror = function(event) {
            console.error("IndexedDB Open Error:", event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Loads data for a specific key from the IndexedDB 'users' store.
 * @param {string} key - The key to retrieve (e.g., 'previousUsers').
 * @returns {Promise<Array<Object>>} Resolves with the data array, or an empty array if not found or on error.
 */
async function loadFromIndexedDB(key) {
    let db;
    try {
        db = await openIndexedDB();
    } catch (error) {
        console.error(`Failed to open IndexedDB for loading key '${key}':`, error);
        return []; // Return empty array if DB fails to open
    }

    return new Promise((resolve) => { // No reject needed, resolve with [] on error
        const transaction = db.transaction('users', 'readonly');
        const store = transaction.objectStore('users');
        const request = store.get(key);

        request.onsuccess = function(event) {
             // Data is stored in the 'value' property of the object { key: 'keyName', value: [...] }
            const result = event.target.result;
            resolve(result ? result.value : []);
        };
        request.onerror = function(event) {
            console.error(`IndexedDB Load Error for key '${key}':`, event.target.error);
            // Resolve with empty array on load error to allow the app to continue
            resolve([]);
        };
         transaction.oncomplete = () => { db.close(); /* console.log(`IDB load transaction for ${key} complete.`); */ };
         transaction.onerror = (event) => console.error(`IDB load transaction error for ${key}:`, event.target.error); // Should not happen if request errors handled
    });
}

/**
 * Saves data (an array of users) for a specific key to the IndexedDB 'users' store.
 * @param {string} key - The key to save under (e.g., 'previousUsers').
 * @param {Array<Object>} users - The array of user objects to save.
 * @returns {Promise<void>} Resolves when the save is complete, rejects on error.
 */
async function saveToIndexedDB(key, users) {
    if (!Array.isArray(users)) {
        console.error(`Attempted to save non-array data to IndexedDB for key '${key}'. Aborting. Data:`, users);
        return Promise.reject(new Error("Invalid data type: Expected an array.")); // Reject promise for clarity
    }

    let db;
    try {
        db = await openIndexedDB();
    } catch (error) {
         console.error(`Failed to open IndexedDB for saving key '${key}':`, error);
        throw error; // Propagate the error
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction('users', 'readwrite');
        const store = transaction.objectStore('users');
        // Store the data as an object: { key: 'yourKey', value: yourArray }
        const request = store.put({ key: key, value: users });

        request.onsuccess = function() {
            // Let transaction.oncomplete handle final resolution
        };
        request.onerror = function(event) {
             console.error(`IndexedDB Put Error for key '${key}':`, event.target.error);
             // Don't close DB here, let transaction error handler do it potentially
             reject(event.target.error); // Reject the promise on request error
        };

         // Transaction level events are more reliable for completion/failure
         transaction.oncomplete = () => {
             /* console.log(`IndexedDB transaction for key '${key}' complete.`); */
             db.close();
             resolve();
         };
         transaction.onabort = (event) => {
             console.error(`IndexedDB transaction for key '${key}' aborted.`, event.target.error || 'Unknown abort reason');
             db.close();
             reject(event.target.error || new Error('Transaction aborted'));
         };
          transaction.onerror = (event) => {
             console.error(`IndexedDB transaction error for key '${key}'.`, event.target.error);
             db.close(); // Close DB even on transaction error
             reject(event.target.error);
         };
    });
}

/**
 * Loads user data (expected to be an array) from the currently selected storage type.
 * Uses the global `storageType` variable.
 * @param {string} key - The storage key (e.g., 'previousUsers').
 * @returns {Promise<Array<Object>>} Resolves with the loaded data array or an empty array on error/not found.
 */
async function loadUsers(key) {
    console.log(`Loading data for key '${key}' using storage type: ${storageType}`);
    if (storageType === "indexedClicked" || storageType.startsWith('IndexedDB:')) { // Handle both the default value and potential custom keys
        try {
             // If using custom keys, extract the actual key name
             const idbKey = storageType.startsWith('IndexedDB:') ? storageType.substring(11) : key;
             console.log(`Using IndexedDB key: ${idbKey}`);
             const data = await loadFromIndexedDB(idbKey);
             console.log(`Loaded ${data.length} items from IndexedDB for key '${idbKey}'.`);
             return Array.isArray(data) ? data : []; // Ensure it returns an array
        } catch (error) {
             console.error(`Failed to load from IndexedDB for key '${key}' (storage type: ${storageType}).`, error);
             return []; // Fallback to empty array on IDB load error
        }
    } else {
        const storage = storageType === "local" ? localStorage : sessionStorage;
        try {
            const storedUsers = storage.getItem(key);
             const data = storedUsers ? JSON.parse(storedUsers) : [];
             // Validate that the parsed data is an array
             if (!Array.isArray(data)) {
                 console.warn(`Data loaded from ${storageType} storage for key '${key}' is not an array. Returning []. Data:`, data);
                 storage.removeItem(key); // Optionally remove invalid data
                 return [];
             }
             console.log(`Loaded ${data.length} items from ${storageType} storage for key '${key}'.`);
            return data;
        } catch (error) {
             console.error(`Error loading or parsing from ${storageType} storage key '${key}':`, error);
             // Optionally try to remove corrupted data
             try { storage.removeItem(key); } catch (e) { /* ignore remove error */ }
             return []; // Return empty array on error
        }
    }
}

/**
 * Saves user data (an array) to the currently selected storage type.
 * Uses the global `storageType` variable.
 * @param {string} key - The storage key (e.g., 'previousUsers').
 * @param {Array<Object>} users - The array of user objects to save.
 * @returns {Promise<void>} Resolves when saved, rejects on IndexedDB errors.
 */
async function saveUsers(key, users) {
    if (!Array.isArray(users)) {
        console.error(`Attempted to save non-array data for key '${key}'. Aborting save. Data:`, users);
        return; // Don't save invalid data
    }
     console.log(`Saving ${users.length} items for key '${key}' using storage type: ${storageType}`);

    if (storageType === "indexedClicked" || storageType.startsWith('IndexedDB:')) { // Handle default and custom keys
         try {
              // If using custom keys, extract the actual key name
             const idbKey = storageType.startsWith('IndexedDB:') ? storageType.substring(11) : key;
             console.log(`Saving to IndexedDB key: ${idbKey}`);
             await saveToIndexedDB(idbKey, users);
             console.log(`Saved to IndexedDB for key '${idbKey}'.`);
        } catch (error) {
             console.error(`Failed to save to IndexedDB for key '${key}' (storage type: ${storageType}).`, error);
             // Optionally notify the user about the save failure
             // showUserMessage("Failed to save history to IndexedDB.", 'error');
             throw error; // Re-throw IDB errors so caller knows it failed
        }
    } else {
        const storage = storageType === "local" ? localStorage : sessionStorage;
        try {
            storage.setItem(key, JSON.stringify(users));
             console.log(`Saved to ${storageType} storage for key '${key}'.`);
        } catch (error) {
             console.error(`Error saving to ${storageType} storage key '${key}':`, error);
             // Notify the user about the save failure (e.g., quota exceeded)
             // showUserMessage(`Failed to save history to ${storageType} storage. Storage might be full.`, 'error');
             // Don't re-throw, as localStorage/sessionStorage errors are less critical than IDB usually
        }
    }
}

/**
 * Gets all keys currently stored in the IndexedDB 'users' object store.
 * Useful for populating storage type options with custom saved lists.
 * @returns {Promise<string[]>} A promise resolving with an array of keys, or empty array on error.
 */
 async function getIndexedDBKeys() {
     let db;
     try {
         db = await openIndexedDB();
     } catch (error) {
         console.warn("Failed to open IndexedDB to get keys:", error);
         return []; // Return empty array if DB fails to open
     }

     return new Promise((resolve) => { // Resolve with [] on error
         const transaction = db.transaction('users', 'readonly');
         const store = transaction.objectStore('users');
         const request = store.getAllKeys(); // Get all keys from the store

         request.onsuccess = function(event) {
             resolve(event.target.result || []);
         };

         request.onerror = function(event) {
             console.error("IndexedDB getAllKeys Error:", event.target.error);
             resolve([]); // Resolve with empty array on error
         };

         transaction.oncomplete = () => { db.close(); /* console.log("IDB getAllKeys transaction complete."); */ };
         transaction.onerror = (event) => console.error("IDB getAllKeys transaction error:", event.target.error);
     });
 }

 /**
  * Initializes the options for the storage type selector.
  * Includes standard options (Local, Session, IndexedDB) and any custom keys found in IndexedDB.
  * @returns {Promise<void>}
  */
 async function populateStorageOptions() {
     if (!storageTypeSelector) {
         console.warn("Storage type selector element (#storageType) not found. Cannot populate options.");
         return;
     }
     console.log("Populating storage options...");

     const currentSelectedValue = storageTypeSelector.value; // Preserve current selection if possible
     storageTypeSelector.innerHTML = ''; // Clear existing options

     // Add standard options
     storageTypeSelector.add(new Option('Local Storage', 'local'));
     storageTypeSelector.add(new Option('Session Storage', 'session'));
     storageTypeSelector.add(new Option('IndexedDB (Default History)', 'indexedClicked')); // Primary IndexedDB option

     // Add keys found in IndexedDB as separate options (potentially for saved lists)
     try {
         const idbKeys = await getIndexedDBKeys();
          console.log("Found IndexedDB keys:", idbKeys);
         idbKeys.forEach(key => {
             // Avoid adding the default keys again or internal keys
             if (key !== 'previousUsers' && key !== 'removedUsers' && key !== 'indexedClicked') {
                  // Use a prefix to distinguish these custom keys in the value
                  const optionValue = `IndexedDB:${key}`;
                  const optionText = `IndexedDB: ${key}`; // Display key name
                  storageTypeSelector.add(new Option(optionText, optionValue));
                  console.log(`Added custom IndexedDB key '${key}' as storage option.`);
             }
         });
     } catch (error) {
         console.warn("Could not populate custom IndexedDB keys:", error);
         // Error should have been logged by getIndexedDBKeys
     }

      // Try to restore the previous selection, or default to the current state `storageType`
      let valueToSet = currentSelectedValue || storageType;
      if (storageTypeSelector.querySelector(`option[value="${valueToSet}"]`)) {
          storageTypeSelector.value = valueToSet;
      } else {
          // If the previous/current value isn't valid anymore, default to 'local'
          console.warn(`Storage type '${valueToSet}' not found in options. Defaulting to 'local'.`);
          storageTypeSelector.value = 'local';
      }
      // Update the global state variable to match the final selector value
      storageType = storageTypeSelector.value;
      console.log(`Storage options populated. Current selection: ${storageType}`);
 }
