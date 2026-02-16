/**
 * Stock Data Service for fetching stock data.
 */
export class StockDataService {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
    }

    /**
     * Fetch stock data from API.
     * @param {string} symbol - Stock symbol
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>}
     */
    async fetchStockData(symbol, options = {}) {
        const cacheKey = `${symbol}-${JSON.stringify(options)}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const response = await this.makeRequest(symbol, options);
            const data = this.transformResponse(response);
            this.setCache(cacheKey, data);
            return data;
        } catch (error) {
            throw new Error(`Failed to fetch data for ${symbol}: ${error.message}`);
        }
    }

    /**
     * Make HTTP request.
     * @param {string} symbol - Stock symbol
     * @param {Object} options - Request options
     * @returns {Promise<Object>}
     */
    async makeRequest(symbol, options) {
        // Placeholder for actual API call
        // In a real implementation, this would call an external API
        return {
            symbol: symbol.toUpperCase(),
            data: null,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Transform API response to standard format.
     * @param {Object} response - API response
     * @returns {Object}
     */
    transformResponse(response) {
        return {
            symbol: response.symbol,
            price: response.data?.price || null,
            open: response.data?.open || null,
            high: response.data?.high || null,
            low: response.data?.low || null,
            close: response.data?.close || null,
            volume: response.data?.volume || null,
            change: response.data?.change || null,
            changePercent: response.data?.changePercent || null,
            timestamp: response.timestamp
        };
    }

    /**
     * Get data from cache.
     * @param {string} key - Cache key
     * @returns {Object|null}
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Set data in cache.
     * @param {string} key - Cache key
     * @param {Object} data - Data to cache
     */
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear the cache.
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Set cache timeout.
     * @param {number} timeout - Timeout in milliseconds
     */
    setCacheTimeout(timeout) {
        this.cacheTimeout = timeout;
    }

    /**
     * Fetch multiple stocks.
     * @param {string[]} symbols - Array of symbols
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>}
     */
    async fetchMultiple(symbols, options = {}) {
        const results = {};
        const promises = symbols.map(async (symbol) => {
            try {
                results[symbol] = await this.fetchStockData(symbol, options);
            } catch (error) {
                results[symbol] = { error: error.message };
            }
        });

        await Promise.all(promises);
        return results;
    }

    /**
     * Fetch historical data.
     * @param {string} symbol - Stock symbol
     * @param {string} period - Time period ('1D', '1W', '1M', '3M', '1Y')
     * @returns {Promise<Array>}
     */
    async fetchHistorical(symbol, period = '1M') {
        // Placeholder for historical data fetch
        return {
            symbol: symbol.toUpperCase(),
            period,
            data: [],
            timestamp: new Date().toISOString()
        };
    }
}
