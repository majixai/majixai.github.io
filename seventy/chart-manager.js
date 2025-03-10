// chart-manager.js
export default class ChartManager {
  #chart;
  #apiKey;
  #errorMessageElement; // Element to display error messages
  static MAX_RGB_VALUE = 255; // Constant for max RGB value

  constructor() {
    this.#apiKey = process.env.API_KEY || "XVYHOWRTRNPN3FJA"; // Use environment variable for API key
    this.#errorMessageElement = document.getElementById('error-message');
    this.init().then(() => {
      this.render(); // Render initial series for IBM
    });
  }

  async init() {
    this.#chart = LightweightCharts.createChart(document.getElementById('chart'), {
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
      this.#handleError(`Error rendering chart for ${symbol}: ${error.message}`);
    }
  }

  async #loadData(symbol) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${this.#apiKey}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return this.#handleError(`API Error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();

      if (data['Error Message']) {
        return this.#handleError(`Alpha Vantage API Error for ${symbol}: ${data['Error Message']}`);
      }
      if (data['Note']) {
        return this.#handleError(`Alpha Vantage API Note for ${symbol}: ${data['Note']}. Rate limit may be in effect.`);
      }

      const timeSeriesData = data['Time Series (Daily)'];
      if (!timeSeriesData) {
        return this.#handleError(`No Time Series data found for symbol: ${symbol} in API response.`);
      }

      const formattedData = Object.entries(timeSeriesData).map(([time, values]) => ({
        time: time,
        value: parseFloat(values['4. close'])
      }));
      return formattedData;

    } catch (error) {
      return this.#handleError(`Network error loading data for ${symbol}: ${error.message}`);
    }
  }

  #getRandomColor() {
    const r = Math.floor(Math.random() * ChartManager.MAX_RGB_VALUE);
    const g = Math.floor(Math.random() * ChartManager.MAX_RGB_VALUE);
    const b = Math.floor(Math.random() * ChartManager.MAX_RGB_VALUE);
    return `rgba(${r}, ${g}, ${b}, 0.7)`;
  }

  #displayErrorMessage(message) {
    this.#errorMessageElement.textContent = message;
  }

  #clearErrorMessage() {
    this.#errorMessageElement.textContent = '';
  }

  #handleError(message) {
    this.#displayErrorMessage(message);
    return null; // Indicate error to the caller
  }
}
