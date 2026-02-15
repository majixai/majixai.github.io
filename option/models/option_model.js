/**
 * Option Model for storing and managing option contract data.
 */
export class OptionModel {
    constructor() {
        this.contracts = new Map();
        this.underlyingPrice = null;
        this.riskFreeRate = 0.05;
        this.volatility = null;
    }

    /**
     * Set the underlying asset price.
     * @param {number} price - Current stock price
     */
    setUnderlyingPrice(price) {
        this.underlyingPrice = price;
    }

    /**
     * Get the underlying asset price.
     * @returns {number|null}
     */
    getUnderlyingPrice() {
        return this.underlyingPrice;
    }

    /**
     * Set the risk-free interest rate.
     * @param {number} rate - Annual risk-free rate (e.g., 0.05 for 5%)
     */
    setRiskFreeRate(rate) {
        this.riskFreeRate = rate;
    }

    /**
     * Set implied volatility.
     * @param {number} vol - Implied volatility (e.g., 0.3 for 30%)
     */
    setVolatility(vol) {
        this.volatility = vol;
    }

    /**
     * Add an option contract.
     * @param {string} id - Contract identifier
     * @param {Object} contract - Contract data
     */
    addContract(id, contract) {
        this.contracts.set(id, {
            ...contract,
            addedAt: new Date().toISOString()
        });
    }

    /**
     * Get an option contract.
     * @param {string} id - Contract identifier
     * @returns {Object|null}
     */
    getContract(id) {
        return this.contracts.get(id) || null;
    }

    /**
     * Get all contracts.
     * @returns {Array}
     */
    getAllContracts() {
        return Array.from(this.contracts.entries()).map(([id, contract]) => ({
            id,
            ...contract
        }));
    }

    /**
     * Remove a contract.
     * @param {string} id - Contract identifier
     * @returns {boolean}
     */
    removeContract(id) {
        return this.contracts.delete(id);
    }

    /**
     * Clear all contracts.
     */
    clearContracts() {
        this.contracts.clear();
    }

    /**
     * Get market parameters.
     * @returns {Object}
     */
    getMarketParams() {
        return {
            underlyingPrice: this.underlyingPrice,
            riskFreeRate: this.riskFreeRate,
            volatility: this.volatility
        };
    }
}
