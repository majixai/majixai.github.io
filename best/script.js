        const onlineUsersDiv = document.getElementById("onlineUsers");
        const previousUsersDiv = document.getElementById("previousUsers");
        const mainIframe = document.getElementById("mainIframe");
        let previousUsers = loadPreviousUsers(); // Load from localStorage

        displayPreviousUsers(); // Display on load
        fetchData(); // Initial data fetch

        function fetchData() {
            const apiUrl = 'https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f';

            fetch(apiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    displayOnlineUsers(data.results);
                })
                .catch(error => {
                    console.error("Fetching data failed:", error);
                    onlineUsersDiv.innerHTML = `<p>Error fetching data.</p>`;
                });
        }

        function displayOnlineUsers(users) {
            onlineUsersDiv.innerHTML = "";
            if (!users || users.length === 0) {
                onlineUsersDiv.innerHTML = `<p>No online users found.</p>`;
                return;
            }

            users.forEach(user => {
                if (!user.image_url || !user.username || !user.age || !user.location || !user.iframe_embed) {
                    console.warn("Incomplete user data:", user);
                    return; // Skip this user if data is missing
                }
                const userElement = document.createElement("div");
                userElement.className = "user-info";
                userElement.innerHTML = `
                    <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}">
                    <div class="user-details">
                        <p>Username: ${user.username}</p>
                        <p>Age: ${user.age}</p>
                        <p>Location: ${user.location}</p>
                    </div>
                `;

                userElement.addEventListener("click", function () {
                    const iframeUrl = userElement.querySelector("img").dataset.iframeUrl;
                    mainIframe.src = iframeUrl;

                    addToPreviousUsers(user);
                    displayPreviousUsers();
                });

                onlineUsersDiv.appendChild(userElement);
            });
        }


        function addToPreviousUsers(user) {
            if (!previousUsers.some(u => u.username === user.username)) {
                previousUsers.push(user);
                localStorage.setItem("previousUsers", JSON.stringify(previousUsers));
            }
        }

        function displayPreviousUsers() {
            previousUsersDiv.innerHTML = "";
            previousUsers.forEach(user => {
                if (!user.image_url || !user.username) {
                    console.warn("Incomplete previous user data:", user);
                    return; // Skip if data is missing
                }
                const userElement = document.createElement("div");
                userElement.className = "user-info";
                userElement.innerHTML = `
                    <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}">
                    <div class="user-details">
                        <p>Username: ${user.username}</p>
                    </div>
                `;

                userElement.addEventListener("click", function () {
                    const iframeUrl = userElement.querySelector("img").dataset.iframeUrl;
                    mainIframe.src = iframeUrl;
                });

                previousUsersDiv.appendChild(userElement);
            });
        }

        function loadPreviousUsers() {
            const storedUsers = localStorage.getItem("previousUsers");
            return storedUsers ? JSON.parse(storedUsers) : [];
        }

        // API related button functionalities (example - you may need to adjust based on your API class)
        var chaturbateAPI = { //removed API Class, implemented fetch directly
            loadMore: function() { console.log('Load More functionality needs to be implemented.'); },
            loadLess: function() { console.log('Load Less functionality needs to be implemented.'); },
        };
        var loadMore = document.getElementById('loadMore');
        var loadLess = document.getElementById('loadLess');

        loadMore.addEventListener('click', function() {
            chaturbateAPI.loadMore();
        });
        loadLess.addEventListener('click', function() {
            chaturbateAPI.loadLess();
        });
