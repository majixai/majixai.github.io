/**
 * Main script for the Room Viewer application.
 * Handles fetching, filtering, displaying, and managing user history.
 */
document.addEventListener('DOMContentLoaded', async function () {

    console.log("DOM fully loaded. Initializing application...");

    // --- Utility Class ---
    // Provides helper methods for API interaction and logging
    class Utils {
        /**
         * Wrapper to add basic error logging to async functions.
         * @param {Function} func - The async function to wrap.
         * @returns {Function} - The wrapped function.
         */
        static asyncWrapper(func) {
            return async function (...args) {
                try {
                    return await func.apply(this, args);
                } catch (error) {
                    console.error(`Error in function '${func.name}':`, error);
                    // Potentially display a user-friendly error message in the UI
                    // this.displayErrorMessage(`An error occurred in ${func.name}. Check console.`);
                }
            };
        }

        /**
         * Decorator-like function to log function execution time.
         * Note: Standard decorators require Babel/TypeScript setup. This is a manual wrapper.
         * To use: Utils.logExecutionTime(() => this.someMethod());
         * @param {Function} func - The function to measure.
         * @param {string} [name=func.name] - Optional name for logging.
         * @returns {*} - The result of the function.
         */
        static logExecutionTime(func, name = func.name || 'Anonymous') {
            const start = performance.now();
            const result = func();
            const end = performance.now();
            console.log(`${name} executed in ${end - start} ms`);
            return result;
        }

        /**
         * Generator to iterate over paginated API results.
         * Handles fetching multiple pages until no more results or limit is reached.
         * @param {string} baseUrl - The base API URL (before limit/offset).
         * @param {number} limit - The maximum number of items per page.
         * @param {number} [maxPages=Infinity] - Maximum number of pages to fetch.
         */
        static async *apiPaginator(baseUrl, limit, maxPages = Infinity) {
            let offset = 0;
            let continueFetching = true;
            let pageCount = 0;

            while (continueFetching && pageCount < maxPages) {
                const apiUrl = `${baseUrl}&limit=${limit}&offset=${offset}`;
                console.log(`Fetching API page: ${apiUrl}`);
                try {
                    const response = await fetch(apiUrl);
                    if (!response.ok) {
                         // Attempt to read error body if available
                         const errorBody = await response.text().catch(() => `Status: ${response.status}`);
                         throw new Error(`HTTP error! status: ${response.status}, details: ${errorBody}`);
                    }
                    const data = await response.json();

                    if (data.results && data.results.length > 0) {
                        yield data.results; // Yield the current batch of results
                        offset += limit;
                        pageCount++;
                        // Stop fetching if the number of results is less than the limit (last page)
                        if (data.results.length < limit) {
                            continueFetching = false;
                        }
                    } else {
                         // No results in this batch, stop fetching
                        continueFetching = false;
                    }
                } catch (error) {
                    console.error("API Paginator Fetch Error:", error);
                    continueFetching = false; // Stop on error
                    // Re-throw the error so the caller can handle it if needed
                    throw error;
                }
            }
            if (pageCount >= maxPages) {
                 console.warn(`API Paginator stopped after reaching maxPages (${maxPages}).`);
            }
        }

         /**
         * Checks if a user's birthday is today.
         * @param {string | Date | null} birthday - The user's birthday.
         * @returns {boolean} - True if birthday is today, false otherwise.
         */
        static isBirthday(birthday) {
            if (!birthday) return false;
            try {
                const today = new Date();
                const birthDate = new Date(birthday);
                 // Check if the date is valid before comparing
                if (isNaN(birthDate.getTime())) {
                     console.warn("Invalid birthday date string:", birthday);
                     return false;
                }
                return today.getDate() === birthDate.getDate() && today.getMonth() === birthDate.getMonth();
            } catch (e) {
                 console.error("Error checking birthday:", e);
                 return false;
            }
        }
    }

    // --- Storage Manager Class ---
    // Handles loading and saving data using different storage mechanisms.
    class StorageManager {
        constructor(storageType = 'local') {
            this.storageType = storageType;
            this.dbName = 'UserDatabase'; // IndexedDB database name
            this.dbVersion = 1;
            this.storeName = 'users'; // IndexedDB object store name
            this.db = null; // Placeholder for IndexedDB connection

            // Initialize IndexedDB connection early
             Utils.asyncWrapper(async () => {
                 try {
                     this.db = await this.#openIndexedDB();
                     console.log("IndexedDB opened successfully.");
                     // Optionally populate storage options after DB opens
                     // this.populateStorageOptions(); // Needs DOM access, better in UserManager
                 } catch (error) {
                     console.error("Failed to open IndexedDB:", error);
                     // Handle failure, perhaps disable IndexedDB option in UI
                 }
             }).call(this); // Use .call(this) to set the context
        }

        /**
         * Sets the storage type.
         * @param {string} type - 'local', 'session', or 'indexedDB'.
         */
        setStorageType(type) {
            if (['local', 'session', 'indexedDB'].includes(type)) {
                this.storageType = type;
                console.log(`Storage type set to: ${this.storageType}`);
            } else {
                console.warn(`Invalid storage type: ${type}. Keeping ${this.storageType}.`);
            }
        }

        /**
         * Loads data from storage.
         * @param {string} key - The key to load.
         * @returns {Promise<Array<Object>>} - Promise resolving with the data array.
         */
        async load(key) {
            if (this.storageType === "indexedDB") {
                if (!this.db) {
                     console.warn("IndexedDB not available, cannot load.");
                     return [];
                }
                return await this.#loadFromIndexedDB(key);
            } else {
                const storage = this.storageType === "local" ? localStorage : sessionStorage;
                try {
                    const storedData = storage.getItem(key);
                    return storedData ? JSON.parse(storedData) : [];
                } catch (error) {
                    console.error(`Error loading from ${this.storageType} storage key '${key}':`, error);
                    return []; // Return empty array on error
                }
            }
        }

        /**
         * Saves data to storage.
         * @param {string} key - The key to save under.
         * @param {Array<Object>} data - The data array to save.
         * @returns {Promise<void>} - Promise resolving when save is complete.
         */
        async save(key, data) {
             // Ensure data is an array before saving
             if (!Array.isArray(data)) {
                 console.error(`Attempted to save non-array data for key '${key}'. Aborting save.`, data);
                 return; // Prevent saving invalid data
             }

            if (this.storageType === "indexedDB") {
                 if (!this.db) {
                     console.warn("IndexedDB not available, cannot save.");
                     return;
                 }
                await this.#saveToIndexedDB(key, data);
            } else {
                const storage = this.storageType === "local" ? localStorage : sessionStorage;
                 try {
                    storage.setItem(key, JSON.stringify(data));
                 } catch (error) {
                     console.error(`Error saving to ${this.storageType} storage key '${key}':`, error);
                      // Depending on requirements, you might want to notify the user
                 }
            }
        }

        /**
         * Opens the IndexedDB database and creates object store if necessary.
         * @returns {Promise<IDBDatabase>}
         * @private
         */
        #openIndexedDB() {
            return new Promise((resolve, reject) => {
                if (!('indexedDB' in window)) {
                    reject(new Error("IndexedDB not supported by this browser."));
                    return;
                }
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onupgradeneeded = function(event) {
                    const db = event.target.result;
                    console.log("IndexedDB upgrade needed or creating database.");
                    // Check if the object store already exists before creating
                    if (!db.objectStoreNames.contains(this.storeName)) {
                         const objectStore = db.createObjectStore(this.storeName, { keyPath: 'key' });
                         console.log(`Created object store: ${this.storeName}`);
                         // Add indexes if needed later
                         // objectStore.createIndex('username', 'value.username', { unique: false });
                    } else {
                         console.log(`Object store '${this.storeName}' already exists.`);
                    }
                }.bind(this); // Bind 'this' to access storeName

                request.onsuccess = function(event) {
                    const db = event.target.result;
                    db.onerror = (err) => console.error("IndexedDB Database Error:", err.target.error); // Generic error handler
                    resolve(db);
                };

                request.onerror = function(event) {
                    console.error("IndexedDB Open Error:", event.target.error);
                    reject(event.target.error);
                };
            });
        }

        /**
         * Loads data for a specific key from IndexedDB.
         * @param {string} key - The key to load.
         * @returns {Promise<Array<Object>>}
         * @private
         */
        #loadFromIndexedDB(key) {
            return new Promise(async (resolve, reject) => {
                 if (!this.db) {
                     reject(new Error("IndexedDB not initialized."));
                     return;
                 }
                 const transaction = this.db.transaction(this.storeName, 'readonly');
                 const store = transaction.objectStore(this.storeName);
                 const request = store.get(key);

                 request.onsuccess = function(event) {
                     // Data is stored in the 'value' property { key: 'keyName', value: [...] }
                     resolve(event.target.result ? event.target.result.value : []);
                 };

                 request.onerror = function(event) {
                     console.error(`IndexedDB Load Error for key '${key}':`, event.target.error);
                     reject(event.target.error);
                 };
            });
        }

        /**
         * Saves data for a specific key to IndexedDB.
         * @param {string} key - The key to save under.
         * @param {Array<Object>} data - The data array.
         * @returns {Promise<void>}
         * @private
         */
        #saveToIndexedDB(key, data) {
            return new Promise(async (resolve, reject) => {
                 if (!this.db) {
                     reject(new Error("IndexedDB not initialized."));
                     return;
                 }
                 const transaction = this.db.transaction(this.storeName, 'readwrite');
                 const store = transaction.objectStore(this.storeName);

                 const request = store.put({ key: key, value: data }); // Store as { key, value }

                 request.onsuccess = function() {
                     resolve();
                 };

                 request.onerror = function(event) {
                     console.error(`IndexedDB Save Error for key '${key}':`, event.target.error);
                     reject(event.target.error);
                 };

                 // Ensure transaction completes successfully
                 transaction.oncomplete = () => console.log(`IndexedDB transaction for key '${key}' complete.`);
                 transaction.onabort = (event) => {
                     console.error(`IndexedDB transaction for key '${key}' aborted.`, event.target.error);
                     reject(event.target.error);
                 };
            });
        }

         /**
         * Gets all keys currently stored in the IndexedDB object store.
         * Useful for populating storage type options.
         * @returns {Promise<string[]>}
         */
         async getIndexedDBKeys() {
             return new Promise((resolve, reject) => {
                 if (!this.db) {
                     reject(new Error("IndexedDB not initialized."));
                     return;
                 }
                 const transaction = this.db.transaction(this.storeName, 'readonly');
                 const store = transaction.objectStore(this.storeName);
                 const request = store.getAllKeys();

                 request.onsuccess = function(event) {
                     resolve(event.target.result || []);
                 };

                 request.onerror = function(event) {
                     console.error("IndexedDB get all keys error:", event.target.error);
                     reject(event.target.error);
                 };
             });
         }

          /**
          * Clears a specific key from storage.
          * @param {string} key - The key to clear.
          * @returns {Promise<void>}
          */
         async clear(key) {
             if (this.storageType === "indexedDB") {
                 if (!this.db) {
                     console.warn("IndexedDB not available, cannot clear.");
                     return;
                 }
                 return new Promise((resolve, reject) => {
                     const transaction = this.db.transaction(this.storeName, 'readwrite');
                     const store = transaction.objectStore(this.storeName);
                     const request = store.delete(key);

                     request.onsuccess = () => resolve();
                     request.onerror = (event) => {
                         console.error(`IndexedDB Clear Error for key '${key}':`, event.target.error);
                         reject(event.target.error);
                     };
                      transaction.oncomplete = () => console.log(`IndexedDB clear transaction for key '${key}' complete.`);
                     transaction.onabort = (event) => {
                         console.error(`IndexedDB clear transaction for key '${key}' aborted.`, event.target.error);
                         reject(event.target.error);
                     };
                 });
             } else {
                 const storage = this.storageType === "local" ? localStorage : sessionStorage;
                 try {
                    storage.removeItem(key);
                 } catch (error) {
                    console.error(`Error clearing ${this.storageType} storage key '${key}':`, error);
                 }
             }
         }
    }


    // --- UserManager Class ---
    // Manages fetching, filtering, displaying, and previous users list.
    class UserManager {
        constructor() {
            // --- DOM References ---
            this.onlineUsersDiv = document.getElementById("onlineUsers")?.querySelector('.user-list');
            this.previousUsersDiv = document.getElementById("previousUsers")?.querySelector('.user-list');
            this.mainIframe = document.getElementById("mainIframe");
            this.mainIframe2 = document.getElementById("mainIframe2");
            this.storageTypeSelector = document.getElementById("storageType");
            this.filterTagsSelect = document.getElementById("filterTags");
            this.filterAgeSelect = document.getElementById("filterAge");
            this.filterAge18Button = document.getElementById("filterAge18"); // Specific Age 18 button
            this.filterTagAsianButton = document.getElementById("filterTagAsian"); // Specific Tag Asian button
            this.filterTagBlondeButton = document.getElementById("filterTagBlonde"); // Specific Tag Blonde button
            this.clearPreviousUsersButton = document.getElementById("clearPreviousUsers"); // Button to clear history
            this.onlineLoadingIndicator = document.getElementById("onlineLoadingIndicator"); // Optional loading element
            this.onlineErrorDisplay = document.getElementById("onlineErrorDisplay"); // Optional error element


            // --- State ---
            this.storageManager = new StorageManager(this.storageTypeSelector?.value || 'local'); // Initialize StorageManager
            this.previousUsers = []; // Users in the history list (saved)
            this.allOnlineUsersData = []; // Currently fetched online users (fresh data)
            this.fetchInterval = null; // To hold the interval ID

            // --- Configuration ---
            this.apiUrlBase = 'https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f';
            this.apiLimit = 500; // Limit per API page
            this.fetchIntervalDuration = 300000; // 5 minutes in ms (300 * 1000)
            this.maxHistorySize = 50; // Maximum number of users to store in previousUsers

            // --- Initialize ---
            this.#validateDOMReferences();
            Utils.asyncWrapper(() => this.#initialize()).call(this); // Wrap async init
        }

        /** Validate essential DOM elements exist. */
        #validateDOMReferences() {
             if (!this.onlineUsersDiv || !this.previousUsersDiv || !this.mainIframe || !this.mainIframe2 || !this.storageTypeSelector || !this.filterTagsSelect || !this.filterAgeSelect) {
                 console.error("ERROR: Essential DOM elements not found!");
                 // Optionally throw error or disable functionality
                 // throw new Error("Missing required DOM elements.");
             }
        }

        /** Main initialization logic. */
        async #initialize() {
            await this.#loadPreviousUsers(); // Load history from storage

            this.#setupEventListeners();
            await this.fetchOnlineUsers(); // Initial fetch
            this.#startFetchInterval(); // Start periodic fetching

             // Display previous users after initial fetch completes (so we have online data)
             // Ensure displayPreviousUsers is called AFTER allOnlineUsersData is populated
             // This happens within fetchOnlineUsers -> displayOnlineUsers -> displayPreviousUsers flow now
        }

        /** Set up all event listeners. */
        #setupEventListeners() {
            // Storage Type Change
            this.storageTypeSelector?.addEventListener("change", Utils.asyncWrapper(async () => {
                const selectedType = this.storageTypeSelector.value;
                this.storageManager.setStorageType(selectedType);
                await this.#loadPreviousUsers(); // Reload history from new storage type
                this.#displayPreviousUsers(); // Refresh display
            }).bind(this)); // Bind 'this'

            // Filter Selects Change
            this.filterTagsSelect?.addEventListener("change", Utils.logExecutionTime(this.applyFiltersAndDisplay.bind(this), 'applyFilters (tags)'));
            this.filterAgeSelect?.addEventListener("change", Utils.logExecutionTime(this.applyFiltersAndDisplay.bind(this), 'applyFilters (age)'));

            // Filter Buttons Click (Pass specific filter overrides)
            this.filterAge18Button?.addEventListener("click", Utils.logExecutionTime(() => this.applyFiltersAndDisplay({ age: 18 }), 'applyFilters (btn18)'));
            this.filterTagAsianButton?.addEventListener("click", Utils.logExecutionTime(() => this.applyFiltersAndDisplay({ tag: 'asian' }), 'applyFilters (btnAsian)'));
            this.filterTagBlondeButton?.addEventListener("click", Utils.logExecutionTime(() => this.applyFiltersAndDisplay({ tag: 'blonde' }), 'applyFilters (btnBlonde)'));
            // Add more filter button listeners here...

            // Clear Previous Users Button
            this.clearPreviousUsersButton?.addEventListener("click", Utils.asyncWrapper(this.#clearPreviousUsers).bind(this));
        }

        /** Starts the periodic fetching interval. */
        #startFetchInterval() {
            if (this.fetchInterval) {
                clearInterval(this.fetchInterval); // Clear existing interval if any
            }
            this.fetchInterval = setInterval(Utils.asyncWrapper(this.fetchOnlineUsers).bind(this), this.fetchIntervalDuration);
            console.log(`Started fetching interval (${this.fetchIntervalDuration / 1000}s).`);
        }

        /** Fetches online user data from the API, populates filters, and displays users. */
        async fetchOnlineUsers() {
            console.log("Fetching online users...");
            this.showLoadingIndicator("Loading online users...");
            this.clearErrorDisplay(); // Clear previous errors

            this.allOnlineUsersData = []; // Reset data array

            try {
                 // Use the paginator generator
                for await (const batch of Utils.apiPaginator(this.apiUrlBase, this.apiLimit)) {
                    this.allOnlineUsersData = this.allOnlineUsersData.concat(batch);
                    this.showLoadingIndicator(`Fetching batch ${Math.ceil(this.allOnlineUsersData.length / this.apiLimit)}...`);
                }
                 console.log(`Successfully fetched ${this.allOnlineUsersData.length} online users.`);

                Utils.logExecutionTime(this.populateFilters.bind(this), 'populateFilters');
                Utils.logExecutionTime(this.applyFiltersAndDisplay.bind(this), 'applyFiltersAndDisplay (after fetch)'); // Apply filters after fetching
                this.#displayPreviousUsers(); // Refresh previous users based on NEW online data

            } catch (error) {
                console.error("Error during fetchOnlineUsers:", error);
                this.showErrorDisplay(`Failed to fetch online users. ${error.message}`);
                this.onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error loading users.</p>'; // Clear online list on error
            } finally {
                this.hideLoadingIndicator(); // Always hide indicator
            }
        }

        /** Populates the tag and age filter dropdowns. */
        populateFilters() {
             if (!this.filterTagsSelect || !this.filterAgeSelect) {
                  console.warn("Filter select elements not found. Skipping populateFilters.");
                  return;
             }
            const tagFrequency = {};
            const ages = new Set();

            this.allOnlineUsersData.forEach(user => {
                if (user.tags) {
                    user.tags.forEach(tag => {
                        // Normalize tags to lowercase? Depends on API consistency. Assuming lowercase for now.
                        const lowerTag = tag.toLowerCase();
                        tagFrequency[lowerTag] = (tagFrequency[lowerTag] || 0) + 1;
                    });
                }
                if (user.age && typeof user.age === 'number') { // Ensure age is a number
                    ages.add(user.age);
                }
            });

            // Sort tags by frequency, then alphabetically if tied
            const sortedTags = Object.entries(tagFrequency)
                .sort(([, countA], [, countB]) => countB - countA) // Sort by count descending
                .slice(0, 50) // Limit to top 50 tags for performance/UI
                .map(entry => entry[0]); // Get just the tag names

             // Keep current selections if options existed before repopulating
             const selectedTags = Array.from(this.filterTagsSelect.selectedOptions).map(opt => opt.value);
             this.filterTagsSelect.innerHTML = '<option value="">-- Select Tag --</option>' + // Add default option
                 sortedTags.map(tag =>
                     `<option value="${tag}" ${selectedTags.includes(tag) ? 'selected' : ''}>${tag} (${tagFrequency[tag]})</option>`
                 ).join('');

            // Sort ages numerically
            const sortedAges = Array.from(ages).sort((a, b) => a - b);
             const selectedAges = Array.from(this.filterAgeSelect.selectedOptions).map(opt => parseInt(opt.value));
            this.filterAgeSelect.innerHTML = '<option value="">-- Select Age --</option>' + // Add default option
                 sortedAges.map(age =>
                     `<option value="${age}" ${selectedAges.includes(age) ? 'selected' : ''}>${age}</option>`
                 ).join('');

             // Optional: Populate IndexedDB keys to storage selector if manager supports it
             if (typeof this.storageManager.getIndexedDBKeys === 'function' && this.storageTypeSelector) {
                 Utils.asyncWrapper(async () => {
                     try {
                         const keys = await this.storageManager.getIndexedDBKeys();
                         const existingValues = Array.from(this.storageTypeSelector.options).map(opt => opt.value);
                         keys.forEach(key => {
                             if (!existingValues.includes(key)) {
                                 const option = new Option(key, key); // Text and value are the key
                                 this.storageTypeSelector.add(option);
                                 console.log(`Added IndexedDB key '${key}' to storage options.`);
                             }
                         });
                     } catch (error) {
                         console.warn("Could not populate IndexedDB keys to storage options:", error);
                     }
                 }).call(this);
             }
        }

        /**
         * Applies filters from selects and/or button overrides and displays users.
         * @param {Object} [buttonFilters={}] - Optional filters from specific buttons { tag: 'tagName' } or { age: 18 }.
         */
        applyFiltersAndDisplay(buttonFilters = {}) {
            console.log("Applying filters...", { buttonFilters });

            // Determine filters from selects or button overrides
            const filterTags = buttonFilters.tag ? [buttonFilters.tag.toLowerCase()] : Array.from(this.filterTagsSelect?.selectedOptions || []).map(option => option.value.toLowerCase());
            const filterAges = buttonFilters.age ? [buttonFilters.age] : Array.from(this.filterAgeSelect?.selectedOptions || []).map(option => parseInt(option.value));

            // Apply filters to the full online user data
            const filteredUsers = this.allOnlineUsersData.filter(user => {
                const isPublic = user.current_show === 'public';
                // Check if user has AT LEAST ONE of the selected tags, or if no tags are selected
                const hasTags = filterTags.length === 0 || filterTags.some(tag => user.tags?.map(t => t.toLowerCase()).includes(tag));
                 // Check if user matches AT LEAST ONE of the selected ages, or if no ages are selected
                const isAgeMatch = filterAges.length === 0 || (user.age && filterAges.includes(user.age));
                // Add filter for 'New' status if needed
                // const isNew = buttonFilters.is_new ? user.is_new : true; // Filter by new if buttonFilters has it

                return isPublic && hasTags && isAgeMatch; // && isNew;
            });

            this.displayOnlineUsers(filteredUsers);
        }

        /** Displays the given list of online users in the online users div. */
        displayOnlineUsers(usersToDisplay) {
             if (!this.onlineUsersDiv) {
                  console.warn("Online users display div not found. Skipping displayOnlineUsers.");
                  return;
             }
            console.log(`Displaying ${usersToDisplay.length} filtered online users.`);
            this.onlineUsersDiv.innerHTML = ""; // Clear previous list

            if (usersToDisplay.length === 0) {
                this.onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found with these filters.</p>';
                return;
            }

            // Sort users (optional, e.g., by tokens, viewers, age, alphabetical)
            // usersToDisplay.sort((a, b) => b.num_tokens - a.num_tokens); // Example: Sort by tokens

            usersToDisplay.forEach(user => {
                // Basic data validation before creating element
                if (!user.image_url || !user.username || !user.iframe_embed) {
                    console.warn("Skipping user with incomplete data:", user);
                    return;
                }
                const userElement = this.#createUserElement(user, 'online'); // Indicate it's for the online list
                this.onlineUsersDiv.appendChild(userElement);
            });
        }

         /** Displays the previous users list, checking their current online status. */
         #displayPreviousUsers() {
             if (!this.previousUsersDiv) {
                  console.warn("Previous users display div not found. Skipping displayPreviousUsers.");
                  return;
             }
             console.log(`Displaying previous users list (${this.previousUsers.length} saved).`);
             this.previousUsersDiv.innerHTML = ""; // Clear previous list

             if (this.previousUsers.length === 0) {
                 this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users saved.</p>';
                 return;
             }

             // Filter previous users to show only those currently online and public
             const currentlyOnlineAndPublicPreviousUsers = this.previousUsers.filter(prevUser => {
                 // Find the user in the current online data
                 const onlineUser = this.allOnlineUsersData.find(online => online.username === prevUser.username);
                 // Check if found AND if their current show status is 'public'
                 return onlineUser && onlineUser.current_show === 'public';
             });

             console.log(`Displaying ${currentlyOnlineAndPublicPreviousUsers.length} previous users (currently online & public).`);

             if (currentlyOnlineAndPublicPreviousUsers.length === 0) {
                  this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">None of your saved users are currently online & public.</p>';
                  return;
             }

             // Sort previous users by the order in the this.previousUsers array (most recent click first)
             currentlyOnlineAndPublicPreviousUsers.forEach(user => {
                 // Create the element. Pass 'previous' type to potentially style differently or add remove button
                 const userElement = this.#createUserElement(user, 'previous');
                 this.previousUsersDiv.appendChild(userElement);
             });
         }


        /**
         * Creates a DOM element for a single user with all details and event listeners.
         * @param {Object} user - The user object.
         * @param {'online' | 'previous'} listType - The type of list this element is for.
         * @returns {HTMLElement} - The created div element.
         */
        #createUserElement(user, listType) {
            const userElement = document.createElement("div");
            userElement.className = `user-info ${listType}-list-item`; // Add class for list type
            userElement.dataset.username = user.username; // Store username on the element

            // Use template literal for structure and details
            userElement.innerHTML = `
                <img src="${user.image_url}" alt="${user.username} thumbnail" loading="lazy"> <!-- Add alt text and lazy loading -->
                <div class="user-details">
                    <p class="username">${user.username}</p>
                    <p>Age: ${user.age || 'N/A'} ${user.is_new ? '<span class="badge new-badge">New</span>' : ''}</p> <!-- Add span for styling 'New' -->
                    <p class="tags">Tags: ${user.tags?.join(', ') || 'N/A'}</p> <!-- Handle missing tags -->
                    ${Utils.isBirthday(user.birthday) ? `<p class="birthday">🎂 Happy Birthday! 🎂</p>` : ''} <!-- Use static utility -->
                </div>
                ${listType === 'previous' ? '<button class="remove-user-btn" title="Remove from history">X</button>' : ''} <!-- Add remove button for history -->
            `;

            // Add click listener to load iframe
            const imgOrDetails = userElement.querySelector('.user-details') || userElement.querySelector('img'); // Make details or image clickable
            imgOrDetails.addEventListener("click", Utils.logExecutionTime(() => this.#handleUserClick(user)).bind(this), { once: false }); // Bind 'this', allow multiple clicks

            // Add listener for the remove button if it exists
            const removeBtn = userElement.querySelector('.remove-user-btn');
            if (removeBtn) {
                removeBtn.addEventListener("click", Utils.asyncWrapper(async (event) => {
                    event.stopPropagation(); // Prevent click on remove button from triggering iframe load
                    console.log(`Removing ${user.username} from history.`);
                    await this.#removeFromPreviousUsers(user.username);
                    this.#displayPreviousUsers(); // Refresh the previous users list display
                }).bind(this));
            }

            return userElement;
        }

        /**
         * Handles user click event to load iframe and add to previous users.
         * @param {Object} user - The user object that was clicked.
         */
        #handleUserClick(user) {
             if (!this.mainIframe || !this.mainIframe2) {
                  console.warn("Iframe elements not found. Cannot load user.");
                  return;
             }
            console.log(`User clicked: ${user.username}`);

            const iframeChoiceRadio = document.querySelector('input[name="iframeChoice"]:checked');
            const iframeChoice = iframeChoiceRadio ? iframeChoiceRadio.value : 'mainIframe'; // Default to mainIframe
            let selectedIframe;

            if (iframeChoice === 'mainIframe2') {
                selectedIframe = this.mainIframe2;
            } else {
                selectedIframe = this.mainIframe;
            }

             // Ensure the iframe URL is correctly formatted
            selectedIframe.src = `https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=${user.username}`;
            console.log(`Loading ${user.username} into ${iframeChoice}.`);

            // Add or move the user to the top of the previous users list
             Utils.asyncWrapper(() => this.#addToPreviousUsers(user)).call(this);
        }

        /**
         * Adds a user to the previous users history, ensuring uniqueness and limit.
         * Moves user to front if already exists. Saves to storage.
         * @param {Object} user - The user object to add.
         */
        async #addToPreviousUsers(user) {
            // Remove user if already in the list to move them to the front
            this.previousUsers = this.previousUsers.filter(u => u.username !== user.username);

            // Add the user to the beginning of the array
            this.previousUsers.unshift(user);

            // Trim the array if it exceeds the max size
            if (this.previousUsers.length > this.maxHistorySize) {
                this.previousUsers = this.previousUsers.slice(0, this.maxHistorySize);
                console.log(`Previous users trimmed to max size ${this.maxHistorySize}.`);
            }

            console.log(`Added/Moved ${user.username} to previous users history.`);
            await this.#savePreviousUsers(); // Save the updated list
            this.#displayPreviousUsers(); // Refresh the previous users display
        }

         /**
          * Removes a user from the previous users history by username. Saves to storage.
          * @param {string} username - The username to remove.
          */
         async #removeFromPreviousUsers(username) {
             const initialCount = this.previousUsers.length;
             this.previousUsers = this.previousUsers.filter(u => u.username !== username);
             if (this.previousUsers.length < initialCount) {
                 console.log(`Removed ${username} from previous users history.`);
                 await this.#savePreviousUsers(); // Save the updated list
             } else {
                 console.warn(`Attempted to remove ${username} but they were not found in history.`);
             }
         }

        /** Loads the previous users history from storage. */
        async #loadPreviousUsers() {
            console.log(`Loading previous users from storage (${this.storageManager.storageType})...`);
            this.previousUsers = await this.storageManager.load('previousUsers'); // Use StorageManager
            console.log(`Loaded ${this.previousUsers.length} previous users.`);
        }

        /** Saves the current previous users history to storage. */
        async #savePreviousUsers() {
             console.log(`Saving ${this.previousUsers.length} previous users to storage (${this.storageManager.storageType})...`);
             await this.storageManager.save('previousUsers', this.previousUsers); // Use StorageManager
             console.log("Previous users saved.");
        }

         /** Clears the previous users history from state and storage. */
         async #clearPreviousUsers() {
             console.log("Clearing previous users history...");
             this.previousUsers = []; // Clear state
             await this.storageManager.clear('previousUsers'); // Clear storage
             this.#displayPreviousUsers(); // Refresh display
             console.log("Previous users history cleared.");
         }


        // --- Loading and Error Display Helpers (Implement based on your HTML) ---
        showLoadingIndicator(message = 'Loading...') {
            if (this.onlineLoadingIndicator) {
                this.onlineLoadingIndicator.textContent = message;
                this.onlineLoadingIndicator.style.display = 'block';
                 this.onlineUsersDiv.innerHTML = ''; // Clear list while loading
            } else {
                 console.log(`LOADING: ${message}`); // Fallback logging
            }
        }

        hideLoadingIndicator() {
            if (this.onlineLoadingIndicator) {
                this.onlineLoadingIndicator.style.display = 'none';
            }
             // Make sure to call applyFiltersAndDisplay/displayOnlineUsers AFTER hiding,
             // so the content is shown again. This is handled in fetchOnlineUsers.
        }

        showErrorDisplay(message) {
            if (this.onlineErrorDisplay) {
                this.onlineErrorDisplay.textContent = `Error: ${message}`;
                this.onlineErrorDisplay.style.display = 'block';
            } else {
                 console.error(`ERROR DISPLAY: ${message}`); // Fallback logging
            }
        }

         clearErrorDisplay() {
              if (this.onlineErrorDisplay) {
                this.onlineErrorDisplay.style.display = 'none';
                this.onlineErrorDisplay.textContent = '';
            }
         }

    } // End UserManager Class

    // --- Initialize the Application ---
    // Create an instance of the UserManager which handles everything
    const app = new UserManager();

    // Expose methods globally if needed for debugging or external calls (optional)
    // window.userManager = app;
});
