/**
 * Data Model for handling market data storage and retrieval.
 */
export class DataModel {
    constructor() {
        this.cache = new Map();
        this.lastUpdate = null;
    }

    /**
     * Store market data for a symbol.
     * @param {string} symbol - Stock symbol
     * @param {Object} data - Market data object
     */
    setData(symbol, data) {
        this.cache.set(symbol.toUpperCase(), {
            ...data,
            timestamp: new Date().toISOString()
        });
        this.lastUpdate = new Date();
    }

    /**
     * Retrieve market data for a symbol.
     * @param {string} symbol - Stock symbol
     * @returns {Object|null} Market data or null if not found
     */
    getData(symbol) {
        return this.cache.get(symbol.toUpperCase()) || null;
    }

    /**
     * Check if data exists for a symbol.
     * @param {string} symbol - Stock symbol
     * @returns {boolean}
     */
    hasData(symbol) {
        return this.cache.has(symbol.toUpperCase());
    }

    /**
     * Get all cached symbols.
     * @returns {string[]}
     */
    getSymbols() {
        return Array.from(this.cache.keys());
    }

    /**
     * Clear all cached data.
     */
    clearCache() {
        this.cache.clear();
        this.lastUpdate = null;
    }

    /**
     * Get the timestamp of the last update.
     * @returns {Date|null}
     */
    getLastUpdate() {
        return this.lastUpdate;
    }

    /**
     * Get cache size.
     * @returns {number}
     */
    getCacheSize() {
        return this.cache.size;
    }
}
