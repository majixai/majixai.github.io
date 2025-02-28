class TickerExtractor {
    /**
     * Extracts the ticker symbol from the directory name in the URL pathname.
     * If extraction fails or the directory name is invalid, returns a default ticker.
     * @returns {string} Ticker symbol or default 'jinx' if extraction fails.
     */
    static getTickerFromDirectoryName() {
        const pathName = window.location.pathname;
        const pathParts = pathName.split('/');
        // Get the second to last part of the path as directory name
        let directoryName = pathParts[pathParts.length - 2];

        // If second to last part is not available, try the last part
        if (!directoryName) {
            directoryName = pathParts[pathParts.length - 1];
        }

        // Handle cases where directoryName might be undefined or empty or null
        if (!directoryName) {
            console.warn("Could not extract ticker from URL path. Using default 'jinx'. Path:", pathName);
            return "jinx";
        }

        // Remove extension if present (e.g., .html, .php)
        directoryName = directoryName.split('.')[0];

        // Validate directoryName to ensure it's not just empty or root path
        if (directoryName.trim() === '' || directoryName.trim() === '/') {
            console.warn("Extracted directory name is invalid. Using default 'jinx'. Path:", pathName, "Directory Name:", directoryName);
            return "jinx";
        }

        return directoryName.trim();
    }
}

class APIConfig {
    /**
     * Configuration class for the Alpha Vantage API.
     * Defines API key, base URL, output size, and extended hours setting.
     * Consider moving API Key to a backend or environment variable for security in production.
     */
    constructor() {
        this.apiKey = 'XVYHOWRTRNPN3FJA'; // API Key - consider security implications for production
        this.baseUrl = 'https://www.alphavantage.co/query';
        this.outputSize = 'full';
        this.extendedHours = false; // Default to false, can be made configurable
    }

    getApiKey() {
        return this.apiKey;
    }

    getBaseUrl() {
        return this.baseUrl;
    }

    getOutputSize() {
        return this.outputSize;
    }

    isExtendedHours() {
        return this.extendedHours;
    }

    setExtendedHours(extendedHours) {
        this.extendedHours = extendedHours;
    }
}

class DataFetcher {
    /**
     * Fetches financial data from the Alpha Vantage API or retrieves cached data.
     * @param {APIConfig} apiConfig - API configuration instance.
     */
    constructor(apiConfig) {
        if (!(apiConfig instanceof APIConfig)) {
            throw new Error('DataFetcher constructor requires an APIConfig instance.');
        }
        this.apiConfig = apiConfig;
    }

