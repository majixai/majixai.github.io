// services/sqliteService.js
// sql.js needs to be available globally, e.g., via CDN, and attached to window.initSqlJs
import {
    AI_INTERACTIONS_TABLE_NAME, SQLITE_DB_FILE_KEY, SINGLE_ITEM_KEY as SINGLE_ITEM_KEY_CONST,
    FMP_PROFILES_TABLE_NAME, FMP_QUOTES_TABLE_NAME
} from '../constants.js'; // Assuming .js extension
import {
    // PlotOptions, OptionLeg, AppDBState, GitHubExportSettings,
    // HistoricalBullishSuggestionEntry, AIInteractionLogEntry, AICallType,
    // OptionType, Action, FMPProfile, FMPQuote // These are effectively JSDoc types
} from '../types.js'; // Assuming .js extension
import { saveSQLiteDBFile, loadSQLiteDBFile } from './indexedDBService.js'; // Assuming .js

let db = null;
/** @type {Promise<any> | null} */
let sqlJsInstancePromise = null;

/**
 * @param {any} data
 * @returns {string | null}
 */
const serializeComplex = (data) => {
    if (data === undefined || data === null) return null;
    try {
        return JSON.stringify(data);
    } catch (e) {
        console.error("Serialization error:", e);
        return null;
    }
};

/**
 * @template T
 * @param {string | null | undefined} jsonString
 * @returns {T | null}
 */
const deserializeComplex = (jsonString) => {
    if (jsonString === undefined || jsonString === null) return null;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Deserialization error:", e, "String was:", jsonString);
        return null;
    }
};

