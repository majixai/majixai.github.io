/**
 * MarketMovers Code.gs
 * Handles data fetching (scraping & GOOGLEFINANCE), calculations,
 * trigger management, and email generation.
 */

// ---------------------------------------------------------------------------------------------------------------------------------- //
// --- Configuration Section ---
// --- MODIFY THESE VALUES ---
// ---------------------------------------------------------------------------------------------------------------------------------- //
const CONFIG_MM = {
  ticker: "TSLA", // Default ticker (used elsewhere if needed, not directly here)
  benchmarkTicker: ".DJI", // For general history (will be used directly here, but reference)
  histDataDays: 252, // Days for general history
  // TradingView Scraper Config
  // URLs are kept as part of main config for easier access if needed later
  preMarketGainers: "https://www.tradingview.com/markets/stocks-usa/market-movers-pre-market-gainers/",
  preMarketGappers: "https://www.tradingview.com/markets/stocks-usa/market-movers-pre-market-gappers/",
  afterHoursActive: "https://www.tradingview.com/markets/stocks-usa/market-movers-active-after-hours/",
  afterHoursGainers: "https://www.tradingview.com/markets/stocks-usa/market-movers-after-hours-gainers/",
  dailyGainers: "https://www.tradingview.com/markets/stocks-usa/market-movers-gainers/",
  unusualVolume: "https://www.tradingview.com/markets/stocks-usa/market-movers-unusual-volume/",
  // Detail Calculation Config
  benchmarkForCovar: "SPY", // Benchmark for covariance calc
  histDataPeriodDetails: 60, // Days of data for detail calculations (MACD, RSI etc.)
  smaPeriodDetails: 10, // SMA Period used in detail calculations/chart
  // Email Config
  recipientEmail: "your_email@example.com", // Default/Fallback recipient
  emailSubjectPrefix: "Market Movers Report"
};

// --- Constants ---
const TRADING_DAYS_PER_YEAR_MM = 252;

// --- Property keys for UserProperties ---
const PROP_KEYS = {
  DAILY_EMAIL_ENABLED: 'MM_DAILY_EMAIL_ENABLED', // Stored as 'true'/'false'
  DAILY_EMAIL_IDENTIFIER: 'MM_DAILY_EMAIL_IDENTIFIER',
  DAILY_EMAIL_TIME: 'MM_DAILY_EMAIL_TIME', // Stored as HH:MM string
  DAILY_EMAIL_RECIPIENT: 'MM_DAILY_EMAIL_RECIPIENT',
  DAILY_INCLUDE_DETAILS: 'MM_DAILY_INCLUDE_DETAILS', // Stored as 'true'/'false'
  DAILY_TRIGGER_ID: 'MM_DAILY_TRIGGER_ID' // Store ID of created trigger
};

const DAILY_EMAIL_HANDLER_FUNCTION = 'dailyMarketMoverEmailHandler'; // Name of function triggered daily

// ---------------------------------------------------------------------------------------------------------------------------------- //
// --- UI Functions (Sidebar Menu) ---
// ---------------------------------------------------------------------------------------------------------------------------------- //
/**
 * Opens the sidebar UI. */
function showMarketMoversSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('MarketMovers_Sidebar')
      .setTitle('Market Movers')
      .setWidth(370); // Slightly wider for new layout potentially
  SpreadsheetApp.getUi().showSidebar(html);
}

// ---------------------------------------------------------------------------------------------------------------------------------- //
// --- Calculation Helper Functions ---
// ---------------------------------------------------------------------------------------------------------------------------------- //
/** Calculates Simple Moving Average (SMA) */
function calculateSMA_MM(data, period) {
  if (!data || data.length < period) return NaN;
  const relevantData = data.slice(-period);
  // Filter out non-numeric values before summing
  let sum = 0;
  let count = 0;
  relevantData.filter(v => typeof v === 'number' && !isNaN(v)).forEach(v => { sum += v; count++; }); // Handle potential NaNs in input
  if (count < period) return NaN; // Not enough valid numbers
  return sum / count;
}