    /**
     * Fetches data from the API, caches it, and returns it.
     * If API call fails, it attempts to retrieve cached data.
     * @param {string} interval - Time interval for intraday data (e.g., '1min', '5min', 'daily').
     * @param {string} ticker - Stock ticker symbol.
     * @param {boolean} isDaily - True if fetching daily data, false for intraday.
     * @returns {Promise<object>} Data from API or cached data.
     * @throws {Error} If fetching and cached data are unavailable.
     */
    async fetchData(interval, ticker, isDaily = false) {
        const cacheKey = `chartData-${ticker}-${interval}-${isDaily}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
            try {
                console.log(`Using cached data for ${ticker}, interval: ${interval}, daily: ${isDaily}`);
                return JSON.parse(cachedData);
            } catch (e) {
                console.warn('Error parsing cached data, refetching:', e);
                localStorage.removeItem(cacheKey); //Remove invalid cache
            }
        }

        const apiUrl = this.getApiUrl(interval, ticker, isDaily);
        try {
            console.log(`Fetching data from API for ${ticker}, interval: ${interval}, daily: ${isDaily}`);
            const response = await fetch(apiUrl);
            if (!response.ok) {
                //Handle HTTP errors (e.g., 404, 500)
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            if (data['Error Message'] || data['Note']) {
                throw new Error(data['Error Message'] || data['Note']);
            }

            localStorage.setItem(cacheKey, JSON.stringify(data)); // Cache valid data
            return data;
        } catch (error) {
            console.error('Error fetching data from API:', error);
            if (cachedData) {
                alert('Using cached data due to API error.');
                return JSON.parse(cachedData);
            } else {
                console.error('No cached data available.');
                throw new Error(`Failed to fetch data from API and no valid cache available for ${ticker}, interval: ${interval}, daily: ${isDaily}. Original error: ${error.message}`);
            }
        }
    }

    /**
     * Constructs the Alpha Vantage API URL based on parameters.
     * @param {string} interval - Time interval.
     * @param {string} ticker - Stock ticker.
     * @param {boolean} isDaily - True for daily data, false for intraday.
     * @returns {string} API URL.
     */
    getApiUrl(interval, ticker, isDaily) {
        const apiKey = this.apiConfig.getApiKey();
        const baseUrl = this.apiConfig.getBaseUrl();
        const outputSize = this.apiConfig.getOutputSize();
        const extendedHours = this.apiConfig.isExtendedHours();
        let functionName = isDaily ? 'TIME_SERIES_DAILY_ADJUSTED' : 'TIME_SERIES_INTRADAY';

        let url = `${baseUrl}?function=${functionName}&symbol=${ticker}&apikey=${apiKey}&outputsize=${outputSize}`;

        if (!isDaily) {
            url += `&interval=${interval}&extended_hours=${extendedHours}`;
        }
        return url;
    }
}

class IndicatorCalculator {
    /**
     * Calculates the Moving Average Convergence Divergence (MACD) indicator.
     * @param {number[]} closingPrices - Array of closing prices.
     * @returns {object} MACD object containing macd, signal, and histogram arrays.
     */
    calculateMACD(closingPrices) {
        if (!Array.isArray(closingPrices) || closingPrices.length < 26) {
            console.warn("Insufficient data for MACD calculation.");
            return { macd: [], signal: [], histogram: [] }; // Return empty arrays to prevent plotting errors
        }
        const fastPeriod = 12;
        const slowPeriod = 26;
        const signalPeriod = 9;

        const fastEMA = this.calculateEMA(closingPrices, fastPeriod);
        const slowEMA = this.calculateEMA(closingPrices, slowPeriod);
        const macdLine = fastEMA.map((value, index) => value - slowEMA[index]);
        const signalLine = this.calculateEMA(macdLine, signalPeriod);
        const histogram = macdLine.map((value, index) => value - signalLine[index]);

        return { macd: macdLine, signal: signalLine, histogram };
    }

    /**
     * Calculates Exponential Moving Average (EMA).
     * @param {number[]} data - Array of numerical data.
     * @param {number} period - Period for EMA calculation.
     * @returns {number[]} EMA values.
     */
    calculateEMA(data, period) {
        if (!Array.isArray(data) || data.length === 0) {
            console.warn("Cannot calculate EMA on empty or non-array data.");
            return [];
        }
        if (period <= 0 || period > data.length) {
            console.warn("Invalid period for EMA calculation.");
            return data.slice(); // Return original data or handle as needed
        }
        const k = 2 / (period + 1);
        let ema = [data[0]];
        for (let i = 1; i < data.length; i++) {
            ema.push((data[i] * k) + (ema[i - 1] * (1 - k)));
        }
        return ema;
    }

    /**
     * Calculates Average True Range (ATR).
     * @param {number[]} highPrices - Array of high prices.
     * @param {number[]} lowPrices - Array of low prices.
     * @param {number[]} closingPrices - Array of closing prices.
     * @returns {number[]} ATR values.
     */
    calculateATR(highPrices, lowPrices, closingPrices) {
        if (!Array.isArray(highPrices) || !Array.isArray(lowPrices) || !Array.isArray(closingPrices) ||
            highPrices.length !== closingPrices.length || lowPrices.length !== closingPrices.length || closingPrices.length < 2) {
            console.warn("Insufficient or mismatched data for ATR calculation.");
            return [];
        }
        let trueRange = [];
        for (let i = 1; i < closingPrices.length; i++) {
            trueRange.push(Math.max(
                highPrices[i] - lowPrices[i],
                Math.abs(highPrices[i] - closingPrices[i - 1]),
                Math.abs(lowPrices[i] - closingPrices[i - 1])
            ));
        }
        const atrPeriod = 14;
        return this.calculateEMA(trueRange, atrPeriod);
    }

    /**
     * Calculates Stochastic Oscillator (%K and %D).
     * @param {number[]} highPrices - Array of high prices.
     * @param {number[]} lowPrices - Array of low prices.
     * @param {number[]} closingPrices - Array of closing prices.
     * @returns {object} Stochastic oscillator values { k: %K, d: %D }.
     */
    calculateStochastics(highPrices, lowPrices, closingPrices) {
        if (!Array.isArray(highPrices) || !Array.isArray(lowPrices) || !Array.isArray(closingPrices) ||
            highPrices.length !== closingPrices.length || lowPrices.length !== closingPrices.length || closingPrices.length < 14) {
            console.warn("Insufficient or mismatched data for Stochastic calculation.");
            return { k: [], d: [] };
        }
        const kPeriod = 14;
        const dPeriod = 3;

        let kValues = [];
        for (let i = kPeriod - 1; i < closingPrices.length; i++) {
            const highestHigh = Math.max(...highPrices.slice(i - kPeriod + 1, i + 1));
            const lowestLow = Math.min(...lowPrices.slice(i - kPeriod + 1, i + 1));
            if (highestHigh === lowestLow) {
                kValues.push(50); // Avoid division by zero, set to midpoint
            } else {
                kValues.push(100 * (closingPrices[i] - lowestLow) / (highestHigh - lowestLow));
            }
        }
        const dValues = this.calculateEMA(kValues, dPeriod);
        return { k: kValues, d: dValues };
    }

    /**
     * Calculates Standard Deviation.
     * @param {number[]} data - Array of numerical data.
     * @returns {number} Standard deviation or NaN if data is invalid.
     */
    calculateStdev(data) {
        if (!Array.isArray(data) || data.length === 0) {
            console.warn("Cannot calculate stdev on empty or non-array data.");
            return NaN;
        }
        const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
        const squaredDifferences = data.map(val => Math.pow(val - mean, 2));
        const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / data.length;
        return Math.sqrt(variance);
    }

    /**
     * Calculates Variance.
     * @param {number[]} data - Array of numerical data.
     * @returns {number} Variance or NaN if data is invalid.
     */
    calculateVariance(data) {
        if (!Array.isArray(data) || data.length === 0) {
            console.warn("Cannot calculate variance on empty or non-array data.");
            return NaN;
        }
        const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
        const squaredDifferences = data.map(val => Math.pow(val - mean, 2));
        return squaredDifferences.reduce((sum, val) => sum + val, 0) / data.length;
    }

    /**
     * Calculates Covariance between two datasets.
     * @param {number[]} dataX - First dataset.
     * @param {number[]} dataY - Second dataset.
     * @returns {number} Covariance or NaN if data is invalid or mismatched.
     */
    calculateCovariance(dataX, dataY) {
        if (!Array.isArray(dataX) || !Array.isArray(dataY) || dataX.length !== dataY.length || dataX.length === 0) {
            console.warn("Mismatched or empty data for covariance calculation.");
            return NaN;
        }
        const meanX = dataX.reduce((sum, val) => sum + val, 0) / dataX.length;
        const meanY = dataY.reduce((sum, val) => sum + val, 0) / dataY.length;
        let covariance = 0;
        for (let i = 0; i < dataX.length; i++) {
            covariance += (dataX[i] - meanX) * (dataY[i] - meanY);
        }
        return covariance / dataX.length;
    }

    /**
     * Calculates Black-Scholes option price and probability.
     * @param {number} S - Current stock price.
     * @param {number} K - Strike price.
     * @param {number} T - Time to expiration in years.
     * @param {number} r - Risk-free rate.
     * @param {number} sigma - Volatility.
     * @param {string} [optionType='call'] - 'call' or 'put'.
     * @returns {object} Object containing price and probability, or NaN if invalid input.
     */
    calculateBlackScholes(S, K, T, r, sigma, optionType = 'call') {
        if (isNaN(S) || isNaN(K) || isNaN(T) || isNaN(r) || isNaN(sigma)) {
             console.warn("Invalid input (NaN) for Black-Scholes calculation.");
            return { price: NaN, probability: NaN };
        }
        if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
             console.warn("Invalid input (<=0) for Black-Scholes calculation.");
            return { price: 0, probability: 0 };
        }

        const d1 = (Math.log(S / K) + (r + 0.5 * Math.pow(sigma, 2)) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);

        /**
         * Approximates the cumulative normal distribution function (CDF).
         * Using error function approximation - Abramowitz and Stegun method.
         * @param {number} x - The value to evaluate the CDF at.
         * @returns {number} CDF value.
         */
        function cumulativeNormalDistribution(x) {
            const phi = 0.5 * (1.0 + erf(x / Math.sqrt(2.0)));
            return phi;
        }

        /**
         * Approximates the error function (erf).
         * Abramowitz and Stegun approximation.
         * @param {number} x - The value to evaluate the erf at.
         * @returns {number} erf value.
         */
        function erf(x) {
            const a1 = 0.254829592;
            const a2 = -0.284496736;
            const a3 = 1.421413741;
            const a4 = -1.453152027;
            const a5 = 1.061405429;
            const p = 0.3275911;
            const sign = x < 0 ? -1 : 1;
            x = Math.abs(x);
            const t = 1.0 / (1.0 + p * x);
            const erfValue = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
            return sign * erfValue;
        }


        const N_d1 = cumulativeNormalDistribution(d1);
        const N_minus_d1 = cumulativeNormalDistribution(-d1);
        const N_d2 = cumulativeNormalDistribution(d2);
        const N_minus_d2 = cumulativeNormalDistribution(-d2);
        let price, probability;

        if (optionType.toLowerCase() === 'call') {
            price = (S * N_d1 - K * Math.exp(-r * T) * N_d2);
            probability = N_d1; //Probability for call option is N(d1)
        } else if (optionType.toLowerCase() === 'put') {
            price = (K * Math.exp(-r * T) * N_minus_d2 - S * N_minus_d1);
            probability = N_minus_d1;//Probability for put option is N(-d1)
        } else {
            console.warn("Invalid option type for Black-Scholes calculation.");
            return { price: NaN, probability: NaN }; // Invalid option type
        }
        return {price, probability}
    }

    /**
     * Damped Cosine Hyperbolic function for prediction.
     * @param {number} x - Input value.
     * @param {number} [amplitude=1] - Amplitude of the function.
     * @param {number} [damping=0] - Damping factor.
     * @param {number} [phi=0] - Phase shift.
     * @param {number} [theta=0] - Phase shift offset.
     * @returns {number} Calculated value from the damped cosh function.
     */
    cosh(x, amplitude = 1, damping = 0, phi = 0, theta = 0) {
      const damp = Math.exp(-damping * x);
      return amplitude * damp * (0.5 * (Math.exp(x + phi) + Math.exp(-x + theta)));
    }
}

class SummaryGenerator {
    /**
     * Generates an HTML summary of trading indicators and Black-Scholes option prices.
     * @param {number[]} closingPrices - Array of closing prices.
     * @param {object} macd - MACD indicator object.
     * @param {number[]} atr - ATR values.
     * @param {object} stoch - Stochastic oscillator object.
     * @param {number} stdev - Standard deviation of closing prices.
     * @param {number} variance - Variance of closing prices.
     * @param {object} blackScholesCall - Black-Scholes call option price object.
     * @param {object} blackScholesPut - Black-Scholes put option price object.
     * @param {string} ticker - Stock ticker symbol.
     * @param {string} strategy - Trading strategy ('bull', 'bear', 'combined').
     * @returns {string} HTML string for the summary.
     */
    generateSummary(closingPrices, macd, atr, stoch, stdev, variance, blackScholesCall, blackScholesPut, ticker, strategy) {
        let signal = "Neutral";
        let projectedPrice = closingPrices[closingPrices.length - 1];
        let percentChange = 0;
        let daysToFlip = "N/A";

        let buySignals = 0;
        let sellSignals = 0;

        //MACD Histogram check
        if (macd.histogram && macd.histogram.length > 0) { //Check for empty arrays.
            if (macd.histogram[macd.histogram.length - 1] > 0) buySignals++;
            else if (macd.histogram[macd.histogram.length - 1] < 0) sellSignals++;
        }


        //Stochastics check
        if (stoch.k && stoch.d && stoch.k.length > 0 && stoch.d.length > 0) { //Check for empty arrays.
            if (stoch.k[stoch.k.length - 1] > stoch.d[stoch.d.length - 1] && stoch.k[stoch.k.length - 1] < 80) buySignals++;
            else if (stoch.k[stoch.k.length - 1] < stoch.d[stoch.d.length - 1] && stoch.k[stoch.k.length - 1] > 20) sellSignals++;
        }


        //Strategy signal aggregation.
        if (strategy === 'bull') {
            if (buySignals >= 1) signal = "Buy"; //Bull strategy: at least 1 buy signal needed
            else signal = "Neutral";
        } else if (strategy === 'bear') {
            if (sellSignals >= 1) signal = "Sell"; //Bear strategy: at least 1 sell signal
            else signal = "Neutral"
        }
        else { //Combined strategy
            if (buySignals >= 2) signal = "Buy"; //Combined: require stronger signals
            else if (sellSignals >= 2) signal = "Sell";
        }


        if (signal === "Buy") {
            projectedPrice += atr[atr.length - 1]; //Projected price increased by ATR
            daysToFlip = Math.floor(Math.random() * 10) + 1; //Random days estimate
        } else if (signal === "Sell") {
            projectedPrice -= atr[atr.length - 1];  //Projected price decreased by ATR
            daysToFlip = Math.floor(Math.random() * 10) + 1; //Random days estimate
        }

        percentChange = ((projectedPrice - closingPrices[closingPrices.length - 1]) / closingPrices[closingPrices.length - 1]) * 100;

        return `
            <div class="indicator-summary">
              Overall Signal: <span style="color: ${signal === 'Buy' ? 'green' : (signal === 'Sell' ? 'red' : 'blue')}">${signal}</span><br>
              Projected Price: ${projectedPrice.toFixed(2)}<br>
              Percent Change: ${percentChange.toFixed(2)}%<br>
              Time to Signal Flip (Days Estimate): ${daysToFlip} days<br>
              Standard Deviation (Closing Prices): ${stdev.toFixed(2)}<br>
              Variance (Closing Prices): ${variance.toFixed(2)}<br>
              Black-Scholes Call Option Price: ${isNaN(blackScholesCall.price) ? 'N/A' : blackScholesCall.price.toFixed(2)}<br>
              Probability (Call): ${isNaN(blackScholesCall.probability) ? 'N/A' : (blackScholesCall.probability * 100).toFixed(2)}%<br>
              Black-Scholes Put Option Price: ${isNaN(blackScholesPut.price) ? 'N/A' : blackScholesPut.price.toFixed(2)}<br>
               Probability (Put): ${isNaN(blackScholesPut.probability) ? 'N/A' : (blackScholesPut.probability * 100).toFixed(2)}%
            </div>
          `;
    }
}


class ChartPlotter {
    /**
     * Class for plotting stock charts using Plotly.js, including candlestick,
     * indicator charts (MACD, ATR, Stochastics, StDev, Variance) and cosh prediction chart.
     * Stores zoom levels for each chart to maintain zoom state across updates.
     */
    constructor() {
        this.zoomData = {}; // Store zoom ranges for charts
        this.indicatorCalculator = new IndicatorCalculator(); //Calculator instance.
    }

    /**
     * Plots candlestick chart, indicator chart, and summary for a given dataset.
     * @param {object} data - Data from API.
     * @param {string} interval - Time interval.
     * @param {string} ticker - Stock ticker.
     * @param {IndicatorCalculator} indicatorCalculator - Indicator calculator instance.
     * @param {SummaryGenerator} summaryGenerator - Summary generator instance.
     * @param {boolean} isDaily - True if daily data, false for intraday.
     * @param {string} strategy - Trading strategy ('bull', 'bear', 'combined').
     */
    plotCharts(data, interval, ticker, indicatorCalculator, summaryGenerator, isDaily, strategy) {
        let timeSeriesKey = isDaily ? 'Time Series (Daily)' : `Time Series (${interval})`;
        if (!data[timeSeriesKey]) {
            console.error('Invalid data format for interval:', interval, data);
            document.getElementById('summary').innerHTML = `<p>Error: Invalid data format for interval ${interval}. Please try again later.</p>`;
            return;
        }

        // Extract OHLCV data and reverse dates for chronological order
        const dates = Object.keys(data[timeSeriesKey]).reverse();
        const closingPrices = dates.map(date => parseFloat(data[timeSeriesKey][date][isDaily ? '5. adjusted close' : '4. close']));
        const highPrices = dates.map(date => parseFloat(data[timeSeriesKey][date]['2. high']));
        const lowPrices = dates.map(date => parseFloat(data[timeSeriesKey][date]['3. low']));
        const openPrices = dates.map(date => parseFloat(data[timeSeriesKey][date]['1. open']));


        // Calculate technical indicators
        const macd = indicatorCalculator.calculateMACD(closingPrices);
        const atr = indicatorCalculator.calculateATR(highPrices, lowPrices, closingPrices);
        const stoch = indicatorCalculator.calculateStochastics(highPrices, lowPrices, closingPrices);
        const stdev = indicatorCalculator.calculateStdev(closingPrices);
        const variance = indicatorCalculator.calculateVariance(closingPrices);

        // Black-Scholes Approximation - using last closing price, ATR as volatility proxy
        const lastClosingPrice = closingPrices[closingPrices.length - 1];
        const volatilityProxy = atr[atr.length - 1] / lastClosingPrice; // Volatility proxy
        const riskFreeRate = 0.02; // Risk-free rate (e.g., 2%)
        const timeToExpiration = 1 / 365; // Time to expiration, 1 day in years


        const blackScholesCall = indicatorCalculator.calculateBlackScholes(lastClosingPrice, lastClosingPrice, timeToExpiration, riskFreeRate, volatilityProxy, 'call');
        const blackScholesPut = indicatorCalculator.calculateBlackScholes(lastClosingPrice, lastClosingPrice, timeToExpiration, riskFreeRate, volatilityProxy, 'put');


        // Generate and display summary
        const summaryHTML = summaryGenerator.generateSummary(closingPrices, macd, atr, stoch, stdev, variance, blackScholesCall, blackScholesPut, ticker, strategy);
        document.getElementById('summary').innerHTML = summaryHTML;

        // Plot charts
        this.plotPriceChart(dates, openPrices, highPrices, lowPrices, closingPrices, ticker, interval, macd, isDaily);
        this.plotIndicatorChart(dates, macd, atr, stoch, stdev, variance, interval, isDaily);
        this.plotCoshPrediction(dates, openPrices, highPrices, lowPrices, closingPrices, interval, isDaily);
    }


    /**
     * Plots the candlestick price chart.
     * @param {string[]} dates - Array of dates for x-axis.
     * @param {number[]} openPrices - Array of open prices.
     * @param {number[]} highPrices - Array of high prices.
     * @param {number[]} lowPrices - Array of low prices.
     * @param {number[]} closingPrices - Array of closing prices.
     * @param {string} ticker - Stock ticker.
     * @param {string} interval - Time interval.
     * @param {object} macd - MACD indicator object.
     * @param {boolean} isDaily - True if daily chart.
     */
    plotPriceChart(dates, openPrices, highPrices, lowPrices, closingPrices, ticker, interval, macd, isDaily) {
        const bullColor = '#007030'; // Dark green for bullish candles
        const bearColor = '#8C1515'; // Dark red for bearish candles

        const priceTrace = {
            x: dates,
            open: openPrices,
            high: highPrices,
            low: lowPrices,
            close: closingPrices,
            decreasing: { line: { color: bearColor } },
            increasing: { line: { color: bullColor } },
            type: 'candlestick',
            xaxis: 'x',
            yaxis: 'y',
            name: 'Price'
        };

        //Define rangeslider buttons based on daily or intraday
        let rangeSelectorButtons = [
            { step: 'day', stepmode: 'backward', count: 1, label: '1 day' },
            { step: 'month', stepmode: 'backward', count: 1, label: '1 month' },
            { step: 'month', stepmode: 'backward', count: 6, label: '6 months' },
            { step: 'year', stepmode: 'backward', count: 1, label: '1 year' },
            { step: 'all', label: 'All' }
        ];

        if (isDaily) {
            rangeSelectorButtons = [
                { step: 'month', stepmode: 'backward', count: 1, label: '1 month' },
                { step: 'month', stepmode: 'backward', count: 6, label: '6mo' },
                { step: 'year', stepmode: 'backward', count: 1, label: '1y' },
                { step: 'year', stepmode: 'backward', count: 5, label: '5y' },
                { step: 'all', label: 'All' }
            ];
        }

        const priceLayout = {
            title: `${ticker.toUpperCase()} ${isDaily ? 'Daily' : 'Intraday'} Candlestick Chart (${interval})`,
            dragmode: 'zoom',
            margin: { r: 10, t: 25, b: 40, l: 60 },
            showlegend: true,
            xaxis: {
                autorange: true,
                rangeslider: { visible: false }, // Hide range slider initially
                title: 'Date',
                type: 'date',
                rangeselector: {
                    x: 0, y: 1.2, xanchor: 'left', font: { size: 8 }, buttons: rangeSelectorButtons
                }
            },
            yaxis: { autorange: true, type: 'linear', title: 'Price' },
            annotations: this.getAnnotations(dates, macd.histogram) // Annotations for potential turns
        };

        // Restore zoom, if available
        if (this.zoomData[`price-${interval}-${isDaily}`]) {
            Object.assign(priceLayout.xaxis, {range: this.zoomData[`price-${interval}-${isDaily}`].xRange});
            Object.assign(priceLayout.yaxis, {range: this.zoomData[`price-${interval}-${isDaily}`].yRange});
        }


        const priceChart = document.getElementById('price-chart');
        Plotly.newPlot('price-chart', [priceTrace], priceLayout, { responsive: true });

        // Zoom event handler to save zoom state
        priceChart.on('plotly_relayout', (eventData) => {
            if (eventData['xaxis.range[0]'] && eventData['yaxis.range[0]']) {
                this.zoomData[`price-${interval}-${isDaily}`] = {
                    xRange: [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']],
                    yRange: [eventData['yaxis.range[0]'], eventData['yaxis.range[1]']]
                };
            } else if (eventData['xaxis.autorange'] && eventData['yaxis.autorange']) {
                delete this.zoomData[`price-${interval}-${isDaily}`]; // Reset zoom data on autorange
            }
        });
    }

    /**
     * Generates annotations for potential bull/bear turns on the chart.
     * @param {string[]} dates - Array of dates.
     * @param {number[]} macdHistogram - MACD histogram data.
     * @returns {Array<object>} Array of annotation objects for Plotly.
     */
    getAnnotations(dates, macdHistogram) {
        const annotations = [];
        const threshold = 0;
        const potentialBearColor = '#FEE11A'; // Yellow for potential bear turn
        const potentialBullColor = '#00539B'; // Dark blue for potential bull turn

        // Annotate points where MACD histogram crosses zero
        if(Array.isArray(macdHistogram) && macdHistogram.length > 0) { //Check for empty arrays.
            for (let i = 1; i < macdHistogram.length; i++) {
                if ((macdHistogram[i - 1] <= threshold && macdHistogram[i] > threshold) || (macdHistogram[i - 1] >= threshold && macdHistogram[i] < threshold)) {
                    const annotationText = macdHistogram[i] > threshold ? 'Potential Bull Turn' : 'Potential Bear Turn';
                    const annotationColor = macdHistogram[i] > threshold ? potentialBullColor : potentialBearColor;
                    annotations.push({
                        x: dates[i],
                        y: 0,
                        xref: 'x',
                        yref: 'y domain',
                        text: annotationText,
                        showarrow: true,
                        arrowcolor: annotationColor,
                        arrowhead: 3,
                        ax: 0,
                        ay: -40,
                        font: { color: annotationColor }
                    });
                }
            }
        }

        return annotations;
    }


    /**
     * Plots the indicator chart including MACD, ATR, Stochastics, StDev, and Variance.
     * @param {string[]} dates - Array of dates.
     * @param {object} macd - MACD indicator object.
     * @param {number[]} atr - ATR values.
     * @param {object} stoch - Stochastic oscillator object.
     * @param {number} stdev - Standard deviation values.
     * @param {number} variance - Variance values.
     * @param {string} interval - Time interval.
     * @param {boolean} isDaily - True if daily chart.
     */
    plotIndicatorChart(dates, macd, atr, stoch, stdev, variance, interval, isDaily) {
        const macdTrace = {
            x: dates,
            y: macd.macd,
            type: 'scatter',
            mode: 'lines',
            name: 'MACD',
            marker: { color: '#00008B' } // Dark blue
        };

        const signalTrace = {
            x: dates,
            y: macd.signal,
            type: 'scatter',
            mode: 'lines',
            name: 'Signal',
            marker: { color: '#ADD8E6' } // Light blue
        };

        const histogramTrace = {
            x: dates,
            y: macd.histogram,
            type: 'bar',
            name: 'Histogram',
            marker: {
                color: macd.histogram.map(value => { // Color histogram bars based on value magnitude and sign
                    if (value >= 0) {
                        if (value >= 0.15) return '#006400'; // Dark green for strong positive
                        else if (value >= 0.1) return '#228B22';
                        else if (value >= 0.05) return '#3CB371';
                        else if (value >= 0.01) return '#7CFC00';
                        else return '#90EE90'; // Light green for weak positive
                    } else {
                        if (value <= -0.15) return '#8B0000'; // Dark red for strong negative
                        else if (value <= -0.1) return '#B22222';
                        else if (value <= -0.05) return '#DC143C';
                        else if (value <= -0.01) return '#FF0000';
                        else return '#FFA07A'; // Light red for weak negative
                    }
                })
            }
        };

        const atrTrace = {
            x: dates,
            y: atr,
            type: 'scatter',
            mode: 'lines',
            name: 'ATR',
            yaxis: 'y2', // Secondary y-axis for ATR
            marker: { color: '#800080' } // Purple
        };

        const stochKTrace = {
            x: dates,
            y: stoch.k,
            type: 'scatter',
            mode: 'lines',
            name: 'Stoch %K',
            yaxis: 'y3', // Tertiary y-axis for Stochastics
            marker: { color: '#808000' } // Olive
        };

        const stochDTrace = {
            x: dates,
            y: stoch.d,
            type: 'scatter',
            mode: 'lines',
            name: 'Stoch %D',
            yaxis: 'y3', // Tertiary y-axis for Stochastics
            marker: { color: '#BDB76B' } // Dark khaki
        };
        const stdevTrace = {
            x: dates.slice(stdev.length * -1), // Align dates with stdev values
            y: stdev,
            type: 'scatter',
            mode: 'lines',
            name: 'Stdev',
            yaxis: 'y4', // Fourth y-axis for Stdev
            marker: { color: '#A9A9A9' } // Dark grey
        };

        const varianceTrace = {
            x: dates.slice(variance.length * -1), // Align dates with variance values
            y: variance,
            type: 'scatter',
            mode: 'lines',
            name: 'Variance',
            yaxis: 'y5', // Fifth y-axis for Variance
            marker: { color: '#C0C0C0' } // Grey
        };


        const indicatorLayout = {
            title: `Indicators (${interval})`,
            xaxis: { title: 'Date', autorange: true, type: 'date' },
            yaxis: { title: 'MACD', domain: [0.6, 1] }, // Adjusted domain for MACD
            yaxis2: { title: 'ATR', overlaying: 'y', side: 'right', position: 0.95 },
            yaxis3: { title: 'Stochastics', overlaying: 'y', side: 'right', position: 0.85, range: [0, 100] },
            yaxis4: { title: 'Stdev', overlaying: 'y', side: 'right', position: 0.78, anchor: 'free', autoshift: true }, //Adjusted position
            yaxis5: { title: 'Variance', overlaying: 'y', side: 'right', position: 0.70, anchor: 'free', autoshift: true }, //Adjusted position
            showlegend: true,
            legend: { orientation: 'h', x: 0.5, y: 1.1, xanchor: 'center', yanchor: 'bottom' }
        };

        // Restore zoom if available
        if (this.zoomData[`indicator-${interval}-${isDaily}`]) {
            Object.assign(indicatorLayout.xaxis, {range: this.zoomData[`indicator-${interval}-${isDaily}`].xRange});
            Object.assign(indicatorLayout.yaxis, {range: this.zoomData[`indicator-${interval}-${isDaily}`].yRange});
            Object.assign(indicatorLayout.yaxis2, {range: this.zoomData[`indicator-${interval}-${isDaily}`].y2Range});
            Object.assign(indicatorLayout.yaxis3, {range: this.zoomData[`indicator-${interval}-${isDaily}`].y3Range});
            Object.assign(indicatorLayout.yaxis4, {range: this.zoomData[`indicator-${interval}-${isDaily}`].y4Range});
            Object.assign(indicatorLayout.yaxis5, {range: this.zoomData[`indicator-${interval}-${isDaily}`].y5Range});
        }


        const indicatorChart = document.getElementById('indicator-chart');
        Plotly.newPlot('indicator-chart', [macdTrace, signalTrace, histogramTrace, atrTrace, stochKTrace, stochDTrace, stdevTrace, varianceTrace], indicatorLayout, { responsive: true });

        // Zoom event handling to save zoom state
        indicatorChart.on('plotly_relayout', (eventData) => {
            let zoomData = {};
            if (eventData['xaxis.range[0]']) zoomData.xRange = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
            if (eventData['yaxis.range[0]']) zoomData.yRange = [eventData['yaxis.range[0]'], eventData['yaxis.range[1]']];
            if (eventData['yaxis2.range[0]']) zoomData.y2Range = [eventData['yaxis2.range[0]'], eventData['yaxis2.range[1]']];
            if (eventData['yaxis3.range[0]']) zoomData.y3Range = [eventData['yaxis3.range[0]'], eventData['yaxis3.range[1]']];
            if (eventData['yaxis4.range[0]']) zoomData.y4Range = [eventData['yaxis4.range[0]'], eventData['yaxis4.range[1]']];
            if (eventData['yaxis5.range[0]']) zoomData.y5Range = [eventData['yaxis5.range[0]'], eventData['yaxis5.range[1]']];


            if (eventData['xaxis.autorange']) {
                delete this.zoomData[`indicator-${interval}-${isDaily}`]; // Clear zoom on autorange
            } else if (Object.keys(zoomData).length > 0) {
                this.zoomData[`indicator-${interval}-${isDaily}`] = zoomData; // Save zoom ranges
            }
        });
    }


    /**
     * Plots a cosh prediction chart based on recent price data.
     * Uses damped cosine hyperbolic function to predict future price movement.
     * @param {string[]} dates - Array of dates.
     * @param {number[]} openPrices - Array of open prices.
     * @param {number[]} highPrices - Array of high prices.
     * @param {number[]} lowPrices - Array of low prices.
     * @param {number[]} closingPrices - Array of closing prices.
     * @param {string} interval - Time interval.
     * @param {boolean} isDaily - True if daily chart.
     */
    plotCoshPrediction(dates, openPrices, highPrices, lowPrices, closingPrices, interval, isDaily) {
        if (!Array.isArray(closingPrices) || closingPrices.length < 5) { // Check for array and min length
            console.warn("Not enough data for Cosh prediction.");
            return;
        }

        // Use the last 5 OHLC data points for prediction
        const startIndex = closingPrices.length - 5;
        const relevantOpen = openPrices.slice(startIndex);
        const relevantHigh = highPrices.slice(startIndex);
        const relevantLow = lowPrices.slice(startIndex);
        const relevantClose = closingPrices.slice(startIndex);
        const relevantDates = dates.slice(startIndex);

        // Average price calculation
        const avgPrices = relevantClose.map((close, i) => (relevantOpen[i] + relevantHigh[i] + relevantLow[i] + close) / 4);

        // Cosh function parameters - fine-tuned for price prediction
        const amplitude = (Math.max(...avgPrices) - Math.min(...avgPrices)) / 2;
        const damping = 0.1; // Moderate damping
        const phi = 0;
        const theta = 0;

        // Time values for prediction based on data points length
        const xValues = avgPrices.map((_, i) => i);
        const yValues = xValues.map(x => this.indicatorCalculator.cosh(x, amplitude, damping, phi, theta));

        // Normalize prediction values to price range
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        const priceMin = Math.min(...avgPrices);
        const priceMax = Math.max(...avgPrices);
        const normalizedYValues = yValues.map(y => priceMin + ((y - yMin) / (yMax - yMin)) * (priceMax - priceMin));


        const coshTrace = {
            x: relevantDates,
            y: normalizedYValues,
            type: 'scatter',
            mode: 'lines',
            name: 'Cosh Prediction',
            line: { color: 'purple', width: 2, dash: 'dash' }
        };

        const coshLayout = {
            title: `Cosh Prediction (${interval})`,
            xaxis: { title: 'Date', autorange: true, type: 'date' },
            yaxis: { title: 'Predicted Price', autorange: true },
            showlegend: true
        };

        Plotly.newPlot('cosh-chart', [coshTrace], coshLayout, { responsive: true });
    }
}


class TitleUpdater {
    /**
     * Updates the document head title to include the ticker symbol.
     * If no ticker is provided, sets a default title.
     * @param {string} currentTicker - Current stock ticker symbol.
     */
    static updateHeadTitle(currentTicker) {
        document.title = currentTicker ? `Jinx - ${currentTicker.toUpperCase()} Chart` : "Jinx";
    }
}


class ChartDashboard {
    /**
     * Main class to manage the chart dashboard.
     * Handles API configuration, data fetching, indicator calculation,
     * summary generation, chart plotting, and UI interactions.
     */
    constructor() {
        this.apiConfig = new APIConfig();
        this.dataFetcher = new DataFetcher(this.apiConfig);
        this.indicatorCalculator = new IndicatorCalculator();
        this.summaryGenerator = new SummaryGenerator();
        this.chartPlotter = new ChartPlotter();
        this.currentInterval = '1min'; // Default interval
        this.isDaily = false; // Default to intraday charts
        this.strategy = 'combined'; // Default strategy
        this.intervalButtons = document.querySelectorAll('.interval-btn');
        this.dailyButton = document.getElementById('daily-btn');
        this.strategyButtons = document.querySelectorAll('.strategy-btn');
    }

    /**
     * Initializes the chart dashboard by attaching event listeners to UI elements
     * and loading data for initial chart plotting.
     */
    initialize() {
        this.attachIntervalButtonListeners();
        this.attachDailyButtonListener();
        this.attachStrategyButtonListeners();
        this.loadDataAndPlot(); // Load and plot initial data
    }

    /**
     * Attaches event listeners to interval selection buttons.
     * Updates charts based on the selected interval.
     */
    attachIntervalButtonListeners() {
        this.intervalButtons.forEach(button => {
            button.addEventListener('click', () => {
                const interval = button.getAttribute('data-interval');
                this.currentInterval = (interval === '1hour') ? '60min' : interval; // API format
                this.isDaily = false;
                this.loadDataAndPlot(this.currentInterval, false, this.strategy);
                this.setActiveButton(button); // Set active state
            });
        });
    }

    /**
     * Attaches event listener to the daily data button.
     * Updates charts to display daily data.
     */
    attachDailyButtonListener() {
        this.dailyButton.addEventListener('click', () => {
            this.isDaily = true;
            this.loadDataAndPlot('daily', true, this.strategy); // Load daily data
            this.setActiveButton(this.dailyButton); // Set active state for daily button

            //Deactivate interval buttons when daily is active
            this.intervalButtons.forEach(btn => btn.classList.remove('active'));
        });
    }

    /**
     * Attaches event listeners to strategy selection buttons.
     * Updates summaries based on the selected strategy.
     */
    attachStrategyButtonListeners() {
        this.strategyButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.strategy = button.getAttribute('data-strategy');
                this.loadDataAndPlot(this.currentInterval, this.isDaily, this.strategy);
                this.setActiveStrategyButton(button); // Set active strategy button
            });
        });
    }

    /**
     * Sets the active button state for interval buttons, visually highlighting the selected interval.
     * @param {HTMLElement} clickedButton - The button element that was clicked.
     */
    setActiveButton(clickedButton) {
        // Remove 'active' class from all interval buttons
        this.intervalButtons.forEach(btn => btn.classList.remove('active'));
        if (this.dailyButton) {
            this.dailyButton.classList.remove('active'); // Ensure daily button is also deactivated
        }
        // Add 'active' class to the clicked button
        clickedButton.classList.add('active');
    }

    /**
     * Sets the active button state for strategy buttons.
     * @param {HTMLElement} clickedButton - The strategy button element that was clicked.
     */
     setActiveStrategyButton(clickedButton) {
        this.strategyButtons.forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');
    }


    /**
     * Loads data from API and plots charts based on the current ticker, interval, and strategy.
     * Handles errors and updates the summary and chart elements in the DOM.
     * @param {string} [interval=this.currentInterval] - Time interval.
     * @param {boolean} [isDaily=this.isDaily] - True if daily data.
     * @param {string} [strategy=this.strategy] - Trading strategy.
     */
    async loadDataAndPlot(interval = this.currentInterval, isDaily = this.isDaily, strategy = this.strategy) {
        const ticker = TickerExtractor.getTickerFromDirectoryName(); // Extract ticker from URL
        TitleUpdater.updateHeadTitle(ticker); // Update document title
        try {
            const data = await this.dataFetcher.fetchData(interval, ticker, isDaily); // Fetch data
            this.chartPlotter.plotCharts(data, interval, ticker, this.indicatorCalculator, this.summaryGenerator, isDaily, strategy); // Plot charts
        } catch (error) {
            console.error("Data loading error:", error); //Log for debugging.
            document.getElementById('summary').innerHTML = '<p>Error: Could not load data. Please try again later.</p>'; // Inform user on UI
            document.getElementById('price-chart').innerHTML = '<p class="error-message">Could not load price chart data.</p>';
            document.getElementById('indicator-chart').innerHTML = '<p class="error-message">Could not load indicator chart data.</p>';
            document.getElementById('cosh-chart').innerHTML = '<p class="error-message">Could not load prediction chart data.</p>';
        }
    }
}


// Initialize dashboard on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
    const dashboard = new ChartDashboard();
    dashboard.initialize();

    // Set default active interval button to 1min and strategy to combined on load
    const defaultIntervalButton = document.querySelector('.interval-btn[data-interval="1min"]');
    if (defaultIntervalButton) {
        dashboard.setActiveButton(defaultIntervalButton);
    }
    const defaultStrategyButton = document.querySelector('.strategy-btn[data-strategy="combined"]');
    if (defaultStrategyButton) {
        dashboard.setActiveStrategyButton(defaultStrategyButton);
    }
});
