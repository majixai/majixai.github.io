/**
 * ==========================================================================
 * FILE: System_Alerts.gs
 * DESCRIPTION: Handles the creation of Google Calendar events for bullish
 *              market alerts.
 * ==========================================================================
 */

const System_Alerts = {

  // Cooldown period in milliseconds (4 hours)
  ALERT_COOLDOWN: 14400000,

  /**
   * Checks market data for bullish signals and creates calendar alerts.
   * @param {Array<Object>} data The latest market data from the heartbeat.
   */
  checkBullishAlerts: function(data) {
    const calendar = CalendarApp.getDefaultCalendar();
    const now = new Date();

    data.forEach(stock => {
      // Alert if projected return is > 2% in the next cycle (highly bullish)
      if (stock.projectedReturn > 0.02) {

        const lastAlertTime = this.getLastAlertTime(stock.ticker);

        if (now.getTime() - lastAlertTime > this.ALERT_COOLDOWN) {
          try {
            this.createCalendarEvent(calendar, stock, now);
            this.setLastAlertTime(stock.ticker, now.getTime());
            System_Logger.log("Alerts", `Created bull alert for ${stock.ticker}.`);
          } catch (calErr) {
            System_Logger.log("CalendarAlert", calErr.message, true);
          }
        }
      }
    });
  },

  /**
   * Retrieves the timestamp of the last alert for a given ticker.
   * @param {string} ticker The stock ticker.
   * @returns {number} The timestamp in milliseconds.
   */
  getLastAlertTime: function(ticker) {
    const lastAlertKey = `ALERT_${ticker}`;
    return parseFloat(PropertiesService.getScriptProperties().getProperty(lastAlertKey) || 0);
  },

  /**
   * Stores the timestamp of the last alert for a given ticker.
   * @param {string} ticker The stock ticker.
   * @param {number} time The timestamp in milliseconds.
   */
  setLastAlertTime: function(ticker, time) {
    const lastAlertKey = `ALERT_${ticker}`;
    PropertiesService.getScriptProperties().setProperty(lastAlertKey, time.toString());
  },

  /**
   * Creates the actual event in the user's default Google Calendar.
   * @param {Calendar} calendar The CalendarApp instance.
   * @param {Object} stock The stock data object.
   * @param {Date} now The current date object.
   */
  createCalendarEvent: function(calendar, stock, now) {
    const eventEndTime = new Date(now.getTime() + 900000); // Event lasts 15 mins

    const title = `🚀 BULL ALERT: ${stock.ticker}`;
    const description = `The quantitative model detected a strong bullish signal.

    - Current Price: ${stock.price.toFixed(4)}
    - 15-Min Projected Price: ${stock.projected.toFixed(4)}
    - Projected Return: ${(stock.projectedReturn * 100).toFixed(2)}%
    - Annualized Volatility (Sigma): ${stock.sigma.toFixed(4)}

    *Note: This is an automated alert based on mathematical models and is not financial advice.*`;

    calendar.createEvent(title, now, eventEndTime, { description: description });
  }
};
