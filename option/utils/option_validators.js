/**
 * Option Validators utility module.
 */
export class OptionValidators {
    /**
     * Validate strike price.
     * @param {*} strike - Strike price
     * @returns {boolean}
     */
    static isValidStrike(strike) {
        const num = parseFloat(strike);
        return !isNaN(num) && num > 0;
    }

    /**
     * Validate premium.
     * @param {*} premium - Option premium
     * @returns {boolean}
     */
    static isValidPremium(premium) {
        const num = parseFloat(premium);
        return !isNaN(num) && num >= 0;
    }

    /**
     * Validate volatility.
     * @param {*} vol - Volatility value (e.g., 0.3 for 30%)
     * @returns {boolean}
     */
    static isValidVolatility(vol) {
        const num = parseFloat(vol);
        return !isNaN(num) && num > 0 && num < 10; // Max 1000% volatility
    }

    /**
     * Validate time to expiration.
     * @param {*} time - Time in years
     * @returns {boolean}
     */
    static isValidTimeToExpiry(time) {
        const num = parseFloat(time);
        return !isNaN(num) && num > 0 && num <= 10; // Max 10 years
    }

    /**
     * Validate risk-free rate.
     * @param {*} rate - Interest rate
     * @returns {boolean}
     */
    static isValidRiskFreeRate(rate) {
        const num = parseFloat(rate);
        return !isNaN(num) && num >= -0.1 && num <= 1; // -10% to 100%
    }

    /**
     * Validate option type.
     * @param {string} type - Option type
     * @returns {boolean}
     */
    static isValidOptionType(type) {
        return ['call', 'put'].includes(type?.toLowerCase());
    }

    /**
     * Validate position type.
     * @param {string} position - Position type
     * @returns {boolean}
     */
    static isValidPosition(position) {
        return ['long', 'short'].includes(position?.toLowerCase());
    }

    /**
     * Validate number of contracts.
     * @param {*} contracts - Number of contracts
     * @returns {boolean}
     */
    static isValidContracts(contracts) {
        const num = parseInt(contracts);
        return !isNaN(num) && num > 0 && num <= 10000;
    }

    /**
     * Validate Black-Scholes inputs.
     * @param {Object} inputs - Object with S, K, T, r, sigma
     * @returns {Object}
     */
    static validateBSInputs(inputs) {
        const errors = [];

        if (!this.isValidStrike(inputs.S)) {
            errors.push('Invalid underlying price (S)');
        }
        if (!this.isValidStrike(inputs.K)) {
            errors.push('Invalid strike price (K)');
        }
        if (!this.isValidTimeToExpiry(inputs.T)) {
            errors.push('Invalid time to expiry (T)');
        }
        if (!this.isValidRiskFreeRate(inputs.r)) {
            errors.push('Invalid risk-free rate (r)');
        }
        if (!this.isValidVolatility(inputs.sigma)) {
            errors.push('Invalid volatility (sigma)');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate strategy leg.
     * @param {Object} leg - Strategy leg object
     * @returns {Object}
     */
    static validateStrategyLeg(leg) {
        const errors = [];

        if (!this.isValidOptionType(leg.type) && leg.type !== 'stock') {
            errors.push('Invalid leg type');
        }
        if (!this.isValidPosition(leg.position)) {
            errors.push('Invalid position');
        }
        if (leg.strike && !this.isValidStrike(leg.strike)) {
            errors.push('Invalid strike');
        }
        if (leg.quantity && !this.isValidContracts(leg.quantity)) {
            errors.push('Invalid quantity');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Calculate days to expiration.
     * @param {Date|string} expirationDate - Expiration date
     * @returns {number}
     */
    static calculateDTE(expirationDate) {
        const exp = new Date(expirationDate);
        const now = new Date();
        const diffTime = exp.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    }

    /**
     * Convert days to years.
     * @param {number} days - Number of days
     * @returns {number}
     */
    static daysToYears(days) {
        return days / 365;
    }
}
