// services/indexedDBService.js
// For pure JS, 'idb' would need to be available globally, e.g., via CDN.
// We'll assume `window.idb` provides `openDB`.
// const { openDB } from 'idb'; // This line is problematic for no-build browser JS.

import {
    DB_NAME, DB_VERSION, PLOT_OPTIONS_STORE_NAME, LEGS_STORE_NAME,
    APP_STATE_STORE_NAME, GITHUB_SETTINGS_STORE_NAME, HISTORICAL_BULLISH_SUGGESTIONS_STORE_NAME,
    SQLITE_DB_STORE_NAME, FMP_CACHE_STORE_NAME, FMP_HISTORICAL_CACHE_STORE_NAME, USER_TRADES_STORE_NAME,
    SINGLE_ITEM_KEY, SQLITE_DB_FILE_KEY as SQLITE_DB_FILE_KEY_CONST,
    PREDEFINED_STRATEGIES, DEFAULT_POINT_VALUE, DEFAULT_NUM_POINTS
} from '../constants.js'; // Assuming .js extension
import {
    InsightTabKey
    // PlotOptions, OptionLeg, AppDBState, GitHubExportSettings,
    // HistoricalBullishSuggestionEntry, CachedFMPProfile, CachedFMPQuote,
    // FMPCacheHistoricalEntry, FMHistoricalPrice // These are effectively JSDoc types
} from '../types.js'; // Assuming .js extension

/**
 * @typedef {import('idb').DBSchema} DBSchema
 * @typedef {import('idb').IDBPDatabase} IDBPDatabase
 * @typedef {import('idb').StoreNames} StoreNames
 * @typedef {import('idb').StoreKey} StoreKey
 */

/**
 * @typedef {Object} OptionPlotterDB
 * @property {Object} plotOptionsStore
 * @property {string} plotOptionsStore.key
 * @property {import('../types.js').PlotOptions} plotOptionsStore.value
 * @property {Object} legsStore
 * @property {string} legsStore.key
 * @property {import('../types.js').OptionLeg} legsStore.value
 * @property {Object} appStateStore
 * @property {string} appStateStore.key
 * @property {import('../types.js').AppDBState} appStateStore.value
 * @property {Object} githubSettingsStore
 * @property {string} githubSettingsStore.key
 * @property {import('../types.js').GitHubExportSettings} githubSettingsStore.value
 * @property {Object} historicalBullishSuggestionsStore
 * @property {string} historicalBullishSuggestionsStore.key
 * @property {import('../types.js').HistoricalBullishSuggestionEntry} historicalBullishSuggestionsStore.value
 * @property {{ticker: string, initialTimestamp: number}} historicalBullishSuggestionsStore.indexes
 * @property {Object} sqliteDbStore
 * @property {string} sqliteDbStore.key
 * @property {Uint8Array} sqliteDbStore.value
 * @property {Object} fmpCacheStore
 * @property {string} fmpCacheStore.key
 * @property {import('../types.js').CachedFMPProfile | import('../types.js').CachedFMPQuote} fmpCacheStore.value
 * @property {Object} fmpHistoricalCacheStore
 * @property {string} fmpHistoricalCacheStore.key
 * @property {import('../types.js').FMPCacheHistoricalEntry} fmpHistoricalCacheStore.value
 * @property {Object} userTradesStore
 * @property {string} userTradesStore.key // or number if using autoIncrement
 * @property {import('../types.js').UserTrade} userTradesStore.value // Assuming UserTrade type will be defined
 * @extends {DBSchema}
 */

/** @type {Promise<IDBPDatabase<OptionPlotterDB>>} */
let dbPromise;

