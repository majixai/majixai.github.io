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
        this.outputSize = 'full'; // Keep full output size
        this.extendedHours = true; // Consider removing this, as we might want both
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

    async fetchData(interval, ticker, isDaily = false) {
        const apiUrl = this.getApiUrl(interval, ticker, isDaily);
        try {
            console.log(`Fetching data from API with interval: ${interval}, Daily: ${isDaily}`);
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data['Error Message'] || data['Note']) {
                throw new Error(data['Error Message'] || data['Note']);
            }
            // Better key structure for cached data.
            localStorage.setItem(`chartData-${ticker}-${interval}-${isDaily}`, JSON.stringify(data));
            return data;
        } catch (error) {
            console.error('Error fetching data from API:', error);
            // Retrieve cached data using a similar key structure
            let cachedData = localStorage.getItem(`chartData-${ticker}-${interval}-${isDaily}`);
            if (cachedData) {
                alert('Using cached data');
                return JSON.parse(cachedData);
            } else {
                console.error('No cached data available.');
                throw error; // Re-throw error to be handled by caller
            }
        }
    }

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
    // Updated Black-Scholes to return prices
    calculateBlackScholes(S, K, T, r, sigma, optionType = 'call') {
        if (isNaN(S) || isNaN(K) || isNaN(T) || isNaN(r) || isNaN(sigma)) return { price: NaN, probability: NaN };
        if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return { price: 0, probability: 0 };

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
        let price, probability;

        if (optionType.toLowerCase() === 'call') {
            price = (S * N_d1 - K * Math.exp(-r * T) * N_d2);
            probability = N_d1; //Probability
        } else if (optionType.toLowerCase() === 'put') {
            price = (K * Math.exp(-r * T) * N_minus_d2 - S * N_minus_d1);
            probability = N_minus_d1;//Probability

        } else {
            return { price: NaN, probability: NaN }; // Invalid option type
        }
        return {price, probability}
    }
    //Damped, Cosh Function.
    cosh(x, amplitude = 1, damping = 0, phi = 0, theta = 0) {
      const damp = Math.exp(-damping * x);
      return amplitude * damp * (0.5 * (Math.exp(x + phi) + Math.exp(-x + theta)));
    }
}

class SummaryGenerator {
   generateSummary(closingPrices, macd, atr, stoch, stdev, variance, blackScholesCall, blackScholesPut, ticker, strategy) {
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
        //Strategy check.
        if (strategy === 'bull') {
            if (buySignals >= 1) signal = "Buy"; //Bull
            else signal = "Neutral";
        } else if (strategy === 'bear') {
            if (sellSignals >= 1) signal = "Sell"; //Bear
            else signal = "Neutral"
        }
        else { //Combined
            if (buySignals >= 2) signal = "Buy";
            else if (sellSignals >= 2) signal = "Sell";
        }


        if (signal === "Buy") {
            projectedPrice += atr[atr.length - 1];
            daysToFlip = Math.floor(Math.random() * 10) + 1;
        } else if (signal === "Sell") {
            projectedPrice -= atr[atr.length - 1];
            daysToFlip = Math.floor(Math.random() * 10) + 1;
        }

        percentChange = ((projectedPrice - closingPrices[closingPrices.length - 1]) / closingPrices[closingPrices.length - 1]) * 100;

        // Display BSM Call/Put prices (not costs) and probabilities
        return `
            <div class="indicator-summary">
              Overall Signal: <span style="color: ${signal === 'Buy' ? 'green' : (signal === 'Sell' ? 'red' : 'blue')}">${signal}</span><br>
              Projected Price: ${projectedPrice.toFixed(2)}<br>
              Percent Change: ${percentChange.toFixed(2)}%<br>
              Time to Signal Flip (Days Estimate): ${daysToFlip}<br>
              Standard Deviation (Closing Prices): ${stdev.toFixed(2)}<br>
              Variance (Closing Prices): ${variance.toFixed(2)}<br>
              Black-Scholes Call Option Price: ${isNaN(blackScholesCall.price) ? 'N/A' : blackScholesCall.price.toFixed(2)}<br>
              Probability (Call): ${isNaN(blackScholesCall.probability) ? 'N/A' : (blackScholesCall.probability * 100).toFixed(2)}%<br>
              Black-Scholes Put Option Price: ${isNaN(blackScholesPut.price) ? 'N/A' : blackScholesPut.price.toFixed(2)}<br>
               Probability (Put): ${isNaN(blackScholesPut.probability) ? 'N/A' : (blackScholesPut.probability * 100).toFixed(2)}%
            </div>
          `; //Return Price + Probability
    }
}