async function getSqlJs() {
    if (sqlJsInstancePromise) return sqlJsInstancePromise;

    sqlJsInstancePromise = new Promise(async (resolve, reject) => {
        let initSqlJsFunction = window.initSqlJs;

        if (!initSqlJsFunction) {
            console.warn("sql.js not immediately available on window.initSqlJs. Retrying for a short period...");
            let attempts = 0;
            const maxAttempts = 20;

            const tryToInitialize = async () => {
                initSqlJsFunction = window.initSqlJs;
                if (initSqlJsFunction) {
                    try {
                        const instance = await initSqlJsFunction({ locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}` });
                        resolve(instance);
                    } catch (e) {
                        reject(e);
                    }
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(tryToInitialize, 100);
                } else {
                    reject(new Error("sql.js failed to load on window.initSqlJs after multiple attempts."));
                }
            };
            await tryToInitialize();
        } else {
            try {
                const instance = await initSqlJsFunction({ locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}` });
                resolve(instance);
            } catch (e) {
                reject(e);
            }
        }
    });
    return sqlJsInstancePromise;
}

export const initSqlJsDb = async () => {
    if (db) return true;
    try {
        const sqlJs = await getSqlJs();

        const dbFile = await loadSQLiteDBFile();
        if (dbFile) {
            db = new sqlJs.Database(dbFile);
            console.log("SQLite DB loaded from IndexedDB.");
        } else {
            db = new sqlJs.Database();
            console.log("New SQLite DB created.");
        }

        db.exec(`
            CREATE TABLE IF NOT EXISTS plot_options (
                id TEXT PRIMARY KEY, underlyingName TEXT, currentS TEXT, pointValue TEXT, minST TEXT,
                maxST TEXT, numPoints TEXT, showIndividualLegs INTEGER, initialTTEForSimulation REAL,
                simulationSigma TEXT, simulationR TEXT
            );
            CREATE TABLE IF NOT EXISTS option_legs (
                id TEXT PRIMARY KEY, type TEXT, action TEXT, strike TEXT, premium TEXT, quantity TEXT,
                role TEXT, premiumMissing INTEGER
            );
            CREATE TABLE IF NOT EXISTS app_state (
                id TEXT PRIMARY KEY, selectedStrategyName TEXT, showBlackScholes INTEGER,
                currentAIStrategySuggestions TEXT, lastUnderlyingForStrategySuggestions TEXT,
                currentAIBullishStockSuggestions TEXT, lastFetchedBullishStocksTimestamp INTEGER,
                allAccumulatedAISources TEXT, activeInsightTab TEXT, aiCallDurations TEXT,
                showAnalyticsPanel INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS github_settings (
                id TEXT PRIMARY KEY, pat TEXT, username TEXT, repoName TEXT, filePath TEXT
            );
            CREATE TABLE IF NOT EXISTS historical_bullish_suggestions (
                id TEXT PRIMARY KEY, ticker TEXT, priceAtSuggestion REAL, initialTimestamp INTEGER,
                projectedPriceChangePercentMin REAL, projectedPriceChangePercentMax REAL,
                projectedTimeline TEXT, priceCategory TEXT, outlookHorizon TEXT, reasoning TEXT,
                detailedReasoning TEXT, analysisTimestamp INTEGER, priceProjectionDetails TEXT
            );
            CREATE TABLE IF NOT EXISTS ${AI_INTERACTIONS_TABLE_NAME} (
                id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL, call_type TEXT NOT NULL,
                underlying_name TEXT, strategy_name TEXT, fmp_data_used INTEGER DEFAULT 0,
                prompt_token_count INTEGER, candidates_token_count INTEGER, total_token_count INTEGER,
                error_present INTEGER DEFAULT 0, duration_ms INTEGER
            );
            CREATE TABLE IF NOT EXISTS ${FMP_PROFILES_TABLE_NAME} (
                symbol TEXT PRIMARY KEY, data TEXT, timestamp INTEGER
            );
            CREATE TABLE IF NOT EXISTS ${FMP_QUOTES_TABLE_NAME} (
                symbol TEXT PRIMARY KEY, data TEXT, timestamp INTEGER
            );
        `);
        console.log(`SQLite tables ensured, including FMP tables.`);
        return true;
    } catch (error) {
        console.error("Failed to initialize SQLite DB:", error);
        db = null;
        sqlJsInstancePromise = null;
        return false;
    }
};

const persistSQLiteDB = async () => {
    if (!db) {
      const initialized = await initSqlJsDb();
      if (!initialized || !db) {
        console.error("Cannot persist: SQLite DB not initialized.");
        return;
      }
    }
    const binaryArray = db.export();
    await saveSQLiteDBFile(binaryArray);
};

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * @param {Omit<import('../types.js').AIInteractionLogEntry, 'id' | 'timestamp'>} logEntry
 * @returns {Promise<void>}
 */
export const logAIInteraction = async (logEntry) => {
    if (!db) {
        const initialized = await initSqlJsDb();
        if (!initialized || !db) {
            console.error("SQLite DB not initialized, cannot log AI interaction."); return;
        }
    }
    /** @type {import('../types.js').AIInteractionLogEntry} */
    const entry = { id: generateUUID(), timestamp: Date.now(), ...logEntry };
    try {
        db.run(`INSERT INTO ${AI_INTERACTIONS_TABLE_NAME} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ entry.id, entry.timestamp, entry.call_type, entry.underlying_name || null,
              entry.strategy_name || null, entry.fmp_data_used ? 1 : 0, entry.prompt_token_count || null,
              entry.candidates_token_count || null, entry.total_token_count || null,
              entry.error_present ? 1 : 0, entry.duration_ms ]);
        await persistSQLiteDB();
    } catch (error) { console.error("Error logging AI interaction to SQLite:", error); }
};

/**
 * @param {import('../types.js').PlotOptions} options
 * @returns {Promise<void>}
 */
export const savePlotOptionsToSQLite = async (options) => {
    if (!db) { await initSqlJsDb(); if (!db) return; }
    db.run("INSERT OR REPLACE INTO plot_options VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        options.id, options.underlyingName, options.currentS, options.pointValue, options.minST,
        options.maxST, options.numPoints, options.showIndividualLegs ? 1 : 0,
        options.initialTTEForSimulation, options.simulationSigma, options.simulationR
    ]);
    await persistSQLiteDB();
};

/**
 * @returns {Promise<import('../types.js').PlotOptions | undefined>}
 */
export const getPlotOptionsFromSQLite = async () => {
    if (!db) { await initSqlJsDb(); if (!db) return undefined; }
    const stmt = db.prepare("SELECT * FROM plot_options WHERE id = ?");
    const result = stmt.getAsObject({ '?': SINGLE_ITEM_KEY_CONST });
    stmt.free();
    if (result.id) {
        // @ts-ignore
        return { ...result, showIndividualLegs: Boolean(result.showIndividualLegs) };
    }
    return undefined;
};

/**
 * @param {import('../types.js').OptionLeg[]} legs
 * @returns {Promise<void>}
 */
export const saveLegsToSQLite = async (legs) => {
    if (!db) { await initSqlJsDb(); if (!db) return; }
    db.exec("DELETE FROM option_legs");
    legs.forEach(leg => {
        db.run("INSERT INTO option_legs VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
            leg.id, leg.type, leg.action, leg.strike, leg.premium, leg.quantity, leg.role, leg.premiumMissing ? 1 : 0
        ]);
    });
    await persistSQLiteDB();
};

/**
 * @returns {Promise<import('../types.js').OptionLeg[]>}
 */
export const getLegsFromSQLite = async () => {
    if (!db) { await initSqlJsDb(); if (!db) return []; }
    const results = db.exec("SELECT * FROM option_legs");
    if (results.length > 0 && results[0].values) {
        return results[0].values.map((row) => ({
            id: row[0], type: row[1], action: row[2],
            strike: row[3], premium: row[4], quantity: row[5],
            role: row[6], premiumMissing: Boolean(row[7])
        }));
    }
    return [];
};

/**
 * @param {import('../types.js').AppDBState} state
 * @returns {Promise<void>}
 */
export const saveAppStateToSQLite = async (state) => {
    if (!db) { await initSqlJsDb(); if (!db) return; }
    db.run("INSERT OR REPLACE INTO app_state VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        state.id, state.selectedStrategyName, state.showBlackScholes ? 1 : 0,
        serializeComplex(state.currentAIStrategySuggestions),
        state.lastUnderlyingForStrategySuggestions,
        serializeComplex(state.currentAIBullishStockSuggestions),
        state.lastFetchedBullishStocksTimestamp,
        serializeComplex(state.allAccumulatedAISources),
        state.activeInsightTab,
        serializeComplex(state.aiCallDurations),
        state.showAnalyticsPanel ? 1 : 0
    ]);
    await persistSQLiteDB();
};

/**
 * @returns {Promise<import('../types.js').AppDBState | undefined>}
 */
export const getAppStateFromSQLite = async () => {
    if (!db) { await initSqlJsDb(); if (!db) return undefined; }
    const stmt = db.prepare("SELECT * FROM app_state WHERE id = ?");
    const result = stmt.getAsObject({ '?': SINGLE_ITEM_KEY_CONST });
    stmt.free();
    if (result.id) {
        // @ts-ignore
        return {
            ...result,
            showBlackScholes: Boolean(result.showBlackScholes),
            currentAIStrategySuggestions: deserializeComplex(result.currentAIStrategySuggestions),
            currentAIBullishStockSuggestions: deserializeComplex(result.currentAIBullishStockSuggestions),
            allAccumulatedAISources: deserializeComplex(result.allAccumulatedAISources),
            aiCallDurations: deserializeComplex(result.aiCallDurations),
            showAnalyticsPanel: Boolean(result.showAnalyticsPanel)
        };
    }
    return undefined;
};

/**
 * @param {import('../types.js').HistoricalBullishSuggestionEntry} suggestion
 * @returns {Promise<void>}
 */
export const saveHistoricalBullishSuggestionToSQLite = async (suggestion) => {
    if (!db) { await initSqlJsDb(); if (!db) return; }
    db.run("INSERT OR REPLACE INTO historical_bullish_suggestions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        suggestion.id, suggestion.ticker, suggestion.priceAtSuggestion, suggestion.initialTimestamp,
        suggestion.projectedPriceChangePercentMin, suggestion.projectedPriceChangePercentMax,
        suggestion.projectedTimeline, suggestion.priceCategory, suggestion.outlookHorizon,
        suggestion.reasoning || null, suggestion.detailedReasoning || null,
        suggestion.analysisTimestamp || null, serializeComplex(suggestion.priceProjectionDetails)
    ]);
    await persistSQLiteDB();
};

/**
 * @returns {Promise<import('../types.js').HistoricalBullishSuggestionEntry[]>}
 */
export const getHistoricalBullishSuggestionsFromSQLite = async () => {
    if (!db) { await initSqlJsDb(); if (!db) return []; }
    const results = db.exec("SELECT * FROM historical_bullish_suggestions ORDER BY initialTimestamp DESC");
    if (results.length > 0 && results[0].values) {
        return results[0].values.map((row) => ({
            id: row[0], ticker: row[1], priceAtSuggestion: row[2],
            initialTimestamp: row[3], projectedPriceChangePercentMin: row[4],
            projectedPriceChangePercentMax: row[5], projectedTimeline: row[6],
            priceCategory: row[7], outlookHorizon: row[8], reasoning: row[9],
            detailedReasoning: row[10], analysisTimestamp: row[11],
            priceProjectionDetails: deserializeComplex(row[12])
        }));
    }
    return [];
};

/**
 * @param {import('../types.js').GitHubExportSettings} settings
 * @returns {Promise<void>}
 */
export const saveGitHubSettingsToSQLite = async (settings) => {
    if (!db) { await initSqlJsDb(); if (!db) return; }
    db.run("INSERT OR REPLACE INTO github_settings VALUES (?, ?, ?, ?, ?)", [
        settings.id, settings.pat, settings.username, settings.repoName, settings.filePath
    ]);
    await persistSQLiteDB();
};

/**
 * @returns {Promise<import('../types.js').GitHubExportSettings | undefined>}
 */
export const getGitHubSettingsFromSQLite = async () => {
    if (!db) { await initSqlJsDb(); if (!db) return undefined; }
    const stmt = db.prepare("SELECT * FROM github_settings WHERE id = ?");
    const result = stmt.getAsObject({ '?': SINGLE_ITEM_KEY_CONST });
    stmt.free();
    // @ts-ignore
    return result.id ? result : undefined;
};

/**
 * @param {string} symbol
 * @param {import('../types.js').FMPProfile} profile
 * @param {number} timestamp
 * @returns {Promise<void>}
 */
export const saveFMPProfileToSQLite = async (symbol, profile, timestamp) => {
    if (!db) { await initSqlJsDb(); if (!db) return; }
    db.run(`INSERT OR REPLACE INTO ${FMP_PROFILES_TABLE_NAME} (symbol, data, timestamp) VALUES (?, ?, ?)`,
        [symbol, serializeComplex(profile), timestamp]);
    await persistSQLiteDB();
};

/**
 * @param {string} symbol
 * @returns {Promise<import('../types.js').FMPProfile | null>}
 */
export const getFMPProfileFromSQLite = async (symbol) => {
    if (!db) { await initSqlJsDb(); if (!db) return null; }
    const stmt = db.prepare(`SELECT data FROM ${FMP_PROFILES_TABLE_NAME} WHERE symbol = ?`);
    const result = stmt.getAsObject({ '?': symbol });
    stmt.free();
    // @ts-ignore
    return result.data ? deserializeComplex(result.data) : null;
};

/**
 * @param {string} symbol
 * @param {import('../types.js').FMPQuote} quote
 * @param {number} timestamp
 * @returns {Promise<void>}
 */
export const saveFMPQuoteToSQLite = async (symbol, quote, timestamp) => {
    if (!db) { await initSqlJsDb(); if (!db) return; }
    db.run(`INSERT OR REPLACE INTO ${FMP_QUOTES_TABLE_NAME} (symbol, data, timestamp) VALUES (?, ?, ?)`,
        [symbol, serializeComplex(quote), timestamp]);
    await persistSQLiteDB();
};

/**
 * @param {string} symbol
 * @returns {Promise<import('../types.js').FMPQuote | null>}
 */
export const getFMPQuoteFromSQLite = async (symbol) => {
    if (!db) { await initSqlJsDb(); if (!db) return null; }
    const stmt = db.prepare(`SELECT data FROM ${FMP_QUOTES_TABLE_NAME} WHERE symbol = ?`);
    const result = stmt.getAsObject({ '?': symbol });
    stmt.free();
    // @ts-ignore
    return result.data ? deserializeComplex(result.data) : null;
};

/**
 * @returns {Uint8Array | null}
 */
export const getDatabaseFile = () => {
    if (!db) {
      console.warn("Attempted to get database file before DB was initialized.");
      return null;
    }
    return db.export();
};
