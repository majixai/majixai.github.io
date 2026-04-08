/**
 * @file model.js — Model layer for the MVC architecture (Alpha edition).
 * @description Composes ApiService and StorageManager as a single unified Model.
 *              In MVC: Model owns all data-fetching and persistence logic.
 *              The Controller (App in script.js) talks to PerformerModel,
 *              never directly to ApiService or StorageManager.
 */
class PerformerModel {
    /** @type {ApiService} Remote data-fetching service */
    #api;
    /** @type {StorageManager} IndexedDB / localStorage persistence service */
    #storage;

    /**
     * @param {Object} [cfg] Optional config overrides (defaults fall back to config.js globals).
     * @param {string}  [cfg.apiUrlBase]
     * @param {number}  [cfg.apiLimit]
     * @param {number}  [cfg.maxApiFetchLimit]
     * @param {number}  [cfg.apiFetchTimeout]
     */
    constructor(cfg = {}) {
        this.#api = new ApiService(
            cfg.apiUrlBase      ?? apiUrlBase,
            cfg.apiLimit        ?? apiLimit,
            cfg.maxApiFetchLimit ?? maxApiFetchLimit,
            cfg.apiFetchTimeout  ?? apiFetchTimeout
        );
        this.#storage = new StorageManager();
    }

    /** @returns {ApiService} The remote API service (read-only). */
    get api() { return this.#api; }

    /** @returns {StorageManager} The local persistence service (read-only). */
    get storage() { return this.#storage; }

    /**
     * Initialise the persistence layer (opens IndexedDB).
     * Delegates to StorageManager.init() — call from the Controller's start() method.
     * @returns {Promise<void>}
     */
    async init() {
        return this.#storage.init();
    }
}