const initDB = () => {
  if (!dbPromise) {
    if (typeof window === 'undefined' || !window.idb || !window.idb.openDB) {
        console.error("idb library not found on window. Please include it via CDN.");
        // Return a promise that rejects or a mock DB to prevent further errors
        return Promise.reject(new Error("idb library not found."));
    }
    dbPromise = window.idb.openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Upgrading DB from version ${oldVersion} to ${newVersion}`);
        if (oldVersion < 1) {
            if (!db.objectStoreNames.contains(PLOT_OPTIONS_STORE_NAME)) {
            db.createObjectStore(PLOT_OPTIONS_STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(LEGS_STORE_NAME)) {
            db.createObjectStore(LEGS_STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(APP_STATE_STORE_NAME)) {
            db.createObjectStore(APP_STATE_STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(GITHUB_SETTINGS_STORE_NAME)) {
            db.createObjectStore(GITHUB_SETTINGS_STORE_NAME, { keyPath: 'id' });
            }
        }
        if (oldVersion < 2) {
            if (!db.objectStoreNames.contains(HISTORICAL_BULLISH_SUGGESTIONS_STORE_NAME)) {
                const store = db.createObjectStore(HISTORICAL_BULLISH_SUGGESTIONS_STORE_NAME, { keyPath: 'id' });
                store.createIndex('ticker', 'ticker');
                store.createIndex('initialTimestamp', 'initialTimestamp');
            }
        }
        if (oldVersion < 3) {
            if (!db.objectStoreNames.contains(SQLITE_DB_STORE_NAME)) {
                db.createObjectStore(SQLITE_DB_STORE_NAME);
            }
        }
        if (oldVersion < 4) {
            if (!db.objectStoreNames.contains(FMP_CACHE_STORE_NAME)) {
                db.createObjectStore(FMP_CACHE_STORE_NAME, { keyPath: 'id' });
            }
        }
        if (oldVersion < 5) { // New upgrade step for historical cache
            if (!db.objectStoreNames.contains(FMP_HISTORICAL_CACHE_STORE_NAME)) {
                db.createObjectStore(FMP_HISTORICAL_CACHE_STORE_NAME, { keyPath: 'id' });
            }
        }
        // Upgrade for version 6
        if (oldVersion < 6) {
            if (!db.objectStoreNames.contains(USER_TRADES_STORE_NAME)) {
                db.createObjectStore(USER_TRADES_STORE_NAME, { keyPath: 'id' });
            }
        }
      },
    });
  }
  return dbPromise;
};

/**
 * @param {any} value
 * @returns {boolean}
 */
const isPlainEmptyObject = (value) => {
    return value && typeof value === 'object' && Object.keys(value).length === 0 && Object.getPrototypeOf(value) === Object.prototype;
};

/**
 * @template {StoreNames<OptionPlotterDB>} StoreName
 * @param {StoreName} storeName
 * @param {StoreKey<OptionPlotterDB, StoreName>} key
 * @returns {Promise<OptionPlotterDB[StoreName]['value'] | undefined>}
 */
async function getItemFromStore(storeName, key) {
  const db = await initDB();
  return db.get(storeName, key);
}

/**
 * @template {StoreNames<OptionPlotterDB>} StoreName
 * @param {StoreName} storeName
 * @param {OptionPlotterDB[StoreName]['value']} item
 * @param {StoreKey<OptionPlotterDB, StoreName>} [key]
 * @returns {Promise<StoreKey<OptionPlotterDB, StoreName>>}
 */
async function setItemInStore(storeName, item, key) {
  const db = await initDB();
  const keyResult = key !== undefined ? await db.put(storeName, item, key) : await db.put(storeName, item);
  return keyResult;
}

/**
 * @template TValue
 * @param {StoreNames<OptionPlotterDB>} storeName
 * @param {string} key
 * @param {string} typeName
 * @returns {Promise<TValue | undefined>}
 */
async function getStructuredItemFromStore(storeName, key, typeName) {
    const result = await getItemFromStore(storeName, /** @type {any} */ (key));

    if (result === undefined) {
        return undefined;
    }

    if (isPlainEmptyObject(result)) {
        console.warn(`IndexedDB: Retrieved plain empty object for ${typeName} with key '${String(key)}', treating as undefined.`);
        return undefined;
    }

    if (typeof (/** @type {any} */ (result)).id === 'string') {
        return /** @type {TValue} */ (result);
    } else {
        console.warn(`IndexedDB: Retrieved object for ${typeName} with key '${String(key)}' is missing 'id' or has unexpected structure, treating as undefined. Object:`, result);
        return undefined;
    }
}

/** @returns {Promise<import('../types.js').PlotOptions | undefined>} */
export const getPlotOptionsFromDB = async () => {
    return getStructuredItemFromStore(PLOT_OPTIONS_STORE_NAME, SINGLE_ITEM_KEY, "PlotOptions");
};
/**
 * @param {import('../types.js').PlotOptions} options
 * @returns {Promise<string>}
 */
export const savePlotOptionsToDB = async (options) => {
    const itemToSave = {...options, id: SINGLE_ITEM_KEY};
    return /** @type {Promise<string>} */ (setItemInStore(PLOT_OPTIONS_STORE_NAME, itemToSave));
};

/** @returns {Promise<import('../types.js').OptionLeg[]>} */
export const getLegsFromDB = async () => {
  const db = await initDB();
  return db.getAll(LEGS_STORE_NAME);
};

/**
 * @param {import('../types.js').OptionLeg[]} legs
 * @returns {Promise<void>}
 */
export const saveLegsToDB = async (legs) => {
  const db = await initDB();
  const tx = db.transaction(LEGS_STORE_NAME, 'readwrite');
  await tx.objectStore(LEGS_STORE_NAME).clear();
  await Promise.all(legs.map(leg => tx.objectStore(LEGS_STORE_NAME).put(leg)));
  await tx.done;
};

/** @returns {Promise<import('../types.js').AppDBState | undefined>} */
export const getAppStateFromDB = async () => {
    return getStructuredItemFromStore(APP_STATE_STORE_NAME, SINGLE_ITEM_KEY, "AppDBState");
};
/**
 * @param {import('../types.js').AppDBState} state
 * @returns {Promise<string>}
 */
export const saveAppStateToDB = async (state) => {
    const itemToSave = {...state, id: SINGLE_ITEM_KEY};
    return /** @type {Promise<string>} */ (setItemInStore(APP_STATE_STORE_NAME, itemToSave));
};

/** @returns {Promise<import('../types.js').GitHubExportSettings | undefined>} */
export const getGitHubSettingsFromDB = async () => {
    return getStructuredItemFromStore(GITHUB_SETTINGS_STORE_NAME, SINGLE_ITEM_KEY, "GitHubSettings");
};
/**
 * @param {import('../types.js').GitHubExportSettings} settings
 * @returns {Promise<string>}
 */
export const saveGitHubSettingsToDB = async (settings) => {
    const itemToSave = {...settings, id: SINGLE_ITEM_KEY};
    return /** @type {Promise<string>} */ (setItemInStore(GITHUB_SETTINGS_STORE_NAME, itemToSave));
};

/**
 * @param {import('../types.js').HistoricalBullishSuggestionEntry} suggestion
 * @returns {Promise<string>}
 */
export const saveHistoricalBullishSuggestionToDB = async (suggestion) => {
    return /** @type {Promise<string>} */ (setItemInStore(HISTORICAL_BULLISH_SUGGESTIONS_STORE_NAME, suggestion));
};

/** @returns {Promise<import('../types.js').HistoricalBullishSuggestionEntry[]>} */
export const getHistoricalBullishSuggestionsFromDB = async () => {
  const db = await initDB();
  return db.getAll(HISTORICAL_BULLISH_SUGGESTIONS_STORE_NAME);
};

/**
 * @param {string} ticker
 * @returns {Promise<import('../types.js').HistoricalBullishSuggestionEntry[]>}
 */
export const getHistoricalSuggestionsByTickerFromDB = async (ticker) => {
    const db = await initDB();
    return db.getAllFromIndex(HISTORICAL_BULLISH_SUGGESTIONS_STORE_NAME, 'ticker', ticker);
};

/**
 * @param {Uint8Array} dbFile
 * @returns {Promise<string>}
 */
export const saveSQLiteDBFile = async (dbFile) => {
    await setItemInStore(SQLITE_DB_STORE_NAME, dbFile, SQLITE_DB_FILE_KEY_CONST);
    return SQLITE_DB_FILE_KEY_CONST;
};

/** @returns {Promise<Uint8Array | undefined>} */
export const loadSQLiteDBFile = async () => {
    const rawResult = await getItemFromStore(SQLITE_DB_STORE_NAME, SQLITE_DB_FILE_KEY_CONST);

    if (rawResult === undefined) {
        return undefined;
    }

    if (rawResult instanceof Uint8Array) {
        return rawResult;
    }

    console.warn(`IndexedDB: Retrieved non-Uint8Array value for SQLite DB file (key: ${SQLITE_DB_FILE_KEY_CONST}). Type: ${typeof rawResult}. Value:`, rawResult, ". Treating as undefined.");
    return undefined;
};

/**
 * @template T
 * @param {string} cacheKey
 * @returns {Promise<T | undefined>}
 */
export const getFMPCacheFromDB = async (cacheKey) => {
    return getStructuredItemFromStore(FMP_CACHE_STORE_NAME, cacheKey, "FMPCacheEntry");
};

/**
 * @template T
 * @param {T} cacheEntry
 * @returns {Promise<string>}
 */
export const saveFMPCacheToDB = async (cacheEntry) => {
    // @ts-ignore
    return /** @type {Promise<string>} */ (setItemInStore(FMP_CACHE_STORE_NAME, cacheEntry));
};

/**
 * @param {string} cacheKey
 * @returns {Promise<import('../types.js').FMPCacheHistoricalEntry | undefined>}
 */
export const getFMPHistoricalCacheFromDB = async (cacheKey) => {
    return getStructuredItemFromStore(FMP_HISTORICAL_CACHE_STORE_NAME, cacheKey, "FMPHistoricalCacheEntry");
};

/**
 * @param {import('../types.js').FMPCacheHistoricalEntry} cacheEntry
 * @returns {Promise<string>}
 */
export const saveFMPHistoricalCacheToDB = async (cacheEntry) => {
    return /** @type {Promise<string>} */ (setItemInStore(FMP_HISTORICAL_CACHE_STORE_NAME, cacheEntry));
};

/**
 * @returns {Promise<{plotOptions: import('../types.js').PlotOptions, legs: import('../types.js').OptionLeg[], appState: import('../types.js').AppDBState, historicalBullishSuggestions?: import('../types.js').HistoricalBullishSuggestionEntry[], exportedAt: string}>}
 */
export const getAllDataForExport = async () => {
    const plotOptionsData = await getPlotOptionsFromDB();
    const legsData = await getLegsFromDB();
    const appStateData = await getAppStateFromDB();
    const historicalSuggestionsData = await getHistoricalBullishSuggestionsFromDB();

    /** @type {import('../types.js').PlotOptions} */
    const defaultPlotOptions = {
        id: SINGLE_ITEM_KEY,
        underlyingName: 'SPY',
        currentS: '',
        pointValue: DEFAULT_POINT_VALUE,
        minST: '',
        maxST: '',
        numPoints: DEFAULT_NUM_POINTS,
        showIndividualLegs: true,
        initialTTEForSimulation: 45 / 365,
        simulationSigma: '0.20',
        simulationR: '0.05',
    };

    /** @type {import('../types.js').AppDBState} */
    const defaultAppState = {
        id: SINGLE_ITEM_KEY,
        selectedStrategyName: PREDEFINED_STRATEGIES[0].name,
        showBlackScholes: false,
        currentAIStrategySuggestions: null,
        lastUnderlyingForStrategySuggestions: null,
        currentAIBullishStockSuggestions: null,
        lastFetchedBullishStocksTimestamp: null,
        allAccumulatedAISources: null,
        activeInsightTab: InsightTabKey.Status,
        aiCallDurations: {},
        showAnalyticsPanel: false,
    };

    return {
        plotOptions: plotOptionsData || defaultPlotOptions,
        legs: legsData || [],
        appState: appStateData || defaultAppState,
        historicalBullishSuggestions: historicalSuggestionsData || [],
        exportedAt: new Date().toISOString(),
    };
}

initDB().catch(err => console.error("Failed to initialize DB:", err));

/**
 * @param {import('../types.js').UserTrade} trade // Define UserTrade in types.js
 * @returns {Promise<string>} // Or number, depending on key type
 */
export const saveUserTradeToDB = async (trade) => {
    // Ensure trade has a unique id if not auto-generated by IndexedDB
    if (!trade.id) {
        trade.id = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return setItemInStore(USER_TRADES_STORE_NAME, trade);
};

/** @returns {Promise<import('../types.js').UserTrade[]>} */
export const getUserTradesFromDB = async () => {
  const db = await initDB();
  return db.getAll(USER_TRADES_STORE_NAME);
};
