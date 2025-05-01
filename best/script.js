document.addEventListener('DOMContentLoaded', async function () {
    /**
     * Utility class for wrappers and decorators.
     */
    class Utils {
        /**
         * Wrapper to add error handling to async functions.
         * @param {Function} func - The async function to wrap.
         */
        static asyncWrapper(func) {
            return async function (...args) {
                try {
                    return await func.apply(this, args);
                } catch (error) {
                    console.error("Error in function:", func.name, error);
                }
            };
        }

        /**
         * Decorator to log function execution time.
         * @param {Function} func - The function to decorate.
         */
        static executionTimeDecorator(func) {
            return function (...args) {
                const start = performance.now();
                const result = func.apply(this, args);
                const end = performance.now();
                console.log(`${func.name} executed in ${end - start}ms`);
                return result;
            };
        }

        /**
         * Generator to iterate over paginated API results.
         * @param {string} url - The base API URL.
         * @param {number} limit - The maximum number of items per page.
         */
        static async *apiPaginator(url, limit) {
            let offset = 0;
            let continueFetching = true;

            while (continueFetching) {
                const apiUrl = `${url}&limit=${limit}&offset=${offset}`;
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();

                if (data.results && data.results.length > 0) {
                    yield data.results;
                    offset += limit;
                    if (data.results.length < limit) continueFetching = false;
                } else {
                    continueFetching = false;
                }
            }
        }
    }

    /**
     * Main class for user management.
     */
    class UserManager {
        constructor() {
            this.onlineUsersDiv = document.getElementById("onlineUsers").querySelector('.user-list');
            this.previousUsersDiv = document.getElementById("previousUsers").querySelector('.user-list');
            this.mainIframe = document.getElementById("mainIframe");
            this.mainIframe2 = document.getElementById("mainIframe2");

            this.storageTypeSelector = document.getElementById("storageType");
            this.filterTagsSelect = document.getElementById("filterTags");
            this.filterAgeSelect = document.getElementById("filterAge");

            this.button18 = document.getElementById("filter18");
            this.buttonAsian = document.getElementById("filterAsian");
            this.buttonNew = document.getElementById("filterNew");

            this.storageType = this.storageTypeSelector.value;
            this.previousUsers = [];
            this.allOnlineUsersData = [];

            this.#initialize();
        }

        async #initialize() {
            this.previousUsers = await this.#loadUsers("previousUsers");
            await this.displayPreviousUsers();

            this.storageTypeSelector.addEventListener("change", Utils.asyncWrapper(async () => {
                this.storageType = this.storageTypeSelector.value;
                this.previousUsers = await this.#loadUsers("previousUsers");
                await this.displayPreviousUsers();
            }));

            this.button18.addEventListener("click", () => this.applyTagFilter("18"));
            this.buttonAsian.addEventListener("click", () => this.applyTagFilter("asian"));
            this.buttonNew.addEventListener("click", () => this.applyTagFilter("new"));

            await this.fetchData();
            setInterval(Utils.asyncWrapper(() => this.fetchData()), 300000);
        }

        /**
         * Fetches online user data using the generator for pagination.
         */
        async fetchData() {
            const apiBaseUrl = 'https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f';
            const limit = 500;

            this.allOnlineUsersData = []; // Reset data

            for await (const batch of Utils.apiPaginator(apiBaseUrl, limit)) {
                this.allOnlineUsersData = this.allOnlineUsersData.concat(batch);
            }

            this.populateFilters();
            this.displayOnlineUsers();
        }

        /**
         * Populates filters with tags and ages.
         */
        @Utils.executionTimeDecorator
        populateFilters() {
            const tagFrequency = {};
            const ages = new Set();

            this.allOnlineUsersData.forEach(user => {
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

            this.filterTagsSelect.innerHTML = sortedTags.map(tag => `<option value="${tag}">${tag}</option>`).join('');
            this.filterAgeSelect.innerHTML = Array.from(ages).map(age => `<option value="${age}">${age}</option>`).join('');
        }

        /**
         * Displays online users based on filters.
         */
        displayOnlineUsers() {
            const filterTags = Array.from(this.filterTagsSelect.selectedOptions).map(option => option.value);
            const filterAges = Array.from(this.filterAgeSelect.selectedOptions).map(option => parseInt(option.value));

            const filteredUsers = this.allOnlineUsersData.filter(user => {
                const isPublic = user.current_show === 'public';
                const hasTags = filterTags.length === 0 || filterTags.some(tag => user.tags.includes(tag));
                const isAgeMatch = filterAges.length === 0 || filterAges.includes(user.age);
                return isPublic && hasTags && isAgeMatch;
            });

            this.onlineUsersDiv.innerHTML = "";
            if (filteredUsers.length === 0) {
                this.onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
                return;
            }

            filteredUsers.forEach(user => {
                const userElement = this.#createUserElement(user);
                this.onlineUsersDiv.appendChild(userElement);
            });
        }

        /**
         * Creates a DOM element for a user.
         * @param {Object} user - The user object.
         */
        #createUserElement(user) {
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

            userElement.addEventListener("click", () => this.#handleUserClick(user));
            return userElement;
        }

        /**
         * Handles user click to update iframe.
         * @param {Object} user - The user object.
         */
        #handleUserClick(user) {
            const iframeChoice = document.querySelector('input[name="iframeChoice"]:checked').value;
            const selectedIframe = iframeChoice === 'mainIframe2' ? this.mainIframe2 : this.mainIframe;
            selectedIframe.src = `https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=${user.username}`;
        }

        /**
         * Loads users from storage.
         * @param {string} key - The storage key.
         */
        async #loadUsers(key) {
            const storage = this.storageType === "local" ? localStorage : sessionStorage;
            const storedUsers = storage.getItem(key);
            return storedUsers ? JSON.parse(storedUsers) : [];
        }
    }

    // Initialize the user manager
    new UserManager();
});
