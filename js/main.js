// main.js - Entry point for the Showcase application

// IIFE to encapsulate the main logic and avoid polluting the global scope
(async () => {
    /**
     * A simple decorator (as a higher-order function) for logging method calls.
     * @param {Function} fn - The original function.
     * @param {string} name - The name of the function to log.
     * @returns {Function} - The decorated function.
     */
    const logMethod = (fn, name) => {
        return (...args) => {
            console.log(`Calling method: ${name}`);
            return fn(...args);
        };
    };

    /**
     * Represents the main application controller.
     * This class demonstrates OOP, async/await, and interaction with other modules.
     */
    class AppController {
        #dataUrl = 'assets/data.json'; // Private member

        constructor() {
            this.cache = new CacheService('ShowcaseDB', 1);
            this.ui = new UIManager('data-container');
            this.animationCtrl = new AnimationController('.data-card');
        }

        // Using a decorator to log the method call
        init = logMethod(async () => {
            document.getElementById('start-animation-btn').addEventListener('click', () => this.animationCtrl.start());
            document.getElementById('stop-animation-btn').addEventListener('click', () => this.animationCtrl.stop());

            try {
                let data = await this.cache.getData('concepts');
                if (!data) {
                    console.log('Fetching fresh data...');
                    const response = await fetch(this.#dataUrl);
                    const rawData = await response.json();
                    data = rawData.map(DataMapper.toConcept);
                    await this.cache.setData('concepts', data);
                } else {
                    console.log('Data loaded from cache.');
                }

                this.ui.render(data);
                this.animationCtrl.start();
                this.loadCommitInfo(); // Fetch and display commit info
            } catch (error) {
                console.error('Failed to initialize application:', error);
                this.ui.showError('Failed to load data.');
            }
        }, 'AppController.init');

        async loadCommitInfo() {
            try {
                const response = await fetch('assets/commit-info.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const commitInfo = await response.json();
                this.ui.renderCommitInfo(commitInfo);
            } catch (error) {
                console.error('Could not load commit info:', error);
                this.ui.showCommitInfoError('Could not load commit information.');
            }
        }
    }

    // --- DataMapper: Demonstrates object mapping and bitwise operations ---
    class DataMapper {
        static FEATURE_FLAGS = {
            OOP: 1,       // 0001
            ASYNC: 2,     // 0010
            CACHE: 4,     // 0100
            ANIMATION: 8, // 1000
        };

        /**
         * @typedef {object} IConcept
         * @property {number} id
         * @property {string} name
         * @property {string} description
         * @property {string[]} features
         */

        /**
         * Maps raw data to a Concept object.
         * @param {object} rawData - The raw data object.
         * @returns {IConcept} - The mapped concept object.
         */
        static toConcept(rawData) {
            const features = [];
            for (const key in this.FEATURE_FLAGS) {
                if (rawData.features & this.FEATURE_FLAGS[key]) {
                    features.push(key);
                }
            }
            return { ...rawData, features };
        }
    }

    // --- UIManager: Handles DOM manipulation ---
    class UIManager {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
        }

        /**
         * Renders an array of concepts to the DOM.
         * @param {IConcept[]} concepts - The concepts to render.
         */
        render(concepts) {
            this.container.innerHTML = '';
            for (const concept of this.conceptIterator(concepts)) {
                this.container.appendChild(this.createCard(concept));
            }
        }

        /**
         * A generator function to iterate over concepts.
         * @param {IConcept[]} concepts
         */
        *conceptIterator(concepts) {
            for (const concept of concepts) {
                yield concept;
            }
        }

        createCard(concept) {
            const card = document.createElement('div');
            card.className = 'col-md-4 data-card';
            card.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">${concept.name}</h5>
                    <p class="card-text">${concept.description}</p>
                    <p class="card-text"><small class="text-muted">Features: ${concept.features.join(', ')}</small></p>
                </div>`;
            return card;
        }

        showError(message) {
            this.container.innerHTML = `<div class="alert alert-danger">${message}</div>`;
        }

        renderCommitInfo(commitInfo) {
            const container = document.getElementById('commit-info-container');
            container.innerHTML = `
                <p><strong>Commit:</strong> ${commitInfo.sha}</p>
                <p><strong>Author:</strong> ${commitInfo.author}</p>
                <p><strong>Date:</strong> ${commitInfo.date}</p>
                <p><strong>Message:</strong></p>
                <pre>${commitInfo.message}</pre>
                <p><strong>Modified Directories:</strong></p>
                <ul>
                    ${commitInfo.directories.map(dir => `<li>${dir}</li>`).join('')}
                </ul>
            `;
        }

        showCommitInfoError(message) {
            const container = document.getElementById('commit-info-container');
            container.innerHTML = `<div class="alert alert-warning">${message}</div>`;
        }
    }

    // --- CacheService: A wrapper for IndexedDB ---
    class CacheService {
        #dbName;
        #dbVersion;
        #db = null;

        constructor(dbName, dbVersion) {
            this.#dbName = dbName;
            this.#dbVersion = dbVersion;
        }

        async #getDB() {
            if (this.#db) return this.#db;
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.#dbName, this.#dbVersion);
                request.onerror = () => reject("Error opening DB.");
                request.onsuccess = (event) => {
                    this.#db = event.target.result;
                    resolve(this.#db);
                };
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    db.createObjectStore('concepts', { keyPath: 'id' });
                };
            });
        }

        async setData(storeName, data) {
            const db = await this.#getDB();
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            data.forEach(item => store.put(item));
            return new Promise((resolve) => {
                transaction.oncomplete = () => resolve();
            });
        }

        async getData(storeName) {
            const db = await this.#getDB();
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result.length > 0 ? request.result : null);
            });
        }
    }

    // --- AnimationController: Manages CSS animations ---
    class AnimationController {
        #elements;
        #intervalId = null;

        constructor(selector) {
            this.#elements = document.querySelectorAll(selector);
        }

        start() {
            if (this.#intervalId) return;
            this.#elements.forEach(el => el.classList.add('animated'));
            this.#intervalId = setInterval(() => {
                this.#elements.forEach(el => {
                    el.classList.remove('animated');
                    // Reflow hack to restart animation
                    void el.offsetWidth;
                    el.classList.add('animated');
                });
            }, 3000);
        }

        stop() {
            clearInterval(this.#intervalId);
            this.#intervalId = null;
            this.#elements.forEach(el => el.classList.remove('animated'));
        }
    }

    // Initialize the application
    const app = new AppController();
    app.init();

})();
