/**
 * =================================================================
 * SPREADSHEET UI & TRIGGERS
 * =================================================================
 */

function onOpen(e) {
  SpreadsheetApp.getUi()
      .createMenu('Jinx Finance')
      .addItem('Open Manager', 'showSidebar')
      .addSeparator()
      .addItem('Market Movers', 'showMarketMoversSidebar')
      .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Jinx Finance Manager');
  SpreadsheetApp.getUi().showSidebar(html);
}

// Web App entry point for the simple email form
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle("Jinx Finance Email Service");
}

/**
 * Webhook entry point for POST requests from services like TradingView.
 * @param {Object} e The event object from the POST request.
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // Log the incoming data for debugging
    console.log("Webhook payload received: " + JSON.stringify(payload, null, 2));

    // Handle the GitHub interaction
    const githubResult = GitHubService.createFileFromWebhook(payload);

    // Return a success response to the webhook sender
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Webhook received and processed.', githubResponse: githubResult }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("Error in doPost: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * =================================================================
 * SERVICE CLASSES (OOP Refactor)
 * =================================================================
 */

/**
 * Manages all settings stored in PropertiesService.
 */
class SettingsManager {
  static SETTINGS_KEY = 'APP_SETTINGS';

  /**
   * Saves a settings object to script properties.
   * @param {Object} settings The settings object to save.
   * @returns {Object} A result object.
   */
  static saveSettings(settings) {
    if (!settings) {
      return { success: false, message: 'No settings provided.' };
    }
    try {
      // Never store empty passwords, keep the old one if an empty string is passed
      const currentSettings = this.getSettings() || {};
      if (!settings.githubPat) settings.githubPat = currentSettings.githubPat;
      if (!settings.fmpApiKey) settings.fmpApiKey = currentSettings.fmpApiKey;
      if (!settings.geminiApiKey) settings.geminiApiKey = currentSettings.geminiApiKey;

      PropertiesService.getScriptProperties().setProperty(this.SETTINGS_KEY, JSON.stringify(settings));
      return { success: true, message: 'Settings saved successfully.' };
    } catch (e) {
      console.error("Error saving settings: " + e.toString());
      return { success: false, message: 'Failed to save settings.' };
    }
  }

  /**
   * Retrieves the settings object from script properties.
   * @returns {Object|null} The settings object or null.
   */
  static getSettings() {
    try {
      const settingsJson = PropertiesService.getScriptProperties().getProperty(this.SETTINGS_KEY);
      return settingsJson ? JSON.parse(settingsJson) : null;
    } catch (e) {
      console.error("Error getting settings: " + e.toString());
      return null;
    }
  }
}

/**
 * Handles interactions with the GitHub API.
 */
class GitHubService {
  static API_URL = 'https://api.github.com';

  /**
   * Creates a new file in a GitHub repository with content from a webhook.
   * @param {Object} payload The data from the TradingView webhook.
   * @returns {Object} The response from the GitHub API.
   */
  static createFileFromWebhook(payload) {
    const settings = SettingsManager.getSettings();
    if (!settings || !settings.githubPat || !settings.githubRepo) {
      throw new Error("GitHub settings (PAT and Repo) are not configured.");
    }

    const { githubPat, githubRepo } = settings;
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const fileName = `tv_alert_${timestamp}.json`;
    const path = `tradingview-alerts/${fileName}`;
    const url = `${this.API_URL}/repos/${githubRepo}/contents/${path}`;

    const fileContent = JSON.stringify(payload, null, 2);
    const encodedContent = Utilities.base64Encode(fileContent);

    const options = {
      method: 'put',
      headers: {
        'Authorization': `token ${githubPat}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Google-Apps-Script-Jinx-Finance'
      },
      payload: JSON.stringify({
        message: `TradingView Alert: ${payload.signal || 'Signal'} for ${payload.ticker || 'N/A'}`,
        content: encodedContent
      }),
      contentType: 'application/json',
      muteHttpExceptions: true // Important to catch errors
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    console.log(`GitHub API Response Code: ${responseCode}`);
    console.log(`GitHub API Response Body: ${responseBody}`);

    if (responseCode >= 200 && responseCode < 300) {
      return JSON.parse(responseBody);
    } else {
      throw new Error(`GitHub API Error (${responseCode}): ${responseBody}`);
    }
  }
}

/**
 * =================================================================
 * GLOBALLY EXPOSED FUNCTIONS (for client-side `google.script.run`)
 * =================================================================
 */

// --- Settings ---
function saveSettings(settings) { return SettingsManager.saveSettings(settings); }
function getSettings() {
  const settings = SettingsManager.getSettings();
  // Only return non-sensitive info to the client
  if (settings) {
    return { githubRepo: settings.githubRepo };
  }
  return null;
}

// --- Schedules ---
const SCRIPT_PROPERTY_SCHEDULES = 'schedules';
function getSchedules() {
  const schedulesJson = PropertiesService.getScriptProperties().getProperty(SCRIPT_PROPERTY_SCHEDULES);
  return schedulesJson ? JSON.parse(schedulesJson) : [];
}
function saveSchedules(schedules) {
  PropertiesService.getScriptProperties().setProperty(SCRIPT_PROPERTY_SCHEDULES, JSON.stringify(schedules));
}
function addSchedule(newSchedule) {
  const schedules = getSchedules();
  schedules.push({ id: new Date().getTime().toString(), ...newSchedule });
  saveSchedules(schedules);
  return { success: true, message: 'Schedule added.', schedules: getSchedules() };
}
function deleteSchedule(scheduleId) {
  let schedules = getSchedules();
  schedules = schedules.filter(s => s.id !== scheduleId);
  saveSchedules(schedules);
  return { success: true, message: 'Schedule deleted.', schedules: getSchedules() };
}

// --- Simple Email Form ---
function sendEmail(to, ticker) {
  const subject = `Market Phase for ${ticker} - Jinx Finance`;
  const htmlBody = `<p>Analysis for ${ticker}.</p>`; // Simple body
  GmailApp.sendEmail(to, subject, "", { htmlBody });
  return `Email sent to ${to} for ${ticker}.`;
}

// --- Other ---
function getServerTimezone() { return Session.getScriptTimeZone(); }
function runManualPortAnalysis() {
  console.log("Manual analysis run triggered.");
  return { success: true, message: 'Manual analysis completed successfully.' };
}
function checkApiKeys() {
  const settings = SettingsManager.getSettings();
  return !!(settings && settings.fmpApiKey && settings.geminiApiKey);
}

/**
 * =================================================================
 * TIME-DRIVEN TRIGGER WORKFLOW
 * =================================================================
 */
function runScheduledImportAndEmail() {
  const schedules = getSchedules();
  if (schedules.length === 0) return;

  const currentTime = new Date();
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  const emailsToSend = new Set();
  schedules.forEach(schedule => {
    const [scheduleHour, scheduleMinute] = schedule.time.split(':').map(Number);
    if (currentHour === scheduleHour && currentMinute === scheduleMinute) {
      schedule.email.split(',').forEach(email => emailsToSend.add(email.trim()));
    }
  });

  if (emailsToSend.size > 0) {
    const recipientList = Array.from(emailsToSend).join(',');
    console.log(`Running scheduled task for: ${recipientList}`);
    // GmailApp.sendEmail(recipientList, "Scheduled Report", "Here is your report.");
  }
}