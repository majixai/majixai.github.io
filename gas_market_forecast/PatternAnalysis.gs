function buildSymbolReport_(symbol, projectConfig) {
  const bundle = fetchMarketDataBundle_(symbol, projectConfig);
  const weekly = analyzeTimeframe_(bundle.weekly, 'weekly', true);
  const daily = analyzeTimeframe_(bundle.daily, 'daily', true);
  const hourly = analyzeTimeframe_(bundle.hourly, 'hourly', false);
  const m15 = analyzeTimeframe_(bundle.m15, '15m', false);
  return {
    symbol: symbol,
    generatedAt: new Date().toISOString(),
    forecast: buildOhlcvForecast_(daily, hourly, m15),
    patterns: {
      weekly: summarizeTimeframe_(weekly),
      daily: summarizeTimeframe_(daily),
      hourly: summarizeTimeframe_(hourly),
      m15: summarizeTimeframe_(m15)
    },
    repetitions: detectCrossTimeframeRepetitions_([weekly, daily, hourly, m15]),
    rawContext: {
      weeklyBars: bundle.weekly.length,
      dailyBars: bundle.daily.length,
      hourlyBars: bundle.hourly.length,
      m15Bars: bundle.m15.length
    }
  };
}

function analyzeTimeframe_(candles, timeframe, isMultiDay) {
  const closes = candles.map(function(candle) { return candle.close; });
  const highs = candles.map(function(candle) { return candle.high; });
  const lows = candles.map(function(candle) { return candle.low; });
  const volumes = candles.map(function(candle) { return candle.volume; });
  const indicators = {
    sma20: sma_(closes, 20),
    ema9: ema_(closes, 9),
    ema21: ema_(closes, 21),
    rsi14: rsi_(closes, 14),
    atr14: atr_(candles, 14),
    macd: macd_(closes),
    vwap: vwap_(candles),
    obv: obv_(candles)
  };
  const tags = [];
  const lastClose = closes[closes.length - 1];
  if (lastClose != null && indicators.ema21 != null) {
    tags.push(lastClose >= indicators.ema21 ? 'price_above_ema21' : 'price_below_ema21');
  }
  if (indicators.rsi14 != null) {
    if (indicators.rsi14 >= 60) tags.push('rsi_bullish');
    else if (indicators.rsi14 <= 40) tags.push('rsi_bearish');
  }
  if (indicators.macd && indicators.macd.line != null && indicators.macd.signal != null) {
    tags.push(indicators.macd.line >= indicators.macd.signal ? 'macd_bullish' : 'macd_bearish');
  }
  const structure = detectStructure_(closes, highs, lows, volumes);
  Array.prototype.push.apply(tags, structure.tags);
  Array.prototype.push.apply(tags, detectCandlestickPatterns_(candles));
  return {
    timeframe: timeframe,
    persistence: isMultiDay ? 'multiday' : 'session_reset',
    candles: candles,
    indicators: indicators,
    structure: structure,
    tags: uniqueList_(tags)
  };
}

function summarizeTimeframe_(analysis) {
  return {
    timeframe: analysis.timeframe,
    persistence: analysis.persistence,
    lastClose: roundTo_(analysis.candles.length ? analysis.candles[analysis.candles.length - 1].close : null, 2),
    structure: analysis.structure.summary,
    tags: analysis.tags,
    indicators: analysis.indicators
  };
}

function detectStructure_(closes, highs, lows, volumes) {
  if (closes.length < 5) {
    return { summary: 'insufficient bars', tags: ['insufficient_bars'], trend: 'unknown', regime: 'unknown' };
  }
  const recentCloses = closes.slice(-5);
  const earlierCloses = closes.slice(-10, -5).length ? closes.slice(-10, -5) : closes.slice(0, Math.max(closes.length - 5, 1));
  const recentAvg = average_(recentCloses);
  const earlierAvg = average_(earlierCloses);
  let trend = 'sideways';
  if (recentAvg > earlierAvg * 1.01) trend = 'up';
  if (recentAvg < earlierAvg * 0.99) trend = 'down';
  const recentHigh = Math.max.apply(null, highs.slice(-5));
  const recentLow = Math.min.apply(null, lows.slice(-5));
  const compression = recentAvg ? (recentHigh - recentLow) / recentAvg : 0;
  const regime = compression < 0.02 ? 'compression' : 'expansion';
  const recentVolume = average_(volumes.slice(-5));
  const earlierVolume = average_(volumes.slice(-10, -5).length ? volumes.slice(-10, -5) : volumes.slice(0, Math.max(volumes.length - 5, 1)));
  let volumePosture = 'stable_volume';
  if (recentVolume > earlierVolume * 1.1) volumePosture = 'rising_volume';
  if (recentVolume < earlierVolume * 0.9) volumePosture = 'falling_volume';
  return {
    summary: [trend + ' trend', regime, volumePosture.replace('_', ' ')].join(', '),
    tags: ['trend_' + trend, regime, volumePosture],
    trend: trend,
    regime: regime,
    volumePosture: volumePosture
  };
}

function detectCandlestickPatterns_(candles) {
  if (candles.length < 2) {
    return [];
  }
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const body = Math.abs(last.close - last.open);
  const range = Math.max(0.0001, last.high - last.low);
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const tags = [];
  if (body / range < 0.2) tags.push('doji');
  if (lowerWick > body * 1.8 && upperWick < body) tags.push('hammer');
  if (upperWick > body * 1.8 && lowerWick < body) tags.push('shooting_star');
  if (last.high <= prev.high && last.low >= prev.low) tags.push('inside_bar');
  if (last.high >= prev.high && last.low <= prev.low) tags.push('outside_bar');
  if (prev.close < prev.open && last.close > last.open && last.close >= prev.open && last.open <= prev.close) tags.push('bullish_engulfing');
  if (prev.close > prev.open && last.close < last.open && last.open >= prev.close && last.close <= prev.open) tags.push('bearish_engulfing');
  return tags;
}

