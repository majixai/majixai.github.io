/**
 * Simple Calculator Webhook Handler
 * 
 * This Google Apps Script provides a webhook endpoint to receive
 * calculation data from the Simple Calculator web app and log it
 * to a Google Sheet.
 * 
 * Setup:
 * 1. Open Google Sheets and create a new spreadsheet
 * 2. Go to Extensions > Apps Script
 * 3. Copy this code into the script editor
 * 4. Deploy as a web app:
 *    - Click "Deploy" > "New deployment"
 *    - Select type: "Web app"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 5. Copy the web app URL and paste it into the Simple Calculator app
 */

/**
 * Serves the documentation page for GET requests.
 * @return {HtmlService.HtmlOutput} The HTML output to be rendered.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Simple Calculator Webhook');
}

/**
 * Handles POST requests from the Simple Calculator web app.
 * Logs the calculation data to the active spreadsheet.
 * 
 * @param {Object} e The event parameter for a POST request.
 * @return {ContentService.TextOutput} A JSON response.
 */
function doPost(e) {
  try {
    // Parse the incoming JSON payload
    const data = JSON.parse(e.postData.contents);
    
    // Validate required fields
    if (data.num1 === undefined || data.num2 === undefined || data.result === undefined) {
      return createJsonResponse({
        success: false,
        error: 'Missing required fields: num1, num2, result'
      });
    }
    
    // Log to the spreadsheet
    const logResult = logCalculation(data);
    
    if (!logResult.success) {
      return createJsonResponse({
        success: false,
        error: logResult.error
      });
    }
    
    // Return success response
    return createJsonResponse({
      success: true,
      message: 'Calculation logged successfully',
      row: logResult.row,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: 'Invalid request: ' + error.message
    });
  }
}

/**
 * Logs the calculation data to the active spreadsheet.
 * Creates headers if the sheet is empty.
 * 
 * @param {Object} data The calculation data to log.
 * @return {Object} Result object with success status.
 */
function logCalculation(data) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName('Calculations');
    
    // Create the sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Calculations');
      // Add headers
      sheet.getRange('A1:G1').setValues([[
        'Timestamp',
        'Number 1',
        'Number 2',
        'Operation',
        'Result',
        'Source',
        'Client Timestamp'
      ]]);
      sheet.getRange('A1:G1').setFontWeight('bold');
    }
    
    // Get the next empty row
    const lastRow = sheet.getLastRow();
    const newRow = lastRow + 1;
    
    // Append the calculation data
    sheet.getRange(newRow, 1, 1, 7).setValues([[
      new Date().toISOString(),
      data.num1,
      data.num2,
      data.operation || 'addition',
      data.result,
      data.source || 'unknown',
      data.timestamp || ''
    ]]);
    
    return { success: true, row: newRow };
    
  } catch (error) {
    return { success: false, error: error.message };
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
 * Test function to verify the logCalculation function works.
 * Run this from the Apps Script editor to test.
 */
function testLogCalculation() {
  const testData = {
    num1: 42,
    num2: 58,
    operation: 'addition',
    result: 100,
    source: 'test',
    timestamp: new Date().toISOString()
  };
  
  const result = logCalculation(testData);
  Logger.log('Test result: ' + JSON.stringify(result));
}
