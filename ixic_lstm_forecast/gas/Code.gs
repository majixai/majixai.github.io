const IXIC_DEFAULTS = {
  PRIMARY_SYMBOL: '^IXIC',
  SYMBOL_CATEGORIES: 'indices,tech_mega',
  SYMBOLS_CSV_URL: 'https://raw.githubusercontent.com/majixai/majixai.github.io/main/actions/symbols.csv',
  TIMEZONE: Session.getScriptTimeZone() || 'America/New_York',
  SEND_HOUR_LOCAL: 22,
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_URL_BASE: 'https://generativelanguage.googleapis.com/v1beta/models/',
  MAX_DAILY_CALLS: 20,
  MAX_MONTHLY_CALLS: 400,
  MARKET_CALENDAR: 'US_EQUITIES',
  GAS_WEBHOOK_SECRET: '',
  RECIPIENT_EMAILS: '',
};

function nightlyIxicForecastJob() {
  const settings = getIxicSettings();
  if (!isNextMorningMarketOpen_(settings)) {
    Logger.log('Skipping nightlyIxicForecastJob: market not open next morning.');
    return;
  }
  if (!checkAndConsumeRateLimit_(settings)) {
    Logger.log('Skipping nightlyIxicForecastJob: Gemini rate limit budget exhausted.');
    return;
  }

  const reports = settings.selectedSymbols.map(function (symbol) {
    return buildSymbolReport_(symbol, settings);
  });
  const prompt = buildGeminiPrompt_(settings, reports);
  const aiResponse = callGemini_(settings, prompt);
  const htmlBody = buildEmailHtml_(settings, reports, aiResponse);
  sendForecastEmail_(settings, htmlBody, reports);
}

function installIxicNightlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'nightlyIxicForecastJob') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('nightlyIxicForecastJob')
    .timeBased()
    .everyDays(1)
    .atHour(getIxicSettings().sendHourLocal)
    .nearMinute(0)
    .inTimezone(getIxicSettings().timezone)
    .create();
}

function doGet() {
  return jsonOut_({ ok: true, service: 'ixic-nightly-forecast', version: '1.0.0' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const settings = getIxicSettings();
    if (settings.webhookSecret && body.secret !== settings.webhookSecret) {
      return jsonOut_({ ok: false, error: 'Unauthorized' }, 403);
    }

    if (body.operation === 'upsertForecastSettings') {
      applyWebhookSettings_(body);
      return jsonOut_({ ok: true, operation: body.operation, updated: true });
    }

    if (body.operation === 'runNow') {
      nightlyIxicForecastJob();
      return jsonOut_({ ok: true, operation: body.operation, ran: true });
    }

    return jsonOut_({ ok: true, operation: 'noop' });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message }, 500);
  }
}

function getIxicSettings() {
  const props = PropertiesService.getScriptProperties();
  const timezone = props.getProperty('IXIC_TIMEZONE') || IXIC_DEFAULTS.TIMEZONE;
  const sendHourLocal = parseInt(props.getProperty('IXIC_SEND_HOUR_LOCAL') || IXIC_DEFAULTS.SEND_HOUR_LOCAL, 10);
  const primarySymbol = props.getProperty('IXIC_PRIMARY_SYMBOL') || IXIC_DEFAULTS.PRIMARY_SYMBOL;
  const symbolCategories = splitCsv_(props.getProperty('IXIC_SYMBOL_CATEGORIES') || IXIC_DEFAULTS.SYMBOL_CATEGORIES);
  const explicitSymbols = splitCsv_(props.getProperty('IXIC_SYMBOLS') || '');
  const symbolCatalog = loadSymbolsCatalog_(props.getProperty('IXIC_SYMBOLS_CSV_URL') || IXIC_DEFAULTS.SYMBOLS_CSV_URL);
  const selectedSymbols = selectSymbolsFromCatalog_(symbolCatalog, primarySymbol, explicitSymbols, symbolCategories);

  return {
    timezone: timezone,
    sendHourLocal: sendHourLocal,
    marketCalendar: props.getProperty('IXIC_MARKET_CALENDAR') || IXIC_DEFAULTS.MARKET_CALENDAR,
    primarySymbol: primarySymbol,
    selectedSymbols: selectedSymbols,
    recipientEmails: splitCsv_(props.getProperty('RECIPIENT_EMAILS') || IXIC_DEFAULTS.RECIPIENT_EMAILS),
    geminiApiKey: props.getProperty('GEMINI_API_KEY') || '',
    geminiModel: props.getProperty('IXIC_GEMINI_MODEL') || IXIC_DEFAULTS.GEMINI_MODEL,
    maxDailyCalls: parseInt(props.getProperty('IXIC_GEMINI_DAILY_LIMIT') || IXIC_DEFAULTS.MAX_DAILY_CALLS, 10),
    maxMonthlyCalls: parseInt(props.getProperty('IXIC_GEMINI_MONTHLY_LIMIT') || IXIC_DEFAULTS.MAX_MONTHLY_CALLS, 10),
    webhookSecret: props.getProperty('IXIC_WEBHOOK_SECRET') || IXIC_DEFAULTS.GAS_WEBHOOK_SECRET,
    symbolCategories: symbolCategories,
    symbolsCsvUrl: props.getProperty('IXIC_SYMBOLS_CSV_URL') || IXIC_DEFAULTS.SYMBOLS_CSV_URL,
  };
}

