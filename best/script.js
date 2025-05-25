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

        // DOM References (kept public for now, could be refactored later)
        onlineUsersDiv;
        previousUsersDiv;
        mainIframe;
        mainIframe2;
        storageTypeSelector;
        filterTagsSelect;
        filterAgeSelect;
        sendReportButton;
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
        #initialIframesSet = false;
        
        constructor() {
            // Instantiate services and managers
            // Config variables (apiUrlBase, etc.) are globally available from config.js
            this.apiService = new ApiService(apiUrlBase, apiLimit, maxApiFetchLimit, apiFetchTimeout);
            this.uiManager = new UIManager();
            this.storageManager = new StorageManager(); 

            // DOM References
            this.onlineUsersDiv = document.getElementById("onlineUsers")?.querySelector('.user-list');
            this.previousUsersDiv = document.getElementById("previousUsers")?.querySelector('.user-list');
            this.mainIframe = document.getElementById("mainIframe");
            this.mainIframe2 = document.getElementById("mainIframe2");
            this.storageTypeSelector = document.getElementById("storageType");
            this.filterTagsSelect = document.getElementById("filterTags");
            this.filterAgeSelect = document.getElementById("filterAge");
            this.sendReportButton = document.getElementById("sendReportButton");
            
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
            console.log("App: Executing fetchDataAndUpdateUI...");
            this.uiManager.showOnlineLoadingIndicator("Loading online users...");
            this.uiManager.clearOnlineErrorDisplay();

            try {
                const fetchedUsers = await this.apiService.getOnlineRooms();
                this.#allOnlineUsersData = fetchedUsers;
                this.#lastFilteredUsers = [];

                if (this.#allOnlineUsersData.length > 0) {
                    this.#populateFilters(this.#allOnlineUsersData);
                    this.#applyFiltersAndDisplay();
                    await this.#displayPreviousUsers();
                    if (!this.#initialIframesSet) {
                        this.#setDefaultIframes();
                    }
                } else {
                    if (this.onlineUsersDiv) this.onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found or failed to fetch.</p>';
                    this.#populateFilters([]);
                    this.#applyFiltersAndDisplay();
                    await this.#displayPreviousUsers();
                }
            } catch (error) {
                console.error("Error in fetchDataAndUpdateUI (App):", error);
                this.uiManager.showOnlineErrorDisplay(`Failed to fetch data: ${error.message}. Check console.`);
            } finally {
                this.uiManager.hideOnlineLoadingIndicator();
                console.log("App: fetchDataAndUpdateUI execution finished.");
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
                        navigator.clipboard.writeText(snippetText)
                            .then(() => this.#showSnippetStatus('Snippet copied to clipboard!', 'success'))
                            .catch(err => {
                                console.error('Failed to copy snippet: ', err);
                                this.#showSnippetStatus('Failed to copy snippet.', 'error');
                            });
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
            if (this.#initialIframesSet || !this.#allOnlineUsersData || this.#allOnlineUsersData.length === 0) return;
            const femaleUsers = this.#allOnlineUsersData.filter(user => user.gender === 'f');
            femaleUsers.sort((a, b) => (b.num_viewers || 0) - (a.num_viewers || 0));
            const topUser1 = femaleUsers[0];
            const topUser2 = femaleUsers[1];
            if (this.mainIframe && topUser1) {
                this.mainIframe.src = `https://chaturbate.com/embed/${topUser1.username}/?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black`;
            }
            if (this.mainIframe2 && topUser2) {
                this.mainIframe2.src = `https://chaturbate.com/embed/${topUser2.username}/?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black`;
            } else if (this.mainIframe2 && topUser1 && !topUser2) {
                 console.log("Only one top female user found. mainIframe2 not changed or cleared.");
            }
            this.#initialIframesSet = true;
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

            this.#lastFilteredUsers=this.#allOnlineUsersData.filter(u=>{ 
                if(!u||!u.username)return false;
                const isPublic=u.current_show==='public';
                let hasTags=true;
                if(filterTags.length>0){
                    const userTagsLower=(u.tags&&Array.isArray(u.tags))?u.tags.map(t=>typeof t==='string'?t.toLowerCase():''):[];
                    hasTags=filterTags.some(fT=>userTagsLower.includes(fT))
                }
                let isAgeMatch=true;
                if(filterAges.length>0){isAgeMatch=(u.age&&typeof u.age==='number')?filterAges.includes(u.age):false}
                
                let matchesBirthdayFilter = true; 
                if (buttonFilters.birthdayBanner) {
                    matchesBirthdayFilter = this.#isBirthday(u.birthday); 
                }

                return isPublic && hasTags && isAgeMatch && matchesBirthdayFilter;
            });
            this.#displayOnlineUsersList(this.#lastFilteredUsers); 
        }

        #displayOnlineUsersList(usersToDisplay) {
            if (!this.onlineUsersDiv) return;
            this.onlineUsersDiv.innerHTML = "";
            if (usersToDisplay.length === 0) {
                this.onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users match filters.</p>';
                return;
            }
            const fragment = document.createDocumentFragment();
            usersToDisplay.forEach(user => {
                if (!user || !user.image_url || !user.username) return;
                const userElement = this.uiManager.createUserElement(user, 'online', this.#handleUserClick.bind(this), this.#removeFromPreviousUsers.bind(this), (username) => this.storageManager.getUserClickCount(username, this.#previousUsers), this.#isBirthday.bind(this), this.uiManager.showOnlineLoadingIndicator.bind(this.uiManager), this.uiManager.hideOnlineLoadingIndicator.bind(this.uiManager), this.#displayPreviousUsers.bind(this));
                fragment.appendChild(userElement);
            });
            this.onlineUsersDiv.appendChild(fragment);
        }

        async #displayPreviousUsers() {
            if (!this.previousUsersDiv) return;
            this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">Loading history...</p>';
            if (this.#previousUsers.length === 0) {
                this.#previousUsers = await this.storageManager.loadUsers("previousUsers");
                if (this.#previousUsers.length === 0) {
                    this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">No viewing history.</p>';
                    return;
                }
            }
            if (this.#allOnlineUsersData.length === 0) {
                this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">History loaded. Fetch online status...</p>';
                return;
            }
            const onlineUserMap = new Map(this.#allOnlineUsersData.map(u => [u.username, u]));
            const onlinePrevious = this.#previousUsers.filter(pU => onlineUserMap.get(pU.username)?.current_show === 'public');
            this.previousUsersDiv.innerHTML = "";
            if (onlinePrevious.length === 0) {
                this.previousUsersDiv.innerHTML = '<p class="text-muted w3-center">None of your saved users are online & public.</p>';
                return;
            }
            const fragment = document.createDocumentFragment();
            onlinePrevious.forEach(user => {
                if (!user || !user.image_url || !user.username) return;
                 const userElement = this.uiManager.createUserElement(user, 'previous', this.#handleUserClick.bind(this), this.#removeFromPreviousUsers.bind(this), (username) => this.storageManager.getUserClickCount(username, this.#previousUsers), this.#isBirthday.bind(this), this.uiManager.showOnlineLoadingIndicator.bind(this.uiManager), this.uiManager.hideOnlineLoadingIndicator.bind(this.uiManager), this.#displayPreviousUsers.bind(this));
                fragment.appendChild(userElement);
            });
            this.previousUsersDiv.appendChild(fragment);
        }

        #handleUserClick(user) {
            if (!this.mainIframe || !this.mainIframe2 || !user || !user.username) return;
            const iframeChoiceRadio = document.querySelector('input[name="iframeChoice"]:checked');
            const selectedIframe = (iframeChoiceRadio?.value === 'mainIframe2') ? this.mainIframe2 : this.mainIframe;
            selectedIframe.src = `https://chaturbate.com/embed/${user.username}/?tour=dU9X&campaign=9cg6A&disable_sound=1&bgcolor=black`;
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
            this.#previousUsers = [];
            try {
                await this.storageManager.saveUsers("previousUsers", []); 
                if (this.#storageType === "indexedClicked" || this.#storageType?.startsWith('IndexedDB:')) {
                    // This assumes saveUsers with an empty array effectively clears it or an explicit delete might be needed.
                }
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
            const critical = [this.onlineUsersDiv, this.previousUsersDiv, this.mainIframe, this.mainIframe2, this.storageTypeSelector, this.filterTagsSelect, this.filterAgeSelect];
            if (critical.some(el => !el)) { 
                const missing = critical.map((el,i)=>el?null:["onlineUsersDiv","previousUsersDiv","mainIframe","mainIframe2","storageTypeSelector","filterTagsSelect","filterAgeSelect"][i]).filter(Boolean).join(', ');
                console.error(`CRITICAL ERROR: Missing essential DOM elements: ${missing}. App might not function.`);
                this.uiManager.showOnlineErrorDisplay(`Initialization failed: Missing elements (${missing}).`);
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
                $('#toggleControlsButton').on('click', () => {
                    $('#controlsBarContainer').slideToggle();
                });
            } else {
                console.error('jQuery is not loaded. Some UI features might not work.');
                const toggleBtn = document.getElementById('toggleControlsButton');
                const controlsBar = document.getElementById('controlsBarContainer');
                if (toggleBtn && controlsBar) {
                    toggleBtn.addEventListener('click', () => {
                         controlsBar.style.display = controlsBar.style.display === 'none' ? 'flex' : 'none';
                    });
                }
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
            
            await this.#fetchDataAndUpdateUI(); 
            
            this.#startFetchInterval(); 

            if (typeof window.initializeAllUsers === 'function') window.initializeAllUsers();
            window.initializeAllUsersFromScriptJS = (cb) => { if(typeof cb==='function')cb() };
            
            console.log("App: Initialization complete and periodic fetching started.");
            this.uiManager.hideOnlineLoadingIndicator();
        }

        #startFetchInterval() {
            if (this.#fetchInterval) clearInterval(this.#fetchInterval); 
            this.#fetchInterval = setInterval(async () => { 
                await this.#fetchDataAndUpdateUI(); 
            }, fetchIntervalDuration); 
        }
    } // End App Class

    // DOMContentLoaded Listener
    document.addEventListener('DOMContentLoaded', () => {
        const app = new App();
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
