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

        const slideshowControls = user.image_urls.length > 1 ? `
            <div class="slideshow-controls">
                <button class="prev-btn">&lt;</button>
                <button class="next-btn">&gt;</button>
            </div>
        ` : '';

        userElement.innerHTML = `
            <div class="user-image-container">
                <img src="${user.image_urls[0]}" alt="${user.username} thumbnail" loading="lazy" class="w3-image" crossOrigin="anonymous">
                <canvas></canvas>
                ${slideshowControls}
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
            if (event.target.closest('.remove-user-btn')) {
                return;
            }
            event.preventDefault();
            handleUserClickCallback(user);
        });

        // const toggleBtn = userElement.querySelector('.toggle-view-btn');
        // if (toggleBtn) {
        //     toggleBtn.addEventListener('click', function(event) {
        //         event.stopPropagation(); // Prevent the main user card click event
        //         const imageContainer = this.closest('.user-image-container');
        //         if (imageContainer) {
        //             imageContainer.classList.toggle('iframe-active');
        //             if (imageContainer.classList.contains('iframe-active')) {
        //                 this.textContent = 'Show Image';
        //             } else {
        //                 this.textContent = 'Show Preview';
        //             }
        //         }
        //     });
        // }
// 
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

        const prevBtn = userElement.querySelector('.prev-btn');
        const nextBtn = userElement.querySelector('.next-btn');
        const img = userElement.querySelector('img');
        let currentImageIndex = 0;

        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentImageIndex = (currentImageIndex - 1 + user.image_urls.length) % user.image_urls.length;
            img.src = user.image_urls[currentImageIndex];
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentImageIndex = (currentImageIndex + 1) % user.image_urls.length;
            img.src = user.image_urls[currentImageIndex];
        });

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

    showGeneralNotification(message, type = 'info', duration = 3000) {
        let notificationDiv = document.getElementById('general-notification');
        if (!notificationDiv) {
            notificationDiv = document.createElement('div');
            notificationDiv.id = 'general-notification';
            notificationDiv.style.position = 'fixed';
            notificationDiv.style.bottom = '20px';
            notificationDiv.style.left = '50%';
            notificationDiv.style.transform = 'translateX(-50%)';
            notificationDiv.style.padding = '10px 20px';
            notificationDiv.style.borderRadius = '5px';
            notificationDiv.style.zIndex = '10000';
            notificationDiv.style.transition = 'opacity 0.5s';
            notificationDiv.style.opacity = '0';
            document.body.appendChild(notificationDiv);
        }

        notificationDiv.textContent = message;
        if (type === 'error') {
            notificationDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
            notificationDiv.style.color = 'white';
        } else {
            notificationDiv.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
            notificationDiv.style.color = 'white';
        }

        notificationDiv.style.opacity = '1';

        setTimeout(() => {
            notificationDiv.style.opacity = '0';
        }, duration - 500);
    }
}

// To make UIManager available if not using modules:
// window.UIManager = UIManager;
// However, script.js will instantiate it directly.
