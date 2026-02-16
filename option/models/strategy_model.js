/**
 * Strategy Model for options trading strategies.
 */
export class StrategyModel {
    constructor() {
        this.strategies = new Map();
        this.activeStrategy = null;
    }

    /**
     * Define a strategy.
     * @param {string} name - Strategy name
     * @param {Object} config - Strategy configuration
     */
    defineStrategy(name, config) {
        this.strategies.set(name, {
            name,
            legs: config.legs || [],
            description: config.description || '',
            type: config.type || 'custom',
            createdAt: new Date().toISOString()
        });
    }

    /**
     * Get a strategy by name.
     * @param {string} name - Strategy name
     * @returns {Object|null}
     */
    getStrategy(name) {
        return this.strategies.get(name) || null;
    }

    /**
     * Get all defined strategies.
     * @returns {Array}
     */
    getAllStrategies() {
        return Array.from(this.strategies.values());
    }

    /**
     * Set the active strategy.
     * @param {string} name - Strategy name
     * @returns {boolean}
     */
    setActiveStrategy(name) {
        if (this.strategies.has(name)) {
            this.activeStrategy = name;
            return true;
        }
        return false;
    }

    /**
     * Get the active strategy.
     * @returns {Object|null}
     */
    getActiveStrategy() {
        if (this.activeStrategy) {
            return this.strategies.get(this.activeStrategy);
        }
        return null;
    }

    /**
     * Get predefined strategies.
     * @returns {Object}
     */
    getPredefinedStrategies() {
        return {
            coveredCall: {
                name: 'Covered Call',
                description: 'Own stock + sell call option',
                legs: [
                    { type: 'stock', position: 'long', quantity: 100 },
                    { type: 'call', position: 'short', quantity: 1 }
                ],
                type: 'income'
            },
            protectivePut: {
                name: 'Protective Put',
                description: 'Own stock + buy put option',
                legs: [
                    { type: 'stock', position: 'long', quantity: 100 },
                    { type: 'put', position: 'long', quantity: 1 }
                ],
                type: 'hedge'
            },
            bullCallSpread: {
                name: 'Bull Call Spread',
                description: 'Buy lower strike call + sell higher strike call',
                legs: [
                    { type: 'call', position: 'long', strike: 'lower', quantity: 1 },
                    { type: 'call', position: 'short', strike: 'higher', quantity: 1 }
                ],
                type: 'directional'
            },
            bearPutSpread: {
                name: 'Bear Put Spread',
                description: 'Buy higher strike put + sell lower strike put',
                legs: [
                    { type: 'put', position: 'long', strike: 'higher', quantity: 1 },
                    { type: 'put', position: 'short', strike: 'lower', quantity: 1 }
                ],
                type: 'directional'
            },
            ironCondor: {
                name: 'Iron Condor',
                description: 'Sell OTM put spread + sell OTM call spread',
                legs: [
                    { type: 'put', position: 'long', strike: 'lowest', quantity: 1 },
                    { type: 'put', position: 'short', strike: 'lower', quantity: 1 },
                    { type: 'call', position: 'short', strike: 'higher', quantity: 1 },
                    { type: 'call', position: 'long', strike: 'highest', quantity: 1 }
                ],
                type: 'neutral'
            },
            straddle: {
                name: 'Long Straddle',
                description: 'Buy call and put at same strike',
                legs: [
                    { type: 'call', position: 'long', strike: 'atm', quantity: 1 },
                    { type: 'put', position: 'long', strike: 'atm', quantity: 1 }
                ],
                type: 'volatility'
            },
            strangle: {
                name: 'Long Strangle',
                description: 'Buy OTM call and OTM put',
                legs: [
                    { type: 'call', position: 'long', strike: 'higher', quantity: 1 },
                    { type: 'put', position: 'long', strike: 'lower', quantity: 1 }
                ],
                type: 'volatility'
            }
        };
    }

    /**
     * Load predefined strategies.
     */
    loadPredefinedStrategies() {
        const predefined = this.getPredefinedStrategies();
        for (const [key, strategy] of Object.entries(predefined)) {
            this.defineStrategy(key, strategy);
        }
    }
}