/** Calculates Exponential Moving Average (EMA) */
function calculateEMA(data, period) {
  if (!data || data.length < period) return new Array(data.length).fill(NaN);
  const k = 2 / (period + 1);
  const emaValues = new Array(data.length).fill(NaN);

  let firstValidIndex = -1;
  let initialSma = 0;
  // Find first valid starting SMA
  for (let i = period - 1; i < data.length; i++) {
    const initialData = data.slice(i - period + 1, i + 1);
    if (initialData.every(d => !isNaN(d))) {
      initialSma = initialData.reduce((a, b) => a + b, 0) / period;
      firstValidIndex = i;
      break;
    }
  }

  if (firstValidIndex === -1) return emaValues;

  emaValues[firstValidIndex] = initialSma;
  for (let i = firstValidIndex + 1; i < data.length; i++) {
    if (!isNaN(data[i]) && !isNaN(emaValues[i-1])) { // Need current price and previous EMA
      emaValues[i] = (data[i] * k) + (emaValues[i-1] * (1 - k));
    } else {
      emaValues[i] = emaValues[i-1];
    }
  }
  return emaValues;
}

/** Calculates MACD (Moving Average Convergence Divergence) */
function calculateMACD(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  const minLength = longPeriod + signalPeriod;
  if (!data || data.length < minLength) return { macdLine: [], signalLine: [], histogram: [] };

  const emaShort = calculateEMA(data, shortPeriod);
  const emaLong = calculateEMA(data, longPeriod);

  const macdLine = emaShort.map((val, i) => val - emaLong[i]);

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = macdLine.map((val, i) => val - signalLine[i]);

  return { macdLine, signalLine, histogram };
}

/** Calculates RSI (Relative Strength Index) */
function calculateRSI(data, period = 14) {
  if (!data || data.length < period) return [];
  const rsiArray = Array(data.length).fill(NaN);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i-1];
    if (i <= period) {
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
      if (i === period) {
        gains /= period;
        losses /= period;
      }
    } else {
      if (change > 0) {
        gains = (gains * (period - 1) + change) / period;
        losses = (losses * (period - 1)) / period;
      } else {
        gains = (gains * (period - 1)) / period;
        losses = (losses * (period - 1) - change) / period;
      }
    }

    if (i >= period) {
      const rs = gains / losses;
      rsiArray[i] = 100 - (100 / (1 + rs));
    }
  }
  return rsiArray;
}

