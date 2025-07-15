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
        displayPreviousUsersCallback,
        getDaysSinceOrUntil18thBirthdayCallback,
        socialMediaData,
        toggleUserCardPreviewCallback
    ) {
        const userElement = document.createElement("div");
        userElement.className = `user-info ${listType}-list-item`;
        userElement.dataset.username = user.username;

        const clickCount = getUserClickCountCallback(user.username);
        const isBirthday = isBirthdayCallback(user.birthday);
        const birthdayMessage = getDaysSinceOrUntil18thBirthdayCallback(user.birthday, user.age);

        let socialLinksHtml = '';
        if (socialMediaData) {
            for (const platform in socialMediaData) {
                socialMediaData[platform].forEach(link => {
                    socialLinksHtml += `<a href="${link.startsWith('@') ? `https://twitter.com/${link.substring(1)}` : link}" target="_blank" class="social-link">${platform}</a> `;
                });
            }
        }

        const imageContainer = document.createElement('div');
        imageContainer.className = 'user-image-container';
        const img = document.createElement('img');
        img.src = user.image_url_360x270 || user.image_url;
        img.alt = `${user.username}'s stream preview`;
        img.loading = 'lazy';
        imageContainer.appendChild(img);

        userElement.imageContainerEl = imageContainer;
        userElement.imageEl = img;
        userElement.dataset.previewState = 'image';

        userElement.innerHTML = `
            ${isBirthday ? '<div class="birthday-banner">🎉 Happy Birthday! 🎉</div>' : ''}
            <div class="user-image-container">
                <img src="${user.image_url_360x270 || user.image_url}" alt="${user.username}'s stream preview" loading="lazy">
            </div>
            <div class="user-details">
                <div class="user-title">${user.username}</div>
                <div class="user-stats">
                    <span class="user-age">Age: ${user.age}</span> |
                    <span class="user-viewers">Viewers: ${user.num_viewers}</span>
                    ${clickCount > 0 ? `<span class="user-click-count"> | Clicks: ${clickCount}</span>` : ''}
                </div>
                ${birthdayMessage ? `<div class="birthday-message">${birthdayMessage}</div>` : ''}
                <div class="user-tags">${(user.tags || []).join(', ')}</div>
                <div class="social-media-links">${socialLinksHtml}</div>
            </div>
        `;

        userElement.prepend(imageContainer);


        userElement.addEventListener("click", (event) => {
            if (event.target.tagName !== 'A') {
                handleUserClickCallback(user);
            }
        });

        if (listType === 'previous') {
            const removeButton = document.createElement('button');
            removeButton.textContent = 'X';
            removeButton.className = 'remove-from-history-btn';
            removeButton.title = `Remove ${user.username} from history`;
            removeButton.addEventListener('click', async (event) => {
                event.stopPropagation();
                if (confirm(`Are you sure you want to remove ${user.username} from your history?`)) {
                    showOnlineLoadingIndicatorCallback("Removing user...");
                    await removeFromPreviousUsersCallback(user.username);
                    // No longer need to manually remove element, displayPreviousUsers will redraw
                    await displayPreviousUsersCallback();
                    hideOnlineLoadingIndicatorCallback();
                }
            });
            userElement.querySelector('.user-details').appendChild(removeButton);
        }

        // Add a toggle button for the preview
        const togglePreviewButton = document.createElement('button');
        togglePreviewButton.textContent = 'Toggle Preview';
        togglePreviewButton.className = 'toggle-preview-btn';
        togglePreviewButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUserCardPreviewCallback(userElement, user.username);
        });
        userElement.querySelector('.user-details').appendChild(togglePreviewButton);


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
