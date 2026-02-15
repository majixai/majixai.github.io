/**
 * Data Controller for orchestrating market data operations.
 */
import { DataModel } from '../models/data_model.js';

export class DataController {
    constructor(model = null) {
        this.model = model || new DataModel();
    }

    /**
     * Fetch and store market data for a symbol.
     * @param {string} symbol - Stock symbol
     * @param {Function} fetchFunction - Async function to fetch data
     * @returns {Promise<Object>}
     */
    async fetchData(symbol, fetchFunction) {
        try {
            const data = await fetchFunction(symbol);
            this.model.setData(symbol, data);
            return {
                success: true,
                data: data,
                symbol: symbol
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                symbol: symbol
            };
        }
    }

    /**
     * Get cached data for a symbol.
     * @param {string} symbol - Stock symbol
     * @returns {Object}
     */
    getData(symbol) {
        const data = this.model.getData(symbol);
        return {
            success: data !== null,
            data: data,
            symbol: symbol,
            cached: data !== null
        };
    }

    /**
     * Get all cached symbols.
     * @returns {string[]}
     */
    getCachedSymbols() {
        return this.model.getSymbols();
    }

    /**
     * Clear the data cache.
     * @returns {Object}
     */
    clearCache() {
        this.model.clearCache();
        return {
            success: true,
            message: 'Cache cleared'
        };
    }

    /**
     * Get cache statistics.
     * @returns {Object}
     */
    getCacheStats() {
        return {
            size: this.model.getCacheSize(),
            lastUpdate: this.model.getLastUpdate(),
            symbols: this.model.getSymbols()
        };
    }
}
