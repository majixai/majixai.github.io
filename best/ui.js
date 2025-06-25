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
        getDaysSinceOrUntil18thBirthdayCallback, // Existing new callback
        socialMediaData // Add new parameter for social media
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

        let birthdayProximityHTMLString = '';
        if (typeof getDaysSinceOrUntil18thBirthdayCallback === 'function') {
            const birthdayProximityText = getDaysSinceOrUntil18thBirthdayCallback(user.birthday, user.age);
            if (birthdayProximityText && birthdayProximityText.trim() !== '') {
                birthdayProximityHTMLString = `<p class="birthday-proximity w3-small">${birthdayProximityText}</p>`;
            }
        }

        let socialMediaHTML = '';
        if (socialMediaData && Object.keys(socialMediaData).length > 0) {
            socialMediaHTML += '<p class="social-media-links w3-small">Social: ';
            const links = [];
            for (const platform in socialMediaData) {
                socialMediaData[platform].forEach(handle => {
                    // Create a clickable link if it's a URL, otherwise just display the handle
                    if (handle.startsWith('http')) {
                        links.push(`<a href="${handle}" target="_blank" rel="noopener noreferrer">${handle.replace(/^(https?:\/\/)?(www\.)?/, '')}</a>`);
                    } else if (handle.startsWith('@') && platform === 'twitter') {
                        links.push(`<a href="https://twitter.com/${handle.substring(1)}" target="_blank" rel="noopener noreferrer">${handle}</a>`);
                    } else if (handle.startsWith('@') && platform === 'instagram') {
                        links.push(`<a href="https://instagram.com/${handle.substring(1)}" target="_blank" rel="noopener noreferrer">${handle}</a>`);
                    }
                    else {
                        links.push(handle);
                    }
                });
            }
            socialMediaHTML += links.join(' | ') + '</p>';
        }

        userElement.innerHTML = `
            <div class="user-image-container">
                <img src="${user.image_url}" alt="${user.username} thumbnail" loading="lazy" class="user-thumbnail-img">
                <!-- Iframe will be created and inserted here by JS if needed -->
                ${removeButtonHTML}
            </div>
            <div class="user-details w3-container w3-padding-small">
                <p class="username w3-large">${user.username} ${newBadge}</p>
                <p><small>Age: ${ageDisplay} | Viewers: ${user.num_viewers || 'N/A'} | Clicks: ${clickCount}</small></p>
                ${birthdayProximityHTMLString}
                ${socialMediaHTML}
                <p class="tags"><small>Tags: ${tagsDisplay}</small></p>
                ${birthdayBanner}
            </div>
        `;

        userElement.addEventListener("click", function(event) {
            // Prevent card click if dblclick target is image container or if remove button is clicked
            if (event.target.closest('.user-image-container') || event.target.closest('.remove-user-btn')) {
                // For double click, we let its own handler manage it.
                // For remove button, its own handler manages it.
                // This prevents the main card click (which loads to main viewer)
                // if the intention was to interact with the preview or remove button.
                // However, single click on image container might still be desired for main viewer if not dblclick.
                // Let's refine: only stop if it's the remove button. Dblclick is a separate event.
                if (event.target.closest('.remove-user-btn')) {
                    return;
                }
            }
            // If the click was on the image container, but not a double click,
            // it might still be intended to load to the main viewer.
            // The double click handler will call event.stopPropagation() if it handles the event.
            // For now, let the main user click proceed unless it's the remove button.
            handleUserClickCallback(user); // This loads user to main iframe viewer
        });

        const imageContainer = userElement.querySelector('.user-image-container');
        if (imageContainer) {
            // Store references
            userElement.imageEl = imageContainer.querySelector('.user-thumbnail-img');
            userElement.imageContainerEl = imageContainer;
            // userElement.iframeEl will be created on demand by App class

            imageContainer.addEventListener('dblclick', function(event) {
                event.preventDefault(); // Prevent any browser default double-click behavior
                event.stopPropagation(); // Stop event from bubbling to the main card click listener

                // The actual toggle logic (toggleUserCardPreview) will be passed in handleUserClickCallback
                // or as a new parameter. For now, assuming it's part of app instance accessible via handleUserClickCallback's context
                // This needs to be adjusted: toggleUserCardPreview should be a distinct callback.
                // Let's assume a new callback: toggleUserCardPreviewCallback
                if (typeof window.appInstance !== 'undefined' && typeof window.appInstance.toggleUserCardPreview === 'function') {
                    if (window.appInstance.userCardPreviewMode === 'image') { // Only allow dblclick if global mode is 'image'
                        window.appInstance.toggleUserCardPreview(userElement, user.username);
                    } else {
                        console.log("Double-click ignored: Global preview mode is active.");
                    }
                } else {
                    console.warn("toggleUserCardPreview function or appInstance not available for user card.", user.username);
                }
            });
        }

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
