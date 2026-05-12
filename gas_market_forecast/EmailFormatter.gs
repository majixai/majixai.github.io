function buildForecastEmailSubject_(symbolReports, nextSession) {
  return 'Nightly Market Forecast • ' + nextSession.nextSessionDate + ' • ' + symbolReports.map(function(report) {
    return report.symbol;
  }).join(', ');
}

function buildForecastEmailHtml_(projectConfig, nextSession, symbolReports, geminiResponse) {
  const repetitionHtml = symbolReports.map(function(report) {
    return '<li><strong>' + escapeHtml_(report.symbol) + ':</strong> ' + escapeHtml_((report.repetitions[0] && report.repetitions[0].summary) || 'No repeated pattern tags across timeframes.') + '</li>';
  }).join('');

  const cards = symbolReports.map(function(report) {
    return [
      '<section style="border:1px solid #d8dee9;border-radius:12px;padding:16px;margin:0 0 16px 0;">',
      '<h2 style="margin:0 0 8px 0;">' + escapeHtml_(report.symbol) + '</h2>',
      '<p style="margin:0 0 12px 0;"><strong>Forecast OHLCV:</strong> open ' + escapeHtml_(report.forecast.nextOpen) +
        ', high ' + escapeHtml_(report.forecast.nextHigh) + ', low ' + escapeHtml_(report.forecast.nextLow) +
        ', close ' + escapeHtml_(report.forecast.nextClose) + ', volume ' + escapeHtml_(report.forecast.nextVolumeBias) + '.</p>',
      buildTimeframeHtml_('Weekly', report.patterns.weekly),
      buildTimeframeHtml_('Daily', report.patterns.daily),
      buildTimeframeHtml_('Hourly', report.patterns.hourly),
      buildTimeframeHtml_('15 Minute', report.patterns.m15),
      '<p style="margin:12px 0 0 0;"><strong>Repeated tags:</strong> ' + escapeHtml_(report.repetitions.map(function(item) { return item.tag; }).join(', ') || 'none') + '</p>',
      '</section>'
    ].join('');
  }).join('');

  return [
    '<html><body style="font-family:Arial,sans-serif;color:#1f2933;line-height:1.45;">',
    '<h1 style="margin-bottom:8px;">Nightly Market Forecast</h1>',
    '<p style="margin-top:0;">GitHub remains the source of truth for this project directory and prompt pack. Next session: <strong>' + escapeHtml_(nextSession.nextSessionDate) + '</strong>.</p>',
    cards,
    '<section style="border:1px solid #d8dee9;border-radius:12px;padding:16px;margin:0 0 16px 0;">',
    '<h2 style="margin-top:0;">Cross-timeframe repetition highlights</h2>',
    '<ul>' + repetitionHtml + '</ul>',
    '</section>',
    '<section style="border:1px solid #d8dee9;border-radius:12px;padding:16px;">',
    '<h2 style="margin-top:0;">Gemini analytical output</h2>',
    '<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;margin:0;">' + escapeHtml_(geminiResponse.text || 'No Gemini output returned.') + '</pre>',
    '<p style="margin-top:12px;color:#52606d;">Gemini usage this period: daily ' + escapeHtml_(geminiResponse.usage.dailyUsed) + '/' + escapeHtml_(geminiResponse.usage.dailyLimit) + ', monthly ' + escapeHtml_(geminiResponse.usage.monthlyUsed) + '/' + escapeHtml_(geminiResponse.usage.monthlyLimit) + '.</p>',
    '</section>',
    '</body></html>'
  ].join('');
}

function buildTimeframeHtml_(label, pattern) {
  const indicators = pattern.indicators || {};
  const macd = indicators.macd || {};
  return [
    '<h3 style="margin:12px 0 4px 0;">' + escapeHtml_(label) + ' (' + escapeHtml_(pattern.persistence) + ')</h3>',
    '<p style="margin:0 0 6px 0;">' + escapeHtml_(pattern.structure) + '</p>',
    '<p style="margin:0 0 6px 0;"><strong>Tags:</strong> ' + escapeHtml_((pattern.tags || []).join(', ') || 'n/a') + '</p>',
    '<p style="margin:0;"><strong>Indicators:</strong> SMA20 ' + escapeHtml_(indicators.sma20) +
      ' · EMA9 ' + escapeHtml_(indicators.ema9) + ' · EMA21 ' + escapeHtml_(indicators.ema21) +
      ' · RSI14 ' + escapeHtml_(indicators.rsi14) + ' · ATR14 ' + escapeHtml_(indicators.atr14) +
      ' · MACD ' + escapeHtml_(macd.line) + '/' + escapeHtml_(macd.signal) + ' · VWAP ' + escapeHtml_(indicators.vwap) + '</p>'
  ].join('');
}

function buildForecastPlainText_(nextSession, symbolReports, geminiResponse) {
  const lines = [
    'Nightly Market Forecast',
    'Next session: ' + nextSession.nextSessionDate,
    ''
  ];
  symbolReports.forEach(function(report) {
    lines.push(report.symbol + ': O=' + report.forecast.nextOpen + ' H=' + report.forecast.nextHigh + ' L=' + report.forecast.nextLow + ' C=' + report.forecast.nextClose + ' V=' + report.forecast.nextVolumeBias);
    lines.push('  Weekly: ' + report.patterns.weekly.structure);
    lines.push('  Daily: ' + report.patterns.daily.structure);
    lines.push('  Hourly: ' + report.patterns.hourly.structure);
    lines.push('  15m: ' + report.patterns.m15.structure);
    lines.push('  Repetitions: ' + (report.repetitions.map(function(item) { return item.tag; }).join(', ') || 'none'));
    lines.push('');
  });
  lines.push(geminiResponse.text || 'No Gemini output returned.');
  return lines.join('\n');
}