class ChartPlotter {
    constructor() {
        this.zoomData = {}; //Object to store zoom
    }
    plotCharts(data, interval, ticker, indicatorCalculator, summaryGenerator, isDaily, strategy) {
        let timeSeriesKey = isDaily ? 'Time Series (Daily)' : `Time Series (${interval})`;
        if (!data[timeSeriesKey]) {
            console.error('Invalid data format for interval:', interval, data);
            document.getElementById('summary').innerHTML = `<p>Error: Invalid data format for interval ${interval}. Please try again later.</p>`;
            return;
        }
        // Use adjusted close for daily, regular close for intraday
        const dates = Object.keys(data[timeSeriesKey]).reverse();
        const closingPrices = dates.map(date => parseFloat(data[timeSeriesKey][date][isDaily ? '5. adjusted close' : '4. close']));
        const highPrices = dates.map(date => parseFloat(data[timeSeriesKey][date]['2. high']));
        const lowPrices = dates.map(date => parseFloat(data[timeSeriesKey][date]['3. low']));
        const openPrices = dates.map(date => parseFloat(data[timeSeriesKey][date]['1. open']));


        const macd = indicatorCalculator.calculateMACD(closingPrices);
        const atr = indicatorCalculator.calculateATR(highPrices, lowPrices, closingPrices);
        const stoch = indicatorCalculator.calculateStochastics(highPrices, lowPrices, closingPrices);
        const stdev = indicatorCalculator.calculateStdev(closingPrices);
        const variance = indicatorCalculator.calculateVariance(closingPrices);

        // Black-Scholes Approximation - using last closing price, ATR as volatility proxy,
        // and using 1/365 for T, for all intervals.
        const lastClosingPrice = closingPrices[closingPrices.length - 1];
        const volatilityProxy = atr[atr.length - 1] / lastClosingPrice; // Rough volatility proxy using ATR, needs refinement
        const riskFreeRate = 0.02; // Placeholder risk-free rate (e.g., 2%)

        //If daily, use year, else use day.
        const timeToExpiration = 1/365; // Use 1 day for BSM, regardless of interval

        const blackScholesCall = indicatorCalculator.calculateBlackScholes(lastClosingPrice, lastClosingPrice, timeToExpiration, riskFreeRate, volatilityProxy, 'call');
        const blackScholesPut = indicatorCalculator.calculateBlackScholes(lastClosingPrice, lastClosingPrice, timeToExpiration, riskFreeRate, volatilityProxy, 'put');


        const summaryHTML = summaryGenerator.generateSummary(closingPrices, macd, atr, stoch, stdev, variance, blackScholesCall, blackScholesPut, ticker, strategy);
        document.getElementById('summary').innerHTML = summaryHTML;

        this.plotPriceChart(
dates, openPrices, highPrices, lowPrices, closingPrices, ticker, interval, macd, isDaily); // Pass open, high, low, macd
        this.plotIndicatorChart(dates, macd, atr, stoch, stdev, variance, interval, isDaily);
        this.plotCoshPrediction(dates, openPrices, highPrices, lowPrices, closingPrices, interval, isDaily); // Add cosh prediction chart
    }