function detectCrossTimeframeRepetitions_(analyses) {
  const counts = {};
  analyses.forEach(function(analysis) {
    analysis.tags.forEach(function(tag) {
      counts[tag] = counts[tag] || [];
      counts[tag].push(analysis.timeframe);
    });
  });
  return Object.keys(counts)
    .filter(function(tag) { return counts[tag].length > 1; })
    .sort()
    .map(function(tag) {
      return {
        tag: tag,
        timeframes: counts[tag],
        summary: tag + ' repeated across ' + counts[tag].join(', ')
      };
    });
}

function buildOhlcvForecast_(daily, hourly, m15) {
  const lastDaily = daily.candles[daily.candles.length - 1];
  const atr = daily.indicators.atr14 || Math.max((lastDaily.high - lastDaily.low), 1);
  const trendScore = scoreTrendBias_(daily) + scoreTrendBias_(hourly) * 0.6 + scoreTrendBias_(m15) * 0.4;
  const normalizedBias = Math.max(-1.5, Math.min(1.5, trendScore / 3));
  const open = lastDaily.close + atr * normalizedBias * 0.15;
  const high = lastDaily.close + atr * (0.75 + Math.max(0, normalizedBias) * 0.35);
  const low = lastDaily.close - atr * (0.75 + Math.max(0, -normalizedBias) * 0.35);
  const close = lastDaily.close + atr * normalizedBias * 0.3;
  return {
    nextOpen: roundTo_(open, 2),
    nextHigh: roundTo_(Math.max(high, open, close), 2),
    nextLow: roundTo_(Math.min(low, open, close), 2),
    nextClose: roundTo_(close, 2),
    nextVolumeBias: daily.structure.volumePosture,
    biasScore: roundTo_(normalizedBias, 2)
  };
}

function scoreTrendBias_(analysis) {
  let score = 0;
  if (analysis.structure.trend === 'up') score += 1;
  if (analysis.structure.trend === 'down') score -= 1;
  if (analysis.tags.indexOf('macd_bullish') !== -1) score += 0.5;
  if (analysis.tags.indexOf('macd_bearish') !== -1) score -= 0.5;
  if (analysis.tags.indexOf('rsi_bullish') !== -1) score += 0.5;
  if (analysis.tags.indexOf('rsi_bearish') !== -1) score -= 0.5;
  return score;
}

function sma_(values, length) {
  if (values.length < length) return null;
  return roundTo_(average_(values.slice(-length)), 4);
}

function ema_(values, length) {
  if (values.length < length) return null;
  const multiplier = 2 / (length + 1);
  let current = average_(values.slice(0, length));
  for (let index = length; index < values.length; index += 1) {
    current = (values[index] - current) * multiplier + current;
  }
  return roundTo_(current, 4);
}

function rsi_(values, length) {
  if (values.length <= length) return null;
  let gains = 0;
  let losses = 0;
  for (let index = values.length - length; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return roundTo_(100 - (100 / (1 + rs)), 2);
}

function atr_(candles, length) {
  if (candles.length <= length) return null;
  const trueRanges = [];
  for (let index = candles.length - length; index < candles.length; index += 1) {
    const current = candles[index];
    const previousClose = candles[index - 1].close;
    trueRanges.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - previousClose),
      Math.abs(current.low - previousClose)
    ));
  }
  return roundTo_(average_(trueRanges), 4);
}

function macd_(values) {
  if (values.length < 35) return { line: null, signal: null, histogram: null };
  const ema12Series = emaSeries_(values, 12);
  const ema26Series = emaSeries_(values, 26);
  const macdSeries = [];
  for (let index = 0; index < values.length; index += 1) {
    if (ema12Series[index] != null && ema26Series[index] != null) {
      macdSeries[index] = ema12Series[index] - ema26Series[index];
    } else {
      macdSeries[index] = null;
    }
  }
  const compactMacd = macdSeries.filter(function(value) { return value != null; });
  const signal = ema_(compactMacd, 9);
  const line = compactMacd.length ? roundTo_(compactMacd[compactMacd.length - 1], 4) : null;
  return {
    line: line,
    signal: signal,
    histogram: line != null && signal != null ? roundTo_(line - signal, 4) : null
  };
}

function emaSeries_(values, length) {
  const result = [];
  if (values.length < length) return result;
  const multiplier = 2 / (length + 1);
  let current = average_(values.slice(0, length));
  for (let index = 0; index < values.length; index += 1) {
    if (index < length - 1) {
      result[index] = null;
    } else if (index === length - 1) {
      result[index] = current;
    } else {
      current = (values[index] - current) * multiplier + current;
      result[index] = current;
    }
  }
  return result;
}

function vwap_(candles) {
  if (!candles.length) return null;
  let priceVolume = 0;
  let totalVolume = 0;
  candles.forEach(function(candle) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    priceVolume += typicalPrice * candle.volume;
    totalVolume += candle.volume;
  });
  return totalVolume ? roundTo_(priceVolume / totalVolume, 4) : null;
}

function obv_(candles) {
  if (candles.length < 2) return null;
  let obv = 0;
  for (let index = 1; index < candles.length; index += 1) {
    if (candles[index].close > candles[index - 1].close) obv += candles[index].volume;
    else if (candles[index].close < candles[index - 1].close) obv -= candles[index].volume;
  }
  return obv;
}

function uniqueList_(values) {
  return values.filter(function(value, index) {
    return values.indexOf(value) === index;
  });
}
