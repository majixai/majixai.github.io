// search.js
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('userSearch');
    const searchResultsContainer = document.getElementById('searchResults');
    const mainIframe = document.getElementById('mainIframe');
    const secondIframe = document.getElementById('secondIframe');
    const ageFromInput = document.getElementById('ageFrom'); // New age filter input
    const ageToInput = document.getElementById('ageTo');     // New age filter input
    const tagSearchInput = document.getElementById('tagSearch'); // New tag filter input

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
                location: detailsParagraphs[2].textContent.split(': ')[1], // Extract location
                tags: [] // **Important:** Add tags array, populate if API provides tags, or leave empty
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
                tags: [] // **Important:** Add tags array, populate if API provides tags, or leave empty
                // Add other relevant properties if needed
            };
        });
        allUsers = [...onlineUsers, ...previousUsers];
    }

    // Debounce function for search input
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    const debouncedSearch = debounce(handleSearch, 300);

    searchInput.addEventListener('input', debouncedSearch);
    ageFromInput.addEventListener('input', debouncedSearch); // Age From filter
    ageToInput.addEventListener('input', debouncedSearch);     // Age To filter
    tagSearchInput.addEventListener('input', debouncedSearch);   // Tag filter


    function handleSearch() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        const ageFrom = parseInt(ageFromInput.value);
        const ageTo = parseInt(ageToInput.value);
        const tagSearchTerms = tagSearchInput.value.trim().toLowerCase().split(',').map(tag => tag.trim()).filter(tag => tag !== ''); // Split and trim tags

        const filteredUsers = allUsers.filter(user => {
            // Username filter (existing)
            const usernameMatch = searchTerm === '' || user.username.toLowerCase().includes(searchTerm);

            // Age filter (new)
            const ageMatch =
                (isNaN(ageFrom) || isNaN(ageTo)) || // No age range specified
                (isNaN(ageFrom) && user.age <= ageTo) || // Only ageTo specified
                (isNaN(ageTo) && user.age >= ageFrom) || // Only ageFrom specified
                (user.age >= ageFrom && user.age <= ageTo) || (user.age === 'N/A'); // Age range specified, include N/A

            // Tag filter (new) - Assuming user.tags is an array of strings
            const tagMatch = tagSearchTerms.length === 0 || tagSearchTerms.every(searchTag => {
                return user.tags.some(userTag => userTag.toLowerCase().includes(searchTag)); // Check if any user tag includes search tag
            });

            return usernameMatch && ageMatch && tagMatch; // Combine all filters
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
            userElement.className = "search-user-info";
            let tagsHtml = user.tags.length > 0 ? `<p>Tags: ${user.tags.join(', ')}</p>` : ''; // Display tags if available
            userElement.innerHTML = `
                <img src="${user.image_url}" alt="${user.username}" data-iframe-url="${user.iframe_embed}" data-username="${user.username}">
                <div class="user-details">
                    <p>Username: ${user.username}</p>
                    <p>Age: ${user.age || 'N/A'}</p>
                    ${tagsHtml}
                </div>
            `;
            userElement.addEventListener("click", function () {
                const usr = userElement.querySelector("img").dataset.username;

                mainIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;
                secondIframe.src = 'https://www.google.com/search?q=' + usr;

                // Add to previousUsers and update localStorage
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
                        location: detailsParagraphs[2].textContent.split(': ')[1],
                        tags: [] // Assuming tags are not updated in onlineUsersData refetch for now
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
                            age: age,
                            tags: [] // Assuming tags are not updated in previousUsersData refetch for now
                        };
                    });
                    selectedUser = previousUsersData.find(u => u.username === usr);
                }

                if (selectedUser) {
                    addToPreviousUsers(selectedUser);
                    displayPreviousUsers();
                }

                clearSearchResults();
                searchInput.value = '';
                ageFromInput.value = ''; // Clear ageFrom input
                ageToInput.value = '';     // Clear ageTo input
                tagSearchInput.value = '';   // Clear tag input
            });
            searchResultsContainer.appendChild(userElement);
        });
    }

    function clearSearchResults() {
        searchResultsContainer.innerHTML = "";
    }


    window.initializeAllUsers = initializeAllUsers;
    window.addToPreviousUsers = function(user) {
        console.warn("addToPreviousUsers needs to be defined in script.js");
    };
    window.displayPreviousUsers = function() {
        console.warn("displayPreviousUsers needs to be defined in script.js");
    };

    let scriptLoadedCheck = setInterval(() => {
        if (typeof initializeAllUsersFromScriptJS !== 'undefined') {
            clearInterval(scriptLoadedCheck);
            initializeAllUsersFromScriptJS(initializeAllUsers);
        }
    }, 100);

});
