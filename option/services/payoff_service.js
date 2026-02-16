/**
 * Payoff Service for calculating option strategy payoffs.
 */
export class PayoffService {
    /**
     * Calculate payoff for a single call option at expiration.
     * @param {number} underlyingPrice - Price of underlying at expiration
     * @param {number} strike - Strike price
     * @param {number} premium - Premium paid (positive for long, negative for short)
     * @param {string} position - 'long' or 'short'
     * @returns {number}
     */
    callPayoff(underlyingPrice, strike, premium, position) {
        const intrinsic = Math.max(0, underlyingPrice - strike);
        const multiplier = position === 'long' ? 1 : -1;
        return (intrinsic * multiplier) - premium;
    }

    /**
     * Calculate payoff for a single put option at expiration.
     * @param {number} underlyingPrice - Price of underlying at expiration
     * @param {number} strike - Strike price
     * @param {number} premium - Premium paid (positive for long, negative for short)
     * @param {string} position - 'long' or 'short'
     * @returns {number}
     */
    putPayoff(underlyingPrice, strike, premium, position) {
        const intrinsic = Math.max(0, strike - underlyingPrice);
        const multiplier = position === 'long' ? 1 : -1;
        return (intrinsic * multiplier) - premium;
    }

    /**
     * Calculate payoff for stock position.
     * @param {number} currentPrice - Current price of stock
     * @param {number} entryPrice - Entry price of stock
     * @param {number} quantity - Number of shares
     * @param {string} position - 'long' or 'short'
     * @returns {number}
     */
    stockPayoff(currentPrice, entryPrice, quantity, position) {
        const diff = currentPrice - entryPrice;
        const multiplier = position === 'long' ? 1 : -1;
        return diff * quantity * multiplier;
    }

    /**
     * Calculate total strategy payoff.
     * @param {Array} legs - Array of strategy legs
     * @param {number} underlyingPrice - Price of underlying at expiration
     * @param {Object} params - Strategy parameters (strikes, premiums, etc.)
     * @returns {number}
     */
    calculateStrategyPayoff(legs, underlyingPrice, params) {
        let totalPayoff = 0;

        for (const leg of legs) {
            const strike = params.strikes?.[leg.strike] || params.strike || leg.strikePrice;
            const premium = params.premiums?.[leg.type]?.[leg.position] || leg.premium || 0;
            const quantity = leg.quantity || 1;

            let legPayoff = 0;

            switch (leg.type) {
                case 'call':
                    legPayoff = this.callPayoff(underlyingPrice, strike, premium, leg.position);
                    break;
                case 'put':
                    legPayoff = this.putPayoff(underlyingPrice, strike, premium, leg.position);
                    break;
                case 'stock':
                    const entryPrice = params.stockEntry || underlyingPrice;
                    legPayoff = this.stockPayoff(underlyingPrice, entryPrice, quantity, leg.position);
                    break;
            }

            totalPayoff += legPayoff * (leg.type === 'stock' ? 1 : quantity * 100);
        }

        return totalPayoff;
    }

    /**
     * Find breakeven points for a strategy.
     * @param {Array} legs - Array of strategy legs
     * @param {Object} params - Strategy parameters
     * @returns {Array}
     */
    findBreakevens(legs, params) {
        const breakevens = [];

        // Get range of strikes to search
        const strikes = Object.values(params.strikes || {});
        const minStrike = Math.min(...strikes) * 0.8;
        const maxStrike = Math.max(...strikes) * 1.2;

        // Search for sign changes in payoff
        let prevPayoff = this.calculateStrategyPayoff(legs, minStrike, params);

        for (let price = minStrike; price <= maxStrike; price += 0.01) {
            const payoff = this.calculateStrategyPayoff(legs, price, params);

            if ((prevPayoff < 0 && payoff >= 0) || (prevPayoff > 0 && payoff <= 0)) {
                breakevens.push(parseFloat(price.toFixed(2)));
            }

            prevPayoff = payoff;
        }

        return breakevens;
    }

    /**
     * Calculate max profit and max loss for a strategy.
     * @param {Array} legs - Array of strategy legs
     * @param {Object} params - Strategy parameters
     * @param {number} minPrice - Minimum price to evaluate
     * @param {number} maxPrice - Maximum price to evaluate
     * @returns {Object}
     */
    calculateProfitLoss(legs, params, minPrice, maxPrice) {
        let maxProfit = -Infinity;
        let maxLoss = Infinity;
        let maxProfitPrice = 0;
        let maxLossPrice = 0;

        for (let price = minPrice; price <= maxPrice; price += 0.1) {
            const payoff = this.calculateStrategyPayoff(legs, price, params);

            if (payoff > maxProfit) {
                maxProfit = payoff;
                maxProfitPrice = price;
            }
            if (payoff < maxLoss) {
                maxLoss = payoff;
                maxLossPrice = price;
            }
        }

        return {
            maxProfit: maxProfit === Infinity ? 'Unlimited' : maxProfit,
            maxProfitPrice,
            maxLoss: maxLoss === -Infinity ? 'Unlimited' : maxLoss,
            maxLossPrice
        };
    }
}
