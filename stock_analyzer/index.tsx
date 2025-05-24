/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import * as marked from 'marked';

// Ensure Plotly is available globally
declare var Plotly: any;

console.log("Application script loading...");

// Primary API Key from environment (still required as per guidelines)
const GEMINI_API_KEY_PRIMARY = process.env.API_KEY;

// Conceptual representation of multiple API keys.
// In a real build, API_KEYS_STRING would be populated from process.env.API_KEYS_LIST.
// For this exercise, using the keys provided by the user directly in the prompt.
const USER_PROVIDED_KEYS_STRING = "AIzaSyDIoMikp7IWx-QZxDDXa8LTbDlkJIePZlI,AIzaSyAqAZ9i3L4dMtRAP8O-qDVNk7iPzrG5gsg,AIzaSyCm64O3VnVbXLsiPEhjSWwPgEmjveObQE8,AIzaSyApDY8KavbT3p0pibPSs9xy34RvtunzvSM,AIzaSyAPhjW7ZGG5q9LJ-8r6xgxoggNG_uaeWNM";

const apiKeysFromList = (USER_PROVIDED_KEYS_STRING || "").split(',').map(k => k.trim()).filter(k => k);

let apiKeys: string[] = [];
if (apiKeysFromList.length > 0) {
    apiKeys = apiKeysFromList;
    console.log(`Using a list of ${apiKeys.length} API keys for rotation.`);
} else if (GEMINI_API_KEY_PRIMARY) {
    apiKeys = [GEMINI_API_KEY_PRIMARY];
    console.log("Using a single primary API_KEY.");
} else {
    const errorMsg = "CRITICAL: No API keys configured (neither API_KEYS_LIST nor a primary API_KEY).";
    console.error(errorMsg);
    alert(errorMsg + " The application cannot start.");
    throw new Error(errorMsg);
}

let currentApiKeyIndex = 0; 
// `ai` instance will be created dynamically before each API call.
let ai: GoogleGenAI; 

const tickerInput = document.getElementById('ticker-input') as HTMLInputElement;
const exchangeInput = document.getElementById('exchange-input') as HTMLInputElement;
const getPriceButton = document.getElementById('get-price-button') as HTMLButtonElement;
const resultsOutput = document.getElementById('results-output') as HTMLDivElement;
const tradingViewWidgetContainer = document.getElementById('tradingview-widget-container') as HTMLDivElement;
const plotlyChartOutput = document.getElementById('plotly-chart-output') as HTMLDivElement;
const sourcesContainerWrapper = document.getElementById('sources-container-wrapper') as HTMLDivElement;
const toggleSourcesButton = document.getElementById('toggle-sources-button') as HTMLButtonElement;
const sourcesContent = document.getElementById('sources-content') as HTMLDivElement;
const spotPriceValueElement = document.getElementById('spot-price-value') as HTMLSpanElement;
const errorsSection = document.getElementById('errors-section') as HTMLDivElement;
const copyErrorsButton = document.getElementById('copy-errors-button') as HTMLButtonElement;
const copyErrorsStatus = document.getElementById('copy-errors-status') as HTMLSpanElement;
const toggleRateLimitInfoButton = document.getElementById('toggle-rate-limit-info-button') as HTMLButtonElement;
const rateLimitInfoContent = document.getElementById('rate-limit-info-content') as HTMLDivElement;
const cooldownTimerElement = document.getElementById('cooldown-timer') as HTMLSpanElement;

console.log("DOM elements obtained.");

const DB_NAME = 'StockAnalyzerDB';
const DB_VERSION = 1;
const STORE_NAME = 'analyses';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_API_CALL_INTERVAL_MS = 6; // 60 seconds cooldown for API calls

console.log(`Cache settings: DB_NAME=${DB_NAME}, STORE_NAME=${STORE_NAME}, CACHE_TTL_MS=${CACHE_TTL_MS}`);
console.log(`API call interval: MIN_API_CALL_INTERVAL_MS=${MIN_API_CALL_INTERVAL_MS}`);

interface CachedAnalysis {
  id: string; // ticker_exchange
  ticker: string;
  exchange: string;
  timestamp: number;
  responseText: string;
  groundingChunks?: any[];
  ohlcvData?: PlotlyOHLCVData[];
  spotPrice?: number;
}

interface PlotlyOHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface LoggedErrorEntry {
  timestamp: string;
  message: string;
  name?: string;
  stack?: string;
  context?: string;
  apiKeyUsed?: string;
}

let loggedErrors: LoggedErrorEntry[] = [];
let previousSpotPrice: number | null = null;
let lastApiCallTimestamp: number = 0;
let cooldownIntervalId: number | null = null;

console.log("Global variables initialized.");

function initializeGenAIClient() {
    const apiKeyToUse = apiKeys[currentApiKeyIndex];
    if (!apiKeyToUse) {
        logError("No API key available at current index for GenAI client initialization.", "API Key Error");
        throw new Error("No API key available for GenAI client.");
    }
    ai = new GoogleGenAI({ apiKey: apiKeyToUse });
    console.log(`GoogleGenAI client initialized with API key at index ${currentApiKeyIndex}.`);
}

