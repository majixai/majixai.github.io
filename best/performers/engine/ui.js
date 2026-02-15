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
    
    // Callbacks
    #_onPerformerSelectCallback;
    #_onRefreshCallback;
    #_onFilterChangeCallback;
    #_onSearchCallback;

    constructor(callbacks = {}) {
        this.#_initDOMReferences();
        this.#_onPerformerSelectCallback = callbacks.onPerformerSelect;
        this.#_onRefreshCallback = callbacks.onRefresh;
        this.#_onFilterChangeCallback = callbacks.onFilterChange;
        this.#_onSearchCallback = callbacks.onSearch;
        this.#_initEventListeners();
        this.#_setLayout(this.#_currentLayout);
        this.#_initLocalImageRecognition();
    }

    /**
     * Initialize local image recognition model (non-generative ML).
     * @private
     */
    #_initLocalImageRecognition() {
        if (!window.mobilenet || !window.tf) {
            console.warn('UIManager: TensorFlow/MobileNet not available, skipping local vision labels.');
            return;
        }

        this.#_mlModelPromise = window.mobilenet.load({ version: 2, alpha: 1.0 })
            .then((model) => {
                this.#_mlModel = model;
                this.#_analyzeVisibleCards();
                return model;
            })
            .catch((error) => {
                console.warn('UIManager: Failed to load MobileNet model:', error);
                return null;
            });
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

        // Load more button
        document.querySelector('#loadMoreBtn')?.addEventListener('click', () => {
            if (this.#_onFilterChangeCallback) {
                this.#_onFilterChangeCallback(this.getFilters(), true); // true = load more
            }
        });
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
                <img src="${imageUrl}" alt="${this.#_escapeHtml(name)}" loading="lazy" data-role="performer-image">
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

        return card;
    }

    /**
     * Infer image label and confidence for an image URL.
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

        const img = new Image();
        img.crossOrigin = 'anonymous';

        const loaded = new Promise((resolve, reject) => {
            img.onload = () => resolve(true);
            img.onerror = () => reject(new Error('image load failed'));
        });

        img.src = imageUrl;
        try {
            await loaded;
            const predictions = await this.#_mlModel.classify(img, 1);
            if (!predictions || !predictions.length) {
                return null;
            }
            const top = predictions[0];
            const result = {
                label: top.className,
                confidence: Math.round((top.probability || 0) * 100)
            };
            this.#_predictionCache.set(imageUrl, result);
            return result;
        } catch (error) {
            return null;
        }
    }

    /**
     * Analyze currently visible performer cards.
     * @private
     */
    async #_analyzeVisibleCards() {
        if (!this.#_gridContainer) return;
        const cards = Array.from(this.#_gridContainer.querySelectorAll('.performer-card'));
        for (const card of cards) {
            const image = card.querySelector('img[data-role="performer-image"]');
            const visionEl = card.querySelector('.card-vision');
            if (!image || !visionEl) continue;
            const prediction = await this.#_inferImageLabel(image.src);
            if (!prediction) {
                visionEl.textContent = 'Vision: unavailable';
                continue;
            }
            visionEl.textContent = `Vision: ${prediction.label} (${prediction.confidence}%)`;
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
     * Randomized high-speed slideshow for performer images.
     * @private
     */
    #_startAutoSlideshow() {
        if (this.#_slideshowTimer) {
            clearTimeout(this.#_slideshowTimer);
        }

        const tick = () => {
            const cards = Array.from(this.#_gridContainer.querySelectorAll('.performer-card'));
            if (cards.length > 0 && this.#_allPerformers.length > 0) {
                const swaps = Math.max(1, Math.floor(cards.length * 0.12));
                for (let i = 0; i < swaps; i++) {
                    const card = cards[Math.floor(Math.random() * cards.length)];
                    const candidate = this.#_allPerformers[Math.floor(Math.random() * this.#_allPerformers.length)];
                    if (!card || !candidate?.image_url) continue;

                    const imageEl = card.querySelector('img[data-role="performer-image"]');
                    if (!imageEl) continue;
                    imageEl.src = candidate.image_url;

                    const visionEl = card.querySelector('.card-vision');
                    if (visionEl) {
                        visionEl.textContent = 'Vision: updating...';
                        this.#_inferImageLabel(candidate.image_url).then((prediction) => {
                            if (!prediction) {
                                visionEl.textContent = 'Vision: unavailable';
                                return;
                            }
                            visionEl.textContent = `Vision: ${prediction.label} (${prediction.confidence}%)`;
                        });
                    }
                }
            }

            const nextDelay = 100 + Math.floor(Math.random() * 190); // 0.10s - 0.29s
            this.#_slideshowTimer = setTimeout(tick, nextDelay);
        };

        tick();
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

            this.#_setViewerVisionPill(targetSlot, 'Vision: analyzing...');
            const prediction = await this.#_inferImageLabel(performer.image_url || performer.profile_pic_url);
            if (prediction) {
                this.#_setViewerVisionPill(targetSlot, `${prediction.label} (${prediction.confidence}%)`);
            } else {
                this.#_setViewerVisionPill(targetSlot, 'Vision: unavailable');
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
     * Show/hide load more button
     * @param {boolean} show 
     */
    showLoadMore(show) {
        const btn = document.querySelector('#loadMoreBtn');
        if (btn) {
            btn.style.display = show ? 'inline-block' : 'none';
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
}