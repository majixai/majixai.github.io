/**
 * Greeks Service for calculating option sensitivities.
 */
export class GreeksService {
    /**
     * Calculate position delta.
     * @param {number} optionDelta - Delta per contract
     * @param {number} contracts - Number of contracts
     * @param {string} position - 'long' or 'short'
     * @returns {number}
     */
    static positionDelta(optionDelta, contracts, position) {
        const multiplier = position === 'long' ? 1 : -1;
        return optionDelta * contracts * 100 * multiplier;
    }

    /**
     * Calculate portfolio delta.
     * @param {Array} positions - Array of position objects with delta, contracts, position
     * @returns {number}
     */
    static portfolioDelta(positions) {
        return positions.reduce((total, pos) => {
            return total + this.positionDelta(pos.delta, pos.contracts, pos.position);
        }, 0);
    }

    /**
     * Calculate position gamma.
     * @param {number} optionGamma - Gamma per contract
     * @param {number} contracts - Number of contracts
     * @returns {number}
     */
    static positionGamma(optionGamma, contracts) {
        return optionGamma * contracts * 100;
    }

    /**
     * Calculate portfolio gamma.
     * @param {Array} positions - Array of position objects with gamma and contracts
     * @returns {number}
     */
    static portfolioGamma(positions) {
        return positions.reduce((total, pos) => {
            return total + this.positionGamma(pos.gamma, pos.contracts);
        }, 0);
    }

    /**
     * Calculate position theta.
     * @param {number} optionTheta - Theta per contract
     * @param {number} contracts - Number of contracts
     * @param {string} position - 'long' or 'short'
     * @returns {number}
     */
    static positionTheta(optionTheta, contracts, position) {
        const multiplier = position === 'long' ? 1 : -1;
        return optionTheta * contracts * 100 * multiplier;
    }

    /**
     * Calculate portfolio theta.
     * @param {Array} positions - Array of position objects with theta, contracts, position
     * @returns {number}
     */
    static portfolioTheta(positions) {
        return positions.reduce((total, pos) => {
            return total + this.positionTheta(pos.theta, pos.contracts, pos.position);
        }, 0);
    }

    /**
     * Calculate position vega.
     * @param {number} optionVega - Vega per contract
     * @param {number} contracts - Number of contracts
     * @param {string} position - 'long' or 'short'
     * @returns {number}
     */
    static positionVega(optionVega, contracts, position) {
        const multiplier = position === 'long' ? 1 : -1;
        return optionVega * contracts * 100 * multiplier;
    }

    /**
     * Calculate portfolio vega.
     * @param {Array} positions - Array of position objects with vega, contracts, position
     * @returns {number}
     */
    static portfolioVega(positions) {
        return positions.reduce((total, pos) => {
            return total + this.positionVega(pos.vega, pos.contracts, pos.position);
        }, 0);
    }

    /**
     * Calculate delta-neutral hedge ratio.
     * @param {number} portfolioDelta - Current portfolio delta
     * @param {number} hedgeInstrumentDelta - Delta of hedging instrument
     * @returns {number}
     */
    static deltaHedgeRatio(portfolioDelta, hedgeInstrumentDelta) {
        if (hedgeInstrumentDelta === 0) {
            return null;
        }
        return -portfolioDelta / hedgeInstrumentDelta;
    }

    /**
     * Calculate gamma-weighted delta.
     * @param {number} delta - Current delta
     * @param {number} gamma - Current gamma
     * @param {number} priceChange - Expected price change
     * @returns {number}
     */
    static gammaAdjustedDelta(delta, gamma, priceChange) {
        return delta + (0.5 * gamma * priceChange);
    }

    /**
     * Estimate P&L based on Greeks.
     * @param {Object} greeks - Object containing delta, gamma, theta, vega
     * @param {number} priceChange - Change in underlying price
     * @param {number} volChange - Change in volatility (in percentage points)
     * @param {number} daysElapsed - Days elapsed
     * @returns {Object}
     */
    static estimatePnL(greeks, priceChange, volChange, daysElapsed) {
        const deltaPnL = greeks.delta * priceChange;
        const gammaPnL = 0.5 * greeks.gamma * priceChange * priceChange;
        const thetaPnL = greeks.theta * daysElapsed;
        const vegaPnL = greeks.vega * volChange;

        return {
            deltaPnL,
            gammaPnL,
            thetaPnL,
            vegaPnL,
            totalPnL: deltaPnL + gammaPnL + thetaPnL + vegaPnL
        };
    }
}
