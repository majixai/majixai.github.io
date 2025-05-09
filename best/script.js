// 1.  **Remove the example API:** We will remove or comment out the `apiUrlBase` constant and the `fetchData` function's reliance on `fetch`.
// 2.  **Handle the lack of data:** Since there's no longer an API to fetch from, the `fetchData` function will be modified to simulate an empty response. This will ensure the application doesn't get stuck waiting for data that never arrives.
// 3.  **Address persistent "Loading":** By simulating an empty response and ensuring `fetchData` completes, the loading indicators should be hidden.
// 4.  **Address non-working buttons:** Buttons related to filtering and searching online users won't have any users to operate on if `allOnlineUsersData` is empty. The `displayOnlineUsersList` function already handles showing an empty list and disabling the auto-scroll button in this scenario. Other buttons like clearing history, saving messages, and toggling viewer layout should still work as they don't directly depend on the *presence* of online users, only on the state managed within the script (like history and messages). We will ensure these are still functional.

document.addEventListener('DOMContentLoaded', async function() {

    // Removed: const apiUrlBase = 'https://api.example.com/users/online'; // No longer used
    // Removed: const apiLimit = 50; // No longer used
    // Removed: const maxApiFetchLimit = 500; // No longer used
    const fetchIntervalDuration = 60000; // Still useful for periodic updates, even if simulating empty data
    // Removed: const apiFetchTimeout = 15000; // No longer used

    const REPORT_SEND_METHOD = 'mailto'; // Changed to mailto for a basic client-side demo

    const AUTO_SCROLL_SPEED = 1;
    const AUTO_SCROLL_DELAY_AT_END = 1000;

    const LIST_IFRAME_BASE_URL = 'https://chaturbate.com/embed/';
    const LIST_IFRAME_PARAMS = '?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black&aspect=0.5625'; // Keep these for potentially loading users via history/search

    const MAIN_IFRAME_BASE_URL = 'https://chaturbate.com/embed/';
    const MAIN_IFRAME_PARAMS = '?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black'; // Keep these for loading users into main viewer

    const AUTOCOMPLETE_MIN_LENGTH = 2;
    const AUTOCOMPLETE_DELAY = 300;
    const AUTOCOMPLETE_MAX_SUGGESTIONS = 10;

    let mobilenetModel = null; // Keep ML model for image recognition
    const IMAGE_RECOGNITION_CONFIDENCE_THRESHOLD = 0.2;
    const IMAGE_RECOGNITION_MAX_RESULTS = 3;
    let analysisQueue = [];
    let isAnalyzing = false;
    const ANALYSIS_DELAY = 50;

    const LOG_MAX_ENTRIES = 1000;

    // Keep all DOM references
    let onlineUsersDiv = null;
    let previousUsersDiv = null;

    let mainViewerContainer = null;
    let iframeWrapper1 = null;
    let mainIframe1 = null;
    let iframeWrapper2 = null;
    let mainIframe2 = null;
    let iframeWrapper3 = null;
    let mainIframe3 = null;
    let iframeWrapper4 = null;
    let mainIframe4 = null;
    let mainIframes = [];
    let iframeWrappers = [];
    let mainIframeColumn = null;

    let storageTypeSelector = null;
    let filterTagsSelect = null;
    let filterAgeSelect = null;
    let clearPreviousUsersButton = null;

    let sendReportButton = null;
    let reportLoadingIndicator = null;
    let reportStatusDisplay = null;

    let onlineLoadingIndicator = null;
    let onlineErrorDisplay = null;
    let recognitionStatusDisplay = null;

    let toggleAutoScrollButton = null;
    let toggleDisplayModeButton = null;
    let toggleIframeCountButton = null;

    let userSearchInput = null;
    let messageSearchInput = null;

    let messageInput = null;
    let saveMessageButton = null;
    let messageListDiv = null;
    let messageStatusDisplay = null;

    let logDisplayArea = null;
    let logEntriesDiv = null;
    let showLogsButton = null;
    let clearLogsButton = null;

    // Section headers for toggling
    let filtersSectionHeader = null;
    let displaySectionHeader = null;
    let viewerSectionHeader = null;
    let messagingSectionHeader = null;
    let reportingSectionHeader = null;


    let storageType = 'indexedDB';
    const historyStorageKey = 'previousUsers';
    const maxHistorySize = 200;

    let previousUsers = [];
    let allOnlineUsersData = []; // This will be empty now
    let lastFilteredUsers = []; // This will also be empty after filtering
    let fetchInterval = null;
    let fetchFailed = false; // Set this to true to simulate a failed API load

    let isAutoScrolling = false;
    let autoScrollAnimationFrameId = null;
    let autoScrollTimeoutId = null;

    let displayMode = 'image'; // Default to image mode

    let iframeCount = 2; // Default viewer count

    let currentUserSearchTerm = '';
    let currentMessageSearchTerm = '';

    let savedMessages = []; // Messages loaded from IndexedDB

    let capturedLogs = [];
    const originalConsole = {}; // To capture console logs
    let seen = new Set(); // For circular reference handling in logging


    // --- Log Functionality ---
    function formatLogTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
        return `${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    function formatLogArguments(args) {
        return args.map(arg => {
            if (arg instanceof Error) {
                return arg.stack || arg.message;
            } else if (typeof arg === 'object' && arg !== null) {
                try {
                    // Use a replacer function to handle circular references
                    seen = new Set(); // Reset seen set for each new object
                    return JSON.stringify(arg, (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            if (seen.has(value)) return '[Circular]';
                            seen.add(value);
                        }
                        return value;
                    }, 2);
                } catch (e) {
                    // Fallback for objects that can't be stringified
                    console.error("Error stringifying log argument:", e);
                    return String(arg);
                } finally {
                     seen = new Set(); // Clear after stringification attempt
                 }
            } else {
                return String(arg);
            }
        }).join(' ');
    }

     function captureConsole() {
         const levels = ['log', 'warn', 'error', 'info', 'debug'];

         levels.forEach(level => {
             originalConsole[level] = console[level];

             console[level] = function(...args) {
                 // Call the original console method first
                 originalConsole[level].apply(console, args);

                 // Capture for display
                 const message = formatLogArguments(args);
                 const timestamp = new Date();
                 const logEntry = {
                     timestamp: timestamp.toISOString(),
                     timeFormatted: formatLogTime(timestamp),
                     level: level,
                     message: message
                 };

                 capturedLogs.push(logEntry);
                 // Keep only the most recent logs
                 if (capturedLogs.length > LOG_MAX_ENTRIES) {
                     capturedLogs.shift();
                 }

                 // Append to display if log area is visible
                 if (logDisplayArea && !logDisplayArea.classList.contains('w3-hide') && logEntriesDiv) {
                      appendLogToDisplay(logEntry);
                 }
             };
         });
         originalConsole.log("Console capture initialized."); // Log this using the captured console
     }

     function displayLogs() {
          if (!logEntriesDiv) {
              originalConsole.warn("Log entries display div (#logEntries) not found. Cannot display logs.");
              return;
          }
          logEntriesDiv.innerHTML = ''; // Clear current display

          const fragment = document.createDocumentFragment();
          capturedLogs.forEach(logEntry => {
              const logElement = createLogElement(logEntry);
              fragment.appendChild(logElement);
          });
          logEntriesDiv.appendChild(fragment);

          // Scroll to bottom
          logEntriesDiv.scrollTop = logEntriesDiv.scrollHeight;
     }

     function appendLogToDisplay(logEntry) {
         if (!logEntriesDiv) return;

         // Remove oldest if over limit before adding new
         while (logEntriesDiv.childElementCount >= LOG_MAX_ENTRIES) {
              logEntriesDiv.firstChild?.remove();
         }

         const logElement = createLogElement(logEntry);
         logEntriesDiv.appendChild(logElement);

         // Auto-scroll only if near the bottom
         const isNearBottom = logEntriesDiv.scrollHeight - logEntriesDiv.clientHeight <= logEntriesDiv.scrollTop + 20;
         if (isNearBottom) {
             logEntriesDiv.scrollTop = logEntriesDiv.scrollHeight;
         }
     }

     function createLogElement(logEntry) {
         const logElement = document.createElement('div');
         logElement.className = `log-entry log-${logEntry.level}`; // Use level for styling
         // Escape HTML to prevent script injection or layout issues from log content
         logElement.innerHTML = `<span class="log-timestamp">[${logEntry.timeFormatted}]</span> <span class="log-message">${escapeHTML(logEntry.message)}</span>`;
         return logElement;
     }

     function escapeHTML(str) {
         return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
     }

     function clearLogs() {
          const confirmClear = confirm("Are you sure you want to clear all logs?");
          if (!confirmClear) {
              console.log("Log clear cancelled.");
              return;
          }
          capturedLogs = []; // Clear the array
          if (logEntriesDiv) {
              logEntriesDiv.innerHTML = ''; // Clear the display
          }
          console.log("Logs cleared.");
     }


    // --- Helper Functions (Date/Age) ---
    function dateDifferenceInDays(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        const diffMs = Math.abs(date1.getTime() - date2.getTime());
        return Math.round(diffMs / oneDay);
    }

    function isBirthday(birthday) {
        if (!birthday || typeof birthday !== 'string') return false;
        try {
            const today = new Date();
            // Parse date string in YYYY-MM-DD format (UTC to avoid timezone issues)
            const parts = birthday.split('-');
            if (parts.length !== 3) return false;
            const birthDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));

            if (isNaN(birthDate.getTime())) {
                 console.warn("Invalid date encountered in isBirthday:", birthday);
                 return false;
            }

            // Compare UTC month and day
            return today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() === birthDate.getUTCDate();
        } catch (e) {
             console.error("Error checking birthday for:", birthday, e);
             return false;
        }
    }

    function getDaysSince18thBirthday(birthdayString, apiAge) {
        // Only calculate if API age is 18 and a birthday string is provided
        if (!birthdayString || typeof birthdayString !== 'string' || apiAge !== 18) {
            return null;
        }

        try {
            const today = new Date();
             const parts = birthdayString.split('-');
             if (parts.length !== 3) return null;

            const birthYear = parseInt(parts[0], 10);
            const birthMonth = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const birthDay = parseInt(parts[2], 10);

            // Calculate the date of the 18th birthday
            const eighteenthBirthday = new Date(birthYear + 18, birthMonth, birthDay);

            // If 18th birthday is in the future, return null
            if (eighteenthBirthday > today) {
                 // This shouldn't happen if the API age is 18, but it's a safety check
                 console.warn(`User (Birth: ${birthdayString}, API Age: ${apiAge}) 18th birthday (${eighteenthBirthday.toISOString().split('T')[0]}) is in the future. Data inconsistency?`);
                return null;
            }

             // Calculate the date of the 19th birthday
             const nineteenthBirthday = new Date(birthYear + 19, birthMonth, birthDay);

            // If 19th birthday has passed, return null (they are 19+)
            if (nineteenthBirthday <= today) {
                 // This shouldn't happen if the API age is 18
                 console.warn(`User (Birth: ${birthdayString}, API Age: ${apiAge}) 19th birthday (${nineteenthBirthday.toISOString().split('T')[0]}) has passed. Data inconsistency?`);
                return null;
            }

             // Calculate the difference in days using UTC dates to avoid timezone issues
             const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
             const eighteenthBirthdayUtc = Date.UTC(eighteenthBirthday.getUTCFullYear(), eighteenthBirthday.getUTCMonth(), eighteenthBirthday.getUTCDate());
             const diffMs = todayUtc - eighteenthBirthdayUtc;
             const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)); // Convert milliseconds to days

            return days >= 0 ? days : null; // Ensure days is non-negative

        } catch (e) {
             console.error("Error calculating days since 18th birthday for:", birthdayString, e);
             return null;
        }
    }


    // --- IndexedDB Storage Functions ---
    function openIndexedDB() {
        return new Promise((resolve, reject) => {
             if (!('indexedDB' in window)) {
                 console.error("IndexedDB not supported by this browser.");
                 reject(new Error("IndexedDB not supported."));
                 return;
             }
            // Version 2: Added 'messages' object store
            const request = indexedDB.open('UserDatabase', 2);

            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                 console.log("IndexedDB upgrade needed or creating database. Old version:", event.oldVersion, "New version:", event.newVersion);

                 // Create 'users' store if it doesn't exist (from version 1)
                 if (!db.objectStoreNames.contains('users')) {
                      db.createObjectStore('users', { keyPath: 'key' });
                     console.log("Created object store: 'users'");
                 }

                 // Create 'messages' store if it doesn't exist (for version 2)
                 if (!db.objectStoreNames.contains('messages')) {
                      const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
                     messageStore.createIndex('text', 'text', { unique: false }); // Index for searching
                     console.log("Created object store: 'messages' with 'text' index.");
                 } else {
                     console.log("Object store 'messages' already exists.");
                 }
            };

            request.onsuccess = function(event) {
                const db = event.target.result;
                 // Add general error handler for the database connection
                 db.onerror = (errEvent) => console.error("IndexedDB Database Error:", errEvent.target.error);
                resolve(db);
            };

            request.onerror = function(event) {
                console.error("IndexedDB Open Error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

     // Load data from the selected storage type (Local, Session, or IndexedDB)
     async function loadUsers(key = historyStorageKey) {
         console.log(`Attempting to load history from: ${storageType} with key '${key}'`);
         try {
             if (storageType === 'local') {
                 const data = localStorage.getItem(key);
                 return data ? JSON.parse(data) : [];
             } else if (storageType === 'session') {
                 const data = sessionStorage.getItem(key);
                 return data ? JSON.parse(data) : [];
             } else if (storageType.startsWith('indexedDB')) { // Handle 'indexedDB' and 'indexedDB:key'
                 const idbKey = storageType.split(':')[1] || key; // Use key if none specified after colon
                  return await loadFromIndexedDB(idbKey);
             } else {
                  console.error(`Unknown storage type: ${storageType}`);
                  return [];
             }
         } catch (e) {
             console.error(`Error loading from ${storageType} with key '${key}':`, e);
         }
         return []; // Return empty array on any error
     }

      // Save data to the selected storage type
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
             } else if (storageType.startsWith('indexedDB')) { // Handle 'indexedDB' and 'indexedDB:key'
                  const idbKey = storageType.split(':')[1] || key;
                 await saveToIndexedDB(idbKey, users);
             } else {
                  console.error(`Unknown storage type: ${storageType}`);
                  return Promise.reject(new Error(`Unknown storage type: ${storageType}`));
             }
             console.log("Save successful.");
             return Promise.resolve();
         } catch (e) {
             console.error(`Error saving to ${storageType} with key '${key}':`, e);
             // Check for QuotaExceededError specifically for web storage
             if ((storageType === 'local' || storageType === 'session') && e instanceof DOMException && (e.code === 22 || e.code === 1014 || e.name === 'QuotaExceededError')) {
                  console.error("Storage quota exceeded for Web Storage.");
                  showOnlineErrorDisplay("Storage quota exceeded. Cannot save history.");
                  return Promise.reject(new Error("Storage quota exceeded."));
             }
              // Check for error in IndexedDB save
              if (storageType.startsWith('indexedDB')) {
                   showOnlineErrorDisplay(`Error saving history to IndexedDB: ${e.message}`);
                   return Promise.reject(e);
              }
             showOnlineErrorDisplay(`Error saving history: ${e.message}`);
             return Promise.reject(e);
         }
     }

     async function loadFromIndexedDB(key) {
         let db;
         try {
             db = await openIndexedDB();
         } catch (error) {
             console.error(`Failed to open IndexedDB for loading key '${key}':`, error);
             return []; // Return empty array if DB fails to open
         }

         return new Promise((resolve) => {
             const transaction = db.transaction('users', 'readonly');
             const store = transaction.objectStore('users');
             const request = store.get(key);

             request.onsuccess = function(event) {
                 const result = event.target.result;
                 resolve(result ? result.value : []); // Resolve with data or empty array
             };
             request.onerror = function(event) {
                 console.error(`IndexedDB Load Error for key '${key}':`, event.target.error);
                 resolve([]); // Resolve with empty array on store error
             };
              // Ensure transaction completion/error closes the DB
              transaction.oncomplete = () => { db.close(); };
              transaction.onerror = (event) => { console.error(`IDB load transaction error for ${key}:`, event.target.error); db.close(); resolve([]); }; // Resolve empty on transaction error
              transaction.onabort = (event) => { console.error(`IDB load transaction aborted for ${key}:`, event.target.error); db.close(); resolve([]); }; // Resolve empty on transaction abort
         });
     }

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
             throw error; // Re-throw if DB fails to open
         }

         return new Promise((resolve, reject) => {
             const transaction = db.transaction('users', 'readwrite');
             const store = transaction.objectStore('users');
             const request = store.put({ key: key, value: users }); // Use put to add or update

             request.onsuccess = function() {
                 // Optional: console.log(`IndexedDB Put successful for key '${key}'.`);
             };
             request.onerror = function(event) {
                  console.error(`IndexedDB Put Error for key '${key}':`, event.target.error);
                  reject(event.target.error); // Reject on store error
             };

              // Ensure transaction completion/error closes the DB
              transaction.oncomplete = () => {
                  db.close();
                  resolve(); // Resolve on transaction complete
              };
              transaction.onabort = (event) => {
                  console.error(`IndexedDB transaction for key '${key}' aborted.`, event.target.error || 'Unknown abort reason');
                  db.close();
                  reject(event.target.error || new Error('Transaction aborted')); // Reject on abort
              };
               transaction.onerror = (event) => {
                  console.error(`IndexedDB transaction error for key '${key}'.`, event.target.error);
                  db.close();
                  reject(event.target.error); // Reject on transaction error
              };
         });
     }

      // Get all keys from the 'users' object store
      async function getIndexedDBKeys() {
          let db;
          try {
              db = await openIndexedDB();
          } catch (error) {
              console.error("Failed to open IndexedDB for getting keys:", error);
              return []; // Return empty array if DB fails to open
          }

          return new Promise((resolve) => {
              const transaction = db.transaction('users', 'readonly');
              const store = transaction.objectStore('users');
              const request = store.getAllKeys(); // Get all keys in the store

              request.onsuccess = function(event) {
                  const keys = event.target.result || [];
                   resolve(keys); // Resolve with keys array
              };
              request.onerror = function(event) {
                  console.error("IndexedDB GetAllKeys Error:", event.target.error);
                  resolve([]); // Resolve empty array on store error
              };
              // Ensure transaction completion/error closes the DB
              transaction.oncomplete = () => { db.close(); };
              transaction.onerror = (event) => { console.error("IDB getAllKeys transaction error:", event.target.error); db.close(); resolve([]); }; // Resolve empty on transaction error
               transaction.onabort = (event) => { console.error("IDB getAllKeys transaction aborted:", event.target.error); db.close(); resolve([]); }; // Resolve empty on transaction abort
          });
      }

     // --- Message Storage (IndexedDB) ---
    async function saveMessageToIndexedDB(message) {
         if (!message || typeof message.text !== 'string' || message.text.trim() === '') {
              console.warn("Attempted to save empty or invalid message:", message);
              return Promise.reject(new Error("Invalid message data."));
         }

        let db;
        try {
            db = await openIndexedDB();
        } catch (error) {
             console.error("Failed to open IndexedDB for saving message:", error);
            throw error; // Re-throw if DB fails to open
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction('messages', 'readwrite');
            const store = transaction.objectStore('messages');

             const messageToSave = {
                 text: message.text.trim(),
                 timestamp: new Date().toISOString(), // Save ISO string for easy sorting
             };

            const request = store.add(messageToSave); // Use add for new unique keys (autoIncrement)

            request.onsuccess = function(event) {
                 // event.target.result is the generated key (id)
                resolve(event.target.result);
            };

            request.onerror = function(event) {
                console.error("IndexedDB Message Save Error:", event.target.error);
                reject(event.target.error); // Reject on store error
            };

             // Ensure transaction completion/error closes the DB
             transaction.oncomplete = () => { db.close(); };
             transaction.onabort = (event) => { console.error("IDB message save transaction aborted.", event.target.error); db.close(); reject(event.target.error || new Error('Transaction aborted')); }; // Reject on abort
             transaction.onerror = (event) => { console.error("IDB message save transaction error.", event.target.error); db.close(); reject(event.target.error); }; // Reject on transaction error
        });
    }

    async function loadMessagesFromIndexedDB() {
        let db;
        try {
            db = await openIndexedDB();
        } catch (error) {
            console.error("Failed to open IndexedDB for loading messages:", error);
            return []; // Return empty array if DB fails to open
        }

        return new Promise((resolve) => {
            const transaction = db.transaction('messages', 'readonly');
            const store = transaction.objectStore('messages');

            const request = store.getAll(); // Get all objects in the store

            request.onsuccess = function(event) {
                resolve(event.target.result || []); // Resolve with messages array or empty
            };

            request.onerror = function(event) {
                console.error("IndexedDB Load All Messages Error:", event.target.error);
                resolve([]); // Resolve empty array on store error
            };

             // Ensure transaction completion/error closes the DB
             transaction.oncomplete = () => { db.close(); };
             transaction.onerror = (event) => { console.error("IDB load all messages transaction error:", event.target.error); db.close(); resolve([]); }; // Resolve empty on transaction error
              transaction.onabort = (event) => { console.error("IDB load all messages transaction aborted:", event.target.error); db.close(); resolve([]); }; // Resolve empty on transaction abort
        });
    }


    // --- Data Fetching and Processing (Simulated) ---
    async function fetchData() {
        console.log("Executing fetchData: Simulating online user data fetch...");
        stopAutoScroll();
        showOnlineLoadingIndicator("Simulating online user data fetch...");
        clearOnlineErrorDisplay();
         fetchFailed = false; // Assume success unless explicitly set to true

        // --- Simulation: Replace actual fetch logic ---
        // Simulate an empty response from the API
        allOnlineUsersData = [];
        let totalFetchedCount = 0; // Total users fetched is 0

        // Set fetchFailed to true here if you want to test the fetch failure display path
        // fetchFailed = true;
        // --- End Simulation ---

        if (fetchFailed) {
            console.warn("fetchData: Simulated fetch failed.");
            showOnlineErrorDisplay("Failed to load online users (API unavailable).");
        } else {
             console.log("fetchData: Simulated fetch successful (returned 0 users).");
        }

        lastFilteredUsers = []; // Reset filtered list

        // Keep logic for populating filters, displaying users, and previous users,
        // even if allOnlineUsersData is empty. The display functions handle empty lists.
        console.log("fetchData: Populating filters and displaying users based on simulation results.");
        populateFilters(allOnlineUsersData); // This will populate filters with nothing if allOnlineUsersData is empty
        if (userSearchInput && typeof $.fn.autocomplete === 'function') {
             $(userSearchInput).autocomplete('option', 'source', getAllUsernames()); // Autocomplete source will be empty
        }
        applyFiltersAndDisplay(); // This will display the empty list
        await displayPreviousUsers(); // History display depends on allOnlineUsersData being online & public

        hideOnlineLoadingIndicator();
        console.log("fetchData execution finished.");
    }

     // Gets usernames from the (now empty) allOnlineUsersData
     function getAllUsernames() {
         if (!allOnlineUsersData || allOnlineUsersData.length === 0) {
             return [];
         }
         return allOnlineUsersData.map(user => user.username);
     }


    // --- Filtering and Display ---
    function populateFilters(users) {
         if (!filterTagsSelect || !filterAgeSelect) {
              console.warn("Filter select elements not found. Cannot populate filters.");
              return;
         }
        console.log(`Populating filters with data from ${users.length} users...`);

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

        // Preserve current selections when repopulating
        const currentSelectedTags = Array.from(filterTagsSelect.selectedOptions).map(opt => opt.value);
        const currentSelectedAges = Array.from(filterAgeSelect.selectedOptions).map(opt => parseInt(opt.value));

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


     function applyFiltersAndDisplay(buttonFilters = {}) {
        console.log("Applying filters...", { buttonFilters, currentUserSearchTerm });

        // If allOnlineUsersData is empty (due to simulation or failure), just display an empty list
        if (fetchFailed || allOnlineUsersData.length === 0) {
            console.warn("Applying filters skipped: No online user data available (fetch failed or list is empty).");
            lastFilteredUsers = []; // Ensure filtered list is empty
            displayOnlineUsersList(lastFilteredUsers);
            return;
        }

        // Get selected filter values
        let filterTags = [];
        if (buttonFilters.tag) {
            filterTags = [buttonFilters.tag.toLowerCase()];
             console.log(`Quick filter applied: Tag = ${buttonFilters.tag}`);
        } else if (filterTagsSelect) {
            filterTags = Array.from(filterTagsSelect.selectedOptions)
                .map(option => option.value.toLowerCase())
                .filter(tag => tag !== ''); // Exclude the "-- All Tags --" option value
        }

        let filterAges = [];
        if (buttonFilters.age) {
            filterAges = [parseInt(buttonFilters.age)];
             console.log(`Quick filter applied: Age = ${buttonFilters.age}`);
        } else if (filterAgeSelect) {
            filterAges = Array.from(filterAgeSelect.selectedOptions)
                .map(option => parseInt(option.value))
                .filter(age => !isNaN(age) && age > 0); // Exclude the "-- All Ages --" option value and invalid numbers
        }

         // Update search term unless a quick filter was used
         if (Object.keys(buttonFilters).length === 0) {
              currentUserSearchTerm = userSearchInput ? userSearchInput.value.trim().toLowerCase() : '';
         } else {
             currentUserSearchTerm = ''; // Clear search term if a quick filter button is clicked
              if (userSearchInput) userSearchInput.value = ''; // Also clear the input field
         }


        console.log("Active filters:", { filterTags, filterAges, userSearchTerm: currentUserSearchTerm });

        // Filter the main online user data
        const filteredUsers = allOnlineUsersData.filter(user => {
            // Basic checks for valid user data and public status (if needed based on actual API)
            // Note: Since allOnlineUsersData is empty, this filter will always result in an empty array now.
             if (!user || !user.username || user.current_show !== 'public') { // Assuming 'public' status filter
                return false;
            }

             // Tag filtering
             let hasTags = true;
             if (filterTags.length > 0) {
                 const userTagsLower = (user.tags && Array.isArray(user.tags))
                     ? user.tags.map(t => typeof t === 'string' ? t.toLowerCase() : '')
                     : [];
                 hasTags = filterTags.some(filterTag => userTagsLower.includes(filterTag)); // User must have at least one selected tag
             }

            // Age filtering
            let isAgeMatch = true;
            if (filterAges.length > 0) {
                isAgeMatch = (user.age && typeof user.age === 'number')
                    ? filterAges.includes(user.age)
                    : false;
            }

             // Username search filtering
             let isUserSearchMatch = true;
             if (currentUserSearchTerm !== '') {
                  isUserSearchMatch = user.username.toLowerCase().includes(currentUserSearchTerm);
             }

            return hasTags && isAgeMatch && isUserSearchMatch;
        });

        console.log(`Filtered ${allOnlineUsersData.length} users down to ${filteredUsers.length}.`);
        lastFilteredUsers = filteredUsers; // Store the result
        displayOnlineUsersList(filteredUsers); // Display the filtered list
    }


    function displayOnlineUsersList(usersToDisplay) {
         // Ensure the container exists before manipulating it
         if (!onlineUsersDiv) {
             console.warn("Online users display div (#onlineUsers .user-list) not found. Cannot display users.");
             return;
         }
        console.log(`displayOnlineUsersList: Displaying ${usersToDisplay.length} filtered online users in ${displayMode} mode.`);

        stopAutoScroll(); // Stop auto-scroll whenever the list is updated

        onlineUsersDiv.innerHTML = ""; // Clear current list

        // Display appropriate message if the list is empty
        if (usersToDisplay.length === 0) {
            if (fetchFailed) {
                 onlineUsersDiv.innerHTML = '<p class="text-muted w3-center w3-text-red">Failed to load online users (API unavailable).</p>';
            } else {
                 onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found (API unavailable or no users online).</p>';
            }

            // Disable auto-scroll button if the list is not scrollable
            if (toggleAutoScrollButton) {
                toggleAutoScrollButton.disabled = true;
                toggleAutoScrollButton.textContent = 'Not Scrollable';
                 toggleAutoScrollButton.classList.remove('w3-red');
                 toggleAutoScrollButton.classList.add('w3-green');
            }
             // Clear image analysis queue and status if no images are displayed
             analysisQueue = [];
             isAnalyzing = false;
             showRecognitionStatus('');
            return;
        }

        // Add mode classes for styling
        onlineUsersDiv.classList.toggle('image-mode', displayMode === 'image');
        onlineUsersDiv.classList.toggle('iframe-mode', displayMode === 'iframe');


        const fragment = document.createDocumentFragment();

         // Prepare image analysis queue if in image mode and model is loaded
         if (displayMode === 'image' && mobilenetModel) {
             analysisQueue = []; // Clear previous queue
             isAnalyzing = false;
              showRecognitionStatus('Queuing images for analysis...');
         } else {
               // Clear queue and status if not in image mode or model not available
               analysisQueue = [];
               isAnalyzing = false;
               showRecognitionStatus('');
         }


        usersToDisplay.forEach(user => {
            // Basic data validation for user object
            if (!user || !user.image_url || !user.username) {
                console.warn("Skipping online user display due to incomplete data:", user);
                return; // Skip invalid user objects
            }
             // Find the user in the main state array to potentially get existing recognition results
             // Note: With empty allOnlineUsersData, this won't find anything, so recognition will be 'pending' but won't complete.
             const userInState = allOnlineUsersData.find(u => u.username === user.username);

             if (userInState && displayMode === 'image' && !userInState.recognition_results) {
                 // Add to analysis queue only if image mode, model loaded (implicitly checked by processAnalysisQueue), and not already analyzed
                 analysisQueue.push({
                     username: user.username,
                     imageUrl: user.image_url,
                 });
                   // Set state to null/undefined to indicate pending analysis
                   user.recognition_results = null; // Use null to indicate queued/pending
             } else if (userInState && displayMode === 'iframe') {
                  // In iframe mode, just make sure the prop exists but don't queue for analysis
                  userInState.recognition_results = userInState.recognition_results || undefined; // Or some other non-null/non-array value
             }
             // If userInState is not found (likely with empty allOnlineUsersData), the user object passed here is used as is.
             // user.recognition_results will be undefined, leading to the 'pending' state initially in image mode.


            const userElement = createUserElement(user, 'online', displayMode);
            fragment.appendChild(userElement);
        });
        onlineUsersDiv.appendChild(fragment);

         // Start processing the analysis queue if there are items and the model is ready
         if (analysisQueue.length > 0 && mobilenetModel && displayMode === 'image') {
              console.log(`Queued ${analysisQueue.length} images for recognition.`);
              processAnalysisQueue(); // Start the queue processing loop
         } else if (displayMode === 'image' && mobilenetModel && usersToDisplay.length > 0) {
               // Case where list is displayed in image mode, model is ready, but no images were queued
               // (e.g., all images already had recognition results)
               showRecognitionStatus("Recognition results shown below users.", 'info');
               setTimeout(() => showRecognitionStatus(''), 3000);
         } else if (!mobilenetModel && displayMode === 'image' && usersToDisplay.length > 0) {
               // Case where list is displayed in image mode, but model is not ready
               console.warn("MobileNet model not loaded. Cannot perform image recognition.");
               showRecognitionStatus("Image recognition not available (model loading failed?).", 'warning');
         } else {
              // Case where list is empty, or not in image mode
              showRecognitionStatus('');
         }


         // Re-evaluate auto-scroll button state after rendering
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


    async function displayPreviousUsers() {
         // Ensure the container exists before manipulating it
         if (!previousUsersDiv) {
             console.warn("Previous users display div (#previousUsers .user-list) not found.");
             return;
         }
         console.log(`displayPreviousUsers: Refreshing display. History has ${previousUsers.length} users loaded in state.`);
         previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Loading history...</p>'; // Initial loading message

         // Load history from storage if it's not already loaded in memory state
         // This allows the storage type selector to trigger a reload from a different source
         if (previousUsers.length === 0) {
             previousUsers = await loadUsers(historyStorageKey);
              console.log(`displayPreviousUsers: Loaded ${previousUsers.length} users from storage.`);
         }

         // Check if any history users exist in storage
         if (previousUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No viewing history saved.</p>';
            console.log("displayPreviousUsers: No previous users found in state or storage.");
            return;
         }

         // The history list is designed to show *saved* users who are *currently* online & public.
         // With allOnlineUsersData being empty, this list will also be empty.
         if (allOnlineUsersData.length === 0) {
             console.warn("displayPreviousUsers: Online user data not available. Cannot check if history users are currently online.");
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">History loaded, but online status check failed (API unavailable).</p>';
             return;
         }

         // Create a map of currently online users for quick lookup
         const onlineUserMap = new Map(allOnlineUsersData.map(user => [user.username, user]));

         // Filter the history list to include only users found in the current online list and marked as public
         const currentlyOnlineAndPublicPreviousUsers = previousUsers.filter(prevUser => {
             const onlineUser = onlineUserMap.get(prevUser.username);
             return onlineUser && onlineUser.current_show === 'public'; // Ensure user is online and in public show
         });

         console.log(`displayPreviousUsers: Found ${currentlyOnlineAndPublicPreviousUsers.length} saved users currently online & public.`);

         previousUsersDiv.innerHTML = ""; // Clear the loading message

         // Display message if no history users are currently online
         if (currentlyOnlineAndPublicPreviousUsers.length === 0) {
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">None of your saved users are online & public right now.</p>';
              return;
         }

         // Always display history users as static images
         previousUsersDiv.classList.remove('iframe-mode');
         previousUsersDiv.classList.add('image-mode');

         // Create and append user elements
         const fragment = document.createDocumentFragment();
         currentlyOnlineAndPublicPreviousUsers.forEach(user => {
             if (!user || !user.image_url || !user.username) {
                console.warn("Skipping previous user display due to incomplete data:", user);
                return;
            }
              // Use the online user data if available for the most current info (like viewer count, tags)
              const onlineUserData = onlineUserMap.get(user.username);
              const userForDisplay = onlineUserData || user; // Use online data if found, otherwise fallback to saved history data

             const userElement = createUserElement(userForDisplay, 'previous', 'image'); // History list always uses image mode
             fragment.appendChild(userElement);
         });
         previousUsersDiv.appendChild(fragment);
          console.log("displayPreviousUsers: Previous users display complete.");
    }


    function createUserElement(user, listType, mode) {
        // Basic check for essential data before creating element
         if (!user || !user.username) {
             console.warn("createUserElement: Invalid user data:", user);
             return null; // Return null if user data is insufficient
         }

        const userElement = document.createElement("div");
        userElement.className = `user-info w3-card w3-margin-bottom ${listType}-list-item ${mode}-display-mode`;
        userElement.dataset.username = user.username;
        // Set data-recognized attribute based on recognition results status
        userElement.dataset.recognized = user.recognition_results ? 'true' : (mode === 'image' && user.recognition_results === null ? 'pending' : 'N/A');

        // Prepare user details
        const tagsDisplay = (user.tags && Array.isArray(user.tags) && user.tags.length > 0)
                            ? user.tags.join(', ')
                            : 'N/A';
        const ageDisplay = (user.age && typeof user.age === 'number' && user.age > 0) ? user.age : 'N/A';

        // Handle 18th birthday details
        let ageDetails = `Age: ${ageDisplay}`;
        if (user.age === 18 && user.birthday) {
            const daysSinceBday = getDaysSince18thBirthday(user.birthday, user.age);
            if (daysSinceBday !== null) {
                ageDetails = `Age: 18 <span class="age-days">(${daysSinceBday} days)</span>`;
            } else {
                 ageDetails = `Age: 18`; // Fallback if birthday is invalid or in future/past 18-19 range
            }
        }

        // Optional badges and banners
        const newBadge = user.is_new ? '<span class="badge new-badge w3-tag w3-small w3-red w3-round">New</span>' : '';
        const birthdayBanner = isBirthday(user.birthday) ? `<p class="birthday w3-text-amber w3-center">🎂 Happy Birthday! 🎂</p>` : '';
        const removeButton = listType === 'previous' ? '<button class="remove-user-btn w3-button w3-tiny w3-red w3-hover-dark-grey w3-circle" title="Remove from history">×</button>' : '';

        // Media content (Image or Iframe)
        let mediaContent = '';
        if (mode === 'iframe') {
             const iframeSrc = `${LIST_IFRAME_BASE_URL}${user.username}/${LIST_IFRAME_PARAMS}`;
            mediaContent = `
                <div class="iframe-container">
                     <!-- Added title for accessibility -->
                     <iframe src="${iframeSrc}" title="Live stream of ${user.username}" frameborder="0" scrolling="no" allowfullscreen loading="lazy"></iframe>
                     <div class="click-overlay"></div> <!-- Overlay to make the whole area clickable -->
                </div>
            `;
        } else { // Default to image mode
            // Use placeholder image if image_url is missing
            const imageUrl = user.image_url || 'https://via.placeholder.com/150?text=No+Image'; // Placeholder
            mediaContent = `
                <div class="user-image-container">
                    <img src="${imageUrl}" alt="${user.username} thumbnail" loading="lazy" class="w3-image">
                </div>
            `;
        }

        // Recognition results display area (only in image mode)
        let recognitionHtml = '';
        if (mode === 'image') {
             if (user.recognition_results && user.recognition_results.length > 0) {
                  recognitionHtml = buildRecognitionResultsHtml(user.recognition_results);
             } else if (user.recognition_results === null) {
                  recognitionHtml = `<div class="recognition-results loading-indicator w3-text-grey w3-small">Analyzing...</div>`;
             } else if (user.recognition_results && user.recognition_results.length === 0) {
                   recognitionHtml = `<div class="recognition-results w3-text-grey w3-small">No results above threshold.</div>`;
             } else {
                  // No recognition_results property or undefined/empty array initially
                  recognitionHtml = `<div class="recognition-results w3-text-grey w3-small">Pending Analysis...</div>`; // Or remove this line if you don't want "Pending Analysis"
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
                ${recognitionHtml}
            </div>
        `;

        // Add click listener to the whole user element area (excluding specific buttons/overlays)
        userElement.addEventListener("click", function(event) {
             // Prevent activating the main viewer if a button or overlay was clicked within this element
             if (event.target.closest('.remove-user-btn') || event.target.closest('.click-overlay')) {
                 return;
             }
             event.preventDefault(); // Prevent default link behavior if the element was, for example, an <a>
             handleUserClick(user);
        });

        // Add listener for the remove history button
        const removeBtn = userElement.querySelector('.remove-user-btn');
        if (removeBtn) {
            removeBtn.addEventListener("click", async function(event) {
                event.stopPropagation(); // Prevent the userElement click listener from firing
                console.log(`User clicked remove for: ${user.username}`);
                 showOnlineLoadingIndicator(`Removing ${user.username} from history...`); // Use the online list indicator for feedback
                await removeFromPreviousUsers(user.username);
                await displayPreviousUsers(); // Refresh the history list display
                hideOnlineLoadingIndicator(); // Hide indicator after update
            });
        }

         // Add listener for the click overlay on iframes
         const overlay = userElement.querySelector('.click-overlay');
         if (overlay) {
             overlay.addEventListener('click', function(event) {
                 event.stopPropagation(); // Prevent the userElement click listener from firing
                  console.log(`Overlay clicked for: ${user.username}. Triggering handleUserClick.`);
                  handleUserClick(user); // Trigger user click logic
             });
         }

        return userElement; // Return the created element
    }

    // Helper to generate HTML for recognition results
    function buildRecognitionResultsHtml(results) {
        if (!results || results.length === 0) {
            return ''; // Return empty string if no results
        }
        let html = '<div class="recognition-results"><strong>Recognized:</strong><ul>';
        results.forEach(result => {
            const confidence = (result.probability * 100).toFixed(1); // Format confidence
            html += `<li>${result.className} (${confidence}%)</li>`;
        });
        html += '</ul></div>';
        return html;
    }


    function handleUserClick(user) {
         // Ensure main iframes are available
         if (mainIframes.length === 0 || mainIframes.every(i => !i)) {
              console.error("Main viewer iframe elements not found. Cannot load user stream.");
              showReportStatus("Viewer iframes not initialized correctly.", 'error'); // Use report status for viewer feedback
              return;
         }
         // Ensure user data is valid
         if (!user || !user.username) {
             console.error("Invalid user data passed to handleUserClick:", user);
             return;
         }
        console.log(`User clicked: ${user.username}`);

        // Determine which main iframe to load the user into based on radio button selection
        const iframeChoiceRadio = document.querySelector('input[name="iframeChoice"]:checked');
        const selectedIframeId = iframeChoiceRadio ? iframeChoiceRadio.value : 'mainIframe'; // Default to 'mainIframe' (index 0)

        const selectedIframe = document.getElementById(selectedIframeId);

         // Ensure the selected iframe element exists
         if (!selectedIframe) {
              console.error(`Selected iframe element '${selectedIframeId}' not found.`);
              showReportStatus(`Selected viewer viewport '${selectedIframeId}' not found.`, 'error');
              return;
         }

        // Construct the iframe source URL
        const iframeSrc = `${MAIN_IFRAME_BASE_URL}${user.username}/${MAIN_IFRAME_PARAMS}`;

        console.log(`Loading ${user.username} into ${selectedIframeId} with src: ${iframeSrc}`);
        selectedIframe.src = iframeSrc; // Load the user's stream

        // Add the user to history (asynchronously)
        addToPreviousUsers(user).catch(err => {
            console.error(`Error adding ${user.username} to previous users:`, err);
            // Optional: Show a small error message related to history saving
        });
    }


    // --- History Management ---
    async function addToPreviousUsers(user) {
         // Find if the user is already in the history list
         const existingIndex = previousUsers.findIndex(u => u.username === user.username);

         // Create a history entry object with relevant user data and a timestamp
         const userEntry = {
             username: user.username,
             image_url: user.image_url, // Keep image URL for display
             timestamp: Date.now(), // Timestamp for sorting/recency
             age: user.age,
             tags: user.tags,
             is_new: user.is_new,
             birthday: user.birthday,
             // Note: recognition_results are not saved in history by default,
             // as they might be specific to a fetch cycle's analysis.
         };

         if (existingIndex !== -1) {
             // If user exists, remove the old entry to add the new one at the top (most recent)
             previousUsers.splice(existingIndex, 1);
             console.log(`Moved existing user ${user.username} to top of history.`);
         }

         // Add the new (or updated) user entry to the beginning of the array
         previousUsers.unshift(userEntry);

         // Trim the history list if it exceeds the maximum size
         if (previousUsers.length > maxHistorySize) {
             previousUsers = previousUsers.slice(0, maxHistorySize);
             console.log(`History size limited to ${maxHistorySize}.`);
         }

         console.log(`Added/Moved ${user.username} to history. History size: ${previousUsers.length}`);

         // Save the updated history list to storage
         await saveUsers(previousUsers, historyStorageKey);

         // Refresh the history list display
         await displayPreviousUsers();
    }

     async function removeFromPreviousUsers(username) {
          const initialLength = previousUsers.length;
          // Filter out the user to remove
          previousUsers = previousUsers.filter(user => user.username !== username);

          // If the length changed, it means a user was removed, so save
          if (previousUsers.length < initialLength) {
               console.log(`Removed ${username} from history.`);
               await saveUsers(previousUsers, historyStorageKey);
          } else {
               console.warn(`Attempted to remove ${username} from history, but user not found.`);
          }
          // The caller is responsible for re-displaying the history list after this.
     }

     async function clearPreviousUsers() {
         console.log("Attempting to clear history...");
         const confirmClear = confirm("Are you sure you want to clear your viewing history?");
         if (!confirmClear) {
             console.log("History clear cancelled.");
             return;
         }

         previousUsers = []; // Clear the in-memory state
         console.log("History cleared from state.");

         try {
             // Clear from the selected storage type
             if (storageType === 'local') {
                 localStorage.removeItem(historyStorageKey);
                 console.log(`History key '${historyStorageKey}' cleared from Local Storage.`);
             } else if (storageType === 'session') {
                 sessionStorage.removeItem(historyStorageKey);
                 console.log(`History key '${historyStorageKey}' cleared from Session Storage.`);
             } else if (storageType.startsWith('indexedDB')) {
                  const idbKey = storageType.split(':')[1] || historyStorageKey;
                  let db;
                  try {
                      db = await openIndexedDB();
                      const transaction = db.transaction('users', 'readwrite');
                      const store = transaction.objectStore('users');
                      const request = store.delete(idbKey); // Delete the specific key

                      // Wait for the transaction to complete
                      await new Promise((resolve, reject) => {
                           request.onsuccess = () => resolve();
                           request.onerror = (event) => reject(event.target.error);
                           transaction.oncomplete = () => { db.close(); resolve(); };
                           transaction.onerror = (event) => { db.close(); reject(event.target.error); };
                           transaction.onabort = (event) => { db.close(); reject(event.target.error || new Error('Transaction aborted')); };
                      });
                       console.log(`History key '${idbKey}' cleared from IndexedDB.`);

                  } catch (error) {
                       console.error(`Failed to open/clear IndexedDB for key '${idbKey}':`, error);
                      throw error; // Re-throw the error
                  }
             } else {
                  console.warn(`Clear history requested for unknown storage type: ${storageType}`);
             }

             console.log(`History cleared from ${storageType}.`);
             showReportStatus("Viewing history cleared.", 'success'); // Use report status for history feedback

         } catch (e) {
             console.error(`Error clearing history from ${storageType}:`, e);
              showReportStatus(`Failed to clear history: ${e.message}`, 'error');
         } finally {
              // Always refresh the history display after attempting to clear
              await displayPreviousUsers();
         }
     }


    // --- Storage Type Handling ---
      async function populateStorageOptions() {
         if (!storageTypeSelector) {
              console.warn("Storage type selector not found. Cannot populate options.");
              return;
         }
          console.log("Populating storage options...");
          // Store the currently selected value before clearing options
          const currentSelectedValue = storageTypeSelector.value;

         // Add standard options
         storageTypeSelector.innerHTML = `
             <option value="local">Local Storage</option>
             <option value="session">Session Storage</option>
             <option value="indexedDB">IndexedDB (Default History)</option>
         `;

         // Add options for other keys found in IndexedDB
         try {
             const idbKeys = await getIndexedDBKeys();
              console.log("Found IndexedDB keys:", idbKeys);
             idbKeys.forEach(key => {
                  // Add an option for each key, but only if it's not the default history key
                  if (key !== historyStorageKey) {
                      const option = document.createElement('option');
                      option.value = `indexedDB:${key}`; // Use a distinct value prefix
                      option.textContent = `IndexedDB: ${key}`;
                       // Check if this option was previously selected
                       if (currentSelectedValue === option.value) {
                           option.selected = true;
                       }
                      storageTypeSelector.appendChild(option);
                  }

             });
         } catch (e) {
             console.error("Error getting IndexedDB keys:", e);
              // Optionally add an error option
              const errorOption = document.createElement('option');
              errorOption.value = 'indexedDB:error';
              errorOption.textContent = 'IndexedDB Error';
              errorOption.disabled = true;
              storageTypeSelector.appendChild(errorOption);
         }

          // Restore the previously selected value or default to 'indexedDB'
          if (currentSelectedValue && storageTypeSelector.querySelector(`option[value="${currentSelectedValue}"]`)) {
               storageTypeSelector.value = currentSelectedValue;
          } else {
               storageTypeSelector.value = 'indexedDB';
          }
          // Update the global storageType variable based on the final selection
          storageType = storageTypeSelector.value;
          console.log(`Storage options populated. Current type: ${storageType}`);

     }


    // --- Messaging Feature ---
    async function saveMessage() {
         // Ensure DOM elements exist
         if (!messageInput || !messageStatusDisplay || !saveMessageButton) {
              console.warn("Messaging DOM elements missing. Cannot save message.");
              showReportStatus("Messaging feature elements missing.", 'error'); // Use report status for general app feedback
              return;
         }

         const text = messageInput.value.trim();
         if (text === '') {
              showStatusMessage(messageStatusDisplay, "Message is empty.", 'warning');
              return;
         }

         showStatusMessage(messageStatusDisplay, "Saving...", 'loading');
         saveMessageButton.disabled = true; // Disable button during save
         messageInput.disabled = true; // Disable input during save

         try {
              // Save the message to IndexedDB
              await saveMessageToIndexedDB({ text: text });
              console.log("Message saved successfully.");
              messageInput.value = ''; // Clear input field
              await loadAndDisplayMessages(); // Reload and display messages
              showStatusMessage(messageStatusDisplay, "Message saved!", 'success');
               // Hide the success message after a few seconds
               setTimeout(() => showStatusMessage(messageStatusDisplay, '', 'info', false), 3000);
         } catch (error) {
              console.error("Failed to save message:", error);
              showStatusMessage(messageStatusDisplay, `Error saving message: ${error.message}`, 'error');
         } finally {
             // Re-enable button and input regardless of success or failure
             saveMessageButton.disabled = false;
             messageInput.disabled = false;
         }
    }

    async function loadAndDisplayMessages() {
         // Ensure DOM elements exist
         if (!messageListDiv || !messageSearchInput) {
              console.warn("Message list div or search input not found. Cannot load/display messages.");
              return;
         }
         console.log("Loading and displaying messages...");
         messageListDiv.innerHTML = '<p class="text-muted w3-center">Loading messages...</p>'; // Show loading message

         try {
              // Load messages from IndexedDB
              savedMessages = await loadMessagesFromIndexedDB();
              console.log(`Loaded ${savedMessages.length} messages from DB.`);

              // Update autocomplete source for messages
              if (typeof $.fn.autocomplete === 'function' && messageSearchInput) {
                   $(messageSearchInput).autocomplete('option', 'source', getAllMessageTexts());
              } else {
                  console.warn("jQuery UI Autocomplete not available or message search input not found for message search.");
                   if(messageSearchInput) messageSearchInput.disabled = true; // Disable input if autocomplete isn't ready
              }

              // Get the current search term and filter messages
              currentMessageSearchTerm = messageSearchInput ? messageSearchInput.value.trim().toLowerCase() : '';

              const filteredMessages = savedMessages.filter(msg =>
                  currentMessageSearchTerm === '' || (msg.text && msg.text.toLowerCase().includes(currentMessageSearchTerm)) // Filter by search term
              );

              // Display the filtered list
              displayMessagesList(filteredMessages);

         } catch (error) {
             console.error("Error loading messages:", error);
             messageListDiv.innerHTML = '<p class="text-muted w3-center w3-text-red">Error loading messages.</p>'; // Show error message
         }
    }

     // Helper to get all message texts for autocomplete source
     function getAllMessageTexts() {
         if (!savedMessages || savedMessages.length === 0) {
             return [];
         }
         return savedMessages.map(msg => msg.text).filter(Boolean); // Filter out any potential null/undefined texts
     }

    // Display a list of messages in the message list div
    function displayMessagesList(messagesToDisplay) {
         if (!messageListDiv) return;

         messageListDiv.innerHTML = ""; // Clear current list

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

    // Create a DOM element for a single message item
    function createMessageElement(message) {
        const messageElement = document.createElement("div");
        messageElement.className = "message-item w3-light-grey w3-padding-small w3-margin-bottom w3-round";
        messageElement.textContent = message.text;
        messageElement.dataset.messageId = message.id; // Store ID if needed later (e.g., for deletion)
        messageElement.style.cursor = 'pointer'; // Indicate it's clickable

        // Add click listener to copy message text
        messageElement.addEventListener("click", function() {
            copyToClipboard(message.text);
        });

        return messageElement;
    }

    // Copy text to the user's clipboard
    function copyToClipboard(text) {
         // Ensure status display exists for feedback
         if (!messageStatusDisplay) {
              console.warn("Message status display not found. Cannot provide copy feedback.");
         }

        // Use the modern Clipboard API if available
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                console.log("Text copied to clipboard:", text);
                 if(messageStatusDisplay) showStatusMessage(messageStatusDisplay, "Copied to clipboard!", 'success');
                 // Hide success message after a short delay
                 if(messageStatusDisplay) setTimeout(() => showStatusMessage(messageStatusDisplay, '', 'info', false), 2000);
            }).catch(err => {
                console.error("Failed to copy text:", err);
                 if(messageStatusDisplay) showStatusMessage(messageStatusDisplay, `Failed to copy: ${err.message}`, 'error');
            });
        } else {
             // Fallback for browsers that don't support the Clipboard API (less reliable)
             console.warn("Clipboard API not available. Attempting execCommand fallback.");
              try {
                  const textarea = document.createElement('textarea');
                  textarea.value = text;
                  textarea.style.position = 'fixed'; // Prevent scrolling to bottom
                  textarea.style.left = '-9999px'; // Move off-screen
                  document.body.appendChild(textarea);
                  textarea.focus();
                  textarea.select(); // Select the text

                  const successful = document.execCommand('copy');
                  document.body.removeChild(textarea); // Clean up

                  if (successful) {
                      console.log("Text copied via execCommand:", text);
                       if(messageStatusDisplay) showStatusMessage(messageStatusDisplay, "Copied to clipboard!", 'success');
                       if(messageStatusDisplay) setTimeout(() => showStatusMessage(messageStatusDisplay, '', 'info', false), 2000);
                  } else {
                      console.error("Copy failed via execCommand.");
                      if(messageStatusDisplay) showStatusMessage(messageStatusDisplay, "Copy failed: Manual copy required.", 'error');
                  }
              } catch (err) {
                   console.error("Fallback copy method failed:", err);
                   if(messageStatusDisplay) showStatusMessage(messageStatusDisplay, `Copy failed: ${err.message}`, 'error');
              }
        }
    }

    // --- Status/Feedback Display ---
    // Generic function to show status messages in specific elements
    function showStatusMessage(element, message, type = 'info', show = true) {
         if (!element) return;
         element.textContent = message;
         // Remove previous status classes
         element.classList.remove('success', 'error', 'warning', 'info', 'loading', 'status-message');
         // Add current type class and base status class
         element.classList.add('status-message', type);

         // Control visibility based on 'show' flag
         if (show && message) { // Only show if message is not empty
             element.style.display = (type === 'loading') ? 'inline-block' : 'block'; // Loading might need inline
         } else {
             element.style.display = 'none';
             element.textContent = ''; // Clear text when hiding
         }
    }

    // Specific indicators for online user list actions
    function showOnlineLoadingIndicator(message = 'Loading...') {
        if (onlineLoadingIndicator) {
            onlineLoadingIndicator.textContent = message;
            onlineLoadingIndicator.style.display = 'block';
        }
         // Also update the text inside the online users div if it's currently showing a loading/empty message
         // Check for specific text content to avoid overwriting user elements if they are already rendered
         const currentText = onlineUsersDiv?.querySelector('.text-muted.w3-center')?.textContent;
         if (onlineUsersDiv && currentText && (currentText.includes('Loading') || currentText.includes('users found') || currentText.includes('Failed to load'))) {
             onlineUsersDiv.innerHTML = `<p class="text-muted w3-center">${message}</p>`;
         }
    }
    function hideOnlineLoadingIndicator() {
        if (onlineLoadingIndicator) {
            onlineLoadingIndicator.style.display = 'none';
            onlineLoadingIndicator.textContent = '';
        }
    }
    function showOnlineErrorDisplay(message) {
         if (onlineErrorDisplay) {
            onlineErrorDisplay.textContent = message;
            onlineErrorDisplay.style.display = 'block';
         }
         // Also update the text inside the online users div if it's currently showing a loading/empty message
         const currentText = onlineUsersDiv?.querySelector('.text-muted.w3-center')?.textContent;
          if (onlineUsersDiv && currentText && (currentText.includes('Loading') || currentText.includes('users found') || currentText.includes('Failed to load'))) {
              onlineUsersDiv.innerHTML = `<p class="text-muted w3-center w3-text-red">${message}</p>`;
         }
    }
    function clearOnlineErrorDisplay() {
        if (onlineErrorDisplay) {
            onlineErrorDisplay.textContent = '';
            onlineErrorDisplay.style.display = 'none';
        }
    }

    // Specific indicators for reporting feature actions
    function showReportLoading(message = 'Processing...') {
         if (reportLoadingIndicator) {
              showStatusMessage(reportLoadingIndicator, message, 'loading', true);
         }
    }
    function hideReportLoading() {
         if (reportLoadingIndicator) {
            showStatusMessage(reportLoadingIndicator, '', 'info', false); // Hide by setting message empty and show=false
         }
    }
    function showReportStatus(message, type = 'info') {
        if (reportStatusDisplay) {
             showStatusMessage(reportStatusDisplay, message, type, true);
              // Automatically clear success/info messages after a delay
              if (type === 'success' || type === 'info') {
                   setTimeout(() => clearReportStatus(), 5000);
              }
        }
    }
    function clearReportStatus() {
         if (reportStatusDisplay) {
             showStatusMessage(reportStatusDisplay, '', 'info', false); // Hide by setting message empty and show=false
         }
    }

     // Specific indicators for image recognition status
    function showRecognitionStatus(message, type = 'info') {
         if (!recognitionStatusDisplay) return;
         recognitionStatusDisplay.textContent = message;

         // Remove previous styling classes
         recognitionStatusDisplay.classList.remove('w3-text-grey', 'w3-text-amber', 'w3-text-red');
         recognitionStatusDisplay.classList.remove('loading-indicator');

         // Apply styling and control visibility
         if (message) { // Only show if message is not empty
              recognitionStatusDisplay.style.display = 'inline-block'; // Recognition status is often inline

              if (type === 'loading') {
                   recognitionStatusDisplay.classList.add('loading-indicator');
                   recognitionStatusDisplay.classList.add('w3-text-grey');
              } else if (type === 'warning') {
                   recognitionStatusDisplay.classList.add('w3-text-amber');
              } else if (type === 'error') {
                   recognitionStatusDisplay.classList.add('w3-text-red');
              } else { // Default info or success state
                   recognitionStatusDisplay.classList.add('w3-text-grey'); // Default color
              }

         } else {
             recognitionStatusDisplay.style.display = 'none';
         }
    }


     // --- Auto-Scroll Functionality ---
     let scrollDirection = 1; // 1 for down, -1 for up
     let isAtEnd = false; // Flag to indicate if we reached the top or bottom

     // Performs one step of the auto-scroll
     function scrollStep() {
         // Stop if not scrolling or container is missing
         if (!onlineUsersDiv || !isAutoScrolling) {
             isAutoScrolling = false; // Ensure flag is false if stopping
             return;
         }

         const maxScroll = onlineUsersDiv.scrollHeight - onlineUsersDiv.clientHeight;

         // Stop if the content is not scrollable
         if (maxScroll <= 0) {
             stopAutoScroll();
             if (toggleAutoScrollButton) {
                 toggleAutoScrollButton.disabled = true;
                 toggleAutoScrollButton.textContent = 'Not Scrollable';
                  toggleAutoScrollButton.classList.remove('w3-red');
                   toggleAutoScrollButton.classList.add('w3-green');
             }
             return;
         }

         // Perform the scroll step
         onlineUsersDiv.scrollTop += scrollDirection * AUTO_SCROLL_SPEED;

         // Check if we reached the end (bottom or top)
         if (scrollDirection === 1 && onlineUsersDiv.scrollTop >= maxScroll) {
             onlineUsersDiv.scrollTop = maxScroll; // Ensure we hit the exact end
             isAtEnd = true;
             // Pause at the end if a delay is set
             if (AUTO_SCROLL_DELAY_AT_END > 0) {
                 stopAutoScroll(); // Stop the animation frame loop
                 autoScrollTimeoutId = setTimeout(() => {
                     scrollDirection = -1; // Change direction to up
                      isAtEnd = false; // Reset end flag
                      startAutoScroll(); // Restart scrolling
                 }, AUTO_SCROLL_DELAY_AT_END);
                 return; // Exit this step
             } else {
                  // No delay, just reverse direction immediately
                  scrollDirection = -1;
                  isAtEnd = false;
             }
         } else if (scrollDirection === -1 && onlineUsersDiv.scrollTop <= 0) {
              onlineUsersDiv.scrollTop = 0; // Ensure we hit the exact start
              isAtEnd = true;
              // Pause at the start if a delay is set
              if (AUTO_SCROLL_DELAY_AT_END > 0) {
                 stopAutoScroll(); // Stop the animation frame loop
                 autoScrollTimeoutId = setTimeout(() => {
                     scrollDirection = 1; // Change direction to down
                      isAtEnd = false; // Reset end flag
                      startAutoScroll(); // Restart scrolling
                 }, AUTO_SCROLL_DELAY_AT_END);
                  return; // Exit this step
             } else {
                  // No delay, just reverse direction immediately
                  scrollDirection = 1;
                  isAtEnd = false;
             }
         }

         // Request the next animation frame for smooth scrolling
         autoScrollAnimationFrameId = requestAnimationFrame(scrollStep);
     }

     // Starts the auto-scroll process
     function startAutoScroll() {
         // Check if container exists and is actually scrollable
         if (!onlineUsersDiv || onlineUsersDiv.scrollHeight <= onlineUsersDiv.clientHeight) {
              console.warn("Cannot start auto-scroll: Online list not found or not scrollable.");
               // Ensure button is disabled if not scrollable
               if (toggleAutoScrollButton) {
                   toggleAutoScrollButton.disabled = true;
                   toggleAutoScrollButton.textContent = 'Not Scrollable';
                    toggleAutoScrollButton.classList.remove('w3-red');
                    toggleAutoScrollButton.classList.add('w3-green');
               }
              return;
         }

         // Only start if not already scrolling
         if (!isAutoScrolling) {
             console.log("Starting auto-scroll.");
             isAutoScrolling = true;
             // Ensure initial state
             scrollDirection = 1; // Start scrolling down
             isAtEnd = false;
              // Update button text and style
              if (toggleAutoScrollButton) {
                  toggleAutoScrollButton.textContent = 'Stop Auto-Scroll Online';
                   toggleAutoScrollButton.classList.remove('w3-green');
                   toggleAutoScrollButton.classList.add('w3-red');
              }
             // Request the first animation frame
             autoScrollAnimationFrameId = requestAnimationFrame(scrollStep);
         }
     }

     // Stops the auto-scroll process
     function stopAutoScroll() {
         if (isAutoScrolling) {
             console.log("Stopping auto-scroll.");
             isAutoScrolling = false;
             // Cancel any pending animation frame or timeout
             if (autoScrollAnimationFrameId !== null) {
                 cancelAnimationFrame(autoScrollAnimationFrameId);
                 autoScrollAnimationFrameId = null;
             }
              if (autoScrollTimeoutId !== null) {
                 clearTimeout(autoScrollTimeoutId);
                 autoScrollTimeoutId = null;
              }
             // Update button text and style
             if (toggleAutoScrollButton) {
                 toggleAutoScrollButton.textContent = 'Start Auto-Scroll Online';
                  toggleAutoScrollButton.classList.remove('w3-red');
                  toggleAutoScrollButton.classList.add('w3-green');
             }
         }
     }

     // Handle manual scrolling by the user
     function handleManualScroll() {
         // If the user manually scrolls, stop the auto-scroll
         if (isAutoScrolling) {
             stopAutoScroll();
             console.log("Manual scroll detected, auto-scroll stopped.");
         }
     }


     // --- Viewer Layout Toggling ---
     function updateIframeLayout() {
         // Ensure container and wrappers/iframes exist
         if (!mainViewerContainer || iframeWrappers.length === 0 || mainIframes.length === 0) {
              console.error("Cannot update iframe layout: Main viewer elements not found.");
              return;
         }
         console.log(`Updating iframe layout to show ${iframeCount} viewports.`);

         // Update grid class on the container
         mainViewerContainer.classList.remove('iframe-count-2', 'iframe-count-4');
         mainViewerContainer.classList.add(`iframe-count-${iframeCount}`);

         // Show/hide iframe wrappers and enable/disable corresponding radio buttons
         for (let i = 0; i < iframeWrappers.length; i++) {
             const wrapper = iframeWrappers[i];
             const iframe = mainIframes[i]; // Get the iframe element
             const radio = document.querySelector(`input[name="iframeChoice"][value="mainIframe${i + 1}"]`); // Get the corresponding radio button

             // Ensure elements exist for this index
             if (!wrapper || !iframe || !radio) {
                  console.warn(`Missing element for viewport ${i+1}. Skipping layout update for this one.`);
                  continue;
             }

             if (i < iframeCount) {
                 wrapper.style.display = ''; // Show the wrapper
                 radio.disabled = false; // Enable the radio button
             } else {
                 wrapper.style.display = 'none'; // Hide the wrapper
                 radio.disabled = true; // Disable the radio button
                 // If the hidden iframe was selected, switch selection to the first one
                 if (radio.checked) {
                      const firstRadio = document.querySelector('input[name="iframeChoice"][value="mainIframe1"]');
                      if (firstRadio) firstRadio.checked = true;
                 }
                  // Optionally reset the src of hidden iframes to a default or blank page
                  // Check if the iframe src is already the default before resetting
                  const defaultSrc = 'https://cbxyz.com/in/?tour=dU9X&campaign=9cg6A&track=embed&signup_notice=1&disable_sound=1&mobileRedirect=never';
                  if (iframe.src && iframe.src !== 'about:blank' && !iframe.src.startsWith(defaultSrc)) { // Check if it's not already default or blank
                      iframe.src = defaultSrc;
                      console.log(`Resetting iframe src for hidden viewport ${i + 1}`);
                  } else if (!iframe.src) { // Ensure src is set if it's currently empty somehow
                       iframe.src = defaultSrc;
                  }
             }
         }

          // Update the toggle button text
          if (toggleIframeCountButton) {
              toggleIframeCountButton.textContent = `Toggle ${iframeCount === 2 ? '4' : '2'} Viewports`;
          }
          console.log("Iframe layout updated.");
     }

     // Toggles the number of main viewer iframes between 2 and 4
     function toggleIframeCount() {
         console.log("Toggling iframe count.");
         // Check if the button is available and not disabled
         if (!toggleIframeCountButton || toggleIframeCountButton.disabled) {
             console.warn("Toggle iframe count button is not available or disabled.");
             return;
         }
         // Toggle the count
         iframeCount = (iframeCount === 2) ? 4 : 2;
         // Update the layout based on the new count
         updateIframeLayout();
     }


     // --- Autocomplete Setup ---
     function setupUserAutocomplete() {
         // Ensure search input and jQuery UI Autocomplete are available
         if (!userSearchInput || typeof $.fn.autocomplete !== 'function') {
              console.warn("Cannot setup user autocomplete: Search input not found or jQuery UI Autocomplete not loaded.");
              if (userSearchInput) userSearchInput.disabled = true; // Disable the input if it exists but autocomplete fails
              return;
         }
          console.log("Setting up user autocomplete...");

         // Initialize jQuery UI Autocomplete
         $(userSearchInput).autocomplete({
             minLength: AUTOCOMPLETE_MIN_LENGTH, // Minimum characters before searching
             delay: AUTOCOMPLETE_DELAY, // Delay before searching after input stops
             source: function(request, response) {
                 const term = request.term.toLowerCase();
                 const availableUsernames = getAllUsernames(); // Get usernames from current online data (will be empty)
                 const filteredSuggestions = availableUsernames.filter(username =>
                     username.toLowerCase().includes(term)
                 );
                  // Return sliced suggestions
                  response(filteredSuggestions.slice(0, AUTOCOMPLETE_MAX_SUGGESTIONS));
             },
             select: function(event, ui) {
                 event.preventDefault(); // Prevent default behavior (filling input, submitting form)
                 userSearchInput.value = ui.item.value; // Set input value to selected suggestion
                  currentUserSearchTerm = ui.item.value.trim().toLowerCase(); // Update internal search term
                  applyFiltersAndDisplay(); // Apply filters immediately
                 console.log(`User autocomplete selected: ${ui.item.value}. Applying filters.`);
             },
              change: function(event, ui) {
                   // This fires when the input loses focus *and* the value has changed
                   // or when an item is selected (ui.item is null if no item was selected explicitly)
                   const currentValue = userSearchInput.value.trim().toLowerCase();
                   // Only re-apply filters if the value in the input field is different from the last applied search term
                   // This handles cases where user types and clicks away without selecting a suggestion, or clears the input
                   if (currentValue !== currentUserSearchTerm) {
                       currentUserSearchTerm = currentValue;
                       applyFiltersAndDisplay(); // Apply filters with the new value
                       console.log(`User search input changed/lost focus. Re-applying filters with term: "${currentUserSearchTerm}".`);
                   }
              },
              close: function() {
                   // Optionally re-apply filters when the suggestion menu closes if the input value changed
                   // This might be redundant if 'change' handles it, but can catch some edge cases.
                   // const currentValue = userSearchInput.value.trim().toLowerCase();
                   // if (currentValue !== currentUserSearchTerm) {
                   //     currentUserSearchTerm = currentValue;
                   //     applyFiltersAndDisplay();
                   //     console.log(`User search autocomplete closed. Re-applying filters with term: "${currentUserSearchTerm}".`);
                   // }
              }
         });

           // Bind input event to update the internal search term immediately as user types
           // This is useful for 'change' event to correctly detect when the input value differs from the *last applied* term.
           // Also triggers display update as user types if not using autocomplete.
           $(userSearchInput).on('input', function() {
               const currentValue = userSearchInput.value.trim().toLowerCase();
               // Only update and filter if the value has actually changed
               if (currentValue !== currentUserSearchTerm) {
                    currentUserSearchTerm = currentValue;
                    // Trigger filtering directly on input change, bypassing the need to wait for 'change' event on blur
                    // This gives a more responsive search as-you-type experience
                     applyFiltersAndDisplay();
                     console.log(`User input changed. Filtering list by: "${currentUserSearchTerm}".`);
               }
          });

         console.log("User autocomplete setup complete.");
     }

     // Setup autocomplete for searching saved messages
    function setupMessageAutocomplete() {
        // Ensure search input and jQuery UI Autocomplete are available
        if (!messageSearchInput || typeof $.fn.autocomplete !== 'function') {
             console.warn("Cannot setup message autocomplete: Search input not found or jQuery UI Autocomplete not loaded.");
             if (messageSearchInput) messageSearchInput.disabled = true; // Disable input if autocomplete fails
             return;
        }
         console.log("Setting up message autocomplete...");

        $(messageSearchInput).autocomplete({
            minLength: 0, // Allow searching from 0 characters (shows all suggestions)
            delay: AUTOCOMPLETE_DELAY,
            source: function(request, response) {
                const term = request.term.toLowerCase();
                // Filter saved messages by text content
                const filteredSuggestions = savedMessages
                     .map(msg => msg.text) // Get just the text from messages
                     .filter(text => text && text.toLowerCase().includes(term)); // Filter by search term (ensure text is not null/undefined)

                 // Return sliced suggestions
                 response(filteredSuggestions.slice(0, AUTOCOMPLETE_MAX_SUGGESTIONS));
            },
             select: function(event, ui) {
                 event.preventDefault(); // Prevent default behavior
                 messageSearchInput.value = ui.item.value; // Set input value
                  currentMessageSearchTerm = ui.item.value.trim().toLowerCase(); // Update internal search term
                  // Filter and display messages list based on selection
                  displayMessagesList(savedMessages.filter(msg => msg.text && msg.text.toLowerCase().includes(currentMessageSearchTerm)));
                 console.log(`Message autocomplete selected: "${ui.item.value}". Filtering list.`);
             },
              change: function(event, ui) {
                  // Handle input change on blur or explicit selection
                   const currentValue = messageSearchInput.value.trim().toLowerCase();
                   // Only re-filter if the value changed
                   if (currentValue !== currentMessageSearchTerm) {
                       currentMessageSearchTerm = currentValue;
                       // Filter and display messages list
                       displayMessagesList(savedMessages.filter(msg => msg.text && msg.text.toLowerCase().includes(currentMessageSearchTerm)));
                        console.log(`Message autocomplete changed/lost focus. Filtering list by: "${currentMessageSearchTerm}".`);
                   }
              }
        })
         // Also bind to the input event for search-as-you-type responsiveness without needing blur
         .on('input', function() {
             const currentValue = messageSearchInput.value.trim().toLowerCase();
              if (currentValue !== currentMessageSearchTerm) {
                 currentMessageSearchTerm = currentValue;
                 // Filter and display message list
                 const filteredMessages = savedMessages.filter(msg =>
                     currentMessageSearchTerm === '' || (msg.text && msg.text.toLowerCase().includes(currentMessageSearchTerm))
                 );
                 displayMessagesList(filteredMessages);
                  console.log(`Message input changed. Filtering list by: "${currentMessageSearchTerm}".`);
             }
         });

        console.log("Message autocomplete setup complete.");
    }


     // --- Image Recognition (TensorFlow.js/MobileNet) ---
     async function loadMobileNetModel() {
          // Check if TensorFlow.js and MobileNet libraries are loaded
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
         // Prevent loading the model multiple times
         if (mobilenetModel) {
              console.log("MobileNet model already loaded.");
              return;
         }

         console.log("Loading MobileNet model...");
          showRecognitionStatus("Loading recognition model...", 'loading');
         try {
             // Load the MobileNet model
             mobilenetModel = await mobilenet.load();
             console.log("MobileNet model loaded successfully.");
             showRecognitionStatus("Recognition model loaded.", 'success');
              // Clear status message after a delay
              setTimeout(() => showRecognitionStatus(''), 3000);

              // If users were already displayed in image mode before the model loaded,
              // queue their images for analysis now.
              if (displayMode === 'image' && lastFilteredUsers.length > 0) {
                  console.log("Model loaded after users displayed. Queuing displayed images for analysis.");
                  // Filter for users in the current list that haven't been analyzed yet
                  analysisQueue = lastFilteredUsers.filter(user => user.image_url && user.recognition_results === undefined) // Check for undefined (not yet processed)
                                                   .map(user => ({ username: user.username, imageUrl: user.image_url }));

                   // Start processing the queue if it's not already running
                   if(!isAnalyzing) {
                       processAnalysisQueue();
                   } else {
                       console.log("Analysis process is already running.");
                   }
              }


         } catch (error) {
             console.error("Failed to load MobileNet model:", error);
              showRecognitionStatus(`Recognition failed: Model load error - ${error.message}`, 'error');
              mobilenetModel = null; // Ensure model is null on failure
         }
     }

     // Processes images in the analysis queue one by one
     async function processAnalysisQueue() {
         // Check conditions to continue processing
         if (isAnalyzing || analysisQueue.length === 0 || !mobilenetModel || displayMode !== 'image' || !onlineUsersDiv) {
             isAnalyzing = false; // Ensure flag is reset if stopping
             // Clear status if queue is empty or conditions are not met
             if (analysisQueue.length === 0 || displayMode !== 'image' || !mobilenetModel) showRecognitionStatus('');
             return;
         }

         isAnalyzing = true; // Set flag to indicate processing is active
         console.log(`Starting analysis queue processing (${analysisQueue.length} items).`);
          showRecognitionStatus(`Analyzing ${analysisQueue.length} images...`, 'loading');

         // Process items in the queue until it's empty or conditions change
         while (analysisQueue.length > 0 && mobilenetModel && displayMode === 'image' && onlineUsersDiv) {
             const queueItem = analysisQueue.shift(); // Get the next item from the front of the queue
             const { username, imageUrl } = queueItem;

             // Find the corresponding user object in the main state array
             const userStateIndex = allOnlineUsersData.findIndex(u => u.username === username);
             const user = userStateIndex !== -1 ? allOnlineUsersData[userStateIndex] : null;

             // Find the corresponding user element in the displayed list
             const userElement = onlineUsersDiv.querySelector(`.user-info[data-username="${username}"]`);

              // Check if the user and element still exist and the image URL hasn't changed (list might have updated/filtered)
              // Also ensure we are still in image display mode
             if (user && userElement && displayMode === 'image' && user.image_url === imageUrl) {

                  try {
                      // Find the image element within the user element
                      const imageElement = userElement.querySelector('img');

                      // Ensure the image element exists and is still connected to the DOM
                      if (imageElement && imageElement.isConnected) {

                           // Wait for the image to be fully loaded if it's not already
                           if (!imageElement.complete || imageElement.naturalHeight === 0) {
                                console.log(`Waiting for image for ${username} to load before analysis.`);
                                await new Promise(resolve => {
                                     // Resolve when load or error occurs
                                     imageElement.onload = resolve;
                                     imageElement.onerror = resolve;
                                });
                                // Re-check if the image element is still in the DOM after waiting
                                if (!imageElement.isConnected) {
                                     console.log(`Image for ${username} removed from DOM during load wait. Skipping analysis.`);
                                     continue; // Skip to the next item in the queue
                                }
                                 // Re-check if the image loaded successfully after waiting
                                 if (!imageElement.complete || imageElement.naturalHeight === 0) {
                                     console.warn(`Image for ${username} failed to load or is empty after waiting. Skipping analysis.`);
                                      // Update the UI to show analysis failed for this image
                                      const detailsDiv = userElement.querySelector('.user-details');
                                       if (detailsDiv) {
                                            const existingResultsDiv = detailsDiv.querySelector('.recognition-results');
                                            const errorHtml = `<div class="recognition-results w3-text-red w3-small">Image load failed.</div>`;
                                            if (existingResultsDiv) { existingResultsDiv.outerHTML = errorHtml; }
                                            else { detailsDiv.insertAdjacentHTML('beforeend', errorHtml); }
                                       }
                                      // Update the user state to indicate analysis attempted but failed
                                      if (userStateIndex !== -1) allOnlineUsersData[userStateIndex].recognition_results = []; // Use empty array for failed
                                      if (userElement) userElement.dataset.recognized = 'error';
                                     continue; // Skip to the next item in the queue
                                 }
                           }

                           // Perform the image classification using the loaded model
                           console.log(`Analyzing image for ${username}...`);
                           const predictions = await mobilenetModel.classify(imageElement);
                           console.log(`Analysis results for ${username}:`, predictions);

                           // Filter predictions based on confidence threshold and max results
                           const filteredPredictions = predictions.filter(p => p.probability >= IMAGE_RECOGNITION_CONFIDENCE_THRESHOLD)
                                                                .slice(0, IMAGE_RECOGNITION_MAX_RESULTS);

                           // Update the user object in the main state array with the results
                           if (userStateIndex !== -1) {
                               allOnlineUsersData[userStateIndex].recognition_results = filteredPredictions;
                           }

                           // Update the UI element to show the recognition results
                           const detailsDiv = userElement.querySelector('.user-details');
                           const existingResultsDiv = detailsDiv?.querySelector('.recognition-results');

                           if (detailsDiv) {
                                // Build HTML for the results
                                const resultsHtml = buildRecognitionResultsHtml(filteredPredictions);
                                // Replace or add the results div
                                if (existingResultsDiv) {
                                     existingResultsDiv.outerHTML = resultsHtml || `<div class="recognition-results w3-text-grey w3-small">No results above threshold.</div>`;
                                } else if (resultsHtml) {
                                     detailsDiv.insertAdjacentHTML('beforeend', resultsHtml);
                                } else {
                                     detailsDiv.insertAdjacentHTML('beforeend', `<div class="recognition-results w3-text-grey w3-small">No results above threshold.</div>`);
                                }
                           }
                            // Update the data-recognized attribute on the user element
                            if (userElement) userElement.dataset.recognized = filteredPredictions.length > 0 ? 'true' : 'none';

                           // Update the recognition status display message
                           const remaining = analysisQueue.length;
                           if (remaining > 0) {
                                showRecognitionStatus(`Analyzing... (${remaining} remaining)`);
                           } else {
                                showRecognitionStatus("Analysis complete.", 'success');
                                setTimeout(() => showRecognitionStatus(''), 3000); // Clear final status message
                           }

                      } else {
                           // Case where the image element or user element is no longer valid/in DOM
                           console.log(`Skipping analysis for ${username}: Image element not found or not in DOM.`);
                           const detailsDiv = userElement?.querySelector('.user-details');
                            if (detailsDiv) {
                                 const existingResultsDiv = detailsDiv.querySelector('.recognition-results');
                                  const errorHtml = `<div class="recognition-results w3-text-red w3-small">Image element missing/invalid.</div>`;
                                 if (existingResultsDiv) { existingResultsDiv.outerHTML = errorHtml; }
                                 else { detailsDiv.insertAdjacentHTML('beforeend', errorHtml); }
                            }
                           // Mark as failed in state and UI
                           if (userStateIndex !== -1) allOnlineUsersData[userStateIndex].recognition_results = [];
                           if (userElement) userElement.dataset.recognized = 'error';
                      }

                  } catch (error) {
                      // Catch errors during analysis itself
                      console.error(`Error analyzing image for ${username}:`, error);
                       // Update user state and UI to indicate analysis failed
                      const userStateIndex = allOnlineUsersData.findIndex(u => u.username === username);
                      if (userStateIndex !== -1) {
                           allOnlineUsersData[userStateIndex].recognition_results = [];
                      }
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
                       if (userElement) userElement.dataset.recognized = 'error';
                  }
             } else {
                  // Case where the user or element is no longer valid, or mode changed away from image
                  console.log(`Skipping analysis for ${username} (user/element not found, mode changed, or already analyzed).`);
             }

             // Add a small delay between processing images to avoid freezing the browser UI
             await new Promise(resolve => setTimeout(resolve, ANALYSIS_DELAY));
         }

         // When the loop finishes, reset the isAnalyzing flag
         isAnalyzing = false;
         console.log("Analysis queue processing finished.");
          // Update final status message based on why it finished
          if (analysisQueue.length === 0 && displayMode === 'image' && mobilenetModel) {
               showRecognitionStatus("Image recognition complete.", 'success');
               setTimeout(() => showRecognitionStatus(''), 3000); // Clear final status after delay
          } else if (displayMode !== 'image') {
               showRecognitionStatus(`Analysis paused (${analysisQueue.length} remaining). Switch to Image mode to resume.`, 'warning');
          } else if (!mobilenetModel) {
               showRecognitionStatus(`Analysis stopped (${analysisQueue.length} remaining): Model unavailable.`, 'error');
          } else if (analysisQueue.length > 0 && onlineUsersDiv) {
               // This case shouldn't theoretically happen if the loop logic is correct, but useful for debugging
              console.warn("Analysis loop finished unexpectedly with items still in queue?");
              showRecognitionStatus(`Analysis interrupted (${analysisQueue.length} remaining).`, 'warning');
          } else if (!onlineUsersDiv) {
               // This case happens if the online users div was removed from the DOM
              console.warn("Analysis loop finished because onlineUsersDiv is missing?");
              showRecognitionStatus('', false); // Hide status if there's nowhere to put it
          }
     }


    // --- Section Toggling ---
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


    // --- DOM Initialization and Validation ---
    // Collects references to all necessary DOM elements
    function collectAndValidateDOMReferences() {
         const missingCritical = []; // Elements required for basic functionality
         const missingOptional = []; // Elements whose absence disables only specific features

         // Critical elements
         onlineUsersDiv = document.getElementById("onlineUsers")?.querySelector('.user-list');
         if (!onlineUsersDiv) missingCritical.push("#onlineUsers .user-list");

         previousUsersDiv = document.getElementById("previousUsers")?.querySelector('.user-list');
         if (!previousUsersDiv) missingCritical.push("#previousUsers .user-list");

         mainViewerContainer = document.getElementById("mainViewerContainer");
         if (!mainViewerContainer) missingCritical.push("#mainViewerContainer");

         mainIframeColumn = document.querySelector('.iframe-column');
         if (!mainIframeColumn) missingCritical.push(".iframe-column"); // Needed for layout context

         // Iframe elements and their wrappers (need at least the first two)
         iframeWrapper1 = document.getElementById("iframeWrapper1");
         mainIframe1 = document.getElementById("mainIframe");
         iframeWrapper2 = document.getElementById("iframeWrapper2");
         mainIframe2 = document.getElementById("mainIframe2");
         iframeWrapper3 = document.getElementById("iframeWrapper3"); // Optional beyond first two
         mainIframe3 = document.getElementById("mainIframe3");      // Optional beyond first two
         iframeWrapper4 = document.getElementById("iframeWrapper4"); // Optional beyond first two
         mainIframe4 = document.getElementById("mainIframe4");      // Optional beyond first two

          mainIframes = [mainIframe1, mainIframe2, mainIframe3, mainIframe4];
          iframeWrappers = [iframeWrapper1, iframeWrapper2, iframeWrapper3, iframeWrapper4];

         // Critical: Need at least the first two iframes/wrappers for the 2-viewport mode
         if (!iframeWrapper1 || !mainIframe1) missingCritical.push("#iframeWrapper1 / #mainIframe");
         if (!iframeWrapper2 || !mainIframe2) missingCritical.push("#iframeWrapper2 / #mainIframe2");

         // Controls
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

         logDisplayArea = document.getElementById("logDisplayArea");
         if (!logDisplayArea) missingCritical.push("#logDisplayArea"); // Log area itself
         logEntriesDiv = document.getElementById("logEntries");
         if (!logEntriesDiv) missingCritical.push("#logEntries"); // Container for log entries

         showLogsButton = document.getElementById("showLogsButton");
         if (!showLogsButton) missingCritical.push("#showLogsButton");

         clearLogsButton = document.getElementById("clearLogsButton");
         if (!clearLogsButton) missingCritical.push("#clearLogsButton");


         // Optional elements (features disabled if missing)
         clearPreviousUsersButton = document.getElementById("clearPreviousUsers");
          if (!clearPreviousUsersButton) missingOptional.push("#clearPreviousUsers (Clear History)");

         sendReportButton = document.getElementById("sendReportButton");
          if (!sendReportButton) missingOptional.push("#sendReportButton (Reporting)");

         reportLoadingIndicator = document.getElementById("reportLoadingIndicator");
          if (!reportLoadingIndicator) missingOptional.push("#reportLoadingIndicator (Reporting Loading Indicator)");

         reportStatusDisplay = document.getElementById("reportStatusDisplay");
          if (!reportStatusDisplay) missingOptional.push("#reportStatusDisplay (Reporting Status Display)");

         onlineLoadingIndicator = document.getElementById("onlineLoadingIndicator");
          if (!onlineLoadingIndicator) missingOptional.push("#onlineLoadingIndicator (Online Loading Indicator)");

         onlineErrorDisplay = document.getElementById("onlineErrorDisplay");
          if (!onlineErrorDisplay) missingOptional.push("#onlineErrorDisplay (Online Error Display)");

         recognitionStatusDisplay = document.getElementById("recognitionStatus");
          if (!recognitionStatusDisplay) missingOptional.push("#recognitionStatus (Image Recognition Status)");

         messageStatusDisplay = document.getElementById("messageStatusDisplay");
          if (!messageStatusDisplay) missingOptional.push("#messageStatusDisplay (Message Status Display)");

         // Section headers (for toggling)
         filtersSectionHeader = document.querySelector('h4[onclick="toggleSection(\'filters\')"]');
          if (!filtersSectionHeader) missingOptional.push("Filter section header (Toggling disabled).");
         displaySectionHeader = document.querySelector('h4[onclick="toggleSection(\'display\')']");
          if (!displaySectionHeader) missingOptional.push("Display section header (Toggling disabled).");
         viewerSectionHeader = document.querySelector('h4[onclick="toggleSection(\'viewer\')"]');
          if (!viewerSectionHeader) missingOptional.push("Viewer section header (Toggling disabled).");
         messagingSectionHeader = document.querySelector('h4[onclick="toggleSection(\'messaging\')"]');
          if (!messagingSectionHeader) missingOptional.push("Messaging section header (Toggling disabled).");
         reportingSectionHeader = document.querySelector('h4[onclick="toggleSection(\'reporting\')"]');
          if (!reportingSectionHeader) missingOptional.push("Reporting section header (Toggling disabled).");

         // Quick filter buttons
         const quickFilterButtons = document.querySelectorAll('.quick-filters button');
          if (quickFilterButtons.length === 0) missingOptional.push("Quick filter buttons (Feature disabled).");


        // Report critical errors and stop initialization if essential elements are missing
        if (missingCritical.length > 0) {
            const errorMsg = `CRITICAL ERROR: Missing essential DOM elements needed for application startup: ${missingCritical.join(', ')}. Application cannot start.`;
            originalConsole.error(errorMsg); // Use original console to ensure it logs
            // Attempt to show error in the UI if possible
            if (onlineErrorDisplay) {
                 onlineErrorDisplay.textContent = `Initialization failed: Missing required elements (${missingCritical[0]}...). Check browser console or the Logs section.`;
                 onlineErrorDisplay.style.display = 'block';
            } else {
                alert(errorMsg); // Last resort alert
            }

             // Disable critical controls if their elements were found but init failed
             [
                storageTypeSelector, filterTagsSelect, filterAgeSelect,
                toggleAutoScrollButton, toggleDisplayModeButton, toggleIframeCountButton,
                userSearchInput, messageSearchInput, messageInput, saveMessageButton,
                clearPreviousUsersButton, sendReportButton,
                showLogsButton, clearLogsButton // These might be needed for log display, but disable others
            ].forEach(el => {
                if (el && el !== logDisplayArea && el !== logEntriesDiv) { // Don't disable log display itself
                    el.disabled = true;
                     if (el.tagName === 'BUTTON') el.textContent = 'Error';
                     if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = 'Error: Init Failed';
                     if (el.tagName === 'SELECT') {
                          el.innerHTML = '<option>Error</option>';
                          el.value = 'Error';
                     }
                }
            });
             // Hide specific indicators if they exist but are irrelevant now
             if (recognitionStatusDisplay) recognitionStatusDisplay.style.display = 'none';
             if (messageStatusDisplay) messageStatusDisplay.style.display = 'none';
             if (onlineLoadingIndicator) onlineLoadingIndicator.style.display = 'none';
             if (reportLoadingIndicator) reportLoadingIndicator.style.display = 'none';

             // Ensure log area is visible if it was found
             if(logDisplayArea) {
                  logDisplayArea.classList.remove('w3-hide');
                  // Add the critical error to the log display immediately
                  if(logEntriesDiv) logEntriesDiv.innerHTML += `<div class="log-entry log-error"><span class="log-timestamp">[${formatLogTime(new Date())}]</span> <span class="log-message">${escapeHTML(errorMsg)}</span></div>`;
             }

            return false; // Indicate that initialization failed
        }

         // Report optional errors as warnings
         if (missingOptional.length > 0) {
             console.warn("Missing optional DOM elements. Some features may be disabled:", missingOptional.join(', '));
         }

        return true; // Indicate that critical elements were found
    }


    // --- Event Listener Setup ---
    function setupEventListeners() {
        console.log("Setting up event listeners...");

        // History storage selection change
        storageTypeSelector?.addEventListener("change", async function() {
             const newStorageType = this.value;
             console.log(`Storage type changed to: ${newStorageType}. Reloading history.`);
             if (newStorageType !== storageType) {
                storageType = newStorageType; // Update the global storage type
                showOnlineLoadingIndicator("Loading history from new source..."); // Show feedback
                previousUsers = await loadUsers(historyStorageKey); // Load from the new source
                await displayPreviousUsers(); // Refresh history display
                hideOnlineLoadingIndicator(); // Hide feedback
             }
        });

        // Filter dropdown changes
        filterTagsSelect?.addEventListener("change", () => applyFiltersAndDisplay());
        filterAgeSelect?.addEventListener("change", () => applyFiltersAndDisplay());

         // Quick filter button clicks
         document.getElementById("filterAge18")?.addEventListener("click", () => applyFiltersAndDisplay({ age: 18 }));
         document.getElementById("filterTagAsian")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'asian' }));
         document.getElementById("filterTagBlonde")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'blonde' }));

         // Clear history button
         clearPreviousUsersButton?.addEventListener("click", clearPreviousUsers);

         // Send report button (only if element exists)
         if (sendReportButton) {
             sendReportButton.addEventListener("click", sendReport);
         }

        // Auto-scroll toggle button (only if element exists)
        if (toggleAutoScrollButton) {
             toggleAutoScrollButton.addEventListener("click", function() {
                 if (isAutoScrolling) {
                     stopAutoScroll();
                 } else {
                     startAutoScroll();
                 }
             });
         }

         // Display mode toggle button (image/iframe list view) (only if element exists)
         if (toggleDisplayModeButton) {
             toggleDisplayModeButton.addEventListener("click", function() {
                  console.log("Display mode toggle clicked.");
                 displayMode = displayMode === 'image' ? 'iframe' : 'image'; // Toggle mode
                 console.log(`Display mode switched to: ${displayMode}`);
                 toggleDisplayModeButton.textContent = displayMode === 'image' ? 'Show Iframes' : 'Show Images'; // Update button text
                 displayOnlineUsersList(lastFilteredUsers); // Re-display the list in the new mode
                 if (onlineUsersDiv) onlineUsersDiv.scrollTop = 0; // Scroll to top after changing mode
             });
         }

         // Viewer iframe count toggle (only if element exists)
         if (toggleIframeCountButton) {
              toggleIframeCountButton.addEventListener("click", toggleIframeCount);
         }

        // Save message button (only if element exists)
        if (saveMessageButton) {
             saveMessageButton.addEventListener("click", saveMessage);
        }
         // Allow saving message with Enter key in textarea (Shift+Enter for newline)
         if (messageInput) {
             messageInput.addEventListener("keypress", function(event) {
                  if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault(); // Prevent default newline
                      saveMessage(); // Trigger save
                  }
             });
         }

         // Show logs button (only if elements exist)
         if(showLogsButton && logDisplayArea) {
              showLogsButton.addEventListener("click", function() {
                  if (logDisplayArea.classList.contains('w3-hide')) {
                      logDisplayArea.classList.remove('w3-hide'); // Show the log area
                      displayLogs(); // Populate and scroll logs
                  } else {
                      logDisplayArea.classList.add('w3-hide'); // Hide the log area
                  }
              });
         }
         // Clear logs button (only if element exists)
         if(clearLogsButton) {
              clearLogsButton.addEventListener("click", clearLogs);
         }

        // Listen for manual scrolling on the online users div to stop auto-scroll
        if (onlineUsersDiv) {
             onlineUsersDiv.addEventListener("scroll", handleManualScroll);
         }

         // Setup autocomplete features
         setupUserAutocomplete();
         setupMessageAutocomplete();

        console.log("Event listeners setup complete.");
    }


    // --- Application Initialization ---
    async function initializeApp() {
        console.log("Initializing application...");

        // Start capturing console logs immediately
        captureConsole();
        console.log("Console capture initialized."); // This will go through the captured console

        // Validate required DOM elements before proceeding
        console.log("Validating DOM elements...");
        if (!collectAndValidateDOMReferences()) {
             console.error("Initialization aborted due to missing critical DOM elements.");
             // No need to proceed further if critical elements are missing.
             // An error message is already shown in the UI and console.
             return;
        }
        console.log("DOM validation complete. All critical elements found.");

         // Expose toggleSection globally as it's used in inline onclick attributes (less ideal, but matches HTML)
         window.toggleSection = toggleSection;
         console.log("toggleSection exposed globally.");

         // Check for external dependencies (jQuery UI, TF.js, MobileNet)
         console.log("Checking dependencies...");
         let depsOk = true;
         if (typeof $ === 'undefined' || typeof $.fn.autocomplete === 'undefined') {
             console.error("Dependency Error: jQuery or jQuery UI not loaded. Autocomplete and some UI features disabled.");
             // Disable affected inputs if they were found but the dependency is missing
             if (userSearchInput) { userSearchInput.disabled = true; userSearchInput.placeholder = 'jQuery UI Missing'; }
             if (messageSearchInput) { messageSearchInput.disabled = true; messageSearchInput.placeholder = 'jQuery UI Missing'; }
              depsOk = false;
         } else {
             console.log("jQuery and jQuery UI detected.");
         }

          if (typeof tf === 'undefined' || typeof mobilenet === 'undefined') {
              console.warn("Dependency Warning: TensorFlow.js or MobileNet not loaded. Image recognition disabled.");
               showRecognitionStatus("Recognition unavailable: Dependencies missing.", 'warning');
          } else {
              console.log("TensorFlow.js and MobileNet detected. Starting model load...");
               loadMobileNetModel(); // Start loading the ML model asynchronously
          }
        console.log("Dependency checks complete.");

         // Set initial internal state based on default UI or saved preferences (if any)
         console.log("Setting initial control states...");
         displayMode = 'image'; // Start in image mode
         if (toggleDisplayModeButton) toggleDisplayModeButton.textContent = 'Show Iframes'; // Ensure button text matches default mode
         iframeCount = 2; // Start with 2 viewer iframes
         // Initialize search terms from inputs
         currentUserSearchTerm = userSearchInput ? userSearchInput.value.trim().toLowerCase() : '';
         currentMessageSearchTerm = messageSearchInput ? messageSearchInput.value.trim().toLowerCase() : '';
         console.log("Initial control states set.");

        // Populate the storage type dropdown
        console.log("Populating storage options...");
        await populateStorageOptions(); // Wait for IndexedDB keys lookup
        console.log("Storage options populated.");

        // Setup all event listeners
        console.log("Setting up event listeners...");
        setupEventListeners();
        console.log("Event listeners setup complete.");

        // Load history from storage
        console.log("Loading initial history from storage...");
        showOnlineLoadingIndicator("Loading initial history..."); // Use online indicator for general startup loading
        previousUsers = await loadUsers(historyStorageKey); // Load history into memory
        console.log(`Initial load: Found ${previousUsers.length} users in history state.`);

        // Set up the initial viewer iframe layout
        console.log("Setting up initial iframe layout...");
        updateIframeLayout();
        console.log("Initial iframe layout set.");

        // Load and display saved messages
        console.log("Loading and displaying messages...");
         await loadAndDisplayMessages();
         console.log("Messages loaded and displayed.");

        // Perform the initial data fetch (now simulated empty)
        console.log("Performing initial data fetch (simulated)...");
        await fetchData(); // This will set allOnlineUsersData to []

        // Start the periodic fetch interval (even with simulated empty data, it keeps refreshing the empty list)
        console.log("Starting periodic fetch interval (simulated)...");
        startFetchInterval();
        console.log("Periodic fetch interval started.");

        // Handle any legacy initialization functions if they exist globally (added for compatibility)
        if (typeof window.initializeAllUsers === 'function') {
            console.warn("Executing legacy compatibility function: window.initializeAllUsers()");
            window.initializeAllUsers();
        }
         // Provide a placeholder for another potential legacy function
        window.initializeAllUsersFromScriptJS = function(callback) {
            console.log("Legacy compatibility function initializeAllUsersFromScriptJS called.");
            if (typeof callback === 'function') callback();
        };

        console.log("Application initialization sequence finished.");
        hideOnlineLoadingIndicator(); // Ensure loading indicator is hidden on successful init end

        // Final check and update of button states based on initial data load results
           if (onlineUsersDiv && toggleAutoScrollButton) {
               // Check if the list is scrollable after the initial empty display
               if (onlineUsersDiv.scrollHeight > onlineUsersDiv.clientHeight) {
                   toggleAutoScrollButton.disabled = false;
                   toggleAutoScrollButton.textContent = 'Start Auto-Scroll Online';
                   toggleAutoScrollButton.classList.remove('w3-red');
                   toggleAutoScrollButton.classList.add('w3-green');
               } else {
                   toggleAutoScrollButton.disabled = true; // Disable if not scrollable
                   toggleAutoScrollButton.textContent = 'Not Scrollable';
                    toggleAutoScrollButton.classList.remove('w3-red');
                    toggleAutoScrollButton.classList.add('w3-green');
               }
           } else if (toggleAutoScrollButton) {
                // If onlineUsersDiv is missing, disable scroll button
                toggleAutoScrollButton.disabled = true;
                toggleAutoScrollButton.textContent = 'List Missing';
                toggleAutoScrollButton.classList.remove('w3-red');
                toggleAutoScrollButton.classList.add('w3-green');
           }
            // Disable display mode toggle if onlineUsersDiv is missing
            if (!onlineUsersDiv && toggleDisplayModeButton) {
                 toggleDisplayModeButton.disabled = true;
                 toggleDisplayModeButton.textContent = 'List Missing';
            }
             // Disable viewer count toggle if main viewer container is missing
             if (!mainViewerContainer) {
                 if (toggleIframeCountButton) { toggleIframeCountButton.disabled = true; toggleIframeCountButton.textContent = 'Viewer Missing'; }
             }
    }

    // Starts the periodic data fetch interval
    function startFetchInterval() {
         // Clear any existing interval before starting a new one
         if (fetchInterval) {
             clearInterval(fetchInterval);
             console.log("Cleared existing fetch interval.");
         }
         console.log(`Starting periodic fetch interval (${fetchIntervalDuration / 1000} seconds).`);
         // Set up the interval to call fetchData periodically
         fetchInterval = setInterval(async () => {
             console.log("Interval triggered: Fetching updated data...");
             await fetchData(); // Call the (now simulated) fetchData function
         }, fetchIntervalDuration);
    }


    // Execute the main initialization function when the DOM is ready
    // Use .catch() to handle any unhandled errors during async initialization
    initializeApp().catch(error => {
        console.error("Unhandled error during application initialization:", error);
        // Construct a user-friendly fatal error message
        const fatalErrorMsg = `Fatal initialization error: ${error.message}. Check browser console or the Logs section for details.`;
        // Attempt to display the error in various places in the UI
        showOnlineErrorDisplay(fatalErrorMsg);
         showReportStatus(fatalErrorMsg, 'error');
         if (messageStatusDisplay) showStatusMessage(messageStatusDisplay, 'Fatal Init Error', 'error');

        // Ensure all loading indicators are hidden
        hideOnlineLoadingIndicator();
        hideReportLoading();
        showRecognitionStatus('', false);

        // Disable most interactive controls as the app state might be unreliable
        [
             storageTypeSelector, filterTagsSelect, filterAgeSelect, // Corrected typo: filterAgeSelector -> filterAgeSelect
             toggleAutoScrollButton, toggleDisplayModeButton, toggleIframeCountButton,
             userSearchInput, messageSearchInput, messageInput, saveMessageButton,
             clearPreviousUsersButton, sendReportButton,
             // Keep showLogsButton enabled so user can see logs
             clearLogsButton
        ].forEach(el => {
             // Check if the element exists and isn't the show logs button
             if (el && el !== showLogsButton) {
                 el.disabled = true;
                 // Change button text/input placeholders to indicate error state
                 if (el.tagName === 'BUTTON') el.textContent = 'Error';
                 if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = 'Error: Init Failed';
                 if (el.tagName === 'SELECT') {
                      el.innerHTML = '<option>Error</option>';
                      el.value = 'Error';
                 }
             }
         });

         // Update display areas with error messages if they were showing loading states
         if (onlineUsersDiv && onlineUsersDiv.innerHTML.includes('Loading')) onlineUsersDiv.innerHTML = `<p class="text-muted w3-center w3-text-red">${fatalErrorMsg}</p>`;
         if (previousUsersDiv && previousUsersDiv.innerHTML.includes('Loading')) previousUsersDiv.innerHTML = `<p class="text-muted w3-center w3-text-red">History Unavailable due to error.</p>`;
         if (messageListDiv && messageListDiv.innerHTML.includes('Loading')) messageListDiv.innerHTML = `<p class="text-muted w3-center w3-text-red">Messaging Unavailable due to error.</p>`;

         // Ensure log area is visible and the fatal error is added
         if(logDisplayArea) {
              logDisplayArea.classList.remove('w3-hide');
              // Add the fatal error to the log display only once if it's not already there
              if(logEntriesDiv && !logEntriesDiv.innerHTML.includes('Fatal initialization error')) {
                   const errorHtml = `<div class="log-entry log-error"><span class="log-timestamp">[${formatLogTime(new Date())}]</span> <span class="log-message">${escapeHTML(fatalErrorMsg)}</span></div>`;
                   logEntriesDiv.insertAdjacentHTML('beforeend', errorHtml);
                   logEntriesDiv.scrollTop = logEntriesDiv.scrollHeight; // Scroll to show the latest error
              }
         }
    });

});

