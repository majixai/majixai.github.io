// chart-manager.js
export default class ChartManager {
  #chart;
  #apiKey = "XVYHOWRTRNPN3FJA";
  #errorMessageElement; // Element to display error messages

  constructor() {
    this.#errorMessageElement = document.getElementById('error-message');
    this.init().then(() => {
      this.render('IBM'); // Render initial series for IBM
      // this.render('AAPL'); // Render another series for AAPL
      // this.render('TSLA'); // Render another series for TSLA
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

  async render(symbol = 'MSFT') {
    try {
      const newData = await this.#loadData(symbol);
      if (newData && newData.length > 0) {
        this.#clearErrorMessage(); // Clear any previous error
        const newSeries = this.#chart.addLineSeries({
          name: symbol,
          color: this.#getRandomColor(),
          lineWidth: 2
        });
        newSeries.setData(newData);
      } else {
        this.#displayErrorMessage(`No data found for symbol: ${symbol}`);
      }
    } catch (error) {
      this.#displayErrorMessage(`Error rendering chart for ${symbol}: ${error.message}`);
    }
  }

  async #loadData(symbol) {
    const url = 'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=ibm&apikey=XVYHOWRTRNPN3FJA'
    // const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${this.#apiKey}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const message = `API Error: ${response.status} ${response.statusText}`;
        this.#displayErrorMessage(`Failed to load data for ${symbol}: ${message}`);
        return null; // Indicate error to the caller
      }
      const data = await response.json();

      // Check for API error messages in the JSON response
      if (data['Error Message']) {
        this.#displayErrorMessage(`Alpha Vantage API Error for ${symbol}: ${data['Error Message']}`);
        return null;
      }
      if (data['Note']) { // API rate limit note
        this.#displayErrorMessage(`Alpha Vantage API Note for ${symbol}: ${data['Note']}. Rate limit may be in effect.`);
        return null;
      }

      const timeSeriesData = data['Time Series (Daily)'];
      if (!timeSeriesData) {
        this.#displayErrorMessage(`No Time Series data found for symbol: ${symbol} in API response.`);
        return null;
      }

      const formattedData = Object.entries(timeSeriesData).map(([time, values]) => ({
        time: time,
        value: parseFloat(values['4. close'])
      }));
      return formattedData;

    } catch (error) {
      this.#displayErrorMessage(`Network error loading data for ${symbol}: ${error.message}`);
      return null; // Indicate network error
    }
  }

  #getRandomColor() {
    const r = Math.floor(Math.random() * 255);
    const g = Math.floor(Math.random() * 255);
    const b = Math.floor(Math.random() * 255);
    return `rgba(${r}, ${g}, ${b}, 0.7)`;
  }

  #displayErrorMessage(message) {
    this.#errorMessageElement.textContent = message;
  }

  #clearErrorMessage() {
    this.#errorMessageElement.textContent = '';
  }
}
