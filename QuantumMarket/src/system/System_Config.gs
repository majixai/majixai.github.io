/**
 * ==========================================================================
 * FILE: System_Config.gs
 * DESCRIPTION: Manages all interactions with PropertiesService for storing
 *              and retrieving script settings.
 * ==========================================================================
 */

const System_Config = {

  // A map of default settings.
  DEFAULTS: {
    'GENAI_API_KEY': '',
    'SHEET_ID': '',
    'DOC_ID': '',
    'EMAIL_RECIPIENT': Session.getActiveUser().getEmail(),
    'FOLDER_NAME': 'MarketData_DB'
  },

  /**
   * Retrieves a single setting by key.
   * @param {string} key The key of the setting to retrieve.
   * @returns {string} The stored value or the default value.
   */
  getSetting: function(key) {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(key) || this.DEFAULTS[key] || null;
  },

  /**
   * Retrieves all settings as an object.
   * @returns {Object} An object containing all stored settings.
   */
  getAllSettings: function() {
    const settings = {};
    for (const key in this.DEFAULTS) {
      settings[key] = this.getSetting(key);
    }
    return settings;
  },

  /**
   * Saves a single setting.
   * @param {string} key The key of the setting to save.
   * @param {string} value The value to store.
   */
  saveSetting: function(key, value) {
    PropertiesService.getScriptProperties().setProperty(key, value);
  },

  /**
   * Saves a batch of settings from a form object.
   * @param {Object} formObject The object from the HTML form.
   */
  saveAllSettings: function(formObject) {
    try {
      this.saveSetting('GENAI_API_KEY', formObject.apiKey);
      this.saveSetting('SHEET_ID', formObject.sheetId);
      this.saveSetting('EMAIL_RECIPIENT', formObject.email);
      this.saveSetting('FOLDER_NAME', formObject.folderName);

      // Re-initialize the environment with new settings.
      Service_Data.initEnvironment();

      System_Logger.log("Config", "Configuration saved successfully.");
      return { success: true, msg: "Settings Saved & Environment Initialized." };
    } catch (e) {
      System_Logger.log("SaveSettings", e.toString(), true);
      return { success: false, msg: "Error: " + e.message };
    }
  }
};
