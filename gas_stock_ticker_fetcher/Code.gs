/**
 * @OnlyCurrentDoc
 *
 * The above comment directs App Script to limit the scope of script authorization
 * to only the current document. This enhances security by preventing the script
 * from accessing other files in the user's Drive.
 */

/**
 * Serves the HTML file for the web app.
 * This function is the entry point for GET requests.
 *
 * @return {HtmlService.HtmlOutput} The HTML output to be rendered.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

/**
 * Fetches data for a given stock ticker using the GOOGLEFINANCE formula.
 *
 * This function creates a temporary sheet, inserts the formula, reads the result,
 * and then deletes the sheet. This is a reliable way to get fresh data.
 *
 * @param {string} ticker The stock ticker symbol (e.g., "GOOG", "NASDAQ:TSLA").
 * @return {Object} An object containing the data or an error message.
 */
function getTickerData(ticker) {
  if (!ticker || typeof ticker !== 'string' || ticker.trim() === '') {
    return { success: false, error: 'Invalid ticker symbol provided.' };
  }

  const spreadsheet = SpreadsheetApp.create('Temporary Ticker Fetcher');
  const sheet = spreadsheet.getSheets()[0];
  const range = sheet.getRange('A1');

  try {
    // Set the formula in the cell
    range.setFormula('=GOOGLEFINANCE("' + ticker + '")');

    // Flush the changes to ensure the formula is calculated
    SpreadsheetApp.flush();
    Utilities.sleep(2000); // Wait for 2 seconds to allow the formula to calculate

    // Get the calculated value
    const data = range.getValue();

    // Check if the formula returned an error (e.g., #N/A for an invalid ticker)
    if (typeof data === 'string' && data.startsWith('#')) {
      return { success: false, error: 'Could not retrieve data for ticker: ' + ticker + '. It may be invalid.' };
    }

    return { success: true, data: data };

  } catch (e) {
    return { success: false, error: 'An unexpected error occurred: ' + e.message };
  } finally {
    // Ensure the temporary spreadsheet is always deleted
    DriveApp.getFileById(spreadsheet.getId()).setTrashed(true);
  }
}
