function nightlyMarketForecastJob() {
  const nextSession = isNextUsEquitiesSessionOpen_();
  if (!nextSession.isOpen) {
    Logger.log('Skipping nightly forecast: ' + nextSession.reason);
    return;
  }

  const projectConfig = loadProjectDirectoryConfig_();
  const symbolReports = projectConfig.defaults.symbols.map(function(symbol, index) {
    if (index > 0) {
      Utilities.sleep(toNumberOrDefault_(projectConfig.defaults.marketDataDelayMs, NIGHTLY_MARKET_FORECAST.defaultMarketDataDelayMs));
    }
    return buildSymbolReport_(symbol, projectConfig);
  });
  const geminiResponse = generateGeminiForecast_(projectConfig, nextSession, symbolReports);
  const subject = buildForecastEmailSubject_(symbolReports, nextSession);
  const htmlBody = buildForecastEmailHtml_(projectConfig, nextSession, symbolReports, geminiResponse);
  const plainBody = buildForecastPlainText_(nextSession, symbolReports, geminiResponse);

  MailApp.sendEmail({
    to: projectConfig.runtime.recipients.join(','),
    subject: subject,
    htmlBody: htmlBody,
    body: plainBody
  });

  Logger.log('Nightly market forecast sent for ' + nextSession.nextSessionDate + '.');
}

function installNightlyMarketForecastTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'nightlyMarketForecastJob') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('nightlyMarketForecastJob')
    .timeBased()
    .atHour(22)
    .everyDays(1)
    .inTimezone(NIGHTLY_MARKET_FORECAST.timezone)
    .create();
}

function removeNightlyMarketForecastTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'nightlyMarketForecastJob') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
