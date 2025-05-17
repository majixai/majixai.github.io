/**
 * ========================================================================
 * Application State Variables
 * ========================================================================
 * These variables hold the current state of the application, similar to
 * what React's state hooks would manage.
 */
let appState = {
    currentSection: 'about',        // ID of the currently displayed section ('about', 'oneLeg', etc.)
    strategyData: null,             // Holds the parsed strategy data from JSON/DB/Cache
    isLoading: true,                // Flag indicating if data is currently being loaded
    error: null,                    // Holds any error message string to display
    isOffline: !navigator.onLine,   // Tracks the current network connection status
    dbConnection: null,             // Holds the active IndexedDB database connection
    dataSource: null,               // Tracks where the data was loaded from ('Network', 'IndexedDB', 'Cache', 'Embedded', 'Error')
    lastFetchTimestamp: null        // Timestamp of the last successful fetch attempt
};

/**
 * ========================================================================
 * DOM Element References
 * ========================================================================
 * Caching references to frequently accessed DOM elements for performance.
 */
const DOM = {
    sidebar: document.getElementById('mySidebar'),
    sidebarLinks: document.getElementById('sidebarLinks'),
    overlay: document.getElementById('myOverlay'),
    closeMenuButton: document.getElementById('closeMenuButton'),
    openMenuButton: document.getElementById('openMenuButton'),
    contentContainer: document.getElementById('contentContainer'), // This is now the container for sections
    statusMessageArea: document.getElementById('statusMessageArea'),
    statusIndicators: document.getElementById('statusIndicators'),
    refreshDataButton: document.getElementById('refreshDataButton'),
    lastUpdated: document.getElementById('lastUpdated'),
    // References to the section containers within contentContainer
    sectionContainers: {
        about: document.getElementById('about'),
        oneLeg: document.getElementById('oneLeg'),
        twoLeg: document.getElementById('twoLeg'),
        threeLeg: document.getElementById('threeLeg'),
        fourLeg: document.getElementById('fourLeg'),
        multiLeg: document.getElementById('multiLeg') // Added multiLeg section
        // Add more sections here if needed
    }
};

/**
 * ========================================================================
 * Application Constants
 * ========================================================================
 */
const DB_NAME = 'optionStrategyDB_Vanilla_v1'; // Database name specific to this version
const DB_VERSION = 1;                          // Database version
const STORE_NAME = 'strategyStore_v1';         // Object store name
const DATA_KEY = 'allStrategiesDataBlob';      // Key for storing the entire data blob in IDB
const CACHE_NAME = 'option-strategy-cache-vanilla-v1'; // Cache Storage name
const STRATEGIES_JSON_URL = 'strategies.json'; // URL to fetch strategy data
const CURRENT_UNDERLYING_PRICE = 5975.50; // Fixed price based on the MES data image for plotting ranges


/**
 * ========================================================================
 * Logging Helper
 * ========================================================================
 * Provides prefixed console logging for easier debugging.
 */
const logger = {
    log: (...args) => console.log('[App Log]', ...args),
    warn: (...args) => console.warn('[App Warn]', ...args),
    error: (...args) => console.error('[App Error]', ...args),
    info: (...args) => console.info('[App Info]', ...args)
};

/**
 * ========================================================================
 * IndexedDB Utility Functions (Promise-based)
 * ========================================================================
 */

/** Opens and potentially upgrades the IndexedDB. */
function openDB() {
    return new Promise((resolve, reject) => {
        logger.log(`Opening IndexedDB: ${DB_NAME} (v${DB_VERSION})`);
        if (!window.indexedDB) {
             logger.warn("IndexedDB not supported by this browser."); // Use warn instead of error for graceful fallback
             appState.dbConnection = null; // Explicitly set null if not supported
             return resolve(null); // Resolve with null as it's not an error *in opening*, just lack of support
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => {
            logger.error("IndexedDB connection error:", event.target.error);
            appState.dbConnection = null; // Ensure null on error
            reject(`IndexedDB error: ${event.target.error?.message || 'Unknown error'}`);
        };
        request.onsuccess = (event) => {
            logger.log("IndexedDB connection successful.");
            appState.dbConnection = event.target.result; // Store connection globally
            resolve(appState.dbConnection);
        };
        request.onupgradeneeded = (event) => {
            logger.info("IndexedDB upgrade needed.");
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                logger.log(`Creating Object Store: ${STORE_NAME}`);
                db.createObjectStore(STORE_NAME); // Store entire blob, no keyPath needed
            }
            logger.info("IndexedDB upgrade complete.");
        };
    });
}

/** Saves the entire strategy data object to IndexedDB. */
function saveDataToDB(data) {
     return new Promise(async (resolve, reject) => {
        if (!appState.dbConnection) {
            logger.warn("No active DB connection for save, cannot save.");
            return reject("No DB connection available.");
        }
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            return reject("Invalid or empty data provided to saveDataToDB.");
        }

        try {
            const transaction = appState.dbConnection.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            logger.log(`Attempting to save data under key: ${DATA_KEY}`);
            const request = store.put(data, DATA_KEY); // Store data using the predefined key

            request.onsuccess = () => resolve(`Data successfully saved to IndexedDB.`);
            request.onerror = (event) => reject(`Failed to save data to IndexedDB: ${event.target.error}`);
            transaction.oncomplete = () => logger.log('IndexedDB save transaction completed.');
            transaction.onerror = (event) => logger.error(`IndexedDB save transaction error: ${event.target.error}`);
        } catch (e) {
            logger.error("Error initiating IndexedDB save transaction:", e);
            reject(`IndexedDB transaction error: ${e.message}`);
        }
     });
}

/** Loads the strategy data object from IndexedDB. */
function loadDataFromDB() {
    return new Promise(async (resolve, reject) => {
        if (!appState.dbConnection) {
            logger.warn("No active DB connection for load, cannot load.");
            return resolve(null); // Resolve with null if no DB connection is available
        }
        try {
            const transaction = appState.dbConnection.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            logger.log(`Attempting to load data from IndexedDB using key: ${DATA_KEY}`);
            const request = store.get(DATA_KEY);
            request.onsuccess = (event) => {
                if (event.target.result) {
                    logger.log("Data found in IndexedDB.");
                    resolve(event.target.result);
                } else {
                    logger.log("No data found in IndexedDB for the key.");
                    resolve(null);
                }
            };
            request.onerror = (event) => reject(`Failed to load data from IndexedDB: ${event.target.error}`);
        } catch (e) {
             logger.error("Error initiating IndexedDB load transaction:", e);
             reject(`IndexedDB transaction error: ${e.message}`);
        }
    });
}

/**
 * ========================================================================
 * Cache Storage API Utility Functions
 * ========================================================================
 */

/** Caches the fetched data response using the Cache Storage API. */
 async function cacheDataResponse(url, data) {
    if (!('caches' in window)) {
        logger.warn("Cache Storage API not supported, cannot cache data response.");
        return;
    }
    try {
        const cache = await caches.open(CACHE_NAME);
        const responseToCache = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', 'X-Cached-Timestamp': Date.now() } // Add timestamp header
        });
        await cache.put(url, responseToCache);
        logger.log(`Data for ${url} successfully stored in Cache Storage.`);
    } catch (error) {
        logger.error('Failed to cache data response:', error);
    }
}

/** Attempts to retrieve data from the Cache Storage API. */
 async function loadDataFromCache(url) {
     if (!('caches' in window)) {
         logger.warn("Cache Storage API not supported, cannot load from cache.");
         return null;
     }
     try {
         const cache = await caches.open(CACHE_NAME);
         const cachedResponse = await cache.match(url);
         if (cachedResponse) {
             logger.log(`Data found in Cache Storage for ${url}.`);
             // Optional: Check cache freshness based on X-Cached-Timestamp header if needed
             // const timestamp = cachedResponse.headers.get('X-Cached-Timestamp');
             // if (timestamp && (Date.now() - parseInt(timestamp)) > YOUR_EXPIRY_TIME) { ... handle stale }
             const data = await cachedResponse.json();
             return data;
         } else {
             logger.log(`No data found in Cache Storage for ${url}.`);
             return null;
         }
     } catch (error) {
         logger.error(`Error loading data from Cache Storage for ${url}:`, error);
         return null; // Treat cache error as cache miss
     }
 }


