document.addEventListener('DOMContentLoaded', async function() {
    try {
        const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
        const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
        const mainIframe = document.getElementById("mainIframe");
        const mainIframe2 = document.getElementById("mainIframe2");

        const storageTypeSelector = document.getElementById("storageType");
        const filterTagsSelect = document.getElementById("filterTags");
        const filterAgeSelect = document.getElementById("filterAge");
        const sortTagsSelect = document.getElementById("sortTags");
        const sortAgeSelect = document.getElementById("sortAge");

        let storageType = storageTypeSelector.value;
        let previousUsers = loadUsers("previousUsers");
        let removedUsers = loadUsers("removedUsers");
        await displayPreviousUsers();
        let allOnlineUsersData = [];

        storageTypeSelector.addEventListener("change", async function() {
            try {
                storageType = this.value;
                previousUsers = loadUsers("previousUsers");
                removedUsers = loadUsers("removedUsers");
                await displayPreviousUsers();
            } catch (error) {
                alert("Error in storageTypeSelector change event: " + error.message);
            }
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
                    alert("Fetch error: " + error.message);
                    onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error fetching data.</p>';
                    return;
                }
            }

            try {
                populateFilters(allOnlineUsersData);
                onlineUsersDiv.innerHTML = "";
                await displayOnlineUsers(allOnlineUsersData);

                if (typeof initializeAllUsers === 'function') {
                    window.initializeAllUsers();
                }
            } catch (error) {
                alert("Error in fetchData: " + error.message);
            }
        }

        function populateFilters(users) {
            try {
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
            } catch (error) {
                alert("Error in populateFilters: " + error.message);
            }
        }

        async function displayOnlineUsers(users) {
            try {
                const filterTags = Array.from(filterTagsSelect.selectedOptions).map(option => option.value);
                const filterAges = Array.from(filterAgeSelect.selectedOptions).map(option => parseInt(option.value));

                const filteredUsers = users.filter(user => {
                    const isPublic = user.current_show === 'public';
                    const hasTags = filterTags.length === 0 || filterTags.some(tag => user.tags.includes(tag));
                    const isAgeMatch = filterAges.length === 0 || filterAges.includes(user.age);
                    return isPublic && hasTags && isAgeMatch;
                });

                const sortTag = sortTagsSelect.value;
                const sortAge = sortAgeSelect.value;

                if (sortTag && sortTag !== 'Sort by Tag') {
                    filteredUsers.sort((a, b) => {
                        const aHasTag = a.tags.includes(sortTag);
                        const bHasTag = b.tags.includes(sortTag);
                        return aHasTag === bHasTag ? 0 : aHasTag ? -1 : 1;
                    });
                }

                if (sortAge && sortAge !== 'Sort by Age') {
                    if (sortAge === "asc") {
                        filteredUsers.sort((a, b) => a.age - b.age);
                    } else if (sortAge === "desc") {
                        filteredUsers.sort((a, b) => b.age - a.age);
                    }
                }

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
                        try {
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
                        } catch (error) {
                            alert("Error in userElement click event: " + error.message);
                        }
                    });
                    onlineUsersDiv.appendChild(userElement);
                });
            } catch (error) {
                alert("Error in displayOnlineUsers: " + error.message);
            }
        }

        async function addToPreviousUsers(user) {
            try {
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
                        try {
                            const usr = userElement.querySelector("img").dataset.username;
                            const iframeChoice = document.querySelector('input[name="iframeChoice"]:checked').value;
                            let selectedIframe;

                            if (iframeChoice === 'mainIframe2') {
                                selectedIframe = mainIframe2;
                            } else {
                                selectedIframe = mainIframe;
                            }
                            selectedIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;
                        } catch (error) {
                            alert("Error in userElement click event: " + error.message);
                        }
                    });

                    previousUsersDiv.prepend(userElement);
                }
            } catch (error) {
                alert("Error in addToPreviousUsers: " + error.message);
            }
        }

        async function displayPreviousUsers() {
            try {
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
                        try {
                            const usr = userElement.querySelector("img").dataset.username;
                            const iframeChoice = document.querySelector('input[name="iframeChoice"]:checked').value;
                            let selectedIframe;

                            if (iframeChoice === 'mainIframe2') {
                                selectedIframe = mainIframe2;
                            } else {
                                selectedIframe = mainIframe;
                            }
                            selectedIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;
                        } catch (error) {
                            alert("Error in userElement click event: " + error.message);
                        }
                    });

                    previousUsersDiv.appendChild(userElement);
                });
            } catch (error) {
                alert("Error in displayPreviousUsers: " + error.message);
            }
        }

        function isBirthday(birthday) {
            try {
                if (!birthday) return false;
                const today = new Date();
                const birthDate = new Date(birthday);
                return today.getDate() === birthDate.getDate() && today.getMonth() === birthDate.getMonth();
            } catch (error) {
                alert("Error in isBirthday: " + error.message);
                return false;
            }
        }

        function loadUsers(key) {
            try {
                const storage = storageType === "local" ? localStorage : sessionStorage;
                const storedUsers = storage.getItem(key);
                return storedUsers ? JSON.parse(storedUsers) : [];
            } catch (error) {
                alert("Error in loadUsers: " + error.message);
                return [];
            }
        }

        function saveUsers(key, users) {
            try {
                const storage = storageType === "local" ? localStorage : sessionStorage;
                storage.setItem(key, JSON.stringify(users));
            } catch (error) {
                alert("Error in saveUsers: " + error.message);
            }
        }

        if (typeof window.addToPreviousUsers !== 'undefined') {
            window.addToPreviousUsers = addToPreviousUsers;
        }
        if (typeof window.displayPreviousUsers !== 'undefined') {
            window.displayPreviousUsers = displayPreviousUsers;
        }

        window.initializeAllUsersFromScriptJS = function(callback) {
            try {
                callback();
            } catch (error) {
                alert("Error in initializeAllUsersFromScriptJS: " + error.message);
            }
        };

        await fetchData();
        setInterval(async () => {
            try {
                allOnlineUsersData = [];
                await fetchData();
            } catch (error) {
                alert("Error in setInterval fetchData: " + error.message);
            }
        }, 120000);
    } catch (error) {
        alert("Error in DOMContentLoaded: " + error.message);
    }
});
