// search.js
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('userSearch');
    const searchResultsContainer = document.getElementById('searchResults');
    let allUsers = []; // Store combined online and previous users for search

    // Function to initialize allUsers - call this after online and previous users are loaded initially
    function initializeAllUsers() {
        const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
        const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');

        let onlineUsers = Array.from(onlineUsersDiv.querySelectorAll('.user-info')).map(userElement => {
            const detailsParagraphs = userElement.querySelector('.user-details').querySelectorAll('p');
            let ageText = detailsParagraphs[1].textContent.split(': ')[1].split(' ')[0];
            let age = ageText === 'N/A' ? 'N/A' : parseInt(ageText, 10); // Parse age as integer or keep 'N/A'

            return {
                username: userElement.querySelector('img').alt,
                image_url: userElement.querySelector('img').src,
                iframe_embed: userElement.querySelector('img').dataset.iframeUrl,
                age: age,
                location: detailsParagraphs[2].textContent.split(': ')[1] // Extract location
                // Add other relevant properties if needed
            };
        });

        let previousUsers = Array.from(previousUsersDiv.querySelectorAll('.user-info')).map(userElement => {
            const detailsParagraphs = userElement.querySelector('.user-details').querySelectorAll('p');
            let ageText = detailsParagraphs[0].textContent.split(': ')[1];
            let age = ageText === 'N/A' ? 'N/A' : parseInt(ageText, 10);

            return {
                username: userElement.querySelector('img').alt,
                image_url: userElement.querySelector('img').src,
                iframe_embed: userElement.querySelector('img').dataset.iframeUrl,
                age: age,
                // Add other relevant properties if needed
            };
        });
        allUsers = [...onlineUsers, ...previousUsers];
    }

    // Debounce function to limit API calls (no API calls in search.js anymore, but keep debounce for input)
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    const debouncedSearch = debounce(handleSearch, 300); // 300ms delay

    searchInput.addEventListener('input', debouncedSearch);

    function handleSearch() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (searchTerm.length < 2) { // Minimum characters to start search
            clearSearchResults();
            return;
        }

        const filteredUsers = allUsers.filter(user => {
            return user.username.toLowerCase().includes(searchTerm);
        });

        displaySearchResults(filteredUsers);
    }


    function displaySearchResults(users) {
        searchResultsContainer.innerHTML = "";
        if (users.length === 0) {
            searchResultsContainer.innerHTML = '<p class="text-muted">No users found.</p>';
            return;
        }

        users.forEach(user => {
            const userElement = document.createElement("div");
            userElement.className = "search-user-info"; // Different class for search results
            userElement.innerHTML = `
                <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}" data-username="${user.username}">
                <div class="user-details">
                    <p>Username: ${user.username}</p>
                    <p>Age: ${user.age || 'N/A'}</p>
                </div>
            `;
            userElement.addEventListener("click", function () {
                const usr = userElement.querySelector("img").dataset.username;
                const mainIframe = document.getElementById("mainIframe");
                mainIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;

                // Add to previousUsers and update localStorage (reuse function from script.js)
                const onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
                let onlineUsersData = Array.from(onlineUsersDiv.querySelectorAll('.user-info')).map(el => {
                    const detailsParagraphs = el.querySelector('.user-details').querySelectorAll('p');
                    let ageText = detailsParagraphs[1].textContent.split(': ')[1].split(' ')[0];
                    let age = ageText === 'N/A' ? 'N/A' : parseInt(ageText, 10);
                    return {
                        username: el.querySelector('img').alt,
                        image_url: el.querySelector('img').src,
                        iframe_embed: el.querySelector('img').dataset.iframeUrl,
                        age: age,
                        location: detailsParagraphs[2].textContent.split(': ')[1]
                    };
                });
                let selectedUser = onlineUsersData.find(u => u.username === usr);
                if (!selectedUser) {
                    const previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
                    let previousUsersData = Array.from(previousUsersDiv.querySelectorAll('.user-info')).map(el => {
                         const detailsParagraphs = el.querySelector('.user-details').querySelectorAll('p');
                        let ageText = detailsParagraphs[0].textContent.split(': ')[1];
                        let age = ageText === 'N/A' ? 'N/A' : parseInt(ageText, 10);
                        return {
                            username: el.querySelector('img').alt,
                            image_url: el.querySelector('img').src,
                            iframe_embed: el.querySelector('img').dataset.iframeUrl,
                            age: age
                        };
                    });
                    selectedUser = previousUsersData.find(u => u.username === usr);
                }


                if (selectedUser) {
                    // Assuming addToPreviousUsers and displayPreviousUsers are globally accessible from script.js
                    addToPreviousUsers(selectedUser);
                    displayPreviousUsers();
                }

                clearSearchResults(); // Clear search results after selection
                searchInput.value = ''; // Clear search input
            });
            searchResultsContainer.appendChild(userElement);
        });
    }

    function clearSearchResults() {
        searchResultsContainer.innerHTML = "";
    }


    // Expose initializeAllUsers, addToPreviousUsers, displayPreviousUsers globally so script.js can call them
    window.initializeAllUsers = initializeAllUsers;
    window.addToPreviousUsers = function(user) { // Dummy function - script.js will override
        console.warn("addToPreviousUsers needs to be defined in script.js");
    };
    window.displayPreviousUsers = function() { // Dummy function - script.js will override
        console.warn("displayPreviousUsers needs to be defined in script.js");
    };

    // Wait for script.js to load and populate online/previous users before initializing allUsers
    let scriptLoadedCheck = setInterval(() => {
        if (typeof initializeAllUsersFromScriptJS !== 'undefined') { // Check for a flag from script.js
            clearInterval(scriptLoadedCheck);
            initializeAllUsersFromScriptJS(initializeAllUsers); // Call the initialization after script.js data is ready
        }
    }, 100);

});
