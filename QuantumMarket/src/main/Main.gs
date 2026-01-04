/**
 * ==========================================================================
 * FILE: Main.gs
 * DESCRIPTION: Main controller, menu initialization, and trigger entry points.
 *              This file orchestrates the entire application, delegating tasks
 *              to the various specialized services.
 * ==========================================================================
 */

/**
 * --------------------------------------------------------------------------
 * MENU & INITIALIZATION
 * --------------------------------------------------------------------------
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚡ Quantum Market Pro')
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

/**
 * --------------------------------------------------------------------------
 * CORE TRIGGER FUNCTIONS (GLOBAL SCOPE)
 * --------------------------------------------------------------------------
 */

/**
 * TRIGGER: minutelyHeartbeat
 * Executes the Fetch -> Math -> AI -> Storage cycle.
 */
function minutelyHeartbeat() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return; // Fail fast if clogged

  try {
    // 1. Fetch Cycle
    const liveData = Service_Data.fetchWatchlist();
    if (!liveData || liveData.length === 0) return;

    // 2. Math Cycle
    const projectedData = Service_Quant.runMonteCarloSimulation(liveData);
    const correctedData = Service_Quant.performErrorAnalysis(projectedData);

    // 3. AI Cycle (every 15 mins to save quota)
    if (new Date().getMinutes() % 15 === 0) {
      Service_AI.updateBullsSuggestions(correctedData);
    }

    // 4. Persistence & Alerting Cycle
    Service_Data.snapshotToDrive(correctedData);
    Service_Data.updateSheet(correctedData);
    System_Alerts.checkBullishAlerts(correctedData);

  } catch (e) {
    System_Logger.log("minutelyHeartbeat", e.stack || e.toString(), true);
  } finally {
    lock.releaseLock();
  }
}

/**
 * TRIGGER: runDailyPredictionRoutine
 * Runs the AI Oracle to predict daily market moves.
 */
function runDailyPredictionRoutine() {
  Service_Oracle.runDailyPredictionRoutine();
}

/**
 * TRIGGER: generateMassiveDataEmail
 * Hooks into the Email Data Loop to broadcast a market snapshot.
 */
function generateMassiveDataEmail() {
  Email_Broadcast.broadcastMarketSnapshot();
}

/**
 * TRIGGER: processEmailIntel
 * Hooks into the Email Data Loop to ingest and process a market snapshot.
 */
function processEmailIntel() {
  Email_Ingest.ingestEmailData();
}

/**
 * --------------------------------------------------------------------------
 * HTML SERVICE WRAPPERS
 * --------------------------------------------------------------------------
 */
function showSettings() {
  const html = HtmlService.createTemplateFromFile('ui/Settings').evaluate().setWidth(500).setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(html, 'System Configuration');
}

function showSidebar() {
  const html = HtmlService.createTemplateFromFile('ui/index').evaluate().setTitle('Market Control').setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showHelp() {
  const html = HtmlService.createTemplateFromFile('ui/Help').evaluate().setWidth(600).setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Guide');
}

function doGet(e) {
  return HtmlService.createTemplateFromFile('ui/index').evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
