/**
 * Handles HTTP POST requests to the web app.
 * This function acts as a webhook endpoint.
 *
 * @param {Object} e The event parameter for a POST request.
 * @return {ContentService.TextOutput} A JSON response.
 */
function doPost(e) {
  try {
    // 1. Parse the incoming JSON payload from the request body.
    const requestData = JSON.parse(e.postData.contents);
    const { fileId, logSheetId, forwardUrl } = requestData;

    // 2. Check for the required fileId parameter.
    if (!fileId) {
      return createJsonResponse({ success: false, error: 'Missing required parameter: fileId' });
    }

    // 3. Decompress the file using the provided ID.
    const result = readAndDecompressFileById(fileId);

    if (!result.success) {
      return createJsonResponse(result);
    }

    const decompressedContent = result.isJson ? JSON.stringify(result.data, null, 2) : result.data;

    // 4. Log the content to a Google Sheet if a logSheetId is provided.
    if (logSheetId) {
      logToSheet(logSheetId, fileId, decompressedContent);
    }

    // 5. Forward the content to another webhook if a forwardUrl is provided.
    if (forwardUrl) {
      forwardToWebhook(forwardUrl, { fileId: fileId, content: decompressedContent });
    }

    // 6. Return a success response with the decompressed content.
    return createJsonResponse({ success: true, fileId: fileId, content: decompressedContent });

  } catch (error) {
    // Handle JSON parsing errors or other unexpected errors.
    return createJsonResponse({ success: false, error: 'Invalid request or internal error: ' + error.message });
  }
}

/**
 * Creates a JSON response for the webhook.
 *
 * @param {Object} data The data object to be returned as JSON.
 * @return {ContentService.TextOutput} The JSON output.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Reads and decompresses a file from Google Drive by its ID.
 *
 * @param {string} fileId The ID of the file in Google Drive.
 * @return {Object} An object containing the success status and the data or an error message.
 */
function readAndDecompressFileById(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const unzippedBlob = Utilities.unzip(blob);
    const text = unzippedBlob.getDataAsString();

    // Try to parse as JSON, but return raw text if it fails.
    try {
      return { success: true, data: JSON.parse(text), isJson: true };
    } catch (e) {
      return { success: true, data: text, isJson: false };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Logs data to a specified Google Sheet.
 *
 * @param {string} sheetId The ID of the Google Sheet.
 * @param {string} fileId The ID of the processed file.
 * @param {string} content The decompressed content.
 */
function logToSheet(sheetId, fileId, content) {
  try {
    const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
    sheet.appendRow([new Date().toISOString(), fileId, content]);
  } catch (error) {
    // Log the error to the Apps Script console for debugging.
    console.error('Failed to log to sheet: ' + error.message);
  }
}

/**
 * Forwards data to another webhook URL.
 *
 * @param {string} url The URL to forward the data to.
 * @param {Object} payload The JSON payload to send.
 */
function forwardToWebhook(url, payload) {
  try {
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload)
    };
    UrlFetchApp.fetch(url, options);
  } catch (error) {
    // Log the error to the Apps Script console for debugging.
    console.error('Failed to forward webhook: ' + error.message);
  }
}
