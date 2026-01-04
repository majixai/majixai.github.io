/**
 * ==========================================================================
 * FILE: Service_Oracle.gs
 * DESCRIPTION: Handles the once-daily AI-powered market prediction routine.
 *              This service acts as the "Oracle," providing high-level,
 *              long-term (daily) predictions.
 * ==========================================================================
 */

const Service_Oracle = {

  /**
   * Main function triggered daily before market open.
   */
  runDailyPredictionRoutine: function() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(300000)) return; // 5 minute lock to prevent overlap

    try {
      System_Logger.log("Oracle", "Waking up the Oracle for daily predictions...");

      const marketContext = this.getPreviousDayContext();
      if (!marketContext) {
        System_Logger.log("Oracle", "Routine cancelled: Not enough historical data to form a context.", true);
        return;
      }

      const watchlist = Service_Data.getSheetData('Watchlist').map(r => ({ticker: r[0], exchange: r[1]}));
      if (watchlist.length === 0) {
        System_Logger.log("Oracle", "Routine cancelled: Watchlist is empty.");
        return;
      }

      const predictions = [];
      for (const stock of watchlist) {
        try {
          // Pass context to the AI service to get a prediction
          const prediction = Service_AI.fetchOraclePrediction(stock, marketContext);
          if(prediction) predictions.push(prediction);
          Utilities.sleep(2000); // API rate limiting
        } catch (e) {
          System_Logger.log("OracleTicker", `Failed prediction for ${stock.ticker}: ${e.message}`, true);
        }
      }

      this.savePredictionsToSheet(predictions);
      System_Logger.log("Oracle", `Successfully generated and saved ${predictions.length} daily predictions.`);

    } catch (e) {
      System_Logger.log("Oracle", `CRITICAL FAILURE in daily routine: ${e.stack}`, true);
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Gathers and condenses all data from the last 24 hours from Drive snapshots
   * to create a market context for the AI.
   * @returns {string|null} A stringified JSON of the market data or null if none.
   */
  getPreviousDayContext: function() {
    const folderName = System_Config.getSetting('FOLDER_NAME');
    const folder = DriveApp.getFoldersByName(folderName).next();
    const files = folder.getFiles();
    const yesterday = new Date(new Date().setDate(new Date().getDate() - 1));

    const marketData = {};

    while (files.hasNext()) {
      const file = files.next();
      if (file.getDateCreated() > yesterday) {
        try {
          const data = JSON.parse(Utilities.unzip(file.getBlob()).getDataAsString());
          data.forEach(item => {
            if (!marketData[item.ticker]) marketData[item.ticker] = [];
            // Store a tuple of price and sigma to capture price and volatility
            marketData[item.ticker].push([item.price, item.sigma]);
          });
        } catch(e) { /* Ignore corrupted files */ }
      }
    }

    // Downsample to save tokens for the AI prompt
    for (const ticker in marketData) {
      if (marketData[ticker].length > 25) {
         const factor = Math.floor(marketData[ticker].length / 25);
         marketData[ticker] = marketData[ticker].filter((_, i) => i % factor === 0);
      }
    }

    return Object.keys(marketData).length > 0 ? JSON.stringify(marketData) : null;
  },

  /**
   * Saves the generated predictions to the 'Daily_Predictions' sheet.
   * @param {Array<Object>} predictions The array of prediction objects from the AI.
   */
  savePredictionsToSheet: function(predictions) {
    if (predictions.length === 0) return;

    const ss = Service_Data.initEnvironment();
    const sheet = ss.getSheetByName('Daily_Predictions');
    const today = new Date();

    const rows = predictions.map(p => [
      today,
      p.ticker,
      p.opening_prediction,
      p.closing_prediction,
      p.confidence
    ]);

    // Append new rows to the end of the sheet
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }
};
