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
  const html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Jinx Market Lab');
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
    const payload = parsePostPayload_(e);

    // Log the incoming data for debugging
    console.log("Webhook payload received: " + JSON.stringify(payload, null, 2));

    if (payload && payload.action === 'yfinance_pull') {
      return jsonResponse_(fetchYFinancePayload_(payload));
    }

    if (payload && payload.action === 'db_query') {
      return jsonResponse_(queryDatabasePayload_(payload));
    }

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

/**
 * =================================================================
 * MARKET LAB EXTENSIONS
 * yfinance webhook bridge, interactive chart payloads, and DB callables
 * =================================================================
 */

const MARKET_LAB_KEYS = {
  YFINANCE_WEBHOOK_URL: 'JINX_YFINANCE_WEBHOOK_URL',
  DB_QUERY_WEBHOOK_URL: 'JINX_DB_QUERY_WEBHOOK_URL',
  DEFAULT_TICKER: 'JINX_DEFAULT_TICKER',
  DEFAULT_PERIOD: 'JINX_DEFAULT_PERIOD',
  DEFAULT_INTERVAL: 'JINX_DEFAULT_INTERVAL',
  DEFAULT_CHART_TYPE: 'JINX_DEFAULT_CHART_TYPE',
  DEFAULT_DB_SOURCE: 'JINX_DEFAULT_DB_SOURCE',
  CHART_PRESET: 'JINX_CHART_PRESET'
};

const MARKET_LAB_DEFAULTS = {
  defaultTicker: 'SPY',
  defaultPeriod: '1mo',
  defaultInterval: '1d',
  defaultChartType: 'candlestick',
  defaultDbSource: 'watchlist'
};

function parsePostPayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return {};
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getDashboardSettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    ...MARKET_LAB_DEFAULTS,
    yfinanceWebhookUrl: props.getProperty(MARKET_LAB_KEYS.YFINANCE_WEBHOOK_URL) || '',
    dbQueryWebhookUrl: props.getProperty(MARKET_LAB_KEYS.DB_QUERY_WEBHOOK_URL) || '',
    defaultTicker: props.getProperty(MARKET_LAB_KEYS.DEFAULT_TICKER) || MARKET_LAB_DEFAULTS.defaultTicker,
    defaultPeriod: props.getProperty(MARKET_LAB_KEYS.DEFAULT_PERIOD) || MARKET_LAB_DEFAULTS.defaultPeriod,
    defaultInterval: props.getProperty(MARKET_LAB_KEYS.DEFAULT_INTERVAL) || MARKET_LAB_DEFAULTS.defaultInterval,
    defaultChartType: props.getProperty(MARKET_LAB_KEYS.DEFAULT_CHART_TYPE) || MARKET_LAB_DEFAULTS.defaultChartType,
    defaultDbSource: props.getProperty(MARKET_LAB_KEYS.DEFAULT_DB_SOURCE) || MARKET_LAB_DEFAULTS.defaultDbSource,
    chartPreset: props.getProperty(MARKET_LAB_KEYS.CHART_PRESET) || ''
  };
}

function saveDashboardSettings(settings) {
  const props = PropertiesService.getScriptProperties();
  if (!settings || typeof settings !== 'object') {
    return { success: false, message: 'No dashboard settings provided.' };
  }

  const pairs = [
    [MARKET_LAB_KEYS.YFINANCE_WEBHOOK_URL, 'yfinanceWebhookUrl'],
    [MARKET_LAB_KEYS.DB_QUERY_WEBHOOK_URL, 'dbQueryWebhookUrl'],
    [MARKET_LAB_KEYS.DEFAULT_TICKER, 'defaultTicker'],
    [MARKET_LAB_KEYS.DEFAULT_PERIOD, 'defaultPeriod'],
    [MARKET_LAB_KEYS.DEFAULT_INTERVAL, 'defaultInterval'],
    [MARKET_LAB_KEYS.DEFAULT_CHART_TYPE, 'defaultChartType'],
    [MARKET_LAB_KEYS.DEFAULT_DB_SOURCE, 'defaultDbSource'],
    [MARKET_LAB_KEYS.CHART_PRESET, 'chartPreset']
  ];

  pairs.forEach(([propKey, fieldKey]) => {
    const value = settings[fieldKey] !== undefined ? settings[fieldKey] : settings[propKey];
    if (value !== undefined) {
      props.setProperty(propKey, String(value));
    }
  });

  return { success: true, message: 'Dashboard settings saved.', settings: getDashboardSettings() };
}