// **Explanation of Changes:**
// 
// 1.  **`apiUrlBase`, `apiLimit`, `maxApiFetchLimit`, `apiFetchTimeout`:** These constants are commented out or removed as they are no longer relevant.
// 2.  **`fetchData` Modification:**
//     *   The core `while` loop containing the `fetch` call is replaced.
//     *   `allOnlineUsersData` is immediately set to an empty array `[]`.
//     *   `fetchFailed` is set to `false` (simulating a successful fetch that returned no data), though you could change this to `true` to test the error display path.
//     *   The function still proceeds to call `populateFilters`, `applyFiltersAndDisplay`, and `displayPreviousUsers`, which are designed to handle empty data gracefully.
//     *   Loading/error indicators (`showOnlineLoadingIndicator`, `hideOnlineLoadingIndicator`, `clearOnlineErrorDisplay`) are still called to ensure they are shown at the start and hidden at the end of `fetchData`, preventing the "Loading" message from being stuck.
// 3.  **`displayOnlineUsersList`:** This function already correctly displays a "No online users found" message when `usersToDisplay` is empty. The modification in `fetchData` ensures this condition is met. It also correctly disables the auto-scroll button if the list is not scrollable.
// 4.  **`displayPreviousUsers`:** This function relies on `allOnlineUsersData` to determine which saved history users are *currently* online. Since `allOnlineUsersData` will always be empty, this list will also always be empty. The code now explicitly checks if `allOnlineUsersData.length === 0` after loading history and displays a message indicating that the online status check failed.
// 5.  **Button Functionality:** Buttons that rely on `allOnlineUsersData` (like filtering, searching online users, auto-scroll on the online list) will now operate on an empty list, effectively doing nothing or showing no results, which is the correct behavior when no online data is available. Buttons related to history management (`clearPreviousUsers`), message management (`saveMessage`, `message search`), reporting (`sendReport`, although the mailto method is limited), and viewer layout (`toggleIframeCount`) still work as they don't require the online user list to be populated.
// 6.  **`REPORT_SEND_METHOD`:** Changed to `mailto` as a basic client-side way to demonstrate the reporting feature without needing a server endpoint. Note the warning about data size limitations for mailto links is still relevant.
// 7.  **DOM Element Validation:** Added specific handling for `showLogsButton` in the error state disabling loop to ensure the user can still open the logs to see what went wrong.
// 8.  **Logs:** Added more detailed logging messages to track the flow, especially in the simulated `fetchData` and display functions.

// Now, when you run the application, it will simulate fetching no data, display "No online users found (API unavailable or no users online).", and display an appropriate message in the "History (Online Now)" section. Other features like saving/loading messages and toggling the viewer layout should still function.
