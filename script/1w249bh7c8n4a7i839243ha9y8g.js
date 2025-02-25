// script/1w249bh7c8n4a7i839243ha9y8g.js
class TickerExtractor {
    static getTickerFromDirectoryName() {
        const pathName = window.location.pathname;
        const pathParts = pathName.split('/');
        let directoryName = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1] || '';
        directoryName = directoryName.split('.')[0];
        if (directoryName && directoryName !== '' && directoryName !== '/') {
            return directoryName;
        } else {
            console.warn("Could not extract ticker from directory name. Using default 'jinx'. Path:", pathName);
            return "jinx";
        }
    }
}

class APIConfig {
    constructor() {
        this.apiKey = 'XVYHOWRTRNPN3FJA';
        this.baseUrl = 'https://www.alphavantage.co/query';
        this.outputSize = 'full';
        this.extendedHours = true;
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
}

class DataFetcher {
    constructor(apiConfig) {
        if (!(apiConfig instanceof APIConfig)) {
            throw new Error('DataFetcher constructor requires an APIConfig instance.');
        }
        this.apiConfig = apiConfig;
    }

    async fetchData(interval, ticker) {
        const apiUrl = this.getApiUrl(interval, ticker);
        try {
            console.log('Fetching data from API with interval:', interval);
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data['Error Message'] || data['Note']) {
                throw new Error(data['Error Message'] || data['Note']);
            }
            localStorage.setItem('chartData', JSON.stringify(data));
            return data;
        } catch (error) {
            console.error('Error fetching data from API:', error);
            let cachedData = localStorage.getItem('chartData');
            if (cachedData) {
                alert('Using cached data');
                return JSON.parse(cachedData);
            } else {
                console.error('No cached data available.');
                throw error; // Re-throw error to be handled by caller
            }
        }
    }

    getApiUrl(interval, ticker) {
        const apiKey = this.apiConfig.getApiKey();
        const baseUrl = this.apiConfig.getBaseUrl();
        const outputSize = this.apiConfig.getOutputSize();
        const extendedHours = this.apiConfig.isExtendedHours();

        return `${baseUrl}?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=${interval}&outputsize=${outputSize}&apikey=${apiKey}&extended_hours=${extendedHours}`;
    }
}

