document.addEventListener('DOMContentLoaded', function() {
    const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
    const mainIframe = document.getElementById("mainIframe");
    const mainIframe2 = document.getElementById("mainIframe2");

    let previousUsers = loadPreviousUsers();
    let removedUsers = loadRemovedUsers(); // Load removed users from localStorage
    displayPreviousUsers(); // Initial display from localStorage

    let allOnlineUsersData = []; // Initialize *once* here
    let onlineUsernamesSet = new Set(); // Store online usernames for efficient lookup


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
                    const publicUsers = data.results.filter(user => user.current_show === 'public');
                    // Update the existing allOnlineUsersData array (don't reset it!)
                    publicUsers.forEach(newUser => {
                        if (!allOnlineUsersData.some(existingUser => existingUser.username === newUser.username)) {
                            allOnlineUsersData.push(newUser);
                        }
                    });

                    // Update onlineUsernamesSet
                    publicUsers.forEach(user => onlineUsernamesSet.add(user.username));

                    if (data.results.length === 500) {
                        // Continue fetching if necessary
                        return fetchData(offset + 500);
                    } else {
                        // Filter out users that are no longer online
                        allOnlineUsersData = allOnlineUsersData.filter(user => onlineUsernamesSet.has(user.username));
                        displayOnlineUsers(allOnlineUsersData);
                        return Promise.resolve(); // Resolve the promise chain
                    }

                } else {
                    onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
                    return Promise.resolve(); // Resolve even if no users found
                }
            })
            .catch(error => {
                console.error("Fetch error:", error);
                onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error fetching data.</p>';
                return Promise.reject(error); // Propagate the rejection
            });
    }



    function displayOnlineUsers(users) {
        onlineUsersDiv.innerHTML = ""; // Clear the list before updating
        if (users.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
            return;
        }

        users.forEach(user => {
            if (user.current_show !== 'public' || !user.image_url || !user.username) {
                return; // Skip invalid users
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

            userElement.addEventListener("click", function(event) {
                event.preventDefault();
                const usr = this.querySelector("img").dataset.username;
                const iframeChoice = document.querySelector('input[name="iframeChoice"]:checked').value;
                const selectedIframe = iframeChoice === 'mainIframe2' ? mainIframe2 : mainIframe;
                selectedIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;

                addToPreviousUsers(user);
            });
            onlineUsersDiv.appendChild(userElement);
        });
    }


    function addToPreviousUsers(user) {
        if (!previousUsers.some(u => u.username === user.username)) {
            previousUsers.unshift(user);
            localStorage.setItem("previousUsers", JSON.stringify(previousUsers));

            const userElement = document.createElement("div");
            userElement.className = "user-info";
            userElement.innerHTML = `
                <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}" data-username="${user.username}">
                <div class="user-details">
                    <p>Age: ${user.age || 'N/A'}</p>
                    <p>Username: ${user.username}</p>
                </div>
            `;

            userElement.addEventListener("click", function(event) {
                event.preventDefault();
                const usr = this.querySelector("img").dataset.username;
                const iframeChoice = document.querySelector('input[name="iframeChoice"]:checked').value;
                const selectedIframe = iframeChoice === 'mainIframe2' ? mainIframe2 : mainIframe;
                selectedIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;
            });

            userElement.addEventListener("dblclick", function(event) {
                event.preventDefault();
                const usernameToRemove = user.username;
                previousUsers = previousUsers.filter(u => u.username !== usernameToRemove);
                localStorage.setItem("previousUsers", JSON.stringify(previousUsers));
                this.remove(); // Correctly removes the element
            });

            previousUsersDiv.prepend(userElement); // Prepend to the list
        }
    }
   function displayPreviousUsers() {
        previousUsersDiv.innerHTML = ""; // Clear for initial load

        const storedUsers = loadPreviousUsers();
        if (storedUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users yet.</p>';
            return;
        }

        storedUsers.forEach(user => {
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

            // Add online/offline indicator (using onlineUsernamesSet)
            if (onlineUsernamesSet.has(user.username)) {
                userElement.classList.add("online"); // You'll need CSS for this
            } else {
                userElement.classList.add("offline");  // And CSS for this
            }


            userElement.addEventListener("click", function(event) {
                event.preventDefault();
                const usr = this.querySelector("img").dataset.username;
                const iframeChoice = document.querySelector('input[name="iframeChoice"]:checked').value;
                const selectedIframe = iframeChoice === 'mainIframe2' ? mainIframe2 : mainIframe;
                selectedIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;
            });

             userElement.addEventListener("dblclick", function(event) {
                event.preventDefault();
                const usernameToRemove = user.username;
                previousUsers = previousUsers.filter(u => u.username !== usernameToRemove);
                localStorage.setItem("previousUsers", JSON.stringify(previousUsers));
                this.remove(); // Correctly removes the element
            });


            previousUsersDiv.appendChild(userElement);
        });
    }


    function loadPreviousUsers() {
        const storedUsers = localStorage.getItem("previousUsers");
        return storedUsers ? JSON.parse(storedUsers) : [];
    }

    function loadRemovedUsers() {
        const storedRemovedUsers = localStorage.getItem("removedUsers");
        return storedRemovedUsers ? JSON.parse(storedRemovedUsers) : [];
    }

    function saveRemovedUsers() {
        localStorage.setItem("removedUsers", JSON.stringify(removedUsers));
    }

    // Initial fetch and setup
    fetchData().then(() => {
        // Now that initial data is loaded, set up the interval
        setInterval(() => {
            onlineUsernamesSet.clear(); // Clear the Set before refetching
            fetchData().then(displayPreviousUsers).catch(err=> console.error("Error in set interval displayPreviousUsers:", err)); // Update online status
              //Update online status
        }, 60000);
    }).catch(error => {
      console.error("initial fetch error:", error);
    });
});