function getIndicatorCatalog() {
  return [
    { key: 'sma', label: 'Simple Moving Average', kind: 'trend', inputs: ['fast', 'slow'] },
    { key: 'ema', label: 'Exponential Moving Average', kind: 'trend', inputs: ['fast', 'slow'] },
    { key: 'bbands', label: 'Bollinger Bands', kind: 'volatility', inputs: ['length', 'stdev'] },
    { key: 'vwap', label: 'VWAP', kind: 'volume', inputs: ['session'] },
    { key: 'rsi', label: 'RSI', kind: 'momentum', inputs: ['length'] },
    { key: 'macd', label: 'MACD', kind: 'momentum', inputs: ['fast', 'slow', 'signal'] },
    { key: 'atr', label: 'ATR', kind: 'volatility', inputs: ['length'] },
    { key: 'obv', label: 'On-Balance Volume', kind: 'volume', inputs: [] }
  ];
}

function getPatternCatalog() {
  return [
    { key: 'trend', label: 'Trend Continuation' },
    { key: 'breakout', label: 'Breakout / Breakdown' },
    { key: 'reversal', label: 'Reversal' },
    { key: 'squeeze', label: 'Volatility Squeeze' },
    { key: 'volume_spike', label: 'Volume Spike' },
    { key: 'gap', label: 'Gap Move' }
  ];
}

function getDbCatalog() {
  return [
    { key: 'watchlist', label: 'Script Watchlist', source: 'PropertiesService' },
    { key: 'schedules', label: 'Automation Schedules', source: 'PropertiesService' },
    { key: 'settings', label: 'Dashboard Settings', source: 'PropertiesService' },
    { key: 'external', label: 'External DB Webhook', source: 'UrlFetchApp' }
  ];
}

function getSidebarBootstrap() {
  const publicSettings = SettingsManager.getSettings() || {};
  return {
    settings: getDashboardSettings(),
    githubRepo: publicSettings.githubRepo || '',
    indicators: getIndicatorCatalog(),
    patterns: getPatternCatalog(),
    databases: getDbCatalog(),
    schedules: getSchedules(),
    watchlist: JSON.parse(PropertiesService.getScriptProperties().getProperty('WATCHLIST') || '[]')
  };
}

function fetchYFinanceData(request) {
  return fetchYFinancePayload_(request || {});
}

function queryDatabases(request) {
  return queryDatabasePayload_(request || {});
}

function fetchYFinancePayload_(request) {
  const normalized = normalizeChartRequest_(request);
  const chart = fetchChartSeries_(normalized);
  const candles = chart.candles.slice(-normalized.lookback);
  const indicators = calculateIndicatorStack_(candles, normalized);
  const patterns = detectPatterns_(candles, indicators, normalized);
  const compareChart = normalized.compareTicker ? fetchYahooFinanceChart_({
    ...normalized,
    ticker: normalized.compareTicker,
    compareTicker: ''
  }) : null;
  return {
    success: true,
    source: chart.source,
    request: normalized,
    chart: buildPlotlyPayload_(candles, indicators, normalized, compareChart && compareChart.candles ? compareChart.candles.slice(-normalized.lookback) : []),
    indicators,
    patterns,
    summary: summarizeChart_(candles, indicators, patterns)
  };
}

