/**
 * Stock Formatters utility class.
 */
export class StockFormatters {
    /**
     * Format stock price.
     * @param {number} price - Price value
     * @param {string} currency - Currency code
     * @returns {string}
     */
    static formatPrice(price, currency = 'USD') {
        if (price === null || price === undefined) return '--';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(price);
    }

    /**
     * Format price change with sign.
     * @param {number} change - Change value
     * @param {number} changePercent - Change percentage
     * @returns {string}
     */
    static formatChange(change, changePercent) {
        if (change === null || change === undefined) return '--';
        const sign = change >= 0 ? '+' : '';
        return `${sign}${this.formatPrice(change)} (${sign}${(changePercent * 100).toFixed(2)}%)`;
    }

    /**
     * Format volume with suffixes.
     * @param {number} volume - Volume value
     * @returns {string}
     */
    static formatVolume(volume) {
        if (!volume) return '--';
        const suffixes = [
            { value: 1e12, suffix: 'T' },
            { value: 1e9, suffix: 'B' },
            { value: 1e6, suffix: 'M' },
            { value: 1e3, suffix: 'K' }
        ];

        for (const { value, suffix } of suffixes) {
            if (volume >= value) {
                return `${(volume / value).toFixed(2)}${suffix}`;
            }
        }
        return volume.toLocaleString();
    }

    /**
     * Format market cap.
     * @param {number} marketCap - Market cap value
     * @returns {string}
     */
    static formatMarketCap(marketCap) {
        return this.formatVolume(marketCap);
    }

    /**
     * Format date for display.
     * @param {Date|string} date - Date value
     * @param {string} format - Format type ('short', 'long', 'datetime')
     * @returns {string}
     */
    static formatDate(date, format = 'short') {
        const d = new Date(date);
        const options = {
            short: { month: 'short', day: 'numeric' },
            long: { year: 'numeric', month: 'long', day: 'numeric' },
            datetime: { 
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }
        };
        return new Intl.DateTimeFormat('en-US', options[format] || options.short).format(d);
    }

    /**
     * Format time for display.
     * @param {Date|string} date - Date value
     * @returns {string}
     */
    static formatTime(date) {
        const d = new Date(date);
        return new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(d);
    }

    /**
     * Format P/E ratio.
     * @param {number} pe - P/E ratio
     * @returns {string}
     */
    static formatPE(pe) {
        if (!pe || isNaN(pe)) return 'N/A';
        return pe.toFixed(2);
    }

    /**
     * Format dividend yield.
     * @param {number} yield_ - Dividend yield
     * @returns {string}
     */
    static formatDividendYield(yield_) {
        if (!yield_) return '--';
        return `${(yield_ * 100).toFixed(2)}%`;
    }

    /**
     * Format 52-week range.
     * @param {number} low - 52-week low
     * @param {number} high - 52-week high
     * @returns {string}
     */
    static format52WeekRange(low, high) {
        return `${this.formatPrice(low)} - ${this.formatPrice(high)}`;
    }

    /**
     * Get arrow indicator for change.
     * @param {number} change - Change value
     * @returns {string}
     */
    static getChangeArrow(change) {
        if (change > 0) return '▲';
        if (change < 0) return '▼';
        return '';
    }

    /**
     * Get CSS class for change.
     * @param {number} change - Change value
     * @returns {string}
     */
    static getChangeClass(change) {
        if (change > 0) return 'positive';
        if (change < 0) return 'negative';
        return 'neutral';
    }
}
