/**
 * Strategy Controller for options strategy operations.
 */
import { StrategyModel } from '../models/strategy_model.js';
import { PayoffService } from '../services/payoff_service.js';

export class StrategyController {
    constructor(model = null) {
        this.model = model || new StrategyModel();
        this.payoffService = new PayoffService();
        this.model.loadPredefinedStrategies();
    }

    /**
     * Get available strategies.
     * @returns {Array}
     */
    getAvailableStrategies() {
        return this.model.getAllStrategies();
    }

    /**
     * Select a strategy.
     * @param {string} name - Strategy name
     * @returns {Object}
     */
    selectStrategy(name) {
        const success = this.model.setActiveStrategy(name);
        return {
            success,
            message: success ? `Selected ${name}` : `Strategy ${name} not found`,
            strategy: success ? this.model.getActiveStrategy() : null
        };
    }

    /**
     * Create a custom strategy.
     * @param {string} name - Strategy name
     * @param {Object} config - Strategy configuration
     * @returns {Object}
     */
    createStrategy(name, config) {
        this.model.defineStrategy(name, config);
        return {
            success: true,
            message: `Created strategy ${name}`,
            strategy: this.model.getStrategy(name)
        };
    }

    /**
     * Calculate strategy payoff at expiration.
     * @param {number} underlyingPrice - Underlying asset price at expiration
     * @param {Object} strategyParams - Strategy parameters
     * @returns {Object}
     */
    calculatePayoff(underlyingPrice, strategyParams) {
        const strategy = this.model.getActiveStrategy();
        if (!strategy) {
            return {
                success: false,
                error: 'No strategy selected'
            };
        }

        try {
            const payoff = this.payoffService.calculateStrategyPayoff(
                strategy.legs,
                underlyingPrice,
                strategyParams
            );

            return {
                success: true,
                strategy: strategy.name,
                underlyingPrice,
                payoff
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate payoff diagram data.
     * @param {number} minPrice - Minimum price for diagram
     * @param {number} maxPrice - Maximum price for diagram
     * @param {Object} strategyParams - Strategy parameters
     * @param {number} points - Number of data points
     * @returns {Object}
     */
    generatePayoffDiagram(minPrice, maxPrice, strategyParams, points = 100) {
        const strategy = this.model.getActiveStrategy();
        if (!strategy) {
            return {
                success: false,
                error: 'No strategy selected'
            };
        }

        const step = (maxPrice - minPrice) / (points - 1);
        const data = [];

        for (let i = 0; i < points; i++) {
            const price = minPrice + (i * step);
            const payoff = this.payoffService.calculateStrategyPayoff(
                strategy.legs,
                price,
                strategyParams
            );
            data.push({ price, payoff });
        }

        return {
            success: true,
            strategy: strategy.name,
            data
        };
    }

    /**
     * Get strategy breakeven points.
     * @param {Object} strategyParams - Strategy parameters
     * @returns {Object}
     */
    getBreakevenPoints(strategyParams) {
        const strategy = this.model.getActiveStrategy();
        if (!strategy) {
            return {
                success: false,
                error: 'No strategy selected'
            };
        }

        try {
            const breakevens = this.payoffService.findBreakevens(
                strategy.legs,
                strategyParams
            );

            return {
                success: true,
                strategy: strategy.name,
                breakevens
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}
