/**
 * ==========================================================================
 * FILE: Service_Data.gs
 * DESCRIPTION: Handles all data input/output operations, including interactions
 *              with Google Finance, Google Sheets, and Google Drive for
 *              data persistence and environment setup.
 * ==========================================================================
 */

const Service_Data = {

  // --- 1. ENVIRONMENT & SHEET INITIALIZATION ---

  /**
   * Ensures the necessary Sheets and Drive folders/subfolders exist.
   * This is the foundational setup for the entire application.
   */
  initEnvironment: function() {
    const folderName = System_Config.getSetting('FOLDER_NAME');

    // Set up or validate the main Drive Folder
    let mainFolder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      mainFolder = folders.next();
    } else {
      mainFolder = DriveApp.createFolder(folderName);
      System_Logger.log("DataService", `Created main Drive folder: ${folderName}`);
    }

    // Ensure critical subfolders exist
    this.ensureSubFolderExists(mainFolder, 'processed_snapshots');
    this.ensureSubFolderExists(mainFolder, 'ingested_payloads');

    // Set up or validate the Spreadsheet database
    const sheetId = System_Config.getSetting('SHEET_ID');
    let ss;
    if (sheetId) {
      try {
        ss = SpreadsheetApp.openById(sheetId);
      } catch (e) {
        ss = this.createNewSheet();
        System_Config.saveSetting('SHEET_ID', ss.getId());
      }
    } else {
      ss = this.createNewSheet();
      System_Config.saveSetting('SHEET_ID', ss.getId());
    }
    return ss;
  },

  /**
   * Helper to create a subfolder if it doesn't exist.
   * @param {Folder} parentFolder The parent Google Drive folder.
   * @param {string} folderName The name of the subfolder to check for.
   */
  ensureSubFolderExists: function(parentFolder, folderName) {
    const subFolders = parentFolder.getFoldersByName(folderName);
    if (!subFolders.hasNext()) {
      parentFolder.createFolder(folderName);
      System_Logger.log("DataService", `Created subfolder: ${folderName}`);
    }
  },

  /**
   * Creates a new Spreadsheet with all required sheets and formatting.
   * @returns {Spreadsheet} The newly created Spreadsheet object.
   */
  createNewSheet: function() {
    const ss = SpreadsheetApp.create('Quantum Market Database');
    const sheets = ['Watchlist', 'Daily_Predictions', 'AI_Bulls', 'Config'];

    ss.deleteSheet(ss.getSheetByName('Sheet1')); // Remove default sheet

    const sheetConfigs = {
      'Watchlist': [['Ticker', 'Exchange', 'Price', 'Projected', 'Sigma', 'Error', 'Updated', 'Notes']],
      'Daily_Predictions': [['Date', 'Ticker', 'Opening_Prediction', 'Closing_Prediction', 'Confidence']],
      'AI_Bulls': [['Ticker', 'Reasoning', 'Confidence_Score', 'Last_Updated']],
      'Config': [[]]
    };

    sheets.forEach(name => {
      const sheet = ss.insertSheet(name);
      const headers = sheetConfigs[name];
      if (headers && headers[0].length > 0) {
        sheet.getRange(1, 1, headers.length, headers[0].length).setValues(headers).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
    });

    System_Logger.log("DataService", `Created new database sheet: ${ss.getName()}`);
    return ss;
  },

  // --- 2. CORE DATA FETCHING & PERSISTENCE ---

  /**
   * Fetches the raw data from a specified sheet.
   * @param {string} sheetName The name of the sheet to read.
   * @returns {Array<Array<string>>} A 2D array of data.
   */
  getSheetData: function(sheetName) {
    const ss = this.initEnvironment();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return [];
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  },

  /**
   * Fetches live prices for the entire watchlist using GOOGLEFINANCE.
   * @returns {Array<Object>} An array of stock objects with live price data.
   */
  fetchWatchlist: function() {
    const watchlistData = this.getSheetData('Watchlist');
    const watchlist = watchlistData.map(r => ({ ticker: r[0], exchange: r[1] })).filter(r => r.ticker);
    if (watchlist.length === 0) return [];

    const tempSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(`TempFetch_${new Date().getTime()}`);
    try {
      const formulas = watchlist.map(stock => {
        const symbol = (stock.exchange === 'CRYPTO' || stock.ticker.includes('-'))
                       ? `'${stock.ticker}'`
                       : `'${stock.ticker}:${stock.exchange}'`;
        return [`=GOOGLEFINANCE(${symbol}, "price")`];
      });

      tempSheet.getRange(1, 1, formulas.length, 1).setFormulas(formulas);
      SpreadsheetApp.flush();
      Utilities.sleep(2500); // Wait for external data call to complete

      const prices = tempSheet.getRange(1, 1, formulas.length, 1).getValues();

      return watchlist.map((stock, i) => ({
        ...stock,
        price: (prices[i][0] && typeof prices[i][0] === 'number') ? prices[i][0] : null
      })).filter(s => s.price !== null);

    } catch(e) {
      System_Logger.log("FetchWatchlist", e.message, true);
      return [];
    } finally {
      SpreadsheetApp.getActiveSpreadsheet().deleteSheet(tempSheet);
    }
  },

  /**
   * Updates the 'Watchlist' sheet with the latest computed data.
   * @param {Array<Object>} data The processed data from the quant service.
   */
  updateSheet: function(data) {
    if (!data || data.length === 0) return;

    const ss = this.initEnvironment();
    const sheet = ss.getSheetByName('Watchlist');
    const range = sheet.getRange(2, 1, sheet.getLastRow(), sheet.getLastColumn());
    const sheetData = range.getValues();
    const now = new Date().toLocaleTimeString();
    const dataMap = new Map(data.map(item => [item.ticker, item]));

    const updatedSheetData = sheetData.map(row => {
      const ticker = row[0];
      if (dataMap.has(ticker)) {
        const item = dataMap.get(ticker);
        return [
          item.ticker, item.exchange, item.price.toFixed(4),
          item.projected.toFixed(4), item.sigma.toFixed(5),
          item.error.toFixed(5), now, row[7] || ''
        ];
      }
      return row;
    });
    range.setValues(updatedSheetData);
  },

  /**
   * Creates a compressed JSON snapshot of data and saves it to Google Drive.
   * @param {Object} data The data to save.
   */
  snapshotToDrive: function(data) {
    try {
      const folderName = System_Config.getSetting('FOLDER_NAME');
      const folder = DriveApp.getFoldersByName(folderName).next();

      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const fileName = `snapshot_${timestamp}.json.gz`;

      const jsonString = JSON.stringify(data);
      const blob = Utilities.newBlob(jsonString, 'application/json', fileName);
      const compressedBlob = Utilities.gzip(blob);
      folder.createFile(compressedBlob);

      this.pruneOldSnapshots(folder);
    } catch (e) {
      System_Logger.log("SnapshotToDrive", e.message, true);
    }
  },

  /**
   * Prunes old snapshot files to keep the Drive folder clean (keeps last 100).
   * @param {Folder} folder The Google Drive folder to prune.
   */
  pruneOldSnapshots: function(folder) {
    const files = folder.getFiles();
    const fileList = [];
    while(files.hasNext()) fileList.push(files.next());

    if (fileList.length > 100) {
      fileList.sort((a, b) => a.getDateCreated() - b.getDateCreated())
              .slice(0, fileList.length - 100)
              .forEach(f => f.setTrashed(true));
    }
  },

  // --- 3. UTILITY FUNCTIONS ---

  /**
   * Adds a new ticker to the 'Watchlist' sheet.
   * @param {string} ticker The stock ticker.
   * @param {string} exchange The stock exchange.
   * @returns {string} A success or error message.
   */
  addTicker: function(ticker, exchange) {
    ticker = ticker.trim().toUpperCase();
    exchange = exchange.trim().toUpperCase();

    const ss = this.initEnvironment();
    const sheet = ss.getSheetByName('Watchlist');

    const existingData = sheet.getRange(2, 1, sheet.getLastRow(), 1).getValues();
    if (existingData.some(row => row[0] === ticker)) {
      return `Ticker ${ticker} already exists.`;
    }

    sheet.appendRow([ticker, exchange, 'Fetching...', '', '', '', '', '']);
    System_Logger.log("DataService", `Added ticker: ${ticker}`);

    minutelyHeartbeat(); // Run an immediate update for the new ticker

    return `Successfully added ${ticker}.`;
  }
};
