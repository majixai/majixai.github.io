
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import * as marked from 'marked';

// Plotly is expected to be available globally via its script tag in index.html

console.log("Application script loading...");

// Primary API Key from environment (still required as per guidelines)
const GEMINI_API_KEY_PRIMARY = process.env.API_KEY;

const USER_PROVIDED_KEYS_STRING = "AIzaSyDz_sxnZLHccREaG7l9XleOf3pJN6jelWw,AIzaSyAqAZ9i3L4dMtRAP8O-qDVNk7iPzrG5gsg,AIzaSyCm64O3VnVbXLsiPEhjSWwPgEmjveObQE8,AIzaSyApDY8KavbT3p0pibPSs9xy34RvtunzvSM,AIzaSyAPhjW7ZGG5q9LJ-8r6xgxoggNG_uaeWNM";

const apiKeysFromList = (USER_PROVIDED_KEYS_STRING || "").split(',').map(k => k.trim()).filter(k => k);

let apiKeys = [];
if (apiKeysFromList.length > 0) {
    apiKeys = apiKeysFromList;
    console.log(`Using a list of ${apiKeys.length} API keys for rotation.`);
} else if (GEMINI_API_KEY_PRIMARY) {
    apiKeys = [GEMINI_API_KEY_PRIMARY];
    console.log("Using a single primary API_KEY.");
} else {
    const errorMsg = "CRITICAL: No API keys configured (neither USER_PROVIDED_KEYS_STRING nor a primary API_KEY).";
    console.error(errorMsg);
    alert(errorMsg + " The application cannot start.");
    throw new Error(errorMsg);
}

let currentApiKeyIndex = 0;
let ai;

const tickerInput = document.getElementById('ticker-input');
const exchangeInput = document.getElementById('exchange-input');
const getPriceButton = document.getElementById('get-price-button');
const resultsOutput = document.getElementById('results-output');
const tradingViewWidgetContainer = document.getElementById('tradingview-widget-container');
const plotlyChartOutput = document.getElementById('plotly-chart-output');
const optionsStrategyChartsContainer = document.getElementById('options-strategy-charts-container');
const optionsStrategyChartsOutput = document.getElementById('options-strategy-charts-output');
const sourcesContainerWrapper = document.getElementById('sources-container-wrapper');
const toggleSourcesButton = document.getElementById('toggle-sources-button');
const sourcesContent = document.getElementById('sources-content');
const spotPriceValueElement = document.getElementById('spot-price-value');
const errorsSection = document.getElementById('errors-section');
const copyErrorsButton = document.getElementById('copy-errors-button');
const copyErrorsStatus = document.getElementById('copy-errors-status');
const toggleRateLimitInfoButton = document.getElementById('toggle-rate-limit-info-button');
const rateLimitInfoContent = document.getElementById('rate-limit-info-content');
const cooldownTimerElement = document.getElementById('cooldown-timer');
const toggleDataStorageInfoButton = document.getElementById('toggle-data-storage-info-button');
const dataStorageInfoContent = document.getElementById('data-storage-info-content');


console.log("DOM elements obtained.");

const DB_NAME = 'StockAnalyzerDB';
const DB_VERSION = 3;
const STORE_NAME = 'analyses';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_API_CALL_INTERVAL_MS = 60000; // 60 seconds cooldown for API calls

console.log(`Cache settings: DB_NAME=${DB_NAME}, STORE_NAME=${STORE_NAME}, CACHE_TTL_MS=${CACHE_TTL_MS}`);
console.log(`API call interval: MIN_API_CALL_INTERVAL_MS=${MIN_API_CALL_INTERVAL_MS}`);

let loggedErrors = [];
let previousSpotPrice = null;
let lastApiCallTimestamp = 0;
let cooldownIntervalId = null;

console.log("Global variables initialized.");


/**
 * BlackScholesModel class for calculating European option prices.
 * Based on the Black-Scholes-Merton model.
 * Source: Fischer Black and Myron Scholes (1973). "The Pricing of Options and Corporate Liabilities". Journal of Political Economy. 81 (3): 637–654.
 * And Robert C. Merton (1973). "Theory of Rational Option Pricing". Bell Journal of Economics and Management Science. 4 (1): 141–183.
 */
class BlackScholesModel {
    // Standard Normal Cumulative Distribution Function (CDF)
    // Using Abramowitz and Stegun approximation (Formula 7.1.26)
    _cdf(x) {
        const p = 0.2316419;
        const b1 = 0.319381530;
        const b2 = -0.356563782;
        const b3 = 1.781477937;
        const b4 = -1.821255978;
        const b5 = 1.330274429;

        const t = 1.0 / (1.0 + p * Math.abs(x));
        const y = 1.0 - (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-x * x / 2.0) *
                  (b1 * t + b2 * Math.pow(t, 2) + b3 * Math.pow(t, 3) + b4 * Math.pow(t, 4) + b5 * Math.pow(t, 5));

        return x < 0 ? 1.0 - y : y;
    }

    calculateD1D2(S, K, T, r, sigma) {
        if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
            logError("Invalid input for Black-Scholes d1/d2: S, K, T, sigma must be positive.", "BlackScholesInputError");
            return null;
        }
        const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);
        return { d1, d2 };
    }
    
    getCallPrice(S, K, T, r, sigma) {
        const d1d2 = this.calculateD1D2(S, K, T, r, sigma);
        if (!d1d2) return null;
        const { d1, d2 } = d1d2;
        return S * this._cdf(d1) - K * Math.exp(-r * T) * this._cdf(d2);
    }

    getPutPrice(S, K, T, r, sigma) {
        const d1d2 = this.calculateD1D2(S, K, T, r, sigma);
        if (!d1d2) return null;
        const { d1, d2 } = d1d2;
        return K * Math.exp(-r * T) * this._cdf(-d2) - S * this._cdf(-d1);
    }
}


function initializeGenAIClient() {
    const apiKeyToUse = apiKeys[currentApiKeyIndex];
    if (!apiKeyToUse) {
        logError("No API key available at current index for GenAI client initialization.", "API Key Error");
        // Attempt to cycle to the next key if multiple are available
        if (apiKeys.length > 1) {
            currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
            console.warn("Attempted to cycle API key due to missing key at current index.");
            const nextKey = apiKeys[currentApiKeyIndex];
            if (!nextKey) { // This should ideally not happen if apiKeys has entries
                 throw new Error("No API key available for GenAI client after attempting to cycle.");
            }
            ai = new GoogleGenAI({ apiKey: nextKey });
            console.log(`GoogleGenAI client initialized with API key at NEW index ${currentApiKeyIndex}.`);
            return;
        }
        // If only one key was configured and it's missing, or no keys at all
        throw new Error("No API key available for GenAI client.");
    }
    ai = new GoogleGenAI({ apiKey: apiKeyToUse });
    console.log(`GoogleGenAI client initialized with API key at index ${currentApiKeyIndex}.`);
}


function logError(error, context) {
  const apiKeyUsed = apiKeys[currentApiKeyIndex] ? `Key ending with ...${apiKeys[currentApiKeyIndex].slice(-4)} (Index ${currentApiKeyIndex})` : 'N/A';
  console.error(`Error encountered. Context: ${context || 'N/A'}. API Key Used: ${apiKeyUsed}`, error);

  const newErrorEntry = {
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

function openDB() {
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
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        console.log(`Object store '${STORE_NAME}' created.`);
      }
      console.log(`IndexedDB upgrade complete from version ${event.oldVersion} to ${event.newVersion}.`);
    };
  });
}

async function getCachedAnalysis(ticker, exchange) {
  const id = `${ticker}_${exchange}`;
  console.log(`Attempting to get cached analysis for ${id} from IndexedDB.`);
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onerror = () => {
        logError(request.error, `Error getting cached analysis for ${id} from IndexedDB`);
        reject(request.error);
      };
      request.onsuccess = () => {
        if (request.result && (Date.now() - request.result.timestamp < CACHE_TTL_MS)) {
          console.log(`IndexedDB Cache hit for ${id}. Timestamp: ${new Date(request.result.timestamp).toISOString()}`);
          resolve(request.result);
        } else {
          if (request.result) {
              console.log(`IndexedDB Cache expired or invalid for ${id}. Deleting.`);
              const deleteTransaction = db.transaction(STORE_NAME, 'readwrite');
              const deleteStore = deleteTransaction.objectStore(STORE_NAME);
              const deleteRequest = deleteStore.delete(id);
              deleteRequest.onerror = () => logError(deleteRequest.error, `Failed to delete expired IndexedDB cache for ${id}`);
              deleteRequest.onsuccess = () => console.log(`Successfully deleted expired IndexedDB cache for ${id}`);
          } else {
            console.log(`IndexedDB Cache miss for ${id}.`);
          }
          resolve(null);
        }
      };
    });
  } catch (dbError) {
    logError(dbError, `Failed to open IndexedDB for getCachedAnalysis of ${id}`);
    return null;
  }
}

async function cacheAnalysis(data) {
  // TODO: Implement data compression (e.g., using Pako for gzip) here for larger responses, especially responseText.
  console.log(`Attempting to cache analysis for ${data.id} in IndexedDB.`);
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data);
      request.onerror = () => {
        logError(request.error, `Error caching analysis for ${data.id} in IndexedDB`);
        reject(request.error);
      };
      request.onsuccess = () => {
        console.log(`Analysis for ${data.id} cached successfully in IndexedDB.`);
        resolve();
      };
    });
  } catch (dbError) {
     logError(dbError, `Failed to open IndexedDB for cacheAnalysis of ${data.id}`);
  }
}

function displayMessage(htmlContent, type = 'info') {
  console.log(`Displaying message of type '${type}'. Content snippet: ${htmlContent.substring(0, 50)}...`);
  let typeClass = type;
  if (type === 'cached-ratelimit') typeClass = 'error';
  else if (type === 'cached') typeClass = 'info';

  resultsOutput.innerHTML = `<div class="message ${typeClass}">${htmlContent}</div>`;
}

