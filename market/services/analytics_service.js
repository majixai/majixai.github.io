/**
 * Analytics Service for market data analysis.
 */
export class AnalyticsService {
    /**
     * Calculate simple moving average.
     * @param {number[]} prices - Array of price values
     * @param {number} period - Number of periods
     * @returns {number[]}
     */
    static calculateSMA(prices, period) {
        if (prices.length < period) {
            return [];
        }

        const sma = [];
        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        return sma;
    }

    /**
     * Calculate exponential moving average.
     * @param {number[]} prices - Array of price values
     * @param {number} period - Number of periods
     * @returns {number[]}
     */
    static calculateEMA(prices, period) {
        if (prices.length < period) {
            return [];
        }

        const multiplier = 2 / (period + 1);
        const ema = [];

        // First EMA is SMA
        const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        ema.push(firstSMA);

        for (let i = period; i < prices.length; i++) {
            const newEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
            ema.push(newEMA);
        }

        return ema;
    }

    /**
     * Calculate Relative Strength Index (RSI).
     * @param {number[]} prices - Array of price values
     * @param {number} period - RSI period (typically 14)
     * @returns {number[]}
     */
    static calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) {
            return [];
        }

        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }

        const rsi = [];
        let avgGain = 0;
        let avgLoss = 0;

        // Initial average
        for (let i = 0; i < period; i++) {
            if (changes[i] > 0) {
                avgGain += changes[i];
            } else {
                avgLoss += Math.abs(changes[i]);
            }
        }
        avgGain /= period;
        avgLoss /= period;

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));

        // Subsequent values
        for (let i = period; i < changes.length; i++) {
            const gain = changes[i] > 0 ? changes[i] : 0;
            const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;

            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;

            const newRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + newRS)));
        }

        return rsi;
    }

    /**
     * Calculate Bollinger Bands.
     * @param {number[]} prices - Array of price values
     * @param {number} period - Period for moving average
     * @param {number} stdDevMultiplier - Standard deviation multiplier
     * @returns {Object}
     */
    static calculateBollingerBands(prices, period = 20, stdDevMultiplier = 2) {
        if (prices.length < period) {
            return { upper: [], middle: [], lower: [] };
        }

        const middle = this.calculateSMA(prices, period);
        const upper = [];
        const lower = [];

        for (let i = period - 1; i < prices.length; i++) {
            const slice = prices.slice(i - period + 1, i + 1);
            const mean = slice.reduce((a, b) => a + b, 0) / period;
            const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
            const stdDev = Math.sqrt(variance);

            upper.push(middle[i - period + 1] + stdDevMultiplier * stdDev);
            lower.push(middle[i - period + 1] - stdDevMultiplier * stdDev);
        }

        return { upper, middle, lower };
    }

    /**
     * Calculate price momentum.
     * @param {number[]} prices - Array of price values
     * @param {number} period - Momentum period
     * @returns {number[]}
     */
    static calculateMomentum(prices, period = 10) {
        if (prices.length < period + 1) {
            return [];
        }

        const momentum = [];
        for (let i = period; i < prices.length; i++) {
            momentum.push(prices[i] - prices[i - period]);
        }
        return momentum;
    }

    /**
     * Calculate daily returns.
     * @param {number[]} prices - Array of price values
     * @returns {number[]}
     */
    static calculateReturns(prices) {
        if (prices.length < 2) {
            return [];
        }

        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
        return returns;
    }

    /**
     * Calculate volatility (standard deviation of returns).
     * @param {number[]} prices - Array of price values
     * @param {number} period - Period for volatility calculation
     * @returns {number[]}
     */
    static calculateVolatility(prices, period = 20) {
        const returns = this.calculateReturns(prices);

        if (returns.length < period) {
            return [];
        }

        const volatility = [];
        for (let i = period - 1; i < returns.length; i++) {
            const slice = returns.slice(i - period + 1, i + 1);
            const mean = slice.reduce((a, b) => a + b, 0) / period;
            const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (period - 1);
            volatility.push(Math.sqrt(variance));
        }

        return volatility;
    }
}
