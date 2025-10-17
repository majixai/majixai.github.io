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
 * Writes the fetched data to the active Google Sheet with a specific column order:
 * A: Date, B: Open, C: High, D: Low, E: Close, F: Volume.
 *
 * @param {Array<Object>} dataToWrite An array of objects from the API.
 *                                   Each object is assumed to have fields like 'timestamp', 'open', 'high', 'low', 'close', 'volume'.
 *                                   IMPORTANT: User might need to adjust these field names based on actual API response.
 * @return {string} A success or error message.
 */
function writeDataToSheet(dataToWrite) {
  if (!dataToWrite || dataToWrite.length === 0) {
    Logger.log('writeDataToSheet: No data provided.');
    return 'No data provided to write.';
  }

  if (!Array.isArray(dataToWrite) || typeof dataToWrite[0] !== 'object' || dataToWrite[0] === null) {
    Logger.log('writeDataToSheet: Data is not in expected format (array of objects). Data: ' + JSON.stringify(dataToWrite));
    return 'Error: Data is not in the expected format (array of objects). Cannot write to sheet.';
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clearContents(); // Clear existing data

    // Define the fixed header row
    const header = ["Date", "Open", "High", "Low", "Close", "Volume"];
    
    // --- Assumed API field names ---
    // IMPORTANT FOR USER: Adjust these field names if your API response uses different keys!
    const fieldMap = {
      date: 'timestamp', // Source field for Date (will be formatted)
      open: 'open',      // Source field for Open
      high: 'high',      // Source field for High
      low: 'low',        // Source field for Low
      close: 'close',    // Source field for Close
      volume: 'volume'   // Source field for Volume
    };
    // --- End of Assumed API field names ---

    const dataRows = dataToWrite.map(apiRowObject => {
      let dateValue;
      const timestamp = apiRowObject[fieldMap.date];

      if (timestamp === undefined || timestamp === null) {
        dateValue = "N/A";
      } else if (typeof timestamp === 'number') {
        // Assuming timestamp is in seconds or milliseconds.
        // If it's like 1678886400 (seconds) or 1678886400000 (milliseconds)
        const dateObj = new Date(timestamp * (timestamp.toString().length === 10 ? 1000 : 1));
        dateValue = Utilities.formatDate(dateObj, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");
      } else if (typeof timestamp === 'string') {
        // If it's already a date string, try to parse it to ensure it's valid, then reformat.
        // This also handles ISO strings directly.
        try {
          const dateObj = new Date(timestamp);
          if (!isNaN(dateObj.getTime())) { // Check if date is valid
             dateValue = Utilities.formatDate(dateObj, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");
          } else {
            dateValue = timestamp; // Use as is if parsing fails but it's a string
          }
        } catch (e) {
          dateValue = timestamp; // Fallback to original string value if Date parsing throws error
        }
      } else {
        dateValue = String(timestamp); // Fallback for other types
      }
      
      return [
        dateValue,
        apiRowObject[fieldMap.open] !== undefined ? apiRowObject[fieldMap.open] : "N/A",
        apiRowObject[fieldMap.high] !== undefined ? apiRowObject[fieldMap.high] : "N/A",
        apiRowObject[fieldMap.low] !== undefined ? apiRowObject[fieldMap.low] : "N/A",
        apiRowObject[fieldMap.close] !== undefined ? apiRowObject[fieldMap.close] : "N/A",
        apiRowObject[fieldMap.volume] !== undefined ? apiRowObject[fieldMap.volume] : "N/A"
      ];
    });

    // Write header
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    // Write data rows
    if (dataRows.length > 0) {
      sheet.getRange(2, 1, dataRows.length, header.length).setValues(dataRows);
    }

    Logger.log(`Successfully wrote ${dataRows.length} rows with fixed column mapping.`);
    return `Successfully wrote ${dataRows.length} rows and ${header.length} columns (Date, Open, High, Low, Close, Volume) to the sheet.`;
  } catch (e) {
    Logger.log(`Error in writeDataToSheet: ${e.toString()}. Data sample: ${dataToWrite.length > 0 ? JSON.stringify(dataToWrite[0]) : 'N/A'}`);
    return `Error writing to sheet with fixed mapping: ${e.toString()}`;
  }
}

// --- Settings Management Functions ---

/**
 * Saves the Calendar ID to user properties.
 * @param {string} calendarId The ID of the calendar to save.
 * @return {object} An object indicating success or failure.
 */
function saveCalendarId(calendarId) {
  try {
    if (!calendarId || typeof calendarId !== 'string' || calendarId.trim() === '') {
      throw new Error('Calendar ID cannot be empty.');
    }
    PropertiesService.getUserProperties().setProperty('calendarId', calendarId);
    Logger.log('Calendar ID saved: ' + calendarId);
    return { success: true, message: 'Calendar ID updated successfully.' };
  } catch (e) {
    Logger.log('Error saving Calendar ID: ' + e.message);
    return { success: false, message: 'Error saving Calendar ID: ' + e.message };
  }
}

/**
 * Retrieves the saved Calendar ID from user properties.
 * @return {object} An object containing the calendarId or an error.
 */
function getCalendarIdConfig() {
  try {
    const calendarId = PropertiesService.getUserProperties().getProperty('calendarId');
    if (calendarId) {
      return { success: true, calendarId: calendarId };
    } else {
      return { success: false, message: 'Calendar ID not found.' };
    }
  } catch (e) {
    Logger.log('Error retrieving Calendar ID: ' + e.message);
    return { success: false, message: 'Error retrieving Calendar ID: ' + e.message };
  }
}

/**
 * Saves the Drive Folder ID to user properties.
 * @param {string} driveFolderId The ID of the Drive folder to save.
 * @return {object} An object indicating success or failure.
 */
function saveDriveFolderId(driveFolderId) {
  try {
    if (!driveFolderId || typeof driveFolderId !== 'string' || driveFolderId.trim() === '') {
      throw new Error('Drive Folder ID cannot be empty.');
    }
    PropertiesService.getUserProperties().setProperty('driveFolderId', driveFolderId);
    Logger.log('Drive Folder ID saved: ' + driveFolderId);
    return { success: true, message: 'Drive Folder ID updated successfully.' };
  } catch (e) {
    Logger.log('Error saving Drive Folder ID: ' + e.message);
    return { success: false, message: 'Error saving Drive Folder ID: ' + e.message };
  }
}

/**
 * Retrieves the saved Drive Folder ID from user properties.
 * @return {object} An object containing the driveFolderId or an error.
 */
function getDriveFolderIdConfig() {
  try {
    const driveFolderId = PropertiesService.getUserProperties().getProperty('driveFolderId');
    if (driveFolderId) {
      return { success: true, driveFolderId: driveFolderId };
    } else {
      return { success: false, message: 'Drive Folder ID not found.' };
    }
  } catch (e) {
    Logger.log('Error retrieving Drive Folder ID: ' + e.message);
    return { success: false, message: 'Error retrieving Drive Folder ID: ' + e.message };
  }
}

/**
 * Saves the Target Spreadsheet ID to user properties.
 * @param {string} targetSheetId The ID of the target spreadsheet to save.
 * @return {object} An object indicating success or failure.
 */
function saveTargetSheetId(targetSheetId) {
  try {
    if (!targetSheetId || typeof targetSheetId !== 'string' || targetSheetId.trim() === '') {
      throw new Error('Target Sheet ID cannot be empty.');
    }
    PropertiesService.getUserProperties().setProperty('targetSheetId', targetSheetId);
    Logger.log('Target Sheet ID saved: ' + targetSheetId);
    return { success: true, message: 'Target Spreadsheet ID updated successfully.' };
  } catch (e) {
    Logger.log('Error saving Target Sheet ID: ' + e.message);
    return { success: false, message: 'Error saving Target Sheet ID: ' + e.message };
  }
}

/**
 * Retrieves the saved Target Spreadsheet ID from user properties.
 * @return {object} An object containing the targetSheetId or an error.
 */
function getTargetSheetIdConfig() {
  try {
    const targetSheetId = PropertiesService.getUserProperties().getProperty('targetSheetId');
    if (targetSheetId) {
      return { success: true, targetSheetId: targetSheetId };
    } else {
      return { success: false, message: 'Target Sheet ID not found.' };
    }
  } catch (e) {
    Logger.log('Error retrieving Target Sheet ID: ' + e.message);
    return { success: false, message: 'Error retrieving Target Sheet ID: ' + e.message };
  }
}

/**
 * Saves all client-provided settings.
 *
 * @param {object} settings An object containing settings like calendarId, driveFolderId, targetSheetId.
 * @return {object} An object summarizing the success of each operation and an overall status.
 */
function saveAllClientSettings(settings) {
  const results = [];
  let overallSuccess = true;
  let consolidatedMessageParts = [];

  // Save Calendar ID
  if (settings && settings.hasOwnProperty('calendarId')) {
    const calendarResult = saveCalendarId(settings.calendarId);
    results.push({ setting: 'Calendar ID', success: calendarResult.success, message: calendarResult.message });
    if (!calendarResult.success) overallSuccess = false;
    consolidatedMessageParts.push(`Calendar ID: ${calendarResult.success ? 'Updated' : 'Error'}`);
  } else {
    // Handle case where calendarId might not be provided, or log if it's considered mandatory
     results.push({ setting: 'Calendar ID', success: false, message: 'Calendar ID not provided in settings.' });
     overallSuccess = false;
     consolidatedMessageParts.push('Calendar ID: Not provided');
  }

  // Save Drive Folder ID
  if (settings && settings.hasOwnProperty('driveFolderId')) {
    const driveFolderResult = saveDriveFolderId(settings.driveFolderId);
    results.push({ setting: 'Drive Folder ID', success: driveFolderResult.success, message: driveFolderResult.message });
    if (!driveFolderResult.success) overallSuccess = false;
    consolidatedMessageParts.push(`Drive Folder ID: ${driveFolderResult.success ? 'Updated' : 'Error'}`);
  } else {
     results.push({ setting: 'Drive Folder ID', success: false, message: 'Drive Folder ID not provided in settings.' });
     overallSuccess = false;
     consolidatedMessageParts.push('Drive Folder ID: Not provided');
  }

  // Save Target Sheet ID
  if (settings && settings.hasOwnProperty('targetSheetId')) {
    const sheetResult = saveTargetSheetId(settings.targetSheetId);
    results.push({ setting: 'Target Sheet ID', success: sheetResult.success, message: sheetResult.message });
    if (!sheetResult.success) overallSuccess = false;
    consolidatedMessageParts.push(`Target Sheet ID: ${sheetResult.success ? 'Updated' : 'Error'}`);
  } else {
     results.push({ setting: 'Target Sheet ID', success: false, message: 'Target Sheet ID not provided in settings.' });
     overallSuccess = false;
     consolidatedMessageParts.push('Target Sheet ID: Not provided');
  }

  return {
    overallSuccess: overallSuccess,
    results: results,
    consolidatedMessage: 'Processed all settings. ' + consolidatedMessageParts.join('. ') + '.'
  };
}
