/**
 * =================================================================
 * CONSTANTS
 * =================================================================
 */
const SETTINGS_KEY = 'APP_SETTINGS';
const SCHEDULES_KEY = 'schedules';
const GITHUB_API_URL = 'https://api.github.com';

/**
 * =================================================================
 * PRIMARY TRIGGERS (onOpen, doGet, doPost)
 * =================================================================
 */

function onOpen(e) {
  SpreadsheetApp.getUi()
      .createMenu('Jinx Finance')
      .addItem('Open Manager', 'showSidebar')
      .addToUi();
}

/**
 * Handles GET requests to the web app, acting as a URL router.
 * @param {Object} e The event object from the GET request.
 * @returns {HtmlOutput} The HTML page to serve.
 */
function doGet(e) {
  const page = e.parameter.page;
  if (page === 'email') {
    return HtmlService.createHtmlOutputFromFile('Email').setTitle("Jinx Finance - Send Email");
  }
  // Default to the main dashboard
  return HtmlService.createHtmlOutputFromFile('Index').setTitle("Jinx Finance - Alert Dashboard");
}

/**
 * Handles POST requests, serving as the webhook receiver.
 * @param {Object} e The event object from the POST request.
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    console.log("Webhook received: " + JSON.stringify(payload, null, 2));

    const githubResult = gitHub_createFile(payload);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', githubResponse: githubResult }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error("doPost Error: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * =================================================================
 * UI & SIDEBAR FUNCTIONS
 * =================================================================
 */

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Jinx Finance Manager');
  SpreadsheetApp.getUi().showSidebar(html);
}

function getServerTimezone() {
  return Session.getScriptTimeZone();
}

/**
 * =================================================================
 * SETTINGS MANAGEMENT FUNCTIONS
 * =================================================================
 */

function saveSettings(settings) {
  try {
    const currentSettings = getSettings() || {};
    // Retain existing passwords if new ones are not provided
    const newSettings = {
      githubPat: settings.githubPat || currentSettings.githubPat,
      githubRepo: settings.githubRepo || currentSettings.githubRepo,
      fmpApiKey: settings.fmpApiKey || currentSettings.fmpApiKey,
      geminiApiKey: settings.geminiApiKey || currentSettings.geminiApiKey,
    };
    PropertiesService.getScriptProperties().setProperty(SETTINGS_KEY, JSON.stringify(newSettings));
    return { success: true, message: 'Settings saved.' };
  } catch (e) {
    console.error("saveSettings Error: " + e.toString());
    return { success: false, message: 'Failed to save settings.' };
  }
}

function getSettings() {
  try {
    const settingsJson = PropertiesService.getScriptProperties().getProperty(SETTINGS_KEY);
    return settingsJson ? JSON.parse(settingsJson) : null;
  } catch (e) {
    console.error("getSettings Error: " + e.toString());
    return null;
  }
}

// Exposed to client, but only returns non-sensitive info
function getClientSettings() {
  const settings = getSettings();
  return settings ? { githubRepo: settings.githubRepo } : null;
}

function checkApiKeys() {
  const settings = getSettings();
  return !!(settings && settings.fmpApiKey && settings.geminiApiKey);
}

/**
 * =================================================================
 * GITHUB INTEGRATION FUNCTIONS
 * =================================================================
 */

function gitHub_createFile(payload) {
  const settings = getSettings();
  if (!settings || !settings.githubPat || !settings.githubRepo) {
    throw new Error("GitHub PAT and Repo not configured in Settings.");
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const path = `tradingview-alerts/alert_${timestamp}.json`;
  const url = `${GITHUB_API_URL}/repos/${settings.githubRepo}/contents/${path}`;

  const options = {
    method: 'put',
    headers: {
      'Authorization': `token ${settings.githubPat}`,
      'Accept': 'application/vnd.github.v3+json',
    },
    payload: JSON.stringify({
      message: `TV Alert: ${payload.signal || 'Signal'} for ${payload.ticker || 'N/A'}`,
      content: Utilities.base64Encode(JSON.stringify(payload, null, 2))
    }),
    contentType: 'application/json',
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseBody = response.getContentText();
  if (response.getResponseCode() >= 300) {
    throw new Error(`GitHub API Error: ${responseBody}`);
  }
  return JSON.parse(responseBody);
}

function getGitHubAlerts() {
  const settings = getSettings();
  if (!settings || !settings.githubRepo) {
    throw new Error("GitHub Repo not configured in Settings.");
  }

  const url = `${GITHUB_API_URL}/repos/${settings.githubRepo}/contents/tradingview-alerts`;
  const options = {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
    muteHttpExceptions: true
  };
  // Add auth header if PAT is available, for private repos
  if (settings.githubPat) {
    options.headers['Authorization'] = `token ${settings.githubPat}`;
  }

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode === 404) {
    return []; // Directory doesn't exist yet, return empty array
  } else if (responseCode >= 300) {
    throw new Error(`GitHub API Error (${responseCode}): ${responseText}`);
  }

  const files = JSON.parse(responseText);
  const alerts = files
    .filter(file => file.type === 'file' && file.name.endsWith('.json'))
    .map(file => {
      try {
        const contentResponse = UrlFetchApp.fetch(file.download_url, options);
        return JSON.parse(contentResponse.getContentText());
      } catch (e) {
        console.error(`Failed to fetch or parse ${file.name}: ${e.toString()}`);
        return null; // Skip corrupted files
      }
    })
    .filter(alert => alert !== null); // Filter out any nulls from failed fetches

  return alerts.reverse(); // Show most recent first
}


/**
 * =================================================================
 * SCHEDULE MANAGEMENT FUNCTIONS
 * =================================================================
 */

function getSchedules() {
  const json = PropertiesService.getScriptProperties().getProperty(SCHEDULES_KEY);
  return json ? JSON.parse(json) : [];
}

function saveSchedules(schedules) {
  PropertiesService.getScriptProperties().setProperty(SCHEDULES_KEY, JSON.stringify(schedules));
}

function addSchedule(schedule) {
  const schedules = getSchedules();
  schedules.push({ id: new Date().getTime().toString(), ...schedule });
  saveSchedules(schedules);
  return { success: true, message: 'Schedule added.', schedules: getSchedules() };
}

function deleteSchedule(scheduleId) {
  let schedules = getSchedules();
  schedules = schedules.filter(s => s.id !== scheduleId);
  saveSchedules(schedules);
  return { success: true, message: 'Schedule deleted.', schedules: getSchedules() };
}

/**
 * =================================================================
 * LEGACY & PLACEHOLDER FUNCTIONS
 * =================================================================
 */

function sendEmail(to, ticker) {
  GmailApp.sendEmail(to, `Analysis for ${ticker}`, `This is the analysis for ${ticker}.`);
  return `Email sent to ${to} for ${ticker}.`;
}

function runManualPortAnalysis() {
  console.log("Manual analysis run triggered.");
  return { success: true, message: 'Manual analysis completed successfully.' };
}

function runScheduledImportAndEmail() {
  // Placeholder for time-driven trigger logic
  console.log("Scheduled import/email task is running.");
}