function applyWebhookSettings_(payload) {
  const props = PropertiesService.getScriptProperties();
  if (payload.primarySymbol) props.setProperty('IXIC_PRIMARY_SYMBOL', payload.primarySymbol);
  if (payload.symbols && payload.symbols.length) props.setProperty('IXIC_SYMBOLS', payload.symbols.join(','));
  if (payload.symbolSource && payload.symbolSource.categories) {
    props.setProperty('IXIC_SYMBOL_CATEGORIES', payload.symbolSource.categories.join(','));
  }
  if (payload.symbolSource && (payload.symbolSource.csvUrl || payload.symbolSource.csvPath)) {
    props.setProperty('IXIC_SYMBOLS_CSV_URL', payload.symbolSource.csvUrl || payload.symbolSource.csvPath);
  }
  if (payload.schedule) {
    if (payload.schedule.send_hour_local != null) props.setProperty('IXIC_SEND_HOUR_LOCAL', String(payload.schedule.send_hour_local));
    if (payload.schedule.timezone) props.setProperty('IXIC_TIMEZONE', payload.schedule.timezone);
    if (payload.schedule.market_calendar) props.setProperty('IXIC_MARKET_CALENDAR', payload.schedule.market_calendar);
  }
  if (payload.gemini) {
    if (payload.gemini.model) props.setProperty('IXIC_GEMINI_MODEL', payload.gemini.model);
    if (payload.gemini.daily_limit != null) props.setProperty('IXIC_GEMINI_DAILY_LIMIT', String(payload.gemini.daily_limit));
    if (payload.gemini.monthly_limit != null) props.setProperty('IXIC_GEMINI_MONTHLY_LIMIT', String(payload.gemini.monthly_limit));
  }
}

function buildSymbolReport_(symbol, settings) {
  const weekly = fetchOhlcv_(symbol, '1wk', '2y');
  const daily = fetchOhlcv_(symbol, '1d', '6mo');
  const hourly = fetchOhlcv_(symbol, '60m', '30d');
  const m15 = fetchOhlcv_(symbol, '15m', '10d');

  const enriched = {
    weekly: enrichTimeframe_(weekly, 'weekly'),
    daily: enrichTimeframe_(daily, 'daily'),
    hourly: enrichTimeframe_(hourly, 'hourly'),
    m15: enrichTimeframe_(m15, '15m'),
  };
  const repetitions = detectCrossTimeframeRepetitions_(enriched);

  return {
    symbol: symbol,
    generatedAt: new Date().toISOString(),
    forecast: buildForecastOhlcv_(enriched.daily, enriched.hourly, enriched.m15),
    patterns: {
      weekly: summarizePatterns_(enriched.weekly, true),
      daily: summarizePatterns_(enriched.daily, true),
      hourly: summarizePatterns_(enriched.hourly, false),
      m15: summarizePatterns_(enriched.m15, false),
    },
    indicators: {
      weekly: enriched.weekly.indicators,
      daily: enriched.daily.indicators,
      hourly: enriched.hourly.indicators,
      m15: enriched.m15.indicators,
    },
    repetitions: repetitions,
  };
}

