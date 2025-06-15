class MenuApp {
    constructor(dbService) {
        this.dbService = dbService; // Service for IndexedDB operations
        this.contentIframe = $('#content-iframe');
        this.contentDisplayArea = $('#content-display-area');
        this.defaultWelcomeTitle = this.contentDisplayArea.find('h2').first();
        this.defaultWelcomeText = this.contentDisplayArea.find('p').first();
        this.navUl = $('nav ul');
        this.addMenuItemForm = $('#add-menu-item-form');
        this.genAiToggle = $('#genai-toggle-switch');
        this.setAlertForm = $('#set-alert-form'); // Added Alert Form
        this.alertsListDiv = $('#alerts-list'); // Added Alerts List Div

        // Expose showContent globally if needed by static links, or refactor static links
        window.showContent = this.showContent.bind(this);
        this.alerts = []; // In-memory store for active alerts for checking
        this.alertCheckInterval = null;
    }

    async init() {
        console.log("MenuApp initializing...");
        this.initGenAiToggle();
        if (this.dbService && typeof this.dbService.initDb === 'function') {
            try {
                await this.dbService.initDb();
                console.log("Database service initialized.");
                await this.loadUserMenuItems();
                await this.loadAlerts(); // Load existing alerts
            } catch (error) {
                console.error("Error initializing DB service:", error);
            }
        } else {
            console.warn("DB service not available. User-added links and alerts will not be persistent.");
        }
        this.requestNotificationPermission();
        this.bindEvents();
        this.startAlertChecks(); // Start checking for alerts
    }

    initGenAiToggle() {
        const savedState = localStorage.getItem('genAiEnabled');
        // Default to false (disabled) if no saved state
        const initialState = savedState === 'true';

        window.genAiEnabled = initialState;
        if (this.genAiToggle.length) {
            this.genAiToggle.prop('checked', initialState);
        }
        console.log("GenAI features initially:", window.genAiEnabled ? "Enabled" : "Disabled");

        // Dispatch initial event for other parts of the application
        const event = new CustomEvent('genai-toggle-changed', { detail: { enabled: window.genAiEnabled } });
        window.dispatchEvent(event);
    }

    bindEvents() {
        // Handle clicks on dynamically added menu items as well
        this.navUl.on('click', 'a.dynamic-item', (event) => {
            event.preventDefault();
            const targetUrl = $(event.currentTarget).attr('href');
            const type = $(event.currentTarget).data('type'); // 'iframe' or 'link'
            this.showContent($(event.currentTarget).text(), targetUrl, type);
        });

        // Handle clicks on static menu items (if they are not already handled by global showContent)
        // This is more robust:
        $('nav ul li a:not(.dynamic-item)').each((index, element) => {
            const $link = $(element);
            // If it's not an external link and has onclick for old showContent
            if (!$link.attr('href').endsWith('.html') && $link.attr('onclick')) {
                 // No need to re-bind if it's already using global showContent
            } else if ($link.attr('href').endsWith('.html') && $link.attr('onclick')) {
                // For links like "Play Game (External)" or iframe links
                // The original onclick="showContent('rules', 'rules.html')" still works
            }
        });


        if (this.addMenuItemForm.length) {
            this.addMenuItemForm.on('submit', async (event) => {
                event.preventDefault();
                const name = $('#menu-item-name').val().trim();
                const url = $('#menu-item-url').val().trim();
                const type = $('#menu-item-type').val(); // 'iframe' or 'link'

                if (name && url) {
                    await this.addNewMenuItem(name, url, type);
                    this.addMenuItemForm[0].reset();
                } else {
                    alert("Please provide both a name and a URL.");
                }
            });
        } else {
            console.warn("Add menu item form not found.");
        }

        if (this.genAiToggle.length) {
            this.genAiToggle.on('change', () => {
                window.genAiEnabled = this.genAiToggle.is(':checked');
                localStorage.setItem('genAiEnabled', window.genAiEnabled);
                console.log("GenAI features toggled:", window.genAiEnabled ? "Enabled" : "Disabled");

                // Dispatch custom event for other parts of the application
                const event = new CustomEvent('genai-toggle-changed', { detail: { enabled: window.genAiEnabled } });
                window.dispatchEvent(event);
            });
        } else {
            console.warn("GenAI toggle switch not found.");
        }

        if (this.setAlertForm.length) {
            this.setAlertForm.on('submit', async (event) => {
                event.preventDefault();
                const date = $('#alert-date').val();
                const time = $('#alert-time').val();
                const message = $('#alert-message').val().trim();

                if (date && time && message) {
                    const dateTimeString = `${date}T${time}:00`;
                    // Basic validation for date and time (more robust needed for production)
                    if (new Date(dateTimeString) < new Date()) {
                        alert("Please select a future date and time for the alert.");
                        return;
                    }
                    await this.addNewAlert(dateTimeString, message);
                    this.setAlertForm[0].reset();
                } else {
                    alert("Please fill in all alert fields.");
                }
            });
        } else {
            console.warn("Set Alert form not found.");
        }

        this.alertsListDiv.on('click', '.dismiss-alert-btn', async (event) => {
            const alertId = $(event.currentTarget).data('alert-id');
            await this.dismissAlert(alertId, $(event.currentTarget).closest('.alert-item'));
        });
    }

    requestNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        console.log("Notification permission granted.");
                        new Notification("Jinx Menu Alerts", { body: "Notifications are now enabled!" });
                    } else {
                        console.log("Notification permission denied.");
                        alert("You have denied notification permissions. Alerts will not be shown as system notifications.");
                    }
                });
            } else if (Notification.permission === 'denied') {
                 console.warn("Notification permission was previously denied. Alerts will not be shown as system notifications.");
            }
        } else {
            console.warn("This browser does not support desktop notification.");
        }
    }

    async addNewAlert(dateTimeString, message) {
        const newAlert = {
            id: `alert-${Date.now()}`,
            type: 'alert', // To distinguish from menu items if stored together
            dateTime: dateTimeString,
            message: message,
            triggered: false
        };

        if (this.dbService && typeof this.dbService.addItem === 'function') {
            try {
                await this.dbService.addItem(newAlert);
                console.log("Alert saved to DB:", newAlert);
                this.alerts.push(newAlert); // Add to in-memory array
                this.renderAlert(newAlert); // Display in UI
            } catch (error) {
                console.error("Error saving alert to DB:", error);
                alert("Error saving alert.");
            }
        } else {
            // Fallback for session only if DB is not working
            this.alerts.push(newAlert);
            this.renderAlert(newAlert);
            console.warn("DB service not available. Alert saved for this session only.");
        }
    }

    renderAlert(alert) {
        if (alert.triggered) return; // Don't render already triggered alerts in the list

        const alertDiv = $('<div></div>')
            .addClass('alert-item')
            .attr('id', `alert-ui-${alert.id}`)
            .css({ padding: '5px', border: '1px solid #ccc', marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

        const alertText = new Date(alert.dateTime).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'});
        alertDiv.html(`<span>${alert.message} (<em>${alertText}</em>)</span>`);

        const dismissButton = $('<button>Dismiss</button>')
            .addClass('dismiss-alert-btn')
            .data('alert-id', alert.id)
            .css({ cursor: 'pointer', color: 'orange', border: 'none', background: 'none', fontSize: '0.9em' });

        alertDiv.append(dismissButton);
        this.alertsListDiv.append(alertDiv);
    }

    async loadAlerts() {
        if (!this.dbService || typeof this.dbService.getItems !== 'function') {
            console.warn("DB service not available for loading alerts.");
            // Potentially load from a temporary in-memory store if needed for session w/o DB
            this.alerts.forEach(alert => this.renderAlert(alert)); // Render any session-only alerts
            return;
        }
        try {
            const items = await this.dbService.getItems();
            this.alerts = []; // Clear current in-memory alerts
            this.alertsListDiv.find('.alert-item').remove(); // Clear UI

            if (items && items.length > 0) {
                items.forEach(item => {
                    // Assuming menu items might also be in this store, filter for alerts
                    // A better way would be for indexedDBService to allow fetching by type/store name
                    if (item.type === 'alert' && !item.triggered) {
                        this.alerts.push(item);
                        this.renderAlert(item);
                    }
                });
                console.log("Alerts loaded and rendered:", this.alerts.length);
            }
        } catch (error) {
            console.error("Error loading alerts from DB:", error);
        }
    }

    async dismissAlert(alertId, $listItemElement) {
        if (this.dbService && typeof this.dbService.deleteItem === 'function') {
            try {
                await this.dbService.deleteItem(alertId);
                console.log("Alert deleted from DB:", alertId);
            } catch (error) {
                console.error("Error deleting alert from DB:", error);
                // Proceed to remove from UI and memory anyway
            }
        } else {
            console.warn("DB service not available. Alert removal might not be persistent.");
        }

        this.alerts = this.alerts.filter(a => a.id !== alertId);
        if ($listItemElement && $listItemElement.length) {
            $listItemElement.remove();
        } else {
            // If element not passed, find and remove it
            $(`#alert-ui-${alertId}`).remove();
        }
        console.log("Alert dismissed from UI and memory:", alertId);
    }

    startAlertChecks() {
        if (this.alertCheckInterval) {
            clearInterval(this.alertCheckInterval);
        }
        // Check every 30 seconds (adjust as needed)
        this.alertCheckInterval = setInterval(async () => {
            const now = new Date();
            // console.log("Checking alerts...", now.toLocaleTimeString()); // For debugging

            for (const alert of this.alerts) {
                if (!alert.triggered && new Date(alert.dateTime) <= now) {
                    console.log("Triggering alert:", alert);
                    if (Notification.permission === 'granted') {
                        const notification = new Notification("Jinx Menu Alert!", {
                            body: alert.message,
                            tag: alert.id // Use alert ID as tag to prevent duplicate notifications if check runs fast
                        });
                        notification.onclick = () => {
                            // Focus window or navigate to a relevant part of the app
                            window.focus();
                            // Optionally dismiss the alert when notification is clicked
                            // this.dismissAlert(alert.id);
                            console.log(`Notification for alert ${alert.id} clicked.`);
                        };
                    } else {
                        // Fallback if notifications are not granted: simple alert
                        window.alert(`ALERT: ${alert.message}\n(Time: ${new Date(alert.dateTime).toLocaleTimeString()})`);
                    }

                    alert.triggered = true;
                    // Update in DB to mark as triggered (or delete if preferred)
                    if (this.dbService && typeof this.dbService.updateItem === 'function') {
                        try {
                            await this.dbService.updateItem(alert);
                        } catch (e) {
                            console.error("Failed to update alert as triggered in DB", e);
                            // If update fails, consider deleting or handling otherwise
                        }
                    } else if (this.dbService && typeof this.dbService.deleteItem === 'function') {
                        // Alternative: just delete it after triggering
                        // await this.dbService.deleteItem(alert.id);
                    }
                    // Remove from UI list as it's now triggered
                    $(`#alert-ui-${alert.id}`).remove();
                }
            }
            // Clean up triggered alerts from memory
            this.alerts = this.alerts.filter(a => !a.triggered);

        }, 30000);
        console.log("Alert checking mechanism started.");
    }

    stopAlertChecks() {
        if (this.alertCheckInterval) {
            clearInterval(this.alertCheckInterval);
            this.alertCheckInterval = null;
            console.log("Alert checking mechanism stopped.");
        }
    }


    showContent(contentIdOrName, url, type = 'iframe') {
        // window.location.hash = contentIdOrName.toLowerCase().replace(/\s+/g, '-'); // Update hash

        if (url && type === 'iframe') {
            this.defaultWelcomeTitle.hide();
            this.defaultWelcomeText.hide();
            this.contentIframe.attr('src', url).show();
        } else if (url && type === 'link') {
            // For external links, let the browser handle it or open in new tab
            window.open(url, '_blank');
            // Optionally, reset view to home if desired after clicking external link
            this.showContent('Welcome!', null);
        } else {
            // Handle "Home" or other non-iframe/non-external-link dynamic items
            this.contentIframe.hide().attr('src', 'about:blank');
            this.defaultWelcomeTitle.text(contentIdOrName === 'home' ? 'Welcome!' : contentIdOrName).show();
            this.defaultWelcomeText.text(contentIdOrName === 'home' ? 'Select an option from the menu to learn more or start playing.' : `Content for ${contentIdOrName} would be displayed here if it's not a URL link.`).show();
        }
    }

    async addNewMenuItem(name, url, type) {
        const newItem = {
            id: `user-${Date.now()}`, // Simple unique ID
            name: name,
            url: url,
            type: type // 'iframe' or 'link'
        };

        if (this.dbService && typeof this.dbService.addItem === 'function') {
            try {
                await this.dbService.addItem(newItem);
                console.log("Item saved to DB:", newItem);
            } catch (error) {
                console.error("Error saving item to DB:", error);
                alert("Error saving menu item. It will be available for this session only.");
            }
        } else {
            console.warn("DB service not available. Item not saved to DB.");
            // Optionally, store in memory for session-only use if DB fails
        }
        this.renderMenuItem(newItem);
    }

    renderMenuItem(item) {
        // Create the link element using jQuery
        const $link = $('<a></a>')
            .attr('href', item.url)
            .addClass('dynamic-item') // For event delegation
            .data('type', item.type)  // Store type for click handler
            .text(item.name);

        if (item.type === 'link') {
            $link.attr('target', '_blank'); // Open external links in new tab
        }

        // Create list item and append link
        const $listItem = $('<li></li>').append($link);

        // Add a small delete button - styles are now in style.css
        const $deleteButton = $('<button>X</button>')
            .addClass('delete-item-btn')
            // .css({ 'margin-left': '10px', 'cursor': 'pointer', 'color': 'red', 'border': 'none', 'background': 'none'}) // Styles removed
            .on('click', async (e) => {
                e.stopPropagation(); // Prevent menu item click
                e.preventDefault(); // Prevent default link behavior
                if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
                    await this.deleteUserMenuItem(item.id, $listItem);
                }
            });
        $listItem.append($deleteButton);

        this.navUl.append($listItem);
    }

    async loadUserMenuItems() {
        if (!this.dbService || typeof this.dbService.getItems !== 'function') {
            console.warn("DB service not available for loading items.");
            return;
        }
        try {
            const items = await this.dbService.getItems();
            if (items && items.length > 0) {
                items.forEach(item => this.renderMenuItem(item));
                console.log("User menu items loaded:", items.length);
            }
        } catch (error) {
            console.error("Error loading items from DB:", error);
        }
    }

    async deleteUserMenuItem(itemId, $listItemElement) {
        if (this.dbService && typeof this.dbService.deleteItem === 'function') {
            try {
                await this.dbService.deleteItem(itemId);
                $listItemElement.remove();
                console.log("Item deleted from DB and UI:", itemId);
            } catch (error) {
                console.error("Error deleting item from DB:", error);
                alert("Error deleting menu item from persistent storage.");
            }
        } else {
             // If no DB service, just remove from UI (it was session only)
            $listItemElement.remove();
            console.warn("DB service not available. Item removed from UI only.");
        }
    }

    // Example of an async operation to fetch data (not used by current iframe logic directly but for illustration)
    async fetchData(url) {
        try {
            const response = await $.ajax({
                url: url,
                dataType: 'html' // or 'json', 'xml' etc.
            });
            return response;
        } catch (error) {
            console.error("Error fetching data:", error);
            throw error; // Re-throw to be handled by caller
        }
    }
}

// The MenuApp will be instantiated in index.html after DOM is ready and indexedDBService.js is loaded.
// $(document).ready(...) in index.html will call:
// const app = new MenuApp(window.indexedDBService);
// app.init();
