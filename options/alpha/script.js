/**
 * ========================================================================
 * script.js - Advanced Vanilla JS Options Strategy Visualizer V2
 * ========================================================================
 * Date: 2023-10-27
 * Author: [Your Name/AI Generator]
 *
 * Core Logic for the Options Strategy Visualizer. Handles:
 * - State Management (global inputs, strategy data, UI state)
 * - DOM Manipulation & Rendering
 * - Black-Scholes & Binomial Option Pricing
 * - Greeks Calculation (Net & Leg)
 * - Numerical Break-even Point Finding
 * - Plotly Chart Generation (Detailed w/ annotations, shading, legs)
 * - Asynchronous Data Fetching (Fetch API)
 * - Offline Data Persistence (IndexedDB, Cache API)
 * - User Parameter Modification & Persistence (localStorage)
 * - Event Handling for User Interactions
 * - Responsive Sidebar Logic (W3.CSS integration)
 * ========================================================================
 */

"use strict"; // Enforce stricter parsing and error handling

// IIFE (Immediately Invoked Function Expression) to encapsulate the entire application,
// preventing pollution of the global scope and creating a private namespace.
(function () {

    /**
     * ------------------------------------------------------------------------
     * Application State (`appState`)
     * ------------------------------------------------------------------------
     * Central hub for all dynamic data and UI flags. Avoid direct manipulation
     * outside of dedicated state update functions where possible.
     */
    const appState = {
        // --- UI State ---
        currentSection: 'about',        // Active section ID ('about', 'oneLeg', etc.)
        isLoading: true,                // True while fetching/initializing critical data
        error: null,                    // Holds user-facing error messages (string or null)
        infoMessage: null,              // Holds short-lived info messages (string or null)
        isOffline: !navigator.onLine,   // Tracks network connectivity
        bsInputsChangedSinceLastRender: false, // Flag: Have global inputs changed?
        calculationInProgress: false,   // Flag to prevent concurrent calculations

        // --- Data State ---
        strategyDefinitions: null,      // Raw definitions (structure) loaded from JSON/storage
        calculatedStrategies: null,     // Enriched data: Definitions + Overrides + BS/Binomial Results - Drives rendering
        dbConnection: null,             // Active IndexedDB connection
        dataSource: null,               // Source of definitions ('Network', 'Cache', 'IndexedDB', 'Initial', 'None', 'Error')
        lastFetchTimestamp: null,       // Timestamp of last definition fetch attempt

        // --- User Configuration & Overrides ---
        userOverrides: {},              // Stores user mods { strategyId: { quantity: Q, legs: [{strike: K, ivOverride: V}, ...] } }
        pricingModel: 'BS',             // 'BS' or 'Binomial'
        globalInputs: {                 // Global parameters
            underlyingPrice: 5100.00,   // Default /ES
            dte: 30,
            rate: 5.0,                  // %
            vol: 15.0,                  // %
            dividendYield: 0.0,         // % (q)
            binomialSteps: 100          // For Binomial model
        },
        chartSettings: {                // Chart display preferences
             showLegs: false,
             shadeProfitLoss: true
        }
    };

    /**
     * ------------------------------------------------------------------------
     * DOM Element References (`DOM`)
     * ------------------------------------------------------------------------
     * Cache references to frequently accessed DOM elements for performance.
     * Uses optional chaining (?.) to avoid errors if an element isn't found,
     * although critical elements should always exist in the HTML.
     */
    const DOM = {
        // Layout & Navigation
        sidebar: document.getElementById('mySidebar'),
        sidebarLinks: document.getElementById('sidebarLinks'),
        overlay: document.getElementById('myOverlay'),
        closeMenuButton: document.getElementById('closeMenuButton'),
        openMenuButton: document.getElementById('openMenuButton'),
        mainContentArea: document.querySelector('.main-content-area'),
        // Content & Status Display
        contentContainer: document.getElementById('contentContainer'),
        statusMessageArea: document.getElementById('statusMessageArea'),
        statusIndicators: document.getElementById('statusIndicators'),
        lastUpdated: document.getElementById('lastUpdated'),
        // Controls
        refreshDataButton: document.getElementById('refreshDataButton'),
        saveModsButton: document.getElementById('saveUserModsButton'),
        loadModsButton: document.getElementById('loadUserModsButton'),
        clearModsButton: document.getElementById('clearUserModsButton'),
        // Global Inputs
        modelSelector: document.getElementById('pricingModelSelector'),
        globalInputUnderlying: document.getElementById('globalInputUnderlying'),
        globalInputDTE: document.getElementById('globalInputDTE'),
        globalInputRate: document.getElementById('globalInputRate'),
        globalInputVol: document.getElementById('globalInputVol'),
        globalInputDividend: document.getElementById('globalInputDividend'),
        globalInputBinomialSteps: document.getElementById('globalInputBinomialSteps'),
        // Chart Settings (Assuming added to HTML if UI controls desired)
        // chartShowLegsToggle: document.getElementById('chartShowLegsToggle'),
        // chartShadeToggle: document.getElementById('chartShadeToggle'),
    };

    /**
     * ------------------------------------------------------------------------
     * Constants and Configuration
     * ------------------------------------------------------------------------
     */
    const DB_NAME = 'optionStrategyDB_Adv_Vanilla_v1'; // Adv DB name
    const DB_VERSION = 1;
    const STORE_NAME = 'strategyDefsStore_v1';         // Store defs only
    const DATA_KEY = 'allStrategyDefinitionsBlob';     // Key for storing definitions
    const CACHE_NAME = 'option-strategy-defs-cache-vanilla-v2'; // Updated cache name
    const STRATEGIES_JSON_URL = 'strategies.json'; // Expects JSON *without* premiums
    const DAYS_PER_YEAR = 365.25;                      // For annualizing time in BS
    const ES_POINT_VALUE = 50;                         // /ES Futures multiplier ($ per point)
    const PLOT_PRICE_RANGE_FACTOR = 0.20; // % range around current price for plots
    const PLOT_STEPS = 200; // Number of points for plotting curves
    const LOCAL_STORAGE_KEY = 'optionStrategyUserOverrides_v2'; // Key for user modifications
    const NUMERICAL_PRECISION = 0.01; // For breakeven finding, float comparisons
    const MAX_BISECTION_ITERATIONS = 100; // Safety limit for root finder

    /**
     * ------------------------------------------------------------------------
     * Logging Utility
     * ------------------------------------------------------------------------
     * Provides namespaced logging levels for better traceability.
     */
    const logger = {
        log: (...args) => console.log('[App Log]', ...args),
        warn: (...args) => console.warn('[App Warn]', ...args),
        error: (...args) => console.error('[App Error]', ...args),
        info: (...args) => console.info('[App Info]', ...args),
        debug: (...args) => console.debug('[App Debug]', ...args) // Use for detailed step-by-step info
    };

    /**
     * ========================================================================
     * Black-Scholes-Merton Model Implementation
     * ========================================================================
     * Standard European option pricing model.
     */

    /** Cumulative Standard Normal Distribution (CDF) - Abramowitz & Stegun approximation */
    function normCdf(x) {
        // constants for approximation
        const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
        let sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2.0);
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return 0.5 * (1.0 + sign * y);
    }

    /** Standard Normal Probability Density Function (PDF) */
    function normPdf(x) {
        return (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-0.5 * x * x);
    }

    /** Black-Scholes calculation including Greeks and dividend yield (q) */
    function blackScholes(S, K, T, r, v, optionType, q = 0) {
        logger.debug(`BS Input: S=${S}, K=${K}, T=${T.toFixed(4)}, r=${r.toFixed(4)}, v=${v.toFixed(4)}, q=${q.toFixed(4)}, type=${optionType}`);
        // Input validation
        if (isNaN(S) || isNaN(K) || isNaN(T) || isNaN(r) || isNaN(v) || isNaN(q) || S <= 0 || K <= 0 || T < 0 || v <= 0 || r < 0 || q < 0 || (optionType !== 'call' && optionType !== 'put')) {
            logger.warn("Invalid input to Black-Scholes.", {S, K, T, r, v, q, optionType});
            return { error: "Invalid Input" };
        }
        // Handle T=0 case (expiration): return intrinsic value and boundary greeks
        if (T <= 1e-10) {
            logger.debug("BS: T near zero, returning intrinsic value.");
            let intrinsic = (optionType === 'call') ? Math.max(0, S - K) : Math.max(0, K - S);
            let deltaBound = (optionType === 'call' ? (S > K ? 1 : (S < K ? 0 : 0.5)) : (S < K ? -1 : (S > K ? 0 : -0.5)));
            // Note: Gamma/Theta are theoretically infinite at expiry/strike, Vega/Rho are 0. Return practical limits/indicators.
            return { price: intrinsic, delta: deltaBound, gamma: null, vega: 0, theta: null, rho: 0, d1: null, d2: null, error: null };
        }

        const vSqrtT = v * Math.sqrt(T);
        // Prevent division by zero if vol or time is extremely small
        if (Math.abs(vSqrtT) < 1e-10) {
            logger.warn("BS: Volatility or Time too small.");
             let intrinsic = (optionType === 'call') ? Math.max(0, S - K) : Math.max(0, K - S);
             return { price: intrinsic, delta: null, gamma: null, vega: null, theta: null, rho: null, d1: null, d2: null, error: "Near Zero Vol/Time" };
        }

        const d1 = (Math.log(S / K) + (r - q + 0.5 * v * v) * T) / vSqrtT;
        const d2 = d1 - vSqrtT;
        const nD1 = normCdf(d1), nD2 = normCdf(d2), nPrimeD1 = normPdf(d1), nNegD1 = normCdf(-d1), nNegD2 = normCdf(-d2);
        let price, delta, theta, rho;

        try {
            // Calculate Price, Delta, Theta, Rho based on option type
            if (optionType === 'call') {
                price = S * Math.exp(-q * T) * nD1 - K * Math.exp(-r * T) * nD2;
                delta = Math.exp(-q * T) * nD1;
                theta = (- (S * Math.exp(-q * T) * nPrimeD1 * v) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * nD2 + q * S * Math.exp(-q * T) * nD1) / DAYS_PER_YEAR;
                rho = K * T * Math.exp(-r * T) * nD2 / 100; // Per 1% rate change
            } else { // put
                price = K * Math.exp(-r * T) * nNegD2 - S * Math.exp(-q * T) * nNegD1;
                delta = -Math.exp(-q * T) * nNegD1;
                theta = (- (S * Math.exp(-q * T) * nPrimeD1 * v) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * nNegD2 - q * S * Math.exp(-q * T) * nNegD1) / DAYS_PER_YEAR;
                rho = -K * T * Math.exp(-r * T) * nNegD2 / 100; // Per 1% rate change
            }
            // Gamma and Vega calculation (same for calls and puts)
            const gamma = Math.exp(-q * T) * nPrimeD1 / (S * vSqrtT);
            const vega = S * Math.exp(-q * T) * nPrimeD1 * Math.sqrt(T) / 100; // Per 1% vol change

            // Package results, ensuring validity
            const results = { price, delta, gamma, vega, theta, rho, d1, d2, error: null };
            for(const key in results) {
                if(typeof results[key] === 'number' && !isFinite(results[key])) { // Check for NaN, Infinity
                    logger.warn(`BS Calculation resulted in non-finite value for ${key}`);
                    results[key] = null; // Represent non-finite as null for consistency
                }
            }
            // Final check: Price cannot be negative
            if (results.price !== null && results.price < 0) {
                 logger.warn(`BS Price calculated negative (${results.price.toFixed(4)}), flooring to 0.`);
                 results.price = 0;
            }
            return results;

        } catch (calcError) {
            logger.error("Error during Black-Scholes math:", calcError);
            return { error: `Calculation Error: ${calcError.message}` };
        }
    }

    /**
     * ========================================================================
     * Binomial Tree Option Pricing Model (European)
     * ========================================================================
     * Cox-Ross-Rubinstein (CRR) model implementation. Provides an alternative pricing method.
     */
    function binomialTreePricer(S, K, T, r, v, optionType, q = 0, steps = 100) {
        logger.debug(`Binomial Input: S=${S}, K=${K}, T=${T.toFixed(4)}, r=${r.toFixed(4)}, v=${v.toFixed(4)}, q=${q.toFixed(4)}, type=${optionType}, steps=${steps}`);
        // Input validation
         if (isNaN(S) || isNaN(K) || isNaN(T) || isNaN(r) || isNaN(v) || isNaN(q) || isNaN(steps) || S <= 0 || K <= 0 || T < 0 || v <= 0 || steps < 1 || r < 0 || q < 0 || (optionType !== 'call' && optionType !== 'put')) {
             logger.warn("Invalid input to Binomial Pricer.", {S, K, T, r, v, q, steps, optionType});
             return { error: "Invalid Input" };
         }
         // Handle T=0 case
          if (T <= 1e-10) {
             logger.debug("Binomial: T near zero, returning intrinsic value.");
             let intrinsic = (optionType === 'call') ? Math.max(0, S - K) : Math.max(0, K - S);
             return { price: intrinsic, delta: null, gamma: null, theta: null, vega: null, rho: null, error: null }; // Greeks not calculated here
         }

        // Calculate parameters
        const dt = T / steps;
        const u = Math.exp(v * Math.sqrt(dt)); // Up factor
        const d = 1 / u;                       // Down factor (ensures recombining tree)
        const p = (Math.exp((r - q) * dt) - d) / (u - d); // Risk-neutral probability
        const discount = Math.exp(-r * dt);     // Discount factor per step

        // Check for arbitrage condition / model stability
        if (p < 0 || p > 1 || isNaN(p) || u <= d || d <= 0 || u <= 0) {
             logger.warn("Binomial arbitrage condition violated or parameters unstable. Check inputs.", {p, u, d, r, q, dt, v});
             return { error: "Model Instability/Arbitrage" };
         }

        // --- Tree Calculation ---
        try {
            // Initialize option values at maturity (last time step)
            // Use a single array and update in place to save memory for large step counts
            let optionValues = new Array(steps + 1);
            for (let i = 0; i <= steps; i++) {
                const priceAtMaturity = S * Math.pow(u, steps - i) * Math.pow(d, i);
                optionValues[i] = (optionType === 'call')
                                ? Math.max(0, priceAtMaturity - K)
                                : Math.max(0, K - priceAtMaturity);
            }

            // Backward induction: Step back through the tree
            // Overwrite the array from the end towards the beginning at each time step
            for (let step = steps - 1; step >= 0; step--) {
                for (let i = 0; i <= step; i++) {
                    // Expected value at this node using risk-neutral probability
                    const expectedValue = p * optionValues[i] + (1 - p) * optionValues[i + 1];
                    optionValues[i] = discount * expectedValue;
                    // Note for American options: Compare discountedExpectedValue with intrinsic value at this node
                }
                // The relevant part of the array shrinks by one element each step
            }

            // --- Greeks Calculation (Finite Differences - simplified) ---
            // Requires values from early steps which are overwritten.
            // We need to run small, separate trees for Greeks. This is less efficient but simpler here.
            let delta = null, gamma = null, theta = null;
            if (steps >= 2) { // Need at least 2 steps for gamma/theta approx
                // Re-run for 1 step to get priceUp, priceDown
                let V_t1 = new Array(2);
                V_t1[0] = (optionType === 'call') ? Math.max(0, S * u - K) : Math.max(0, K - S * u); // Value after up move
                V_t1[1] = (optionType === 'call') ? Math.max(0, S * d - K) : Math.max(0, K - S * d); // Value after down move
                const priceUp = discount * (p * V_t1[0] + (1 - p) * V_t1[1]); // Incorrect - This needs T-1 values, not T values

                // Recalculate specific nodes needed: V(S,t=0), V(S*u, t=dt), V(S*d, t=dt), V(S*u*u, t=2dt), V(S*u*d, t=2dt), V(S*d*d, t=2dt)
                // This is complex to do efficiently without storing the whole tree or using more advanced methods.
                // Let's use a simpler approximation by re-running small trees.

                 // For Delta: Price(S*1.01), Price(S*0.99)
                const S_up_small = S * 1.001; // Small price change
                const S_down_small = S * 0.999;
                const price_S_up = binomialTreePricer(S_up_small, K, T, r, v, optionType, q, Math.max(20, Math.min(steps, 50))).price; // Run smaller tree
                const price_S_down = binomialTreePricer(S_down_small, K, T, r, v, optionType, q, Math.max(20, Math.min(steps, 50))).price;
                if (price_S_up !== null && price_S_down !== null && (S_up_small - S_down_small) > 1e-6) {
                    delta = (price_S_up - price_S_down) / (S_up_small - S_down_small);
                }

                 // For Theta: Price(T-dt) - Price(T) / dt
                const T_minus_dt = T - dt;
                 if (T_minus_dt > 1e-9) {
                    const price_T_minus_dt = binomialTreePricer(S, K, T_minus_dt, r, v, optionType, q, Math.max(20, Math.min(steps-1, 50))).price;
                    if (price_T_minus_dt !== null) {
                        theta = (price_T_minus_dt - optionValues[0]) / (dt * DAYS_PER_YEAR); // Change over dt, per day
                    }
                 }

                 // Gamma is harder with this simple re-run approach. Omitting for brevity/accuracy concerns.
            }


            const finalPrice = optionValues[0]; // Price at the root node
            const results = { price: finalPrice, delta, gamma, theta, vega: null, rho: null, error: null }; // No simple Binomial Vega/Rho
            if (isNaN(results.price)) return { error: "Calculation Resulted in NaN" };
            if (results.price < 0) results.price = 0;
            return results;

        } catch (calcError) {
            logger.error("Error during binomial calculation:", calcError);
            return { error: `Calculation Error: ${calcError.message}` };
        }
    }

    /**
     * ========================================================================
     * Numerical Breakeven Finder (Bisection Method)
     * ========================================================================
     * Finds points where the strategy P/L curve crosses zero.
     */
    function findBreakevens(payoffFunction, searchMin, searchMax, quantity = 1) {
        logger.debug(`Finding breakevens between ${searchMin.toFixed(2)} and ${searchMax.toFixed(2)} for qty ${quantity}`);
        const breakevens = [];
        // Adjust step size based on range, but ensure reasonable minimum steps
        const numSteps = Math.max(PLOT_STEPS * 2, 200); // Use more steps for better interval detection
        const step = (searchMax - searchMin) / numSteps;
        let lastSign = null;
        const intervals = []; // Store [start, end] of intervals containing a root

        if (step <= 0) {
            logger.warn("Invalid search range for breakeven calculation.");
            return [];
        }

        try {
            // --- Broad Scan for Sign Changes ---
            let prevPrice = searchMin;
            let prevPayoff = payoffFunction(prevPrice);
            if (isNaN(prevPayoff)) { prevPayoff = payoffFunction(prevPrice + step*0.1); } // Try offset
            if (isNaN(prevPayoff)) { logger.error("Cannot calculate payoff at search start."); return []; }

            lastSign = Math.sign(prevPayoff);
            // Handle edge case where starting point is already a root
            if(Math.abs(prevPayoff) < NUMERICAL_PRECISION) intervals.push([prevPrice - step*0.1, prevPrice + step*0.1]);


            for (let i = 1; i <= numSteps; i++) {
                const price = searchMin + i * step;
                const currentPayoff = payoffFunction(price);
                if (isNaN(currentPayoff)) {
                     logger.warn(`Payoff NaN at price ${price.toFixed(2)}, skipping step.`);
                     continue; // Skip if payoff calculation fails
                }
                const currentSign = Math.sign(currentPayoff);

                // Detect sign change (root crossing)
                if (currentSign !== lastSign && lastSign !== 0 && currentSign !== 0) {
                    intervals.push([prevPrice, price]);
                    logger.debug(`Root interval found: [${prevPrice.toFixed(2)}, ${price.toFixed(2)}] (Signs: ${lastSign} -> ${currentSign})`);
                }
                // Detect near-zero crossing (potential root) - check AFTER sign change check
                else if (Math.abs(currentPayoff) < NUMERICAL_PRECISION * 5) {
                    // Avoid adding duplicate intervals if sign also changed
                    if (!(currentSign !== lastSign && lastSign !== 0 && currentSign !== 0)) {
                        intervals.push([price - step, price + step]); // Bracket the near-zero point
                        logger.debug(`Near-zero payoff (${currentPayoff.toFixed(4)}) found near ${price.toFixed(2)}, adding interval.`);
                    }
                }

                prevPrice = price;
                // Update lastSign only if the current payoff isn't exactly zero
                if (currentSign !== 0) {
                    lastSign = currentSign;
                }
            }

            // --- Bisection Refinement within each interval ---
            const refinedRoots = new Set(); // Use Set to store unique roots
            intervals.forEach(([a, b]) => {
                let low = a, high = b;
                let payoffLow = payoffFunction(low);
                let payoffHigh = payoffFunction(high);

                 // If interval was added due to near-zero, signs might be the same - check endpoints
                 if (Math.abs(payoffLow) < NUMERICAL_PRECISION && low >= searchMin && low <= searchMax) refinedRoots.add(parseFloat(low.toFixed(2)));
                 if (Math.abs(payoffHigh) < NUMERICAL_PRECISION && high >= searchMin && high <= searchMax) refinedRoots.add(parseFloat(high.toFixed(2)));

                 // Proceed with bisection only if signs actually differ
                 if (isNaN(payoffLow) || isNaN(payoffHigh) || Math.sign(payoffLow) === Math.sign(payoffHigh)) {
                     logger.debug(`Skipping bisection [${a.toFixed(2)}, ${b.toFixed(2)}]: Same sign or NaN.`);
                     return;
                 }


                for (let i = 0; i < MAX_BISECTION_ITERATIONS; i++) {
                    const mid = (low + high) / 2;
                    // Avoid infinite loop if interval becomes too small
                    if (high - low < NUMERICAL_PRECISION / 10) break;

                    const payoffMid = payoffFunction(mid);

                    if (isNaN(payoffMid)) { logger.warn(`Payoff NaN during bisection at ${mid.toFixed(2)}, aborting interval.`); return; }

                    // Check convergence conditions
                    if (Math.abs(payoffMid) < NUMERICAL_PRECISION || (high - low) / 2 < NUMERICAL_PRECISION) {
                        if (mid >= searchMin && mid <= searchMax) {
                             refinedRoots.add(parseFloat(mid.toFixed(2)));
                             logger.debug(`Bisection converged to root: ${mid.toFixed(2)}`);
                        }
                        return; // Root found
                    }

                    // Adjust interval
                    if (Math.sign(payoffMid) === Math.sign(payoffLow)) { low = mid; payoffLow = payoffMid; }
                    else { high = mid; payoffHigh = payoffMid; }
                }
                 logger.warn(`Bisection failed to converge within max iterations for interval [${a.toFixed(2)}, ${b.toFixed(2)}]`);
            });

            const sortedUniqueBreakevens = Array.from(refinedRoots).sort((a, b) => a - b);
            logger.info(`Found Breakevens: ${sortedUniqueBreakevens.join(', ') || 'None'}`);
            return sortedUniqueBreakevens;

        } catch (error) {
            logger.error("Error during breakeven calculation:", error);
            return []; // Return empty array on error
        }
    }

    /**
     * ========================================================================
     * Net Greeks Calculation
     * ========================================================================
     * Sums the Greeks of individual legs, considering position and quantity.
     */
    function calculateNetGreeks(legs, quantity = 1) { /* ... As implemented before ... */ }

    /**
     * ========================================================================
     * Storage Utilities (IndexedDB, Cache API, localStorage)
     * ========================================================================
     */
    // --- IndexedDB Functions ---
    async function openDB() { /* ... As implemented before ... */ }
    async function saveDataToDB(data) { /* ... As implemented before (saves definitions) ... */ }
    async function loadDataFromDB() { /* ... As implemented before (loads definitions) ... */ }

    // --- Cache Storage API Functions ---
    async function cacheDataResponse(url, data) { /* ... As implemented before ... */ }
    async function loadDataFromCache(url) { /* ... As implemented before ... */ }

    // --- localStorage Functions for User Overrides ---
    /** Saves current user overrides state to localStorage */
    function saveUserOverridesToLocalStorage() { /* ... As implemented before ... */ }
    /** Loads user overrides from localStorage into appState */
    function loadUserOverridesFromLocalStorage() { /* ... As implemented before ... */ }
    /** Clears overrides from state and localStorage */
    function clearUserOverrides() { /* ... As implemented before ... */ }

    /**
     * ========================================================================
     * State Management & Calculation Logic (ENHANCED)
     * ========================================================================
     */

     /** Applies user overrides to a deep copy of base definitions */
     function applyUserOverrides(baseDefinitions, overrides) { /* ... As implemented before ... */ }

    /** Recalculates values for ONE strategy definition (including overrides) */
    function recalculateSingleStrategy(strategyDefinition) {
        // ... (Existing validation for strategyDefinition) ...
        // Use current global inputs
        const { underlyingPrice: S, dte, rate: rPercent, vol: globalVPercent, dividendYield: qPercent, binomialSteps } = appState.globalInputs;
        // ... (Input validation for global inputs) ...
        const T = dte / DAYS_PER_YEAR; const r = rPercent / 100.0; const q = qPercent / 100.0; const globalV = globalVPercent / 100.0;

        const calculateFunc = appState.pricingModel === 'Binomial' ? binomialTreePricer : blackScholes;
        const modelArgs = { S, T, r, q };
        if (appState.pricingModel === 'Binomial') modelArgs.steps = binomialSteps;

        // Deep clone the input definition to work with
        const calculatedStrategy = JSON.parse(JSON.stringify(strategyDefinition));
        let calculationSuccess = true;
        let overallNetPremium = 0; let netType = 'N/A';
        const strategyQuantity = calculatedStrategy.parameters.quantity || 1; // Use defined quantity

        // --- Calculate Price & Greeks for each leg ---
        const processLeg = (leg) => {
            if (!leg || typeof leg.strike !== 'number' || typeof leg.type !== 'string' || typeof leg.position !== 'string') {
                logger.warn("Skipping invalid leg structure:", leg);
                calculationSuccess = false;
                return null; // Skip invalid leg structure
            }
            const K = leg.strike;
            // Use per-leg IV override if valid, otherwise use global
            const legVolOverride = leg.ivOverride;
            const V = (typeof legVolOverride === 'number' && legVolOverride > 0) ? legVolOverride / 100.0 : globalV;
            const optionType = leg.type;

            const bsArgs = { ...modelArgs, K, v: V, optionType };
             const result = calculateFunc(...Object.values(bsArgs)); // Call BS or Binomial

            leg.calculated = result || { error: `${appState.pricingModel} Calc Failed` }; // Store result on the leg copy
            if (!result || result.error) { calculationSuccess = false; }
            return result;
        };

        // Apply calculation to legs or single parameter set
        if (calculatedStrategy.parameters.legs && Array.isArray(calculatedStrategy.parameters.legs)) {
            calculatedStrategy.parameters.legs.forEach(leg => {
                const result = processLeg(leg);
                // Accumulate net premium only if calculation was successful
                if (result && !result.error && typeof result.price === 'number') {
                     if (leg.position === 'long') overallNetPremium += result.price;
                     else overallNetPremium -= result.price;
                } else {
                     calculationSuccess = false; // Mark failure if any leg fails
                }
            });
        } else if (calculatedStrategy.parameters.type && typeof calculatedStrategy.parameters.strike === 'number') { // Single leg
             const legDataForCalc = { ...calculatedStrategy.parameters }; // Copy params
             const result = processLeg(legDataForCalc);
             calculatedStrategy.parameters.calculated = result || { error: `${appState.pricingModel} Calc Failed` };
              if (result && !result.error && typeof result.price === 'number') {
                 overallNetPremium = result.price; // Net premium is just the leg premium
              } else { calculationSuccess = false; }
        } else {
             logger.error(`Invalid parameter structure for strategy: ${calculatedStrategy.id || calculatedStrategy.name}`);
             calculationSuccess = false; // Invalid structure
        }

        // --- Calculate Net Greeks ---
        calculatedStrategy.calculatedNetGreeks = calculateNetGreeks(
            calculatedStrategy.parameters.legs || [calculatedStrategy.parameters], // Handle single leg case
            strategyQuantity
        );
        // Check if net greek calculation itself indicated an error
        if (calculatedStrategy.calculatedNetGreeks.error) calculationSuccess = false;

        // --- Finalize Net Premium ---
        if (calculationSuccess) {
             netType = overallNetPremium >= 0 ? 'Debit' : 'Credit';
             overallNetPremium = Math.abs(overallNetPremium);
        } else { overallNetPremium = NaN; netType = 'Error'; }
        calculatedStrategy.calculatedNet = { premium: overallNetPremium, type: netType };

        // --- Calculate Numerical Breakevens ---
        calculatedStrategy.calculatedBreakevens = []; // Initialize
        if (calculationSuccess) {
             try {
                 // Define the payoff function using the *calculated* premiums from the legs/parameter
                 const payoffAtExpiry = (priceAtExpiry) => {
                     let totalPayoff = 0;
                     const baseParams = calculatedStrategy.parameters;
                     const quantity = baseParams.quantity || 1;

                     if (baseParams.legs) {
                         baseParams.legs.forEach(leg => {
                             // IMPORTANT: Use CALCULATED premium for T=0 payoff! Intrinsic value alone isn't enough for BE calc.
                             const premium = leg.calculated?.price ?? 0; // Default to 0 if calc failed
                             totalPayoff += calculateLegPayoff(priceAtExpiry, leg.type, leg.position, leg.strike, premium, 1); // Use Q=1 for payoff function
                         });
                     } else if (baseParams.type) { // Single leg
                          const premium = baseParams.calculated?.price ?? 0;
                          totalPayoff += calculateLegPayoff(priceAtExpiry, baseParams.type, baseParams.position, baseParams.strike, premium, 1);
                     }
                     // The payoff function returns payoff for ONE unit of the strategy
                     return totalPayoff * quantity; // Scale by quantity for root finding (where P/L = 0)
                 };

                 // Define search range robustly
                 const strikes = (calculatedStrategy.parameters.legs?.map(l => l.strike) || [calculatedStrategy.parameters.strike]).filter(k => typeof k === 'number');
                 const S_current = appState.globalInputs.underlyingPrice;
                 const minStrike = strikes.length > 0 ? Math.min(...strikes) : S_current;
                 const maxStrike = strikes.length > 0 ? Math.max(...strikes) : S_current;
                 const searchMin = Math.max(0.01, Math.min(S_current * (1 - PLOT_PRICE_RANGE_FACTOR * 2.5), minStrike * 0.8)); // Wider search, avoid 0
                 const searchMax = Math.max(S_current * (1 + PLOT_PRICE_RANGE_FACTOR * 2.5), maxStrike * 1.2);

                 calculatedStrategy.calculatedBreakevens = findBreakevens(payoffAtExpiry, searchMin, searchMax, strategyQuantity);
             } catch(beError) {
                  logger.error(`Error calculating breakevens for ${calculatedStrategy.id}:`, beError);
                  calculatedStrategy.calculatedBreakevens = []; // Ensure it's an empty array on error
             }
        }

        // --- Calculate Theoretical Max P/L ---
        calculatedStrategy.calculatedMaxPL = calculateTheoreticalMaxPL(calculatedStrategy);

        if (!calculationSuccess) logger.warn(`Calculation issues occurred for strategy: ${calculatedStrategy.id || calculatedStrategy.name}`);
        return calculatedStrategy; // Return the fully enriched strategy object
    }


    /** Recalculates ALL strategies and updates `appState.calculatedStrategies` */
    function recalculateAllStrategies() {
        logger.info(`Recalculating all strategies using ${appState.pricingModel} model.`);
        if (appState.calculationInProgress) {
             logger.warn("Calculation already in progress, skipping redundant call.");
             return false; // Avoid concurrent calculations
        }
         if (!appState.strategyDefinitions) { logger.error("Cannot recalculate all: Definitions not loaded."); return false; }

        appState.calculationInProgress = true; // Set flag
        appState.error = null; // Clear previous calc errors before starting
        let overallSuccess = true;

        try {
            // Apply current user overrides for this calculation run
            const definitionsToUse = applyUserOverrides(appState.strategyDefinitions, appState.userOverrides);
            const newCalculatedData = {};

            for (const categoryKey in definitionsToUse) {
                 if (categoryKey === 'about') { newCalculatedData.about = definitionsToUse.about; continue; }
                if (Array.isArray(definitionsToUse[categoryKey])) {
                    newCalculatedData[categoryKey] = definitionsToUse[categoryKey].map(def => {
                        const result = recalculateSingleStrategy(def); // Recalculate based on potentially overridden def
                        if (!result || result.calculatedNet?.type === 'Error') { overallSuccess = false; }
                        return result || def; // Return calculated or original def on failure
                    });
                }
            }
            appState.calculatedStrategies = newCalculatedData; // Update state with results

        } catch (error) {
             logger.error("Error during full strategy recalculation:", error);
             appState.error = `Calculation Error: ${error.message}`;
             appState.calculatedStrategies = null; // Invalidate calculated data on major error
             overallSuccess = false;
        } finally {
            appState.calculationInProgress = false; // Unset flag
        }

        if (!overallSuccess && !appState.error) { // Set generic error if specific one wasn't caught
            appState.error = "One or more strategy calculations failed.";
        } else if (overallSuccess) {
            logger.info("Full recalculation complete.");
            // Clear calculation-related errors if successful
             if (appState.error && (appState.error.includes("Failed to calculate") || appState.error.includes("Invalid Input"))) {
                 appState.error = null;
             }
        }
        return overallSuccess;
    }


    /** Helper to calculate theoretical Max P/L based on structure and calculated net cost */
    function calculateTheoreticalMaxPL(calculatedStrategy) {
         // This requires knowledge of each strategy type's payoff structure
         const params = calculatedStrategy.parameters;
         const netCalc = calculatedStrategy.calculatedNet;
         const quantity = params.quantity || 1;
         let maxProfit = null, maxLoss = null; // Use null for potentially infinite

         if (!netCalc || netCalc.type === 'Error' || isNaN(netCalc.premium)) {
             logger.warn(`Cannot calculate Max P/L for ${calculatedStrategy.id}: Net calculation invalid.`);
             return { maxProfit: NaN, maxLoss: NaN };
         }

         // Net cost/credit: Positive for debit, negative for credit
         const netCostOrCredit = (netCalc.type === 'Debit' ? netCalc.premium : -netCalc.premium) * quantity;

         // Determine strategy type based on structure/ID (needs improvement for robustness)
         let strategyType = 'unknown';
         const idPrefix = calculatedStrategy.id?.split('-')[0];
         const numLegs = params.legs?.length ?? (params.type ? 1 : 0);

         if (numLegs === 1) strategyType = params.position; // 'long' or 'short'
         else if (numLegs === 2) {
             if (idPrefix === 'bull' || idPrefix === 'bear') strategyType = 'vertical';
             else if (idPrefix === 'long' && (params.legs[0].strike === params.legs[1].strike)) strategyType = 'long_straddle';
             else if (idPrefix === 'long') strategyType = 'long_strangle';
             // Add short straddle/strangle if defined
         } else if (numLegs === 4) { // Assuming specific structures for 4 legs
             if (idPrefix === 'iron') strategyType = netCalc.type === 'Credit' ? 'iron_condor_fly' : 'reverse_iron'; // Differentiate short vs long vol
             else if (idPrefix === 'box') strategyType = 'box';
             else if (idPrefix?.includes('butterfly')) strategyType = netCalc.type === 'Debit' ? 'long_butterfly' : 'short_butterfly'; // Guess based on typical construction cost
         }
         // Add more type detections as needed

         logger.debug(`Max P/L Calc: ID=${calculatedStrategy.id}, Type=${strategyType}, NetCost/Credit=${netCostOrCredit.toFixed(2)}`);

         try {
             switch (strategyType) {
                case 'long': // Long Call/Put
                    maxLoss = netCostOrCredit; // Amount paid (always positive or zero)
                    if (params.type === 'call') maxProfit = Infinity;
                    else maxProfit = (params.strike * quantity) - netCostOrCredit; // Max profit for put if S=0
                    break;
                case 'short': // Short Call/Put
                    maxProfit = -netCostOrCredit; // Credit received (should be positive)
                    if (params.type === 'put') maxLoss = -(params.strike * quantity - (-netCostOrCredit)); // Max loss for put if S=0
                    else maxLoss = -Infinity; // Unlimited loss for short call
                    break;
                 case 'vertical': // Vertical Spreads
                     const width = Math.abs(params.legs[0].strike - params.legs[1].strike) * quantity;
                     if (netCalc.type === 'Debit') { // Debit Spreads (Bull Call, Bear Put)
                         maxLoss = netCostOrCredit;
                         maxProfit = width - netCostOrCredit;
                     } else { // Credit Spreads (Bear Call, Bull Put)
                         maxProfit = -netCostOrCredit;
                         maxLoss = -(width - (-netCostOrCredit));
                     }
                     break;
                 case 'long_straddle': case 'long_strangle':
                      maxLoss = netCostOrCredit; // Debit paid
                      maxProfit = Infinity; // Theoretically unlimited profit potential
                      break;
                 case 'iron_condor_fly': // Short Iron Condor / Butterfly
                     maxProfit = -netCostOrCredit; // Credit received
                     // Assumes symmetric wings for simplicity here
                     const wingWidthIC = Math.abs(params.legs[1].strike-params.legs[0].strike) * quantity;
                     maxLoss = -(wingWidthIC - (-netCostOrCredit));
                     break;
                 case 'reverse_iron': // Long Iron Condor / Butterfly
                      maxLoss = netCostOrCredit; // Debit paid
                      const wingWidthRIC = Math.abs(params.legs[1].strike-params.legs[0].strike) * quantity;
                      maxProfit = wingWidthRIC - netCostOrCredit;
                      break;
                 case 'long_butterfly':
                      maxLoss = netCostOrCredit; // Debit paid
                      const wingWidthBF = Math.abs(params.legs[1].strike-params.legs[0].strike) * quantity; // Assumes K2 is legs[1]
                      maxProfit = wingWidthBF - netCostOrCredit;
                      break;
                  case 'box':
                       const widthBox = Math.abs(params.legs[0].strike - params.legs[1].strike) * quantity; // K1 and K2
                       // Profit/Loss is locked in
                       maxProfit = widthBox - netCostOrCredit;
                       maxLoss = widthBox - netCostOrCredit;
                       break;
                // TODO: Add cases for Short Straddle/Strangle, Short Butterfly, Ratios, etc.
                 default:
                    logger.warn(`Max P/L calculation not implemented for strategy type derived from ID: ${calculatedStrategy.id}`);
                    maxProfit = Infinity; // Default assumptions for unknown types
                    maxLoss = -Infinity;
             }
         } catch (e) {
              logger.error(`Error calculating Max P/L for ${calculatedStrategy.id}:`, e);
              return { maxProfit: NaN, maxLoss: NaN };
         }


         // Final formatting/validation
         return {
             maxProfit: (maxProfit === Infinity || maxProfit === null || isNaN(maxProfit)) ? Infinity : maxProfit,
             maxLoss: (maxLoss === -Infinity || maxLoss === null || isNaN(maxLoss)) ? -Infinity : maxLoss
         };
    }

    /**
     * ========================================================================
     * DOM Manipulation and Rendering (ENHANCED)
     * ========================================================================
     */

     /** Clears content and status areas, purges Plotly charts */
     function clearContentAreas() { /* ... As implemented before ... */ }
    /** Updates the status message area */
    function updateStatusMessage() { /* ... As implemented before ... */ }
    /** Updates header status indicators */
    function updateStatusIndicators() { /* ... As implemented before ... */ }
    /** Renders sidebar links based on available strategy DEFINITIONS */
    function renderSidebarLinks() { /* ... As implemented before ... */ }
    /** Renders the About section from DEFINITIONS */
    function renderAboutSection() { /* ... As implemented before ... */ }
    /** Updates the 'active' class on sidebar links */
    function updateSidebarActiveState() { /* ... As implemented before ... */ }

    /** Creates the HTML for a single strategy detail panel (using CALCULATED data) */
    function createStrategyDetailPanel(calculatedStrategy) {
        const panel = document.createElement('div');
        panel.className = 'w3-panel w3-card-4 strategy-panel';
        panel.dataset.strategyId = calculatedStrategy.id || calculatedStrategy.name;
        // Add pending class if overrides exist for this strategy
        if(appState.userOverrides[calculatedStrategy.id]) {
             panel.classList.add('modified-pending');
        }


        // --- Helpers ---
        const createHeading = (text) => `<h3>${text || 'Unnamed Strategy'}</h3>`;
        const createDetailPara = (content, title = null) => {
             if (content === null || content === undefined) return '';
             let html = `<p>`;
             if (title) html += `<strong>${title}:</strong> `;
             html += content;
             html += `</p>`;
             return html;
        };
        const createListSection = (items, title) => {
             if (!items || items.length === 0) return '';
             let listHTML = `<div class="strategy-detail-section"><strong>${title}:</strong><ul>`;
             items.forEach(item => { listHTML += `<li>${item}</li>`; });
             listHTML += `</ul></div>`;
             return listHTML;
         };
        const createDetailSection = (content, title) => {
            if (content === null || content === undefined) return '';
             let value = content;
             if (typeof content === 'number' && isFinite(content)) value = content.toFixed(4); // Format numbers, check for finite
             else if (content === Infinity) value = 'Unlimited (+∞)';
             else if (content === -Infinity) value = 'Unlimited (-∞)';
             else if (isNaN(content)) value = 'N/A (Calc Error)'; // Handle NaN explicitly

             return `<div class="strategy-detail-section"><strong>${title}:</strong> ${value}</div>`;
         };
        const formatGreek = (value) => (value === null || !isFinite(value)) ? 'N/A' : value.toFixed(4);

        // --- Build Panel HTML ---
        let panelHTML = createHeading(calculatedStrategy.name);
        // Basic Info
        panelHTML += createDetailPara(calculatedStrategy.outlook, "Market Outlook");
        panelHTML += createDetailPara(calculatedStrategy.description, "Description");

        // --- Parameters & Construction Section WITH INPUTS ---
        panelHTML += `<div class="strategy-params-section"><h5>Parameters & Construction</h5>`;
        // Quantity Input
        const quantity = calculatedStrategy.parameters.quantity || 1; // Default to 1 if undefined
        panelHTML += `<div class="param-input-group">
                        <label for="qty_${calculatedStrategy.id}">Quantity:</label>
                        <input type="number" id="qty_${calculatedStrategy.id}" class="strategy-input"
                               data-strategy-id="${calculatedStrategy.id}" data-param="quantity"
                               min="1" step="1" value="${quantity}" required>
                        <span class="input-suffix">Contracts/Spreads</span>
                      </div>`;

        // Construction List / Leg Inputs
        if (calculatedStrategy.construction) panelHTML += createListSection(calculatedStrategy.construction, "Structure");
        if (calculatedStrategy.parameters?.legs && Array.isArray(calculatedStrategy.parameters.legs)) {
             calculatedStrategy.parameters.legs.forEach((leg, index) => {
                 panelHTML += `<div class="param-input-group">
                               <label for="strike_${calculatedStrategy.id}_${index}">Leg ${index + 1} (${leg.position} ${leg.type}) Strike:</label>
                               <input type="number" id="strike_${calculatedStrategy.id}_${index}" class="strategy-input" data-strategy-id="${calculatedStrategy.id}" data-leg-index="${index}" data-param="strike" value="${leg.strike}" step="0.25" required>
                               <label for="iv_${calculatedStrategy.id}_${index}" style="min-width: 30px; margin-left: 15px;">IV%:</label>
                               <input type="number" id="iv_${calculatedStrategy.id}_${index}" class="strategy-input iv-override" data-strategy-id="${calculatedStrategy.id}" data-leg-index="${index}" data-param="ivOverride" min="0.1" step="0.1" value="${leg.ivOverride || ''}" placeholder="${appState.globalInputs.vol.toFixed(1)}" title="Override global IV for this leg (optional)">
                             </div>`;
             });
        } else if (calculatedStrategy.parameters?.type && typeof calculatedStrategy.parameters.strike === 'number') { // Single leg
            panelHTML += `<div class="param-input-group">
                           <label for="strike_${calculatedStrategy.id}_0">Strike:</label>
                           <input type="number" id="strike_${calculatedStrategy.id}_0" class="strategy-input" data-strategy-id="${calculatedStrategy.id}" data-leg-index="0" data-param="strike" value="${calculatedStrategy.parameters.strike}" step="0.25" required>
                         </div>`;
            panelHTML += `<div class="param-input-group">
                            <label for="iv_${calculatedStrategy.id}_0" style="min-width: 30px; margin-left: 15px;">IV%:</label>
                            <input type="number" id="iv_${calculatedStrategy.id}_0" class="strategy-input iv-override" data-strategy-id="${calculatedStrategy.id}" data-leg-index="0" data-param="ivOverride" min="0.1" step="0.1" value="${calculatedStrategy.parameters.ivOverride || ''}" placeholder="${appState.globalInputs.vol.toFixed(1)}" title="Override global IV for this leg (optional)">
                          </div>`;
        }
        if (calculatedStrategy.notes) panelHTML += `<p class="strategy-notes"><em>Note: ${calculatedStrategy.notes}</em></p>`;
        panelHTML += `</div>`; // End strategy-params-section

        // --- Calculated Values & Greeks ---
        panelHTML += `<div class="strategy-detail-section"><strong>Theoretical Value <span class="model-name-display">(${appState.pricingModel})</span>:</strong>`;
        const netCalc = calculatedStrategy.calculatedNet;
        if (netCalc && netCalc.type !== 'Error') {
            panelHTML += ` Net ${netCalc.type}: <span class="calculated-value">${'$'+netCalc.premium.toFixed(2)}</span>`;
        } else { panelHTML += ` <span class="calculated-value">Error</span>`; }
        panelHTML += `<span class="point-value-note">($${ES_POINT_VALUE}/pt Multiplier applies to P/L)</span></div>`;

        // Display Greeks Table (Net Greeks)
        let greeksHTML = `<div class="strategy-detail-section"><strong>Net Strategy Greeks (Approximate):</strong>`;
        const netGreeks = calculatedStrategy.calculatedNetGreeks;
        if (netGreeks && !netGreeks.error) {
             greeksHTML += `<table class="greeks-table"><thead><tr><th>Greek</th><th>Net Value</th><th>Unit</th></tr></thead><tbody>`;
             greeksHTML += `<tr class="net-greeks-row"><td>Net Delta</td><td>${formatGreek(netGreeks.delta)}</td><td>Per $1 /ES Change</td></tr>`;
             greeksHTML += `<tr class="net-greeks-row"><td>Net Gamma</td><td>${formatGreek(netGreeks.gamma)}</td><td>Delta's Change</td></tr>`;
             greeksHTML += `<tr class="net-greeks-row"><td>Net Vega</td><td>${formatGreek(netGreeks.vega)}</td><td>Per 1% IV Change</td></tr>`;
             greeksHTML += `<tr class="net-greeks-row"><td>Net Theta</td><td>${formatGreek(netGreeks.theta)}</td><td>Per Day Decay</td></tr>`;
             greeksHTML += `<tr class="net-greeks-row"><td>Net Rho</td><td>${formatGreek(netGreeks.rho)}</td><td>Per 1% Rate Change</td></tr>`;
             greeksHTML += `</tbody></table>`;
             // Add note about approximation
             greeksHTML += `<small><i>Net Greeks are the sum of individual leg Greeks (calculated via ${appState.pricingModel}). Binomial Greeks are approximate.</i></small>`;
        } else { greeksHTML += `<p><small><i>Net Greeks calculation failed or not applicable.</i></small></p>`; }
        greeksHTML += `</div>`;
        panelHTML += greeksHTML;

        // Structural P/L & Calculated Metrics
        panelHTML += createDetailSection(calculatedStrategy.maxProfit, "Max Profit Structure");
        panelHTML += createDetailSection(calculatedStrategy.maxLoss, "Max Loss Structure");
        // Calculated Breakevens
        panelHTML += createDetailSection(
               (calculatedStrategy.calculatedBreakevens?.length > 0) ? calculatedStrategy.calculatedBreakevens.map(be => be.toFixed(2)).join(', ') : 'N/A',
               `Calculated Breakeven(s) @ Exp`
         );
        // Calculated Max P/L
         const maxPL = calculatedStrategy.calculatedMaxPL;
         panelHTML += createDetailSection((maxPL?.maxProfit === Infinity) ? 'Unlimited' : `$${maxPL?.maxProfit?.toFixed(2) ?? 'N/A'}`, `Calculated Max Profit`);
         panelHTML += createDetailSection((maxPL?.maxLoss === -Infinity) ? 'Unlimited' : `$${maxPL?.maxLoss?.toFixed(2) ?? 'N/A'}`, `Calculated Max Loss`);

        // Plotly Container
        if (calculatedStrategy.plotlyDivId) panelHTML += `<div id="${calculatedStrategy.plotlyDivId}" class="plotly-chart-container"><div class="w3-display-container w3-light-grey" style="height:100%;"><p class="w3-display-middle w3-center"><i class="fa fa-spinner w3-spin"></i><br>Loading Chart...</p></div></div>`;
        else panelHTML += `<p class="info-message">No plot defined for this strategy.</p>`

        // Example & Action Buttons
        if (calculatedStrategy.example) panelHTML += `<p class="strategy-example"><em>Example: ${calculatedStrategy.example}</em></p>`;
        panelHTML += `<div class="panel-actions">
                        <button class="w3-button recalculate-button action-button ${appState.userOverrides[calculatedStrategy.id] ? 'pending-recalc' : ''}" data-strategy-id="${calculatedStrategy.id}" title="Recalculate this strategy using current parameters">
                            <i class="fa fa-calculator"></i> Recalculate This Strategy
                        </button>
                        <button class="w3-button w3-light-grey w3-small action-button calendar-button" data-strategy-name="${calculatedStrategy.name || 'Unknown'}">
                            <i class="fa fa-calendar-plus-o"></i> Add to Calendar (Placeholder)
                        </button>
                      </div>`;

        panel.innerHTML = panelHTML;
        return panel;
    }


    /** Renders the current section, orchestrating calculation and rendering */
    function renderCurrentSection() {
        logger.log(`Rendering section: ${appState.currentSection}`);

        // --- Phase 1: Update Status & Check Pre-requisites ---
        updateStatusMessage(); // Display loading/error/info
        updateStatusIndicators(); // Update header indicators
        updateSidebarActiveState(); // Highlight correct nav link

        if (appState.isLoading) { clearContentAreas(); return; } // Still loading defs
        if (!appState.strategyDefinitions) { // Critical: Need definitions
            appState.error = "Strategy definitions missing. Try reloading definitions."; updateStatusMessage(); clearContentAreas(); return;
        }

        // --- Phase 2: Recalculate ALL if necessary ---
        // Trigger if calculated data is absent OR global inputs have changed since last full render
        if (!appState.calculatedStrategies || appState.bsInputsChangedSinceLastRender) {
            logger.info("Global recalculation required (Initial load or global input change).");
            if (!recalculateAllStrategies()) { // Attempt recalc
                updateStatusMessage(); // Show potential calc errors
                clearContentAreas(); // Don't render if calc failed
                return; // Stop rendering if overall calculation failed
            }
            appState.bsInputsChangedSinceLastRender = false; // Reset flag after successful calc
        }

        // --- Phase 3: Render Content using calculatedStrategies ---
        if (!appState.calculatedStrategies) { // Check again after potential calc failure
            logger.error("Rendering aborted: Calculated strategies data unavailable.");
            if (!appState.error) appState.error = "Failed to prepare strategy data for display.";
            updateStatusMessage(); clearContentAreas(); return;
        }

        logger.debug("Proceeding to render content from calculatedStrategies.");
        clearContentAreas(); // Clear previous content
        try {
            switch(appState.currentSection) {
                case 'about': renderAboutSection(); break; // Uses definitions
                case 'oneLeg': case 'twoLeg': case 'threeLeg': case 'fourLeg':
                    renderStrategySection(appState.currentSection); break; // Uses calculatedStrategies
                default: /* Fallback */ logger.warn(`Unknown section: ${appState.currentSection}.`); renderAboutSection(); break;
            }
        } catch(renderError) {
             logger.error("Error during section rendering:", renderError);
             appState.error = `UI Render Error: ${renderError.message}`;
             updateStatusMessage(); // Show render error
        }

        // Track GA Page View (only if render was likely successful)
        if(!appState.error) trackGAPageView(appState.currentSection);
    }


    /** Renders a strategy section using CALCULATED data and triggers plotting */
    function renderStrategySection(sectionKey) {
        const sectionTitles = { oneLeg: '1-Leg', twoLeg: '2-Leg', threeLeg: '3-Leg', fourLeg: '4-Leg' };
        const sectionDescriptions = { /* ... As before ... */ };
        const title = `${sectionTitles[sectionKey] || 'Unknown'} Strategies`;
        const description = sectionDescriptions[sectionKey];
        const strategies = appState.calculatedStrategies[sectionKey] || []; // Use CALCULATED data

        DOM.contentContainer.innerHTML = `<h2>${title}</h2>${description ? `<p>${description}</p>` : ''}`; // Set title/desc

        if (strategies.length > 0) {
            strategies.forEach(calculatedStrategy => {
                try {
                    // Create panel based on the enriched strategy data
                    const detailPanel = createStrategyDetailPanel(calculatedStrategy);
                    DOM.contentContainer.appendChild(detailPanel);
                    // Trigger Plotly rendering for this panel immediately after appending
                    renderPlotlyChart(calculatedStrategy);
                } catch (panelError) {
                    logger.error(`Error creating panel for strategy ${calculatedStrategy.id}:`, panelError);
                    // Append an error message placeholder if panel creation failed
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'strategy-panel error-message';
                    errorDiv.textContent = `Error displaying strategy ${calculatedStrategy.name || calculatedStrategy.id}.`;
                    DOM.contentContainer.appendChild(errorDiv);
                }
            });
        } else {
             DOM.contentContainer.innerHTML += '<p class="info-message">No strategies defined or calculated for this section.</p>';
        }
    }


    /** Re-renders a single strategy panel after modification/recalculation */
    function renderSingleStrategyPanel(strategyId) {
        logger.debug(`Re-rendering single strategy panel: ${strategyId}`);
        const container = DOM.contentContainer;
        const existingPanel = container.querySelector(`div.strategy-panel[data-strategy-id="${strategyId}"]`);

        if (!appState.calculatedStrategies) return logger.error("Cannot render panel, calculatedStrategies is null.");

        // Find the updated calculated strategy data
        let updatedStrategyData = null; let categoryKey = findCategoryKey(strategyId);
        if (categoryKey && appState.calculatedStrategies[categoryKey]) {
            updatedStrategyData = appState.calculatedStrategies[categoryKey].find(s => s.id === strategyId);
        }

        if (!updatedStrategyData) return logger.error(`Could not find UPDATED calculated data for strategy ID: ${strategyId}`);

        // Create the new panel HTML structure
        const newPanel = createStrategyDetailPanel(updatedStrategyData); // Uses updated calculated data

        // Replace the old panel with the new one
        if (existingPanel) {
             logger.debug(`Replacing existing panel for ${strategyId}`);
             // Purge existing Plotly chart before removing the div
             const existingChartDiv = existingPanel.querySelector('.plotly-chart-container');
             if (existingChartDiv?._fullLayout && typeof Plotly !== 'undefined') {
                 try { Plotly.purge(existingChartDiv); } catch(e) { logger.error("Plotly purge failed during single panel update", e); }
             }
             existingPanel.replaceWith(newPanel); // Use replaceWith for modern browsers
        } else {
             logger.warn(`Existing panel not found for ${strategyId}, appending instead.`);
             container.appendChild(newPanel); // Fallback: append if something went wrong
        }

        // Trigger Plotly rendering for the *new* panel's chart container
        renderPlotlyChart(updatedCalculatedStrategy);
    }


    /** Centralized function to render/update a Plotly chart (ENHANCED) */
    function renderPlotlyChart(calculatedStrategy) {
        const plotContainer = document.getElementById(calculatedStrategy.plotlyDivId);
        if (!plotContainer) return logger.error(`Plot container not found: ${calculatedStrategy.plotlyDivId}`);
        logger.debug(`Rendering Plotly for ${calculatedStrategy.id}`);

        // Ensure Plotly library is available
        if (typeof Plotly === 'undefined') {
            plotContainer.innerHTML = `<p class="error-message">Plotly library failed to load.</p>`;
            return;
        }
         // Purge existing chart before drawing new one
         try { Plotly.purge(plotContainer); } catch (e) { /* ignore */ }

        // Check if calculation was successful for this strategy
        if (calculatedStrategy.calculatedNet?.type === 'Error') {
             plotContainer.innerHTML = `<p class="error-message">Calculation error prevents chart rendering.</p>`;
             return;
        }

        // Get traces and base layout from specific plot function
        if (calculatedStrategy.plotFunction && calculatedStrategy.parameters && plotFunctions[calculatedStrategy.plotFunction]) {
            try {
                // Pass the parameters from the *calculated* strategy object
                const { traces, layout: baseLayout } = plotFunctions[calculatedStrategy.plotFunction](calculatedStrategy.parameters);

                // Generate the final enhanced layout using calculated metrics attached during recalculate
                const finalLayout = getPlotlyLayout(baseLayout.title.text, calculatedStrategy);

                // Filter traces based on chart settings
                const tracesToShow = traces.filter(trace =>
                    trace.name?.toLowerCase().includes('net p/l') || appState.chartSettings.showLegs
                );

                 // Add Profit/Loss Shading if enabled
                 if (appState.chartSettings.shadeProfitLoss && tracesToShow.length > 0) {
                      const netTrace = tracesToShow.find(t => t.name?.toLowerCase().includes('net p/l'));
                      if (netTrace && netTrace.x && netTrace.y) {
                          addShading(finalLayout, netTrace.x, netTrace.y); // Add shading shapes
                      }
                 }


                // Draw the plot
                Plotly.newPlot(plotContainer, tracesToShow, finalLayout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d'] });

            } catch (plotError) {
                logger.error(`Error rendering Plotly chart ${calculatedStrategy.plotlyDivId}:`, plotError);
                plotContainer.innerHTML = `<p class="error-message">Chart Error: ${plotError.message}</p>`;
            }
        } else {
             plotContainer.innerHTML = `<p class="info-message">Plotting function or parameters missing/invalid for this strategy.</p>`;
        }
    }

    /** Adds Profit/Loss shading shapes to a Plotly layout object */
    function addShading(layout, xData, yData) {
        logger.debug("Adding P/L shading to chart layout.");
        let startX = null;
        for(let i = 0; i < xData.length; i++) {
            const currentY = yData[i];
            const isProfit = currentY > NUMERICAL_PRECISION;
            const isLoss = currentY < -NUMERICAL_PRECISION;

            if ((isProfit || isLoss) && startX === null) {
                startX = xData[i]; // Start of a region
            } else if (startX !== null && (!isProfit && !isLoss)) { // End of region (crossed zero)
                const endX = xData[i];
                const lastY = yData[i-1] ?? 0; // Use previous point's sign
                layout.shapes.push({
                    type: 'rect', xref: 'x', yref: 'paper',
                    x0: startX, y0: 0, x1: endX, y1: 1,
                    fillcolor: lastY > 0 ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)', // Bootstrap success/danger lightened
                    layer: 'below', line: { width: 0 }
                });
                startX = null; // Reset
            }
        }
         // Handle region extending to the end
         if (startX !== null) {
             const endX = xData[xData.length - 1];
             const lastY = yData[yData.length -1] ?? 0;
             layout.shapes.push({
                 type: 'rect', xref: 'x', yref: 'paper',
                 x0: startX, y0: 0, x1: endX, y1: 1,
                 fillcolor: lastY > 0 ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                 layer: 'below', line: { width: 0 }
             });
         }
    }


    /** Enhanced Plotly layout generator */
    function getPlotlyLayout(title, calculatedStrategy) {
        const baseLayout = {
            title: { text: title, font: { size: 17, family: 'Segoe UI, Arial, sans-serif', color: '#2c3e50' }, y:0.95 },
            xaxis: { title: '/ES Futures Price @ Expiration', zeroline: true, gridcolor: '#e9ecef', automargin: true, range: [] },
            yaxis: { title: 'Profit / Loss ($) per Unit', zeroline: true, gridcolor: '#e9ecef', tickformat: '$,.2f', automargin: true, range: [] },
            showlegend: true,
            legend: { orientation: "h", yanchor: "bottom", y: -0.3, xanchor: "center", x: 0.5, font: { size: 10 } },
            margin: { l: 75, r: 30, b: 110, t: 60, pad: 5 },
            hovermode: 'x unified',
            paper_bgcolor: '#ffffff', // White paper
            plot_bgcolor: '#ffffff', // White plot area
            shapes: [], annotations: [] // Initialize arrays
        };
        const params = calculatedStrategy.parameters;
        const S = appState.globalInputs.underlyingPrice;
        const prices = generatePriceRange(S, PLOT_PRICE_RANGE_FACTOR * 1.2); // Wider range
        baseLayout.xaxis.range = [prices[0], prices[prices.length - 1]];
        const yRangeLimits = {min: null, max: null}; // Track Y for axis range

        // --- Add Lines & Annotations ---
        const addShape = (shape) => baseLayout.shapes.push(shape);
        const addAnnotation = (anno) => baseLayout.annotations.push(anno);

        // Helper for Vertical Lines
        const addVerticalLine = (xVal, color, dash = 'dash', text = null, textY = 0.95, textAnchor = null, yShift = 0) => {
            if (xVal === null || isNaN(xVal) || !isFinite(xVal)) return;
            addShape({ type: 'line', xref: 'x', yref: 'paper', x0: xVal, y0: 0, x1: xVal, y1: 1, line: { color, width: 1.5, dash }});
            if (text) {
                addAnnotation({
                    x: xVal, y: textY, xref: 'x', yref: 'paper', text: `<b>${text}</b>`, showarrow: false,
                    font: { size: 10, color: color }, bordercolor: '#fff', borderwidth: 2, bgcolor: 'rgba(255,255,255,0.7)',
                    xanchor: textAnchor || (xVal > S ? 'left' : 'right'), xshift: textAnchor ? 0 : (xVal > S ? 5 : -5),
                    yanchor: 'middle', yshift: yShift
                });
            }
             // Adjust X-axis range if line is outside current view
             baseLayout.xaxis.range[0] = Math.min(baseLayout.xaxis.range[0], xVal - (prices[1]-prices[0])*2); // Add padding
             baseLayout.xaxis.range[1] = Math.max(baseLayout.xaxis.range[1], xVal + (prices[1]-prices[0])*2);
        };

        // Helper for Horizontal Lines
        const addHorizontalLine = (yVal, color, dash = 'dash', text = null, textAnchor = 'left') => {
            if (yVal === null || isNaN(yVal) || !isFinite(yVal)) return;
             addShape({ type: 'line', xref: 'paper', yref: 'y', x0: 0, y0: yVal, x1: 1, y1: yVal, line: { color, width: 1.5, dash }});
             if (text) {
                 addAnnotation({
                     x: (textAnchor === 'left' ? 0.02 : 0.98) , y: yVal, xref: 'paper', yref: 'y', text: `<b>${text}</b>`, showarrow: false,
                     font: { size: 10, color: color }, bgcolor: 'rgba(255,255,255,0.7)', bordercolor: '#fff', borderwidth: 2,
                     xanchor: textAnchor, yanchor: yVal > 0 ? 'bottom' : 'top', yshift: yVal > 0 ? 4 : -4
                 });
             }
             // Track min/max Y for axis range adjustment
             if(yRangeLimits.min === null || yVal < yRangeLimits.min) yRangeLimits.min = yVal;
             if(yRangeLimits.max === null || yVal > yRangeLimits.max) yRangeLimits.max = yVal;
        };

        // --- Add Specific Lines ---
        // 1. Zero P/L Line
        addHorizontalLine(0, 'rgba(50, 50, 50, 0.8)', 'solid', 'P/L = 0', 'right');
        // 2. Current Underlying Price
        addVerticalLine(S, 'rgba(255, 140, 0, 0.9)', 'solid', `Current ${S.toFixed(2)}`, 0.88);
        // 3. Strike Prices
        const strikes = new Set(); /* ... get strikes ... */
        strikes.forEach((k, i) => addVerticalLine(k, 'rgba(100, 100, 100, 0.7)', 'dot', `K ${k}`, 0.92, null, i * -12)); // Offset text slightly
        // 4. Calculated Break-evens
        calculatedStrategy.calculatedBreakevens?.forEach((be, i) => addVerticalLine(be, 'rgba(34, 139, 34, 0.9)', 'dashdot', `BE ${be.toFixed(2)}`, 0.82, null, i * -12));
        // 5. Calculated Max Profit / Max Loss
        const maxPL = calculatedStrategy.calculatedMaxPL;
        if (maxPL) {
            if (maxPL.maxProfit !== Infinity) addHorizontalLine(maxPL.maxProfit, 'rgba(0, 150, 0, 0.8)', 'dash', `Max Profit: ${maxPL.maxProfit.toFixed(2)}`);
            if (maxPL.maxLoss !== -Infinity) addHorizontalLine(maxPL.maxLoss, 'rgba(200, 0, 0, 0.8)', 'dash', `Max Loss: ${maxPL.maxLoss.toFixed(2)}`);
        }

        // --- Adjust Y Axis Range ---
        // (Use calculated Max P/L and potentially trace data min/max)
         const yMinLimit = (maxPL?.maxLoss === -Infinity || maxPL?.maxLoss === null) ? yRangeLimits.min : maxPL.maxLoss;
         const yMaxLimit = (maxPL?.maxProfit === Infinity || maxPL?.maxProfit === null) ? yRangeLimits.max : maxPL.maxProfit;
         if (yMinLimit !== null && isFinite(yMinLimit) && yMaxLimit !== null && isFinite(yMaxLimit)) {
             const padding = (yMaxLimit - yMinLimit) * 0.15 || Math.abs(yMinLimit || yMaxLimit || 1) * 0.3; // More padding
             baseLayout.yaxis.range = [yMinLimit - padding, yMaxLimit + padding];
         } else {
              // Fallback if limits are infinite/null - might need data range analysis here
              logger.warn("Could not determine finite Y-axis range from Max P/L.");
         }


        return baseLayout;
    }


    /**
     * ========================================================================
     * Event Handlers & Application Flow (ENHANCED)
     * ========================================================================
     */
    // --- Navigation & Basic UI ---
    function handleNavLinkClick(event) {
        event.preventDefault();
        const section = event.target?.dataset?.section;
        if (section && section !== appState.currentSection) {
            logger.log(`Navigating to section: ${section}`);
            appState.currentSection = section;
            // Render section - uses existing calculated data if BS inputs haven't changed
            renderCurrentSection();
        }
        w3_close(); // Close sidebar on mobile
    }
    function handleCalendarButtonClick(event) { /* ... as before ... */ }
    function handleRefreshDataClick() { initializeApp(true); } // Reload definitions
    function updateNetworkStatus() {
        const wasOffline = appState.isOffline;
        appState.isOffline = !navigator.onLine;
        logger.log(`Network status changed: ${appState.isOffline ? 'OFFLINE' : 'ONLINE'}`);
        updateStatusIndicators();
        DOM.refreshDataButton.disabled = appState.isOffline || appState.isLoading;
        if (wasOffline && !appState.isOffline) {
             logger.info("Network online, attempting to refresh definitions.");
             initializeApp(true); // Force refresh on reconnect
        } else if (appState.isOffline) {
             renderCurrentSection(); // Re-render to show offline status correctly
        }
    }
    function w3_open() { DOM.sidebar.style.display = 'block'; DOM.overlay.style.display = 'block'; }
    function w3_close() { DOM.sidebar.style.display = 'none'; DOM.overlay.style.display = 'none'; }
    function trackGAPageView(section) { /* ... as before ... */ }

    // --- Global Input Handling ---
    function handleGlobalInputChange(event) {
        logger.debug(`Global Input change: ${event.target.id}`);
        let changed = false;
        const input = event.target;
        const inputId = input.id;
        // Derive state key from input ID (e.g., 'globalInputRate' -> 'rate')
        const stateKey = inputId.replace('globalInput', '').charAt(0).toLowerCase() + inputId.replace('globalInput', '').slice(1);

        if (inputId === 'pricingModelSelector') {
            const value = input.value;
            if (value !== appState.pricingModel) { appState.pricingModel = value; changed = true; }
        } else if (appState.globalInputs.hasOwnProperty(stateKey)) {
            const isInt = ['dte', 'binomialSteps'].includes(stateKey);
            let value = isInt ? parseInt(input.value, 10) : parseFloat(input.value);
            const min = parseFloat(input.min); const max = parseFloat(input.max); // Get min/max from attributes

            // Validate and update state
            let isValid = !isNaN(value);
            if (isValid && !isNaN(min)) isValid = value >= min;
            if (isValid && !isNaN(max)) isValid = value <= max;

            if (isValid && value !== appState.globalInputs[stateKey]) {
                appState.globalInputs[stateKey] = value;
                changed = true;
                input.classList.remove('w3-border-red'); // Clear validation style
            } else if (!isValid) {
                input.classList.add('w3-border-red'); // Mark input as invalid
            } else {
                input.classList.remove('w3-border-red'); // Value didn't change but might have been invalid before
            }
        }

        if (changed) {
            appState.bsInputsChangedSinceLastRender = true; // Mark global state dirty
            logger.log("Global inputs updated, triggering full recalculation & re-render:", appState.globalInputs, "Model:", appState.pricingModel);
            renderCurrentSection(); // Triggers full recalculation
        }
    }

    // --- Strategy Input Handling ---
    function handleStrategyInputChange(event) {
        const input = event.target;
        if (!input.classList.contains('strategy-input')) return;

        const strategyId = input.dataset.strategyId;
        const param = input.dataset.param; // 'strike', 'quantity', 'ivOverride'
        const legIndex = input.dataset.legIndex !== undefined ? parseInt(input.dataset.legIndex, 10) : null;
        const valueStr = input.value;
        let value;

        logger.debug(`Strategy Input Change: Strategy=${strategyId}, Param=${param}, Leg=${legIndex}, Value=${valueStr}`);

        // --- Parse and Validate Value ---
        let isValid = false;
        if (param === 'quantity') {
            value = parseInt(valueStr, 10);
            if (!isNaN(value) && value >= 1) isValid = true;
        } else if (param === 'strike') {
            value = parseFloat(valueStr);
            if (!isNaN(value) && value > 0) isValid = true;
        } else if (param === 'ivOverride') {
            // Allow empty string to clear the override
            if (valueStr === '') {
                value = null; // Represent 'clear' as null
                isValid = true;
            } else {
                value = parseFloat(valueStr);
                if (!isNaN(value) && value > 0) isValid = true;
            }
        } else { return; } // Unknown parameter

        // --- Update Override State & UI Cue ---
        if (isValid) {
            updateUserOverrideState(strategyId, param, legIndex, value);
            input.classList.remove('w3-border-red');
            const panel = input.closest('.strategy-panel');
            if (panel) panel.classList.add('modified-pending');
            const recalcButton = panel?.querySelector('.recalculate-button');
            if (recalcButton) recalcButton.classList.add('pending-recalc'); // Use class
        } else {
            logger.warn("Invalid strategy input value detected.");
            input.classList.add('w3-border-red');
            // Do not update override state with invalid value
        }
    }

    // --- Strategy Recalculate Handling ---
    function handleStrategyRecalculateClick(event) {
         const button = event.target.closest('.recalculate-button');
         if (!button || appState.calculationInProgress) return; // Prevent action if busy

         const strategyId = button.dataset.strategyId;
         logger.log(`Recalculate button clicked for strategy: ${strategyId}`);
         appState.calculationInProgress = true; // Prevent concurrent calcs
         button.disabled = true; // Disable button during calc
         button.innerHTML = '<i class="fa fa-spinner w3-spin"></i> Calculating...';

         // Use setTimeout to allow UI to update before potentially blocking calculation
         setTimeout(async () => {
             try {
                 // --- Find definition WITH current overrides applied ---
                 let strategyDef = null; let categoryKey = findCategoryKey(strategyId);
                 if (!categoryKey || !appState.strategyDefinitions?.[categoryKey]) throw new Error("Base definition category not found");
                 strategyDef = appState.strategyDefinitions[categoryKey].find(s => s.id === strategyId);
                 if (!strategyDef) throw new Error("Base definition not found");

                 const definitionWithOverrides = applyUserOverrides({ [categoryKey]: [strategyDef] }, appState.userOverrides)[categoryKey][0];

                 // --- Recalculate this single strategy ---
                 const updatedCalculatedStrategy = recalculateSingleStrategy(definitionWithOverrides);

                 if (updatedCalculatedStrategy && updatedCalculatedStrategy.calculatedNet?.type !== 'Error') {
                     // Update the specific strategy in appState.calculatedStrategies
                     if (appState.calculatedStrategies?.[categoryKey]) {
                         const index = appState.calculatedStrategies[categoryKey].findIndex(s => s.id === strategyId);
                         if (index > -1) appState.calculatedStrategies[categoryKey][index] = updatedCalculatedStrategy;
                         else logger.warn(`Calculated data structure missing entry for ${strategyId}`); // Should not happen
                     }
                     // Re-render ONLY this panel
                     renderSingleStrategyPanel(strategyId);
                     // Reset visual cues
                     const panel = DOM.contentContainer.querySelector(`.strategy-panel[data-strategy-id="${strategyId}"]`); // Get the new panel
                     if (panel) panel.classList.remove('modified-pending');
                     button.classList.remove('pending-recalc');
                 } else {
                     const errorMsg = updatedCalculatedStrategy?.calculatedNet?.type === 'Error' ? 'Calculation failed.' : 'Update failed.';
                     updateStatusMessageInternal(`Error recalculating ${strategyId}: ${errorMsg}`, "error-message", 4000);
                 }
             } catch (error) {
                  logger.error(`Error during single strategy recalculation for ${strategyId}:`, error);
                  updateStatusMessageInternal(`Error recalculating ${strategyId}.`, "error-message", 4000);
             } finally {
                  appState.calculationInProgress = false; // Release lock
                  button.disabled = false; // Re-enable button
                  button.innerHTML = '<i class="fa fa-calculator"></i> Recalculate This Strategy';
             }
         }, 10); // Small delay for UI responsiveness
    }

    // --- localStorage Button Handlers ---
    function handleSaveOverrides() { saveUserOverridesToLocalStorage(); }
    function handleLoadOverrides() {
        if (loadUserOverridesFromLocalStorage()) {
             appState.bsInputsChangedSinceLastRender = true; // Mark as changed to force full recalc with loaded overrides
             renderCurrentSection(); // Re-render everything applying loaded overrides
        }
    }
    function handleClearOverrides() {
         if (confirm("Clear all saved parameters and revert to defaults?")) {
             clearUserOverrides();
             appState.bsInputsChangedSinceLastRender = true; // Force recalc after clearing
             renderCurrentSection();
         }
    }

    /** Helper for temporary info/error messages */
    let statusTimeoutId = null;
    function updateStatusMessageInternal(message, className = 'info-message', duration = 3500) {
        // ... (Implementation as before, using statusTimeoutId) ...
    }

    /** Updates the userOverrides state object */
    function updateUserOverrideState(strategyId, param, legIndex, value) {
        // Ensure strategy entry exists
        if (!appState.userOverrides[strategyId]) {
             // Find number of legs from definition to initialize legs array correctly
             const def = appState.strategyDefinitions[findCategoryKey(strategyId)]?.find(s => s.id === strategyId);
             const numLegs = def?.parameters?.legs?.length ?? 1;
             appState.userOverrides[strategyId] = { legs: Array(numLegs).fill(null).map(()=>({})) }; // Initialize with empty objects
        }
        const strategyOverride = appState.userOverrides[strategyId];

        if (param === 'quantity') {
            strategyOverride.quantity = value;
        } else if (param === 'strike' || param === 'ivOverride') {
             // Ensure legs array in override matches expected length (could happen if def reloaded)
             const numLegsDef = appState.strategyDefinitions[findCategoryKey(strategyId)]?.find(s => s.id === strategyId)?.parameters.legs?.length ?? 1;
             while (strategyOverride.legs.length < numLegsDef) strategyOverride.legs.push({});
             if(strategyOverride.legs.length > numLegsDef) strategyOverride.legs.length = numLegsDef; // Trim excess

             if (legIndex !== null && legIndex >= 0 && legIndex < strategyOverride.legs.length) {
                  if (param === 'ivOverride' && (value === '' || value === null)) {
                       delete strategyOverride.legs[legIndex].ivOverride; // Remove property if cleared
                  } else {
                     strategyOverride.legs[legIndex][param] = value; // Set strike or IV override
                  }
                  // Optional: Clean up empty leg override objects if all params are default/cleared
                   if (Object.keys(strategyOverride.legs[legIndex]).length === 0) {
                       // Maybe remove leg override? Becomes complex if index matters. Simpler to leave empty object.
                   }
             }
        }
        logger.debug("User overrides updated:", strategyId, appState.userOverrides[strategyId]);
    }

    /** Finds the category key ('oneLeg', etc.) for a strategy ID */
    function findCategoryKey(strategyId) { /* ... As implemented before ... */ }

    /**
     * ========================================================================
     * Data Loading and Initialization (ENHANCED)
     * ========================================================================
     */
    async function initializeApp(forceRefresh = false) {
        logger.log(`>>> Initializing Application V2 - Force Refresh: ${forceRefresh}`);
        appState.isLoading = true; appState.error = null; appState.infoMessage = null;
        renderCurrentSection(); // Show initial loading state

        let loadedDefs = null; let source = 'None';

        try {
            // --- Load Strategy DEFINITIONS (Network > Cache > DB) ---
            // 1. Ensure DB is open (can happen in parallel with fetch)
             openDB().catch(dbError => logger.error("Initial DB Open Failed:", dbError)); // Log error but don't block loading yet

            // 2. Attempt Fetch
             if (!appState.isOffline || forceRefresh) {
                 try {
                     logger.info(`Attempting network fetch: ${STRATEGIES_JSON_URL}`);
                     const response = await fetch(STRATEGIES_JSON_URL, { cache: 'no-store' });
                     appState.lastFetchTimestamp = new Date();
                     if (!response.ok) throw new Error(`HTTP ${response.status}`);
                     loadedDefs = await response.json();
                     source = 'Network'; logger.log("Definitions fetched from Network.");
                     // Save/Cache in background
                     if (loadedDefs) {
                          saveDataToDB(loadedDefs).catch(e=>logger.error("BG DB Save failed",e));
                          cacheDataResponse(STRATEGIES_JSON_URL, loadedDefs).catch(e=>logger.error("BG Cache Save failed",e));
                     }
                 } catch (fetchError) { logger.warn(`Fetch failed: ${fetchError.message}.`); appState.error = `Network unavailable. Checking offline...`; }
             } else { logger.info("Offline, skipping network fetch."); appState.lastFetchTimestamp = new Date(); }

            // 3. Attempt Cache (if needed)
             if (!loadedDefs) {
                 logger.info("Attempting Cache API...");
                 const cacheDefs = await loadDataFromCache(STRATEGIES_JSON_URL);
                 if (cacheDefs) { loadedDefs = cacheDefs; source = 'Cache'; appState.error = null; logger.log("Definitions loaded from Cache."); }
             }

            // 4. Attempt IndexedDB (if needed)
             if (!loadedDefs) {
                  logger.info("Attempting IndexedDB...");
                  try {
                      const dbDefs = await loadDataFromDB(); // Uses existing connection or re-opens
                      if (dbDefs) { loadedDefs = dbDefs; source = 'IndexedDB'; appState.error = null; logger.log("Definitions loaded from IndexedDB."); }
                      else { logger.info("No definitions found in IndexedDB."); }
                  } catch (dbLoadError) { logger.error("IndexedDB load failed:", dbLoadError); if (!appState.error) appState.error="Offline storage error.";}
             }

             // --- Process Loaded Definitions & Overrides ---
             if (loadedDefs) {
                 appState.strategyDefinitions = loadedDefs; // Store base definitions
                 appState.dataSource = source;
                 appState.error = null; // Clear loading errors
             } else {
                 logger.error("Failed to load strategy definitions from any source.");
                 appState.strategyDefinitions = null; appState.calculatedStrategies = null; appState.dataSource = 'None';
                 if (!appState.error) appState.error = "Could not load strategy definitions."; // Set final error
             }

        } catch (initError) {
             logger.error("Critical Initialization Error:", initError);
             appState.error = `Application failed to initialize: ${initError.message}`;
             appState.strategyDefinitions = null; appState.calculatedStrategies = null; appState.dataSource = 'Error';
        } finally {
            appState.isLoading = false; // Loading phase complete
             if (appState.lastFetchTimestamp) DOM.lastUpdated.textContent = `Defs source checked: ${appState.lastFetchTimestamp.toLocaleTimeString()}`;
            DOM.refreshDataButton.disabled = appState.isOffline || appState.isLoading;
        }

        // --- Initial Render Cycle ---
        renderSidebarLinks(); // Needs definitions
        // This triggers recalculateAllStrategies (which applies overrides) and renders the UI
        renderCurrentSection();
        logger.log(">>> Application Initialization Complete <<<");
    }

    /**
     * ========================================================================
     * Conceptual Placeholders & Initialization Trigger
     * ========================================================================
     */
    function conceptualSecretUsage() {
        // --- Placeholder for explaining GitHub Secret limitations ---
        logger.warn("[Conceptual] GitHub Secrets are for backend/build processes, NOT directly usable in client-side JS.");
        // const HYPOTHETICAL_API_KEY = "THIS_IS_NOT_A_REAL_SECRET"; // Never hardcode
        // logger.info(`[Conceptual] If an API key (${HYPOTHETICAL_API_KEY.substring(0,4)}...) were needed, it would be fetched from a secure backend or injected during build.`);
    }

    // --- DOMContentLoaded Event Listener ---
    document.addEventListener('DOMContentLoaded', () => {
        logger.log("DOM Content Loaded. Setting up listeners and initializing V2...");
        // --- Setup Event Listeners ---
        try {
            DOM.openMenuButton?.addEventListener('click', w3_open);
            DOM.closeMenuButton?.addEventListener('click', w3_close);
            DOM.overlay?.addEventListener('click', w3_close);
            DOM.refreshDataButton?.addEventListener('click', handleRefreshDataClick);
            window.addEventListener('online', updateNetworkStatus);
            window.addEventListener('offline', updateNetworkStatus);
            // Global Inputs
            DOM.modelSelector?.addEventListener('change', handleGlobalInputChange);
            DOM.globalInputUnderlying?.addEventListener('change', handleGlobalInputChange);
            DOM.globalInputDTE?.addEventListener('change', handleGlobalInputChange);
            DOM.globalInputRate?.addEventListener('change', handleGlobalInputChange);
            DOM.globalInputVol?.addEventListener('change', handleGlobalInputChange);
            DOM.globalInputDividend?.addEventListener('change', handleGlobalInputChange);
            DOM.globalInputBinomialSteps?.addEventListener('change', handleGlobalInputChange);
            // Delegated Listeners for Dynamic Content
            DOM.contentContainer?.addEventListener('click', (event) => {
                 handleCalendarButtonClick(event); // Check for calendar clicks
                 handleStrategyRecalculateClick(event); // Check for recalc clicks
            });
             DOM.contentContainer?.addEventListener('change', handleStrategyInputChange); // Listen for changes on strategy inputs
            // localStorage Buttons
            DOM.saveModsButton?.addEventListener('click', handleSaveOverrides);
            DOM.loadModsButton?.addEventListener('click', handleLoadOverrides);
            DOM.clearModsButton?.addEventListener('click', handleClearOverrides);
            // Chart Settings Listener (if implemented)
            // DOM.chartSettingsContainer?.addEventListener('change', handleChartSettingsChange);
            logger.info("Core event listeners attached.");
        } catch (listenerError) {
             logger.error("Error attaching initial event listeners:", listenerError);
             appState.error = "UI setup failed. Please refresh.";
             updateStatusMessage(); // Show critical setup error
             return; // Stop initialization if listeners failed
        }


        // --- Set Initial Global Input Values from State ---
        try {
            if (DOM.modelSelector) DOM.modelSelector.value = appState.pricingModel;
            if (DOM.globalInputUnderlying) DOM.globalInputUnderlying.value = appState.globalInputs.underlyingPrice;
            if (DOM.globalInputDTE) DOM.globalInputDTE.value = appState.globalInputs.dte;
            if (DOM.globalInputRate) DOM.globalInputRate.value = appState.globalInputs.rate;
            if (DOM.globalInputVol) DOM.globalInputVol.value = appState.globalInputs.vol;
            if (DOM.globalInputDividend) DOM.globalInputDividend.value = appState.globalInputs.dividendYield;
            if (DOM.globalInputBinomialSteps) DOM.globalInputBinomialSteps.value = appState.globalInputs.binomialSteps;
            logger.debug("Initial global input values set from state.");
        } catch (e) { logger.error("Error setting initial input values:", e); }

        // --- Log Placeholders ---
        conceptualSecretUsage();

        // --- Start Application ---
        loadUserOverridesFromLocalStorage(); // Load overrides *before* first calculation
        initializeApp(); // Load definitions, apply overrides, calculate, render
    });

})(); // End IIFE
