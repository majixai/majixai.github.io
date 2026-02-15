/**
 * Pricing Controller for option pricing operations.
 */
import { OptionModel } from '../models/option_model.js';
import { BlackScholesService } from '../services/black_scholes_service.js';

export class PricingController {
    constructor(model = null) {
        this.model = model || new OptionModel();
        this.pricingService = new BlackScholesService();
    }

    /**
     * Set market parameters.
     * @param {Object} params - Market parameters
     */
    setMarketParams(params) {
        if (params.underlyingPrice !== undefined) {
            this.model.setUnderlyingPrice(params.underlyingPrice);
        }
        if (params.riskFreeRate !== undefined) {
            this.model.setRiskFreeRate(params.riskFreeRate);
        }
        if (params.volatility !== undefined) {
            this.model.setVolatility(params.volatility);
        }
    }

    /**
     * Calculate option price.
     * @param {string} type - 'call' or 'put'
     * @param {number} strike - Strike price
     * @param {number} timeToExpiry - Time to expiry in years
     * @returns {Object}
     */
    calculatePrice(type, strike, timeToExpiry) {
        const params = this.model.getMarketParams();

        if (!params.underlyingPrice || !params.volatility) {
            return {
                success: false,
                error: 'Missing market parameters'
            };
        }

        try {
            const price = type === 'call'
                ? this.pricingService.callPrice(
                    params.underlyingPrice,
                    strike,
                    timeToExpiry,
                    params.riskFreeRate,
                    params.volatility
                )
                : this.pricingService.putPrice(
                    params.underlyingPrice,
                    strike,
                    timeToExpiry,
                    params.riskFreeRate,
                    params.volatility
                );

            return {
                success: true,
                type,
                strike,
                timeToExpiry,
                price,
                params: params
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calculate Greeks.
     * @param {string} type - 'call' or 'put'
     * @param {number} strike - Strike price
     * @param {number} timeToExpiry - Time to expiry in years
     * @returns {Object}
     */
    calculateGreeks(type, strike, timeToExpiry) {
        const params = this.model.getMarketParams();

        if (!params.underlyingPrice || !params.volatility) {
            return {
                success: false,
                error: 'Missing market parameters'
            };
        }

        try {
            const greeks = this.pricingService.calculateGreeks(
                type,
                params.underlyingPrice,
                strike,
                timeToExpiry,
                params.riskFreeRate,
                params.volatility
            );

            return {
                success: true,
                type,
                strike,
                timeToExpiry,
                greeks
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Add a contract to track.
     * @param {string} id - Contract ID
     * @param {Object} contract - Contract data
     * @returns {Object}
     */
    addContract(id, contract) {
        this.model.addContract(id, contract);
        return {
            success: true,
            message: `Contract ${id} added`,
            contract
        };
    }

    /**
     * Get all tracked contracts.
     * @returns {Array}
     */
    getContracts() {
        return this.model.getAllContracts();
    }
}
