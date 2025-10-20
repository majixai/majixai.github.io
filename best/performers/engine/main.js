/**
 * @file Main PerformerEngine class and application entry point.
 * @author Jules
 * @description This file brings together all the engine components (API, Cache, UI)
 * to create the main application logic. It demonstrates advanced OOP concepts like
 * classes, private members, and composition.
 */

/**
 * @class Performer
 * @description A class representing a single performer. This is a form of Object Mapping,
 * turning raw data objects into structured instances with potential methods.
 * This acts as a "struct" or "interface" for performer data.
 */
class Performer {
    // Public members, directly mapped from the JSON data.
    username;
    display_name;
    image_url;
    iframe_embed;
    age;
    gender;

    /**
     * @param {object} data - Raw data object for a performer.
     */
    constructor(data) {
        // Object mapping from data to class properties.
        this.username = data.username;
        this.display_name = data.display_name || data.username;
        this.image_url = data.image_url || data.profile_pic_url;
        this.iframe_embed = data.iframe_embed;
        this.age = data.age;
        this.gender = data.gender;

        // Using Object.freeze to make the instance immutable, a good practice for data objects.
        Object.freeze(this);
    }

    /**
     * A static factory method to create Performer instances.
     * @param {object[]} performerData - An array of raw performer data.
     * @returns {Performer[]} An array of Performer instances.
     */
    static createMany(performerData) {
        return performerData.map(data => new Performer(data));
    }
}


/**
 * @class PerformerEngine
 * @description The main orchestrator for the application. It initializes and
 * coordinates all the other modules.
 */
class PerformerEngine {
    // Using private fields for true encapsulation.
    #_uiManager;
    #_dataAPI;
    #_performers = []; // This will hold Performer class instances.
    #_currentPage = 1;
    #_itemsPerPage = 10; // Default items per page

    constructor() {
        // The engine is composed of the other modules, a key OOP principle.
        this.#_dataAPI = new DataAPI(CacheManager);
        this.#_uiManager = new UIManager(
            {
                grid: '#performerGrid',
                iframe: '#mainIframe',
                refresh: '#refreshBtn',
                pagination: '#paginationControls'
            },
            // Callbacks for UI events
            {
                onPerformerSelect: (performer) => this.#_handlePerformerSelection(performer),
                onPageChange: (page) => this.goToPage(page),
                onRefresh: () => this.forceRefresh()
            }
        );
    }

    /**
     * @private
     * Handles the logic when a performer card is selected in the UI.
     * @param {Performer} performer - The selected performer.
     */
    #_handlePerformerSelection(performer) {
        console.log(`Performer selected: ${performer.display_name}`);
        this.#_uiManager.updateViewer(performer);
    }

    /**
     * The main initialization method for the application.
     * @public
     */
    async init(forceRefresh = false) {
        this.#_uiManager.showLoading();
        try {
            const performerData = await this.#_dataAPI.getPerformers(forceRefresh);
            this.#_performers = Performer.createMany(performerData);
            this.#_currentPage = 1; // Reset to first page on load
            this.#_renderCurrentPage();
        } catch (error) {
            console.error("Failed to initialize PerformerEngine:", error);
            this.#_uiManager.showError();
        }
    }

    /**
     * Navigates to a specific page number.
     * @param {number} page - The page number to navigate to.
     */
    goToPage(page) {
        const totalPages = Math.ceil(this.#_performers.length / this.#_itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.#_currentPage = page;
            this.#_renderCurrentPage();
        }
    }

    /**
     * Forces a refresh of the data from the network.
     */
    forceRefresh() {
        console.log("Forcing data refresh...");
        this.init(true);
    }

    /**
     * @private
     * Renders the performers for the current page and updates pagination UI.
     */
    #_renderCurrentPage() {
        const startIndex = (this.#_currentPage - 1) * this.#_itemsPerPage;
        const endIndex = startIndex + this.#_itemsPerPage;
        const pagePerformers = this.#_performers.slice(startIndex, endIndex);

        if (pagePerformers.length > 0) {
            this.#_uiManager.renderPerformers(pagePerformers);
            // Select the first performer of the page, if not already viewing one.
            if (this.#_uiManager.isViewerEmpty()) {
                 this.#_handlePerformerSelection(pagePerformers[0]);
            }
        } else if (this.#_currentPage === 1) {
            this.#_uiManager.showError("No public performers found.");
        }

        const totalPages = Math.ceil(this.#_performers.length / this.#_itemsPerPage);
        this.#_uiManager.renderPagination(this.#_currentPage, totalPages);
    }
}

// Entry point for the application.
// We wait for the DOM to be fully loaded before initializing the engine.
document.addEventListener('DOMContentLoaded', () => {
    const engine = new PerformerEngine();
    engine.init();
});