function logError(error: any, context?: string) {
  const apiKeyUsed = apiKeys[currentApiKeyIndex] ? `Key ending with ...${apiKeys[currentApiKeyIndex].slice(-4)} (Index ${currentApiKeyIndex})` : 'N/A';
  console.error(`Error encountered. Context: ${context || 'N/A'}. API Key Used: ${apiKeyUsed}`, error);

  const newErrorEntry: LoggedErrorEntry = {
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : 'UnknownError',
    stack: error instanceof Error ? error.stack : undefined,
    context: context || 'No specific context',
    apiKeyUsed: apiKeyUsed,
  };
  loggedErrors.push(newErrorEntry);
  console.info("Error logged. Total logged errors:", loggedErrors.length);
  updateCopyErrorsButtonState();
}

function updateCopyErrorsButtonState() {
  if (!errorsSection || !copyErrorsButton) return;

  if (loggedErrors.length > 0) {
    errorsSection.style.display = 'block';
    copyErrorsButton.textContent = `Copy ${loggedErrors.length} Logged Error(s)`;
    copyErrorsButton.disabled = false;
  } else {
    errorsSection.style.display = 'none';
    copyErrorsButton.disabled = true;
  }
  console.log("Copy errors button state updated.");
}

function openDB(): Promise<IDBDatabase> {
  console.log("Opening IndexedDB...");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => {
      logError(request.error, `IndexedDB open error for ${DB_NAME}`);
      reject(request.error);
    };
    request.onsuccess = () => {
      console.log("IndexedDB opened successfully.");
      resolve(request.result);
    };
    request.onupgradeneeded = (event) => {
      console.log("IndexedDB upgrade needed.");
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        console.log(`Object store '${STORE_NAME}' created.`);
      }
    };
  });
}

async function getCachedAnalysis(ticker: string, exchange: string): Promise<CachedAnalysis | null> {
  const id = `${ticker}_${exchange}`;
  console.log(`Attempting to get cached analysis for ${id}.`);
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onerror = () => {
        logError(request.error, `Error getting cached analysis for ${id}`);
        reject(request.error);
      };
      request.onsuccess = () => {
        if (request.result && (Date.now() - request.result.timestamp < CACHE_TTL_MS)) {
          console.log(`Cache hit for ${id}. Timestamp: ${new Date(request.result.timestamp).toISOString()}`);
          resolve(request.result as CachedAnalysis);
        } else {
          if (request.result) {
              console.log(`Cache expired or invalid for ${id}. Deleting.`);
              const deleteTransaction = db.transaction(STORE_NAME, 'readwrite');
              const deleteStore = deleteTransaction.objectStore(STORE_NAME);
              const deleteRequest = deleteStore.delete(id);
              deleteRequest.onerror = () => logError(deleteRequest.error, `Failed to delete expired cache for ${id}`);
              deleteRequest.onsuccess = () => console.log(`Successfully deleted expired cache for ${id}`);
          } else {
            console.log(`Cache miss for ${id}.`);
          }
          resolve(null);
        }
      };
    });
  } catch (dbError) {
    logError(dbError, `Failed to open DB for getCachedAnalysis of ${id}`);
    return null;
  }
}

async function cacheAnalysis(data: CachedAnalysis): Promise<void> {
  console.log(`Attempting to cache analysis for ${data.id}.`);
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data);
      request.onerror = () => {
        logError(request.error, `Error caching analysis for ${data.id}`);
        reject(request.error);
      };
      request.onsuccess = () => {
        console.log(`Analysis for ${data.id} cached successfully.`);
        resolve();
      };
    });
  } catch (dbError) {
     logError(dbError, `Failed to open DB for cacheAnalysis of ${data.id}`);
  }
}

function displayMessage(htmlContent: string, type: 'loading' | 'error' | 'success' | 'info' | 'cached' | 'cached-ratelimit' | 'warning' = 'info') {
  console.log(`Displaying message of type '${type}'. Content snippet: ${htmlContent.substring(0, 50)}...`);
  let typeClass = type;
  if (type === 'cached-ratelimit') typeClass = 'error';
  else if (type === 'cached') typeClass = 'info';

  resultsOutput.innerHTML = `<div class="message ${typeClass}">${htmlContent}</div>`;
}

function updateSpotPriceDisplay(newPrice?: number) {
    console.log(`Updating spot price display. New price: ${newPrice}, Previous price: ${previousSpotPrice}`);
    if (spotPriceValueElement) {
        spotPriceValueElement.classList.remove('price-up', 'price-down');
        if (typeof newPrice === 'number') {
            spotPriceValueElement.textContent = newPrice.toFixed(2);
            if (previousSpotPrice !== null && newPrice !== previousSpotPrice) {
                if (newPrice > previousSpotPrice) {
                    spotPriceValueElement.classList.add('price-up');
                    console.log("Spot price up.");
                } else {
                    spotPriceValueElement.classList.add('price-down');
                    console.log("Spot price down.");
                }
            }
            previousSpotPrice = newPrice;
        } else {
            spotPriceValueElement.textContent = '--.--';
            console.log("Spot price display reset to '--.--'.");
        }
    } else {
      console.warn("spotPriceValueElement not found in DOM.");
    }
}

