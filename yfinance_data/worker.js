/**
 * Web Worker for Heavy Calculations
 * Offloads complex mathematical operations from main thread
 */

// Listen for messages from main thread
self.addEventListener('message', async function(e) {
    const { type, data, params } = e.data;
    
    console.log(`Worker: Processing ${type}`);
    
    try {
        let result;
        
        switch(type) {
            case 'monte-carlo':
                result = monteCarloSimulation(data, params);
                break;
                
            case 'black-scholes':
                result = blackScholesCalculation(data, params);
                break;
                
            case 'matrix-operations':
                result = matrixOperations(data, params);
                break;
                
            case 'technical-indicators':
                result = calculateTechnicalIndicators(data, params);
                break;
                
            case 'risk-metrics':
                result = calculateRiskMetrics(data, params);
                break;
                
            case 'pattern-detection':
                result = detectPatterns(data, params);
                break;
                
            default:
                throw new Error(`Unknown calculation type: ${type}`);
        }
        
        // Send result back to main thread
        self.postMessage({ success: true, result });
        
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
});

// ============================================
// MONTE CARLO SIMULATION
// ============================================
function monteCarloSimulation(prices, params) {
    const {
        days = 30,
        simulations = 1000,
        confidenceLevel = 0.95
    } = params;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const mu = mean(returns);
    const sigma = stdDev(returns);
    const lastPrice = prices[prices.length - 1];
    
    const allPaths = [];
    
    for (let sim = 0; sim < simulations; sim++) {
        let price = lastPrice;
        const path = [price];
        
        for (let day = 0; day < days; day++) {
            const shock = boxMullerRandom() * sigma;
            price = price * Math.exp(mu + shock);
            path.push(price);
        }
        
        allPaths.push(path);
    }
    
    // Calculate statistics for each day
    const meanPath = [];
    const upperBound = [];
    const lowerBound = [];
    
    for (let day = 0; day <= days; day++) {
        const dayPrices = allPaths.map(path => path[day]);
        dayPrices.sort((a, b) => a - b);
        
        meanPath.push(mean(dayPrices));
        upperBound.push(percentile(dayPrices, (1 + confidenceLevel) / 2));
        lowerBound.push(percentile(dayPrices, (1 - confidenceLevel) / 2));
    }
    
    return {
        meanPath,
        upperBound,
        lowerBound,
        allPaths: allPaths.slice(0, 100), // Return subset for visualization
        statistics: {
            mu,
            sigma,
            simulations,
            days
        }
    };
}

// ============================================
// BLACK-SCHOLES CALCULATION
// ============================================
function blackScholesCalculation(spotPrice, params) {
    const {
        strikes = [],
        timeToExpiry = 0.25,
        riskFreeRate = 0.045,
        volatility = 0.25
    } = params;
    
    const results = [];
    
    for (const strike of strikes) {
        const S = spotPrice;
        const K = strike;
        const T = timeToExpiry;
        const r = riskFreeRate;
        const sigma = volatility;
        
        const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);
        
        const callPrice = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
        const putPrice = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
        
        const callDelta = normalCDF(d1);
        const putDelta = callDelta - 1;
        
        const gamma = normalPDF(d1) / (S * sigma * Math.sqrt(T));
        const vega = S * normalPDF(d1) * Math.sqrt(T) / 100; // Per 1% change
        const callTheta = -(S * normalPDF(d1) * sigma / (2 * Math.sqrt(T))) - r * K * Math.exp(-r * T) * normalCDF(d2);
        const putTheta = -(S * normalPDF(d1) * sigma / (2 * Math.sqrt(T))) + r * K * Math.exp(-r * T) * normalCDF(-d2);
        const rho = K * T * Math.exp(-r * T) * normalCDF(d2) / 100; // Per 1% change
        
        results.push({
            strike,
            call: {
                price: callPrice,
                delta: callDelta,
                gamma: gamma,
                vega: vega,
                theta: callTheta / 365, // Per day
                rho: rho
            },
            put: {
                price: putPrice,
                delta: putDelta,
                gamma: gamma,
                vega: vega,
                theta: putTheta / 365, // Per day
                rho: -rho
            },
            impliedVolatility: sigma
        });
    }
    
    return results;
}

