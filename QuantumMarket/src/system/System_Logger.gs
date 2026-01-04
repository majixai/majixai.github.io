/**
 * ==========================================================================
 * FILE: System_Logger.gs
 * DESCRIPTION: Handles the military-grade, persistent logging system.
 * ==========================================================================
 */

const System_Logger = {
  /**
   * Main logging function.
   * @param {string} context The name of the function or process logging the message.
   * @param {string} message The log message.
   * @param {boolean} isError If true, triggers an error email.
   */
  log: function(context, message, isError = false) {
    const timestamp = new Date();
    const entry = `[${timestamp.toLocaleTimeString()}] [${context}] ${message}`;

    console.log(entry);
    this.saveToStorage(entry);

    if (isError) {
      this.sendErrorEmail(context, message);
    }
  },

  /**
   * Saves a log entry to script properties for UI display.
   * @param {string} entry The formatted log entry.
   */
  saveToStorage: function(entry) {
    try {
      const props = PropertiesService.getScriptProperties();
      let logs = props.getProperty('SYSTEM_LOGS');
      logs = logs ? JSON.parse(logs) : [];
      logs.unshift(entry);
      if (logs.length > 50) logs.pop(); // Keep last 50
      props.setProperty('SYSTEM_LOGS', JSON.stringify(logs));
    } catch(e) {
      console.error("Failed to save log to props", e);
    }
  },

  /**
   * Sends a critical error email, with throttling to prevent spam.
   * @param {string} context The context of the error.
   * @param {string} message The error message.
   */
  sendErrorEmail: function(context, message) {
    try {
      const props = PropertiesService.getScriptProperties();
      const lastEmailKey = `LAST_EMAIL_${context}`;
      const lastEmailTime = parseFloat(props.getProperty(lastEmailKey) || 0);
      const now = new Date().getTime();

      // 1 hour cooldown per context
      if (now - lastEmailTime > 3600000) {
        const email = System_Config.getSetting('EMAIL_RECIPIENT') || Session.getActiveUser().getEmail();

        MailApp.sendEmail({
          to: email,
          subject: `🚨 JINX TICKER FAILURE: ${context}`,
          body: `Timestamp: ${new Date()}\nContext: ${context}\nError: ${message}\n\nPlease check the Settings > Debug Console.`
        });

        props.setProperty(lastEmailKey, now.toString());
      }
    } catch(e) {
      console.error("Failed to send error email", e);
    }
  },

  /**
   * Retrieves all stored logs.
   * @returns {string} A newline-separated string of log entries.
   */
  getLogs: function() {
    const logs = PropertiesService.getScriptProperties().getProperty('SYSTEM_LOGS');
    return logs ? JSON.parse(logs).join('\n') : "No logs recorded yet.";
  },

  /**
   * Clears the log history from script properties.
   */
  clearLogs: function() {
    PropertiesService.getScriptProperties().deleteProperty('SYSTEM_LOGS');
  }
};