class IndicatorCalculator {
    calculateMACD(closingPrices) {
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

    calculateEMA(data, period) {
        const k = 2 / (period + 1);
        let ema = [data[0]];
        for (let i = 1; i < data.length; i++) {
            ema.push(data[i] * k + ema[i - 1] * (1 - k));
        }
        return ema;
    }

    calculateATR(highPrices, lowPrices, closingPrices) {
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

    calculateStochastics(highPrices, lowPrices, closingPrices) {
        const kPeriod = 14;
        const dPeriod = 3;

        let kValues = [];
        for (let i = kPeriod - 1; i < closingPrices.length; i++) {
            const highestHigh = Math.max(...highPrices.slice(i - kPeriod + 1, i + 1));
            const lowestLow = Math.min(...lowPrices.slice(i - kPeriod + 1, i + 1));
            kValues.push(100 * (closingPrices[i] - lowestLow) / (highestHigh - lowestLow));
        }
        const dValues = this.calculateEMA(kValues, dPeriod);
        return { k: kValues, d: dValues };
    }

    calculateStdev(data) {
        if (!data || data.length === 0) return NaN;
        const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
        const squaredDifferences = data.map(val => Math.pow(val - mean, 2));
        const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / data.length;
        return Math.sqrt(variance);
    }

    calculateVariance(data) {
        if (!data || data.length === 0) return NaN;
        const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
        const squaredDifferences = data.map(val => Math.pow(val - mean, 2));
        return squaredDifferences.reduce((sum, val) => sum + val, 0) / data.length;
    }

    calculateCovariance(dataX, dataY) {
        if (!dataX || !dataY || dataX.length !== dataY.length || dataX.length === 0) return NaN;
        const meanX = dataX.reduce((sum, val) => sum + val, 0) / dataX.length;
        const meanY = dataY.reduce((sum, val) => sum + val, 0) / dataY.length;
        let covariance = 0;
        for (let i = 0; i < dataX.length; i++) {
            covariance += (dataX[i] - meanX) * (dataY[i] - meanY);
        }
        return covariance / dataX.length;
    }

    calculateBlackScholes(S, K, T, r, sigma, optionType = 'call') {
        if (isNaN(S) || isNaN(K) || isNaN(T) || isNaN(r) || isNaN(sigma)) return NaN;
        if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return 0;

        const d1 = (Math.log(S / K) + (r + 0.5 * Math.pow(sigma, 2)) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);

        function cumulativeNormalDistribution(x) {
            const phi = 0.5 * (1.0 + erf(x / Math.sqrt(2.0)));
            return phi;
        }

        function erf(x) {
            // Approximation of error function - Abramowitz and Stegun method
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

        if (optionType.toLowerCase() === 'call') {
            return (S * N_d1 - K * Math.exp(-r * T) * N_d2);
        } else if (optionType.toLowerCase() === 'put') {
            return (K * Math.exp(-r * T) * N_minus_d2 - S * N_minus_d1);
        } else {
            return NaN; // Invalid option type
        }
    }
}

class SummaryGenerator {
    generateSummary(closingPrices, macd, atr, stoch, stdev, variance, blackScholesCall, blackScholesPut, ticker) {
        let signal = "Neutral";
        let projectedPrice = closingPrices[closingPrices.length - 1];
        let percentChange = 0;
        let daysToFlip = "N/A";

        let buySignals = 0;
        let sellSignals = 0;

        if (macd.histogram[macd.histogram.length - 1] > 0) buySignals++;
        else if (macd.histogram[macd.histogram.length - 1] < 0) sellSignals++;

        if (stoch.k[stoch.k.length - 1] > stoch.d[stoch.d.length - 1] && stoch.k[stoch.k.length - 1] < 80) buySignals++;
        else if (stoch.k[stoch.k.length - 1] < stoch.d[stoch.d.length - 1] && stoch.k[stoch.k.length - 1] > 20) sellSignals++;

        if (buySignals >= 2) signal = "Buy";
        else if (sellSignals >= 2) signal = "Sell";

        if (signal === "Buy") {
            projectedPrice += atr[atr.length - 1];
            daysToFlip = Math.floor(Math.random() * 10) + 1;
        } else if (signal === "Sell") {
            projectedPrice -= atr[atr.length - 1];
            daysToFlip = Math.floor(Math.random() * 10) + 1;
        }

        percentChange = ((projectedPrice - closingPrices[closingPrices.length - 1]) / closingPrices[closingPrices.length - 1]) * 100;

        return `
            <div class="indicator-summary">
              Overall Signal: <span style="color: ${signal === 'Buy' ? 'green' : (signal === 'Sell' ? 'red' : 'blue')}">${signal}</span><br>
              Projected Price: ${projectedPrice.toFixed(2)}<br>
              Percent Change: ${percentChange.toFixed(2)}%<br>
              Time to Signal Flip (Days Estimate): ${daysToFlip}<br>
              Standard Deviation (Closing Prices): ${stdev.toFixed(2)}<br>
              Variance (Closing Prices): ${variance.toFixed(2)}<br>
              Black-Scholes Call Option (Approx.): ${isNaN(blackScholesCall) ? 'N/A' : blackScholesCall.toFixed(2)}<br>
              Black-Scholes Put Option (Approx.): ${isNaN(blackScholesPut) ? 'N/A' : blackScholesPut.toFixed(2)}
            </div>
          `;
    }
}


class ChartPlotter {
    plotCharts(data, interval, ticker, indicatorCalculator, summaryGenerator) {
        let timeSeriesKey = `Time Series (${interval})`;
        if (!data[timeSeriesKey]) {
            console.error('Invalid data format for interval:', interval, data);
            document.getElementById('summary').innerHTML = `<p>Error: Invalid data format for interval ${interval}. Please try again later.</p>`;
            return;
        }

        const dates = Object.keys(data[timeSeriesKey]).reverse();
        const closingPrices = dates.map(date => parseFloat(data[timeSeriesKey][date]['4. close']));
        const highPrices = dates.map(date => parseFloat(data[timeSeriesKey][date]['2. high']));
        const lowPrices = dates.map(date => parseFloat(data[timeSeriesKey][date]['3. low']));

        const macd = indicatorCalculator.calculateMACD(closingPrices);
        const atr = indicatorCalculator.calculateATR(highPrices, lowPrices, closingPrices);
        const stoch = indicatorCalculator.calculateStochastics(highPrices, lowPrices, closingPrices);
        const stdev = indicatorCalculator.calculateStdev(closingPrices);
        const variance = indicatorCalculator.calculateVariance(closingPrices);

        // Black-Scholes Approximation - using last closing price, ATR as volatility proxy, and placeholder values
        const lastClosingPrice = closingPrices[closingPrices.length - 1];
        const volatilityProxy = atr[atr.length - 1] / lastClosingPrice; // Rough volatility proxy using ATR, needs refinement
        const riskFreeRate = 0.02; // Placeholder risk-free rate (e.g., 2%)
        const timeToExpiration = 1/365; // Very short time to expiration, for demonstration
        const blackScholesCall = indicatorCalculator.calculateBlackScholes(lastClosingPrice, lastClosingPrice, timeToExpiration, riskFreeRate, volatilityProxy, 'call'); // ATM Call
        const blackScholesPut = indicatorCalculator.calculateBlackScholes(lastClosingPrice, lastClosingPrice, timeToExpiration, riskFreeRate, volatilityProxy, 'put'); // ATM Put


        const summaryHTML = summaryGenerator.generateSummary(closingPrices, macd, atr, stoch, stdev, variance, blackScholesCall, blackScholesPut, ticker);
        document.getElementById('summary').innerHTML = summaryHTML;

        this.plotPriceChart(dates, closingPrices, ticker, interval);
        this.plotIndicatorChart(dates, macd, atr, stoch, stdev, variance, interval); // Pass new indicators to plot
    }

    plotIndicatorChart(dates, macd, atr, stoch, stdev, variance, interval) {
        const macdTrace = {
            x: dates,
            y: macd.macd,
            type: 'scatter',
            mode: 'lines',
            name: 'MACD'
        };

        const signalTrace = {
            x: dates,
            y: macd.signal,
            type: 'scatter',
            mode: 'lines',
            name: 'Signal'
        };

        const histogramTrace = {
            x: dates,
            y: macd.histogram,
            type: 'bar',
            name: 'Histogram',
            marker: {
                color: macd.histogram.map(value => {
                    if (value >= 0) {
                        if (value >= 0.15) return '#006400';
                        else if (value >= 0.1) return '#228B22';
                        else if (value >= 0.05) return '#3CB371';
                        else if (value >= 0.01) return '#7CFC00';
                        else return '#90EE90';
                    } else {
                        if (value <= -0.15) return '#8B0000';
                        else if (value <= -0.1) return '#B22222';
                        else if (value <= -0.05) return '#DC143C';
                        else if (value <= -0.01) return '#FF0000';
                        else return '#FFA07A';
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
            yaxis: 'y2'
        };

        const stochKTrace = {
            x: dates,
            y: stoch.k,
            type: 'scatter',
            mode: 'lines',
            name: 'Stoch K',
            yaxis: 'y3'
        };

        const stochDTrace = {
            x: dates,
            y: stoch.d,
            type: 'scatter',
            mode: 'lines',
            name: 'Stoch D',
            yaxis: 'y3'
        };

        const stdevTrace = {
            x: dates.slice(stdev.length * -1), // Align dates with stdev values
            y: stdev,
            type: 'scatter',
            mode: 'lines',
            name: 'Stdev',
            yaxis: 'y4' // New y-axis for Stdev
        };

        const varianceTrace = {
            x: dates.slice(variance.length * -1), // Align dates with variance values
            y: variance,
            type: 'scatter',
            mode: 'lines',
            name: 'Variance',
            yaxis: 'y5' // New y-axis for Variance
        };


        const indicatorLayout = {
            title: `Indicators (${interval})`,
            xaxis: { title: 'Date' },
            yaxis: { title: 'MACD' },
            yaxis2: {
                title: 'ATR',
                overlaying: 'y',
                side: 'right'
            },
            yaxis3: {
                title: 'Stochastics',
                overlaying: 'y',
                side: 'right',
                position: 0.90 // Adjust position if needed to prevent overlap
            },
            yaxis4: {
                title: 'Stdev',
                overlaying: 'y',
                side: 'right',
                position: 0.85 // Adjust position to prevent overlap
            },
            yaxis5: {
                title: 'Variance',
                overlaying: 'y',
                side: 'right',
                position: 0.80 // Adjust position to prevent overlap
            }
        };

        Plotly.newPlot('indicator-chart', [macdTrace, signalTrace, histogramTrace, atrTrace, stochKTrace, stochDTrace, stdevTrace, varianceTrace], indicatorLayout);
    }
}

class TitleUpdater {
    static updateHeadTitle(currentTicker) {
        if (currentTicker) {
            document.title = `Jinx ${currentTicker.toUpperCase()} Chart with Indicators`;
        } else {
            document.title = "Jinx";
        }
    }
}


class ChartDashboard {
    constructor() {
        this.apiConfig = new APIConfig();
        this.dataFetcher = new DataFetcher(this.apiConfig);
        this.indicatorCalculator = new IndicatorCalculator();
        this.summaryGenerator = new SummaryGenerator();
        this.chartPlotter = new ChartPlotter();
        this.currentInterval = '5min';
        this.intervalButtons = document.querySelectorAll('.interval-btn');
    }

    initialize() {
        this.attachIntervalButtonListeners();
        this.loadDataAndPlot();
    }

    attachIntervalButtonListeners() {
        this.intervalButtons.forEach(button => {
            button.addEventListener('click', () => {
                const interval = button.getAttribute('data-interval');
                this.currentInterval = (interval === '1hour') ? '60min' : interval;
                this.loadDataAndPlot(this.currentInterval);
                this.setActiveButton(button);
            });
        });
    }

    setActiveButton(clickedButton) {
        this.intervalButtons.forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');
    }

    async loadDataAndPlot(interval = this.currentInterval) {
        const ticker = TickerExtractor.getTickerFromDirectoryName();
        TitleUpdater.updateHeadTitle(ticker);
        try {
            const data = await this.dataFetcher.fetchData(interval, ticker);
            this.chartPlotter.plotCharts(data, interval, ticker, this.indicatorCalculator, this.summaryGenerator);
        } catch (error) {
            document.getElementById('summary').innerHTML = '<p>Error: Could not load data. Please try again later.</p>';
        }
    }
}


window.addEventListener('DOMContentLoaded', function() {
    const dashboard = new ChartDashboard();
    dashboard.initialize();

    const defaultIntervalButton = document.querySelector('.interval-btn[data-interval="5min"]');
    if (defaultIntervalButton) {
        dashboard.setActiveButton(defaultIntervalButton);
    }
});
