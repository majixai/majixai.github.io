/**
 * @file UI Manager for the Best Performers Application.
 * @description Handles DOM manipulation, rendering, and user interactions.
 */

class UIManager {
    // DOM element references
    #_gridContainer;
    #_iframeGrid;
    #_searchInput;
    #_refreshButton;
    #_statusBar;
    #_filterElements = {};
    #_snippetElements = {};
    #_currentLayout = AppConfig.DEFAULT_LAYOUT;
    #_viewerSlots = new Map(); // Maps slot number to performer username
    #_allPerformers = [];
    #_slideshowTimer = null;
    #_mlModel = null;
    #_mlModelPromise = null;
    #_predictionCache = new Map();
    #_contextMenu = null;
    #_contextMenuTarget = null;
    #_analyzeInterval = null;
    #_userLabels = new Map(); // Maps username to array of labels
    
    // Callbacks
    #_onPerformerSelectCallback;
    #_onRefreshCallback;
    #_onFilterChangeCallback;
    #_onSearchCallback;
    #_onShapeSettingsChangeCallback;

    constructor(callbacks = {}) {
        this.#_initDOMReferences();
        this.#_onPerformerSelectCallback = callbacks.onPerformerSelect;
        this.#_onRefreshCallback = callbacks.onRefresh;
        this.#_onFilterChangeCallback = callbacks.onFilterChange;
        this.#_onSearchCallback = callbacks.onSearch;
        this.#_onShapeSettingsChangeCallback = callbacks.onShapeSettingsChange;
        this.#_initEventListeners();
        this.#_setLayout(this.#_currentLayout);
        this.#_initLocalImageRecognition();
        this.#_initContextMenu();
        this.#_loadUserLabels();
    }

    /**
     * Initialize local image recognition model (non-generative ML).
     * Enhanced with configurable settings and periodic re-analysis.
     * @private
     */
    #_initLocalImageRecognition() {
        if (!window.mobilenet || !window.tf) {
            console.warn('UIManager: TensorFlow/MobileNet not available, skipping local vision labels.');
            return;
        }