function displayFormattedResult(geminiResponseText: string, groundingChunks: any[] | undefined, spotPrice?: number, fromCacheType: 'none' | 'standard' | 'ratelimit' = 'none') {
  console.log(`Displaying formatted result. From cache type: ${fromCacheType}. Spot price: ${spotPrice}`);
  let mainHtml = marked.parse(geminiResponseText) as string;

  if (fromCacheType === 'standard') {
    mainHtml = `<div><strong class="cached-notice">[Served from Local Cache]</strong></div>` + mainHtml;
  } else if (fromCacheType === 'ratelimit') {
    mainHtml = `<div><strong class="cached-notice error">[Served from Local Cache due to API Rate Limit with current key - Data may be outdated. Key will rotate on next attempt.]</strong></div>` + mainHtml;
  }

  displayMessage(mainHtml, fromCacheType !== 'none' ? (fromCacheType === 'ratelimit' ? 'cached-ratelimit' : 'cached') : 'success');
  updateSpotPriceDisplay(spotPrice);

  console.log("Updating sources display...");
  if (sourcesContainerWrapper && sourcesContent && toggleSourcesButton) {
    if (groundingChunks && groundingChunks.length > 0) {
      console.log(`Found ${groundingChunks.length} grounding chunks.`);
      let sourcesHtml = '<ul>';
      groundingChunks.forEach(chunk => {
        if (chunk.web && chunk.web.uri) {
          const title = chunk.web.title || chunk.web.uri;
          sourcesHtml += `<li><a href="${chunk.web.uri}" target="_blank" rel="noopener noreferrer">${title}</a></li>`;
        }
      });
      sourcesHtml += '</ul>';
      sourcesContent.innerHTML = sourcesHtml;
      sourcesContainerWrapper.style.display = 'block';
      toggleSourcesButton.style.display = 'inline-block';
      sourcesContent.style.display = 'none';
      toggleSourcesButton.setAttribute('aria-expanded', 'false');
      toggleSourcesButton.textContent = `Sources (${groundingChunks.length})`;
    } else {
      console.log("No grounding chunks found.");
      sourcesContainerWrapper.style.display = 'none';
      sourcesContent.innerHTML = '';
    }
  } else {
    console.warn("Sources display elements not found in DOM.");
  }
}

function updateTradingViewWidget(ticker?: string, exchange?: string) {
  console.log(`Updating TradingView widget. Ticker: ${ticker}, Exchange: ${exchange}`);
  console.info("TradingView Widget Note: Direct content extraction from the TradingView iframe is not possible due to browser Same-Origin Policy.");

  if (!tradingViewWidgetContainer) {
    console.warn("tradingViewWidgetContainer not found.");
    return;
  }

  const existingScript = tradingViewWidgetContainer.querySelector('script[src*="tradingview.com"]');
  if (existingScript) {
    console.log("Removing existing TradingView script.");
    existingScript.remove();
  }

  const innerWidgetDiv = tradingViewWidgetContainer.querySelector('.tradingview-widget-container__widget');
  if (innerWidgetDiv) {
    innerWidgetDiv.innerHTML = '';
    console.log("Cleared inner TradingView widget container.");
  }

  const effectiveTicker = ticker || "TSLA";
  const effectiveExchange = exchange || "NASDAQ";
  const tradingViewSymbol = `${effectiveExchange.toUpperCase().replace(/[^A-Z0-9]/g, '')}:${effectiveTicker.toUpperCase().replace(/[^A-Z0-9.]/g, '')}`;
  console.log(`Effective TradingView symbol: ${tradingViewSymbol}`);

  const widgetConfig = {
    autosize: true,
    symbol: tradingViewSymbol,
    interval: "1",
    timezone: "America/Los_Angeles",
    theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light",
    style: "1",
    locale: "en",
    withdateranges: true,
    allow_symbol_change: true,
    studies: [
        "Volume@tv-basicstudies",
        "RSI@tv-basicstudies",
        "MACD@tv-basicstudies",
        "BB@tv-basicstudies"
    ],
    support_host: "https://www.tradingview.com"
  };

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.async = true;
  script.innerHTML = JSON.stringify(widgetConfig, null, 2);

  tradingViewWidgetContainer.appendChild(script);
  console.log("New TradingView script appended.");
}