function fetchTradingViewData(identifier, sendEmailOnce, recipient) {
  try {
    const url = CONFIG_MM[identifier];
    if (!url) {
      return { success: false, message: 'Invalid identifier.' };
    }
    const response = UrlFetchApp.fetch(url);
    const content = response.getContentText();
    const data = parseTradingViewData(content);

    if (sendEmailOnce) {
      sendMarketMoversEmail(recipient, data);
    }

    return { success: true, data: data };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function scheduleDailyEmailTrigger(identifier, timeString, recipient, includeDetails) {
  try {
    const trigger = ScriptApp.newTrigger(DAILY_EMAIL_HANDLER_FUNCTION)
      .timeBased()
      .atHour(parseInt(timeString.split(':')[0]))
      .nearMinute(parseInt(timeString.split(':')[1]))
      .everyDays(1)
      .create();

    PropertiesService.getUserProperties().setProperties({
      [PROP_KEYS.DAILY_EMAIL_ENABLED]: 'true',
      [PROP_KEYS.DAILY_EMAIL_IDENTIFIER]: identifier,
      [PROP_KEYS.DAILY_EMAIL_TIME]: timeString,
      [PROP_KEYS.DAILY_EMAIL_RECIPIENT]: recipient,
      [PROP_KEYS.DAILY_INCLUDE_DETAILS]: includeDetails,
      [PROP_KEYS.DAILY_TRIGGER_ID]: trigger.getUniqueId()
    });

    return { success: true, message: 'Schedule created successfully.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getDailyEmailStatus() {
  const properties = PropertiesService.getUserProperties().getProperties();
  const enabled = properties[PROP_KEYS.DAILY_EMAIL_ENABLED] === 'true';
  return { success: true, status: { enabled: enabled, time: properties[PROP_KEYS.DAILY_EMAIL_TIME], recipient: properties[PROP_KEYS.DAILY_EMAIL_RECIPIENT] } };
}

function cancelDailyEmailTrigger() {
  try {
    const triggerId = PropertiesService.getUserProperties().getProperty(PROP_KEYS.DAILY_TRIGGER_ID);
    if (triggerId) {
      const allTriggers = ScriptApp.getProjectTriggers();
      for (let i = 0; i < allTriggers.length; i++) {
        if (allTriggers[i].getUniqueId() === triggerId) {
          ScriptApp.deleteTrigger(allTriggers[i]);
          break;
        }
      }
    }

    const properties = PropertiesService.getUserProperties();
    properties.deleteProperty(PROP_KEYS.DAILY_EMAIL_ENABLED);
    properties.deleteProperty(PROP_KEYS.DAILY_EMAIL_IDENTIFIER);
    properties.deleteProperty(PROP_KEYS.DAILY_EMAIL_TIME);
    properties.deleteProperty(PROP_KEYS.DAILY_EMAIL_RECIPIENT);
    properties.deleteProperty(PROP_KEYS.DAILY_INCLUDE_DETAILS);
    properties.deleteProperty(PROP_KEYS.DAILY_TRIGGER_ID);

    return { success: true, message: 'Schedule cancelled successfully.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function dailyMarketMoverEmailHandler() {
  const properties = PropertiesService.getUserProperties().getProperties();
  const identifier = properties[PROP_KEYS.DAILY_EMAIL_IDENTIFIER];
  const recipient = properties[PROP_KEYS.DAILY_EMAIL_RECIPIENT];
  const includeDetails = properties[PROP_KEYS.DAILY_INCLUDE_DETAILS] === 'true';

  const response = fetchTradingViewData(identifier, false, null);
  if (response.success) {
    sendMarketMoversEmail(recipient, response.data, includeDetails);
  }
}

function sendMarketMoversEmail(recipient, data, includeDetails) {
  let subject = `${CONFIG_MM.emailSubjectPrefix} - ${new Date().toLocaleDateString()}`;
  let body = '<h1>Market Movers Report</h1>';
  body += '<table border="1" cellpadding="5" style="border-collapse: collapse;"><tr><th>Ticker</th><th>Chg %</th><th>Volume</th></tr>';
  data.forEach(item => {
    body += `<tr><td>${item.ticker}</td><td>${item.chg}</td><td>${item.volume}</td></tr>`;
  });
  body += '</table>';

  MailApp.sendEmail(recipient, subject, '', { htmlBody: body });
}

function parseTradingViewData(html) {
  const data = [];
  const regex = /<a href="\/symbols\/([A-Z]+):([A-Z]+)\/" class="tv-screener__symbol">([A-Z]+)<\/a>.*?<span class="tv-screener__change tv-screener__change--(up|down)">(.*?)<\/span>.*?<td class="tv-screener__cell tv-screener__cell--marketscreener-table-row-cell tv-screener__cell--left tv-screener__cell--last">\s*(\d+\.\d+[A-Z])\s*<\/td>/gs;
  let match;
  while ((match = regex.exec(html)) !== null) {
    data.push({
      ticker: match[3],
      exchange: match[2],
      chg: match[5],
      volume: match[6]
    });
  }
  return data;
}

function getTickerDetails(ticker) {
  try {
    const data = getHistoricalData_MM(ticker, CONFIG_MM.histDataPeriodDetails);
    const closes = data.closes;
    const sma = calculateSMA_MM(closes, CONFIG_MM.smaPeriodDetails);
    const macd = calculateMACD(closes);
    const rsi = calculateRSI(closes);

    return {
      success: true,
      details: {
        lastClose: closes[closes.length - 1],
        sma: sma,
        macd: macd.macdLine[macd.macdLine.length - 1],
        rsi: rsi[rsi.length - 1],
        smaPeriod: CONFIG_MM.smaPeriodDetails
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getHistoricalData_MM(ticker, days) {
  let sheet;
  try {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet();
    const formula = `=GOOGLEFINANCE("${ticker}", "close", TODAY()-${days}, TODAY())`;
    sheet.getRange("A1").setFormula(formula);
    SpreadsheetApp.flush();
    Utilities.sleep(2000); // Wait for GOOGLEFINANCE to populate

    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      throw new Error(`No historical data returned for ${ticker}.`);
    }

    // Remove header row
    data.shift();

    const closes = data.map(row => row[1]);
    return {
      closes: closes
    };
  } finally {
    if (sheet) {
      SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
    }
  }
}
