(function() {
    /**
     * Room Viewer Application Script
     * Handles fetching, filtering, displaying online users,
     * managing viewing history (previous users), and sending reports
     * via a server-side endpoint.
     */
    document.addEventListener('DOMContentLoaded', async function() {

        console.log("DOM fully loaded. Initializing application...");

    // --- DOM References ---
    // Use optional chaining (?) for elements that might not exist in the HTML
    const onlineUsersDiv = document.getElementById("onlineUsers")?.querySelector('.user-list');
    const previousUsersDiv = document.getElementById("previousUsers")?.querySelector('.user-list');
    const mainIframe = document.getElementById("mainIframe");
    const mainIframe2 = document.getElementById("mainIframe2");

    const storageTypeSelector = document.getElementById("storageType");
    const filterTagsSelect = document.getElementById("filterTags");
    const filterAgeSelect = document.getElementById("filterAge");

    // --- New DOM References for Reporting and Status ---
    const sendReportButton = document.getElementById("sendReportButton"); // Button to trigger report
    const reportLoadingIndicator = document.getElementById("reportLoadingIndicator"); // Optional loading indicator for report
    const reportStatusDisplay = document.getElementById("reportStatusDisplay"); // Optional element to show report success/error status

    // --- References for Online Loading/Error Display ---
    // Add these elements to your HTML if you want visual feedback during fetch
    const onlineLoadingIndicator = document.getElementById("onlineLoadingIndicator");
    const onlineErrorDisplay = document.getElementById("onlineErrorDisplay");

    // --- State Variables ---
    let storageType = storageTypeSelector?.value || 'local'; // Default to 'local' if selector missing
    let previousUsers = []; // Array to hold the history list
    // let removedUsers = []; // Array to hold removed users (Not fully implemented in logic, but structure exists)
    let allOnlineUsersData = []; // Array to hold ALL fetched online user data before filtering
    let lastFilteredUsers = []; // Array to hold the list currently displayed in the online section (used for reporting)
    let fetchInterval = null; // To hold the interval ID

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
            // Assuming birthday format is YYYY-MM-DD. Adjust if needed.
            // Split and create date carefully to avoid timezone issues if possible.
            // Using UTC methods can help standardize if the source format is consistent.
            const parts = birthday.split('-');
            if (parts.length !== 3) return false; // Basic format check

            // Note: new Date(year, monthIndex, day) uses 0-based month
            const birthDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));

            if (isNaN(birthDate.getTime())) {
                 console.warn("Invalid date encountered in isBirthday:", birthday);
                 return false;
            }
            // Compare UTC day and month
            return today.getUTCDate() === birthDate.getUTCDate() && today.getUTCMonth() === birthDate.getUTCMonth();
        } catch (e) {
             console.error("Error checking birthday for:", birthday, e);
             return false;
        }
    }

    // --- Core Application Logic Functions ---

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
        const tagFrequency = {};
        const ages = new Set();

        users.forEach(user => {
            // Ensure tags is an array and tags are strings
            if (user.tags && Array.isArray(user.tags)) {
                user.tags.forEach(tag => {
                     if (typeof tag === 'string' && tag.trim() !== '') {
                        const lowerTag = tag.trim().toLowerCase();
                        tagFrequency[lowerTag] = (tagFrequency[lowerTag] || 0) + 1;
                     }
                });
            }
            // Ensure age is a valid positive number
            if (user.age && typeof user.age === 'number' && user.age > 0) {
                ages.add(user.age);
            }
        });

        // --- Populate Tags ---
        // Sort tags: first by frequency (desc), then alphabetically for ties
        const sortedTags = Object.entries(tagFrequency)
            .sort(([tagA, countA], [tagB, countB]) => countB - countA || tagA.localeCompare(tagB))
            .slice(0, 75) // Limit number of tags shown in dropdown (e.g., top 75)
            .map(([tag]) => tag); // Get only the tag name

         // Preserve current selections before clearing
         const selectedTagValues = Array.from(filterTagsSelect.selectedOptions).map(opt => opt.value);
         filterTagsSelect.innerHTML = '<option value="">-- All Tags --</option>'; // Default option
         sortedTags.forEach(tag => {
              const isSelected = selectedTagValues.includes(tag);
              // Capitalize first letter for display (optional)
              const displayText = tag.charAt(0).toUpperCase() + tag.slice(1);
             filterTagsSelect.add(new Option(`${displayText} (${tagFrequency[tag]})`, tag, false, isSelected));
         });


        // --- Populate Ages ---
        // Sort ages numerically
        const sortedAges = Array.from(ages).sort((a, b) => a - b);
         // Preserve current selections
         const selectedAgeValues = Array.from(filterAgeSelect.selectedOptions).map(opt => opt.value);
        filterAgeSelect.innerHTML = '<option value="">-- All Ages --</option>'; // Default option
         sortedAges.forEach(age => {
              const isSelected = selectedAgeValues.includes(String(age)); // Compare as strings
             filterAgeSelect.add(new Option(String(age), String(age), false, isSelected));
         });

         console.log("Filter population complete.");

         // Update storage options (in case new IndexedDB keys were created externally, though unlikely)
         // Run this less frequently if it causes issues or isn't needed after init
         // await populateStorageOptions();
    }

     /**
      * Applies filters based on dropdown selections or button overrides.
      * Updates `lastFilteredUsers` state and calls `displayOnlineUsersList`.
      * @param {Object} [buttonFilters={}] - Optional filters from specific buttons like { tag: 'tagName' } or { age: 18 }.
      */
    function applyFiltersAndDisplay(buttonFilters = {}) {
        console.log("Applying filters...", { buttonFilters });

        // Determine filter criteria: Use button filter if provided, otherwise use select elements
        let filterTags = [];
        if (buttonFilters.tag) {
            filterTags = [buttonFilters.tag.toLowerCase()];
            // Optionally update the dropdown to reflect the button click
            if (filterTagsSelect) filterTagsSelect.value = buttonFilters.tag.toLowerCase();
        } else if (filterTagsSelect) {
            filterTags = Array.from(filterTagsSelect.selectedOptions)
                .map(option => option.value.toLowerCase())
                .filter(tag => tag !== ''); // Exclude the "-- All Tags --" option
        }

        let filterAges = [];
        if (buttonFilters.age) {
            filterAges = [parseInt(buttonFilters.age)];
             if (filterAgeSelect) filterAgeSelect.value = String(buttonFilters.age);
        } else if (filterAgeSelect) {
            filterAges = Array.from(filterAgeSelect.selectedOptions)
                .map(option => parseInt(option.value))
                .filter(age => !isNaN(age) && age > 0); // Exclude "-- All Ages --" and ensure valid numbers
        }

        console.log("Active filters:", { filterTags, filterAges });

        // Filter the main data source (`allOnlineUsersData`)
        const filteredUsers = allOnlineUsersData.filter(user => {
            // Basic check for user validity
            if (!user || !user.username) return false;

            // Filter condition 1: Must be public show (adjust if other types are needed)
            const isPublic = user.current_show === 'public';

            // Filter condition 2: Tag match (must match ALL selected tags if multiple are selected)
            // OR use .some() if ANY selected tag should match
             let hasTags = true; // Default to true if no tags are selected
             if (filterTags.length > 0) {
                 // Ensure user.tags exists and is an array
                 const userTagsLower = (user.tags && Array.isArray(user.tags))
                     ? user.tags.map(t => typeof t === 'string' ? t.toLowerCase() : '')
                     : [];
                 // Use .some() - user must have at least one of the selected tags
                 hasTags = filterTags.some(filterTag => userTagsLower.includes(filterTag));
                 // OR Use .every() - user must have ALL selected tags (less common use case)
                 // hasTags = filterTags.every(filterTag => userTagsLower.includes(filterTag));
             }


            // Filter condition 3: Age match (must match ANY selected age if multiple selected)
            let isAgeMatch = true; // Default to true if no ages are selected
            if (filterAges.length > 0) {
                // Ensure user.age exists and is a number
                isAgeMatch = (user.age && typeof user.age === 'number')
                    ? filterAges.includes(user.age)
                    : false;
            }

            // Return true only if all conditions pass
            return isPublic && hasTags && isAgeMatch;
        });

        console.log(`Filtered ${allOnlineUsersData.length} users down to ${filteredUsers.length}.`);
        lastFilteredUsers = filteredUsers; // --- Store the filtered list for reporting ---
        displayOnlineUsersList(filteredUsers); // Display the result
    }


    /**
     * Displays the provided list of users in the online users container.
     * @param {Array<Object>} usersToDisplay - The array of user objects to display.
     */
    function displayOnlineUsersList(usersToDisplay) {
         if (!onlineUsersDiv) {
             console.warn("Online users display div (#onlineUsers .user-list) not found. Cannot display users.");
             return;
         }
        // console.log(`displayOnlineUsersList: Displaying ${usersToDisplay.length} filtered online users.`);
        onlineUsersDiv.innerHTML = ""; // Clear previous list

        if (usersToDisplay.length === 0) {
            onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users match the current filters.</p>';
            return;
        }

         // Optional: Sort the displayed users (e.g., by tokens, viewers, age, alphabetical)
         // usersToDisplay.sort((a, b) => (b.num_viewers || 0) - (a.num_viewers || 0)); // Example: Sort by viewers descending

        const fragment = document.createDocumentFragment(); // Use fragment for better performance
        usersToDisplay.forEach(user => {
            // Basic data validation before creating element
            if (!user || !user.image_url || !user.username) { // iframe_embed might not always be needed directly here
                console.warn("Skipping online user display due to incomplete data:", user);
                return;
            }
            const userElement = createUserElement(user, 'online'); // Use helper, specify list type
            fragment.appendChild(userElement);
        });
        onlineUsersDiv.appendChild(fragment); // Append fragment once
         // console.log("displayOnlineUsersList: Online users display complete.");
    }


    /**
     * Displays the previous users list, filtering to show only those currently online & public.
     * Ensures `previousUsers` state is loaded before displaying.
     * @returns {Promise<void>}
     */
    async function displayPreviousUsers() {
         if (!previousUsersDiv) {
             console.warn("Previous users display div (#previousUsers .user-list) not found.");
             return;
         }
         console.log(`displayPreviousUsers: Refreshing display. History has ${previousUsers.length} users.`);
         previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Loading history...</p>'; // Initial loading state

         // Ensure previousUsers state is loaded. If it's empty, try loading from storage.
         if (previousUsers.length === 0) {
             console.log("displayPreviousUsers: State empty, attempting load from storage...");
             previousUsers = await loadUsers("previousUsers"); // Load based on current storageType
             if (previousUsers.length === 0) {
                previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No viewing history saved.</p>';
                console.log("displayPreviousUsers: No previous users found in storage.");
                return;
             } else {
                  console.log(`displayPreviousUsers: Loaded ${previousUsers.length} previous users from storage.`);
             }
         }

         // Check if we have current online data to compare against.
         if (allOnlineUsersData.length === 0) {
              console.warn("displayPreviousUsers: Online user data (allOnlineUsersData) not available. Displaying saved history without online status check.");
              // Option 1: Show all saved users without filtering (might be confusing)
               // const usersToDisplay = previousUsers;
              // Option 2: Show a message indicating online status can't be checked
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">History loaded. Fetching online status...</p>';
              return; // Wait for next fetchData cycle to get online status
         }
          // console.log(`displayPreviousUsers: Comparing against ${allOnlineUsersData.length} currently online users.`);


         // Filter previous users: Show only those who are *currently* in `allOnlineUsersData` and are 'public'.
         // Create a Map for faster lookup of online users by username
         const onlineUserMap = new Map(allOnlineUsersData.map(user => [user.username, user]));

         const currentlyOnlineAndPublicPreviousUsers = previousUsers.filter(prevUser => {
             const onlineUser = onlineUserMap.get(prevUser.username);
             // Must be found in the current online list AND have current_show == 'public'
             return onlineUser && onlineUser.current_show === 'public';
         });

         console.log(`displayPreviousUsers: Found ${currentlyOnlineAndPublicPreviousUsers.length} saved users currently online & public.`);

         // Clear the loading message
         previousUsersDiv.innerHTML = "";

         if (currentlyOnlineAndPublicPreviousUsers.length === 0) {
              previousUsersDiv.innerHTML = '<p class="text-muted w3-center">None of your saved users are online & public right now.</p>';
              return;
         }

         // Display the filtered list
         const fragment = document.createDocumentFragment();
         currentlyOnlineAndPublicPreviousUsers.forEach(user => {
             // Re-validate data just in case, though it should be fine if saved correctly
             if (!user || !user.image_url || !user.username) {
                console.warn("Skipping previous user display due to incomplete data:", user);
                return;
            }
             const userElement = createUserElement(user, 'previous'); // Use helper, indicate type 'previous'
             fragment.appendChild(userElement);
         });
         previousUsersDiv.appendChild(fragment);
          console.log("displayPreviousUsers: Previous users display complete.");
    }


    /**
     * Handles clicking on a user: loads their stream into the selected iframe
     * and adds/moves them to the top of the previous users history.
     * @param {Object} user - The user object that was clicked.
     */
    function handleUserClick(user) {
         if (!mainIframe || !mainIframe2) {
              console.error("Iframe elements (#mainIframe or #mainIframe2) not found. Cannot load user stream.");
              // Optionally show a user-facing error message
              return;
         }
         if (!user || !user.username) {
             console.error("Invalid user data passed to handleUserClick:", user);
             return;
         }
        console.log(`User clicked: ${user.username}`);

        // Determine which iframe to use based on radio button selection
        const iframeChoiceRadio = document.querySelector('input[name="iframeChoice"]:checked');
        const iframeChoice = iframeChoiceRadio ? iframeChoiceRadio.value : 'mainIframe'; // Default to 'mainIframe'
        const selectedIframe = (iframeChoice === 'mainIframe2') ? mainIframe2 : mainIframe;

        // Construct the iframe URL (ensure parameters are correct)
        // Example URL structure - verify this matches Chaturbate's requirements
        const iframeSrc = `https://chaturbate.com/embed/${user.username}/?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black`;
        // Or use the fullvideo URL if preferred:
        // const iframeSrc = `https://chaturbate.com/fullvideo/?campaign=9cg6A&disable_sound=0&tour=dU9X&b=${user.username}`;
        // &

        console.log(`Loading ${user.username} into ${iframeChoice} with src: ${iframeSrc}`);
        selectedIframe.src = iframeSrc;


        // Add or move the user to the top of the previous users list (async operation)
        // We don't necessarily need to wait for this to complete before returning
        addToPreviousUsers(user).catch(err => {
            console.error(`Error adding ${user.username} to previous users:`, err);
            // Handle potential save errors (e.g., show a message)
        });
        // Refreshing the previous users display is handled by the main fetch cycle or explicitly after removals
    }


    /**
     * Adds a user to the `previousUsers` state array.
     * Ensures uniqueness (moves to front if exists) and enforces `maxHistorySize`.
     * Saves the updated list to the selected storage.
     * @param {Object} user - The user object to add/move.
     * @returns {Promise<void>}
     */
    async function addToPreviousUsers(user) {
        if (!user || !user.username) {
            console.warn("Attempted to add invalid user to history:", user);
            return;
        }
        // console.log(`Attempting to add/move ${user.username} to history.`);

        // Find index of user if they already exist in the history
        const existingIndex = previousUsers.findIndex(u => u.username === user.username);

        // If user exists, remove their old entry first
        if (existingIndex !== -1) {
            previousUsers.splice(existingIndex, 1);
            // console.log(`Removed existing entry for ${user.username} before re-adding to front.`);
        }

        // Add the current user object to the beginning of the array
        previousUsers.unshift(user);

        // Trim the array if it exceeds the maximum allowed size
        if (previousUsers.length > maxHistorySize) {
            const removed = previousUsers.splice(maxHistorySize); // Remove items from the end
            console.log(`Previous users history trimmed, ${removed.length} oldest users removed.`);
        }

        // console.log(`Added/Moved ${user.username} to front of history state. Size: ${previousUsers.length}`);

        // Save the updated history list to storage
        try {
            await saveUsers("previousUsers", previousUsers);
            // No need to refresh display here usually, displayPreviousUsers is called periodically
            // or after specific actions like removal. Calling it here might cause unnecessary redraws.
        } catch (error) {
            console.error(`Failed to save previous users after adding ${user.username}:`, error);
            // Consider reverting the state change or notifying the user if saving fails critically
            // For now, the state remains updated even if save fails.
        }
    }

     /**
      * Removes a user from the `previousUsers` history state by username.
      * Saves the updated list to the selected storage.
      * @param {string} username - The username to remove.
      * @returns {Promise<void>}
      */
     async function removeFromPreviousUsers(username) {
         if (!username) {
             console.warn("Attempted to remove user with invalid username from history.");
             return;
         }
         console.log(`Attempting to remove ${username} from history.`);
         const initialCount = previousUsers.length;
         // Filter out the user with the matching username
         previousUsers = previousUsers.filter(u => u.username !== username);

         if (previousUsers.length < initialCount) {
             console.log(`Successfully removed ${username} from history state. New size: ${previousUsers.length}`);
             // Save the updated list to storage
             try {
                await saveUsers("previousUsers", previousUsers);
                // The display refresh should be called *after* this function completes successfully
                // displayPreviousUsers(); // Moved this call to the event listener
             } catch (error) {
                 console.error(`Failed to save previous users after removing ${username}:`, error);
                 // State is updated, but save failed. May need error handling/notification.
             }
         } else {
             console.warn(`Attempted to remove ${username}, but they were not found in the current history state.`);
         }
     }

     /**
      * Clears the previous users history from both state and the selected storage.
      * @returns {Promise<void>}
      */
     async function clearPreviousUsers() {
         console.log("Clearing previous users history...");
         const confirmation = confirm("Are you sure you want to clear your entire viewing history?");
         if (!confirmation) {
             console.log("Clear history cancelled by user.");
             return;
         }

         showOnlineLoadingIndicator("Clearing history..."); // Show feedback

         previousUsers = []; // Clear state array

         // Clear from the currently selected storage
         const keyToClear = "previousUsers";
         try {
             if (storageType === "indexedClicked" || storageType.startsWith('IndexedDB:')) {
                 // For IndexedDB, we need to explicitly delete the key
                 let db;
                 try {
                     db = await openIndexedDB();
                     const tx = db.transaction('users', 'readwrite');
                     const store = tx.objectStore('users');
                     // Use the correct key (handle custom keys if storageType indicates one)
                     const idbKey = storageType.startsWith('IndexedDB:') ? storageType.substring(11) : keyToClear;
                     console.log(`Deleting key '${idbKey}' from IndexedDB.`);
                     store.delete(idbKey);
                     await new Promise((resolve, reject) => { // Wait for transaction completion
                         tx.oncomplete = () => { console.log(`IndexedDB delete transaction for key '${idbKey}' complete.`); db.close(); resolve(); };
                         tx.onerror = (e) => { console.error("IndexedDB delete transaction error:", e.target.error); db.close(); reject(e.target.error); };
                         tx.onabort = (e) => { console.error("IndexedDB delete transaction aborted:", e.target.error); db.close(); reject(e.target.error || new Error('Delete transaction aborted')); };
                     });
                     console.log(`History key '${idbKey}' cleared from IndexedDB.`);
                 } catch (dbError) {
                     console.error("Error accessing IndexedDB to clear history:", dbError);
                     // Re-throw or handle more gracefully
                     throw dbError; // Propagate error
                 }
             } else {
                 // For localStorage or sessionStorage
                 const storage = storageType === "local" ? localStorage : sessionStorage;
                 storage.removeItem(keyToClear);
                 console.log(`History key '${keyToClear}' cleared from ${storageType} storage.`);
             }

             // Successfully cleared from storage, now update display
             await displayPreviousUsers(); // Refresh display to show it's empty (needs await)
             console.log("Previous users history cleared successfully.");

         } catch (error) {
             console.error("Error clearing previous users history from storage:", error);
             // Optionally show an error message to the user
             // showUserMessage("Failed to clear history from storage.", 'error');
         } finally {
             hideOnlineLoadingIndicator(); // Hide feedback indicator
         }
    // --- Reporting Functions ---

    /**
     * Sends the `lastFilteredUsers` list as a JSON report
     * to the configured `REPORT_SERVER_ENDPOINT`.
     * Handles loading state and status feedback.
     * @returns {Promise<void>}
     */
    async function sendReport() {
        console.log("Attempting to send report...");

        // 1. Validate Endpoint Configuration
        if (!REPORT_SERVER_ENDPOINT || REPORT_SERVER_ENDPOINT === '/api/send-user-report') { // Check default/placeholder
             const errorMsg = "Report feature disabled: Server endpoint not configured in the script.";
             console.error(errorMsg);
             showReportStatus(errorMsg, 'error');
             return;
        }
         // Optional: Basic check if it looks like a URL path or full URL
         if (!REPORT_SERVER_ENDPOINT.startsWith('/') && !REPORT_SERVER_ENDPOINT.startsWith('http')) {
              const errorMsg = `Report feature error: Invalid endpoint URL format: "${REPORT_SERVER_ENDPOINT}"`;
              console.error(errorMsg);
              showReportStatus(errorMsg, 'error');
              return;
         }


        // 2. Check if there's data to send
        if (!lastFilteredUsers || lastFilteredUsers.length === 0) {
            const warnMsg = "No users currently displayed in the 'Online Users' list to report.";
            console.warn(warnMsg);
            showReportStatus(warnMsg, 'warning');
            return;
        }

        // 3. Show Loading State
        showReportLoading(`Sending report for ${lastFilteredUsers.length} users...`);
        clearReportStatus(); // Clear previous status messages

        // 4. Prepare Data Payload
        // Select only the necessary fields to minimize payload size and complexity
        const reportData = lastFilteredUsers.map(user => ({
            username: user.username,
            age: user.age,
            tags: user.tags,
            // Add other potentially useful fields if available and needed by the server
            is_new: user.is_new,
            num_viewers: user.num_viewers,
            // current_show: user.current_show, // Usually 'public' if filtered this way
            // birthday: user.birthday, // Send if needed by server
            // image_url: user.image_url // Probably not needed for report
        }));

        console.log(`Sending report payload (${reportData.length} users) to: ${REPORT_SERVER_ENDPOINT}`);
        // console.log("Sample report payload item:", reportData[0]); // Debugging

        // 5. Send Request using Fetch API
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
             console.error(`Report send aborted due to timeout (${reportSendTimeout}ms).`);
             controller.abort();
             }, reportSendTimeout);

        try {
            const response = await fetch(REPORT_SERVER_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add any required Authorization or custom headers here
                    // e.g., 'Authorization': 'Bearer YOUR_API_TOKEN'
                    // e.g., 'X-Api-Key': 'YOUR_SECRET_KEY'
                },
                body: JSON.stringify(reportData),
                signal: controller.signal // Link abort controller
            });

            clearTimeout(timeoutId); // Clear the timeout timer if fetch completes/fails

            console.log(`Report send response status: ${response.status}`);

            // 6. Handle Response
            if (!response.ok) {
                 // Try to get more detailed error message from server response body
                 let errorBody = `Server responded with status ${response.status} ${response.statusText}`;
                 try {
                     const errorJson = await response.json();
                     errorBody = errorJson.message || errorJson.error || JSON.stringify(errorJson);
                 } catch (e) {
                     // If response is not JSON, try text
                     try {
                         errorBody = await response.text();
                     } catch (e2) { /* Keep the original status text */ }
                 }
                 console.error(`Report send HTTP error: ${errorBody}`);
                 throw new Error(`Server error: ${errorBody.substring(0, 100)}...`); // Throw concise error
            }

            // Assuming server sends back JSON like { status: 'success', message: '...' }
            // or { status: 'error', message: '...' }
            const result = await response.json();
            console.log("Report send server response:", result);

            if (result && (result.status === 'success' || response.status === 200 || response.status === 201)) { // Check common success indicators
                const successMsg = result.message || "Report sent successfully!";
                console.log(successMsg);
                showReportStatus(successMsg, 'success');
            } else {
                const errorMsg = `Report failed: ${result.message || result.error || 'Unknown server response.'}`;
                console.error(errorMsg);
                showReportStatus(errorMsg, 'error');
            }

        } catch (error) {
            console.error("Error caught during report send fetch:", error);
             if (error.name === 'AbortError') {
                 showReportStatus("Report request timed out. Server might be slow or unreachable.", 'error');
             } else {
                 // Network errors, JSON parsing errors, or thrown errors from response handling
                 showReportStatus(`Failed to send report: ${error.message}`, 'error');
             }
        } finally {
            // 7. Hide Loading State
            hideReportLoading(); // Always hide loading indicator regardless of success/failure
            console.log("Report sending process finished.");
        }
    }


    // --- Initial Setup and Event Listeners ---

    /** Checks if all essential DOM elements are present. Logs errors or warnings. */
    function validateDOMReferences() {
        const criticalMissing = [];
        if (!onlineUsersDiv) criticalMissing.push("#onlineUsers .user-list");
        if (!previousUsersDiv) criticalMissing.push("#previousUsers .user-list");
        if (!mainIframe) criticalMissing.push("#mainIframe");
        if (!mainIframe2) criticalMissing.push("#mainIframe2");
        if (!storageTypeSelector) criticalMissing.push("#storageType");
        if (!filterTagsSelect) criticalMissing.push("#filterTags");
        if (!filterAgeSelect) criticalMissing.push("#filterAge");

        if (criticalMissing.length > 0) {
            const errorMsg = `CRITICAL ERROR: Missing essential DOM elements: ${criticalMissing.join(', ')}. Application might not function correctly.`;
            console.error(errorMsg);
            // Display error to user?
            showOnlineErrorDisplay(`Initialization failed: Missing required page elements (${criticalMissing[0]}...).`);
            // throw new Error(errorMsg); // Option: Stop execution if critical elements missing
            return false; // Indicate failure
        }

        // Optional elements (log warnings if missing)
        if (!sendReportButton) console.warn("Optional element missing: #sendReportButton. Reporting functionality disabled.");
        if (!reportLoadingIndicator) console.warn("Optional element missing: #reportLoadingIndicator. Reporting loading feedback unavailable.");
        if (!reportStatusDisplay) console.warn("Optional element missing: #reportStatusDisplay. Reporting status feedback unavailable.");
        if (!onlineLoadingIndicator) console.warn("Optional element missing: #onlineLoadingIndicator. Online user loading feedback unavailable.");
        if (!onlineErrorDisplay) console.warn("Optional element missing: #onlineErrorDisplay. Online user error feedback unavailable.");

        console.log("DOM references validated. Essential elements found.");
        return true; // Indicate success
    }


    /** Sets up all necessary event listeners for UI elements. */
    function setupEventListeners() {
        console.log("Setting up event listeners...");

        // Storage Type Change
        storageTypeSelector?.addEventListener("change", async function() {
             const newStorageType = this.value;
             console.log(`Storage type changed to: ${newStorageType}`);
             // Prevent changing if a save is in progress? (More complex state needed)
             if (newStorageType !== storageType) {
                storageType = newStorageType;
                // Reload history from the newly selected storage type
                showOnlineLoadingIndicator("Loading history from new source..."); // Provide feedback
                previousUsers = await loadUsers("previousUsers");
                // removedUsers = await loadUsers("removedUsers"); // If using removedUsers
                await displayPreviousUsers(); // Refresh display (needs await)
                hideOnlineLoadingIndicator();
             }
        });

        // Filter Selects Change (use 'change' event)
        filterTagsSelect?.addEventListener("change", () => applyFiltersAndDisplay());
        filterAgeSelect?.addEventListener("change", () => applyFiltersAndDisplay());

         // --- Specific Filter Buttons ---
         // Example buttons - ensure these IDs exist in your HTML
         document.getElementById("filterAge18")?.addEventListener("click", () => applyFiltersAndDisplay({ age: 18 }));
         document.getElementById("filterTagAsian")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'asian' }));
         document.getElementById("filterTagBlonde")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'blonde' }));
         document.getElementById("filterTagDeepthroat")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'deepthroat' }));
         document.getElementById("filterTagBigboobs")?.addEventListener("click", () => applyFiltersAndDisplay({ tag: 'bigboobs' }));
         // Add listeners for other specific filter buttons...

         // --- Clear History Button ---
         document.getElementById("clearPreviousUsers")?.addEventListener("click", clearPreviousUsers); // Calls async function

         // --- Send Report Button ---
         if (sendReportButton) {
             sendReportButton.addEventListener("click", sendReport); // Calls async function
             console.log("Report button event listener added.");
         } else {
             console.log("Report button not found, listener not added.");
         }

        console.log("Event listeners setup complete.");
    }


    // --- Application Initialization Sequence ---

    async function initializeApp() {
        console.log("Initializing application...");

        if (!validateDOMReferences()) {
             console.error("Initialization aborted due to missing critical DOM elements.");
             return; // Stop initialization
        }

        // 1. Populate storage options dropdown
        await populateStorageOptions(); // Sets initial `storageType` based on selector

        // 2. Setup event listeners for UI elements
        setupEventListeners();

        // 3. Load initial user history from the selected storage
        showOnlineLoadingIndicator("Loading initial history...");
        previousUsers = await loadUsers("previousUsers");
        // removedUsers = await loadUsers("removedUsers"); // Load if needed
        console.log(`Initial load: Found ${previousUsers.length} users in history.`);
        // Don't display previous users yet, wait for online data for filtering

        // 4. Perform the initial fetch of online user data
        // `fetchData` will handle displaying online users and the *filtered* previous users
        await fetchData(); // This is the main initial data load and display trigger

        // 5. Start the periodic fetch interval *after* the first fetch completes
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
    }

    // --- Fetch Interval Control ---
    function startFetchInterval() {
         if (fetchInterval) {
             clearInterval(fetchInterval);
             console.log("Cleared existing fetch interval.");
         }
         console.log(`Starting periodic fetch interval (${fetchIntervalDuration / 1000} seconds).`);
         // Call fetchData immediately, then set interval for subsequent calls
         // Note: Initial call is already done by initializeApp()
         fetchInterval = setInterval(async () => {
             console.log("Interval triggered: Fetching updated data...");
             await fetchData(); // Call the async fetch function periodically
         }, fetchIntervalDuration);
    }

    // --- Start the application ---
    initializeApp().catch(error => {
        console.error("Unhandled error during application initialization:", error);
        showOnlineErrorDisplay(`Fatal initialization error: ${error.message}. Please refresh or check console.`);
        // Optionally hide loading indicators if they were left visible
        hideOnlineLoadingIndicator();
        hideReportLoading();
    });

    }); // End DOMContentLoaded
})();
