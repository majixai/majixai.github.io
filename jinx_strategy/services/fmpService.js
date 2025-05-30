import {
    FMP_API_BASE_URL, getFMPApiKey,
    FMP_PROFILE_CACHE_DURATION, FMP_QUOTE_CACHE_DURATION,
    FMP_HISTORICAL_CACHE_DURATION_DAILY, FMP_HISTORICAL_CACHE_DURATION_INTRADAY
} from '../constants.js'; // Assuming .js extension
import {
    OptionType,
    // FMPProfile, FMPQuote, FMPOption, FMPOptionChain, OptionsChainData,
    // OptionChainEntry, CachedFMPProfile, CachedFMPQuote, FMHistoricalPrice,
    // FMPCacheHistoricalEntry  // These are effectively JSDoc types now
} from '../types.js'; // Assuming .js extension
import { getFMPCacheFromDB, saveFMPCacheToDB, getFMPHistoricalCacheFromDB, saveFMPHistoricalCacheToDB } from './indexedDBService.js'; // Assuming .js
import * as sqliteService from './sqliteService.js'; // For SQLite mirror, assuming .js

/**
 * @template T
 * @param {string} endpoint
 * @param {Record<string, string>} [params={}]
 * @returns {Promise<T | { error: string }>}
 */
const fetchFMPDataAPI = async (endpoint, params = {}) => {
  const apiKey = getFMPApiKey();
  const queryString = new URLSearchParams({ ...params, apikey: apiKey }).toString();
  const url = `${FMP_API_BASE_URL}/${endpoint}?${queryString}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error(`FMP API Error (${response.status}) for ${endpoint}:`, errorData);
      const errorMessage = errorData?.['Error Message'] || errorData?.message || response.statusText || `FMP API request failed with status ${response.status}`;
      return { error: `FMP Error: ${errorMessage}` };
    }
    const data = await response.json();
    if (Array.isArray(data) && data.length === 0 && (endpoint.includes('profile') || endpoint.includes('quote') || endpoint.includes('historical-chart'))) {
        // For historical-chart, an empty array is a valid response if no data for the range.
        if (endpoint.includes('historical-chart')) return data; // Cast to T is implicit
        return { error: `FMP Error: No data found for the ticker in ${endpoint}.` };
    }
    if (data && typeof data === 'object' && data['Error Message']) {
        return { error: `FMP Error: ${data['Error Message']}` };
    }
    return data; // Cast to T is implicit
  } catch (error) {
    console.error(`Network or parsing error fetching FMP data for ${endpoint}:`, error);
    const message = error instanceof Error ? error.message : "Unknown network error";
    return { error: `Network error with FMP: ${message}` };
  }
};

/**
 * @param {string} ticker
 * @returns {Promise<import('../types.js').FMPProfile | null>}
 */
export const getCompanyProfileFMP = async (ticker) => {
  const cacheKey = `${ticker.toUpperCase()}_profile`;
  /** @type {import('../types.js').CachedFMPProfile | null} */
  const cachedEntry = await getFMPCacheFromDB(cacheKey);

  if (cachedEntry && (Date.now() - cachedEntry.timestamp < FMP_PROFILE_CACHE_DURATION)) {
    console.log(`FMP: Using cached profile for ${ticker}`);
    return cachedEntry.data;
  }

  console.log(`FMP: Fetching live profile for ${ticker}`);
  const result = await fetchFMPDataAPI(`profile/${ticker.toUpperCase()}`);
  if ('error' in result) {
    console.error(result.error);
    return null;
  }
  const profileData = result[0] || null;
  if (profileData) {
    /** @type {import('../types.js').CachedFMPProfile} */
    const newCacheEntry = { id: cacheKey, data: profileData, timestamp: Date.now() };
    await saveFMPCacheToDB(newCacheEntry);
    await sqliteService.saveFMPProfileToSQLite(ticker.toUpperCase(), profileData, newCacheEntry.timestamp);
  }
  return profileData;
};

/**
 * @param {string} ticker
 * @returns {Promise<import('../types.js').FMPQuote | null>}
 */
export const getQuoteFMP = async (ticker) => {
  const cacheKey = `${ticker.toUpperCase()}_quote`;
  /** @type {import('../types.js').CachedFMPQuote | null} */
  const cachedEntry = await getFMPCacheFromDB(cacheKey);

  if (cachedEntry && (Date.now() - cachedEntry.timestamp < FMP_QUOTE_CACHE_DURATION)) {
    console.log(`FMP: Using cached quote for ${ticker}`);
    return cachedEntry.data;
  }

  console.log(`FMP: Fetching live quote for ${ticker}`);
  const result = await fetchFMPDataAPI(`quote/${ticker.toUpperCase()}`);
   if ('error' in result) {
    console.error(result.error);
    return null;
  }
  const quoteData = result[0] || null;
  if (quoteData) {
    /** @type {import('../types.js').CachedFMPQuote} */
    const newCacheEntry = { id: cacheKey, data: quoteData, timestamp: Date.now() };
    await saveFMPCacheToDB(newCacheEntry);
    await sqliteService.saveFMPQuoteToSQLite(ticker.toUpperCase(), quoteData, newCacheEntry.timestamp);
  }
  return quoteData;
};

/**
 * @param {string} ticker
 * @param {number} [targetExpirationDays=45]
 * @returns {Promise<import('../types.js').OptionsChainData | null>}
 */
export const getOptionsChainFMP = async (ticker, targetExpirationDays = 45) => {
  const expirationDatesResult = await fetchFMPDataAPI(`stock_option_chain_exp_date/${ticker.toUpperCase()}`);
  if ('error' in expirationDatesResult) {
    console.error("FMP: Failed to fetch expiration dates:", expirationDatesResult.error);
    return null;
  }
  if (!expirationDatesResult || expirationDatesResult.length === 0) {
    console.warn("FMP: No expiration dates found for", ticker);
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let closestExpiration = null;
  let smallestDiff = Infinity;

  for (const expStr of expirationDatesResult) {
    const expDate = new Date(expStr);
    expDate.setUTCHours(0,0,0,0);
    const diffDays = (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && Math.abs(diffDays - targetExpirationDays) < smallestDiff) {
      smallestDiff = Math.abs(diffDays - targetExpirationDays);
      closestExpiration = expStr;
    }
  }

  if (!closestExpiration) {
    console.warn("FMP: Could not find a suitable future expiration date for", ticker);
    for (const expStr of expirationDatesResult) {
        const expDate = new Date(expStr);
        expDate.setUTCHours(0,0,0,0);
        const diffDays = (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0) {
            closestExpiration = expStr; // Fallback to first available future date
            break;
        }
    }
    if (!closestExpiration) return null;
  }

  console.log(`FMP: Delaying chain fetch for ${ticker} by 2000ms after getting expiration dates.`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  const chainResult = await fetchFMPDataAPI(`stock_option_chain/${ticker.toUpperCase()}`, { date: closestExpiration });

  if ('error' in chainResult) {
    console.error(`FMP: Failed to fetch options chain for ${ticker} on ${closestExpiration}:`, chainResult.error);
    return null;
  }
  if (!chainResult || chainResult.length === 0) {
    console.warn(`FMP: No options data found for ${ticker} on ${closestExpiration}`);
    return null;
  }

  /** @type {import('../types.js').OptionChainEntry[]} */
  const calls = [];
  /** @type {import('../types.js').OptionChainEntry[]} */
  const puts = [];
  let currentStockPriceForChain;

  chainResult.forEach((fmpOpt) => {
    const optionTypeMatch = fmpOpt.optionSymbol.match(/([CP])(\d+)$/);
    if (!optionTypeMatch) return;

    const optionType = optionTypeMatch[1] === 'C' ? OptionType.Call : OptionType.Put;
    const underlyingPrice = fmpOpt.underlyingLastPrice || fmpOpt.stockPrice || undefined;
    if (underlyingPrice && !currentStockPriceForChain) {
        currentStockPriceForChain = underlyingPrice;
    }

    /** @type {import('../types.js').OptionChainEntry} */
    const entry = {
      strike: fmpOpt.strike, bid: fmpOpt.bid, ask: fmpOpt.ask, last: fmpOpt.lastPrice,
      mid: (fmpOpt.bid && fmpOpt.ask) ? parseFloat(((fmpOpt.bid + fmpOpt.ask) / 2).toFixed(4)) : null,
      openInterest: fmpOpt.openInterest, volume: fmpOpt.volume, expirationDate: fmpOpt.expirationDate,
      impliedVolatility: fmpOpt.impliedVolatility, delta: fmpOpt.delta, gamma: fmpOpt.gamma,
      theta: fmpOpt.theta, vega: fmpOpt.vega, parity: null,
    };

    if (optionType === OptionType.Call) calls.push(entry);
    else puts.push(entry);
  });

  calls.sort((a, b) => a.strike - b.strike);
  puts.sort((a, b) => a.strike - b.strike);

  return {
    expirationDate: closestExpiration, calls, puts,
    currentStockPriceForChain: currentStockPriceForChain, source: 'fmp',
  };
};

/**
 * @param {string} ticker
 * @param {string} [from] YYYY-MM-DD
 * @param {string} [to] YYYY-MM-DD
 * @param {'1min' | '5min' | '15min' | '30min' | '1hour' | '4hour' | '1day'} [interval='1day']
 * @returns {Promise<import('../types.js').FMHistoricalPrice[] | null>}
 */
export const getHistoricalCandlesFMP = async (
    ticker,
    from, // YYYY-MM-DD
    to,   // YYYY-MM-DD
    interval = '1day'
) => {
    const cacheKey = `${ticker.toUpperCase()}_${interval}_${from || 'start'}_${to || 'end'}`;
    const cacheDuration = interval === '1day' ? FMP_HISTORICAL_CACHE_DURATION_DAILY : FMP_HISTORICAL_CACHE_DURATION_INTRADAY;

    /** @type {import('../types.js').FMPCacheHistoricalEntry | null} */
    const cachedEntry = await getFMPHistoricalCacheFromDB(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < cacheDuration)) {
        console.log(`FMP: Using cached ${interval} historical data for ${ticker} from ${from} to ${to}`);
        return cachedEntry.data;
    }

    console.log(`FMP: Fetching live ${interval} candles for ${ticker} from ${from} to ${to}`);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;

    const result = await fetchFMPDataAPI(`historical-chart/${interval}/${ticker.toUpperCase()}`, params);

    if ('error' in result) {
        console.error(`FMP: Failed to fetch ${interval} historical candles for ${ticker}:`, result.error);
        return null; // Error occurred
    }
    // An empty array is a valid response if FMP has no data for that range/ticker, not an error.
    if (!result) { // Should not happen if API returns array or error object
        console.warn(`FMP: Unexpected null/undefined result for ${interval} historical data for ${ticker}.`);
        return [];
    }

    const sortedResult = result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    /** @type {import('../types.js').FMPCacheHistoricalEntry} */
    const newCacheEntry = { id: cacheKey, data: sortedResult, timestamp: Date.now() };
    await saveFMPHistoricalCacheToDB(newCacheEntry);
    // No direct SQLite mirror for historical candle arrays for now to keep SQLite lean. IDB is sufficient.

    return sortedResult;
};
