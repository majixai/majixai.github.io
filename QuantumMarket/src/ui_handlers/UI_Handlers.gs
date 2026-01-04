/**
 * ==========================================================================
 * FILE: UI_Handlers.gs
 * DESCRIPTION: Provides a clean interface between the HTML UI (client-side)
 *              and the backend services. All functions in this file are
 *              intended to be called directly from UI via google.script.run.
 * ==========================================================================
 */

// --- CONFIG & LOGS ---

function getStoredSettings() {
  return System_Config.getAllSettings();
}

function saveSettings(formObject) {
  return System_Config.saveAllSettings(formObject);
}

function getRecentLogs() {
  return System_Logger.getLogs();
}

function clearRecentLogs() {
  System_Logger.clearLogs();
  return "Logs cleared.";
}

// --- DASHBOARD DATA ---

/**
 * Fetches and formats data for the main dashboard display.
 */
function getDashboardData() {
  try {
    const data = Service_Data.getSheetData('Watchlist');
    if (!data || data.length === 0) return [];

    // Format the raw sheet data into a more UI-friendly object array
    return data.map(r => ({
      ticker: r[0],
      exchange: r[1],
      price: r[2],
      projected: r[3],
      sigma: r[4],
      error: r[5],
      updated: r[6],
      url: (r[1] === 'CRYPTO' || r[0].includes('-'))
           ? `https://www.google.com/finance/quote/${r[0]}`
           : `https://www.google.com/finance/quote/${r[0]}:${r[1]}`
    })).filter(item => item.ticker && item.ticker !== "");
  } catch (e) {
    System_Logger.log("GetDashboardData", e.message, true);
    return []; // Return empty array on failure
  }
}

// --- WATCHLIST MANAGEMENT ---

function addTicker(ticker, exchange) {
  try {
    if (!ticker || !exchange) return "Error: Missing Input";
    return Service_Data.addTicker(ticker, exchange);
  } catch (e) {
    System_Logger.log("AddTicker", e.toString(), true);
    return "Error: " + e.message;
  }
}

function promptForWatchlist() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('AI Market Aggregator', 'Enter a theme for the AI to build a watchlist around (e.g., "AI Stocks", "DeFi Crypto", "Semiconductor Companies"):', ui.ButtonSet.OK_CANCEL);

  if (resp.getSelectedButton() == ui.Button.OK) {
    try {
      const theme = resp.getResponseText();
      if (!theme) return;

      ui.alert("Request sent to the AI Oracle. This may take a moment. You will be notified upon completion.");
      const result = Service_AI.generateNewWatchlist(theme);
      ui.alert(result);

    } catch(e) {
      System_Logger.log("AI-Prompt", e.toString(), true);
      ui.alert("An error occurred: " + e.message);
    }
  }
}
