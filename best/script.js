/**
 * Room Viewer Application Script
 * Handles fetching, filtering, displaying online users (as images or iframes)
 * with image recognition results, managing viewing history (previous users),
 * storing and managing text messages with search/autocomplete, sending reports,
 * adding auto-scrolling for the online user list, and dynamic main iframe layout (2/4).
 * Uses W3.CSS, jQuery, jQuery UI, and TensorFlow.js via CDNs.
 */
document.addEventListener('DOMContentLoaded', async function() {

    console.log("DOM fully loaded. Initializing application...");

    // --- API Configuration ---
    // NOTE: Replace with your actual API endpoints, limits, and intervals
    const apiUrlBase = 'https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip'; // <-- CONFIGURE THIS
    const apiLimit = 50; // Number of users per API request
    const maxApiFetchLimit = 500; // Safety limit for total users fetched per cycle
    const fetchIntervalDuration = 60000; // Fetch interval in milliseconds (e.g., 60000 = 1 minute)
    const apiFetchTimeout = 15000; // Timeout for individual API requests

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
    // NOTE: These are for the SMALL preview iframes in the list, NOT the main viewer.
    // The main viewer iframes are styled with fixed 850x480 dimensions via CSS.
    const LIST_IFRAME_BASE_URL = 'https://chaturbate.com/embed/';
    const LIST_IFRAME_PARAMS = '?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black&aspect=0.5625'; // Aspect 0.5625 is 9/16

    // --- Config for Main Viewer Iframes ---
    // NOTE: The size (850x480) is enforced by CSS rules for .iframe-wrapper
    const MAIN_IFRAME_BASE_URL = 'https://chaturbate.com/embed/'; // Or 'fullvideo'
    const MAIN_IFRAME_PARAMS = '?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black';


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


    // --- DOM References (Declare here, validate in initializeApp) ---
    let onlineUsersDiv = null;
    let previousUsersDiv = null;

    // Main Viewer DOM Refs
    let mainViewerContainer = null;
    let iframeWrapper1 = null;
    let mainIframe1 = null; // Renamed for clarity
    let iframeWrapper2 = null;
    let mainIframe2 = null;
    let iframeWrapper3 = null;
    let mainIframe3 = null;
    let iframeWrapper4 = null;
    let mainIframe4 = null;
    let mainIframes = []; // Array for easy access
    let iframeWrappers = []; // Array for easy access
    let mainIframeColumn = null; // The parent column

    // Filter DOM Refs
    let storageTypeSelector = null;
    let filterTagsSelect = null;
    let filterAgeSelect = null;
    let clearPreviousUsersButton = null; // Added ref

    // Reporting DOM Refs
    let sendReportButton = null;
    let reportLoadingIndicator = null;
    let reportStatusDisplay = null;

    // Online List Loading/Error DOM Refs
    let onlineLoadingIndicator = null;
    let onlineErrorDisplay = null;
    let recognitionStatusDisplay = null;

    // Buttons
    let toggleAutoScrollButton = null;
    let toggleDisplayModeButton = null;
    let toggleIframeCountButton = null;
    // Removed iframe size buttons: let increaseIframeSizeButton = null; let decreaseIframeSizeButton = null;

    // Search DOM Refs
    let userSearchInput = null;
    let messageSearchInput = null;

    // Messaging DOM Refs
    let messageInput = null;
    let saveMessageButton = null;
    let messageListDiv = null;
    let messageStatusDisplay = null;

    // Collapsible Section Headers
    let filterSectionHeader = null;
    let displaySectionHeader = null;
    let viewerSectionHeader = null;
    let messagingSectionHeader = null;
    let reportingSectionHeader = null;


    // --- State Variables ---
    let storageType = 'indexedDB'; // Default storage type
    const historyStorageKey = 'previousUsers'; // Key for storing history in Local/Session/IndexedDB
    const maxHistorySize = 200; // Maximum number of users to keep in history

    let previousUsers = []; // Array of { username, timestamp, ...other data needed for display }
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
    // Removed iframeSizeIndex and related state

    // Search State
    let currentUserSearchTerm = ''; // For online user search
    let currentMessageSearchTerm = ''; // For message search

    // Messaging State
    let savedMessages = []; // Array to hold loaded messages


    // --- Helper Functions ---

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
             // Use UTC date parts for consistency
            const birthDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
            if (isNaN(birthDate.getTime())) {
                 console.warn("Invalid date encountered in isBirthday:", birthday);
                 return false;
            }
             // Compare month and day using UTC methods
            return today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() === birthDate.getUTCDate();
        } catch (e) {
             console.error("Error checking birthday for:", birthday, e);
             return false;
        }
    }

    /**
     * Calculates the number of days since the user's 18th birthday, assuming API age 18 is correct.
     * This is complex due to potential API age calculation differences vs standard date math.
     * This function attempts to calculate days since the *specific date* they turned 18.
     * @param {string | null | undefined} birthdayString - The birthday string (YYYY-MM-DD).
     * @param {number | null | undefined} apiAge - The user's current age as reported by API.
     * @returns {number | null} Number of days since the 18th birthday, or null if not age 18 or calculation fails/inconsistent.
     */
    function getDaysSince18thBirthday(birthdayString, apiAge) {
        if (!birthdayString || typeof birthdayString !== 'string' || apiAge !== 18) {
            return null;
        }

        try {
            const today = new Date(); // Use local time for comparison
            const parts = birthdayString.split('-');
             if (parts.length !== 3) return null;

            const birthYear = parseInt(parts[0], 10);
            const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
            const birthDay = parseInt(parts[2], 10);

            // Calculate the date of their 18th birthday
            const eighteenthBirthday = new Date(birthYear + 18, birthMonth, birthDay);

            // Check if the 18th birthday has happened yet (compare dates directly)
            if (eighteenthBirthday > today) {
                 // API reports age 18, but 18th birthday is in the future.
                 // This is inconsistent with a standard age calculation.
                 // Log a warning, cannot calculate days *since* 18th birthday.
                 console.warn(`User (Birth: ${birthdayString}, API Age: ${apiAge}) 18th birthday (${eighteenthBirthday.toISOString().split('T')[0]}) is in the future.`);
                return null;
            }

            // Calculate the date of their 19th birthday
             const nineteenthBirthday = new Date(birthYear + 19, birthMonth, birthDay);

            // Check if the 19th birthday has already happened
            if (nineteenthBirthday <= today) {
                 // API reports age 18, but 19th birthday has passed.
                 // This is inconsistent with a standard age calculation.
                 console.warn(`User (Birth: ${birthdayString}, API Age: ${apiAge}) 19th birthday (${nineteenthBirthday.toISOString().split('T')[0]}) has passed.`);
                return null;
            }

            // If 18th birthday has passed, and 19th has not, API age 18 is consistent.
            // Calculate days difference between today and the 18th birthday date.
             // Use UTC dates for calculation to avoid timezone issues affecting the diff logic.
             const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
             const eighteenthBirthdayUtc = Date.UTC(eighteenthBirthday.getUTCFullYear(), eighteenthBirthday.getUTCMonth(), eighteenthBirthday.getUTCDate());
             const diffMs = todayUtc - eighteenthBirthdayUtc;
             const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            return days >= 0 ? days : null; // Should be non-negative if 18th birthday has passed

        } catch (e) {
             console.error("Error calculating days since 18th birthday for:", birthdayString, e);
             return null;
        }
    }


    // --- Storage Functions ---

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
     * Loads data from the selected storage type.
     * @param {string} key - The key to retrieve (e.g., 'previousUsers').
     * @returns {Promise<Array<Object>>} Resolves with the data array, or an empty array if not found or on error.
     */
     async function loadUsers(key = historyStorageKey) {
         console.log(`Attempting to load history from: ${storageType} with key '${key}'`);
         try {
             if (storageType === 'local') {
                 const data = localStorage.getItem(key);
                 return data ? JSON.parse(data) : [];
             } else if (storageType === 'session') {
                 const data = sessionStorage.getItem(key);
                 return data ? JSON.parse(data) : [];
             } else if (storageType === 'indexedDB' || storageType.startsWith('indexedDB:')) {
                 // Use the key directly for IndexedDB load
                 const idbKey = storageType.startsWith('indexedDB:') ? storageType.substring('indexedDB:'.length) : key;
                  return await loadFromIndexedDB(idbKey);
             }
         } catch (e) {
             console.error(`Error loading from ${storageType} with key '${key}':`, e);
         }
         return [];
     }

     /**
      * Saves data to the selected storage type.
      * @param {Array<Object>} users - The array of user objects to save.
      * @param {string} key - The key to save under (e.g., 'previousUsers').
      * @returns {Promise<void>} Resolves when the save is complete, rejects on error.
      */
     async function saveUsers(users, key = historyStorageKey) {
         if (!Array.isArray(users)) {
             console.error(`Attempted to save non-array data to ${storageType} for key '${key}'. Aborting. Data:`, users);
             return Promise.reject(new Error("Invalid data type: Expected an array."));
         }
         console.log(`Attempting to save ${users.length} users to: ${storageType} with key '${key}'`);
         try {
             const data = JSON.stringify(users);
             if (storageType === 'local') {
                 localStorage.setItem(key, data);
             } else if (storageType === 'session') {
                 sessionStorage.setItem(key, data);
             } else if (storageType === 'indexedDB' || storageType.startsWith('indexedDB:')) {
                 // Use the key directly for IndexedDB save
                  const idbKey = storageType.startsWith('indexedDB:') ? storageType.substring('indexedDB:'.length) : key;
                 await saveToIndexedDB(idbKey, users); // saveToIndexedDB expects the value directly
             }
             console.log("Save successful.");
             return Promise.resolve();
         } catch (e) {
             console.error(`Error saving to ${storageType} with key '${key}':`, e);
             // Handle potential quota exceeded errors for localStorage/sessionStorage
             if (e instanceof DOMException && (e.code === 22 || e.code === 1014 || e.name === 'QuotaExceededError')) {
                  console.error("Storage quota exceeded.");
                  showOnlineErrorDisplay("Storage quota exceeded. Cannot save history.");
                  return Promise.reject(new Error("Storage quota exceeded."));
             }
             showOnlineErrorDisplay(`Error saving history: ${e.message}`);
             return Promise.reject(e);
         }
     }

     /**
      * Loads data for a specific key from the IndexedDB 'users' store.
      * @param {string} key - The key to retrieve.
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
              transaction.onerror = (event) => { console.error(`IDB load transaction error for ${key}:`, event.target.error); db.close(); };
              transaction.onabort = (event) => { console.error(`IDB load transaction aborted for ${key}:`, event.target.error); db.close(); };
         });
     }

     /**
      * Saves data (an array of users) for a specific key to the IndexedDB 'users' store.
      * @param {string} key - The key to save under.
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
             const request = store.put({ key: key, value: users }); // 'put' will add or update based on key

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
      async function getIndexedDBKeys() {
          let db;
          try {
              db = await openIndexedDB();
          } catch (error) {
              console.error("Failed to open IndexedDB for getting keys:", error);
              return [];
          }

          return new Promise((resolve) => {
              const transaction = db.transaction('users', 'readonly');
              const store = transaction.objectStore('users');
              const request = store.getAllKeys();

              request.onsuccess = function(event) {
                  // Filter out the default key if needed, or include all user list keys
                  const keys = event.target.result || [];
                  // Optionally filter keys, e.g., remove internal keys if any are added later
                  resolve(keys.filter(key => key !== 'someInternalKey')); // Example filter
              };
              request.onerror = function(event) {
                  console.error("IndexedDB GetAllKeys Error:", event.target.error);
                  resolve([]);
              };
              transaction.oncomplete = () => { db.close(); };
              transaction.onerror = (event) => { console.error("IDB getAllKeys transaction error:", event.target.error); db.close(); };
               transaction.onabort = (event) => { console.error("IDB getAllKeys transaction aborted:", event.target.error); db.close(); };
          });
      }


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
             transaction.onerror = (event) => { console.error("IDB load all messages transaction error:", event.target.error); db.close(); };
              transaction.onabort = (event) => { console.error("IDB load all messages transaction aborted:", event.target.error); db.close(); };
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
            const apiUrl = `${apiUrlBase}?limit=${apiLimit}&offset=${offset}`; // Use query params
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
                         continueFetching = false; // No results means no more pages
                     }
                 } else {
                     console.warn(`fetchData: Response JSON does not contain a valid 'results' array from offset ${offset}:`, data);
                      showOnlineErrorDisplay(`API response format error from offset ${offset}. Check console.`);
                     continueFetching = false; // Stop fetching if data format is unexpected
                 }

            } catch (error) {
                console.error(`fetchData: Error during fetch for offset ${offset}:`, error);
                 if (error.name === 'AbortError') {
                     showOnlineErrorDisplay(`Failed to fetch data (timeout). Check network or API status.`);
                 } else {
                    showOnlineErrorDisplay(`Failed to fetch data: ${error.message}. Check console.`);
                 }
                continueFetching = false; // Stop fetching on any error
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
             console.log("fetchData: Populating filters, displaying users, and previous users.");
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
              populateFilters([]); // Clear filters
             // Clear User Autocomplete source
              if (userSearchInput && typeof $.fn.autocomplete === 'function') {
                  $(userSearchInput).autocomplete('option', 'source', []);
             }
              applyFiltersAndDisplay(); // Ensure display reflects empty state
              await displayPreviousUsers(); // Display previous users based on potentially stale data
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
    function populateFilters(users) {
         if (!filterTagsSelect || !filterAgeSelect) {
              console.warn("Filter select elements not found. Cannot populate filters.");
              return;
         }
        console.log("Populating filters...");

        const uniqueTags = new Set();
        const uniqueAges = new Set();

        users.forEach(user => {
            if (user.tags && Array.isArray(user.tags)) {
                user.tags.forEach(tag => {
                    if (typeof tag === 'string' && tag.trim() !== '') {
                        uniqueTags.add(tag.trim());
                    }
                });
            }
            if (user.age && typeof user.age === 'number' && user.age > 0) {
                uniqueAges.add(user.age);
            }
        });

        const sortedTags = Array.from(uniqueTags).sort();
        const sortedAges = Array.from(uniqueAges).sort((a, b) => a - b);

        // Save current selections
        const currentSelectedTags = Array.from(filterTagsSelect.selectedOptions).map(opt => opt.value);
        const currentSelectedAges = Array.from(filterAgeSelect.selectedOptions).map(opt => parseInt(opt.value));

        // Populate Tags
        filterTagsSelect.innerHTML = '<option value="">-- All Tags --</option>';
        sortedTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
             if (currentSelectedTags.includes(tag)) {
                 option.selected = true;
             }
            filterTagsSelect.appendChild(option);
        });

        // Populate Ages
        filterAgeSelect.innerHTML = '<option value="">-- All Ages --</option>';
        sortedAges.forEach(age => {
            const option = document.createElement('option');
            option.value = age;
            option.textContent = age;
             if (currentSelectedAges.includes(age)) {
                 option.selected = true;
             }
            filterAgeSelect.appendChild(option);
        });
        console.log("Filters populated.");
    }


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
            // Note: Setting select value programmatically might not work for multiple select easily
            // You might need to iterate options or use a library
            // For quick filter buttons, we'll just apply the filter, not update the multi-select UI
             console.log(`Quick filter applied: Tag = ${buttonFilters.tag}`);
             // Optional: Reset multi-selects if a quick filter is used? User preference.
             // if (filterTagsSelect) Array.from(filterTagsSelect.options).forEach(opt => opt.selected = false);
             // if (filterAgeSelect) Array.from(filterAgeSelect.options).forEach(opt => opt.selected = false);

        } else if (filterTagsSelect) {
            filterTags = Array.from(filterTagsSelect.selectedOptions)
                .map(option => option.value.toLowerCase())
                .filter(tag => tag !== '');
        }

        let filterAges = [];
        if (buttonFilters.age) {
            filterAges = [parseInt(buttonFilters.age)];
             console.log(`Quick filter applied: Age = ${buttonFilters.age}`);
             // Optional: Reset multi-selects
             // if (filterTagsSelect) Array.from(filterTagsSelect.options).forEach(opt => opt.selected = false);
             // if (filterAgeSelect) Array.from(filterAgeSelect.options).forEach(opt => opt.selected = false);
        } else if (filterAgeSelect) {
            filterAges = Array.from(filterAgeSelect.selectedOptions)
                .map(option => parseInt(option.value))
                .filter(age => !isNaN(age) && age > 0);
        }

         // Get the current search term from the user search input if not explicitly filtered by button
         // We still want the user search to combine with dropdowns, but quick buttons *override* dropdowns temporarily.
         if (Object.keys(buttonFilters).length === 0) {
              currentUserSearchTerm = userSearchInput ? userSearchInput.value.trim().toLowerCase() : '';
         } else {
             // If a quick filter button was used, clear the search input? User preference.
             // if (userSearchInput) userSearchInput.value = '';
             currentUserSearchTerm = ''; // Ignore search input if a quick filter is active
         }


        console.log("Active filters:", { filterTags, filterAges, userSearchTerm: currentUserSearchTerm });

        const filteredUsers = allOnlineUsersData.filter(user => {
            if (!user || !user.username || user.current_show !== 'public') {
                 // Must be public and have basic info
                return false;
            }

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

            return hasTags && isAgeMatch && isUserSearchMatch;
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

        onlineUsersDiv.innerHTML = ""; // Clear current list

        if (usersToDisplay.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users match the current filters.</p>';
            // Disable auto-scroll if list is empty
            if (toggleAutoScrollButton) {
                toggleAutoScrollButton.disabled = true;
                toggleAutoScrollButton.textContent = 'Not Scrollable';
                 toggleAutoScrollButton.classList.remove('w3-red');
                 toggleAutoScrollButton.classList.add('w3-green');
            }
             // Clear the analysis queue if the list is empty/hidden
             analysisQueue = [];
             isAnalyzing = false;
             showRecognitionStatus(''); // Hide status
            return;
        }

        onlineUsersDiv.classList.toggle('image-mode', displayMode === 'image');
        onlineUsersDiv.classList.toggle('iframe-mode', displayMode === 'iframe');


        const fragment = document.createDocumentFragment();

        // Clear previous analysis results and queue for these users if switching modes
        // or if fetching new data invalidates old results.
         if (displayMode === 'image' && mobilenetModel) {
              // If switching TO image mode or refreshing image list, clear queue and start fresh
             analysisQueue = [];
             isAnalyzing = false; // Reset analysis state
              showRecognitionStatus('Queuing images for analysis...'); // Indicate process will start
              console.log("Image mode active, clearing analysis queue.");
         } else {
              // If switching TO iframe mode or model not ready, clear queue and hide status
               analysisQueue = [];
               isAnalyzing = false;
               showRecognitionStatus('');
               console.log("Not in image mode or model not ready, analysis queue cleared.");
         }


        usersToDisplay.forEach(user => {
            if (!user || !user.image_url || !user.username) {
                console.warn("Skipping online user display due to incomplete data:", user);
                return;
            }
             // Add recognition results property to the user object if it doesn't exist or is stale
             // A simple timestamp check isn't perfect, a version or fetch time might be better.
             // For simplicity, we'll clear results/queue whenever the list is refreshed/filters change.
             // User object in allOnlineUsersData might retain results, but we rebuild display elements.
             // Let's ensure the user object *in allOnlineUsersData* has a place for results.
             const userInState = allOnlineUsersData.find(u => u.username === user.username);
             if (userInState && displayMode === 'image' && !userInState.recognition_results) {
                 // This user needs analysis, add to queue if in image mode and no results yet
                 analysisQueue.push({
                     username: user.username,
                     imageUrl: user.image_url,
                     // Will find the element by username later, as elements are created now
                 });
                  // Add placeholder recognition state
                   user.recognition_results = null; // Indicates analysis is needed/pending
             } else if (userInState && displayMode === 'image' && userInState.recognition_results) {
                 // User in state has results, use them directly
             } else if (userInState && displayMode === 'iframe') {
                  // Clear results if switching to iframe mode? Or keep them?
                  // Let's keep them on the user object but don't display them.
                  userInState.recognition_results = userInState.recognition_results || null;
             }


            const userElement = createUserElement(user, 'online', displayMode); // Pass the user object with potential results
            fragment.appendChild(userElement);

        });
        onlineUsersDiv.appendChild(fragment);

         // Start processing the analysis queue if there are items and the model is loaded
         if (analysisQueue.length > 0 && mobilenetModel && displayMode === 'image') {
              console.log(`Queued ${analysisQueue.length} images for recognition.`);
              processAnalysisQueue(); // Start the analysis process
         } else if (displayMode === 'image' && mobilenetModel && usersToDisplay.length > 0) {
              // If in image mode, model is loaded, list has users, but queue is empty
              // means all displayed images either have results or their URL was bad.
              console.log("Image mode active, but no new images queued for recognition (already analyzed?).");
               showRecognitionStatus("Recognition results shown below users.", 'info');
               setTimeout(() => showRecognitionStatus(''), 3000); // Hide info status
         } else if (!mobilenetModel && displayMode === 'image' && usersToDisplay.length > 0) {
               console.warn("MobileNet model not loaded. Cannot perform image recognition.");
               showRecognitionStatus("Image recognition not available (model loading failed?).", 'warning');
         } else {
              showRecognitionStatus(''); // Hide status if not in image mode or no users
         }


         // Update auto-scroll button state
         if (toggleAutoScrollButton) {
             // Check if scrollHeight is greater than clientHeight (content overflows)
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
         console.log(`displayPreviousUsers: Refreshing display. History has ${previousUsers.length} users loaded in state.`);
         // Show a temporary message while filtering/rendering
         previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Updating history display...</p>';

         // If previousUsers state is empty, try loading from storage
         if (previousUsers.length === 0) {
             previousUsers = await loadUsers(historyStorageKey);
              console.log(`displayPreviousUsers: Loaded ${previousUsers.length} users from storage.`);
         }

         if (previousUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No viewing history saved.</p>';
            console.log("displayPreviousUsers: No previous users found in state or storage.");
            return;
         }


         // If online user data isn't available yet, we can't filter by online status
         // In this case, display the saved history, but note that online status is unknown.
         if (allOnlineUsersData.length === 0) {
             console.warn("displayPreviousUsers: Online user data not available. Displaying saved history without online status check.");
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">History loaded. Online status check pending fetch.</p>';
              // Display saved users without online check (optional, could also wait)
              // For now, let's just return and wait for fetchData to trigger display again.
              // This prevents showing potentially offline users in the "Online Now" history list.
             return;
         }

         // Filter previous users to show only those currently in the fetched online list and are public
         const onlineUserMap = new Map(allOnlineUsersData.map(user => [user.username, user]));

         const currentlyOnlineAndPublicPreviousUsers = previousUsers.filter(prevUser => {
             const onlineUser = onlineUserMap.get(prevUser.username);
             return onlineUser && onlineUser.current_show === 'public';
         });

         console.log(`displayPreviousUsers: Found ${currentlyOnlineAndPublicPreviousUsers.length} saved users currently online & public.`);

         previousUsersDiv.innerHTML = ""; // Clear the "Updating..." message

         if (currentlyOnlineAndPublicPreviousUsers.length === 0) {
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">None of your saved users are online & public right now.</p>';
              return;
         }

         // Ensure the history list uses image mode classes
         previousUsersDiv.classList.remove('iframe-mode');
         previousUsersDiv.classList.add('image-mode'); // Always image mode

         const fragment = document.createDocumentFragment();
         currentlyOnlineAndPublicPreviousUsers.forEach(user => {
             if (!user || !user.image_url || !user.username) {
                console.warn("Skipping previous user display due to incomplete data:", user);
                return;
            }
             // For history, use the potentially older data stored in the previousUsers array state
             // or merge with current online data if available and desired (e.g., get current viewers count)
             // Let's merge with current online data for freshness where available
              const onlineUserData = onlineUserMap.get(user.username);
              const userForDisplay = onlineUserData || user; // Use online data if available, else historical

             const userElement = createUserElement(userForDisplay, 'previous', 'image'); // Always use 'image' mode for history
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
        // Add a data attribute to store recognition state (useful for debugging/targeting)
        userElement.dataset.recognized = user.recognition_results ? 'true' : (mode === 'image' && !user.recognition_results ? 'pending' : 'N/A');

        const tagsDisplay = (user.tags && Array.isArray(user.tags) && user.tags.length > 0)
                            ? user.tags.join(', ')
                            : 'N/A';
        const ageDisplay = (user.age && typeof user.age === 'number' && user.age > 0) ? user.age : 'N/A';

        let ageDetails = `Age: ${ageDisplay}`;
         // Calculate days since 18th birthday only if age is 18 and birthday is available
        if (user.age === 18 && user.birthday) {
            const daysSinceBday = getDaysSince18thBirthday(user.birthday, user.age);
            if (daysSinceBday !== null) {
                ageDetails = `Age: 18 <span class="age-days">(${daysSinceBday} days)</span>`;
            } else {
                 ageDetails = `Age: 18`; // Fallback if calculation fails or is inconsistent
            }
        }


        const newBadge = user.is_new ? '<span class="badge new-badge w3-tag w3-small w3-red w3-round">New</span>' : '';
        const birthdayBanner = isBirthday(user.birthday) ? `<p class="birthday w3-text-amber w3-center">🎂 Happy Birthday! 🎂</p>` : '';
        const removeButton = listType === 'previous' ? '<button class="remove-user-btn w3-button w3-tiny w3-red w3-hover-dark-grey w3-circle" title="Remove from history">×</button>' : '';

        let mediaContent = '';
        // Use the specific list iframe parameters for list previews
        if (mode === 'iframe') {
             // Append the user's username to the base embed URL
             const iframeSrc = `${LIST_IFRAME_BASE_URL}${user.username}/${LIST_IFRAME_PARAMS}`;
            mediaContent = `
                <div class="iframe-container">
                     <iframe src="${iframeSrc}" frameborder="0" scrolling="no" allowfullscreen loading="lazy"></iframe>
                     <div class="click-overlay"></div> <!-- Overlay to make clicking easier -->
                </div>
            `;
        } else { // mode === 'image'
            mediaContent = `
                <div class="user-image-container">
                    <img src="${user.image_url}" alt="${user.username} thumbnail" loading="lazy" class="w3-image">
                </div>
            `;
        }

        // Add placeholder/results for recognition if in image mode
        let recognitionHtml = '';
        if (mode === 'image') {
             if (user.recognition_results) {
                  recognitionHtml = buildRecognitionResultsHtml(user.recognition_results);
             } else if (user.recognition_results === null) {
                  // null indicates analysis is pending/failed previously, add loading placeholder
                  recognitionHtml = `<div class="recognition-results loading-indicator w3-text-grey w3-small">Analyzing...</div>`;
             } else {
                 // undefined indicates it hasn't been queued, but display mode is image, queue it later
                 // No recognitionHtml placeholder needed yet, it will be added when analysis is complete
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
             // Prevent click handler if clicking the remove button or overlay
             if (event.target.closest('.remove-user-btn') || event.target.closest('.click-overlay')) {
                 return;
             }
             event.preventDefault();
             handleUserClick(user); // Pass the full user object
        });

        const removeBtn = userElement.querySelector('.remove-user-btn');
        if (removeBtn) {
            removeBtn.addEventListener("click", async function(event) {
                event.stopPropagation(); // Prevent triggering parent click
                console.log(`User clicked remove for: ${user.username}`);
                 showOnlineLoadingIndicator(`Removing ${user.username} from history...`); // Use online loading for history actions
                await removeFromPreviousUsers(user.username);
                await displayPreviousUsers(); // Refresh history display
                hideOnlineLoadingIndicator();
            });
        }

         const overlay = userElement.querySelector('.click-overlay');
         if (overlay) {
             // Attach the click listener to the overlay instead of the parent element
             // This prevents the overlay interfering with potential interactions inside the iframe if scrolling was enabled
             // and ensures clicking anywhere on the overlay triggers the user click.
             overlay.addEventListener('click', function(event) {
                 event.stopPropagation(); // Stop propagation from the overlay
                  console.log(`Overlay clicked for: ${user.username}. Triggering handleUserClick.`);
                  handleUserClick(user); // Call handleUserClick directly
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
         // Ensure main viewer iframes are available
         if (mainIframes.length === 0 || mainIframes.every(i => !i)) {
              console.error("Main viewer iframe elements not found. Cannot load user stream.");
              showReportStatus("Viewer iframes not initialized correctly.", 'error');
              return;
         }
         if (!user || !user.username) {
             console.error("Invalid user data passed to handleUserClick:", user);
             return;
         }
        console.log(`User clicked: ${user.username}`);

        // Determine which iframe to use based on radio button selection
        const iframeChoiceRadio = document.querySelector('input[name="iframeChoice"]:checked');
        // Default to the first iframe if no radio is checked or found
        const selectedIframeId = iframeChoiceRadio ? iframeChoiceRadio.value : 'mainIframe1';


        const selectedIframe = document.getElementById(selectedIframeId);

         if (!selectedIframe) {
              console.error(`Selected iframe element '${selectedIframeId}' not found.`);
              showReportStatus(`Selected viewer viewport '${selectedIframeId}' not found.`, 'error');
              return;
         }

         // Construct the main viewer iframe source URL
        const iframeSrc = `${MAIN_IFRAME_BASE_URL}${user.username}/${MAIN_IFRAME_PARAMS}`;

        console.log(`Loading ${user.username} into ${selectedIframeId} with src: ${iframeSrc}`);
        selectedIframe.src = iframeSrc;

        // Add the user to history
        addToPreviousUsers(user).catch(err => {
            console.error(`Error adding ${user.username} to previous users:`, err);
             // Optional: Show error message
             // showReportStatus(`Failed to update history for ${user.username}.`, 'error');
        });
    }


    /**
     * Adds a user to the `previousUsers` state array.
     * Ensures uniqueness (moves to front if exists) and enforces `maxHistorySize`.
     * Saves the updated list to the selected storage.
     * @param {Object} user - The user object to add/move.
     * @returns {Promise<void>}
     */
    async function addToPreviousUsers(user) {
         // Find the user in the current previousUsers array
         const existingIndex = previousUsers.findIndex(u => u.username === user.username);

         // Create a history entry with minimal data, plus a timestamp
         const userEntry = {
             username: user.username,
             image_url: user.image_url, // Save image URL for display
             timestamp: Date.now(), // Add/update timestamp
             // Optionally save other static data like age, tags if needed for display when offline
             age: user.age,
             tags: user.tags,
             is_new: user.is_new,
             birthday: user.birthday,
             // Do NOT save recognition_results here as it changes and inflates storage
         };

         if (existingIndex !== -1) {
             // User exists, remove them from their current position
             const existingUser = previousUsers.splice(existingIndex, 1)[0];
              // Merge any potentially needed fields from the existing entry?
              // For simplicity, just update the timestamp in the new entry
             userEntry.timestamp = Date.now();
         }

         // Add the user entry to the front of the array
         previousUsers.unshift(userEntry);

         // Enforce max history size
         if (previousUsers.length > maxHistorySize) {
             previousUsers = previousUsers.slice(0, maxHistorySize);
             console.log(`History size limited to ${maxHistorySize}.`);
         }

         console.log(`Added/Moved ${user.username} to history. History size: ${previousUsers.length}`);

         // Save the updated history to storage
         await saveUsers(previousUsers, historyStorageKey);

         // Refresh the history display
         await displayPreviousUsers(); // This will filter by online status
    }

     /**
      * Removes a user from the `previousUsers` history state by username.
      * Saves the updated list to the selected storage.
      * @param {string} username - The username to remove.
      * @returns {Promise<void>}
      */
     async function removeFromPreviousUsers(username) {
          const initialLength = previousUsers.length;
          previousUsers = previousUsers.filter(user => user.username !== username);

          if (previousUsers.length < initialLength) {
               console.log(`Removed ${username} from history.`);
               // Save the updated list only if a user was actually removed
               await saveUsers(previousUsers, historyStorageKey);
          } else {
               console.warn(`Attempted to remove ${username} from history, but user not found.`);
          }
     }

     /**
      * Clears the previous users history from both state and the selected storage.
      * @returns {Promise<void>}
      */
     async function clearPreviousUsers() {
         console.log("Attempting to clear history...");
         const confirmClear = confirm("Are you sure you want to clear your viewing history?");
         if (!confirmClear) {
             console.log("History clear cancelled.");
             return;
         }

         // Clear from state
         previousUsers = [];
         console.log("History cleared from state.");

         // Clear from storage
         try {
             if (storageType === 'local') {
                 localStorage.removeItem(historyStorageKey);
             } else if (storageType === 'session') {
                 sessionStorage.removeItem(historyStorageKey);
             } else if (storageType === 'indexedDB' || storageType.startsWith('indexedDB:')) {
                  const idbKey = storageType.startsWith('indexedDB:') ? storageType.substring('indexedDB:'.length) : historyStorageKey;
                  let db;
                  try {
                      db = await openIndexedDB();
                      const transaction = db.transaction('users', 'readwrite');
                      const store = transaction.objectStore('users');
                      const request = store.delete(idbKey); // Delete the specific key

                      await new Promise((resolve, reject) => {
                           request.onsuccess = () => resolve();
                           request.onerror = (event) => reject(event.target.error);
                           transaction.oncomplete = () => { db.close(); resolve(); }; // Ensure close on complete
                           transaction.onerror = (event) => { db.close(); reject(event.target.error); };
                           transaction.onabort = (event) => { db.close(); reject(event.target.error || new Error('Transaction aborted')); };
                      });
                       console.log(`History key '${idbKey}' cleared from IndexedDB.`);

                  } catch (error) {
                       console.error(`Failed to open/clear IndexedDB for key '${idbKey}':`, error);
                      throw error; // Re-throw to be caught below
                  }
             }
             console.log(`History cleared from ${storageType}.`);
             showReportStatus("Viewing history cleared.", 'success'); // Use report status for this action

         } catch (e) {
             console.error(`Error clearing history from ${storageType}:`, e);
              showReportStatus(`Failed to clear history: ${e.message}`, 'error');
         } finally {
             // Always refresh the display after attempting to clear
              await displayPreviousUsers();
              // Re-enable the button if it was disabled during confirmation
              if (clearPreviousUsersButton) clearPreviousUsersButton.disabled = false; // Not needed if confirm is modal
         }
     }


     /**
      * Initializes the options for the storage type selector.
      * Includes standard options (Local, Session, IndexedDB) and any custom keys found in IndexedDB.
      * @returns {Promise<void>}
      */
     async function populateStorageOptions() {
         if (!storageTypeSelector) {
              console.warn("Storage type selector not found. Cannot populate options.");
              return;
         }
          console.log("Populating storage options...");
          const currentSelectedValue = storageTypeSelector.value; // Preserve current selection

         // Clear existing options except the default ones
         storageTypeSelector.innerHTML = `
             <option value="local">Local Storage</option>
             <option value="session">Session Storage</option>
             <option value="indexedDB">IndexedDB (Default History)</option>
         `;

         try {
             const idbKeys = await getIndexedDBKeys();
              console.log("Found IndexedDB keys:", idbKeys);
             idbKeys.forEach(key => {
                  // Add options for other saved IndexedDB keys, except the default history key
                  if (key !== historyStorageKey) {
                      const option = document.createElement('option');
                      option.value = `indexedDB:${key}`; // Prefix to distinguish custom IDB keys
                      option.textContent = `IndexedDB: ${key}`;
                      storageTypeSelector.appendChild(option);
                  }
             });
         } catch (e) {
             console.error("Error getting IndexedDB keys:", e);
             // Continue without adding custom IDB options
         }

          // Restore previous selection if it still exists
          if (currentSelectedValue && storageTypeSelector.querySelector(`option[value="${currentSelectedValue}"]`)) {
               storageTypeSelector.value = currentSelectedValue;
          } else {
               // Default to 'indexedDB' if previous selection is invalid or not found
               storageTypeSelector.value = 'indexedDB';
          }
          storageType = storageTypeSelector.value; // Update state based on final value
          console.log(`Storage options populated. Current type: ${storageType}`);

     }


    // --- NEW Message Functions ---

    /**
     * Reads input, saves message to DB, clears input, and refreshes message list.
     */
    async function saveMessage() {
         if (!messageInput || !messageStatusDisplay || !saveMessageButton) {
              console.warn("Messaging DOM elements missing. Cannot save message.");
              showReportStatus("Messaging feature elements missing.", 'error');
              return;
         }

         const text = messageInput.value.trim();
         if (text === '') {
              showStatusMessage(messageStatusDisplay, "Message is empty.", 'warning');
              return;
         }

         showStatusMessage(messageStatusDisplay, "Saving...", 'loading');
         saveMessageButton.disabled = true;
         messageInput.disabled = true;

         try {
              await saveMessageToIndexedDB({ text: text });
              console.log("Message saved successfully.");
              messageInput.value = ''; // Clear input
              await loadAndDisplayMessages(); // Reload and display messages
              showStatusMessage(messageStatusDisplay, "Message saved!", 'success');
              // Clear success/warning message after a delay
               setTimeout(() => showStatusMessage(messageStatusDisplay, '', 'info', false), 3000);
         } catch (error) {
              console.error("Failed to save message:", error);
              showStatusMessage(messageStatusDisplay, `Error saving message: ${error.message}`, 'error');
         } finally {
             saveMessageButton.disabled = false;
             messageInput.disabled = false;
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

             // Update Message Autocomplete source (using jQuery UI)
              if (typeof $.fn.autocomplete === 'function') {
                   $(messageSearchInput).autocomplete('option', 'source', getAllMessageTexts());
              } else {
                  console.warn("jQuery UI Autocomplete not available for message search.");
                   if(messageSearchInput) messageSearchInput.disabled = true;
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
     * Gets a list of all message texts.
     * Used for message autocomplete source and filtering.
     * @returns {string[]} Array of message texts.
     */
     function getAllMessageTexts() {
         if (!savedMessages || savedMessages.length === 0) {
             return [];
         }
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
     * @param {Object} message - The message object ({ id, text, timestamp }).
     * @returns {HTMLElement} The created message div element.
     */
    function createMessageElement(message) {
        const messageElement = document.createElement("div");
        messageElement.className = "message-item";
        // Set text content directly to prevent HTML injection if message text contains HTML
        messageElement.textContent = message.text;
        messageElement.dataset.messageId = message.id; // Store ID if needed for delete

        // Add click listener to copy text to clipboard
        messageElement.addEventListener("click", function() {
            copyToClipboard(message.text);
        });
        // Optional: Add delete button/listener here

        return messageElement;
    }

    /**
     * Copies text to the user's clipboard.
     * Provides status feedback via the message status display.
     * @param {string} text - The text to copy.
     */
    function copyToClipboard(text) {
         if (!messageStatusDisplay) {
              console.warn("Message status display not found. Cannot provide copy feedback.");
         }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                console.log("Text copied to clipboard:", text);
                 if(messageStatusDisplay) showStatusMessage(messageStatusDisplay, "Copied to clipboard!", 'success');
                 if(messageStatusDisplay) setTimeout(() => showStatusMessage(messageStatusDisplay, '', 'info', false), 2000); // Hide after 2s
            }).catch(err => {
                console.error("Failed to copy text:", err);
                 if(messageStatusDisplay) showStatusMessage(messageStatusDisplay, `Failed to copy: ${err.message}`, 'error');
            });
        } else {
             console.warn("Clipboard API not available.");
             if(messageStatusDisplay) showStatusMessage(messageStatusDisplay, "Copy failed: Clipboard not supported.", 'error');
            // Fallback for older browsers if needed, but less reliable
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
         // Remove all type classes before adding the new one
         element.classList.remove('success', 'error', 'warning', 'info', 'loading');
         element.classList.add(type);

         if (show) {
             // Use inline-block for loading, block for others
             element.style.display = (type === 'loading' || element.classList.contains('loading-indicator')) ? 'inline-block' : 'block';
         } else {
             element.style.display = 'none'; // Hide the element
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
         if (!reportLoadingIndicator || !reportStatusDisplay) {
              console.warn("Reporting status elements missing. Cannot send report.");
              alert("Reporting feature elements missing. Check console.");
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
                // Check if emailjs is available and configured
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
                //           console.error('EmailJS send failed:', result);
                //           showReportStatus(`EmailJS send failed (Status: ${result.status}). See console.`, 'error');
                //      }
                // } else {
                //      console.error("EmailJS SDK not loaded or configuration missing.");
                //      showReportStatus("Report feature not configured. EmailJS SDK missing or keys not set.", 'error');
                //      throw new Error("EmailJS not configured."); // Throw to fall into catch
                // }
                 // Fallback if placeholder method isn't actually implemented/configured
                 throw new Error("Client-side report service not actually implemented/configured in JS.");


            } else if (REPORT_SEND_METHOD === 'mailto') {
                console.log("Using mailto link for report.");
                const subject = encodeURIComponent(`Room Viewer Online User Report (${reportData.length} users)`);
                // Format data for the mailto body (simple text)
                const bodyText = reportData.map(user =>
                    `Username: ${user.username}\nAge: ${user.age}\nTags: ${user.tags ? user.tags.join(', ') : 'N/A'}\nViewers: ${user.num_viewers || 'N/A'}\nBirthday: ${user.birthday || 'N/A'}\nRecognition: ${user.recognition_results || 'N/A'}\n---\n`
                ).join('\n');
                const body = encodeURIComponent("Online Users Report:\n\n" + bodyText);

                const mailtoLink = `mailto:your.email@example.com?subject=${subject}&body=${body}`; // !! REPLACE your.email@example.com !!

                 // Check URL length limit (rough estimate)
                 if (mailtoLink.length > 2000) { // Mailto limits vary, 2000 is a common safe upper bound
                      const errorMsg = `Report data (${mailtoLink.length} chars) too large for mailto link. Reduce filters or use a different report method.`;
                      console.warn(errorMsg);
                      showReportStatus(errorMsg, 'warning');
                      throw new Error(errorMsg); // Stop process
                 }

                window.location.href = mailtoLink;
                showReportStatus("Attempted to open email client with report data.", 'info');

            } else {
                console.error(`Unknown REPORT_SEND_METHOD configured: ${REPORT_SEND_METHOD}`);
                showReportStatus(`Report feature misconfigured: Unknown method '${REPORT_SEND_METHOD}'.`, 'error');
                 throw new Error(`Unknown report method: ${REPORT_SEND_METHOD}`); // Throw to fall into catch
            }

        } catch (error) {
            console.error("Error caught during report sending:", error);
            showReportStatus(`Failed to send report: ${error.message}`, 'error');
        } finally {
            hideReportLoading();
        }
    }


    // --- UI Loading and Error/Status Display Helpers ---
    // Using the showStatusMessage helper for consistency

    function showOnlineLoadingIndicator(message = 'Loading...') {
        if (onlineLoadingIndicator) {
            onlineLoadingIndicator.textContent = message;
            onlineLoadingIndicator.style.display = 'block';
        }
    }
    function hideOnlineLoadingIndicator() {
        if (onlineLoadingIndicator) {
            onlineLoadingIndicator.style.display = 'none';
        }
    }
    function showOnlineErrorDisplay(message) {
         if (onlineErrorDisplay) {
            onlineErrorDisplay.textContent = message;
            onlineErrorDisplay.style.display = 'block';
         }
    }
    function clearOnlineErrorDisplay() {
        if (onlineErrorDisplay) {
            onlineErrorDisplay.textContent = '';
            onlineErrorDisplay.style.display = 'none';
        }
    }

    function showReportLoading(message = 'Processing...') {
         if (reportLoadingIndicator) {
              reportLoadingIndicator.textContent = message;
              showStatusMessage(reportLoadingIndicator, message, 'loading', true);
         }
    }
    function hideReportLoading() {
         if (reportLoadingIndicator) {
            showStatusMessage(reportLoadingIndicator, '', 'info', false);
         }
    }
    function showReportStatus(message, type = 'info') {
        if (reportStatusDisplay) {
             showStatusMessage(reportStatusDisplay, message, type, true);
              // Hide non-error/warning messages after a delay
              if (type === 'success' || type === 'info') {
                   setTimeout(() => clearReportStatus(), 5000); // Hide after 5 seconds
              }
        }
    }
    function clearReportStatus() {
         if (reportStatusDisplay) {
             showStatusMessage(reportStatusDisplay, '', 'info', false);
         }
    }

    /**
     * Displays or hides the image recognition status message.
     * @param {string} message - The message to display. Empty string hides.
     * @param {'loading'|'info'|'warning'|'error'|''} [type='info'] - Status type.
     */
    function showRecognitionStatus(message, type = 'info') {
         if (!recognitionStatusDisplay) return;
         recognitionStatusDisplay.textContent = message;

         recognitionStatusDisplay.classList.remove('w3-text-grey', 'w3-text-amber', 'w3-text-red'); // Reset text color
         recognitionStatusDisplay.classList.remove('loading-indicator'); // Reset loading indicator class

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
     let scrollDirection = 1; // 1 for down, -1 for up
     let isAtEnd = false; // Flag to indicate if at the start or end

     function scrollStep() {
         if (!onlineUsersDiv || !isAutoScrolling) {
             isAutoScrolling = false;
             return;
         }

         const maxScroll = onlineUsersDiv.scrollHeight - onlineUsersDiv.clientHeight;

         if (maxScroll <= 0) {
             // Not enough content to scroll
             stopAutoScroll();
             if (toggleAutoScrollButton) {
                 toggleAutoScrollButton.disabled = true;
                 toggleAutoScrollButton.textContent = 'Not Scrollable';
                  toggleAutoScrollButton.classList.remove('w3-red');
                  toggleAutoScrollButton.classList.add('w3-green');
             }
             return;
         }

         onlineUsersDiv.scrollTop += scrollDirection * AUTO_SCROLL_SPEED;

         // Check if we've reached the end (or start)
         if (scrollDirection === 1 && onlineUsersDiv.scrollTop >= maxScroll) {
             onlineUsersDiv.scrollTop = maxScroll; // Ensure it's exactly at the end
             isAtEnd = true;
             // Pause at the end before changing direction
             if (AUTO_SCROLL_DELAY_AT_END > 0) {
                 stopAutoScroll(); // Stop animation frame
                 autoScrollTimeoutId = setTimeout(() => {
                     scrollDirection = -1; // Change direction
                      isAtEnd = false;
                      startAutoScroll(); // Restart animation frame
                 }, AUTO_SCROLL_DELAY_AT_END);
                 return; // Stop this frame, wait for timeout
             } else {
                  scrollDirection = -1; // Change direction immediately
                  isAtEnd = false;
             }
         } else if (scrollDirection === -1 && onlineUsersDiv.scrollTop <= 0) {
              onlineUsersDiv.scrollTop = 0; // Ensure it's exactly at the start
              isAtEnd = true;
              // Pause at the start before changing direction
              if (AUTO_SCROLL_DELAY_AT_END > 0) {
                 stopAutoScroll(); // Stop animation frame
                 autoScrollTimeoutId = setTimeout(() => {
                     scrollDirection = 1; // Change direction
                      isAtEnd = false;
                      startAutoScroll(); // Restart animation frame
                 }, AUTO_SCROLL_DELAY_AT_END);
                  return; // Stop this frame, wait for timeout
             } else {
                  scrollDirection = 1; // Change direction immediately
                  isAtEnd = false;
             }
         }

         // Continue animation loop
         autoScrollAnimationFrameId = requestAnimationFrame(scrollStep);
     }

     function startAutoScroll() {
         if (!onlineUsersDiv || onlineUsersDiv.scrollHeight <= onlineUsersDiv.clientHeight) {
              console.warn("Cannot start auto-scroll: Online list not found or not scrollable.");
               if (toggleAutoScrollButton) {
                   toggleAutoScrollButton.disabled = true;
                   toggleAutoScrollButton.textContent = 'Not Scrollable';
                    toggleAutoScrollButton.classList.remove('w3-red');
                    toggleAutoScrollButton.classList.add('w3-green');
               }
              return;
         }

         if (!isAutoScrolling) {
             console.log("Starting auto-scroll.");
             isAutoScrolling = true;
             scrollDirection = 1; // Always start scrolling down
             isAtEnd = false;
              if (toggleAutoScrollButton) {
                  toggleAutoScrollButton.textContent = 'Stop Auto-Scroll Online';
                   toggleAutoScrollButton.classList.remove('w3-green');
                   toggleAutoScrollButton.classList.add('w3-red');
              }
             autoScrollAnimationFrameId = requestAnimationFrame(scrollStep);
         }
     }

     function stopAutoScroll() {
         if (isAutoScrolling) {
             console.log("Stopping auto-scroll.");
             isAutoScrolling = false;
             if (autoScrollAnimationFrameId !== null) {
                 cancelAnimationFrame(autoScrollAnimationFrameId);
                 autoScrollAnimationFrameId = null;
             }
              if (autoScrollTimeoutId !== null) {
                 clearTimeout(autoScrollTimeoutId);
                 autoScrollTimeoutId = null;
              }
             if (toggleAutoScrollButton) {
                 toggleAutoScrollButton.textContent = 'Start Auto-Scroll Online';
                  toggleAutoScrollButton.classList.remove('w3-red');
                  toggleAutoScrollButton.classList.add('w3-green');
             }
         }
     }

     function handleManualScroll() {
         // If the user manually scrolls, stop auto-scrolling
         if (isAutoScrolling) {
             stopAutoScroll();
             console.log("Manual scroll detected, auto-scroll stopped.");
         }
     }


     // --- Iframe Layout Functions (Simplified for Fixed Size) ---

     /**
      * Updates the main viewer container and iframe visibility
      * based on the current `iframeCount` state. Relies on CSS for fixed sizing.
      */
     function updateIframeLayout() {
         // Ensure main viewer elements are validated before calling this
         if (!mainViewerContainer || iframeWrappers.length === 0 || mainIframes.length === 0) {
              console.error("Cannot update iframe layout: Main viewer elements not found.");
              return;
         }
         console.log(`Updating iframe layout to show ${iframeCount} viewports.`);

         // Update the container class to trigger CSS grid layout
         mainViewerContainer.classList.remove('iframe-count-2', 'iframe-count-4');
         mainViewerContainer.classList.add(`iframe-count-${iframeCount}`);

         // Update wrapper visibility and radio button states
         for (let i = 0; i < iframeWrappers.length; i++) {
             const wrapper = iframeWrappers[i];
             const iframe = mainIframes[i];
             const radio = document.querySelector(`input[name="iframeChoice"][value="mainIframe${i + 1}"]`);

             if (!wrapper || !iframe || !radio) {
                  console.warn(`Missing element for viewport ${i+1}. Skipping layout update for this one.`);
                  continue;
             }

             if (i < iframeCount) {
                 wrapper.style.display = ''; // Show the wrapper (grid handles layout)
                 radio.disabled = false;
             } else {
                 wrapper.style.display = 'none'; // Hide the wrapper
                 radio.disabled = true;
                 // If the hidden radio was checked, switch to the first visible one
                 if (radio.checked) {
                      const firstRadio = document.querySelector('input[name="iframeChoice"][value="mainIframe1"]');
                      if (firstRadio) firstRadio.checked = true;
                 }
                  // Reset iframe src when hiding to stop potential stream
                  // Only reset if it's currently showing a user stream, not the placeholder
                  if (iframe.src && !iframe.src.startsWith('https://cbxyz.com/in/?tour=') && iframe.src !== 'about:blank') {
                      iframe.src = 'https://cbxyz.com/in/?tour=dU9X&campaign=9cg6A&track=embed&signup_notice=1&disable_sound=1&mobileRedirect=never'; // Reset to placeholder
                      console.log(`Resetting iframe src for hidden viewport ${i + 1}`);
                  } else if (!iframe.src) {
                      // If src was empty/null, ensure it's the placeholder
                       iframe.src = 'https://cbxyz.com/in/?tour=dU9X&campaign=9cg6A&track=embed&signup_notice=1&disable_sound=1&mobileRedirect=never';
                  }
             }
         }

          // Ensure the button text is correct after toggling count
          if (toggleIframeCountButton) {
              toggleIframeCountButton.textContent = `Toggle ${iframeCount === 2 ? '4' : '2'} Viewports`;
          }
          console.log("Iframe layout updated.");
     }

     /**
      * Toggles the number of main viewer iframes between 2 and 4.
      */
     function toggleIframeCount() {
         console.log("Toggling iframe count.");
          // Ensure the button exists before toggling
         if (!toggleIframeCountButton || toggleIframeCountButton.disabled) {
             console.warn("Toggle iframe count button is not available or disabled.");
             return;
         }
         iframeCount = (iframeCount === 2) ? 4 : 2;
         updateIframeLayout();
     }

     // Removed updateIframeSize, increaseIframeSize, decreaseIframeSize


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
                 const availableUsernames = getAllUsernames(); // Get usernames from fetched data
                 const filteredSuggestions = availableUsernames.filter(username =>
                     username.toLowerCase().includes(term)
                 );
                  response(filteredSuggestions.slice(0, AUTOCOMPLETE_MAX_SUGGESTIONS));
             },
             select: function(event, ui) {
                 event.preventDefault(); // Prevent input from being replaced by label if label/value are different
                 userSearchInput.value = ui.item.value; // Set input value to selected username
                  // Trigger filtering based on selected username
                  currentUserSearchTerm = ui.item.value.trim().toLowerCase(); // Update state
                  applyFiltersAndDisplay(); // Apply filters including the selected name
                 console.log(`User autocomplete selected: ${ui.item.value}. Applying filters.`);
             },
              // Use 'change' event to handle typing and losing focus without selecting
              change: function(event, ui) {
                  // ui.item is null if no item was selected, value is the input value
                   const currentValue = userSearchInput.value.trim().toLowerCase();
                   // Only re-filter if the value has actually changed since the last filter application
                   // or if the value is empty (user cleared search)
                   if (currentValue !== currentUserSearchTerm) {
                       currentUserSearchTerm = currentValue; // Update state
                       applyFiltersAndDisplay(); // Re-apply filters with the new search term
                       console.log(`User search input changed. Re-applying filters with term: "${currentUserSearchTerm}".`);
                   }
              }
              // Removed 'focus' handler as it's not typically needed for filtering
         });

          // Add a fallback input listener in case 'change' isn't sufficient or for immediate feedback
          // This might cause redundant calls if autocomplete 'change' also fires, but ensures updates happen.
           $(userSearchInput).on('input', function() {
               const currentValue = userSearchInput.value.trim().toLowerCase();
               if (currentValue !== currentUserSearchTerm) {
                    currentUserSearchTerm = currentValue;
                    // Delay filtering slightly to avoid filtering on every single keypress
                    // (Autocomplete's 'delay' helps for suggestions, but this is for list filtering)
                    // Alternatively, rely *only* on the autocomplete 'change' event.
                    // Let's stick to the 'change' event triggered by autocomplete for now for consistency.
                    // If immediate feedback is desired, the 'input' listener should call applyFiltersAndDisplay directly.
                    // For now, trusting the 'change' event which fires on blur or selection.
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

                 // Provide suggestions. The filtering of the main message list happens in 'change' or 'input'.
                 response(filteredSuggestions.slice(0, AUTOCOMPLETE_MAX_SUGGESTIONS));
            },
             select: function(event, ui) {
                 // Prevent the default select behavior that modifies the input value
                 event.preventDefault();
                 // Setting the input value here might not be the primary goal;
                 // the main goal is filtering the list below based on the text.
                 // Let's update the input value and trigger the list filter.
                 messageSearchInput.value = ui.item.value;
                  // Trigger the list filtering based on the selected text
                  currentMessageSearchTerm = ui.item.value.trim().toLowerCase();
                  displayMessagesList(savedMessages.filter(msg => msg.text.toLowerCase().includes(currentMessageSearchTerm)));
                 console.log(`Message autocomplete selected: "${ui.item.value}". Filtering list.`);
             },
             // Use the 'change' or 'input' event to trigger list filtering
              change: function(event, ui) {
                  // This fires when the input value changes AND autocomplete is closed or no item selected
                   const currentValue = messageSearchInput.value.trim().toLowerCase();
                   // Only filter if the value changed
                   if (currentValue !== currentMessageSearchTerm) {
                       currentMessageSearchTerm = currentValue;
                       displayMessagesList(savedMessages.filter(msg => msg.text.toLowerCase().includes(currentMessageSearchTerm)));
                        console.log(`Message autocomplete changed/lost focus. Filtering list by: "${currentMessageSearchTerm}".`);
                   }
              }
        })
         // Add an input listener to re-filter the *displayed list* as the user types,
         // even before autocomplete selects or closes. This provides more immediate feedback.
         .on('input', function() {
             const currentValue = messageSearchInput.value.trim().toLowerCase();
              // Only filter if the value actually changed
             if (currentValue !== currentMessageSearchTerm) {
                 currentMessageSearchTerm = currentValue;
                 // Perform filtering directly on the savedMessages array
                 const filteredMessages = savedMessages.filter(msg =>
                     currentMessageSearchTerm === '' || msg.text.toLowerCase().includes(currentMessageSearchTerm)
                 );
                 displayMessagesList(filteredMessages);
                  console.log(`Message input changed. Filtering list by: "${currentMessageSearchTerm}".`);
             }
         });


        console.log("Message autocomplete setup complete.");
    }


     // --- Image Recognition Functions ---

     /**
      * Loads the MobileNet model. Needs TensorFlow.js to be loaded first.
      * @returns {Promise<void>}
      */
     async function loadMobileNetModel() {
         // Check if TensorFlow.js and MobileNet scripts are available globally
          if (typeof tf === 'undefined') {
              console.error("TensorFlow.js script not loaded. Cannot load ML model.");
               showRecognitionStatus("Recognition unavailable: TensorFlow.js missing.", 'error');
              return;
          }
         if (typeof mobilenet === 'undefined') {
              console.error("MobileNet script not loaded. Cannot load ML model.");
               showRecognitionStatus("Recognition unavailable: MobileNet script missing.", 'error');
              return;
          }
         if (mobilenetModel) {
              console.log("MobileNet model already loaded.");
              return; // Already loaded
         }

         console.log("Loading MobileNet model...");
          showRecognitionStatus("Loading recognition model...", 'loading');
         try {
             mobilenetModel = await mobilenet.load();
             console.log("MobileNet model loaded successfully.");
             showRecognitionStatus("Recognition model loaded.", 'success');
             // Clear status after a brief moment
              setTimeout(() => showRecognitionStatus(''), 3000);

              // If there are users displayed and in image mode, queue them for analysis
              // This handles cases where the model loads *after* the initial user list is displayed
              if (displayMode === 'image' && lastFilteredUsers.length > 0) {
                  console.log("Model loaded after users displayed. Queuing displayed images for analysis.");
                  analysisQueue = lastFilteredUsers.filter(user => user.image_url && !user.recognition_results)
                                                   .map(user => ({ username: user.username, imageUrl: user.image_url }));
                  processAnalysisQueue(); // Start processing the newly populated queue
              }


         } catch (error) {
             console.error("Failed to load MobileNet model:", error);
              showRecognitionStatus(`Recognition failed: Model load error - ${error.message}`, 'error');
              // Disable image recognition features or provide clear error state
         }
     }

     /**
      * Processes the analysis queue sequentially.
      */
     async function processAnalysisQueue() {
         if (isAnalyzing || analysisQueue.length === 0 || !mobilenetModel || displayMode !== 'image') {
             // Stop if already running, nothing to process, model not loaded, or mode changed
             isAnalyzing = false; // Ensure flag is false if queue is empty or conditions fail
             if (analysisQueue.length === 0 || displayMode !== 'image') showRecognitionStatus(''); // Hide status if done or mode changed
             return;
         }

         isAnalyzing = true;
         console.log(`Starting analysis queue processing (${analysisQueue.length} items).`);
          showRecognitionStatus(`Analyzing ${analysisQueue.length} images...`, 'loading');

         while (analysisQueue.length > 0 && mobilenetModel && displayMode === 'image') {
             const queueItem = analysisQueue.shift(); // Get the next item
             const { username, imageUrl } = queueItem; // Element reference might be stale, find it live

             // Find the user object in the main data array to store results
             const user = allOnlineUsersData.find(u => u.username === username);
             // Find the current DOM element for this user in the online list
             const userElement = onlineUsersDiv?.querySelector(`.user-info[data-username="${username}"]`);

             if (user && userElement && displayMode === 'image' && user.image_url === imageUrl) {
                  // Double-check mode, user exists in data, element exists, and image URL hasn't changed (unlikely in this flow)
                  try {
                      // Find the image element within the current userElement
                      const imageElement = userElement.querySelector('img');

                      // Ensure the image element exists and is loaded/visible before analyzing
                      // Checking isConnected is good. Checking visibility is complex without IntersectionObserver.
                      // We'll assume if the element exists in the onlineUsersDiv, its image can be processed.
                      if (imageElement && imageElement.isConnected) {

                           // Check if image is fully loaded, wait if necessary (optional but robust)
                           if (!imageElement.complete || imageElement.naturalHeight === 0) {
                                console.log(`Waiting for image for ${username} to load before analysis.`);
                                await new Promise(resolve => {
                                     imageElement.onload = resolve;
                                     imageElement.onerror = resolve; // Resolve even on error to not block queue
                                });
                                // Re-check if the element is *still* in the DOM after waiting
                                if (!imageElement.isConnected) {
                                     console.log(`Image for ${username} removed from DOM during load wait. Skipping analysis.`);
                                     continue; // Skip this item
                                }
                                 if (!imageElement.complete || imageElement.naturalHeight === 0) {
                                     console.warn(`Image for ${username} failed to load or is empty. Skipping analysis.`);
                                      const detailsDiv = userElement.querySelector('.user-details');
                                       if (detailsDiv) detailsDiv.insertAdjacentHTML('beforeend', `<div class="recognition-results w3-text-red w3-small">Image load failed.</div>`);
                                      user.recognition_results = []; // Mark as failed analysis
                                      userElement.dataset.recognized = 'error';
                                     continue; // Skip this item
                                 }
                           }


                           console.log(`Analyzing image for ${username}...`);
                            // Use tf.browser.fromPixels or tf.image.decode* if needed, but mobilenet.classify usually handles img element
                           const predictions = await mobilenetModel.classify(imageElement);
                           console.log(`Analysis results for ${username}:`, predictions);

                           // Filter results by confidence threshold and limit number
                           const filteredPredictions = predictions.filter(p => p.probability >= IMAGE_RECOGNITION_CONFIDENCE_THRESHOLD)
                                                                .slice(0, IMAGE_RECOGNITION_MAX_RESULTS);

                           // Store results on the user object state (`allOnlineUsersData`)
                           const userStateIndex = allOnlineUsersData.findIndex(u => u.username === username);
                           if (userStateIndex !== -1) {
                               allOnlineUsersData[userStateIndex].recognition_results = filteredPredictions;
                               // No need for timestamp check if we clear queue on list refresh
                           } else {
                               // This shouldn't happen if user was in allOnlineUsersData when queued
                               console.warn(`User ${username} not found in allOnlineUsersData during analysis result storage.`);
                           }


                           // Update the specific user element in the DOM with results
                           const detailsDiv = userElement.querySelector('.user-details');
                           const existingResultsDiv = detailsDiv.querySelector('.recognition-results');

                           if (detailsDiv) {
                                const resultsHtml = buildRecognitionResultsHtml(filteredPredictions);
                                if (existingResultsDiv) {
                                     // Replace the loading placeholder or old results
                                     existingResultsDiv.outerHTML = resultsHtml || `<div class="recognition-results w3-text-grey w3-small">No results above threshold.</div>`;
                                } else if (resultsHtml) {
                                     // Insert results before the end of details if no placeholder existed
                                     detailsDiv.insertAdjacentHTML('beforeend', resultsHtml);
                                } else {
                                     // Add a message if no results met the threshold
                                     detailsDiv.insertAdjacentHTML('beforeend', `<div class="recognition-results w3-text-grey w3-small">No results above threshold.</div>`);
                                }
                           }
                            // Update the dataset flag
                            userElement.dataset.recognized = filteredPredictions.length > 0 ? 'true' : 'none';

                           // Update status display
                           const remaining = analysisQueue.length;
                           if (remaining > 0) {
                                showRecognitionStatus(`Analyzing... (${remaining} remaining)`);
                           } else {
                                showRecognitionStatus("Analysis complete.", 'success');
                                setTimeout(() => showRecognitionStatus(''), 3000); // Hide success status
                           }


                      } else {
                           // Image element not found or not connected
                           console.log(`Skipping analysis for ${username}: Image element not found or not in DOM.`);
                            const detailsDiv = userElement.querySelector('.user-details');
                             if (detailsDiv) detailsDiv.insertAdjacentHTML('beforeend', `<div class="recognition-results w3-text-red w3-small">Image element missing.</div>`);
                            userElement.dataset.recognized = 'error';
                      }

                  } catch (error) {
                      console.error(`Error analyzing image for ${username}:`, error);
                       // Find the user object again in case state changed somehow
                      const userStateIndex = allOnlineUsersData.findIndex(u => u.username === username);
                      if (userStateIndex !== -1) {
                           allOnlineUsersData[userStateIndex].recognition_results = []; // Mark as failed analysis
                      }
                      // Update the specific user element in the DOM with an error message
                      const detailsDiv = userElement?.querySelector('.user-details');
                      const existingResultsDiv = detailsDiv?.querySelector('.recognition-results');
                       if (detailsDiv) {
                            const errorHtml = `<div class="recognition-results w3-text-red w3-small">Analysis failed.</div>`;
                            if (existingResultsDiv) {
                                existingResultsDiv.outerHTML = errorHtml;
                            } else {
                                detailsDiv.insertAdjacentHTML('beforeend', errorHtml);
                            }
                       }
                       if (userElement) userElement.dataset.recognized = 'error'; // Indicate error state
                  }
             } else {
                  console.log(`Skipping analysis for ${username} (user/element not found, mode changed, or already analyzed).`);
             }

             // Add a small delay between processing images
             await new Promise(resolve => setTimeout(resolve, ANALYSIS_DELAY));
         }

         isAnalyzing = false;
         console.log("Analysis queue processing finished.");
          if (analysisQueue.length === 0 && displayMode === 'image') {
               // Final status update if queue is truly empty and we are still in image mode
               showRecognitionStatus("Image recognition complete.", 'success');
               setTimeout(() => showRecognitionStatus(''), 3000);
          } else if (displayMode !== 'image') {
               // Status update if the loop stopped because the mode changed
               showRecognitionStatus(`Analysis paused (${analysisQueue.length} remaining). Switch to Image mode to resume.`, 'warning');
          } else if (analysisQueue.length > 0 && !mobilenetModel) {
               // Status update if the loop stopped because the model became unavailable
               showRecognitionStatus(`Analysis stopped (${analysisQueue.length} remaining): Model unavailable.`, 'error');
          }
     }


    // --- Collapsible Sections ---
    /**
     * Toggles the visibility of a control section and updates the icon.
     * Exposes this function globally so HTML onclick works.
     * @param {string} sectionId - The ID prefix of the section div ('filters', 'display', etc.).
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
             console.warn(`Toggle section element not found for ID: ${sectionId}Section or ${sectionId}ToggleIcon`);
        }
    }


    // --- Initial Setup and Event Listeners ---

    /** Collects and validates all essential DOM references. Logs errors/warnings. */
    function collectAndValidateDOMReferences() {
         const missingCritical = [];
         const missingOptional = [];

         // --- Critical Elements ---
         onlineUsersDiv = document.getElementById("onlineUsers")?.querySelector('.user-list');
         if (!onlineUsersDiv) missingCritical.push("#onlineUsers .user-list");

         previousUsersDiv = document.getElementById("previousUsers")?.querySelector('.user-list');
         if (!previousUsersDiv) missingCritical.push("#previousUsers .user-list");

         mainViewerContainer = document.getElementById("mainViewerContainer");
         if (!mainViewerContainer) missingCritical.push("#mainViewerContainer");

         mainIframeColumn = document.querySelector('.iframe-column');
         if (!mainIframeColumn) missingCritical.push(".iframe-column");

         // Collect all potential main iframes and their wrappers
         iframeWrapper1 = document.getElementById("iframeWrapper1");
         mainIframe1 = document.getElementById("mainIframe");
         iframeWrapper2 = document.getElementById("iframeWrapper2");
         mainIframe2 = document.getElementById("mainIframe2");
         iframeWrapper3 = document.getElementById("iframeWrapper3");
         mainIframe3 = document.getElementById("mainIframe3");
         iframeWrapper4 = document.getElementById("iframeWrapper4");
         mainIframe4 = document.getElementById("mainIframe4");

          mainIframes = [mainIframe1, mainIframe2, mainIframe3, mainIframe4];
          iframeWrappers = [iframeWrapper1, iframeWrapper2, iframeWrapper3, iframeWrapper4];

         // Check if at least the first two critical iframes/wrappers exist
         if (!iframeWrapper1 || !mainIframe1) missingCritical.push("#iframeWrapper1 / #mainIframe");
         if (!iframeWrapper2 || !mainIframe2) missingCritical.push("#iframeWrapper2 / #mainIframe2");


         storageTypeSelector = document.getElementById("storageType");
         if (!storageTypeSelector) missingCritical.push("#storageType");

         filterTagsSelect = document.getElementById("filterTags");
         if (!filterTagsSelect) missingCritical.push("#filterTags");

         filterAgeSelect = document.getElementById("filterAge");
         if (!filterAgeSelect) missingCritical.push("#filterAge");

         toggleAutoScrollButton = document.getElementById("toggleAutoScroll");
         if (!toggleAutoScrollButton) missingCritical.push("#toggleAutoScroll");

         toggleDisplayModeButton = document.getElementById("toggleDisplayMode");
         if (!toggleDisplayModeButton) missingCritical.push("#toggleDisplayMode");

         toggleIframeCountButton = document.getElementById("toggleIframeCount");
         if (!toggleIframeCountButton) missingCritical.push("#toggleIframeCount");

         userSearchInput = document.getElementById("userSearchInput");
         if (!userSearchInput) missingCritical.push("#userSearchInput");

         messageSearchInput = document.getElementById("messageSearchInput");
         if (!messageSearchInput) missingCritical.push("#messageSearchInput");

         messageInput = document.getElementById("messageInput");
         if (!messageInput) missingCritical.push("#messageInput");

         saveMessageButton = document.getElementById("saveMessageButton");
         if (!saveMessageButton) missingCritical.push("#saveMessageButton");

         messageListDiv = document.getElementById("messageList");
         if (!messageListDiv) missingCritical.push("#messageList");


         // --- Optional Elements (Log as warnings) ---
         clearPreviousUsersButton = document.getElementById("clearPreviousUsers");
          if (!clearPreviousUsersButton) missingOptional.push("#clearPreviousUsers");

         sendReportButton = document.getElementById("sendReportButton");
          if (!sendReportButton) missingOptional.push("#sendReportButton. Reporting functionality disabled.");

         reportLoadingIndicator = document.getElementById("reportLoadingIndicator");
          if (!reportLoadingIndicator) missingOptional.push("#reportLoadingIndicator. Reporting loading feedback unavailable.");

         reportStatusDisplay = document.getElementById("reportStatusDisplay");
          if (!reportStatusDisplay) missingOptional.push("#reportStatusDisplay. Reporting status feedback unavailable.");

         onlineLoadingIndicator = document.getElementById("onlineLoadingIndicator");
          if (!onlineLoadingIndicator) missingOptional.push("#onlineLoadingIndicator. Online user loading feedback unavailable.");

         onlineErrorDisplay = document.getElementById("onlineErrorDisplay");
          if (!onlineErrorDisplay) missingOptional.push("#onlineErrorDisplay. Online user error feedback unavailable.");

         recognitionStatusDisplay = document.getElementById("recognitionStatus");
          if (!recognitionStatusDisplay) missingOptional.push("#recognitionStatus. Image recognition status unavailable.");

         messageStatusDisplay = document.getElementById("messageStatusDisplay");
          if (!messageStatusDisplay) missingOptional.push("#messageStatusDisplay. Message saving status feedback unavailable.");

         filterSectionHeader = document.querySelector('h4[onclick="toggleSection(\'filters\')"]');
          if (!filterSectionHeader) missingOptional.push("Filter section header. Toggling disabled.");
         displaySectionHeader = document.querySelector('h4[onclick="toggleSection(\'display\')"]');
          if (!displaySectionHeader) missingOptional.push("Display section header. Toggling disabled.");
         viewerSectionHeader = document.querySelector('h4[onclick="toggleSection(\'viewer\')"]');
          if (!viewerSectionHeader) missingOptional.push("Viewer section header. Toggling disabled.");
         messagingSectionHeader = document.querySelector('h4[onclick="toggleSection(\'messaging\')"]');
          if (!messagingSectionHeader) missingOptional.push("Messaging section header. Toggling disabled.");
         reportingSectionHeader = document.querySelector('h4[onclick="toggleSection(\'reporting\')"]');
          if (!reportingSectionHeader) missingOptional.push("Reporting section header. Toggling disabled.");

         // Quick filter buttons
         const quickFilterButtons = document.querySelectorAll('.quick-filters button');
          if (quickFilterButtons.length === 0) missingOptional.push("Quick filter buttons. Feature disabled.");
          quickFilterButtons.forEach(btn => {
              // Attach placeholder listeners or just note their optional status
          });


        if (missingCritical.length > 0) {
            const errorMsg = `CRITICAL ERROR: Missing essential DOM elements: ${missingCritical.join(', ')}. Application cannot start.`;
            console.error(errorMsg);
            // Attempt to show error on page if possible
            if (onlineErrorDisplay) {
                 onlineErrorDisplay.textContent = `Initialization failed: Missing required elements (${missingCritical[0]}...). Check console & HTML.`;
                 onlineErrorDisplay.style.display = 'block';
            } else {
                alert(errorMsg); // Fallback alert
            }

            // Disable all possibly found critical buttons/inputs on fatal error
             [
                storageTypeSelector, filterTagsSelect, filterAgeSelect,
                toggleAutoScrollButton, toggleDisplayModeButton, toggleIframeCountButton,
                userSearchInput, messageSearchInput, messageInput, saveMessageButton,
                clearPreviousUsersButton, sendReportButton
            ].forEach(el => {
                if (el) {
                    el.disabled = true;
                     if (el.tagName === 'BUTTON') el.textContent = 'Error';
                     if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = 'Error: Init Failed';
                     if (el.tagName === 'SELECT') {
                          el.innerHTML = '<option>Error</option>';
                          el.value = 'Error';
                     }
                }
            });
            // Hide critical status elements if their parent container might be missing
             if (recognitionStatusDisplay) recognitionStatusDisplay.style.display = 'none';
             if (messageStatusDisplay) messageStatusDisplay.style.display = 'none';
             if (onlineLoadingIndicator) onlineLoadingIndicator.style.display = 'none';
             if (reportLoadingIndicator) reportLoadingIndicator.style.display = 'none';


            return false; // Indicate failure
        }

         if (missingOptional.length > 0) {
             console.warn("Missing optional DOM elements. Some features may be disabled:", missingOptional.join(', '));
              // Note: Don't disable critical elements if only optional ones are missing
         }


        console.log("DOM references collected and validated. Essential elements found.");
        return true; // Indicate success
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
                 // When storage type changes, reload history from the new source
                showOnlineLoadingIndicator("Loading history from new source...");
                previousUsers = await loadUsers(historyStorageKey); // Load using the standard history key
                await displayPreviousUsers(); // Refresh display (will filter by online status)
                hideOnlineLoadingIndicator();
             }
        });

        // Filter Selects Change (use 'change' event)
        filterTagsSelect?.addEventListener("change", () => applyFiltersAndDisplay());
        filterAgeSelect?.addEventListener("change", () => applyFiltersAndDisplay());

         // --- Specific Quick Filter Buttons ---
         document.getElementById("filterAge18")?.addEventListener("click", () => applyFiltersAndDisplay({ age: 18 }));
         document.getElementById("filterTagAsian")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'asian' }));
         document.getElementById("filterTagBlonde")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'blonde' }));

         // --- Clear History Button ---
         clearPreviousUsersButton?.addEventListener("click", clearPreviousUsers);

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
                 if (onlineUsersDiv) onlineUsersDiv.scrollTop = 0; // Reset scroll position when mode changes
             });
             console.log("Display mode toggle button event listener added.");
         }

         // --- Iframe Count Button Listener ---
         if (toggleIframeCountButton) {
              toggleIframeCountButton.addEventListener("click", toggleIframeCount);
              console.log("Toggle iframe count button listener added.");
         }
         // Removed increase/decrease size button listeners

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
              console.log("Message input keypress listener added.");
         }


        // --- Listener to stop auto-scroll on manual list scroll ---
        if (onlineUsersDiv) {
             onlineUsersDiv.addEventListener("scroll", handleManualScroll);
             console.log("Manual scroll listener added to online users list.");
        }

         // --- Autocomplete Search Setups ---
         // User search
         setupUserAutocomplete();
         // Message search
         setupMessageAutocomplete();


        console.log("Event listeners setup complete.");
    }


    // --- Application Initialization Sequence ---

    async function initializeApp() {
        console.log("Initializing application...");

        // 1. Collect and validate critical DOM elements first
        if (!collectAndValidateDOMReferences()) {
             console.error("Initialization aborted due to missing critical DOM elements.");
             return; // Stop initialization if critical elements are missing
        }

         // 2. Expose toggleSection function globally so HTML onclick works
         window.toggleSection = toggleSection;


         // 3. Check for essential library dependencies (jQuery/UI, TF/MobileNet)
         let depsOk = true;
         if (typeof $ === 'undefined' || typeof $.fn.autocomplete === 'undefined') {
             console.error("Dependency Error: jQuery or jQuery UI not loaded. Autocomplete and some UI features disabled.");
             if (userSearchInput) { userSearchInput.disabled = true; userSearchInput.placeholder = 'jQuery UI Missing'; }
             if (messageSearchInput) { messageSearchInput.disabled = true; messageSearchInput.placeholder = 'jQuery UI Missing'; }
              depsOk = false;
         } else {
             console.log("jQuery and jQuery UI detected.");
         }

          if (typeof tf === 'undefined' || typeof mobilenet === 'undefined') {
              console.warn("Dependency Warning: TensorFlow.js or MobileNet not loaded. Image recognition disabled.");
               showRecognitionStatus("Recognition unavailable: Dependencies missing.", 'warning');
              // No need to set depsOk = false here if the app can run without ML
          } else {
              console.log("TensorFlow.js and MobileNet detected.");
               // 4. Load MobileNet model (async, doesn't block other init)
               loadMobileNetModel();
          }


         // 5. Set initial states for controls
         displayMode = 'image'; // Start online list in image mode
         if (toggleDisplayModeButton) toggleDisplayModeButton.textContent = 'Show Iframes';
         iframeCount = 2; // Start with 2 main viewports
         currentUserSearchTerm = userSearchInput ? userSearchInput.value.trim().toLowerCase() : ''; // Get initial search input value
         currentMessageSearchTerm = messageSearchInput ? messageSearchInput.value.trim().toLowerCase() : ''; // Get initial message search input value


        // 6. Populate storage options dropdown and set initial storageType state
        await populateStorageOptions();


        // 7. Setup event listeners for UI elements (including new buttons, search, messaging)
        setupEventListeners();

        // 8. Load initial user history from the selected storage
        showOnlineLoadingIndicator("Loading initial history...");
        previousUsers = await loadUsers(historyStorageKey);
        console.log(`Initial load: Found ${previousUsers.length} users in history state.`);
        // History display will be updated by fetchData() once online data is available for filtering


         // 9. Set up initial main iframe layout (fixed size handled by CSS)
         updateIframeLayout(); // Sets the 2-viewport layout


        // 10. Load and display initial saved messages from DB
         await loadAndDisplayMessages(); // This populates savedMessages and sets up message autocomplete source


        // 11. Perform the initial fetch of online user data
        // `fetchData` will handle:
        // - Fetching data into `allOnlineUsersData`
        // - Populating filter dropdowns
        // - Updating user autocomplete source
        // - Applying filters and displaying online users (`displayOnlineUsersList`)
        // - Updating the previous users display (`displayPreviousUsers`) by filtering history based on newly fetched online data.
        await fetchData();


        // 12. Start the periodic fetch interval *after* the first fetch completes
        startFetchInterval();

        // --- Optional: Compatibility Placeholders (keep these if needed for external calls) ---
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


           // Check and set initial disabled states for buttons based on scrollability etc.
           // This was moved here from fetchData for initial setup
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
                toggleAutoScrollButton.textContent = 'List Missing';
                toggleAutoScrollButton.classList.remove('w3-red');
                toggleAutoScrollButton.classList.add('w3-green');
           }
            // Disable display mode button if online list element is missing
            if (!onlineUsersDiv && toggleDisplayModeButton) {
                 toggleDisplayModeButton.disabled = true;
                 toggleDisplayModeButton.textContent = 'List Missing';
            }
             // Disable iframe count button if main viewer container is missing
             if (!mainViewerContainer) {
                 if (toggleIframeCountButton) { toggleIframeCountButton.disabled = true; toggleIframeCountButton.textContent = 'Viewer Missing'; }
             }
             // Disable messaging buttons/inputs if elements are missing (handled in validate)
              if (!messageInput || !saveMessageButton || !messageListDiv) {
                   // These should already be disabled by validateDOMReferences
              }
               // Disable search inputs if elements are missing (handled in validate & setup)
              if (!userSearchInput) { /* already handled */ }
              if (!messageSearchInput) { /* already handled */ }


           // Open default sections on load (optional, depends on desired initial view)
           // toggleSection('filters');
           // toggleSection('display'); // Often useful to show controls initially
           // toggleSection('viewer'); // Often useful to show controls initially
           // toggleSection('messaging');
           // toggleSection('reporting');

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
    // Use a self-invoking async function or just call initializeApp and catch errors
    initializeApp().catch(error => {
        console.error("Unhandled error during application initialization:", error);
         // Attempt to display a visible error message
        const fatalErrorMsg = `Fatal initialization error: ${error.message}. Check browser console for details.`;
        showOnlineErrorDisplay(fatalErrorMsg); // Use online error display
         showReportStatus(fatalErrorMsg, 'error'); // Use report status display if available
         if (messageStatusDisplay) showStatusMessage(messageStatusDisplay, 'Fatal Init Error', 'error');

        // Ensure all loading/status indicators are hidden
        hideOnlineLoadingIndicator();
        hideReportLoading();
        showRecognitionStatus('', false); // Hide recognition status

         // Disable all interactive elements on fatal error
        [
             storageTypeSelector, filterTagsSelect, filterAgeSelect,
             toggleAutoScrollButton, toggleDisplayModeButton, toggleIframeCountButton,
             userSearchInput, messageSearchInput, messageInput, saveMessageButton,
             clearPreviousUsersButton, sendReportButton
        ].forEach(el => {
             if (el) {
                 el.disabled = true;
                 if (el.tagName === 'BUTTON') el.textContent = 'Error';
                 if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = 'Error: Init Failed';
                 if (el.tagName === 'SELECT') {
                      el.innerHTML = '<option>Error</option>';
                      el.value = 'Error';
                 }
             }
         });

         // Clear content areas if possible
         if (onlineUsersDiv) onlineUsersDiv.innerHTML = `<p class="text-muted w3-center w3-text-red">${fatalErrorMsg}</p>`;
         if (previousUsersDiv) previousUsersDiv.innerHTML = `<p class="text-muted w3-center w3-text-red">History Unavailable due to error.</p>`;
         if (messageListDiv) messageListDiv.innerHTML = `<p class="text-muted w3-center w3-text-red">Messaging Unavailable due to error.</p>`;
    });

}); // End DOMContentLoaded
