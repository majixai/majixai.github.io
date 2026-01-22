/**
 * YFinance Data Fetcher with GenAI Price Predictions
 * Google Apps Script Main File
 */

// Configuration
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
const PYTHON_BACKEND_URL = SCRIPT_PROPERTIES.getProperty('PYTHON_BACKEND_URL') || 'YOUR_BACKEND_URL';
const DRIVE_FOLDER_ID = SCRIPT_PROPERTIES.getProperty('DRIVE_FOLDER_ID') || 'YOUR_FOLDER_ID';

/**
 * Creates custom menu on spreadsheet open
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('YFinance Predictor')
    .addItem('📊 Show Sidebar', 'showSidebar')
    .addItem('📚 Instructions', 'showInstructions')
    .addSeparator()
    .addItem('🔄 Fetch All Data', 'fetchAllTickerData')
    .addItem('📈 Generate Report', 'generateReport')
    .addSeparator()
    .addItem('⚙️ Configure Settings', 'showConfigDialog')
    .addItem('🔗 Sync with Git', 'syncWithGit')
    .addToUi();
}

/**
 * Shows the sidebar for ticker input and predictions
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('finSidebar')
    .setTitle('YFinance Predictor')
    .setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Git Webhook Handler - POST endpoint
 * Automatically triggered when git pushes occur
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const event = e.parameter.event || 'push';
    
    // Log webhook event
    logWebhookEvent(payload, event);
    
    // Handle different git events
    switch(event) {
      case 'push':
        handleGitPush(payload);
        break;
      case 'pull_request':
        handlePullRequest(payload);
        break;
      default:
        Logger.log('Unhandled event: ' + event);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Webhook processed',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Webhook error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Git Webhook Handler - GET endpoint (for verification)
 */
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'health') {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return HtmlService.createHtmlOutput('<h1>YFinance Predictor API</h1><p>Use POST for webhook events</p>');
}

/**
 * Handle git push events
 */
function handleGitPush(payload) {
  const commits = payload.commits || [];
  const branch = payload.ref ? payload.ref.split('/').pop() : 'unknown';
  
  Logger.log(`Git push detected on branch: ${branch}`);
  Logger.log(`Commits: ${commits.length}`);
  
  // Trigger data refresh if specific files changed
  const changedFiles = commits.flatMap(c => [...(c.added || []), ...(c.modified || [])]);
  if (changedFiles.some(f => f.includes('.py') || f.includes('requirements.txt'))) {
    Logger.log('Python files changed, triggering data refresh');
    refreshAllData();
  }
}

/**
 * Handle pull request events
 */
function handlePullRequest(payload) {
  const action = payload.action;
  const prNumber = payload.pull_request ? payload.pull_request.number : 'unknown';
  Logger.log(`Pull request ${action}: #${prNumber}`);
}

/**
 * Log webhook events to a sheet
 */
function logWebhookEvent(payload, event) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName('Webhook_Log');
  
  if (!logSheet) {
    logSheet = ss.insertSheet('Webhook_Log');
    logSheet.appendRow(['Timestamp', 'Event', 'Repository', 'Branch', 'Commits', 'Author']);
  }
  
  const timestamp = new Date();
  const repo = payload.repository ? payload.repository.full_name : 'N/A';
  const branch = payload.ref ? payload.ref.split('/').pop() : 'N/A';
  const commits = payload.commits ? payload.commits.length : 0;
  const author = payload.pusher ? payload.pusher.name : 'N/A';
  
  logSheet.appendRow([timestamp, event, repo, branch, commits, author]);
}

/**
 * Fetch ticker data from Python backend
 */
function fetchTickerData(ticker, period = '1mo', interval = '1d') {
  try {
    const url = `${PYTHON_BACKEND_URL}/api/fetch`;
    const payload = {
      ticker: ticker,
      period: period,
      interval: interval
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    if (data.status === 'success') {
      // Store in compressed format
      storeCompressedData(ticker, data.data);
      return data.data;
    } else {
      throw new Error(data.message || 'Failed to fetch data');
    }
    
  } catch (error) {
    Logger.log(`Error fetching ${ticker}: ${error.toString()}`);
    throw error;
  }
}

/**
 * Get GenAI price prediction
 */
function getPricePrediction(ticker, historicalData = null) {
  try {
    const url = `${PYTHON_BACKEND_URL}/api/predict`;
    const payload = {
      ticker: ticker,
      data: historicalData
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    return result;
    
  } catch (error) {
    Logger.log(`Error getting prediction for ${ticker}: ${error.toString()}`);
    throw error;
  }
}

/**
 * Store compressed data in Google Drive
 */
function storeCompressedData(ticker, data) {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const filename = `${ticker}_${new Date().getTime()}.json.gz`;
    
    // Compress data using Utilities.gzip (if available) or base64 encoding
    const jsonString = JSON.stringify(data);
    const compressed = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(jsonString)));
    
    // Check if file exists and update or create new
    const files = folder.getFilesByName(filename);
    if (files.hasNext()) {
      const file = files.next();
      file.setContent(compressed);
    } else {
      folder.createFile(filename, compressed);
    }
    
    Logger.log(`Stored compressed data for ${ticker}`);
    return filename;
    
  } catch (error) {
    Logger.log(`Error storing compressed data: ${error.toString()}`);
    // Fallback: store uncompressed
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const filename = `${ticker}_${new Date().getTime()}.json`;
    folder.createFile(filename, JSON.stringify(data));
  }
}

/**
 * Load compressed data from Google Drive
 */
