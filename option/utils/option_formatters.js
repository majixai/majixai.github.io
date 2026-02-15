/**
 * Option Formatters utility module.
 */
export class OptionFormatters {
    /**
     * Format strike price.
     * @param {number} strike - Strike price
     * @param {number} decimals - Decimal places
     * @returns {string}
     */
    static formatStrike(strike, decimals = 2) {
        return `$${strike.toFixed(decimals)}`;
    }

    /**
     * Format premium/price.
     * @param {number} premium - Option premium
     * @param {number} decimals - Decimal places
     * @returns {string}
     */
    static formatPremium(premium, decimals = 2) {
        return `$${premium.toFixed(decimals)}`;
    }

    /**
     * Format contract value (premium * 100).
     * @param {number} premium - Option premium per share
     * @returns {string}
     */
    static formatContractValue(premium) {
        return `$${(premium * 100).toFixed(2)}`;
    }

    /**
     * Format delta.
     * @param {number} delta - Delta value
     * @returns {string}
     */
    static formatDelta(delta) {
        return delta.toFixed(4);
    }

    /**
     * Format gamma.
     * @param {number} gamma - Gamma value
     * @returns {string}
     */
    static formatGamma(gamma) {
        return gamma.toFixed(5);
    }

    /**
     * Format theta (daily).
     * @param {number} theta - Theta value
     * @returns {string}
     */
    static formatTheta(theta) {
        return `$${theta.toFixed(4)}/day`;
    }

    /**
     * Format vega.
     * @param {number} vega - Vega value
     * @returns {string}
     */
    static formatVega(vega) {
        return `$${vega.toFixed(4)}/1%`;
    }

    /**
     * Format implied volatility.
     * @param {number} iv - Implied volatility (e.g., 0.3 for 30%)
     * @returns {string}
     */
    static formatIV(iv) {
        return `${(iv * 100).toFixed(2)}%`;
    }

    /**
     * Format option type.
     * @param {string} type - 'call' or 'put'
     * @returns {string}
     */
    static formatType(type) {
        return type.charAt(0).toUpperCase() + type.slice(1);
    }

    /**
     * Format expiration date.
     * @param {Date} date - Expiration date
     * @returns {string}
     */
    static formatExpiration(date) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Intl.DateTimeFormat('en-US', options).format(date);
    }

    /**
     * Format days to expiration.
     * @param {number} days - Days to expiration
     * @returns {string}
     */
    static formatDTE(days) {
        if (days < 1) {
            return 'Expiring today';
        } else if (days === 1) {
            return '1 day';
        } else {
            return `${days} days`;
        }
    }

    /**
     * Format moneyness.
     * @param {number} underlyingPrice - Current underlying price
     * @param {number} strike - Strike price
     * @param {string} type - 'call' or 'put'
     * @returns {string}
     */
    static formatMoneyness(underlyingPrice, strike, type) {
        const diff = underlyingPrice - strike;
        const percentage = Math.abs(diff / underlyingPrice * 100).toFixed(1);

        if (Math.abs(diff) < 0.01 * underlyingPrice) {
            return 'ATM';
        } else if (type === 'call') {
            return diff > 0 ? `${percentage}% ITM` : `${percentage}% OTM`;
        } else {
            return diff < 0 ? `${percentage}% ITM` : `${percentage}% OTM`;
        }
    }

    /**
     * Format payoff/profit.
     * @param {number} value - Payoff value
     * @returns {string}
     */
    static formatPayoff(value) {
        const sign = value >= 0 ? '+' : '';
        return `${sign}$${value.toFixed(2)}`;
    }
}
