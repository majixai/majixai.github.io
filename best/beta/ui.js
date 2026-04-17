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
        const scoreInfo = Number.isFinite(user.relevanceScore) ? ` | Score: ${Number(user.relevanceScore).toFixed(2)}` : '';
        const gpuInfo = Number.isFinite(user.gpuScore) ? ` | GPU: ${Number(user.gpuScore).toFixed(1)}` : '';

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
            <div class="user-image-container slideshow-carousel" data-images='[]'>
                <img src="${LAZY_PLACEHOLDER}" data-src="${user.image_url}" alt="${user.username} thumbnail" class="w3-image slide-img" style="cursor:zoom-in;">
                <div class="slide-progress"></div>
                <span class="slide-counter" style="display:none;">1/1</span>
                <span class="slide-overlay-label">${user.username}</span>
                ${removeButtonHTML}
            </div>
            <div class="user-details w3-container w3-padding-small">
                <p class="username w3-large">${user.username} ${newBadge} <button class="fav-btn" title="Favorite" data-username="${user.username}">★</button></p>
                <p><small>Age: ${ageDisplay} | Viewers: ${user.num_viewers || 'N/A'} | Clicks: ${clickCount}${scoreInfo}${gpuInfo}</small></p>
                ${birthdayProximityHTMLString}
                ${socialMediaHTML}
                <p class="tags"><small>Tags: ${tagsDisplay}</small></p>
                ${birthdayBanner}
                <div class="card-vision" style="display:none;"></div>
            </div>
        `;

        // Initialize slideshow for this card
        this._initCardSlideshow(userElement, user);

        // Trigger GPU vision scoring for this card via idle callback
        if (user.image_url && typeof window.visionScorer !== 'undefined') {
            scheduleIdleTask(async () => {
                const result = await window.visionScorer.scoreImage(user.image_url).catch(() => null);
                if (!result) return;
                userElement.dataset.featureScore = result.featureScore;
                const visionEl = userElement.querySelector('.card-vision');
                if (visionEl) {
                    visionEl.textContent = `🔍 ${result.label} ${result.confidence}%`;
                    visionEl.style.display = '';
                }
            }, { timeout: 8000 });
        }

        // Favorites button
        const favBtn = userElement.querySelector('.fav-btn');
        if (favBtn) {
            const favs = JSON.parse(localStorage.getItem('beta_favorites') || '{}');
            if (favs[user.username]) favBtn.classList.add('favorited');
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const favs = JSON.parse(localStorage.getItem('beta_favorites') || '{}');
                if (favs[user.username]) {
                    delete favs[user.username];
                    favBtn.classList.remove('favorited');
                } else {
                    favs[user.username] = true;
                    favBtn.classList.add('favorited');
                }
                localStorage.setItem('beta_favorites', JSON.stringify(favs));
            });
        }

        userElement.addEventListener("click", function(event) {
            const shouldIgnoreClick = window.IframeOpenControls?.shouldIgnoreCardClick
                ? window.IframeOpenControls.shouldIgnoreCardClick(event.target, ['.remove-user-btn'])
                : (event.target.closest('.remove-user-btn') || event.target.closest('.open-iframe-btn'));
            if (shouldIgnoreClick) {
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
        // Lazy-load the card image once it enters the viewport
        const lazyImg = userElement.querySelector('img[data-src]');
        if (lazyImg) LazyImageObserver.observe(lazyImg);

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

    /**
     * Initialize slideshow for a performer card if multiple images are available.
     * @param {HTMLElement} cardElement
     * @param {Object} user
     */
    _initCardSlideshow(cardElement, user) {
        const carousel = cardElement.querySelector('.slideshow-carousel');
        const imgEl = carousel?.querySelector('.slide-img');
        if (!carousel || !imgEl) return;

        // Use IntersectionObserver to lazy-load slideshow data only when visible
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                obs.disconnect();
                const datPath = `../history/${encodeURIComponent(user.username)}.dat`;
                fetch(datPath)
                    .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`)))
                    .then(buffer => {
                        const decompressed = pako.inflate(new Uint8Array(buffer), { to: 'string' });
                        const urls = [...new Set(JSON.parse(decompressed).filter(Boolean))];
                        if (urls.length < 2) return;
                        carousel.dataset.images = JSON.stringify(urls);
                        const counter = carousel.querySelector('.slide-counter');
                        if (counter) { counter.textContent = `1/${urls.length}`; counter.style.display = 'block'; }
                        this._startCardSlideshow(carousel, imgEl, urls, carousel.querySelector('.slide-progress'), counter);
                    })
                    .catch(() => {
                        // No dat file; leave as single image
                    });
            });
        }, { rootMargin: '200px' });

        observer.observe(cardElement);
    }

    /**
     * Start cycling images on a performer card.
     */
    _startCardSlideshow(carousel, imgEl, urls, progressBar, counterEl) {
        if (carousel._slideshowTimer) clearInterval(carousel._slideshowTimer);
        let idx = 0;
        const duration = 3500;
        const step = () => {
            idx = (idx + 1) % urls.length;
            if (progressBar) {
                progressBar.style.transition = 'none'; progressBar.style.width = '0%';
                void progressBar.offsetWidth;
                progressBar.style.transition = `width ${duration}ms linear`; progressBar.style.width = '100%';
            }
            imgEl.style.opacity = '0.4';
            setTimeout(() => {
                imgEl.src = urls[idx];
                imgEl.style.opacity = '1';
                if (counterEl) counterEl.textContent = `${idx + 1}/${urls.length}`;
            }, 280);
        };
        if (progressBar) {
            progressBar.style.transition = `width ${duration}ms linear`; progressBar.style.width = '100%';
        }
        carousel._slideshowTimer = setInterval(step, duration);
    }

    /**
     * Initializes zoom functionality for iframes and images.
     * Call this method after DOM is ready.
     */
    refreshSlideshows() {
        // Restart all active slideshows (called on periodic fetch)
        document.querySelectorAll('.slideshow-carousel[data-images]').forEach(carousel => {
            let urls;
            try { urls = JSON.parse(carousel.dataset.images); } catch(e) { return; }
            if (!Array.isArray(urls) || urls.length < 2) return;
            const imgEl = carousel.querySelector('.slide-img');
            const progressBar = carousel.querySelector('.slide-progress');
            const counterEl = carousel.querySelector('.slide-counter');
            if (imgEl) this._startCardSlideshow(carousel, imgEl, urls, progressBar, counterEl);
        });
    }

    initZoomHandlers() {
        // Iframe zoom - double-click to toggle fullscreen
        document.querySelectorAll('.iframe-container').forEach(container => {
            // Add close button if not present
            if (!container.querySelector('.iframe-zoom-close')) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'iframe-zoom-close';
                closeBtn.innerHTML = '×';
                closeBtn.title = 'Close fullscreen (Esc)';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    container.classList.remove('zoomed');
                });
                container.appendChild(closeBtn);
            }

            container.addEventListener('dblclick', (e) => {
                // Don't zoom if clicking on iframe directly (to avoid interference with iframe content)
                if (e.target.tagName !== 'IFRAME') {
                    container.classList.toggle('zoomed');
                }
            });
        });

        // Global escape key to close zoomed iframes and image overlays
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.iframe-container.zoomed').forEach(container => {
                    container.classList.remove('zoomed');
                });
                // Also close any image zoom overlays
                document.querySelectorAll('.image-zoom-overlay').forEach(overlay => {
                    overlay.remove();
                });
            }
        });

        // Image zoom - click to open fullscreen overlay
        this.initImageZoomHandlers();
    }

    /**
     * Initializes image zoom handlers for user thumbnails in scroll lists.
     */
    initImageZoomHandlers() {
        document.addEventListener('click', (e) => {
            const img = e.target.closest('.user-image-container img');
            if (img && !e.target.closest('.image-zoom-overlay')) {
                e.preventDefault();
                e.stopPropagation();
                this.openImageZoom(img.src, img.alt);
            }
        });
    }

    /**
     * Opens a fullscreen overlay with the zoomed image.
     * @param {string} src - Image source URL
     * @param {string} alt - Image alt text
     */
    openImageZoom(src, alt) {
        // Remove any existing overlay
        document.querySelectorAll('.image-zoom-overlay').forEach(overlay => overlay.remove());

        const overlay = document.createElement('div');
        overlay.className = 'image-zoom-overlay';
        
        // Create image element programmatically to avoid XSS
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt || 'Zoomed image';
        overlay.appendChild(img);
        
        overlay.addEventListener('click', () => {
            overlay.remove();
        });

        document.body.appendChild(overlay);
    }
}

// To make UIManager available if not using modules:
// window.UIManager = UIManager;
// However, script.js will instantiate it directly.
