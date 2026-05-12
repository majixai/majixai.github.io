function fetchMarketDataBundle_(symbol, projectConfig) {
  const apiKey = projectConfig.runtime.marketDataApiKey;
  const requestDelayMs = toNumberOrDefault_(projectConfig.defaults.marketDataDelayMs, NIGHTLY_MARKET_FORECAST.defaultMarketDataDelayMs);
  const bundle = {};
  bundle.weekly = fetchAlphaVantageTimeSeries_(symbol, 'TIME_SERIES_WEEKLY', null, apiKey, NIGHTLY_MARKET_FORECAST.defaultWeeklyLookback);
  Utilities.sleep(requestDelayMs);
  bundle.daily = fetchAlphaVantageTimeSeries_(symbol, 'TIME_SERIES_DAILY', null, apiKey, NIGHTLY_MARKET_FORECAST.defaultDailyLookback);
  Utilities.sleep(requestDelayMs);
  bundle.hourly = filterIntradaySession_(fetchAlphaVantageTimeSeries_(
    symbol,
    'TIME_SERIES_INTRADAY',
    '60min',
    apiKey,
    NIGHTLY_MARKET_FORECAST.defaultIntradayLookback
  ));
  Utilities.sleep(requestDelayMs);
  bundle.m15 = filterIntradaySession_(fetchAlphaVantageTimeSeries_(
    symbol,
    'TIME_SERIES_INTRADAY',
    '15min',
    apiKey,
    NIGHTLY_MARKET_FORECAST.defaultIntradayLookback
  ));
  Object.keys(bundle).forEach(function(timeframe) {
    if (!bundle[timeframe] || !bundle[timeframe].length) {
      throw new Error('No ' + timeframe + ' candles returned for ' + symbol);
    }
  });
  return bundle;
}

function fetchAlphaVantageTimeSeries_(symbol, fn, interval, apiKey, lookback) {
  let url = 'https://www.alphavantage.co/query?symbol=' + encodeURIComponent(symbol) + '&function=' + encodeURIComponent(fn) + '&datatype=json&outputsize=compact&apikey=' + encodeURIComponent(apiKey);
  if (interval) {
    url += '&interval=' + encodeURIComponent(interval) + '&extended_hours=false';
  }
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Market data request failed for ' + symbol + ' (' + fn + '): ' + response.getResponseCode());
  }
  const payload = JSON.parse(response.getContentText());
  if (payload['Error Message']) {
    throw new Error('Market data error for ' + symbol + ': ' + payload['Error Message']);
  }
  if (payload.Note) {
    throw new Error('Market data provider note for ' + symbol + ': ' + payload.Note);
  }
  const seriesKey = Object.keys(payload).filter(function(key) {
    return /Time Series/i.test(key);
  })[0];
  if (!seriesKey || !payload[seriesKey]) {
    throw new Error('No time series returned for ' + symbol + ' (' + fn + ')');
  }
  return Object.keys(payload[seriesKey])
    .sort()
    .slice(-lookback)
    .map(function(timestamp) {
      const point = payload[seriesKey][timestamp];
      return {
        timestamp: timestamp,
        sessionDate: timestamp.slice(0, 10),
        open: Number(point['1. open']),
        high: Number(point['2. high']),
        low: Number(point['3. low']),
        close: Number(point['4. close']),
        volume: Number(point['5. volume']) || 0
      };
    });
}

function filterIntradaySession_(candles) {
  if (!candles.length) {
    return candles;
  }
  const latestSessionDate = candles[candles.length - 1].sessionDate;
  return candles.filter(function(candle) {
    return candle.sessionDate === latestSessionDate;
  });
}
