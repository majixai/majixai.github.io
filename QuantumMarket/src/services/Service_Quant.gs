/**
 * ==========================================================================
 * FILE: Service_Quant.gs
 * DESCRIPTION: Handles advanced mathematical and quantitative modeling for
 *              market data analysis, including Monte Carlo simulations,
 *              volatility calculations, and error analysis.
 * ==========================================================================
 */

const Service_Quant = {

  // SDE Constants calibrated for 1-minute intervals
  TIME_STEP: 1 / (252 * 8 * 60), // Trading days * hours * minutes
  DRIFT: 0.05 / (252 * 8 * 60),  // Annualized drift, scaled to per-minute
  EWMA_LAMBDA: 0.94,             // Lambda for EWMA volatility calculation
  BETA_LOOKBACK: 120,            // Lookback period for Beta calculation (minutes)

  /**
   * Generates a random number from a standard normal distribution.
   * (Uses the Box-Muller Transform for statistical accuracy).
   * @returns {number} A random normal value (z-score).
   */
  getNormalRandom: function() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  },

  /**
   * Calculates historical volatility (sigma) using an Exponentially Weighted
   * Moving Average (EWMA), which gives more weight to recent data.
   * @param {string} ticker The ticker to analyze.
   * @returns {number} The calculated annualized volatility (sigma).
   */
  getHistoricalSigmaEWMA: function(ticker) {
    try {
      const prices = this.getHistoricalPrices(ticker, this.BETA_LOOKBACK);
      if (prices.length < 20) return 0.25; // Return default if not enough data

      const logReturns = [];
      for (let i = 1; i < prices.length; i++) {
        logReturns.push(Math.log(prices[i] / prices[i-1]));
      }

      let variance = logReturns.reduce((sum, r) => sum + r*r, 0) / logReturns.length; // Initial variance
      for(let i = 1; i < logReturns.length; i++) {
        variance = this.EWMA_LAMBDA * variance + (1 - this.EWMA_LAMBDA) * Math.pow(logReturns[i], 2);
      }

      const dailyVolatility = Math.sqrt(variance);
      return dailyVolatility * Math.sqrt(252 * 8 * 60); // Annualize

    } catch (e) {
      System_Logger.log("GetSigmaEWMA", `Failed for ${ticker}: ${e.message}`, false);
      return 0.25; // Default sigma on error
    }
  },

  /**
   * Calculates the Beta of a stock relative to a market proxy (SPY).
   * Beta = Covariance(Stock, Market) / Variance(Market)
   * @param {string} ticker The ticker to analyze.
   * @returns {number|null} The calculated Beta or null if not enough data.
   */
  calculateBeta: function(ticker) {
    try {
      const stockPrices = this.getHistoricalPrices(ticker, this.BETA_LOOKBACK);
      const marketPrices = this.getHistoricalPrices('SPY', this.BETA_LOOKBACK); // Using SPY as market proxy

      if (stockPrices.length < 20 || marketPrices.length < 20) return null;

      // Ensure arrays are of the same length
      const len = Math.min(stockPrices.length, marketPrices.length);
      const stockReturns = this.calculateLogReturns(stockPrices.slice(-len));
      const marketReturns = this.calculateLogReturns(marketPrices.slice(-len));

      const covariance = this.covariance(stockReturns, marketReturns);
      const marketVariance = this.variance(marketReturns);

      return marketVariance === 0 ? 1 : covariance / marketVariance;

    } catch(e) {
      System_Logger.log("CalculateBeta", `Failed for ${ticker}: ${e.message}`, false);
      return null;
    }
  },

  /**
   * Runs a Monte Carlo simulation for a list of stocks using a Stochastic
   * Differential Equation (SDE) model for asset price paths.
   * @param {Array<Object>} liveData Array of stock objects with current prices.
   * @returns {Array<Object>} The data array with added quantitative metrics.
   */
  runMonteCarloSimulation: function(liveData) {
    return liveData.map(stock => {
      const sigma = this.getHistoricalSigmaEWMA(stock.ticker);

      // Geometric Brownian Motion SDE: dS = μS dt + σS dW
      // Solved form: S_t = S_0 * exp((μ - σ^2/2)t + σ√t * Z)
      const randomShock = this.getNormalRandom();
      const driftComponent = (this.DRIFT - (sigma * sigma) / 2) * this.TIME_STEP;
      const diffusionComponent = sigma * Math.sqrt(this.TIME_STEP) * randomShock;
      const projectedPrice = stock.price * Math.exp(driftComponent + diffusionComponent);

      return {
        ...stock,
        projected: projectedPrice,
        projectedReturn: (projectedPrice - stock.price) / stock.price,
        sigma: sigma,
        beta: this.calculateBeta(stock.ticker) // Add beta calculation
      };
    });
  },

  /**
   * Compares the last projection to the actual price to calculate an error term,
   * which is used to self-correct future projections via a learning mechanism.
   * @param {Array<Object>} projectedData Data after Monte Carlo simulation.
   * @returns {Array<Object>} Data with an added 'error' property.
   */
  performErrorAnalysis: function(projectedData) {
    const props = PropertiesService.getScriptProperties();
    const lastProjectionsJSON = props.getProperty('LAST_PROJECTIONS');
    const lastProjections = lastProjectionsJSON ? JSON.parse(lastProjectionsJSON) : {};

    const updatedData = projectedData.map(stock => {
      let error = 0;
      if (lastProjections[stock.ticker]) {
        const lastProjected = lastProjections[stock.ticker].projected;
        error = (stock.price - lastProjected) / lastProjected;
      }
      return { ...stock, error: error };
    });

    const newProjections = {};
    updatedData.forEach(stock => {
      newProjections[stock.ticker] = { projected: stock.projected, price: stock.price };
    });
    props.setProperty('LAST_PROJECTIONS', JSON.stringify(newProjections));

    return updatedData;
  },

  // --- UTILITY & MATH HELPERS ---

  getHistoricalPrices: function(ticker, count) {
    const folderName = System_Config.getSetting('FOLDER_NAME');
    const folder = DriveApp.getFoldersByName(folderName).next();
    const files = folder.getFiles();
    const prices = [];

    // Convert FileIterator to Array and sort by date descending
    const fileList = [];
    while(files.hasNext()) {
      fileList.push(files.next());
    }
    fileList.sort((a, b) => b.getDateCreated() - a.getDateCreated());

    // Process the most recent files up to the desired count
    for (let i = 0; i < fileList.length && i < count; i++) {
      const file = fileList[i];
      if (file.getName().startsWith('snapshot_')) {
        try {
          const data = JSON.parse(Utilities.unzip(file.getBlob()).getDataAsString());
          const stockData = data.find(s => s.ticker === ticker);
          if (stockData) {
            prices.unshift(stockData.price); // unshift to maintain chronological order
          }
        } catch(e) { /* Ignore corrupted files */ }
      }
    }
    return prices;
  },

  calculateLogReturns: function(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
    return returns;
  },

  variance: function(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  },

  covariance: function(arr1, arr2) {
    const mean1 = arr1.reduce((a, b) => a + b, 0) / arr1.length;
    const mean2 = arr2.reduce((a, b) => a + b, 0) / arr2.length;
    let covar = 0;
    for (let i = 0; i < arr1.length; i++) {
      covar += (arr1[i] - mean1) * (arr2[i] - mean2);
    }
    return covar / arr1.length;
  }
};