function fetchOhlcv_(symbol, interval, range) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol)
    + '?interval=' + encodeURIComponent(interval)
    + '&range=' + encodeURIComponent(range)
    + '&includePrePost=false&events=div%2Csplits';
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) {
    throw new Error('Yahoo Finance request failed for ' + symbol + ' (' + interval + '): ' + resp.getContentText());
  }
  const json = JSON.parse(resp.getContentText());
  const result = (((json || {}).chart || {}).result || [])[0] || {};
  const quote = (((result.indicators || {}).quote) || [])[0] || {};
  const timestamps = result.timestamp || [];
  const out = [];
  for (var i = 0; i < timestamps.length; i++) {
    if ([quote.open, quote.high, quote.low, quote.close, quote.volume].some(function (series) { return !series || series[i] == null; })) {
      continue;
    }
    out.push({
      ts: timestamps[i],
      open: Number(quote.open[i]),
      high: Number(quote.high[i]),
      low: Number(quote.low[i]),
      close: Number(quote.close[i]),
      volume: Number(quote.volume[i]),
    });
  }
  return out;
}

function enrichTimeframe_(candles, timeframe) {
  return {
    timeframe: timeframe,
    candles: candles,
    indicators: {
      SMA20: sma_(candles, 20),
      SMA50: sma_(candles, 50),
      EMA9: ema_(candles, 9),
      EMA21: ema_(candles, 21),
      RSI14: rsi_(candles, 14),
      MACD: macd_(candles),
      ATR14: atr_(candles, 14),
      VWAP: vwap_(candles),
    },
    candlePatterns: detectBasicPatterns_(candles),
    structure: detectStructure_(candles),
    volumeTrend: detectVolumeTrend_(candles),
  };
}

function buildGeminiPrompt_(settings, reports) {
  return [
    'You are a market structure analyst.',
    'Forecast next-session OHLCV probabilistically.',
    'Analyze weekly, daily, hourly, and 15-minute patterns.',
    'Treat weekly and daily patterns as multi-day persistence and lower timeframes as session-fresh unless repetition persists.',
    'Call out repetitions, relevant indicators, and invalidation levels.',
    'Keep the output HTML-friendly and concise.',
    '',
    JSON.stringify({
      project: 'ixic-nightly-forecast',
      schedule: settings.sendHourLocal,
      timezone: settings.timezone,
      reports: reports,
    }, null, 2),
  ].join('\n');
}

function callGemini_(settings, prompt) {
  if (!settings.geminiApiKey) {
    return 'Gemini API key not configured. Populate GEMINI_API_KEY in Script Properties.';
  }
  const response = UrlFetchApp.fetch(
    IXIC_DEFAULTS.GEMINI_URL_BASE + settings.geminiModel + ':generateContent',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-goog-api-key': settings.geminiApiKey },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, topP: 0.9, maxOutputTokens: 3072 },
      }),
      muteHttpExceptions: true,
    }
  );
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Gemini API error: ' + response.getContentText());
  }
  const json = JSON.parse(response.getContentText());
  const parts = ((((json || {}).candidates || [])[0] || {}).content || {}).parts || [];
  return parts.map(function (part) { return part.text || ''; }).join('\n') || 'No Gemini response returned.';
}

function sendForecastEmail_(settings, htmlBody, reports) {
  if (!settings.recipientEmails.length) {
    throw new Error('RECIPIENT_EMAILS Script Property is required.');
  }
  MailApp.sendEmail({
    to: settings.recipientEmails.join(','),
    subject: 'IXIC nightly forecast ' + Utilities.formatDate(new Date(), settings.timezone, 'yyyy-MM-dd'),
    htmlBody: htmlBody,
    body: reports.map(function (report) { return report.symbol + ': ' + JSON.stringify(report.forecast); }).join('\n'),
  });
}

function buildEmailHtml_(settings, reports, aiResponse) {
  const reportHtml = reports.map(function (report) {
    return '<h2>' + report.symbol + '</h2>'
      + '<p><strong>Forecast OHLCV:</strong> ' + escapeHtml_(JSON.stringify(report.forecast)) + '</p>'
      + '<p><strong>Weekly:</strong> ' + escapeHtml_(JSON.stringify(report.patterns.weekly)) + '</p>'
      + '<p><strong>Daily:</strong> ' + escapeHtml_(JSON.stringify(report.patterns.daily)) + '</p>'
      + '<p><strong>Hourly:</strong> ' + escapeHtml_(JSON.stringify(report.patterns.hourly)) + '</p>'
      + '<p><strong>15m:</strong> ' + escapeHtml_(JSON.stringify(report.patterns.m15)) + '</p>'
      + '<p><strong>Repetitions:</strong> ' + escapeHtml_(report.repetitions.join(' | ') || 'None detected') + '</p>';
  }).join('<hr/>');

  return '<html><body>'
    + '<h1>IXIC nightly forecast</h1>'
    + '<p>Symbols source: ' + escapeHtml_(settings.symbolsCsvUrl) + '</p>'
    + reportHtml
    + '<hr/><h2>Gemini analysis</h2><pre style="white-space:pre-wrap;font-family:Arial,sans-serif;">'
    + escapeHtml_(aiResponse)
    + '</pre></body></html>';
}

