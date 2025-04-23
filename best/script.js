Document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM fully loaded and parsed. Starting script execution.");

    // --- Get DOM Elements ---
    const onlineUsersDiv = document.getElementById("onlineUsers") ? document.getElementById("onlineUsers").querySelector('.user-list') : null;
    const previousUsersDiv = document.getElementById("previousUsers") ? document.getElementById("previousUsers").querySelector('.user-list') : null;
    const mainIframe = document.getElementById("mainIframe");
    const mainIframe2 = document.getElementById("mainIframe2");

    const storageTypeSelector = document.getElementById("storageType");
    const filterTagsSelect = document.getElementById("filterTags");
    const filterAgeSelect = document.getElementById("filterAge");

    // Get the specific filter buttons
    const filterAge18Button = document.getElementById("filterAge18");
    const filterTagAsianButton = document.getElementById("filterTagAsian");
    const filterTagBlondeButton = document.getElementById("filterTagBlonde");
    // Add more button variables here for other tags if you add more buttons in HTML

    // Get elements for search and toggle controls (from your HTML script block)
    const controlsFilter = document.getElementById('controlsFilter'); // Assuming you have an element with this ID to toggle
    const recordContainer = document.getElementById('recordContainer'); // Assuming you have an element with this ID to toggle
    const BatWoman = document.getElementById('BatWoman'); // Assuming you have an element with this ID to toggle


    // --- State Variables ---
    let storageType = storageTypeSelector ? storageTypeSelector.value : 'local'; // Default to local if selector not found
    let previousUsers = [];
    let removedUsers = []; // 'removedUsers' seems unused in the provided code, but keeping it as it exists.
    let allOnlineUsersData = [];
    let fetchInterval = null; // To store the interval ID


    // --- Initial Load ---
    // Using async IIFE to load initial users before setting up other listeners that might rely on them
    (async () => {
        previousUsers = await loadUsers("previousUsers");
        removedUsers = await loadUsers("removedUsers"); // Load removed users even if unused
        if (previousUsersDiv) {
             displayPreviousUsers();
             console.log("Initial previousUsers and removedUsers loaded, displayPreviousUsers called.");
        } else {
             console.warn("previousUsersDiv element not found!");
        }


        // Initial population of storage options and fetching data
        if (storageTypeSelector) {
            populateStorageOptions();
        } else {
            console.error("storageTypeSelector element not found!");
        }

        await fetchData(); // Initial fetch

        // Set interval for fetching data periodically *after* the initial fetch is complete
        fetchInterval = setInterval(async () => {
            console.log("Interval triggered: Fetching new data.");
            // allOnlineUsersData = []; // Decided to replace after fetch instead of clearing immediately
            await fetchData(); // fetchData updates allOnlineUsersData and re-displays
            console.log("Interval fetch complete.");
        }, 300000); // 300000 milliseconds = 5 minutes


    })(); // End of async IIFE for initial load


    // --- Event Listeners ---

    // Storage Type Selector Change
    if (storageTypeSelector) {
        storageTypeSelector.addEventListener("change", async function() {
            console.log("Storage type changed to:", this.value);
            storageType = this.value;
            // Reload previous/removed users from the new storage type
            previousUsers = await loadUsers("previousUsers");
            removedUsers = await loadUsers("removedUsers");
            if (previousUsersDiv) {
                await displayPreviousUsers();
            }
            console.log("Storage type change processed, users reloaded.");
        });
    }


    // Filter Select Elements Change
    if (filterTagsSelect) {
        filterTagsSelect.addEventListener("change", function() {
            console.log("Tag select changed. Selected tags:", Array.from(filterTagsSelect.selectedOptions).map(option => option.value));
            displayOnlineUsers(allOnlineUsersData); // Re-display with current select filters
        });
    } else {
        console.error("filterTagsSelect element not found!");
    }

    if (filterAgeSelect) {
        filterAgeSelect.addEventListener("change", function() {
            console.log("Age select changed. Selected ages:", Array.from(filterAgeSelect.selectedOptions).map(option => option.value));
            displayOnlineUsers(allOnlineUsersData); // Re-display with current select filters
        });
    } else {
         console.error("filterAgeSelect element not found!");
    }


    // Specific Filter Buttons Click
    if (filterAge18Button) { // Check if the button exists
        filterAge18Button.addEventListener("click", function() {
            console.log("Age 18 button clicked.");
            // Optionally, you could clear the select filters here if you want buttons to be exclusive
            // if (filterAgeSelect) Array.from(filterAgeSelect.options).forEach(option => option.selected = false);
            // if (filterTagsSelect) Array.from(filterTagsSelect.options).forEach(option => option.selected = false);
            displayOnlineUsers(allOnlineUsersData, { age: 18 });
        });
    } else {
         console.warn("filterAge18Button not found.");
    }

    if (filterTagAsianButton) { // Check if the button exists
        filterTagAsianButton.addEventListener("click", function() {
            console.log("Asian tag button clicked.");
             // Optionally clear select filters
            displayOnlineUsers(allOnlineUsersData, { tag: 'asian' });
        });
    } else {
        console.warn("filterTagAsianButton not found.");
    }

    if (filterTagBlondeButton) { // Check if the button exists
        filterTagBlondeButton.addEventListener("click", function() {
            console.log("Blonde tag button clicked.");
             // Optionally clear select filters
            displayOnlineUsers(allOnlineUsersData, { tag: 'blonde' });
        });
    } else {
         console.warn("filterTagBlondeButton not found.");
    }
    // Add more event listeners for other tag buttons here


    // Toggle Controls (from your HTML script block)
     document.querySelectorAll('.btn-container button').forEach(button => {
            button.addEventListener('click', function() {
                console.log(`Toggle button clicked: ${this.id}`);
                let targetElement = null;
                if (this.id === 'toggleButton' && controlsFilter) targetElement = controlsFilter;
                else if (this.id === 'toggleButton1' && recordContainer) targetElement = recordContainer;
                else if (this.id === 'toggleButton2' && BatWoman) targetElement = BatWoman;

                if (targetElement) {
                    if (targetElement.style.display === 'none') {
                        targetElement.style.display = 'block';
                         console.log(`${targetElement.id} displayed.`);
                    } else {
                        targetElement.style.display = 'none';
                         console.log(`${targetElement.id} hidden.`);
                    }
                } else {
                     console.warn(`Toggle target element not found for button: ${this.id}`);
                }
            });
        });


    // Custom Ctrl+I Search (from your HTML script block)
    document.addEventListener('keydown', function(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'i') { // Works for both Ctrl and Cmd
            event.preventDefault(); // Prevent the browser's default search
            console.log("Ctrl/Cmd + I pressed. Initiating search.");

            const searchTerm = prompt("Search users:"); // Get search term from user
            if (searchTerm) {
                searchUsers(searchTerm);
            } else {
                 console.log("Search cancelled or empty.");
            }
        }
    });


    // --- Core Functions ---

    async function fetchData() {
        console.log("Fetching data from API...");
        const limit = 500;
        let offset = 0;
        let continueFetching = true;
        let currentFetchData = []; // Use a temporary array for the current fetch cycle

        while (continueFetching) {
            // Ensure gender is female and wm is included
            const apiUrl = `https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f&limit=${limit}&offset=${offset}`;
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    currentFetchData = currentFetchData.concat(data.results);
                    console.log(`Workspaceed ${data.results.length} users, total fetched in this cycle: ${currentFetchData.length}, next offset: ${offset + limit}`);
                    // Stop fetching if we get less than the limit (implies end of results)
                    if (data.results.length < limit) {
                        continueFetching = false;
                    } else {
                        offset += limit;
                    }
                } else {
                    continueFetching = false; // No results or empty results received
                    console.log("No more results or empty results received from API.");
                }
            } catch (error) {
                console.error("Fetch error:", error);
                if (onlineUsersDiv) {
                     onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error fetching data.</p>';
                }
                continueFetching = false; // Stop fetching on error
            }
        }

        allOnlineUsersData = currentFetchData; // Update the global data array after fetch is complete
        console.log("Fetch complete. Total online users data:", allOnlineUsersData.length);

        // Populate filters and display users only after data is fetched
        if (filterTagsSelect && filterAgeSelect) {
             populateFilters(allOnlineUsersData);
             console.log("Filters populated.");
        } else {
             console.warn("Filter select elements not found, skipping filter population.");
        }


        if (onlineUsersDiv) {
             onlineUsersDiv.innerHTML = ""; // Clear before initial display or refresh display
            displayOnlineUsers(allOnlineUsersData); // Display with current select filters (buttons handled by their listeners)
            console.log("Initial or refresh display of online users called.");
        } else {
             console.error("onlineUsersDiv element not found!");
        }


        // This might be called by other scripts; ensure data is loaded when it runs
        if (typeof window.initializeAllUsers === 'function') {
            window.initializeAllUsers();
            console.log("window.initializeAllUsers called.");
        }
    }

    // Modify displayOnlineUsers to accept optional filter parameters from buttons
    function displayOnlineUsers(users, buttonFilters = {}) {
        console.log(`displayOnlineUsers called with ${users.length} users. Button filters:`, buttonFilters);

        if (!onlineUsersDiv) {
             console.error("onlineUsersDiv element not found, cannot display users.");
             return; // Exit if the display div doesn't exist
        }

        // Determine filters to apply: button filter overrides select filter for that type
        const filterTags = buttonFilters.tag ? [buttonFilters.tag] : (filterTagsSelect ? Array.from(filterTagsSelect.selectedOptions).map(option => option.value) : []);
        const filterAges = buttonFilters.age ? [buttonFilters.age] : (filterAgeSelect ? Array.from(filterAgeSelect.selectedOptions).map(option => parseInt(option.value)) : []);

        console.log("Applied Filters - Tags:", filterTags, "Ages:", filterAges);


        const filteredUsers = users.filter(user => {
            // Ensure user and necessary properties exist before accessing them
            if (!user || user.current_show === undefined || user.tags === undefined || user.age === undefined) {
                // console.warn("Skipping user with incomplete data:", user); // Optional: Log incomplete data
                return false; // Exclude users with missing critical data
            }

            const isPublic = user.current_show === 'public';

            // Check if the user has AT LEAST ONE of the selected tags, or if no tags are selected
            // Ensure user.tags is an array before calling some()
            const hasTags = filterTags.length === 0 || (Array.isArray(user.tags) && filterTags.some(tag => user.tags.includes(tag)));

            // Check if the user's age is IN the selected ages, or if no ages are selected
            const isAgeMatch = filterAges.length === 0 || filterAges.includes(user.age); // user.age is already checked for existence above

            return isPublic && hasTags && isAgeMatch;
        });

        console.log("Filtered users count:", filteredUsers.length);

        onlineUsersDiv.innerHTML = ""; // Clear the current list
        console.log("onlineUsersDiv cleared.");

        if (filteredUsers.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found with these filters.</p>';
            console.log("No filtered users, displayed message.");
            return;
        }

        filteredUsers.forEach(user => {
            if (!user.image_url || !user.username) {
                console.warn("Skipping user with incomplete display data (missing image_url or username):", user);
                return; // Skip users with essential display data missing
            }

            const userElement = document.createElement("div");
            userElement.className = "user-info";
            userElement.innerHTML = `
                <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}" data-username="${user.username}">
                <div class="user-details">
                    <p>Username: ${user.username}</p>
                    <p>Age: ${user.age !== undefined && user.age !== null ? user.age : 'N/A'} ${user.is_new ? 'New' : ''}</p>
                    <p>Tags: ${user.tags && Array.isArray(user.tags) && user.tags.length > 0 ? user.tags.join(', ') : 'N/A'}</p>
                    ${isBirthday(user.birthday) ? `<p>Happy Birthday!</p>` : ''}
                </div>
            `;

            userElement.addEventListener("click", function(event) {
                event.preventDefault();
                const usr = userElement.querySelector("img").dataset.username;
                const iframeChoiceInput = document.querySelector('input[name="iframeChoice"]:checked');
                const iframeChoice = iframeChoiceInput ? iframeChoiceInput.value : 'mainIframe'; // Default if radio not found or checked

                let selectedIframe = null;
                if (iframeChoice === 'mainIframe2' && mainIframe2) {
                    selectedIframe = mainIframe2;
                } else if (mainIframe) { // Default or if mainIframe2 not found
                    selectedIframe = mainIframe;
                }

                if (selectedIframe) {
                    console.log(`Loading iframe for user ${usr} into ${selectedIframe.id}`);
                    // Construct the correct URL with parameters
                    const iframeSrc = `https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=${encodeURIComponent(usr)}`;
                    selectedIframe.src = iframeSrc;
                } else {
                    console.error("No main iframe element found to load user:", usr);
                }


                addToPreviousUsers(user); // Add the clicked user to previous users
            });
            onlineUsersDiv.appendChild(userElement);
        });
        console.log("Filtered users appended to onlineUsersDiv.");
    }

    function populateFilters(users) {
        console.log(`Populating filters from ${users.length} users.`);

        if (!filterTagsSelect || !filterAgeSelect) {
            console.warn("Filter select elements not found, skipping filter population.");
            return;
        }

        const tagFrequency = {};
        const ages = new Set();

        users.forEach(user => {
            if (user.tags && Array.isArray(user.tags)) { // Ensure user.tags is an array
                user.tags.forEach(tag => {
                    tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
                });
            }
            if (user.age !== undefined && user.age !== null) { // Ensure user.age exists
                ages.add(user.age);
            }
        });

        const sortedTags = Object.entries(tagFrequency)
            .sort((a, b) => b[1] - a[1]) // Sort by frequency desc
            .slice(0, 100) // Limit to top 100 tags
            .map(entry => entry[0]);

        // Clear existing options before populating
        filterTagsSelect.innerHTML = '';
        filterAgeSelect.innerHTML = '';

        // Add a default "Any" or placeholder option (optional)
        // filterTagsSelect.innerHTML += '<option value="">Any Tag</option>';
        // filterAgeSelect.innerHTML += '<option value="">Any Age</option>';


        filterTagsSelect.innerHTML += sortedTags.map(tag => `<option value="${tag}">${tag}</option>`).join('');
        filterAgeSelect.innerHTML += Array.from(ages).sort((a, b) => a - b).map(age => `<option value="${age}">${age}</option>`).join(''); // Sort ages
         console.log(`Populated ${sortedTags.length} tags and ${ages.size} ages.`);

    }


    async function addToPreviousUsers(user) {
        console.log("Attempting to add user to previous:", user ? user.username : 'null user');
        if (!user || !user.username) {
            console.warn("Cannot add user to previous; user or username is missing.");
            return;
        }

        // Check if user is already in the previousUsers list
        if (!previousUsers.some(u => u && u.username === user.username)) {
            // Add user to the beginning of the array
            previousUsers.unshift(user);
            console.log(`User "${user.username}" added to previousUsers array.`);

            // Keep the previous users list to a reasonable size, e.g., 50
            const maxPreviousUsers = 50;
            if (previousUsers.length > maxPreviousUsers) {
                previousUsers = previousUsers.slice(0, maxPreviousUsers);
                 console.log(`Previous users list trimmed to ${maxPreviousUsers}.`);
            }

            await saveUsers("previousUsers", previousUsers);
            console.log("Previous users list saved to storage.");

            // Re-display previous users to reflect the change
             if (previousUsersDiv) {
                 displayPreviousUsers();
                 console.log("Re-displaying previous users list.");
             } else {
                  console.warn("previousUsersDiv not found, cannot re-display previous users.");
             }

        } else {
             console.log(`User "${user.username}" is already in previous users list.`);
        }
    }

    async function displayPreviousUsers() {
         console.log("Displaying previous users...");

         if (!previousUsersDiv) {
             console.error("previousUsersDiv element not found, cannot display previous users.");
             return;
         }

        previousUsersDiv.innerHTML = ""; // Clear the current list

        const storedUsers = await loadUsers("previousUsers");
         console.log(`Loaded ${storedUsers.length} previous users from storage for display.`);


         if (storedUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users yet.</p>';
            console.log("No previous users found, displayed message.");
            return;
        }

        // Display in reverse order to show most recent first
        // Filter for public show is optional, depends on if you only want to show currently online previous users
        [...storedUsers].reverse().forEach(user => {
             // Only display if user is currently online and public (optional filter)
             // Uncomment the following if you only want to see previously visited *and* currently online/public users
             // if (!allOnlineUsersData.some(onlineUser => onlineUser.username === user.username && onlineUser.current_show === 'public')) {
             //      return; // Skip if not currently online and public
             // }
            if (!user || !user.image_url || !user.username) {
                 console.warn("Skipping incomplete previous user data for display:", user);
                return; // Skip users with essential data missing
            }
            const userElement = document.createElement("div");
            userElement.className = "user-info";
            userElement.innerHTML = `
                <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}" data-username="${user.username}">
                <div class="user-details">
                    <p>Age: ${user.age !== undefined && user.age !== null ? user.age : 'N/A'}</p>
                    <p>Username: ${user.username}</p>
                    ${isBirthday(user.birthday) ? `<p>Happy Birthday!</p>` : ''}
                </div>
            `;

            userElement.addEventListener("click", function(event) {
                event.preventDefault();
                const usr = userElement.querySelector("img").dataset.username;
                const iframeChoiceInput = document.querySelector('input[name="iframeChoice"]:checked');
                const iframeChoice = iframeChoiceInput ? iframeChoiceInput.value : 'mainIframe'; // Default if radio not found or checked

                let selectedIframe = null;
                if (iframeChoice === 'mainIframe2' && mainIframe2) {
                    selectedIframe = mainIframe2;
                } else if (mainIframe) { // Default or if mainIframe2 not found
                    selectedIframe = mainIframe;
                }

                 if (selectedIframe) {
                    console.log(`Loading iframe for previous user ${usr} into ${selectedIframe.id}`);
                     // Construct the correct URL with parameters
                    const iframeSrc = `https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=${encodeURIComponent(usr)}`;
                    selectedIframe.src = iframeSrc;
                 } else {
                     console.error("No main iframe element found to load previous user:", usr);
                 }
            });

            previousUsersDiv.appendChild(userElement); // Append to add to the div
        });
         console.log("Previous users appended to previousUsersDiv.");
    }


    function isBirthday(birthday) {
        if (!birthday) return false;
        try {
            const today = new Date();
            const birthDate = new Date(birthday);
            // Check if date is valid
            if (isNaN(birthDate.getTime())) {
                 // console.warn("Invalid birthday date format:", birthday); // Log only if needed frequently
                return false;
            }
            // Check month and day (getMonth() is 0-indexed)
            return today.getDate() === birthDate.getDate() && today.getMonth() === birthDate.getMonth();
        } catch (e) {
            console.error("Error processing birthday:", birthday, e);
            return false;
        }
    }

    // --- Storage Functions (Local Storage, Session Storage, IndexedDB) ---

    async function loadUsers(key) {
         console.log("Loading users for key:", key, "from storage type:", storageType);
        if (storageType === "indexeddb") { // Ensure this matches your option value
            return await loadFromIndexedDB(key);
        } else {
            const storage = storageType === "local" ? localStorage : sessionStorage;
            const storedUsers = storage.getItem(key);
            try {
                const users = storedUsers ? JSON.parse(storedUsers) : [];
                 console.log(`Loaded ${users.length} users for key "${key}" from ${storageType} storage.`);
                 return users;
            } catch (e) {
                console.error(`Error parsing stored users for key "${key}" from ${storageType} storage:`, e);
                return []; // Return empty array on parse error
            }
        }
    }

    async function saveUsers(key, users) {
         console.log(`Saving ${users.length} users for key "${key}" to storage type:`, storageType);
        if (storageType === "indexeddb") { // Ensure this matches your option value
            await saveToIndexedDB(key, users);
        } else {
            const storage = storageType === "local" ? localStorage : sessionStorage;
            try {
                 storage.setItem(key, JSON.stringify(users));
                 console.log(`Saved users for key "${key}" to ${storageType} storage.`);
            } catch (e) {
                 console.error(`Error saving users to ${storageType} storage for key "${key}":`, e);
            }
        }
    }

    function openIndexedDB() {
        return new Promise((resolve, reject) => {
             // console.log("Opening IndexedDB 'UserDatabase'..."); // Log only if needed frequently
            const request = indexedDB.open('UserDatabase', 1);

            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                console.log("IndexedDB upgrade needed or creating for the first time.");
                // Check if object store already exists before creating
                if (!db.objectStoreNames.contains('users')) {
                   const objectStore = db.createObjectStore('users', { keyPath: 'key' });
                   // Create index if needed for future filtering/searching within IndexedDB
                   objectStore.createIndex('tags_idx', 'value.tags', { multiEntry: true, unique: false });
                   objectStore.createIndex('age_idx', 'value.age', { unique: false });
                   objectStore.createIndex('username_idx', 'value.username', { unique: false });
                    console.log("Object store 'users' created with indices.");
                } else {
                     // console.log("Object store 'users' already exists."); // Log only if needed frequently
                }
            };

            request.onsuccess = function(event) {
                const db = event.target.result;
                 // console.log("IndexedDB 'UserDatabase' opened successfully."); // Log only if needed frequently
                resolve(db);
            };
            request.onerror = function(event) {
                 console.error("Error opening IndexedDB:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    async function loadFromIndexedDB(key) {
        return new Promise(async (resolve, reject) => {
            // console.log("Loading from IndexedDB for key:", key); // Log only if needed frequently
            try {
                const db = await openIndexedDB();
                const transaction = db.transaction('users', 'readonly');
                const store = transaction.objectStore('users');
                const request = store.get(key);

                request.onsuccess = function(event) {
                    const result = event.target.result ? event.target.result.value : [];
                     console.log(`Loaded ${result.length} items for key "${key}" from IndexedDB.`);
                    resolve(result);
                };
                request.onerror = function(event) {
                     console.error(`Error getting data for key "${key}" from IndexedDB:`, event.target.error);
                    reject(event.target.error);
                };
                 transaction.onerror = function(event) { // Also listen for transaction errors
                     console.error(`Transaction error loading data for key "${key}" from IndexedDB:`, event.target.error);
                    reject(event.target.error);
                };
            } catch (e) {
                console.error("Error in loadFromIndexedDB:", e);
                resolve([]); // Resolve with empty array on error
            }
        });
    }


    function saveToIndexedDB(key, users) {
        return new Promise(async (resolve, reject) => {
            console.log(`Saving ${users.length} items for key "${key}" to IndexedDB.`);
            try {
                const db = await openIndexedDB();
                 // Check if the store exists before creating a transaction
                if (!db.objectStoreNames.contains('users')) {
                     console.error("IndexedDB object store 'users' not found, cannot save.");
                     reject(new Error("IndexedDB object store not found."));
                     return;
                }
                const transaction = db.transaction('users', 'readwrite');
                const store = transaction.objectStore('users');

                 // IndexedDB stores data based on the keyPath ('key'). We put an object
                 // with the structure { key: key, value: users_array }.
                const dataToStore = { key: key, value: users };

                const request = store.put(dataToStore);

                transaction.oncomplete = function() { // Use transaction complete
                     console.log(`Transaction complete for key "${key}". Data saved to IndexedDB.`);
                    resolve();
                };

                request.onerror = function(event) {
                    console.error(`Error putting data for key "${key}" into IndexedDB:`, event.target.error);
                    reject(event.target.error);
                };
                 transaction.onerror = function(event) { // Also listen for transaction errors
                    console.error(`Transaction error saving data for key "${key}" to IndexedDB:`, event.target.error);
                    reject(event.target.error);
                };
            } catch (e) {
                console.error("Error in saveToIndexedDB:", e);
                reject(e); // Reject on error
            }
        });
    }

    async function populateStorageOptions() {
        console.log("Populating storage options...");
         if (!storageTypeSelector) {
             console.error("storageTypeSelector element not found, cannot populate storage options.");
             return;
         }
        // Clear existing options except the default ones (local, session, indexeddb)
        const defaultOptions = storageTypeSelector.querySelectorAll('option[value="local"], option[value="session"], option[value="indexeddb"]');
        const optionsToRemove = Array.from(storageTypeSelector.options).filter(option =>
            !['local', 'session', 'indexeddb'].includes(option.value)
        );
        optionsToRemove.forEach(option => storageTypeSelector.removeChild(option));


        try {
            const db = await openIndexedDB();
            // Check if the store exists before trying to get keys
            if (!db.objectStoreNames.contains('users')) {
                 console.warn("IndexedDB object store 'users' not found, no IndexedDB keys to populate.");
                 return;
            }
            const transaction = db.transaction('users', 'readonly');
            const store = transaction.objectStore('users');
            const request = store.getAllKeys();

            request.onsuccess = function(event) {
                const keys = event.target.result;
                 console.log("IndexedDB keys found:", keys);
                // Add IndexedDB keys as options if they don't already exist
                keys.forEach(key => {
                    // Only add keys that are not the default storage types
                    if (!['local', 'session', 'indexeddb'].includes(key) &&
                         !storageTypeSelector.querySelector(`option[value="${key}"]`)) {
                         const option = document.createElement('option');
                         option.value = key;
                         option.textContent = key; // Display the key name
                         storageTypeSelector.appendChild(option);
                    }
                });
                 console.log("Storage options populated.");
            };
            request.onerror = function(event) {
                console.error("Error fetching keys from IndexedDB:", event.target.error);
            };
             transaction.onerror = function(event) {
                 console.error("Transaction error fetching keys from IndexedDB:", event.target.error);
            };
        } catch (e) {
             console.error("Error in populateStorageOptions:", e);
        }
    }


    // --- Search Functionality (from your HTML script block) ---

    function searchUsers(searchTerm) {
        console.log("Searching for:", searchTerm);
        const onlineUsersContainer = document.getElementById('onlineUsers');
        const previousUsersContainer = document.getElementById('previousUsers');

        if (!onlineUsersContainer || !previousUsersContainer) {
             console.error("Search containers not found!");
             return;
        }


        // Clear previous highlights from both sections
        clearHighlights(onlineUsersContainer);
        clearHighlights(previousUsersContainer);
         console.log("Cleared previous highlights.");

        if (!searchTerm) {
             console.log("Empty search term, only cleared highlights.");
             return; // If search term is empty, just clear highlights and stop
        }


        // Search and highlight in online users
        const onlineHighlightedCount = searchAndHighlight(onlineUsersContainer, searchTerm);
        console.log(`Highlighted ${onlineHighlightedCount} matches in online users.`);

        // Search and highlight in previous users
        const previousHighlightedCount = searchAndHighlight(previousUsersContainer, searchTerm);
         console.log(`Highlighted ${previousHighlightedCount} matches in previous users.`);


        // Scroll to the first highlight in online users, if any, otherwise in previous users.
        if (onlineHighlightedCount > 0) {
            scrollToFirstHighlight(onlineUsersContainer);
             console.log("Scrolled to first highlight in online users.");
        } else if (previousHighlightedCount > 0) {
             scrollToFirstHighlight(previousUsersContainer);
             console.log("Scrolled to first highlight in previous users.");
        } else {
             console.log("No matches found to scroll to.");
        }
    }

     // Helper function to perform search and highlighting in a given container
     function searchAndHighlight(container, searchTerm) {
        const userElements = container.querySelectorAll('.user-info'); // Target the whole user info block
        let highlightCount = 0;

        userElements.forEach(userElement => {
            const usernameElement = userElement.querySelector('.user-details p:first-child'); // Username line
             const tagsElement = userElement.querySelector('.user-details p:nth-child(3)'); // Tags line (assuming it's the 3rd p)

            if (!usernameElement && !tagsElement) {
                 console.warn("Could not find username or tags element in user-info block:", userElement);
                 return; // Skip if essential elements are missing
            }

            const usernameText = usernameElement ? usernameElement.textContent : '';
             const tagsText = tagsElement ? tagsElement.textContent : '';

            const regex = new RegExp(searchTerm, 'gi'); // 'g' for global, 'i' for case-insensitive
            let userElementMatched = false;

            // Highlight username
            if (usernameElement && regex.test(usernameText)) {
                const highlightedText = usernameText.replace(regex, (match) => `<span class="highlight">${match}</span>`);
                usernameElement.innerHTML = highlightedText; // Replace with highlighted HTML
                userElementMatched = true;
            }

            // Highlight tags
             if (tagsElement && regex.test(tagsText)) {
                const highlightedText = tagsText.replace(regex, (match) => `<span class="highlight">${match}</span>`);
                tagsElement.innerHTML = highlightedText; // Replace with highlighted HTML
                userElementMatched = true; // Mark as matched even if only tags match
             }

             if (userElementMatched) {
                 highlightCount++;
             }

        });
         return highlightCount; // Return count of user blocks with highlights
    }

     // Helper function to clear all highlights in a given container
      function clearHighlights(container) {
        const highlightedSpans = container.querySelectorAll('.highlight');
        highlightedSpans.forEach(span => {
            // Replace the span with its inner text content
            const parent = span.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(span.textContent), span);
                // Recursively clear highlights within the replaced content if any nested (unlikely here but safe)
                 clearHighlights(parent); // This might be overkill, but handles nested spans if they somehow occur
            }
        });
         // After replacing all spans, consolidate adjacent text nodes if necessary (optional cleanup)
         // parent.normalize(); // Could be used on the parent if needed
    }

    // Helper function to scroll to the first highlighted element in a container
    function scrollToFirstHighlight(container) {
        const firstHighlighted = container.querySelector('.highlight');
        if (firstHighlighted) {
            // Scroll the parent element (.scrollable-list-container) to bring the highlight into view
            const scrollableParent = firstHighlighted.closest('.scrollable-list-container');
            if (scrollableParent) {
                 firstHighlighted.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                 console.log("Scrolled into view:", firstHighlighted);
            } else {
                 console.warn("Could not find scrollable parent for highlight.");
                 firstHighlighted.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // Fallback
            }

        }
    }


    // --- Expose functions to the global scope if needed by other scripts ---
    // It's generally better to avoid global variables/functions if possible,
    // but keeping these if they are required by other parts of your application.
    if (typeof window.addToPreviousUsers === 'undefined') {
        window.addToPreviousUsers = addToPreviousUsers;
    }
    if (typeof window.displayPreviousUsers === 'undefined') {
        window.displayPreviousUsers = displayPreviousUsers;
    }
     // Exposing searchUsers so your Ctrl+I listener can call it (or move the listener inside this script)
     window.searchUsers = searchUsers; // Expose searchUsers


    // This function seems intended to be called by an external script to indicate initialization is complete.
    // It doesn't perform initialization itself, but rather runs a provided callback.
    window.initializeAllUsersFromScriptJS = function(callback) {
        console.log("window.initializeAllUsersFromScriptJS called.");
        // Ensure allOnlineUsersData is loaded or loading before calling the callback if needed
        // For now, assuming fetchData has been initiated or completed by the main script flow.
        if (callback && typeof callback === 'function') {
            callback();
        } else {
            console.warn("initializeAllUsersFromScriptJS called without a valid callback function.");
        }
        console.log("window.initializeAllUsersFromScriptJS finished.");
    };


     // --- Cleanup on page unload ---
     window.addEventListener('beforeunload', () => {
         if (fetchInterval) {
             clearInterval(fetchInterval);
             console.log("Fetch interval cleared on page unload.");
         }
         // No need to explicitly close IndexedDB connection unless managing many databases or long-running workers
     });


});
