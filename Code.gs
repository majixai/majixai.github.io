// Global constants for API configuration
const API_KEY = '324aa0762emsh819e95a929bb601p12c02cjsn53c4a93bd374'; // IMPORTANT: User must replace with their own key
const API_HOST = 'yahoo-finance15.p.rapidapi.com';

/**
 * Runs when the Google Sheet is opened.
 * Adds a custom menu item to open the sidebar.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Yahoo Finance')
      .addItem('Open yFinance Sidebar', 'showYFinanceSidebar')
      .addToUi();
}

/**
 * Shows the sidebar in the Google Sheet.
 */
function showYFinanceSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('yFinanceSidebar')
      .setTitle('yFinance Stock Data')
      .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Fetches stock data from the Yahoo Finance API.
 *
 * @param {string} symbol The stock symbol (e.g., 'AAPL', 'TSLA').
 * @param {string} interval The data interval (e.g., '1m', '5m', '1d').
 * @return {Object} An object containing the data or an error message.
 */
function fetchStockData(symbol = 'TSLA', interval = '1m') {
  const url = `https://${API_HOST}/api/v1/markets/stock/history?symbol=${symbol}&interval=${interval}&diffandsplits=false`;
  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': API_HOST
    },
    muteHttpExceptions: true // Prevents script termination on HTTP errors, allowing custom error handling
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const resultText = response.getContentText();

    if (responseCode === 200) {
      const jsonResponse = JSON.parse(resultText);
      // The API response structure needs to be inspected to determine how to best extract data.
      // This part will likely need adjustment based on the actual API response.
      if (jsonResponse.body && Array.isArray(jsonResponse.body) && jsonResponse.body.length > 0) {
        return { data: jsonResponse.body };
      } else if (jsonResponse.items && Array.isArray(jsonResponse.items) && jsonResponse.items.length > 0) {
         return { data: jsonResponse.items };
      } else if (jsonResponse.body && typeof jsonResponse.body === 'object' && Object.keys(jsonResponse.body).length > 0) {
        // Handles cases where data might be an object of objects or a single record.
        // Attempts to convert it into an array of arrays for sheets.
        const dataArray = Object.values(jsonResponse.body);
        if (dataArray.length > 0 && typeof dataArray[0] === 'object') {
             return { data: dataArray };
        }
        return { data: [jsonResponse.body] }; // Fallback for a single complex object
      } else if (typeof jsonResponse === 'object' && jsonResponse !== null && Object.keys(jsonResponse).length > 0 && !jsonResponse.body && !jsonResponse.items) {
        // Fallback for responses that are a single JSON object without a 'body' or 'items' wrapper
        // Or if the API returns an object where keys are timestamps/IDs and values are the data records
        const topLevelKeys = Object.keys(jsonResponse);
        let potentialDataArray = [];
        if (topLevelKeys.length > 0) {
            // Check if the first key's value is an array (e.g. { "someKey": [{...}, {...}] })
            if(Array.isArray(jsonResponse[topLevelKeys[0]])) {
                potentialDataArray = jsonResponse[topLevelKeys[0]];
            } 
            // Check if all values are objects (e.g. { "ts1": {...}, "ts2": {...} })
            else if (Object.values(jsonResponse).every(v => typeof v === 'object' && v !== null && !Array.isArray(v))) {
                 potentialDataArray = Object.values(jsonResponse);
            }
            // If it's a single record not in an array
            else if (Object.values(jsonResponse).every(v => typeof v !== 'object')) {
                 potentialDataArray = [jsonResponse];
            }
        }
        if (potentialDataArray.length > 0) {
            return { data: potentialDataArray };
        }
        return { error: 'No data array found in API response, or format is unexpected.', details: resultText };
      }
      else {
        return { error: 'No data found or unexpected format in API response.', details: resultText };
      }
    } else {
      // Log the error and return it for the client-side to display
      let errorDetails = resultText;
      try {
        const errorJson = JSON.parse(resultText);
        errorDetails = errorJson.message || resultText; // RapidAPI often has a 'message' field in errors
      } catch (e) {
        // resultText is not JSON, use as is
      }
      Logger.log(`API Error: ${responseCode} - ${errorDetails}`);
      return { error: `API Error: ${responseCode}`, details: errorDetails };
    }
  } catch (e) {
    Logger.log(`Error in fetchStockData: ${e.toString()}`);
    return { error: `Script Error: ${e.toString()}` };
  }
}

/**
 * Writes the fetched data to the active Google Sheet.
 *
 * @param {Array<Object>} dataToWrite An array of objects, where each object represents a row.
 * @return {string} A success or error message.
 */
function writeDataToSheet(dataToWrite) {
  if (!dataToWrite || dataToWrite.length === 0) {
    Logger.log('writeDataToSheet: No data provided.');
    return 'No data provided to write.';
  }

  // Ensure dataToWrite is an array of objects
  if (!Array.isArray(dataToWrite) || typeof dataToWrite[0] !== 'object' || dataToWrite[0] === null) {
    Logger.log('writeDataToSheet: Data is not in expected format (array of objects). Data: ' + JSON.stringify(dataToWrite));
    return 'Error: Data is not in the expected format (array of objects). Cannot write to sheet.';
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clearContents(); // Clear existing data

    // Dynamically create header row from keys of the first object
    const header = Object.keys(dataToWrite[0]);
    
    // Map array of objects to 2D array for setValues()
    const dataRows = dataToWrite.map(rowObject => {
      return header.map(colName => {
        const val = rowObject[colName];
        // If a value is an object or array, stringify it to fit in a cell
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return val;
      });
    });

    // Write header
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    // Write data rows
    sheet.getRange(2, 1, dataRows.length, header.length).setValues(dataRows);

    Logger.log(`Successfully wrote ${dataRows.length} rows to the sheet.`);
    return `Successfully wrote ${dataRows.length} rows and ${header.length} columns to the sheet.`;
  } catch (e) {
    Logger.log(`Error in writeDataToSheet: ${e.toString()}. Data sample: ${JSON.stringify(dataToWrite[0])}`);
    return `Error writing to sheet: ${e.toString()}`;
  }
}