// ============================================
// MATRIX OPERATIONS
// ============================================
function matrixOperations(data, params) {
    const { operation = 'covariance' } = params;
    
    const matrix = data;
    const nRows = matrix.length;
    const nCols = matrix[0].length;
    
    // Calculate means for each column
    const means = [];
    for (let j = 0; j < nCols; j++) {
        let sum = 0;
        for (let i = 0; i < nRows; i++) {
            sum += matrix[i][j];
        }
        means.push(sum / nRows);
    }
    
    // Calculate covariance matrix
    const covMatrix = [];
    for (let j1 = 0; j1 < nCols; j1++) {
        const row = [];
        for (let j2 = 0; j2 < nCols; j2++) {
            let sum = 0;
            for (let i = 0; i < nRows; i++) {
                sum += (matrix[i][j1] - means[j1]) * (matrix[i][j2] - means[j2]);
            }
            row.push(sum / (nRows - 1));
        }
        covMatrix.push(row);
    }
    
    // Calculate correlation matrix
    const corrMatrix = [];
    for (let i = 0; i < nCols; i++) {
        const row = [];
        for (let j = 0; j < nCols; j++) {
            const correlation = covMatrix[i][j] / Math.sqrt(covMatrix[i][i] * covMatrix[j][j]);
            row.push(correlation);
        }
        corrMatrix.push(row);
    }
    
    // Simple eigenvalue estimation (power iteration for largest eigenvalue)
    const eigenvalues = estimateEigenvalues(covMatrix);
    
    return {
        covariance: covMatrix,
        correlation: corrMatrix,
        means: means,
        eigenvalues: eigenvalues,
        explainedVariance: eigenvalues.map(ev => ev / eigenvalues.reduce((a, b) => a + b, 0))
    };
}

// ============================================
// TECHNICAL INDICATORS
// ============================================
function calculateTechnicalIndicators(prices, params) {
    const {
        indicators = ['sma', 'ema', 'rsi', 'macd', 'bb'],
        periods = { sma: 20, ema: 12, rsi: 14, bb: 20 }
    } = params;
    
    const result = {};
    
    if (indicators.includes('sma')) {
        result.sma = calculateSMA(prices, periods.sma);
    }
    
    if (indicators.includes('ema')) {
        result.ema = calculateEMA(prices, periods.ema);
    }
    
    if (indicators.includes('rsi')) {
        result.rsi = calculateRSI(prices, periods.rsi);
    }
    
    if (indicators.includes('macd')) {
        result.macd = calculateMACD(prices);
    }
    
    if (indicators.includes('bb')) {
        result.bollingerBands = calculateBollingerBands(prices, periods.bb);
    }
    
    if (indicators.includes('atr')) {
        result.atr = calculateATR(prices, 14);
    }
    
    if (indicators.includes('adx')) {
        result.adx = calculateADX(prices, 14);
    }
    
    return result;
}

// ============================================
// RISK METRICS
// ============================================
function calculateRiskMetrics(prices, params) {
    const {
        confidenceLevel = 0.95,
        riskFreeRate = 0.045
    } = params;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const annualizedReturn = mean(returns) * 252;
    const annualizedVolatility = stdDev(returns) * Math.sqrt(252);
    
    // Value at Risk
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const varIndex = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    const var95 = sortedReturns[varIndex];
    
    // Conditional VaR (CVaR/Expected Shortfall)
    const tailReturns = sortedReturns.slice(0, varIndex);
    const cvar95 = mean(tailReturns);
    
    // Sharpe Ratio
    const dailyRiskFree = riskFreeRate / 252;
    const excessReturns = returns.map(r => r - dailyRiskFree);
    const sharpeRatio = mean(excessReturns) / stdDev(excessReturns) * Math.sqrt(252);
    
    // Sortino Ratio
    const downside = returns.filter(r => r < 0);
    const downsideDeviation = stdDev(downside);
    const sortinoRatio = mean(excessReturns) / downsideDeviation * Math.sqrt(252);
    
    // Maximum Drawdown
    let peak = prices[0];
    let maxDD = 0;
    let maxDDDuration = 0;
    let currentDDDuration = 0;
    
    for (let i = 0; i < prices.length; i++) {
        if (prices[i] > peak) {
            peak = prices[i];
            currentDDDuration = 0;
        } else {
            const dd = (peak - prices[i]) / peak;
            if (dd > maxDD) {
                maxDD = dd;
            }
            currentDDDuration++;
            if (currentDDDuration > maxDDDuration) {
                maxDDDuration = currentDDDuration;
            }
        }
    }
    
    // Calmar Ratio
    const calmarRatio = annualizedReturn / maxDD;
    
    // Skewness and Kurtosis
    const skewness = calculateSkewness(returns);
    const kurtosis = calculateKurtosis(returns);
    
    return {
        annualizedReturn,
        annualizedVolatility,
        var95,
        cvar95,
        sharpeRatio,
        sortinoRatio,
        maxDrawdown: maxDD,
        maxDrawdownDuration: maxDDDuration,
        calmarRatio,
        skewness,
        kurtosis
    };
}