function displayPlotlyChart(dataForPlot: Array<PlotlyOHLCVData>, title: string, fromCacheType: 'none' | 'standard' | 'ratelimit' = 'none') {
  console.log(`Displaying Plotly chart. Title: ${title}. From cache type: ${fromCacheType}. Data points: ${dataForPlot?.length}`);
  if (!plotlyChartOutput) {
    console.warn("plotlyChartOutput element not found.");
    return;
  }
  if (!dataForPlot || dataForPlot.length === 0) {
    const msg = "<p>No plottable OHLCV data available to display.</p>";
    console.log(msg);
    plotlyChartOutput.innerHTML = msg;
    return;
  }

  try {
    const dates = dataForPlot.map(d => d.date);
    const openPrices = dataForPlot.map(d => d.open);
    const highPrices = dataForPlot.map(d => d.high);
    const lowPrices = dataForPlot.map(d => d.low);
    const closePrices = dataForPlot.map(d => d.close);
    const volumes = dataForPlot.map(d => d.volume);

    const candlestickTrace = {
      x: dates, open: openPrices, high: highPrices, low: lowPrices, close: closePrices,
      type: 'candlestick', name: title, xaxis: 'x', yaxis: 'y',
      increasing: {line: {color: '#26A69A'}}, decreasing: {line: {color: '#EF5350'}}
    };
    const volumeTrace = {
      x: dates, y: volumes, type: 'bar', name: 'Volume', xaxis: 'x', yaxis: 'y2',
      marker: { color: dataForPlot.map(d => d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)')}
    };

    let chartTitle = title;
    if (fromCacheType === 'standard') chartTitle = `${title} (Cached)`;
    else if (fromCacheType === 'ratelimit') chartTitle = `${title} (Cached - API Limit)`;

    const layout = {
      title: chartTitle, dragmode: 'zoom', showlegend: false,
      xaxis: { autorange: true, domain: [0, 1], rangeslider: { visible: false }, title: 'Date', type: 'date'},
      yaxis: { autorange: true, domain: [0.25, 1], title: 'Price'},
      yaxis2: { autorange: true, domain: [0, 0.2], title: 'Volume', showticklabels: true, side: 'right'},
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#f0f0f0' : '#333' },
      grid: {rows: 2, columns: 1, pattern: 'independent'},
    };

    Plotly.newPlot(plotlyChartOutput, [candlestickTrace, volumeTrace], layout, {responsive: true});
    console.log("Plotly chart rendered.");
  } catch (e) {
    logError(e, "Error rendering Plotly OHLCV chart");
    plotlyChartOutput.innerHTML = '<p>Error rendering OHLCV chart. Check console for details.</p>';
  }
}

function parseOhlcvDataFromResponse(textOutput: string): PlotlyOHLCVData[] | null {
    console.log("Attempting to parse OHLCV data from response.");
    try {
        const jsonRegexStrict = /```json\s*(\[[\s\S]*?\{"date":\s*".*?",\s*"open":\s*[\d.]+,\s*"high":\s*[\d.]+,\s*"low":\s*[\d.]+,\s*"close":\s*[\d.]+,\s*"volume":\s*\d+\s*\}[\s\S]*?\])\s*```/ms;
        const jsonRegexLoose = /(\[[\s\S]*?\{"date":\s*".*?",\s*"open":\s*[\d.]+,\s*"high":\s*[\d.]+,\s*"low":\s*[\d.]+,\s*"close":\s*[\d.]+,\s*"volume":\s*\d+\s*\}[\s\S]*?\])/ms;
        let plottableData: PlotlyOHLCVData[] | null = null;

        let match = textOutput.match(jsonRegexStrict);
        if (match && match[1]) {
            console.log("Found strict JSON block for OHLCV data.");
            try { plottableData = JSON.parse(match[1]); } catch (e) {
                logError(e, `Strict JSON block found for OHLCV but failed to parse. Content: ${match[1]}`);
            }
        }

        if (!plottableData) {
            match = textOutput.match(jsonRegexLoose);
            if (match && match[1]) {
                console.log("Found loose JSON block for OHLCV data.");
                try { plottableData = JSON.parse(match[1]); } catch (e) {
                    logError(e, `Loose JSON match found for OHLCV but failed to parse. Content: ${match[1]}`);
                }
            }
        }

        if (Array.isArray(plottableData) && plottableData.length > 0 && plottableData.every(item =>
            typeof item === 'object' && item !== null &&
            'date' in item && typeof item.date === 'string' &&
            'open' in item && typeof item.open === 'number' &&
            'high' in item && typeof item.high === 'number' &&
            'low' in item && typeof item.low === 'number' &&
            'close' in item && typeof item.close === 'number' &&
            'volume' in item && typeof item.volume === 'number'
          )) {
          console.log("Successfully parsed and validated OHLCV data:", plottableData);
          return plottableData;
        }
        console.warn("Failed to parse or validate OHLCV data from response text.");
        return null;
    } catch (e) {
        logError(e, "Error during OHLCV data parsing process");
        return null;
    }
}

function parseSpotPriceFromResponse(textOutput: string): number | null {
    console.log("Attempting to parse spot price from response.");
    const spotPriceRegex = /(?:current spot price for [A-Z.]+ is|Current Spot Price:)\s*([\$€£]?\s*\d{1,3}(?:[,.]\d{3})*(\.\d+)?)/i;
    const generalPriceRegex = /price is\s*([\$€£]?\s*\d{1,3}(?:[,.]\d{3})*(\.\d+)?)/i;
    const standalonePriceRegex = /([\$€£]?\s*\d+\.\d{2,})/i;

    let match = textOutput.match(spotPriceRegex);
    if (match && match[1]) {
        try {
            const priceString = match[1].replace(/[^\d.]/g, '');
            const price = parseFloat(priceString);
            console.log(`Parsed spot price (specific phrase): ${price}`);
            return price;
        } catch (e) {
            logError(e, `Error parsing spot price (specific phrase). Matched: ${match[1]}`);
        }
    }

    match = textOutput.match(generalPriceRegex);
    if (match && match[1]) {
        try {
            const priceString = match[1].replace(/[^\d.]/g, '');
            const price = parseFloat(priceString);
            console.log(`Parsed spot price (general phrase): ${price}`);
            return price;
        } catch (e) {
            logError(e, `Error parsing spot price (general phrase). Matched: ${match[1]}`);
        }
    }

    match = textOutput.match(standalonePriceRegex);
     if (match && match[1]) {
        try {
            const priceString = match[1].replace(/[^\d.]/g, '');
            const potentialPrice = parseFloat(priceString);
            if (potentialPrice > 0 && potentialPrice < 1000000) {
                console.log(`Parsed spot price (standalone number regex): ${potentialPrice}`);
                return potentialPrice;
            }
        } catch (e) {
            logError(e, `Error parsing spot price (standalone number regex). Matched: ${match[1]}`);
        }
    }
    console.warn("Could not parse spot price from response text.");
    return null;
}

function startVisualCooldown(timestampOfCallAttempt: number) {
    if (cooldownIntervalId) {
        clearInterval(cooldownIntervalId);
        cooldownIntervalId = null;
    }
    if (getPriceButton) getPriceButton.disabled = true;

    const updateTimer = () => {
        const now = Date.now();
        const elapsed = now - timestampOfCallAttempt;
        const remainingMs = MIN_API_CALL_INTERVAL_MS - elapsed;

        if (remainingMs <= 0) {
            if (cooldownIntervalId) clearInterval(cooldownIntervalId);
            cooldownIntervalId = null;
            if (getPriceButton) getPriceButton.disabled = false;
            if (cooldownTimerElement) {
                 cooldownTimerElement.textContent = "";
                 cooldownTimerElement.style.display = 'none';
            }
            console.log("Visual cooldown finished.");
        } else {
            const remainingSeconds = Math.ceil(remainingMs / 1000);
            if (cooldownTimerElement) {
                cooldownTimerElement.textContent = `Next request in ${remainingSeconds}s`;
                cooldownTimerElement.style.display = 'block';
            }
             if (getPriceButton) getPriceButton.disabled = true;
        }
    };

    console.log(`Starting visual cooldown. Cooldown base timestamp: ${new Date(timestampOfCallAttempt).toISOString()}`);
    updateTimer();
    cooldownIntervalId = window.setInterval(updateTimer, 1000);
}

async function fetchStockInfo() {
  console.log("fetchStockInfo called.");
  const ticker = tickerInput.value.trim().toUpperCase();
  const exchange = exchangeInput.value.trim().toUpperCase();
  console.log(`Ticker: ${ticker}, Exchange: ${exchange}`);

  if (!ticker || !exchange) {
    const msg = '<p>Please enter both a ticker symbol and an exchange.</p>';
    displayMessage(msg, 'error');
    console.log("Ticker or exchange missing.");
    updateSpotPriceDisplay(undefined);
    previousSpotPrice = null;
    return;
  }

  const now = Date.now();
  if (now - lastApiCallTimestamp < MIN_API_CALL_INTERVAL_MS) {
    const timeToWait = Math.ceil((MIN_API_CALL_INTERVAL_MS - (now - lastApiCallTimestamp)) / 1000);
    const msg = `<p>Please wait ${timeToWait} more seconds before fetching new data to avoid API rate limits.</p>`;
    displayMessage(msg, 'warning');
    console.log("API call throttled. User clicked too soon.");
    if (!cooldownIntervalId) {
         startVisualCooldown(lastApiCallTimestamp);
    }
    return;
  }

  if (tickerInput.dataset.lastTicker !== ticker || exchangeInput.dataset.lastExchange !== exchange) {
    console.log("Ticker/Exchange changed, resetting previousSpotPrice.");
    previousSpotPrice = null;
    updateSpotPriceDisplay(undefined);
  }
  tickerInput.dataset.lastTicker = ticker;
  exchangeInput.dataset.lastExchange = exchange;

  updateTradingViewWidget(ticker, exchange);

  tickerInput.disabled = true;
  exchangeInput.disabled = true;
  console.log("Inputs disabled.");

  if (sourcesContainerWrapper) sourcesContainerWrapper.style.display = 'none';
  if (sourcesContent) sourcesContent.innerHTML = '';

  lastApiCallTimestamp = Date.now();
  startVisualCooldown(lastApiCallTimestamp);
  localStorage.setItem('lastApiCallTimestampGlobal', String(lastApiCallTimestamp)); // Persist global timestamp

  try {
    console.log("Checking cache for stock info...");
    const cachedData = await getCachedAnalysis(ticker, exchange);
    if (cachedData) {
      console.log("Cache hit. Displaying cached data.");
      displayMessage('<p>Loading analysis from local cache...</p>', 'cached');
      if (plotlyChartOutput) plotlyChartOutput.innerHTML = '<p>Loading cached OHLCV data for chart...</p>';

      displayFormattedResult(cachedData.responseText, cachedData.groundingChunks, cachedData.spotPrice, 'standard');

      if (cachedData.ohlcvData) {
        displayPlotlyChart(cachedData.ohlcvData, `7-Day Projected OHLCV for ${ticker} (Cached)`, 'standard');
      } else {
         if (plotlyChartOutput) plotlyChartOutput.innerHTML = "<p>Cached OHLCV data not found.</p>";
         console.log("Cached OHLCV data not found.");
      }
      localStorage.setItem('lastTicker', ticker);
      localStorage.setItem('lastExchange', exchange);
      console.log("Saved to localStorage and returning from cache.");
      return;
    }
  } catch (e) {
      logError(e, "Error accessing cache, proceeding with API call");
      previousSpotPrice = null;
      updateSpotPriceDisplay(undefined);
  }

  console.log("Cache miss or error. Fetching fresh data from API.");
  displayMessage('<p>Fetching fresh stock projections, options analysis, and OHLCV data from API...</p>', 'loading');
  if (plotlyChartOutput) plotlyChartOutput.innerHTML = '<p>Loading projected OHLCV data for chart from API...</p>';
  
  initializeGenAIClient(); // Initialize with current key

  const wsjOptionsUrlPattern = `https://www.wsj.com/market-data/quotes/${ticker}/options`;
  const prompt = `
Analyze the stock with ticker symbol ${ticker} on the ${exchange} exchange.
Please state the current spot price for ${ticker} clearly in your response, for example: "The current spot price for ${ticker} is XXX.XX."

Provide projected prices and potential timelines for price reversals.
These timelines can range from short-term (seconds, minutes, hours) to medium-term (days, weeks) and longer-term (months).
Incorporate common financial indicators, the Black-Scholes model, advanced calculus, linear algebra, non-linear differential equations, parametric equations, partial differential equations (partials), Principal Component Analysis (PCA), and damping concepts in your analysis of reversals.
For the relevant price data used in your projections (e.g., historical data or the basis for your 7-day OHLCV forecast), please also include the following statistical measures: Standard Deviation, Mean, Median, and Mode. Clearly state these values in your textual analysis.
Please also include the company's full name and discuss factors influencing these projections.
Consider information and sentiment from YouTube videos related to the stock, if relevant and available through search.
The application caches responses; ensure this analysis is up-to-date based on your current knowledge cut-off and available search data.

Additionally, consult the following URLs for market context and to suggest other potential tickers that are similar or might be better performers:
- https://www.tradingview.com/markets/stocks-usa/market-movers-all-stocks/
- https://www.tradingview.com/markets/stocks-usa/market-movers-gainers/
- https://www.tradingview.com/markets/stocks-usa/market-movers-pre-market-gainers/
Based on these sources, list any alternative tickers that investors might find interesting, explaining why.

Furthermore, access and analyze the options chain data for ${ticker} from The Wall Street Journal. You can primarily use the URL pattern: ${wsjOptionsUrlPattern}.
If that specific URL doesn't yield results, use Google Search to find the correct WSJ options page for ${ticker}.
Based on this options data (including strike prices, expiration dates, open interest, volume, bid/ask for calls and puts) and your overall market analysis and projections:
1. Identify key insights from the options chain (e.g., heavily traded strikes, implied volatility trends, put/call ratios).
2. Suggest 2-3 potential multi-leg options strategies (e.g., bull call spreads, bear put spreads, iron condors, butterflies, straddles, strangles) that seem relevant given the current outlook for ${ticker}.
3. For each suggested strategy, describe it textually, including:
    a. The rationale behind it.
    b. The market outlook it's best suited for (e.g., bullish, bearish, neutral, volatile, range-bound).
    c. How it might be constructed (e.g., "Buy X call, Sell Y call at higher strike").
    d. Potential risk/reward characteristics.
Do NOT attempt to provide JSON for these options strategies; describe them textually within your main analysis.

Finally, provide a small set of projected OHLCV (Open, High, Low, Close, Volume) data for the next 7 days for ${ticker}.
The data should be in a JSON array format like this:
[{"date": "YYYY-MM-DD", "open": 170.10, "high": 172.50, "low": 169.80, "close": 171.75, "volume": 1234567}, ...].
Ensure this JSON array is clearly demarcated in your response, for example, by putting it on its own line, or within a markdown JSON code block under a heading like "Projected 7-Day OHLCV Data (JSON):".
`;
  console.log("Generated Gemini prompt.");

  try {
    console.log(`Sending request to Gemini API using key index ${currentApiKeyIndex} (Key ending with ...${apiKeys[currentApiKeyIndex].slice(-4)}).`);
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    console.log("Full API Response Received.");
    console.log(`API Response Status: Candidate count=${response.candidates?.length}, Prompt Feedback Block Reason: ${response.promptFeedback?.blockReason || 'N/A'}`);

    if (response.promptFeedback && response.promptFeedback.blockReason) {
        const blockReason = response.promptFeedback.blockReason;
        const blockMessageDetail = response.promptFeedback.blockReasonMessage || 'No additional message';
        logError({message: `Prompt was blocked by API. Reason: ${blockReason} (${blockMessageDetail})`, name: "APIBlockError", stack: JSON.stringify(response.promptFeedback.safetyRatings, null, 2)}, "Gemini API prompt blocked");

        const userMessage = `The request was blocked by the API. Reason: ${blockReason} (${blockMessageDetail}). Please try modifying your query or contact support if this persists.`;
        displayMessage(`<p>${userMessage}</p>`, 'error');
        if (plotlyChartOutput) plotlyChartOutput.innerHTML = "<p>OHLCV chart data could not be retrieved due to a blocked request.</p>";
        updateSpotPriceDisplay(undefined);
        return;
    }

    const textOutput = response.text;
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    if (textOutput) {
      console.log("API returned text output.");
      const spotPrice = parseSpotPriceFromResponse(textOutput);
      displayFormattedResult(textOutput, groundingMetadata?.groundingChunks, spotPrice, 'none');
      localStorage.setItem('lastTicker', ticker);
      localStorage.setItem('lastExchange', exchange);
      localStorage.setItem('currentApiKeyIndex', String(currentApiKeyIndex)); // Save current index on success
      console.log("Saved to localStorage after successful API call.");

      const ohlcvData = parseOhlcvDataFromResponse(textOutput);
      if (ohlcvData) {
        console.log("OHLCV data parsed successfully.");
        displayPlotlyChart(ohlcvData, `7-Day Projected OHLCV for ${ticker}`, 'none');
         await cacheAnalysis({
          id: `${ticker}_${exchange}`,
          ticker,
          exchange,
          timestamp: Date.now(),
          responseText: textOutput,
          groundingChunks: groundingMetadata?.groundingChunks,
          ohlcvData: ohlcvData,
          spotPrice: spotPrice
        });
      } else {
        console.warn("Plottable OHLCV data not found or malformed post-API call.");
        if (plotlyChartOutput) plotlyChartOutput.innerHTML = "<p>Projected OHLCV data for chart not found or in an unexpected format in the AI's response.</p>";
         await cacheAnalysis({
          id: `${ticker}_${exchange}`,
          ticker,
          exchange,
          timestamp: Date.now(),
          responseText: textOutput,
          groundingChunks: groundingMetadata?.groundingChunks,
          spotPrice: spotPrice
        });
      }
    } else {
      logError({message: "Model returned no text, though the request was not explicitly blocked.", name: "NoTextResponseError"}, "Gemini API No Text Output");
      displayMessage('<p>Could not retrieve stock projection information. The model returned no text. Check console for API response details.</p>', 'error');
      if (plotlyChartOutput) plotlyChartOutput.innerHTML = "<p>Failed to load OHLCV projection data for chart as no text was returned.</p>";
      updateSpotPriceDisplay(undefined);
    }

  } catch (error: any) {
    logError(error, "Error fetching stock projections from API");
    let errorMessage = 'An error occurred while fetching the stock projections.';
    let isRateLimitError = false;

    if (error instanceof Error) {
        errorMessage += ` Details: ${error.message}`;
    }

    if ( (error.message && error.message.includes('429')) ||
         (error.error && typeof error.error === 'object' && error.error.code === 429) ||
         (error.status && error.status === 'RESOURCE_EXHAUSTED') ||
         (error.response && error.response.status === 429)
        ) {
        isRateLimitError = true;
        const failingKey = apiKeys[currentApiKeyIndex];
        currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
        localStorage.setItem('currentApiKeyIndex', String(currentApiKeyIndex));
        console.warn(`Caught 429 Error with key ending ...${failingKey.slice(-4)}. Rotated to key index ${currentApiKeyIndex}. Attempting to use cache.`);
        errorMessage = `API rate limit exceeded with the current key (ending ...${failingKey.slice(-4)}). The API key will be rotated for the next attempt. Displaying cached data if available. Please wait for the cooldown.`;

        const cachedData = await getCachedAnalysis(ticker, exchange);
        if (cachedData) {
            console.log("Displaying cached data due to 429 error.");
            displayMessage(`<p>${errorMessage}</p>`, 'cached-ratelimit');
            displayFormattedResult(cachedData.responseText, cachedData.groundingChunks, cachedData.spotPrice, 'ratelimit');
            if (cachedData.ohlcvData) {
                displayPlotlyChart(cachedData.ohlcvData, `7-Day Projected OHLCV for ${ticker} (Cached - API Limit)`, 'ratelimit');
            } else {
                if (plotlyChartOutput) plotlyChartOutput.innerHTML = "<p>Cached OHLCV data not found. API rate limit also prevented fetching new data.</p>";
            }
        } else {
            console.log("No cached data available during 429 error.");
            displayMessage(`<p>API rate limit exceeded for ${ticker} on ${exchange} (key ending ...${failingKey.slice(-4)}), and no cached data is available. The API key has been rotated. Please wait for the cooldown period and try again.</p>`, 'error');
            if (plotlyChartOutput) plotlyChartOutput.innerHTML = "<p>Error fetching OHLCV projection data. API rate limit exceeded and no cache.</p>";
            updateSpotPriceDisplay(undefined);
        }
    } else {
        displayMessage(`<p>${errorMessage}</p>`, 'error');
        if (plotlyChartOutput) plotlyChartOutput.innerHTML = "<p>Error fetching OHLCV projection data for chart due to an API or network issue.</p>";
        updateSpotPriceDisplay(undefined);
    }
  } finally {
    console.log("Re-enabling inputs (button managed by cooldown).");
    tickerInput.disabled = false;
    exchangeInput.disabled = false;
  }
}

if (getPriceButton) {
    getPriceButton.addEventListener('click', fetchStockInfo);
    console.log("Event listener added to getPriceButton.");
} else {
    console.error("getPriceButton not found in DOM.");
}

if (toggleSourcesButton && sourcesContent) {
    toggleSourcesButton.addEventListener('click', () => {
        const isExpanded = sourcesContent.style.display === 'block';
        sourcesContent.style.display = isExpanded ? 'none' : 'block';
        toggleSourcesButton.setAttribute('aria-expanded', String(!isExpanded));
        console.log(`Sources toggled. Expanded: ${!isExpanded}`);
    });
    console.log("Event listener added to toggleSourcesButton.");
} else {
    console.warn("toggleSourcesButton or sourcesContent not found.");
}

if (toggleRateLimitInfoButton && rateLimitInfoContent) {
    toggleRateLimitInfoButton.addEventListener('click', () => {
        const isExpanded = rateLimitInfoContent.style.display === 'block';
        rateLimitInfoContent.style.display = isExpanded ? 'none' : 'block';
        toggleRateLimitInfoButton.setAttribute('aria-expanded', String(!isExpanded));
        toggleRateLimitInfoButton.textContent = isExpanded ? 'View API Rate Info' : 'Hide API Rate Info';
        console.log(`Rate limit info toggled. Expanded: ${!isExpanded}`);
    });
    console.log("Event listener added to toggleRateLimitInfoButton.");
} else {
    console.warn("toggleRateLimitInfoButton or rateLimitInfoContent not found.");
}

if (copyErrorsButton) {
    copyErrorsButton.addEventListener('click', async () => {
        console.log("Copy errors button clicked.");
        if (loggedErrors.length === 0) {
            if (copyErrorsStatus) copyErrorsStatus.textContent = "No errors to copy.";
            setTimeout(() => { if (copyErrorsStatus) copyErrorsStatus.textContent = ""; }, 3000);
            return;
        }

        let errorText = `Stock Projection Analyzer - Logged Errors (${new Date().toISOString()})

`;
        errorText += `User Agent: ${navigator.userAgent}

`;
        loggedErrors.forEach((err, index) => {
            errorText += `Error #${index + 1}
`;
            errorText += `Timestamp: ${err.timestamp}
`;
            errorText += `Name: ${err.name || 'N/A'}
`;
            errorText += `Message: ${err.message}
`;
            errorText += `Context: ${err.context || 'N/A'}
`;
            errorText += `API Key Info: ${err.apiKeyUsed || 'N/A'}
`;
            if (err.stack) {
                errorText += `Stack Trace:
${err.stack}
`;
            }
            errorText += "--------------------------------------------------

";
        });

        try {
            await navigator.clipboard.writeText(errorText);
            if (copyErrorsStatus) copyErrorsStatus.textContent = "Errors copied to clipboard!";
            console.log("Errors copied to clipboard.");
        } catch (err) {
            logError(err, "Failed to copy errors to clipboard");
            if (copyErrorsStatus) copyErrorsStatus.textContent = "Failed to copy. See console.";
        }
        setTimeout(() => { if (copyErrorsStatus) copyErrorsStatus.textContent = ""; }, 3000);
    });
    console.log("Event listener added to copyErrorsButton.");
} else {
    console.warn("copyErrorsButton not found.");
}

function initializeApp() {
    console.log("Initializing application...");
    try {
        const lastTicker = localStorage.getItem('lastTicker');
        const lastExchange = localStorage.getItem('lastExchange');
        lastApiCallTimestamp = Number(localStorage.getItem('lastApiCallTimestampGlobal')) || 0;
        currentApiKeyIndex = Number(localStorage.getItem('currentApiKeyIndex')) || 0;
        if (currentApiKeyIndex >= apiKeys.length || currentApiKeyIndex < 0) {
            currentApiKeyIndex = 0; // Reset if out of bounds
        }

        console.log(`Loaded from localStorage - Ticker: ${lastTicker}, Exchange: ${lastExchange}, LastAPICallGlobal: ${new Date(lastApiCallTimestamp).toISOString()}, CurrentKeyIndex: ${currentApiKeyIndex}`);

        tickerInput.value = lastTicker || "TSLA";
        exchangeInput.value = lastExchange || "NASDAQ";
        tickerInput.dataset.lastTicker = tickerInput.value;
        exchangeInput.dataset.lastExchange = exchangeInput.value;

    } catch (e) {
        logError(e, "Could not load preferences from localStorage");
        tickerInput.value = "TSLA";
        exchangeInput.value = "NASDAQ";
        lastApiCallTimestamp = 0;
        currentApiKeyIndex = 0;
    }

    const initialMessage = `
    <p>Enter a stock ticker and exchange to receive a comprehensive analysis. Data is cached for 1 hour.</p>
    <ul>
        <li>Current spot price (displayed above the TradingView chart, updates with each new analysis).</li>
        <li>Company information, price projections, and statistical measures (Mean, Median, Mode, Std Dev).</li>
        <li>Analysis of potential price reversals using advanced mathematical models, financial indicators, and varying timelines (seconds to months).</li>
        <li>Suggestions for alternative tickers based on TradingView market movers.</li>
        <li>Multi-leg options strategy suggestions (textual description) derived from WSJ options chain data.</li>
        <li>A 7-day projected OHLCV candlestick & volume chart.</li>
    </ul>
    <p>The TradingView chart will update to your selected ticker. Sources (if available) will appear at the bottom of the page.</p>
    <p><strong>Note:</strong> If API rate limits are hit with the current API key, the key will be rotated for the next attempt, and cached data (if available) will be displayed. Click "View API Rate Info" below for details.</p>
    `;
    displayMessage(initialMessage, 'info');

    if (plotlyChartOutput) {
        plotlyChartOutput.innerHTML = '<p>Projected OHLCV chart will appear here after fetching data.</p>';
    }
    if (sourcesContainerWrapper) {
        sourcesContainerWrapper.style.display = 'none';
    }
    if (spotPriceValueElement) {
        spotPriceValueElement.textContent = '--.--';
    }

    updateCopyErrorsButtonState();

    if (tickerInput.value && exchangeInput.value) {
        console.log("Preparing for initial fetch/cooldown check.");
        const now = Date.now();
        const timeSinceLastCall = now - lastApiCallTimestamp;

        if (timeSinceLastCall >= MIN_API_CALL_INTERVAL_MS) {
            console.log("Initial fetch allowed. No recent global API call.");
            fetchStockInfo();
        } else {
            console.log("Initial fetch throttled due to recent global API call. Starting visual cooldown.");
            startVisualCooldown(lastApiCallTimestamp);
            const timeToWait = Math.ceil((MIN_API_CALL_INTERVAL_MS - timeSinceLastCall) / 1000);
            displayMessage(`<p>Application initialized. Please wait ${timeToWait}s due to recent activity. API call cooldown in effect.</p>`, 'warning');
            updateTradingViewWidget(tickerInput.value, exchangeInput.value);
        }
    } else {
      console.log("No default ticker/exchange, updating TradingView with its default.");
      updateSpotPriceDisplay(undefined);
      previousSpotPrice = null;
      updateTradingViewWidget();
    }

    window.addEventListener('beforeunload', () => {
        console.log(`Persisting lastApiCallTimestampGlobal: ${new Date(lastApiCallTimestamp).toISOString()} and currentApiKeyIndex: ${currentApiKeyIndex}`);
        localStorage.setItem('lastApiCallTimestampGlobal', String(lastApiCallTimestamp));
        localStorage.setItem('currentApiKeyIndex', String(currentApiKeyIndex));
    });
    console.log("Application initialized.");
}

// Initialize the application on load
initializeApp();
