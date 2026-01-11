/**
 * @file Main Best Performers Engine class and application entry point.
 * @description Orchestrates all modules for the enhanced performer viewing experience.
 */

/**
 * @class Performer
 * @description Data class for performer objects
 */
class Performer {
    username;
    display_name;
    image_url;
    iframe_embed;
    age;
    gender;
    num_viewers;
    is_new;
    tags;
    current_show;
    rankScore;

    constructor(data) {
        this.username = data.username;
        this.display_name = data.display_name || data.username;
        this.image_url = data.image_url || data.profile_pic_url;
        this.iframe_embed = data.iframe_embed;
        this.age = data.age;
        this.gender = data.gender;
        this.num_viewers = data.num_viewers || 0;
        this.is_new = data.is_new || false;
        this.tags = data.tags || [];
        this.current_show = data.current_show;
        this.rankScore = data.rankScore || 0;

        Object.freeze(this);
    }

    static createMany(performerData) {
        return performerData.map(data => new Performer(data));
    }
}

/**
 * @class BestPerformersEngine
 * @description Main application orchestrator
 */
class BestPerformersEngine {
    #_uiManager;
    #_dataAPI;
    #_performers = [];
    #_currentPage = 1;
    #_currentFilters = {};
    #_fetchInterval = null;

    constructor() {
        this.#_dataAPI = new DataAPI(CacheManager);
        this.#_uiManager = new UIManager({
            onPerformerSelect: (performer) => this.#_handlePerformerSelection(performer),
            onRefresh: () => this.refresh(),
            onFilterChange: (filters, loadMore) => this.#_handleFilterChange(filters, loadMore),
            onSearch: (query) => this.#_handleSearch(query)
        });

        this.#_currentFilters = { ...AppConfig.DEFAULT_FILTERS };
    }

    /**
     * Handle performer selection
     * @private
     */
    async #_handlePerformerSelection(performer) {
        console.log(`Performer selected: ${performer.display_name || performer.username}`);
        
        this.#_uiManager.updateViewer(performer);
        
        // Add to history
        try {
            await CacheManager.addToHistory(performer.username);
        } catch (error) {
            console.error("Error adding to history:", error);
        }
    }

    /**
     * Handle filter changes
     * @private
     */
    async #_handleFilterChange(filters, loadMore = false) {
        if (loadMore) {
            this.#_currentPage++;
        } else {
            this.#_currentPage = 1;
            this.#_currentFilters = { ...filters };
        }

        await this.#_loadPerformers(loadMore);
    }

    /**
     * Handle search input
     * @private
     */
    async #_handleSearch(query) {
        this.#_currentFilters.search = query;
        this.#_currentPage = 1;
        await this.#_loadPerformers(false);
    }

    /**
     * Load performers with current filters
     * @private
     */
    async #_loadPerformers(append = false) {
        if (!append) {
            this.#_uiManager.showLoading();
        }

        try {
            const result = await this.#_dataAPI.getPerformers({
                filters: this.#_currentFilters,
                page: this.#_currentPage,
                perPage: AppConfig.PERFORMERS_PER_PAGE
            });

            this.#_performers = Performer.createMany(result.performers);

            if (this.#_performers.length > 0) {
                this.#_uiManager.renderPerformers(this.#_performers, append);
                this.#_uiManager.showLoadMore(result.hasMore);
                
                // Auto-populate viewers on first load
                if (this.#_currentPage === 1 && !append) {
                    this.#_uiManager.autoPopulateViewers(this.#_performers);
                }
            } else if (!append) {
                this.#_uiManager.showError('No performers found matching your criteria.');
            }

            this.#_uiManager.updateStatus({
                count: result.total,
                lastUpdate: Date.now()
            });

        } catch (error) {
            console.error("Failed to load performers:", error);
            if (!append) {
                this.#_uiManager.showError(error.message);
            }
        } finally {
            this.#_uiManager.hideLoading();
        }
    }

    /**
     * Refresh performer data
     */
    async refresh() {
        this.#_currentPage = 1;
        await this.#_dataAPI.getPerformers({ forceRefresh: true, filters: this.#_currentFilters });
        await this.#_loadPerformers(false);
    }

    /**
     * Initialize snippet functionality
     * @private
     */
    async #_initSnippets() {
        // Load existing snippets
        try {
            const snippets = await CacheManager.getAllSnippets();
            this.#_uiManager.renderSnippets(snippets);
        } catch (error) {
            console.error("Error loading snippets:", error);
        }

        // Save snippet button handler
        const saveBtn = document.querySelector('#saveSnippetButton');
        saveBtn?.addEventListener('click', async () => {
            const text = this.#_uiManager.getSnippetInput();
            if (!text.trim()) {
                this.#_uiManager.showSnippetStatus('Snippet cannot be empty', 'error');
                return;
            }

            try {
                await CacheManager.addSnippet(text);
                const snippets = await CacheManager.getAllSnippets();
                this.#_uiManager.renderSnippets(snippets);
                this.#_uiManager.clearSnippetInput();
                this.#_uiManager.showSnippetStatus('Snippet saved!', 'success');
            } catch (error) {
                this.#_uiManager.showSnippetStatus(error.message, 'error');
            }
        });

        // Delete snippet handler (event delegation)
        const snippetsList = document.querySelector('#snippetsList');
        snippetsList?.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const id = parseInt(e.target.dataset.id);
                if (id) {
                    try {
                        await CacheManager.deleteSnippet(id);
                        const snippets = await CacheManager.getAllSnippets();
                        this.#_uiManager.renderSnippets(snippets);
                        this.#_uiManager.showSnippetStatus('Snippet deleted', 'success');
                    } catch (error) {
                        this.#_uiManager.showSnippetStatus('Failed to delete', 'error');
                    }
                }
            }
        });

        // Autocomplete for main text area
        const mainTextArea = document.querySelector('#mainTextArea');
        mainTextArea?.addEventListener('input', async (e) => {
            const text = e.target.value;
            const triggerPos = text.lastIndexOf('{{');
            
            if (triggerPos !== -1 && triggerPos === text.length - 2) {
                // Just typed '{{', show all snippets
                const snippets = await CacheManager.getAllSnippets();
                this.#_uiManager.showAutocompleteSuggestions(snippets);
            } else if (triggerPos !== -1) {
                const query = text.substring(triggerPos + 2);
                if (query.length > 0) {
                    const snippets = await CacheManager.searchSnippets(query);
                    this.#_uiManager.showAutocompleteSuggestions(snippets);
                }
            } else {
                this.#_uiManager.hideAutocompleteSuggestions();
            }
        });

        mainTextArea?.addEventListener('blur', () => {
            setTimeout(() => {
                this.#_uiManager.hideAutocompleteSuggestions();
            }, 150);
        });
    }

    /**
     * Start periodic refresh
     * @private
     */
    #_startPeriodicRefresh() {
        if (this.#_fetchInterval) {
            clearInterval(this.#_fetchInterval);
        }
        
        this.#_fetchInterval = setInterval(async () => {
            console.log("Periodic refresh triggered");
            await this.refresh();
        }, AppConfig.FETCH_INTERVAL);
    }

    /**
     * Log visit for analytics
     * @private
     */
    #_logVisit() {
        const data = {
            timestamp: new Date().toISOString(),
            target: window.location.href,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            event_type: 'page_visit'
        };

        if (navigator.sendBeacon && AppConfig.LOGGING_SERVICE_URL) {
            navigator.sendBeacon(AppConfig.LOGGING_SERVICE_URL, JSON.stringify(data));
        }
    }

    /**
     * Main initialization
     */
    async init() {
        console.log("BestPerformersEngine: Initializing...");
        
        this.#_logVisit();
        
        // Load saved filter preferences
        try {
            const savedFilters = await CacheManager.getFilters();
            this.#_currentFilters = { ...AppConfig.DEFAULT_FILTERS, ...savedFilters };
        } catch (error) {
            console.warn("Could not load saved filters:", error);
        }

        // Initialize snippets
        await this.#_initSnippets();

        // Load performers
        await this.#_loadPerformers(false);

        // Start periodic refresh
        this.#_startPeriodicRefresh();

        console.log("BestPerformersEngine: Initialization complete");
    }
}

// Entry point
document.addEventListener('DOMContentLoaded', () => {
    const engine = new BestPerformersEngine();
    engine.init().catch(error => {
        console.error("Failed to initialize BestPerformersEngine:", error);
    });
});