document.addEventListener('DOMContentLoaded', function() {
    const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
    const mainIframe = document.getElementById("mainIframe");

    let previousUsers = loadPreviousUsers();
    displayPreviousUsers();

    function fetchData() {
        const apiUrl = 'https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f&limit=500'; // &offset=' o ?? 0;

        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.results && data.results.length > 0) {
                    onlineUsersDiv.innerHTML = ""; // Clear loading message
                    displayOnlineUsers(data.results);
                } else {
                    onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
                }
            })
            .catch(error => {
                console.error("Fetch error:", error);
                onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error fetching data.</p>';
            });
    }
Function displayOnlineUsers(users) {
        onlineUsersDiv.innerHTML = "";
        if (users.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
            return;
        }

        // Filter users to only display those currently online and NOT in private
        // **IMPORTANT: Inspect your 'users' data to find the correct properties for 'private' status.**
        // **To inspect the data, uncomment the `console.log("User object:", user);` line inside the `onlinePublicUsers.forEach` loop below**
        // **and check the browser's developer console.**
        const onlinePublicUsers = users.filter(user => {
            // **Placeholder filter - assuming there's a property called 'room_status' and public rooms DO NOT have 'private' as their status.**
            // **MODIFY THIS FILTER BASED ON YOUR INSPECTION OF THE 'user' DATA IN THE CONSOLE.**
            return user.room_status !== 'private';

            // **Example filters based on different potential property names:**
            // 1. If 'is_private_room' is a boolean and FALSE for public rooms:
            //    return user.is_private_room === false;
            // 2. If 'room_type' is 'public' for public rooms:
            //    return user.room_type === 'public';
            // 3. If you find 'isOnline' and 'isPrivate' boolean properties:
            //    return user.isOnline === true && user.isPrivate === false;

            // **If you are unsure, or want to see all users initially to inspect the data, you can temporarily use:**
            // return true; // This will show all users, regardless of 'private' status - for data inspection only
        });

        if (onlinePublicUsers.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online public users found.</p>';
            return;
        }

        onlinePublicUsers.forEach(user => {
            if (!user.image_url || !user.username) {
                console.warn("Incomplete user data:", user);
                return; // Skip users with missing data
            }

            // **UNCOMMENT THIS LINE TO INSPECT THE 'user' OBJECT IN THE BROWSER CONSOLE:**
            // console.log("User object:", user);

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
            // previousUsers = previousUsers.slice(0, 20);
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

    function addToPreviousUsers(user) {
        if (!previousUsers.some(u => u.username === user.username)) {
            previousUsers.unshift(user);
            // previousUsers = previousUsers.slice(0, 20);
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

    // Initial fetch when page loads
    fetchData();
    setInterval(fetchData, 5000);
    // let counter = 0;
    // const intervalId = setInterval(() => {
    //   // fetchData(counter);
    //   counter += 500;
    //   if (counter > 15000) {
    //     clearInterval(intervalId);
    //   }
    // }, 0);
});
