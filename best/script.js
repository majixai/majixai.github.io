document.addEventListener('DOMContentLoaded', function() {
    const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
    const mainIframe = document.getElementById("mainIframe");
    const mainIframe2 = document.getElementById("mainIframe2");

    let previousUsers = loadPreviousUsers();
    let removedUsers = loadRemovedUsers();
    displayPreviousUsers();
    let allOnlineUsersData = [];

    function fetchData(offset = 0) {
        const apiUrl = `https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&limit=500&offset=${offset}`;

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

                        if (typeof initializeAllUsers === 'function') {
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

        const filteredUsers = users.filter(user => {
            const isPublic = user.current_show === 'public';
            const hasTags = ['asian', '18', 'deepthroat', 'bigboobs', 'fuckmachine'].some(tag => user.tags.includes(tag));
            const isYoung = user.age && user.age < 25;
            const isBirthdayWithinTwoWeeks = isBirthdayInRange(user.birthday);
            return isPublic && (hasTags || isYoung || isBirthdayWithinTwoWeeks);
        });

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

    function isBirthdayInRange(birthday) {
        if (!birthday) return false;
        const today = new Date();
        const twoWeeksAgo = new Date(today);
        const twoWeeksLater = new Date(today);
        twoWeeksAgo.setDate(today.getDate() - 14);
        twoWeeksLater.setDate(today.getDate() + 14);

        const userBirthday = new Date(birthday);
        const birthdayThisYear = new Date(today.getFullYear(), userBirthday.getMonth(), userBirthday.getDate());
        const birthdayNextYear = new Date(today.getFullYear() + 1, userBirthday.getMonth(), userBirthday.getDate());

        return (birthdayThisYear >= twoWeeksAgo && birthdayThisYear <= twoWeeksLater) ||
               (birthdayNextYear >= twoWeeksAgo && birthdayNextYear <= twoWeeksLater);
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

    function displayPreviousUsers() {
        previousUsersDiv.innerHTML = "";

        const onlineUsernamesPromise = fetchOnlineUsernames();

        const storedUsers = loadPreviousUsers();
        if (storedUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users yet.</p>';
            return;
        }

        onlineUsernamesPromise.then(onlineUsernames => {
            if (!onlineUsernames) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Error fetching online users for previous users list.</p>';
                return;
            }

            const onlinePreviousUsersInitial = storedUsers.filter(user => onlineUsernames.includes(user.username) && user.current_show === 'public');

            if (onlinePreviousUsersInitial.length === 0) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous public users currently online.</p>';
                return;
            }

            onlinePreviousUsersInitial.forEach(user => {
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
        }).catch(error => {
            console.error("Error fetching online users for previous users:", error);
            previousUsersDiv.innerHTML = '<p class="text-danger w3-center">Error updating previous users online status.</p>';
        });
    }

    function fetchOnlineUsernames() {
        return new Promise((resolve, reject) => {
            let currentOnlineUsersData = [];
            function recursiveFetch(offset = 0) {
                const apiUrl = `https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&limit=500&offset=${offset}`;

                fetch(apiUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.results && data.results.length > 0) {
                            const publicUsernames = data.results
                                .filter(user => user.current_show === 'public')
                                .map(user => user.username);
                            currentOnlineUsersData = currentOnlineUsersData.concat(publicUsernames);

                            if (data.results.length === 500) {
                                return recursiveFetch(offset + 500);
                            } else {
                                resolve(currentOnlineUsersData);
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

    window.initializeAllUsersFromScriptJS = function(callback) {
        callback();
    };

    fetchData();
    setInterval(() => {
        allOnlineUsersData = [];
        fetchData();
    }, 60000);
});
