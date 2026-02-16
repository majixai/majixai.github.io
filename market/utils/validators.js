/**
 * Validators utility module for validating market data.
 */
export class Validators {
    /**
     * Validate a stock symbol.
     * @param {string} symbol - Symbol to validate
     * @returns {boolean}
     */
    static isValidSymbol(symbol) {
        if (!symbol || typeof symbol !== 'string') {
            return false;
        }
        // Basic pattern: 1-10 uppercase letters/numbers
        return /^[A-Z0-9]{1,10}$/i.test(symbol.trim());
    }

    /**
     * Validate a price value.
     * @param {*} price - Price to validate
     * @returns {boolean}
     */
    static isValidPrice(price) {
        const num = parseFloat(price);
        return !isNaN(num) && num >= 0;
    }

    /**
     * Validate a quantity value.
     * @param {*} quantity - Quantity to validate
     * @returns {boolean}
     */
    static isValidQuantity(quantity) {
        const num = parseFloat(quantity);
        return !isNaN(num) && num > 0;
    }

    /**
     * Validate price data array.
     * @param {Array} prices - Array of prices
     * @returns {boolean}
     */
    static isValidPriceArray(prices) {
        if (!Array.isArray(prices) || prices.length === 0) {
            return false;
        }
        return prices.every(p => this.isValidPrice(p));
    }

    /**
     * Validate a date string.
     * @param {string} dateStr - Date string
     * @returns {boolean}
     */
    static isValidDate(dateStr) {
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
    }

    /**
     * Validate date range.
     * @param {string} startDate - Start date string
     * @param {string} endDate - End date string
     * @returns {boolean}
     */
    static isValidDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end;
    }

    /**
     * Validate percentage value.
     * @param {*} value - Value to validate
     * @returns {boolean}
     */
    static isValidPercentage(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num >= -100 && num <= 100;
    }

    /**
     * Validate chart configuration.
     * @param {Object} config - Chart configuration object
     * @returns {Object}
     */
    static validateChartConfig(config) {
        const errors = [];

        if (config.type && !['line', 'bar', 'candlestick', 'area'].includes(config.type)) {
            errors.push('Invalid chart type');
        }

        if (config.period && !['1D', '1W', '1M', '3M', '6M', '1Y', '5Y'].includes(config.period)) {
            errors.push('Invalid period');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Sanitize symbol input.
     * @param {string} symbol - Symbol to sanitize
     * @returns {string}
     */
    static sanitizeSymbol(symbol) {
        if (!symbol || typeof symbol !== 'string') {
            return '';
        }
        return symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    }
}
