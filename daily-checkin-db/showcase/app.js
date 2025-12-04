(function() {
    'use strict';

    // IIFE for private scope

    // --- DECORATOR ---
    // A simple decorator function (higher-order function) for logging.
    function withLogging(fn) {
        return function(...args) {
            console.log(`Calling function: ${fn.name}`);
            const result = fn.apply(this, args);
            console.log(`Function ${fn.name} finished.`);
            return result;
        };
    }

    // --- INTERFACES/STRUCTS (simulated with JSDoc) ---
    /**
     * @typedef {object} UserData
     * @property {number} id
     * @property {string} name
     * @property {string} checkinDate
     * @property {number} permissions
     */

    // --- CACHE MANAGER (IndexedDB) ---
    class CacheManager {
        static #DB_NAME = 'DailyCheckinDB';
        static #STORE_NAME = 'checkins';
        static #VERSION = 1;
        #db;

        constructor() {
            this.#db = null;
        }

        async init() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(CacheManager.#DB_NAME, CacheManager.#VERSION);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(CacheManager.#STORE_NAME)) {
                        db.createObjectStore(CacheManager.#STORE_NAME, { keyPath: 'id' });
                    }
                };
                request.onsuccess = (event) => {
                    this.#db = event.target.result;
                    resolve();
                };
                request.onerror = (event) => {
                    console.error('IndexedDB error:', event.target.errorCode);
                    reject(event.target.errorCode);
                };
            });
        }

        async saveData(data) {
            return new Promise((resolve, reject) => {
                const transaction = this.#db.transaction([CacheManager.#STORE_NAME], 'readwrite');
                const store = transaction.objectStore(CacheManager.#STORE_NAME);
                const request = store.put(data);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.errorCode);
            });
        }

        async getData(id) {
            return new Promise((resolve, reject) => {
                const transaction = this.#db.transaction([CacheManager.#STORE_NAME], 'readonly');
                const store = transaction.objectStore(CacheManager.#STORE_NAME);
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.errorCode);
            });
        }
    }

    // --- FIREBASE MANAGER (Simulated) ---
    class FirebaseManager {
        #initialized = false;

        constructor() {
            console.log('FirebaseManager: Constructor called.');
            if (typeof firebase === 'undefined') {
                console.warn('Firebase SDK not loaded. Running in simulated mode.');
            }
        }

        init() {
            console.log('FirebaseManager: Initializing...');
            return new Promise(resolve => {
                setTimeout(() => {
                    this.#initialized = true;
                    console.log('FirebaseManager: Initialized successfully.');
                    resolve();
                }, 500);
            });
        }

        async saveData(collection, data) {
            if (!this.#initialized) {
                console.error('FirebaseManager: Not initialized.');
                return;
            }
            console.log(`FirebaseManager: Simulating saving data to collection '${collection}'...`);
            console.log(data);
            return Promise.resolve();
        }
    }


    // --- DATA MANAGER ---
    class DataManager {
        #rawData;

        constructor() {
            this.#rawData = [];
        }

        async fetchData(url) {
            try {
                // In a real scenario, this would fetch and unzip a .dat file.
                // For this showcase, we'll simulate the data.
                console.log(`Fetching data from ${url}...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
                this.#rawData = [
                    { 'user_id': 1, 'username': 'Alice', 'checkin_ts': 1672531200, 'perms': 5 },
                    { 'user_id': 2, 'username': 'Bob', 'checkin_ts': 1672617600, 'perms': 1 }
                ];
                 return this.#rawData;
            } catch (error) {
                console.error('Failed to fetch data:', error);
                return [];
            }
        }

        // --- OBJECT MAPPING ---
        _mapRawData(rawDataItem) {
            /** @type {UserData} */
            const mappedData = {
                id: rawDataItem.user_id,
                name: rawDataItem.username,
                checkinDate: new Date(rawDataItem.checkin_ts * 1000).toLocaleDateString(),
                permissions: rawDataItem.perms
            };
            return mappedData;
        }

        // --- GENERATOR ---
        *getProcessedData() {
            for (const item of this.#rawData) {
                yield this._mapRawData(item);
            }
        }
    }

    // --- BITWISE OPERATIONS for PERMISSIONS ---
    const Permissions = {
        READ: 1,    // 001
        WRITE: 2,   // 010
        DELETE: 4,  // 100
        ADMIN: 8    // 1000
    };


    // --- UI MANAGER ---
    class UIManager {
        constructor() {
            this.dataOutput = document.getElementById('data-output');
            this.toggleAnimationBtn = document.getElementById('toggleAnimation');
            this.animatedSvg = document.querySelector('.animated-svg');
        }

        displayData(dataIterator, onDataDisplayed) {
            this.dataOutput.innerHTML = '';
            for (const user of dataIterator) {
                const hasWriteAccess = (user.permissions & Permissions.WRITE) > 0;
                const element = document.createElement('div');
                element.className = 'w3-panel w3-border';
                element.innerHTML = `
                    <p><strong>User:</strong> ${user.name}</p>
                    <p><strong>Check-in:</strong> ${user.checkinDate}</p>
                    <p><strong>Can Write:</strong> ${hasWriteAccess}</p>
                `;
                this.dataOutput.appendChild(element);
            }
            if (onDataDisplayed) {
                onDataDisplayed(); // --- HOOKS/CALLBACKS ---
            }
        }

        initAnimationToggle() {
            const toggle = () => this.animatedSvg.classList.toggle('rotating');
            const decoratedToggle = withLogging(toggle);
            this.toggleAnimationBtn.addEventListener('click', decoratedToggle);
        }
    }


    // --- APP INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', async () => {
        const uiManager = new UIManager();
        const dataManager = new DataManager();
        const cacheManager = new CacheManager();
        const firebaseManager = new FirebaseManager();

        uiManager.initAnimationToggle();

        try {
            await cacheManager.init();
            await firebaseManager.init();

            // Check cache first
            let cachedData = await cacheManager.getData(1);
            if (cachedData) {
                console.log('Loading data from cache...');
                 uiManager.displayData([cachedData].values());
            } else {
                 console.log('Fetching new data...');
                // Fetch, process, and display data
                await dataManager.fetchData('/daily-checkin-db/showcase/data/sample.dat');
                const dataIterator = dataManager.getProcessedData();
                uiManager.displayData(dataIterator, () => {
                     console.log('Data display complete.');
                });

                // Save to cache and Firebase
                const firstRecord = dataManager.getProcessedData().next().value;
                if(firstRecord) {
                    await cacheManager.saveData(firstRecord);
                    console.log('Saved first record to cache.');
                    await firebaseManager.saveData('checkins', firstRecord);
                }
            }
        } catch (error) {
            console.error('App initialization failed:', error);
            uiManager.dataOutput.innerHTML = '<p class="w3-text-red">Failed to load data.</p>';
        }
    });

})();