function loadCompressedData(ticker) {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const files = folder.searchFiles(`title contains "${ticker}_" and title contains ".json"`);
    
    const fileList = [];
    while (files.hasNext()) {
      const file = files.next();
      fileList.push({
        name: file.getName(),
        date: file.getLastUpdated(),
        file: file
      });
    }
    
    if (fileList.length === 0) {
      return null;
    }
    
    // Get most recent file
    fileList.sort((a, b) => b.date - a.date);
    const latestFile = fileList[0].file;
    
    // Decompress if .gz extension
    const content = latestFile.getBlob().getDataAsString();
    if (latestFile.getName().endsWith('.gz')) {
      const decompressed = Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(content)));
      return JSON.parse(decompressed.getDataAsString());
    } else {
      return JSON.parse(content);
    }
    
  } catch (error) {
    Logger.log(`Error loading compressed data: ${error.toString()}`);
    return null;
  }
}

/**
 * Fetch data for multiple tickers
 */
function fetchAllTickerData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let tickerSheet = ss.getSheetByName('Tickers');
  
  if (!tickerSheet) {
    tickerSheet = ss.insertSheet('Tickers');
    tickerSheet.appendRow(['Ticker', 'Name', 'Last Updated', 'Current Price', 'Predicted Price', 'Confidence']);
    tickerSheet.appendRow(['SPY', 'S&P 500 ETF', '', '', '', '']);
    tickerSheet.appendRow(['^GSPC', 'S&P 500 Index', '', '', '', '']);
    tickerSheet.appendRow(['^DJI', 'Dow Jones', '', '', '', '']);
    tickerSheet.appendRow(['^IXIC', 'NASDAQ', '', '', '', '']);
  }
  
  const data = tickerSheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    const ticker = data[i][0];
    if (ticker) {
      try {
        SpreadsheetApp.getActiveSpreadsheet().toast(`Fetching ${ticker}...`, 'Progress', -1);
        
        // Fetch data
        const tickerData = fetchTickerData(ticker);
        
        // Get prediction
        const prediction = getPricePrediction(ticker, tickerData);
        
        // Update sheet
        tickerSheet.getRange(i + 1, 3).setValue(new Date()); // Last Updated
        if (tickerData.current_price) {
          tickerSheet.getRange(i + 1, 4).setValue(tickerData.current_price); // Current Price
        }
        if (prediction.predicted_price) {
          tickerSheet.getRange(i + 1, 5).setValue(prediction.predicted_price); // Predicted Price
          tickerSheet.getRange(i + 1, 6).setValue(prediction.confidence || 'N/A'); // Confidence
        }
        
      } catch (error) {
        Logger.log(`Error processing ${ticker}: ${error.toString()}`);
        tickerSheet.getRange(i + 1, 3).setValue('Error: ' + error.toString());
      }
    }
  }
  
  SpreadsheetApp.getActiveSpreadsheet().toast('All data fetched!', 'Complete', 3);
}

/**
 * Refresh all data (triggered by git webhook)
 */
function refreshAllData() {
  Logger.log('Refreshing all data...');
  fetchAllTickerData();
}

/**
 * Generate comprehensive report
 */
function generateReport() {
  try {
    const url = `${PYTHON_BACKEND_URL}/api/generate_report`;
    
    // Get all ticker data
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tickerSheet = ss.getSheetByName('Tickers');
    const data = tickerSheet.getDataRange().getValues();
    
    const tickers = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        tickers.push(data[i][0]);
      }
    }
    
    const payload = {
      tickers: tickers
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.status === 'success') {
      // Create report sheet
      let reportSheet = ss.getSheetByName('Report');
      if (reportSheet) {
        ss.deleteSheet(reportSheet);
      }
      reportSheet = ss.insertSheet('Report');
      
      // Add report content
      reportSheet.appendRow(['Market Analysis Report']);
      reportSheet.appendRow(['Generated: ' + new Date().toLocaleString()]);
      reportSheet.appendRow([]);
      reportSheet.appendRow(['Ticker', 'Current Price', 'Predicted Price', 'Change %', 'Recommendation']);
      
      result.report_data.forEach(item => {
        reportSheet.appendRow([
          item.ticker,
          item.current_price,
          item.predicted_price,
          item.change_percent,
          item.recommendation
        ]);
      });
      
      SpreadsheetApp.getActiveSpreadsheet().toast('Report generated!', 'Success', 3);
      ss.setActiveSheet(reportSheet);
    }
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error generating report: ' + error.toString());
  }
}

/**
 * Show configuration dialog
 */
function showConfigDialog() {
  const html = HtmlService.createHtmlOutputFromFile('Config')
    .setWidth(450)
    .setHeight(350);
  SpreadsheetApp.getUi().showModalDialog(html, '⚙️ Configuration');
}

/**
 * Show instructions modal
 */
function showInstructions() {
  const html = HtmlService.createHtmlOutputFromFile('Instructions')
    .setWidth(700)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, '📚 How to Use YFinance Predictor');
}

/**
 * Save configuration
 */
function saveConfig(backendUrl, folderId) {
  SCRIPT_PROPERTIES.setProperty('PYTHON_BACKEND_URL', backendUrl);
  SCRIPT_PROPERTIES.setProperty('DRIVE_FOLDER_ID', folderId);
  return { status: 'success' };
}

/**
 * Get current configuration
 */
function getConfig() {
  return {
    backendUrl: SCRIPT_PROPERTIES.getProperty('PYTHON_BACKEND_URL') || '',
    folderId: SCRIPT_PROPERTIES.getProperty('DRIVE_FOLDER_ID') || ''
  };
}

/**
 * Sync with Git repository
 */
function syncWithGit() {
  SpreadsheetApp.getActiveSpreadsheet().toast('Syncing with Git...', 'Sync', -1);
  refreshAllData();
  SpreadsheetApp.getActiveSpreadsheet().toast('Sync complete!', 'Success', 3);
}