function detectCrossTimeframeRepetitions_(bundle) {
  const keys = Object.keys(bundle);
  const reps = [];
  for (var i = 0; i < keys.length; i++) {
    for (var j = i + 1; j < keys.length; j++) {
      const a = bundle[keys[i]];
      const b = bundle[keys[j]];
      if (a.structure.trend === b.structure.trend) reps.push(keys[i] + '/' + keys[j] + ': trend=' + a.structure.trend);
      if (a.volumeTrend === b.volumeTrend) reps.push(keys[i] + '/' + keys[j] + ': volume=' + a.volumeTrend);
      const shared = a.candlePatterns.filter(function (pattern) { return b.candlePatterns.indexOf(pattern) !== -1; });
      if (shared.length) reps.push(keys[i] + '/' + keys[j] + ': patterns=' + shared.join(', '));
    }
  }
  return reps;
}

function summarizePatterns_(tf, isMultiDay) {
  return {
    timeframe: tf.timeframe,
    persistence: isMultiDay ? 'multiday' : 'session-fresh',
    patterns: tf.candlePatterns,
    structure: tf.structure,
    volumeTrend: tf.volumeTrend,
  };
}

function buildForecastOhlcv_(daily, hourly, m15) {
  const last = daily.candles[daily.candles.length - 1] || { close: 0 };
  const atr = daily.indicators.ATR14 || 0;
  return {
    openBias: round_(last.close + atr * 0.15),
    highBias: round_(last.close + atr * 0.85),
    lowBias: round_(last.close - atr * 0.65),
    closeBias: round_(last.close + atr * 0.25),
    volumeBias: hourly.volumeTrend || m15.volumeTrend || 'stable',
  };
}

function detectBasicPatterns_(candles) {
  if (candles.length < 2) return [];
  const out = [];
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const body = Math.abs(last.close - last.open);
  const range = Math.max(last.high - last.low, 0.0001);
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  if (body / range < 0.2) out.push('doji');
  if (lowerWick > body * 2 && upperWick < body) out.push('hammer');
  if (upperWick > body * 2 && lowerWick < body) out.push('shooting_star');
  if (prev.close < prev.open && last.close > last.open && last.open <= prev.close && last.close >= prev.open) out.push('bullish_engulfing');
  if (prev.close > prev.open && last.close < last.open && last.open >= prev.close && last.close <= prev.open) out.push('bearish_engulfing');
  return out;
}

function detectStructure_(candles) {
  if (candles.length < 10) return { trend: 'unknown', regime: 'insufficient_data' };
  const closes = candles.map(function (c) { return c.close; });
  const recent = closes.slice(-5);
  const older = closes.slice(-10, -5);
  const recentAvg = avg_(recent);
  const olderAvg = avg_(older);
  let trend = 'sideways';
  if (recentAvg > olderAvg * 1.01) trend = 'up';
  else if (recentAvg < olderAvg * 0.99) trend = 'down';
  const hi = Math.max.apply(null, recent);
  const lo = Math.min.apply(null, recent);
  const compression = (hi - lo) / Math.max(recentAvg, 0.0001);
  return { trend: trend, regime: compression < 0.015 ? 'compression' : 'expansion', recentHigh: hi, recentLow: lo };
}

function detectVolumeTrend_(candles) {
  if (candles.length < 10) return 'unknown';
  const recent = avg_(candles.slice(-5).map(function (c) { return c.volume; }));
  const older = avg_(candles.slice(-10, -5).map(function (c) { return c.volume; }));
  if (recent > older * 1.1) return 'rising';
  if (recent < older * 0.9) return 'falling';
  return 'stable';
}