function updateSpotPriceDisplay(newPrice) {
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

function displayFormattedResult(
    geminiResponseText,
    groundingChunks,
    spotPrice,
    fromCacheType = 'none',
    rawOptionsData,
    optionsDataSourceOrigin = 'none'
) {
  console.log(`Displaying formatted result. From cache type: ${fromCacheType}. Spot price: ${spotPrice}. Options data present: ${!!rawOptionsData}. Options Source: ${optionsDataSourceOrigin}`);
  let mainHtml = marked.parse(geminiResponseText);

  let optionsSourceMessage = "";
  if (rawOptionsData && rawOptionsData.optionsChain && rawOptionsData.optionsChain.length > 0) {
      if (optionsDataSourceOrigin === 'nasdaq') {
          optionsSourceMessage = `<p class="mt-3 small text-muted"><em>Options strategies are informed by live options chain data fetched directly from Nasdaq.</em></p>`;
      } else if (optionsDataSourceOrigin === 'yahoo') {
          optionsSourceMessage = `<p class="mt-3 small text-muted"><em>Options strategies are informed by live options chain data fetched directly from Yahoo Finance.</em></p>`;
      } else if (optionsDataSourceOrigin === 'ai') { // Data parsed from AI's response
            const barchartStatementMatch = geminiResponseText.match(/Options data sourced from Barchart/i);
            const nasdaqStatementMatch = geminiResponseText.match(/Options data sourced from Nasdaq/i); // AI sourced
            const yahooStatementMatch = geminiResponseText.match(/Options data sourced from Yahoo Finance/i); // AI sourced
            const wsjStatementMatch = geminiResponseText.match(/Options data sourced from WSJ/i);
            const noRealDataMatch = geminiResponseText.match(/Could not reliably extract options data|using generalized premiums|illustrative premiums/i);

            if (rawOptionsData.dataSourceStatement) {
                optionsSourceMessage = `<p class="mt-3 small text-muted"><em>${rawOptionsData.dataSourceStatement} (Data provided by AI)</em></p>`;
            } else if (barchartStatementMatch) {
                optionsSourceMessage = `<p class="mt-3 small text-muted"><em>Options strategies are informed by AI-reported options chain data from Barchart.</em></p>`;
            } else if (nasdaqStatementMatch) {
                optionsSourceMessage = `<p class="mt-3 small text-muted"><em>Options strategies are informed by AI-reported options chain data from Nasdaq.</em></p>`;
            } else if (yahooStatementMatch) {
                optionsSourceMessage = `<p class="mt-3 small text-muted"><em>Options strategies are informed by AI-reported options chain data from Yahoo Finance (fallback).</em></p>`;
            } else if (wsjStatementMatch) {
                optionsSourceMessage = `<p class="mt-3 small text-muted"><em>Options strategies are informed by AI-reported options chain data from WSJ (fallback).</em></p>`;
            } else if (noRealDataMatch) {
                optionsSourceMessage = `<p class="mt-3 small text-warning"><em>Note: AI indicated that real-time options data from primary/fallback sources could not be reliably extracted. Suggested strategy premiums may be illustrative. (Data provided by AI)</em></p>`;
            } else {
                optionsSourceMessage = `<p class="mt-3 small text-muted"><em>Options strategies are informed by AI-reported options chain data (attempted from Barchart/Nasdaq, then Yahoo Finance/WSJ).</em></p>`;
            }
      }
  } else if (fromCacheType === 'none' && geminiResponseText.toLowerCase().includes("options strategy")) {
      optionsSourceMessage = `<p class="mt-3 small text-warning"><em>Note: AI mentioned options, but specific options chain data was not available from direct fetch or AI response to verify premiums for charts.</em></p>`;
  }
  mainHtml += optionsSourceMessage;


  if (fromCacheType === 'standard') {
    mainHtml = `<div><strong class="cached-notice">[Served from Local Cache]</strong></div>` + mainHtml;
  } else if (fromCacheType === 'ratelimit') {
    mainHtml = `<div><strong class="cached-notice error">[Served from Local Cache due to API Rate Limit or Error - Data may be outdated. Key may have rotated.]</strong></div>` + mainHtml;
  }

  const messageTypeForDisplay = fromCacheType === 'none' ? 'success' : (fromCacheType === 'ratelimit' ? 'cached-ratelimit' : 'cached');
  displayMessage(mainHtml, messageTypeForDisplay);
  updateSpotPriceDisplay(spotPrice); // This will update based on the most current data source (API or Cache)

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

function updateTradingViewWidget(ticker, exchange) {
  console.log(`Updating TradingView widget. Ticker: ${ticker}, Exchange: ${exchange}`);
  if (!tradingViewWidgetContainer) {
    console.warn("tradingViewWidgetContainer not found.");
    return;
  }

  const existingScript = tradingViewWidgetContainer.querySelector('script[src*="tradingview.com"]');
  if (existingScript) existingScript.remove();

  const innerWidgetDiv = tradingViewWidgetContainer.querySelector('.tradingview-widget-container__widget');
  if (innerWidgetDiv) innerWidgetDiv.innerHTML = '';

  const effectiveTicker = ticker || "TSLA";
  const effectiveExchange = exchange || "NASDAQ";
  const tradingViewSymbol = `${effectiveExchange.toUpperCase().replace(/[^A-Z0-9]/g, '')}:${effectiveTicker.toUpperCase().replace(/[^A-Z0-9.]/g, '')}`;

  const widgetConfig = {
    autosize: true, symbol: tradingViewSymbol, interval: "1", timezone: "America/Los_Angeles",
    theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light",
    style: "1", locale: "en", withdateranges: true, allow_symbol_change: true,
    studies: ["Volume@tv-basicstudies", "RSI@tv-basicstudies", "MACD@tv-basicstudies", "BB@tv-basicstudies"],
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

function displayPlotlyChart(dataForPlot, title, fromCacheType = 'none') {
  console.log(`Displaying Plotly chart. Title: ${title}. From cache type: ${fromCacheType}. Data points: ${dataForPlot?.length}`);
  if (!plotlyChartOutput) {
    console.warn("plotlyChartOutput element not found.");
    return;
  }
  if (!dataForPlot || dataForPlot.length === 0) {
    plotlyChartOutput.innerHTML = "<p>No plottable OHLCV data available to display.</p>";
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
      type: 'candlestick', name: 'OHLC', xaxis: 'x', yaxis: 'y',
      increasing: {line: {color: '#26A69A'}}, decreasing: {line: {color: '#EF5350'}}
    };
    const volumeTrace = {
      x: dates, y: volumes, type: 'bar', name: 'Volume', xaxis: 'x', yaxis: 'y2',
      marker: { color: dataForPlot.map(d => d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)')}
    };

    let chartTitle = title;
    if (fromCacheType === 'standard') chartTitle = `${title} (Cached)`;
    else if (fromCacheType === 'ratelimit') chartTitle = `${title} (Cached - API Error)`;

    const layout = {
      title: chartTitle, dragmode: 'zoom', showlegend: true,
      xaxis: { autorange: true, domain: [0, 1], rangeslider: { visible: false }, title: 'Date', type: 'date'},
      yaxis: { autorange: true, domain: [0.25, 1], title: 'Price'},
      yaxis2: { autorange: true, domain: [0, 0.2], title: 'Volume', showticklabels: true, side: 'right'},
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#f0f0f0' : '#333' },
      grid: {rows: 2, columns: 1, pattern: 'independent'},
      legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1 },
    };

    Plotly.newPlot(plotlyChartOutput, [candlestickTrace, volumeTrace], layout, {responsive: true});
    console.log("Plotly OHLCV chart rendered.");
  } catch (e) {
    logError(e, "Error rendering Plotly OHLCV chart");
    plotlyChartOutput.innerHTML = '<p>Error rendering OHLCV chart. Check console for details.</p>';
  }
}

function parseOhlcvDataFromResponse(textOutput) {
    console.log("Attempting to parse OHLCV data from response.");
    try {
        const jsonRegexStrict = /```json\s*(\[[\s\S]*?\{"date":\s*".*?",\s*"open":\s*[\d.]+,\s*"high":\s*[\d.]+,\s*"low":\s*[\d.]+,\s*"close":\s*[\d.]+,\s*"volume":\s*\d+\s*\}[\s\S]*?\])\s*```/ms;
        const jsonRegexLoose = /(\[[\s\S]*?\{"date":\s*".*?",\s*"open":\s*[\d.]+,\s*"high":\s*[\d.]+,\s*"low":\s*[\d.]+,\s*"close":\s*[\d.]+,\s*"volume":\s*\d+\s*\}[\s\S]*?\])/ms;
        let plottableData = null;

        let match = textOutput.match(jsonRegexStrict);
        if (match && match[1]) {
            try { plottableData = JSON.parse(match[1]); } catch (e) {
                logError(e, `Strict JSON block found for OHLCV but failed to parse. Content: ${match[1]}`);
            }
        }

        if (!plottableData) {
            match = textOutput.match(jsonRegexLoose);
            if (match && match[1]) {
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
          console.log("Successfully parsed and validated OHLCV data:", plottableData.length);
          return plottableData;
        }
        console.warn("Failed to parse or validate OHLCV data from response text.");
        return null;
    } catch (e) {
        logError(e, "Error during OHLCV data parsing process");
        return null;
    }
}

function parseSpotPriceFromResponse(textOutput) {
    const spotPriceRegexes = [
        /(?:current spot price for [A-Z.]+ is|Current Spot Price:)\s*([\$€£]?\s*\d{1,3}(?:[,.]\d{3})*(\.\d+)?)/i,
        /price is\s*([\$€£]?\s*\d{1,3}(?:[,.]\d{3})*(\.\d+)?)/i,
        /([\$€£]?\s*\d+\.\d{2,})/i
    ];
    for (const regex of spotPriceRegexes) {
        const match = textOutput.match(regex);
        if (match && match[1]) {
            try {
                const priceString = match[1].replace(/[^\d.]/g, '');
                const price = parseFloat(priceString);
                if (!isNaN(price) && price > 0 && price < 10000000) {
                     console.log(`Parsed spot price with regex ${regex}: ${price}`);
                    return price;
                }
            } catch (e) {
                logError(e, `Error parsing spot price. Matched: ${match[1]} with regex ${regex}`);
            }
        }
    }
    console.warn("Could not parse spot price from response text.");
    return null;
}

function parseOptionsDataSourceStatement(textOutput) {
    // This function is primarily for AI-provided statements if direct fetch fails.
    const patterns = [
        /(Options data sourced from Barchart\.)/i,
        /(Options data sourced from Nasdaq\.)/i,
        /(Options data sourced from Yahoo Finance\.)/i,
        /(Options data sourced from WSJ\.)/i,
        /(Could not reliably extract options data from.*?illustrative\.)/i,
        /(Options data primarily from Barchart\.)/i,
        /(Options data primarily from Nasdaq\.)/i,
        /(Options data primarily from Yahoo Finance\.)/i,
        /(Options data primarily from WSJ\.)/i
    ];
    for (const pattern of patterns) {
        const match = textOutput.match(pattern);
        if (match && match[1]) {
            console.log("Parsed AI options data source statement:", match[1]);
            return match[1];
        }
    }
    return null;
}

function parseRawOptionsDataFromResponse(textOutput) {
    console.log("Attempting to parse structured options data from AI response (fallback).");
    try {
        const optionsJsonRegex = /```json\s*(\{[\s\S]*?"optionsChain":\s*\[[\s\S]*?\][\s\S]*?\})\s*```/ms;
        let match = textOutput.match(optionsJsonRegex);
        let jsonStr;

        if (match && match[1]) {
            jsonStr = match[1];
        } else {
            const looserOptionsJsonRegex = /("optionsChain":\s*\[[\s\S]*?\])/ms;
            match = textOutput.match(looserOptionsJsonRegex);
            if (match && match[1]) {
                jsonStr = `{${match[1]}}`;
            }
        }

        if (jsonStr) {
            const parsed = JSON.parse(jsonStr);
            if (parsed && Array.isArray(parsed.optionsChain)) {
                const isValid = parsed.optionsChain.every((entry) =>
                    typeof entry.expirationDate === 'string' &&
                    Array.isArray(entry.calls) && Array.isArray(entry.puts) &&
                    entry.calls.every((c) => typeof c.strike === 'number') &&
                    entry.puts.every((p) => typeof p.strike === 'number')
                );
                if (isValid) {
                    const dataSourceStmt = parseOptionsDataSourceStatement(textOutput);
                    console.log(`Successfully parsed AI-provided options data with ${parsed.optionsChain.length} expiration(s). AI Source statement: ${dataSourceStmt}`);
                    return { optionsChain: parsed.optionsChain, dataSourceStatement: dataSourceStmt || "Options data parsed from AI response." };
                } else {
                     logError("AI-parsed optionsChain data has invalid structure.", "OptionsDataParsingFromAI");
                }
            } else {
                logError("AI-parsed JSON for options data does not contain valid 'optionsChain' array.", "OptionsDataParsingFromAI");
            }
        } else {
            console.warn("No structured options data (optionsChain JSON block) found in AI response.");
        }
    } catch (e) {
        logError(e, "Error parsing options data JSON from AI response text");
    }
    return null;
}


function parseOptionsStrategiesFromResponse(textOutput, hasFetchedOptionsData) {
    console.log(`Attempting to parse options strategies from response. HasFetchedOptionsData: ${hasFetchedOptionsData}`);
    const strategies = [];
    const strategyBlockRegex = /### Options Strategy: (.*?)\s*\*\*Textual Description:\*\*\s*(.*?)\s*\*\*Parameters:\*\*\s*([\s\S]*?)(?=\n### Options Strategy:|\n{3,}|$)/gs;

    // Regex for legs: premium is now optional in the text
    const legRegex = /- Leg\d+_Action: (Buy|Sell)\s*- Leg\d+_Type: (Call|Put)\s*- Leg\d+_Strike: ([\d.]+)(?:\s*- Leg\d+_Premium: ([\d.]+))?/g;
    const typeRegex = /- Type: (.*?)\n/; // Strategy type (e.g., Bull Call Spread)
    const netPremiumRegex = /- Net_Premium: ([\d.]+) \((Debit|Credit)\)/; // If AI provides illustrative
    const suggestedExpirationFocusRegex = /- Suggested_Expiration_Focus: (.*?)\n/;
    const netPremiumOutlookRegex = /- Net_Premium_Outlook: (.*?)\n/;


    let blockMatch;
    while ((blockMatch = strategyBlockRegex.exec(textOutput)) !== null) {
        const strategyTitle = blockMatch[1].trim();
        const textualDesc = blockMatch[2].trim();
        const paramsBlock = blockMatch[3];

        const typeMatch = paramsBlock.match(typeRegex);
        const strategyName = typeMatch ? typeMatch[1].trim() : strategyTitle;

        const legs = [];
        let legMatch;
        while ((legMatch = legRegex.exec(paramsBlock)) !== null) {
            legs.push({
                action: legMatch[1],
                type: legMatch[2],
                strike: parseFloat(legMatch[3]),
                premium: legMatch[4] ? parseFloat(legMatch[4]) : undefined, // Premium is optional
            });
        }

        let netPremium = undefined;
        let netPremiumOutlook = undefined;

        if (hasFetchedOptionsData) {
            const outlookMatch = paramsBlock.match(netPremiumOutlookRegex);
            if (outlookMatch) netPremiumOutlook = outlookMatch[1].trim();
        } else {
            const netPremiumMatchText = paramsBlock.match(netPremiumRegex);
            if (netPremiumMatchText) {
                netPremium = parseFloat(netPremiumMatchText[1]);
                if (netPremiumMatchText[2].toLowerCase() === 'credit') {
                    netPremium *= -1;
                }
            } else if (legs.every(l => l.premium !== undefined)) { // Calculate if all legs have premium (AI fallback)
                netPremium = legs.reduce((acc, leg) => acc + (leg.action === 'Buy' ? leg.premium : -leg.premium), 0);
                 console.warn(`Net premium for ${strategyName} (AI fallback) calculated from AI leg premiums: ${netPremium.toFixed(2)}`);
            }
        }

        const suggestedFocusMatch = paramsBlock.match(suggestedExpirationFocusRegex);
        const suggestedExpirationFocus = suggestedFocusMatch ? suggestedFocusMatch[1].trim() : undefined;

        if (legs.length > 0) {
            strategies.push({
                strategyName,
                textualDescription: textualDesc,
                legs,
                netPremium, // Could be undefined if hasFetchedOptionsData is true
                suggestedExpirationFocus,
                netPremiumOutlook
            });
        } else {
            console.warn(`Could not parse legs for strategy: ${strategyName} from params block:`, paramsBlock);
        }
    }

    if (strategies.length > 0) {
        console.log(`Successfully parsed ${strategies.length} options strategies.`);
        return strategies;
    }
    console.warn("No options strategies could be parsed from the response.");
    return null;
}


function calculateStrategyPayoff(
    strategy,
    currentSpotPrice,
    actualOptionsData,
    priceRangeFactor = 0.3
) {
    const { strategyName, legs, textualDescription, suggestedExpirationFocus } = strategy;

    if (!actualOptionsData || actualOptionsData.optionsChain.length === 0) {
        logError(`Cannot calculate payoff for ${strategyName}: No actual options data available.`, "PayoffCalculation");
        return null;
    }

    // Determine target expiration date
    let targetExpirationEntry;
    if (suggestedExpirationFocus) {
        // Simplistic match for now: find first expiration containing the focus string, or default
        targetExpirationEntry = actualOptionsData.optionsChain.find(
            exp => exp.expirationDate.includes(suggestedExpirationFocus) || // e.g. "2024-09-20"
                   (suggestedExpirationFocus.toLowerCase().includes("nearest") && actualOptionsData.optionsChain.length > 0)
        );
    }
    if (!targetExpirationEntry) {
        targetExpirationEntry = actualOptionsData.optionsChain[0]; // Default to first available
    }
    if (!targetExpirationEntry) {
        logError(`Cannot calculate payoff for ${strategyName}: No suitable expiration found in actualOptionsData. Focus: ${suggestedExpirationFocus}`, "PayoffCalculation");
        return null;
    }
    console.log(`For strategy ${strategyName}, using expiration ${targetExpirationEntry.expirationDate}`);


    let calculatedNetPremium = 0;
    const legsWithLivePremiums = [];

    for (const leg of legs) {
        const contracts = leg.type === 'Call' ? targetExpirationEntry.calls : targetExpirationEntry.puts;
        const contract = contracts.find(c => c.strike === leg.strike || c.strikePrice === leg.strike);

        if (!contract) {
            logError(`Contract for leg ${leg.type} ${leg.strike} not found in fetched data for ${targetExpirationEntry.expirationDate}. Strategy: ${strategyName}`, "PayoffCalculation");
            return null; // Cannot calculate if a leg is missing
        }

        let livePremium;
        if (contract.bid !== undefined && contract.ask !== undefined && contract.bid > 0 && contract.ask > 0) {
            if ((contract.ask - contract.bid) / contract.ask < 0.25) { // Spread less than 25% of ask
                 livePremium = (contract.bid + contract.ask) / 2;
            } else {
                livePremium = contract.lastPrice; // Wide spread, use lastPrice
                 console.warn(`Wide spread for ${leg.type} ${leg.strike}, using lastPrice: ${livePremium}. Bid: ${contract.bid}, Ask: ${contract.ask}`);
            }
        } else {
            livePremium = contract.lastPrice;
        }

        if (livePremium === undefined || livePremium < 0) { // Allow 0 premium for far OTM options that might be illiquid
             logError(`Invalid or missing live premium for leg ${leg.type} ${leg.strike} (Premium: ${livePremium}). Contract: ${JSON.stringify(contract)}. Strategy: ${strategyName}`, "PayoffCalculation");
            // If AI gave a premium and we couldn't find live one, maybe use AI's? For now, fail.
            // Or, if it's a "Sell" leg far OTM, a 0 premium might be acceptable in some rare cases if lastPrice is 0.
            // However, for calculation, we need a number. If lastPrice is 0 and bid/ask are also 0 or undefined, this is problematic.
            // For robustness, let's assume if lastPrice is 0, and bid/ask are not useful, it's effectively 0.
            if (livePremium === undefined && contract.lastPrice === 0) livePremium = 0;
            else return null; // Prematurely exit if a valid premium cannot be determined
        }

        legsWithLivePremiums.push({ ...leg, premium: livePremium });
        calculatedNetPremium += (leg.action === 'Buy' ? livePremium : -livePremium);
    }

    console.log(`Strategy: ${strategyName}, Calculated Net Premium from live data: ${calculatedNetPremium.toFixed(2)}`);

    const pricePoints = 100;
    const minPrice = Math.max(0.01, currentSpotPrice * (1 - priceRangeFactor));
    const maxPrice = currentSpotPrice * (1 + priceRangeFactor);
    const step = (maxPrice - minPrice) / pricePoints;

    const xValues = [];
    const yValues = [];

    for (let i = 0; i <= pricePoints; i++) {
        const S = minPrice + i * step;
        xValues.push(S);
        let payoff = 0;

        legsWithLivePremiums.forEach(leg => {
            let legPayoff = 0;
            if (leg.type === 'Call') {
                legPayoff = Math.max(0, S - leg.strike);
            } else {
                legPayoff = Math.max(0, leg.strike - S);
            }
            // Premium is already part of calculatedNetPremium
            payoff += (leg.action === 'Buy' ? legPayoff : -legPayoff);
        });
        yValues.push(payoff - calculatedNetPremium); // Subtract the *actual* net cost/credit
    }
    return { x: xValues, y: yValues, name: strategyName, textualDescription, calculatedNetPremium };
}


function displayOptionsStrategyCharts(
    strategiesData,
    fromCacheType = 'none',
    optionsDataSource
) {
    if (!optionsStrategyChartsContainer || !optionsStrategyChartsOutput) {
        console.warn("Options strategy chart container elements not found.");
        return;
    }

    optionsStrategyChartsOutput.innerHTML = '';

    if (!strategiesData || strategiesData.length === 0) {
        optionsStrategyChartsContainer.style.display = 'block';
        optionsStrategyChartsOutput.innerHTML = `<p class="col-12 text-center">No options strategy data available to display charts.</p>`;
        console.log("No options strategy data to display.");
        return;
    }

    optionsStrategyChartsContainer.style.display = 'block';

    strategiesData.forEach((strategy, index) => {
        const chartId = `options-chart-${index}`;
        const chartContainer = document.createElement('div');
        chartContainer.className = 'col-md-6 mb-3';

        let dataSourceInfo = "";
        if (optionsDataSource === 'nasdaq') dataSourceInfo = "(Live Nasdaq Data)";
        else if (optionsDataSource === 'yahoo') dataSourceInfo = "(Live Yahoo Finance Data)";
        else if (optionsDataSource === 'ai') dataSourceInfo = "(AI Reported Data)";

        let cacheInfo = "";
        if (fromCacheType === 'standard') cacheInfo = "(Cached)";
        else if (fromCacheType === 'ratelimit') cacheInfo = "(Cached - API Error)";


        chartContainer.innerHTML = `
            <div class="w3-card-2 h-100">
                <div class="w3-container">
                     <h5 class="text-center mt-2 chart-subheader">${strategy.name} ${dataSourceInfo} ${cacheInfo}</h5>
                     <p class="text-center small text-muted">Net Premium: ${strategy.calculatedNetPremium.toFixed(2)} (${strategy.calculatedNetPremium >=0 ? 'Debit' : 'Credit'})</p>
                </div>
                <div id="${chartId}" class="plotly-chart-options"></div>
                ${strategy.textualDescription ? `<div class="w3-container w3-small pb-2 options-textual-desc"><p><strong>Description:</strong> ${marked.parse(strategy.textualDescription)}</p></div>` : ''}
            </div>`;
        optionsStrategyChartsOutput.appendChild(chartContainer);

        const trace = {
            x: strategy.x,
            y: strategy.y,
            type: 'scatter',
            mode: 'lines',
            name: 'P/L',
            line: { color: '#007bff' }
        };

        const layout = {
            title: { text: '', font: {size: 14} },
            xaxis: { title: 'Underlying Price at Expiration', automargin: true },
            yaxis: { title: 'Profit / Loss', automargin: true, zeroline: true, zerolinecolor: '#888', zerolinewidth: 1 },
            margin: { l: 50, r: 20, b: 40, t: 20, pad: 4 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#f0f0f0' : '#333' },
            height: 300,
            showlegend: false
        };

        try {
            Plotly.newPlot(chartId, [trace], layout, {responsive: true, displayModeBar: false});
        } catch (e) {
            logError(e, `Error rendering Plotly chart for options strategy: ${strategy.name}`);
            const errorDiv = document.getElementById(chartId);
            if(errorDiv) errorDiv.innerHTML = `<p class="text-danger text-center">Error rendering chart for ${strategy.name}.</p>`;
        }
    });
    console.log(`${strategiesData.length} options strategy charts rendered.`);
}

function startVisualCooldown(timestampOfCallAttempt) {
    if (cooldownIntervalId) clearInterval(cooldownIntervalId);
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
        } else {
            const remainingSeconds = Math.ceil(remainingMs / 1000);
            if (cooldownTimerElement) {
                cooldownTimerElement.textContent = `Next request in ${remainingSeconds}s`;
                cooldownTimerElement.style.display = 'block';
            }
            if (getPriceButton) getPriceButton.disabled = true;
        }
    };
    updateTimer(); // Run immediately
    cooldownIntervalId = window.setInterval(updateTimer, 1000);
}

async function loadInitialStockData(ticker, exchange) {
    console.log(`Attempting to load initial data for ${ticker}/${exchange} from IndexedDB cache on app init.`);
    updateTradingViewWidget(ticker, exchange);

    try {
        const cachedData = await getCachedAnalysis(ticker, exchange);
        if (cachedData) {
            console.log(`Found cached analysis for ${ticker}/${exchange} in IndexedDB.`);
            displayMessage('<p>Displaying previously cached data for default ticker...</p>', 'cached');
            if (plotlyChartOutput) plotlyChartOutput.innerHTML = '<p>Loading cached OHLCV data...</p>';

            // The spot price display might have been set by localStorage, this will update it if cache is fresher
            displayFormattedResult(cachedData.responseText, cachedData.groundingChunks, cachedData.spotPrice, 'standard', cachedData.rawOptionsData, cachedData.optionsDataSourceOrigin || 'ai');

            if (cachedData.ohlcvData) {
                displayPlotlyChart(cachedData.ohlcvData, `7-Day Projected OHLCV for ${ticker}`, 'standard');
            } else {
                if (plotlyChartOutput) plotlyChartOutput.innerHTML = `<p>Cached OHLCV data not found for ${ticker}.</p>`;
            }

            if (cachedData.parsedOptionsStrategies && cachedData.spotPrice && cachedData.rawOptionsData) {
                const optionsChartData = cachedData.parsedOptionsStrategies.map(strat =>
                    calculateStrategyPayoff(strat, cachedData.spotPrice, cachedData.rawOptionsData)
                ).filter(Boolean); // Filter out nulls if payoff calc failed
                displayOptionsStrategyCharts(optionsChartData, 'standard', cachedData.optionsDataSourceOrigin || 'ai');
            } else {
                if (optionsStrategyChartsContainer && optionsStrategyChartsOutput) {
                    optionsStrategyChartsContainer.style.display = 'block';
                    optionsStrategyChartsOutput.innerHTML = `<p class="col-12 text-center">Cached options strategy data (or required components like spot price/raw options) not found for ${ticker}.</p>`;
                }
            }
             updateSpotPriceDisplay(cachedData.spotPrice); // Ensure spot price is from this more complete cache
        } else {
            console.log(`No valid cache found in IndexedDB for ${ticker}/${exchange}. Spot price might have been set from localStorage earlier.`);
            const initialMessage = `
            <p>No cached data found for ${ticker} on ${exchange}.</p>
            <p>Enter a stock ticker and exchange (or press "Get Projections & Analysis" for the current default: ${ticker}) to receive an analysis.</p>
            <ul>
                <li>Current spot price (displayed above the TradingView chart).</li>
                <li>Company information, price projections, and statistical measures.</li>
                <li>Analysis of potential price reversals with specific timelines (seconds to months).</li>
                <li>Suggestions for alternative tickers based on market movers with short-term gain potential.</li>
                <li>AI-suggested multi-leg options strategies (textual description and payoff diagrams, informed by direct Nasdaq/Yahoo fetch or AI search via Barchart/Nasdaq/Yahoo Finance/WSJ).</li>
                <li>A 7-day projected OHLCV candlestick & volume chart (trading days only).</li>
            </ul>
            <p>The TradingView chart is set to ${ticker}. Sources (if available) will appear at the bottom.</p>
            `;
            displayMessage(initialMessage, 'info');
            if (plotlyChartOutput) plotlyChartOutput.innerHTML = `<p>Projected OHLCV chart for ${ticker} will appear here once data is fetched.</p>`;
            if (optionsStrategyChartsContainer && optionsStrategyChartsOutput) {
                optionsStrategyChartsContainer.style.display = 'none';
                optionsStrategyChartsOutput.innerHTML = `<p class="col-12 text-center initial-options-message">Options strategy payoff diagrams for ${ticker} will appear here once data is fetched.</p>`;
            }
            if (sourcesContainerWrapper) sourcesContainerWrapper.style.display = 'none';
            // Spot price from localStorage might already be displayed. If not, this keeps it as '--.--'
            if (localStorage.getItem(`lastSpotPrice_${ticker}_${exchange}`) === null) {
                 updateSpotPriceDisplay(undefined);
                 previousSpotPrice = null;
            }
        }
    } catch (e) {
        logError(e, `Error loading initial data for ${ticker}/${exchange} from IndexedDB cache`);
        displayMessage(`<p>Error trying to load cached data for ${ticker}. Please try fetching manually.</p>`, 'error');
        updateSpotPriceDisplay(undefined); // Reset on error
        previousSpotPrice = null;
    }
}

function formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function fetchOptionsFromNasdaq(ticker) {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 90); // Look out ~90 days for expirations

    const apiUrl = `https://api.nasdaq.com/api/quote/${ticker.toUpperCase()}/option-chain?assetclass=stocks&limit=30&todate=${formatDateToYYYYMMDD(futureDate)}&export=true`;

    console.log(`Fetching Nasdaq options data from: ${apiUrl}`);
    try {
        const response = await fetch(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 StockProjectionAnalyzer/1.0' }
        });
        if (!response.ok) {
            throw new Error(`Nasdaq API request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return transformNasdaqApiResponse(data, ticker);
    } catch (error) {
        logError(error, `Error fetching or parsing Nasdaq options data for ${ticker}`);
        return null;
    }
}

function transformNasdaqApiResponse(apiResponse, ticker) {
    if (!apiResponse || !apiResponse.data) {
        console.warn("Nasdaq API response is not in the expected format or missing data object.", apiResponse);
        return null;
    }

    let spotPriceFromNasdaq = undefined;
    if (apiResponse.data.lastSalePrice) {
        const priceStr = String(apiResponse.data.lastSalePrice).replace('$', '').trim();
        spotPriceFromNasdaq = parseFloat(priceStr);
        if (isNaN(spotPriceFromNasdaq)) {
            spotPriceFromNasdaq = undefined;
            console.warn(`Could not parse lastSalePrice from Nasdaq response: ${apiResponse.data.lastSalePrice}`);
        } else {
            console.log(`Spot price from Nasdaq response: ${spotPriceFromNasdaq}`);
        }
    }


    if (!apiResponse.data.table || !apiResponse.data.table.rows) {
        console.warn("Nasdaq API response is missing options table data.", apiResponse);
        // Still return if spot price was found, even if options table is missing
        if (spotPriceFromNasdaq !== undefined) {
            return {
                optionsChain: [],
                dataSourceStatement: `Spot price for ${ticker} fetched from Nasdaq. Options chain data was not available in this response.`,
                spotPrice: spotPriceFromNasdaq
            };
        }
        return null;
    }

    const optionsChain = [];
    const expirationsMap = new Map();

    apiResponse.data.table.rows.forEach((contract) => {
        if (!contract.expiryDate || !contract.strikePrice || !contract.c_Last || !contract.p_Last) {
            return;
        }
        const expirationDate = contract.expiryDate.split(' ')[0];
        const [month, day, year] = expirationDate.split('/');
        const formattedExpirationDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;


        if (!expirationsMap.has(formattedExpirationDate)) {
            expirationsMap.set(formattedExpirationDate, { calls: [], puts: [] });
        }
        const currentExpiryGroup = expirationsMap.get(formattedExpirationDate);

        const strike = parseFloat(contract.strikePrice);

        if (contract.c_Last !== '--') {
            currentExpiryGroup.calls.push({
                strike: strike,
                lastPrice: parseFloat(contract.c_Last) || undefined,
                bid: parseFloat(contract.c_Bid) || undefined,
                ask: parseFloat(contract.c_Ask) || undefined,
                volume: parseInt(contract.c_Volume, 10) || undefined,
                openInterest: parseInt(contract.c_Openinterest, 10) || undefined,
                contractSymbol: contract.c_OptionSymbol || undefined
            });
        }

        if (contract.p_Last !== '--') {
             currentExpiryGroup.puts.push({
                strike: strike,
                lastPrice: parseFloat(contract.p_Last) || undefined,
                bid: parseFloat(contract.p_Bid) || undefined,
                ask: parseFloat(contract.p_Ask) || undefined,
                volume: parseInt(contract.p_Volume, 10) || undefined,
                openInterest: parseInt(contract.p_Openinterest, 10) || undefined,
                contractSymbol: contract.p_OptionSymbol || undefined
            });
        }
    });

    const sortedExpirations = Array.from(expirationsMap.keys()).sort();
    const limitedExpirations = sortedExpirations.slice(0, 3);

    for (const expDate of limitedExpirations) {
        const group = expirationsMap.get(expDate);
        group.calls.sort((a,b) => a.strike - b.strike);
        group.puts.sort((a,b) => a.strike - b.strike);
        optionsChain.push({ expirationDate: expDate, calls: group.calls, puts: group.puts });
    }

    if (optionsChain.length === 0 && spotPriceFromNasdaq === undefined) {
        console.warn(`No valid options data or spot price parsed from Nasdaq for ${ticker}`);
        return null;
    }

    return {
        optionsChain,
        dataSourceStatement: `Options data fetched directly from Nasdaq for ${ticker}.`,
        spotPrice: spotPriceFromNasdaq
    };
}


async function fetchOptionsFromYahoo(ticker) {
    const apiUrl = `https://query2.finance.yahoo.com/v7/finance/options/${ticker.toUpperCase()}`;
    console.log(`Fetching Yahoo Finance options data from: ${apiUrl}`);
    try {
        const response = await fetch(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 StockProjectionAnalyzer/1.0' }
        });
        if (!response.ok) {
            throw new Error(`Yahoo Finance API request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return transformYahooApiResponse(data, ticker);
    } catch (error) {
        logError(error, `Error fetching or parsing Yahoo options data for ${ticker}`);
        return null;
    }
}

function transformYahooApiResponse(apiResponse, ticker) {
    if (!apiResponse || !apiResponse.optionChain || !apiResponse.optionChain.result || !apiResponse.optionChain.result[0]) {
        console.warn("Yahoo API response is not in the expected format or missing data (result[0]).", apiResponse);
        return null;
    }

    const optionsData = apiResponse.optionChain.result[0];

    let spotPriceFromYahoo = undefined;
    if (optionsData.quote && optionsData.quote.regularMarketPrice !== undefined) {
        spotPriceFromYahoo = parseFloat(optionsData.quote.regularMarketPrice);
        if (isNaN(spotPriceFromYahoo)) {
            spotPriceFromYahoo = undefined;
            console.warn(`Could not parse regularMarketPrice from Yahoo response: ${optionsData.quote.regularMarketPrice}`);
        } else {
            console.log(`Spot price from Yahoo response: ${spotPriceFromYahoo}`);
        }
    }

    if (!optionsData.options || optionsData.options.length === 0) {
         console.warn("Yahoo API response is missing options chain data (options array).", apiResponse);
        if (spotPriceFromYahoo !== undefined) { // Still return if spot price was found
            return {
                optionsChain: [],
                dataSourceStatement: `Spot price for ${ticker} fetched from Yahoo. Options chain data was not available in this response.`,
                spotPrice: spotPriceFromYahoo
            };
        }
        return null;
    }

    const expirationTimestamps = optionsData.expirationDates || [];
    const optionsByExpiration = optionsData.options || [];

    const optionsChain = [];

    for (let i = 0; i < Math.min(expirationTimestamps.length, 3); i++) {
        const expirationTimestamp = expirationTimestamps[i];
        const expirationDateObj = new Date(expirationTimestamp * 1000);
        const formattedExpirationDate = formatDateToYYYYMMDD(expirationDateObj);

        const calls = [];
        const puts = [];

        const expirationOptionSet = optionsByExpiration.find((optSet) => optSet.expirationDate === expirationTimestamp);
        if (!expirationOptionSet) continue;


        (expirationOptionSet.calls || []).forEach((contract) => {
            calls.push({
                strike: contract.strike,
                lastPrice: contract.lastPrice,
                bid: contract.bid,
                ask: contract.ask,
                volume: contract.volume,
                openInterest: contract.openInterest,
                impliedVolatility: contract.impliedVolatility,
                inTheMoney: contract.inTheMoney,
                contractSymbol: contract.contractSymbol,
            });
        });

        (expirationOptionSet.puts || []).forEach((contract) => {
            puts.push({
                strike: contract.strike,
                lastPrice: contract.lastPrice,
                bid: contract.bid,
                ask: contract.ask,
                volume: contract.volume,
                openInterest: contract.openInterest,
                impliedVolatility: contract.impliedVolatility,
                inTheMoney: contract.inTheMoney,
                contractSymbol: contract.contractSymbol,
            });
        });

        calls.sort((a,b) => a.strike - b.strike);
        puts.sort((a,b) => a.strike - b.strike);

        if(calls.length > 0 || puts.length > 0){
            optionsChain.push({ expirationDate: formattedExpirationDate, calls, puts });
        }
    }
     if (optionsChain.length === 0 && spotPriceFromYahoo === undefined) {
        console.warn(`No valid options data or spot price parsed from Yahoo for ${ticker}`);
        return null;
    }
    return {
        optionsChain,
        dataSourceStatement: `Options data fetched directly from Yahoo Finance for ${ticker}.`,
        spotPrice: spotPriceFromYahoo
    };
}

function buildGeminiPrompt(ticker, exchange, hasFetchedOptionsData) {
    let optionsInstructions = "";
    if (hasFetchedOptionsData) {
        optionsInstructions = `
I have already fetched live options chain data for ${ticker}, including strikes, bid/ask/last premiums, volume, and open interest for various near-term expirations.
YOUR TASK FOR OPTIONS:
1. Briefly summarize key insights one might typically find in an options chain analysis (e.g., regarding open interest, volume, or implied volatility patterns across strikes/expirations). Do not refer to specific numbers unless they are general examples of how such analysis is done.
2. Suggest 2-3 potential multi-leg options strategies suitable for ${ticker} given its current outlook.

For each suggested multi-leg options strategy:
FIRST, provide a textual description, including: rationale, market outlook (e.g., bullish, bearish, neutral, volatile), construction details (e.g., "buy a call at strike X, sell a call at strike Y"), and general risk/reward profile.
SECOND, provide the key parameters in a structured format.
YOU MUST USE THE FOLLOWING FORMAT FOR PARAMETERS and DO NOT INCLUDE PREMIUMS:
### Options Strategy: [Strategy Name e.g., Bull Call Spread]
**Textual Description:** [Your detailed textual description here]
**Parameters:**
- Type: [Strategy Name e.g., Bull Call Spread]
- Suggested_Expiration_Focus: [e.g., "Nearest Monthly Expiration", "Approx 30-45 days out"]
- Leg1_Action: Buy
- Leg1_Type: Call
- Leg1_Strike: [A specific strike price, e.g., 150.00. Choose a sensible strike based on the current spot price of ${ticker}]
- Leg2_Action: Sell
- Leg2_Type: Call
- Leg2_Strike: [A specific strike price, e.g., 155.00]
// Add more legs as needed for the strategy
- Net_Premium_Outlook: [e.g., "Debit", "Credit", "Typically a net debit strategy"]

The application will use the live fetched premiums to calculate the exact net premium and construct payoff diagrams.
DO NOT include an \`optionsChain\` JSON block in your response.
`;
    } else { // Fallback: Ask AI to fetch options data
        optionsInstructions = `
Access and analyze the options chain data for ${ticker}. Your goal is to obtain current premium data (bid/ask/last price) for strike selection.

PRIMARY SOURCES (Attempt in this order):
1. BARCHART: Use Google Search to find options data on Barchart.
   - Construct search query like: "Barchart options ${ticker}"
   - Or try direct URL pattern: \`https://www.barchart.com/stocks/quotes/${ticker}/options?expiration=YYYY-MM-DD-m\`
     (You'll need to determine a suitable near-term monthly expiration. Use your knowledge to find a valid near-term monthly expiry for the URL. Ensure the date format is YYYY-MM-DD).
2. NASDAQ: Use Google Search for Nasdaq options data.
   - Search query: "Nasdaq options ${ticker}"
   - Or try direct URL pattern: \`https://www.nasdaq.com/market-activity/stocks/${ticker}/option-chain\`
FALLBACK SOURCES (If Barchart and Nasdaq fail or lack sufficient data):
3. YAHOO FINANCE: Search "Yahoo Finance options ${ticker}" or use \`https://finance.yahoo.com/quote/${ticker}/options/\`.
4. WSJ: Search "WSJ options ${ticker}".

CRITICAL: In your textual response, YOU MUST CLEARLY STATE which source was primarily used for the \`optionsChain\` JSON data (e.g., "Options data sourced from Barchart.", "Options data sourced from Nasdaq.", "Options data sourced from Yahoo Finance.", "Options data sourced from WSJ.", or "Could not reliably extract options data from primary/fallback sources; the following strategies use generalized premiums and market understanding based on typical volatility for ${ticker}.").

From the chosen source (Barchart, Nasdaq, Yahoo Finance, or WSJ), extract the following data for at least two near-term expiration dates (e.g., the two closest expirations):
- Expiration Date (YYYY-MM-DD)
- For Calls: Strike, Last Price, Bid, Ask, Volume, Open Interest for 5-10 strikes around the current spot price (covering OTM, ATM, ITM).
- For Puts: Strike, Last Price, Bid, Ask, Volume, Open Interest for 5-10 strikes around the current spot price (covering OTM, ATM, ITM).
If specific data points like Bid/Ask are missing, omit them or represent as null/0 if your JSON structure requires a value.

Present this extracted options chain data in a structured JSON format within your response. Demarcate this JSON block clearly (e.g., with \`\`\`json ... \`\`\`):
\`\`\`json
{
  "optionsChain": [
    {
      "expirationDate": "YYYY-MM-DD",
      "calls": [
        {"strike": 150.00, "lastPrice": 5.50, "bid": 5.45, "ask": 5.55, "volume": 1000, "openInterest": 5000}, /* ... more */ ],
      "puts": [ {"strike": 150.00, "lastPrice": 2.30, "bid": 2.25, "ask": 2.35, "volume": 800, "openInterest": 4000}, /* ... more */ ]
    } /* ... more expirations ... */
  ]
}
\`\`\`
This JSON block is CRITICAL for the application if you are providing the data.

Then, using THIS EXTRACTED \`optionsChain\` JSON DATA (if successfully obtained from Barchart/Nasdaq/Yahoo/WSJ) and your overall market analysis:
1. Briefly summarize key insights from the options chain you've listed.
2. Suggest 2-3 potential multi-leg options strategies.

For each suggested multi-leg options strategy:
FIRST, provide a textual description.
SECOND, provide the key parameters in a structured format. WHEN SELECTING STRIKES AND PREMIUMS FOR THESE STRATEGIES, YOU MUST USE THE STRIKES AND THEIR CORRESPONDING BID/ASK PRICES (use midpoint of bid/ask if available and spread is reasonable, otherwise use Last Price if it's sensible) FROM THE \`optionsChain\` JSON DATA YOU PROVIDED. Clearly state the premium used for each leg. The Net_Premium should be calculated based on these leg premiums. If you could not fetch real data and stated so, then you may use typical market premiums, but explicitly state that these are illustrative premiums.

Example of the structured parameter format (premiums MUST be from your extracted data if available):
### Options Strategy: Bull Call Spread
**Textual Description:** This strategy is suitable for moderately bullish outlooks...
**Parameters:**
- Type: Bull Call Spread
- Leg1_Action: Buy
- Leg1_Type: Call
- Leg1_Strike: 150.00
- Leg1_Premium: 5.50
- Leg2_Action: Sell
- Leg2_Type: Call
- Leg2_Strike: 155.00
- Leg2_Premium: 3.20
- Net_Premium: 2.30 (Debit)
`;
    }


return `
Analyze the stock with ticker symbol ${ticker} on the ${exchange} exchange.
Please state the current spot price for ${ticker} clearly in your response, for example: "The current spot price for ${ticker} is XXX.XX."

Provide projected prices and potential timelines for price reversals. These timelines should be specific and can range from very short-term (seconds, minutes, hours) to short-term (days, weeks) and medium-to-long-term (months). Be precise about the expected duration.
Incorporate financial indicators, advanced calculus, linear algebra, differential equations, PCA, and damping concepts in your reversal analysis.
Include statistical measures (Standard Deviation, Mean, Median, Mode) for relevant price data used in projections.
State the company's full name and factors influencing projections. The application caches responses; ensure analysis is up-to-date using your current knowledge and available search data. Conceptually, you can assume the application has access to standard financial models like Black-Scholes for theoretical option pricing if relevant to your discussion of option strategies or theory, but you do not need to perform such calculations or provide their numerical outputs.

Incorporate news, sentiment, and other market data into your analysis:
- Financial News & Sentiment: Consult \`google.com/finance\` and \`finance.yahoo.com\` (search for ${ticker}) for recent news, earnings reports, and general market sentiment.
- Supplementary Data: Check \`https://www.stockoptionschannel.com/symbol/${ticker}/\` for any additional relevant information.
- Real-time Trades (Level 2 Hint): Analyze data patterns from sources like \`https://www.nasdaq.com/market-activity/stocks/${ticker}/latest-real-time-trades?page=1&rows_per_page=100\` to infer short-term price pressure or unusual volume, if discernible through search. Mention if such patterns influence your short-term outlook.
Consider YouTube sentiment if relevant via search.

When suggesting alternative tickers, use market screener data and look for stocks with potential for large percentage gains in a very short timeframe (e.g., minutes, hours, or a few days).
Consult these URLs for market context and screener data:
- General Movers: \`https://www.tradingview.com/markets/stocks-usa/market-movers-all-stocks/\`
- Top Gainers: \`https://www.tradingview.com/markets/stocks-usa/market-movers-gainers/\` and \`https://finance.yahoo.com/markets/stocks/gainers/?start=0&count=100\`
- Pre-Market Gainers: \`https://www.tradingview.com/markets/stocks-usa/market-movers-pre-market-gainers/\`
Clearly state your reasoning for the short-term potential of any alternatives suggested. List these alternative tickers with reasons.

${optionsInstructions}

Finally, provide projected OHLCV (Open, High, Low, Close, Volume) data for the next 7 **upcoming open market trading days** for ${ticker}.
This means you should exclude weekends (Saturdays, Sundays) and any common US stock market holidays (e.g. New Year's Day, MLK Jr. Day, Presidents' Day, Good Friday, Memorial Day, Juneteenth, Independence Day, Labor Day, Thanksgiving, Christmas) within that 7-trading-day window.
Base these projections on all the analysis performed, including technicals, sentiment, news, and options market indicators.
The data should be in a JSON array format, demarcated clearly:
\`\`\`json
[{"date": "YYYY-MM-DD", "open": 170.10, "high": 172.50, "low": 169.80, "close": 171.75, "volume": 1234567}, ...]
\`\`\`
`;
}


async function fetchStockInfo() {
  console.log("fetchStockInfo called.");
  const ticker = tickerInput.value.trim().toUpperCase();
  const exchange = exchangeInput.value.trim().toUpperCase();

  if (!ticker || !exchange) {
    displayMessage('<p>Please enter both a ticker symbol and an exchange.</p>', 'error');
    updateSpotPriceDisplay(undefined);
    previousSpotPrice = null;
    if (optionsStrategyChartsContainer) optionsStrategyChartsContainer.style.display = 'none';
    if (plotlyChartOutput) plotlyChartOutput.innerHTML = '<p>Projected OHLCV candlestick & volume chart will appear here after fetching data.</p>';
    return;
  }

  const now = Date.now();
  if (now - lastApiCallTimestamp < MIN_API_CALL_INTERVAL_MS) {
    const timeToWait = Math.ceil((MIN_API_CALL_INTERVAL_MS - (now - lastApiCallTimestamp)) / 1000);
    displayMessage(`<p>Please wait ${timeToWait} more seconds before fetching new data to avoid API rate limits.</p>`, 'warning');
    if (!cooldownIntervalId) startVisualCooldown(lastApiCallTimestamp); // Ensure cooldown visualization is active
    return;
  }

  if (tickerInput.dataset.lastTicker !== ticker || exchangeInput.dataset.lastExchange !== exchange) {
    previousSpotPrice = null;
    updateSpotPriceDisplay(undefined);
  }
  tickerInput.dataset.lastTicker = ticker;
  exchangeInput.dataset.lastExchange = exchange;

  updateTradingViewWidget(ticker, exchange);

  tickerInput.disabled = true;
  exchangeInput.disabled = true;
  if (sourcesContainerWrapper) sourcesContainerWrapper.style.display = 'none';
  if (sourcesContent) sourcesContent.innerHTML = '';
  if (optionsStrategyChartsContainer) optionsStrategyChartsContainer.style.display = 'none';
  if (optionsStrategyChartsOutput) optionsStrategyChartsOutput.innerHTML = '<p class="col-12 text-center initial-options-message">Loading options strategy payoff diagrams...</p>';

  lastApiCallTimestamp = Date.now();
  startVisualCooldown(lastApiCallTimestamp);
  localStorage.setItem('lastApiCallTimestampGlobal', String(lastApiCallTimestamp));

  displayMessage('<p>Fetching stock projections. Attempting to fetch live options data (Nasdaq/Yahoo)... AI analysis will follow.</p>', 'loading');
  if (plotlyChartOutput) plotlyChartOutput.innerHTML = '<p>Loading projected OHLCV data for chart from API...</p>';

  try {
    initializeGenAIClient();
  } catch (initError) {
    logError(initError, "GenAI Client Initialization Failed in fetchStockInfo");
    displayMessage('<p>Critical error: Could not initialize AI Client. API Key might be missing or invalid. Check console.</p>', 'error');
    tickerInput.disabled = false;
    exchangeInput.disabled = false;
    if (cooldownIntervalId) {
        clearInterval(cooldownIntervalId);
        cooldownIntervalId = null;
        if (getPriceButton) getPriceButton.disabled = false;
        if (cooldownTimerElement) {
            cooldownTimerElement.textContent = "";
            cooldownTimerElement.style.display = 'none';
        }
    }
    return;
  }

  let liveFetchedOptionsData = null;
  let optionsDataSourceOrigin = 'none';
  let spotPriceFromDirectFetch = undefined;

  try {
      liveFetchedOptionsData = await fetchOptionsFromNasdaq(ticker);
      if (liveFetchedOptionsData && liveFetchedOptionsData.optionsChain.length > 0) {
          optionsDataSourceOrigin = 'nasdaq';
          if (liveFetchedOptionsData.spotPrice !== undefined) {
              spotPriceFromDirectFetch = liveFetchedOptionsData.spotPrice;
              console.log(`Spot price ${spotPriceFromDirectFetch} obtained from direct Nasdaq fetch.`);
              updateSpotPriceDisplay(spotPriceFromDirectFetch);
              localStorage.setItem(`lastSpotPrice_${ticker}_${exchange}`, String(spotPriceFromDirectFetch));
          }
          console.log("Successfully fetched and transformed options data from Nasdaq API.");
          displayMessage('<p>Successfully fetched live options data from Nasdaq. Proceeding with AI analysis...</p>', 'loading');
      } else {
          console.log("Nasdaq fetch did not yield data or complete options chain, trying Yahoo Finance.");
          liveFetchedOptionsData = await fetchOptionsFromYahoo(ticker); // This might overwrite Nasdaq's partial data (e.g., if only spot price came from Nasdaq)
          if (liveFetchedOptionsData && liveFetchedOptionsData.optionsChain.length > 0) {
              optionsDataSourceOrigin = 'yahoo';
               if (liveFetchedOptionsData.spotPrice !== undefined) { // Prefer Yahoo's spot if options chain comes from Yahoo
                  spotPriceFromDirectFetch = liveFetchedOptionsData.spotPrice;
                  console.log(`Spot price ${spotPriceFromDirectFetch} obtained from direct Yahoo fetch.`);
                  updateSpotPriceDisplay(spotPriceFromDirectFetch);
                  localStorage.setItem(`lastSpotPrice_${ticker}_${exchange}`, String(spotPriceFromDirectFetch));
              }
              console.log("Successfully fetched and transformed options data from Yahoo Finance API.");
              displayMessage('<p>Successfully fetched live options data from Yahoo Finance. Proceeding with AI analysis...</p>', 'loading');
          } else {
              console.log("Yahoo Finance fetch also did not yield data. AI will be asked to provide options data.");
              displayMessage('<p>Could not fetch live options data directly. AI will attempt to provide it. Fetching AI analysis...</p>', 'loading');
              if (liveFetchedOptionsData?.spotPrice && !spotPriceFromDirectFetch) { // Case: Yahoo only returned spot, not chain.
                spotPriceFromDirectFetch = liveFetchedOptionsData.spotPrice;
                console.log(`Spot price ${spotPriceFromDirectFetch} obtained from Yahoo (options chain was empty).`);
                updateSpotPriceDisplay(spotPriceFromDirectFetch);
                localStorage.setItem(`lastSpotPrice_${ticker}_${exchange}`, String(spotPriceFromDirectFetch));
              }
              liveFetchedOptionsData = null; // Ensure it's null if no full chain
          }
      }
  } catch (fetchError) {
      logError(fetchError, "Error during direct options data fetching attempts");
      displayMessage('<p>Error fetching live options data. AI will attempt to provide it. Fetching AI analysis...</p>', 'loading');
      liveFetchedOptionsData = null;
      optionsDataSourceOrigin = 'none'; // Reset as direct fetch failed
      // spotPriceFromDirectFetch might have been set if one API call gave spot but not chain, and the other failed completely.
  }

  const prompt = buildGeminiPrompt(ticker, exchange, !!(liveFetchedOptionsData && liveFetchedOptionsData.optionsChain.length > 0));

  try {
    console.log(`Sending request to Gemini API using key index ${currentApiKeyIndex}. HasFetchedOptionsData: ${!!(liveFetchedOptionsData && liveFetchedOptionsData.optionsChain.length > 0)}`);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    if (response.promptFeedback && response.promptFeedback.blockReason) {
        const blockReason = response.promptFeedback.blockReason;
        logError({message: `Prompt was blocked. Reason: ${blockReason}`, name: "APIBlockError"}, "Gemini API prompt blocked");
        throw new Error(`API request blocked: ${blockReason}`);
    }

    const textOutput = response.text;
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    if (!textOutput) {
      throw new Error("Model returned no text.");
    }

    let finalSpotPrice = spotPriceFromDirectFetch; // Prioritize directly fetched spot price
    if (finalSpotPrice === undefined) { // If not available from direct fetch, try parsing from AI
        const spotPriceFromAI = parseSpotPriceFromResponse(textOutput);
        if (spotPriceFromAI !== null) {
            finalSpotPrice = spotPriceFromAI;
            console.log(`Spot price ${finalSpotPrice} obtained from AI response (no direct fetch).`);
            localStorage.setItem(`lastSpotPrice_${ticker}_${exchange}`, String(finalSpotPrice));
        }
    } else {
        console.log(`Using spot price ${finalSpotPrice} from direct API fetch, ignoring AI's parsed spot price if any.`);
    }

    let finalOptionsDataForDisplayAndCache = liveFetchedOptionsData;
    if (!finalOptionsDataForDisplayAndCache || finalOptionsDataForDisplayAndCache.optionsChain.length === 0) {
        finalOptionsDataForDisplayAndCache = parseRawOptionsDataFromResponse(textOutput);
        if (finalOptionsDataForDisplayAndCache && finalOptionsDataForDisplayAndCache.optionsChain.length > 0) {
            optionsDataSourceOrigin = 'ai';
            console.log("Used options data parsed from AI response.");
            // If AI provided options and we didn't have spot price yet, AI's text is the only source for spot.
            if (finalSpotPrice === undefined) {
                 const spotPriceFromAI = parseSpotPriceFromResponse(textOutput);
                 if (spotPriceFromAI !== null) finalSpotPrice = spotPriceFromAI;
            }
        } else {
            optionsDataSourceOrigin = 'none';
            console.log("No options data from direct fetch or AI response parsing.");
        }
    }
    // Ensure displayFormattedResult gets the most up-to-date spot price
    displayFormattedResult(textOutput, groundingMetadata?.groundingChunks, finalSpotPrice, 'none', finalOptionsDataForDisplayAndCache, optionsDataSourceOrigin);
    localStorage.setItem('lastTicker', ticker);
    localStorage.setItem('lastExchange', exchange);
    localStorage.setItem('currentApiKeyIndex', String(currentApiKeyIndex));

    const ohlcvData = parseOhlcvDataFromResponse(textOutput);
    if (ohlcvData) {
      displayPlotlyChart(ohlcvData, `Projected OHLCV (Next 7 Trading Days) for ${ticker}`, 'none');
    } else {
      if (plotlyChartOutput) plotlyChartOutput.innerHTML = "<p>Projected OHLCV data for chart not found or malformed in API response.</p>";
    }

    const parsedStrategies = parseOptionsStrategiesFromResponse(textOutput, !!(liveFetchedOptionsData && liveFetchedOptionsData.optionsChain.length > 0));
    if (parsedStrategies && finalSpotPrice && finalOptionsDataForDisplayAndCache && finalOptionsDataForDisplayAndCache.optionsChain.length > 0) {
        const optionsChartData = parsedStrategies.map(strat =>
            calculateStrategyPayoff(strat, finalSpotPrice, finalOptionsDataForDisplayAndCache)
        ).filter(Boolean);
        displayOptionsStrategyCharts(optionsChartData, 'none', optionsDataSourceOrigin);
    } else {
        if (optionsStrategyChartsContainer && optionsStrategyChartsOutput) {
          optionsStrategyChartsContainer.style.display = 'block';
          let message = "Options strategy chart data not found, could not be parsed, or a component (like spot price or valid options chain) is missing.";
           if (!finalOptionsDataForDisplayAndCache || finalOptionsDataForDisplayAndCache.optionsChain.length === 0) {
            message += " No valid options chain data was available from direct fetch or AI for chart calculations."
           }
          optionsStrategyChartsOutput.innerHTML = `<p class="col-12 text-center">${message}</p>`;
        }
    }

    await cacheAnalysis({
      id: `${ticker}_${exchange}`, ticker, exchange, timestamp: Date.now(),
      responseText: textOutput, groundingChunks: groundingMetadata?.groundingChunks,
      ohlcvData: ohlcvData, spotPrice: finalSpotPrice,
      rawOptionsData: finalOptionsDataForDisplayAndCache,
      parsedOptionsStrategies: parsedStrategies,
      optionsDataSourceOrigin: optionsDataSourceOrigin
    });

  } catch (error) {
    logError(error, "Error fetching stock projections from API or processing response");
    let errorMessage = 'An error occurred while fetching or processing stock projections.';
    if (error instanceof Error) errorMessage = error.message;

    const isRateLimitError = (
        (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('resource_exhausted'))) ||
        (error.error && typeof error.error === 'object' && error.error.code === 429) ||
        (error.status && (String(error.status).includes('RESOURCE_EXHAUSTED') || error.status === 429)) ||
        (error.response && error.response.status === 429) ||
        (error.message && error.message.includes('API request blocked'))
    );

    let failingKeyInfo = apiKeys[currentApiKeyIndex] ? `(key ending ...${apiKeys[currentApiKeyIndex].slice(-4)})` : '(key info N/A)';

    if (isRateLimitError) {
        currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
        localStorage.setItem('currentApiKeyIndex', String(currentApiKeyIndex));
        errorMessage = `API request failed ${failingKeyInfo}: ${error.message}. Key rotated. Attempting to display cached data.`;
        console.warn(`Rate limit or block error for key index ${currentApiKeyIndex > 0 ? currentApiKeyIndex -1 : apiKeys.length -1}. Rotated to index ${currentApiKeyIndex}.`);
    } else {
        errorMessage = `Failed to fetch live data ${failingKeyInfo}: ${error.message}. Attempting to display cached data.`;
    }

    const cachedData = await getCachedAnalysis(ticker, exchange);
    if (cachedData) {
        console.log(`Serving ${ticker}/${exchange} from IndexedDB cache due to API error.`);
        displayMessage(`<p>${errorMessage}</p>`, 'cached-ratelimit');
        displayFormattedResult(cachedData.responseText, cachedData.groundingChunks, cachedData.spotPrice, 'ratelimit', cachedData.rawOptionsData, cachedData.optionsDataSourceOrigin || 'ai');
        if (cachedData.ohlcvData) {
            displayPlotlyChart(cachedData.ohlcvData, `Projected OHLCV (Next 7 Trading Days) for ${ticker}`, 'ratelimit');
        } else {
            if (plotlyChartOutput) plotlyChartOutput.innerHTML = "<p>Cached OHLCV data not found. API error also prevented new data.</p>";
        }
        if (cachedData.parsedOptionsStrategies && cachedData.spotPrice && cachedData.rawOptionsData) {
            const optionsChartData = cachedData.parsedOptionsStrategies.map(strat =>
                calculateStrategyPayoff(strat, cachedData.spotPrice, cachedData.rawOptionsData)
            ).filter(Boolean);
            displayOptionsStrategyCharts(optionsChartData, 'ratelimit', cachedData.optionsDataSourceOrigin || 'ai');
        } else {
             if (optionsStrategyChartsContainer && optionsStrategyChartsOutput) {
                optionsStrategyChartsContainer.style.display = 'block';
                optionsStrategyChartsOutput.innerHTML = '<p class="col-12 text-center">Cached options strategy chart data (or its components) not found. API error also prevented new data.</p>';
            }
        }
    } else {
        console.log(`No IndexedDB cache available for ${ticker}/${exchange} after API error.`);
        const finalErrorMessage = isRateLimitError ?
            `API request failed ${failingKeyInfo}: ${error.message}. Key rotated. No cached data available for ${ticker}. Please wait for cooldown.` :
            `Failed to fetch live data for ${ticker} ${failingKeyInfo}: ${error.message}. No cached data available.`;
        displayMessage(`<p>${finalErrorMessage}</p>`, 'error');
        if (plotlyChartOutput) plotlyChartOutput.innerHTML = "<p>Error fetching OHLCV data: API error and no cache.</p>";
        if (optionsStrategyChartsContainer && optionsStrategyChartsOutput) {
            optionsStrategyChartsContainer.style.display = 'block';
            optionsStrategyChartsOutput.innerHTML = '<p class="col-12 text-center">Error fetching options strategy data: API error and no cache.</p>';
        }
        updateSpotPriceDisplay(undefined);
    }
  } finally {
    tickerInput.disabled = false;
    exchangeInput.disabled = false;
  }
}

if (getPriceButton) getPriceButton.addEventListener('click', fetchStockInfo);

if (toggleSourcesButton && sourcesContent) {
    toggleSourcesButton.addEventListener('click', () => {
        const isExpanded = sourcesContent.style.display === 'block';
        sourcesContent.style.display = isExpanded ? 'none' : 'block';
        toggleSourcesButton.setAttribute('aria-expanded', String(!isExpanded));
    });
}

if (toggleRateLimitInfoButton && rateLimitInfoContent) {
    toggleRateLimitInfoButton.addEventListener('click', () => {
        const isExpanded = rateLimitInfoContent.style.display === 'block';
        rateLimitInfoContent.style.display = isExpanded ? 'none' : 'block';
        toggleRateLimitInfoButton.setAttribute('aria-expanded', String(!isExpanded));
        toggleRateLimitInfoButton.textContent = isExpanded ? 'Hide API Rate Info' : 'View API Rate Info';
    });
}

if (toggleDataStorageInfoButton && dataStorageInfoContent) {
    toggleDataStorageInfoButton.addEventListener('click', () => {
        const isExpanded = dataStorageInfoContent.style.display === 'block';
        dataStorageInfoContent.style.display = isExpanded ? 'none' : 'block';
        toggleDataStorageInfoButton.setAttribute('aria-expanded', String(!isExpanded));
        toggleDataStorageInfoButton.textContent = isExpanded ? 'Hide Data Storage Info' : 'View Data Storage & Caching Info';
    });
}


if (copyErrorsButton) {
    copyErrorsButton.addEventListener('click', async () => {
        if (loggedErrors.length === 0) {
            if (copyErrorsStatus) copyErrorsStatus.textContent = "No errors to copy.";
            setTimeout(() => { if (copyErrorsStatus) copyErrorsStatus.textContent = ""; }, 3000);
            return;
        }
        let errorText = `Stock Projection Analyzer - Logged Errors (${new Date().toISOString()})\nUser Agent: ${navigator.userAgent}\n\n`;
        loggedErrors.forEach((err, index) => {
            errorText += `Error #${index + 1}\nTimestamp: ${err.timestamp}\nName: ${err.name || 'N/A'}\nMessage: ${err.message}\nContext: ${err.context || 'N/A'}\nAPI Key Info: ${err.apiKeyUsed || 'N/A'}\n${err.stack ? `Stack Trace:\n${err.stack}\n` : ''}--------------------------------------------------\n\n`;
        });
        try {
            await navigator.clipboard.writeText(errorText);
            if (copyErrorsStatus) copyErrorsStatus.textContent = "Errors copied!";
        } catch (err) {
            logError(err, "Failed to copy errors to clipboard");
            if (copyErrorsStatus) {
                 copyErrorsStatus.textContent = "Failed to copy.";
                 copyErrorsStatus.classList.add('error');
            }
        }
        setTimeout(() => {
            if (copyErrorsStatus) {
                copyErrorsStatus.textContent = "";
                copyErrorsStatus.classList.remove('error');
            }
        }, 3000);
    });
}

function initializeApp() {
    console.log("Initializing application...");
    let lastTicker = null;
    let lastExchange = null;

    // Load preferences and last state from localStorage
    try {
        console.log("Attempting to load preferences from localStorage...");
        lastTicker = localStorage.getItem('lastTicker');
        lastExchange = localStorage.getItem('lastExchange');
        lastApiCallTimestamp = Number(localStorage.getItem('lastApiCallTimestampGlobal')) || 0;
        currentApiKeyIndex = Number(localStorage.getItem('currentApiKeyIndex')) || 0;
        if (currentApiKeyIndex >= apiKeys.length || currentApiKeyIndex < 0 || isNaN(currentApiKeyIndex)) {
            console.warn(`Invalid currentApiKeyIndex (${currentApiKeyIndex}) found in localStorage, resetting to 0.`);
            currentApiKeyIndex = 0;
        }

        tickerInput.value = lastTicker || "TSLA"; // Default to TSLA if nothing stored
        exchangeInput.value = lastExchange || "NASDAQ"; // Default to NASDAQ
        tickerInput.dataset.lastTicker = tickerInput.value; // Initialize dataset for comparison
        exchangeInput.dataset.lastExchange = exchangeInput.value;
        console.log(`Loaded from localStorage: lastTicker=${lastTicker}, lastExchange=${exchangeInput.value}, lastApiCallTimestamp=${lastApiCallTimestamp}, currentApiKeyIndex=${currentApiKeyIndex}`);

        // Attempt to load and display spot price from localStorage for immediate feedback
        if (lastTicker && lastExchange) {
            const spotPriceFromLocalStorageStr = localStorage.getItem(`lastSpotPrice_${lastTicker}_${lastExchange}`);
            if (spotPriceFromLocalStorageStr) {
                const spotPriceFromLocalStorage = parseFloat(spotPriceFromLocalStorageStr);
                if (!isNaN(spotPriceFromLocalStorage)) {
                    console.log(`Found spot price ${spotPriceFromLocalStorage} in localStorage for ${lastTicker}_${lastExchange}. Displaying.`);
                    updateSpotPriceDisplay(spotPriceFromLocalStorage);
                } else {
                    console.warn(`Failed to parse spot price from localStorage for ${lastTicker}_${lastExchange}: ${spotPriceFromLocalStorageStr}`);
                }
            } else {
                 console.log(`No spot price found in localStorage for ${lastTicker}_${lastExchange}.`);
            }
        }

    } catch (e) {
        logError(e, "Could not load preferences from localStorage");
        // Fallback defaults if localStorage access fails or values are corrupt
        tickerInput.value = "TSLA";
        exchangeInput.value = "NASDAQ";
        lastApiCallTimestamp = 0;
        currentApiKeyIndex = 0;
        tickerInput.dataset.lastTicker = tickerInput.value;
        exchangeInput.dataset.lastExchange = exchangeInput.value;
    }

    if (sourcesContainerWrapper) sourcesContainerWrapper.style.display = 'none';
    if (spotPriceValueElement && !localStorage.getItem(`lastSpotPrice_${tickerInput.value}_${exchangeInput.value}`)) {
        // If no spot price was loaded from localStorage, ensure it's '--.--'
         spotPriceValueElement.textContent = '--.--';
    }
    updateCopyErrorsButtonState();


    if (tickerInput.value && exchangeInput.value) {
        // Load full cached data from IndexedDB (this might update the spot price again if fresher)
        loadInitialStockData(tickerInput.value, exchangeInput.value);

        // Check and apply API call cooldown based on persisted timestamp
        const now = Date.now();
        const timeSinceLastCall = now - lastApiCallTimestamp;
        if (timeSinceLastCall < MIN_API_CALL_INTERVAL_MS) {
            console.log(`Cooldown active: ${Math.ceil((MIN_API_CALL_INTERVAL_MS - timeSinceLastCall) / 1000)}s remaining.`);
            startVisualCooldown(lastApiCallTimestamp);
        }
    } else {
        // Fallback display if no ticker/exchange could be determined (e.g., first visit, localStorage error)
        const initialMessage = `
        <p>Enter a stock ticker and exchange to receive a comprehensive analysis. Data is cached for 1 hour.</p>
        <ul>
            <li>Current spot price (displayed above the TradingView chart).</li>
            <li>Company information, price projections, and statistical measures.</li>
            <li>Analysis of potential price reversals with specific timelines (seconds to months).</li>
            <li>Suggestions for alternative tickers based on market movers with short-term gain potential.</li>
            <li>AI-suggested multi-leg options strategies (textual description and payoff diagrams, informed by direct Nasdaq/Yahoo fetch or AI search via Barchart/Nasdaq/Yahoo Finance/WSJ).</li>
            <li>A 7-day projected OHLCV candlestick & volume chart (trading days only).</li>
        </ul>
        <p>The TradingView chart will update to your selected ticker. Sources (if available) will appear at the bottom.</p>
        <p><strong>Note:</strong> If API rate limits are hit, the API key rotates, and cached data (if available) is displayed. Click "View API Rate Info" for details.</p>
        `;
        displayMessage(initialMessage, 'info');
        if (plotlyChartOutput) plotlyChartOutput.innerHTML = '<p>Projected OHLCV chart will appear here.</p>';
        if (optionsStrategyChartsContainer && optionsStrategyChartsOutput) {
            optionsStrategyChartsContainer.style.display = 'none';
            optionsStrategyChartsOutput.innerHTML = '<p class="col-12 text-center initial-options-message">Options strategy payoff diagrams will appear here if data is available.</p>';
        }
        updateSpotPriceDisplay(undefined);
        previousSpotPrice = null;
        updateTradingViewWidget(); // Load default TradingView widget
    }

    // Save critical state to localStorage before the window unloads
    window.addEventListener('beforeunload', () => {
        console.log("Saving state to localStorage before unload: lastApiCallTimestamp, currentApiKeyIndex.");
        localStorage.setItem('lastApiCallTimestampGlobal', String(lastApiCallTimestamp));
        localStorage.setItem('currentApiKeyIndex', String(currentApiKeyIndex));
    });
    console.log("Application initialized.");
}

initializeApp();
