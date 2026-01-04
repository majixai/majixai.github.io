/**
 * -------------------------------------------------------------------------
 * FILE: Code.gs
 * DESCRIPTION: Main Controller, Trigger Logic, and Logging System
 * -------------------------------------------------------------------------
 */

// --- 1. MILITARY-GRADE LOGGING SYSTEM ---

const LogSystem = {
  log: function(context, message, isError = false) {
    const timestamp = new Date();
    const entry = `[${timestamp.toLocaleTimeString()}] [${context}] ${message}`;

    console.log(entry);

    // 1. Store locally for UI "Copy Errors"
    this.saveToStorage(entry);

    // 2. Email if Critical Error (throttle to avoid spamming)
    if (isError) {
      this.sendErrorEmail(context, message);
    }
  },

  saveToStorage: function(entry) {
    try {
      const props = PropertiesService.getScriptProperties();
      // Get existing logs, keep last 50 lines
      let logs = props.getProperty('SYSTEM_LOGS');
      logs = logs ? JSON.parse(logs) : [];
      logs.unshift(entry); // Add to top
      if (logs.length > 50) logs.pop(); // Trim
      props.setProperty('SYSTEM_LOGS', JSON.stringify(logs));
    } catch(e) {
      console.error("Failed to save log to props", e);
    }
  },

  sendErrorEmail: function(context, message) {
    try {
      // Simple check to prevent email flooding (max 1 per hour per context)
      const props = PropertiesService.getScriptProperties();
      const lastEmailKey = `LAST_EMAIL_${context}`;
      const lastEmailTime = parseFloat(props.getProperty(lastEmailKey) || 0);
      const now = new Date().getTime();

      if (now - lastEmailTime > 3600000) { // 1 hour cooldown
        const email = props.getProperty('EMAIL_RECIPIENT') || Session.getActiveUser().getEmail();

        MailApp.sendEmail({
          to: email,
          subject: `🚨 JINX TICKER FAILURE: ${context}`,
          body: `Timestamp: ${new Date()}\nContext: ${context}\nError: ${message}\n\nPlease check the Settings > Debug Console.`
        });

        props.setProperty(lastEmailKey, now);
      }
    } catch(e) {
      console.error("Failed to send error email", e);
    }
  },

  getLogs: function() {
    const logs = PropertiesService.getScriptProperties().getProperty('SYSTEM_LOGS');
    return logs ? JSON.parse(logs).join('\n') : "No logs recorded yet.";
  },

  clearLogs: function() {
    PropertiesService.getScriptProperties().deleteProperty('SYSTEM_LOGS');
    return "Logs cleared.";
  }
};

// --- 2. MENU & INITIALIZATION ---

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚡ Quantum Market')
    .addItem('🚀 Launch Dashboard', 'showSidebar')
    .addItem('🧠 AI: Aggregate New Watchlist', 'promptForWatchlist')
    .addItem('⚙️ Settings & Logs', 'showSettings')
    .addItem('❓ Interactive Guide', 'showHelp')
    .addSeparator()
    .addItem('Force Market Update', 'minutelyHeartbeat')
    .addItem('Run Daily Oracle (8:50 AM)', 'runDailyPredictionRoutine')
    .addSeparator()
    .addItem('📤 Broadcast Data Shards', 'generateMassiveDataEmail')
    .addItem('📥 Process Email Intel', 'processEmailIntel')
    .addToUi();
}

// --- 3. CORE TRIGGER FUNCTION (GLOBAL SCOPE) ---

/**
 * TRIGGER: minutelyHeartbeat
 * Executes the Fetch -> Math -> AI -> Storage cycle.
 */
function minutelyHeartbeat() {
  const lock = LockService.getScriptLock();
  // Fail fast if the system is clogged (10s wait)
  if (!lock.tryLock(10000)) return;

  try {
    // 1. Validate Environment
    if (typeof DataEngine === 'undefined') throw new Error("DataEngine library missing.");
    if (typeof QuantLib === 'undefined') throw new Error("QuantLib library missing.");

    // 2. Fetch Cycle
    const liveData = DataEngine.fetchWatchlist();
    if (!liveData || liveData.length === 0) return;

    // 3. Math Cycle (SDE Projections)
    const projectedData = QuantLib.runMonteCarloSimulation(liveData);

    // 4. Learning Cycle (Error Analysis)
    const correctedData = QuantLib.performErrorAnalysis(projectedData);

    // 5. AI Cycle (Run every 15 minutes to save quota)
    if (new Date().getMinutes() % 15 === 0) {
      try {
        AIEngine.updateBullsSuggestions(correctedData);
      } catch (aiErr) {
        LogSystem.log("Heartbeat-AI", aiErr.toString(), true);
      }
    }

    // 6. Persistence Cycle
    DataEngine.snapshotToDrive(correctedData);
    DataEngine.updateSheet(correctedData);
    checkBullishAlerts(correctedData);

  } catch (e) {
    LogSystem.log("minutelyHeartbeat", e.stack || e.toString(), true);
  } finally {
    lock.releaseLock();
  }
}

