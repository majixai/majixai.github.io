// Set the ID of the Google Sheet to be used for logging.
// To create a new sheet, go to sheet.new and copy the ID from the URL.
const LOG_SHEET_ID = 'YOUR_SHEET_ID_HERE'; // <-- IMPORTANT: Replace with your actual Sheet ID

/**
 * Appends a log entry to the designated Google Sheet.
 * Creates the sheet if it doesn't exist.
 *
 * @param {string} functionName The name of the function being logged.
 * @param {string} status The status of the event (e.g., "SUCCESS", "ERROR").
 * @param {string} details Additional details or error messages.
 */
function logEvent(functionName, status, details) {
  try {
    const sheet = getLogSheet();
    const timestamp = new Date();
    sheet.appendRow([timestamp, functionName, status, details]);
  } catch (e) {
    // Fallback to Logger if logging to the sheet fails
    Logger.log(`Failed to log to sheet: ${e.toString()}`);
    Logger.log(`Original log: [${functionName}] ${status} - ${details}`);
  }
}

/**
 * Retrieves the log sheet, creating it if it doesn't exist.
 * @private
 * @return {Sheet} The Google Sheet for logging.
 */
function getLogSheet() {
  if (LOG_SHEET_ID === 'YOUR_SHEET_ID_HERE') {
    throw new Error('Please replace "YOUR_SHEET_ID_HERE" with your Google Sheet ID in LoggingService.gs');
  }

  const ss = SpreadsheetApp.openById(LOG_SHEET_ID);
  let sheet = ss.getSheetByName('Logs');

  if (!sheet) {
    sheet = ss.insertSheet('Logs');
    sheet.appendRow(['Timestamp', 'Function Name', 'Status', 'Details']);
  }

  return sheet;
}
