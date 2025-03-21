if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/serviceWorker.js')
        .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
        }).catch(error => {
            console.error('Service Worker registration failed:', error);
        });
}

document.addEventListener('DOMContentLoaded', async function() {
    class User {
        #username;
        #imageUrl;
        #iframeUrl;
        #age;
        #tags;
        #birthday;
        #isNew;
        #currentShow;

        constructor({ username, image_url, iframe_embed, age, tags, birthday, is_new, current_show }) {
            this.#username = username;
            this.#imageUrl = image_url;
            this.#iframeUrl = iframe_embed;
            this.#age = age;
            this.#tags = tags;
            this.#birthday = birthday;
            this.#isNew = is_new;
            this.#currentShow = current_show;
        }

        get username() {
            return this.#username;
        }

        get imageUrl() {
            return this.#imageUrl;
        }

        get iframeUrl() {
            return this.#iframeUrl;
        }

        get age() {
            return this.#age;
        }

        get tags() {
            return this.#tags;
        }

        get birthday() {
            return this.#birthday;
        }

        get isNew() {
            return this.#isNew;
        }

        get currentShow() {
            return this.#currentShow;
        }

        isBirthday() {
            if (!this.#birthday) return false;
            const today = new Date();
            const birthDate = new Date(this.#birthday);
            return today.getDate() === birthDate.getDate() && today.getMonth() === birthDate.getMonth();
        }

        toHTML() {
            return `
                <div class="user-info">
                    <img src="${this.#imageUrl}" alt="${this.#username}" data-iframe-url="${this.#iframeUrl}" data-username="${this.#username}">
                    <div class="user-details">
                        <p>Username: ${this.#username}</p>
                        <p>Age: ${this.#age || 'N/A'} ${this.#isNew ? 'New' : ''}</p>
                        <p>Tags: ${this.#tags.join(', ')}</p>
                        ${this.isBirthday() ? `<p>Happy Birthday!</p>` : ''}
                    </div>
                </div>
            `;
        }
    }

    class UserManager {
        #users;
        #storageType;

        constructor(storageType = 'local') {
            this.#storageType = storageType;
            this.#users = new Set();
        }

        addUser(user) {
            this.#users.add(user);
        }

        removeUser(username) {
            this.#users = new Set([...this.#users].filter(user => user.username !== username));
        }

        get allUsers() {
            return [...this.#users];
        }

        get filteredUsers() {
            const filterTags = Array.from(document.getElementById("filterTags").selectedOptions).map(option => option.value);
            const filterAges = Array.from(document.getElementById("filterAge").selectedOptions).map(option => parseInt(option.value));

            return this.allUsers.filter(user => {
                const isPublic = user.currentShow === 'public';
                const hasTags = filterTags.length === 0 || filterTags.some(tag => user.tags.includes(tag));
                const isAgeMatch = filterAges.length === 0 || filterAges.includes(user.age);
                return isPublic && hasTags && isAgeMatch;
            });
        }

        saveUsers(key) {
            const storage = this.#storageType === "local" ? localStorage : sessionStorage;
            storage.setItem(key, JSON.stringify([...this.#users]));
        }

        loadUsers(key) {
            const storage = this.#storageType === "local" ? localStorage : sessionStorage;
            const storedUsers = storage.getItem(key);
            this.#users = storedUsers ? new Set(JSON.parse(storedUsers).map(user => new User(user))) : new Set();
        }
    }

    class UserDisplay {
        #onlineUsersDiv;
        #previousUsersDiv;
        #mainIframe;
        #mainIframe2;
        #userManager;

        constructor(onlineUsersDiv, previousUsersDiv, mainIframe, mainIframe2, userManager) {
            this.#onlineUsersDiv = onlineUsersDiv;
            this.#previousUsersDiv = previousUsersDiv;
            this.#mainIframe = mainIframe;
            this.#mainIframe2 = mainIframe2;
            this.#userManager = userManager;
        }

        displayOnlineUsers() {
            this.#onlineUsersDiv.innerHTML = "";
            const filteredUsers = this.#userManager.filteredUsers;

            if (filteredUsers.length === 0) {
                this.#onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
                return;
            }

            filteredUsers.forEach(user => {
                const userElement = document.createElement("div");
                userElement.innerHTML = user.toHTML();
                userElement.querySelector("img").addEventListener("click", (event) => this.#handleUserClick(event, user));
                this.#onlineUsersDiv.appendChild(userElement);
            });
        }

        displayPreviousUsers() {
            this.#previousUsersDiv.innerHTML = "";
            const previousUsers = this.#userManager.allUsers.filter(user => user.currentShow === 'public');

            if (previousUsers.length === 0) {
                this.#previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No previous users yet.</p>';
                return;
            }

            previousUsers.forEach(user => {
                const userElement = document.createElement("div");
                userElement.innerHTML = user.toHTML();
                userElement.querySelector("img").addEventListener("click", (event) => this.#handleUserClick(event, user));
                this.#previousUsersDiv.appendChild(userElement);
            });
        }

        #handleUserClick(event, user) {
            event.preventDefault();
            const usr = user.username;
            const iframeChoice = document.querySelector('input[name="iframeChoice"]:checked').value;
            let selectedIframe;

            if (iframeChoice === 'mainIframe2') {
                selectedIframe = this.#mainIframe2;
            } else {
                selectedIframe = this.#mainIframe;
            }

            selectedIframe.src = 'https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=' + usr;
            this.#userManager.addUser(user);
            this.#userManager.saveUsers("previousUsers");
        }
    }

    class App {
        #userManager;
        #userDisplay;

        constructor() {
            this.#userManager = new UserManager();
            this.#userDisplay = new UserDisplay(
                document.getElementById("onlineUsers").querySelector('.user-list'),
                document.getElementById("previousUsers").querySelector('.user-list'),
                document.getElementById("mainIframe"),
                document.getElementById("mainIframe2"),
                this.#userManager
            );
        }

        async init() {
            this.#userManager.loadUsers("previousUsers");
            this.#userDisplay.displayPreviousUsers();
            await this.fetchData();
            await this.monitorContentWindow(document.getElementById("mainIframe"));
            await this.monitorContentWindow(document.getElementById("mainIframe2"));
            setInterval(async () => {
                this.#userManager = new UserManager();
                await this.fetchData();
            }, 60000);
        }

        async fetchData() {
            if (navigator.serviceWorker.controller) {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    if (event.data && event.data.data) {
                        event.data.data.forEach(userData => {
                            const user = new User(userData);
                            this.#userManager.addUser(user);
                        });
                        this.#userDisplay.displayOnlineUsers();
                    }
                };

                navigator.serviceWorker.controller.postMessage({ type: 'FETCH_USERS' }, [messageChannel.port2]);
            } else {
                console.error("Service Worker controller not found.");
            }
        }

        async monitorContentWindow(iframe) {
            const onIframeLoad = async () => {
                try {
                    const contentWindow = iframe.contentWindow;
                    if (contentWindow) {
                        contentWindow.document.addEventListener("click", async (event) => {
                            const target = event.target;
                            if (target && target.matches(".user-info img")) {
                                const username = target.dataset.username;
                                const user = this.#userManager.allUsers.find(u => u.username === username);
                                if (user) {
                                    await this.#userManager.addUser(user);
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.error("Error monitoring content window:", error);
                }
            };

            iframe.addEventListener('load', onIframeLoad);
        }
    }

    const app = new App();
    await app.init();
});
