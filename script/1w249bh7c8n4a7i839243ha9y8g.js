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
