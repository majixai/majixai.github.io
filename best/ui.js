class UIManager {
    constructor() {
        // DOM element references will be queried within methods as needed
        // to keep the constructor clean and avoid issues if elements are not immediately available.
        // However, for frequently accessed elements, caching them in the constructor after DOMContentLoaded
        // (if UIManager is instantiated then) or via an init method could be an optimization.
        // For now, methods will query directly.
        console.log("UIManager instantiated.");
    }

    /**
     * Creates and returns a DOM element for a single user.
     * @param {Object} user - The user data object.
     * @param {'online' | 'previous'} listType - Indicates which list the element is for.
     * @param {Function} handleUserClickCallback - Callback for when a user element is clicked.
     * @param {Function} removeFromPreviousUsersCallback - Callback to remove a user from history.
     * @param {Function} getUserClickCountCallback - Callback to get user click count.
     * @param {Function} isBirthdayCallback - Callback to check if it's user's birthday.
     * @param {Function} showOnlineLoadingIndicatorCallback - Callback to show loading indicator.
     * @param {Function} hideOnlineLoadingIndicatorCallback - Callback to hide loading indicator.
     * @param {Function} displayPreviousUsersCallback - Callback to refresh previous users display.
     * @returns {HTMLElement} The created user div element.
     */
    createUserElement(
        user, 
        listType, 
        handleUserClickCallback, 
        removeFromPreviousUsersCallback, 
        getUserClickCountCallback,
        isBirthdayCallback,
        showOnlineLoadingIndicatorCallback,
        hideOnlineLoadingIndicatorCallback,
        displayPreviousUsersCallback
    ) {
        const userElement = document.createElement("div");
        userElement.className = `user-info w3-card w3-margin-bottom ${listType}-list-item`;
        userElement.dataset.username = user.username;

        const tagsDisplay = (user.tags && Array.isArray(user.tags) && user.tags.length > 0)
                            ? user.tags.join(', ')
                            : 'N/A';
        const ageDisplay = (user.age && typeof user.age === 'number') ? user.age : 'N/A';
        const newBadge = user.is_new ? '<span class="badge new-badge w3-tag w3-small w3-red w3-round">New</span>' : '';
        const birthdayBanner = isBirthdayCallback(user.birthday) ? `<p class="birthday w3-text-amber w3-center">🎂 Happy Birthday! 🎂</p>` : '';
        const removeButtonHTML = listType === 'previous' ? '<button class="remove-user-btn w3-button w3-tiny w3-red w3-hover-dark-grey w3-circle" title="Remove from history">×</button>' : '';
        const clickCount = getUserClickCountCallback(user.username);

        userElement.innerHTML = `
            <div class="user-image-container">
                <img src="${user.image_url}" alt="${user.username} thumbnail" loading="lazy" class="w3-image">
                ${removeButtonHTML}
            </div>
            <div class="user-details w3-container w3-padding-small">
                <p class="username w3-large">${user.username} ${newBadge}</p>
                <p><small>Age: ${ageDisplay} | Viewers: ${user.num_viewers || 'N/A'} | Clicks: ${clickCount}</small></p>
                <p class="tags"><small>Tags: ${tagsDisplay}</small></p>
                ${birthdayBanner}
            </div>
        `;

        userElement.addEventListener("click", function(event) {
            if (event.target.closest('.remove-user-btn')) {
                return;
            }
            event.preventDefault();
            handleUserClickCallback(user);
        });

        const removeBtn = userElement.querySelector('.remove-user-btn');
        if (removeBtn) {
            removeBtn.addEventListener("click", async function(event) {
                event.stopPropagation();
                console.log(`User clicked remove for: ${user.username}`);
                if (typeof showOnlineLoadingIndicatorCallback === 'function') {
                    showOnlineLoadingIndicatorCallback("Removing from history...");
                }
                await removeFromPreviousUsersCallback(user.username);
                if (typeof displayPreviousUsersCallback === 'function') {
                     await displayPreviousUsersCallback(); // Refresh display
                }
                if (typeof hideOnlineLoadingIndicatorCallback === 'function') {
                    hideOnlineLoadingIndicatorCallback();
                }
            });
        }
        return userElement;
    }

    showOnlineLoadingIndicator(message = 'Loading...') {
        const onlineLoadingIndicator = document.getElementById("onlineLoadingIndicator");
        const onlineUsersDivList = document.getElementById("onlineUsers")?.querySelector('.user-list');
        if (onlineLoadingIndicator) {
            onlineLoadingIndicator.textContent = message;
            onlineLoadingIndicator.style.display = 'block';
        }
        if (onlineUsersDivList) onlineUsersDivList.innerHTML = ''; // Clear list area
    }

    hideOnlineLoadingIndicator() {
        const onlineLoadingIndicator = document.getElementById("onlineLoadingIndicator");
        if (onlineLoadingIndicator) {
            onlineLoadingIndicator.style.display = 'none';
        }
    }

    showOnlineErrorDisplay(message) {
        const onlineErrorDisplay = document.getElementById("onlineErrorDisplay");
        console.error(`UI: SHOW ONLINE ERROR: ${message}`);
        if (onlineErrorDisplay) {
            onlineErrorDisplay.textContent = `Error: ${message}`;
            onlineErrorDisplay.style.display = 'block';
            onlineErrorDisplay.className = 'error-message'; // Ensure styling
        }
        this.hideOnlineLoadingIndicator(); // Also hide loading indicator
    }

    clearOnlineErrorDisplay() {
        const onlineErrorDisplay = document.getElementById("onlineErrorDisplay");
        if (onlineErrorDisplay) {
            onlineErrorDisplay.style.display = 'none';
            onlineErrorDisplay.textContent = '';
            onlineErrorDisplay.className = '';
        }
    }

    showReportLoading(message = 'Processing...') {
        const reportLoadingIndicator = document.getElementById("reportLoadingIndicator");
        const sendReportButton = document.getElementById("sendReportButton");
        if (reportLoadingIndicator) {
            reportLoadingIndicator.textContent = message;
            reportLoadingIndicator.style.display = 'block';
        }
        if (sendReportButton) sendReportButton.disabled = true;
        this.clearReportStatus(); // Clear previous status
    }

    hideReportLoading() {
        const reportLoadingIndicator = document.getElementById("reportLoadingIndicator");
        const sendReportButton = document.getElementById("sendReportButton");
        if (reportLoadingIndicator) {
            reportLoadingIndicator.style.display = 'none';
        }
        if (sendReportButton) sendReportButton.disabled = false;
    }

    showReportStatus(message, type = 'info') {
        const reportStatusDisplay = document.getElementById("reportStatusDisplay");
        console.log(`UI: SHOW REPORT STATUS (${type}): ${message}`);
        if (reportStatusDisplay) {
            reportStatusDisplay.textContent = message;
            reportStatusDisplay.className = `report-status ${type}`;
            reportStatusDisplay.style.display = 'block';

            if (type !== 'error') {
                setTimeout(() => this.clearReportStatus(), 6000);
            }
        }
        this.hideReportLoading(); // Ensure loading is hidden
    }

    clearReportStatus() {
        const reportStatusDisplay = document.getElementById("reportStatusDisplay");
        if (reportStatusDisplay) {
            reportStatusDisplay.style.display = 'none';
            reportStatusDisplay.textContent = '';
            reportStatusDisplay.className = 'report-status';
        }
    }
}

// To make UIManager available if not using modules:
// window.UIManager = UIManager;
// However, script.js will instantiate it directly.
