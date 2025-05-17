// Okay, I have heavily refactored the `script.js` file to incorporate more `try...catch` blocks and extensive logging throughout the data loading, DOM manipulation, plotting, and event handling logic.

// This version is designed to provide much more detailed feedback in the browser's developer console, making it easier to diagnose issues if they arise.

// Here is the full updated `script.js` file:

// **`script.js` (Refactored with Heavy Tries and Logging)**

// ```javascript
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
// Used as a fallback center price for plotting ranges and for calendar/diagonal calcs
const CURRENT_UNDERLYING_PRICE = 5975.50;


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
        logger.log(`[DB] Opening IndexedDB: ${DB_NAME} (v${DB_VERSION})`);
        if (!window.indexedDB) {
             logger.warn("[DB] IndexedDB not supported by this browser."); // Use warn instead of error for graceful fallback
             appState.dbConnection = null; // Explicitly set null if not supported
             return resolve(null); // Resolve with null as it's not an error *in opening*, just lack of support
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => {
            logger.error("[DB] IndexedDB connection error:", event.target.error);
            appState.dbConnection = null; // Ensure null on error
            reject(`IndexedDB error: ${event.target.error?.message || 'Unknown error'}`);
        };
        request.onsuccess = (event) => {
            logger.log("[DB] IndexedDB connection successful.");
            appState.dbConnection = event.target.result; // Store connection globally
            resolve(appState.dbConnection);
        };
        request.onupgradeneeded = (event) => {
            logger.info("[DB] IndexedDB upgrade needed.");
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                logger.log(`[DB] Creating Object Store: ${STORE_NAME}`);
                db.createObjectStore(STORE_NAME); // Store entire blob, no keyPath needed
            } else {
                 logger.log(`[DB] Object Store "${STORE_NAME}" already exists.`);
            }
            logger.info("[DB] IndexedDB upgrade complete.");
        };
    });
}

/** Saves the entire strategy data object to IndexedDB. */
function saveDataToDB(data) {
     return new Promise(async (resolve, reject) => {
        if (!appState.dbConnection) {
            logger.warn("[DB] No active DB connection for save, cannot save.");
            return reject("No DB connection available.");
        }
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            logger.warn("[DB] Invalid or empty data provided to saveDataToDB.");
            return reject("Invalid or empty data provided to saveDataToDB.");
        }

        try {
            const transaction = appState.dbConnection.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            logger.log(`[DB] Attempting to save data under key: ${DATA_KEY}`);
            const request = store.put(data, DATA_KEY); // Store data using the predefined key

            request.onsuccess = () => {
                 logger.log(`[DB] Data successfully saved to IndexedDB.`);
                 resolve(`Data successfully saved to IndexedDB.`);
            }
            request.onerror = (event) => {
                 logger.error(`[DB] Failed to save data to IndexedDB:`, event.target.error);
                 reject(`Failed to save data to IndexedDB: ${event.target.error}`);
            }
            // Log transaction completion/error separately as it's asynchronous
            transaction.oncomplete = () => logger.log('[DB] Save transaction completed.');
            transaction.onerror = (event) => logger.error('[DB] Save transaction error:', event.target.error);

        } catch (e) {
            logger.error("[DB] Error initiating IndexedDB save transaction:", e);
            reject(`IndexedDB transaction error: ${e.message}`);
        }
     });
}

/** Loads the strategy data object from IndexedDB. */
function loadDataFromDB() {
    return new Promise(async (resolve, reject) => {
        if (!appState.dbConnection) {
            logger.warn("[DB] No active DB connection for load, cannot load.");
            return resolve(null); // Resolve with null if no DB connection is available
        }
        try {
            const transaction = appState.dbConnection.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            logger.log(`[DB] Attempting to load data from IndexedDB using key: ${DATA_KEY}`);
            const request = store.get(DATA_KEY);
            request.onsuccess = (event) => {
                if (event.target.result) {
                    logger.log("[DB] Data found in IndexedDB.");
                    resolve(event.target.result);
                } else {
                    logger.log("[DB] No data found in IndexedDB for the key.");
                    resolve(null);
                }
            };
            request.onerror = (event) => {
                logger.error("[DB] Failed to load data from IndexedDB:", event.target.error);
                reject(`Failed to load data from IndexedDB: ${event.target.error}`);
            };
            // Log transaction completion/error separately
             transaction.oncomplete = () => logger.log('[DB] Load transaction completed.');
             transaction.onerror = (event) => logger.error('[DB] Load transaction error:', event.target.error);
        } catch (e) {
             logger.error("[DB] Error initiating IndexedDB load transaction:", e);
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
        logger.warn("[Cache] Cache Storage API not supported, cannot cache data response.");
        return;
    }
    try {
        logger.log(`[Cache] Attempting to open cache: ${CACHE_NAME}`);
        const cache = await caches.open(CACHE_NAME);
        logger.log(`[Cache] Cache "${CACHE_NAME}" opened. Creating response.`);
        const responseToCache = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', 'X-Cached-Timestamp': Date.now() } // Add timestamp header
        });
        logger.log(`[Cache] Putting data for ${url} into cache.`);
        await cache.put(url, responseToCache);
        logger.log(`[Cache] Data for ${url} successfully stored in Cache Storage.`);
    } catch (error) {
        logger.error('[Cache] Failed to cache data response:', error);
    }
}

/** Attempts to retrieve data from the Cache Storage API. */
 async function loadDataFromCache(url) {
     if (!('caches' in window)) {
         logger.warn("[Cache] Cache Storage API not supported, cannot load from cache.");
         return null;
     }
     try {
         logger.log(`[Cache] Attempting to open cache: ${CACHE_NAME} for loading.`);
         const cache = await caches.open(CACHE_NAME);
          logger.log(`[Cache] Cache "${CACHE_NAME}" opened. Matching URL: ${url}`);
         const cachedResponse = await cache.match(url);
         if (cachedResponse) {
             logger.log(`[Cache] Data found in Cache Storage for ${url}.`);
             // Optional: Check cache freshness based on X-Cached-Timestamp header if needed
             // const timestamp = cachedResponse.headers.get('X-Cached-Timestamp');
             // logger.log(`[Cache] Cached timestamp: ${timestamp}`);
             // if (timestamp && (Date.now() - parseInt(timestamp)) > YOUR_EXPIRY_TIME) { ... handle stale }
             const data = await cachedResponse.json();
             logger.log("[Cache] Successfully parsed JSON from cache.");
             return data;
         } else {
             logger.log(`[Cache] No data found in Cache Storage for ${url}.`);
             return null;
         }
     } catch (error) {
         logger.error(`[Cache] Error loading data from Cache Storage for ${url}:`, error);
         return null; // Treat cache error as cache miss
     }
 }


/**
 * ========================================================================
 * Plotly Charting Functions
 * ========================================================================
 * These functions prepare data for Plotly based on strategy parameters.
 * They take (params, plotlyDivId, strategyObject) and call Plotly.newPlot.
 * IMPORTANT: These functions MUST be registered in the plotFunctions map below.
 * They should handle potential invalid inputs gracefully (e.g., NaNs).
 */

/** Calculates Profit/Loss for a single option leg at expiration */
function calculateLegPayoff(price, type, position, strike, premium) {
    try {
        // Ensure inputs are numbers
        const numericStrike = parseFloat(strike);
        const numericPremium = parseFloat(premium);
        if (isNaN(numericStrike) || isNaN(numericPremium)) {
             logger.warn(`[PlotCalc] calculateLegPayoff received NaN: Price=${price}, Type=${type}, Pos=${position}, Strike=${strike}, Premium=${premium}`);
            return 0; // Return 0 if parameters are invalid
        }

        let intrinsicValue = 0;
        type = type.toLowerCase(); position = position.toLowerCase();
        if (type === 'call') intrinsicValue = Math.max(0, price - numericStrike);
        else if (type === 'put') intrinsicValue = Math.max(0, numericStrike - price);
        else {
             logger.warn(`[PlotCalc] calculateLegPayoff received invalid type: ${type}`);
             return 0; // Handle invalid type
        }

        if (position === 'long') return intrinsicValue - numericPremium;
        else if (position === 'short') return -intrinsicValue + numericPremium;
        else {
             logger.warn(`[PlotCalc] calculateLegPayoff received invalid position: ${position}`);
             return 0; // Handle invalid position
        }
    } catch (e) {
        logger.error(`[PlotCalc] Error in calculateLegPayoff: ${e.message}`, e);
        return 0; // Ensure a number is always returned even on error
    }
}