function checkAndConsumeRateLimit_(settings) {
  const props = PropertiesService.getScriptProperties();
  const now = new Date();
  const dayKey = Utilities.formatDate(now, settings.timezone, 'yyyy-MM-dd');
  const monthKey = Utilities.formatDate(now, settings.timezone, 'yyyy-MM');
  const dailyUsage = JSON.parse(props.getProperty('IXIC_GEMINI_DAILY_USAGE') || '{}');
  const monthlyUsage = JSON.parse(props.getProperty('IXIC_GEMINI_MONTHLY_USAGE') || '{}');
  const dayCount = dailyUsage[dayKey] || 0;
  const monthCount = monthlyUsage[monthKey] || 0;
  if (dayCount >= settings.maxDailyCalls || monthCount >= settings.maxMonthlyCalls) return false;
  dailyUsage[dayKey] = dayCount + 1;
  monthlyUsage[monthKey] = monthCount + 1;
  props.setProperty('IXIC_GEMINI_DAILY_USAGE', JSON.stringify(dailyUsage));
  props.setProperty('IXIC_GEMINI_MONTHLY_USAGE', JSON.stringify(monthlyUsage));
  return true;
}

function isNextMorningMarketOpen_(settings) {
  const now = new Date();
  const tomorrow = new Date(now.getTime());
  tomorrow.setDate(now.getDate() + 1);
  const day = tomorrow.getDay();
  if (day === 0 || day === 6) return false;
  return settings.marketCalendar === 'US_EQUITIES';
}

function loadSymbolsCatalog_(csvUrl) {
  const text = UrlFetchApp.fetch(csvUrl, { muteHttpExceptions: true }).getContentText();
  const rows = Utilities.parseCsv(text);
  return rows.slice(1).map(function (row) {
    return { symbol: row[0], category: row[1] || 'uncategorized' };
  }).filter(function (row) { return row.symbol; });
}

function selectSymbolsFromCatalog_(catalog, primarySymbol, explicitSymbols, categories) {
  const selected = [primarySymbol];
  const categorySet = {};
  categories.forEach(function (category) { categorySet[String(category).toLowerCase()] = true; });
  explicitSymbols.forEach(function (symbol) {
    if (selected.indexOf(symbol) === -1) selected.push(symbol);
  });
  catalog.forEach(function (record) {
    if (selected.length >= 12) return;
    if (!categories.length || categorySet[String(record.category).toLowerCase()]) {
      if (selected.indexOf(record.symbol) === -1) selected.push(record.symbol);
    }
  });
  return selected;
}

function splitCsv_(value) {
  return String(value || '').split(',').map(function (item) { return item.trim(); }).filter(Boolean);
}
function avg_(values) { return values.length ? values.reduce(function (a, b) { return a + b; }, 0) / values.length : 0; }
function round_(value) { return Math.round(value * 100) / 100; }
function sma_(candles, len) { return candles.length < len ? null : round_(avg_(candles.slice(-len).map(function (c) { return c.close; }))); }
function ema_(candles, len) { if (candles.length < len) return null; var k = 2 / (len + 1); var value = candles[candles.length - len].close; for (var i = candles.length - len + 1; i < candles.length; i++) value = candles[i].close * k + value * (1 - k); return round_(value); }
function rsi_(candles, len) { if (candles.length <= len) return null; var gains = 0; var losses = 0; for (var i = candles.length - len; i < candles.length; i++) { var change = candles[i].close - candles[i - 1].close; if (change > 0) gains += change; else losses += Math.abs(change); } if (!losses) return 100; var rs = gains / losses; return round_(100 - 100 / (1 + rs)); }
function macd_(candles) { var ema12 = ema_(candles, 12); var ema26 = ema_(candles, 26); return ema12 == null || ema26 == null ? null : round_(ema12 - ema26); }
function atr_(candles, len) { if (candles.length <= len) return null; var trs = []; for (var i = candles.length - len; i < candles.length; i++) { var prevClose = candles[i - 1].close; trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - prevClose), Math.abs(candles[i].low - prevClose))); } return round_(avg_(trs)); }
function vwap_(candles) { var pv = 0; var vol = 0; candles.forEach(function (c) { var typical = (c.high + c.low + c.close) / 3; pv += typical * c.volume; vol += c.volume; }); return vol ? round_(pv / vol) : null; }
function escapeHtml_(text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function jsonOut_(payload, code) { const out = ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); if (code && out.setResponseCode) out.setResponseCode(code); return out; }
