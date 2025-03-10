// chart-manager.js
export default class ChartManager {
  #chartDiv; // Using #chartDiv for Plotly container
  #apiKey;    // API Key (now configurable from environment variables)
  #errorMessageElement; // Element for displaying error messages
  static MAX_RGB_VALUE = 255; // Constant for max RGB color value

  constructor() {
    this.#chartDiv = document.getElementById('chart');
    this.#errorMessageElement = document.getElementById('error-message');
    // API Key from environment variable or default
    this.#apiKey = process.env.API_KEY || "XVYHOWRTRNPN3FJA";

    this.init().then(() => {
      this.render('IBM'); // Initial series
      this.render('AAPL');
      this.render('TSLA');
    });
  }

  async init() {
    Plotly.newPlot(this.#chartDiv, [], {
      title: 'Stock Chart',
      xaxis: {
        title: 'Date'
      },
      yaxis: {
        title: 'Price'
      },
      plot_bgcolor: '#fff',
      paper_bgcolor: '#fff',
      font: {
        color: '#333'
      }
    });
  }

  async render(symbol = 'MSFT') {
    try {
      const newData = await this.#loadData(symbol);
      if (newData && newData.x.length > 0) {
        this.#clearErrorMessage();
        const trace = {
          x: newData.x,
          y: newData.y,
          mode: 'lines',
          name: symbol,
          line: {
            color: this.#getRandomColor()
          }
        };
        Plotly.addTraces(this.#chartDiv, [trace]);
      } else {
        this.#handleError(`No data found for symbol: ${symbol}`); // Use handleError
      }
    } catch (error) {
      this.#handleError(`Error rendering chart for ${symbol}: ${error.message}`); // Use handleError
    }
  }

  async #loadData(symbol) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&apikey=${this.#apiKey}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return this.#handleError(`API Error: ${response.status} ${response.statusText}`); // Use handleError
      }
      const data = await response.json();

      if (data['Error Message']) {
        return this.#handleError(`Alpha Vantage API Error for ${symbol}: ${data['Error Message']}`); // Use handleError
      }
      if (data['Note']) {
        return this.#handleError(`Alpha Vantage API Note for ${symbol}: ${data['Note']}. Rate limit may be in effect.`); // Use handleError
      }

      const timeSeriesData = data['Time Series (Daily)'];
      if (!timeSeriesData) {
        return this.#handleError(`No Time Series data found for symbol: ${symbol} in API response.`); // Use handleError
      }

      const formattedData = { x: [], y: [] };
      Object.entries(timeSeriesData).forEach(([time, values]) => {
        formattedData.x.unshift(time);
        formattedData.y.unshift(parseFloat(values['4. close']));
      });
      return formattedData;

    } catch (error) {
      return this.#handleError(`Network error loading data for ${symbol}: ${error.message}`); // Use handleError
    }
  }

  #getRandomColor() {
    const r = Math.floor(Math.random() * ChartManager.MAX_RGB_VALUE); // Use MAX_RGB_VALUE constant
    const g = Math.floor(Math.random() * ChartManager.MAX_RGB_VALUE);
    const b = Math.floor(Math.random() * ChartManager.MAX_RGB_VALUE);
    return `rgb(${r}, ${g}, ${b})`;
  }

  #displayErrorMessage(message) {
    this.#errorMessageElement.textContent = message;
  }

  #clearErrorMessage() {
    this.#errorMessageElement.textContent = '';
  }

  #handleError(message) { // Centralized error handling
    this.#displayErrorMessage(message);
    return null; // Indicate error to the caller
  }
}
