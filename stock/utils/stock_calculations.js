/**
 * Stock Calculations utility class.
 */
export class StockCalculations {
    /**
     * Calculate percentage change.
     * @param {number} current - Current price
     * @param {number} previous - Previous price
     * @returns {number}
     */
    static percentageChange(current, previous) {
        if (!previous) return 0;
        return (current - previous) / previous;
    }

    /**
     * Calculate price change.
     * @param {number} current - Current price
     * @param {number} previous - Previous price
     * @returns {number}
     */
    static priceChange(current, previous) {
        return current - previous;
    }

    /**
     * Calculate simple returns.
     * @param {number[]} prices - Array of prices
     * @returns {number[]}
     */
    static simpleReturns(prices) {
        if (prices.length < 2) return [];
        return prices.slice(1).map((price, i) => 
            (price - prices[i]) / prices[i]
        );
    }

    /**
     * Calculate average return.
     * @param {number[]} returns - Array of returns
     * @returns {number}
     */
    static averageReturn(returns) {
        if (!returns.length) return 0;
        return returns.reduce((sum, r) => sum + r, 0) / returns.length;
    }

    /**
     * Calculate standard deviation.
     * @param {number[]} values - Array of values
     * @returns {number}
     */
    static standardDeviation(values) {
        if (values.length < 2) return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
        return Math.sqrt(variance);
    }

    /**
     * Calculate CAGR (Compound Annual Growth Rate).
     * @param {number} startValue - Starting value
     * @param {number} endValue - Ending value
     * @param {number} years - Number of years
     * @returns {number}
     */
    static cagr(startValue, endValue, years) {
        if (startValue <= 0 || years <= 0) return 0;
        return Math.pow(endValue / startValue, 1 / years) - 1;
    }

    /**
     * Calculate RSI (Relative Strength Index).
     * @param {number[]} prices - Array of prices
     * @param {number} period - RSI period (default 14)
     * @returns {number}
     */
    static rsi(prices, period = 14) {
        if (prices.length < period + 1) return null;

        const changes = prices.slice(1).map((price, i) => price - prices[i]);
        const gains = changes.map(c => c > 0 ? c : 0);
        const losses = changes.map(c => c < 0 ? -c : 0);

        const avgGain = gains.slice(-period).reduce((sum, g) => sum + g, 0) / period;
        const avgLoss = losses.slice(-period).reduce((sum, l) => sum + l, 0) / period;

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    /**
     * Calculate SMA (Simple Moving Average).
     * @param {number[]} prices - Array of prices
     * @param {number} period - SMA period
     * @returns {number}
     */
    static sma(prices, period) {
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        return slice.reduce((sum, p) => sum + p, 0) / period;
    }

    /**
     * Calculate EMA (Exponential Moving Average).
     * @param {number[]} prices - Array of prices
     * @param {number} period - EMA period
     * @returns {number}
     */
    static ema(prices, period) {
        if (prices.length < period) return null;

        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;

        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
        }

        return ema;
    }

    /**
     * Calculate VWAP (Volume Weighted Average Price).
     * @param {Array} data - Array of {price, volume} objects
     * @returns {number}
     */
    static vwap(data) {
        if (!data.length) return null;

        let sumPV = 0;
        let sumV = 0;

        for (const { price, volume } of data) {
            sumPV += price * volume;
            sumV += volume;
        }

        return sumV > 0 ? sumPV / sumV : null;
    }

    /**
     * Calculate beta against a benchmark.
     * @param {number[]} stockReturns - Stock returns
     * @param {number[]} benchmarkReturns - Benchmark returns
     * @returns {number}
     */
    static beta(stockReturns, benchmarkReturns) {
        if (stockReturns.length !== benchmarkReturns.length || stockReturns.length < 2) {
            return null;
        }

        const n = stockReturns.length;
        const stockMean = stockReturns.reduce((sum, r) => sum + r, 0) / n;
        const benchmarkMean = benchmarkReturns.reduce((sum, r) => sum + r, 0) / n;

        let covariance = 0;
        let benchmarkVariance = 0;

        for (let i = 0; i < n; i++) {
            const stockDiff = stockReturns[i] - stockMean;
            const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
            covariance += stockDiff * benchmarkDiff;
            benchmarkVariance += benchmarkDiff * benchmarkDiff;
        }

        return benchmarkVariance > 0 ? covariance / benchmarkVariance : null;
    }
}