    plotPriceChart(dates, openPrices, highPrices, lowPrices, closingPrices, ticker, interval, macd, isDaily) {
        const bullColor = '#007030'; // Dark green
        const bearColor = '#8C1515'; // Dark red

        const priceTrace = {
            x: dates,
            open: openPrices,
            high: highPrices,
            low: lowPrices,
            close: closingPrices,
            decreasing: { line: { color: bearColor } }, // Bearish candles - Dark Red
            increasing: { line: { color: bullColor } }, // Bullish candles - Dark Green
            type: 'candlestick',
            xaxis: 'x',
            yaxis: 'y',
            name: 'Candlestick' //Name
        };

        let rangeSelectorButtons = [{
                step: 'day',
                stepmode: 'backward',
                count: 1,
                label: '1 day'
            }, {
                step: 'month',
                stepmode: 'backward',
                count: 1,
                label: '1 month'
            }, {
                step: 'month',
                stepmode: 'backward',
                count: 6,
                label: '6 months'
            }, {
                step: 'year',
                stepmode: 'backward',
                count: 1,
                label: '1 year'
            }, {
                step: 'all',
                label: 'All'
            }];

        if (isDaily) {
            rangeSelectorButtons = [{
                    step: 'month',
                    stepmode: 'backward',
                    count: 1,
                    label: '1 month'
                },
                {
                    step: 'month',
                    stepmode: 'backward',
                    count: 6,
                    label: '6mo'
                },
                {
                    step: 'year',
                    stepmode: 'backward',
                    count: 1,
                    label: '1y'
                },
                {
                    step: 'year',
                    stepmode: 'backward',
                    count: 5,
                    label: '5y'
                },
                {
                    step: 'all',
                    label: 'All'
                }
            ];
        }

        const priceLayout = {
            title: `${ticker.toUpperCase()} ${isDaily ? 'Daily' : 'Intraday'} Candlestick Chart (${interval})`,
            dragmode: 'zoom',
            margin: {
                r: 10,
                t: 25,
                b: 40,
                l: 60
            },
            showlegend: true, // Show legend
            xaxis: {
                autorange: true,
                rangeslider: {
                    visible: false // Initially hide the built-in rangeslider
                },
                title: 'Date',
                type: 'date',
                rangeselector: {
                    x: 0,
                    y: 1.2,
                    xanchor: 'left',
                    font: { size: 8 },
                    buttons: rangeSelectorButtons
                }
            },
            yaxis: {
                autorange: true,
                type: 'linear',
                title: 'Price' // Add y-axis title
            },
            annotations: this.getAnnotations(dates, macd.histogram) // Add annotations
        };

        // Restore zoom level if it exists for this chart
        if (this.zoomData[`price-${interval}-${isDaily}`]) {
            priceLayout.xaxis.range = this.zoomData[`price-${interval}-${isDaily}`].xRange;
            priceLayout.yaxis.range = this.zoomData[`price-${interval}-${isDaily}`].yRange;
        }


        const priceChart = document.getElementById('price-chart'); //Get element.
        Plotly.newPlot('price-chart', [priceTrace], priceLayout, { responsive: true });

        // Custom zoom event handler to store zoom levels
        priceChart.on('plotly_relayout', (eventData) => {
          // Check for zoom event and save the ranges
          if (eventData['xaxis.range[0]'] && eventData['yaxis.range[0]']) {
            this.zoomData[`price-${interval}-${isDaily}`] = {
              xRange: [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']],
              yRange: [eventData['yaxis.range[0]'], eventData['yaxis.range[1]']]
            };
          } else if (eventData['xaxis.autorange'] && eventData['yaxis.autorange']) { // Handle reset
            delete this.zoomData[`price-${interval}-${isDaily}`];
          }
        });
    }

    getAnnotations(dates, macdHistogram) {
        const annotations = [];
        const threshold = 0; // You can adjust this threshold
        const potentialBearColor = '#FEE11A'; // Yellow-ish
        const potentialBullColor = '#00539B'; // Dark blue


        // Find indices where histogram crosses the threshold to indicate potential bull/bear shifts
        for (let i = 1; i < macdHistogram.length; i++) {
            if ((macdHistogram[i - 1] <= threshold && macdHistogram[i] > threshold) || (macdHistogram[i - 1] >= threshold && macdHistogram[i] < threshold)) {
                const annotationText = macdHistogram[i] > threshold ? 'Potential Bull Turn' : 'Potential Bear Turn';
                const annotationColor = macdHistogram[i] > threshold ? potentialBullColor : potentialBearColor; // Use potential turn colors
                annotations.push({
                    x: dates[i], // Date of the signal
                    y: 0,      // Y position in data coordinates (adjust as needed)
                    xref: 'x',
                    yref: 'y domain', // Position relative to y-axis domain (0 is bottom, 1 is top)
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
        return annotations;
    }


    plotIndicatorChart(dates, macd, atr, stoch, stdev, variance, interval, isDaily) {
        const macdTrace = {
            x: dates,
            y: macd.macd,
            type: 'scatter',
            mode: 'lines',
            name: 'MACD',
            marker: { color: '#00008B' }
        };

        const signalTrace = {
            x: dates,
            y: macd.signal,
            type: 'scatter',
            mode: 'lines',
            name: 'Signal',
            marker: { color: '#ADD8E6' }
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
            yaxis: 'y2',
            marker: { color: '#800080' }
        };

        const stochKTrace = {
            x: dates,
            y: stoch.k,
            type: 'scatter',
            mode: 'lines',
            name: 'Stoch K',
            yaxis: 'y3',
            marker: { color: '#808000' }
        };

        const stochDTrace = {
            x: dates,
            y: stoch.d,
            type: 'scatter',
            mode: 'lines',
            name: 'Stoch D',
            yaxis: 'y3',
            marker: { color: '#BDB76B' }
        };

        const stdevTrace = {
            x: dates.slice(stdev.length * -1), // Align dates with stdev values
            y: stdev,
            type: 'scatter',
            mode: 'lines',
            name: 'Stdev',
            yaxis: 'y4', // New y-axis for Stdev
            marker: { color: '#A9A9A9' }
        };

        const varianceTrace = {
            x: dates.slice(variance.length * -1), // Align dates with variance values
            y: variance,
            type: 'scatter',
            mode: 'lines',
            name: 'Variance',
            yaxis: 'y5', // New y-axis for Variance
            marker: { color: '#C0C0C0' }
        };


        const indicatorLayout = {
            title: `Indicators (${interval})`,
            xaxis: { title: 'Date',
                autorange: true,
                type: 'date'
             },
            yaxis: { title: 'MACD', domain: [0.7, 1] }, // More space
            yaxis2: {
                title: 'ATR',
                overlaying: 'y',
                side: 'right',
                position: 0.95
            },
            yaxis3: {
                title: 'Stochastics',
                overlaying: 'y',
                side: 'right',
                position: 0.85,
                range: [0, 100] //Stoch Range

            },
            yaxis4: {
                title: 'Stdev',
                overlaying: 'y',
                side: 'right',
                position: 0.80,
                anchor: 'free', // Decouple from main y-axis.
                autoshift: true,
            },
            yaxis5: {
                title: 'Variance',
                overlaying: 'y',
                side: 'right',
                position: 0.75,
                anchor: 'free', // Decouple from main y-axis.
                autoshift: true,
            },
            showlegend: true,
            legend: {
                orientation: 'h', // Horizontal legend
                x: 0.5,          // Center
                y: 1.1,         // Position above
                xanchor: 'center',
                yanchor: 'bottom'
            }
        };
        // Restore, if available
        if (this.zoomData[`indicator-${interval}-${isDaily}`]) {
          indicatorLayout.xaxis.range = this.zoomData[`indicator-${interval}-${isDaily}`].xRange;
          indicatorLayout.yaxis.range = this.zoomData[`indicator-${interval}-${isDaily}`].yRange; // Main MACD
          indicatorLayout.yaxis2.range = this.zoomData[`indicator-${interval}-${isDaily}`].y2Range; // ATR
          indicatorLayout.yaxis3.range = this.zoomData[`indicator-${interval}-${isDaily}`].y3Range; // Stoch
          indicatorLayout.yaxis4.range = this.zoomData[`indicator-${interval}-${isDaily}`].y4Range; // stdev
          indicatorLayout.yaxis5.range = this.zoomData[`indicator-${interval}-${isDaily}`].y5Range; // variance
        }


        const indicatorChart = document.getElementById('indicator-chart');
        Plotly.newPlot('indicator-chart', [macdTrace, signalTrace, histogramTrace, atrTrace, stochKTrace, stochDTrace, stdevTrace, varianceTrace], indicatorLayout, { responsive: true });

        // Custom zoom
        indicatorChart.on('plotly_relayout', (eventData) => {
            let zoomData = {};

            if (eventData['xaxis.range[0]']) {
                zoomData.xRange = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
            }
            if (eventData['yaxis.range[0]']) {
                zoomData.yRange = [eventData['yaxis.range[0]'], eventData['yaxis.range[1]']];
            }
            if (eventData['yaxis2.range[0]']) {
                zoomData.y2Range = [eventData['yaxis2.range[0]'], eventData['yaxis2.range[1]']];
            }
            if (eventData['yaxis3.range[0]']) {
                zoomData.y3Range = [eventData['yaxis3.range[0]'], eventData['yaxis3.range[1]']];
            }
            if (eventData['yaxis4.range[0]']) {
              zoomData.y4Range = [eventData['yaxis4.range[0]'], eventData['yaxis4.range[1]']];
            }
            if (eventData['yaxis5.range[0]']) {
              zoomData.y5Range = [eventData['yaxis5.range[0]'], eventData['yaxis5.range[1]']];
            }

            // Check if it's an autoscale event
            if (eventData['xaxis.autorange']) { //x-axis
                delete this.zoomData[`indicator-${interval}-${isDaily}`];
            } else if (Object.keys(zoomData).length > 0) { //Save
                this.zoomData[`indicator-${interval}-${isDaily}`] = zoomData;
            }
        });
    }

    plotCoshPrediction(dates, openPrices, highPrices, lowPrices, closingPrices, interval, isDaily) {
        if (closingPrices.length < 5) { // Need at least 5 data points
            console.warn("Not enough data for Cosh prediction.");
            return;
        }

        // Use the last 5 OHLC data points.
        const startIndex = closingPrices.length - 5;
        const relevantOpen = openPrices.slice(startIndex);
        const relevantHigh = highPrices.slice(startIndex);
        const relevantLow = lowPrices.slice(startIndex);
        const relevantClose = closingPrices.slice(startIndex);
        const relevantDates = dates.slice(startIndex);

        // Calculate average price for each of the 5 periods
        const avgPrices = relevantClose.map((close, i) => (relevantOpen[i] + relevantHigh[i] + relevantLow[i] + close) / 4);

        //Parameters.
        const amplitude = (Math.max(...avgPrices) - Math.min(...avgPrices)) / 2; // Amplitude
        const damping = 0.1; //Damping
        const phi = 0; //Phase
        const theta = 0;// Phase

        // Generate x values (time).  Use a simple index.
        const xValues = avgPrices.map((_, i) => i);

        // Calculate y values (cosh prediction)
        const yValues = xValues.map(x => this.indicatorCalculator.cosh(x, amplitude, damping, phi, theta));

        // Normalize yValues to fit within a reasonable range relative to the actual prices
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        const priceMin = Math.min(...avgPrices);
        const priceMax = Math.max(...avgPrices);
        const normalizedYValues = yValues.map(y => {
          return priceMin + ((y - yMin) / (yMax - yMin)) * (priceMax - priceMin);
        });

        // Create the trace for the prediction
        const coshTrace = {
            x: relevantDates,
            y: normalizedYValues,
            type: 'scatter',
            mode: 'lines',
            name: 'Cosh Prediction',
            line: {
                color: 'purple',
                width: 2,
                dash: 'dash'  // Dashed line
            }
        };

      const coshLayout = {
        title: `Cosh Prediction (${interval})`,
        xaxis: {
          title: 'Date',
          autorange: true,
          type: 'date'
        },
        yaxis: {
          title: 'Predicted Price',
          autorange: true
        },
        showlegend: true
      };

      //Plot.
      Plotly.newPlot('cosh-chart', [coshTrace], coshLayout, {
responsive: true });

        // No need for zoom handling on this chart, at least not initially.  It's a very short-term prediction.

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
        this.currentInterval = '1min'; // Default
        this.isDaily = false; // Default to intraday
        this.strategy = 'combined'; // 'bull', 'bear', or 'combined'
        this.intervalButtons = document.querySelectorAll('.interval-btn');
        this.dailyButton = document.getElementById('daily-btn'); // Daily
        this.strategyButtons = document.querySelectorAll('.strategy-btn'); // Strategy buttons
    }

    initialize() {
        this.attachIntervalButtonListeners();
        this.attachDailyButtonListener(); // Daily
        this.attachStrategyButtonListeners();
        this.loadDataAndPlot();
    }

    attachIntervalButtonListeners() {
        this.intervalButtons.forEach(button => {
            button.addEventListener('click', () => {
                const interval = button.getAttribute('data-interval');
                this.currentInterval = (interval === '1hour') ? '60min' : interval;
                this.isDaily = false; // Intraday.
                this.loadDataAndPlot(this.currentInterval, false, this.strategy);
                this.setActiveButton(button);
            });
        });
    }

    // Daily button
    attachDailyButtonListener() {
        this.dailyButton.addEventListener('click', () => {
            this.isDaily = true;
            this.loadDataAndPlot('daily', true, this.strategy); // Load daily
            this.setActiveButton(this.dailyButton);

            //Deactivate buttons.
            this.intervalButtons.forEach(btn => btn.classList.remove('active'));
        });
    }

    attachStrategyButtonListeners() {
        this.strategyButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.strategy = button.getAttribute('data-strategy');
                this.loadDataAndPlot(this.currentInterval, this.isDaily, this.strategy);
                this.setActiveStrategyButton(button);
            });
        });
    }

    setActiveButton(clickedButton) {
        // Remove from all buttons
        this.intervalButtons.forEach(btn => btn.classList.remove('active'));
        if (this.dailyButton) {
            this.dailyButton.classList.remove('active');
        }

        // Add class to the clicked
        clickedButton.classList.add('active');
    }
     setActiveStrategyButton(clickedButton) {
        this.strategyButtons.forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');
    }

    async loadDataAndPlot(interval = this.currentInterval, isDaily = this.isDaily, strategy = this.strategy) {
        const ticker = TickerExtractor.getTickerFromDirectoryName();
        TitleUpdater.updateHeadTitle(ticker);
        try {
            const data = await this.dataFetcher.fetchData(interval, ticker, isDaily);
            this.chartPlotter.plotCharts(data, interval, ticker, this.indicatorCalculator, this.summaryGenerator, isDaily, strategy);
        } catch (error) {
            document.getElementById('summary').innerHTML = '<p>Error: Could not load data. Please try again later.</p>';
        }
    }
}


window.addEventListener('DOMContentLoaded', () => {
    const dashboard = new ChartDashboard();
    dashboard.initialize();

    // Activate the default, 1min
    const defaultIntervalButton = document.querySelector('.interval-btn[data-interval="1min"]');
    if (defaultIntervalButton) {
        dashboard.setActiveButton(defaultIntervalButton);
    }

     // Activate the default strategy, 'combined'.
    const defaultStrategyButton = document.querySelector('.strategy-btn[data-strategy="combined"]');
    if (defaultStrategyButton) {
        dashboard.setActiveStrategyButton(defaultStrategyButton);
    }
});
