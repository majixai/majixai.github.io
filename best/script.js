// The previous version from this works, without showing the 2 previous users (new users in the second case).

document.addEventListener('DOMContentLoaded', function() {
    const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
    // const newUsersDiv = document.getElementById("newUsers").querySelector('.user-list'); // New users box
    const mainIframe = document.getElementById("mainIframe");
    const mainIframe2 = document.getElementById("mainIframe2");

    let previousUsers = loadPreviousUsers();
    // let newUsers = loadNewUsers(); // Load new users from localStorage
    let removedUsers = loadRemovedUsers(); // Load removed users from localStorage
    displayPreviousUsers(); // Initial display from localStorage
    // displayNewUsers(); // Initial display for new users
    let allOnlineUsersData = [];

    function fetchData(offset = 0) {
        const apiUrl = `https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f&limit=500&offset=${offset}`;

        return fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.results && data.results.length > 0) {
                    // Filter for public users here, before concatenating
                    const publicUsers = data.results.filter(user => user.current_show === 'public');
                    allOnlineUsersData = allOnlineUsersData.concat(publicUsers);

                    if (data.results.length === 500) {
                        return fetchData(offset + 500);
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
                console.error("Fetch error:", error);
                onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error fetching data.</p>';
                return Promise.reject(error);
            });
    }

    function displayOnlineUsers(users) {
        onlineUsersDiv.innerHTML = "";
        if (users.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
            return;
        }

        users.forEach(user => {
            // Ensure user is public before displaying
            if (user.current_show !== 'public') {
                return; // Skip non-public users
            }
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
                    <p>Tags: ${user.tags[0] || ''} ${user.tags[1] || ''} ${user.tags[2] || ''} ${user.tags[3] || ''}  ${user.tags[4] || ''}</p>
                    </div>
            `;

            userElement.addEventListener("click", function (event) {
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

                addToPreviousUsers(user); // Now addToPreviousUsers will handle display update
                // addToNewUsers(user); // Add to new users box

                // Remove user from online users list visually and from data
                // userElement.remove(); // Remove from display
                // allOnlineUsersData = allOnlineUsersData.filter(u => u.username !== user.username); // Remove from data array
            });
            onlineUsersDiv.appendChild(userElement);
        });
    }

    function addToPreviousUsers(user) {
        if (!previousUsers.some(u => u.username === user.username)) {
            previousUsers.unshift(user);
            // previousUsers = previousUsers.slice(0, 20); // Keep only latest 20
            localStorage.setItem("previousUsers", JSON.stringify(previousUsers));

            // Create and prepend the new user element
            const userElement = document.createElement("div");
            userElement.className = "user-info";
            userElement.innerHTML = `
                <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}" data-username="${user.username}">
                <div class="user-details">
                    <p>Age: ${user.age || 'N/A'}</p>
                    <p>Username: ${user.username}</p>
                </div>
            `;

            userElement.addEventListener("click", function (event) {
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

            // // Keep only a maximum of 20 user elements in previousUsersDiv
            // if (previousUsersDiv.children.length > 2000) {
            //     previousUsersDiv.removeChild(previousUsersDiv.lastElementChild);
            // }
        }
    }

    function addToNewUsers(user) {
        if (!newUsers.some(u => u.username === user.username)) {
            newUsers.unshift(user);
            localStorage.setItem("newUsers", JSON.stringify(newUsers));

            // Create and prepend the new user element
            const userElement = document.createElement("div");
            userElement.className = "user-info";
            userElement.innerHTML = `
                <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}" data-username="${user.username}">
                <div class="user-details">
                    <p>Age: ${user.age || 'N/A'}</p>
                    <p>Username: ${user.username}</p>
                </div>
            `;

            userElement.addEventListener("click", function (event) {
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

            newUsersDiv.prepend(userElement);
        }
    }

    function displayPreviousUsers() {
        previousUsersDiv.innerHTML = ""; // Clear for initial load

        const onlineUsernamesPromise = fetchOnlineUsernames(); // Start fetching usernames immediately

        const storedUsers = loadPreviousUsers();
        if (storedUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users yet.</p>';
            return; // Exit early if no stored users
        }

        onlineUsernamesPromise.then(onlineUsernames => {
            if (!onlineUsernames) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Error fetching online users for previous users list.</p>';
                return;
            }

            // Filter previous users to only include those who are currently online AND public for initial display
            const onlinePreviousUsersInitial = storedUsers.filter(user => onlineUsernames.includes(user.username) && user.current_show === 'public');

            if (onlinePreviousUsersInitial.length === 0) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous public users currently online.</p>';
                return;
            }

            onlinePreviousUsersInitial.forEach(user => { // Use filtered list for initial display
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
                    </div>
                `;

                userElement.addEventListener("click", function (event) {
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
        }).catch(error => {
            console.error("Error fetching online users for previous users:", error);
            previousUsersDiv.innerHTML = '<p class="text-danger w3-center">Error updating previous users online status.</p>';
        });
    }

    function displayNewUsers() {
        newUsersDiv.innerHTML = ""; // Clear for initial load

        const onlineUsernamesPromise = fetchOnlineUsernames(); // Start fetching usernames immediately

        const storedUsers = loadNewUsers();
        if (storedUsers.length === 0) {
            newUsersDiv.innerHTML = '<p class="text-muted w3-center">No new users yet.</p>';
            return; // Exit early if no stored users
        }

        onlineUsernamesPromise.then(onlineUsernames => {
            if (!onlineUsernames) {
                newUsersDiv.innerHTML = '<p class="text-muted w3-center">Error fetching online users for new users list.</p>';
                return;
            }

            // Filter new users to only include those who are currently online AND public for initial display
            const onlineNewUsersInitial = storedUsers.filter(user => onlineUsernames.includes(user.username) && user.current_show === 'public');

            if (onlineNewUsersInitial.length === 0) {
                newUsersDiv.innerHTML = '<p class="text-muted w3-center">No new public users currently online.</p>';
                return;
            }

            onlineNewUsersInitial.forEach(user => { // Use filtered list for initial display
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
                    </div>
                `;

                userElement.addEventListener("click", function (event) {
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

                newUsersDiv.appendChild(userElement);
            });
        }).catch(error => {
            console.error("Error fetching online users for new users:", error);
            newUsersDiv.innerHTML = '<p class="text-danger w3-center">Error updating new users online status.</p>';
        });
    }

    function fetchOnlineUsernames() {
        return new Promise((resolve, reject) => {
            let currentOnlineUsersData = [];
            function recursiveFetch(offset = 0) {
                const apiUrl = `https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f&limit=500&offset=${offset}`;

                fetch(apiUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.results && data.results.length > 0) {
                            // Only consider public users for username list
                            const publicUsernames = data.results
                                .filter(user => user.current_show === 'public')
                                .map(user => user.username);
                            currentOnlineUsersData = currentOnlineUsersData.concat(publicUsernames);

                            if (data.results.length === 500) {
                                return recursiveFetch(offset + 500);
                            } else {
                                resolve(currentOnlineUsersData); // Resolve with usernames of public users
                            }
                        } else {
                            resolve([]);
                        }
                    })
                    .catch(error => {
                        reject(error);
                    });
            }
            recursiveFetch();
        });
    }

    function loadPreviousUsers() {
        const storedUsers = localStorage.getItem("previousUsers");
        return storedUsers ? JSON.parse(storedUsers) : [];
    }

    function loadNewUsers() {
        const storedNewUsers = localStorage.getItem("newUsers");
        return storedNewUsers ? JSON.parse(storedNewUsers) : [];
    }

    function loadRemovedUsers() {
        const storedRemovedUsers = localStorage.getItem("removedUsers");
        return storedRemovedUsers ? JSON.parse(storedRemovedUsers) : [];
    }

    function saveRemovedUsers() {
        localStorage.setItem("removedUsers", JSON.stringify(removedUsers));
    }

    if (typeof window.addToPreviousUsers !== 'undefined') {
        window.addToPreviousUsers = addToPreviousUsers;
    }
    if (typeof window.displayPreviousUsers !== 'undefined') {
        window.displayPreviousUsers = displayPreviousUsers;
    }
    // if (typeof window.addToNewUsers !== 'undefined') {
     //    window.addToNewUsers = addToNewUsers;
    // }
    // if (typeof window.displayNewUsers !== 'undefined') {
    //     window.displayNewUsers = displayNewUsers;
    // }

    window.initializeAllUsersFromScriptJS = function(callback) {
        callback();
    };

    fetchData();
    setInterval(() => {
        allOnlineUsersData = [];
        fetchData();
        // displayPreviousUsers(); // Removed periodic refresh of previous users
    }, 60000);
});
