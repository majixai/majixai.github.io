function reserveGeminiBudget_(projectConfig) {
  const dailyLimit = toNumberOrDefault_(projectConfig.defaults.geminiDailyLimit, NIGHTLY_MARKET_FORECAST.defaultGeminiDailyLimit);
  const monthlyLimit = toNumberOrDefault_(projectConfig.defaults.geminiMonthlyLimit, NIGHTLY_MARKET_FORECAST.defaultGeminiMonthlyLimit);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const now = new Date();
    const dayKey = 'GEMINI_DAILY_' + isoDateKey_(now, NIGHTLY_MARKET_FORECAST.timezone);
    const monthKey = 'GEMINI_MONTHLY_' + isoMonthKey_(now, NIGHTLY_MARKET_FORECAST.timezone);
    const dailyCount = toNumberOrDefault_(properties.getProperty(dayKey), 0);
    const monthlyCount = toNumberOrDefault_(properties.getProperty(monthKey), 0);
    if (dailyCount >= dailyLimit) {
      throw new Error('Gemini daily limit reached (' + dailyCount + '/' + dailyLimit + ')');
    }
    if (monthlyCount >= monthlyLimit) {
      throw new Error('Gemini monthly limit reached (' + monthlyCount + '/' + monthlyLimit + ')');
    }
    properties.setProperty(dayKey, String(dailyCount + 1));
    properties.setProperty(monthKey, String(monthlyCount + 1));
    return {
      dailyUsed: dailyCount + 1,
      dailyLimit: dailyLimit,
      monthlyUsed: monthlyCount + 1,
      monthlyLimit: monthlyLimit
    };
  } finally {
    lock.releaseLock();
  }
}
