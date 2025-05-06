
document.addEventListener('DOMContentLoaded', async function() {

    const apiUrlBase = 'https://api.example.com/users/online';
    const apiLimit = 50;
    const maxApiFetchLimit = 500;
    const fetchIntervalDuration = 60000;
    const apiFetchTimeout = 15000;

    const REPORT_SEND_METHOD = 'placeholder-client-service';

    const AUTO_SCROLL_SPEED = 1;
    const AUTO_SCROLL_DELAY_AT_END = 1000;

    const LIST_IFRAME_BASE_URL = 'https://chaturbate.com/embed/';
    const LIST_IFRAME_PARAMS = '?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black&aspect=0.5625';

    const MAIN_IFRAME_BASE_URL = 'https://chaturbate.com/embed/';
    const MAIN_IFRAME_PARAMS = '?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black';

    const AUTOCOMPLETE_MIN_LENGTH = 2;
    const AUTOCOMPLETE_DELAY = 300;
    const AUTOCOMPLETE_MAX_SUGGESTIONS = 10;

    let mobilenetModel = null;
    const IMAGE_RECOGNITION_CONFIDENCE_THRESHOLD = 0.2;
    const IMAGE_RECOGNITION_MAX_RESULTS = 3;
    let analysisQueue = [];
    let isAnalyzing = false;
    const ANALYSIS_DELAY = 50;

    const LOG_MAX_ENTRIES = 1000;

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

    let filterSectionHeader = null;
    let displaySectionHeader = null;
    let viewerSectionHeader = null;
    let messagingSectionHeader = null;
    let reportingSectionHeader = null;

    let storageType = 'indexedDB';
    const historyStorageKey = 'previousUsers';
    const maxHistorySize = 200;

    let previousUsers = [];
    let allOnlineUsersData = [];
    let lastFilteredUsers = [];
    let fetchInterval = null;
    let fetchFailed = false;

    let isAutoScrolling = false;
    let autoScrollAnimationFrameId = null;
    let autoScrollTimeoutId = null;

    let displayMode = 'image';

    let iframeCount = 2;

    let currentUserSearchTerm = '';
    let currentMessageSearchTerm = '';

    let savedMessages = [];

    let capturedLogs = [];
    const originalConsole = {};
    let seen = new Set();


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
                    return JSON.stringify(arg, (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            if (seen.has(value)) return '[Circular]';
                            seen.add(value);
                        }
                        return value;
                    }, 2);
                } catch (e) {
                    return String(arg);
                } finally {
                     seen = new Set();
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
                 originalConsole[level].apply(console, args);

                 const message = formatLogArguments(args);
                 const timestamp = new Date();
                 const logEntry = {
                     timestamp: timestamp.toISOString(),
                     timeFormatted: formatLogTime(timestamp),
                     level: level,
                     message: message
                 };

                 capturedLogs.push(logEntry);
                 if (capturedLogs.length > LOG_MAX_ENTRIES) {
                     capturedLogs.shift();
                 }

                 if (logDisplayArea && !logDisplayArea.classList.contains('w3-hide') && logEntriesDiv) {
                      appendLogToDisplay(logEntry);
                 }
             };
         });
     }

     function displayLogs() {
          if (!logEntriesDiv) {
              originalConsole.warn("Log entries display div (#logEntries) not found. Cannot display logs.");
              return;
          }
          logEntriesDiv.innerHTML = '';

          const fragment = document.createDocumentFragment();
          capturedLogs.forEach(logEntry => {
              const logElement = createLogElement(logEntry);
              fragment.appendChild(logElement);
          });
          logEntriesDiv.appendChild(fragment);

          logEntriesDiv.scrollTop = logEntriesDiv.scrollHeight;
     }

     function appendLogToDisplay(logEntry) {
         if (!logEntriesDiv) return;

         while (logEntriesDiv.childElementCount >= LOG_MAX_ENTRIES) {
              logEntriesDiv.firstChild?.remove();
         }

         const logElement = createLogElement(logEntry);
         logEntriesDiv.appendChild(logElement);

         const isNearBottom = logEntriesDiv.scrollHeight - logEntriesDiv.clientHeight <= logEntriesDiv.scrollTop + 20;
         if (isNearBottom) {
             logEntriesDiv.scrollTop = logEntriesDiv.scrollHeight;
         }
     }

     function createLogElement(logEntry) {
         const logElement = document.createElement('div');
         logElement.className = `log-entry log-${logEntry.level}`;
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
          capturedLogs = [];
          if (logEntriesDiv) {
              logEntriesDiv.innerHTML = '';
          }
          console.log("Logs cleared.");
     }


    function dateDifferenceInDays(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        const diffMs = Math.abs(date1.getTime() - date2.getTime());
        return Math.round(diffMs / oneDay);
    }

    function isBirthday(birthday) {
        if (!birthday || typeof birthday !== 'string') return false;
        try {
            const today = new Date();
            const parts = birthday.split('-');
            if (parts.length !== 3) return false;
            const birthDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
            if (isNaN(birthDate.getTime())) {
                 console.warn("Invalid date encountered in isBirthday:", birthday);
                 return false;
            }
            return today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() === birthDate.getUTCDate();
        } catch (e) {
             console.error("Error checking birthday for:", birthday, e);
             return false;
        }
    }

    function getDaysSince18thBirthday(birthdayString, apiAge) {
        if (!birthdayString || typeof birthdayString !== 'string' || apiAge !== 18) {
            return null;
        }

        try {
            const today = new Date();
            const parts = birthdayString.split('-');
             if (parts.length !== 3) return null;

            const birthYear = parseInt(parts[0], 10);
            const birthMonth = parseInt(parts[1], 10) - 1;
            const birthDay = parseInt(parts[2], 10);

            const eighteenthBirthday = new Date(birthYear + 18, birthMonth, birthDay);

            if (eighteenthBirthday > today) {
                 console.warn(`User (Birth: ${birthdayString}, API Age: ${apiAge}) 18th birthday (${eighteenthBirthday.toISOString().split('T')[0]}) is in the future.`);
                return null;
            }

             const nineteenthBirthday = new Date(birthYear + 19, birthMonth, birthDay);

            if (nineteenthBirthday <= today) {
                 console.warn(`User (Birth: ${birthdayString}, API Age: ${apiAge}) 19th birthday (${nineteenthBirthday.toISOString().split('T')[0]}) has passed.`);
                return null;
            }

             const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
             const eighteenthBirthdayUtc = Date.UTC(eighteenthBirthday.getUTCFullYear(), eighteenthBirthday.getUTCMonth(), eighteenthBirthday.getUTCDate());
             const diffMs = todayUtc - eighteenthBirthdayUtc;
             const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            return days >= 0 ? days : null;

        } catch (e) {
             console.error("Error calculating days since 18th birthday for:", birthdayString, e);
             return null;
        }
    }


    function openIndexedDB() {
        return new Promise((resolve, reject) => {
             if (!('indexedDB' in window)) {
                 console.warn("IndexedDB not supported by this browser.");
                 reject(new Error("IndexedDB not supported."));
                 return;
             }
            const request = indexedDB.open('UserDatabase', 2);

            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                 console.log("IndexedDB upgrade needed or creating database. Old version:", event.oldVersion, "New version:", event.newVersion);

                 if (!db.objectStoreNames.contains('users')) {
                      db.createObjectStore('users', { keyPath: 'key' });
                     console.log("Created object store: 'users'");
                 }

                 if (!db.objectStoreNames.contains('messages')) {
                      const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
                     messageStore.createIndex('text', 'text', { unique: false });
                     console.log("Created object store: 'messages' with 'text' index.");
                 } else {
                     console.log("Object store 'messages' already exists.");
                 }
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
                 const idbKey = storageType.startsWith('indexedDB:') ? storageType.substring('indexedDB:'.length) : key;
                  return await loadFromIndexedDB(idbKey);
             }
         } catch (e) {
             console.error(`Error loading from ${storageType} with key '${key}':`, e);
         }
         return [];
     }

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
                  const idbKey = storageType.startsWith('indexedDB:') ? storageType.substring('indexedDB:'.length) : key;
                 await saveToIndexedDB(idbKey, users);
             }
             console.log("Save successful.");
             return Promise.resolve();
         } catch (e) {
             console.error(`Error saving to ${storageType} with key '${key}':`, e);
             if (e instanceof DOMException && (e.code === 22 || e.code === 1014 || e.name === 'QuotaExceededError')) {
                  console.error("Storage quota exceeded.");
                  showOnlineErrorDisplay("Storage quota exceeded. Cannot save history.");
                  return Promise.reject(new Error("Storage quota exceeded."));
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
                  const keys = event.target.result || [];
                   resolve(keys);
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
            throw error;
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction('messages', 'readwrite');
            const store = transaction.objectStore('messages');

             const messageToSave = {
                 text: message.text.trim(),
                 timestamp: new Date().toISOString(),
             };

            const request = store.add(messageToSave);

            request.onsuccess = function(event) {
                resolve(event.target.result);
            };

            request.onerror = function(event) {
                console.error("IndexedDB Message Save Error:", event.target.error);
                reject(event.target.error);
            };

             transaction.oncomplete = () => { db.close(); };
             transaction.onabort = (event) => { console.error("IDB message save transaction aborted.", event.target.error); db.close(); reject(event.target.error); };
             transaction.onerror = (event) => { console.error("IDB message save transaction error.", event.target.error); db.close(); reject(event.target.error); };
        });
    }

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

            const request = store.getAll();

            request.onsuccess = function(event) {
                resolve(event.target.result || []);
            };

            request.onerror = function(event) {
                console.error("IndexedDB Load All Messages Error:", event.target.error);
                resolve([]);
            };

             transaction.oncomplete = () => { db.close(); };
             transaction.onerror = (event) => { console.error("IDB load all messages transaction error:", event.target.error); db.close(); };
              transaction.onabort = (event) => { console.error("IDB load all messages transaction aborted:", event.target.error); db.close(); };
        });
    }


    async function fetchData() {
        console.log("Executing fetchData: Starting online user data fetch...");
        stopAutoScroll();
        showOnlineLoadingIndicator("Loading online users...");
        clearOnlineErrorDisplay();
         fetchFailed = false;

        let fetchedUsers = [];
        let offset = 0;
        let continueFetching = true;
        let totalFetchedCount = 0;

        while (continueFetching && totalFetchedCount < maxApiFetchLimit) {
            const apiUrl = `${apiUrlBase}?limit=${apiLimit}&offset=${offset}`;
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
                      showOnlineErrorDisplay(`API response format error from offset ${offset}. Check console.`);
                     continueFetching = false;
                 }

            } catch (error) {
                console.error(`fetchData: Error during fetch for offset ${offset}:`, error);
                 fetchFailed = true;
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

        allOnlineUsersData = fetchedUsers;
        lastFilteredUsers = [];

        if (allOnlineUsersData.length > 0) {
             console.log("fetchData: Populating filters, displaying users, and previous users.");
             populateFilters(allOnlineUsersData);
             if (userSearchInput && typeof $.fn.autocomplete === 'function') {
                  $(userSearchInput).autocomplete('option', 'source', getAllUsernames());
             }
             applyFiltersAndDisplay();
             await displayPreviousUsers();
        } else {
             console.log("fetchData: No online users data fetched in this cycle.");
              if (onlineUsersDiv) {
                  if (fetchFailed) {
                      onlineUsersDiv.innerHTML = '<p class="text-muted w3-center w3-text-red">Failed to load online users. Check connection/API and browser console/logs.</p>';
                  } else {
                      onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found.</p>';
                  }
              }

              populateFilters([]);
              if (userSearchInput && typeof $.fn.autocomplete === 'function') {
                  $(userSearchInput).autocomplete('option', 'source', []);
             }
              lastFilteredUsers = [];
              displayOnlineUsersList(lastFilteredUsers);
              await displayPreviousUsers();
        }

        hideOnlineLoadingIndicator();
        console.log("fetchData execution finished.");
    }

     function getAllUsernames() {
         if (!allOnlineUsersData || allOnlineUsersData.length === 0) {
             return [];
         }
         return allOnlineUsersData.map(user => user.username);
     }


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

        if (fetchFailed || allOnlineUsersData.length === 0) {
            console.warn("Applying filters skipped: No online user data available (fetch failed or list is empty).");
            lastFilteredUsers = [];
            displayOnlineUsersList(lastFilteredUsers);
            return;
        }


        let filterTags = [];
        if (buttonFilters.tag) {
            filterTags = [buttonFilters.tag.toLowerCase()];
             console.log(`Quick filter applied: Tag = ${buttonFilters.tag}`);
        } else if (filterTagsSelect) {
            filterTags = Array.from(filterTagsSelect.selectedOptions)
                .map(option => option.value.toLowerCase())
                .filter(tag => tag !== '');
        }

        let filterAges = [];
        if (buttonFilters.age) {
            filterAges = [parseInt(buttonFilters.age)];
             console.log(`Quick filter applied: Age = ${buttonFilters.age}`);
        } else if (filterAgeSelect) {
            filterAges = Array.from(filterAgeSelect.selectedOptions)
                .map(option => parseInt(option.value))
                .filter(age => !isNaN(age) && age > 0);
        }

         if (Object.keys(buttonFilters).length === 0) {
              currentUserSearchTerm = userSearchInput ? userSearchInput.value.trim().toLowerCase() : '';
         } else {
             currentUserSearchTerm = '';
         }

        console.log("Active filters:", { filterTags, filterAges, userSearchTerm: currentUserSearchTerm });

        const filteredUsers = allOnlineUsersData.filter(user => {
            if (!user || !user.username || user.current_show !== 'public') {
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

             let isUserSearchMatch = true;
             if (currentUserSearchTerm !== '') {
                  isUserSearchMatch = user.username.toLowerCase().includes(currentUserSearchTerm);
             }

            return hasTags && isAgeMatch && isUserSearchMatch;
        });

        console.log(`Filtered ${allOnlineUsersData.length} users down to ${filteredUsers.length}.`);
        lastFilteredUsers = filteredUsers;
        displayOnlineUsersList(filteredUsers);
    }


    function displayOnlineUsersList(usersToDisplay) {
         if (!onlineUsersDiv) {
             console.warn("Online users display div (#onlineUsers .user-list) not found. Cannot display users.");
             return;
         }
        console.log(`displayOnlineUsersList: Displaying ${usersToDisplay.length} filtered online users in ${displayMode} mode.`);

        stopAutoScroll();

        onlineUsersDiv.innerHTML = "";

        if (usersToDisplay.length === 0) {
            if (fetchFailed) {
                 onlineUsersDiv.innerHTML = '<p class="text-muted w3-center w3-text-red">Failed to load online users.</p>';
            } else {
                 onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users match the current filters.</p>';
            }

            if (toggleAutoScrollButton) {
                toggleAutoScrollButton.disabled = true;
                toggleAutoScrollButton.textContent = 'Not Scrollable';
                 toggleAutoScrollButton.classList.remove('w3-red');
                 toggleAutoScrollButton.classList.add('w3-green');
            }
             analysisQueue = [];
             isAnalyzing = false;
             showRecognitionStatus('');
            return;
        }

        onlineUsersDiv.classList.toggle('image-mode', displayMode === 'image');
        onlineUsersDiv.classList.toggle('iframe-mode', displayMode === 'iframe');


        const fragment = document.createDocumentFragment();

         if (displayMode === 'image' && mobilenetModel) {
             analysisQueue = [];
             isAnalyzing = false;
              showRecognitionStatus('Queuing images for analysis...');
         } else {
               analysisQueue = [];
               isAnalyzing = false;
               showRecognitionStatus('');
         }


        usersToDisplay.forEach(user => {
            if (!user || !user.image_url || !user.username) {
                console.warn("Skipping online user display due to incomplete data:", user);
                return;
            }
             const userInState = allOnlineUsersData.find(u => u.username === user.username);
             if (userInState && displayMode === 'image' && !userInState.recognition_results) {
                 analysisQueue.push({
                     username: user.username,
                     imageUrl: user.image_url,
                 });
                   user.recognition_results = null;
             } else if (userInState && displayMode === 'iframe') {
                  userInState.recognition_results = userInState.recognition_results || null;
             }

            const userElement = createUserElement(user, 'online', displayMode);
            fragment.appendChild(userElement);
        });
        onlineUsersDiv.appendChild(fragment);

         if (analysisQueue.length > 0 && mobilenetModel && displayMode === 'image') {
              console.log(`Queued ${analysisQueue.length} images for recognition.`);
              processAnalysisQueue();
         } else if (displayMode === 'image' && mobilenetModel && usersToDisplay.length > 0) {
               showRecognitionStatus("Recognition results shown below users.", 'info');
               setTimeout(() => showRecognitionStatus(''), 3000);
         } else if (!mobilenetModel && displayMode === 'image' && usersToDisplay.length > 0) {
               console.warn("MobileNet model not loaded. Cannot perform image recognition.");
               showRecognitionStatus("Image recognition not available (model loading failed?).", 'warning');
         } else {
              showRecognitionStatus('');
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


    async function displayPreviousUsers() {
         if (!previousUsersDiv) {
             console.warn("Previous users display div (#previousUsers .user-list) not found.");
             return;
         }
         console.log(`displayPreviousUsers: Refreshing display. History has ${previousUsers.length} users loaded in state.`);
         previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Updating history display...</p>';

         if (previousUsers.length === 0) {
             previousUsers = await loadUsers(historyStorageKey);
              console.log(`displayPreviousUsers: Loaded ${previousUsers.length} users from storage.`);
         }

         if (previousUsers.length === 0) {
            previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No viewing history saved.</p>';
            console.log("displayPreviousUsers: No previous users found in state or storage.");
            return;
         }


         if (allOnlineUsersData.length === 0) {
             console.warn("displayPreviousUsers: Online user data not available. Displaying saved history without online status check.");
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">History loaded. Online status check pending fetch.</p>';
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
         previousUsersDiv.classList.add('image-mode');

         const fragment = document.createDocumentFragment();
         currentlyOnlineAndPublicPreviousUsers.forEach(user => {
             if (!user || !user.image_url || !user.username) {
                console.warn("Skipping previous user display due to incomplete data:", user);
                return;
            }
              const onlineUserData = onlineUserMap.get(user.username);
              const userForDisplay = onlineUserData || user;

             const userElement = createUserElement(userForDisplay, 'previous', 'image');
             fragment.appendChild(userElement);
         });
         previousUsersDiv.appendChild(fragment);
          console.log("displayPreviousUsers: Previous users display complete.");
    }


    function createUserElement(user, listType, mode) {
        const userElement = document.createElement("div");
        userElement.className = `user-info w3-card w3-margin-bottom ${listType}-list-item ${mode}-display-mode`;
        userElement.dataset.username = user.username;
        userElement.dataset.recognized = user.recognition_results ? 'true' : (mode === 'image' && !user.recognition_results ? 'pending' : 'N/A');

        const tagsDisplay = (user.tags && Array.isArray(user.tags) && user.tags.length > 0)
                            ? user.tags.join(', ')
                            : 'N/A';
        const ageDisplay = (user.age && typeof user.age === 'number' && user.age > 0) ? user.age : 'N/A';

        let ageDetails = `Age: ${ageDisplay}`;
        if (user.age === 18 && user.birthday) {
            const daysSinceBday = getDaysSince18thBirthday(user.birthday, user.age);
            if (daysSinceBday !== null) {
                ageDetails = `Age: 18 <span class="age-days">(${daysSinceBday} days)</span>`;
            } else {
                 ageDetails = `Age: 18`;
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
        } else {
            mediaContent = `
                <div class="user-image-container">
                    <img src="${user.image_url}" alt="${user.username} thumbnail" loading="lazy" class="w3-image">
                </div>
            `;
        }

        let recognitionHtml = '';
        if (mode === 'image') {
             if (user.recognition_results) {
                  recognitionHtml = buildRecognitionResultsHtml(user.recognition_results);
             } else if (user.recognition_results === null) {
                  recognitionHtml = `<div class="recognition-results loading-indicator w3-text-grey w3-small">Analyzing...</div>`;
             } else {
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

        userElement.addEventListener("click", function(event) {
             if (event.target.closest('.remove-user-btn') || event.target.closest('.click-overlay')) {
                 return;
             }
             event.preventDefault();
             handleUserClick(user);
        });

        const removeBtn = userElement.querySelector('.remove-user-btn');
        if (removeBtn) {
            removeBtn.addEventListener("click", async function(event) {
                event.stopPropagation();
                console.log(`User clicked remove for: ${user.username}`);
                 showOnlineLoadingIndicator(`Removing ${user.username} from history...`);
                await removeFromPreviousUsers(user.username);
                await displayPreviousUsers();
                hideOnlineLoadingIndicator();
            });
        }

         const overlay = userElement.querySelector('.click-overlay');
         if (overlay) {
             overlay.addEventListener('click', function(event) {
                 event.stopPropagation();
                  console.log(`Overlay clicked for: ${user.username}. Triggering handleUserClick.`);
                  handleUserClick(user);
             });
         }

        return userElement;
    }

    function buildRecognitionResultsHtml(results) {
        if (!results || results.length === 0) {
            return '';
        }
        let html = '<div class="recognition-results"><strong>Recognized:</strong><ul>';
        results.forEach(result => {
            const confidence = (result.probability * 100).toFixed(1);
            html += `<li>${result.className} (${confidence}%)</li>`;
        });
        html += '</ul></div>';
        return html;
    }


    function handleUserClick(user) {
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

        const iframeChoiceRadio = document.querySelector('input[name="iframeChoice"]:checked');
        const selectedIframeId = iframeChoiceRadio ? iframeChoiceRadio.value : 'mainIframe1';

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


    async function addToPreviousUsers(user) {
         const existingIndex = previousUsers.findIndex(u => u.username === user.username);

         const userEntry = {
             username: user.username,
             image_url: user.image_url,
             timestamp: Date.now(),
             age: user.age,
             tags: user.tags,
             is_new: user.is_new,
             birthday: user.birthday,
         };

         if (existingIndex !== -1) {
             const existingUser = previousUsers.splice(existingIndex, 1)[0];
             userEntry.timestamp = Date.now();
         }

         previousUsers.unshift(userEntry);

         if (previousUsers.length > maxHistorySize) {
             previousUsers = previousUsers.slice(0, maxHistorySize);
             console.log(`History size limited to ${maxHistorySize}.`);
         }

         console.log(`Added/Moved ${user.username} to history. History size: ${previousUsers.length}`);

         await saveUsers(previousUsers, historyStorageKey);

         await displayPreviousUsers();
    }

     async function removeFromPreviousUsers(username) {
          const initialLength = previousUsers.length;
          previousUsers = previousUsers.filter(user => user.username !== username);

          if (previousUsers.length < initialLength) {
               console.log(`Removed ${username} from history.`);
               await saveUsers(previousUsers, historyStorageKey);
          } else {
               console.warn(`Attempted to remove ${username} from history, but user not found.`);
          }
     }

     async function clearPreviousUsers() {
         console.log("Attempting to clear history...");
         const confirmClear = confirm("Are you sure you want to clear your viewing history?");
         if (!confirmClear) {
             console.log("History clear cancelled.");
             return;
         }

         previousUsers = [];
         console.log("History cleared from state.");

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
                      const request = store.delete(idbKey);

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
                      throw error;
                  }
             }
             console.log(`History cleared from ${storageType}.`);
             showReportStatus("Viewing history cleared.", 'success');

         } catch (e) {
             console.error(`Error clearing history from ${storageType}:`, e);
              showReportStatus(`Failed to clear history: ${e.message}`, 'error');
         } finally {
              await displayPreviousUsers();
         }
     }


      async function populateStorageOptions() {
         if (!storageTypeSelector) {
              console.warn("Storage type selector not found. Cannot populate options.");
              return;
         }
          console.log("Populating storage options...");
          const currentSelectedValue = storageTypeSelector.value;

         storageTypeSelector.innerHTML = `
             <option value="local">Local Storage</option>
             <option value="session">Session Storage</option>
             <option value="indexedDB">IndexedDB (Default History)</option>
         `;

         try {
             const idbKeys = await getIndexedDBKeys();
              console.log("Found IndexedDB keys:", idbKeys);
             idbKeys.forEach(key => {
                  const option = document.createElement('option');
                  option.value = `indexedDB:${key}`;
                  option.textContent = `IndexedDB: ${key}`;
                   if (currentSelectedValue === option.value) {
                       option.selected = true;
                   }
                  storageTypeSelector.appendChild(option);

             });
         } catch (e) {
             console.error("Error getting IndexedDB keys:", e);
         }

          if (currentSelectedValue && storageTypeSelector.querySelector(`option[value="${currentSelectedValue}"]`)) {
               storageTypeSelector.value = currentSelectedValue;
          } else {
               storageTypeSelector.value = 'indexedDB';
          }
          storageType = storageTypeSelector.value;
          console.log(`Storage options populated. Current type: ${storageType}`);

     }


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
              messageInput.value = '';
              await loadAndDisplayMessages();
              showStatusMessage(messageStatusDisplay, "Message saved!", 'success');
               setTimeout(() => showStatusMessage(messageStatusDisplay, '', 'info', false), 3000);
         } catch (error) {
              console.error("Failed to save message:", error);
              showStatusMessage(messageStatusDisplay, `Error saving message: ${error.message}`, 'error');
         } finally {
             saveMessageButton.disabled = false;
             messageInput.disabled = false;
         }
    }

    async function loadAndDisplayMessages() {
         if (!messageListDiv || !messageSearchInput) {
              console.warn("Message list div or search input not found. Cannot load/display messages.");
              return;
         }
         console.log("Loading and displaying messages...");
         messageListDiv.innerHTML = '<p class="text-muted w3-center">Loading messages...</p>';

         try {
              savedMessages = await loadMessagesFromIndexedDB();
              console.log(`Loaded ${savedMessages.length} messages from DB.`);

              if (typeof $.fn.autocomplete === 'function' && messageSearchInput) {
                   $(messageSearchInput).autocomplete('option', 'source', getAllMessageTexts());
              } else {
                  console.warn("jQuery UI Autocomplete not available or message search input not found for message search.");
                   if(messageSearchInput) messageSearchInput.disabled = true;
              }

              currentMessageSearchTerm = messageSearchInput ? messageSearchInput.value.trim().toLowerCase() : '';

              const filteredMessages = savedMessages.filter(msg =>
                  currentMessageSearchTerm === '' || msg.text.toLowerCase().includes(currentMessageSearchTerm)
              );

              displayMessagesList(filteredMessages);

         } catch (error) {
             console.error("Error loading messages:", error);
             messageListDiv.innerHTML = '<p class="text-muted w3-center w3-text-red">Error loading messages.</p>';
         }
    }

     function getAllMessageTexts() {
         if (!savedMessages || savedMessages.length === 0) {
             return [];
         }
         return savedMessages.map(msg => msg.text);
     }


    function displayMessagesList(messagesToDisplay) {
         if (!messageListDiv) return;

         messageListDiv.innerHTML = "";

         if (messagesToDisplay.length === 0) {
              messageListDiv.innerHTML = '<p class="text-muted w3-center">No saved messages found.</p>';
              return;
         }

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

    function createMessageElement(message) {
        const messageElement = document.createElement("div");
        messageElement.className = "message-item";
        messageElement.textContent = message.text;
        messageElement.dataset.messageId = message.id;

        messageElement.addEventListener("click", function() {
            copyToClipboard(message.text);
        });

        return messageElement;
    }

    function copyToClipboard(text) {
         if (!messageStatusDisplay) {
              console.warn("Message status display not found. Cannot provide copy feedback.");
         }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                console.log("Text copied to clipboard:", text);
                 if(messageStatusDisplay) showStatusMessage(messageStatusDisplay, "Copied to clipboard!", 'success');
                 if(messageStatusDisplay) setTimeout(() => showStatusMessage(messageStatusDisplay, '', 'info', false), 2000);
            }).catch(err => {
                console.error("Failed to copy text:", err);
                 if(messageStatusDisplay) showStatusMessage(messageStatusDisplay, `Failed to copy: ${err.message}`, 'error');
            });
        } else {
             console.warn("Clipboard API not available.");
             if(messageStatusDisplay) showStatusMessage(messageStatusDisplay, "Copy failed: Clipboard not supported.", 'error');
        }
    }

    function showStatusMessage(element, message, type = 'info', show = true) {
         if (!element) return;
         element.textContent = message;
         element.classList.remove('success', 'error', 'warning', 'info', 'loading');
         element.classList.add('status-message', type);

         if (show) {
             element.style.display = (type === 'loading') ? 'inline-block' : 'block';
         } else {
             element.style.display = 'none';
         }
    }


    async function sendReport() {
        console.log("Attempting to send report...");

        if (!lastFilteredUsers || lastFilteredUsers.length === 0) {
            const warnMsg = "No users currently displayed in the 'Online Users' list to report.";
            console.warn(warnMsg);
            showReportStatus(warnMsg, 'warning');
            return;
        }
         if (!reportLoadingIndicator || !reportStatusDisplay || !sendReportButton) {
              console.warn("Reporting status/button elements missing. Cannot send report.");
              alert("Reporting feature elements missing. Check console.");
              return;
         }

        sendReportButton.disabled = true;

        const reportData = lastFilteredUsers.map(user => ({
            username: user.username,
            age: user.age,
            tags: user.tags,
            is_new: user.is_new,
            num_viewers: user.num_viewers,
            birthday: user.birthday,
             recognition_results: user.recognition_results ? user.recognition_results.map(r => `${r.className} (${(r.probability * 100).toFixed(1)}%)`).join(', ') : 'Not analyzed'
        }));

        showReportLoading(`Preparing report for ${reportData.length} users...`);
        clearReportStatus();

        try {
            if (REPORT_SEND_METHOD === 'placeholder-client-service') {
                console.log("Using placeholder client-side service method for report.");
                showReportStatus("Report sending via client service (placeholder). Requires service setup (e.g. EmailJS).", 'info');

                 throw new Error("Client-side report service not actually implemented/configured in JS.");


            } else if (REPORT_SEND_METHOD === 'mailto') {
                console.log("Using mailto link for report.");
                const subject = encodeURIComponent(`Room Viewer Online User Report (${reportData.length} users)`);
                const bodyText = reportData.map(user =>
                    `Username: ${user.username}\nAge: ${user.age}\nTags: ${user.tags ? user.tags.join(', ') : 'N/A'}\nViewers: ${user.num_viewers || 'N/A'}\nBirthday: ${user.birthday || 'N/A'}\nRecognition: ${user.recognition_results || 'N/A'}\n---\n`
                ).join('\n');
                const body = encodeURIComponent("Online Users Report:\n\n" + bodyText);

                const mailtoLink = `mailto:your.email@example.com?subject=${subject}&body=${body}`;

                 if (mailtoLink.length > 2000) {
                      const errorMsg = `Report data (${mailtoLink.length} chars) too large for mailto link. Reduce filters or use a different report method.`;
                      console.warn(errorMsg);
                      showReportStatus(errorMsg, 'warning');
                      throw new Error(errorMsg);
                 }

                window.location.href = mailtoLink;
                showReportStatus("Attempted to open email client with report data.", 'info');

            } else {
                console.error(`Unknown REPORT_SEND_METHOD configured: ${REPORT_SEND_METHOD}`);
                showReportStatus(`Report feature misconfigured: Unknown method '${REPORT_SEND_METHOD}'.`, 'error');
                 throw new Error(`Unknown report method: ${REPORT_SEND_METHOD}`);
            }

        } catch (error) {
            console.error("Error caught during report sending:", error);
            showReportStatus(`Failed to send report: ${error.message}`, 'error');
        } finally {
            hideReportLoading();
            sendReportButton.disabled = false;
        }
    }


    function showOnlineLoadingIndicator(message = 'Loading...') {
        if (onlineLoadingIndicator) {
            onlineLoadingIndicator.textContent = message;
            onlineLoadingIndicator.style.display = 'block';
        }
        if (onlineUsersDiv && onlineUsersDiv.querySelector('.text-muted.w3-center')?.textContent?.includes('Loading')) {
             onlineUsersDiv.innerHTML = `<p class="text-muted w3-center">${message}</p>`;
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
         if (onlineUsersDiv && onlineUsersDiv.querySelector('.text-muted.w3-center')?.textContent?.includes('Loading')) {
              onlineUsersDiv.innerHTML = `<p class="text-muted w3-center w3-text-red">${message}</p>`;
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
              if (type === 'success' || type === 'info') {
                   setTimeout(() => clearReportStatus(), 5000);
              }
        }
    }
    function clearReportStatus() {
         if (reportStatusDisplay) {
             showStatusMessage(reportStatusDisplay, '', 'info', false);
         }
    }

    function showRecognitionStatus(message, type = 'info') {
         if (!recognitionStatusDisplay) return;
         recognitionStatusDisplay.textContent = message;

         recognitionStatusDisplay.classList.remove('w3-text-grey', 'w3-text-amber', 'w3-text-red');
         recognitionStatusDisplay.classList.remove('loading-indicator');

         if (message) {
              recognitionStatusDisplay.style.display = 'inline-block';

              if (type === 'loading') {
                   recognitionStatusDisplay.classList.add('loading-indicator');
                   recognitionStatusDisplay.classList.add('w3-text-grey');
              } else if (type === 'warning') {
                   recognitionStatusDisplay.classList.add('w3-text-amber');
              } else if (type === 'error') {
                   recognitionStatusDisplay.classList.add('w3-text-red');
              } else {
                   recognitionStatusDisplay.classList.add('w3-text-grey');
              }

         } else {
             recognitionStatusDisplay.style.display = 'none';
         }
    }


     let scrollDirection = 1;
     let isAtEnd = false;

     function scrollStep() {
         if (!onlineUsersDiv || !isAutoScrolling) {
             isAutoScrolling = false;
             return;
         }

         const maxScroll = onlineUsersDiv.scrollHeight - onlineUsersDiv.clientHeight;

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

         onlineUsersDiv.scrollTop += scrollDirection * AUTO_SCROLL_SPEED;

         if (scrollDirection === 1 && onlineUsersDiv.scrollTop >= maxScroll) {
             onlineUsersDiv.scrollTop = maxScroll;
             isAtEnd = true;
             if (AUTO_SCROLL_DELAY_AT_END > 0) {
                 stopAutoScroll();
                 autoScrollTimeoutId = setTimeout(() => {
                     scrollDirection = -1;
                      isAtEnd = false;
                      startAutoScroll();
                 }, AUTO_SCROLL_DELAY_AT_END);
                 return;
             } else {
                  scrollDirection = -1;
                  isAtEnd = false;
             }
         } else if (scrollDirection === -1 && onlineUsersDiv.scrollTop <= 0) {
              onlineUsersDiv.scrollTop = 0;
              isAtEnd = true;
              if (AUTO_SCROLL_DELAY_AT_END > 0) {
                 stopAutoScroll();
                 autoScrollTimeoutId = setTimeout(() => {
                     scrollDirection = 1;
                      isAtEnd = false;
                      startAutoScroll();
                 }, AUTO_SCROLL_DELAY_AT_END);
                  return;
             } else {
                  scrollDirection = 1;
                  isAtEnd = false;
             }
         }

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
             scrollDirection = 1;
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
         if (isAutoScrolling) {
             stopAutoScroll();
             console.log("Manual scroll detected, auto-scroll stopped.");
         }
     }


     function updateIframeLayout() {
         if (!mainViewerContainer || iframeWrappers.length === 0 || mainIframes.length === 0) {
              console.error("Cannot update iframe layout: Main viewer elements not found.");
              return;
         }
         console.log(`Updating iframe layout to show ${iframeCount} viewports.`);

         mainViewerContainer.classList.remove('iframe-count-2', 'iframe-count-4');
         mainViewerContainer.classList.add(`iframe-count-${iframeCount}`);

         for (let i = 0; i < iframeWrappers.length; i++) {
             const wrapper = iframeWrappers[i];
             const iframe = mainIframes[i];
             const radio = document.querySelector(`input[name="iframeChoice"][value="mainIframe${i + 1}"]`);

             if (!wrapper || !iframe || !radio) {
                  console.warn(`Missing element for viewport ${i+1}. Skipping layout update for this one.`);
                  continue;
             }

             if (i < iframeCount) {
                 wrapper.style.display = '';
                 radio.disabled = false;
             } else {
                 wrapper.style.display = 'none';
                 radio.disabled = true;
                 if (radio.checked) {
                      const firstRadio = document.querySelector('input[name="iframeChoice"][value="mainIframe1"]');
                      if (firstRadio) firstRadio.checked = true;
                 }
                  if (iframe.src && !iframe.src.startsWith('https://cbxyz.com/in/?tour=') && iframe.src !== 'about:blank') {
                      iframe.src = 'https://cbxyz.com/in/?tour=dU9X&campaign=9cg6A&track=embed&signup_notice=1&disable_sound=1&mobileRedirect=never';
                      console.log(`Resetting iframe src for hidden viewport ${i + 1}`);
                  } else if (!iframe.src) {
                       iframe.src = 'https://cbxyz.com/in/?tour=dU9X&campaign=9cg6A&track=embed&signup_notice=1&disable_sound=1&mobileRedirect=never';
                  }
             }
         }

          if (toggleIframeCountButton) {
              toggleIframeCountButton.textContent = `Toggle ${iframeCount === 2 ? '4' : '2'} Viewports`;
          }
          console.log("Iframe layout updated.");
     }

     function toggleIframeCount() {
         console.log("Toggling iframe count.");
         if (!toggleIframeCountButton || toggleIframeCountButton.disabled) {
             console.warn("Toggle iframe count button is not available or disabled.");
             return;
         }
         iframeCount = (iframeCount === 2) ? 4 : 2;
         updateIframeLayout();
     }


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
                 userSearchInput.value = ui.item.value;
                  currentUserSearchTerm = ui.item.value.trim().toLowerCase();
                  applyFiltersAndDisplay();
                 console.log(`User autocomplete selected: ${ui.item.value}. Applying filters.`);
             },
              change: function(event, ui) {
                   const currentValue = userSearchInput.value.trim().toLowerCase();
                   if (currentValue !== currentUserSearchTerm) {
                       currentUserSearchTerm = currentValue;
                       applyFiltersAndDisplay();
                       console.log(`User search input changed. Re-applying filters with term: "${currentUserSearchTerm}".`);
                   }
              }
         });

           $(userSearchInput).on('input', function() {
               const currentValue = userSearchInput.value.trim().toLowerCase();
               if (currentValue !== currentUserSearchTerm) {
                    currentUserSearchTerm = currentValue;
               }
          });

         console.log("User autocomplete setup complete.");
     }

    function setupMessageAutocomplete() {
        if (!messageSearchInput || typeof $.fn.autocomplete !== 'function') {
             console.warn("Cannot setup message autocomplete: Search input not found or jQuery UI Autocomplete not loaded.");
             if (messageSearchInput) messageSearchInput.disabled = true;
             return;
        }
         console.log("Setting up message autocomplete...");

        $(messageSearchInput).autocomplete({
            minLength: 0,
            delay: AUTOCOMPLETE_DELAY,
            source: function(request, response) {
                const term = request.term.toLowerCase();
                const filteredSuggestions = savedMessages
                     .map(msg => msg.text)
                     .filter(text => text.toLowerCase().includes(term));

                 response(filteredSuggestions.slice(0, AUTOCOMPLETE_MAX_SUGGESTIONS));
            },
             select: function(event, ui) {
                 event.preventDefault();
                 messageSearchInput.value = ui.item.value;
                  currentMessageSearchTerm = ui.item.value.trim().toLowerCase();
                  displayMessagesList(savedMessages.filter(msg => msg.text.toLowerCase().includes(currentMessageSearchTerm)));
                 console.log(`Message autocomplete selected: "${ui.item.value}". Filtering list.`);
             },
              change: function(event, ui) {
                   const currentValue = messageSearchInput.value.trim().toLowerCase();
                   if (currentValue !== currentMessageSearchTerm) {
                       currentMessageSearchTerm = currentValue;
                       displayMessagesList(savedMessages.filter(msg => msg.text.toLowerCase().includes(currentMessageSearchTerm)));
                        console.log(`Message autocomplete changed/lost focus. Filtering list by: "${currentMessageSearchTerm}".`);
                   }
              }
        })
         .on('input', function() {
             const currentValue = messageSearchInput.value.trim().toLowerCase();
              if (currentValue !== currentMessageSearchTerm) {
                 currentMessageSearchTerm = currentValue;
                 const filteredMessages = savedMessages.filter(msg =>
                     currentMessageSearchTerm === '' || msg.text.toLowerCase().includes(currentMessageSearchTerm)
                 );
                 displayMessagesList(filteredMessages);
                  console.log(`Message input changed. Filtering list by: "${currentMessageSearchTerm}".`);
             }
         });

        console.log("Message autocomplete setup complete.");
    }


     async function loadMobileNetModel() {
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
              return;
         }

         console.log("Loading MobileNet model...");
          showRecognitionStatus("Loading recognition model...", 'loading');
         try {
             mobilenetModel = await mobilenet.load();
             console.log("MobileNet model loaded successfully.");
             showRecognitionStatus("Recognition model loaded.", 'success');
              setTimeout(() => showRecognitionStatus(''), 3000);

              if (displayMode === 'image' && lastFilteredUsers.length > 0) {
                  console.log("Model loaded after users displayed. Queuing displayed images for analysis.");
                  analysisQueue = lastFilteredUsers.filter(user => user.image_url && !user.recognition_results)
                                                   .map(user => ({ username: user.username, imageUrl: user.image_url }));

                   if(!isAnalyzing) {
                       processAnalysisQueue();
                   } else {
                       console.log("Analysis process is already running.");
                   }
              }


         } catch (error) {
             console.error("Failed to load MobileNet model:", error);
              showRecognitionStatus(`Recognition failed: Model load error - ${error.message}`, 'error');
              mobilenetModel = null;
         }
     }

     async function processAnalysisQueue() {
         if (isAnalyzing || analysisQueue.length === 0 || !mobilenetModel || displayMode !== 'image' || !onlineUsersDiv) {
             isAnalyzing = false;
             if (analysisQueue.length === 0 || displayMode !== 'image' || !mobilenetModel) showRecognitionStatus('');
             return;
         }

         isAnalyzing = true;
         console.log(`Starting analysis queue processing (${analysisQueue.length} items).`);
          showRecognitionStatus(`Analyzing ${analysisQueue.length} images...`, 'loading');

         while (analysisQueue.length > 0 && mobilenetModel && displayMode === 'image' && onlineUsersDiv) {
             const queueItem = analysisQueue.shift();
             const { username, imageUrl } = queueItem;

             const userStateIndex = allOnlineUsersData.findIndex(u => u.username === username);
             const user = userStateIndex !== -1 ? allOnlineUsersData[userStateIndex] : null;

             const userElement = onlineUsersDiv.querySelector(`.user-info[data-username="${username}"]`);

             if (user && userElement && displayMode === 'image' && user.image_url === imageUrl) {

                  try {
                      const imageElement = userElement.querySelector('img');

                      if (imageElement && imageElement.isConnected) {

                           if (!imageElement.complete || imageElement.naturalHeight === 0) {
                                console.log(`Waiting for image for ${username} to load before analysis.`);
                                await new Promise(resolve => {
                                     imageElement.onload = resolve;
                                     imageElement.onerror = resolve;
                                });
                                if (!imageElement.isConnected) {
                                     console.log(`Image for ${username} removed from DOM during load wait. Skipping analysis.`);
                                     continue;
                                }
                                 if (!imageElement.complete || imageElement.naturalHeight === 0) {
                                     console.warn(`Image for ${username} failed to load or is empty after waiting. Skipping analysis.`);
                                      const detailsDiv = userElement.querySelector('.user-details');
                                       if (detailsDiv) detailsDiv.insertAdjacentHTML('beforeend', `<div class="recognition-results w3-text-red w3-small">Image load failed.</div>`);
                                      if (userStateIndex !== -1) allOnlineUsersData[userStateIndex].recognition_results = [];
                                      userElement.dataset.recognized = 'error';
                                     continue;
                                 }
                           }

                           console.log(`Analyzing image for ${username}...`);
                           const predictions = await mobilenetModel.classify(imageElement);
                           console.log(`Analysis results for ${username}:`, predictions);

                           const filteredPredictions = predictions.filter(p => p.probability >= IMAGE_RECOGNITION_CONFIDENCE_THRESHOLD)
                                                                .slice(0, IMAGE_RECOGNITION_MAX_RESULTS);

                           if (userStateIndex !== -1) {
                               allOnlineUsersData[userStateIndex].recognition_results = filteredPredictions;
                           }

                           const detailsDiv = userElement.querySelector('.user-details');
                           const existingResultsDiv = detailsDiv?.querySelector('.recognition-results');

                           if (detailsDiv) {
                                const resultsHtml = buildRecognitionResultsHtml(filteredPredictions);
                                if (existingResultsDiv) {
                                     existingResultsDiv.outerHTML = resultsHtml || `<div class="recognition-results w3-text-grey w3-small">No results above threshold.</div>`;
                                } else if (resultsHtml) {
                                     detailsDiv.insertAdjacentHTML('beforeend', resultsHtml);
                                } else {
                                     detailsDiv.insertAdjacentHTML('beforeend', `<div class="recognition-results w3-text-grey w3-small">No results above threshold.</div>`);
                                }
                           }
                            userElement.dataset.recognized = filteredPredictions.length > 0 ? 'true' : 'none';

                           const remaining = analysisQueue.length;
                           if (remaining > 0) {
                                showRecognitionStatus(`Analyzing... (${remaining} remaining)`);
                           } else {
                                showRecognitionStatus("Analysis complete.", 'success');
                                setTimeout(() => showRecognitionStatus(''), 3000);
                           }

                      } else {
                           console.log(`Skipping analysis for ${username}: Image element not found or not in DOM.`);
                            const detailsDiv = userElement?.querySelector('.user-details');
                             if (detailsDiv) {
                                  const existingResultsDiv = detailsDiv.querySelector('.recognition-results');
                                   const errorHtml = `<div class="recognition-results w3-text-red w3-small">Image element missing/invalid.</div>`;
                                  if (existingResultsDiv) { existingResultsDiv.outerHTML = errorHtml; }
                                  else { detailsDiv.insertAdjacentHTML('beforeend', errorHtml); }
                             }
                            if (userStateIndex !== -1) allOnlineUsersData[userStateIndex].recognition_results = [];
                            if (userElement) userElement.dataset.recognized = 'error';
                      }

                  } catch (error) {
                      console.error(`Error analyzing image for ${username}:`, error);
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
                  console.log(`Skipping analysis for ${username} (user/element not found, mode changed, already analyzed, or img URL mismatch).`);
             }

             await new Promise(resolve => setTimeout(resolve, ANALYSIS_DELAY));
         }

         isAnalyzing = false;
         console.log("Analysis queue processing finished.");
          if (analysisQueue.length === 0 && displayMode === 'image' && mobilenetModel) {
               showRecognitionStatus("Image recognition complete.", 'success');
               setTimeout(() => showRecognitionStatus(''), 3000);
          } else if (displayMode !== 'image') {
               showRecognitionStatus(`Analysis paused (${analysisQueue.length} remaining). Switch to Image mode to resume.`, 'warning');
          } else if (!mobilenetModel) {
               showRecognitionStatus(`Analysis stopped (${analysisQueue.length} remaining): Model unavailable.`, 'error');
          } else if (analysisQueue.length > 0 && onlineUsersDiv) {
              console.warn("Analysis loop finished but queue is not empty?");
              showRecognitionStatus(`Analysis interrupted (${analysisQueue.length} remaining).`, 'warning');
          } else if (!onlineUsersDiv) {
              console.warn("Analysis loop finished but onlineUsersDiv is missing?");
              showRecognitionStatus('', false);
          }
     }


    function toggleSection(sectionId) {
        const section = document.getElementById(`${sectionId}Section`);
        const icon = document.getElementById(`${sectionId}ToggleIcon`);
        if (section && icon) {
            if (section.classList.contains('w3-hide')) {
                section.classList.remove('w3-hide');
                icon.textContent = '▲';
            } else {
                section.classList.add('w3-hide');
                icon.textContent = '▼';
            }
        } else {
             console.warn(`Toggle section element not found for ID: ${sectionId}Section or ${sectionId}ToggleIcon`);
        }
    }


    function collectAndValidateDOMReferences() {
         const missingCritical = [];
         const missingOptional = [];

         onlineUsersDiv = document.getElementById("onlineUsers")?.querySelector('.user-list');
         if (!onlineUsersDiv) missingCritical.push("#onlineUsers .user-list");

         previousUsersDiv = document.getElementById("previousUsers")?.querySelector('.user-list');
         if (!previousUsersDiv) missingCritical.push("#previousUsers .user-list");

         mainViewerContainer = document.getElementById("mainViewerContainer");
         if (!mainViewerContainer) missingCritical.push("#mainViewerContainer");

         mainIframeColumn = document.querySelector('.iframe-column');
         if (!mainIframeColumn) missingCritical.push(".iframe-column");

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

         logDisplayArea = document.getElementById("logDisplayArea");
         if (!logDisplayArea) missingCritical.push("#logDisplayArea");
         logEntriesDiv = document.getElementById("logEntries");
         if (!logEntriesDiv) missingCritical.push("#logEntries");

         showLogsButton = document.getElementById("showLogsButton");
         if (!showLogsButton) missingCritical.push("#showLogsButton");

         clearLogsButton = document.getElementById("clearLogsButton");
         if (!clearLogsButton) missingCritical.push("#clearLogsButton");


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
         displaySectionHeader = document.querySelector('h4[onclick="toggleSection(\'display\')']");
          if (!displaySectionHeader) missingOptional.push("Display section header. Toggling disabled.");
         viewerSectionHeader = document.querySelector('h4[onclick="toggleSection(\'viewer\')"]');
          if (!viewerSectionHeader) missingOptional.push("Viewer section header. Toggling disabled.");
         messagingSectionHeader = document.querySelector('h4[onclick="toggleSection(\'messaging\')"]');
          if (!messagingSectionHeader) missingOptional.push("Messaging section header. Toggling disabled.");
         reportingSectionHeader = document.querySelector('h4[onclick="toggleSection(\'reporting\')"]');
          if (!reportingSectionHeader) missingOptional.push("Reporting section header. Toggling disabled.");

         const quickFilterButtons = document.querySelectorAll('.quick-filters button');
          if (quickFilterButtons.length === 0) missingOptional.push("Quick filter buttons. Feature disabled.");


        if (missingCritical.length > 0) {
            const errorMsg = `CRITICAL ERROR: Missing essential DOM elements: ${missingCritical.join(', ')}. Application cannot start.`;
            originalConsole.error(errorMsg);
            if (onlineErrorDisplay) {
                 onlineErrorDisplay.textContent = `Initialization failed: Missing required elements (${missingCritical[0]}...). Check browser console or the Logs section.`;
                 onlineErrorDisplay.style.display = 'block';
            } else {
                alert(errorMsg);
            }

             [
                storageTypeSelector, filterTagsSelect, filterAgeSelect,
                toggleAutoScrollButton, toggleDisplayModeButton, toggleIframeCountButton,
                userSearchInput, messageSearchInput, messageInput, saveMessageButton,
                clearPreviousUsersButton, sendReportButton,
                showLogsButton, clearLogsButton
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
             if (recognitionStatusDisplay) recognitionStatusDisplay.style.display = 'none';
             if (messageStatusDisplay) messageStatusDisplay.style.display = 'none';
             if (onlineLoadingIndicator) onlineLoadingIndicator.style.display = 'none';
             if (reportLoadingIndicator) reportLoadingIndicator.style.display = 'none';

             if(logDisplayArea) {
                  logDisplayArea.classList.remove('w3-hide');
                  if(logEntriesDiv) logEntriesDiv.innerHTML = `<div class="log-entry log-error"><span class="log-timestamp">[${formatLogTime(new Date())}]</span> <span class="log-message">${escapeHTML(errorMsg)}</span></div>`;
             }

            return false;
        }

         if (missingOptional.length > 0) {
             console.warn("Missing optional DOM elements. Some features may be disabled:", missingOptional.join(', '));
         }

        return true;
    }


    function setupEventListeners() {
        console.log("Setting up event listeners...");

        storageTypeSelector?.addEventListener("change", async function() {
             const newStorageType = this.value;
             console.log(`Storage type changed to: ${newStorageType}`);
             if (newStorageType !== storageType) {
                storageType = newStorageType;
                showOnlineLoadingIndicator("Loading history from new source...");
                previousUsers = await loadUsers(historyStorageKey);
                await displayPreviousUsers();
                hideOnlineLoadingIndicator();
             }
        });

        filterTagsSelect?.addEventListener("change", () => applyFiltersAndDisplay());
        filterAgeSelect?.addEventListener("change", () => applyFiltersAndDisplay());

         document.getElementById("filterAge18")?.addEventListener("click", () => applyFiltersAndDisplay({ age: 18 }));
         document.getElementById("filterTagAsian")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'asian' }));
         document.getElementById("filterTagBlonde")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'blonde' }));

         clearPreviousUsersButton?.addEventListener("click", clearPreviousUsers);

         if (sendReportButton) {
             sendReportButton.addEventListener("click", sendReport);
         }

        if (toggleAutoScrollButton) {
             toggleAutoScrollButton.addEventListener("click", function() {
                 if (isAutoScrolling) {
                     stopAutoScroll();
                 } else {
                     startAutoScroll();
                 }
             });
         }

         if (toggleDisplayModeButton) {
             toggleDisplayModeButton.addEventListener("click", function() {
                  console.log("Display mode toggle clicked.");
                 displayMode = displayMode === 'image' ? 'iframe' : 'image';
                 console.log(`Display mode switched to: ${displayMode}`);
                 toggleDisplayModeButton.textContent = displayMode === 'image' ? 'Show Iframes' : 'Show Images';
                 displayOnlineUsersList(lastFilteredUsers);
                 if (onlineUsersDiv) onlineUsersDiv.scrollTop = 0;
             });
         }

         if (toggleIframeCountButton) {
              toggleIframeCountButton.addEventListener("click", toggleIframeCount);
         }

        if (saveMessageButton) {
             saveMessageButton.addEventListener("click", saveMessage);
        }
         if (messageInput) {
             messageInput.addEventListener("keypress", function(event) {
                  if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      saveMessage();
                  }
             });
         }

         if(showLogsButton && logDisplayArea) {
              showLogsButton.addEventListener("click", function() {
                  if (logDisplayArea.classList.contains('w3-hide')) {
                      logDisplayArea.classList.remove('w3-hide');
                      displayLogs();
                  } else {
                      logDisplayArea.classList.add('w3-hide');
                  }
              });
         }
         if(clearLogsButton) {
              clearLogsButton.addEventListener("click", clearLogs);
         }

        if (onlineUsersDiv) {
             onlineUsersDiv.addEventListener("scroll", handleManualScroll);
         }

         setupUserAutocomplete();
         setupMessageAutocomplete();

        console.log("Event listeners setup complete.");
    }


    async function initializeApp() {
        console.log("Initializing application...");

        captureConsole();
        console.log("Console capture initialized.");


        console.log("Validating DOM elements...");
        if (!collectAndValidateDOMReferences()) {
             console.error("Initialization aborted due to missing critical DOM elements.");
             return;
        }
        console.log("DOM validation complete.");

         window.toggleSection = toggleSection;
         console.log("toggleSection exposed globally.");

         console.log("Checking dependencies...");
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
          } else {
              console.log("TensorFlow.js and MobileNet detected. Starting model load...");
               loadMobileNetModel();
          }
        console.log("Dependency checks complete.");

         console.log("Setting initial control states...");
         displayMode = 'image';
         if (toggleDisplayModeButton) toggleDisplayModeButton.textContent = 'Show Iframes';
         iframeCount = 2;
         currentUserSearchTerm = userSearchInput ? userSearchInput.value.trim().toLowerCase() : '';
         currentMessageSearchTerm = messageSearchInput ? messageSearchInput.value.trim().toLowerCase() : '';
         console.log("Initial control states set.");

        console.log("Populating storage options...");
        await populateStorageOptions();
        console.log("Storage options populated.");

        console.log("Setting up event listeners...");
        setupEventListeners();
        console.log("Event listeners setup complete.");

        console.log("Loading initial history from storage...");
        showOnlineLoadingIndicator("Loading initial history...");
        previousUsers = await loadUsers(historyStorageKey);
        console.log(`Initial load: Found ${previousUsers.length} users in history state.`);

        console.log("Setting up initial iframe layout...");
        updateIframeLayout();
        console.log("Initial iframe layout set.");

        console.log("Loading and displaying messages...");
         await loadAndDisplayMessages();
         console.log("Messages loaded and displayed.");

        console.log("Performing initial data fetch...");
        await fetchData();
        console.log("Initial data fetch complete.");

        console.log("Starting periodic fetch interval...");
        startFetchInterval();
        console.log("Periodic fetch interval started.");

        if (typeof window.initializeAllUsers === 'function') {
            console.warn("Executing legacy compatibility function: window.initializeAllUsers()");
            window.initializeAllUsers();
        }
        window.initializeAllUsersFromScriptJS = function(callback) {
            console.log("Legacy compatibility function initializeAllUsersFromScriptJS called.");
            if (typeof callback === 'function') callback();
        };

        console.log("Application initialization sequence finished.");
        hideOnlineLoadingIndicator();


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
            if (!onlineUsersDiv && toggleDisplayModeButton) {
                 toggleDisplayModeButton.disabled = true;
                 toggleDisplayModeButton.textContent = 'List Missing';
            }
             if (!mainViewerContainer) {
                 if (toggleIframeCountButton) { toggleIframeCountButton.disabled = true; toggleIframeCountButton.textContent = 'Viewer Missing'; }
             }
    }

    function startFetchInterval() {
         if (fetchInterval) {
             clearInterval(fetchInterval);
             console.log("Cleared existing fetch interval.");
         }
         console.log(`Starting periodic fetch interval (${fetchIntervalDuration / 1000} seconds).`);
         fetchInterval = setInterval(async () => {
             console.log("Interval triggered: Fetching updated data...");
             await fetchData();
         }, fetchIntervalDuration);
    }


    initializeApp().catch(error => {
        console.error("Unhandled error during application initialization:", error);
        const fatalErrorMsg = `Fatal initialization error: ${error.message}. Check browser console or the Logs section.`;
        showOnlineErrorDisplay(fatalErrorMsg);
         showReportStatus(fatalErrorMsg, 'error');
         if (messageStatusDisplay) showStatusMessage(messageStatusDisplay, 'Fatal Init Error', 'error');

        hideOnlineLoadingIndicator();
        hideReportLoading();
        showRecognitionStatus('', false);

        [
             storageTypeSelector, filterTagsSelect, filterAgeSelector,
             toggleAutoScrollButton, toggleDisplayModeButton, toggleIframeCountButton,
             userSearchInput, messageSearchInput, messageInput, saveMessageButton,
             clearPreviousUsersButton, sendReportButton,
             showLogsButton, clearLogsButton
        ].forEach(el => {
             if (el && !el.disabled) {
                 el.disabled = true;
                 if (el.tagName === 'BUTTON') el.textContent = 'Error';
                 if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = 'Error: Init Failed';
                 if (el.tagName === 'SELECT') {
                      el.innerHTML = '<option>Error</option>';
                      el.value = 'Error';
                 }
             }
         });

         if (onlineUsersDiv && onlineUsersDiv.innerHTML.includes('Loading')) onlineUsersDiv.innerHTML = `<p class="text-muted w3-center w3-text-red">${fatalErrorMsg}</p>`;
         if (previousUsersDiv && previousUsersDiv.innerHTML.includes('Loading')) previousUsersDiv.innerHTML = `<p class="text-muted w3-center w3-text-red">History Unavailable due to error.</p>`;
         if (messageListDiv && messageListDiv.innerHTML.includes('Loading')) messageListDiv.innerHTML = `<p class="text-muted w3-center w3-text-red">Messaging Unavailable due to error.</p>`;

         if(logDisplayArea) {
              logDisplayArea.classList.remove('w3-hide');
              if(logEntriesDiv && !logEntriesDiv.innerHTML.includes('Fatal initialization error')) {
                   const errorHtml = `<div class="log-entry log-error"><span class="log-timestamp">[${formatLogTime(new Date())}]</span> <span class="log-message">${escapeHTML(fatalErrorMsg)}</span></div>`;
                   logEntriesDiv.insertAdjacentHTML('beforeend', errorHtml);
                   logEntriesDiv.scrollTop = logEntriesDiv.scrollHeight;
              }
         }
    });

});