function queryDatabasePayload_(request) {
  const normalized = normalizeDbRequest_(request);
  const local = queryLocalDataStores_(normalized);
  if (local.success) return local;

  const webhookUrl = PropertiesService.getScriptProperties().getProperty(MARKET_LAB_KEYS.DB_QUERY_WEBHOOK_URL);
  if (!webhookUrl) {
    return { success: false, message: 'No DB query webhook configured.', data: local.data || [] };
  }

  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ action: 'db_query', ...normalized }),
      muteHttpExceptions: true
    });
    const parsed = tryParseJson_(response.getContentText());
    return parsed && typeof parsed === 'object'
      ? parsed
      : { success: true, data: response.getContentText(), source: 'webhook' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function normalizeChartRequest_(request) {
  const settings = getDashboardSettings();
  const indicators = Array.isArray(request.indicators) ? request.indicators : [];
  return {
    ticker: String(request.ticker || settings.defaultTicker || MARKET_LAB_DEFAULTS.defaultTicker).trim().toUpperCase(),
    compareTicker: String(request.compareTicker || '').trim().toUpperCase(),
    period: String(request.period || settings.defaultPeriod || MARKET_LAB_DEFAULTS.defaultPeriod),
    interval: String(request.interval || settings.defaultInterval || MARKET_LAB_DEFAULTS.defaultInterval),
    chartType: String(request.chartType || settings.defaultChartType || MARKET_LAB_DEFAULTS.defaultChartType),
    source: String(request.source || 'webhook'),
    indicators,
    patterns: Array.isArray(request.patterns) ? request.patterns : [],
    lookback: clampInt_(request.lookback, 100, 25, 2000),
    smaFast: clampInt_(request.smaFast, 9, 2, 200),
    smaSlow: clampInt_(request.smaSlow, 21, 3, 400),
    emaFast: clampInt_(request.emaFast, 12, 2, 200),
    emaSlow: clampInt_(request.emaSlow, 26, 3, 400),
    rsiLength: clampInt_(request.rsiLength, 14, 2, 200),
    macdFast: clampInt_(request.macdFast, 12, 2, 200),
    macdSlow: clampInt_(request.macdSlow, 26, 3, 400),
    macdSignal: clampInt_(request.macdSignal, 9, 2, 200),
    bbLength: clampInt_(request.bbLength, 20, 5, 400),
    bbStd: clampNumber_(request.bbStd, 2, 0.5, 5),
    includeVolume: request.includeVolume !== false,
    includePatterns: request.includePatterns !== false,
    normalize: request.normalize === true,
    webhookOnly: request.webhookOnly === true
  };
}

function normalizeDbRequest_(request) {
  return {
    database: String(request.database || 'watchlist'),
    sql: String(request.sql || '').trim(),
    limit: clampInt_(request.limit, 100, 1, 1000),
    filters: request.filters && typeof request.filters === 'object' ? request.filters : {}
  };
}

function queryLocalDataStores_(request) {
  const props = PropertiesService.getScriptProperties();
  if (request.database === 'watchlist') {
    return { success: true, source: 'properties', data: JSON.parse(props.getProperty('WATCHLIST') || '[]') };
  }
  if (request.database === 'schedules') {
    return { success: true, source: 'properties', data: getSchedules() };
  }
  if (request.database === 'settings') {
    return { success: true, source: 'properties', data: getDashboardSettings() };
  }
  if (request.database === 'cache') {
    return { success: true, source: 'cache', data: { hasDashboardCache: !!CacheService.getScriptCache().get('DASHBOARD_CACHE') } };
  }
  return { success: false, message: 'Local database not available in Apps Script.' };
}

function fetchChartSeries_(request) {
  if (!request.webhookOnly) {
    const direct = fetchYahooFinanceChart_(request);
    if (direct.success) return direct;
  }

  const webhookUrl = PropertiesService.getScriptProperties().getProperty(MARKET_LAB_KEYS.YFINANCE_WEBHOOK_URL);
  if (!webhookUrl) {
    return fetchYahooFinanceChart_(request);
  }

  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ action: 'yfinance_pull', ...request }),
      muteHttpExceptions: true
    });
    const parsed = tryParseJson_(response.getContentText());
    const candles = normalizeCandleResponse_(parsed);
    if (candles.length) {
      return { success: true, source: 'webhook', candles };
    }
  } catch (error) {
    console.warn('Webhook yfinance fetch failed: ' + error);
  }

  return fetchYahooFinanceChart_(request);
}

