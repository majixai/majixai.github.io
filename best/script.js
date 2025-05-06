/**
 * Room Viewer Application Script
 * Handles fetching, filtering, displaying online users (as images or iframes)
 * with image recognition results, managing viewing history (previous users),
 * storing and managing text messages with search/autocomplete, sending reports,
 * adding auto-scrolling for the online user list, and dynamic main iframe layout/sizing.
 * Uses W3.CSS, jQuery, jQuery UI, and TensorFlow.js via CDNs.
 */
document.addEventListener('DOMContentLoaded', async function() {

    console.log("DOM fully loaded. Initializing application...");

    // --- Configuration ---
    // !! IMPORTANT !! Configure your report sending method !!
    // 'placeholder-client-service': Placeholder/Example for using a client-side service like EmailJS (requires their SDK/CDN)
    // 'mailto': Basic mailto link (limited, insecure for large/sensitive data)
    // A secure backend endpoint is the recommended professional approach.
    const REPORT_SEND_METHOD = 'placeholder-client-service'; // <-- CONFIGURE THIS

    // If using 'placeholder-client-service' with EmailJS (requires EmailJS SDK CDN in HTML and init)
    // const EMAILJS_SERVICE_ID = 'YOUR_EMAILJS_SERVICE_ID'; // Replace with your service ID
    // const EMAILJS_TEMPLATE_ID = 'YOUR_EMAILJS_TEMPLATE_ID'; // Replace with your template ID
    // const EMAILJS_PUBLIC_KEY = 'YOUR_EMAILJS_PUBLIC_KEY'; // Replace with your public key (or init via script tag)


    // --- Config for Auto-Scrolling ---
    const AUTO_SCROLL_SPEED = 1; // Pixels to scroll per animation frame (adjust for speed)
    const AUTO_SCROLL_DELAY_AT_END = 1000; // Milliseconds to pause at the end before restarting (optional)

    // --- Config for Iframe Display Mode (in online list) ---
    const LIST_IFRAME_BASE_URL = 'https://chaturbate.com/embed/';
    const LIST_IFRAME_PARAMS = '?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black&aspect=0.5625';

    // --- Config for Main Viewer Iframes ---
    const MAIN_IFRAME_BASE_URL = 'https://chaturbate.com/embed/'; // Or 'fullvideo'
    const MAIN_IFRAME_PARAMS = '?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black';

    // Define possible size classes for the main iframe column (corresponds to w3-col l classes)
    const IFRAME_SIZE_CLASSES = ['l6', 'l8', 'l9']; // 50%, 66.66%, 75% of parent row

    // --- Config for Search/Autocomplete ---
    const AUTOCOMPLETE_MIN_LENGTH = 2; // Minimum characters before showing suggestions
    const AUTOCOMPLETE_DELAY = 300; // Delay in ms after typing stops before searching
    const AUTOCOMPLETE_MAX_SUGGESTIONS = 10; // Max number of suggestions to show

    // --- Config for Image Recognition ---
    let mobilenetModel = null; // To hold the loaded ML model
    const IMAGE_RECOGNITION_CONFIDENCE_THRESHOLD = 0.2; // Minimum confidence to display a result
    const IMAGE_RECOGNITION_MAX_RESULTS = 3; // Max number of results to display per image
    let analysisQueue = []; // Queue for images to be analyzed
    let isAnalyzing = false; // Flag to prevent multiple analysis processes running
    const ANALYSIS_DELAY = 50; // Delay between analyzing images (ms) to avoid blocking UI


    // --- DOM References ---
    const onlineUsersDiv = document.getElementById("onlineUsers")?.querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers")?.querySelector('.user-list');

    // Main Viewer DOM Refs
    const mainViewerContainer = document.getElementById("mainViewerContainer");
    const iframeWrapper1 = document.getElementById("iframeWrapper1");
    const mainIframe = document.getElementById("mainIframe"); // Viewport 1
    const iframeWrapper2 = document.getElementById("iframeWrapper2");
    const mainIframe2 = document.getElementById("mainIframe2"); // Viewport 2
    const iframeWrapper3 = document.getElementById("iframeWrapper3");
    const mainIframe3 = document.getElementById("mainIframe3"); // Viewport 3
    const iframeWrapper4 = document.getElementById("iframeWrapper4");
    const mainIframe4 = document.getElementById("mainIframe4"); // Viewport 4
    const mainIframes = [mainIframe, mainIframe2, mainIframe3, mainIframe4]; // Array for easy access
    const iframeWrappers = [iframeWrapper1, iframeWrapper2, iframeWrapper3, iframeWrapper4]; // Array for easy access
    const mainIframeColumn = document.querySelector('.iframe-column'); // The parent column

    // Filter DOM Refs
    const storageTypeSelector = document.getElementById("storageType");
    const filterTagsSelect = document.getElementById("filterTags");
    const filterAgeSelect = document.getElementById("filterAge");

    // Reporting DOM Refs
    const sendReportButton = document.getElementById("sendReportButton");
    const reportLoadingIndicator = document.getElementById("reportLoadingIndicator");
    const reportStatusDisplay = document.getElementById("reportStatusDisplay");

    // Online List Loading/Error DOM Refs
    const onlineLoadingIndicator = document.getElementById("onlineLoadingIndicator");
    const onlineErrorDisplay = document.getElementById("onlineErrorDisplay");
    const recognitionStatusDisplay = document.getElementById("recognitionStatus"); // NEW

    // Buttons
    const toggleAutoScrollButton = document.getElementById("toggleAutoScroll");
    const toggleDisplayModeButton = document.getElementById("toggleDisplayMode");
    const toggleIframeCountButton = document.getElementById("toggleIframeCount");
    const increaseIframeSizeButton = document.getElementById("increaseIframeSize");
    const decreaseIframeSizeButton = document.getElementById("decreaseIframeSize");

    // Search DOM Refs
    const userSearchInput = document.getElementById("userSearchInput"); // User search
    const messageSearchInput = document.getElementById("messageSearchInput"); // NEW Message search

    // Messaging DOM Refs
    const messageInput = document.getElementById("messageInput"); // NEW
    const saveMessageButton = document.getElementById("saveMessageButton"); // NEW
    const messageListDiv = document.getElementById("messageList"); // NEW
    const messageStatusDisplay = document.getElementById("messageStatusDisplay"); // NEW

    // Collapsible Section Headers (for toggling)
    const filterSectionHeader = document.querySelector('h4[onclick="toggleSection(\'filters\')"]');
    const displaySectionHeader = document.querySelector('h4[onclick="toggleSection(\'display\')"]');
    const viewerSectionHeader = document.querySelector('h4[onclick="toggleSection(\'viewer\')"]');
    const messagingSectionHeader = document.querySelector('h4[onclick="toggleSection(\'messaging\')"]'); // NEW
    const reportingSectionHeader = document.querySelector('h4[onclick="toggleSection(\'reporting\')"]');


    // --- State Variables ---
    let storageType = storageTypeSelector?.value || 'local';
    let previousUsers = [];
    let allOnlineUsersData = []; // The full list fetched from the API
    let lastFilteredUsers = []; // The list currently displayed in the online section (after all filtering/search)
    let fetchInterval = null;

    // Auto-Scrolling State
    let isAutoScrolling = false;
    let autoScrollAnimationFrameId = null;
    let autoScrollTimeoutId = null;

    // Display Mode State (online list)
    let displayMode = 'image'; // 'image' or 'iframe'

    // Main Viewer Iframe State
    let iframeCount = 2; // Currently active iframes (2 or 4)
    let iframeSizeIndex = 0; // Index into IFRAME_SIZE_CLASSES (0=l6, 1=l8, 2=l9)

    // Search State
    let currentUserSearchTerm = ''; // For online user search
    let currentMessageSearchTerm = ''; // NEW For message search

    // Messaging State
    let savedMessages = []; // NEW Array to hold loaded messages


    // --- Helper Functions ---

    /**
     * Checks if a user's birthday string (e.g., "YYYY-MM-DD") corresponds to today's date.
     * @param {string | null | undefined} birthday - The birthday string.
     * @returns {boolean} True if it's the user's birthday today, false otherwise.
     */
    function isBirthday(birthday) {
        if (!birthday || typeof birthday !== 'string') return false;
        try {
            const today = new Date();
            const parts = birthday.split('-');
            if (parts.length !== 3) return false;
            const birthDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
            if (isNaN(birthDate.getTime())) {
                 console.warn("Invalid date encountered in isBirthday:", birthday);
                 return false;
            }
            return today.getUTCDate() === birthDate.getUTCDate() && today.getUTCMonth() === birthDate.getUTCMonth();
        } catch (e) {
             console.error("Error checking birthday for:", birthday, e);
             return false;
        }
    }

    /**
     * Calculates the number of days between two dates (UTC).
     * @param {Date} date1
     * @param {Date} date2
     * @returns {number} The difference in days (always positive).
     */
    function dateDifferenceInDays(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
        const diffMs = Math.abs(date1.getTime() - date2.getTime());
        return Math.round(diffMs / oneDay);
    }


    /**
     * Calculates the number of days from their previous birthday if the user's age is exactly 18.
     * Attempts to handle leap years/date differences.
     * @param {string | null | undefined} birthdayString - The birthday string (YYYY-MM-DD).
     * @param {number | null | undefined} age - The user's current age as reported by API.
     * @returns {number | null} Number of days since the most recent birthday that resulted in age 18, or null.
     */
    function getDaysSinceLastBirthday(birthdayString, age) {
        if (!birthdayString || typeof birthdayString !== 'string' || age !== 18) {
            return null;
        }

        try {
            const today = new Date();
            const parts = birthdayString.split('-');
             if (parts.length !== 3) return null;

            const birthMonth = parseInt(parts[1]) - 1; // 0-indexed month
            const birthDay = parseInt(parts[2]);

             // Get the user's birthday date *this year*
             const thisYearBday = new Date(Date.UTC(today.getUTCFullYear(), birthMonth, birthDay));

             let relevantBirthday;
             // If today's date (UTC) is on or after their birthday date this year (UTC)
             if (today.getUTCMonth() > thisYearBday.getUTCMonth() || (today.getUTCMonth() === thisYearBday.getUTCMonth() && today.getUTCDate() >= thisYearBday.getUTCDate())) {
                 relevantBirthday = thisYearBday; // The most recent birthday was this year
             } else {
                 relevantBirthday = new Date(Date.UTC(today.getUTCFullYear() - 1, birthMonth, birthDay)); // The most recent birthday was last year
             }

             // Sanity check: Verify that the year of the relevant birthday aligns with age 18 today.
             // A simple check: did they turn 18 on this relevant birthday?
             const ageAtRelevantBdayYear = today.getUTCFullYear() - relevantBirthday.getUTCFullYear();

             // The API age (18) might be calculated slightly differently (e.g. based on local time, or just year diff)
             // Trust the API age (18) and calculate days since the *most recent* birthday date, assuming that's their 18th one.
             // If the API reports 18, the most recent birthday was either their 18th (if it already passed this year)
             // or their 17th (if it hasn't passed this year, but they will turn 18 this year).
             // We want days *since they turned 18*. So we need the date of their 18th birthday.

             const ageOnDate = (date) => {
                 const bday = new Date(Date.UTC(parseInt(parts[0]), birthMonth, birthDay));
                 let age = date.getUTCFullYear() - bday.getUTCFullYear();
                 // Adjust age if the birthday hasn't happened yet this year
                 if (date.getUTCMonth() < bday.getUTCMonth() || (date.getUTCMonth() === bday.getUTCMonth() && date.getUTCDate() < bday.getUTCDate())) {
                     age--;
                 }
                 return age;
             };

             let eighteenthBirthdayYear = today.getUTCFullYear() - 18;
             let eighteenthBirthday = new Date(Date.UTC(eighteenthBirthdayYear, birthMonth, birthDay));

             // Check if they were 18 *on* today's date according to the API.
             // This is the tricky part without knowing the API's exact age calculation.
             // Assuming the API age is based on a simple year difference or similar,
             // and we want days since their *literal* 18th birthday:

             // Method: Find the date they turned 18.
             let dateOf18thBirthday = new Date(Date.UTC(today.getUTCFullYear() - 18, birthMonth, birthDay));

             // If their 18th birthday hasn't happened *this year* yet,
             // and the API says they are 18, this is likely an edge case or their age calculation is year-based.
             // Let's trust the API age (18) and calculate days since the *most recent* birthday date.
             // If API says 18 and today is *before* this year's birthday, they turned 17 last birthday.
             // If API says 18 and today is *on or after* this year's birthday, they turned 18 this birthday.
             // This seems wrong. The API age should correspond to their *current* age.
             // If the API says AGE is 18, it means they are between their 18th and 19th birthday.

             // Correct approach given API gives AGE=18:
             // Find their 18th birthday date: original year + 18 years.
             const actualBirthYear = parseInt(parts[0]);
             const dateOf18thBday = new Date(Date.UTC(actualBirthYear + 18, birthMonth, birthDay));

             // If their 18th birthday is *in the future* relative to today,
             // then the API reporting their age as 18 is inconsistent with standard age calculation.
             // We cannot calculate days *since* their 18th birthday if it hasn't happened yet.
             if (dateOf18thBday > today) {
                  console.warn(`User ${user.username} (Birth: ${birthdayString}, API Age: ${age}) 18th birthday is in the future (${dateOf18thBday.toISOString().split('T')[0]}). Cannot calculate days since 18th birthday.`);
                 return null; // 18th birthday hasn't happened yet
             }

             // If their 19th birthday has *already happened* relative to today,
             // then the API reporting their age as 18 is inconsistent.
             const dateOf19thBday = new Date(Date.UTC(actualBirthYear + 19, birthMonth, birthDay));
             if (dateOf19thBday <= today) {
                  console.warn(`User ${user.username} (Birth: ${birthdayString}, API Age: ${age}) 19th birthday has passed (${dateOf19thBday.toISOString().split('T')[0]}). API age 18 is inconsistent.`);
                 return null; // They are already 19 or older
             }

             // If their 18th birthday has happened, and their 19th birthday has not,
             // they are indeed 18. Calculate days since their 18th birthday.
             return dateDifferenceInDays(today, dateOf18thBday);


        } catch (e) {
             console.error("Error calculating days since last birthday for:", birthdayString, e);
             return null;
        }
    }


    // --- Storage Functions (Modified for Messages) ---

    /**
     * Opens the IndexedDB database. Creates/upgrades the object stores if needed.
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance or rejects on error.
     */
    function openIndexedDB() {
        return new Promise((resolve, reject) => {
             if (!('indexedDB' in window)) {
                 console.warn("IndexedDB not supported by this browser.");
                 reject(new Error("IndexedDB not supported."));
                 return;
             }
            const request = indexedDB.open('UserDatabase', 2); // Increment version for upgrade

            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                 console.log("IndexedDB upgrade needed or creating database. Old version:", event.oldVersion, "New version:", event.newVersion);

                 // Create 'users' store if it doesn't exist (from v1)
                 if (!db.objectStoreNames.contains('users')) {
                      db.createObjectStore('users', { keyPath: 'key' }); // Stores key-value pairs like previousUsers
                     console.log("Created object store: 'users'");
                 }

                 // NEW: Create 'messages' store (from v2)
                 if (!db.objectStoreNames.contains('messages')) {
                     // Use 'id' as keyPath, autoIncrement true for unique IDs
                      const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
                     // Create an index for searching message text (case-insensitive search is harder, but this helps)
                     messageStore.createIndex('text', 'text', { unique: false });
                     console.log("Created object store: 'messages' with 'text' index.");
                 } else {
                     console.log("Object store 'messages' already exists.");
                 }

                // Handle migrations if adding more versions later
                 // Example for v3:
                 // if (event.oldVersion < 3) { ... create new store or index ... }
            };

            request.onsuccess = function(event) {
                const db = event.target.result;
                 db.onerror = (errEvent) => console.error("IndexedDB Database Error:", errEvent.target.error);
                resolve(db);
            };

            request.onerror = function(event) {
                console.error("IndexedDB Open Error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Loads data for a specific key from the IndexedDB 'users' store.
     * @param {string} key - The key to retrieve (e.g., 'previousUsers').
     * @returns {Promise<Array<Object>>} Resolves with the data array, or an empty array if not found or on error.
     */
    async function loadFromIndexedDB(key) {
        let db;
        try {
            db = await openIndexedDB();
        } catch (error) {
            console.error(`Failed to open IndexedDB for loading key '${key}':`, error);
            return [];
        }

        return new Promise((resolve) => {
            const transaction = db.transaction('users', 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(key);

            request.onsuccess = function(event) {
                const result = event.target.result;
                resolve(result ? result.value : []);
            };
            request.onerror = function(event) {
                console.error(`IndexedDB Load Error for key '${key}':`, event.target.error);
                resolve([]);
            };
             transaction.oncomplete = () => { db.close(); };
             transaction.onerror = (event) => console.error(`IDB load transaction error for ${key}:`, event.target.error);
        });
    }

    /**
     * Saves data (an array of users) for a specific key to the IndexedDB 'users' store.
     * @param {string} key - The key to save under (e.g., 'previousUsers').
     * @param {Array<Object>} users - The array of user objects to save.
     * @returns {Promise<void>} Resolves when the save is complete, rejects on error.
     */
    async function saveToIndexedDB(key, users) {
        if (!Array.isArray(users)) {
            console.error(`Attempted to save non-array data to IndexedDB for key '${key}'. Aborting. Data:`, users);
            return Promise.reject(new Error("Invalid data type: Expected an array."));
        }

        let db;
        try {
            db = await openIndexedDB();
        } catch (error) {
             console.error(`Failed to open IndexedDB for saving key '${key}':`, error);
            throw error;
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction('users', 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put({ key: key, value: users });

            request.onsuccess = function() {
                // Let transaction.oncomplete handle final resolution
            };
            request.onerror = function(event) {
                 console.error(`IndexedDB Put Error for key '${key}':`, event.target.error);
                 reject(event.target.error);
            };

             transaction.oncomplete = () => {
                 db.close();
                 resolve();
             };
             transaction.onabort = (event) => {
                 console.error(`IndexedDB transaction for key '${key}' aborted.`, event.target.error || 'Unknown abort reason');
                 db.close();
                 reject(event.target.error || new Error('Transaction aborted'));
             };
              transaction.onerror = (event) => {
                 console.error(`IndexedDB transaction error for key '${key}'.`, event.target.error);
                 db.close();
                 reject(event.target.error);
             };
        });
    }

    /**
     * Gets all keys currently stored in the IndexedDB 'users' object store.
     * Useful for populating storage type options with custom saved lists.
     * @returns {Promise<string[]>} A promise resolving with an array of keys, or empty array on error.
     */
     async function getIndexedDBKeys() { /* ... */ }

    // --- NEW Message Storage Functions ---

    /**
     * Saves a new message object to the IndexedDB 'messages' store.
     * @param {Object} message - The message object to save (should contain 'text').
     * @returns {Promise<number>} Resolves with the ID of the saved message.
     */
    async function saveMessageToIndexedDB(message) {
         if (!message || typeof message.text !== 'string' || message.text.trim() === '') {
              console.warn("Attempted to save empty or invalid message:", message);
              return Promise.reject(new Error("Invalid message data."));
         }

        let db;
        try {
            db = await openIndexedDB(); // Open DB with the correct version
        } catch (error) {
             console.error("Failed to open IndexedDB for saving message:", error);
            throw error;
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction('messages', 'readwrite');
            const store = transaction.objectStore('messages');

            // Ensure message object has a timestamp and potentially a flag
             const messageToSave = {
                 text: message.text.trim(),
                 timestamp: new Date().toISOString(), // Add timestamp
                 // Add other properties if needed, like user context, etc.
             };

            const request = store.add(messageToSave); // 'add' is for new objects, 'put' for update/add

            request.onsuccess = function(event) {
                 // event.target.result contains the auto-generated key (ID)
                resolve(event.target.result);
            };

            request.onerror = function(event) {
                console.error("IndexedDB Message Save Error:", event.target.error);
                reject(event.target.error);
            };

             transaction.oncomplete = () => { db.close(); console.log("IDB message save transaction complete."); };
             transaction.onabort = (event) => { console.error("IDB message save transaction aborted.", event.target.error); db.close(); reject(event.target.error); };
             transaction.onerror = (event) => { console.error("IDB message save transaction error.", event.target.error); db.close(); reject(event.target.error); };
        });
    }

    /**
     * Loads all messages from the IndexedDB 'messages' store.
     * @returns {Promise<Array<Object>>} Resolves with an array of message objects, or empty array on error/not found.
     */
    async function loadMessagesFromIndexedDB() {
        let db;
        try {
            db = await openIndexedDB();
        } catch (error) {
            console.error("Failed to open IndexedDB for loading messages:", error);
            return [];
        }

        return new Promise((resolve) => {
            const transaction = db.transaction('messages', 'readonly');
            const store = transaction.objectStore('messages');

            const request = store.getAll(); // Get all objects

            request.onsuccess = function(event) {
                resolve(event.target.result || []);
            };

            request.onerror = function(event) {
                console.error("IndexedDB Load All Messages Error:", event.target.error);
                resolve([]);
            };

             transaction.oncomplete = () => { db.close(); console.log("IDB load all messages transaction complete."); };
             transaction.onerror = (event) => console.error("IDB load all messages transaction error:", event.target.error);
        });
    }


    // --- Core Application Logic Functions ---

    /**
     * Fetches online user data from the API using pagination.
     * Updates `allOnlineUsersData`, then calls functions to populate filters and display users.
     */
    async function fetchData() {
        console.log("Executing fetchData: Starting online user data fetch...");
        stopAutoScroll(); // Stop auto-scroll when fetching/updating the list
        showOnlineLoadingIndicator("Loading online users...");
        clearOnlineErrorDisplay();

        let fetchedUsers = [];
        let offset = 0;
        let continueFetching = true;
        let totalFetchedCount = 0;

        while (continueFetching && totalFetchedCount < maxApiFetchLimit) {
            const apiUrl = `${apiUrlBase}&limit=${apiLimit}&offset=${offset}`;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                     console.warn(`fetchData: Aborting fetch for offset ${offset} due to timeout (${apiFetchTimeout}ms).`);
                     controller.abort();
                     }, apiFetchTimeout);

                const response = await fetch(apiUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                console.log(`fetchData: Response status for offset ${offset}: ${response.status}`);

                if (!response.ok) {
                     const errorBody = await response.text().catch(() => `Status: ${response.statusText}`);
                     console.error(`fetchData: HTTP error fetching offset ${offset}. Status: ${response.status}, Body: ${errorBody}`);
                     throw new Error(`HTTP error ${response.status}`);
                }

                const data = await response.json();

                 if (data && data.results && Array.isArray(data.results)) {
                      if (data.results.length > 0) {
                         fetchedUsers = fetchedUsers.concat(data.results);
                         totalFetchedCount = fetchedUsers.length;
                         showOnlineLoadingIndicator(`Fetched ${totalFetchedCount} users...`);

                         if (data.results.length < apiLimit) {
                             continueFetching = false;
                         } else {
                             offset += apiLimit;
                         }
                     } else {
                         continueFetching = false;
                     }
                 } else {
                     console.warn(`fetchData: Response JSON does not contain a valid 'results' array from offset ${offset}:`, data);
                     continueFetching = false;
                 }

            } catch (error) {
                console.error(`fetchData: Error during fetch for offset ${offset}:`, error);
                 if (error.name === 'AbortError') {
                     showOnlineErrorDisplay(`Failed to fetch data (timeout). Check network or API status.`);
                 } else {
                    showOnlineErrorDisplay(`Failed to fetch data: ${error.message}. Check console.`);
                 }
                continueFetching = false;
            }
        }

        if (totalFetchedCount >= maxApiFetchLimit) {
            console.warn(`fetchData: Fetch stopped after reaching safety limit (${maxApiFetchLimit} users).`);
            showOnlineErrorDisplay(`Load stopped at ${maxApiFetchLimit} users. Data might be incomplete.`);
        }

        console.log(`fetchData: Fetch cycle finished. Total users fetched in this cycle: ${totalFetchedCount}`);

        // --- Post-fetch actions ---
        allOnlineUsersData = fetchedUsers;
        lastFilteredUsers = []; // Reset filtered list until filters are applied

        if (allOnlineUsersData.length > 0) {
             console.log("fetchData: Populating filters and displaying users...");
             populateFilters(allOnlineUsersData);
             // Update User Autocomplete source
             if (userSearchInput && typeof $.fn.autocomplete === 'function') {
                  $(userSearchInput).autocomplete('option', 'source', getAllUsernames());
             }
             applyFiltersAndDisplay(); // Applies filters and calls displayOnlineUsersList (which uses displayMode and triggers recognition)
             await displayPreviousUsers(); // Display previous users (always image mode)
        } else {
             console.log("fetchData: No online users data fetched in this cycle. Clearing online display.");
              if (onlineUsersDiv) onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found or failed to fetch.</p>';
              populateFilters([]);
             // Clear User Autocomplete source
              if (userSearchInput && typeof $.fn.autocomplete === 'function') {
                  $(userSearchInput).autocomplete('option', 'source', []);
             }
              applyFiltersAndDisplay(); // Ensure display reflects empty state
              await displayPreviousUsers();
        }

        hideOnlineLoadingIndicator();
        console.log("fetchData execution finished.");
    }

    /**
     * Gets a list of all unique usernames from the full dataset.
     * Used for user autocomplete source.
     * @returns {string[]} Array of usernames.
     */
     function getAllUsernames() {
         if (!allOnlineUsersData || allOnlineUsersData.length === 0) {
             return [];
         }
         return allOnlineUsersData.map(user => user.username);
     }


    /**
     * Populates the tag and age filter dropdowns based on the provided user data.
     * Preserves currently selected values if possible.
     * @param {Array<Object>} users - The array of user objects (usually `allOnlineUsersData`).
     */
    function populateFilters(users) { /* ... (same code) ... */ }


     /**
      * Applies filters based on dropdown selections, button overrides, AND user search input.
      * Updates `lastFilteredUsers` state and calls `displayOnlineUsersList`.
      * @param {Object} [buttonFilters={}] - Optional filters from specific buttons like { tag: 'tagName' } or { age: 18 }.
      */
    function applyFiltersAndDisplay(buttonFilters = {}) {
        console.log("Applying filters...", { buttonFilters, currentUserSearchTerm });

        let filterTags = [];
        if (buttonFilters.tag) {
            filterTags = [buttonFilters.tag.toLowerCase()];
            if (filterTagsSelect) filterTagsSelect.value = buttonFilters.tag.toLowerCase();
        } else if (filterTagsSelect) {
            filterTags = Array.from(filterTagsSelect.selectedOptions)
                .map(option => option.value.toLowerCase())
                .filter(tag => tag !== '');
        }

        let filterAges = [];
        if (buttonFilters.age) {
            filterAges = [parseInt(buttonFilters.age)];
             if (filterAgeSelect) filterAgeSelect.value = String(buttonFilters.age);
        } else if (filterAgeSelect) {
            filterAges = Array.from(filterAgeSelect.selectedOptions)
                .map(option => parseInt(option.value))
                .filter(age => !isNaN(age) && age > 0);
        }

         // Get the current search term from the user search input
         currentUserSearchTerm = userSearchInput ? userSearchInput.value.trim().toLowerCase() : '';

        console.log("Active filters:", { filterTags, filterAges, userSearchTerm: currentUserSearchTerm });

        const filteredUsers = allOnlineUsersData.filter(user => {
            if (!user || !user.username) return false;

            const isPublic = user.current_show === 'public';

             let hasTags = true;
             if (filterTags.length > 0) {
                 const userTagsLower = (user.tags && Array.isArray(user.tags))
                     ? user.tags.map(t => typeof t === 'string' ? t.toLowerCase() : '')
                     : [];
                 hasTags = filterTags.some(filterTag => userTagsLower.includes(filterTag));
             }

            let isAgeMatch = true;
            if (filterAges.length > 0) {
                isAgeMatch = (user.age && typeof user.age === 'number')
                    ? filterAges.includes(user.age)
                    : false;
            }

             // User search term filter (case-insensitive substring match on username)
             let isUserSearchMatch = true;
             if (currentUserSearchTerm !== '') {
                  isUserSearchMatch = user.username.toLowerCase().includes(currentUserSearchTerm);
             }

            return isPublic && hasTags && isAgeMatch && isUserSearchMatch;
        });

        console.log(`Filtered ${allOnlineUsersData.length} users down to ${filteredUsers.length}.`);
        lastFilteredUsers = filteredUsers;
        displayOnlineUsersList(filteredUsers); // Use the current displayMode and trigger recognition
    }


    /**
     * Displays the provided list of users in the online users container.
     * Also handles auto-scroll and triggers image recognition.
     * Uses the global `displayMode`.
     * @param {Array<Object>} usersToDisplay - The array of user objects to display.
     */
    function displayOnlineUsersList(usersToDisplay) {
         if (!onlineUsersDiv) {
             console.warn("Online users display div (#onlineUsers .user-list) not found. Cannot display users.");
             return;
         }
        console.log(`displayOnlineUsersList: Displaying ${usersToDisplay.length} filtered online users in ${displayMode} mode.`);

        stopAutoScroll();

        onlineUsersDiv.innerHTML = "";

        if (usersToDisplay.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users match the current filters.</p>';
            if (toggleAutoScrollButton) {
                toggleAutoScrollButton.disabled = true;
                toggleAutoScrollButton.textContent = 'Not Scrollable';
                 toggleAutoScrollButton.classList.remove('w3-red');
                 toggleAutoScrollButton.classList.add('w3-green');
            }
             // Clear the analysis queue if the list is empty
             analysisQueue = [];
             showRecognitionStatus(''); // Hide status
            return;
        }

        onlineUsersDiv.classList.toggle('image-mode', displayMode === 'image');
        onlineUsersDiv.classList.toggle('iframe-mode', displayMode === 'iframe');


        const fragment = document.createDocumentFragment();
        // Clear previous analysis results and queue for these users
        // This is simple; a more robust solution would cache results per user object
        analysisQueue = []; // Clear the queue
         isAnalyzing = false; // Reset analysis state
         showRecognitionStatus(''); // Hide previous status

        usersToDisplay.forEach(user => {
            if (!user || !user.image_url || !user.username) {
                console.warn("Skipping online user display due to incomplete data:", user);
                return;
            }
             // Add recognition results property to the user object if it doesn't exist or is stale
             if (!user.recognition_results || user.recognition_timestamp < Date.now() - fetchIntervalDuration) {
                  user.recognition_results = null; // Reset results
                  user.recognition_timestamp = 0; // Reset timestamp
             }

            const userElement = createUserElement(user, 'online', displayMode);
            fragment.appendChild(userElement);

             // Add the user's image URL to the analysis queue if we are in image mode
             // and the user hasn't been analyzed recently (or ever)
             if (displayMode === 'image' && !user.recognition_results) {
                  analysisQueue.push({
                      username: user.username,
                      imageUrl: user.image_url,
                      element: userElement // Pass the DOM element to update later
                  });
             }
        });
        onlineUsersDiv.appendChild(fragment);

         // Start processing the analysis queue if there are items
         if (analysisQueue.length > 0 && mobilenetModel) { // Ensure model is loaded
              console.log(`Queued ${analysisQueue.length} images for recognition.`);
              processAnalysisQueue(); // Start the analysis process
         } else if (displayMode === 'image' && mobilenetModel && usersToDisplay.length > 0) {
              // If in image mode, model is loaded, list is not empty, but no images queued,
              // it means all currently displayed images might have results already.
              // Or maybe the image_url was missing on some?
              console.log("Image mode active, but no new images queued for recognition.");
              showRecognitionStatus("Recognition results shown below users."); // Indicate where results are
         } else if (!mobilenetModel && displayMode === 'image' && usersToDisplay.length > 0) {
               console.warn("MobileNet model not loaded. Cannot perform image recognition.");
               showRecognitionStatus("Image recognition not available (model loading failed?).", 'warning');
         } else {
              showRecognitionStatus(''); // Hide status if not in image mode or no users
         }


         if (toggleAutoScrollButton) {
             if (onlineUsersDiv.scrollHeight > onlineUsersDiv.clientHeight) {
                  toggleAutoScrollButton.disabled = false;
                  toggleAutoScrollButton.textContent = 'Start Auto-Scroll Online';
                   toggleAutoScrollButton.classList.remove('w3-red');
                   toggleAutoScrollButton.classList.add('w3-green');
             } else {
                 toggleAutoScrollButton.disabled = true;
                 toggleAutoScrollButton.textContent = 'Not Scrollable';
                  toggleAutoScrollButton.classList.remove('w3-red');
                  toggleAutoScrollButton.classList.add('w3-green');
             }
         }
         console.log("displayOnlineUsersList complete.");
    }


    /**
     * Displays the previous users list, filtering to show only those currently online & public.
     * Ensures `previousUsers` state is loaded before displaying. Always uses image mode.
     * @returns {Promise<void>}
     */
    async function displayPreviousUsers() {
         if (!previousUsersDiv) {
             console.warn("Previous users display div (#previousUsers .user-list) not found.");
             return;
         }
         console.log(`displayPreviousUsers: Refreshing display. History has ${previousUsers.length} users.`);
         previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Loading history...</p>';

         if (previousUsers.length === 0) {
             previousUsers = await loadUsers("previousUsers");
             if (previousUsers.length === 0) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No viewing history saved.</p>';
                console.log("displayPreviousUsers: No previous users found in storage.");
                return;
             } else {
                  console.log(`displayPreviousUsers: Loaded ${previousUsers.length} previous users from storage.`);
             }
         }

         if (allOnlineUsersData.length === 0) {
              console.warn("displayPreviousUsers: Online user data (allOnlineUsersData) not available. Displaying saved history without online status check.");
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">History loaded. Fetching online status...</p>';
              return;
         }

         const onlineUserMap = new Map(allOnlineUsersData.map(user => [user.username, user]));

         const currentlyOnlineAndPublicPreviousUsers = previousUsers.filter(prevUser => {
             const onlineUser = onlineUserMap.get(prevUser.username);
             return onlineUser && onlineUser.current_show === 'public';
         });

         console.log(`displayPreviousUsers: Found ${currentlyOnlineAndPublicPreviousUsers.length} saved users currently online & public.`);

         previousUsersDiv.innerHTML = "";

         if (currentlyOnlineAndPublicPreviousUsers.length === 0) {
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">None of your saved users are online & public right now.</p>';
              return;
         }

         previousUsersDiv.classList.remove('iframe-mode');
         previousUsersDiv.classList.add('image-mode'); // Always image mode

         const fragment = document.createDocumentFragment();
         currentlyOnlineAndPublicPreviousUsers.forEach(user => {
             if (!user || !user.image_url || !user.username) {
                console.warn("Skipping previous user display due to incomplete data:", user);
                return;
            }
             const userElement = createUserElement(user, 'previous', 'image'); // Always use 'image' mode
             fragment.appendChild(userElement);
         });
         previousUsersDiv.appendChild(fragment);
          console.log("displayPreviousUsers: Previous users display complete.");
    }


    /**
     * Creates and returns a DOM element for a single user (online or previous).
     * Includes image/iframe, details, badges, birthday, and image recognition results.
     * @param {Object} user - The user data object.
     * @param {'online' | 'previous'} listType - Indicates which list the element is for.
     * @param {'image' | 'iframe'} mode - The display mode for this element.
     * @returns {HTMLElement} The created user div element.
     */
    function createUserElement(user, listType, mode) {
        const userElement = document.createElement("div");
        userElement.className = `user-info w3-card w3-margin-bottom ${listType}-list-item ${mode}-display-mode`;
        userElement.dataset.username = user.username;
        // Add a data attribute to store recognition state
        userElement.dataset.recognized = user.recognition_results ? 'true' : 'false';

        const tagsDisplay = (user.tags && Array.isArray(user.tags) && user.tags.length > 0)
                            ? user.tags.join(', ')
                            : 'N/A';
        const ageDisplay = (user.age && typeof user.age === 'number') ? user.age : 'N/A';

        let ageDetails = `Age: ${ageDisplay}`;
        if (user.age === 18 && user.birthday) {
            const daysSinceBday = getDaysSinceLastBirthday(user.birthday, user.age);
            if (daysSinceBday !== null) {
                ageDetails = `Age: 18 <span class="age-days">(${daysSinceBday} days)</span>`;
            } else {
                 ageDetails = `Age: 18`; // Fallback if calculation fails
            }
        }

        const newBadge = user.is_new ? '<span class="badge new-badge w3-tag w3-small w3-red w3-round">New</span>' : '';
        const birthdayBanner = isBirthday(user.birthday) ? `<p class="birthday w3-text-amber w3-center">🎂 Happy Birthday! 🎂</p>` : '';
        const removeButton = listType === 'previous' ? '<button class="remove-user-btn w3-button w3-tiny w3-red w3-hover-dark-grey w3-circle" title="Remove from history">×</button>' : '';

        let mediaContent = '';
        if (mode === 'iframe') {
             const iframeSrc = `${LIST_IFRAME_BASE_URL}${user.username}/${LIST_IFRAME_PARAMS}`;
            mediaContent = `
                <div class="iframe-container">
                     <iframe src="${iframeSrc}" frameborder="0" scrolling="no" allowfullscreen loading="lazy"></iframe>
                     <div class="click-overlay"></div>
                </div>
            `;
        } else { // mode === 'image'
            mediaContent = `
                <div class="user-image-container">
                    <img src="${user.image_url}" alt="${user.username} thumbnail" loading="lazy" class="w3-image">
                </div>
            `;
        }

        // Add placeholder for recognition results if in image mode and not yet recognized
        let recognitionHtml = '';
        if (mode === 'image') {
             if (user.recognition_results) {
                  recognitionHtml = buildRecognitionResultsHtml(user.recognition_results);
             } else {
                  // Add a placeholder element that can be updated later
                  recognitionHtml = `<div class="recognition-results loading-indicator">Analyzing...</div>`;
             }
        }


        userElement.innerHTML = `
            ${mediaContent}
            ${removeButton}
            <div class="user-details w3-container w3-padding-small">
                <p class="username w3-large">${user.username} ${newBadge}</p>
                <p><small>${ageDetails} | Viewers: ${user.num_viewers || 'N/A'}</small></p>
                <p class="tags"><small>Tags: ${tagsDisplay}</small></p>
                ${birthdayBanner}
                ${recognitionHtml} <!-- Insert recognition results here -->
            </div>
        `;

        // --- Add Event Listeners ---
        userElement.addEventListener("click", function(event) {
             if (event.target.closest('.remove-user-btn') || event.target.closest('.click-overlay')) {
                 return;
             }
             event.preventDefault();
             handleUserClick(user); // Pass the full user object
        });

        const removeBtn = userElement.querySelector('.remove-user-btn');
        if (removeBtn) {
            removeBtn.addEventListener("click", async function(event) {
                event.stopPropagation();
                console.log(`User clicked remove for: ${user.username}`);
                showOnlineLoadingIndicator("Removing from history...");
                await removeFromPreviousUsers(user.username);
                await displayPreviousUsers();
                hideOnlineLoadingIndicator();
            });
        }

         const overlay = userElement.querySelector('.click-overlay');
         if (overlay) {
             overlay.addEventListener('click', function(event) {
                 event.stopPropagation();
                  console.log(`Overlay clicked for: ${user.username}. Triggering parent click.`);
                  userElement.click(); // Simulate click on the parent element
             });
         }

        return userElement;
    }

    /**
     * Builds the HTML string to display image recognition results.
     * @param {Array<Object>} results - Array of recognition results ({className, probability}).
     * @returns {string} HTML string.
     */
    function buildRecognitionResultsHtml(results) {
        if (!results || results.length === 0) {
            return '';
        }
        let html = '<div class="recognition-results"><strong>Recognized:</strong><ul>';
        results.forEach(result => {
            // Format probability as percentage
            const confidence = (result.probability * 100).toFixed(1);
            html += `<li>${result.className} (${confidence}%)</li>`;
        });
        html += '</ul></div>';
        return html;
    }


    /**
     * Handles clicking on a user: loads their stream into the selected main iframe
     * and adds/moves them to the top of the previous users history.
     * @param {Object} user - The user object that was clicked.
     */
    function handleUserClick(user) {
         if (!mainIframe || !mainIframe2) { // Ensure at least the first two exist
              console.error("Initial main iframe elements not found. Cannot load user stream.");
              showReportStatus("Viewer iframes not found.", 'error');
              return;
         }
         if (!user || !user.username) {
             console.error("Invalid user data passed to handleUserClick:", user);
             return;
         }
        console.log(`User clicked: ${user.username}`);

        // Determine which iframe to use based on radio button selection
        const iframeChoiceRadio = document.querySelector('input[name="iframeChoice"]:checked');
        const selectedIframeId = iframeChoiceRadio ? iframeChoiceRadio.value : 'mainIframe';

        const selectedIframe = document.getElementById(selectedIframeId);

         if (!selectedIframe) {
              console.error(`Selected iframe element '${selectedIframeId}' not found.`);
              showReportStatus(`Selected viewer viewport '${selectedIframeId}' not found.`, 'error');
              return;
         }

        const iframeSrc = `${MAIN_IFRAME_BASE_URL}${user.username}/${MAIN_IFRAME_PARAMS}`;

        console.log(`Loading ${user.username} into ${selectedIframeId} with src: ${iframeSrc}`);
        selectedIframe.src = iframeSrc;

        addToPreviousUsers(user).catch(err => {
            console.error(`Error adding ${user.username} to previous users:`, err);
        });
    }


    /**
     * Adds a user to the `previousUsers` state array.
     * Ensures uniqueness (moves to front if exists) and enforces `maxHistorySize`.
     * Saves the updated list to the selected storage.
     * @param {Object} user - The user object to add/move.
     * @returns {Promise<void>}
     */
    async function addToPreviousUsers(user) { /* ... (same logic) ... */ }

     /**
      * Removes a user from the `previousUsers` history state by username.
      * Saves the updated list to the selected storage.
      * @param {string} username - The username to remove.
      * @returns {Promise<void>}
      */
     async function removeFromPreviousUsers(username) { /* ... (same logic) ... */ }

     /**
      * Clears the previous users history from both state and the selected storage.
      * @returns {Promise<void>}
      */
     async function clearPreviousUsers() { /* ... (same logic) ... */ }


     /**
      * Initializes the options for the storage type selector.
      * Includes standard options (Local, Session, IndexedDB) and any custom keys found in IndexedDB.
      * @returns {Promise<void>}
      */
     async function populateStorageOptions() { /* ... (same logic) ... */ }


    // --- NEW Message Functions ---

    /**
     * Reads input, saves message to DB, clears input, and refreshes message list.
     */
    async function saveMessage() {
         if (!messageInput || !messageStatusDisplay) {
              console.warn("Message input or status display not found.");
              showReportStatus("Messaging elements missing.", 'error'); // Use report status for broader visibility
              return;
         }

         const text = messageInput.value.trim();
         if (text === '') {
              showStatusMessage(messageStatusDisplay, "Message is empty.", 'warning');
              return;
         }

         showStatusMessage(messageStatusDisplay, "Saving...", 'loading');
         if (saveMessageButton) saveMessageButton.disabled = true;
         if (messageInput) messageInput.disabled = true;

         try {
              await saveMessageToIndexedDB({ text: text });
              console.log("Message saved successfully.");
              messageInput.value = ''; // Clear input
              await loadAndDisplayMessages(); // Reload and display messages
              showStatusMessage(messageStatusDisplay, "Message saved!", 'success');
         } catch (error) {
              console.error("Failed to save message:", error);
              showStatusMessage(messageStatusDisplay, `Error saving message: ${error.message}`, 'error');
         } finally {
             if (saveMessageButton) saveMessageButton.disabled = false;
             if (messageInput) messageInput.disabled = false;
              // Clear status after a delay for success/warning
              if (messageStatusDisplay.classList.contains('success') || messageStatusDisplay.classList.contains('warning')) {
                  setTimeout(() => showStatusMessage(messageStatusDisplay, '', 'info', false), 3000); // Hide after 3s
              }
         }
    }

    /**
     * Loads messages from DB and displays them, optionally filtering by search term.
     */
    async function loadAndDisplayMessages() {
         if (!messageListDiv || !messageSearchInput) {
              console.warn("Message list div or search input not found. Cannot load/display messages.");
              return;
         }
         console.log("Loading and displaying messages...");
         messageListDiv.innerHTML = '<p class="text-muted w3-center">Loading messages...</p>'; // Loading state

         try {
             // Load all messages from DB into state
              savedMessages = await loadMessagesFromIndexedDB();
              console.log(`Loaded ${savedMessages.length} messages from DB.`);

             // Update Message Autocomplete source
              if (messageSearchInput && typeof $.fn.autocomplete === 'function') {
                   $(messageSearchInput).autocomplete('option', 'source', getAllMessageTexts());
              }

             // Get current search term
              currentMessageSearchTerm = messageSearchInput.value.trim().toLowerCase();

             // Filter messages based on search term
              const filteredMessages = savedMessages.filter(msg =>
                  currentMessageSearchTerm === '' || msg.text.toLowerCase().includes(currentMessageSearchTerm)
              );

              displayMessagesList(filteredMessages); // Display filtered messages

         } catch (error) {
             console.error("Error loading messages:", error);
             messageListDiv.innerHTML = '<p class="text-muted w3-center w3-text-red">Error loading messages.</p>';
         }
    }

    /**
     * Gets a list of all unique message texts.
     * Used for message autocomplete source.
     * @returns {string[]} Array of message texts.
     */
     function getAllMessageTexts() {
         if (!savedMessages || savedMessages.length === 0) {
             return [];
         }
         // Return only the text from the loaded messages
         return savedMessages.map(msg => msg.text);
     }


    /**
     * Displays the provided list of messages in the message list container.
     * @param {Array<Object>} messagesToDisplay - Array of message objects.
     */
    function displayMessagesList(messagesToDisplay) {
         if (!messageListDiv) return;

         messageListDiv.innerHTML = ""; // Clear previous list

         if (messagesToDisplay.length === 0) {
              messageListDiv.innerHTML = '<p class="text-muted w3-center">No saved messages found.</p>';
              return;
         }

         // Sort messages by timestamp, newest first
         messagesToDisplay.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

         const fragment = document.createDocumentFragment();
         messagesToDisplay.forEach(msg => {
             if (!msg || !msg.text) {
                 console.warn("Skipping message display due to incomplete data:", msg);
                 return;
             }
             const messageElement = createMessageElement(msg);
             fragment.appendChild(messageElement);
         });
         messageListDiv.appendChild(fragment);
         console.log(`Displayed ${messagesToDisplay.length} messages.`);
    }

    /**
     * Creates a DOM element for a single message.
     * @param {Object} message - The message object.
     * @returns {HTMLElement} The created message div element.
     */
    function createMessageElement(message) {
        const messageElement = document.createElement("div");
        messageElement.className = "message-item";
        messageElement.textContent = message.text; // Set text content

        // Add click listener to copy text to clipboard
        messageElement.addEventListener("click", function() {
            copyToClipboard(message.text);
        });
        // Optional: Add delete button listener here

        return messageElement;
    }

    /**
     * Copies text to the user's clipboard.
     * Provides status feedback via the message status display.
     * @param {string} text - The text to copy.
     */
    function copyToClipboard(text) {
         if (!messageStatusDisplay) {
              console.warn("Message status display not found.");
               // Fallback to alert if status element is missing?
              if (navigator.clipboard && navigator.clipboard.writeText) {
                   navigator.clipboard.writeText(text).then(() => console.log("Text copied to clipboard (no status UI).")).catch(err => console.error("Failed to copy text:", err));
              } else {
                   console.warn("Clipboard API not available.");
              }
              return;
         }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                console.log("Text copied to clipboard:", text);
                 showStatusMessage(messageStatusDisplay, "Copied to clipboard!", 'success');
                 setTimeout(() => showStatusMessage(messageStatusDisplay, '', 'info', false), 2000); // Hide after 2s
            }).catch(err => {
                console.error("Failed to copy text:", err);
                 showStatusMessage(messageStatusDisplay, `Failed to copy: ${err.message}`, 'error');
            });
        } else {
             console.warn("Clipboard API not available.");
             showStatusMessage(messageStatusDisplay, "Copy failed: Clipboard not supported.", 'error');
            // Fallback for older browsers (execCommand is deprecated/less reliable)
            /*
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                console.log('Text copied using execCommand');
                 showStatusMessage(messageStatusDisplay, "Copied to clipboard (fallback)!", 'success');
                 setTimeout(() => showStatusMessage(messageStatusDisplay, '', 'info', false), 2000);
            } catch (err) {
                console.error('Fallback copy failed', err);
                showStatusMessage(messageStatusDisplay, "Failed to copy (fallback).", 'error');
            }
            document.body.removeChild(textarea);
            */
        }
    }

    /**
     * Displays a status message in a designated element.
     * @param {HTMLElement} element - The DOM element to display the status in.
     * @param {string} message - The message text.
     * @param {'success' | 'error' | 'warning' | 'info' | 'loading'} [type='info'] - Type for CSS styling.
     * @param {boolean} [show=true] - Whether to show or hide the element.
     */
    function showStatusMessage(element, message, type = 'info', show = true) {
         if (!element) return;
         element.textContent = message;
         element.className = `message-status ${type}`; // Use a base class
         element.style.display = show ? (type === 'loading' ? 'inline-block' : 'block') : 'none'; // Show/hide and adjust display type for loading

         // Add W3.CSS classes based on type
         element.classList.remove('w3-text-grey', 'w3-text-green', 'w3-text-red', 'w3-text-amber', 'w3-text-blue'); // Remove previous
         element.classList.remove('w3-panel', 'w3-pale-green', 'w3-pale-red', 'w3-pale-yellow', 'w3-pale-blue'); // Remove previous panel classes
         element.style.borderLeft = ''; // Remove border style

         if (type === 'loading') {
              element.classList.add('w3-text-grey');
         } else if (type === 'success') {
              element.classList.add('w3-panel', 'w3-pale-green');
              element.style.borderLeft = '6px solid #4CAF50';
         } else if (type === 'error') {
              element.classList.add('w3-panel', 'w3-pale-red');
              element.style.borderLeft = '6px solid #f44336';
         } else if (type === 'warning') {
               element.classList.add('w3-panel', 'w3-pale-yellow');
               element.style.borderLeft = '6px solid #ff9800';
         } else { // info
              element.classList.add('w3-panel', 'w3-pale-blue');
              element.style.borderLeft = '6px solid #2196F3';
         }
    }


    // --- Reporting Functions (Client-Side Placeholder) ---

    /**
     * Sends the `lastFilteredUsers` list as a report
     * using the configured client-side method.
     * Handles loading state and status feedback.
     * @returns {Promise<void>}
     */
    async function sendReport() {
        console.log("Attempting to send report...");

        if (!lastFilteredUsers || lastFilteredUsers.length === 0) {
            const warnMsg = "No users currently displayed in the 'Online Users' list to report.";
            console.warn(warnMsg);
            showReportStatus(warnMsg, 'warning');
            return;
        }

        const reportData = lastFilteredUsers.map(user => ({
            username: user.username,
            age: user.age,
            tags: user.tags,
            is_new: user.is_new,
            num_viewers: user.num_viewers,
            birthday: user.birthday,
            // Include recognition results if available
             recognition_results: user.recognition_results ? user.recognition_results.map(r => `${r.className} (${(r.probability * 100).toFixed(1)}%)`).join(', ') : 'Not analyzed'
        }));

        showReportLoading(`Preparing report for ${reportData.length} users...`);
        clearReportStatus();

        try {
            if (REPORT_SEND_METHOD === 'placeholder-client-service') {
                console.log("Using placeholder client-side service method for report.");
                showReportStatus("Report sending via client service (placeholder). Requires service setup (e.g. EmailJS).", 'info');

                // --- Example using EmailJS (requires their CDN and initialization) ---
                // if (typeof emailjs !== 'undefined' && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID) {
                //      const templateParams = {
                //          report_json: JSON.stringify(reportData, null, 2), // Send formatted JSON
                //          report_summary: `Report contains ${reportData.length} online users.`,
                //          // Add other fields needed by your template, e.g., sender email input value
                //      };
                //      const result = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
                //      if (result.status === 200) {
                //           showReportStatus('Report sent successfully via EmailJS!', 'success');
                //      } else {
                //           showReportStatus(`EmailJS send failed (Status: ${result.status}). See console.`, 'error');
                //      }
                // } else {
                //      console.error("EmailJS SDK not loaded or configuration missing.");
                //      showReportStatus("Report feature not configured. EmailJS SDK missing or keys not set.", 'error');
                // }
                 // Fallback if placeholder method isn't actually implemented/configured
                 throw new Error("Client-side report service not actually implemented/configured.");


            } else if (REPORT_SEND_METHOD === 'mailto') {
                console.log("Using mailto link for report.");
                const subject = encodeURIComponent("Room Viewer Online User Report");
                // Format data for the mailto body (simple text)
                const bodyText = reportData.map(user =>
                    `Username: ${user.username}\nAge: ${user.age}\nTags: ${user.tags.join(', ')}\nViewers: ${user.num_viewers}\nBirthday: ${user.birthday || 'N/A'}\nRecognition: ${user.recognition_results || 'N/A'}\n---\n`
                ).join('\n');
                const body = encodeURIComponent("Online Users Report:\n\n" + bodyText);
                 // Check URL length limit (rough estimate)
                 if ((mailtoLink.length + body.length) > 2000) { // Mailto limits vary, 2000 is a common safe upper bound
                      const errorMsg = "Report data too large for mailto link. Reduce filters or use a different report method.";
                      console.warn(errorMsg);
                      showReportStatus(errorMsg, 'warning');
                      throw new Error(errorMsg); // Stop process
                 }

                const mailtoLink = `mailto:your.email@example.com?subject=${subject}&body=${body}`; // !! REPLACE your.email@example.com !!

                window.location.href = mailtoLink;
                showReportStatus("Attempted to open email client with report data.", 'info');

            } else {
                console.error(`Unknown REPORT_SEND_METHOD configured: ${REPORT_SEND_METHOD}`);
                showReportStatus(`Report feature misconfigured: Unknown method '${REPORT_SEND_METHOD}'.`, 'error');
            }

        } catch (error) {
            console.error("Error caught during report sending:", error);
            showReportStatus(`Failed to send report: ${error.message}`, 'error');
        } finally {
            hideReportLoading();
        }
    }


    // --- UI Loading and Error/Status Display Helpers ---
    // (Extended for message status)
    function showOnlineLoadingIndicator(message = 'Loading...') { /* ... */ }
    function hideOnlineLoadingIndicator() { /* ... */ }
    function showOnlineErrorDisplay(message) { /* ... */ }
    function clearOnlineErrorDisplay() { /* ... */ }
    function showReportLoading(message = 'Processing...') { /* ... */ }
    function hideReportLoading() { /* ... */ }
    function showReportStatus(message, type = 'info') { /* ... */ }
    function clearReportStatus() { /* ... */ }
    // showStatusMessage helper implemented earlier for messages

    /**
     * Displays or hides the image recognition status message.
     * @param {string} message - The message to display. Empty string hides.
     * @param {'loading'|'info'|'warning'|'error'|''} [type='info'] - Status type.
     */
    function showRecognitionStatus(message, type = 'info') {
         if (!recognitionStatusDisplay) return;
         recognitionStatusDisplay.textContent = message;
         recognitionStatusDisplay.className = `w3-small w3-text-grey w3-margin-bottom`; // Reset base classes
         if (message) {
              recognitionStatusDisplay.style.display = 'inline-block'; // Show

              if (type === 'loading') {
                   recognitionStatusDisplay.classList.add('loading-indicator');
                   recognitionStatusDisplay.classList.add('w3-text-grey');
              } else if (type === 'warning') {
                   recognitionStatusDisplay.classList.add('w3-text-amber');
              } else if (type === 'error') {
                   recognitionStatusDisplay.classList.add('w3-text-red');
              } else { // info or default
                   recognitionStatusDisplay.classList.add('w3-text-grey');
              }

         } else {
             recognitionStatusDisplay.style.display = 'none'; // Hide
         }
    }


     // --- Auto-Scrolling Functions ---
     // (Remain the same as previous update)
     function scrollStep() { /* ... */ }
     function startAutoScroll() { /* ... */ }
     function stopAutoScroll() { /* ... */ }
     function handleManualScroll() { /* ... */ }


     // --- Iframe Layout & Sizing Functions ---

     /**
      * Updates the main viewer container and iframe visibility
      * based on the current `iframeCount` state.
      */
     function updateIframeLayout() {
         if (!mainViewerContainer || mainIframes.some(i => !i) || iframeWrappers.some(w => !w) || !mainIframeColumn) {
              console.error("Cannot update iframe layout: Missing main viewer elements.");
              return;
         }
         console.log(`Updating iframe layout to show ${iframeCount} viewports.`);

         mainViewerContainer.classList.remove('iframe-count-2', 'iframe-count-4');
         mainViewerContainer.classList.add(`iframe-count-${iframeCount}`);

         for (let i = 0; i < iframeWrappers.length; i++) {
             const wrapper = iframeWrappers[i];
             const iframe = mainIframes[i];
             const radio = document.querySelector(`input[name="iframeChoice"][value="mainIframe${i + 1}"]`);

             if (!wrapper || !iframe || !radio) continue; // Skip if element not found

             if (i < iframeCount) {
                 wrapper.style.display = ''; // Show the wrapper
                 radio.disabled = false;
             } else {
                 wrapper.style.display = 'none'; // Hide the wrapper
                 // Optionally reset iframe src when hiding
                  if (iframe.src && iframe.src !== 'about:blank' && !iframe.src.startsWith('https://cbxyz.com/in/')) { // Don't clear default placeholders
                      // Reset to placeholder or blank
                      iframe.src = 'https://cbxyz.com/in/?tour=dU9X&campaign=9cg6A&track=embed&signup_notice=1&disable_sound=1&mobileRedirect=never'; // Placeholder
                      console.log(`Resetting iframe src for hidden viewport ${i + 1}`);
                  } else if (!iframe.src) {
                      // If src was already empty/null, ensure it's the placeholder
                       iframe.src = 'https://cbxyz.com/in/?tour=dU9X&campaign=9cg6A&track=embed&signup_notice=1&disable_sound=1&mobileRedirect=never';
                  }

                 radio.disabled = true;
                 // If the hidden radio was checked, switch to the first visible one
                 if (radio.checked) {
                      const firstRadio = document.querySelector('input[name="iframeChoice"][value="mainIframe1"]');
                      if (firstRadio) firstRadio.checked = true;
                 }
             }
         }

          // Ensure the button text is correct after toggling count
          if (toggleIframeCountButton) {
              toggleIframeCountButton.textContent = `Toggle ${iframeCount}/${iframeCount === 2 ? 4 : 2} Viewports`;
          }

         // Update the size class on the parent iframe-column
          updateIframeSize(); // Apply current size index
     }

     /**
      * Toggles the number of main viewer iframes between 2 and 4.
      */
     function toggleIframeCount() {
         console.log("Toggling iframe count.");
         iframeCount = (iframeCount === 2) ? 4 : 2;
         updateIframeLayout();
     }

     /**
      * Updates the size class on the iframe column based on `iframeSizeIndex`.
      */
     function updateIframeSize() {
         if (!mainIframeColumn || IFRAME_SIZE_CLASSES.length === 0) {
              console.warn("Cannot update iframe size: iframe-column element or size classes not found.");
              return;
         }
         console.log(`Updating iframe column size to index ${iframeSizeIndex}.`);

         IFRAME_SIZE_CLASSES.forEach(cls => {
              // Remove only the 'lX' classes we manage, preserve other W3.CSS classes like w3-col, mX, sX
              if (cls.startsWith('l')) {
                   mainIframeColumn.classList.remove(cls);
              }
         });

         const currentSizeClass = IFRAME_SIZE_CLASSES[iframeSizeIndex];
         if (currentSizeClass) {
             mainIframeColumn.classList.add(currentSizeClass);
         } else {
              console.warn(`Invalid iframeSizeIndex: ${iframeSizeIndex}`);
         }

         // Update button states
         if (increaseIframeSizeButton) {
              increaseIframeSizeButton.disabled = iframeSizeIndex >= IFRAME_SIZE_CLASSES.length - 1;
         }
          if (decreaseIframeSizeButton) {
               decreaseIframeSizeButton.disabled = iframeSizeIndex <= 0;
          }
     }

     /**
      * Increases the size index for main viewer iframes.
      */
     function increaseIframeSize() {
          if (iframeSizeIndex < IFRAME_SIZE_CLASSES.length - 1) {
              iframeSizeIndex++;
              updateIframeSize();
              console.log(`Increased iframe size to index ${iframeSizeIndex}`);
          }
     }

     /**
      * Decreases the size index for main viewer iframes.
      */
     function decreaseIframeSize() {
          if (iframeSizeIndex > 0) {
              iframeSizeIndex--;
              updateIframeSize();
              console.log(`Decreased iframe size to index ${iframeSizeIndex}`);
          }
     }


     // --- Autocomplete Search Functions ---

     /**
      * Sets up the jQuery UI Autocomplete widget on the user search input.
      */
     function setupUserAutocomplete() {
         if (!userSearchInput || typeof $.fn.autocomplete !== 'function') {
              console.warn("Cannot setup user autocomplete: Search input not found or jQuery UI Autocomplete not loaded.");
              if (userSearchInput) userSearchInput.disabled = true;
              return;
         }
          console.log("Setting up user autocomplete...");

         $(userSearchInput).autocomplete({
             minLength: AUTOCOMPLETE_MIN_LENGTH,
             delay: AUTOCOMPLETE_DELAY,
             source: function(request, response) {
                 const term = request.term.toLowerCase();
                 const availableUsernames = getAllUsernames();
                 const filteredSuggestions = availableUsernames.filter(username =>
                     username.toLowerCase().includes(term)
                 );
                  response(filteredSuggestions.slice(0, AUTOCOMPLETE_MAX_SUGGESTIONS));
             },
             select: function(event, ui) {
                 event.preventDefault();
                 userSearchInput.value = ui.item.value; // Set input value
                  // Trigger filtering based on selected username
                  applyFiltersAndDisplay();
                 console.log(`User autocomplete selected: ${ui.item.value}`);
             },
             focus: function(event, ui) {
                 event.preventDefault();
             }
         });

          // Add a change listener to the input to re-apply filters if the user types
          // and doesn't select from autocomplete, or clears the input.
          $(userSearchInput).on('input propertychange change', function() {
               const currentValue = userSearchInput.value.trim().toLowerCase();
               // Only apply filters if the value *changed* or autocomplete isn't open
               // The 'change' event also catches when focus is lost after typing
               if (currentValue !== currentUserSearchTerm || !$(userSearchInput).autocomplete("widget").is(":visible")) {
                    currentUserSearchTerm = currentValue;
                    applyFiltersAndDisplay();
               }
          });

         console.log("User autocomplete setup complete.");
     }

    /**
      * Sets up the jQuery UI Autocomplete widget on the message search input.
      */
    function setupMessageAutocomplete() {
        if (!messageSearchInput || typeof $.fn.autocomplete !== 'function') {
             console.warn("Cannot setup message autocomplete: Search input not found or jQuery UI Autocomplete not loaded.");
             if (messageSearchInput) messageSearchInput.disabled = true;
             return;
        }
         console.log("Setting up message autocomplete...");

        $(messageSearchInput).autocomplete({
            minLength: 0, // Allow searching with empty input (to show all messages)
            delay: AUTOCOMPLETE_DELAY,
            source: function(request, response) {
                 // Filter the loaded messages based on the term
                const term = request.term.toLowerCase();
                const filteredSuggestions = savedMessages
                     .map(msg => msg.text) // Use message text as the source items
                     .filter(text => text.toLowerCase().includes(term));

                 // We typically don't select a message *from* the autocomplete for copying
                 // We just use autocomplete to filter the *list below*
                 // So, we'll filter the displayed list in the 'close' or 'change' event instead of 'select'.
                 response(filteredSuggestions.slice(0, AUTOCOMPLETE_MAX_SUGGESTIONS)); // Provide suggestions but they won't be 'selected' in the standard way
            },
             select: function(event, ui) {
                 // Prevent the default select behavior that modifies the input value
                 event.preventDefault();
                 // Manually set the input value if needed, but the main goal is just to filter the list
                 messageSearchInput.value = ui.item.value;
                  // Trigger the list filtering based on the selected text
                  currentMessageSearchTerm = ui.item.value.trim().toLowerCase();
                  displayMessagesList(savedMessages.filter(msg => msg.text.toLowerCase().includes(currentMessageSearchTerm)));
                 console.log(`Message autocomplete selected: ${ui.item.value}`);
             },
             // Use the 'change' or 'close' event to trigger list filtering
              change: function(event, ui) {
                  // This fires when the input value changes AND autocomplete is closed or no item selected
                   const currentValue = messageSearchInput.value.trim().toLowerCase();
                   // Only filter if the value changed
                   if (currentValue !== currentMessageSearchTerm) {
                       currentMessageSearchTerm = currentValue;
                       displayMessagesList(savedMessages.filter(msg => msg.text.toLowerCase().includes(currentMessageSearchTerm)));
                        console.log(`Message autocomplete changed/lost focus. Filtering list by: ${currentMessageSearchTerm}`);
                   }
              },
               // Optional: Filter on 'input' for more immediate feedback as user types
               // Be careful with performance on very large message lists
               open: function() { /* Optional: Style the list when open */ },
               close: function() {
                    // Ensure filtering happens when the autocomplete dropdown is closed,
                    // in case the user didn't select an item but changed the text
                   const currentValue = messageSearchInput.value.trim().toLowerCase();
                   if (currentValue !== currentMessageSearchTerm) {
                       currentMessageSearchTerm = currentValue;
                       displayMessagesList(savedMessages.filter(msg => msg.text.toLowerCase().includes(currentMessageSearchTerm)));
                       console.log(`Message autocomplete closed. Filtering list by: ${currentMessageSearchTerm}`);
                   }
               }
        })
         // Add an input listener to re-filter the *displayed list* as the user types,
         // even before autocomplete selects or closes.
         .on('input propertychange', function() {
             const currentValue = messageSearchInput.value.trim().toLowerCase();
              // Only filter if the value actually changed
             if (currentValue !== currentMessageSearchTerm) {
                 currentMessageSearchTerm = currentValue;
                 // Perform filtering directly on the savedMessages array
                 const filteredMessages = savedMessages.filter(msg =>
                     currentMessageSearchTerm === '' || msg.text.toLowerCase().includes(currentMessageSearchTerm)
                 );
                 displayMessagesList(filteredMessages);
                  console.log(`Message input changed. Filtering list by: ${currentMessageSearchTerm}`);
             }
         });


        console.log("Message autocomplete setup complete.");
    }


     // --- NEW Image Recognition Functions ---

     /**
      * Loads the MobileNet model. Needs TensorFlow.js to be loaded first.
      * @returns {Promise<void>}
      */
     async function loadMobileNetModel() {
         if (mobilenetModel) {
              console.log("MobileNet model already loaded.");
              return; // Already loaded
         }
         if (typeof tf === 'undefined' || typeof mobilenet === 'undefined') {
              console.error("TensorFlow.js or MobileNet script not loaded. Cannot load model.");
              showRecognitionStatus("Recognition failed: TensorFlow.js or MobileNet missing.", 'error');
              return; // Scripts not available
         }
         console.log("Loading MobileNet model...");
          showRecognitionStatus("Loading recognition model...", 'loading');
         try {
             mobilenetModel = await mobilenet.load();
             console.log("MobileNet model loaded successfully.");
             showRecognitionStatus("Recognition model loaded.", 'info');
             // Clear status after a brief moment
              setTimeout(() => showRecognitionStatus(''), 3000);
         } catch (error) {
             console.error("Failed to load MobileNet model:", error);
              showRecognitionStatus(`Recognition failed: Model load error - ${error.message}`, 'error');
         }
     }

     /**
      * Processes the analysis queue sequentially.
      */
     async function processAnalysisQueue() {
         if (isAnalyzing || analysisQueue.length === 0 || !mobilenetModel) {
             // Stop if already running, nothing to process, or model not loaded
             isAnalyzing = false; // Ensure flag is false if queue is empty
             if (analysisQueue.length === 0) showRecognitionStatus(''); // Hide status if done
             return;
         }

         isAnalyzing = true;
         console.log(`Starting analysis queue processing (${analysisQueue.length} items).`);
          showRecognitionStatus(`Analyzing ${analysisQueue.length} images...`, 'loading');

         while (analysisQueue.length > 0 && mobilenetModel && displayMode === 'image') {
             const { username, imageUrl, element } = analysisQueue.shift(); // Get the next item

             // Find the user object in the main data array to store results
             const user = allOnlineUsersData.find(u => u.username === username);

             if (user && displayMode === 'image') { // Double-check mode and user exists
                  try {
                      // Check if element is still in the DOM and visible
                      const imageElement = element.querySelector('img');
                      if (imageElement && imageElement.isConnected && isElementInViewport(element)) {
                           console.log(`Analyzing image for ${username}...`);
                           const predictions = await mobilenetModel.classify(imageElement);
                           console.log(`Analysis results for ${username}:`, predictions);

                           // Filter results by confidence threshold and limit number
                           const filteredPredictions = predictions.filter(p => p.probability >= IMAGE_RECOGNITION_CONFIDENCE_THRESHOLD)
                                                                .slice(0, IMAGE_RECOGNITION_MAX_RESULTS);

                           // Store results on the user object state
                           user.recognition_results = filteredPredictions;
                           user.recognition_timestamp = Date.now();
                            // Update the dataset flag
                            element.dataset.recognized = 'true';


                           // Update the specific user element in the DOM with results
                           const detailsDiv = element.querySelector('.user-details');
                           const existingResultsDiv = detailsDiv.querySelector('.recognition-results');

                           if (detailsDiv) {
                                const resultsHtml = buildRecognitionResultsHtml(filteredPredictions);
                                if (existingResultsDiv) {
                                    existingResultsDiv.outerHTML = resultsHtml; // Replace placeholder/old results
                                } else {
                                     // Insert results before the end of details
                                     detailsDiv.insertAdjacentHTML('beforeend', resultsHtml);
                                }
                           }

                           showRecognitionStatus(`Analyzing... (${analysisQueue.length} remaining)`);

                      } else {
                           // Element not visible or removed, skip analysis for this image in this pass
                           console.log(`Skipping analysis for ${username} (element not visible or removed).`);
                            // If the element is gone, maybe mark user as needing re-analysis next time?
                            // For now, just drop from queue.
                      }

                  } catch (error) {
                      console.error(`Error analyzing image for ${username}:`, error);
                      // Update the specific user element in the DOM with an error message
                      const detailsDiv = element.querySelector('.user-details');
                      const existingResultsDiv = detailsDiv.querySelector('.recognition-results');
                       if (detailsDiv) {
                            const errorHtml = `<div class="recognition-results w3-text-red w3-small">Analysis failed.</div>`;
                            if (existingResultsDiv) {
                                existingResultsDiv.outerHTML = errorHtml;
                            } else {
                                detailsDiv.insertAdjacentHTML('beforeend', errorHtml);
                            }
                       }
                       // Mark user state to indicate failure/needs retry?
                       user.recognition_results = null;
                       user.recognition_timestamp = 0;
                       element.dataset.recognized = 'error'; // Indicate error state

                  }
             } else {
                  console.log(`Skipping analysis for ${username} (user not found or mode changed).`);
             }

             // Add a small delay between processing images
             await new Promise(resolve => setTimeout(resolve, ANALYSIS_DELAY));
         }

         isAnalyzing = false;
         console.log("Analysis queue processing finished.");
          if (analysisQueue.length === 0) {
               showRecognitionStatus("Image recognition complete.", 'info');
               setTimeout(() => showRecognitionStatus(''), 3000); // Hide success status
          } else {
               // If loop stopped because mode changed, indicate remaining queue
               showRecognitionStatus(`Analysis paused (${analysisQueue.length} remaining). Switch to Image mode to resume.`, 'warning');
          }
     }

     /**
      * Helper to check if an element is currently visible in the viewport.
      * Simplified check - does not use IntersectionObserver.
      * @param {HTMLElement} el - The element to check.
      * @returns {boolean} True if in viewport, false otherwise.
      */
     function isElementInViewport(el) {
         const rect = el.getBoundingClientRect();
         return (
             rect.top >= 0 &&
             rect.left >= 0 &&
             rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
             rect.right <= (window.innerWidth || document.documentElement.clientWidth)
         );
     }


    // --- Collapsible Sections ---
    /**
     * Toggles the visibility of a control section and updates the icon.
     * Exposes this function globally so HTML onclick works.
     * @param {string} sectionId - The ID of the section div ('filters', 'display', etc.).
     */
    function toggleSection(sectionId) {
        const section = document.getElementById(`${sectionId}Section`);
        const icon = document.getElementById(`${sectionId}ToggleIcon`);
        if (section && icon) {
            if (section.classList.contains('w3-hide')) {
                section.classList.remove('w3-hide');
                icon.textContent = '▲'; // Up arrow
            } else {
                section.classList.add('w3-hide');
                icon.textContent = '▼'; // Down arrow
            }
        } else {
             console.warn(`Toggle section not found for ID: ${sectionId}`);
        }
    }


    // --- Initial Setup and Event Listeners ---

    /** Checks if all essential DOM elements are present. Logs errors or warnings. */
    function validateDOMReferences() {
        const criticalMissing = [];
        if (!onlineUsersDiv) criticalMissing.push("#onlineUsers .user-list");
        if (!previousUsersDiv) criticalMissing.push("#previousUsers .user-list");

        // Check core main viewer elements
        if (!mainViewerContainer) criticalMissing.push("#mainViewerContainer");
        if (!iframeWrapper1 || !mainIframe) criticalMissing.push("#iframeWrapper1 / #mainIframe");
        if (!iframeWrapper2 || !mainIframe2) criticalMissing.push("#iframeWrapper2 / #mainIframe2");
        if (!mainIframeColumn) criticalMissing.push(".iframe-column");


        if (!storageTypeSelector) criticalMissing.push("#storageType");
        if (!filterTagsSelect) criticalMissing.push("#filterTags");
        if (!filterAgeSelect) criticalMissing.push("#filterAge");

        // Check control buttons
        if (!toggleAutoScrollButton) criticalMissing.push("#toggleAutoScroll");
        if (!toggleDisplayModeButton) criticalMissing.push("#toggleDisplayMode");
        if (!toggleIframeCountButton) criticalMissing.push("#toggleIframeCount");
        if (!increaseIframeSizeButton) criticalMissing.push("#increaseIframeSize");
        if (!decreaseIframeSizeButton) criticalMissing.push("#decreaseIframeSize");

        // Check search inputs
        if (!userSearchInput) criticalMissing.push("#userSearchInput");
        if (!messageSearchInput) criticalMissing.push("#messageSearchInput"); // NEW

        // Check messaging elements
        if (!messageInput) criticalMissing.push("#messageInput"); // NEW
        if (!saveMessageButton) criticalMissing.push("#saveMessageButton"); // NEW
        if (!messageListDiv) criticalMissing.push("#messageList"); // NEW

        // Check optional reporting elements (log warnings)
        if (!sendReportButton) console.warn("Optional element missing: #sendReportButton. Reporting functionality disabled.");
        if (!reportLoadingIndicator) console.warn("Optional element missing: #reportLoadingIndicator. Reporting loading feedback unavailable.");
        if (!reportStatusDisplay) console.warn("Optional element missing: #reportStatusDisplay. Reporting status feedback unavailable.");

        // Check optional online list loading/error/recognition elements (log warnings)
        if (!onlineLoadingIndicator) console.warn("Optional element missing: #onlineLoadingIndicator. Online user loading feedback unavailable.");
        if (!onlineErrorDisplay) console.warn("Optional element missing: #onlineErrorDisplay. Online user error feedback unavailable.");
        if (!recognitionStatusDisplay) console.warn("Optional element missing: #recognitionStatus. Image recognition status unavailable.");

         // Check messaging status display (log warning)
         if (!messageStatusDisplay) console.warn("Optional element missing: #messageStatusDisplay. Message saving status feedback unavailable.");

        // Check control section headers (log warnings)
         if (!filterSectionHeader) console.warn("Optional element missing: Filter section header. Toggling disabled.");
         if (!displaySectionHeader) console.warn("Optional element missing: Display section header. Toggling disabled.");
         if (!viewerSectionHeader) console.warn("Optional element missing: Viewer section header. Toggling disabled.");
         if (!messagingSectionHeader) console.warn("Optional element missing: Messaging section header. Toggling disabled."); // NEW
         if (!reportingSectionHeader) console.warn("Optional element missing: Reporting section header. Toggling disabled.");


        if (criticalMissing.length > 0) {
            const errorMsg = `CRITICAL ERROR: Missing essential DOM elements: ${criticalMissing.join(', ')}. Application might not function correctly.`;
            console.error(errorMsg);
            showOnlineErrorDisplay(`Initialization failed: Missing required page elements (${criticalMissing[0]}...). Check HTML.`);
            // Attempt to disable buttons if critical elements are missing
             [
                toggleAutoScrollButton, toggleDisplayModeButton, toggleIframeCountButton,
                increaseIframeSizeButton, decreaseIframeSizeButton, userSearchInput,
                messageSearchInput, saveMessageButton, sendReportButton
            ].forEach(btn => {
                if (btn) {
                    btn.disabled = true;
                    if (btn.tagName === 'BUTTON') btn.textContent = 'Error';
                    if (btn.tagName === 'INPUT') btn.placeholder = 'Error';
                    if (btn.tagName === 'TEXTAREA') btn.placeholder = 'Error';
                }
            });
             // Hide status elements that depend on critical DOM
             if (recognitionStatusDisplay) recognitionStatusDisplay.style.display = 'none';
             if (messageStatusDisplay) messageStatusDisplay.style.display = 'none';

            return false; // Indicate failure
        }

        console.log("DOM references validated. Essential elements found.");
        return true;
    }


    /** Sets up all necessary event listeners for UI elements. */
    function setupEventListeners() {
        console.log("Setting up event listeners...");

        // Storage Type Change
        storageTypeSelector?.addEventListener("change", async function() {
             const newStorageType = this.value;
             console.log(`Storage type changed to: ${newStorageType}`);
             if (newStorageType !== storageType) {
                storageType = newStorageType;
                showOnlineLoadingIndicator("Loading history from new source...");
                previousUsers = await loadUsers("previousUsers");
                displayPreviousUsers(); // Refresh display (always image mode)
                hideOnlineLoadingIndicator();
             }
        });

        // Filter Selects Change (use 'change' event)
        filterTagsSelect?.addEventListener("change", () => applyFiltersAndDisplay());
        filterAgeSelect?.addEventListener("change", () => applyFiltersAndDisplay());

         // --- Specific Filter Buttons ---
         document.getElementById("filterAge18")?.addEventListener("click", () => applyFiltersAndDisplay({ age: 18 }));
         document.getElementById("filterTagAsian")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'asian' }));
         document.getElementById("filterTagBlonde")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'blonde' }));

         // --- Clear History Button ---
         document.getElementById("clearPreviousUsers")?.addEventListener("click", clearPreviousUsers);

         // --- Send Report Button ---
         if (sendReportButton) {
             sendReportButton.addEventListener("click", sendReport);
             console.log("Report button event listener added.");
         }

        // --- Auto-Scroll Button Listener ---
        if (toggleAutoScrollButton) {
             toggleAutoScrollButton.addEventListener("click", function() {
                 if (isAutoScrolling) {
                     stopAutoScroll();
                 } else {
                     startAutoScroll();
                 }
             });
             console.log("Auto-scroll button event listener added.");
        }

         // --- Display Mode Button Listener ---
         if (toggleDisplayModeButton) {
             toggleDisplayModeButton.addEventListener("click", function() {
                  console.log("Display mode toggle clicked.");
                 displayMode = displayMode === 'image' ? 'iframe' : 'image';
                 console.log(`Display mode switched to: ${displayMode}`);
                 toggleDisplayModeButton.textContent = displayMode === 'image' ? 'Show Iframes' : 'Show Images';
                 displayOnlineUsersList(lastFilteredUsers); // Re-display with new mode (triggers analysis queue reset/start)
                 if (onlineUsersDiv) onlineUsersDiv.scrollTop = 0; // Reset scroll
             });
             console.log("Display mode toggle button event listener added.");
         }

         // --- Iframe Count/Size Button Listeners ---
         if (toggleIframeCountButton) {
              toggleIframeCountButton.addEventListener("click", toggleIframeCount);
              console.log("Toggle iframe count button listener added.");
         }
         if (increaseIframeSizeButton) {
              increaseIframeSizeButton.addEventListener("click", increaseIframeSize);
               console.log("Increase iframe size button listener added.");
         }
          if (decreaseIframeSizeButton) {
               decreaseIframeSizeButton.addEventListener("click", decreaseIframeSize);
                console.log("Decrease iframe size button listener added.");
          }

        // --- NEW Messaging Button Listener ---
        if (saveMessageButton) {
             saveMessageButton.addEventListener("click", saveMessage);
             console.log("Save message button listener added.");
        }
         // Allow saving message on Enter key in textarea
         if (messageInput) {
             messageInput.addEventListener("keypress", function(event) {
                  if (event.key === 'Enter' && !event.shiftKey) { // Shift+Enter for newline
                      event.preventDefault(); // Prevent default Enter behavior (newline)
                      saveMessage();
                  }
             });
         }


        // --- Listener to stop auto-scroll on manual list scroll ---
        if (onlineUsersDiv) {
             onlineUsersDiv.addEventListener("scroll", handleManualScroll);
             console.log("Manual scroll listener added to online users list.");
        }

         // --- Autocomplete Search Setups ---
         // User search (already handled in previous update, just ensure it's called)
         if (userSearchInput) setupUserAutocomplete();
         // Message search (NEW)
         if (messageSearchInput) setupMessageAutocomplete();

         // --- Set up collapsible section toggling ---
         // The onclicks in HTML call the global window.toggleSection function
         // Ensure this function is exposed globally in initializeApp or here if preferred
         // window.toggleSection = toggleSection; // Already added this in initializeApp

        console.log("Event listeners setup complete.");
    }


    // --- Application Initialization Sequence ---

    async function initializeApp() {
        console.log("Initializing application...");

        // Validate critical DOM elements first
        if (!validateDOMReferences()) {
             console.error("Initialization aborted due to missing critical DOM elements.");
             return;
        }

         // Expose toggleSection function globally so HTML onclick works
         window.toggleSection = toggleSection;

         // Set initial states for controls
         displayMode = 'image'; // Start online list in image mode
         if (toggleDisplayModeButton) toggleDisplayModeButton.textContent = 'Show Iframes';
         iframeCount = 2; // Start with 2 viewports
         iframeSizeIndex = 0; // Start with default size (l6)
         currentUserSearchTerm = ''; // Clear any default search input value
         currentMessageSearchTerm = ''; // Clear any default message search input value


        // 1. Load MobileNet model (async, but doesn't block other init)
         // Need to ensure jQuery UI is loaded if using autocomplete
         if (typeof $ === 'undefined' || typeof $.fn.autocomplete === 'undefined') {
             console.error("jQuery or jQuery UI not loaded. Autocomplete and other jQuery-based features disabled.");
              // Disable relevant buttons/inputs if jQuery/UI are missing
              [userSearchInput, messageSearchInput].forEach(input => {
                  if(input) {
                       input.disabled = true;
                       input.placeholder = 'jQuery UI Missing';
                   }
               });
              // Don't disable all buttons, some are pure JS (like scroll/display toggle if no list/viewer is critical)
         } else {
             // Load the ML model only if jQuery is present (as it's used in the processAnalysisQueue example)
             // Or ensure processAnalysisQueue doesn't rely directly on jQuery DOM manipulation
              loadMobileNetModel(); // Start model loading
         }


        // 2. Populate storage options dropdown
        await populateStorageOptions(); // Sets initial `storageType` based on selector

        // 3. Setup event listeners for UI elements (including new buttons, search, messaging)
        setupEventListeners();

        // 4. Load initial user history from the selected storage
        showOnlineLoadingIndicator("Loading initial history...");
        previousUsers = await loadUsers("previousUsers");
        console.log(`Initial load: Found ${previousUsers.length} users in history.`);
        // History display will be updated by fetchData()


         // 5. Set up initial main iframe layout and size
         updateIframeLayout(); // This also calls updateIframeSize


        // 6. Load and display initial saved messages from DB
         await loadAndDisplayMessages(); // This populates savedMessages and sets up message autocomplete source


        // 7. Perform the initial fetch of online user data
        // `fetchData` will handle displaying online users (in image mode initially) and the *filtered* previous users
        // It also updates the user autocomplete source.
        await fetchData();


        // 8. Start the periodic fetch interval *after* the first fetch completes
        startFetchInterval();

        // --- Optional: Compatibility Placeholders ---
        if (typeof window.initializeAllUsers === 'function') {
            console.warn("Executing legacy compatibility function: window.initializeAllUsers()");
            window.initializeAllUsers();
        }
        window.initializeAllUsersFromScriptJS = function(callback) {
            console.log("Legacy compatibility function initializeAllUsersFromScriptJS called.");
            if (typeof callback === 'function') callback();
        };
        // --- End Compatibility ---

        console.log("Application initialization complete and periodic fetching started.");
        hideOnlineLoadingIndicator(); // Ensure loading indicator is hidden

        // Initial checks for button states after first render
         if (onlineUsersDiv && toggleAutoScrollButton) {
             if (onlineUsersDiv.scrollHeight > onlineUsersDiv.clientHeight) {
                 toggleAutoScrollButton.disabled = false;
                 toggleAutoScrollButton.textContent = 'Start Auto-Scroll Online';
                 toggleAutoScrollButton.classList.remove('w3-red');
                 toggleAutoScrollButton.classList.add('w3-green');
             } else {
                 toggleAutoScrollButton.disabled = true;
                 toggleAutoScrollButton.textContent = 'Not Scrollable';
                  toggleAutoScrollButton.classList.remove('w3-red');
                  toggleAutoScrollButton.classList.add('w3-green');
             }
         } else if (toggleAutoScrollButton) {
              toggleAutoScrollButton.disabled = true;
              toggleAutoScrollButton.textContent = 'List Element Missing';
              toggleAutoScrollButton.classList.remove('w3-red');
              toggleAutoScrollButton.classList.add('w3-green');
         }
          // Disable display mode button if online list element is missing
          if (!onlineUsersDiv && toggleDisplayModeButton) {
               toggleDisplayModeButton.disabled = true;
               toggleDisplayModeButton.textContent = 'List Element Missing';
          }
           // Disable iframe count/size buttons if main viewer container is missing
           if (!mainViewerContainer || !mainIframeColumn) {
               if (toggleIframeCountButton) { toggleIframeCountButton.disabled = true; toggleIframeCountButton.textContent = 'Viewer Missing'; }
               if (increaseIframeSizeButton) { increaseIframeSizeButton.disabled = true; }
               if (decreaseIframeSizeButton) { decreaseIframeSizeButton.disabled = true; }
           }
           // Disable messaging buttons/inputs if elements are missing
            if (!messageInput || !saveMessageButton || !messageListDiv) {
                 if (messageInput) { messageInput.disabled = true; messageInput.placeholder = 'Messaging elements missing'; }
                 if (saveMessageButton) { saveMessageButton.disabled = true; saveMessageButton.textContent = 'Messaging Error'; }
                 if (messageListDiv) { messageListDiv.innerHTML = '<p class="text-muted w3-center w3-text-red">Messaging elements missing.</p>'; }
            }
             // Disable search inputs if elements are missing (already handled in setup functions, but double check)
            if (!userSearchInput) { if(userSearchInput) { userSearchInput.disabled = true; userSearchInput.placeholder = 'Search missing'; } }
            if (!messageSearchInput) { if(messageSearchInput) { messageSearchInput.disabled = true; messageSearchInput.placeholder = 'Search missing'; } }


           // Open default sections on load
           // toggleSection('filters'); // Example: keep filters closed initially
           toggleSection('display');
           toggleSection('viewer');
           toggleSection('messaging'); // Open messaging by default?
           // toggleSection('reporting'); // Example: reporting closed initially
    }

    // --- Fetch Interval Control ---
    function startFetchInterval() {
         if (fetchInterval) {
             clearInterval(fetchInterval);
             console.log("Cleared existing fetch interval.");
         }
         console.log(`Starting periodic fetch interval (${fetchIntervalDuration / 1000} seconds).`);
         fetchInterval = setInterval(async () => {
             console.log("Interval triggered: Fetching updated data...");
             // fetchData will call stopAutoScroll() internally before updating the list
             await fetchData();
         }, fetchIntervalDuration);
    }


    // --- Start the application ---
    initializeApp().catch(error => {
        console.error("Unhandled error during application initialization:", error);
        showOnlineErrorDisplay(`Fatal initialization error: ${error.message}. Please refresh or check console.`);
        hideOnlineLoadingIndicator();
        hideReportLoading();
         // Ensure all relevant buttons/inputs are disabled on fatal error
        [
            toggleAutoScrollButton, toggleDisplayModeButton, toggleIframeCountButton,
            increaseIframeSizeButton, decreaseIframeSizeButton, userSearchInput,
            messageSearchInput, saveMessageButton, sendReportButton
        ].forEach(btn => {
            if (btn) {
                btn.disabled = true;
                 if (btn.tagName === 'BUTTON') btn.textContent = 'Error';
                 if (btn.tagName === 'INPUT') btn.placeholder = 'Error';
                 if (btn.tagName === 'TEXTAREA') btn.placeholder = 'Error';
            }
        });
        if (recognitionStatusDisplay) showRecognitionStatus('Initialization Error', 'error');
         if (messageStatusDisplay) showStatusMessage(messageStatusDisplay, 'Initialization Error', 'error');
         if (onlineUsersDiv) onlineUsersDiv.innerHTML = '<p class="text-muted w3-center w3-text-red">Fatal initialization error.</p>';
         if (messageListDiv) messageListDiv.innerHTML = '<p class="text-muted w3-center w3-text-red">Fatal initialization error.</p>';

    });

}); // End DOMContentLoaded
