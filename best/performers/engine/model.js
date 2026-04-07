/**
 * @file model.js — Model layer for the Best Performers Engine (MVC architecture).
 * @description Composes DataAPI and CacheManager as the unified data layer.
 *              In MVC: the Model owns all data operations, caching, and persistence
 *              independently of the View (UIManager) and the Controller (BestPerformersEngine).
 *
 *              DataAPI handles remote fetching with pagination + retry.
 *              CacheManager (singleton IIFE) handles IndexedDB v6 persistence across
 *              7 object stores (performers / settings / snippets / recordings /
 *              analytics / imageRecognition / imageLabels).
 */
class PerformerEngineModel {
    /** @type {DataAPI} Remote data-fetching service (wraps CacheManager internally) */
    #dataAPI;
    /** @type {Object} CacheManager singleton — IndexedDB persistence layer */
    #cache;

    constructor() {
        this.#cache   = CacheManager;
        this.#dataAPI = new DataAPI(CacheManager);
    }

    /**
     * @returns {DataAPI} The remote data-fetching service (read-only).
     *   Use for pagination, retries, and live Chaturbate API calls.
     */
    get dataAPI() { return this.#dataAPI; }

    /**
     * @returns {Object} The CacheManager singleton (read-only).
     *   Use for direct IndexedDB reads/writes (performers, settings, snippets, etc.).
     */
    get cache() { return this.#cache; }
}
