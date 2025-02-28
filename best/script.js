// script.js
document.addEventListener('DOMContentLoaded', function() {
    const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
    const mainIframe = document.getElementById("mainIframe");

    let previousUsers = loadPreviousUsers();
    displayPreviousUsers();
    let allOnlineUsersData = []; // Store all online users data for pagination

    function fetchData(offset = 0) {
        const apiUrl = `https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f&limit=500&offset=${offset}`;

        return fetch(apiUrl) // Return the fetch promise to manage recursion
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.results && data.results.length > 0) {
                    allOnlineUsersData = allOnlineUsersData.concat(data.results); // Accumulate results

                    if (data.results.length === 500) { // Assuming 'limit=500' was reached, fetch next page
                        return fetchData(offset + 500); // Recursive call for next page
                    } else {
                        // Less than limit, assume no more pages, display all users and initialize search
                        onlineUsersDiv.innerHTML = ""; // Clear loading message
                        displayOnlineUsers(allOnlineUsersData);

                        if(typeof initializeAllUsers === 'function') {
                            window.initializeAllUsers(); // Call from search.js to initialize search data
                        }
                        return Promise.resolve(); // Resolve promise to end the chain
                    }
                } else {
                    // No results, or empty results, no more users to fetch
                    onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
                    return Promise.resolve(); // Resolve promise to end the chain
                }
            })
            .catch(error => {
                console.error("Fetch error:", error);
                onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error fetching data.</p>';
                return Promise.reject(error); // Reject promise to propagate error
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
                return; // Skip users with missing data
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

                // Add to previousUsers and update localStorage
                addToPreviousUsers(user);
                displayPreviousUsers();
            });
            onlineUsersDiv.appendChild(userElement);
        });
    }


    function addToPreviousUsers(user) {
        if (!previousUsers.some(u => u.username === user.username)) {
            previousUsers.unshift(user);
            previousUsers = previousUsers.slice(0, 20); // Limit previous users to 20
            localStorage.setItem("previousUsers", JSON.stringify(previousUsers));
        }
    }

    function displayPreviousUsers() {
        previousUsersDiv.innerHTML = "";
        if (previousUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users.</p>';
            return;
        }

        previousUsers.forEach(user => {
            if (!user.image_url || !user.username) {
                return; // Skip display if data is missing, or handle more gracefully
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
                // const choice = document.;
                mainIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;
            });
            previousUsersDiv.appendChild(userElement);
        });
    }

    function loadPreviousUsers() {
        const storedUsers = localStorage.getItem("previousUsers");
        return storedUsers ? JSON.parse(storedUsers) : [];
    }

    // Override dummy functions in search.js with actual implementations from script.js
    if (typeof window.addToPreviousUsers !== 'undefined') {
        window.addToPreviousUsers = addToPreviousUsers;
    }
    if (typeof window.displayPreviousUsers !== 'undefined') {
        window.displayPreviousUsers = displayPreviousUsers;
    }


     // Expose a function to signal search.js when to initialize and provide data
    window.initializeAllUsersFromScriptJS = function(callback) {
        callback(); // Execute the initializeAllUsers function from search.js
    };


    // Initial fetch when page loads
    fetchData();
    setInterval(() => {
        allOnlineUsersData = []; // Reset online users array before each interval fetch
        fetchData();
    }, 300000);

});
