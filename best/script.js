'use strict';

document.addEventListener('DOMContentLoaded', function() {
    const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
    const mainIframe = document.getElementById("mainIframe");
    const mainIframe2 = document.getElementById("mainIframe2");

    let previousUsers = loadPreviousUsers();
    let removedUsers = loadRemovedUsers();
    displayPreviousUsers();

    let allOnlineUsersData = [];
    const API_ENDPOINT = 'https://chaturbate.com/api/public/affiliates/onlinerooms/';
    const AFFILIATE_PARAMS = '?wm=9cg6A&client_ip=request_ip&gender=f&limit=500';
    const FETCH_LIMIT = 500;
    const REFRESH_INTERVAL = 60000;

    /**
     * Fetches online user data from the API, handling pagination.
     * @param {number} [offset=0] - Offset for API pagination.
     * @returns {Promise<void>} - Resolves when data fetching and display are complete.
     */
    function fetchData(offset = 0) {
        const apiUrl = `${API_ENDPOINT}${AFFILIATE_PARAMS}&offset=${offset}`;

        return fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API request failed with status: ${response.status} for URL: ${apiUrl}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.results && data.results.length > 0) {
                    const publicUsers = data.results.filter(user => user.current_show === 'public');
                    allOnlineUsersData = allOnlineUsersData.concat(publicUsers);

                    if (data.results.length === FETCH_LIMIT) {
                        return fetchData(offset + FETCH_LIMIT);
                    } else {
                        onlineUsersDiv.innerHTML = "";
                        displayOnlineUsers(allOnlineUsersData);

                        if(typeof initializeAllUsers === 'function') {
                            window.initializeAllUsers();
                        }
                        return Promise.resolve();
                    }
                } else {
                    onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
                    return Promise.resolve();
                }
            })
            .catch(error => {
                console.error("Error fetching online users:", error);
                onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Failed to load online users.</p>';
                return Promise.reject(error);
            });
    }

    /**
     * Displays online users in the onlineUsersDiv.
     * @param {Array<Object>} users - Array of user objects to display.
     */
    function displayOnlineUsers(users) {
        onlineUsersDiv.innerHTML = "";

        if (!users || users.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
            return;
        }

        users.forEach(user => {
            if (user.current_show !== 'public') {
                return;
            }
            if (!user.image_url || !user.username) {
                console.warn("Incomplete user data received for user:", user);
                return;
            }

            const userElement = createUserElement(user, 'online');
            onlineUsersDiv.appendChild(userElement);
        });
    }

    /**
     * Creates a user element (div) for displaying user information.
     * @param {Object} user - User data object.
     * @param {string} listType - 'online' or 'previous' to differentiate event handling if needed.
     * @returns {HTMLDivElement} - The created user div element.
     */
    function createUserElement(user, listType) {
        const userElement = document.createElement("div");
        userElement.className = "user-info";
        userElement.innerHTML = `
            <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}" data-username="${user.username}">
            <div class="user-details">
                <p>Username: ${user.username}</p>
                <p>Age: ${user.age || 'N/A'} ${user.is_new ? 'New' : ''}</p>
                <p>Tags: ${user.tags && user.tags.slice(0, 5).join(', ') || 'No tags'}</p> </div>
        `;

        userElement.addEventListener("click", function (event) {
            event.preventDefault();
            handleUserClick(user, listType);
            if (listType === 'online') {
                userElement.remove();
                allOnlineUsersData = allOnlineUsersData.filter(u => u.username !== user.username);
                addToPreviousUsers(user);
            }
        });

        if (listType === 'previous') {
            userElement.addEventListener("dblclick", function(event) {
                event.preventDefault();
                handleUserDoubleClick(user, userElement);
            });
        }

        return userElement;
    }

    /**
     * Handles single click event on a user element. Loads user iframe.
     * @param {Object} user - The user object.
     * @param {string} listType - 'online' or 'previous' indicating the list the user is from.
     */
    function handleUserClick(user, listType) {
        const username = user.username;
        const iframeChoice = document.querySelector('input[name="iframeChoice"]:checked').value;
        const selectedIframe = (iframeChoice === 'mainIframe2') ? mainIframe2 : mainIframe;
        // selectedIframe.src = `https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=${username}`;

        if (listType === 'online') {
            addToPreviousUsers(user);
        }
    }

    /**
     * Handles double click event on a user element in the previous users list.
     * Removes user from previous users and adds to removed users.
     * @param {Object} user - The user object.
     * @param {HTMLElement} userElement - The DOM element representing the user.
     */
    function handleUserDoubleClick(user, userElement) {
        const usernameToRemove = user.username;

        previousUsers = previousUsers.filter(u => u.username !== usernameToRemove);
        savePreviousUsers(previousUsers); // Use function to save

        removedUsers.push(user);
        saveRemovedUsers();

        userElement.remove();
        console.log(`User ${usernameToRemove} removed and added to removed users (not displayed).`);
    }


    /**
     * Adds a user to the previous users list, if not already present.
     * Updates localStorage and prepends the user to the display.
     * @param {Object} user - The user object to add.
     */
    function addToPreviousUsers(user) {
        if (!previousUsers.some(u => u.username === user.username)) {
            previousUsers.unshift(user);
            savePreviousUsers(previousUsers); // Use function to save

            const userElement = createUserElement(user, 'previous');
            previousUsersDiv.prepend(userElement);

            // Consider implementing a limit for previousUsersDiv if needed for performance.
        }
    }


    /**
     * Displays the list of previous users from localStorage.
     * Fetches online usernames to filter and display only currently online previous users.
     */
    function displayPreviousUsers() {
        previousUsersDiv.innerHTML = "";

        const onlineUsernamesPromise = fetchOnlineUsernames();
        const storedUsers = loadPreviousUsers();

        if (!storedUsers || storedUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users yet.</p>';
            return;
        }

        onlineUsernamesPromise.then(onlineUsernames => {
            if (!onlineUsernames) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Error fetching online user list for updates.</p>';
                return;
            }

            // Filter to show only previous users who are currently online and public
            const onlinePreviousUsersInitial = storedUsers.filter(user => onlineUsernames.includes(user.username) && user.current_show === 'public');

            if (!onlinePreviousUsersInitial || onlinePreviousUsersInitial.length === 0) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous public users currently online.</p>';
                return;
            }

            onlinePreviousUsersInitial.forEach(user => {
                if (user.current_show !== 'public') return;
                if (!user.image_url || !user.username) return;

                const userElement = createUserElement(user, 'previous');
                previousUsersDiv.appendChild(userElement);
            });

        }).catch(error => {
            console.error("Error updating previous users online status:", error);
            previousUsersDiv.innerHTML = '<p class="text-danger w3-center">Error updating previous users list.</p>';
        });
    }


    /**
     * Fetches a list of currently online public usernames from the API.
     * Handles pagination to retrieve all online users.
     * @returns {Promise<Array<string>|null>} - Resolves with an array of usernames or null on error.
     */
    function fetchOnlineUsernames() {
        let currentOnlineUsernames = [];

        const recursiveFetchUsernames = (offset) => {
            const apiUrl = `${API_ENDPOINT}${AFFILIATE_PARAMS}&offset=${offset}`;
            return fetch(apiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`API request failed with status: ${response.status} for URL: ${apiUrl}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.results && data.results.length > 0) {
                        const publicUsernames = data.results
                            .filter(user => user.current_show === 'public')
                            .map(user => user.username);
                        currentOnlineUsernames = currentOnlineUsernames.concat(publicUsernames);

                        if (data.results.length === FETCH_LIMIT) {
                            return recursiveFetchUsernames(offset + FETCH_LIMIT);
                        } else {
                            return currentOnlineUsernames;
                        }
                    } else {
                        return currentOnlineUsernames;
                    }
                });
        };

        return recursiveFetchUsernames(0)
            .catch(error => {
                console.error("Error fetching online usernames:", error);
                return null;
            });
    }


    /**
     * Loads previous users data from localStorage, handling multiple lists.
     * @returns {Array<Object>} - Array of previous user objects, or empty array if none.
     */
    function loadPreviousUsers() {
        const currentListIndex = localStorage.getItem('currentPreviousUsersListIndex') || '1';
        const storageKey = `previousUsers_${currentListIndex}`;
        const storedUsers = localStorage.getItem(storageKey);
        return storedUsers ? JSON.parse(storedUsers) : [];
    }

    /**
     * Saves previous users data to localStorage, managing multiple lists and quota errors.
     * @param {Array<Object>} users - Array of previous user objects to save.
     */
    function savePreviousUsers(users) {
        let currentListIndex = localStorage.getItem('currentPreviousUsersListIndex') || '1';
        let storageKey = `previousUsers_${currentListIndex}`;

        try {
            localStorage.setItem(storageKey, JSON.stringify(users));
        } catch (e) {
            if (e instanceof DOMException && (e.code === 22 || e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                console.warn("localStorage quota exceeded for list", storageKey, ". Creating a new list.");
                // Increment list index and store it
                currentListIndex = String(parseInt(currentListIndex, 10) + 1);
                localStorage.setItem('currentPreviousUsersListIndex', currentListIndex);
                storageKey = `previousUsers_${currentListIndex}`; // New storage key
                // localStorage.setItem(storageKey, JSON.stringify(users)); // Try saving again to the new list - No need to retry here, the next save attempt will use the new key
                // It's crucial NOT to recursively call savePreviousUsers here, as it can lead to infinite recursion in case quota is always exceeded.
                // Just update the current list index and the next save attempt will use the new list.
                localStorage.setItem(storageKey, JSON.stringify(users)); // Save to the new list - ensure save happens on new list after incrementing index.
            } else {
                console.error("Error saving to localStorage:", e);
            }
        }
    }


    /**
     * Loads removed users data from localStorage.
     * @returns {Array<Object>} - Array of removed user objects, or empty array if none.
     */
    function loadRemovedUsers() {
        const storedRemovedUsers = localStorage.getItem("removedUsers");
        return storedRemovedUsers ? JSON.parse(storedRemovedUsers) : [];
    }

    /**
     * Saves removed users data to localStorage.
     */
    function saveRemovedUsers() {
        localStorage.setItem("removedUsers", JSON.stringify(removedUsers));
    }


    // Expose functions globally if needed
    window.addToPreviousUsers = addToPreviousUsers;
    window.displayPreviousUsers = displayPreviousUsers;

    window.initializeAllUsersFromScriptJS = function(callback) {
        callback();
    };


    // Initial data fetch and periodic refresh
    fetchData();
    setInterval(() => {
        allOnlineUsersData = [];
        fetchData();
        // displayPreviousUsers();
    }, REFRESH_INTERVAL);
});