/**
 * ========================================================================
 * Plotly Charting Functions
 * ========================================================================
 * These functions prepare data for Plotly based on strategy parameters.
 * They take (params, plotlyDivId, strategyObject) and call Plotly.newPlot.
 */

/** Calculates Profit/Loss for a single option leg */
function calculateLegPayoff(price, type, position, strike, premium) {
    // Ensure inputs are numbers
    const numericStrike = parseFloat(strike);
    const numericPremium = parseFloat(premium);
    if (isNaN(numericStrike) || isNaN(numericPremium)) return 0;

    let intrinsicValue = 0;
    type = type.toLowerCase(); position = position.toLowerCase();
    if (type === 'call') intrinsicValue = Math.max(0, price - numericStrike);
    else if (type === 'put') intrinsicValue = Math.max(0, numericStrike - price);
    if (position === 'long') return intrinsicValue - numericPremium;
    else return -intrinsicValue + numericPremium;
}

/** Generates an array of prices for the X-axis */
function generatePriceRange(center, rangePct = 0.15, steps = 200) {
     const numericCenter = parseFloat(center);
     if (isNaN(numericCenter) || numericCenter <= 0) numericCenter = CURRENT_UNDERLYING_PRICE; // Fallback if center is invalid

    const range = numericCenter * rangePct;
    const minP = Math.max(0.01, numericCenter - range);
    const maxP = numericCenter + range;
    const step = (maxP - minP) / steps;
    return Array.from({ length: steps + 1 }, (_, i) => minP + i * step);
}

/** Creates a standard Plotly layout object */
function getPlotlyLayout(title) {
    return {
        title: { text: title, font: { size: 16, family: 'Segoe UI, Arial, sans-serif' } },
        xaxis: { title: 'Underlying Price @ Expiration', zeroline: true, gridcolor: '#efefef' },
        yaxis: { title: 'Profit / Loss ($)', zeroline: true, gridcolor: '#efefef', tickformat: '$,.2f' },
        showlegend: false,
        margin: { l: 70, r: 30, b: 50, t: 60, pad: 4 },
        hovermode: 'x unified',
        paper_bgcolor: '#f9f9f9', plot_bgcolor: '#f9f9f9',
        responsive: true // Make responsive
    };
}

