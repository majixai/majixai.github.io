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

    constructor() {
        // The engine is composed of the other modules, a key OOP principle.
        this.#_dataAPI = new DataAPI(CacheManager);
        this.#_uiManager = new UIManager(
            {
                grid: '#performerGrid',
                iframe: '#mainIframe',
                start: '#startAnimationBtn',
                stop: '#stopAnimationBtn'
            },
            // The callback "hook" allows the UI to communicate back to the engine
            // without being tightly coupled.
            (performer) => this.#_handlePerformerSelection(performer)
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
    async init() {
        this.#_uiManager.showLoading();
        try {
            // The "async/await" syntax makes asynchronous code read like synchronous code.
            const performerData = await this.#_dataAPI.getPerformers();
            this.#_performers = Performer.createMany(performerData);

            if (this.#_performers.length > 0) {
                this.#_uiManager.renderPerformers(this.#_performers);
                // Automatically select the first performer to display in the viewer.
                this.#_handlePerformerSelection(this.#_performers[0]);
            } else {
                this.#_uiManager.showError(); // Or a "no performers found" message
            }
        } catch (error) {
            console.error("Failed to initialize PerformerEngine:", error);
            this.#_uiManager.showError();
        }
    }
}

// Entry point for the application.
// We wait for the DOM to be fully loaded before initializing the engine.
document.addEventListener('DOMContentLoaded', () => {
    const engine = new PerformerEngine();
    engine.init();
});