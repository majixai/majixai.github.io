/**
 * -------------------------------------------------------------------------
 * FILE: DataEngine.gs
 * DESCRIPTION: Handles Data I/O -> Google Finance, Sheets, Drive
 * -------------------------------------------------------------------------
 */

const DataEngine = {

  // --- 1. INITIALIZATION & ENVIRONMENT SETUP ---

  /**
   * Ensures the necessary Sheets and Drive folders exist.
   */
  initEnvironment: function() {
    const props = PropertiesService.getScriptProperties();
    const sheetId = props.getProperty('SHEET_ID');
    const folderName = props.getProperty('FOLDER_NAME') || 'MarketData_DB';

    let ss;
    if (sheetId) {
      try {
        ss = SpreadsheetApp.openById(sheetId);
      } catch (e) {
        // If ID is invalid or access lost, create a new one
        ss = this.createNewSheet();
        props.setProperty('SHEET_ID', ss.getId());
      }
    } else {
      ss = this.createNewSheet();
      props.setProperty('SHEET_ID', ss.getId());
    }

    // Check for Drive folder and subfolder
    let mainFolder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      mainFolder = folders.next();
    } else {
      mainFolder = DriveApp.createFolder(folderName);
      LogSystem.log("DataEngine", `Created Drive folder: ${folderName}`);
    }

    // Ensure the subfolder for processed files exists
    const subFolders = mainFolder.getFoldersByName('processed_snapshots');
    if (!subFolders.hasNext()) {
      mainFolder.createFolder('processed_snapshots');
      LogSystem.log("DataEngine", "Created 'processed_snapshots' subfolder.");
    }

    return ss;
  },

  /**
   * Creates a new Spreadsheet with required sheets and headers.
   */
  createNewSheet: function() {
    const ss = SpreadsheetApp.create('Quantum Market Database');
    const sheets = ['Watchlist', 'Daily_Predictions', 'AI_Bulls', 'Config'];

    // Clear default "Sheet1"
    ss.deleteSheet(ss.getSheetByName('Sheet1'));

    sheets.forEach(name => {
      const sheet = ss.insertSheet(name);
      let headers = [];
      if (name === 'Watchlist') {
        headers = [['Ticker', 'Exchange', 'Price', 'Projected', 'Sigma', 'Error', 'Updated', 'Notes']];
      } else if (name === 'Daily_Predictions') {
        headers = [['Date', 'Ticker', 'Opening_Prediction', 'Closing_Prediction', 'Confidence']];
      } else if (name === 'AI_Bulls') {
        headers = [['Ticker', 'Reasoning', 'Confidence_Score', 'Last_Updated']];
      }
      if (headers.length > 0) {
        sheet.getRange(1, 1, headers.length, headers[0].length).setValues(headers).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
    });

    LogSystem.log("DataEngine", `Created new database sheet: ${ss.getName()}`);
    return ss;
  },

  // --- 2. CORE DATA FETCHING ---

  /**
   * Fetches the current watchlist from the sheet.
   * @returns {Array<Object>} An array of ticker objects.
   */
  getWatchlist: function() {
    const ss = this.initEnvironment();
    const sheet = ss.getSheetByName('Watchlist');
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    return data.filter(r => r[0]).map(r => ({ ticker: r[0], exchange: r[1] }));
  },

  /**
   * Fetches live prices for the entire watchlist using GOOGLEFINANCE.
   * @returns {Array<Object>} Array of stocks with live data.
   */
  fetchWatchlist: function() {
    const watchlist = this.getWatchlist();
    if (watchlist.length === 0) return [];

    // Create a temporary sheet for bulk fetching
    const tempSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('TempFetch');

    try {
      const formulas = watchlist.map((stock, i) => {
        const symbol = (stock.exchange === 'CRYPTO' || stock.ticker.includes('-'))
                       ? `'${stock.ticker}'`
                       : `'${stock.ticker}:${stock.exchange}'`;
        return [`=GOOGLEFINANCE(${symbol}, "price")`];
      });

      // Set all formulas and get results
      tempSheet.getRange(1, 1, formulas.length, 1).setFormulas(formulas);
      SpreadsheetApp.flush(); // Force calculation
      Utilities.sleep(2000); // Wait for external data

      const prices = tempSheet.getRange(1, 1, formulas.length, 1).getValues();

      // Combine results with original data
      return watchlist.map((stock, i) => ({
        ...stock,
        price: (prices[i][0] && typeof prices[i][0] === 'number') ? prices[i][0] : null
      })).filter(s => s.price !== null);

    } catch(e) {
      LogSystem.log("FetchWatchlist", e.message, true);
      return [];
    } finally {
      // Cleanup
      SpreadsheetApp.getActiveSpreadsheet().deleteSheet(tempSheet);
    }
  },

  // --- 3. DATA PERSISTENCE (SHEETS & DRIVE) ---

  /**
   * Updates the 'Watchlist' sheet with the latest computed data.
   * @param {Array<Object>} data The processed data.
   */
  updateSheet: function(data) {
    if (!data || data.length === 0) return;

    const ss = this.initEnvironment();
    const sheet = ss.getSheetByName('Watchlist');
    const range = sheet.getRange(2, 1, sheet.getLastRow(), sheet.getLastColumn());
    const sheetData = range.getValues();
    const now = new Date().toLocaleTimeString();

    // Create a map for quick lookups
    const dataMap = new Map(data.map(item => [item.ticker, item]));

    // Update existing rows
    const updatedSheetData = sheetData.map(row => {
      const ticker = row[0];
      if (dataMap.has(ticker)) {
        const item = dataMap.get(ticker);
        return [
          item.ticker,
          item.exchange,
          item.price.toFixed(4),
          item.projected.toFixed(4),
          item.sigma.toFixed(5),
          item.error.toFixed(5),
          now,
          row[7] || '' // Preserve notes
        ];
      }
      return row;
    });

    range.setValues(updatedSheetData);
  },

  /**
   * Creates a compressed JSON snapshot of data and saves to Drive.
   * @param {Object} data The data to save.
   */
  snapshotToDrive: function(data) {
    try {
      const props = PropertiesService.getScriptProperties();
      const folderName = props.getProperty('FOLDER_NAME') || 'MarketData_DB';
      const folder = DriveApp.getFoldersByName(folderName).next();

      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const fileName = `snapshot_${timestamp}.json.gz`;

      const jsonString = JSON.stringify(data);
      const blob = Utilities.newBlob(jsonString, 'application/json', fileName);
      const compressedBlob = Utilities.gzip(blob);

      folder.createFile(compressedBlob);

      // Prune old files (keep last 100)
      const files = folder.getFiles();
      const fileList = [];
      while(files.hasNext()) fileList.push(files.next());

      if (fileList.length > 100) {
        fileList.sort((a,b) => a.getDateCreated() - b.getDateCreated())
                .slice(0, fileList.length - 100)
                .forEach(f => f.setTrashed(true));
      }
    } catch (e) {
      LogSystem.log("SnapshotToDrive", e.message, true);
    }
  },

  // --- 4. UTILITY FUNCTIONS ---

  /**
   * Adds a new ticker to the watchlist.
   * @param {string} ticker The stock ticker.
   * @param {string} exchange The stock exchange.
   * @returns {string} A success or error message.
   */
  addTicker: function(ticker, exchange) {
    ticker = ticker.trim().toUpperCase();
    exchange = exchange.trim().toUpperCase();

    const ss = this.initEnvironment();
    const sheet = ss.getSheetByName('Watchlist');

    // Check for duplicates
    const existingData = sheet.getRange(2, 1, sheet.getLastRow(), 1).getValues();
    if (existingData.some(row => row[0] === ticker)) {
      return `Ticker ${ticker} already exists.`;
    }

    sheet.appendRow([ticker, exchange, 'Fetching...', '', '', '', '', '']);
    LogSystem.log("DataEngine", `Added ticker: ${ticker}`);

    // Run an immediate update for the new ticker
    minutelyHeartbeat();

    return `Successfully added ${ticker}.`;
  }
};