        const mlConfig = AppConfig.ML_CONFIG;
        this.#_mlModelPromise = window.mobilenet.load({ 
            version: mlConfig.modelVersion, 
            alpha: mlConfig.modelAlpha 
        })
            .then((model) => {
                this.#_mlModel = model;
                console.log('UIManager: MobileNet model loaded successfully');
                this.#_analyzeVisibleCards();
                this.#_startPeriodicAnalysis();
                return model;
            })
            .catch((error) => {
                console.warn('UIManager: Failed to load MobileNet model:', error);
                return null;
            });
    }

    /**
     * Start periodic re-analysis of visible images
     * @private
     */
    #_startPeriodicAnalysis() {
        if (this.#_analyzeInterval) {
            clearInterval(this.#_analyzeInterval);
        }
        const interval = AppConfig.ML_CONFIG.analyzeInterval;
        if (interval > 0) {
            this.#_analyzeInterval = setInterval(() => {
                this.#_analyzeVisibleCards();
            }, interval);
        }
    }

    /**
     * Load user labels from IndexedDB
     * @private
     */
    async #_loadUserLabels() {
        try {
            const labels = await CacheManager.getAllLabels();
            this.#_userLabels.clear();
            for (const label of labels) {
                if (!this.#_userLabels.has(label.username)) {
                    this.#_userLabels.set(label.username, []);
                }
                this.#_userLabels.get(label.username).push(label);
            }
            console.log(`UIManager: Loaded ${labels.length} user labels`);
        } catch (error) {
            console.warn('UIManager: Failed to load user labels:', error);
        }
    }

    /**
     * Initialize the right-click context menu for image labeling
     * @private
     */
    #_initContextMenu() {
        // Create context menu element
        this.#_contextMenu = document.createElement('div');
        this.#_contextMenu.id = 'imageContextMenu';
        this.#_contextMenu.className = 'context-menu';
        this.#_contextMenu.style.display = 'none';

        // Build menu items from label categories
        const categories = AppConfig.LABEL_CATEGORIES;
        let menuHTML = '<div class="context-menu-header">🏷️ Add Label</div>';
        for (const cat of categories) {
            if (cat.id === 'custom') {
                menuHTML += `<div class="context-menu-divider"></div>`;
            }
            menuHTML += `
                <div class="context-menu-item" data-label-id="${cat.id}" style="--label-color: ${cat.color}">
                    <span class="label-indicator" style="background: ${cat.color}">${cat.shortLabel}</span>
                    <span class="label-text">${cat.label}</span>
                </div>
            `;
        }
        menuHTML += `<div class="context-menu-divider"></div>`;
        menuHTML += `<div class="context-menu-item" data-action="view-sidebyside">📺 View Side-by-Side</div>`;
        menuHTML += `<div class="context-menu-item" data-action="view-stacked">📱 View Stacked</div>`;
        menuHTML += `<div class="context-menu-divider"></div>`;
        menuHTML += `<div class="context-menu-item context-menu-cancel" data-action="cancel">❌ Cancel</div>`;
        
        this.#_contextMenu.innerHTML = menuHTML;
        document.body.appendChild(this.#_contextMenu);

        // Handle menu item clicks
        this.#_contextMenu.addEventListener('click', async (e) => {
            const item = e.target.closest('.context-menu-item');
            if (!item) return;

            const labelId = item.dataset.labelId;
            const action = item.dataset.action;

            if (action === 'cancel') {
                this.#_hideContextMenu();
                return;
            }

            if (action === 'view-sidebyside' && this.#_contextMenuTarget) {
                await this.#_openPerformerView(this.#_contextMenuTarget.username, 'sidebyside');
                this.#_hideContextMenu();
                return;
            }

            if (action === 'view-stacked' && this.#_contextMenuTarget) {
                await this.#_openPerformerView(this.#_contextMenuTarget.username, 'stacked');
                this.#_hideContextMenu();
                return;
            }

            if (labelId && this.#_contextMenuTarget) {
                await this.#_applyLabel(labelId, this.#_contextMenuTarget);
            }

            this.#_hideContextMenu();
        });

        // Hide menu on outside click
        document.addEventListener('click', (e) => {
            if (!this.#_contextMenu.contains(e.target)) {
                this.#_hideContextMenu();
            }
        });

        // Hide menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.#_hideContextMenu();
            }
        });
    }

    /**
     * Show context menu at position
     * @private
     */
    #_showContextMenu(x, y, targetData) {
        this.#_contextMenuTarget = targetData;
        this.#_contextMenu.style.left = `${x}px`;
        this.#_contextMenu.style.top = `${y}px`;
        this.#_contextMenu.style.display = 'block';

        // Ensure menu stays within viewport
        const rect = this.#_contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.#_contextMenu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.#_contextMenu.style.top = `${y - rect.height}px`;
        }
    }

    /**
     * Hide context menu
     * @private
     */
    #_hideContextMenu() {
        this.#_contextMenu.style.display = 'none';
        this.#_contextMenuTarget = null;
    }

    /**
     * Apply a label to an image
     * @private
     */
    async #_applyLabel(labelId, targetData) {
        let customText = '';
        if (labelId === 'custom') {
            customText = prompt('Enter custom label:');
            if (!customText) return;
        }

        try {
            const labelData = {
                imageUrl: targetData.imageUrl,
                username: targetData.username,
                labelId: labelId,
                customText: customText,
                x: targetData.x,
                y: targetData.y,
                slotNumber: targetData.slotNumber
            };

            await CacheManager.addImageLabel(labelData);

            // Update local cache
            if (!this.#_userLabels.has(targetData.username)) {
                this.#_userLabels.set(targetData.username, []);
            }
            this.#_userLabels.get(targetData.username).push(labelData);

            // Update UI to show the new label
            this.#_updateLabelBadges(targetData.username);

            console.log(`Label applied: ${labelId} to ${targetData.username}`);
        } catch (error) {
            console.error('Failed to apply label:', error);
        }
    }

    /**
     * Update label badges for a performer card
     * @private
     */
    #_updateLabelBadges(username) {
        const card = this.#_gridContainer?.querySelector(`[data-username="${username}"]`);
        if (!card) return;

        const labels = this.#_userLabels.get(username) || [];
        let badgeContainer = card.querySelector('.user-label-badges');
        
        if (!badgeContainer) {
            badgeContainer = document.createElement('div');
            badgeContainer.className = 'user-label-badges';
            const imageContainer = card.querySelector('.card-image-container');
            if (imageContainer) {
                imageContainer.appendChild(badgeContainer);
            }
        }

        // Get unique labels
        const uniqueLabels = [...new Set(labels.map(l => l.labelId))];
        const categories = AppConfig.LABEL_CATEGORIES;
        
        badgeContainer.innerHTML = '';
        for (const labelId of uniqueLabels) {
            const cat = categories.find(c => c.id === labelId);
            if (cat) {
                const badge = document.createElement('span');
                badge.className = 'user-label-badge';
                badge.style.background = cat.color;
                badge.textContent = cat.shortLabel;
                badge.title = cat.label;
                badgeContainer.appendChild(badge);
            }
        }
    }

    /**
     * Initialize DOM references
     * @private
     */
    #_initDOMReferences() {
        this.#_gridContainer = document.querySelector('#performerGrid');
        this.#_iframeGrid = document.querySelector('#iframeGrid');
        this.#_searchInput = document.querySelector('#searchInput');
        this.#_refreshButton = document.querySelector('#refreshButton');
        this.#_statusBar = {
            count: document.querySelector('#performerCount'),
            status: document.querySelector('#onlineStatus'),
            lastUpdate: document.querySelector('#lastUpdate')
        };
        
        // Filter elements
        this.#_filterElements = {
            sortBy: document.querySelector('#sortBy'),
            gender: document.querySelector('#filterGender'),
            ageMin: document.querySelector('#filterAgeMin'),
            ageMax: document.querySelector('#filterAgeMax'),
            tags: document.querySelector('#filterTags'),
            layout: document.querySelector('#viewerLayoutSelect'),
            applyBtn: document.querySelector('#applyFilters'),
            resetBtn: document.querySelector('#resetFilters'),
            toggleBtn: document.querySelector('#toggleFilters'),
            panel: document.querySelector('#filtersPanel'),
            targetSlot: document.querySelector('#targetSlot')
        };

        // Snippet elements
        this.#_snippetElements = {
            toggleBtn: document.querySelector('#toggleSnippets'),
            panel: document.querySelector('#snippetsPanel'),
            input: document.querySelector('#newSnippetInput'),
            saveBtn: document.querySelector('#saveSnippetButton'),
            list: document.querySelector('#snippetsList'),
            status: document.querySelector('#snippetStatus'),
            mainTextArea: document.querySelector('#mainTextArea'),
            autocomplete: document.querySelector('#autocompleteSuggestions')
        };

        // Validate critical elements
        if (!this.#_gridContainer || !this.#_iframeGrid) {
            console.error("UIManager: Critical DOM elements not found");
        }
    }

    /**
     * Initialize event listeners
     * @private
     */
    #_initEventListeners() {
        // Search input with debounce
        let searchTimeout;
        this.#_searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (this.#_onSearchCallback) {
                    this.#_onSearchCallback(e.target.value);
                }
            }, 300);
        });

        // Refresh button
        this.#_refreshButton?.addEventListener('click', () => {
            if (this.#_onRefreshCallback) {
                this.#_onRefreshCallback();
            }
        });

        // Filter panel toggle
        this.#_filterElements.toggleBtn?.addEventListener('click', () => {
            const panel = this.#_filterElements.panel;
            if (panel) {
                const isVisible = panel.style.display !== 'none';
                panel.style.display = isVisible ? 'none' : 'block';
                this.#_filterElements.toggleBtn.textContent = isVisible ? 'Filters ▼' : 'Filters ▲';
            }
        });

        // Snippet panel toggle
        this.#_snippetElements.toggleBtn?.addEventListener('click', () => {
            const panel = this.#_snippetElements.panel;
            if (panel) {
                const isVisible = panel.style.display !== 'none';
                panel.style.display = isVisible ? 'none' : 'block';
                this.#_snippetElements.toggleBtn.textContent = isVisible ? 'Snippets ▼' : 'Snippets ▲';
            }
        });

        // Apply filters
        this.#_filterElements.applyBtn?.addEventListener('click', () => {
            if (this.#_onFilterChangeCallback) {
                this.#_onFilterChangeCallback(this.getFilters());
            }
        });

        // Reset filters
        this.#_filterElements.resetBtn?.addEventListener('click', () => {
            this.resetFilters();
            if (this.#_onFilterChangeCallback) {
                this.#_onFilterChangeCallback(this.getFilters());
            }
        });

        // Layout selector
        this.#_filterElements.layout?.addEventListener('change', (e) => {
            this.#_setLayout(parseInt(e.target.value));
        });

        // Quick filter buttons
        document.querySelectorAll('.quick-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filterType = btn.dataset.filter;
                const filterValue = btn.dataset.value;
                
                // Toggle active state
                btn.classList.toggle('active');
                
                // Apply the quick filter
                this.#_applyQuickFilter(filterType, filterValue, btn.classList.contains('active'));
            });
        });

        // Performer grid click (event delegation)
        this.#_gridContainer?.addEventListener('click', (e) => {
            const openIframeButton = e.target.closest('.open-iframe-btn');
            if (openIframeButton) {
                e.preventDefault();
                e.stopPropagation();
                const buttonCard = openIframeButton.closest('.performer-card');
                if (buttonCard && this.#_onPerformerSelectCallback) {
                    try {
                        const performerData = JSON.parse(buttonCard.dataset.performer);
                        this.#_onPerformerSelectCallback(performerData);
                    } catch (error) {
                        console.error("Error parsing performer data from iframe open button:", error);
                    }
                }
                return;
            }

            const card = e.target.closest('.performer-card');
            if (card && this.#_onPerformerSelectCallback) {
                try {
                    const performerData = JSON.parse(card.dataset.performer);
                    this.#_onPerformerSelectCallback(performerData);
                } catch (error) {
                    console.error("Error parsing performer data:", error);
                }
            }
        });

        // Iframe close buttons
        this.#_iframeGrid?.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-iframe-btn')) {
                const wrapper = e.target.closest('.iframe-wrapper');
                if (wrapper) {
                    const slot = parseInt(wrapper.dataset.slot);
                    this.clearIframeSlot(slot);
                }
            }
        });

        // IntersectionObserver sentinel replaces "Load More" button
        // The sentinel is appended/replaced by showLoadMore(); clicking the button is kept as a fallback.
        document.querySelector('#loadMoreBtn')?.addEventListener('click', () => {
            if (this.#_onFilterChangeCallback) {
                this.#_onFilterChangeCallback(this.getFilters(), true); // true = load more
            }
        });

        // Right-click context menu for performer cards
        this.#_gridContainer?.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.performer-card');
            const img = e.target.closest('img[data-role="performer-image"]');
            if (card && img) {
                e.preventDefault();
                try {
                    const performerData = JSON.parse(card.dataset.performer);
                    const rect = img.getBoundingClientRect();
                    const coords = this.#_calculatePercentCoords(
                        e.clientX - rect.left, 
                        e.clientY - rect.top, 
                        rect.width, 
                        rect.height
                    );
                    
                    this.#_showContextMenu(e.clientX, e.clientY, {
                        imageUrl: img.dataset.imgUrl || img.src,
                        username: performerData.username,
                        x: coords.xPercent,
                        y: coords.yPercent,
                        slotNumber: null
                    });
                } catch (error) {
                    console.error("Error handling context menu:", error);
                }
            }
        });

        // Right-click context menu for iframe wrappers
        this.#_iframeGrid?.addEventListener('contextmenu', (e) => {
            const wrapper = e.target.closest('.iframe-wrapper');
            if (wrapper) {
                e.preventDefault();
                const slot = parseInt(wrapper.dataset.slot);
                const username = this.#_getSlotUsername(slot);
                if (username) {
                    const rect = wrapper.getBoundingClientRect();
                    const coords = this.#_calculatePercentCoords(
                        e.clientX - rect.left, 
                        e.clientY - rect.top, 
                        rect.width, 
                        rect.height
                    );
                    
                    this.#_showContextMenu(e.clientX, e.clientY, {
                        imageUrl: '',
                        username: username,
                        x: coords.xPercent,
                        y: coords.yPercent,
                        slotNumber: slot
                    });
                }
            }
        });

        // Shape settings listeners
        this.#_initShapeSettingsListeners();
    }

    /**
     * Get username for a slot number
     * @private
     */
    #_getSlotUsername(slot) {
        for (const [username, slotNum] of this.#_viewerSlots) {
            if (slotNum === slot) return username;
        }
        return null;
    }

    /**
     * Apply quick filter
     * @private
     */
    #_applyQuickFilter(type, value, isActive) {
        switch (type) {
            case 'age':
                if (isActive) {
                    this.#_filterElements.ageMin.value = value;
                    this.#_filterElements.ageMax.value = value;
                } else {
                    this.#_filterElements.ageMin.value = 18;
                    this.#_filterElements.ageMax.value = 99;
                }
                break;
            case 'tag':
                const currentTags = this.#_filterElements.tags.value.split(',').map(t => t.trim()).filter(t => t);
                if (isActive) {
                    if (!currentTags.includes(value)) {
                        currentTags.push(value);
                    }
                } else {
                    const idx = currentTags.indexOf(value);
                    if (idx > -1) currentTags.splice(idx, 1);
                }
                this.#_filterElements.tags.value = currentTags.join(', ');
                break;
            case 'new':
                // Handle new models filter (would need custom handling)
                break;
        }
        
        if (this.#_onFilterChangeCallback) {
            this.#_onFilterChangeCallback(this.getFilters());
        }
    }

    /**
     * Set the viewer layout (number of visible iframes)
     * @private
     */
    #_setLayout(count) {
        this.#_currentLayout = count;
        
        // Remove existing layout classes
        this.#_iframeGrid.className = 'iframe-grid';
        this.#_iframeGrid.classList.add(`layout-${count}`);

        // Show/hide iframe wrappers based on layout
        const wrappers = this.#_iframeGrid.querySelectorAll('.iframe-wrapper');
        wrappers.forEach((wrapper, index) => {
            if (index < count) {
                wrapper.classList.remove('hidden');
            } else {
                wrapper.classList.add('hidden');
            }
        });
    }

    /**
     * Get current filter values
     * @returns {Object}
     */
    getFilters() {
        const tags = this.#_filterElements.tags?.value
            .split(',')
            .map(t => t.trim())
            .filter(t => t);

        return {
            sortBy: this.#_filterElements.sortBy?.value || 'viewers_desc',
            gender: this.#_filterElements.gender?.value || 'f',
            ageMin: parseInt(this.#_filterElements.ageMin?.value) || 18,
            ageMax: parseInt(this.#_filterElements.ageMax?.value) || 99,
            tags: tags,
            search: this.#_searchInput?.value || ''
        };
    }

    /**
     * Reset filters to defaults
     */
    resetFilters() {
        const defaults = AppConfig.DEFAULT_FILTERS;
        if (this.#_filterElements.sortBy) this.#_filterElements.sortBy.value = defaults.sortBy;
        if (this.#_filterElements.gender) this.#_filterElements.gender.value = defaults.gender;
        if (this.#_filterElements.ageMin) this.#_filterElements.ageMin.value = defaults.ageMin;
        if (this.#_filterElements.ageMax) this.#_filterElements.ageMax.value = defaults.ageMax;
        if (this.#_filterElements.tags) this.#_filterElements.tags.value = '';
        if (this.#_searchInput) this.#_searchInput.value = '';

        // Reset quick filter buttons
        document.querySelectorAll('.quick-filter-btn.active').forEach(btn => {
            btn.classList.remove('active');
        });
    }

    /**
     * Render performers to the grid
     * @param {Array<Object>} performers 
     * @param {boolean} append - Whether to append to existing or replace
     */
    renderPerformers(performers, append = false) {
        if (!append) {
            this.#_gridContainer.innerHTML = '';
            this.#_allPerformers = [...performers];
        } else {
            this.#_allPerformers = [...this.#_allPerformers, ...performers];
        }

        if (performers.length === 0 && !append) {
            this.#_gridContainer.innerHTML = '<p class="loading-message">No performers found matching your criteria.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        performers.forEach((performer, index) => {
            fragment.appendChild(this.#_createPerformerCard(performer, index + 1));
        });
        this.#_gridContainer.appendChild(fragment);

        // Update cards that are currently in viewer
        this.#_updateViewerIndicators();
        this.#_analyzeVisibleCards();
        this.#_startAutoSlideshow();
    }

    /**
     * Create a performer card element
     * @private
     */
    #_createPerformerCard(performer, rank) {
        const card = document.createElement('div');
        card.className = 'performer-card';
        card.dataset.performer = JSON.stringify(performer);
        card.dataset.username = performer.username;

        const name = performer.display_name || performer.username;
        const imageUrl = performer.image_url || 'placeholder.svg';
        const viewers = performer.num_viewers || 0;
        const age = performer.age || '?';
        const rankScore = performer.rankScore || 0;

        // Check if this performer is in a viewer
        if (this.#_viewerSlots.has(performer.username)) {
            card.classList.add('in-viewer');
        }

        card.innerHTML = `
            <div class="card-image-container">
                <img src="${LAZY_PLACEHOLDER}" data-src="${imageUrl}" data-img-url="${imageUrl}" alt="${this.#_escapeHtml(name)}" data-role="performer-image">
                ${window.IframeOpenControls?.buildOpenButtonHTML({ title: 'Open performer in viewer' }) || '<button type="button" class="open-iframe-btn" title="Open performer in viewer" aria-label="Open performer in viewer">📺</button>'}
                <div class="card-badges">
                    ${performer.is_new ? '<span class="badge badge-new">NEW</span>' : ''}
                    ${rank <= 10 ? `<span class="badge badge-rank">#${rank}</span>` : ''}
                    <span class="badge badge-viewers">👁 ${this.#_formatViewers(viewers)}</span>
                </div>
                <div class="card-overlay">
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                </div>
            </div>
            <div class="card-content">
                <h3>${this.#_escapeHtml(name)}</h3>
                <div class="card-meta">
                    <span>Age: ${age}</span>
                    <span class="card-score">★ ${rankScore}</span>
                </div>
                <div class="card-vision" data-vision-for="${this.#_escapeHtml(performer.username)}">Vision: pending...</div>
            </div>
        `;

        // Lazy-load the card image once it enters the viewport
        const lazyImg = card.querySelector('img[data-src]');
        if (lazyImg) LazyImageObserver.observe(lazyImg);

        return card;
    }

    /**
     * Format a single prediction label (strips extra comma-separated details)
     * @private
     */
    #_formatPredictionLabel(label, confidence) {
        const shortLabel = label.split(',')[0].trim();
        return `${shortLabel} ${confidence}%`;
    }

    /**
     * Format multiple predictions into a display string
     * @private
     */
    #_formatPredictionText(prediction, maxPreds = 3) {
        if (!prediction) return 'unavailable';
        
        if (prediction.predictions && prediction.predictions.length > 1) {
            const topPreds = prediction.predictions.slice(0, maxPreds)
                .map(p => this.#_formatPredictionLabel(p.label, p.confidence))
                .join(' | ');
            return topPreds;
        }
        return this.#_formatPredictionLabel(prediction.label, prediction.confidence);
    }

    /**
     * Calculate percentage coordinates from mouse event
     * @private
     */
    #_calculatePercentCoords(x, y, width, height) {
        return {
            xPercent: Math.round((x / width) * 100),
            yPercent: Math.round((y / height) * 100)
        };
    }

    /**
     * Infer image labels and confidence for an image URL.
     * Returns top N predictions based on ML_CONFIG.topPredictions.
     * @private
     */
    async #_inferImageLabel(imageUrl) {
        if (!imageUrl) return null;
        if (this.#_predictionCache.has(imageUrl)) {
            return this.#_predictionCache.get(imageUrl);
        }

        if (!this.#_mlModel && this.#_mlModelPromise) {
            await this.#_mlModelPromise;
        }
        if (!this.#_mlModel) return null;

        const mlConfig = AppConfig.ML_CONFIG;
        const img = new Image();
        img.crossOrigin = 'anonymous';

        const loaded = new Promise((resolve, reject) => {
            img.onload = () => resolve(true);
            img.onerror = () => reject(new Error('image load failed'));
        });

        img.src = imageUrl;
        try {
            await loaded;
            const predictions = await this.#_mlModel.classify(img, mlConfig.topPredictions);
            if (!predictions || !predictions.length) {
                return null;
            }
            
            // Filter by confidence threshold and format results
            const filtered = predictions
                .filter(p => Math.round((p.probability || 0) * 100) >= mlConfig.confidenceThreshold)
                .map(p => ({
                    label: p.className,
                    confidence: Math.round((p.probability || 0) * 100)
                }));

            if (filtered.length === 0) return null;

            const result = {
                label: filtered[0].label,
                confidence: filtered[0].confidence,
                predictions: filtered  // Array of all top predictions
            };
            this.#_predictionCache.set(imageUrl, result);
            return result;
        } catch (error) {
            return null;
        }
    }

    /**
     * Analyze currently visible performer cards.
     * Enhanced to show multiple predictions.
     * @private
     */
    async #_analyzeVisibleCards() {
        if (!this.#_gridContainer) return;
        const cards = Array.from(this.#_gridContainer.querySelectorAll('.performer-card'));
        for (const card of cards) {
            const image = card.querySelector('img[data-role="performer-image"]');
            const visionEl = card.querySelector('.card-vision');
            if (!image || !visionEl) continue;
            const prediction = await this.#_inferImageLabel(image.dataset.imgUrl || image.src);
            if (!prediction) {
                visionEl.textContent = 'Vision: unavailable';
                continue;
            }
            
            // Display top predictions with confidences using helper method
            visionEl.textContent = `🔍 ${this.#_formatPredictionText(prediction, 3)}`;
            if (prediction.predictions) {
                visionEl.title = prediction.predictions.map(p => `${p.label} (${p.confidence}%)`).join('\n');
            }

            // Also update any existing user labels
            try {
                const performerData = JSON.parse(card.dataset.performer);
                this.#_updateLabelBadges(performerData.username);
            } catch (err) {
                // Ignore parse errors
            }
        }
    }

    /**
     * Set local vision label pill on viewer slot header.
     * @private
     */
    #_setViewerVisionPill(slot, text) {
        const wrapper = this.#_iframeGrid?.querySelector(`.iframe-wrapper[data-slot="${slot}"]`);
        const header = wrapper?.querySelector('.iframe-header');
        if (!header) return;

        let pill = header.querySelector('.vision-pill');
        if (!pill) {
            pill = document.createElement('span');
            pill.className = 'vision-pill';
            header.appendChild(pill);
        }
        pill.textContent = text;
    }

    /**
     * Stop any active slideshow timer.
     * Each card displays only its own performer's image, not random images from other performers.
     * @private
     */
    #_startAutoSlideshow() {
        if (this.#_slideshowTimer) {
            clearTimeout(this.#_slideshowTimer);
            this.#_slideshowTimer = null;
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @private
     */
    #_escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format viewer count
     * @private
     */
    #_formatViewers(count) {
        if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'k';
        }
        return count.toString();
    }

    /**
     * Update the iframe viewer with a performer
     * @param {Object} performer 
     * @param {number} slot - Slot number (1-9), or 'auto' for next empty
     */
    async updateViewer(performer, slot = 'auto') {
        if (!performer || !performer.username) return;

        // Determine which slot to use
        let targetSlot;
        if (slot === 'auto') {
            const selectedSlot = this.#_filterElements.targetSlot?.value;
            if (selectedSlot && selectedSlot !== 'auto') {
                targetSlot = parseInt(selectedSlot);
            } else {
                // Find next empty slot
                targetSlot = this.#_findEmptySlot();
            }
        } else {
            targetSlot = slot;
        }

        if (!targetSlot || targetSlot > this.#_currentLayout) {
            console.warn("No available slot for viewer");
            return;
        }

        const iframe = document.querySelector(`#iframe${targetSlot}`);
        const wrapper = iframe?.closest('.iframe-wrapper');
        const nameSpan = wrapper?.querySelector('.performer-name');

        if (iframe) {
            const iframeSrc = AppConfig.buildIframeUrl(performer.username);
            if (!iframeSrc) {
                console.warn("Invalid username for viewer");
                return;
            }
            iframe.src = iframeSrc;
            
            // Remove from previous slot if already viewing
            for (const [username, existingSlot] of this.#_viewerSlots) {
                if (username === performer.username && existingSlot !== targetSlot) {
                    this.clearIframeSlot(existingSlot);
                }
            }

            // Update slot tracking
            this.#_viewerSlots.set(performer.username, targetSlot);
            
            if (nameSpan) {
                nameSpan.textContent = performer.display_name || performer.username;
            }

            this.#_setViewerVisionPill(targetSlot, '🔍 analyzing...');
            const prediction = await this.#_inferImageLabel(performer.image_url || performer.profile_pic_url);
            if (prediction) {
                this.#_setViewerVisionPill(targetSlot, `🔍 ${this.#_formatPredictionText(prediction, 2)}`);
            } else {
                this.#_setViewerVisionPill(targetSlot, '🔍 unavailable');
            }

            this.#_updateViewerIndicators();
        }
    }

    /**
     * Find next empty slot
     * @private
     */
    #_findEmptySlot() {
        const usedSlots = new Set(this.#_viewerSlots.values());
        for (let i = 1; i <= this.#_currentLayout; i++) {
            if (!usedSlots.has(i)) return i;
        }
        // If all full, replace slot 1
        return 1;
    }

    /**
     * Clear an iframe slot
     * @param {number} slot 
     */
    clearIframeSlot(slot) {
        const iframe = document.querySelector(`#iframe${slot}`);
        const wrapper = iframe?.closest('.iframe-wrapper');
        const nameSpan = wrapper?.querySelector('.performer-name');

        if (iframe) {
            iframe.src = 'about:blank';
        }
        if (nameSpan) {
            nameSpan.textContent = '-';
        }
        this.#_setViewerVisionPill(slot, 'Vision: -');

        // Remove from tracking
        for (const [username, existingSlot] of this.#_viewerSlots) {
            if (existingSlot === slot) {
                this.#_viewerSlots.delete(username);
                break;
            }
        }

        this.#_updateViewerIndicators();
    }

    /**
     * Update card indicators for performers in viewers
     * @private
     */
    #_updateViewerIndicators() {
        // Remove all in-viewer classes
        this.#_gridContainer.querySelectorAll('.performer-card.in-viewer').forEach(card => {
            card.classList.remove('in-viewer');
        });

        // Add in-viewer class to current viewers
        for (const username of this.#_viewerSlots.keys()) {
            const card = this.#_gridContainer.querySelector(`[data-username="${username}"]`);
            if (card) {
                card.classList.add('in-viewer');
            }
        }
    }

    /**
     * Auto-populate viewer slots with top performers
     * @param {Array<Object>} performers 
     */
    autoPopulateViewers(performers) {
        const count = Math.min(this.#_currentLayout, performers.length);
        for (let i = 0; i < count; i++) {
            this.updateViewer(performers[i], i + 1);
        }
    }

    // ==================== Status Bar Methods ====================

    /**
     * Update status bar
     * @param {Object} status 
     */
    updateStatus(status) {
        if (status.count !== undefined) {
            this.#_statusBar.count.textContent = `${status.count} performers online`;
        }
        if (status.lastUpdate) {
            const time = new Date(status.lastUpdate).toLocaleTimeString();
            this.#_statusBar.lastUpdate.textContent = `Updated: ${time}`;
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.#_gridContainer.innerHTML = '<p class="loading-message">Loading performers...</p>';
        document.querySelector('#loadingIndicator').style.display = 'block';
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        document.querySelector('#loadingIndicator').style.display = 'none';
    }

    /**
     * Show/hide load more. When showing, attaches an IntersectionObserver sentinel
     * that auto-triggers loading; falls back to the visible button for manual trigger.
     * @param {boolean} show 
     */
    showLoadMore(show) {
        const btn = document.querySelector('#loadMoreBtn');
        const container = document.querySelector('#loadMoreContainer');
        if (btn) btn.style.display = show ? 'inline-block' : 'none';

        // Detach any existing sentinel
        container?.querySelector('.performers-sentinel')?.remove();
        if (this._loadMoreSentinelObserver) {
            this._loadMoreSentinelObserver.disconnect();
            this._loadMoreSentinelObserver = null;
        }

        if (show && container && this.#_onFilterChangeCallback) {
            const sentinel = document.createElement('div');
            sentinel.className = 'performers-sentinel';
            sentinel.style.cssText = 'height:1px;visibility:hidden;pointer-events:none;';
            container.appendChild(sentinel);
            this._loadMoreSentinelObserver = createSentinelObserver(() => {
                if (this.#_onFilterChangeCallback) {
                    this.#_onFilterChangeCallback(this.getFilters(), true);
                }
            });
            this._loadMoreSentinelObserver.observe(sentinel);
        }
    }

    /**
     * Show error message
     * @param {string} message 
     */
    showError(message) {
        this.#_gridContainer.innerHTML = `<p class="error-message">Error: ${this.#_escapeHtml(message)}</p>`;
    }

    // ==================== Snippet Methods ====================

    /**
     * Render snippets list
     * @param {Array<Object>} snippets 
     */
    renderSnippets(snippets) {
        if (!this.#_snippetElements.list) return;

        if (!snippets || snippets.length === 0) {
            this.#_snippetElements.list.innerHTML = '<p class="text-muted">No snippets saved yet.</p>';
            return;
        }

        this.#_snippetElements.list.innerHTML = '';
        const fragment = document.createDocumentFragment();

        snippets.forEach(snippet => {
            const item = document.createElement('div');
            item.className = 'snippet-item';
            item.innerHTML = `
                <span class="snippet-text">${this.#_escapeHtml(snippet.text.substring(0, 50))}${snippet.text.length > 50 ? '...' : ''}</span>
                <span class="delete-btn" data-id="${snippet.id}" title="Delete">×</span>
            `;
            
            item.querySelector('.snippet-text').addEventListener('click', () => {
                navigator.clipboard.writeText(snippet.text)
                    .then(() => this.showSnippetStatus('Copied to clipboard!', 'success'))
                    .catch(() => this.showSnippetStatus('Failed to copy', 'error'));
            });

            fragment.appendChild(item);
        });

        this.#_snippetElements.list.appendChild(fragment);
    }

    /**
     * Get snippet input value
     * @returns {string}
     */
    getSnippetInput() {
        return this.#_snippetElements.input?.value || '';
    }

    /**
     * Clear snippet input
     */
    clearSnippetInput() {
        if (this.#_snippetElements.input) {
            this.#_snippetElements.input.value = '';
        }
    }

    /**
     * Show snippet status message
     * @param {string} message 
     * @param {string} type - 'success' or 'error'
     */
    showSnippetStatus(message, type = 'success') {
        const statusEl = this.#_snippetElements.status;
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `snippet-status ${type}`;
            statusEl.style.display = 'block';
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * Show autocomplete suggestions
     * @param {Array<Object>} snippets 
     */
    showAutocompleteSuggestions(snippets) {
        const container = this.#_snippetElements.autocomplete;
        if (!container || snippets.length === 0) {
            if (container) container.style.display = 'none';
            return;
        }

        container.innerHTML = '';
        snippets.forEach(snippet => {
            const div = document.createElement('div');
            div.textContent = snippet.text;
            div.addEventListener('click', () => {
                const textArea = this.#_snippetElements.mainTextArea;
                if (textArea) {
                    const currentText = textArea.value;
                    const triggerPos = currentText.lastIndexOf('{{');
                    if (triggerPos !== -1) {
                        textArea.value = currentText.substring(0, triggerPos) + snippet.text;
                    } else {
                        textArea.value += snippet.text;
                    }
                    textArea.focus();
                }
                container.style.display = 'none';
            });
            container.appendChild(div);
        });
        container.style.display = 'block';
    }

    /**
     * Hide autocomplete suggestions
     */
    hideAutocompleteSuggestions() {
        if (this.#_snippetElements.autocomplete) {
            this.#_snippetElements.autocomplete.style.display = 'none';
        }
    }

    /**
     * Get current viewer slot count
     * @returns {number}
     */
    getCurrentLayout() {
        return this.#_currentLayout;
    }

    /**
     * Initializes zoom functionality for iframes and images.
     * Call this method after DOM is ready.
     */
    initZoomHandlers() {
        // Iframe zoom - double-click to toggle fullscreen
        document.querySelectorAll('.iframe-wrapper').forEach(wrapper => {
            // Add close button if not present
            if (!wrapper.querySelector('.iframe-zoom-close')) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'iframe-zoom-close';
                closeBtn.innerHTML = '×';
                closeBtn.title = 'Close fullscreen (Esc)';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    wrapper.classList.remove('zoomed');
                });
                wrapper.appendChild(closeBtn);
            }

            wrapper.addEventListener('dblclick', (e) => {
                // Don't zoom if clicking on iframe directly (to avoid interference with iframe content)
                // or if clicking close button
                if (e.target.tagName !== 'IFRAME' && !e.target.classList.contains('close-iframe-btn') && !e.target.classList.contains('iframe-zoom-close')) {
                    wrapper.classList.toggle('zoomed');
                }
            });
        });

        // Global escape key to close zoomed iframes
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.iframe-wrapper.zoomed').forEach(wrapper => {
                    wrapper.classList.remove('zoomed');
                });
                // Also close any image zoom overlays
                document.querySelectorAll('.image-zoom-overlay').forEach(overlay => {
                    overlay.remove();
                });
            }
        });

        // Image zoom - click to open fullscreen overlay for performer cards
        this.initImageZoomHandlers();
    }

    /**
     * Initializes image zoom handlers for performer thumbnails in the grid.
     * Uses Alt+click to avoid interfering with the normal card click behavior
     * (which selects a performer and loads them in a viewer).
     */
    initImageZoomHandlers() {
        document.addEventListener('click', (e) => {
            // Alt+click on performer images to zoom without triggering performer selection
            const img = e.target.closest('.card-image-container img');
            if (img && e.altKey && !e.target.closest('.image-zoom-overlay')) {
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

    /**
     * Open a performer view (iframe + slideshow) in side-by-side or stacked layout
     * @param {string} username - Performer username
     * @param {string} layout - 'sidebyside' or 'stacked'
     * @private
     */
    async #_openPerformerView(username, layout = 'sidebyside') {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'performer-view-modal';
        modal.innerHTML = `
            <div class="performer-view-container ${layout}">
                <button class="performer-view-close">×</button>
                <div class="performer-view-iframe">
                    <iframe src="${AppConfig.buildIframeUrl(username)}" 
                            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" 
                            sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-modals allow-downloads"
                            title="${username} live stream"></iframe>
                </div>
                <div class="performer-view-slideshow">
                    <div class="slideshow-header">
                        <h3>${username} Gallery</h3>
                        <button class="layout-toggle" data-current="${layout}">
                            ${layout === 'sidebyside' ? '📱 Stack' : '📺 Side-by-Side'}
                        </button>
                    </div>
                    <div class="slideshow-images">
                        <p>Loading images...</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        // Close button handler
        modal.querySelector('.performer-view-close').addEventListener('click', () => {
            modal.remove();
        });

        // Layout toggle handler
        modal.querySelector('.layout-toggle').addEventListener('click', (e) => {
            const container = modal.querySelector('.performer-view-container');
            const currentLayout = e.target.dataset.current;
            const newLayout = currentLayout === 'sidebyside' ? 'stacked' : 'sidebyside';
            
            container.classList.remove(currentLayout);
            container.classList.add(newLayout);
            e.target.dataset.current = newLayout;
            e.target.textContent = newLayout === 'sidebyside' ? '📱 Stack' : '📺 Side-by-Side';
        });

        // Track view event
        try {
            await CacheManager.trackEvent({
                username: username,
                eventType: 'iframe_open',
                metadata: { layout: layout }
            });
        } catch (error) {
            console.error("Error tracking iframe open:", error);
        }

        // Close on escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * Reorder performers by score (GPU-accelerated image similarity)
     * @param {Array} performers - Array of performer objects
     */
    async reorderPerformersByScore(performers) {
        if (!performers || performers.length === 0) return;

        // Get click statistics for all performers
        const performersWithScores = await Promise.all(
            performers.map(async (performer) => {
                try {
                    const stats = await CacheManager.getPerformerStats(performer.username);
                    return {
                        ...performer,
                        clickScore: stats.clickScore,
                        totalInteractions: stats.totalClicks + stats.totalViews
                    };
                } catch (error) {
                    return {
                        ...performer,
                        clickScore: 0,
                        totalInteractions: 0
                    };
                }
            })
        );

        // Sort by click score and interactions
        performersWithScores.sort((a, b) => {
            // First by click score
            if (b.clickScore !== a.clickScore) {
                return b.clickScore - a.clickScore;
            }
            // Then by total interactions
            if (b.totalInteractions !== a.totalInteractions) {
                return b.totalInteractions - a.totalInteractions;
            }
            // Finally by viewer count
            return (b.num_viewers || 0) - (a.num_viewers || 0);
        });

        // Re-render with new order
        this.renderPerformers(performersWithScores, false);
        
        console.log('Performers reordered by interaction score');
    }

    /**
     * GPU-accelerated image similarity using TensorFlow.js
     * Moves similar images of clicked performers toward the top and returns
     * the list of similar performers so callers can award them bonus points.
     * @param {string} clickedUsername - Username of the clicked performer
     * @returns {Promise<Array<{username: string, similarity: number}>>} Similar performers above threshold
     */
    async moveSimilarImagesToTop(clickedUsername) {
        if (!this.#_mlModel) {
            console.warn('ML model not loaded, cannot perform image similarity');
            return [];
        }

        try {
            // Get the clicked performer's image
            const clickedCard = this.#_gridContainer?.querySelector(`[data-performer*='"username":"${clickedUsername}"']`);
            if (!clickedCard) return [];

            const clickedImage = clickedCard.querySelector('img[data-role="performer-image"]');
            if (!clickedImage) return [];

            // Get features for clicked image
            const clickedFeatures = await this.#_getImageFeatures(clickedImage.dataset.imgUrl || clickedImage.src);
            if (!clickedFeatures) return [];

            // Calculate similarity for all visible performers
            const allCards = Array.from(this.#_gridContainer?.querySelectorAll('.performer-card') || []);
            const similarities = await Promise.all(
                allCards.map(async (card) => {
                    const img = card.querySelector('img[data-role="performer-image"]');
                    const imgSrc = img?.dataset.imgUrl || img?.src;
                    if (!img || imgSrc === (clickedImage.dataset.imgUrl || clickedImage.src)) {
                        return { card, username: null, similarity: 0 };
                    }

                    const features = await this.#_getImageFeatures(imgSrc);
                    if (!features) {
                        return { card, username: null, similarity: 0 };
                    }

                    // Extract username from data-performer attribute
                    let username = null;
                    try {
                        const performerData = JSON.parse(card.dataset.performer || '{}');
                        username = performerData.username || null;
                    } catch (_) { /* ignore parse errors */ }

                    // Calculate cosine similarity
                    const similarity = this.#_cosineSimilarity(clickedFeatures, features);
                    return { card, username, similarity };
                })
            );

            // Sort by similarity and reorder DOM
            similarities.sort((a, b) => b.similarity - a.similarity);
            
            // Move top similar cards to the front
            const topSimilar = similarities.slice(0, 10).filter(s => s.similarity > AppConfig.ML_CONFIG.similarityThreshold);
            topSimilar.forEach(({ card }) => {
                this.#_gridContainer?.insertBefore(card, this.#_gridContainer.firstChild);
            });

            console.log(`Moved ${topSimilar.length} similar images to top for ${clickedUsername}`);

            // Return username + similarity pairs so the engine can award bonus points
            return topSimilar
                .filter(s => s.username && s.username !== clickedUsername)
                .map(({ username, similarity }) => ({ username, similarity }));
        } catch (error) {
            console.error('Error in image similarity:', error);
            return [];
        }
    }

    /**
     * Get image features using MobileNet (GPU-accelerated)
     * @private
     */
    async #_getImageFeatures(imageUrl) {
        if (!this.#_mlModel) return null;

        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Image load failed'));
                img.src = imageUrl;
            });

            // Get embeddings (feature vector) from the model
            const features = this.#_mlModel.infer(img, true);
            return Array.from(await features.data());
        } catch (error) {
            return null;
        }
    }

    /**
     * Calculate cosine similarity between two feature vectors
     * @private
     */
    #_cosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }

        if (norm1 === 0 || norm2 === 0) return 0;
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * Get the ML model (for use by external components)
     * @returns {Promise<Object|null>}
     */
    async getMLModel() {
        if (this.#_mlModel) return this.#_mlModel;
        if (this.#_mlModelPromise) return this.#_mlModelPromise;
        return null;
    }
}

/**
 * @class BackgroundImageAnalyzer
 * @description Runs GPU image recognition on performer images in the background
 * every 60 seconds. Results are persisted to IndexedDB and made available for
 * relevance scoring. Implements a feedback loop where user interactions
 * influence analysis priority and analysis results influence ranking.
 */
class BackgroundImageAnalyzer {
    #_mlModel = null;
    #_intervalId = null;
    #_isRunning = false;
    #_onResultsCallback = null;
    #_analysisCount = 0;
    #_classificationCache = new Map(); // Cache classification results to reduce GPU work

    /**
     * @param {Object} options
     * @param {Function} [options.onResults] - Callback invoked with analysis results after each cycle
     */
    constructor(options = {}) {
        this.#_onResultsCallback = options.onResults || null;
    }

    /**
     * Set the ML model for GPU-accelerated image feature extraction
     * @param {Object} model - TensorFlow.js MobileNet model instance
     */
    setModel(model) {
        this.#_mlModel = model;
    }

    /**
     * Start the background analysis loop (every 60 seconds)
     */
    start() {
        if (this.#_intervalId) return;

        const interval = AppConfig.ML_CONFIG.backgroundAnalysisInterval;
        console.log(`BackgroundImageAnalyzer: Starting (interval: ${interval}ms)`);

        // Run an initial analysis after a short delay to let the page settle
        setTimeout(() => this.#_runAnalysisCycle(), 5000);

        this.#_intervalId = setInterval(() => {
            this.#_runAnalysisCycle();
        }, interval);
    }

    /**
     * Stop the background analysis loop
     */
    stop() {
        if (this.#_intervalId) {
            clearInterval(this.#_intervalId);
            this.#_intervalId = null;
        }
        console.log('BackgroundImageAnalyzer: Stopped');
    }

    /**
     * Whether the analyzer is currently active
     * @returns {boolean}
     */
    get isActive() {
        return this.#_intervalId !== null;
    }

    /**
     * Number of completed analysis cycles
     * @returns {number}
     */
    get analysisCount() {
        return this.#_analysisCount;
    }

    /**
     * Run a single background analysis cycle.
     * Selects performer images prioritized by feedback score, extracts features,
     * stores results, and invokes the callback for relevance scoring feedback.
     * @private
     */
    async #_runAnalysisCycle() {
        if (this.#_isRunning || !this.#_mlModel) return;
        this.#_isRunning = true;

        try {
            const batchSize = AppConfig.ML_CONFIG.backgroundBatchSize;
            const cards = this.#_getPerformerCards();
            if (cards.length === 0) {
                this.#_isRunning = false;
                return;
            }

            // Prioritize cards: prefer those with higher feedback or not yet analyzed
            const prioritized = await this.#_prioritizeCards(cards);
            const batch = prioritized.slice(0, batchSize);

            const results = [];
            for (const { username, imageUrl } of batch) {
                try {
                    const featureVector = await this.#_extractFeatures(imageUrl);
                    if (!featureVector) continue;

                    const predictions = await this.#_classifyImage(imageUrl);

                    const result = {
                        username,
                        imageUrl,
                        featureVector,
                        predictions: predictions || [],
                        analyzedAt: Date.now(),
                        feedbackScore: 0
                    };

                    // Preserve existing feedback score with time-based decay
                    const existing = await CacheManager.getRecognitionResult(username);
                    if (existing) {
                        const ageMinutes = (Date.now() - existing.analyzedAt) / 60000;
                        // Only apply decay if at least 5 minutes have passed since last analysis
                        if (ageMinutes >= 5) {
                            result.feedbackScore = existing.feedbackScore * AppConfig.ML_CONFIG.feedbackDecayFactor;
                        } else {
                            result.feedbackScore = existing.feedbackScore;
                        }
                    }

                    await CacheManager.saveRecognitionResult(result);
                    results.push(result);
                } catch (error) {
                    // Skip individual failures silently
                }
            }

            // Prune old results if cache exceeds max
            await CacheManager.pruneRecognitionResults(AppConfig.ML_CONFIG.maxCachedResults);

            this.#_analysisCount++;
            console.log(`BackgroundImageAnalyzer: Cycle ${this.#_analysisCount} completed, analyzed ${results.length} images`);

            // Invoke callback with results for relevance scoring feedback loop
            if (this.#_onResultsCallback && results.length > 0) {
                this.#_onResultsCallback(results);
            }
        } catch (error) {
            console.error('BackgroundImageAnalyzer: Cycle error:', error);
        } finally {
            this.#_isRunning = false;
        }
    }

    /**
     * Get performer card data from the DOM
     * @private
     * @returns {Array<{username: string, imageUrl: string}>}
     */
    #_getPerformerCards() {
        const gridContainer = document.querySelector('#performerGrid');
        if (!gridContainer) return [];

        const cards = Array.from(gridContainer.querySelectorAll('.performer-card'));
        const result = [];
        for (const card of cards) {
            try {
                const data = JSON.parse(card.dataset.performer || '{}');
                const img = card.querySelector('img[data-role="performer-image"]');
                if (data.username && (img?.dataset.imgUrl || img?.src)) {
                    result.push({ username: data.username, imageUrl: img.dataset.imgUrl || img.src });
                }
            } catch (e) {
                // Skip cards with invalid data
            }
        }
        return result;
    }

    /**
     * Prioritize cards for analysis: prefer unanalyzed or high-feedback performers
     * @private
     * @param {Array<{username: string, imageUrl: string}>} cards
     * @returns {Promise<Array<{username: string, imageUrl: string}>>}
     */
    async #_prioritizeCards(cards) {
        const scored = [];
        for (const card of cards) {
            try {
                const existing = await CacheManager.getRecognitionResult(card.username);
                let priority = 100; // High priority for unanalyzed
                if (existing) {
                    // Lower priority for recently analyzed, but boost by feedback
                    const ageMinutes = (Date.now() - existing.analyzedAt) / 60000;
                    priority = Math.min(ageMinutes, 60) + (existing.feedbackScore || 0);
                }
                scored.push({ ...card, priority });
            } catch (e) {
                scored.push({ ...card, priority: 50 });
            }
        }
        scored.sort((a, b) => b.priority - a.priority);
        return scored;
    }

    /**
     * Extract feature vector from an image using GPU-accelerated MobileNet
     * @private
     * @param {string} imageUrl
     * @returns {Promise<Array<number>|null>}
     */
    async #_extractFeatures(imageUrl) {
        if (!this.#_mlModel) return null;

        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            await new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Image load failed'));
                img.src = imageUrl;
            });

            const features = this.#_mlModel.infer(img, true);
            return Array.from(await features.data());
        } catch (error) {
            return null;
        }
    }

    /**
     * Classify an image and return top predictions
     * @private
     * @param {string} imageUrl
     * @returns {Promise<Array<{label: string, confidence: number}>|null>}
     */
    async #_classifyImage(imageUrl) {
        if (!this.#_mlModel) return null;

        // Use cached classification if available (labels rarely change for same image)
        const cached = this.#_classificationCache.get(imageUrl);
        if (cached && (Date.now() - cached.timestamp) < 300000) { // 5-minute TTL
            return cached.predictions;
        }

        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            await new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Image load failed'));
                img.src = imageUrl;
            });

            const predictions = await this.#_mlModel.classify(img, AppConfig.ML_CONFIG.topPredictions);
            const filtered = predictions.map(p => ({
                label: p.className,
                confidence: Math.round(p.probability * 100)
            })).filter(p => p.confidence >= AppConfig.ML_CONFIG.confidenceThreshold);

            this.#_classificationCache.set(imageUrl, { predictions: filtered, timestamp: Date.now() });
            return filtered;
        } catch (error) {
            return null;
        }
    }

    /**
     * Record positive feedback for a performer (called when user interacts)
     * This feeds back into the prioritization for future analysis cycles.
     * @param {string} username
     * @param {number} [weight=1] - Feedback weight (higher = stronger signal)
     */
    async recordFeedback(username, weight = 1) {
        try {
            await CacheManager.updateRecognitionFeedback(username, weight);
        } catch (error) {
            // Silently ignore feedback errors
        }
    }

    /**
     * Get recognition-based relevance score for a performer.
     * Uses stored feature vectors and feedback scores to compute relevance.
     * @param {string} username
     * @returns {Promise<number>} Relevance score (0-100)
     */
    async getRelevanceScore(username) {
        try {
            const result = await CacheManager.getRecognitionResult(username);
            if (!result) return 0;

            let score = 0;

            // Base score from feedback loop (0-50)
            score += Math.min(50, (result.feedbackScore || 0) * 5);

            // Recency bonus (0-25): gentler decay aligned with 60-second analysis interval
            // Full bonus for results < 2 minutes old, linear decay over 30 minutes
            const ageMinutes = (Date.now() - result.analyzedAt) / 60000;
            if (ageMinutes < 2) {
                score += 25;
            } else {
                score += Math.max(0, 25 - ((ageMinutes - 2) * 0.9));
            }

            // Prediction confidence bonus (0-25)
            if (result.predictions && result.predictions.length > 0) {
                const avgConfidence = result.predictions.reduce((sum, p) => sum + p.confidence, 0) / result.predictions.length;
                score += Math.min(25, avgConfidence / 4);
            }

            return Math.round(Math.min(100, score));
        } catch (error) {
            return 0;
        }
     * Initialize event listeners for shape engine settings controls.
     * Reads the shape toggle checkboxes, performer mode select, and complexity
     * slider from the DOM and fires the shape settings change callback on change.
     * @private
     */
    #_initShapeSettingsListeners() {
        const shapesToggle = document.querySelector('#shapesEnabledToggle');
        const mlShapesToggle = document.querySelector('#mlShapesToggle');
        const performerModeSelect = document.querySelector('#performerModeSelect');
        const complexitySlider = document.querySelector('#shapeComplexity');

        const notify = () => {
            if (this.#_onShapeSettingsChangeCallback) {
                this.#_onShapeSettingsChangeCallback({
                    shapesEnabled: shapesToggle?.checked ?? false,
                    mlShapesEnabled: mlShapesToggle?.checked ?? false,
                    performerMode: performerModeSelect?.value ?? 'many',
                    complexity: parseInt(complexitySlider?.value ?? '3')
                });
            }
        };

        shapesToggle?.addEventListener('change', notify);
        mlShapesToggle?.addEventListener('change', notify);
        performerModeSelect?.addEventListener('change', notify);
        complexitySlider?.addEventListener('input', notify);
    }

    /**
     * Infer image label for a given image URL using the GPU-accelerated ML model.
     * Public wrapper around the private #_inferImageLabel method for use by the
     * shape engine and other external callers.
     * @param {string} imageUrl - URL of the image to classify
     * @returns {Promise<{label: string, confidence: number, predictions: Array}|null>}
     */
    async inferImageLabel(imageUrl) {
        return this.#_inferImageLabel(imageUrl);
    }

    /**
     * Get the current viewer slots map (username → slot number).
     * Used by the shape engine to resolve usernames for GPU-driven overlay shapes.
     * @returns {Map<string, number>}
     */
    getViewerSlots() {
        return this.#_viewerSlots;
    }

    /**
     * Update shape engine UI controls to reflect a saved or restored config.
     * Syncs the checkboxes, select, and range slider in the DOM with the
     * provided config object so the UI stays consistent with the engine state.
     * @param {Object} config - Shape engine config object
     * @param {boolean} [config.shapesEnabled]
     * @param {boolean} [config.mlShapesEnabled]
     * @param {string}  [config.performerMode]
     * @param {number}  [config.complexity]
     */
    updateShapeControls(config) {
        if (!config) return;
        const shapesToggle = document.querySelector('#shapesEnabledToggle');
        const mlShapesToggle = document.querySelector('#mlShapesToggle');
        const performerModeSelect = document.querySelector('#performerModeSelect');
        const complexitySlider = document.querySelector('#shapeComplexity');

        if (shapesToggle && config.shapesEnabled !== undefined) shapesToggle.checked = config.shapesEnabled;
        if (mlShapesToggle && config.mlShapesEnabled !== undefined) mlShapesToggle.checked = config.mlShapesEnabled;
        if (performerModeSelect && config.performerMode !== undefined) performerModeSelect.value = config.performerMode;
        if (complexitySlider && config.complexity !== undefined) complexitySlider.value = String(config.complexity);
    }

    /**
     * Get the loaded GPU/ML (MobileNet) model, waiting for it to load if needed.
     * Allows the shape engine to share the already-loaded model for tensor-based
     * shape generation without loading it a second time.
     * @returns {Promise<Object|null>} Resolves to the MobileNet model or null
     */
    async getMLModel() {
        if (this.#_mlModel) return this.#_mlModel;
        if (this.#_mlModelPromise) return this.#_mlModelPromise;
        return null;
    }
}
