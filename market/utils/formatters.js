/**
 * Formatters utility module for formatting market data.
 */
export class Formatters {
    /**
     * Format a number as currency.
     * @param {number} value - Numeric value
     * @param {string} currency - Currency code
     * @param {string} locale - Locale string
     * @returns {string}
     */
    static formatCurrency(value, currency = 'USD', locale = 'en-US') {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
        }).format(value);
    }

    /**
     * Format a number as percentage.
     * @param {number} value - Numeric value (0.05 = 5%)
     * @param {number} decimals - Decimal places
     * @returns {string}
     */
    static formatPercent(value, decimals = 2) {
        return `${(value * 100).toFixed(decimals)}%`;
    }

    /**
     * Format a number with thousand separators.
     * @param {number} value - Numeric value
     * @param {number} decimals - Decimal places
     * @returns {string}
     */
    static formatNumber(value, decimals = 2) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(value);
    }

    /**
     * Format large numbers with K/M/B suffixes.
     * @param {number} value - Numeric value
     * @returns {string}
     */
    static formatCompact(value) {
        const suffixes = [
            { threshold: 1e12, suffix: 'T' },
            { threshold: 1e9, suffix: 'B' },
            { threshold: 1e6, suffix: 'M' },
            { threshold: 1e3, suffix: 'K' }
        ];

        for (const { threshold, suffix } of suffixes) {
            if (Math.abs(value) >= threshold) {
                return `${(value / threshold).toFixed(2)}${suffix}`;
            }
        }

        return value.toFixed(2);
    }

    /**
     * Format a date object.
     * @param {Date} date - Date object
     * @param {string} format - Format type ('short', 'long', 'time')
     * @returns {string}
     */
    static formatDate(date, format = 'short') {
        const options = {
            short: { year: 'numeric', month: 'short', day: 'numeric' },
            long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
            time: { hour: '2-digit', minute: '2-digit', second: '2-digit' }
        };

        return new Intl.DateTimeFormat('en-US', options[format] || options.short).format(date);
    }

    /**
     * Format price change with color indicator.
     * @param {number} change - Price change value
     * @param {number} changePercent - Change percentage
     * @returns {Object}
     */
    static formatPriceChange(change, changePercent) {
        const isPositive = change >= 0;
        return {
            change: `${isPositive ? '+' : ''}${this.formatCurrency(change)}`,
            percent: `${isPositive ? '+' : ''}${this.formatPercent(changePercent)}`,
            color: isPositive ? 'green' : 'red',
            arrow: isPositive ? '▲' : '▼'
        };
    }

    /**
     * Format volume.
     * @param {number} volume - Volume value
     * @returns {string}
     */
    static formatVolume(volume) {
        return this.formatCompact(volume);
    }
}
