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
    // This endpoint MUST be configured to receive POST requests with JSON data
    // and send emails from your server.
    const REPORT_SERVER_ENDPOINT = '/api/send-user-report'; // Example placeholder URL

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

    // --- State Variables ---
    let storageType = storageTypeSelector?.value || 'local'; // Default to 'local' if selector missing
    let previousUsers = []; // Array to hold the history list
    let removedUsers = []; // Array to hold removed users (not fully implemented in logic yet)
    let allOnlineUsersData = []; // Array to hold all fetched online user data
    let lastFilteredUsers = []; // Array to hold the list currently displayed in the online section
    let fetchInterval = null; // To hold the interval ID

    // --- Configuration ---
    const apiUrlBase = 'https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f';
    const apiLimit = 500; // Limit per API page
    const fetchIntervalDuration = 120000; // 2 minutes (120 * 1000) as per your original interval
    const maxHistorySize = 100; // Example limit for previous users history

    // --- Helper Functions (Moved/Updated) ---

    /**
     * Checks if a user's birthday is today.
     * @param {string | Date | null} birthday - The user's birthday.
     * @returns {boolean} - True if birthday is today, false otherwise.
     */
    function isBirthday(birthday) {
        if (!birthday) return false;
        try {
            const today = new Date();
            const birthDate = new Date(birthday);
             // Check if the date is valid before comparing
            if (isNaN(birthDate.getTime())) {
                 // console.warn("Invalid birthday date string:", birthday); // Can be noisy
                 return false;
            }
            return today.getDate() === birthDate.getDate() && today.getMonth() === birthDate.getMonth();
        } catch (e) {
             console.error("Error checking birthday:", e);
             return false;
        }
    }

    // --- Storage Functions (Adapted from your original) ---
    // NOTE: The IndexedDB logic is kept separate as in your original code structure.

    /**
     * Opens the IndexedDB database.
     * @returns {Promise<IDBDatabase>}
     */
    function openIndexedDB() {
        return new Promise((resolve, reject) => {
             if (!('indexedDB' in window)) {
                 console.warn("IndexedDB not supported by this browser.");
                 reject(new Error("IndexedDB not supported."));
                 return;
             }
            const request = indexedDB.open('UserDatabase', 1);

            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                 console.log("IndexedDB upgrade needed or creating database.");
                 if (!db.objectStoreNames.contains('users')) { // Use consistent store name 'users'
                      const objectStore = db.createObjectStore('users', { keyPath: 'key' });
                     console.log("Created object store: 'users'");
                     // objectStore.createIndex('username', 'value.username', { unique: false }); // Example index
                 } else {
                     console.log("Object store 'users' already exists.");
                 }
            };

            request.onsuccess = function(event) {
                const db = event.target.result;
                 db.onerror = (err) => console.error("IndexedDB Database Error:", err.target.error); // Generic DB error handler
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
     * @returns {Promise<Array<Object>>} Resolves with the data array, or [] on error/not found.
     */
    async function loadFromIndexedDB(key) {
        let db;
        try {
            db = await openIndexedDB();
        } catch (error) {
            console.error("Failed to open IndexedDB for loading:", error);
            return []; // Return empty array if DB fails to open
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction('users', 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(key);

            request.onsuccess = function(event) {
                 // Data is stored in the 'value' property { key: 'keyName', value: [...] }
                resolve(event.target.result ? event.target.result.value : []);
            };
            request.onerror = function(event) {
                console.error(`IndexedDB Load Error for key '${key}':`, event.target.error);
                // Resolve with empty array on load error to keep the app running
                resolve([]);
            };
        });
    }

    /**
     * Saves data for a specific key to IndexedDB.
     * @param {string} key - The key to save under.
     * @param {Array<Object>} users - The data array.
     * @returns {Promise<void>} Resolves when save is complete, rejects on error.
     */
    async function saveToIndexedDB(key, users) {
        if (!Array.isArray(users)) {
            console.error(`Attempted to save non-array data to IndexedDB for key '${key}'. Aborting.`, users);
            return; // Prevent saving invalid data
        }

        let db;
        try {
            db = await openIndexedDB();
        } catch (error) {
             console.error("Failed to open IndexedDB for saving:", error);
            throw error; // Propagate error
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction('users', 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put({ key: key, value: users }); // Store as { key, value }

            request.onsuccess = function() {
                resolve();
            };
            request.onerror = function(event) {
                 console.error(`IndexedDB Save Error for key '${key}':`, event.target.error);
                reject(event.target.error);
            };
             // Also listen for transaction events for more robust error handling
             transaction.oncomplete = () => console.log(`IndexedDB transaction for key '${key}' complete.`);
             transaction.onabort = (event) => {
                 console.error(`IndexedDB transaction for key '${key}' aborted.`, event.target.error);
                 reject(event.target.error);
             };
              transaction.onerror = (event) => {
                 console.error(`IndexedDB transaction for key '${key}' failed.`, event.target.error);
                 reject(event.target.error);
             };
        });
    }

    /**
     * Loads data from either Local Storage, Session Storage, or IndexedDB.
     * Uses the global `storageType` variable to decide.
     * @param {string} key - The key to load.
     * @returns {Promise<Array<Object>>} Resolves with data array or [].
     */
    async function loadUsers(key) {
        console.log(`Loading data for key '${key}' using storage type: ${storageType}`);
        if (storageType === "indexedClicked") { // Keep original check logic
            try {
                 const data = await loadFromIndexedDB(key);
                 console.log(`Loaded ${data.length} items from IndexedDB for key '${key}'.`);
                 return data;
            } catch (error) {
                 console.error(`Failed to load from IndexedDB for key '${key}'.`, error);
                 // Fallback or return empty array on IDB load error
                 return [];
            }
        } else {
            const storage = storageType === "local" ? localStorage : sessionStorage;
            try {
                const storedUsers = storage.getItem(key);
                 const data = storedUsers ? JSON.parse(storedUsers) : [];
                 console.log(`Loaded ${data.length} items from ${storageType} storage for key '${key}'.`);
                return data;
            } catch (error) {
                 console.error(`Error loading from ${storageType} storage key '${key}':`, error);
                 return []; // Return empty array on error
            }
        }
    }

    /**
     * Saves data to either Local Storage, Session Storage, or IndexedDB.
     * Uses the global `storageType` variable to decide.
     * @param {string} key - The key to save under.
     * @param {Array<Object>} users - The data array.
     * @returns {Promise<void>}
     */
    async function saveUsers(key, users) {
        if (!Array.isArray(users)) {
            console.error(`Attempted to save non-array data for key '${key}'. Aborting save.`, users);
            return; // Prevent saving invalid data
        }
         console.log(`Saving ${users.length} items for key '${key}' using storage type: ${storageType}`);

        if (storageType === "indexedClicked") { // Keep original check logic
             try {
                 await saveToIndexedDB(key, users);
                 console.log(`Saved to IndexedDB for key '${key}'.`);
            } catch (error) {
                 console.error(`Failed to save to IndexedDB for key '${key}'.`, error);
                 // Depending on requirements, you might want to notify the user
            }
        } else {
            const storage = storageType === "local" ? localStorage : sessionStorage;
            try {
                storage.setItem(key, JSON.stringify(users));
                 console.log(`Saved to ${storageType} storage for key '${key}'.`);
            } catch (error) {
                 console.error(`Error saving to ${storageType} storage key '${key}':`, error);
                 // Depending on requirements, you might want to notify the user
            }
        }
    }

    /**
     * Gets all keys currently stored in the IndexedDB object store.
     * Useful for populating storage type options.
     * @returns {Promise<string[]>}
     */
     async function getIndexedDBKeys() {
         let db;
         try {
             db = await openIndexedDB();
         } catch (error) {
             console.warn("Failed to open IndexedDB to get keys:", error);
             return []; // Return empty array if DB fails to open
         }

         return new Promise((resolve, reject) => {
             const transaction = db.transaction('users', 'readonly'); // Use consistent store name 'users'
             const store = transaction.objectStore('users');
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


    // --- Core Application Logic Functions (Adapted from your original) ---

    /** Fetches online user data, populates filters, and displays users. */
    async function fetchData() {
        console.log("Fetching online user data...");
        showOnlineLoadingIndicator("Loading online users...");
        clearOnlineErrorDisplay(); // Clear previous errors

        allOnlineUsersData = []; // Reset data array

        const limit = apiLimit;
        let offset = 0;
        let continueFetching = true;
        const maxOverallLimit = 5000; // Safety limit

        while (continueFetching && offset < maxOverallLimit) {
            const apiUrl = `${apiUrlBase}&limit=${limit}&offset=${offset}`;
             console.log(`Fetching API page: ${offset / limit + 1} at offset ${offset}`);
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

                const response = await fetch(apiUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) {
                     const errorBody = await response.text().catch(() => `Status: ${response.status}`);
                     throw new Error(`HTTP error! status: ${response.status}, details: ${errorBody}`);
                }
                const data = await response.json();

                if (data.results && data.results.length > 0) {
                     console.log(`Received ${data.results.length} results.`);
                    allOnlineUsersData = allOnlineUsersData.concat(data.results);
                     showOnlineLoadingIndicator(`Fetched ${allOnlineUsersData.length} users...`);

                    if (data.results.length < limit) {
                        continueFetching = false;
                    } else {
                        offset += limit;
                    }
                } else {
                    continueFetching = false; // No more results
                     console.log("No more results from API.");
                }
            } catch (error) {
                console.error("Fetch error:", error);
                 if (error.name === 'AbortError') {
                     console.error("API Fetch timed out.");
                 }
                showOnlineErrorDisplay(`Failed to fetch data: ${error.message}`);
                if (onlineUsersDiv) onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error fetching data.</p>'; // Clear and show error in list
                continueFetching = false; // Stop fetching on error
                // Do NOT return here, let finally block execute
            }
        }

        if (offset >= maxOverallLimit) {
            console.warn(`Fetch stopped after reaching max overall limit (${maxOverallLimit} users).`);
            showOnlineErrorDisplay(`Load stopped at ${maxOverallLimit} users.`);
        }

        console.log(`Finished fetching. Total users: ${allOnlineUsersData.length}`);
        // --- Post-fetch actions ---
        populateFilters(allOnlineUsersData); // Populate filters based on all fetched data
        applyFiltersAndDisplay(); // Apply filters and display online users
        displayPreviousUsers(); // Refresh previous users display based on NEW online data

         hideOnlineLoadingIndicator();
    }

    /** Populates the tag and age filter dropdowns. */
    function populateFilters(users) {
         if (!filterTagsSelect || !filterAgeSelect) {
              console.warn("Filter select elements not found. Cannot populate filters.");
              return;
         }
        console.log("Populating filters...");
        const tagFrequency = {};
        const ages = new Set();

        users.forEach(user => {
            if (user.tags && Array.isArray(user.tags)) { // Ensure tags is an array
                user.tags.forEach(tag => {
                     if (typeof tag === 'string') { // Ensure tag is a string
                        const lowerTag = tag.toLowerCase();
                        tagFrequency[lowerTag] = (tagFrequency[lowerTag] || 0) + 1;
                     }
                });
            }
            if (user.age && typeof user.age === 'number' && user.age > 0) { // Ensure valid positive age
                ages.add(user.age);
            }
        });

        // Sort tags by frequency, then alphabetically if tied
        const sortedTags = Object.entries(tagFrequency)
            .sort(([, countA], [, countB]) => countB - countA || (countA === countB ? a[0].localeCompare(b[0]) : 0)) // Sort by count, then alphabetically
            .slice(0, 50) // Limit to top 50 tags
            .map(entry => entry[0]);

         // Preserve current selections before updating innerHTML
         const selectedTags = Array.from(filterTagsSelect.selectedOptions).map(opt => opt.value.toLowerCase());
        filterTagsSelect.innerHTML = '<option value="">-- All Tags --</option>' + // Default option
             sortedTags.map(tag =>
                 `<option value="${tag}" ${selectedTags.includes(tag) ? 'selected' : ''}>${tag} (${tagFrequency[tag]})</option>`
             ).join('');

        // Sort ages numerically
        const sortedAges = Array.from(ages).sort((a, b) => a - b);
         const selectedAges = Array.from(filterAgeSelect.selectedOptions).map(opt => parseInt(opt.value));
        filterAgeSelect.innerHTML = '<option value="">-- All Ages --</option>' + // Default option
             sortedAges.map(age =>
                 `<option value="${age}" ${selectedAges.includes(age) ? 'selected' : ''}>${age}</option>`
             ).join('');

         console.log("Filter population complete.");

         // Populate IndexedDB keys to storage selector (only adds new keys)
         populateStorageOptions();
    }

     /**
     * Applies filters from selects and/or button overrides and displays users.
     * Saves the filtered list to `lastFilteredUsers`.
     * @param {Object} [buttonFilters={}] - Optional filters from specific buttons { tag: 'tagName' } or { age: 18 }.
     */
    function applyFiltersAndDisplay(buttonFilters = {}) {
        console.log("Applying filters...", { buttonFilters });

        // Determine filters from selects or button overrides
        const filterTags = buttonFilters.tag ? [buttonFilters.tag.toLowerCase()] : Array.from(filterTagsSelect?.selectedOptions || []).map(option => option.value.toLowerCase()).filter(tag => tag !== ''); // Filter out empty default option
        const filterAges = buttonFilters.age ? [buttonFilters.age] : Array.from(filterAgeSelect?.selectedOptions || []).map(option => parseInt(option.value)).filter(age => !isNaN(age)); // Filter out empty default option and NaN

        console.log("Active filters:", { filterTags, filterAges });

        const filteredUsers = allOnlineUsersData.filter(user => {
            const isPublic = user.current_show === 'public';
            const hasTags = filterTags.length === 0 || (user.tags && Array.isArray(user.tags) && filterTags.some(tag => user.tags.map(t => t.toLowerCase()).includes(tag)));
            const isAgeMatch = filterAges.length === 0 || (user.age && typeof user.age === 'number' && filterAges.includes(user.age));

            return isPublic && hasTags && isAgeMatch;
        });

        console.log(`Filtered down to ${filteredUsers.length} users.`);
        lastFilteredUsers = filteredUsers; // --- Store the filtered list ---
        displayOnlineUsersList(filteredUsers); // Use a distinct name to avoid confusion with function name
    }


    /** Displays the given list of online users in the online users div. */
    function displayOnlineUsersList(usersToDisplay) { // Renamed function for clarity
         if (!onlineUsersDiv) { console.warn("Online users display div not found."); return; }
        console.log(`Displaying ${usersToDisplay.length} filtered online users.`);
        onlineUsersDiv.innerHTML = ""; // Clear previous list

        if (usersToDisplay.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found with these filters.</p>';
            return;
        }

         // Optional: Sort users (e.g., by tokens, viewers, age, alphabetical)
         // usersToDisplay.sort((a, b) => b.num_tokens - a.num_tokens); // Example: Sort by tokens

        usersToDisplay.forEach(user => {
            // Basic data validation before creating element
            if (!user || !user.image_url || !user.username || !user.iframe_embed) {
                console.warn("Skipping user with incomplete data:", user);
                return;
            }

            const userElement = createUserElement(user, 'online'); // Use helper
            onlineUsersDiv.appendChild(userElement);
        });
         console.log("Online users display complete.");
    }


    /** Displays the previous users list, checking their current online status. */
    async function displayPreviousUsers() { // Keep original name for external calls if needed
         if (!previousUsersDiv) { console.warn("Previous users display div not found."); return; }
         console.log(`Attempting to display previous users (${previousUsers.length} saved).`);
         previousUsersDiv.innerHTML = "";

         // Ensure previousUsers is loaded before displaying
         if (previousUsers.length === 0) {
             previousUsers = await loadUsers("previousUsers"); // Ensure previousUsers state is up-to-date
             if (previousUsers.length === 0) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users saved yet.</p>';
                console.log("No previous users saved.");
                return;
             }
         }


         // If online data hasn't loaded yet, we can't check online status.
         if (allOnlineUsersData.length === 0) {
              console.warn("Online user data not available yet. Cannot display previous users with online check.");
               previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Fetching online data to display previous users...</p>';
              return;
         }
          console.log(`Found ${allOnlineUsersData.length} currently online users.`);


         // Filter previous users to show only those currently online and public
         const currentlyOnlineAndPublicPreviousUsers = previousUsers.filter(prevUser => {
             // Find the user in the current online data (compare usernames)
             const onlineUser = allOnlineUsersData.find(online => online.username === prevUser.username);
             // Check if found AND if their current show status is 'public'
             const isOnlineAndPublic = onlineUser && onlineUser.current_show === 'public';
             // console.log(`Checking previous user ${prevUser.username}: Online & Public? ${isOnlineAndPublic}`); // Debugging filter
             return isOnlineAndPublic;
         });

         console.log(`Displaying ${currentlyOnlineAndPublicPreviousUsers.length} previous users (currently online & public).`);

         if (currentlyOnlineAndPublicPreviousUsers.length === 0) {
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">None of your saved users are currently online & public.</p>';
              return;
         }

         // Display the filtered list in the previous users div
         currentlyOnlineAndPublicPreviousUsers.forEach(user => {
             // Basic data validation before creating element
             if (!user || !user.image_url || !user.username || !user.iframe_embed) {
                console.warn("Skipping previous user with incomplete data:", user);
                return;
            }
             const userElement = createUserElement(user, 'previous'); // Use helper, indicate type
             previousUsersDiv.appendChild(userElement);
         });
          console.log("Previous users display complete.");
    }


    /**
     * Creates a DOM element for a single user with details and event listeners.
     * @param {Object} user - The user object.
     * @param {'online' | 'previous'} listType - The type of list this element is for.
     * @returns {HTMLElement} - The created div element.
     */
    function createUserElement(user, listType) {
        const userElement = document.createElement("div");
        userElement.className = `user-info ${listType}-list-item`; // Add class for styling
        userElement.dataset.username = user.username; // Store username on element

        // Use template literal for structure and details
        userElement.innerHTML = `
            <img src="${user.image_url}" alt="${user.username} thumbnail" loading="lazy"> <!-- Add alt text and lazy loading -->
            <div class="user-details">
                <p class="username">${user.username}</p>
                <p>Age: ${user.age || 'N/A'} ${user.is_new ? '<span class="badge new-badge">New</span>' : ''}</p> <!-- Add span for styling 'New' -->
                <p class="tags">Tags: ${user.tags?.join(', ') || 'N/A'}</p> <!-- Handle missing tags -->
                ${isBirthday(user.birthday) ? `<p class="birthday">🎂 Happy Birthday! 🎂</p>` : ''} <!-- Use static utility -->
            </div>
            ${listType === 'previous' ? '<button class="remove-user-btn" title="Remove from history">X</button>' : ''} <!-- Add remove button for history -->
        `;

        // Add click listener to load iframe
        // Target details div or image to be clickable area
        const clickableArea = userElement.querySelector('.user-details') || userElement.querySelector('img');
        if (clickableArea) {
             clickableArea.addEventListener("click", function(event) {
                 event.preventDefault(); // Prevent default link behavior if img is in a link
                 // Use the user object directly, it has all info needed
                 handleUserClick(user);
            });
        } else {
            console.warn("Could not find clickable area for user element:", user.username);
        }


        // Add listener for the remove button if it exists (only for previous list items)
        const removeBtn = userElement.querySelector('.remove-user-btn');
        if (removeBtn) {
            removeBtn.addEventListener("click", async function(event) {
                event.stopPropagation(); // Prevent click on remove button from triggering iframe load
                console.log(`User clicked remove for: ${user.username}`);
                await removeFromPreviousUsers(user.username);
                displayPreviousUsers(); // Refresh the previous users list display
            });
        }

        return userElement;
    }


    /**
     * Handles user click event to load iframe and add to previous users.
     * @param {Object} user - The user object that was clicked.
     */
    function handleUserClick(user) {
         if (!mainIframe || !mainIframe2) {
              console.warn("Iframe elements not found. Cannot load user.");
              return;
         }
        console.log(`User clicked: ${user.username}`);

        const iframeChoiceRadio = document.querySelector('input[name="iframeChoice"]:checked');
        const iframeChoice = iframeChoiceRadio ? iframeChoiceRadio.value : 'mainIframe'; // Default to mainIframe
        let selectedIframe;

        if (iframeChoice === 'mainIframe2') {
            selectedIframe = mainIframe2;
        } else {
            selectedIframe = mainIframe;
        }

         // Ensure the iframe URL is correctly formatted
        selectedIframe.src = `https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=${user.username}`;
        console.log(`Loading ${user.username} into ${iframeChoice}.`);

        // Add or move the user to the top of the previous users list
         addToPreviousUsers(user); // This is async internally
    }


    /**
     * Adds a user to the previous users history, ensuring uniqueness and limit.
     * Moves user to front if already exists. Saves to storage.
     * @param {Object} user - The user object to add.
     */
    async function addToPreviousUsers(user) {
        // Remove user if already in the list to move them to the front
        previousUsers = previousUsers.filter(u => u.username !== user.username);

        // Add the user to the beginning of the array
        previousUsers.unshift(user);

        // Trim the array if it exceeds the max size
        if (previousUsers.length > maxHistorySize) {
            previousUsers = previousUsers.slice(0, maxHistorySize);
            console.log(`Previous users history trimmed to max size ${maxHistorySize}.`);
        }

        console.log(`Added/Moved ${user.username} to previous users history state.`);
        await saveUsers("previousUsers", previousUsers); // Save the updated list
        // The display of previous users is updated by the main fetch/filter cycle or explicit calls
        // We don't need to call displayPreviousUsers() here if it's already handled after fetch
        // displayPreviousUsers(); // Might cause flicker if called too often
    }

     /**
      * Removes a user from the previous users history by username. Saves to storage.
      * @param {string} username - The username to remove.
      */
     async function removeFromPreviousUsers(username) {
         console.log(`Attempting to remove ${username} from history.`);
         const initialCount = previousUsers.length;
         previousUsers = previousUsers.filter(u => u.username !== username);
         if (previousUsers.length < initialCount) {
             console.log(`Successfully removed ${username} from history state.`);
             await saveUsers("previousUsers", previousUsers); // Save the updated list
         } else {
             console.warn(`Attempted to remove ${username}, but they were not found in the current history state.`);
         }
     }

     /** Clears the previous users history from state and storage. */
     async function clearPreviousUsers() {
         console.log("Clearing previous users history...");
         previousUsers = []; // Clear state
         removedUsers = []; // Assuming removedUsers should also be cleared

         // Clear from storage based on current storage type
         if (storageType === "indexedClicked") {
             let db;
             try {
                 db = await openIndexedDB();
                  // Delete both keys if they exist
                 const tx = db.transaction('users', 'readwrite');
                 tx.objectStore('users').delete('previousUsers');
                 tx.objectStore('users').delete('removedUsers');
                 await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; tx.onabort = reject; });
                 console.log("Previous and Removed users cleared from IndexedDB.");
             } catch (error) {
                 console.error("Error clearing history from IndexedDB:", error);
             }
         } else {
             const storage = storageType === "local" ? localStorage : sessionStorage;
             try {
                storage.removeItem('previousUsers');
                storage.removeItem('removedUsers');
                console.log(`Previous and Removed users cleared from ${storageType} storage.`);
             } catch (error) {
                 console.error(`Error clearing history from ${storageType} storage:`, error);
             }
         }
         displayPreviousUsers(); // Refresh display
         console.log("Previous users history cleared.");
     }


     /**
      * Initializes the options for the storage type selector, including IndexedDB keys.
      */
     async function populateStorageOptions() {
         if (!storageTypeSelector) {
             console.warn("Storage type selector element not found. Cannot populate storage options.");
             return;
         }

         // Ensure Local and Session storage options are always present
         const existingValues = Array.from(storageTypeSelector.options).map(opt => opt.value);
         if (!existingValues.includes('local')) storageTypeSelector.add(new Option('Local Storage', 'local'));
         if (!existingValues.includes('session')) storageTypeSelector.add(new Option('Session Storage', 'session'));
         // Keep the "indexedClicked" value if it's already there from HTML, otherwise add "indexedDB"
         if (!existingValues.includes('indexedClicked') && !existingValues.includes('indexedDB')) {
             // Decide which to add based on your intended IndexedDB key logic
             // For now, stick to your original 'indexedClicked' check in load/save
              if (!existingValues.includes('indexedClicked')) storageTypeSelector.add(new Option('IndexedDB', 'indexedClicked'));
         }


         // Add keys from IndexedDB if available, except standard ones
         try {
             const idbKeys = await getIndexedDBKeys();
              console.log("Found IndexedDB keys:", idbKeys);
             idbKeys.forEach(key => {
                 // Check if key is already an option (case-sensitive check)
                 if (!Array.from(storageTypeSelector.options).some(opt => opt.value === key)) {
                      // Avoid adding default history keys again if they exist as separate options
                      if (key !== 'previousUsers' && key !== 'removedUsers' && key !== 'indexedClicked') {
                         const option = new Option(`IndexedDB: ${key}`, key); // Show key name in option text
                         storageTypeSelector.add(option);
                         console.log(`Added custom IndexedDB key '${key}' to storage options.`);
                      }
                 }
             });
         } catch (error) {
             console.warn("Could not populate custom IndexedDB keys:", error);
             // Error message already logged in getIndexedDBKeys
         }

          // Set the selector to the current `storageType` state if that option exists
          if (storageTypeSelector.querySelector(`option[value="${storageType}"]`)) {
              storageTypeSelector.value = storageType;
          } else {
              // If the saved/default storageType isn't available as an option, default to local
              console.warn(`Current storageType ('${storageType}') not available as option. Defaulting to 'local'.`);
              storageType = 'local';
              storageTypeSelector.value = 'local';
          }
          console.log(`Initial storage type selector value set to: ${storageTypeSelector.value}`);
     }


    // --- Reporting Functions (NEW) ---

    /**
     * Sends the currently filtered/displayed online users list as a report
     * to the configured server-side endpoint.
     */
    async function sendReport() {
        console.log("Attempting to send report...");

        if (!REPORT_SERVER_ENDPOINT || REPORT_SERVER_ENDPOINT === '/api/send-user-report') {
             console.error("Report server endpoint is not configured! Please update REPORT_SERVER_ENDPOINT.");
             showReportStatus("Error: Report server endpoint not configured.", 'error');
             return;
        }
         // Basic validation for a valid URL format (optional but good practice)
         try { new URL(REPORT_SERVER_ENDPOINT, window.location.origin); } catch(e) {
              console.error("REPORT_SERVER_ENDPOINT is not a valid URL:", e);
              showReportStatus("Error: Report server endpoint URL is invalid.", 'error');
              return;
         }


        if (lastFilteredUsers.length === 0) {
            console.warn("No users in the current filtered list to report.");
            showReportStatus("No users to report in the current view.", 'warning');
            return;
        }

        showReportLoading("Sending report...");
        clearReportStatus(); // Clear previous status message

        // Prepare data to send - select relevant fields to reduce payload size
        const reportData = lastFilteredUsers.map(user => ({
            username: user.username,
            age: user.age,
            tags: user.tags,
            current_show: user.current_show,
            num_tokens: user.num_tokens, // Include tokens if available in API data
            num_viewers: user.num_viewers, // Include viewers if available
            is_new: user.is_new,
            birthday: user.birthday
            // Add other fields if your report needs them
        }));

        console.log(`Sending report for ${reportData.length} users to ${REPORT_SERVER_ENDPOINT}...`);

        try {
            const response = await fetch(REPORT_SERVER_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add any necessary authentication headers here (e.g., API Key)
                    // 'X-Api-Key': 'YOUR_SECRET_API_KEY'
                },
                body: JSON.stringify(reportData),
                 // Add a timeout for the report request
                 signal: AbortController.timeout(30000) // 30 seconds timeout (requires modern browser or polyfill)
                 // Fallback for older browsers:
                 // const controller = new AbortController();
                 // const timeoutId = setTimeout(() => controller.abort(), 30000);
                 // signal: controller.signal
            });

            // clearTimeout(timeoutId); // If using manual AbortController

            if (!response.ok) {
                 // Try to get server error message if available
                 const errorBody = await response.text().catch(() => response.statusText);
                 throw new Error(`Server responded with status ${response.status}: ${errorBody}`);
            }

            // Assume server responds with JSON indicating success/failure
            const result = await response.json();

            if (result.status === 'success') {
                console.log("Report sent successfully!", result.message);
                showReportStatus(result.message || "Report sent successfully!", 'success');
            } else {
                console.error("Server reported an error sending report:", result.message);
                 showReportStatus(`Report failed: ${result.message || 'Unknown error from server'}`, 'error');
            }

        } catch (error) {
            console.error("Error during report fetch:", error);
             if (error.name === 'AbortError') {
                 showReportStatus("Report request timed out.", 'error');
                 console.error("Report request timed out.");
             } else {
                 showReportStatus(`Failed to send report: ${error.message}`, 'error');
             }
        } finally {
            hideReportLoading(); // Always hide loading indicator
             console.log("Report sending process finished.");
        }
    }


    // --- Loading and Error Display Helpers (Adapted) ---

    function showOnlineLoadingIndicator(message = 'Loading...') {
        console.log(`SHOW ONLINE LOADING: ${message}`);
        if (onlineLoadingIndicator) {
            onlineLoadingIndicator.textContent = message;
            onlineLoadingIndicator.style.display = 'block';
             // Clear online list while loading to avoid showing stale data
             if (onlineUsersDiv) onlineUsersDiv.innerHTML = '';
        }
         // Optional: Hide online user list container if it takes up space
         // if (onlineUsersDiv) onlineUsersDiv.style.display = 'none';
    }

    function hideOnlineLoadingIndicator() {
        console.log("HIDE ONLINE LOADING");
        if (onlineLoadingIndicator) {
            onlineLoadingIndicator.style.display = 'none';
        }
         // Optional: Show online user list container again
         // if (onlineUsersDiv) onlineUsersDiv.style.display = ''; // Or 'block', 'flex', etc.
    }

    function showOnlineErrorDisplay(message) {
        console.error(`SHOW ONLINE ERROR: ${message}`);
        if (onlineErrorDisplay) {
            onlineErrorDisplay.textContent = `Error: ${message}`;
            onlineErrorDisplay.style.display = 'block';
        }
    }

     function clearOnlineErrorDisplay() {
          console.log("CLEAR ONLINE ERROR DISPLAY");
          if (onlineErrorDisplay) {
            onlineErrorDisplay.style.display = 'none';
            onlineErrorDisplay.textContent = '';
        }
     }

     // --- New Reporting Status Display Helpers ---
     function showReportLoading(message = 'Sending...') {
         console.log(`SHOW REPORT LOADING: ${message}`);
         if (reportLoadingIndicator) {
             reportLoadingIndicator.textContent = message;
             reportLoadingIndicator.style.display = 'block';
         }
         clearReportStatus(); // Clear previous status when loading
     }

     function hideReportLoading() {
          console.log("HIDE REPORT LOADING");
         if (reportLoadingIndicator) {
             reportLoadingIndicator.style.display = 'none';
         }
     }

     /**
      * Displays a report status message.
      * @param {string} message - The message to display.
      * @param {'success' | 'error' | 'warning' | 'info'} [type='info'] - Type for potential styling via CSS class.
      */
     function showReportStatus(message, type = 'info') {
         console.log(`SHOW REPORT STATUS (${type}): ${message}`);
         if (reportStatusDisplay) {
             reportStatusDisplay.textContent = message;
             reportStatusDisplay.style.display = 'block';
             // Add classes for styling based on type (you'll need CSS rules for these)
             reportStatusDisplay.className = `report-status ${type}`;
             // Optional: Hide status after a few seconds if not an error
             if (type !== 'error') {
                 setTimeout(clearReportStatus, 5000); // Clear success/warning after 5 seconds
             }
         }
     }

      clearReportStatus() {
           console.log("CLEAR REPORT STATUS");
          if (reportStatusDisplay) {
            reportStatusDisplay.style.display = 'none';
            reportStatusDisplay.textContent = '';
            reportStatusDisplay.className = 'report-status'; // Reset classes
        }
     }


    // --- Initial Setup and Event Listeners ---

    // Validate essential DOM elements (consider adding report elements here too)
    function validateDOMReferences() {
        const missing = [];
        if (!onlineUsersDiv) missing.push("#onlineUsers .user-list");
        if (!previousUsersDiv) missing.push("#previousUsers .user-list");
        if (!mainIframe) missing.push("#mainIframe");
        if (!mainIframe2) missing.push("#mainIframe2");
        if (!storageTypeSelector) missing.push("#storageType");
        if (!filterTagsSelect) missing.push("#filterTags");
        if (!filterAgeSelect) missing.push("#filterAge");
        // Report elements are optional, log warning if missing
        if (!sendReportButton) console.warn("Send report button (#sendReportButton) not found. Reporting functionality will not be available.");
        if (!reportLoadingIndicator) console.warn("Report loading indicator (#reportLoadingIndicator) not found.");
        if (!reportStatusDisplay) console.warn("Report status display (#reportStatusDisplay) not found.");


        if (missing.length > 0) {
            console.error("ERROR: Missing essential DOM elements:", missing.join(', '));
            // You might want to disable significant parts of the app here
            // return false; // Indicate failure
        } else {
            console.log("Essential DOM elements found.");
            // return true; // Indicate success
        }
         // Note: We won't strictly enforce missing optionals from stopping the app
         // but critical ones might need stronger handling (e.g., throwing an error)
    }
     validateDOMReferences();


    // Set up initial event listeners
    function setupEventListeners() {
        console.log("Setting up event listeners...");

        // Storage Type Change
        storageTypeSelector?.addEventListener("change", async function() {
            storageType = this.value;
             // Reload history from the newly selected storage type
            previousUsers = await loadUsers("previousUsers");
            // removedUsers = await loadUsers("removedUsers"); // Keep if removedUsers storage is implemented
            displayPreviousUsers(); // Refresh the display based on reloaded history
        });

        // Filter Selects Change
        filterTagsSelect?.addEventListener("change", applyFiltersAndDisplay);
        filterAgeSelect?.addEventListener("change", applyFiltersAndDisplay);

         // Assuming you have buttons with these IDs in your HTML
         const filterAge18Button = document.getElementById("filterAge18");
         const filterTagAsianButton = document.getElementById("filterTagAsian");
         const filterTagBlondeButton = document.getElementById("filterTagBlonde");
         const clearPreviousUsersButton = document.getElementById("clearPreviousUsers"); // Add a button for this


         // Specific Filter Buttons Click (Apply filter overrides)
         filterAge18Button?.addEventListener("click", () => applyFiltersAndDisplay({ age: 18 }));
         filterTagAsianButton?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'asian' }));
         filterTagBlondeButton?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'blonde' }));
         // Add listeners for any other specific tag/age buttons here

         // Clear Previous Users Button
         clearPreviousUsersButton?.addEventListener("click", clearPreviousUsers);


        // --- New Event Listener for Report Button ---
        if (sendReportButton) {
            sendReportButton.addEventListener("click", sendReport); // Call the async sendReport function
            console.log("Report button event listener added.");
        }


        console.log("Event listeners setup complete.");
    }
    setupEventListeners();


    // Start the periodic fetch interval
    function startFetchInterval() {
         if (fetchInterval) {
             clearInterval(fetchInterval);
             console.log("Cleared previous fetch interval.");
         }
         // Note: fetchData is async, but setInterval itself is not.
         // We rely on fetchData's internal error handling and the promise chain.
         fetchInterval = setInterval(async () => {
            // Resetting allOnlineUsersData here before fetch might be desired
            // allOnlineUsersData = []; // Or handle merging/updating in fetchData
            await fetchData(); // Call the async fetch function
         }, fetchIntervalDuration);
         console.log(`Started fetching interval (${fetchIntervalDuration / 1000}s).`);
    }


    // --- Initial Data Load and Display ---

    // Load history first, then fetch online users
    // This ensures `previousUsers` is populated before `fetchData` potentially calls `displayPreviousUsers`
     previousUsers = await loadUsers("previousUsers");
    // removedUsers = await loadUsers("removedUsers"); // Load removed users history if needed
    // displayPreviousUsers(); // Initial display might be misleading if online data isn't ready

    // Initial fetch and display happens here
     await fetchData(); // This calls populateFilters, applyFiltersAndDisplay, and displayPreviousUsers internally


    startFetchInterval(); // Start periodic fetching after initial load


    // --- Expose functions globally if needed for debugging or external interaction (Optional) ---
    // window.addToPreviousUsers = addToPreviousUsers; // Might need to adjust signature if state is internal
    // window.displayPreviousUsers = displayPreviousUsers;
    // window.UserManager = UserManager; // If using the class structure again


    // --- Compatibility Placeholder (if needed by other scripts) ---
    // Based on your original code
    if (typeof window.initializeAllUsers === 'function') {
         console.warn("window.initializeAllUsers found. Executing compatibility placeholder.");
        window.initializeAllUsers();
    }

    window.initializeAllUsersFromScriptJS = function(callback) {
        console.log("initializeAllUsersFromScriptJS called.");
        if (typeof callback === 'function') {
            callback();
        }
    };

    console.log("Application initialization complete.");

});
