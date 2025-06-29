(function() {
    // Global error collection (remains global for now)
    let collectedJsErrors = []; 
    window.onerror = function(message, source, lineno, colno, error) {
        const errorDetails = {
            message: message,
            source: source,
            lineno: lineno,
            colno: colno,
            error: error ? error.stack : 'N/A',
            timestamp: new Date().toISOString()
        };
        collectedJsErrors.push(errorDetails);
        console.error("Collected JS Error:", errorDetails);
        if (collectedJsErrors.length > 100) {
            collectedJsErrors.shift();
        }
        return false;
    };

    class App {
        // Service and Manager instances
        apiService;
        uiManager;
        storageManager;

        // DOM References
        onlineUsersDiv;
        previousUsersDiv;
        // mainIframe and mainIframe2 removed
        dynamicIframeContainer; // New
        iframeCountSelector; // New
        storageTypeSelector;
        filterTagsSelect;
        filterAgeSelect;
        sendReportButton;
        globalUserCardIframeToggleRadios; // New: for the radio button group
        newSnippetInput;
        saveSnippetButton;
        currentSnippetDisplay;
        snippetStatusMessage;
        mainTextArea;
        autocompleteSuggestionsContainer;
        bigTipperPopupButton;
        bigTipperAppModal;
        closeBigTipperAppModal;
        bigTipperAppIframe;
        copyJsErrorsButton;
        filterBirthdayBannerButton;
            
        // Private State Variables
        #storageType;
        #previousUsers = [];
        #allOnlineUsersData = [];
        #lastFilteredUsers = [];
        #fetchInterval = null;
        // #initialIframesSet = false; // Removed, iframe initialization handled differently

        #currentOnlineUsersOffset = 0;
        #isLoadingOnlineUsers = false;
        #hasMoreOnlineUsersToLoad = true; 

        #previousUsersDisplayOffset = 0;
        #previousUsersPageSize = 25; 
        #isLoadingMorePreviousUsers = false;
        #hasMorePreviousUsersToLoad = true;

        // New properties for IntersectionObserver and card preview mode
        #userListIntersectionObserver = null;
        userCardPreviewMode = 'image'; // 'image' or 'iframe-in-view'
        #isScrollingFast = false;
        #scrollCheckTimeout = null;
        
        constructor() {
            // window.appInstance = this; // Removed: toggleUserCardPreview passed as callback

            // --- Critical Dependency Checks ---
            if (typeof ApiService === 'undefined') {
                const errorMsg = "FATAL: ApiService class is not defined. api.js might be missing, have a syntax error, or failed to load.";
                console.error(errorMsg);
                document.body.innerHTML = `<div style="color:red;padding:20px;font-size:18px;font-family:sans-serif;text-align:center;">Critical Error: ApiService not loaded. Application cannot start. Please check console for details. (api.js)</div>`;
                throw new Error(errorMsg);
            }
            if (typeof StorageManager === 'undefined') {
                const errorMsg = "FATAL: StorageManager class is not defined. storage.js might be missing, have a syntax error, or failed to load.";
                console.error(errorMsg);
                document.body.innerHTML = `<div style="color:red;padding:20px;font-size:18px;font-family:sans-serif;text-align:center;">Critical Error: StorageManager not loaded. Application cannot start. Please check console for details. (storage.js)</div>`;
                throw new Error(errorMsg);
            }
            if (typeof UIManager === 'undefined') {
                const errorMsg = "FATAL: UIManager class is not defined. ui.js might be missing, have a syntax error, or failed to load.";
                console.error(errorMsg);
                document.body.innerHTML = `<div style="color:red;padding:20px;font-size:18px;font-family:sans-serif;text-align:center;">Critical Error: UIManager not loaded. Application cannot start. Please check console for details. (ui.js)</div>`;
                throw new Error(errorMsg);
            }

            // Instantiate services and managers
            // Config variables (apiUrlBase, etc.) are globally available from config.js
            this.apiService = new ApiService(apiUrlBase, apiLimit, maxApiFetchLimit, apiFetchTimeout);
            this.uiManager = new UIManager();
            this.storageManager = new StorageManager(); 

            // DOM References
            this.onlineUsersDiv = document.getElementById("onlineUsers")?.querySelector('.user-list');
            this.previousUsersDiv = document.getElementById("previousUsers")?.querySelector('.user-list');
            this.dynamicIframeContainer = document.getElementById("dynamicIframeContainer"); // New
            this.iframeCountSelector = document.getElementById("iframeCountSelector"); // New
            this.storageTypeSelector = document.getElementById("storageType");
            this.filterTagsSelect = document.getElementById("filterTags");
            this.filterAgeSelect = document.getElementById("filterAge");
            this.sendReportButton = document.getElementById("sendReportButton");
            this.globalUserCardIframeToggleRadios = document.getElementsByName("userCardPreviewMode"); // New
            
            this.newSnippetInput = document.getElementById('newSnippetInput');
            this.saveSnippetButton = document.getElementById('saveSnippetButton');
            this.currentSnippetDisplay = document.getElementById('currentSnippetDisplay');
            this.snippetStatusMessage = document.getElementById('snippetStatusMessage'); 

            this.mainTextArea = document.getElementById('mainTextArea');
            this.autocompleteSuggestionsContainer = document.getElementById('autocompleteSuggestionsContainer');

            this.bigTipperPopupButton = document.getElementById('bigTipperPopupButton');
            this.bigTipperAppModal = document.getElementById('bigTipperAppModal');
            this.closeBigTipperAppModal = document.getElementById('closeBigTipperAppModal');
            this.bigTipperAppIframe = document.getElementById('bigTipperAppIframe');

            this.copyJsErrorsButton = document.getElementById('copyJsErrorsButton');
            this.filterBirthdayBannerButton = document.getElementById('filterBirthdayBanner');
            
            // Initialize storageType and sync with window (for StorageManager)
            this.#storageType = this.storageTypeSelector?.value || 'local';
            window.storageType = this.#storageType; 
        }

        #isBirthday(birthday) {
            if (!birthday || typeof birthday !== 'string') return false;
            try {
                const today = new Date();
                const parts = birthday.split('-');
                if (parts.length !== 3) return false;
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const day = parseInt(parts[2], 10);

                if (isNaN(year) || isNaN(month) || isNaN(day) ||
                    year < 1900 || year > new Date().getFullYear() ||
                    month < 1 || month > 12 ||
                    day < 1 || day > 31) {
                    console.warn("Invalid date components in isBirthday:", birthday, {year, month, day});
                    return false;
                }
                const birthDate = new Date(Date.UTC(year, month - 1, day));
                if (isNaN(birthDate.getTime()) || 
                    birthDate.getUTCFullYear() !== year ||
                    birthDate.getUTCMonth() !== (month - 1) ||
                    birthDate.getUTCDate() !== day) {
                    console.warn("Invalid date constructed in isBirthday (check month length or overflow):", birthday, {year, month, day});
                    return false;
                }
                return today.getUTCDate() === birthDate.getUTCDate() && today.getUTCMonth() === birthDate.getUTCMonth();
            } catch (e) {
                 console.error("Error checking birthday for:", birthday, e);
                 return false;
            }
        }

        #getDaysSinceOrUntil18thBirthday(birthdayString, age) {
            if (age !== 18 || !birthdayString || typeof birthdayString !== 'string') {
                return "";
            }

            try {
                const parts = birthdayString.split('-');
                if (parts.length !== 3) {
                    console.warn("Invalid birthday string format:", birthdayString);
                    return "";
                }

                const birthYear = parseInt(parts[0], 10);
                const birthMonth = parseInt(parts[1], 10); // 1-12
                const birthDay = parseInt(parts[2], 10);    // 1-31

                if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay) ||
                    birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
                    console.warn("Invalid date components in getDaysSinceOrUntil18thBirthday:", birthdayString);
                    return "";
                }

                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);

                const currentYear = today.getUTCFullYear();
                const birthdayThisYear = new Date(Date.UTC(currentYear, birthMonth - 1, birthDay));
                birthdayThisYear.setUTCHours(0,0,0,0);
                
                if (birthdayThisYear.getUTCMonth() !== (birthMonth - 1) || birthdayThisYear.getUTCDate() !== birthDay) {
                    console.warn("Birthday month/day mismatch after constructing for current year (e.g. Feb 29 on non-leap):", birthdayString, birthdayThisYear);
                    return ""; 
                }

                const diffTime = birthdayThisYear.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                    return "18th B-day: Today!";
                } else if (diffDays < 0) {
                    return `18th B-day: ${Math.abs(diffDays)} days ago`;
                } else {
                    return `18th B-day: In ${diffDays} days`;
                }

            } catch (error) {
                console.error("Error in #getDaysSinceOrUntil18thBirthday:", error, "for birthday:", birthdayString);
                return "";
            }
        }

        #extractSocialMedia(descriptionString) {
            if (!descriptionString || typeof descriptionString !== 'string') {
                return {}; // Return an empty object if no description
            }

            const socialMediaPatterns = {
                twitter: /twitter\.com\/([a-zA-Z0-9_]+)/ig,
                instagram: /instagram\.com\/([a-zA-Z0-9_.]+)/ig,
                // Add more patterns for other social media platforms (e.g., facebook, tiktok)
                // Generic handles starting with @
                handles: /@([a-zA-Z0-9_]+)/g
            };

            const foundSocialMedia = {};

            for (const platform in socialMediaPatterns) {
                const pattern = socialMediaPatterns[platform];
                let match;
                const matches = [];
                while ((match = pattern.exec(descriptionString)) !== null) {
                    if (platform === 'handles') {
                        // Avoid capturing email addresses if they start with @
                        if (match.index > 0 && descriptionString[match.index-1] === '@') {
                            continue;
                        }
                        // Check if it's part of a URL already captured
                        const potentialHandle = match[1];
                        if (!Object.values(foundSocialMedia).flat().some(url => url.includes(potentialHandle))) {
                            matches.push(`@${potentialHandle}`);
                        }
                    } else {
                        matches.push(match[0]); // Store the full URL or the relevant part
                    }
                }
                if (matches.length > 0) {
                    foundSocialMedia[platform] = [...new Set(matches)]; // Store unique matches
                }
            }
            return foundSocialMedia;
        }

        #escapeHtml(unsafe) {
            return unsafe
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
        }
        
        #showSnippetStatus(message, type = 'info') {
            if (!this.snippetStatusMessage) return;
            this.snippetStatusMessage.textContent = message;
            this.snippetStatusMessage.className = ''; 
            this.snippetStatusMessage.classList.add('status-message', type); 
            if (type === 'success') this.snippetStatusMessage.style.color = 'green';
            else if (type === 'error') this.snippetStatusMessage.style.color = 'red';
            else this.snippetStatusMessage.style.color = 'blue';
            this.snippetStatusMessage.style.display = 'block';
            
            setTimeout(() => {
                if (this.snippetStatusMessage) this.snippetStatusMessage.style.display = 'none';
            }, 3000);
        }

        async #fetchDataAndUpdateUI() {
            console.log("[DIAGNOSTIC] App: Starting #fetchDataAndUpdateUI...");
            this.uiManager.showOnlineLoadingIndicator("Loading online users...");
            this.uiManager.clearOnlineErrorDisplay();

            if (this.#userListIntersectionObserver && this.onlineUsersDiv) {
                this.onlineUsersDiv.querySelectorAll('.user-info').forEach(el => this.#userListIntersectionObserver.unobserve(el));
            }

            this.#currentOnlineUsersOffset = 0;
            this.#hasMoreOnlineUsersToLoad = true;
            this.#isLoadingOnlineUsers = false;

            try {
                console.log("[DIAGNOSTIC] App: Calling apiService.getOnlineRooms...");
                const initialData = await this.apiService.getOnlineRooms(this.#currentOnlineUsersOffset);
                console.log("[DIAGNOSTIC] App: apiService.getOnlineRooms returned:", initialData);

                this.#allOnlineUsersData = initialData.users || []; // Ensure it's an array
                this.#currentOnlineUsersOffset = initialData.nextOffset;
                this.#hasMoreOnlineUsersToLoad = initialData.hasMore;
                
                console.log(`[DIAGNOSTIC] App: Fetched ${this.#allOnlineUsersData.length} users initially.`);

                if (this.#allOnlineUsersData.length > 0) {
                    if (this.#allOnlineUsersData[0]) { // Check if first element exists
                        console.log("[DIAGNOSTIC] Sample user object from fetch:", JSON.stringify(this.#allOnlineUsersData[0], null, 2));
                    }
                    this.#populateFilters(this.#allOnlineUsersData);
                    console.log("[DIAGNOSTIC] App: Calling #applyFiltersAndDisplay after fetch.");
                    this.#applyFiltersAndDisplay();
                    await this.#displayPreviousUsers();
                    this.#setDefaultIframes();
                } else {
                    console.log("[DIAGNOSTIC] App: No online users found or failed to fetch (initialData.users was empty or not an array).");
                    if (this.onlineUsersDiv) this.onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found or failed to fetch.</p>';
                    this.#populateFilters([]);
                    console.log("[DIAGNOSTIC] App: Calling #applyFiltersAndDisplay for empty dataset.");
                    this.#applyFiltersAndDisplay(); // Will show "No online users match filters"
                    await this.#displayPreviousUsers();
                }
            } catch (error) {
                console.error("[DIAGNOSTIC] Error in #fetchDataAndUpdateUI (App):", error);
                this.uiManager.showOnlineErrorDisplay(`Failed to fetch data: ${error.message}. Check console.`);
            } finally {
                this.uiManager.hideOnlineLoadingIndicator();
                console.log("[DIAGNOSTIC] App: #fetchDataAndUpdateUI execution finished.");
            }
        }

        async #showAutocompleteSuggestions(inputText, targetTextArea, suggestionsContainer) {
            if (!targetTextArea || !suggestionsContainer) {
                console.warn("Autocomplete target or suggestions container not found.");
                return;
            }
            if (!inputText || inputText.length < 2) { 
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
                return;
            }
            try {
                const allSnippets = await this.storageManager.loadAllTextSnippets();
                const filteredSnippets = allSnippets.filter(s => s.toLowerCase().includes(inputText.toLowerCase()));
                if (filteredSnippets.length === 0) {
                    suggestionsContainer.innerHTML = '';
                    suggestionsContainer.style.display = 'none';
                    return;
                }
                suggestionsContainer.innerHTML = '';
                filteredSnippets.forEach(snippet => {
                    const div = document.createElement('div');
                    div.textContent = snippet;
                    div.onclick = () => {
                        const currentText = targetTextArea.value;
                        const triggerPos = currentText.lastIndexOf('{{');
                        if (triggerPos !== -1) {
                            targetTextArea.value = currentText.substring(0, triggerPos) + snippet;
                        } else {
                            targetTextArea.value += snippet;
                        }
                        suggestionsContainer.innerHTML = '';
                        suggestionsContainer.style.display = 'none';
                        targetTextArea.focus();
                    };
                    suggestionsContainer.appendChild(div);
                });
                suggestionsContainer.style.display = 'block';
            } catch (error) {
                console.error("Error loading snippets for autocomplete:", error);
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
            }
        }

        #displaySnippetsList(snippetsArray) {
            if (!this.currentSnippetDisplay) return;
            this.currentSnippetDisplay.innerHTML = '';
            if (!snippetsArray || snippetsArray.length === 0) {
                this.currentSnippetDisplay.innerHTML = '<p>No snippets saved yet.</p>';
                return;
            }
            const fragment = document.createDocumentFragment();
            snippetsArray.forEach(snippetText => {
                const snippetElement = document.createElement('div');
                snippetElement.classList.add('snippet-item');
                const textNode = document.createTextNode(snippetText + " ");
                snippetElement.appendChild(textNode);
                snippetElement.addEventListener('click', (e) => {
                    if (e.target.tagName !== 'BUTTON') {
                        try {
                            // Target the first iframe in the dynamic container
                            const targetIframe = this.dynamicIframeContainer?.querySelector('iframe');
                            const targetIframeId = targetIframe ? targetIframe.id : 'N/A';

                            if (targetIframe && targetIframe.contentWindow) {
                                const iframeDoc = targetIframe.contentWindow.document;
                                let inputField = iframeDoc.querySelector('textarea');
                                if (!inputField) inputField = iframeDoc.querySelector('#chat_input');
                                if (!inputField) inputField = iframeDoc.querySelector('#input_text');
                                // if (!inputField) inputField = iframeDoc.querySelector('.chat-input-textarea'); // Example for class

                                if (inputField) {
                                    inputField.value = snippetText;
                                    // Optional: focus and dispatch input event
                                    // inputField.focus();
                                    // const inputEvent = new Event('input', { bubbles: true });
                                    // inputField.dispatchEvent(inputEvent);
                                    this.#showSnippetStatus(`Snippet inserted into ${selectedIframeId}!`, 'success');
                                } else {
                                    this.#showSnippetStatus('Could not find message input in the selected iframe.', 'error');
                                    console.warn('Message input field not found in iframe:', selectedIframeId, 'Attempting to copy to clipboard as fallback.');
                                    // Fallback to clipboard if input field not found
                                    navigator.clipboard.writeText(snippetText)
                                        .then(() => this.#showSnippetStatus('Snippet copied (input not found).', 'warning'))
                                        .catch(copyErr => {
                                            console.error('Fallback: Failed to copy snippet: ', copyErr);
                                            this.#showSnippetStatus('Failed to insert or copy snippet.', 'error');
                                        });
                                }
                            } else {
                                this.#showSnippetStatus('Selected iframe or its content window is not accessible.', 'error');
                                console.warn('Target iframe or contentWindow not accessible:', selectedIframeId, 'Attempting to copy to clipboard as fallback.');
                                // Fallback to clipboard if iframe not accessible
                                navigator.clipboard.writeText(snippetText)
                                    .then(() => this.#showSnippetStatus('Snippet copied (iframe not accessible).', 'warning'))
                                    .catch(copyErr => {
                                        console.error('Fallback: Failed to copy snippet: ', copyErr);
                                        this.#showSnippetStatus('Failed to insert or copy snippet.', 'error');
                                    });
                            }
                        } catch (err) {
                            console.error('Error inserting snippet into iframe:', err);
                            this.#showSnippetStatus('Error inserting snippet. Check console.', 'error');
                            // Fallback to clipboard for any other errors (e.g., cross-origin)
                            navigator.clipboard.writeText(snippetText)
                                .then(() => this.#showSnippetStatus('Snippet copied to clipboard (iframe insert failed).', 'warning'))
                                .catch(copyErr => {
                                    console.error('Failed to copy snippet as fallback: ', copyErr);
                                    this.#showSnippetStatus('Failed to insert snippet or copy to clipboard.', 'error');
                                });
                        }
                    }
                });
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.style.marginLeft = '10px';
                deleteButton.style.padding = '2px 5px';
                deleteButton.style.fontSize = '0.8em';
                deleteButton.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    if (confirm(`Are you sure you want to delete this snippet: "${snippetText}"?`)) {
                        try {
                            await this.storageManager.deleteTextSnippet(snippetText);
                            const updatedSnippets = await this.storageManager.loadAllTextSnippets();
                            this.#displaySnippetsList(updatedSnippets); 
                            this.#showSnippetStatus('Snippet deleted successfully!', 'success');
                        } catch (err) {
                            console.error("Error deleting snippet:", err);
                            this.#showSnippetStatus('Error deleting snippet.', 'error');
                        }
                    }
                });
                snippetElement.appendChild(deleteButton);
                fragment.appendChild(snippetElement);
            });
            this.currentSnippetDisplay.appendChild(fragment);
        }

        #setDefaultIframes() {
            // This method is refactored. It no longer directly sets iframe src attributes.
            // Instead, it should prepare a list of user URLs to be used by #updateIframes.
            // For now, it will just log and #updateIframes will use a default.
            // Later, this can be expanded to pick top users for the current number of iframes.
            console.log("App: #setDefaultIframes called. Logic to select users for iframes would go here.");
            if (!this.#allOnlineUsersData || this.#allOnlineUsersData.length === 0) {
                console.log("App: No online user data to select for iframes.");
                return []; // Return empty array or handle as needed
            }

            const femaleUsers = this.#allOnlineUsersData.filter(user => user.gender === 'f');
            femaleUsers.sort((a, b) => (b.num_viewers || 0) - (a.num_viewers || 0));

            const iframeUsers = [];
            // Example: Get up to 4 users for the iframes
            for (let i = 0; i < Math.min(femaleUsers.length, 4); i++) {
                iframeUsers.push(femaleUsers[i]);
            }
            console.log("App: Selected users for iframes (up to 4):", iframeUsers.map(u => u.username));

            // The actual setting of iframe sources will be handled by #updateIframes
            // #updateIframes could call this method to get the user data.
            return iframeUsers; // Or just their URLs
        }

        #populateFilters(users) {
            if (!this.filterTagsSelect || !this.filterAgeSelect) return;
            const tagFrequency = {};
            const ages = new Set();
            users.forEach(user => {
                if (user.tags && Array.isArray(user.tags)) {
                    user.tags.forEach(tag => {
                        if (typeof tag === 'string' && tag.trim() !== '') {
                            tagFrequency[tag.trim().toLowerCase()] = (tagFrequency[tag.trim().toLowerCase()] || 0) + 1;
                        }
                    });
                }
                if (user.age && typeof user.age === 'number' && user.age > 0) ages.add(user.age);
            });
            const sortedTags = Object.entries(tagFrequency).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,75).map(e=>e[0]);
            const selectedTagValues = Array.from(this.filterTagsSelect.selectedOptions).map(opt=>opt.value);
            this.filterTagsSelect.innerHTML = '<option value="">-- All Tags --</option>';
            sortedTags.forEach(tag=>{
                const isSelected = selectedTagValues.includes(tag);
                this.filterTagsSelect.add(new Option(`${tag.charAt(0).toUpperCase()+tag.slice(1)} (${tagFrequency[tag]})`,tag,false,isSelected));
            });
            const sortedAges = Array.from(ages).sort((a,b)=>a-b);
            const selectedAgeValues = Array.from(this.filterAgeSelect.selectedOptions).map(opt=>opt.value);
            this.filterAgeSelect.innerHTML='<option value="">-- All Ages --</option>';
            sortedAges.forEach(age=>{
                const isSelected = selectedAgeValues.includes(String(age));
                this.filterAgeSelect.add(new Option(String(age),String(age),false,isSelected));
            });
        }

        #applyFiltersAndDisplay(buttonFilters = {}) {
            let filterTags = [];
            if(buttonFilters.tag){filterTags=[buttonFilters.tag.toLowerCase()];if(this.filterTagsSelect)this.filterTagsSelect.value=buttonFilters.tag.toLowerCase()}
            else if(this.filterTagsSelect){filterTags=Array.from(this.filterTagsSelect.selectedOptions).map(o=>o.value.toLowerCase()).filter(t=>t!=='')}
            let filterAges=[];
            if(buttonFilters.age){filterAges=[parseInt(buttonFilters.age)];if(this.filterAgeSelect)this.filterAgeSelect.value=String(buttonFilters.age)}
            else if(this.filterAgeSelect){filterAges=Array.from(this.filterAgeSelect.selectedOptions).map(o=>parseInt(o.value)).filter(a=>!isNaN(a)&&a>0)}
            
            if (buttonFilters.birthdayBanner) {
                filterTags = [];
                filterAges = [];
            }

            this.#lastFilteredUsers = (this.#allOnlineUsersData || []).filter(u => { // Add guard for #allOnlineUsersData
                if(!u||!u.username)return false;
                const isPublic=u.current_show==='public';
                let hasTags=true;
                if(filterTags.length>0){
                    const userTagsLower=(u.tags&&Array.isArray(u.tags))?u.tags.map(t=>typeof t==='string'?t.toLowerCase():''):[];
                    hasTags = filterTags.some(fT => {
                        if (fT === 'deepthroat') {
                            return userTagsLower.includes('deepthroat') || userTagsLower.includes('blowjob');
                        } else if (fT === 'bigboobs') {
                            return userTagsLower.includes('bigboobs') || userTagsLower.includes('bigtits');
                        }
                        return userTagsLower.includes(fT);
                    });
                }
                let isAgeMatch=true;
                if(filterAges.length>0){isAgeMatch=(u.age&&typeof u.age==='number')?filterAges.includes(u.age):false}
                
                let matchesBirthdayFilter = true; 
                if (buttonFilters.birthdayBanner) {
                    matchesBirthdayFilter = this.#isBirthday(u.birthday); 
                }

                return isPublic && hasTags && isAgeMatch && matchesBirthdayFilter;
            });

            // Sort by age if an age filter is active
            if (filterAges.length > 0) {
                this.#lastFilteredUsers.sort((a, b) => {
                    // Ensure ages are numbers and handle cases where age might be missing
                    const ageA = typeof a.age === 'number' ? a.age : Infinity;
                    const ageB = typeof b.age === 'number' ? b.age : Infinity;
                    return ageA - ageB;
                });
            }
            this.#displayOnlineUsersList(this.#lastFilteredUsers); 
        }

        #displayOnlineUsersList(usersToDisplay) {
            console.log(`[DIAGNOSTIC] App: Starting #displayOnlineUsersList with ${usersToDisplay ? usersToDisplay.length : 'null/undefined'} users.`);
            if (!this.onlineUsersDiv) {
                console.error("[DIAGNOSTIC] App: #displayOnlineUsersList - onlineUsersDiv is null!");
                return;
            }

            console.log("[DIAGNOSTIC] App: Clearing onlineUsersDiv.innerHTML");
            this.onlineUsersDiv.innerHTML = ""; // Clear existing content

            if (!usersToDisplay || usersToDisplay.length === 0) { // Check usersToDisplay itself as well
                console.log("[DIAGNOSTIC] App: No users to display or usersToDisplay is empty. Setting message.");
                this.onlineUsersDiv.innerHTML = '<p class="text-muted w3-center" style="color: orange; border: 1px solid orange; padding: 10px;">[DIAGNOSTIC] No online users match filters (or usersToDisplay is empty).</p>';
                return;
            }

            console.log(`[DIAGNOSTIC] App: Preparing to display ${usersToDisplay.length} users.`);
            const fragment = document.createDocumentFragment();
            usersToDisplay.forEach((user, index) => {
                if (!user || !user.image_url || !user.username) {
                    console.warn(`[DIAGNOSTIC] App: Skipping user at index ${index} due to missing critical data (image_url or username). User:`, user);
                    return;
                }
                // console.log(`[DIAGNOSTIC] App: Creating element for user: ${user.username}`);
                const socialMedia = this.#extractSocialMedia(user.description); // Ensure this doesn't throw
                try {
                    const userElement = this.uiManager.createUserElement(
                        user,
                        'online',
                        this.#handleUserClick.bind(this),
                        this.#removeFromPreviousUsers.bind(this),
                        (username) => this.storageManager.getUserClickCount(username, this.#previousUsers),
                        this.#isBirthday.bind(this),
                        this.uiManager.showOnlineLoadingIndicator.bind(this.uiManager),
                        this.uiManager.hideOnlineLoadingIndicator.bind(this.uiManager),
                        this.#displayPreviousUsers.bind(this),
                        (birthdayStr, age) => this.#getDaysSinceOrUntil18thBirthday(birthdayStr, age),
                        socialMedia,
                        this.toggleUserCardPreview.bind(this)
                    );
                    fragment.appendChild(userElement);
                    if (this.#userListIntersectionObserver && userElement.dataset.username) {
                        this.#userListIntersectionObserver.observe(userElement);
                    }
                } catch (e) {
                    console.error(`[DIAGNOSTIC] Error creating user element for ${user.username}:`, e);
                }
            });

            console.log("[DIAGNOSTIC] App: Appending fragment to onlineUsersDiv. Fragment child count:", fragment.children.length);
            this.onlineUsersDiv.appendChild(fragment);
            console.log("[DIAGNOSTIC] App: #displayOnlineUsersList finished.");
        }

        async #appendOnlineUsersList(newUsers) {
            if (!this.onlineUsersDiv || newUsers.length === 0) {
                console.log("App: No new users to append or onlineUsersDiv not found.");
                return;
            }
            console.log(`App: Appending ${newUsers.length} new users to the list.`);
            const fragment = document.createDocumentFragment();
            newUsers.forEach(user => {
                if (!user || !user.image_url || !user.username) return;
                const socialMedia = this.#extractSocialMedia(user.description);
                const userElement = this.uiManager.createUserElement(
                    user, 
                    'online', 
                    this.#handleUserClick.bind(this), 
                    this.#removeFromPreviousUsers.bind(this), 
                    (username) => this.storageManager.getUserClickCount(username, this.#previousUsers), 
                    this.#isBirthday.bind(this), 
                    this.uiManager.showOnlineLoadingIndicator.bind(this.uiManager),
                    this.uiManager.hideOnlineLoadingIndicator.bind(this.uiManager),
                    this.#displayPreviousUsers.bind(this), 
                    (birthdayStr, age) => this.#getDaysSinceOrUntil18thBirthday(birthdayStr, age),
                    socialMedia, // Add the new socialMedia object here
                    this.toggleUserCardPreview.bind(this) // New callback
                );
                fragment.appendChild(userElement);
                if (this.#userListIntersectionObserver && userElement.dataset.username) {
                    this.#userListIntersectionObserver.observe(userElement);
                }
            });
            this.onlineUsersDiv.appendChild(fragment);
        }
        
        async #fetchMoreOnlineUsers() {
            if (this.#isLoadingOnlineUsers || !this.#hasMoreOnlineUsersToLoad) {
                console.log("App: Not fetching more users. isLoading:", this.#isLoadingOnlineUsers, "hasMore:", this.#hasMoreOnlineUsersToLoad);
                return;
            }

            console.log("App: Starting to fetch more online users...");
            this.#isLoadingOnlineUsers = true;
            // Optionally: Show a small loading indicator at the bottom of the list
            // e.g., this.uiManager.showMoreUsersLoadingIndicator(this.onlineUsersDiv);

            try {
                const nextPageData = await this.apiService.getOnlineRooms(this.#currentOnlineUsersOffset);
                
                if (nextPageData && nextPageData.users) {
                    console.log(`App: Fetched ${nextPageData.users.length} more users.`);
                    this.#allOnlineUsersData = this.#allOnlineUsersData.concat(nextPageData.users);
                    this.#currentOnlineUsersOffset = nextPageData.nextOffset;
                    this.#hasMoreOnlineUsersToLoad = nextPageData.hasMore;

                    // Retrieve current filters
                    let filterTags = [];
                    if (this.filterTagsSelect) {
                        filterTags = Array.from(this.filterTagsSelect.selectedOptions).map(o => o.value.toLowerCase()).filter(t => t !== '');
                    }
                    let filterAges = [];
                    if (this.filterAgeSelect) {
                        filterAges = Array.from(this.filterAgeSelect.selectedOptions).map(o => parseInt(o.value)).filter(a => !isNaN(a) && a > 0);
                    }

                    let usersToAppend = nextPageData.users;
                    // Apply filters if any are selected
                    if (filterTags.length > 0 || filterAges.length > 0) {
                        usersToAppend = nextPageData.users.filter(u => {
                            if (!u || !u.username) return false;
                            const isPublic = u.current_show === 'public';
                            let hasTags = true;
                            if (filterTags.length > 0) {
                                const userTagsLower = (u.tags && Array.isArray(u.tags)) ? u.tags.map(t => typeof t === 'string' ? t.toLowerCase() : '') : [];
                                hasTags = filterTags.some(fT => {
                                    if (fT === 'deepthroat') {
                                        return userTagsLower.includes('deepthroat') || userTagsLower.includes('blowjob');
                                    } else if (fT === 'bigboobs') {
                                        return userTagsLower.includes('bigboobs') || userTagsLower.includes('bigtits');
                                    }
                                    return userTagsLower.includes(fT);
                                });
                            }
                            let isAgeMatch = true;
                            if (filterAges.length > 0) {
                                isAgeMatch = (u.age && typeof u.age === 'number') ? filterAges.includes(u.age) : false;
                            }
                            return isPublic && hasTags && isAgeMatch;
                        });
                        console.log(`App: Filtered ${nextPageData.users.length} new users down to ${usersToAppend.length} before appending.`);
                    }

                    await this.#appendOnlineUsersList(usersToAppend);
                    
                    if (!this.#hasMoreOnlineUsersToLoad) {
                        console.log("App: No more online users to load.");
                        // Optionally: Display a "no more users" message.
                    }
                } else {
                    console.warn("App: Fetched no users or invalid data structure for next page.");
                    this.#hasMoreOnlineUsersToLoad = false; // Stop if data structure is invalid
                }
            } catch (error) {
                console.error("Error in #fetchMoreOnlineUsers (App):", error);
                this.uiManager.showOnlineErrorDisplay(`Failed to load more users: ${error.message}.`); // Or a more subtle indicator
                // Consider setting #hasMoreOnlineUsersToLoad = false to prevent retries on persistent errors
                // For now, we let it be so user can try scrolling again.
            } finally {
                this.#isLoadingOnlineUsers = false;
                // Optionally: Hide the small loading indicator
                // e.g., this.uiManager.hideMoreUsersLoadingIndicator(this.onlineUsersDiv);
                console.log("App: Finished fetching more online users. isLoading:", this.#isLoadingOnlineUsers, "hasMore:", this.#hasMoreOnlineUsersToLoad);
            }
        }

        async #displayPreviousUsers() {
            if (!this.previousUsersDiv) return;
            
            // a. Handle Concurrent Loads
            if (this.#isLoadingMorePreviousUsers && this.#previousUsersDisplayOffset > 0) {
                console.log("App: Already loading more previous users. Skipping.");
                return;
            }
            this.#isLoadingMorePreviousUsers = true;
            console.log("App: Starting #displayPreviousUsers. Offset:", this.#previousUsersDisplayOffset);

            let loadingMoreIndicatorAdded = false;
            const isSubsequentLoad = this.#previousUsersDisplayOffset > 0;

            if (isSubsequentLoad && this.previousUsersDiv.querySelector('.user-info')) {
                const loadingMoreEl = document.createElement('p');
                loadingMoreEl.textContent = 'Loading more history...';
                loadingMoreEl.className = 'loading-more-indicator text-muted w3-center';
                this.previousUsersDiv.appendChild(loadingMoreEl);
                loadingMoreIndicatorAdded = true;
            }

            try {
                // b. Initial Load Specifics
                if (this.#previousUsersDisplayOffset === 0) {
                    // Unobserve all previous elements before clearing
                    if (this.#userListIntersectionObserver && this.previousUsersDiv) {
                        this.previousUsersDiv.querySelectorAll('.user-info').forEach(el => this.#userListIntersectionObserver.unobserve(el));
                    }
                    this.previousUsersDiv.innerHTML = ''; // Clear only on initial load
                    this.#hasMorePreviousUsersToLoad = true; // Reset on initial load
                    if (this.#previousUsers.length === 0) {
                        console.log("App: Previous users array is empty, loading from storage.");
                        this.#previousUsers = await this.storageManager.loadUsers("previousUsers");
                    }
                }
                if (this.#previousUsers.length === 0) {
                    this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No viewing history.</p>';
                    this.#hasMorePreviousUsersToLoad = false;
                    this.#isLoadingMorePreviousUsers = false;
                    console.log("App: No viewing history found.");
                    return;
                }
            }

            // c. Check if More Previous Users to Process from the Array
            if (!this.#hasMorePreviousUsersToLoad && this.#previousUsersDisplayOffset > 0) {
                console.log("App: No more previous users in the source array to display (flag was false).");
                // Potentially add a "no more users" message if not already there and list is empty.
                if (this.previousUsersDiv.querySelectorAll('.user-info').length === 0) {
                    this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No more online users from your history to display.</p>';
                }
                this.#isLoadingMorePreviousUsers = false;
                return;
            }
            if (this.#previousUsersDisplayOffset >= this.#previousUsers.length) {
                console.log("App: All previous users from source array have been processed. Offset:", this.#previousUsersDisplayOffset, "Total:", this.#previousUsers.length);
                if (this.#previousUsersDisplayOffset > 0 && this.previousUsersDiv.querySelectorAll('.user-info').length === 0) {
                    this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No more online users from your history to display.</p>';
                } else if (this.#previousUsersDisplayOffset === 0 && this.#previousUsers.length > 0) {
                    this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">None of your saved users are currently online (from the first batch).</p>';
                } else if (this.previousUsersDiv.querySelectorAll('.user-info').length > 0 && this.#previousUsersDisplayOffset > 0) {
                    if (!this.previousUsersDiv.querySelector('.all-history-checked-message')) { // Check for specific class
                        const noMoreMsg = document.createElement('p');
                        noMoreMsg.className = 'text-muted w3-center w3-small all-history-checked-message'; // Use specific class
                        noMoreMsg.textContent = 'All history checked for online users.';
                        this.previousUsersDiv.appendChild(noMoreMsg);
                    }
                }
                this.#hasMorePreviousUsersToLoad = false;
                // this.#isLoadingMorePreviousUsers = false; // Moved to finally
                return; // Return here as all users from the array have been processed
            }

            // d. Determine Batch to Process
            const currentBatch = this.#previousUsers.slice(this.#previousUsersDisplayOffset, this.#previousUsersDisplayOffset + this.#previousUsersPageSize);
            console.log(`App: Processing batch of ${currentBatch.length} previous users. From offset ${this.#previousUsersDisplayOffset}`);
            
            // Advance offset by how many were sliced for the NEXT potential load.
            // This is done before filtering for online, as we've "consumed" this part of the #previousUsers array.
            this.#previousUsersDisplayOffset += currentBatch.length; 
            if (this.#previousUsersDisplayOffset >= this.#previousUsers.length) {
                 this.#hasMorePreviousUsersToLoad = false; 
                 console.log("App: Reached end of #previousUsers array.");
            }


            // e. Filter Batch for Online Status
            if (this.#allOnlineUsersData.length === 0 && this.#previousUsersDisplayOffset <= this.#previousUsersPageSize) {
                // Display a message only if it's the very first attempt to show previous users and online data isn't ready
                this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">History loaded. Fetching online status for users...</p>';
                this.#isLoadingMorePreviousUsers = false; // Allow #fetchDataAndUpdateUI to recall this method
                console.log("App: Online users data not yet available, will retry displayPreviousUsers later.");
                return;
            }
            const onlineUserMap = new Map(this.#allOnlineUsersData.map(u => [u.username, u]));
            const onlineUsersInBatch = currentBatch.filter(pU => onlineUserMap.get(pU.username)?.current_show === 'public');
            console.log(`App: Found ${onlineUsersInBatch.length} online users in the current batch.`);

            // f. Append to DOM
            if (onlineUsersInBatch.length === 0) {
                if (this.previousUsersDiv.querySelectorAll('.user-info').length === 0 && this.#previousUsersDisplayOffset <= this.#previousUsersPageSize) {
                    this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">None of your saved users from the first batch are online & public.</p>';
                } else {
                    console.log("App: No users from the current history batch are online.");
                    // If we want to try loading next batch automatically if this one was empty of online users:
                    if (this.#hasMorePreviousUsersToLoad) { 
                        console.log("App: Trying to display next batch of previous users as this one was empty of online users.");
                        // Before recursing, ensure loading indicator for current attempt is removed
                        if (loadingMoreIndicatorAdded) {
                            const existingLoadingMoreEl = this.previousUsersDiv.querySelector('.loading-more-indicator');
                            if (existingLoadingMoreEl) existingLoadingMoreEl.remove();
                            loadingMoreIndicatorAdded = false;
                        }
                        this.#isLoadingMorePreviousUsers = false; // Release lock for the recursive call
                        await this.#displayPreviousUsers(); // Recurse
                        return; // Important to return after recursion
                    } else if (this.previousUsersDiv.querySelectorAll('.user-info').length === 0) {
                        // No more to load and still nothing displayed
                        this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">None of your saved users are currently online.</p>';
                    }
                }
            } else {
                const fragment = document.createDocumentFragment();
                onlineUsersInBatch.forEach(user => {
                    if (!user || !user.image_url || !user.username) return;
                    const socialMedia = this.#extractSocialMedia(user.description);
                    const userElement = this.uiManager.createUserElement(
                        user, 
                        'previous', 
                        this.#handleUserClick.bind(this), 
                        this.#removeFromPreviousUsers.bind(this), 
                        (username) => this.storageManager.getUserClickCount(username, this.#previousUsers), 
                        this.#isBirthday.bind(this), 
                        this.uiManager.showOnlineLoadingIndicator.bind(this.uiManager), 
                        this.uiManager.hideOnlineLoadingIndicator.bind(this.uiManager), 
                        this.#displayPreviousUsers.bind(this),
                        (birthdayStr, age) => this.#getDaysSinceOrUntil18thBirthday(birthdayStr, age),
                        socialMedia, // Add the new socialMedia object here
                        this.toggleUserCardPreview.bind(this) // New callback
                    );
                    fragment.appendChild(userElement);
                    if (this.#userListIntersectionObserver && userElement.dataset.username) {
                        this.#userListIntersectionObserver.observe(userElement);
                    }
                });
                this.previousUsersDiv.appendChild(fragment);
            }
            
            // Remove initial "Loading history..." or other generic messages if users are now shown
            const loadingMsg = this.previousUsersDiv.querySelector('p.text-muted');
            if (loadingMsg && this.previousUsersDiv.querySelectorAll('.user-info').length > 0) {
                 if (loadingMsg.textContent.includes('Loading history...') || 
                     loadingMsg.textContent.includes('History loaded. Fetch online status for users...') ||
                     loadingMsg.textContent.includes('None of your saved users from the first batch are online & public.')) {
                    // Only remove if it's one of these specific messages and actual users are present
                    loadingMsg.remove();
                }
            }
            
            // g. Finalize (moved to finally block) and handle "All history checked" message
            if (!this.#hasMorePreviousUsersToLoad && this.previousUsersDiv.querySelector('.user-info')) {
                 // Ensure no other message is clobbering this one, and it's not already there
                const existingGenericMessage = this.previousUsersDiv.querySelector('p.text-muted:not(.all-history-checked-message)');
                if (!this.previousUsersDiv.querySelector('.all-history-checked-message') && !existingGenericMessage) {
                    const noMoreMsg = document.createElement('p');
                    noMoreMsg.className = 'text-muted w3-center w3-small all-history-checked-message';
                    noMoreMsg.textContent = 'All history checked for online users.';
                    this.previousUsersDiv.appendChild(noMoreMsg);
                }
            }
            console.log("App: About to finish #displayPreviousUsers. isLoading:", this.#isLoadingMorePreviousUsers, "hasMore:", this.#hasMorePreviousUsersToLoad, "nextOffset:", this.#previousUsersDisplayOffset);

        } finally {
            if (loadingMoreIndicatorAdded) {
                const existingLoadingMoreEl = this.previousUsersDiv.querySelector('.loading-more-indicator');
                if (existingLoadingMoreEl) existingLoadingMoreEl.remove();
            }
            this.#isLoadingMorePreviousUsers = false;
            console.log("App: Finally finished #displayPreviousUsers. isLoading:", this.#isLoadingMorePreviousUsers, "hasMore:", this.#hasMorePreviousUsersToLoad, "nextOffset:", this.#previousUsersDisplayOffset);
        }
        }

        #handleUserClick(user) {
            if (!this.dynamicIframeContainer || !user || !user.username) return;

            const firstIframe = this.dynamicIframeContainer.querySelector('iframe');

            if (firstIframe) {
                firstIframe.src = `https://chaturbate.com/embed/${user.username}/?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black`;
                // Optionally update the title if it was set to the username
                // firstIframe.title = user.username;
            } else {
                console.warn("App: No iframes found in dynamic container to update on user click.");
                // Fallback: maybe update all iframes or the first one created by #updateIframes
                // For now, if no iframe, do nothing.
            }

            this.storageManager.incrementUserClickCount(user.username, this.#previousUsers);
            this.#addToPreviousUsers(user).catch(console.error);
        }

        async #addToPreviousUsers(user) {
            if (!user || !user.username) return;
            const existingIndex = this.#previousUsers.findIndex(u => u.username === user.username);
            if (existingIndex !== -1) this.#previousUsers.splice(existingIndex, 1);
            this.#previousUsers.unshift(user);
            if (this.#previousUsers.length > maxHistorySize) this.#previousUsers.splice(maxHistorySize);
            try {
                await this.storageManager.saveUsers("previousUsers", this.#previousUsers);
            } catch (error) {
                console.error(`Failed to save previous users after adding ${user.username}:`, error);
            }
        }

        async #removeFromPreviousUsers(username) {
            if (!username) return;
            const initialCount = this.#previousUsers.length;
            this.#previousUsers = this.#previousUsers.filter(u => u.username !== username);
            if (this.#previousUsers.length < initialCount) {
                try {
                    await this.storageManager.saveUsers("previousUsers", this.#previousUsers);
                } catch (error) {
                    console.error(`Failed to save previous users after removing ${username}:`, error);
                }
            }
        }

        async #clearPreviousUsers() {
            if (!confirm("Are you sure you want to clear your entire viewing history?")) return;
            this.uiManager.showOnlineLoadingIndicator("Clearing history...");

            // Unobserve all elements in previousUsersDiv before clearing
            if (this.#userListIntersectionObserver && this.previousUsersDiv) {
                this.previousUsersDiv.querySelectorAll('.user-info').forEach(el => this.#userListIntersectionObserver.unobserve(el));
            }

            this.#previousUsers = [];
            try {
                await this.storageManager.saveUsers("previousUsers", []); 
                if (this.#storageType === "indexedClicked" || this.#storageType?.startsWith('IndexedDB:')) {
                    // This assumes saveUsers with an empty array effectively clears it
                }
                // #displayPreviousUsers will be called and it will handle the empty state
                // by setting innerHTML to "No viewing history." and not adding any new observers.
                this.#previousUsersDisplayOffset = 0; // Reset offset for displayPreviousUsers
                await this.#displayPreviousUsers();
            } catch (error) {
                console.error("Error clearing previous users history:", error);
            } finally {
                this.uiManager.hideOnlineLoadingIndicator();
            }
        }

        async #sendReport() {
            if (!REPORT_SERVER_ENDPOINT || REPORT_SERVER_ENDPOINT === '/api/send-user-report') {
                this.uiManager.showReportStatus("Report feature disabled: Server endpoint not configured.", 'error'); return;
            }
            if (!this.#lastFilteredUsers || this.#lastFilteredUsers.length === 0) {
                this.uiManager.showReportStatus("No users to report.", 'warning'); return;
            }
            this.uiManager.showReportLoading(`Sending report for ${this.#lastFilteredUsers.length} users...`);
            const reportData=this.#lastFilteredUsers.map(u=>({username:u.username,age:u.age,tags:u.tags,is_new:u.is_new,num_viewers:u.num_viewers}));
            try{
                const c=new AbortController();setTimeout(()=>c.abort(),reportSendTimeout);
                const r=await fetch(REPORT_SERVER_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reportData),signal:c.signal});
                if(!r.ok){let eB=`Server responded: ${r.status}`;try{const eJ=await r.json();eB=eJ.message||eJ.error||JSON.stringify(eJ)}catch(e){try{eB=await r.text()}catch(e2){}}throw new Error(eB.substring(0,100)+"...")}
                const res=await r.json();
                if(res&&(res.status==='success'||r.status===200||r.status===201)){this.uiManager.showReportStatus(res.message||"Report sent!","success")}
                else{this.uiManager.showReportStatus(`Report failed: ${res.message||res.error||'Unknown response.'}`,'error')}
            }catch(e){if(e.name==='AbortError'){this.uiManager.showReportStatus("Report timed out.","error")}else{this.uiManager.showReportStatus(`Failed to send: ${e.message}`,'error')}}
            finally{this.uiManager.hideReportLoading()}
        }

        #validateDOMReferences() {
            const criticalElementsMap = {
                "onlineUsersDiv": this.onlineUsersDiv,
                "previousUsersDiv": this.previousUsersDiv,
                "dynamicIframeContainer": this.dynamicIframeContainer, // New
                "iframeCountSelector": this.iframeCountSelector,   // New
                "storageTypeSelector": this.storageTypeSelector,
                "filterTagsSelect": this.filterTagsSelect,
                "filterAgeSelect": this.filterAgeSelect
            };

            const missing = Object.keys(criticalElementsMap).filter(key => !criticalElementsMap[key]);

            if (missing.length > 0) {
                const missingStr = missing.join(', ');
                console.error(`CRITICAL ERROR: Missing essential DOM elements: ${missingStr}. App might not function.`);
                // Attempt to show error via UIManager if available, otherwise alert.
                if (this.uiManager && typeof this.uiManager.showOnlineErrorDisplay === 'function') {
                    this.uiManager.showOnlineErrorDisplay(`Initialization failed: Missing elements (${missingStr}).`);
                } else {
                    alert(`CRITICAL ERROR: Missing essential DOM elements: ${missingStr}. App might not function. Check console.`);
                }
                return false;
            }
            return true;
        }

        #setupEventListeners() {
            this.storageTypeSelector?.addEventListener("change", async (event) => {
                const newStorageType = event.target.value;
                if (newStorageType !== this.#storageType) {
                    this.#storageType = newStorageType;
                    window.storageType = newStorageType; 
                    this.uiManager.showOnlineLoadingIndicator("Loading history from new source...");
                    this.#previousUsers = await this.storageManager.loadUsers("previousUsers");
                    await this.#displayPreviousUsers();
                    this.uiManager.hideOnlineLoadingIndicator();
                }
            });

            if (this.globalUserCardIframeToggleRadios) {
                this.globalUserCardIframeToggleRadios.forEach(radio => {
                    radio.addEventListener('change', (event) => {
                        this.userCardPreviewMode = event.target.value;
                        console.log(`App: User card preview mode changed to: ${this.userCardPreviewMode}`);
                        if (this.userCardPreviewMode === 'image') {
                            this.#revertAllCardPreviewsToImage();
                        } else {
                            // When switching to 'iframe-in-view', trigger a check for currently visible items.
                            this.#checkVisibleUserCardsForPreviewUpdate();
                        }
                    });
                });
            }

            this.iframeCountSelector?.addEventListener("change", (event) => {
                const count = parseInt(event.target.value);
                if (!isNaN(count)) {
                    this.#updateIframes(count);
                }
            });

            this.filterTagsSelect?.addEventListener("change", () => this.#applyFiltersAndDisplay());
            this.filterAgeSelect?.addEventListener("change", () => this.#applyFiltersAndDisplay());
            document.getElementById("filterAge18")?.addEventListener("click", () => this.#applyFiltersAndDisplay({ age: 18 }));
            document.getElementById("filterTagAsian")?.addEventListener("click", () => this.#applyFiltersAndDisplay({ tag: 'asian' }));
            document.getElementById("filterTagBlonde")?.addEventListener("click", () => this.#applyFiltersAndDisplay({ tag: 'blonde' }));
            document.getElementById("filterTagDeepthroat")?.addEventListener("click", () => this.#applyFiltersAndDisplay({ tag: 'deepthroat' }));
            document.getElementById("filterTagBigboobs")?.addEventListener("click", () => this.#applyFiltersAndDisplay({ tag: 'bigboobs' }));
            
            if (this.filterBirthdayBannerButton) {
                this.filterBirthdayBannerButton.addEventListener('click', () => {
                    if (this.filterTagsSelect) this.filterTagsSelect.value = "";
                    if (this.filterAgeSelect) this.filterAgeSelect.value = "";
                    this.#applyFiltersAndDisplay({ birthdayBanner: true });
                });
            }

            document.getElementById("clearPreviousUsers")?.addEventListener("click", this.#clearPreviousUsers.bind(this));
            this.sendReportButton?.addEventListener("click", this.#sendReport.bind(this));

            if (this.saveSnippetButton && this.newSnippetInput && this.currentSnippetDisplay) {
                this.saveSnippetButton.addEventListener('click', async () => {
                    const snippetText = this.newSnippetInput.value.trim();
                    if (snippetText === '') { this.#showSnippetStatus('Snippet cannot be empty.', 'error'); return; }
                    try {
                        await this.storageManager.addTextSnippet(snippetText);
                        const updatedSnippets = await this.storageManager.loadAllTextSnippets();
                        this.#displaySnippetsList(updatedSnippets);
                        this.newSnippetInput.value = '';
                        this.#showSnippetStatus('Snippet added successfully!', 'success');
                    } catch (err) { this.#showSnippetStatus('Error adding snippet.', 'error'); }
                });
            }

            if (this.mainTextArea && this.autocompleteSuggestionsContainer) {
                this.mainTextArea.addEventListener('input', (e) => {
                    const text = e.target.value; const triggerPos = text.lastIndexOf('{{');
                    if (triggerPos !== -1) {
                        const query = text.substring(triggerPos + 2);
                        const rect = this.mainTextArea.getBoundingClientRect();
                        this.autocompleteSuggestionsContainer.style.left = `${rect.left}px`;
                        this.autocompleteSuggestionsContainer.style.top = `${rect.bottom}px`;
                        this.autocompleteSuggestionsContainer.style.width = `${rect.width}px`;
                        this.#showAutocompleteSuggestions(query, this.mainTextArea, this.autocompleteSuggestionsContainer);
                    } else { this.autocompleteSuggestionsContainer.style.display = 'none'; }
                });
                this.mainTextArea.addEventListener('blur', () => {
                    setTimeout(() => { if (this.autocompleteSuggestionsContainer) this.autocompleteSuggestionsContainer.style.display = 'none'; }, 150);
                });
            }
            
            if (this.bigTipperPopupButton && this.bigTipperAppModal && this.closeBigTipperAppModal && this.bigTipperAppIframe) {
                this.bigTipperPopupButton.addEventListener('click', () => {
                    this.bigTipperAppIframe.src = 'https://chaturbate.com/app/a78a1e8e-Big-Tipper/';
                    this.bigTipperAppModal.style.display = 'block';
                });
                this.closeBigTipperAppModal.addEventListener('click', () => {
                    this.bigTipperAppModal.style.display = 'none'; this.bigTipperAppIframe.src = 'about:blank';
                });
                window.addEventListener('click', (event) => {
                    if (event.target === this.bigTipperAppModal) {
                        this.bigTipperAppModal.style.display = 'none'; this.bigTipperAppIframe.src = 'about:blank';
                    }
                });
            }
            
            if (this.copyJsErrorsButton) {
                this.copyJsErrorsButton.addEventListener('click', async () => {
                    if(collectedJsErrors.length===0){this.#showSnippetStatus('No JS errors collected.','info');return}
                    let errStr="Collected JS Errors:\n\n";collectedJsErrors.forEach(e=>{errStr+=`T: ${e.timestamp}\nM: ${e.message}\nS: ${e.source}\nL: ${e.lineno}, C: ${e.colno}\nStack: ${e.error}\n----\n`});
                    try{await navigator.clipboard.writeText(errStr);this.#showSnippetStatus('JS errors copied!','success')}catch(e){this.#showSnippetStatus('Failed to copy JS errors.','error')}
                });
            }
            if (typeof $ !== 'undefined') {
                const $toggleButton = $('#toggleControlsButton');
                const $sectionsToToggle = $('#controlsBarContainer, #snippetManagerContainer, #mainTextAreaContainer');

                $toggleButton.on('click', () => {
                    $sectionsToToggle.slideToggle(function() { 
                        if ($('#controlsBarContainer').is(':visible')) {
                            $toggleButton.text('Hide All Controls & Forms');
                        } else {
                            $toggleButton.text('Show All Controls & Forms');
                        }
                    });
                });
                // Initial button text
                if (!$('#controlsBarContainer').is(':visible')) { // This checks visibility based on current state which includes inline styles
                    $toggleButton.text('Show All Controls & Forms');
                } else {
                     $toggleButton.text('Hide All Controls & Forms');
                }
            } else {
                console.error('jQuery is not loaded. Some UI features might not work.');
                const toggleBtn = document.getElementById('toggleControlsButton');
                const controlsBar = document.getElementById('controlsBarContainer');
                const snippetManager = document.getElementById('snippetManagerContainer');
                const mainTextArea = document.getElementById('mainTextAreaContainer');

                if (toggleBtn && controlsBar && snippetManager && mainTextArea) {
                    const toggleAllSections = () => {
                        // Check visibility of controlsBar, assuming all sections are toggled together
                        const isHidden = controlsBar.style.display === 'none' || controlsBar.style.display === '';
                        
                        controlsBar.style.display = isHidden ? 'flex' : 'none';
                        snippetManager.style.display = isHidden ? 'block' : 'none'; 
                        mainTextArea.style.display = isHidden ? 'block' : 'none'; 
                        
                        toggleBtn.textContent = isHidden ? 'Hide All Controls & Forms' : 'Show All Controls & Forms';
                    };

                    toggleBtn.addEventListener('click', toggleAllSections);

                    // Set initial button text
                    // Check initial display style from HTML (which is 'none' for all)
                    if (controlsBar.style.display === 'none' || controlsBar.style.display === '') {
                        toggleBtn.textContent = 'Show All Controls & Forms';
                    } else {
                        toggleBtn.textContent = 'Hide All Controls & Forms';
                    }
                }
            }

            // Listen for window resize events to adjust layout
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    this.#adjustLayoutHeights();
                }, 100); // Debounce resize event
            });

            // Infinite scroll for online users list
            if (this.onlineUsersDiv) {
                let scrollTimeout;
                this.onlineUsersDiv.addEventListener('scroll', () => {
                    clearTimeout(scrollTimeout);
                    scrollTimeout = setTimeout(() => {
                        const element = this.onlineUsersDiv;
                        const threshold = 100; // Pixels from bottom to trigger
                        
                        // Check if scrolled to near the bottom and if we should fetch more
                        if (this.#hasMoreOnlineUsersToLoad && !this.#isLoadingOnlineUsers) {
                            if (element.scrollHeight - element.scrollTop - element.clientHeight < threshold) {
                                console.log('App: Scrolled near bottom of online users list. Fetching more...');
                                this.#fetchMoreOnlineUsers();
                            }
                        }
                    }, 150); // Debounce delay of 150ms
                });
            }

            // Infinite scroll for previous users list
            if (this.previousUsersDiv) {
                let previousUsersScrollTimeout;
                this.previousUsersDiv.addEventListener('scroll', () => {
                    clearTimeout(previousUsersScrollTimeout);
                    previousUsersScrollTimeout = setTimeout(() => {
                        // Ensure 'this' correctly references the App instance
                        const appInstance = this; 
                        const element = appInstance.previousUsersDiv;
                        const threshold = 100; 

                        if (appInstance.#hasMorePreviousUsersToLoad && !appInstance.#isLoadingMorePreviousUsers) {
                            if (element.scrollHeight - element.scrollTop - element.clientHeight < threshold) {
                                console.log('App: Scrolled near bottom of previous users list. Loading more...');
                                appInstance.#displayPreviousUsers(); // Call the updated method
                            }
                        }
                    }, 150); // Debounce delay of 150ms
                });
            }
        }

        async start() { 
            console.log("App: Initializing application...");
            if (!this.#validateDOMReferences()) return; 
            
            await this.storageManager.init().catch(error => {
                console.error("StorageManager initialization failed during App.start:", error);
                this.uiManager.showOnlineErrorDisplay("Critical error: Failed to initialize storage. Application may not function correctly.");
                throw error; 
            });

            await this.storageManager.populateStorageOptions();
            this.#storageType = window.storageType; 

            this.#setupEventListeners(); 
            
            if (this.currentSnippetDisplay) {
                this.storageManager.loadAllTextSnippets()
                    .then(snippets => this.#displaySnippetsList(snippets)) 
                    .catch(err => {
                        console.error("Error loading initial snippets:", err);
                        this.currentSnippetDisplay.innerHTML = '<p>Error loading snippets.</p>';
                        this.#showSnippetStatus('Error loading snippets.', 'error'); 
                    });
            }
            
            this.uiManager.showOnlineLoadingIndicator("Loading initial history...");
            this.#previousUsers = await this.storageManager.loadUsers("previousUsers");
            console.log(`Initial load: Found ${this.#previousUsers.length} users in history.`);

            // Add this block after storageManager.init and loadUsers
            if (this.storageManager && this.storageManager.isIndexedDBFailed) { // Check the getter
                this.uiManager.showOnlineErrorDisplay(
                    "Main database failed to load. Your browsing history and some settings might not be saved reliably. Using temporary storage. If issues persist, try clearing site data or using a different browser.",
                    true // Pass true to indicate it's a warning
                );
            }
            
            await this.#fetchDataAndUpdateUI(); 
            
            this.#startFetchInterval(); 

            if (typeof window.initializeAllUsers === 'function') window.initializeAllUsers();
            window.initializeAllUsersFromScriptJS = (cb) => { if(typeof cb==='function')cb() };
            
            this.#adjustLayoutHeights(); // Adjust heights after initial load
            this.#updateIframes(parseInt(this.iframeCountSelector?.value || '1')); // Initialize iframes
            this.#initializeIntersectionObserver(); // New

            console.log("App: Initialization complete and periodic fetching started.");
            this.uiManager.hideOnlineLoadingIndicator();
        }

        #initializeIntersectionObserver() {
            const observerOptions = {
                root: null, // Use the viewport as the root
                rootMargin: '0px 0px 50px 0px', // Trigger a bit before it's fully in view (bottom margin)
                threshold: 0.01 // Trigger if even 1% is visible
            };

            const observerCallback = (entries, observer) => {
                if (this.userCardPreviewMode !== 'iframe-in-view') {
                    return; // Do nothing if not in the correct mode
                }

                // Basic scroll speed detection (can be refined)
                // If many entries change rapidly, assume fast scroll.
                // This is a very rough heuristic. A proper implementation would track scroll events.
                if (entries.length > 10 && entries.every(e => e.isIntersecting !== (e.target.dataset.previewState === 'iframe'))) { // Heuristic for many changes
                    this.#isScrollingFast = true;
                    clearTimeout(this.#scrollCheckTimeout);
                    this.#scrollCheckTimeout = setTimeout(() => this.#isScrollingFast = false, 300); // Reset after a pause
                }

                if (this.#isScrollingFast) {
                    console.log("App: Fast scroll detected, pausing iframe conversion.");
                    return;
                }

                entries.forEach(entry => {
                    const userElement = entry.target;
                    const username = userElement.dataset.username;
                    if (!username) return;

                    if (entry.isIntersecting) {
                        // console.log(`App IO: ${username} is intersecting. Current state: ${userElement.dataset.previewState}`);
                        if (userElement.dataset.previewState !== 'iframe') {
                           this.toggleUserCardPreview(userElement, username, 'iframe');
                        }
                    } else {
                        // console.log(`App IO: ${username} is NOT intersecting. Current state: ${userElement.dataset.previewState}`);
                        if (userElement.dataset.previewState === 'iframe') {
                           this.toggleUserCardPreview(userElement, username, 'image');
                        }
                    }
                });
            };

            this.#userListIntersectionObserver = new IntersectionObserver(observerCallback, observerOptions);
            console.log("App: IntersectionObserver initialized.");
        }

        #updateIframes(count) {
            if (!this.dynamicIframeContainer) return;

            console.log(`App: Updating iframes to ${count}`);
            this.dynamicIframeContainer.innerHTML = ''; // Clear existing iframes
            this.dynamicIframeContainer.dataset.count = count; // For CSS styling

            const defaultSrc = "https://cbxyz.com/in/?tour=dU9X&campaign=9cg6A&track=embed&signup_notice=1&disable_sound=1&mobileRedirect=never";
            const selectedUsers = this.#setDefaultIframes(); // Get user data

            for (let i = 0; i < count; i++) {
                const iframe = document.createElement('iframe');
                iframe.id = `dynamicIframe-${i}`;

                let userSrc = defaultSrc;
                let userTitle = `Viewer ${i + 1}`;

                if (selectedUsers && selectedUsers[i] && selectedUsers[i].username) {
                    userSrc = `https://chaturbate.com/embed/${selectedUsers[i].username}/?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black`;
                    userTitle = selectedUsers[i].username;
                }

                iframe.src = userSrc;
                iframe.title = userTitle;
                iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
                iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
                this.dynamicIframeContainer.appendChild(iframe);
            }
            this.#adjustLayoutHeights(); // Re-adjust layout after adding iframes
        }

        #startFetchInterval() {
            if (this.#fetchInterval) clearInterval(this.#fetchInterval); 
            this.#fetchInterval = setInterval(async () => { 
                await this.#fetchDataAndUpdateUI(); 
            }, fetchIntervalDuration); 
        }

        #adjustLayoutHeights() {
            console.log('App: Adjusting layout heights for .user-list elements...');
            const iframeColumn = document.querySelector('.iframe-column');
            if (!iframeColumn) {
                console.warn('App: CRITICAL - IFrame column not found for height adjustment. Exiting height adjustment.');
                return;
            }

            const iframeColumnTotalHeight = iframeColumn.offsetHeight;
            console.log(`App: iframeColumn.offsetHeight = ${iframeColumnTotalHeight}px`);

            if (iframeColumnTotalHeight < 100) { // Threshold for iframe column height
                console.warn(`App: iframeColumnTotalHeight is ${iframeColumnTotalHeight}px, which is less than 100px. This might lead to very small user list heights.`);
            }

            // If iframeColumnTotalHeight is 0 or negative, it might be too early in rendering or display:none.
            // In this case, applying any height to user-lists might be futile or hide them.
            // The original code already had a check for iframeColumnTotalHeight <= 0 to return, which is good.
            // Let's ensure that check remains effective.
            if (iframeColumnTotalHeight <= 0) {
                console.warn('App: iframeColumnTotalHeight is 0 or less. Cannot perform height adjustments for user lists. User lists might not be scrollable or visible.');
                // Optionally, apply a default fixed height to user lists here if iframe column is not expected to be hidden.
                // For now, we'll rely on the existing return for this specific case.
                return;
            }

            const userColumns = document.querySelectorAll('.user-column');
            userColumns.forEach(userColumn => {
                const columnId = userColumn.id || 'N/A';
                console.log(`App: Processing column: ${columnId}`);

                userColumn.style.removeProperty('max-height');
                userColumn.style.removeProperty('overflow');

                let h2TotalHeight = 0;
                const h2Element = userColumn.querySelector('h2');
                if (h2Element) {
                    const h2Styles = window.getComputedStyle(h2Element);
                    h2TotalHeight = h2Element.offsetHeight + parseFloat(h2Styles.marginTop) + parseFloat(h2Styles.marginBottom);
                } else {
                    console.log(`App: No h2 element found in column: ${columnId}`);
                }
                console.log(`App: [${columnId}] h2TotalHeight (incl. margins) = ${h2TotalHeight}px`);

                const userColumnStyles = window.getComputedStyle(userColumn);
                const userColumnVerticalPadding = parseFloat(userColumnStyles.paddingTop) + parseFloat(userColumnStyles.paddingBottom);
                console.log(`App: [${columnId}] userColumnVerticalPadding = ${userColumnVerticalPadding}px`);

                let additionalElementsHeight = 0;
                if (userColumn.id === 'previousUsers') {
                    const clearButton = userColumn.querySelector('#clearPreviousUsers');
                    if (clearButton) {
                        const buttonStyles = window.getComputedStyle(clearButton);
                        additionalElementsHeight = clearButton.offsetHeight + parseFloat(buttonStyles.marginTop) + parseFloat(buttonStyles.marginBottom);
                        console.log(`App: [${columnId}] clearButton height (incl. margins) = ${additionalElementsHeight}px`);
                    } else {
                        console.log(`App: [${columnId}] Clear history button not found.`);
                    }
                }

                const userListElement = userColumn.querySelector('.user-list');
                if (userListElement) {
                    const calculatedListMaxHeight = iframeColumnTotalHeight - h2TotalHeight - additionalElementsHeight - userColumnVerticalPadding;
                    console.log(`App: [${columnId}] Calculated listMaxHeight = ${iframeColumnTotalHeight} (iframe) - ${h2TotalHeight} (h2) - ${additionalElementsHeight} (other) - ${userColumnVerticalPadding} (padding) = ${calculatedListMaxHeight}px`);

                    const minSensibleHeight = 100; // Minimum sensible calculated height before fallback
                    const fallbackHeightString = '40vh'; // Fallback max-height

                    if (calculatedListMaxHeight < minSensibleHeight) {
                        console.warn(`App: [${columnId}] Calculated listMaxHeight (${calculatedListMaxHeight}px) is less than ${minSensibleHeight}px. APPLYING FALLBACK max-height: ${fallbackHeightString}.`);
                        userListElement.style.maxHeight = fallbackHeightString;
                    } else {
                        userListElement.style.maxHeight = calculatedListMaxHeight + 'px';
                        console.log(`App: [${columnId}] APPLIED CALCULATED max-height: ${calculatedListMaxHeight}px to .user-list.`);
                    }
                } else {
                    console.warn(`App: [${columnId}] .user-list element not found.`);
                }
            });
        }

        toggleUserCardPreview(userElement, username, forceState = null) {
            if (!userElement || !username) return;
            if (!userElement.imageContainerEl || !userElement.imageEl) {
                console.warn("User element is missing imageContainerEl or imageEl references", userElement);
                return;
            }

            const container = userElement.imageContainerEl;
            let currentState = container.classList.contains('iframe-active') ? 'iframe' : 'image';
            let newState = forceState;

            if (!newState) { // If not forcing a state, toggle
                newState = (currentState === 'image') ? 'iframe' : 'image';
            }

            if (newState === currentState && forceState !== null) { // No change needed if forcing to current state
                // However, if forceState is null (toggle) and newState === currentState, something is wrong or it's a first-time setup.
                // For toggling, newState will always be different from currentState.
            }

            console.log(`App: Toggling user card preview for ${username}. Current: ${currentState}, Target: ${newState}`);

            if (newState === 'iframe') {
                if (currentState === 'image' || !userElement.iframeEl) { // Only create/setup if not already iframe
                    if (!userElement.iframeEl) {
                        userElement.iframeEl = document.createElement('iframe');
                        userElement.iframeEl.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
                        userElement.iframeEl.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
                        // CSS already handles visibility:hidden initially, and width/height 100%
                        container.appendChild(userElement.iframeEl);
                    }
                    // Set src only when intending to show, to prevent loading all iframes upfront
                    userElement.iframeEl.src = `https://chaturbate.com/embed/${username}/?tour=dU9X&campaign=9cg6A&disable_sound=1&mobileRedirect=never&bgcolor=black`;
                    userElement.iframeEl.title = `${username} preview`;
                }
                container.classList.add('iframe-active');
                userElement.dataset.previewState = 'iframe';
            } else { // newState === 'image'
                if (userElement.iframeEl) {
                    userElement.iframeEl.src = 'about:blank'; // Stop loading, free resources
                    // Optionally, remove the iframe after a short delay or keep it for reuse
                    // For simplicity now, keep it but hidden. CSS handles visibility.
                }
                container.classList.remove('iframe-active');
                userElement.dataset.previewState = 'image';
            }
        }

        #revertAllCardPreviewsToImage() {
            console.log("App: Reverting all active card previews to images.");
            const activePreviews = document.querySelectorAll('.user-image-container.iframe-active');
            activePreviews.forEach(container => {
                const userElement = container.closest('.user-info'); // Assuming .user-info is the main card element
                if (userElement && userElement.dataset.username) {
                    this.toggleUserCardPreview(userElement, userElement.dataset.username, 'image');
                }
            });
            // Also ensure IntersectionObserver stops trying to convert them if mode changed.
            // (This is handled by the mode check in observer callback)
        }

        #checkVisibleUserCardsForPreviewUpdate() {
            // This method will be primarily driven by the IntersectionObserver.
            // However, it can be called manually to process currently visible items if needed.
            console.log("App: Checking visible user cards for preview update (IntersectionObserver will handle ongoing).");
            // For initial implementation, we rely on IntersectionObserver to trigger for currently visible items
            // when it's initialized or when the mode changes.
            // Manually iterating and checking visibility here can be complex and less performant than IO.
            // If IO is setup correctly, it should handle elements already in view upon activation.
            if (this.userCardPreviewMode === 'iframe-in-view') {
                // Force re-evaluation of observed items, though IO should do this.
                // This might involve iterating through all observed elements and checking their current intersection status
                // if the observer doesn't automatically re-trigger on mode change.
                // For now, assume IO handles initial visible set.
                if (this.#userListIntersectionObserver) {
                    // Re-observe all currently displayed user cards to trigger updates
                    const allUserCards = [
                        ...(this.onlineUsersDiv?.querySelectorAll('.user-info') || []),
                        ...(this.previousUsersDiv?.querySelectorAll('.user-info') || [])
                    ];
                    allUserCards.forEach(card => {
                        // Temporarily unobserve and reobserve to force a check if observer is already active
                        // This is a bit of a heavy-handed way to force re-check.
                        // A more refined approach might be needed if IO doesn't auto-trigger.
                        // this.#userListIntersectionObserver.unobserve(card);
                        // this.#userListIntersectionObserver.observe(card);
                        // Better: just let the IO do its job. If an item is visible, it should be processed.
                    });
                    console.log("App: IntersectionObserver is active, it will handle visible cards.");
                }
            }
        }

    } // End App Class

    // DOMContentLoaded Listener
    document.addEventListener('DOMContentLoaded', () => {
            const app = new App(); // Correct placement
        app.start().catch(error => {
            console.error("Unhandled error during app startup:", error);
            const body = document.body;
            if (body) {
                 let errorDiv = document.getElementById('appFatalError');
                 if (!errorDiv) {
                     errorDiv = document.createElement('div');
                     errorDiv.id = 'appFatalError';
                     errorDiv.style.cssText = "color: red; background-color: #ffe0e0; border: 1px solid red; padding: 10px; margin: 10px; position: fixed; top: 0; left: 0; right: 0; z-index: 9999;";
                     body.prepend(errorDiv);
                 }
                 errorDiv.textContent = "A critical error occurred during application startup. Please try refreshing the page. Details in console.";
            }
        });
    });

})();
