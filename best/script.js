/**
 * Room Viewer Application Script
 * Handles fetching, filtering, displaying online users,
 * managing viewing history (previous users), and sending reports
 * via a server-side endpoint.
 */
document.addEventListener('DOMContentLoaded', async function() {

    console.log("DOM fully loaded. Initializing application...");

    // --- Configuration ---
    // !! IMPORTANT !! Replace this with the actual URL of your server-side endpoint
    // Make sure this endpoint is accessible from where this script runs (CORS headers might be needed on the server)
    // Example: const REPORT_SERVER_ENDPOINT = 'https://yourserver.com/api/send-user-report';
    const REPORT_SERVER_ENDPOINT = '/api/send-user-report'; // Placeholder URL - NEEDS REPLACEMENT

    // --- DOM References ---
    // Use optional chaining (?) for elements that might not exist in the HTML
    const onlineUsersDiv = document.getElementById("onlineUsers")?.querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers")?.querySelector('.user-list');
    const mainIframe = document.getElementById("mainIframe");
    const mainIframe2 = document.getElementById("mainIframe2");

    const storageTypeSelector = document.getElementById("storageType");
    const filterTagsSelect = document.getElementById("filterTags");
    const filterAgeSelect = document.getElementById("filterAge");

    // --- New DOM References for Reporting and Status ---
    const sendReportButton = document.getElementById("sendReportButton"); // Button to trigger report
    const reportLoadingIndicator = document.getElementById("reportLoadingIndicator"); // Optional loading indicator for report
    const reportStatusDisplay = document.getElementById("reportStatusDisplay"); // Optional element to show report success/error status

    // --- References for Online Loading/Error Display ---
    // Add these elements to your HTML if you want visual feedback during fetch
    const onlineLoadingIndicator = document.getElementById("onlineLoadingIndicator");
    const onlineErrorDisplay = document.getElementById("onlineErrorDisplay");

    // --- State Variables ---
    let storageType = storageTypeSelector?.value || 'local'; // Default to 'local' if selector missing
    let previousUsers = []; // Array to hold the history list
    // let removedUsers = []; // Array to hold removed users (Not fully implemented in logic, but structure exists)
    let allOnlineUsersData = []; // Array to hold ALL fetched online user data before filtering
    let lastFilteredUsers = []; // Array to hold the list currently displayed in the online section (used for reporting)
    let fetchInterval = null; // To hold the interval ID

    // --- API Configuration ---
    // !! Verify this URL is correct and accessible from where your page is hosted !!
    const apiUrlBase = 'https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f';
    const apiLimit = 500; // Limit per API page request
    const fetchIntervalDuration = 120000; // 2 minutes (120 * 1000 milliseconds)
    const maxHistorySize = 100; // Max number of users to keep in the 'previousUsers' history
    const apiFetchTimeout = 25000; // Timeout for each API fetch request (milliseconds)
    const reportSendTimeout = 45000; // Timeout for sending the report (milliseconds)
    const maxApiFetchLimit = 20000; // Safety limit for total users fetched in one cycle

    // --- Helper Functions ---

    /**
     * Checks if a user's birthday string (e.g., "YYYY-MM-DD") corresponds to today's date.
     * @param {string | null | undefined} birthday - The birthday string.
     * @returns {boolean} True if it's the user's birthday today, false otherwise.
     */
    function isBirthday(birthday) {
        if (!birthday || typeof birthday !== 'string') return false;
        try {
            const today = new Date();
            // Assuming birthday format is YYYY-MM-DD. Adjust if needed.
            // Split and create date carefully to avoid timezone issues if possible.
            // Using UTC methods can help standardize if the source format is consistent.
            const parts = birthday.split('-');
            if (parts.length !== 3) return false; // Basic format check

            // Note: new Date(year, monthIndex, day) uses 0-based month
            const birthDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));

            if (isNaN(birthDate.getTime())) {
                 console.warn("Invalid date encountered in isBirthday:", birthday);
                 return false;
            }
            // Compare UTC day and month
            return today.getUTCDate() === birthDate.getUTCDate() && today.getUTCMonth() === birthDate.getUTCMonth();
        } catch (e) {
             console.error("Error checking birthday for:", birthday, e);
             return false;
        }
    }

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


    // --- Core Application Logic Functions ---

    /**
     * Fetches online user data from the API using pagination.
     * Updates `allOnlineUsersData`, then calls functions to populate filters and display users.
     */
    async function fetchData() {
        console.log("Executing fetchData: Starting online user data fetch...");
        showOnlineLoadingIndicator("Loading online users...");
        clearOnlineErrorDisplay(); // Clear previous errors

        let fetchedUsers = []; // Use a temporary array for this fetch cycle
        let offset = 0;
        let continueFetching = true;
        let totalFetchedCount = 0;

        while (continueFetching && totalFetchedCount < maxApiFetchLimit) {
            const apiUrl = `${apiUrlBase}&limit=${apiLimit}&offset=${offset}`;
             console.log(`fetchData: Fetching page (limit ${apiLimit}, offset ${offset}). URL: ${apiUrl}`);
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                     console.warn(`fetchData: Aborting fetch for offset ${offset} due to timeout (${apiFetchTimeout}ms).`);
                     controller.abort();
                     }, apiFetchTimeout);

                const response = await fetch(apiUrl, { signal: controller.signal });
                clearTimeout(timeoutId); // Clear the timeout if fetch completes/fails normally

                console.log(`fetchData: Response status for offset ${offset}: ${response.status}`);

                if (!response.ok) {
                     const errorBody = await response.text().catch(() => `Status: ${response.statusText}`);
                     console.error(`fetchData: HTTP error fetching offset ${offset}. Status: ${response.status}, Body: ${errorBody}`);
                     // Decide if a single page failure should stop the whole process
                     // For now, we'll stop fetching on error.
                     throw new Error(`HTTP error ${response.status}`);
                }

                const data = await response.json();
                 // console.log("fetchData: Successfully parsed JSON response for offset", offset);

                 // Validate the received data structure
                 if (data && data.results && Array.isArray(data.results)) {
                     console.log(`fetchData: Received ${data.results.length} results in batch from offset ${offset}.`);
                      if (data.results.length > 0) {
                         // Log a sample user object to verify properties occasionally
                         // if (offset === 0) console.log("fetchData: Sample user object:", data.results[0]);
                         fetchedUsers = fetchedUsers.concat(data.results);
                         totalFetchedCount = fetchedUsers.length;
                         showOnlineLoadingIndicator(`Fetched ${totalFetchedCount} users...`);

                         if (data.results.length < apiLimit) {
                             console.log("fetchData: Last page reached (results < limit). Stopping fetch.");
                             continueFetching = false; // This was the last page
                         } else {
                             offset += apiLimit; // Prepare for the next page
                             // continueFetching remains true
                         }
                     } else {
                         console.log("fetchData: Received 0 results in batch from offset ${offset}. Stopping fetch.");
                         continueFetching = false; // No more results on this page, stop.
                     }
                 } else {
                     console.warn("fetchData: Response JSON does not contain a valid 'results' array from offset ${offset}:", data);
                     continueFetching = false; // Invalid data structure, stop.
                 }
                 // console.log(`fetchData: Loop check: continueFetching=${continueFetching}, offset=${offset}, totalFetchedCount=${totalFetchedCount}`);

            } catch (error) {
                console.error(`fetchData: Error during fetch for offset ${offset}:`, error);
                 if (error.name === 'AbortError') {
                     showOnlineErrorDisplay(`Failed to fetch data (timeout). Check network or API status.`);
                 } else {
                    showOnlineErrorDisplay(`Failed to fetch data: ${error.message}. Check console.`);
                 }
                 // Optional: Display error directly in the list area
                 // if (onlineUsersDiv) onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error fetching data. See console.</p>';
                continueFetching = false; // Stop fetching loop on any error
            }
        } // End while loop

        if (totalFetchedCount >= maxApiFetchLimit) {
            console.warn(`fetchData: Fetch stopped after reaching safety limit (${maxApiFetchLimit} users).`);
            showOnlineErrorDisplay(`Load stopped at ${maxApiFetchLimit} users. Data might be incomplete.`);
        }

        console.log(`fetchData: Fetch cycle finished. Total users fetched in this cycle: ${totalFetchedCount}`);

        // --- Post-fetch actions ---
        // Replace the old data with the newly fetched data
        allOnlineUsersData = fetchedUsers;
        lastFilteredUsers = []; // Reset filtered list until filters are applied

        if (allOnlineUsersData.length > 0) {
             console.log("fetchData: Populating filters and displaying users...");
             populateFilters(allOnlineUsersData); // Populate filters based on the *new* full dataset
             applyFiltersAndDisplay(); // Apply current filters and display the new online users
             await displayPreviousUsers(); // Refresh previous users display (needs await as it might load)
        } else {
             console.log("fetchData: No online users data fetched in this cycle. Clearing online display.");
              if (onlineUsersDiv) onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found or failed to fetch.</p>';
              populateFilters([]); // Clear filters or show default state
              applyFiltersAndDisplay(); // Ensure display reflects empty state
              await displayPreviousUsers(); // Still try to display previous users (they might be offline now)
        }

        hideOnlineLoadingIndicator();
        console.log("fetchData execution finished.");
    }

    /**
     * Populates the tag and age filter dropdowns based on the provided user data.
     * Preserves currently selected values if possible.
     * @param {Array<Object>} users - The array of user objects (usually `allOnlineUsersData`).
     */
    function populateFilters(users) {
         if (!filterTagsSelect || !filterAgeSelect) {
              console.warn("Filter select elements not found. Cannot populate filters.");
              return;
         }
        console.log("Populating filters...");
        const tagFrequency = {};
        const ages = new Set();

        users.forEach(user => {
            // Ensure tags is an array and tags are strings
            if (user.tags && Array.isArray(user.tags)) {
                user.tags.forEach(tag => {
                     if (typeof tag === 'string' && tag.trim() !== '') {
                        const lowerTag = tag.trim().toLowerCase();
                        tagFrequency[lowerTag] = (tagFrequency[lowerTag] || 0) + 1;
                     }
                });
            }
            // Ensure age is a valid positive number
            if (user.age && typeof user.age === 'number' && user.age > 0) {
                ages.add(user.age);
            }
        });

        // --- Populate Tags ---
        // Sort tags: first by frequency (desc), then alphabetically for ties
        const sortedTags = Object.entries(tagFrequency)
            .sort(([tagA, countA], [tagB, countB]) => countB - countA || tagA.localeCompare(tagB))
            .slice(0, 75) // Limit number of tags shown in dropdown (e.g., top 75)
            .map(([tag]) => tag); // Get only the tag name

         // Preserve current selections before clearing
         const selectedTagValues = Array.from(filterTagsSelect.selectedOptions).map(opt => opt.value);
         filterTagsSelect.innerHTML = '<option value="">-- All Tags --</option>'; // Default option
         sortedTags.forEach(tag => {
              const isSelected = selectedTagValues.includes(tag);
              // Capitalize first letter for display (optional)
              const displayText = tag.charAt(0).toUpperCase() + tag.slice(1);
             filterTagsSelect.add(new Option(`${displayText} (${tagFrequency[tag]})`, tag, false, isSelected));
         });


        // --- Populate Ages ---
        // Sort ages numerically
        const sortedAges = Array.from(ages).sort((a, b) => a - b);
         // Preserve current selections
         const selectedAgeValues = Array.from(filterAgeSelect.selectedOptions).map(opt => opt.value);
        filterAgeSelect.innerHTML = '<option value="">-- All Ages --</option>'; // Default option
         sortedAges.forEach(age => {
              const isSelected = selectedAgeValues.includes(String(age)); // Compare as strings
             filterAgeSelect.add(new Option(String(age), String(age), false, isSelected));
         });

         console.log("Filter population complete.");

         // Update storage options (in case new IndexedDB keys were created externally, though unlikely)
         // Run this less frequently if it causes issues or isn't needed after init
         // await populateStorageOptions();
    }

     /**
      * Applies filters based on dropdown selections or button overrides.
      * Updates `lastFilteredUsers` state and calls `displayOnlineUsersList`.
      * @param {Object} [buttonFilters={}] - Optional filters from specific buttons like { tag: 'tagName' } or { age: 18 }.
      */
    function applyFiltersAndDisplay(buttonFilters = {}) {
        console.log("Applying filters...", { buttonFilters });

        // Determine filter criteria: Use button filter if provided, otherwise use select elements
        let filterTags = [];
        if (buttonFilters.tag) {
            filterTags = [buttonFilters.tag.toLowerCase()];
            // Optionally update the dropdown to reflect the button click
            if (filterTagsSelect) filterTagsSelect.value = buttonFilters.tag.toLowerCase();
        } else if (filterTagsSelect) {
            filterTags = Array.from(filterTagsSelect.selectedOptions)
                .map(option => option.value.toLowerCase())
                .filter(tag => tag !== ''); // Exclude the "-- All Tags --" option
        }

        let filterAges = [];
        if (buttonFilters.age) {
            filterAges = [parseInt(buttonFilters.age)];
             if (filterAgeSelect) filterAgeSelect.value = String(buttonFilters.age);
        } else if (filterAgeSelect) {
            filterAges = Array.from(filterAgeSelect.selectedOptions)
                .map(option => parseInt(option.value))
                .filter(age => !isNaN(age) && age > 0); // Exclude "-- All Ages --" and ensure valid numbers
        }

        console.log("Active filters:", { filterTags, filterAges });

        // Filter the main data source (`allOnlineUsersData`)
        const filteredUsers = allOnlineUsersData.filter(user => {
            // Basic check for user validity
            if (!user || !user.username) return false;

            // Filter condition 1: Must be public show (adjust if other types are needed)
            const isPublic = user.current_show === 'public';

            // Filter condition 2: Tag match (must match ALL selected tags if multiple are selected)
            // OR use .some() if ANY selected tag should match
             let hasTags = true; // Default to true if no tags are selected
             if (filterTags.length > 0) {
                 // Ensure user.tags exists and is an array
                 const userTagsLower = (user.tags && Array.isArray(user.tags))
                     ? user.tags.map(t => typeof t === 'string' ? t.toLowerCase() : '')
                     : [];
                 // Use .some() - user must have at least one of the selected tags
                 hasTags = filterTags.some(filterTag => userTagsLower.includes(filterTag));
                 // OR Use .every() - user must have ALL selected tags (less common use case)
                 // hasTags = filterTags.every(filterTag => userTagsLower.includes(filterTag));
             }


            // Filter condition 3: Age match (must match ANY selected age if multiple selected)
            let isAgeMatch = true; // Default to true if no ages are selected
            if (filterAges.length > 0) {
                // Ensure user.age exists and is a number
                isAgeMatch = (user.age && typeof user.age === 'number')
                    ? filterAges.includes(user.age)
                    : false;
            }

            // Return true only if all conditions pass
            return isPublic && hasTags && isAgeMatch;
        });

        console.log(`Filtered ${allOnlineUsersData.length} users down to ${filteredUsers.length}.`);
        lastFilteredUsers = filteredUsers; // --- Store the filtered list for reporting ---
        displayOnlineUsersList(filteredUsers); // Display the result
    }


    /**
     * Displays the provided list of users in the online users container.
     * @param {Array<Object>} usersToDisplay - The array of user objects to display.
     */
    function displayOnlineUsersList(usersToDisplay) {
         if (!onlineUsersDiv) {
             console.warn("Online users display div (#onlineUsers .user-list) not found. Cannot display users.");
             return;
         }
        // console.log(`displayOnlineUsersList: Displaying ${usersToDisplay.length} filtered online users.`);
        onlineUsersDiv.innerHTML = ""; // Clear previous list

        if (usersToDisplay.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users match the current filters.</p>';
            return;
        }

         // Optional: Sort the displayed users (e.g., by tokens, viewers, age, alphabetical)
         // usersToDisplay.sort((a, b) => (b.num_viewers || 0) - (a.num_viewers || 0)); // Example: Sort by viewers descending

        const fragment = document.createDocumentFragment(); // Use fragment for better performance
        usersToDisplay.forEach(user => {
            // Basic data validation before creating element
            if (!user || !user.image_url || !user.username) { // iframe_embed might not always be needed directly here
                console.warn("Skipping online user display due to incomplete data:", user);
                return;
            }
            const userElement = createUserElement(user, 'online'); // Use helper, specify list type
            fragment.appendChild(userElement);
        });
        onlineUsersDiv.appendChild(fragment); // Append fragment once
         // console.log("displayOnlineUsersList: Online users display complete.");
    }


    /**
     * Displays the previous users list, filtering to show only those currently online & public.
     * Ensures `previousUsers` state is loaded before displaying.
     * @returns {Promise<void>}
     */
    async function displayPreviousUsers() {
         if (!previousUsersDiv) {
             console.warn("Previous users display div (#previousUsers .user-list) not found.");
             return;
         }
         console.log(`displayPreviousUsers: Refreshing display. History has ${previousUsers.length} users.`);
         previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Loading history...</p>'; // Initial loading state

         // Ensure previousUsers state is loaded. If it's empty, try loading from storage.
         if (previousUsers.length === 0) {
             console.log("displayPreviousUsers: State empty, attempting load from storage...");
             previousUsers = await loadUsers("previousUsers"); // Load based on current storageType
             if (previousUsers.length === 0) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No viewing history saved.</p>';
                console.log("displayPreviousUsers: No previous users found in storage.");
                return;
             } else {
                  console.log(`displayPreviousUsers: Loaded ${previousUsers.length} previous users from storage.`);
             }
         }

         // Check if we have current online data to compare against.
         if (allOnlineUsersData.length === 0) {
              console.warn("displayPreviousUsers: Online user data (allOnlineUsersData) not available. Displaying saved history without online status check.");
              // Option 1: Show all saved users without filtering (might be confusing)
               // const usersToDisplay = previousUsers;
              // Option 2: Show a message indicating online status can't be checked
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">History loaded. Fetching online status...</p>';
              return; // Wait for next fetchData cycle to get online status
         }
          // console.log(`displayPreviousUsers: Comparing against ${allOnlineUsersData.length} currently online users.`);


         // Filter previous users: Show only those who are *currently* in `allOnlineUsersData` and are 'public'.
         // Create a Map for faster lookup of online users by username
         const onlineUserMap = new Map(allOnlineUsersData.map(user => [user.username, user]));

         const currentlyOnlineAndPublicPreviousUsers = previousUsers.filter(prevUser => {
             const onlineUser = onlineUserMap.get(prevUser.username);
             // Must be found in the current online list AND have current_show == 'public'
             return onlineUser && onlineUser.current_show === 'public';
         });

         console.log(`displayPreviousUsers: Found ${currentlyOnlineAndPublicPreviousUsers.length} saved users currently online & public.`);

         // Clear the loading message
         previousUsersDiv.innerHTML = "";

         if (currentlyOnlineAndPublicPreviousUsers.length === 0) {
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">None of your saved users are online & public right now.</p>';
              return;
         }

         // Display the filtered list
         const fragment = document.createDocumentFragment();
         currentlyOnlineAndPublicPreviousUsers.forEach(user => {
             // Re-validate data just in case, though it should be fine if saved correctly
             if (!user || !user.image_url || !user.username) {
                console.warn("Skipping previous user display due to incomplete data:", user);
                return;
            }
             const userElement = createUserElement(user, 'previous'); // Use helper, indicate type 'previous'
             fragment.appendChild(userElement);
         });
         previousUsersDiv.appendChild(fragment);
          console.log("displayPreviousUsers: Previous users display complete.");
    }


    /**
     * Creates and returns a DOM element for a single user.
     * Includes image, details, badges, and event listeners.
     * @param {Object} user - The user data object.
     * @param {'online' | 'previous'} listType - Indicates which list the element is for (affects styling/buttons).
     * @returns {HTMLElement} The created user div element.
     */
    function createUserElement(user, listType) {
        const userElement = document.createElement("div");
        // Add classes for styling based on list type
        userElement.className = `user-info w3-card w3-margin-bottom ${listType}-list-item`; // Example using W3.CSS card style
        userElement.dataset.username = user.username; // Store username for potential later use

        // Determine content using template literal for readability
        const tagsDisplay = (user.tags && Array.isArray(user.tags) && user.tags.length > 0)
                            ? user.tags.join(', ')
                            : 'N/A';
        const ageDisplay = (user.age && typeof user.age === 'number') ? user.age : 'N/A';
        const newBadge = user.is_new ? '<span class="badge new-badge w3-tag w3-small w3-red w3-round">New</span>' : '';
        const birthdayBanner = isBirthday(user.birthday) ? `<p class="birthday w3-text-amber w3-center">🎂 Happy Birthday! 🎂</p>` : '';
        const removeButton = listType === 'previous' ? '<button class="remove-user-btn w3-button w3-tiny w3-red w3-hover-dark-grey w3-circle" title="Remove from history">×</button>' : '';

        userElement.innerHTML = `
            <div class="user-image-container">
                <img src="${user.image_url}" alt="${user.username} thumbnail" loading="lazy" class="w3-image">
                ${removeButton} <!-- Position remove button relative to container -->
            </div>
            <div class="user-details w3-container w3-padding-small">
                <p class="username w3-large">${user.username} ${newBadge}</p>
                <p><small>Age: ${ageDisplay} | Viewers: ${user.num_viewers || 'N/A'}</small></p> <!-- Example: Added viewers -->
                <p class="tags"><small>Tags: ${tagsDisplay}</small></p>
                ${birthdayBanner}
            </div>
        `;

        // --- Add Event Listeners ---

        // Add click listener to the main element (excluding the remove button) to load iframe
        userElement.addEventListener("click", function(event) {
             // Prevent triggering if the remove button itself was clicked
             if (event.target.closest('.remove-user-btn')) {
                 return;
             }
             event.preventDefault(); // Prevent potential default behaviors
             handleUserClick(user); // Use the full user object passed in
        });

        // Add listener specifically for the remove button if it exists
        const removeBtn = userElement.querySelector('.remove-user-btn');
        if (removeBtn) {
            removeBtn.addEventListener("click", async function(event) {
                event.stopPropagation(); // VERY IMPORTANT: Prevent click from bubbling up to the userElement listener
                console.log(`User clicked remove for: ${user.username}`);
                showOnlineLoadingIndicator("Removing from history..."); // Provide feedback
                await removeFromPreviousUsers(user.username);
                await displayPreviousUsers(); // Refresh the display after removal (needs await)
                hideOnlineLoadingIndicator();
            });
        }

        return userElement;
    }


    /**
     * Handles clicking on a user: loads their stream into the selected iframe
     * and adds/moves them to the top of the previous users history.
     * @param {Object} user - The user object that was clicked.
     */
    function handleUserClick(user) {
         if (!mainIframe || !mainIframe2) {
              console.error("Iframe elements (#mainIframe or #mainIframe2) not found. Cannot load user stream.");
              // Optionally show a user-facing error message
              return;
         }
         if (!user || !user.username) {
             console.error("Invalid user data passed to handleUserClick:", user);
             return;
         }
        console.log(`User clicked: ${user.username}`);

        // Determine which iframe to use based on radio button selection
        const iframeChoiceRadio = document.querySelector('input[name="iframeChoice"]:checked');
        const iframeChoice = iframeChoiceRadio ? iframeChoiceRadio.value : 'mainIframe'; // Default to 'mainIframe'
        const selectedIframe = (iframeChoice === 'mainIframe2') ? mainIframe2 : mainIframe;

        // Construct the iframe URL (ensure parameters are correct)
        // Example URL structure - verify this matches Chaturbate's requirements
        const iframeSrc = `https://chaturbate.com/?track=embed&room=${user.username}&tour=dU9X&campaign=9cg6A&disable_sound=0&bgcolor=black`;
        // Or use the fullvideo URL if preferred:
        // const iframeSrc = `https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=${user.username}`;
        // &

        console.log(`Loading ${user.username} into ${iframeChoice} with src: ${iframeSrc}`);
        selectedIframe.src = iframeSrc;


        // Add or move the user to the top of the previous users list (async operation)
        // We don't necessarily need to wait for this to complete before returning
        addToPreviousUsers(user).catch(err => {
            console.error(`Error adding ${user.username} to previous users:`, err);
            // Handle potential save errors (e.g., show a message)
        });
        // Refreshing the previous users display is handled by the main fetch cycle or explicitly after removals
    }


    /**
     * Adds a user to the `previousUsers` state array.
     * Ensures uniqueness (moves to front if exists) and enforces `maxHistorySize`.
     * Saves the updated list to the selected storage.
     * @param {Object} user - The user object to add/move.
     * @returns {Promise<void>}
     */
    async function addToPreviousUsers(user) {
        if (!user || !user.username) {
            console.warn("Attempted to add invalid user to history:", user);
            return;
        }
        // console.log(`Attempting to add/move ${user.username} to history.`);

        // Find index of user if they already exist in the history
        const existingIndex = previousUsers.findIndex(u => u.username === user.username);

        // If user exists, remove their old entry first
        if (existingIndex !== -1) {
            previousUsers.splice(existingIndex, 1);
            // console.log(`Removed existing entry for ${user.username} before re-adding to front.`);
        }

        // Add the current user object to the beginning of the array
        previousUsers.unshift(user);

        // Trim the array if it exceeds the maximum allowed size
        if (previousUsers.length > maxHistorySize) {
            const removed = previousUsers.splice(maxHistorySize); // Remove items from the end
            console.log(`Previous users history trimmed, ${removed.length} oldest users removed.`);
        }

        // console.log(`Added/Moved ${user.username} to front of history state. Size: ${previousUsers.length}`);

        // Save the updated history list to storage
        try {
            await saveUsers("previousUsers", previousUsers);
            // No need to refresh display here usually, displayPreviousUsers is called periodically
            // or after specific actions like removal. Calling it here might cause unnecessary redraws.
        } catch (error) {
            console.error(`Failed to save previous users after adding ${user.username}:`, error);
            // Consider reverting the state change or notifying the user if saving fails critically
            // For now, the state remains updated even if save fails.
        }
    }

     /**
      * Removes a user from the `previousUsers` history state by username.
      * Saves the updated list to the selected storage.
      * @param {string} username - The username to remove.
      * @returns {Promise<void>}
      */
     async function removeFromPreviousUsers(username) {
         if (!username) {
             console.warn("Attempted to remove user with invalid username from history.");
             return;
         }
         console.log(`Attempting to remove ${username} from history.`);
         const initialCount = previousUsers.length;
         // Filter out the user with the matching username
         previousUsers = previousUsers.filter(u => u.username !== username);

         if (previousUsers.length < initialCount) {
             console.log(`Successfully removed ${username} from history state. New size: ${previousUsers.length}`);
             // Save the updated list to storage
             try {
                await saveUsers("previousUsers", previousUsers);
                // The display refresh should be called *after* this function completes successfully
                // displayPreviousUsers(); // Moved this call to the event listener
             } catch (error) {
                 console.error(`Failed to save previous users after removing ${username}:`, error);
                 // State is updated, but save failed. May need error handling/notification.
             }
         } else {
             console.warn(`Attempted to remove ${username}, but they were not found in the current history state.`);
         }
     }

     /**
      * Clears the previous users history from both state and the selected storage.
      * @returns {Promise<void>}
      */
     async function clearPreviousUsers() {
         console.log("Clearing previous users history...");
         const confirmation = confirm("Are you sure you want to clear your entire viewing history?");
         if (!confirmation) {
             console.log("Clear history cancelled by user.");
             return;
         }

         showOnlineLoadingIndicator("Clearing history..."); // Show feedback

         previousUsers = []; // Clear state array

         // Clear from the currently selected storage
         const keyToClear = "previousUsers";
         try {
             if (storageType === "indexedClicked" || storageType.startsWith('IndexedDB:')) {
                 // For IndexedDB, we need to explicitly delete the key
                 let db;
                 try {
                     db = await openIndexedDB();
                     const tx = db.transaction('users', 'readwrite');
                     const store = tx.objectStore('users');
                     // Use the correct key (handle custom keys if storageType indicates one)
                     const idbKey = storageType.startsWith('IndexedDB:') ? storageType.substring(11) : keyToClear;
                     console.log(`Deleting key '${idbKey}' from IndexedDB.`);
                     store.delete(idbKey);
                     await new Promise((resolve, reject) => { // Wait for transaction completion
                         tx.oncomplete = () => { console.log(`IndexedDB delete transaction for key '${idbKey}' complete.`); db.close(); resolve(); };
                         tx.onerror = (e) => { console.error("IndexedDB delete transaction error:", e.target.error); db.close(); reject(e.target.error); };
                         tx.onabort = (e) => { console.error("IndexedDB delete transaction aborted:", e.target.error); db.close(); reject(e.target.error || new Error('Delete transaction aborted')); };
                     });
                     console.log(`History key '${idbKey}' cleared from IndexedDB.`);
                 } catch (dbError) {
                     console.error("Error accessing IndexedDB to clear history:", dbError);
                     // Re-throw or handle more gracefully
                     throw dbError; // Propagate error
                 }
             } else {
                 // For localStorage or sessionStorage
                 const storage = storageType === "local" ? localStorage : sessionStorage;
                 storage.removeItem(keyToClear);
                 console.log(`History key '${keyToClear}' cleared from ${storageType} storage.`);
             }

             // Successfully cleared from storage, now update display
             await displayPreviousUsers(); // Refresh display to show it's empty (needs await)
             console.log("Previous users history cleared successfully.");

         } catch (error) {
             console.error("Error clearing previous users history from storage:", error);
             // Optionally show an error message to the user
             // showUserMessage("Failed to clear history from storage.", 'error');
         } finally {
             hideOnlineLoadingIndicator(); // Hide feedback indicator
         }
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


    // --- Reporting Functions ---

    /**
     * Sends the `lastFilteredUsers` list as a JSON report
     * to the configured `REPORT_SERVER_ENDPOINT`.
     * Handles loading state and status feedback.
     * @returns {Promise<void>}
     */
    async function sendReport() {
        console.log("Attempting to send report...");

        // 1. Validate Endpoint Configuration
        if (!REPORT_SERVER_ENDPOINT || REPORT_SERVER_ENDPOINT === '/api/send-user-report') { // Check default/placeholder
             const errorMsg = "Report feature disabled: Server endpoint not configured in the script.";
             console.error(errorMsg);
             showReportStatus(errorMsg, 'error');
             return;
        }
         // Optional: Basic check if it looks like a URL path or full URL
         if (!REPORT_SERVER_ENDPOINT.startsWith('/') && !REPORT_SERVER_ENDPOINT.startsWith('http')) {
              const errorMsg = `Report feature error: Invalid endpoint URL format: "${REPORT_SERVER_ENDPOINT}"`;
              console.error(errorMsg);
              showReportStatus(errorMsg, 'error');
              return;
         }


        // 2. Check if there's data to send
        if (!lastFilteredUsers || lastFilteredUsers.length === 0) {
            const warnMsg = "No users currently displayed in the 'Online Users' list to report.";
            console.warn(warnMsg);
            showReportStatus(warnMsg, 'warning');
            return;
        }

        // 3. Show Loading State
        showReportLoading(`Sending report for ${lastFilteredUsers.length} users...`);
        clearReportStatus(); // Clear previous status messages

        // 4. Prepare Data Payload
        // Select only the necessary fields to minimize payload size and complexity
        const reportData = lastFilteredUsers.map(user => ({
            username: user.username,
            age: user.age,
            tags: user.tags,
            // Add other potentially useful fields if available and needed by the server
            is_new: user.is_new,
            num_viewers: user.num_viewers,
            // current_show: user.current_show, // Usually 'public' if filtered this way
            // birthday: user.birthday, // Send if needed by server
            // image_url: user.image_url // Probably not needed for report
        }));

        console.log(`Sending report payload (${reportData.length} users) to: ${REPORT_SERVER_ENDPOINT}`);
        // console.log("Sample report payload item:", reportData[0]); // Debugging

        // 5. Send Request using Fetch API
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
             console.error(`Report send aborted due to timeout (${reportSendTimeout}ms).`);
             controller.abort();
             }, reportSendTimeout);

        try {
            const response = await fetch(REPORT_SERVER_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add any required Authorization or custom headers here
                    // e.g., 'Authorization': 'Bearer YOUR_API_TOKEN'
                    // e.g., 'X-Api-Key': 'YOUR_SECRET_KEY'
                },
                body: JSON.stringify(reportData),
                signal: controller.signal // Link abort controller
            });

            clearTimeout(timeoutId); // Clear the timeout timer if fetch completes/fails

            console.log(`Report send response status: ${response.status}`);

            // 6. Handle Response
            if (!response.ok) {
                 // Try to get more detailed error message from server response body
                 let errorBody = `Server responded with status ${response.status} ${response.statusText}`;
                 try {
                     const errorJson = await response.json();
                     errorBody = errorJson.message || errorJson.error || JSON.stringify(errorJson);
                 } catch (e) {
                     // If response is not JSON, try text
                     try {
                         errorBody = await response.text();
                     } catch (e2) { /* Keep the original status text */ }
                 }
                 console.error(`Report send HTTP error: ${errorBody}`);
                 throw new Error(`Server error: ${errorBody.substring(0, 100)}...`); // Throw concise error
            }

            // Assuming server sends back JSON like { status: 'success', message: '...' }
            // or { status: 'error', message: '...' }
            const result = await response.json();
            console.log("Report send server response:", result);

            if (result && (result.status === 'success' || response.status === 200 || response.status === 201)) { // Check common success indicators
                const successMsg = result.message || "Report sent successfully!";
                console.log(successMsg);
                showReportStatus(successMsg, 'success');
            } else {
                const errorMsg = `Report failed: ${result.message || result.error || 'Unknown server response.'}`;
                console.error(errorMsg);
                showReportStatus(errorMsg, 'error');
            }

        } catch (error) {
            console.error("Error caught during report send fetch:", error);
             if (error.name === 'AbortError') {
                 showReportStatus("Report request timed out. Server might be slow or unreachable.", 'error');
             } else {
                 // Network errors, JSON parsing errors, or thrown errors from response handling
                 showReportStatus(`Failed to send report: ${error.message}`, 'error');
             }
        } finally {
            // 7. Hide Loading State
            hideReportLoading(); // Always hide loading indicator regardless of success/failure
            console.log("Report sending process finished.");
        }
    }


    // --- UI Loading and Error/Status Display Helpers ---

    function showOnlineLoadingIndicator(message = 'Loading...') {
        // console.log(`UI: SHOW ONLINE LOADING: ${message}`);
        if (onlineLoadingIndicator) {
            onlineLoadingIndicator.textContent = message;
            onlineLoadingIndicator.style.display = 'block'; // Or 'inline', 'flex' etc.
            // Optionally disable user interactions while loading
        }
         // Clear the list area while loading to avoid confusion
         if (onlineUsersDiv) onlineUsersDiv.innerHTML = '';
    }

    function hideOnlineLoadingIndicator() {
        // console.log("UI: HIDE ONLINE LOADING");
        if (onlineLoadingIndicator) {
            onlineLoadingIndicator.style.display = 'none';
            // Re-enable interactions if disabled
        }
    }

    function showOnlineErrorDisplay(message) {
        console.error(`UI: SHOW ONLINE ERROR: ${message}`);
        if (onlineErrorDisplay) {
            onlineErrorDisplay.textContent = `Error: ${message}`;
            onlineErrorDisplay.style.display = 'block'; // Or 'inline', 'flex' etc.
            onlineErrorDisplay.className = 'error-message'; // Add class for styling
        }
        // Also hide loading indicator if an error occurs
        hideOnlineLoadingIndicator();
    }

     function clearOnlineErrorDisplay() {
        //   console.log("UI: CLEAR ONLINE ERROR DISPLAY");
          if (onlineErrorDisplay) {
            onlineErrorDisplay.style.display = 'none';
            onlineErrorDisplay.textContent = '';
            onlineErrorDisplay.className = ''; // Remove styling class
        }
     }

     // --- Reporting Status Display Helpers ---
     function showReportLoading(message = 'Processing...') {
         // console.log(`UI: SHOW REPORT LOADING: ${message}`);
         if (reportLoadingIndicator) {
             reportLoadingIndicator.textContent = message;
             reportLoadingIndicator.style.display = 'block'; // Or 'inline', 'flex'
         }
         if (sendReportButton) sendReportButton.disabled = true; // Disable button while loading
         clearReportStatus(); // Clear previous status messages
     }

     function hideReportLoading() {
        //   console.log("UI: HIDE REPORT LOADING");
         if (reportLoadingIndicator) {
             reportLoadingIndicator.style.display = 'none';
         }
          if (sendReportButton) sendReportButton.disabled = false; // Re-enable button
     }

     /**
      * Displays a status message related to the reporting action.
      * @param {string} message - The message to display.
      * @param {'success' | 'error' | 'warning' | 'info'} [type='info'] - Type for CSS styling.
      */
     function showReportStatus(message, type = 'info') {
         console.log(`UI: SHOW REPORT STATUS (${type}): ${message}`);
         if (reportStatusDisplay) {
             reportStatusDisplay.textContent = message;
             reportStatusDisplay.className = `report-status ${type}`; // Base class + type class for styling
             reportStatusDisplay.style.display = 'block'; // Or 'inline', 'flex'

             // Automatically clear non-error messages after a delay
             if (type !== 'error') {
                 setTimeout(clearReportStatus, 6000); // e.g., clear after 6 seconds
             }
         }
         // Ensure loading is hidden when status is shown
         hideReportLoading();
     }

      function clearReportStatus() {
        //    console.log("UI: CLEAR REPORT STATUS");
          if (reportStatusDisplay) {
            reportStatusDisplay.style.display = 'none';
            reportStatusDisplay.textContent = '';
            reportStatusDisplay.className = 'report-status'; // Reset classes
        }
      }


    // --- Initial Setup and Event Listeners ---

    /** Checks if all essential DOM elements are present. Logs errors or warnings. */
    function validateDOMReferences() {
        const criticalMissing = [];
        if (!onlineUsersDiv) criticalMissing.push("#onlineUsers .user-list");
        if (!previousUsersDiv) criticalMissing.push("#previousUsers .user-list");
        if (!mainIframe) criticalMissing.push("#mainIframe");
        if (!mainIframe2) criticalMissing.push("#mainIframe2");
        if (!storageTypeSelector) criticalMissing.push("#storageType");
        if (!filterTagsSelect) criticalMissing.push("#filterTags");
        if (!filterAgeSelect) criticalMissing.push("#filterAge");

        if (criticalMissing.length > 0) {
            const errorMsg = `CRITICAL ERROR: Missing essential DOM elements: ${criticalMissing.join(', ')}. Application might not function correctly.`;
            console.error(errorMsg);
            // Display error to user?
            showOnlineErrorDisplay(`Initialization failed: Missing required page elements (${criticalMissing[0]}...).`);
            // throw new Error(errorMsg); // Option: Stop execution if critical elements missing
            return false; // Indicate failure
        }

        // Optional elements (log warnings if missing)
        if (!sendReportButton) console.warn("Optional element missing: #sendReportButton. Reporting functionality disabled.");
        if (!reportLoadingIndicator) console.warn("Optional element missing: #reportLoadingIndicator. Reporting loading feedback unavailable.");
        if (!reportStatusDisplay) console.warn("Optional element missing: #reportStatusDisplay. Reporting status feedback unavailable.");
        if (!onlineLoadingIndicator) console.warn("Optional element missing: #onlineLoadingIndicator. Online user loading feedback unavailable.");
        if (!onlineErrorDisplay) console.warn("Optional element missing: #onlineErrorDisplay. Online user error feedback unavailable.");

        console.log("DOM references validated. Essential elements found.");
        return true; // Indicate success
    }


    /** Sets up all necessary event listeners for UI elements. */
    function setupEventListeners() {
        console.log("Setting up event listeners...");

        // Storage Type Change
        storageTypeSelector?.addEventListener("change", async function() {
             const newStorageType = this.value;
             console.log(`Storage type changed to: ${newStorageType}`);
             // Prevent changing if a save is in progress? (More complex state needed)
             if (newStorageType !== storageType) {
                storageType = newStorageType;
                // Reload history from the newly selected storage type
                showOnlineLoadingIndicator("Loading history from new source..."); // Provide feedback
                previousUsers = await loadUsers("previousUsers");
                // removedUsers = await loadUsers("removedUsers"); // If using removedUsers
                await displayPreviousUsers(); // Refresh display (needs await)
                hideOnlineLoadingIndicator();
             }
        });

        // Filter Selects Change (use 'change' event)
        filterTagsSelect?.addEventListener("change", () => applyFiltersAndDisplay());
        filterAgeSelect?.addEventListener("change", () => applyFiltersAndDisplay());

         // --- Specific Filter Buttons ---
         // Example buttons - ensure these IDs exist in your HTML
         document.getElementById("filterAge18")?.addEventListener("click", () => applyFiltersAndDisplay({ age: 18 }));
         document.getElementById("filterTagAsian")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'asian' }));
         document.getElementById("filterTagBlonde")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'blonde' }));
         // Add listeners for other specific filter buttons...

         // --- Clear History Button ---
         document.getElementById("clearPreviousUsers")?.addEventListener("click", clearPreviousUsers); // Calls async function

         // --- Send Report Button ---
         if (sendReportButton) {
             sendReportButton.addEventListener("click", sendReport); // Calls async function
             console.log("Report button event listener added.");
         } else {
             console.log("Report button not found, listener not added.");
         }

        console.log("Event listeners setup complete.");
    }


    // --- Application Initialization Sequence ---

    async function initializeApp() {
        console.log("Initializing application...");

        if (!validateDOMReferences()) {
             console.error("Initialization aborted due to missing critical DOM elements.");
             return; // Stop initialization
        }

        // 1. Populate storage options dropdown
        await populateStorageOptions(); // Sets initial `storageType` based on selector

        // 2. Setup event listeners for UI elements
        setupEventListeners();

        // 3. Load initial user history from the selected storage
        showOnlineLoadingIndicator("Loading initial history...");
        previousUsers = await loadUsers("previousUsers");
        // removedUsers = await loadUsers("removedUsers"); // Load if needed
        console.log(`Initial load: Found ${previousUsers.length} users in history.`);
        // Don't display previous users yet, wait for online data for filtering

        // 4. Perform the initial fetch of online user data
        // `fetchData` will handle displaying online users and the *filtered* previous users
        await fetchData(); // This is the main initial data load and display trigger

        // 5. Start the periodic fetch interval *after* the first fetch completes
        startFetchInterval();

        // --- Optional: Compatibility Placeholders ---
        if (typeof window.initializeAllUsers === 'function') {
            console.warn("Executing legacy compatibility function: window.initializeAllUsers()");
            window.initializeAllUsers();
        }
        window.initializeAllUsersFromScriptJS = function(callback) {
            console.log("Legacy compatibility function initializeAllUsersFromScriptJS called.");
            if (typeof callback === 'function') callback();
        };
        // --- End Compatibility ---

        console.log("Application initialization complete and periodic fetching started.");
        hideOnlineLoadingIndicator(); // Ensure loading indicator is hidden
    }

    // --- Fetch Interval Control ---
    function startFetchInterval() {
         if (fetchInterval) {
             clearInterval(fetchInterval);
             console.log("Cleared existing fetch interval.");
         }
         console.log(`Starting periodic fetch interval (${fetchIntervalDuration / 1000} seconds).`);
         // Call fetchData immediately, then set interval for subsequent calls
         // Note: Initial call is already done by initializeApp()
         fetchInterval = setInterval(async () => {
             console.log("Interval triggered: Fetching updated data...");
             await fetchData(); // Call the async fetch function periodically
         }, fetchIntervalDuration);
    }

    // --- Start the application ---
    initializeApp().catch(error => {
        console.error("Unhandled error during application initialization:", error);
        showOnlineErrorDisplay(`Fatal initialization error: ${error.message}. Please refresh or check console.`);
        // Optionally hide loading indicators if they were left visible
        hideOnlineLoadingIndicator();
        hideReportLoading();
    });

}); // End DOMContentLoaded
