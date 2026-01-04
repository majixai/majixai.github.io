/**
 * -------------------------------------------------------------------------
 * FILE: DailyPrediction.gs
 * DESCRIPTION: Handles the once-daily AI-powered market prediction routine.
 * -------------------------------------------------------------------------
 */

const DailyPrediction = {

  /**
   * Main function to be triggered daily before market open.
   * TRIGGER: Time-driven (e.g., 8:50 AM)
   */
  runDailyPredictionRoutine: function() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(300000)) return; // 5 minute lock

    try {
      LogSystem.log("DailyOracle", "Waking up the Oracle...");

      // 1. Fetch consolidated data from the previous day
      const marketContext = this.getPreviousDayContext();
      if (!marketContext) {
        LogSystem.log("DailyOracle", "Routine cancelled: Not enough data.", true);
        return;
      }

      // 2. Get the current watchlist
      const watchlist = DataEngine.getWatchlist();
      if (watchlist.length === 0) {
        LogSystem.log("DailyOracle", "Routine cancelled: Watchlist is empty.");
        return;
      }

      // 3. Generate predictions for each ticker
      const predictions = [];
      for (const stock of watchlist) {
        try {
          const prediction = this.fetchOraclePrediction(stock, marketContext);
          predictions.push(prediction);
          Utilities.sleep(2000); // Rate limiting for API
        } catch (e) {
          LogSystem.log("DailyOracle-Ticker", `Failed for ${stock.ticker}: ${e.message}`, true);
        }
      }

      // 4. Save predictions to the sheet
      this.savePredictionsToSheet(predictions);
      LogSystem.log("DailyOracle", `Successfully generated and saved ${predictions.length} predictions.`);

    } catch (e) {
      LogSystem.log("DailyOracle", `CRITICAL FAILURE: ${e.stack}`, true);
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Gathers all data from the last 24 hours from Drive to create a context.
   * @returns {string|null} A stringified JSON of the market data or null.
   */
  getPreviousDayContext: function() {
    const folderName = PropertiesService.getScriptProperties().getProperty('FOLDER_NAME') || 'MarketData_DB';
    const folder = DriveApp.getFoldersByName(folderName).next();
    const files = folder.getFiles();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const marketData = {};

    while (files.hasNext()) {
      const file = files.next();
      if (file.getDateCreated() > yesterday) {
        const blob = Utilities.unzip(file.getBlob());
        const data = JSON.parse(blob.getDataAsString());

        data.forEach(item => {
          if (!marketData[item.ticker]) {
            marketData[item.ticker] = [];
          }
          marketData[item.ticker].push({ p: item.price, s: item.sigma });
        });
      }
    }

    // Condense data to save tokens
    for (const ticker in marketData) {
      if (marketData[ticker].length > 20) {
         // Simple downsampling: take every Nth element
         const factor = Math.floor(marketData[ticker].length / 20);
         marketData[ticker] = marketData[ticker].filter((_, i) => i % factor === 0);
      }
    }

    return Object.keys(marketData).length > 0 ? JSON.stringify(marketData) : null;
  },

  /**
   * Calls the Gemini API to get a prediction for a single stock.
   * @param {Object} stock The stock object {ticker, exchange}.
   * @param {string} marketContext The JSON string of previous day's data.
   * @returns {Object} The prediction data.
   */
  fetchOraclePrediction: function(stock, marketContext) {
    const prompt = `
      Act as a market prediction oracle.
      You will be given the ticker symbol and the previous day's price and volatility (sigma) data for the entire market watchlist.

      Your task is to predict the OPENING price and the CLOSING price for the given ticker.
      Also, provide a CONFIDENCE score (0.0 to 1.0) for your closing prediction.

      Ticker to Predict: ${stock.ticker} (${stock.exchange})

      Previous Day Market Context (p = price, s = sigma):
      ${marketContext}

      Constraints:
      - Analyze the ticker's own historical volatility and its relation to the broader market context.
      - Base your prediction on patterns, not external news.
      - Return ONLY a JSON object with the keys "ticker", "opening_prediction", "closing_prediction", and "confidence". Do not include any other text or formatting.
    `;

    const response = AIEngine.callGeminiAPI(prompt);
    const cleanedResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedResponse);
  },

  /**
   * Saves the generated predictions to the 'Daily_Predictions' sheet.
   * @param {Array<Object>} predictions The array of prediction objects.
   */
  savePredictionsToSheet: function(predictions) {
    if (predictions.length === 0) return;

    const ss = DataEngine.initEnvironment();
    const sheet = ss.getSheetByName('Daily_Predictions');
    const today = new Date();

    const rows = predictions.map(p => [
      today,
      p.ticker,
      p.opening_prediction,
      p.closing_prediction,
      p.confidence
    ]);

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }
};


// Make the main function globally accessible for triggers
function runDailyPredictionRoutine() {
  DailyPrediction.runDailyPredictionRoutine();
}
