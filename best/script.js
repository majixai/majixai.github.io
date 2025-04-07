// Copied from 4d6957c8b6df8c34ce06079f92f9d3a334f689a4
document.addEventListener('DOMContentLoaded', async function() {
    const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
    const mainIframe = document.getElementById("mainIframe");
    const mainIframe2 = document.getElementById("mainIframe2");

    const storageTypeSelector = document.getElementById("storageType");
    const filterTagsSelect = document.getElementById("filterTags");
    const filterAgeSelect = document.getElementById("filterAge");

    let storageType = storageTypeSelector.value;
    let previousUsers = loadUsers("previousUsers");
    let removedUsers = loadUsers("removedUsers");
    displayPreviousUsers();
    let allOnlineUsersData = [];

    storageTypeSelector.addEventListener("change", async function() {
        storageType = this.value;
        previousUsers = await loadUsers("previousUsers");
        removedUsers = await loadUsers("removedUsers");
        await displayPreviousUsers();
    });

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
        displayOnlineUsers(allOnlineUsersData);

        if (typeof initializeAllUsers === 'function') {
            window.initializeAllUsers();
        }
    }

    function populateFilters(users) {
        const tags = new Set();
        const ages = new Set();

        users.forEach(user => {
            if (user.tags) {
                user.tags.forEach(tag => tags.add(tag));
            }
            if (user.age) {
                ages.add(user.age);
            }
        });

        filterTagsSelect.innerHTML = Array.from(tags).map(tag => `<option value="${tag}">${tag}</option>`).join('');
        filterAgeSelect.innerHTML = Array.from(ages).map(age => `<option value="${age}">${age}</option>`).join('');
    }

    async function displayOnlineUsers(users) {
        const filterTags = Array.from(filterTagsSelect.selectedOptions).map(option => option.value);
        const filterAges = Array.from(filterAgeSelect.selectedOptions).map(option => parseInt(option.value));

        const filteredUsers = users.filter(user => {
            const isPublic = user.current_show === 'public';
            const hasTags = filterTags.length === 0 || filterTags.some(tag => user.tags.includes(tag));
            const isAgeMatch = filterAges.length === 0 || filterAges.includes(user.age);
            return isPublic && hasTags && isAgeMatch;
        });

        onlineUsersDiv.innerHTML = "";
        if (filteredUsers.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
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
                    <p>Tags: ${user.tags.join(', ')}</p>
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

    async function addToPreviousUsers(user) {
        if (!previousUsers.some(u => u.username === user.username)) {
            previousUsers.unshift(user);
            saveUsers("previousUsers", previousUsers);

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

            previousUsersDiv.prepend(userElement);
        }
    }

    async function displayPreviousUsers() {
        previousUsersDiv.innerHTML = "";

        const storedUsers = loadUsers("previousUsers");
        if (storedUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users yet.</p>';
            return;
        }

        storedUsers.forEach(user => {
            if (user.current_show !== 'public') {
                return;
            }
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

            previousUsersDiv.appendChild(userElement);
        });
    }

    function isBirthday(birthday) {
        if (!birthday) return false;
        const today = new Date();
        const birthDate = new Date(birthday);
        return today.getDate() === birthDate.getDate() && today.getMonth() === birthDate.getMonth();
    }

    function loadUsers(key) {
        if (storageType === "indexeddb") {
            return loadFromIndexedDB(key);
        } else {
            const storage = storageType === "local" ? localStorage : sessionStorage;
            const storedUsers = storage.getItem(key);
            return storedUsers ? JSON.parse(storedUsers) : [];
        }
    }

    function saveUsers(key, users) {
        if (storageType === "indexeddb") {
            saveToIndexedDB(key, users);
        } else {
            const storage = storageType === "local" ? localStorage : sessionStorage;
            storage.setItem(key, JSON.stringify(users));
        }
    }

    function openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('UserDatabase', 1);
            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                db.createObjectStore('users', { keyPath: 'key' });
            };
            request.onsuccess = function(event) {
                resolve(event.target.result);
            };
            request.onerror = function(event) {
                reject(event.target.error);
            };
        });
    }

    function loadFromIndexedDB(key) {
        return new Promise(async (resolve, reject) => {
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
        });
    }
    
    function saveToIndexedDB(key, users) {
        return new Promise(async (resolve, reject) => {
            const db = await openIndexedDB();
            const transaction = db.transaction('users', 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put({ key: key, value: users });
    
            request.onsuccess = function(event) {
                resolve();
            };
            request.onerror = function(event) {
                reject(event.target.error);
            };
        });
    }

    if (typeof window.addToPreviousUsers !== 'undefined') {
        window.addToPreviousUsers = addToPreviousUsers;
    }
    if (typeof window.displayPreviousUsers !== 'undefined') {
        window.displayPreviousUsers = displayPreviousUsers;
    }

    window.initializeAllUsersFromScriptJS = function(callback) {
        callback();
    };

    await fetchData();
    setInterval(async () => {
        allOnlineUsersData = [];
        await fetchData();
    }, 120000);
});
