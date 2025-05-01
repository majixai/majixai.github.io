document.addEventListener('DOMContentLoaded', async function() {
    const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
    const mainIframe = document.getElementById("mainIframe");
    const mainIframe2 = document.getElementById("mainIframe2");

    const storageTypeSelector = document.getElementById("storageType");
    const filterTagsSelect = document.getElementById("filterTags");
    const filterAgeSelect = document.getElementById("filterAge");

    const button18 = document.getElementById("filter18");
    const buttonAsian = document.getElementById("filterAsian");
    const buttonNew = document.getElementById("filterNew");

    let storageType = storageTypeSelector.value;
    let previousUsers = await loadUsers("previousUsers");
    let removedUsers = await loadUsers("removedUsers");
    displayPreviousUsers();
    let allOnlineUsersData = [];

    storageTypeSelector.addEventListener("change", async function() {
        storageType = this.value;
        previousUsers = await loadUsers("previousUsers");
        removedUsers = await loadUsers("removedUsers");
        await displayPreviousUsers();
    });

    button18.addEventListener("click", function() {
        applyTagFilter("18");
    });

    buttonAsian.addEventListener("click", function() {
        applyTagFilter("asian");
    });

    buttonNew.addEventListener("click", function() {
        applyTagFilter("new");
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
                console.error("Fetch error:", error);
                onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error fetching data.</p>';
                return;
            }
        }

        populateFilters(allOnlineUsersData);
        onlineUsersDiv.innerHTML = "";
        displayOnlineUsers(allOnlineUsersData);

        if (typeof initializeAllUsers === 'function') {
            window.initializeAllUsers();
        }
    }

    function populateFilters(users) {
        const tagFrequency = {};
        const ages = new Set();

        users.forEach(user => {
            if (user.tags) {
                user.tags.forEach(tag => {
                    tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
                });
            }
            if (user.age) {
                ages.add(user.age);
            }
        });

        const sortedTags = Object.entries(tagFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(entry => entry[0]);

        filterTagsSelect.innerHTML = sortedTags.map(tag => `<option value="${tag}">${tag}</option>`).join('');
        filterAgeSelect.innerHTML = Array.from(ages).map(age => `<option value="${age}">${age}</option>`).join('');
    }

    async function displayOnlineUsers(users) {
        const filterTags = Array.from(filterTagsSelect.selectedOptions).map(option => option.value);
        const filterAges = Array.from(filterAgeSelect.selectedOptions).map(option => parseInt(option.value));

        const filteredUsers = users.filter(user => {
            const isPublic = user.current_show === 'public';
            const hasTags = filterTags.length === 0 || filterTags.some(tag => user.tags.includes(tag));
            const isAgeMatch = filterAges.length === 0 || filterAges.includes(user.age);
            return isPublic && hasTags && isAgeMatch;
        });

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

    async function displayPreviousUsers() {
        previousUsersDiv.innerHTML = "";

        const storedUsers = await loadUsers("previousUsers");
        const onlinePublicUsers = await filterOnlineUsers(storedUsers);

        if (onlinePublicUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users yet.</p>';
            return;
        }

        onlinePublicUsers.forEach(user => {
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
    }

    async function filterOnlineUsers(users) {
        const onlineUsernames = allOnlineUsersData.map(user => user.username);
        return users.filter(user => onlineUsernames.includes(user.username) && user.current_show === 'public');
    }

    function applyTagFilter(tag) {
        filterTagsSelect.value = tag;
        displayOnlineUsers(allOnlineUsersData);
    }

    function isBirthday(birthday) {
        if (!birthday) return false;
        const today = new Date();
        const birthDate = new Date(birthday);
        return today.getDate() === birthDate.getDate() && today.getMonth() === birthDate.getMonth();
    }

    async function loadUsers(key) {
        if (storageType === "indexedClicked") {
            return await loadFromIndexedDB(key);
        } else {
            const storage = storageType === "local" ? localStorage : sessionStorage;
            const storedUsers = storage.getItem(key);
            return storedUsers ? JSON.parse(storedUsers) : [];
        }
    }

    await fetchData();
    setInterval(async () => {
        allOnlineUsersData = [];
        await fetchData();
    }, 300000);
});
