/**
 * -------------------------------------------------------------------------
 * FILE: QuantLib.gs
 * DESCRIPTION: Handles advanced mathematical modeling for market data.
 * -------------------------------------------------------------------------
 */

const QuantLib = {

  // SDE Constants (calibrated for 1-minute intervals)
  TIME_STEP: 1 / (252 * 8 * 60), // Trading days, hours, minutes
  DRIFT: 0.05 / (252 * 8 * 60),  // Annualized drift, scaled to minutes

  /**
   * Generates a random number from a standard normal distribution.
   * (Box-Muller Transform)
   * @returns {number} A random normal value.
   */
  getNormalRandom: function() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  },

  /**
   * Calculates historical volatility (sigma) from stored Drive snapshots.
   * @param {string} ticker The ticker to analyze.
   * @returns {number} The calculated annualized volatility.
   */
  getHistoricalSigma: function(ticker) {
    try {
      const props = PropertiesService.getScriptProperties();
      const folderName = props.getProperty('FOLDER_NAME') || 'MarketData_DB';
      const folder = DriveApp.getFoldersByName(folderName).next();
      const files = folder.getFiles();

      const prices = [];
      let count = 0;

      // Get the last ~2 hours of data (120 files)
      while (files.hasNext() && count < 120) {
        const file = files.next();
        if (file.getName().startsWith('snapshot_')) {
          const blob = file.getBlob();
          const unzipped = Utilities.unzip(blob);
          const data = JSON.parse(unzipped.getDataAsString());

          const stockData = data.find(s => s.ticker === ticker);
          if (stockData) {
            prices.push(stockData.price);
          }
          count++;
        }
      }

      if (prices.length < 10) return 0.2; // Default if not enough data

      // Calculate log returns
      const logReturns = [];
      for (let i = 1; i < prices.length; i++) {
        logReturns.push(Math.log(prices[i] / prices[i-1]));
      }

      // Calculate standard deviation of log returns
      const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
      const variance = logReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / logReturns.length;
      const stdDev = Math.sqrt(variance);

      // Annualize the volatility
      return stdDev * Math.sqrt(252 * 8 * 60);

    } catch (e) {
      LogSystem.log("GetSigma", `Failed for ${ticker}: ${e.message}`, false);
      return 0.2; // Return a default value on error
    }
  },

  /**
   * Runs a Monte Carlo simulation for a list of stocks using a Stochastic Differential Equation (SDE).
   * @param {Array<Object>} liveData Array of stock objects with current prices.
   * @returns {Array<Object>} The data array with added 'projected' and 'sigma' properties.
   */
  runMonteCarloSimulation: function(liveData) {
    return liveData.map(stock => {
      const sigma = this.getHistoricalSigma(stock.ticker);

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
        sigma: sigma
      };
    });
  },

  /**
   * Compares last projection to actual price to calculate an error term.
   * This error term is used to self-correct future projections.
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
        // Simple error calculation: (Actual - Predicted) / Predicted
        error = (stock.price - lastProjected) / lastProjected;
      }
      return { ...stock, error: error };
    });

    // Store current projections for the next cycle
    const newProjections = {};
    updatedData.forEach(stock => {
      newProjections[stock.ticker] = { projected: stock.projected, price: stock.price };
    });
    props.setProperty('LAST_PROJECTIONS', JSON.stringify(newProjections));

    return updatedData;
  }
};