/** Generates an array of prices for the X-axis */
function generatePriceRange(center, rangePct = 0.15, steps = 200) {
    try {
         const numericCenter = parseFloat(center);
         if (isNaN(numericCenter) || numericCenter <= 0) {
             logger.warn(`[PlotRange] generatePriceRange received invalid center: ${center}. Using fallback.`);
             numericCenter = CURRENT_UNDERLYING_PRICE; // Fallback if center is invalid
             rangePct = 0.05; // Use a smaller range for the fallback center
         }

        const range = numericCenter * rangePct;
        const minP = Math.max(0.01, numericCenter - range); // Avoid exactly 0 for some calcs
        const maxP = numericCenter + range;
        const step = (maxP - minP) / steps;

         // Ensure minP < maxP to avoid infinite loops or errors with small/zero center
         if (minP >= maxP) {
             logger.error(`[PlotRange] Calculated invalid range: min=${minP}, max=${maxP}. Adjusting.`);
             // Create a small valid range around the center if the calculated range is invalid
             const fallbackRange = numericCenter > 1 ? numericCenter * 0.01 : 1; // 1% of center or 1 point
             const fallbackMin = Math.max(0.01, numericCenter - fallbackRange);
             const fallbackMax = numericCenter + fallbackRange;
             const fallbackStep = (fallbackMax - fallbackMin) / steps;
             return Array.from({ length: steps + 1 }, (_, i) => fallbackMin + i * fallbackStep);
         }


        return Array.from({ length: steps + 1 }, (_, i) => minP + i * step);
    } catch (e) {
        logger.error(`[PlotRange] Error generating price range: ${e.message}`, e);
        // Return a minimal default range on error
        return [CURRENT_UNDERLYING_PRICE * 0.9, CURRENT_UNDERLYING_PRICE, CURRENT_UNDERLYING_PRICE * 1.1];
    }
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
// They return { trace, title }
const plotLogic = {
    /** Plots a single long/short call/put */
    plotBasicOption: (params, strategy) => {
        const { type, position, strike, premium } = params;
         // Add input validation/defaulting for parameters
        const cleanStrike = parseFloat(strike) || 0;
        const cleanPremium = parseFloat(premium) || 0;
        if (cleanStrike <= 0 || cleanPremium < 0) logger.warn(`[Plot] BasicOption ${strategy.name}: Invalid strike (${strike}) or premium (${premium})`);


        const prices = generatePriceRange(cleanStrike || CURRENT_UNDERLYING_PRICE); // Use strike or fallback center
        const profits = prices.map(price => calculateLegPayoff(price, type, position, cleanStrike, cleanPremium));
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: position === 'long' ? (type === 'call' ? 'green' : 'blue') : 'red', width: 2.5 } };
        const posText = position.charAt(0).toUpperCase() + position.slice(1);
        const typeText = type.charAt(0).toUpperCase() + type.slice(1);
        const title = `${posText} ${cleanStrike.toFixed(2)} ${typeText} (Premium: ${cleanPremium.toFixed(2)})`;
        return { trace, title };
    },
    plotCoveredCall: (params, strategy) => {
        const { stockPrice, callStrike, callPremium } = params;
        // Add input validation/defaulting
        const cleanStockPrice = parseFloat(stockPrice) || CURRENT_UNDERLYING_PRICE;
        const cleanCallStrike = parseFloat(callStrike) || 0;
        const cleanCallPremium = parseFloat(callPremium) || 0;
         if (cleanCallStrike <= 0 || cleanCallPremium < 0) logger.warn(`[Plot] CoveredCall ${strategy.name}: Invalid strike (${callStrike}) or premium (${callPremium})`);


        const prices = generatePriceRange(cleanStockPrice, 0.2); // Range around stock price
        const profits = prices.map(price => {
            const stockProfit = price - cleanStockPrice;
            const shortCallPayoff = calculateLegPayoff(price, 'call', 'short', cleanCallStrike, cleanCallPremium);
            return stockProfit + shortCallPayoff;
        });
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'darkgreen', width: 2.5 } };
        const title = `Covered Call (${cleanStockPrice.toFixed(2)} Stock, ${cleanCallStrike.toFixed(2)}C @ ${cleanCallPremium.toFixed(2)})`;
        return { trace, title };
    },
     plotProtectivePut: (params, strategy) => {
        const { stockPrice, putStrike, putPremium } = params;
        // Add input validation/defaulting
        const cleanStockPrice = parseFloat(stockPrice) || CURRENT_UNDERLYING_PRICE;
        const cleanPutStrike = parseFloat(putStrike) || 0;
        const cleanPutPremium = parseFloat(putPremium) || 0;
         if (cleanPutStrike <= 0 || cleanPutPremium < 0) logger.warn(`[Plot] ProtectivePut ${strategy.name}: Invalid strike (${putStrike}) or premium (${putPremium})`);


        const prices = generatePriceRange(cleanStockPrice, 0.2); // Range around stock price
        const profits = prices.map(price => {
            const stockProfit = price - cleanStockPrice;
            const longPutPayoff = calculateLegPayoff(price, 'put', 'long', cleanPutStrike, cleanPutPremium);
            return stockProfit + longPutPayoff;
        });
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'darkblue', width: 2.5 } };
        const title = `Protective Put (${cleanStockPrice.toFixed(2)} Stock, ${cleanPutStrike.toFixed(2)}P @ ${cleanPutPremium.toFixed(2)})`;
        return { trace, title };
    },
    plotVerticalSpread: (params, strategy) => {
        const { type, position, strike1, strike2, premium1, premium2 } = params;
         // Add input validation/defaulting
        const cleanStrike1 = parseFloat(strike1) || 0;
        const cleanStrike2 = parseFloat(strike2) || 0;
        const cleanPremium1 = parseFloat(premium1) || 0;
        const cleanPremium2 = parseFloat(premium2) || 0;

        if (cleanStrike1 <= 0 || cleanStrike2 <= 0 || cleanPremium1 < 0 || cleanPremium2 < 0) {
             logger.warn(`[Plot] VerticalSpread ${strategy.name}: Invalid strikes (${strike1},${strike2}) or premiums (${premium1},${premium2})`);
             // Return empty plot data
             return { trace: { x: [], y: [] }, title: `${strategy.name} (Invalid Parameters)` };
        }


        const lowerK = Math.min(cleanStrike1, cleanStrike2), higherK = Math.max(cleanStrike1, cleanStrike2);
        const lowerP = (cleanStrike1 === lowerK) ? cleanPremium1 : cleanPremium2;
        const higherP = (cleanStrike1 === higherK) ? cleanPremium1 : cleanPremium2;
        const prices = generatePriceRange((lowerK + higherK) / 2);
        let profits, netCost, titlePrefix, color;

        if (type === 'call') {
             if (position === 'debit') { // Bull Call (Long K1, Short K2)
                 netCost = lowerP - higherP; profits = prices.map(p => calculateLegPayoff(p, 'call', 'long', lowerK, lowerP) + calculateLegPayoff(p, 'call', 'short', higherK, higherP));
                 titlePrefix = "Bull Call Spread"; color = 'green';
             } else { // Bear Call (Credit) (Short K1, Long K2)
                 netCost = higherP - lowerP; profits = prices.map(p => calculateLegPayoff(p, 'call', 'short', lowerK, lowerP) + calculateLegPayoff(p, 'call', 'long', higherK, higherP)); // Credit is negative cost
                 titlePrefix = "Bear Call Spread"; color = 'red';
             }
         } else { // type === 'put'
                 if (position === 'debit') { // Bear Put (Long K2, Short K1)
                     netCost = higherP - lowerP; profits = prices.map(p => calculateLegPayoff(p, 'put', 'long', higherK, higherP) + calculateLegPayoff(p, 'put', 'short', lowerK, lowerP));
                     titlePrefix = "Bear Put Spread"; color = 'red';
                 } else { // Bull Put (Credit) (Short K2, Long K1)
                     netCost = lowerP - higherP; profits = prices.map(p => calculateLegPayoff(p, 'put', 'short', higherK, higherP) + calculateLegPayoff(p, 'put', 'long', lowerK, lowerP)); // Credit is negative cost
                     titlePrefix = "Bull Put Spread"; color = 'green';
                 }
             }

            const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: color, width: 2.5 } };
            const costType = netCost >= 0 ? 'Debit' : 'Credit';
            const title = `${titlePrefix} ${lowerK.toFixed(2)}/${higherK.toFixed(2)} (${costType}: ${Math.abs(netCost).toFixed(2)})`;
            return { trace, title };
        },
    plotButterfly: (params, strategy) => {
        const { type, strike1, strike2, strike3, premium1, premium2, premium3 } = params;
        // Add input validation/defaulting
        const cleanStrike1 = parseFloat(strike1) || 0;
        const cleanStrike2 = parseFloat(strike2) || 0;
        const cleanStrike3 = parseFloat(strike3) || 0;
        const cleanPremium1 = parseFloat(premium1) || 0;
        const cleanPremium2 = parseFloat(premium2) || 0;
        const cleanPremium3 = parseFloat(premium3) || 0;

        if (cleanStrike1 <= 0 || cleanStrike2 <= 0 || cleanStrike3 <= 0 || cleanPremium1 < 0 || cleanPremium2 < 0 || cleanPremium3 < 0) {
             logger.warn(`[Plot] Butterfly ${strategy.name}: Invalid strikes or premiums.`);
             return { trace: { x: [], y: [] }, title: `${strategy.name} (Invalid Parameters)` };
        }
         // Basic check for butterfly condition (strikes should ideally be spread out and in order)
         if (!(cleanStrike1 < cleanStrike2 && cleanStrike2 < cleanStrike3)) {
              logger.warn(`[Plot] Butterfly ${strategy.name}: Strikes not in ascending order or not distinct.`);
               // Still attempt to plot with provided strikes, but warn
         }


        const netCost = cleanPremium1 - (2 * cleanPremium2) + cleanPremium3; // Debit is positive cost
        const center = (typeof cleanStrike2 === 'number' && !isNaN(cleanStrike2)) ? cleanStrike2 : (cleanStrike1 + cleanStrike3)/2 || CURRENT_UNDERLYING_PRICE;
        const prices = generatePriceRange(center, 0.1); // Narrower range
        const profits = prices.map(p =>
             calculateLegPayoff(p, type, 'long', cleanStrike1, cleanPremium1) +
             (2 * calculateLegPayoff(p, type, 'short', cleanStrike2, cleanPremium2)) +
             calculateLegPayoff(p, type, 'long', cleanStrike3, cleanPremium3)
        );
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'orange', width: 2.5 } };
        const typeText = type.charAt(0).toUpperCase() + type.slice(1);
        const costType = netCost >= 0 ? 'Net Debit' : 'Net Credit';
        const title = `Long ${typeText} Butterfly ${cleanStrike1.toFixed(2)}/${cleanStrike2.toFixed(2)}/${cleanStrike3.toFixed(2)} (${costType}: ${Math.abs(netCost).toFixed(2)})`;
        return { trace, title };
    },
     plotIronCondor: (params, strategy) => {
         const { strikeP1, strikeP2, strikeC3, strikeC4, premiumP1, premiumP2, premiumC3, premiumC4 } = params;
          // Add input validation/defaulting
         const cleanStrikeP1 = parseFloat(strikeP1) || 0;
         const cleanStrikeP2 = parseFloat(strikeP2) || 0;
         const cleanStrikeC3 = parseFloat(strikeC3) || 0;
         const cleanStrikeC4 = parseFloat(strikeC4) || 0;
         const cleanPremiumP1 = parseFloat(premiumP1) || 0;
         const cleanPremiumP2 = parseFloat(premiumP2) || 0;
         const cleanPremiumC3 = parseFloat(premiumC3) || 0;
         const cleanPremiumC4 = parseFloat(premiumC4) || 0;


         if (cleanStrikeP1 <= 0 || cleanStrikeP2 <= 0 || cleanStrikeC3 <= 0 || cleanStrikeC4 <= 0 ||
             cleanPremiumP1 < 0 || cleanPremiumP2 < 0 || cleanPremiumC3 < 0 || cleanPremiumC4 < 0) {
              logger.warn(`[Plot] IronCondor ${strategy.name}: Invalid strikes or premiums.`);
              return { trace: { x: [], y: [] }, title: `${strategy.name} (Invalid Parameters)` };
         }
          // Basic check for iron condor condition (strikes should ideally be spread out and in order)
          if (!(cleanStrikeP1 < cleanStrikeP2 && cleanStrikeP2 < cleanStrikeC3 && cleanStrikeC3 < cleanStrikeC4)) {
               logger.warn(`[Plot] IronCondor ${strategy.name}: Strikes not in ascending order or not distinct.`);
               // Still attempt to plot with provided strikes, but warn
          }


         const netCredit = cleanPremiumP2 + cleanPremiumC3 - cleanPremiumP1 - cleanPremiumC4; // Credit is positive
         const center = (typeof cleanStrikeP2 === 'number' && !isNaN(cleanStrikeP2) && typeof cleanStrikeC3 === 'number' && !isNaN(cleanStrikeC3)) ? (cleanStrikeP2 + cleanStrikeC3) / 2 : CURRENT_UNDERLYING_PRICE;
         const prices = generatePriceRange(center, 0.2);
         const profits = prices.map(p =>
             calculateLegPayoff(p, 'put', 'long', cleanStrikeP1, cleanPremiumP1) + calculateLegPayoff(p, 'put', 'short', cleanStrikeP2, cleanPremiumP2) +
             calculateLegPayoff(p, 'call', 'short', cleanStrikeC3, cleanPremiumC3) + calculateLegPayoff(p, 'call', 'long', cleanStrikeC4, cleanPremiumC4)
         );
         const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#007bff', width: 2.5 } };
         const costType = netCredit >= 0 ? 'Credit' : 'Debit';
         const title = `Iron Condor ${cleanStrikeP1.toFixed(2)}/${cleanStrikeP2.toFixed(2)}P ${cleanStrikeC3.toFixed(2)}/${cleanStrikeC4.toFixed(2)}C (${costType}: ${Math.abs(netCredit).toFixed(2)})`;
         Plotly.newPlot(id, [trace], getPlotlyLayout(title));
     },
     plotIronButterfly: (params, strategy) => {
        const { strikeP1, strikePC2, strikeC3, premiumP1, premiumP2, premiumC2, premiumC3 } = params;
        // Add input validation/defaulting
        const cleanStrikeP1 = parseFloat(strikeP1) || 0;
        const cleanStrikePC2 = parseFloat(strikePC2) || 0;
        const cleanStrikeC3 = parseFloat(strikeC3) || 0;
        const cleanPremiumP1 = parseFloat(premiumP1) || 0;
        const cleanPremiumP2 = parseFloat(premiumP2) || 0;
        const cleanPremiumC2 = parseFloat(premiumC2) || 0;
        const cleanPremiumC3 = parseFloat(premiumC3) || 0;

         if (cleanStrikeP1 <= 0 || cleanStrikePC2 <= 0 || cleanStrikeC3 <= 0 ||
             cleanPremiumP1 < 0 || cleanPremiumP2 < 0 || cleanPremiumC2 < 0 || cleanPremiumC3 < 0) {
              logger.warn(`[Plot] IronButterfly ${strategy.name}: Invalid strikes or premiums.`);
              return { trace: { x: [], y: [] }, title: `${strategy.name} (Invalid Parameters)` };
         }
         // Basic check for butterfly condition (strikes should ideally be spread out and in order)
         if (!(cleanStrikeP1 < cleanStrikePC2 && cleanStrikePC2 < cleanStrikeC3)) {
              logger.warn(`[Plot] IronButterfly ${strategy.name}: Strikes not in ascending order or not distinct.`);
               // Still attempt to plot with provided strikes, but warn
         }


         const netCredit = cleanPremiumP2 + cleanPremiumC2 - cleanPremiumP1 - cleanPremiumC3; // Credit is positive
         const center = (typeof cleanStrikePC2 === 'number' && !isNaN(cleanStrikePC2)) ? cleanStrikePC2 : CURRENT_UNDERLYING_PRICE;
        const prices = generatePriceRange(center, 0.1); // Narrower range for butterfly
        const profits = prices.map(p =>
            calculateLegPayoff(p, 'put', 'long', cleanStrikeP1, cleanPremiumP1) + calculateLegPayoff(p, 'put', 'short', cleanStrikePC2, cleanPremiumP2) +
            calculateLegPayoff(p, 'call', 'short', cleanStrikePC2, cleanPremiumC2) + calculateLegPayoff(p, 'call', 'long', cleanStrikeC3, cleanPremiumC3)
        );
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#ffc107', width: 2.5 } };
        const costType = netCredit >= 0 ? 'Credit' : 'Debit';
        const title = `Iron Butterfly ${cleanStrikeP1.toFixed(2)}P / ${cleanStrikePC2.toFixed(2)}PC / ${cleanStrikeC3.toFixed(2)}C (${costType}: ${Math.abs(netCredit).toFixed(2)})`;
        return { trace, title };
     },
     plotReverseIronCondor: (params, strategy) => {
        const { strikeP1, strikeP2, strikeC3, strikeC4, premiumP1, premiumP2, premiumC3, premiumC4 } = params;
         // Add input validation/defaulting
         const cleanStrikeP1 = parseFloat(strikeP1) || 0;
         const cleanStrikeP2 = parseFloat(strikeP2) || 0;
         const cleanStrikeC3 = parseFloat(strikeC3) || 0;
         const cleanStrikeC4 = parseFloat(strikeC4) || 0;
         const cleanPremiumP1 = parseFloat(premiumP1) || 0;
         const cleanPremiumP2 = parseFloat(premiumP2) || 0;
         const cleanPremiumC3 = parseFloat(premiumC3) || 0;
         const cleanPremiumC4 = parseFloat(premiumC4) || 0;

         if (cleanStrikeP1 <= 0 || cleanStrikeP2 <= 0 || cleanStrikeC3 <= 0 || cleanStrikeC4 <= 0 ||
             cleanPremiumP1 < 0 || cleanPremiumP2 < 0 || cleanPremiumC3 < 0 || cleanPremiumC4 < 0) {
              logger.warn(`[Plot] ReverseIronCondor ${strategy.name}: Invalid strikes or premiums.`);
              return { trace: { x: [], y: [] }, title: `${strategy.name} (Invalid Parameters)` };
         }
          // Basic check for condor condition
          if (!(cleanStrikeP1 < cleanStrikeP2 && cleanStrikeP2 < cleanStrikeC3 && cleanStrikeC3 < cleanStrikeC4)) {
               logger.warn(`[Plot] ReverseIronCondor ${strategy.name}: Strikes not in ascending order or not distinct.`);
               // Still attempt to plot with provided strikes, but warn
          }

        const netDebit = cleanPremiumP2 + cleanPremiumC3 - cleanPremiumP1 - cleanPremiumC4; // Debit is positive
        const center = (typeof cleanStrikeP2 === 'number' && !isNaN(cleanStrikeP2) && typeof cleanStrikeC3 === 'number' && !isNaN(cleanStrikeC3)) ? (cleanStrikeP2 + cleanStrikeC3) / 2 : CURRENT_UNDERLYING_PRICE;
        const prices = generatePriceRange(center, 0.2);
        const profits = prices.map(p =>
            calculateLegPayoff(p, 'put', 'short', cleanStrikeP1, cleanPremiumP1) + calculateLegPayoff(p, 'put', 'long', cleanStrikeP2, cleanPremiumP2) +
            calculateLegPayoff(p, 'call', 'long', cleanStrikeC3, cleanPremiumC3) + calculateLegPayoff(p, 'call', 'short', cleanStrikeC4, cleanPremiumC4)
        );
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#dc3545', width: 2.5 } };
         const costType = netDebit >= 0 ? 'Debit' : 'Credit';
        const title = `Reverse Iron Condor ${cleanStrikeP1.toFixed(2)}/${cleanStrikeP2.toFixed(2)}P ${cleanStrikeC3.toFixed(2)}/${cleanStrikeC4.toFixed(2)}C (${costType}: ${Math.abs(netDebit).toFixed(2)})`;
        return { trace, title };
    },
    plotReverseIronButterfly: (params, strategy) => {
        const { strikeP1, strikePC2, strikeC3, premiumP1, premiumP2, premiumC2, premiumC3 } = params;
         // Add input validation/defaulting
        const cleanStrikeP1 = parseFloat(strikeP1) || 0;
        const cleanStrikePC2 = parseFloat(strikePC2) || 0;
        const cleanStrikeC3 = parseFloat(strikeC3) || 0;
        const cleanPremiumP1 = parseFloat(premiumP1) || 0;
        const cleanPremiumP2 = parseFloat(premiumP2) || 0;
        const cleanPremiumC2 = parseFloat(premiumC2) || 0;
        const cleanPremiumC3 = parseFloat(premiumC3) || 0;

         if (cleanStrikeP1 <= 0 || cleanStrikePC2 <= 0 || cleanStrikeC3 <= 0 ||
             cleanPremiumP1 < 0 || cleanPremiumP2 < 0 || cleanPremiumC2 < 0 || cleanPremiumC3 < 0) {
              logger.warn(`[Plot] ReverseIronButterfly ${strategy.name}: Invalid strikes or premiums.`);
              return { trace: { x: [], y: [] }, title: `${strategy.name} (Invalid Parameters)` };
         }
         // Basic check for butterfly condition
         if (!(cleanStrikeP1 < cleanStrikePC2 && cleanStrikePC2 < cleanStrikeC3)) {
              logger.warn(`[Plot] ReverseIronButterfly ${strategy.name}: Strikes not in ascending order or not distinct.`);
               // Still attempt to plot with provided strikes, but warn
         }

        const netDebit = cleanPremiumP2 + cleanPremiumC2 - cleanPremiumP1 - cleanPremiumC3; // Debit is positive
         const center = (typeof cleanStrikePC2 === 'number' && !isNaN(cleanStrikePC2)) ? cleanStrikePC2 : CURRENT_UNDERLYING_PRICE;
        const prices = generatePriceRange(center, 0.1); // Narrower range
        const profits = prices.map(p =>
            calculateLegPayoff(p, 'put', 'short', cleanStrikeP1, cleanPremiumP1) + calculateLegPayoff(p, 'put', 'long', cleanStrikePC2, cleanPremiumP2) +
            calculateLegPayoff(p, 'call', 'long', cleanStrikePC2, cleanPremiumC2) + calculateLegPayoff(p, 'call', 'short', cleanStrikeC3, cleanPremiumC3)
        );
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#fd7e14', width: 2.5 } };
         const costType = netDebit >= 0 ? 'Debit' : 'Credit';
        const title = `Reverse Iron Butterfly ${cleanStrikeP1.toFixed(2)}P / ${cleanStrikePC2.toFixed(2)}PC / ${cleanStrikeC3.toFixed(2)}C (${costType}: ${Math.abs(netDebit).toFixed(2)})`;
        return { trace, title };
    },
    plotStraddleStrangle: (params, id, strategy) => {
        const { type, position, strikeP, strikeC, premiumP, premiumC } = params; // Added position param
         // Add input validation/defaulting
        const cleanStrikeP = parseFloat(strikeP) || 0;
        const cleanStrikeC = parseFloat(strikeC) || 0;
        const cleanPremiumP = parseFloat(premiumP) || 0;
        const cleanPremiumC = parseFloat(premiumC) || 0;

        if (cleanStrikeP <= 0 || cleanStrikeC <= 0 || cleanPremiumP < 0 || cleanPremiumC < 0) {
             logger.warn(`[Plot] Straddle/Strangle ${strategy.name}: Invalid strikes or premiums.`);
             return { trace: { x: [], y: [] }, title: `${strategy.name} (Invalid Parameters)` };
        }
         // Basic check for strike order
         if (cleanStrikeP > cleanStrikeC) {
              logger.warn(`[Plot] Strangle ${strategy.name}: Put strike (${strikeP}) is higher than Call strike (${strikeC}).`);
               // Still attempt to plot, but warn
         }


         const center = (typeof cleanStrikeP === 'number' && !isNaN(cleanStrikeP) && typeof cleanStrikeC === 'number' && !isNaN(cleanStrikeC)) ? (cleanStrikeP + cleanStrikeC) / 2 : CURRENT_UNDERLYING_PRICE;
        const prices = generatePriceRange(center, 0.4); // Wider range
        const netCost = cleanPremiumP + cleanPremiumC; // Total premium paid (for long) or received (for short)
        const profits = prices.map(p => calculateLegPayoff(p, 'put', position, cleanStrikeP, cleanPremiumP) + calculateLegPayoff(p, 'call', position, cleanStrikeC, cleanPremiumC)); // Use position param
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: position === 'long' ? '#6f42c1' : '#dc3545', width: 2.5 } }; // Purple for long, Red for short
        const titlePrefix = strategy.name.replace(/\s*\(.*\)/, ''); // Use base name
        const costType = position === 'long' ? 'Debit' : 'Credit';
        const strikeText = type === 'straddle' ? cleanStrikeP.toFixed(2) : `${cleanStrikeP.toFixed(2)}P / ${cleanStrikeC.toFixed(2)}C`;
        const title = `${position.charAt(0).toUpperCase() + position.slice(1)} ${titlePrefix.replace('Long ', '').replace('Short ', '')} ${strikeText} (${costType}: ${Math.abs(netCost).toFixed(2)})`; // Adjust title for short straddle/strangle
        return { trace, title };
    },
    plotBoxSpread: (params, id) => {
        const { strike1, strike2, premC1, premC2, premP1, premP2 } = params;
        // Add input validation/defaulting
        const cleanStrike1 = parseFloat(strike1) || 0;
        const cleanStrike2 = parseFloat(strike2) || 0;
        const cleanPremC1 = parseFloat(premC1) || 0;
        const cleanPremC2 = parseFloat(premC2) || 0;
        const cleanPremP1 = parseFloat(premP1) || 0;
        const cleanPremP2 = parseFloat(premP2) || 0;

         if (cleanStrike1 <= 0 || cleanStrike2 <= 0 || cleanPremC1 < 0 || cleanPremC2 < 0 || cleanPremP1 < 0 || cleanPremP2 < 0) {
             logger.warn(`[Plot] BoxSpread: Invalid strikes or premiums.`);
             return { trace: { x: [], y: [] }, title: `Box Spread (Invalid Parameters)` };
         }
          // Basic check for strike order
          if (!(cleanStrike1 < cleanStrike2)) {
               logger.warn(`[Plot] BoxSpread: Strikes not in ascending order or not distinct.`);
               // Still attempt to plot with provided strikes, but warn
          }


        const lowerK = Math.min(cleanStrike1, cleanStrike2);
        const higherK = Math.max(cleanStrike1, cleanStrike2);
         // Map premiums to strikes assuming premC1/premP1 are for strike1 and premC2/premP2 are for strike2
        const lowerPremC = cleanStrike1 === lowerK ? cleanPremC1 : cleanPremC2;
        const higherPremC = cleanStrike1 === higherK ? cleanPremC1 : cleanPremC2;
        const lowerPremP = cleanStrike1 === lowerK ? cleanPremP1 : cleanPremP2;
        const higherPremP = cleanStrike1 === higherK ? cleanPremP1 : cleanPremP2;

        const netDebit = (lowerPremC - higherPremC) + (higherPremP - lowerPremP); // (Buy K1 Call - Sell K2 Call) + (Buy K2 Put - Sell K1 Put)
        const valueAtExpiryIntrinsicDiff = higherK - lowerK; // The constant payoff amount
        const lockedInProfit = valueAtExpiryIntrinsicDiff - netDebit; // P/L = Payoff - Cost

         const center = (typeof lowerK === 'number' && !isNaN(lowerK) && typeof higherK === 'number' && !isNaN(higherK)) ? (lowerK + higherK) / 2 : CURRENT_UNDERLYING_PRICE;
        const prices = generatePriceRange(center, 0.5); // Wider range

        // The payoff at expiration is always K2-K1, regardless of price (ignoring initial cost).
        // The plot should show this constant payoff relative to the initial cost.
        const profits = prices.map(p => lockedInProfit); // P/L relative to initial cost

        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'grey', width: 2.5, dash: 'dash' } };
        const costType = netDebit >= 0 ? 'Debit' : 'Credit';
        const title = `Box Spread ${lowerK.toFixed(2)}/${higherK.toFixed(2)} (P/L Incl. Cost: ${lockedInProfit.toFixed(2)})`;
        return { trace, title };
    },
     plotCalendarSpread: (params, strategy) => {
        const { type, strike, nearPremium, furtherPremium } = params; // strike is the same for both legs
         // Add input validation/defaulting
        const cleanStrike = parseFloat(strike) || 0;
        const cleanNearPremium = parseFloat(nearPremium) || 0;
        const cleanFurtherPremium = parseFloat(furtherPremium) || 0;

         if (cleanStrike <= 0 || cleanNearPremium < 0 || cleanFurtherPremium < 0) {
             logger.warn(`[Plot] CalendarSpread ${strategy.name}: Invalid strike or premiums.`);
             return { trace: { x: [], y: [] }, title: `${strategy.name} (Invalid Parameters)` };
         }
          if (cleanFurtherPremium <= cleanNearPremium) {
               logger.warn(`[Plot] CalendarSpread ${strategy.name}: Further premium (${furtherPremium}) is not greater than Near premium (${nearPremium}) - usually means a credit.`);
               // Will still plot, but might look odd if not debit
          }


        const netDebit = cleanFurtherPremium - cleanNearPremium; // Debit is positive

         const center = (typeof cleanStrike === 'number' && !isNaN(cleanStrike)) ? cleanStrike : CURRENT_UNDERLYING_PRICE;
        const prices = generatePriceRange(center, 0.2); // Range centered on strike

         // --- Simplified Time Value Proxy for the Further option AT NEAR expiry ---
         // Calculate initial intrinsic value at the CURRENT_UNDERLYING_PRICE for the further leg
         const initialIntrinsicFurther = type === 'call' ? Math.max(0, CURRENT_UNDERLYING_PRICE - cleanStrike) : Math.max(0, cleanStrike - CURRENT_UNDERLYING_PRICE);
         // Calculate initial time value for the further leg
         const initialTimeValueFurther = Math.max(0, cleanFurtherPremium - initialIntrinsicFurther);

         // Decay the initial time value based on distance from the strike for the plot
         // This exponential decay is a guess to approximate the curve shape.
         const timeValueProxy = (p) => initialTimeValueFurther * Math.exp(-0.0005 * Math.pow(p - cleanStrike, 2));

         const profits = prices.map(p => {
             // Payoff of Short Near Leg (at its expiry)
             const nearPayoff = calculateLegPayoff(p, type, 'short', cleanStrike, cleanNearPremium);

             // Estimated Value of Long Further Leg (at near expiry)
             const furtherIntrinsic = type === 'call' ? Math.max(0, p - cleanStrike) : Math.max(0, cleanStrike - p);
             const furtherValue = furtherIntrinsic + timeValueProxy(p);

             // Total P/L at Near Expiry = Near Leg Payoff + Further Leg Value - Initial Debit
             return nearPayoff + furtherValue - cleanFurtherPremium; // Subtract premium paid for *this* leg initially
         });

        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'darkorange', width: 2.5 } };
        const costType = netDebit >= 0 ? 'Debit' : 'Credit';
        const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Calendar ${cleanStrike.toFixed(2)} (At Near Expiry) (Net ${costType}: ${Math.abs(netDebit).toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
    plotDiagonalSpread: (params, strategy) => {
        const { type, strike1, premium1, strike2, premium2 } = params; // Assuming strike1/prem1 is FURTHER, strike2/prem2 is NEAR
        // Add input validation/defaulting
        const furtherK = parseFloat(strike1) || 0;
        const furtherP = parseFloat(premium1) || 0;
        const nearK = parseFloat(strike2) || 0;
        const nearP = parseFloat(premium2) || 0;

         if (furtherK <= 0 || nearK <= 0 || furtherP < 0 || nearP < 0) {
             logger.warn(`[Plot] DiagonalSpread ${strategy.name}: Invalid strikes or premiums.`);
             return { trace: { x: [], y: [] }, title: `${strategy.name} (Invalid Parameters)` };
         }
          // Basic check for diagonal spread strike relationship (depends on type)
          if (type === 'call' && furtherK > nearK) {
               logger.warn(`[Plot] Call Diagonal ${strategy.name}: Further call strike (${furtherK}) is higher than Near call strike (${nearK}).`);
                // Will still plot, but might look odd
          } else if (type === 'put' && furtherK < nearK) {
               logger.warn(`[Plot] Put Diagonal ${strategy.name}: Further put strike (${furtherK}) is lower than Near put strike (${nearK}).`);
               // Will still plot, but might look odd
          }


        const netCost = furtherP - nearP; // Usually a debit

         const center = (typeof furtherK === 'number' && !isNaN(furtherK) && typeof nearK === 'number' && !isNaN(nearK)) ? (furtherK + nearK) / 2 : CURRENT_UNDERLYING_PRICE;
         const prices = generatePriceRange(center, 0.25); // Slightly wider range

         // --- Simplified Time Value Proxy for the Further option AT NEAR expiry ---
         // Calculate initial intrinsic value at the CURRENT_UNDERLYING_PRICE for the further leg
         const initialIntrinsicFurther = type === 'call' ? Math.max(0, CURRENT_UNDERLYING_PRICE - furtherK) : Math.max(0, furtherK - CURRENT_UNDERLYING_PRICE);
         // Calculate initial time value for the further leg
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
        const costType = netCost >= 0 ? 'Debit' : 'Credit';
        const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Diagonal ${furtherK.toFixed(2)}/${nearK.toFixed(2)} (At Near Expiry) (Net ${costType}: ${Math.abs(netCost).toFixed(2)})`;
        Plotly.newPlot(id, [trace], getPlotlyLayout(title));
    },
     plotRatioSpread: (params, id, strategy) => {
         // Handles both Ratio Spreads (Buy 1, Sell N) and Backspreads (Sell 1, Buy N)
         const { type, ratio1, ratio2, strike1, strike2, premium1, premium2 } = params;
         // Add input validation/defaulting
         const cleanStrike1 = parseFloat(strike1) || 0;
         const cleanStrike2 = parseFloat(strike2) || 0;
         const cleanPremium1 = parseFloat(premium1) || 0;
         const cleanPremium2 = parseFloat(premium2) || 0;
         const cleanRatio1 = parseFloat(ratio1) || 0;
         const cleanRatio2 = parseFloat(ratio2) || 0;

         if (cleanStrike1 <= 0 || cleanStrike2 <= 0 || cleanPremium1 < 0 || cleanPremium2 < 0 || cleanRatio1 === 0 || cleanRatio2 === 0) {
              logger.warn(`[Plot] RatioSpread/Backspread ${strategy.name}: Invalid strikes, premiums, or ratios.`);
              return { trace: { x: [], y: [] }, title: `${strategy.name} (Invalid Parameters)` };
         }
          // Basic check for strike order
          if (!(cleanStrike1 < cleanStrike2)) {
               logger.warn(`[Plot] ${strategy.name}: Strikes not in ascending order or not distinct.`);
               // Still attempt to plot with provided strikes, but warn
          }

         const lowerK = Math.min(cleanStrike1, cleanStrike2), higherK = Math.max(cleanStrike1, cleanStrike2);
         const lowerP = (cleanStrike1 === lowerK) ? cleanPremium1 : cleanPremium2;
         const higherP = (cleanStrike1 === higherK) ? cleanPremium1 : cleanPremium2;
         // Ratios should be positive in JSON parameters for clarity of quantity
         const lowerRatio = (cleanStrike1 === lowerK) ? Math.abs(cleanRatio1) : Math.abs(cleanRatio2);
         const higherRatio = (cleanStrike1 === higherK) ? Math.abs(cleanRatio1) : Math.abs(cleanRatio2);

         let netCost;
         let primaryPosition, secondaryPosition;
         let color = 'teal';

         // Determine positions based on the strategy name (Ratio vs Backspread)
         if (strategy.id.includes('ratio-spread')) { // Example: Call Ratio (Buy 1 Lower, Sell 2 Higher)
             primaryPosition = 'long'; secondaryPosition = 'short';
             netCost = (lowerRatio * lowerP) - (higherRatio * higherP);
             color = (type === 'call') ? 'purple' : 'teal'; // Call Ratio (Credit) or Put Ratio (Debit) colors

         } else if (strategy.id.includes('backspread')) { // Example: Call Backspread (Sell 1 Lower, Buy 2 Higher)
             primaryPosition = 'short'; secondaryPosition = 'long';
             netCost = (higherRatio * higherP) - (lowerRatio * lowerP); // Usually a debit
             color = (type === 'call') ? 'teal' : 'darkorange'; // Call Back (Debit) or Put Back (Debit) colors
         } else {
             console.error(`Unknown ratio/backspread type for plotting: ${strategy.id}`);
             return { trace: { x: [], y: [] }, title: `${strategy.name} (Plotting Error)` };
         }

         const prices = generatePriceRange((lowerK + higherK) / 2, 0.25); // Wider range

         const profitsArray = prices.map(p =>
             (lowerRatio * calculateLegPayoff(p, type, primaryPosition, lowerK, lowerP)) +
             (higherRatio * calculateLegPayoff(p, type, secondaryPosition, higherK, higherP))
         );

         const trace = { x: prices, y: profitsArray, type: 'scatter', mode: 'lines', line: { color: color, width: 2.5 } };
         const costType = netCost >= 0 ? 'Debit' : 'Credit';
         const title = `${strategy.name.replace(/\s*\(.*\)/, '')} ${lowerK.toFixed(2)}/${higherK.toFixed(2)} (${lowerRatio}:${higherRatio}) (Net ${costType}: ${Math.abs(netCost).toFixed(2)})`;
         return { trace, title };
     },
         plotCondor: (params, id) => { // Added generic Condor plot (can be Call or Put)
             const { type, position, strike1, strike2, strike3, strike4, premium1, premium2, premium3, premium4 } = params;
             // Add input validation/defaulting
             const cleanStrike1 = parseFloat(strike1) || 0;
             const cleanStrike2 = parseFloat(strike2) || 0;
             const cleanStrike3 = parseFloat(strike3) || 0;
             const cleanStrike4 = parseFloat(strike4) || 0;
             const cleanPremium1 = parseFloat(premium1) || 0;
             const cleanPremium2 = parseFloat(premium2) || 0;
             const cleanPremium3 = parseFloat(premium3) || 0;
             const cleanPremium4 = parseFloat(premium4) || 0;

             if (cleanStrike1 <= 0 || cleanStrike2 <= 0 || cleanStrike3 <= 0 || cleanStrike4 <= 0 ||
                 cleanPremium1 < 0 || cleanPremium2 < 0 || cleanPremium3 < 0 || cleanPremium4 < 0) {
                  logger.warn(`[Plot] Condor ${position} ${type}: Invalid strikes or premiums.`);
                  return { trace: { x: [], y: [] }, title: `${position.charAt(0).toUpperCase() + position.slice(1)} ${type.charAt(0).toUpperCase() + type.slice(1)} Condor (Invalid Parameters)` };
             }
              // Basic check for condor condition
              if (!(cleanStrike1 < cleanStrike2 && cleanStrike2 < cleanStrike3 && cleanStrike3 < cleanStrikeC4)) {
                   logger.warn(`[Plot] Condor ${position} ${type}: Strikes not in ascending order or not distinct.`);
                   // Still attempt to plot with provided strikes, but warn
              }


             let netCost;
             let profits;
             let color;

             if (position === 'short') { // Short Condor (Buy K1/K4, Sell K2/K3)
                 netCost = (cleanPremium2 + cleanPremium3) - (cleanPremium1 + cleanPremium4); // Credit is positive
                 profits = generatePriceRange((cleanStrike2 + cleanStrike3) / 2, 0.2).map(p =>
                     calculateLegPayoff(p, type, 'long', cleanStrike1, cleanPremium1) + calculateLegPayoff(p, type, 'short', cleanStrike2, cleanPremium2) +
                     calculateLegPayoff(p, type, 'short', cleanStrike3, cleanPremium3) + calculateLegPayoff(p, type, 'long', cleanStrike4, cleanPremium4)
                 );
                  color = 'purple'; // Credit spreads often purple

             } else if (position === 'long') { // Long Condor (Sell K1/K4, Buy K2/K3)
                 netCost = (cleanPremium1 + cleanPremium4) - (cleanPremium2 + cleanPremium3); // Debit is positive
                 profits = generatePriceRange((cleanStrike2 + cleanStrike3) / 2, 0.2).map(p =>
                     calculateLegPayoff(p, type, 'short', cleanStrike1, cleanPremium1) + calculateLegPayoff(p, type, 'long', cleanStrike2, cleanPremium2) +
                     calculateLegPayoff(p, type, 'long', cleanStrike3, cleanPremium3) + calculateLegPayoff(p, type, 'short', cleanStrike4, cleanPremium4)
                 );
                  color = 'green'; // Debit spreads often green
             } else {
                  console.error(`[Plot] Unknown condor position for plotting: ${position}`);
                  return { trace: { x: [], y: [] }, title: `Condor (Plotting Error)` };
             }


             const trace = { x: generatePriceRange((cleanStrike2 + cleanStrike3) / 2, 0.2), y: profits, type: 'scatter', mode: 'lines', line: { color: color, width: 2.5 } };
             const costType = netCost >= 0 ? 'Credit' : 'Debit'; // Condors are typically credit (short) or debit (long)
             const title = `${position.charAt(0).toUpperCase() + position.slice(1)} ${type.charAt(0).toUpperCase() + type.slice(1)} Condor ${cleanStrike1.toFixed(2)}/${cleanStrike2.toFixed(2)}/${cleanStrike3.toFixed(2)}/${cleanStrike4.toFixed(2)} (Net ${costType}: ${Math.abs(netCost).toFixed(2)})`;
             Plotly.newPlot(id, [trace], getPlotlyLayout(title));
         },
         // Plotting function for strategies with >= 5 legs (requires 'legs' array in parameters)
         plotComplexStrategy: (params, id, strategy) => {
             const { legs } = params; // Expects the parameters to contain a 'legs' array
             if (!Array.isArray(legs) || legs.length < 5) {
                 logger.error(`[Plot] ComplexStrategy ${strategy.name}: Invalid or insufficient legs (${legs ? legs.length : 0}) for plotting.`);
                 // Display an error message in the plot div
                 const plotContainer = document.getElementById(id);
                 if (plotContainer) {
                      plotContainer.innerHTML = `<p class="error-message">Cannot plot: Invalid parameters for strategy.</p>`;
                 }
                 return; // Return undefined/null if parameters are invalid
             }

             // Determine price range - find min/max strike from all legs
             const strikes = legs.map(leg => parseFloat(leg.strike) || 0).filter(s => s > 0); // Filter out invalid/zero strikes
             const minStrike = strikes.length > 0 ? Math.min(...strikes) : CURRENT_UNDERLYING_PRICE * 0.9;
             const maxStrike = strikes.length > 0 ? Math.max(...strikes) : CURRENT_UNDERLYING_PRICE * 1.1;
             const centerPrice = (minStrike + maxStrike) / 2;


             // Generate price range, potentially wider for complex strategies
             const prices = generatePriceRange(centerPrice, 0.3);

             const profits = prices.map(p => {
                 let totalPayoff = 0;
                 legs.forEach(leg => {
                      // Ensure leg parameters are valid numbers for calculation
                      const cleanStrike = parseFloat(leg.strike) || 0;
                      const cleanPremium = parseFloat(leg.premium) || 0;
                      // Only add leg payoff if strike and premium are valid
                      if (cleanStrike > 0 && cleanPremium >= 0) {
                          totalPayoff += calculateLegPayoff(p, leg.type, leg.position, cleanStrike, cleanPremium);
                      } else {
                           // Log warning for specific leg if its parameters are invalid
                            logger.warn(`[Plot] ComplexStrategy ${strategy.name}: Skipping leg due to invalid parameters (Strike=${leg.strike}, Premium=${leg.premium}, Type=${leg.type}, Pos=${leg.position})`);
                      }
                 });
                 return totalPayoff;
             });

              // Calculate net cost from the leg premiums
             let netCost = 0;
             legs.forEach(leg => {
                  const numericPremium = parseFloat(leg.premium);
                  if (!isNaN(numericPremium) && numericPremium >= 0) { // Premium must be non-negative
                      netCost += (leg.position === 'long' ? numericPremium : -numericPremium);
                  } else {
                       logger.warn(`[Plot] ComplexStrategy ${strategy.name}: Leg has invalid premium (${leg.premium}) for net cost calculation.`);
                  }
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
        logger.log("[DOM] Clearing content sections.");
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
                         try { Plotly.purge(chartDiv); } catch (e) { logger.warn(`[DOM] Error purging Plotly chart: ${e.message}`); }
                     }
                 });
            } else {
                 logger.warn(`[DOM] Cannot clear content section: Container not found.`);
            }
        });
        DOM.statusMessageArea.innerHTML = ''; // Clear status messages
         logger.log("[DOM] Content sections cleared.");
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
             logger.log(`[UI] Displaying status message: "${message}"`);
        } else {
             logger.log("[UI] No status message to display.");
        }
    }

    /** Updates the status indicators in the header (Offline, Data Source). */
    function updateStatusIndicators() {
        DOM.statusIndicators.innerHTML = ''; // Clear existing
        let indicatorsHTML = '';
        if (appState.dataSource) {
            const color = appState.dataSource === 'Network' ? 'w3-green' : (appState.dataSource === 'Embedded' ? 'w3-light-grey' : (appState.dataSource === 'IndexedDB' ? 'w3-blue' : 'w3-red')); // Red for Error
            indicatorsHTML += `<span class="w3-tag w3-round ${color}">Data: ${appState.dataSource}</span>`;
        }
        if (appState.isOffline) {
            indicatorsHTML += `<span class="w3-tag w3-round w3-orange w3-margin-left">Offline</span>`;
        }
        DOM.statusIndicators.innerHTML = indicatorsHTML;
         logger.log(`[UI] Updated status indicators. Source: ${appState.dataSource}, Offline: ${appState.isOffline}`);
    }

    /** Renders the sidebar navigation links based on available data keys. */
    function renderSidebarLinks() {
        logger.log("[DOM] Rendering sidebar links.");
        DOM.sidebarLinks.innerHTML = ''; // Clear existing links
        const sectionTitles = { about: 'About', oneLeg: '1-Leg', twoLeg: '2-Leg', threeLeg: '3-Leg', fourLeg: '4-Leg', multiLeg: '5+ Legs' }; // Added multiLeg title
        // Ensure 'about' is always first, then others if data exists and section is present in HTML
        const validKeys = ['about'];
         if (appState.strategyData) {
             Object.keys(appState.strategyData).forEach(key => {
                 // Check if data exists for the key AND the corresponding HTML container exists AND it's an array with items
                 if (key !== 'about' && sectionTitles[key] && DOM.sectionContainers[key] && Array.isArray(appState.strategyData[key]) && appState.strategyData[key].length > 0) {
                      validKeys.push(key);
                 } else if (key !== 'about' && sectionTitles[key] && DOM.sectionContainers[key]) {
                     logger.log(`[DOM] Section "${key}" has no data or invalid data format, skipping sidebar link.`);
                 } else {
                     logger.warn(`[DOM] Unexpected data key or missing container for key: ${key}`);
                 }
             });
         } else {
             logger.warn("[DOM] No strategyData available to render dynamic sidebar links.");
         }


        validKeys.forEach(key => {
            try {
                const link = document.createElement('a');
                link.href = `#${key}`;
                link.className = 'w3-bar-item w3-button nav-link';
                link.textContent = `${sectionTitles[key] || key} Strategies`; // Use key as fallback title
                link.dataset.section = key;
                link.title = `Navigate to ${sectionTitles[key] || key} Strategies`;
                link.addEventListener('click', handleNavLinkClick); // Attach event listener
                DOM.sidebarLinks.appendChild(link);
                 logger.log(`[DOM] Added sidebar link for section: ${key}`);
            } catch (e) {
                 logger.error(`[DOM] Error creating sidebar link for key "${key}": ${e.message}`, e);
            }
        });
         logger.log("[DOM] Sidebar links rendering complete.");
    }

    /** Renders the content for the 'About' section. */
    function renderAboutSection() {
        logger.log("[DOM] Rendering About section.");
        clearContentSections(); // Clear all sections first
        const aboutContainer = DOM.sectionContainers.about; // Get the specific section container
        if (!aboutContainer) {
             logger.error("[DOM] About section container not found.");
             return; // Should not happen with fixed section divs
        }

        if (!appState.strategyData?.about) {
             logger.warn("[DOM] About content not available in strategyData.");
             aboutContainer.innerHTML = '<p class="error-message">About content not available in data.</p>';
             aboutContainer.style.display = 'block'; // Make sure it's visible
             return;
        }
        const aboutData = appState.strategyData.about;
        try {
            aboutContainer.innerHTML = `<h2>${aboutData.title || 'About This Visualizer'}</h2>`;

             // Add the data date if available
             if (aboutData.dataDate) {
                  const dateElement = document.createElement('p');
                  dateElement.className = 'w3-small w3-text-grey';
                  dateElement.textContent = `Data source date: ${aboutData.dataDate}`;
                  aboutContainer.appendChild(dateElement);
                  logger.log(`[DOM] Added data date: ${aboutData.dataDate}`);
             }

            aboutData.content?.forEach(paragraph => {
                try {
                    const p = document.createElement('p');
                    p.innerHTML = paragraph; // Use innerHTML for allowed HTML tags (assuming trusted source)
                    aboutContainer.appendChild(p);
                } catch (e) {
                     logger.error(`[DOM] Error adding paragraph from about content: ${e.message}`, e);
                }
            });
             // Add specific note about calendar/diagonal plots
             const noteDiv = document.createElement('div');
             noteDiv.className = 'info-message'; // Use the predefined info message class
             noteDiv.innerHTML = "<strong>Note on Multi-Expiry Plots:</strong> Payoff diagrams for Calendar and Diagonal spreads on this page represent the theoretical Profit/Loss at the expiration of the <strong>near-term option</strong>. Calculating the exact value of the longer-term option at that time requires a full options pricing model, which is not included here. The plots use a simplified proxy for the longer-term option's time value.";
             aboutContainer.appendChild(noteDiv);
             logger.log("[DOM] Added multi-expiry note.");

            aboutContainer.style.display = 'block'; // Make the section visible
             logger.log("[DOM] About section rendering complete.");

        } catch (e) {
             logger.error(`[DOM] Error rendering About section: ${e.message}`, e);
             aboutContainer.innerHTML = `<p class="error-message">Error rendering About section content: ${e.message}</p>`;
             aboutContainer.style.display = 'block';
        }
    }

    /** Renders a section containing multiple strategy details. */
    function renderStrategySection(sectionKey) {
        logger.log(`[DOM] Rendering strategy section: ${sectionKey}`);
        clearContentSections(); // Clear all sections first
        const sectionContainer = DOM.sectionContainers[sectionKey]; // Get the specific section container
        if (!sectionContainer) {
             logger.error(`[DOM] Container for section ${sectionKey} not found.`);
             return; // Should not happen with fixed section divs
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

        try {
            // Add section title and description
            const titleElement = document.createElement('h2');
            titleElement.textContent = title;
            sectionContainer.appendChild(titleElement);
             logger.log(`[DOM] Added section title: "${title}"`);

            if (description) {
                const descElement = document.createElement('p');
                descElement.textContent = description;
                sectionContainer.appendChild(descElement);
                 logger.log(`[DOM] Added section description.`);
            }

            if (strategies.length > 0) {
                 logger.log(`[DOM] Found ${strategies.length} strategies for section "${sectionKey}". Rendering...`);
                strategies.forEach(strategy => {
                    try {
                        const detailPanel = createStrategyDetailPanel(strategy, sectionKey); // Pass sectionKey here
                        sectionContainer.appendChild(detailPanel);
                        logger.log(`[DOM] Added panel for strategy: ${strategy.name || strategy.id}`);


                        // --- Setup Input Listeners and Initial Plot ---
                        // Use event delegation on the panel for efficiency
                        detailPanel.addEventListener('input', (event) => {
                             // Check if the input is inside the strategy-inputs section
                             if (event.target.closest('.strategy-inputs')) {
                                 logger.log(`[Event] Input detected in panel for strategy: ${strategy.id}. Replotting.`);
                                 replotStrategy(strategy);
                             }
                        });
                        logger.log(`[DOM] Attached input listener for strategy: ${strategy.id}`);


                        // Plot the chart initially after it's in the DOM
                        logger.log(`[Plot] Initiating initial plot for strategy: ${strategy.id}`);
                        replotStrategy(strategy);

                    } catch (e) {
                        logger.error(`[DOM] Error rendering detail panel for strategy "${strategy.name || strategy.id}": ${e.message}`, e);
                        // Add an error message to the section container
                        const errorDiv = document.createElement('div');
                         errorDiv.className = 'error-message';
                         errorDiv.textContent = `Error rendering strategy "${strategy.name || strategy.id}": ${e.message}`;
                         sectionContainer.appendChild(errorDiv);
                    }
                });
                logger.log(`[DOM] Strategy rendering complete for section "${sectionKey}".`);
            } else {
                logger.log(`[DOM] No strategies found for section "${sectionKey}".`);
                const infoMsg = document.createElement('p');
                infoMsg.className = 'info-message';
                infoMsg.textContent = 'No strategies available for this section in the loaded data.';
                sectionContainer.appendChild(infoMsg);
            }
             // Ensure the current section container is visible after rendering
             sectionContainer.style.display = 'block';
             logger.log(`[DOM] Section container "${sectionKey}" set to display: block.`);

        } catch (e) {
             logger.error(`[DOM] Error rendering strategy section "${sectionKey}" overall: ${e.message}`, e);
             sectionContainer.innerHTML = `<p class="error-message">Error rendering section content: ${e.message}</p>`;
             sectionContainer.style.display = 'block';
        }
    }

    /** Creates the HTML elements for a single strategy's detail panel including inputs. */
    function createStrategyDetailPanel(strategy, sectionKey) { // Added sectionKey param
        logger.log(`[DOM] Creating detail panel for strategy: ${strategy.id || strategy.name}`);
        const panel = document.createElement('div');
        panel.className = 'w3-panel w3-card-4 strategy-panel';
        panel.dataset.strategyId = strategy.id || strategy.name; // Use ID if available
        panel.dataset.sectionKey = sectionKey; // Add section key for potential CSS

        // Helper to create a paragraph with optional strong title
        const createDetailHtml = (content, title) => {
            if (!content) return '';
            // Use innerHTML to allow simple formatting like strong/em if present in JSON (assuming trusted source)
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

        try {
            // Handle complex legs parameter separately if it exists
            if (strategy.parameters && strategy.parameters.legs && Array.isArray(strategy.parameters.legs)) {
                 inputFieldsHTML += '<p><i>Adjust parameters for each leg below:</i></p>';
                 strategy.parameters.legs.forEach((leg, index) => {
                      try {
                          inputFieldsHTML += `<h4 class="w3-border-bottom w3-padding-small w3-margin-top w3-margin-bottom">Leg ${index + 1} (${leg.position.charAt(0).toUpperCase() + leg.position.slice(1)} ${leg.type.charAt(0).toUpperCase() + leg.type.slice(1)})</h4>`;
                          for (const paramName in leg) {
                              const paramValue = leg[paramName];
                              // Only create inputs for 'strike' and 'premium' for complex legs for simplicity
                              if (paramName !== 'strike' && paramName !== 'premium') continue;

                              const paramType = typeof paramValue === 'number' ? 'number' : 'text';
                              const stepAttribute = paramType === 'number' ? 'step="any"' : '';
                              const valueAttribute = paramType === 'number' ? `value="${paramValue.toFixed(2)}"` : `value="${paramValue}"`;
                              // Unique ID for complex legs input
                              const inputId = `${strategy.id}-leg${index}-${paramName}-input`;

                               const labelText = paramName.charAt(0).toUpperCase() + paramName.slice(1);


                              inputFieldsHTML += `
                                  <div class="w3-col s6 m4 l3 w3-padding-small">
                                      <label for="${inputId}">Leg ${index + 1} ${labelText}:</label>
                                      <input id="${inputId}" class="w3-input w3-border w3-round-small" type="${paramType}" ${stepAttribute} ${valueAttribute}>
                                  </div>
                               `;
                          }
                      } catch (e) {
                           logger.error(`[DOM] Error creating inputs for complex strategy leg ${index} of "${strategy.id}": ${e.message}`, e);
                           inputFieldsHTML += `<p class="error-message w3-col s12">Error rendering inputs for leg ${index + 1}.</p>`;
                      }
                 });

            } else if (strategy.parameters) { // Handle standard parameters (1-4 legs)
                 for (const paramName in strategy.parameters) {
                      try {
                          const paramValue = strategy.parameters[paramName];
                          // Skip plotting internal type/position flags for simple strategies
                          if (paramName === 'type' || paramName === 'position') continue;

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
                              .replace('Ratio1', 'Ratio 1').replace('Ratio2', 'Ratio 2')
                              .replace('StockPrice', 'Stock Price');


                          inputFieldsHTML += `
                              <div class="w3-col s6 m4 l3 w3-padding-small">
                                  <label for="${inputId}">${labelText}:</label>
                                  <input id="${inputId}" class="w3-input w3-border w3-round-small" type="${paramType}" ${stepAttribute} ${valueAttribute}>
                              </div>
                           `;
                      } catch (e) {
                           logger.error(`[DOM] Error creating input "${paramName}" for strategy "${strategy.id}": ${e.message}`, e);
                           inputFieldsHTML += `<p class="error-message w3-col s12">Error rendering input "${paramName}".</p>`;
                      }
                 }
            } else {
                 logger.warn(`[DOM] Strategy "${strategy.id}" has no parameters defined.`);
                 inputFieldsHTML += '<p class="w3-col s12">No parameters defined for this strategy.</p>';
            }


        } catch (e) {
             logger.error(`[DOM] Error building input fields HTML for strategy "${strategy.id}": ${e.message}`, e);
             inputFieldsHTML += `<p class="error-message w3-col s12">Error building parameter inputs.</p>`;
        } finally {
             inputFieldsHTML += '</div></div>'; // Ensure container div is closed even on error
        }


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
         logger.log(`[DOM] Detail panel HTML created for "${strategy.id}".`);
        return panel;
    }


    /** Selects and renders the appropriate content based on appState.currentSection */
    function renderCurrentSection() {
        logger.log(`[UI] Attempting to render section: ${appState.currentSection}`);
        updateStatusMessage(); // Show loading/error state if applicable
        updateStatusIndicators();

        // Hide all section containers first
        Object.values(DOM.sectionContainers).forEach(container => {
             if (container) container.style.display = 'none';
        });
        logger.log("[UI] All section containers hidden.");


        if (appState.isLoading || (!appState.strategyData && !appState.error)) {
            // If loading or no data/error yet, show only status message area
            // Content sections are already hidden by clearContentSections
             logger.log("[UI] App is loading or no data/error. Only status message shown.");
            return;
        }
         if (!appState.strategyData && appState.error) {
             // If error and no data, status message is already shown, content area remains empty
             logger.log("[UI] App has an error and no data. Only status message shown.");
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
                     logger.warn(`[UI] No valid data found for section: "${appState.currentSection}". Showing About.`);
                     appState.currentSection = 'about';
                     renderAboutSection(); // Recurse to render about
                 }
                break;
            default:
                logger.warn(`[UI] Unknown section requested: "${appState.currentSection}". Showing About.`);
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
             logger.log(`[Analytics] GA event: page_view sent for section "${appState.currentSection}".`);
        }
    }

    /** Updates the 'active' class on sidebar links. */
    function updateSidebarActiveState() {
        try {
            const links = DOM.sidebarLinks.querySelectorAll('.nav-link');
            links.forEach(link => {
                if (link.dataset.section === appState.currentSection) {
                    link.classList.add('active');
                    logger.log(`[UI] Marked sidebar link active: ${link.dataset.section}`);
                } else {
                    link.classList.remove('active');
                }
            });
        } catch (e) {
             logger.error(`[UI] Error updating sidebar active state: ${e.message}`, e);
        }
    }


    /**
     * ========================================================================
     * Event Handlers
     * ========================================================================
     */

    /** Handles clicks on sidebar navigation links. */
    function handleNavLinkClick(event) {
        try {
            event.preventDefault(); // Prevent default anchor behavior
            const section = event.target.dataset.section;
            logger.log(`[Event] Nav link clicked for section: ${section}`);
            // Use window.location.hash for navigation state, which also handles browser history
            if (section && section !== appState.currentSection) { // Only update hash if section is different
                 window.location.hash = section;
                 // The 'hashchange' listener will pick this up and call renderCurrentSection
                 logger.log(`[Event] Updated window.location.hash to #${section}.`);
            } else if (section === appState.currentSection) {
                 logger.log(`[Event] Clicked link for current section (${section}).`);
                 // If clicking the current section link, just close sidebar on small screens
                 if (window.innerWidth <= 992) {
                      w3_close();
                      logger.log("[Event] Closed sidebar on small screen.");
                 }
            } else {
                 // Handle cases where section is undefined or somehow invalid
                 logger.warn("[Event] Clicked navigation link with no valid section data-attribute.");
            }
        } catch (e) {
             logger.error(`[Event] Error handling nav link click: ${e.message}`, e);
        }
    }


    /** Handles click on the "Add to Calendar" placeholder button (uses event delegation). */
    function handleCalendarButtonClick(event) {
        try {
             const button = event.target.closest('.calendar-button');
             if (button) {
                 const strategyName = button.dataset.strategyName || 'Unknown Strategy';
                 logger.log(`[Event] Calendar button clicked for: ${strategyName}`);
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
        } catch (e) {
             logger.error(`[Event] Error handling calendar button click: ${e.message}`, e);
        }
    }

    /** Handles click on the "Refresh Data" button. */
    function handleRefreshDataClick() {
        logger.log("[Event] Refresh data button clicked.");
        if (appState.isOffline) {
            logger.warn("[Event] Cannot refresh data while offline.");
            updateStatusMessageInternal("Cannot refresh data while offline.", "offline-message");
            return;
        }
        if (appState.isLoading) {
            logger.warn("[Event] Already loading data, refresh request ignored.");
            return;
        }
        initializeApp(true); // Trigger forced refresh
    }

    /** Updates network status and triggers data reload if necessary. */
    function updateNetworkStatus() {
        try {
            const wasOffline = appState.isOffline;
            appState.isOffline = !navigator.onLine;
            logger.log(`[Net] Network status changed: ${appState.isOffline ? 'OFFLINE' : 'ONLINE'}`);
            updateStatusIndicators(); // Update header indicator immediately
            DOM.refreshDataButton.disabled = appState.isOffline || appState.isLoading; // Update button state

            // If we just came online and we don't have Network data currently, try fetching fresh data
            if (wasOffline && !appState.isOffline && appState.dataSource !== 'Network') {
                logger.info("[Net] Network connection restored, attempting to fetch fresh data.");
                initializeApp(true); // Force data refresh on reconnect
            } else if (appState.isOffline && !appState.strategyData) {
                 logger.log("[Net] Went offline and have no data. Triggering render.");
                 // If we just went offline and have no data at all, trigger a render
                 renderCurrentSection(); // Shows the offline message
            }
        } catch (e) {
             logger.error(`[Net] Error updating network status: ${e.message}`, e);
        }
    }

     /** Helper for internal status message updates without full re-render */
     function updateStatusMessageInternal(message, className) {
        try {
             DOM.statusMessageArea.innerHTML = ''; // Clear previous
             if (message) {
                 const msgDiv = document.createElement('div');
                 msgDiv.className = `status-message ${className}`;
                 msgDiv.textContent = message;
                 DOM.statusMessageArea.appendChild(msgDiv);
                 logger.log(`[UI] Displaying internal status message: "${message}"`);
             } else {
                 logger.log("[UI] No internal status message to display.");
             }
        } catch (e) {
             logger.error(`[UI] Error updating internal status message: ${e.message}`, e);
        }
     }


    /**
     * ========================================================================
     * Data Loading Orchestration
     * ========================================================================
     */

    /** Main data initialization function */
    async function initializeApp(forceRefresh = false) {
        logger.log(`[Init] Initializing App. Force refresh: ${forceRefresh}`);
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
             openDB().catch(err => { logger.warn("[Init] Initial DB open attempt failed:", err); dbConnectionError = err; });


            // 2. Attempt Fetch if Online (or forced refresh)
            if (!appState.isOffline || forceRefresh) {
                logger.info("[Init] Attempting to fetch data from network...");
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
                    logger.log("[Init] Fetch successful.");
                    loadedData = networkData;
                    source = 'Network';

                    // Asynchronously save/cache the fresh data if possible
                    if (appState.dbConnection) { // Check if connection is ready
                        saveDataToDB(loadedData).catch(err => logger.error("[Init] Background DB save failed:", err));
                    } else {
                         // If DB connection wasn't ready yet, try again after a short delay
                         setTimeout(() => {
                             if (appState.dbConnection) saveDataToDB(loadedData).catch(err => logger.error("[Init] Delayed background DB save failed:", err));
                         }, 500); // Delay slightly to allow DB to connect
                    }
                    cacheDataResponse(STRATEGIES_JSON_URL, loadedData).catch(err => logger.error("[Init] Background Cache save failed:", err));

                } catch (e) {
                    logger.warn(`[Init] Fetch failed: ${e.message}.`);
                    fetchError = e; // Store fetch error
                }
            } else {
                logger.info("[Init] App is offline or refresh not forced. Skipping network fetch.");
                 // Record timestamp of attempt even if skipping
                 appState.lastFetchTimestamp = new Date();
            }

             // 3. Attempt Cache API if Network Failed or Skipped
             if (!loadedData) {
                  logger.info("[Init] Attempting to load data from Cache API...");
                  try {
                       const cacheData = await loadDataFromCache(STRATEGIES_JSON_URL);
                       if (cacheData) {
                           logger.log("[Init] Data loaded from Cache API.");
                           loadedData = cacheData;
                           source = 'Cache';
                       } else {
                            logger.info("[Init] No data found in Cache API.");
                       }
                  } catch (e) {
                       logger.warn(`[Init] Cache load failed: ${e.message}.`);
                       cacheError = e; // Store cache error
                  }
             }

            // 4. Attempt IndexedDB if Network/Cache Failed and DB is available
            if (!loadedData && appState.dbConnection) { // Check appState.dbConnection directly now
                logger.info("[Init] Attempting to load data from IndexedDB...");
                 try {
                    const dbData = await loadDataFromDB();
                    if (dbData) {
                        logger.log("[Init] Data loaded from IndexedDB.");
                        loadedData = dbData;
                        source = 'IndexedDB';
                    } else {
                         logger.info("[Init] No data found in IndexedDB.");
                    }
                 } catch (e) {
                      logger.warn(`[Init] IndexedDB load failed: ${e.message}.`);
                      dbLoadError = e; // Store DB load error
                 }
            } else if (!loadedData && (dbConnectionError || !window.indexedDB)) {
                 // If DB wasn't even connectable/supported and no data loaded yet
                 logger.warn("[Init] Cannot load from IndexedDB - connection not available or supported.");
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
                logger.error("[Init] Final data loading failure.", appState.error);

            } else {
                 // Data successfully loaded from one of the sources
                 appState.strategyData = loadedData;
                 appState.dataSource = source;
                 appState.error = null; // Clear any lingering error messages from failed attempts
                 logger.info(`[Init] Data loaded successfully from ${source}.`);
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
            logger.error("[Init] Unhandled Critical Initialization Error:", initError);
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
```
