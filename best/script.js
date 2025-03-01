// script.js
document.addEventListener('DOMContentLoaded', function() {
    const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
    const mainIframe = document.getElementById("mainIframe");

    let previousUsers = loadPreviousUsers();
    displayPreviousUsers(); // Modified to fetch online users before displaying
    let allOnlineUsersData = []; // Store all online users data for pagination

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
                    allOnlineUsersData = allOnlineUsersData.concat(data.results);

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
            if (!user.image_url || !user.username) {
                console.warn("Incomplete user data:", user);
                return;
            }

            const userElement = document.createElement("div");
            userElement.className = "user-info";
            userElement.innerHTML = `
                <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed} data-username="${user.username}">
                <div class="user-details">
                    <p>Username: ${user.username}</p>
                    <p>Age: ${user.age || 'N/A'} ${user.is_new ? 'New' : ''}</p>
                    <p>Location: ${user.location || 'Unknown'}</p>
                </div>
            `;

            userElement.addEventListener("click", function () {
                const usr = userElement.querySelector("img").dataset.username;
                // mainIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;

                addToPreviousUsers(user);
                displayPreviousUsers(); // Call displayPreviousUsers to refresh with online status
            });
            onlineUsersDiv.appendChild(userElement);
        });
    }


    function addToPreviousUsers(user) {
        if (!previousUsers.some(u => u.username === user.username)) {
            previousUsers.unshift(user);
            previousUsers = previousUsers.slice(0, 20);
            localStorage.setItem("previousUsers", JSON.stringify(previousUsers));
        }
    }

    function displayPreviousUsers() {
        previousUsersDiv.innerHTML = ""; // Clear previous users div

        fetchOnlineUsernames().then(onlineUsernames => { // Fetch online usernames
            if (!onlineUsernames) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Error fetching online users for previous users list.</p>';
                return;
            }

            const onlinePreviousUsers = previousUsers.filter(user => onlineUsernames.includes(user.username));

            if (onlinePreviousUsers.length === 0) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users currently online.</p>';
                return;
            }

            onlinePreviousUsers.forEach(user => {
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

                userElement.addEventListener("click", function () {
                    const usr = userElement.querySelector("img").dataset.username;
                    mainIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;
                });
                previousUsersDiv.appendChild(userElement);
            });
        }).catch(error => {
            console.error("Error fetching online users for previous users:", error);
            previousUsersDiv.innerHTML = '<p class="text-danger w3-center">Error updating previous users online status.</p>';
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
                            currentOnlineUsersData = currentOnlineUsersData.concat(data.results);

                            if (data.results.length === 500) {
                                return recursiveFetch(offset + 500);
                            } else {
                                const usernames = currentOnlineUsersData.map(user => user.username);
                                resolve(usernames); // Resolve with usernames
                            }
                        } else {
                            resolve([]); // Resolve with empty array if no users online
                        }
                    })
                    .catch(error => {
                        reject(error); // Reject promise on error
                    });
            }
            recursiveFetch();
        });
    }


    function loadPreviousUsers() {
        const storedUsers = localStorage.getItem("previousUsers");
        return storedUsers ? JSON.parse(storedUsers) : [];
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


    fetchData();
    setInterval(() => {
        allOnlineUsersData = [];
        fetchData();
        displayPreviousUsers(); // Also refresh previous users online status on interval
    }, 300000);

});
