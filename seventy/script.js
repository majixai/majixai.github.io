(function() {
  'use strict';

  class ChartManager {
    #chart;
    #apiKey = "XVYHOWRTRNPN3FJA";

    constructor() {
      this.init().then(() => {
        this.render('IBM'); // Render initial series for IBM
        this.render('AAPL'); // Render another series for AAPL
        this.render('TSLA'); // Render another series for TSLA
      });
    }

    async init() {
      this.#chart = LightweightCharts.createChart(document.getElementById('chart'), {
        // Chart configuration options
        width: 800,
        height: 400,
        layout: {
          backgroundColor: '#fff',
          textColor: '#333'
        },
        grid: {
          vertLines: {
            color: 'rgba(197, 203, 206, 0.5)'
          },
          horzLines: {
            color: 'rgba(197, 203, 206, 0.5)'
          }
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal
        },
        priceScale: {
          borderColor: 'rgba(197, 203, 206, 0.8)'
        },
        timeScale: {
          borderColor: 'rgba(197, 203, 206, 0.8)'
        }
      });
    }

    async render(symbol = 'MSFT') { // Default to MSFT if no symbol is provided
      const newData = await this.#loadData(symbol);
      const newSeries = this.#chart.addLineSeries({ // Create a *new* series each time
        name: symbol, // Optional: Give the series a name (for legend/tooltips)
        color: this.#getRandomColor(), // Use a random color for each series
        lineWidth: 2
      });
      newSeries.setData(newData);
    }

    async #loadData(symbol) {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&apikey=${this.#apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      // Process the data from Alpha Vantage API
      const timeSeriesData = data['Time Series (Daily)'];
      if (!timeSeriesData) { // Basic error handling if API data is not as expected
          console.error("Error loading data for symbol:", symbol, data);
          return []; // Return empty data or handle error as needed
      }
      const formattedData = Object.entries(timeSeriesData).map(([time, values]) => ({
        time: time,
        value: parseFloat(values['4. close']) // Use closing price
      }));

      return formattedData;
    }

    #getRandomColor() {
      const r = Math.floor(Math.random() * 255);
      const g = Math.floor(Math.random() * 255);
      const b = Math.floor(Math.random() * 255);
      return `rgba(${r}, ${g}, ${b}, 0.7)`; // Slightly transparent random color
    }
  }

  new ChartManager(); // Create an instance of ChartManager

})();
