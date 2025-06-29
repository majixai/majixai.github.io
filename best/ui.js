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
        isBirthdayCallback, // Keep other params for signature consistency for now
        showOnlineLoadingIndicatorCallback,
        hideOnlineLoadingIndicatorCallback,
        displayPreviousUsersCallback,
        getDaysSinceOrUntil18thBirthdayCallback,
        socialMediaData,
        toggleUserCardPreviewCallback // Added in original, keep for now
    ) {
        const userElement = document.createElement("div");
        // Apply some basic classes for context, but main styling is inline for test
        userElement.className = `user-info simple-test-user ${listType}-list-item`;
        userElement.dataset.username = user.username; // Keep username for other potential logic

        // Simplified content
        userElement.textContent = `User: ${user.username} | Viewers: ${user.num_viewers || 'N/A'} | Age: ${user.age || 'N/A'}`;

        // Highly visible styling for testing
        userElement.style.border = "2px solid red";
        userElement.style.padding = "5px";
        userElement.style.margin = "3px";
        userElement.style.backgroundColor = "#ffe5e5"; // Light red background
        userElement.style.color = "#000"; // Ensure text is visible

        // Basic click handler to see if interaction works
        userElement.addEventListener("click", function(event) {
            console.log(`Simplified user card clicked: ${user.username}`);
            if (typeof handleUserClickCallback === 'function') {
                handleUserClickCallback(user);
            }
        });

        // Store some original references on the element if other parts of the code might expect them,
        // even if not used by this simplified version directly.
        // This is mainly to prevent errors if other code (e.g., intersection observer) tries to access them.
        const imageContainer = document.createElement('div');
        imageContainer.className = 'user-image-container'; // For IntersectionObserver checks on dataset.previewState
        const img = document.createElement('img');
        img.src = user.image_url_360x270 || user.image_url || ''; // Use a valid image URL
        imageContainer.appendChild(img);
        userElement.appendChild(imageContainer); // Append it so it's part of the element
        userElement.imageContainerEl = imageContainer;
        userElement.imageEl = img;
        userElement.dataset.previewState = 'image'; // Initialize previewState for observer

        console.log(`[DIAGNOSTIC] Simplified createUserElement for: ${user.username}`);
        return userElement;
    }

    // ... rest of UIManager class remains the same
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

    showOnlineErrorDisplay(message, isWarning = false) {
        const onlineErrorDisplay = document.getElementById("onlineErrorDisplay");
        if (onlineErrorDisplay) {
            if (isWarning) {
                console.warn(`UI: SHOW ONLINE WARNING: ${message}`);
                onlineErrorDisplay.textContent = `Warning: ${message}`;
                onlineErrorDisplay.className = 'warning-message'; // New class for warnings
            } else {
                console.error(`UI: SHOW ONLINE ERROR: ${message}`);
                onlineErrorDisplay.textContent = `Error: ${message}`;
                onlineErrorDisplay.className = 'error-message';
            }
            onlineErrorDisplay.style.display = 'block';
        }
        this.hideOnlineLoadingIndicator();
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
