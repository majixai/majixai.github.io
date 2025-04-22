Document.addEventListener('DOMContentLoaded', async function() {
    const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
    const mainIframe = document.getElementById("mainIframe");
    const mainIframe2 = document.getElementById("mainIframe2");

    const storageTypeSelector = document.getElementById("storageType");
    const filterTagsSelect = document.getElementById("filterTags");
    const filterAgeSelect = document.getElementById("filterAge");

    // Get the new filter buttons (assuming they are still desired from previous request)
    const filterAge18Button = document.getElementById("filterAge18");
    const filterTagAsianButton = document.getElementById("filterTagAsian");
    const filterTagBlondeButton = document.getElementById("filterTagBlonde");
    // Add more button variables here for other tags

    let storageType = storageTypeSelector.value;
    let previousUsers = await loadUsers("previousUsers");
    let removedUsers = await loadUsers("removedUsers");
    displayPreviousUsers();
    let allOnlineUsersData = [];

    storageTypeSelector.addEventListener("change", async function() {
        storageType = this.value;
        previousUsers = await loadUsers("previousUsers");
        removedUsers = await loadUsers("removedUsers");
        await displayPreviousUsers();
    });

    // Add event listeners for the filter select elements
    filterTagsSelect.addEventListener("change", function() {
        displayOnlineUsers(allOnlineUsersData); // Re-display with current select filters
    });

    filterAgeSelect.addEventListener("change", function() {
        displayOnlineUsers(allOnlineUsersData); // Re-display with current select filters
    });


    // Add event listeners for the specific filter buttons (from previous request)
    // These will override the select filters for the specific criteria when clicked.
    if (filterAge18Button) { // Check if the button exists
        filterAge18Button.addEventListener("click", function() {
            // Optionally, you could clear the select filters here if you want buttons to be exclusive
            // Array.from(filterAgeSelect.options).forEach(option => option.selected = false);
            // Array.from(filterTagsSelect.options).forEach(option => option.selected = false);
            displayOnlineUsers(allOnlineUsersData, { age: 18 });
        });
    }

    if (filterTagAsianButton) { // Check if the button exists
        filterTagAsianButton.addEventListener("click", function() {
             // Optionally clear select filters
            displayOnlineUsers(allOnlineUsersData, { tag: 'asian' });
        });
    }

    if (filterTagBlondeButton) { // Check if the button exists
        filterTagBlondeButton.addEventListener("click", function() {
             // Optionally clear select filters
            displayOnlineUsers(allOnlineUsersData, { tag: 'blonde' });
        });
    }
    // Add more event listeners for other tag buttons, calling displayOnlineUsers with the appropriate tag


    async function fetchData() {
        const limit = 500;
        let offset = 0;
        let continueFetching = true;

        while (continueFetching) {
            const apiUrl = `https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f&limit=${limit}&offset=${offset}`;
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                // Removed or adjusted the age <= 19 filter during fetch to get more data for client-side filtering
                if (data.results && data.results.length > 0) {
                    allOnlineUsersData = allOnlineUsersData.concat(data.results);
                    if (data.results.length < limit) {
                        continueFetching = false;
                    } else {
                        offset += limit;
                    }
                } else {
                    continueFetching = false;
                }
            } catch (error) {
                console.error("Fetch error:", error);
                onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error fetching data.</p>';
                return;
            }
        }

        populateFilters(allOnlineUsersData);
        onlineUsersDiv.innerHTML = "";
        displayOnlineUsers(allOnlineUsersData); // Initial display using populated select filters

        if (typeof initializeAllUsers === 'function') {
            window.initializeAllUsers();
        }
    }

    // Modify displayOnlineUsers to accept optional filter parameters from buttons
    function displayOnlineUsers(users, buttonFilters = {}) {
        // If button filters are provided, use them, otherwise use the select element values
        const filterTags = buttonFilters.tag ? [buttonFilters.tag] : Array.from(filterTagsSelect.selectedOptions).map(option => option.value);
        const filterAges = buttonFilters.age ? [buttonFilters.age] : Array.from(filterAgeSelect.selectedOptions).map(option => parseInt(option.value));

        const filteredUsers = users.filter(user => {
            const isPublic = user.current_show === 'public';

            // Check if the user has AT LEAST ONE of the selected tags, or if no tags are selected
            const hasTags = filterTags.length === 0 || (user.tags && filterTags.some(tag => user.tags.includes(tag)));

            // Check if the user's age is IN the selected ages, or if no ages are selected
            const isAgeMatch = filterAges.length === 0 || (user.age !== undefined && filterAges.includes(user.age));

            return isPublic && hasTags && isAgeMatch;
        });

        onlineUsersDiv.innerHTML = "";
        if (filteredUsers.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found with these filters.</p>';
            return;
        }

        filteredUsers.forEach(user => {
            if (!user.image_url || !user.username) {
                console.warn("Incomplete user data:", user);
                return;
            }

            const userElement = document.createElement("div");
            userElement.className = "user-info";
            userElement.innerHTML = `
                <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}" data-username="${user.username}">
                <div class="user-details">
                    <p>Username: ${user.username}</p>
                    <p>Age: ${user.age || 'N/A'} ${user.is_new ? 'New' : ''}</p>
                    <p>Tags: ${user.tags ? user.tags.join(', ') : 'N/A'}</p>
                    ${isBirthday(user.birthday) ? `<p>Happy Birthday!</p>` : ''}
                </div>
            `;

            userElement.addEventListener("click", function(event) {
                event.preventDefault();
                const usr = userElement.querySelector("img").dataset.username;
                const iframeChoice = document.querySelector('input[name="iframeChoice"]:checked').value;
                let selectedIframe;

                if (iframeChoice === 'mainIframe2') {
                    selectedIframe = mainIframe2;
                } else {
                    selectedIframe = mainIframe;
                }
                selectedIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;

                addToPreviousUsers(user);
            });
            onlineUsersDiv.appendChild(userElement);
        });
    }

    function populateFilters(users) {
        const tagFrequency = {};
        const ages = new Set();

        users.forEach(user => {
            if (user.tags) {
                user.tags.forEach(tag => {
                    tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
                });
            }
            if (user.age) {
                ages.add(user.age);
            }
        });

        const sortedTags = Object.entries(tagFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 100) // Increased limit for more tags
            .map(entry => entry[0]);

        // Clear existing options before populating
        filterTagsSelect.innerHTML = '';
        filterAgeSelect.innerHTML = '';

        // Add a default "Any" or placeholder option (optional)
        // filterTagsSelect.innerHTML += '<option value="">Any Tag</option>';
        // filterAgeSelect.innerHTML += '<option value="">Any Age</option>';


        filterTagsSelect.innerHTML += sortedTags.map(tag => `<option value="${tag}">${tag}</option>`).join('');
        filterAgeSelect.innerHTML += Array.from(ages).sort((a, b) => a - b).map(age => `<option value="${age}">${age}</option>`).join(''); // Sort ages
    }


    async function addToPreviousUsers(user) {
        if (!previousUsers.some(u => u.username === user.username)) {
            // Add user to the beginning of the array
            previousUsers.unshift(user);

            // Keep the previous users list to a reasonable size, e.g., 50
            if (previousUsers.length > 50) {
                previousUsers = previousUsers.slice(0, 50);
            }

            await saveUsers("previousUsers", previousUsers);

            // Re-display previous users to reflect the change
            displayPreviousUsers();
        }
    }

    async function displayPreviousUsers() {
        previousUsersDiv.innerHTML = "";

        const storedUsers = await loadUsers("previousUsers");
         if (storedUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users yet.</p>';
            return;
        }

        // Display in reverse order to show most recent first
        [...storedUsers].reverse().forEach(user => {
             // Only display if user is currently online and public (optional, depends on desired behavior)
             // if (user.current_show !== 'public') {
             //     return;
             // }
            if (!user.image_url || !user.username) {
                return;
            }
            const userElement = document.createElement("div");
            userElement.className = "user-info";
            userElement.innerHTML = `
                <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}" data-username="${user.username}">
                <div class="user-details">
                    <p>Age: ${user.age || 'N/A'}</p>
                    <p>Username: ${user.username}</p>
                    ${isBirthday(user.birthday) ? `<p>Happy Birthday!</p>` : ''}
                </div>
            `;

            userElement.addEventListener("click", function(event) {
                event.preventDefault();
                const usr = userElement.querySelector("img").dataset.username;
                const iframeChoice = document.querySelector('input[name="iframeChoice"]:checked').value;
                let selectedIframe;

                if (iframeChoice === 'mainIframe2') {
                    selectedIframe = mainIframe2;
                } else {
                    selectedIframe = mainIframe;
                }
                selectedIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;
            });

            previousUsersDiv.appendChild(userElement); // Append for reverse order display
        });
    }


    function isBirthday(birthday) {
        if (!birthday) return false;
        try {
            const today = new Date();
            const birthDate = new Date(birthday);
            // Check if date is valid
            if (isNaN(birthDate.getTime())) {
                return false;
            }
            return today.getDate() === birthDate.getDate() && today.getMonth() === birthDate.getMonth();
        } catch (e) {
            console.error("Error parsing birthday:", birthday, e);
            return false;
        }
    }

    async function loadUsers(key) {
        if (storageType === "indexedClicked") {
            return await loadFromIndexedDB(key);
        } else {
            const storage = storageType === "local" ? localStorage : sessionStorage;
            const storedUsers = storage.getItem(key);
            try {
                return storedUsers ? JSON.parse(storedUsers) : [];
            } catch (e) {
                console.error(`Error parsing stored users for key ${key}:`, e);
                return []; // Return empty array on parse error
            }
        }
    }

    async function saveUsers(key, users) {
        if (storageType === "indexedClicked") {
            await saveToIndexedDB(key, users);
        } else {
            const storage = storageType === "local" ? localStorage : sessionStorage;
            try {
                 storage.setItem(key, JSON.stringify(users));
            } catch (e) {
                 console.error(`Error saving users to ${storageType} storage for key ${key}:`, e);
            }
        }
    }

    function openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('UserDatabase', 1);
            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                // Check if object store already exists before creating
                if (!db.objectStoreNames.contains('users')) {
                   const objectStore = db.createObjectStore('users', { keyPath: 'key' });
                   objectStore.createIndex('tags', 'tags', { unique: false });
                }
            };
            request.onsuccess = function(event) {
                resolve(event.target.result);
            };
            request.onerror = function(event) {
                reject(event.target.error);
            };
        });
    }

    async function loadFromIndexedDB(key) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = await openIndexedDB();
                const transaction = db.transaction('users', 'readonly');
                const store = transaction.objectStore('users');
                const request = store.get(key);

                request.onsuccess = function(event) {
                    resolve(event.target.result ? event.target.result.value : []);
                };
                request.onerror = function(event) {
                    reject(event.target.error);
                };
            } catch (e) {
                console.error("Error opening IndexedDB for loading:", e);
                resolve([]); // Resolve with empty array on error
            }
        });
    }


    function saveToIndexedDB(key, users) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = await openIndexedDB();
                const transaction = db.transaction('users', 'readwrite');
                const store = transaction.objectStore('users');
                const request = store.put({ key: key, value: users });

                transaction.oncomplete = function() { // Use transaction complete
                    resolve();
                };

                request.onerror = function(event) {
                    console.error("Error saving to IndexedDB:", event.target.error);
                    reject(event.target.error);
                };
                 transaction.onerror = function(event) { // Also listen for transaction errors
                    console.error("Transaction error saving to IndexedDB:", event.target.error);
                    reject(event.target.error);
                };
            } catch (e) {
                console.error("Error opening IndexedDB for saving:", e);
                reject(e); // Reject on error
            }
        });
    }

    async function populateStorageOptions() {
        try {
            const db = await openIndexedDB();
            const transaction = db.transaction('users', 'readonly');
            const store = transaction.objectStore('users');
            const request = store.getAllKeys();
            request.onsuccess = function(event) {
                const keys = event.target.result;
                // Add options only if they don't exist to avoid duplicates on subsequent calls if any
                keys.forEach(key => {
                    if (!storageTypeSelector.querySelector(`option[value="${key}"]`)) {
                         storageTypeSelector.innerHTML += `<option value="${key}">${key}</option>`;
                    }
                });
            };
            request.onerror = function(event) {
                console.error("Error fetching keys from IndexedDB:", event.target.error);
            };
        } catch (e) {
             console.error("Error in populateStorageOptions:", e);
        }
    }

    // Initial population and fetch
    populateStorageOptions();
    await fetchData();

    // Set interval for fetching data periodically
    setInterval(async () => {
        allOnlineUsersData = []; // Clear previous data before fetching
        await fetchData();
    }, 300000); // 300000 milliseconds = 5 minutes


    // Expose functions to the global scope if needed by other scripts
    if (typeof window.addToPreviousUsers === 'undefined') {
        window.addToPreviousUsers = addToPreviousUsers;
    }
    if (typeof window.displayPreviousUsers === 'undefined') {
        window.displayPreviousUsers = displayPreviousUsers;
    }
    window.initializeAllUsersFromScriptJS = function(callback) {
        callback();
    };
});