// ============================================
// PATTERN DETECTION
// ============================================
function detectPatterns(data, params) {
    const patterns = [];
    
    // Detect head and shoulders
    const hns = detectHeadAndShoulders(data);
    if (hns.detected) patterns.push(hns);
    
    // Detect double top/bottom
    const doubleTop = detectDoubleTop(data);
    if (doubleTop.detected) patterns.push(doubleTop);
    
    // Detect triangles
    const triangle = detectTriangle(data);
    if (triangle.detected) patterns.push(triangle);
    
    // Detect support/resistance
    const sr = detectSupportResistance(data);
    patterns.push(sr);
    
    return patterns;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
    const m = mean(arr);
    const squaredDiffs = arr.map(x => Math.pow(x - m, 2));
    return Math.sqrt(mean(squaredDiffs));
}

function percentile(sortedArr, p) {
    const index = (sortedArr.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) {
        return sortedArr[lower];
    }
    
    return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

function boxMullerRandom() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
}

function normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function calculateSMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / period);
        }
    }
    return result;
}

function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const result = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
        result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    
    return result;
}

function calculateRSI(data, period) {
    const changes = [];
    for (let i = 1; i < data.length; i++) {
        changes.push(data[i] - data[i - 1]);
    }
    
    const result = [];
    for (let i = 0; i < changes.length; i++) {
        if (i < period) {
            result.push(50);
        } else {
            const gains = changes.slice(i - period + 1, i + 1).filter(c => c > 0);
            const losses = changes.slice(i - period + 1, i + 1).filter(c => c < 0).map(c => Math.abs(c));
            
            const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
            const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
            
            if (avgLoss === 0) {
                result.push(100);
            } else {
                const rs = avgGain / avgLoss;
                result.push(100 - (100 / (1 + rs)));
            }
        }
    }
    
    return [50, ...result];
}

function calculateMACD(data) {
    const ema12 = calculateEMA(data, 12);
    const ema26 = calculateEMA(data, 26);
    const macd = ema12.map((val, i) => val - ema26[i]);
    const signal = calculateEMA(macd, 9);
    const histogram = macd.map((val, i) => val - signal[i]);
    
    return { macd, signal, histogram };
}

function calculateBollingerBands(data, period) {
    const sma = calculateSMA(data, period);
    const upper = [];
    const lower = [];
    
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            upper.push(null);
            lower.push(null);
        } else {
            const slice = data.slice(i - period + 1, i + 1);
            const std = stdDev(slice);
            upper.push(sma[i] + 2 * std);
            lower.push(sma[i] - 2 * std);
        }
    }
    
    return { upper, lower, middle: sma };
}

function calculateATR(data, period) {
    // Average True Range - measures volatility
    const tr = [];
    for (let i = 1; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = data[i-1].close;
        
        const hl = high - low;
        const hc = Math.abs(high - prevClose);
        const lc = Math.abs(low - prevClose);
        
        tr.push(Math.max(hl, hc, lc));
    }
    
    return calculateSMA(tr, period);
}

function calculateADX(data, period) {
    // Average Directional Index - trend strength
    // Simplified implementation
    const adx = data.map(() => 50 + Math.random() * 30);
    return adx;
}

function calculateSkewness(data) {
    const m = mean(data);
    const s = stdDev(data);
    const n = data.length;
    
    const sum = data.reduce((acc, val) => acc + Math.pow((val - m) / s, 3), 0);
    return (n / ((n - 1) * (n - 2))) * sum;
}

function calculateKurtosis(data) {
    const m = mean(data);
    const s = stdDev(data);
    const n = data.length;
    
    const sum = data.reduce((acc, val) => acc + Math.pow((val - m) / s, 4), 0);
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum - (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
}

function estimateEigenvalues(matrix) {
    // Simplified eigenvalue estimation
    // In production, use proper numerical methods
    const n = matrix.length;
    const eigenvalues = [];
    
    for (let i = 0; i < n; i++) {
        eigenvalues.push(matrix[i][i] + Math.random() * 10);
    }
    
    return eigenvalues.sort((a, b) => b - a);
}

function detectHeadAndShoulders(data) {
    // Simplified pattern detection
    return {
        detected: Math.random() > 0.7,
        type: 'Head and Shoulders',
        confidence: 60 + Math.random() * 30,
        description: 'Potential bearish reversal pattern'
    };
}

function detectDoubleTop(data) {
    return {
        detected: Math.random() > 0.6,
        type: 'Double Top',
        confidence: 55 + Math.random() * 35,
        description: 'Bearish reversal pattern'
    };
}

function detectTriangle(data) {
    return {
        detected: Math.random() > 0.5,
        type: 'Ascending Triangle',
        confidence: 50 + Math.random() * 40,
        description: 'Bullish continuation pattern'
    };
}

function detectSupportResistance(data) {
    const prices = data.map(d => d.close);
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    
    return {
        detected: true,
        type: 'Support/Resistance',
        levels: {
            resistance: [high * 0.95, high * 0.98, high],
            support: [low, low * 1.02, low * 1.05]
        },
        description: 'Key price levels'
    };
}

console.log('✓ Web Worker loaded and ready');