function checkBullishAlerts(data) {
  const calendar = CalendarApp.getDefaultCalendar();
  const now = new Date();

  data.forEach(stock => {
    // Alert if projected return > 2% in 15 mins
    if (stock.projectedReturn > 0.02) {
      const lastAlertKey = `ALERT_${stock.ticker}`;
      const lastAlert = parseFloat(PropertiesService.getScriptProperties().getProperty(lastAlertKey) || 0);

      // Cooldown: 4 hours
      if (now.getTime() - lastAlert > 14400000) {
        try {
          calendar.createEvent(
            `🚀 BULL ALERT: ${stock.ticker}`,
            now,
            new Date(now.getTime() + 900000),
            { description: `Current: ${stock.price}\nProjected: ${stock.projected}\nSigma: ${stock.sigma}` }
          );
          PropertiesService.getScriptProperties().setProperty(lastAlertKey, now.getTime());
        } catch (calErr) {
          LogSystem.log("CalendarAlert", calErr.message, true);
        }
      }
    }
  });
}

// --- 4. BACKEND HANDLERS FOR UI ---

function getStoredSettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    GENAI_API_KEY: props.getProperty('GENAI_API_KEY') || '',
    SHEET_ID: props.getProperty('SHEET_ID') || '',
    DOC_ID: props.getProperty('DOC_ID') || '',
    EMAIL_RECIPIENT: props.getProperty('EMAIL_RECIPIENT') || Session.getActiveUser().getEmail(),
    FOLDER_NAME: props.getProperty('FOLDER_NAME') || 'MarketData_DB'
  };
}

function saveSettings(formObject) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('GENAI_API_KEY', formObject.apiKey);
    props.setProperty('SHEET_ID', formObject.sheetId);
    props.setProperty('EMAIL_RECIPIENT', formObject.email);
    props.setProperty('FOLDER_NAME', formObject.folderName);

    DataEngine.initEnvironment();
    LogSystem.log("Settings", "Configuration saved successfully.");

    return { success: true, msg: "Settings Saved & Environment Initialized." };
  } catch (e) {
    LogSystem.log("SaveSettings", e.toString(), true);
    return { success: false, msg: "Error: " + e.message };
  }
}

function getRecentLogs() {
  return LogSystem.getLogs();
}

function clearRecentLogs() {
  return LogSystem.clearLogs();
}

/**
 * SERVE DATA TO SIDEBAR
 */
function getDashboardData() {
  try {
    const ssId = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || SpreadsheetApp.getActiveSpreadsheet().getId();
    const ss = SpreadsheetApp.openById(ssId);
    const watchSheet = ss.getSheetByName('Watchlist');

    if (!watchSheet) return [];

    const data = watchSheet.getDataRange().getValues();
    const headers = data.shift(); // Remove headers

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
    LogSystem.log("GetDashboardData", e.message, true);
    return [];
  }
}

// --- 5. UI WRAPPERS & PROMPTS ---

function addTicker(ticker, exchange) {
  try {
    if (!ticker || !exchange) return "Error: Missing Input";
    return DataEngine.addTicker(ticker, exchange);
  } catch (e) {
    LogSystem.log("AddTicker", e.toString(), true);
    return "Error: " + e.message;
  }
}

function promptForWatchlist() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('AI Market Aggregator', 'Enter theme (e.g., "AI Stocks", "DeFi Crypto"):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() == ui.Button.OK) {
    try {
      const theme = resp.getResponseText();
      ui.alert("Request sent to Neural Engine. Please wait...");
      const res = AIEngine.generateNewWatchlist(theme);
      ui.alert(res);
    } catch(e) {
      LogSystem.log("AI-Prompt", e.toString(), true);
      ui.alert("Error: " + e.message);
    }
  }
}

// --- 6. EMAIL DATA LOOP HOOKS ---

function generateMassiveDataEmail() {
  try {
    EmailDataLoop.broadcastMarketSnapshot();
  } catch (e) {
    LogSystem.log("BroadcastError", e.message, true);
  }
}

function processEmailIntel() {
  try {
    EmailDataLoop.ingestEmailData();
  } catch (e) {
    LogSystem.log("IngestError", e.message, true);
  }
}

// Display HTML files
function showSettings() { SpreadsheetApp.getUi().showModalDialog(HtmlService.createTemplateFromFile('Settings').evaluate().setWidth(500).setHeight(650), 'System Configuration'); }
function showSidebar() { SpreadsheetApp.getUi().showSidebar(HtmlService.createTemplateFromFile('index').evaluate().setTitle('Market Control').setWidth(300)); }
function showHelp() { SpreadsheetApp.getUi().showModalDialog(HtmlService.createTemplateFromFile('Help').evaluate().setWidth(600).setHeight(600), 'Guide'); }
function doGet(e) { return HtmlService.createTemplateFromFile('index').evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); }