// --- Dictionary mapping JSON function names to JS implementations ---
// Each function takes (params, plotlyDivId, strategyObject)
const plotFunctions = {
    plotBasicOption: (params, id) => { // strategyObject not strictly needed here
        const { type, position, strike, premium } = params;
        const prices = generatePriceRange(strike);
        const profits = prices.map(price => calculateLegPayoff(price, type, position, strike, premium));
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: position === 'long' ? (type === 'call' ? 'green' : 'blue') : 'red', width: 2.5 } }; // Use red for short
        const posText = position.charAt(0).toUpperCase() + position.slice(1);
        const typeText = type.charAt(0).toUpperCase() + type.slice(1);
        const title = `${posText} ${strike.toFixed(2)} ${typeText} (Premium: ${premium.toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
    plotCoveredCall: (params, id) => {
        const { stockPrice, callStrike, callPremium } = params;
         // Assuming 100 shares equivalent for the plot calculation
        const prices = generatePriceRange(stockPrice, 0.2);
        const profits = prices.map(price => {
            const stockProfit = price - stockPrice;
            const shortCallPayoff = calculateLegPayoff(price, 'call', 'short', callStrike, callPremium);
            return stockProfit + shortCallPayoff;
        });
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'darkgreen', width: 2.5 } };
        const title = `Covered Call (${stockPrice.toFixed(2)} Stock, ${callStrike.toFixed(2)}C @ ${callPremium.toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
     plotProtectivePut: (params, id) => {
        const { stockPrice, putStrike, putPremium } = params;
         // Assuming 100 shares equivalent for the plot calculation
        const prices = generatePriceRange(stockPrice, 0.2);
        const profits = prices.map(price => {
            const stockProfit = price - stockPrice;
            const longPutPayoff = calculateLegPayoff(price, 'put', 'long', putStrike, putPremium);
            return stockProfit + longPutPayoff;
        });
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'darkblue', width: 2.5 } };
        const title = `Protective Put (${stockPrice.toFixed(2)} Stock, ${putStrike.toFixed(2)}P @ ${putPremium.toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
    plotVerticalSpread: (params, id, strategy) => {
        const { type, position, strike1, strike2, premium1, premium2 } = params;
        const lowerK = Math.min(strike1, strike2), higherK = Math.max(strike1, strike2);
        const lowerP = (strike1 === lowerK) ? premium1 : premium2;
        const higherP = (strike1 === higherK) ? premium1 : premium2;
        const prices = generatePriceRange((lowerK + higherK) / 2);
        let profits, netCost, titlePrefix, color;

        if (type === 'call') {
             if (position === 'debit') { // Bull Call
                 netCost = lowerP - higherP; profits = prices.map(p => calculateLegPayoff(p, 'call', 'long', lowerK, lowerP) + calculateLegPayoff(p, 'call', 'short', higherK, higherP));
                 titlePrefix = "Bull Call Spread"; color = 'green';
             } else { // Bear Call (Credit)
                 netCost = higherP - lowerP; profits = prices.map(p => calculateLegPayoff(p, 'call', 'short', lowerK, lowerP) + calculateLegPayoff(p, 'call', 'long', higherK, higherP)); // Credit is negative cost
                 titlePrefix = "Bear Call Spread"; color = 'red';
             }
         } else { // type === 'put'
                 if (position === 'debit') { // Bear Put
                     netCost = higherP - lowerP; profits = prices.map(p => calculateLegPayoff(p, 'put', 'long', higherK, higherP) + calculateLegPayoff(p, 'put', 'short', lowerK, lowerP));
                     titlePrefix = "Bear Put Spread"; color = 'red';
                 } else { // Bull Put (Credit)
                     netCost = lowerP - higherP; profits = prices.map(p => calculateLegPayoff(p, 'put', 'short', higherK, higherP) + calculateLegPayoff(p, 'put', 'long', lowerK, lowerP)); // Credit is negative cost
                     titlePrefix = "Bull Put Spread"; color = 'green';
                 }
             }

            const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: color, width: 2.5 } };
            const costType = netCost >= 0 ? 'Debit' : 'Credit';
            const title = `${titlePrefix} ${lowerK.toFixed(2)}/${higherK.toFixed(2)} (${costType}: ${Math.abs(netCost).toFixed(2)})`;
            Plotly.newPlot(id, [trace], getPlotlyLayout(title));
        },
    plotButterfly: (params, id) => {
        const { type, strike1, strike2, strike3, premium1, premium2, premium3 } = params;
         // Assume strikes are ordered K1 < K2 < K3
        const netDebit = premium1 - (2 * premium2) + premium3;
        const prices = generatePriceRange(strike2, 0.1); // Narrower range
        const profits = prices.map(p => calculateLegPayoff(p, type, 'long', strike1, premium1) + (2 * calculateLegPayoff(p, type, 'short', strike2, premium2)) + calculateLegPayoff(p, type, 'long', strike3, premium3));
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'orange', width: 2.5 } };
        const typeText = type.charAt(0).toUpperCase() + type.slice(1);
        const costType = netDebit >= 0 ? 'Net Debit' : 'Net Credit';
        const title = `Long ${typeText} Butterfly ${strike1.toFixed(2)}/${strike2.toFixed(2)}/${strike3.toFixed(2)} (${costType}: ${Math.abs(netDebit).toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
     plotIronCondor: (params, id) => {
         const { strikeP1, strikeP2, strikeC3, strikeC4, premiumP1, premiumP2, premiumC3, premiumC4 } = params;
         // Assume K1 < K2 < K3 < K4
         const netCredit = premiumP2 + premiumC3 - premiumP1 - premiumC4;
         const prices = generatePriceRange((strikeP2 + strikeC3) / 2, 0.2);
         const profits = prices.map(p =>
             calculateLegPayoff(p, 'put', 'long', strikeP1, premiumP1) + calculateLegPayoff(p, 'put', 'short', strikeP2, premiumP2) +
             calculateLegPayoff(p, 'call', 'short', strikeC3, premiumC3) + calculateLegPayoff(p, 'call', 'long', strikeC4, premiumC4)
         );
         const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#007bff', width: 2.5 } };
         const costType = netCredit >= 0 ? 'Credit' : 'Debit';
         const title = `Iron Condor ${strikeP1.toFixed(2)}/${strikeP2.toFixed(2)}P ${strikeC3.toFixed(2)}/${strikeC4.toFixed(2)}C (${costType}: ${Math.abs(netCredit).toFixed(2)})`;
         Plotly.newPlot(id, [trace], getPlotlyLayout(title));
     },
     plotIronButterfly: (params, id) => {
        const { strikeP1, strikePC2, strikeC3, premiumP1, premiumP2, premiumC2, premiumC3 } = params;
        // Assume K1 < K2 < K3, K2 is ATM Short Call/Put
        const netCredit = premiumP2 + premiumC2 - premiumP1 - premiumC3;
        const prices = generatePriceRange(strikePC2, 0.1); // Narrower range for butterfly
        const profits = prices.map(p =>
            calculateLegPayoff(p, 'put', 'long', strikeP1, premiumP1) + calculateLegPayoff(p, 'put', 'short', strikePC2, premiumP2) +
            calculateLegPayoff(p, 'call', 'short', strikePC2, premiumC2) + calculateLegPayoff(p, 'call', 'long', strikeC3, premiumC3)
        );
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#ffc107', width: 2.5 } };
        const costType = netCredit >= 0 ? 'Credit' : 'Debit';
        const title = `Iron Butterfly ${strikeP1.toFixed(2)}P / ${strikePC2.toFixed(2)}PC / ${strikeC3.toFixed(2)}C (${costType}: ${Math.abs(netCredit).toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
     },
     plotReverseIronCondor: (params, id) => {
        const { strikeP1, strikeP2, strikeC3, strikeC4, premiumP1, premiumP2, premiumC3, premiumC4 } = params;
         // Assume K1 < K2 < K3 < K4
        const netDebit = premiumP2 + premiumC3 - premiumP1 - premiumC4;
        const prices = generatePriceRange((strikeP2 + strikeC3) / 2, 0.2);
        const profits = prices.map(p =>
            calculateLegPayoff(p, 'put', 'short', strikeP1, premiumP1) + calculateLegPayoff(p, 'put', 'long', strikeP2, premiumP2) +
            calculateLegPayoff(p, 'call', 'long', strikeC3, premiumC3) + calculateLegPayoff(p, 'call', 'short', strikeC4, premiumC4)
        );
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#dc3545', width: 2.5 } };
         const costType = netDebit >= 0 ? 'Debit' : 'Credit';
        const title = `Reverse Iron Condor ${strikeP1.toFixed(2)}/${strikeP2.toFixed(2)}P ${strikeC3.toFixed(2)}/${strikeC4.toFixed(2)}C (${costType}: ${Math.abs(netDebit).toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
    plotReverseIronButterfly: (params, id) => {
        const { strikeP1, strikePC2, strikeC3, premiumP1, premiumP2, premiumC2, premiumC3 } = params;
         // Assume K1 < K2 < K3, K2 is ATM Long Call/Put
        const netDebit = premiumP2 + premiumC2 - premiumP1 - premiumC3;
        const prices = generatePriceRange(strikePC2, 0.1); // Narrower range
        const profits = prices.map(p =>
            calculateLegPayoff(p, 'put', 'short', strikeP1, premiumP1) + calculateLegPayoff(p, 'put', 'long', strikePC2, premiumP2) +
            calculateLegPayoff(p, 'call', 'long', strikePC2, premiumC2) + calculateLegPayoff(p, 'call', 'short', strikeC3, premiumC3)
        );
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#fd7e14', width: 2.5 } };
         const costType = netDebit >= 0 ? 'Debit' : 'Credit';
        const title = `Reverse Iron Butterfly ${strikeP1.toFixed(2)}P / ${strikePC2.toFixed(2)}PC / ${strikeC3.toFixed(2)}C (${costType}: ${Math.abs(netDebit).toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
    plotStraddleStrangle: (params, id, strategy) => {
        const { type, strikeP, strikeC, premiumP, premiumC } = params;
         // Assume strikeP <= strikeC
        const centerPrice = (strikeP + strikeC) / 2;
        const prices = generatePriceRange(centerPrice, 0.4);
        const netCost = premiumP + premiumC; // For long straddle/strangle, this is debit
        const profits = prices.map(p => calculateLegPayoff(p, 'put', strategy.position, strikeP, premiumP) + calculateLegPayoff(p, 'call', strategy.position, strikeC, premiumC));
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#6f42c1', width: 2.5 } };
        const titlePrefix = strategy.name.replace(/\s*\(.*\)/, ''); // Use base name
        const costType = strategy.position === 'long' ? 'Debit' : 'Credit';
        const strikeText = type === 'straddle' ? strikeP.toFixed(2) : `${strikeP.toFixed(2)}P / ${strikeC.toFixed(2)}C`;
        const title = `${titlePrefix} ${strikeText} (${costType}: ${Math.abs(netCost).toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
    plotBoxSpread: (params, id) => {
        const { strike1, strike2, premC1, premC2, premP1, premP2 } = params;
        // Assume strike1 < strike2
        const lowerK = Math.min(strike1, strike2);
        const higherK = Math.max(strike1, strike2);
         // Map premiums to strikes assuming premC1/premP1 are for strike1 and premC2/premP2 are for strike2
        const lowerPremC = strike1 === lowerK ? premC1 : premC2;
        const higherPremC = strike1 === higherK ? premC1 : premC2;
        const lowerPremP = strike1 === lowerK ? premP1 : premP2;
        const higherPremP = strike1 === higherK ? premP1 : premP2;

        const netDebit = (lowerPremC - higherPremC) + (higherPremP - lowerPremP);
        const valueAtExpiryIntrinsicDiff = higherK - lowerK; // The constant payoff amount
        const lockedInProfit = valueAtExpiryIntrinsicDiff - netDebit; // P/L = Payoff - Cost

        const centerPrice = (lowerK + higherK) / 2;
        const prices = generatePriceRange(centerPrice, 0.5); // Wider range

        // The payoff at expiration is always K2-K1, regardless of price (ignoring initial cost).
        // The plot should show this constant payoff relative to the initial cost.
        const profits = prices.map(p => lockedInProfit); // P/L relative to initial cost

        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'grey', width: 2.5, dash: 'dash' } };
        const costType = netDebit >= 0 ? 'Debit' : 'Credit';
        const title = `Box Spread ${lowerK.toFixed(2)}/${higherK.toFixed(2)} (P/L Incl. Cost: ${lockedInProfit.toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
     plotCalendarSpread: (params, id) => {
        const { type, strike, nearPremium, furtherPremium } = params; // strike is the same for both legs
        const netDebit = furtherPremium - nearPremium;
        const prices = generatePriceRange(strike, 0.2); // Range centered on strike

         // --- Simplified Time Value Proxy for the Further option AT NEAR expiry ---
         // Calculate initial time value for the further leg at the CURRENT_UNDERLYING_PRICE
         const initialIntrinsicFurther = type === 'call' ? Math.max(0, CURRENT_UNDERLYING_PRICE - strike) : Math.max(0, strike - CURRENT_UNDERLYING_PRICE);
         const initialTimeValueFurther = Math.max(0, furtherPremium - initialIntrinsicFurther);

         // Decay the initial time value based on distance from the strike for the plot
         // This exponential decay is a guess to approximate the curve shape.
         const timeValueProxy = (p) => initialTimeValueFurther * Math.exp(-0.0005 * Math.pow(p - strike, 2));

         const profits = prices.map(p => {
             // Payoff of Short Near Leg (at its expiry)
             const nearPayoff = calculateLegPayoff(p, type, 'short', strike, nearPremium);

             // Estimated Value of Long Further Leg (at near expiry)
             const furtherIntrinsic = type === 'call' ? Math.max(0, p - strike) : Math.max(0, strike - p);
             const furtherValue = furtherIntrinsic + timeValueProxy(p);

             // Total P/L at Near Expiry = Near Leg Payoff + Further Leg Value - Initial Debit
             return nearPayoff + furtherValue - furtherPremium; // Subtract premium paid for *this* leg initially
         });

        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'darkorange', width: 2.5 } };
        const costType = netDebit >= 0 ? 'Debit' : 'Credit';
        const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Calendar ${strike.toFixed(2)} (At Near Expiry) (Net ${costType}: ${Math.abs(netDebit).toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
    plotDiagonalSpread: (params, id) => {
        const { type, strike1, premium1, strike2, premium2 } = params; // Assuming strike1/prem1 is FURTHER, strike2/prem2 is NEAR
        const furtherK = strike1, furtherP = premium1;
        const nearK = strike2, nearP = premium2;

        const netDebit = furtherP - nearP; // Usually a debit

         const centerPrice = (furtherK + nearK) / 2;
         const prices = generatePriceRange(centerPrice, 0.25); // Slightly wider range

         // --- Simplified Time Value Proxy for the Further option AT NEAR expiry ---
         // Calculate initial time value for the further leg at the CURRENT_UNDERLYING_PRICE
         const initialIntrinsicFurther = type === 'call' ? Math.max(0, CURRENT_UNDERLYING_PRICE - furtherK) : Math.max(0, furtherK - CURRENT_UNDERLYING_PRICE);
         const initialTimeValueFurther = Math.max(0, furtherP - initialIntrinsicFurther);

         // Decay the initial time value based on distance from the further strike for the plot
         const timeValueProxy = (p) => initialTimeValueFurther * Math.exp(-0.0005 * Math.pow(p - furtherK, 2));

         const profits = prices.map(p => {
             // Payoff of Short Near Leg (at its expiry)
             const nearPayoff = calculateLegPayoff(p, type, 'short', nearK, nearP); // Assuming near leg is short

             // Estimated Value of Long Further Leg (at near expiry)
             const furtherIntrinsic = type === 'call' ? Math.max(0, p - furtherK) : Math.max(0, furtherK - p);
             const furtherValue = furtherIntrinsic + timeValueProxy(p);

             // Total P/L at Near Expiry = Near Leg Payoff + Further Leg Value - Initial Debit
             return nearPayoff + furtherValue - furtherP; // Subtract premium paid for *this* leg initially
         });

        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'darkviolet', width: 2.5 } };
        const costType = netDebit >= 0 ? 'Debit' : 'Credit';
        const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Diagonal ${furtherK.toFixed(2)}/${nearK.toFixed(2)} (At Near Expiry) (Net ${costType}: ${Math.abs(netDebit).toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
     plotRatioSpread: (params, id, strategy) => {
         // Handles both Ratio Spreads (Buy 1, Sell N) and Backspreads (Sell 1, Buy N)
         const { type, ratio1, ratio2, strike1, strike2, premium1, premium2 } = params;
         // Determine which ratio/premium belongs to which strike based on strike1/strike2 mapping in JSON
         const lowerK = Math.min(strike1, strike2), higherK = Math.max(strike1, strike2);
         const lowerP = (strike1 === lowerK) ? premium1 : premium2;
         const higherP = (strike1 === higherK) ? premium1 : premium2;
         // Ratios should be positive in JSON parameters for clarity of quantity
         const lowerRatio = (strike1 === lowerK) ? Math.abs(ratio1) : Math.abs(ratio2);
         const higherRatio = (strike1 === higherK) ? Math.abs(ratio1) : Math.abs(ratio2);

         let netCost;
         let profits;
         let primaryPosition, secondaryPosition;

         // Determine positions and ratios based on the strategy name (Ratio vs Backspread)
         if (strategy.id.includes('ratio-spread')) { // Example: Call Ratio (Buy 1 Lower, Sell 2 Higher)
             primaryPosition = 'long'; secondaryPosition = 'short';
             netCost = (lowerRatio * lowerP) - (higherRatio * higherP);
         } else if (strategy.id.includes('backspread')) { // Example: Call Backspread (Sell 1 Lower, Buy 2 Higher)
             primaryPosition = 'short'; secondaryPosition = 'long';
             netCost = (higherRatio * higherP) - (lowerRatio * lowerP); // Debit usually
         } else {
             console.error(`Unknown ratio/backspread type for plotting: ${strategy.id}`);
             return;
         }


         const prices = generatePriceRange((lowerK + higherK) / 2, 0.25); // Wider range

         const profitsArray = prices.map(p =>
             (lowerRatio * calculateLegPayoff(p, type, primaryPosition, lowerK, lowerP)) +
             (higherRatio * calculateLegPayoff(p, type, secondaryPosition, higherK, higherP))
         );

         const trace = { x: prices, y: profitsArray, type: 'scatter', mode: 'lines', line: { color: 'teal', width: 2.5 } };
         const costType = netCost >= 0 ? 'Debit' : 'Credit';
         const title = `${strategy.name.replace(/\s*\(.*\)/, '')} ${lowerK.toFixed(2)}/${higherK.toFixed(2)} (${lowerRatio}:${higherRatio}) (Net ${costType}: ${Math.abs(netCost).toFixed(2)})`;
         Plotly.newPlot(id, [trace], getPlotlyLayout(title));
     },
         plotCondor: (params, id) => { // Added generic Condor plot (can be Call or Put)
             const { type, position, strike1, strike2, strike3, strike4, premium1, premium2, premium3, premium4 } = params;
             // Assume K1 < K2 < K3 < K4
             let netCost;
             let profits;
             let color = '#17a2b8'; // Default color

             if (position === 'short') { // Short Condor (Buy K1/K4, Sell K2/K3)
                 netCost = (premium2 + premium3) - (premium1 + premium4); // Credit is positive
                 profits = generatePriceRange((strike2 + strike3) / 2, 0.2).map(p =>
                     calculateLegPayoff(p, type, 'long', strike1, premium1) + calculateLegPayoff(p, type, 'short', strike2, premium2) +
                     calculateLegPayoff(p, type, 'short', strike3, premium3) + calculateLegPayoff(p, type, 'long', strike4, premium4)
                 );
                  color = 'purple'; // Credit spreads often purple

             } else if (position === 'long') { // Long Condor (Sell K1/K4, Buy K2/K3)
                 netCost = (premium1 + premium4) - (premium2 + premium3); // Debit is positive
                 profits = generatePriceRange((strike2 + strike3) / 2, 0.2).map(p =>
                     calculateLegPayoff(p, type, 'short', strike1, premium1) + calculateLegPayoff(p, type, 'long', strike2, premium2) +
                     calculateLegPayoff(p, type, 'long', strike3, premium3) + calculateLegPayoff(p, type, 'short', strike4, premium4)
                 );
                  color = 'green'; // Debit spreads often green
             } else {
                  console.error(`Unknown condor position for plotting: ${position}`);
                  return;
             }


             const trace = { x: generatePriceRange((strike2 + strike3) / 2, 0.2), y: profits, type: 'scatter', mode: 'lines', line: { color: color, width: 2.5 } };
             const costType = netCost >= 0 ? 'Credit' : 'Debit'; // Condors are typically credit (short) or debit (long)
             const title = `${position.charAt(0).toUpperCase() + position.slice(1)} ${type.charAt(0).toUpperCase() + type.slice(1)} Condor ${strike1.toFixed(2)}/${strike2.toFixed(2)}/${strike3.toFixed(2)}/${strike4.toFixed(2)} (Net ${costType}: ${Math.abs(netCost).toFixed(2)})`;
             Plotly.newPlot(id, [trace], getPlotlyLayout(title));
         },
         // Plotting function for strategies with >= 5 legs (requires 'legs' array in parameters)
         plotComplexStrategy: (params, id, strategy) => {
             const { legs } = params;
             if (!Array.isArray(legs) || legs.length < 5) {
                 console.error(`Invalid or insufficient legs (${legs ? legs.length : 0}) for complex strategy plotting.`);
                 return;
             }

             // Determine price range - find min/max strike for centering
             const strikes = legs.map(leg => leg.strike);
             const minStrike = Math.min(...strikes);
             const maxStrike = Math.max(...strikes);
             const centerPrice = (minStrike + maxStrike) / 2;

             // Generate price range, potentially wider for complex strategies
             const prices = generatePriceRange(centerPrice, 0.3);

             const profits = prices.map(p => {
                 let totalPayoff = 0;
                 legs.forEach(leg => {
                      totalPayoff += calculateLegPayoff(p, leg.type, leg.position, leg.strike, leg.premium);
                 });
                 return totalPayoff;
             });

              // Calculate net cost
             let netCost = 0;
             legs.forEach(leg => {
                  netCost += (leg.position === 'long' ? leg.premium : -leg.premium);
             });

             const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'darkred', width: 2.5 } }; // Unique color for multi-leg
              const costType = netCost >= 0 ? 'Debit' : 'Credit';
             const title = `${strategy.name} (Net ${costType}: ${Math.abs(netCost).toFixed(2)})`;
             Plotly.newPlot(id, [trace], getPlotlyLayout(title));
         }
    }; // End plotFunctions map


    /**
     * ========================================================================
     * DOM Manipulation and Rendering Functions
     * ========================================================================
     */

    /** Clears the main content area sections. */
    function clearContentSections() {
        Object.values(DOM.sectionContainers).forEach(container => {
            if (container) {
                 // Remove existing child elements
                 while (container.firstChild) {
                     container.removeChild(container.firstChild);
                 }
                 // Purge Plotly charts within this container (best effort)
                 const charts = container.querySelectorAll('.plotly-chart-container');
                 charts.forEach(chartDiv => {
                     if (chartDiv._fullLayout && typeof Plotly !== 'undefined') { // Check if it's a Plotly div
                         try { Plotly.purge(chartDiv); } catch (e) { logger.warn(`Error purging Plotly chart: ${e.message}`); }
                     }
                 });
            }
        });
        DOM.statusMessageArea.innerHTML = ''; // Clear status messages
    }

    /** Updates the status message area (loading, error, offline). */
    function updateStatusMessage() {
        DOM.statusMessageArea.innerHTML = ''; // Clear previous messages
        let message = '';
        let className = 'status-message';

        if (appState.isLoading) {
            message = 'Loading Strategy Data... Please wait.';
            className += ' loading-message';
        } else if (appState.error) {
            message = `Error: ${appState.error}`;
            className += ' error-message';
        } else if (appState.isOffline && !appState.strategyData) {
            message = 'Application is offline and no cached or stored data is available.';
            className += ' offline-message';
        } else if (!appState.strategyData) {
            message = 'No strategy data could be loaded from any source.';
            className += ' error-message';
        }

        if (message) {
            const msgDiv = document.createElement('div');
            msgDiv.className = className;
            msgDiv.textContent = message;
            DOM.statusMessageArea.appendChild(msgDiv);
        }
    }

    /** Updates the status indicators in the header (Offline, Data Source). */
    function updateStatusIndicators() {
        DOM.statusIndicators.innerHTML = ''; // Clear existing
        let indicatorsHTML = '';
        if (appState.dataSource) {
            const color = appState.dataSource === 'Network' ? 'w3-green' : (appState.dataSource === 'Embedded' ? 'w3-light-grey' : 'w3-blue');
            indicatorsHTML += `<span class="w3-tag w3-round ${color}">Data: ${appState.dataSource}</span>`;
        }
        if (appState.isOffline) {
            indicatorsHTML += `<span class="w3-tag w3-round w3-orange w3-margin-left">Offline</span>`;
        }
        DOM.statusIndicators.innerHTML = indicatorsHTML;
    }

    /** Renders the sidebar navigation links based on available data keys. */
    function renderSidebarLinks() {
        DOM.sidebarLinks.innerHTML = ''; // Clear existing links
        const sectionTitles = { about: 'About', oneLeg: '1-Leg', twoLeg: '2-Leg', threeLeg: '3-Leg', fourLeg: '4-Leg', multiLeg: '5+ Legs' }; // Added multiLeg title
        // Ensure 'about' is always first, then others if data exists
        const validKeys = ['about'];
         if (appState.strategyData) {
             Object.keys(appState.strategyData).forEach(key => {
                 if (key !== 'about' && sectionTitles[key] && Array.isArray(appState.strategyData[key]) && appState.strategyData[key].length > 0) {
                      validKeys.push(key);
                 }
             });
         }

        validKeys.forEach(key => {
            const link = document.createElement('a');
            link.href = `#${key}`;
            link.className = 'w3-bar-item w3-button nav-link';
            link.textContent = `${sectionTitles[key] || key} Strategies`; // Use key as fallback title
            link.dataset.section = key;
            link.title = `Navigate to ${sectionTitles[key] || key} Strategies`;
            link.addEventListener('click', handleNavLinkClick); // Attach event listener
            DOM.sidebarLinks.appendChild(link);
        });
    }

    /** Renders the content for the 'About' section. */
    function renderAboutSection() {
        clearContentSections(); // Clear all sections first
        const aboutContainer = DOM.sectionContainers.about; // Get the specific section container
        if (!aboutContainer) return; // Should not happen with fixed section divs

        if (!appState.strategyData?.about) {
             aboutContainer.innerHTML = '<p class="error-message">About content not available in data.</p>';
             aboutContainer.style.display = 'block'; // Make sure it's visible
             return;
        }
        const aboutData = appState.strategyData.about;
        aboutContainer.innerHTML = `<h2>${aboutData.title || 'About This Visualizer'}</h2>`;

         // Add the data date if available
         if (aboutData.dataDate) {
              const dateElement = document.createElement('p');
              dateElement.className = 'w3-small w3-text-grey';
              dateElement.textContent = `Data source date: ${aboutData.dataDate}`;
              aboutContainer.appendChild(dateElement);
         }

        aboutData.content?.forEach(paragraph => {
            const p = document.createElement('p');
            p.innerHTML = paragraph; // Use innerHTML for allowed HTML tags
            aboutContainer.appendChild(p);
        });
         // Add specific note about calendar/diagonal plots
         const noteDiv = document.createElement('div');
         noteDiv.className = 'info-message'; // Use the predefined info message class
         noteDiv.innerHTML = "<strong>Note on Multi-Expiry Plots:</strong> Payoff diagrams for Calendar and Diagonal spreads on this page represent the theoretical Profit/Loss at the expiration of the <strong>near-term option</strong>. Calculating the exact value of the longer-term option at that time requires a full options pricing model, which is not included here. The plots use a simplified proxy for the longer-term option's time value.";
         aboutContainer.appendChild(noteDiv);

        aboutContainer.style.display = 'block'; // Make the section visible
    }

    /** Renders a section containing multiple strategy details. */
    function renderStrategySection(sectionKey) {
        clearContentSections(); // Clear all sections first
        const sectionContainer = DOM.sectionContainers[sectionKey]; // Get the specific section container
        if (!sectionContainer) {
             logger.error(`Container for section ${sectionKey} not found.`);
             return;
        }

        const sectionTitles = { oneLeg: '1-Leg', twoLeg: '2-Leg', threeLeg: '3-Leg', fourLeg: '4-Leg', multiLeg: '5+ Legs' };
        const sectionDescriptions = {
             oneLeg: 'Strategies involving a single option contract (a single leg). These are the fundamental building blocks.',
             twoLeg: 'Strategies combining two different option contracts on the same underlying. Often used to define risk, reduce cost, or express a specific market view (e.g., spreads, straddles, strangles).',
             threeLeg: 'Strategies involving three option contracts, typically used for more complex market outlooks like neutral ranges with defined risk (e.g., butterflies).',
             fourLeg: 'Advanced strategies using four option contracts, commonly employed for range-bound (neutral) markets or volatility plays, often with defined risk and reward (e.g., condors, iron butterflies, box spreads).',
             multiLeg: 'Strategies involving five or more option contracts. These are typically complex combinations designed for specific, often sophisticated, market outlooks or volatility plays.'
         };

        const title = `${sectionTitles[sectionKey] || sectionKey} Strategies`;
        const description = sectionDescriptions[sectionKey];
        const strategies = appState.strategyData ? (appState.strategyData[sectionKey] || []) : [];

        // Add section title and description
        const titleElement = document.createElement('h2');
        titleElement.textContent = title;
        sectionContainer.appendChild(titleElement);

        if (description) {
            const descElement = document.createElement('p');
            descElement.textContent = description;
            sectionContainer.appendChild(descElement);
        }

        if (strategies.length > 0) {
            strategies.forEach(strategy => {
                const detailPanel = createStrategyDetailPanel(strategy, sectionKey); // Pass sectionKey here
                sectionContainer.appendChild(detailPanel);

                // --- Setup Input Listeners and Initial Plot ---
                const inputElements = detailPanel.querySelectorAll('.strategy-inputs input');
                inputElements.forEach(input => {
                     // Use an anonymous function to correctly pass the strategy object
                    input.addEventListener('input', () => replotStrategy(strategy));
                });

                // Plot the chart initially after it's in the DOM
                replotStrategy(strategy);
            });
        } else {
            const infoMsg = document.createElement('p');
            infoMsg.className = 'info-message';
            infoMsg.textContent = 'No strategies available for this section in the loaded data.';
            sectionContainer.appendChild(infoMsg);
        }
         // Ensure the current section container is visible after rendering
         sectionContainer.style.display = 'block';
    }

    /** Creates the HTML elements for a single strategy's detail panel including inputs. */
    function createStrategyDetailPanel(strategy, sectionKey) { // Added sectionKey param
        const panel = document.createElement('div');
        panel.className = 'w3-panel w3-card-4 strategy-panel';
        panel.dataset.strategyId = strategy.id || strategy.name; // Use ID if available
        panel.dataset.sectionKey = sectionKey; // Add section key for potential CSS

        // Helper to create a paragraph with optional strong title
        const createDetailHtml = (content, title) => {
            if (!content) return '';
            // Use innerHTML to allow simple formatting like strong/em if present in JSON
            return `<p><strong class="w3-text-dark-grey">${title}:</strong> ${content}</p>`;
        };

         // Helper to create list section with a title and w3.css class
        const createListSectionHtml = (items, title) => {
             if (!items || items.length === 0) return '';
             let listHTML = `<div class="strategy-detail-section"><strong>${title}:</strong><ul>`;
             items.forEach(item => { listHTML += `<li>${item}</li>`; });
             listHTML += `</ul></div>`;
             return listHTML;
         };

        // Create Input fields HTML
        let inputFieldsHTML = '<div class="strategy-inputs"><strong>Parameters:</strong><div class="w3-row w3-small">';

        // Handle complex legs parameter separately if it exists
        if (strategy.parameters && strategy.parameters.legs && Array.isArray(strategy.parameters.legs)) {
             inputFieldsHTML += '<p><i>Adjust parameters for each leg below:</i></p>';
             strategy.parameters.legs.forEach((leg, index) => {
                 inputFieldsHTML += `<h4>Leg ${index + 1}</h4>`;
                 for (const paramName in leg) {
                     const paramValue = leg[paramName];
                     const paramType = typeof paramValue === 'number' ? 'number' : 'text';
                     const stepAttribute = paramType === 'number' ? 'step="any"' : '';
                     const valueAttribute = paramType === 'number' ? `value="${paramValue.toFixed(2)}"` : `value="${paramValue}"`;
                     // Unique ID for complex legs
                     const inputId = `${strategy.id}-leg${index}-${paramName}-input`;

                      const labelText = paramName
                          .replace(/([A-Z])/g, ' $1').trim()
                          .replace('P', ' Put').replace('C', ' Call')
                          .replace('Prem', ' Premium'); // Basic formatting

                     inputFieldsHTML += `
                         <div class="w3-col s6 m4 l3 w3-padding-small">
                             <label for="${inputId}">Leg ${index + 1} ${labelText}:</label>
                             <input id="${inputId}" class="w3-input w3-border w3-round-small" type="${paramType}" ${stepAttribute} ${valueAttribute}>
                         </div>
                      `;
                 }
             });

        } else if (strategy.parameters) { // Handle standard parameters
             for (const paramName in strategy.parameters) {
                 const paramValue = strategy.parameters[paramName];
                 const paramType = typeof paramValue === 'number' ? 'number' : 'text';
                 const stepAttribute = paramType === 'number' ? 'step="any"' : '';
                 const valueAttribute = paramType === 'number' ? `value="${paramValue.toFixed(2)}"` : `value="${paramValue}"`;
                 const inputId = `${strategy.id}-${paramName}-input`;
                  // Basic formatting for parameter names
                 const labelText = paramName
                     .replace(/([A-Z])/g, ' $1').trim()
                     .replace('P', ' Put').replace('C', ' Call')
                     .replace('Prem', ' Premium')
                     .replace('Pc', 'Put/Call') // specific to iron butterfly
                     .replace('P1', 'Put 1').replace('P2', 'Put 2').replace('P3', 'Put 3').replace('P4', 'Put 4') // Numbered legs
                     .replace('C1', 'Call 1').replace('C2', 'Call 2').replace('C3', 'Call 3').replace('C4', 'Call 4')
                     .replace('Strike1', 'Strike 1').replace('Strike2', 'Strike 2').replace('Strike3', 'Strike 3').replace('Strike4', 'Strike 4')
                     .replace('PutStrike', 'Put Strike').replace('CallStrike', 'Call Strike')
                     .replace('NearPremium', 'Near Premium').replace('FurtherPremium', 'Further Premium')
                     .replace('Ratio1', 'Ratio 1').replace('Ratio2', 'Ratio 2');


                 inputFieldsHTML += `
                     <div class="w3-col s6 m4 l3 w3-padding-small">
                         <label for="${inputId}">${labelText}:</label>
                         <input id="${inputId}" class="w3-input w3-border w3-round-small" type="${paramType}" ${stepAttribute} ${valueAttribute}>
                     </div>
                 `;
             }
        }


        inputFieldsHTML += '</div></div>'; // Close w3-row and strategy-inputs

        // Build panel content using template literal
        panel.innerHTML = `
            <h3>${strategy.name || 'Unnamed Strategy'}</h3>
             ${createDetailHtml(strategy.outlook, "Outlook")}
             ${createDetailHtml(strategy.description, "Description")}

            ${strategy.construction ? `
                <div class="strategy-construction">
                    ${createListSectionHtml(strategy.construction, "Construction")}
                    ${strategy.notes ? `<p class="strategy-notes"><em>Note: ${strategy.notes}</em></p>` : ''}
                </div>
            ` : ''}

             ${createListSectionHtml(strategy.greeksImpact ? Object.entries(strategy.greeksImpact).map(([g, i]) => `<strong>${g.charAt(0).toUpperCase() + g.slice(1)}:</strong> ${i}`) : null, "Greeks Impact")}
             ${createDetailHtml(strategy.whenToUse, "When to Use")}
             ${createDetailHtml(strategy.risks, "Potential Risks")}


             ${createDetailHtml(strategy.maxProfit, "Max Profit")}
             ${createDetailHtml(strategy.maxLoss, "Max Loss")}
             ${createDetailHtml(strategy.breakeven, "Breakeven Point(s)")}

            ${inputFieldsHTML} <!-- Insert inputs here -->

            <!-- Plotly Chart Container -->
            ${strategy.plotlyDivId ? `<div id="${strategy.plotlyDivId}" class="plotly-chart-container"></div>` : ''}

            ${strategy.example ? `<p class="strategy-example"><em>Example: ${strategy.example}</em></p>` : ''}

            <!-- Action Button -->
            <button class="w3-button w3-light-grey w3-small action-button calendar-button" data-strategy-name="${strategy.name || 'Unknown'}">
                <i class="fa fa-calendar-plus-o"></i> Add to Calendar (Placeholder)
            </button>
        `;
        return panel;
    }


    /** Selects and renders the appropriate content based on appState.currentSection */
    function renderCurrentSection() {
        logger.log(`Attempting to render section: ${appState.currentSection}`);
        updateStatusMessage(); // Show loading/error state if applicable
        updateStatusIndicators();

        // Hide all section containers first
        Object.values(DOM.sectionContainers).forEach(container => {
             if (container) container.style.display = 'none';
        });

        if (appState.isLoading || (!appState.strategyData && !appState.error)) {
            // If loading or no data/error yet, show only status message area
            // Content sections are already hidden by clearContentSections
            return;
        }
         if (!appState.strategyData && appState.error) {
             // If error and no data, status message is already shown, content area remains empty
             return;
         }

         // If we have data, render the specific section
        switch(appState.currentSection) {
            case 'about':
                renderAboutSection();
                break;
            case 'oneLeg':
            case 'twoLeg':
            case 'threeLeg':
            case 'fourLeg':
            case 'multiLeg': // Added multiLeg case
                 // Only render if data exists for this section AND it's an array with items
                 if (appState.strategyData[appState.currentSection] && Array.isArray(appState.strategyData[appState.currentSection]) && appState.strategyData[appState.currentSection].length > 0) {
                    renderStrategySection(appState.currentSection);
                 } else {
                     // If section data is empty or missing, show about and log a warning
                     logger.warn(`No valid data found for section: ${appState.currentSection}. Showing About.`);
                     appState.currentSection = 'about';
                     renderAboutSection(); // Recurse to render about
                 }
                break;
            default:
                logger.warn(`Unknown section requested: ${appState.currentSection}. Showing About.`);
                appState.currentSection = 'about'; // Fallback to 'about'
                renderAboutSection(); // Recurse to render about
        }

        // Update sidebar active link AFTER the section is potentially switched
        updateSidebarActiveState();

         // Track page view in Google Analytics if configured
        if (typeof gtag === 'function' && typeof G_XXXXXXXXXX !== 'undefined' && G_XXXXXXXXXX !== 'G-XXXXXXXXXX') { // Basic check if analytics ID is set
            gtag('event', 'page_view', {
                page_title: appState.currentSection,
                page_path: `/#${appState.currentSection}` // Simulate path
            });
             logger.log(`[Analytics] GA event: page_view sent for section ${appState.currentSection}`);
        }
    }

    /** Updates the 'active' class on sidebar links. */
    function updateSidebarActiveState() {
        const links = DOM.sidebarLinks.querySelectorAll('.nav-link');
        links.forEach(link => {
            if (link.dataset.section === appState.currentSection) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }


    /**
     * ========================================================================
     * Event Handlers
     * ========================================================================
     */

    /** Handles clicks on sidebar navigation links. */
    function handleNavLinkClick(event) {
        event.preventDefault(); // Prevent default anchor behavior
        const section = event.target.dataset.section;
        // Use window.location.hash for navigation state, which also handles browser history
        if (section && section !== appState.currentSection) { // Only update hash if section is different
             window.location.hash = section;
             // The 'hashchange' listener will pick this up and call renderCurrentSection
        } else if (section === appState.currentSection) {
             // If clicking the current section link, just close sidebar on small screens
             if (window.innerWidth <= 992) {
                  w3_close();
             }
        } else {
             // Handle cases where section is undefined or somehow invalid
             logger.warn("Clicked navigation link with no valid section data-attribute.");
        }
    }


    /** Handles click on the "Add to Calendar" placeholder button (uses event delegation). */
    function handleCalendarButtonClick(event) {
         const button = event.target.closest('.calendar-button');
         if (button) {
             const strategyName = button.dataset.strategyName || 'Unknown Strategy';
             logger.log(`Calendar button clicked for: ${strategyName}`);
             alert(`Google Calendar Integration Placeholder\n\nStrategy: "${strategyName}"\n\nThis button is a placeholder to demonstrate where external integrations could be added. It does not currently add an event to your Google Calendar.`);

             // Send GA event if configured
            if (typeof gtag === 'function' && typeof G_XXXXXXXXXX !== 'undefined' && G_XXXXXXXXXX !== 'G-XXXXXXXXXX') {
                 gtag('event', 'add_to_calendar_click', {
                     'event_category': 'Strategy Engagement',
                     'event_label': strategyName,
                 });
                 logger.log(`[Analytics] GA event: add_to_calendar_click sent for ${strategyName}`);
             }
         }
    }

    /** Handles click on the "Refresh Data" button. */
    function handleRefreshDataClick() {
        logger.log("Refresh data button clicked.");
        if (appState.isOffline) {
            logger.warn("Cannot refresh data while offline.");
            updateStatusMessageInternal("Cannot refresh data while offline.", "offline-message");
            return;
        }
        if (appState.isLoading) {
            logger.warn("Already loading data, refresh request ignored.");
            return;
        }
        initializeApp(true); // Trigger forced refresh
    }

    /** Updates network status and triggers data reload if necessary. */
    function updateNetworkStatus() {
        const wasOffline = appState.isOffline;
        appState.isOffline = !navigator.onLine;
        logger.log(`Network status changed: ${appState.isOffline ? 'OFFLINE' : 'ONLINE'}`);
        updateStatusIndicators(); // Update header indicator immediately
        DOM.refreshDataButton.disabled = appState.isOffline || appState.isLoading; // Update button state

        // If we just came online and we don't have Network data currently, try fetching fresh data
        if (wasOffline && !appState.isOffline && appState.dataSource !== 'Network') {
            logger.info("Network connection restored, attempting to fetch fresh data.");
            initializeApp(true); // Force data refresh on reconnect
        } else if (appState.isOffline && !appState.strategyData) {
             // If we just went offline and have no data at all, trigger a render
             renderCurrentSection(); // Shows the offline message
        }
    }

     /** Helper for internal status message updates without full re-render */
     function updateStatusMessageInternal(message, className) {
         DOM.statusMessageArea.innerHTML = ''; // Clear previous
         if (message) {
             const msgDiv = document.createElement('div');
             msgDiv.className = `status-message ${className}`;
             msgDiv.textContent = message;
             DOM.statusMessageArea.appendChild(msgDiv);
         }
     }


    /**
     * ========================================================================
     * Data Loading Orchestration
     * ========================================================================
     */

    /** Main data initialization function */
    async function initializeApp(forceRefresh = false) {
        logger.log(`Initializing App. Force refresh: ${forceRefresh}`);
        appState.isLoading = true;
        appState.error = null; // Clear previous errors on new load attempt
        updateStatusMessage(); // Show initial loading state
        updateStatusIndicators();

        let loadedData = null;
        let source = null; // Track origin
        let fetchError = null;
        let cacheError = null;
        let dbLoadError = null;
        let dbConnectionError = null;


        try {
             // 1. Attempt to open IndexedDB connection early
             // This is async but non-blocking for the main data loading flow.
             // We check appState.dbConnection later before trying to use it.
             openDB().catch(err => { logger.warn("Initial DB open attempt failed:", err); dbConnectionError = err; });


            // 2. Attempt Fetch if Online (or forced refresh)
            if (!appState.isOffline || forceRefresh) {
                logger.info("Attempting to fetch data from network...");
                appState.lastFetchTimestamp = new Date(); // Record fetch attempt time
                try {
                    const response = await fetch(STRATEGIES_JSON_URL, {
                        cache: 'no-store', // Bypass HTTP cache for refresh
                        headers: { 'Accept': 'application/json' }
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                    }
                    const networkData = await response.json();
                    logger.log("Fetch successful.");
                    loadedData = networkData;
                    source = 'Network';

                    // Asynchronously save/cache the fresh data if possible
                    if (appState.dbConnection) { // Check if connection is ready
                        saveDataToDB(loadedData).catch(err => logger.error("Background DB save failed:", err));
                    } else {
                         // If DB connection wasn't ready yet, try again after a short delay
                         setTimeout(() => {
                             if (appState.dbConnection) saveDataToDB(loadedData).catch(err => logger.error("Delayed background DB save failed:", err));
                         }, 500); // Delay slightly to allow DB to connect
                    }
                    cacheDataResponse(STRATEGIES_JSON_URL, loadedData).catch(err => logger.error("Background Cache save failed:", err));

                } catch (e) {
                    logger.warn(`Fetch failed: ${e.message}.`);
                    fetchError = e; // Store fetch error
                }
            } else {
                logger.info("App is offline or refresh not forced. Skipping network fetch.");
                 // Record timestamp of attempt even if skipping
                 appState.lastFetchTimestamp = new Date();
            }

             // 3. Attempt Cache API if Network Failed or Skipped
             if (!loadedData) {
                  logger.info("Attempting to load data from Cache API...");
                  try {
                       const cacheData = await loadDataFromCache(STRATEGIES_JSON_URL);
                       if (cacheData) {
                           logger.log("Data loaded from Cache API.");
                           loadedData = cacheData;
                           source = 'Cache';
                       } else {
                            logger.info("No data found in Cache API.");
                       }
                  } catch (e) {
                       logger.warn(`Cache load failed: ${e.message}.`);
                       cacheError = e; // Store cache error
                  }
             }

            // 4. Attempt IndexedDB if Network/Cache Failed and DB is available
            if (!loadedData && appState.dbConnection) { // Check appState.dbConnection directly now
                logger.info("Attempting to load data from IndexedDB...");
                 try {
                    const dbData = await loadDataFromDB();
                    if (dbData) {
                        logger.log("Data loaded from IndexedDB.");
                        loadedData = dbData;
                        source = 'IndexedDB';
                    } else {
                         logger.info("No data found in IndexedDB.");
                    }
                 } catch (e) {
                      logger.warn(`IndexedDB load failed: ${e.message}.`);
                      dbLoadError = e; // Store DB load error
                 }
            } else if (!loadedData && (dbConnectionError || !window.indexedDB)) {
                 // If DB wasn't even connectable/supported and no data loaded yet
                 logger.warn("Cannot load from IndexedDB - connection not available or supported.");
            }

            // 5. Final Check: If still no data, set the appropriate error
            if (!loadedData) {
                let errorMsgs = [];
                 if (fetchError) errorMsgs.push(`Fetch failed (${fetchError.message}).`);
                 if (cacheError) errorMsgs.push(`Cache load failed (${cacheError.message}).`);
                 if (dbLoadError) errorMsgs.push(`DB load failed (${dbLoadError.message}).`);
                 if (dbConnectionError) errorMsgs.push(`DB connection failed (${dbConnectionError.message}).`);
                 if (errorMsgs.length === 0) errorMsgs.push("No data loaded from any source."); // Generic fallback

                appState.error = errorMsgs.join(" | ");
                appState.strategyData = null; // Explicitly ensure null
                appState.dataSource = 'Error'; // Indicate data source failure
                logger.error("Final data loading failure.", appState.error);

            } else {
                 // Data successfully loaded from one of the sources
                 appState.strategyData = loadedData;
                 appState.dataSource = source;
                 appState.error = null; // Clear any lingering error messages from failed attempts
                 logger.info(`Data loaded successfully from ${source}.`);
            }


            // 6. Final State Update
            appState.isLoading = false; // Loading finished
            if (appState.lastFetchTimestamp) {
                DOM.lastUpdated.textContent = `Last data check: ${appState.lastFetchTimestamp.toLocaleTimeString()}`;
            } else {
                 DOM.lastUpdated.textContent = '';
            }
             // Update button state based on final loading/offline status
             DOM.refreshDataButton.disabled = appState.isOffline || appState.isLoading;


        } catch (initError) {
            // Catch any unexpected errors during the orchestration itself
            logger.error("Unhandled Critical Initialization Error:", initError);
            appState.error = `Critical initialization error: ${initError.message || initError}`;
            appState.strategyData = null;
            appState.isLoading = false;
            appState.dataSource = 'Error';
             DOM.refreshDataButton.disabled = true; // Disable refresh on critical error
        }

        // 7. Render the final state based on loaded data or error
        renderSidebarLinks(); // Update links based on loaded data keys
        renderCurrentSection(); // Render content based on final state or show error

    } // End initializeApp


    /**
     * ========================================================================
     * Initial Setup and Event Listeners
     * ========================================================================
     */
    document.addEventListener('DOMContentLoaded', () => {
        logger.log("DOM Content Loaded. Initializing application...");

        // --- Setup Event Listeners ---

        // Sidebar toggle listeners
        if (DOM.openMenuButton) DOM.openMenuButton.addEventListener('click', w3_open);
        if (DOM.closeMenuButton) DOM.closeMenuButton.addEventListener('click', w3_close);
        if (DOM.overlay) DOM.overlay.addEventListener('click', w3_close);

         // Refresh button listener
         if (DOM.refreshDataButton) DOM.refreshDataButton.addEventListener('click', handleRefreshDataClick);

         // Network status listeners
         window.addEventListener('online', updateNetworkStatus);
         window.addEventListener('offline', updateNetworkStatus);

        // Use event delegation for calendar buttons (more efficient)
        // Attach to the main content container, listen for clicks on buttons with the calendar-button class
        if (DOM.contentContainer) DOM.contentContainer.addEventListener('click', handleCalendarButtonClick);

        // Handle initial hash and hash changes for navigation
        // This makes initial load consistent whether there's a hash or not
        window.addEventListener('hashchange', () => {
            const sectionId = window.location.hash ? window.location.hash.substring(1) : 'about';
            // Update the app state and trigger rendering via renderCurrentSection
            // No need to call showSection directly here, renderCurrentSection manages visibility
            if (sectionId !== appState.currentSection) {
                 appState.currentSection = sectionId;
                 renderCurrentSection();
            } else {
                 // If clicking the current section link, just close sidebar on small screens
                 if (window.innerWidth <= 992) {
                      w3_close();
                 }
            }
        });

        // --- Start Application ---
        initializeApp(); // Initial data load and rendering

        // Trigger a hashchange event on load to handle the initial URL hash
        // This ensures the correct section is displayed immediately if a hash is present
        window.dispatchEvent(new HashChangeEvent('hashchange'));

    });

    /**
     * ========================================================================
     * Embedded Strategy Data (Removed)
     * ========================================================================
     * This block is intentionally empty or removed in this version.
     * The application relies on fetching data from strategies.json,
     * or loading from cache/IndexedDB if offline/fetch fails.
     */

</script>
