function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function getCommentary(event) {
  const cache = CacheService.getScriptCache();
  const lastCall = cache.get('lastCall');
  const now = new Date().getTime();

  if (lastCall && now - lastCall < 5000) { // 5 seconds
    return "Commentary is cooling down...";
  }

  cache.put('lastCall', now, 60); // Cache for 60 seconds

  const apiKey = "YOUR_API_KEY"; // Replace with your actual API key
  const prompt = `Generate a short, exciting play-by-play commentary for a football game. The event is: ${event}`;

  const response = UrlFetchApp.fetch("https://api.generativeai.com/v1/commentary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    payload: JSON.stringify({
      prompt: prompt,
      max_tokens: 50,
    }),
  });

  const data = JSON.parse(response.getContentText());
  return data.choices[0].text.trim();
}

// Main Google Apps Script file
function onOpen() {
  // Placeholder for onOpen trigger, can be used to add custom menus to Google Workspace docs
  SpreadsheetApp.getUi().createMenu('Custom Ticker Menu')
      .addItem('Fetch Ticker Data', 'showSidebar')
      .addToUi();
}

function showSidebar() {
  // Placeholder for showing a sidebar, potentially to trigger data fetching
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
      .setTitle('Ticker Data Fetcher');
  SpreadsheetApp.getUi().showSidebar(html);
}

// Include DataFetcher.gs (though Apps Script doesn't use explicit includes like this,
// it implies functions from DataFetcher.gs will be available in the same project)

// Google Apps Script functions for fetching data and creating CSV

/**
 * Fetches data from the specified URL, parses it, and prepares it for CSV.
 *
 * NOTE: The implementation of this function is PENDING.
 * Access to the URL (https://aistudio.google.com/app/prompts?state=...)
 * is required to understand the data structure and how to parse ticker information.
 * Please provide sample data or describe the data format to complete this function.
 */
function getTickerDataAndCreateCSV() {
  // 1. Fetch data from the URL (e.g., using UrlFetchApp.fetch())
  //    var url = "THE_AI_STUDIO_URL_HERE";
  //    var response = UrlFetchApp.fetch(url, { /* headers if needed, e.g., for authorization */ });
  //    var content = response.getContentText();

  // 2. Parse the content to extract ticker data.
  //    This depends heavily on the format of the data (JSON, HTML, plain text, etc.)
  //    var tickers = parseTickerData(content); // Placeholder for parsing logic

  // 3. Format data as CSV.
  //    var csvData = convertToCsv(tickers); // Placeholder for CSV conversion

  // 4. Create a CSV file in Google Drive.
  //    var fileName = "ticker_data_" + new Date().toISOString().slice(0,10) + ".csv";
  //    DriveApp.createFile(fileName, csvData, MimeType.CSV);

  // For now, log a message
  Logger.log("getTickerDataAndCreateCSV function called, but not fully implemented due to pending data source details.");
  return "Function called, but not fully implemented. See logs for details.";
}

/**
 * Placeholder for parsing ticker data from fetched content.
 * @param {string} content The raw content fetched from the URL.
 * @return {Array<Object>} An array of objects, where each object represents a ticker and its data.
 */
function parseTickerData(content) {
  // Implementation depends on actual data structure
  Logger.log("parseTickerData called. Raw content length: " + (content ? content.length : 0));
  // Example structure (to be replaced):
  // return [{ticker: "EXAMPLE", price: 100}, {ticker: "SAMPLE", price: 200}];
  return [];
}

/**
 * Placeholder for converting an array of ticker objects to CSV format.
 * @param {Array<Object>} data An array of ticker data objects.
 * @return {string} A string in CSV format.
 */
function convertToCsv(data) {
  if (!data || data.length === 0) {
    return "Ticker,Price
NO_DATA,0"; // Default CSV if no data
  }
  var csvContent = "";
  // Add headers - assuming keys of the first object are headers
  var headers = Object.keys(data[0]);
  csvContent += headers.join(",") + "\n";

  // Add rows
  data.forEach(function(rowObject) {
    var row = headers.map(function(header) {
      return rowObject[header];
    });
    csvContent += row.join(",") + "\n";
  });
  Logger.log("convertToCsv called. CSV content generated (first 100 chars): " + csvContent.substring(0,100));
  return csvContent;
}

function getGameUpdate(event, details) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `lastCall_${event}`;
  const lastCall = cache.get(cacheKey);
  const now = new Date().getTime();

  let cooldown = 5000; // Default 5 seconds
  if (event === 'touchdown') {
    cooldown = 10000; // 10 seconds for touchdowns
  }

  if (lastCall && now - lastCall < cooldown) {
    return { commentary: `Commentary for ${event} is cooling down...` };
  }

  cache.put(cacheKey, now, 60); // Cache for 60 seconds

  const apiKey = "YOUR_API_KEY"; // Replace with your actual API key
  let prompt;

  switch (event) {
    case 'update':
      prompt = `You are a football game AI. Generate challenging and realistic opponent behavior and play outcomes based on the following details: ${details}. Respond in JSON format with the following keys: 'opponentBehavior', 'playOutcome', 'commentary'.`;
      break;
    case 'play-analysis':
      prompt = `You are a football analyst. Provide a detailed analysis of the following play: ${details}.`;
      break;
    default:
      prompt = `Generate a play-by-play commentary for the following event: ${event}. Details: ${details}`;
  }

  const response = UrlFetchApp.fetch("https://api.generativeai.com/v1/game", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    payload: JSON.stringify({
      prompt: prompt,
      max_tokens: 500,
    }),
  });

  const data = JSON.parse(response.getContentText());
  return JSON.parse(data.choices[0].text.trim());
}
