// script.js
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
                    <p>Age: ${user.age || 'N/A'}</p>
                    <p>Location: ${user.location || 'Unknown'}</p>
                </div>
            `;

            userElement.addEventListener("click", function () {
                const usr = userElement.querySelector("img").dataset.username;
                mainIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;

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
            previousUsers = previousUsers.slice(0, 20);
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