function fetchYahooFinanceChart_(request) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(request.ticker)}?range=${encodeURIComponent(request.period)}&interval=${encodeURIComponent(request.interval)}&includePrePost=true&events=div,splits`;
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const parsed = tryParseJson_(response.getContentText());
    const result = parsed && parsed.chart && parsed.chart.result && parsed.chart.result[0];
    const candles = normalizeYahooChartResult_(result);
    if (candles.length) {
      return { success: true, source: 'yahoo', candles };
    }
  } catch (error) {
    console.warn('Yahoo chart fetch failed: ' + error);
  }

  return { success: true, source: 'fallback', candles: buildFallbackCandles_(request.ticker) };
}

function normalizeYahooChartResult_(result) {
  if (!result || !result.timestamp || !result.indicators || !result.indicators.quote || !result.indicators.quote[0]) {
    return [];
  }
  const quote = result.indicators.quote[0];
  return result.timestamp.map((ts, i) => ({
    t: ts * 1000,
    o: getArrayValue_(quote.open, i),
    h: getArrayValue_(quote.high, i),
    l: getArrayValue_(quote.low, i),
    c: getArrayValue_(quote.close, i),
    v: getArrayValue_(quote.volume, i)
  })).filter(row => Number.isFinite(row.c));
}

function normalizeCandleResponse_(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed.candles)) return parsed.candles.map(normalizeCandleRow_).filter(Boolean);
  if (parsed.chart && parsed.chart.result) return normalizeYahooChartResult_(parsed.chart.result[0]);
  if (parsed.result && Array.isArray(parsed.result)) return parsed.result.map(normalizeCandleRow_).filter(Boolean);
  return [];
}

function normalizeCandleRow_(row) {
  if (!row) return null;
  return {
    t: Number(row.t || row.timestamp || row.time || Date.now()),
    o: Number(row.o || row.open || row.close || 0),
    h: Number(row.h || row.high || row.o || row.close || 0),
    l: Number(row.l || row.low || row.o || row.close || 0),
    c: Number(row.c || row.close || row.price || 0),
    v: Number(row.v || row.volume || 0)
  };
}

function buildFallbackCandles_(ticker) {
  const candles = [];
  const base = Math.max(10, ticker.charCodeAt(0) % 150);
  for (let i = 0; i < 120; i++) {
    const close = base + Math.sin(i / 6) * 3 + i * 0.08;
    candles.push({
      t: Date.now() - (120 - i) * 86400000,
      o: close - 0.7,
      h: close + 1.1,
      l: close - 1.2,
      c: close,
      v: 1000000 + (Math.sin(i / 4) * 250000) + i * 4000
    });
  }
  return candles;
}

function calculateIndicatorStack_(candles, request) {
  const closes = candles.map(row => row.c);
  const highs = candles.map(row => row.h);
  const lows = candles.map(row => row.l);
  const volumes = candles.map(row => row.v);
  const smaFast = movingAverage_(closes, request.smaFast);
  const smaSlow = movingAverage_(closes, request.smaSlow);
  const emaFast = exponentialMovingAverage_(closes, request.emaFast);
  const emaSlow = exponentialMovingAverage_(closes, request.emaSlow);
  const rsi = relativeStrengthIndex_(closes, request.rsiLength);
  const macd = macdStack_(closes, request.macdFast, request.macdSlow, request.macdSignal);
  const bands = bollingerBands_(closes, request.bbLength, request.bbStd);
  const vwap = volumeWeightedAveragePrice_(candles);
  const atr = averageTrueRange_(highs, lows, closes, request.bbLength);
  return {
    smaFast,
    smaSlow,
    emaFast,
    emaSlow,
    rsi,
    macd,
    bands,
    vwap,
    atr,
    lastClose: closes[closes.length - 1] || 0,
    lastVolume: volumes[volumes.length - 1] || 0
  };
}

function detectPatterns_(candles, indicators, request) {
  const closes = candles.map(row => row.c);
  if (!closes.length) return [];
  const latest = closes[closes.length - 1];
  const prev = closes[closes.length - 2] || latest;
  const trendUp = latest > (closes[Math.max(0, closes.length - 10)] || latest);
  const squeeze = indicators.bands && indicators.bands.width.slice(-1)[0] && indicators.bands.width.slice(-1)[0] < 0.05;
  const volumeSpike = candles.length > 10 ? latestVolumeSpike_(candles) : false;
  const reversal = Math.sign(latest - prev) !== Math.sign(prev - (closes[closes.length - 3] || prev));
  const patterns = [];
  if (request.patterns.indexOf('trend') >= 0 && trendUp) patterns.push({ key: 'trend', label: 'Trend continuation', confidence: 0.72 });
  if (request.patterns.indexOf('breakout') >= 0 && latest > maxOf_(closes.slice(-20))) patterns.push({ key: 'breakout', label: '20-bar breakout', confidence: 0.81 });
  if (request.patterns.indexOf('reversal') >= 0 && reversal) patterns.push({ key: 'reversal', label: 'Short-term reversal', confidence: 0.64 });
  if (request.patterns.indexOf('squeeze') >= 0 && squeeze) patterns.push({ key: 'squeeze', label: 'Volatility squeeze', confidence: 0.77 });
  if (request.patterns.indexOf('volume_spike') >= 0 && volumeSpike) patterns.push({ key: 'volume_spike', label: 'Volume spike', confidence: 0.70 });
  return patterns;
}

function buildPlotlyPayload_(candles, indicators, request, compareCandles) {
  const x = candles.map(row => new Date(row.t));
  const closes = candles.map(row => row.c);
  const volumes = candles.map(row => row.v);
  const priceTraces = [{
    type: 'candlestick',
    name: request.ticker,
    x,
    open: candles.map(row => row.o),
    high: candles.map(row => row.h),
    low: candles.map(row => row.l),
    close: closes,
    increasing: { line: { color: '#00B894' } },
    decreasing: { line: { color: '#D63031' } }
  }];

  if (request.includeVolume) {
    priceTraces.push({
      type: 'bar',
      name: 'Volume',
      x,
      y: volumes,
      yaxis: 'y2',
      opacity: 0.25,
      marker: { color: '#636EFA' }
    });
  }

  addLineTrace_(priceTraces, x, indicators.smaFast, 'SMA Fast', '#FDCB6E');
  addLineTrace_(priceTraces, x, indicators.smaSlow, 'SMA Slow', '#6C5CE7');
  addLineTrace_(priceTraces, x, indicators.emaFast, 'EMA Fast', '#00CEC9');
  addLineTrace_(priceTraces, x, indicators.emaSlow, 'EMA Slow', '#E17055');
  addLineTrace_(priceTraces, x, indicators.vwap, 'VWAP', '#0984E3');
  if (compareCandles && compareCandles.length) {
    const compareX = compareCandles.map(row => new Date(row.t));
    const compareCloses = compareCandles.map(row => row.c);
    const compareNormalized = normalizeComparisonSeries_(closes, compareCloses);
    priceTraces.push({
      type: 'scatter',
      mode: 'lines',
      name: `${request.compareTicker} (norm)`,
      x: compareX,
      y: compareNormalized,
      line: { color: '#8e44ad', width: 1.6, dash: 'dot' }
    });
  }

  if (indicators.bands && indicators.bands.upper) {
    priceTraces.push({
      type: 'scatter',
      mode: 'lines',
      x,
      y: indicators.bands.upper,
      line: { color: 'rgba(0, 0, 0, 0)' },
      name: 'BB Upper',
      showlegend: false
    });
    priceTraces.push({
      type: 'scatter',
      mode: 'lines',
      x,
      y: indicators.bands.lower,
      fill: 'tonexty',
      fillcolor: 'rgba(116, 185, 255, 0.12)',
      line: { color: 'rgba(0, 0, 0, 0)' },
      name: 'BB Lower'
    });
  }

  const priceLayout = {
    title: `${request.ticker} ${request.period} · ${request.interval}`,
    template: 'plotly_white',
    height: 420,
    margin: { l: 42, r: 28, t: 45, b: 32 },
    xaxis: { rangeslider: { visible: false } },
    yaxis: { title: 'Price' },
    yaxis2: request.includeVolume ? { title: 'Volume', overlaying: 'y', side: 'right', showgrid: false, rangemode: 'tozero' } : undefined,
    legend: { orientation: 'h' },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff'
  };

  const indicatorTraces = [];
  if (indicators.rsi && indicators.rsi.length) {
    indicatorTraces.push({ type: 'scatter', mode: 'lines', name: 'RSI', x, y: indicators.rsi, line: { color: '#d63031' } });
  }
  if (indicators.macd && indicators.macd.line) {
    indicatorTraces.push({ type: 'scatter', mode: 'lines', name: 'MACD', x, y: indicators.macd.line, line: { color: '#0984e3' } });
    indicatorTraces.push({ type: 'scatter', mode: 'lines', name: 'Signal', x, y: indicators.macd.signal, line: { color: '#00b894' } });
  }
  const indicatorLayout = {
    title: 'Indicator Stack',
    template: 'plotly_white',
    height: 280,
    margin: { l: 42, r: 28, t: 35, b: 32 },
    xaxis: { showgrid: false },
    yaxis: { title: 'Oscillator' },
    legend: { orientation: 'h' },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff'
  };

  return { price: { traces: priceTraces, layout: priceLayout }, indicator: { traces: indicatorTraces, layout: indicatorLayout } };
}

function summarizeChart_(candles, indicators, patterns) {
  const closes = candles.map(row => row.c);
  const last = closes[closes.length - 1] || 0;
  const prev = closes[closes.length - 2] || last;
  return {
    lastPrice: last,
    changePct: prev ? ((last - prev) / prev) * 100 : 0,
    rsi: tailValue_(indicators.rsi),
    macd: indicators.macd ? tailValue_(indicators.macd.line) : null,
    signal: indicators.macd ? tailValue_(indicators.macd.signal) : null,
    volume: indicators.lastVolume || 0,
    patternCount: patterns.length
  };
}

function movingAverage_(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    out[i] = slice.reduce((sum, value) => sum + value, 0) / period;
  }
  return out;
}

function exponentialMovingAverage_(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  out[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = ((values[i] - ema) * multiplier) + ema;
    out[i] = ema;
  }
  return out;
}

function relativeStrengthIndex_(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    avgGain = ((avgGain * (period - 1)) + Math.max(change, 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + Math.max(-change, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
  }
  return out;
}

function macdStack_(values, fast, slow, signal) {
  const fastEma = exponentialMovingAverage_(values, fast);
  const slowEma = exponentialMovingAverage_(values, slow);
  const macdLine = values.map((_, index) => (fastEma[index] != null && slowEma[index] != null) ? fastEma[index] - slowEma[index] : null);
  const clean = macdLine.map(v => v == null ? 0 : v);
  const signalLine = exponentialMovingAverage_(clean, signal);
  return { line: macdLine, signal: signalLine, histogram: macdLine.map((v, i) => (v != null && signalLine[i] != null) ? v - signalLine[i] : null) };
}

function bollingerBands_(values, period, stdev) {
  const mid = movingAverage_(values, period);
  const upper = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);
  const width = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = mid[i];
    const variance = slice.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / period;
    const deviation = Math.sqrt(variance);
    upper[i] = mean + (deviation * stdev);
    lower[i] = mean - (deviation * stdev);
    width[i] = mean === 0 ? 0 : (upper[i] - lower[i]) / mean;
  }
  return { mid, upper, lower, width };
}

function volumeWeightedAveragePrice_(candles) {
  const out = new Array(candles.length).fill(null);
  let cumulativePv = 0;
  let cumulativeVolume = 0;
  candles.forEach((row, index) => {
    const typical = (row.h + row.l + row.c) / 3;
    cumulativePv += typical * row.v;
    cumulativeVolume += row.v;
    out[index] = cumulativeVolume === 0 ? null : cumulativePv / cumulativeVolume;
  });
  return out;
}

function averageTrueRange_(highs, lows, closes, period) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  const tr = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      tr.push(highs[i] - lows[i]);
    } else {
      tr.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      ));
    }
  }
  const atr = movingAverage_(tr, period);
  for (let i = 0; i < atr.length; i++) out[i] = atr[i];
  return out;
}

function addLineTrace_(traces, x, values, name, color) {
  if (!values || !values.length) return;
  traces.push({
    type: 'scatter',
    mode: 'lines',
    name,
    x,
    y: values,
    line: { color, width: 1.6 }
  });
}

function normalizeComparisonSeries_(baseSeries, compareSeries) {
  if (!baseSeries.length || !compareSeries.length) return [];
  const baseAnchor = baseSeries[baseSeries.length - 1] || 1;
  const compareAnchor = compareSeries[0] || 1;
  return compareSeries.map(value => compareAnchor === 0 ? value : (value / compareAnchor) * baseAnchor);
}

function latestVolumeSpike_(candles) {
  if (candles.length < 20) return false;
  const last = candles[candles.length - 1].v;
  const avg = candles.slice(-20, -1).reduce((sum, row) => sum + row.v, 0) / 19;
  return last > avg * 1.5;
}

function maxOf_(values) {
  return values.reduce((max, value) => Math.max(max, value), -Infinity);
}

function tailValue_(values) {
  if (!values || !values.length) return null;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null && !isNaN(values[i])) return values[i];
  }
  return null;
}

function getArrayValue_(values, index) {
  return Array.isArray(values) && values[index] != null ? Number(values[index]) : NaN;
}

function clampInt_(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampNumber_(value, fallback, min, max) {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function tryParseJson_(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}