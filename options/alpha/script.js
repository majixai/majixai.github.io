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
    const DB_NAME = 'optionStrategyDB_Adv_Vanilla_v1';
    const DB_VERSION = 1;
    const STORE_NAME = 'strategyDefsStore_v1';
    const DATA_KEY = 'allStrategyDefinitionsBlob'; // Single key for definitions blob
    const CACHE_NAME = 'option-strategy-defs-cache-vanilla-v2';
    const STRATEGIES_JSON_URL = 'strategies.json'; // Relative path to definitions file
    const DAYS_PER_YEAR = 365.25;
    const ES_POINT_VALUE = 50;
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
            let optionValues = new Array(steps + 1);
            for (let i = 0; i <= steps; i++) {
                const priceAtMaturity = S * Math.pow(u, steps - i) * Math.pow(d, i);
                optionValues[i] = (optionType === 'call')
                                ? Math.max(0, priceAtMaturity - K)
                                : Math.max(0, K - priceAtMaturity);
            }

            // Backward induction: Step back through the tree
            for (let step = steps - 1; step >= 0; step--) {
                const nextStepValues = new Array(step + 1);
                for (let i = 0; i <= step; i++) {
                    // Expected value at this node using risk-neutral probability
                    const expectedValue = p * optionValues[i] + (1 - p) * optionValues[i + 1];
                    nextStepValues[i] = discount * expectedValue;
                    // For American options, you'd add:
                    // const priceAtNode = S * Math.pow(u, step - i) * Math.pow(d, i);
                    // const intrinsicValue = (optionType === 'call') ? Math.max(0, priceAtNode - K) : Math.max(0, K - priceAtNode);
                    // nextStepValues[i] = Math.max(intrinsicValue, discountedExpectedValue);
                }
                optionValues = nextStepValues; // Update values for the current step
            }

            // --- Greeks Calculation (Finite Differences - simplified) ---
            // Requires recalculating parts of the tree or storing intermediate values.
            // This is a basic approximation and less accurate than analytical Greeks from BS.
            let delta = null, gamma = null, theta = null;
             if (steps >= 2) {
                 // Need values after 1 step (which were overwritten) - Let's re-run briefly
                 let values_T1 = new Array(steps + 1); // Values at maturity
                 for (let i = 0; i <= steps; i++) values_T1[i] = (optionType === 'call') ? Math.max(0, S * Math.pow(u, steps - i) * Math.pow(d, i) - K) : Math.max(0, K - S * Math.pow(u, steps - i) * Math.pow(d, i));
                 for (let s = steps - 1; s >= 1; s--) for (let i = 0; i <= s; i++) values_T1[i] = discount * (p * values_T1[i] + (1 - p) * values_T1[i+1]);
                 // Now values_T1[0] is price(u), values_T1[1] is price(d) after one step
                 const priceUp = values_T1[0];
                 const priceDown = values_T1[1];
                 const S_u = S * u; const S_d = S * d;
                 if(Math.abs(S_u - S_d) > 1e-9) delta = (priceUp - priceDown) / (S_u - S_d);

                 // For Gamma, need values after 2 steps (requires another backward pass or storing T2 values)
                 // For simplicity, we'll omit Gamma calculation from this basic Binomial pricer.
                 // For Theta, compare price at step 2 (mid-node) vs price at root
                 // This also requires T2 values. A simpler theta is (priceUD - currentPrice) / (2*dt)
                 // Let's calculate priceUD (value after 2 steps, one up, one down)
                 let values_T2 = new Array(steps + 1); // Values at maturity
                 for (let i = 0; i <= steps; i++) values_T2[i] = (optionType === 'call') ? Math.max(0, S * Math.pow(u, steps - i) * Math.pow(d, i) - K) : Math.max(0, K - S * Math.pow(u, steps - i) * Math.pow(d, i));
                 for (let s = steps - 1; s >= 2; s--) for (let i = 0; i <= s; i++) values_T2[i] = discount * (p * values_T2[i] + (1 - p) * values_T2[i+1]);
                 // Now T2 values are ready
                 const priceUU = discount * (p * values_T1[0] + (1-p) * values_T1[1]); // Needs T1 values
                 const priceUD = discount * (p * values_T1[1] + (1-p) * values_T1[2]); // Needs T1 values
                  if (priceUD !== undefined && !isNaN(priceUD)) {
                     theta = (priceUD - optionValues[0]) / (2 * dt * DAYS_PER_YEAR); // Change over 2 steps -> per day
                  }
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
        const step = (searchMax - searchMin) / (PLOT_STEPS * 3); // Use more steps for detection
        let lastSign = null;
        const intervals = []; // Store [start, end] of intervals containing a root

        try {
            // --- Broad Scan for Sign Changes ---
            let prevPrice = searchMin;
            let prevPayoff = payoffFunction(prevPrice);
            if (isNaN(prevPayoff)) { logger.warn("Payoff NaN at search start."); /* Maybe try slightly offset start? */ prevPayoff = payoffFunction(prevPrice + step*0.1); }
            if (isNaN(prevPayoff)) { logger.error("Cannot calculate payoff at search start."); return []; } // Abort if still NaN

            lastSign = Math.sign(prevPayoff);

            for (let price = searchMin + step; price <= searchMax; price += step) {
                const currentPayoff = payoffFunction(price);
                if (isNaN(currentPayoff)) {
                     logger.warn(`Payoff NaN at price ${price.toFixed(2)}, skipping step.`);
                     continue; // Skip if payoff calculation fails
                }
                const currentSign = Math.sign(currentPayoff);

                // Detect sign change (root crossing)
                if (currentSign !== lastSign && lastSign !== 0 && currentSign !== 0) {
                    intervals.push([prevPrice, price]);
                    logger.debug(`Root interval found: [${prevPrice.toFixed(2)}, ${price.toFixed(2)}]`);
                }
                // Detect near-zero crossing (potential root)
                else if (Math.abs(currentPayoff) < NUMERICAL_PRECISION * 5) { // Increased tolerance slightly
                    intervals.push([price - step, price + step]); // Bracket the near-zero point
                    logger.debug(`Near-zero payoff (${currentPayoff.toFixed(4)}) found near ${price.toFixed(2)}, adding interval.`);
                }

                prevPrice = price;
                // Only update lastSign if the current payoff isn't exactly zero,
                // otherwise, we might miss a root if it lands exactly on a step.
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

                // Re-check signs as interval might have been added due to near-zero, not sign change
                 if (isNaN(payoffLow) || isNaN(payoffHigh) || Math.sign(payoffLow) === Math.sign(payoffHigh)) {
                    // If signs are the same, check if the interval covers zero closely
                    if (Math.abs(payoffLow) < NUMERICAL_PRECISION * 10 || Math.abs(payoffHigh) < NUMERICAL_PRECISION * 10) {
                         // If one end is very close to zero, consider it a potential root
                         const potentialRoot = Math.abs(payoffLow) < Math.abs(payoffHigh) ? low : high;
                         if (potentialRoot >= searchMin && potentialRoot <= searchMax) {
                             refinedRoots.add(parseFloat(potentialRoot.toFixed(2))); // Add formatted root
                             logger.debug(`Adding near-zero endpoint as root: ${potentialRoot.toFixed(2)}`);
                         }
                    } else {
                        logger.debug(`Skipping bisection [${a.toFixed(2)}, ${b.toFixed(2)}]: Same sign.`);
                    }
                    return; // Skip bisection if signs are the same and not near zero
                 }


                for (let i = 0; i < MAX_BISECTION_ITERATIONS; i++) {
                    const mid = (low + high) / 2;
                    const payoffMid = payoffFunction(mid);

                    if (isNaN(payoffMid)) { // Handle calculation failure within bisection
                         logger.warn(`Payoff NaN during bisection at ${mid.toFixed(2)}, aborting interval.`);
                         return;
                    }

                    // Check convergence conditions
                    if (Math.abs(payoffMid) < NUMERICAL_PRECISION || (high - low) / 2 < NUMERICAL_PRECISION) {
                        if (mid >= searchMin && mid <= searchMax) { // Ensure root is within original bounds
                             refinedRoots.add(parseFloat(mid.toFixed(2))); // Add formatted root
                             logger.debug(`Bisection converged to root: ${mid.toFixed(2)}`);
                        }
                        return; // Root found for this interval
                    }

                    // Adjust interval based on sign
                    if (Math.sign(payoffMid) === Math.sign(payoffLow)) {
                        low = mid; payoffLow = payoffMid;
                    } else {
                        high = mid; payoffHigh = payoffMid;
                    }
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
    function calculateNetGreeks(legs, quantity = 1) {
        const netGreeks = { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0, error: null };
        if (!legs || !Array.isArray(legs)) {
            netGreeks.error = "Invalid legs data"; logger.warn(netGreeks.error); return netGreeks;
        }

        let legsComplete = true;
        legs.forEach(leg => {
            // Check if the leg and its calculated data (including Greeks) are valid
            if (!leg || !leg.calculated || leg.calculated.error ||
                leg.calculated.delta === null || leg.calculated.gamma === null ||
                leg.calculated.vega === null || leg.calculated.theta === null ||
                leg.calculated.rho === null ||
                isNaN(leg.calculated.delta) || isNaN(leg.calculated.gamma) ||
                isNaN(leg.calculated.vega) || isNaN(leg.calculated.theta) ||
                isNaN(leg.calculated.rho))
            {
                legsComplete = false;
                logger.warn(`Net Greeks: Skipping leg due to missing/invalid calculated data: ${leg?.type} ${leg?.strike}`);
                return; // Skip this leg
            }
            // Determine multiplier based on position (long = +1, short = -1)
            const multiplier = (leg.position === 'long' ? 1 : -1) * quantity;
            // Accumulate Greeks
            netGreeks.delta += (leg.calculated.delta * multiplier);
            netGreeks.gamma += (leg.calculated.gamma * multiplier);
            netGreeks.vega += (leg.calculated.vega * multiplier);
            netGreeks.theta += (leg.calculated.theta * multiplier);
            netGreeks.rho += (leg.calculated.rho * multiplier);
        });

        if (!legsComplete) {
            netGreeks.error = "Incomplete leg data";
            // Reset sums to NaN if calculation is incomplete
            netGreeks.delta = NaN; netGreeks.gamma = NaN; netGreeks.vega = NaN; netGreeks.theta = NaN; netGreeks.rho = NaN;
             logger.warn("Net Greeks calculation incomplete due to leg errors.");
        }

        logger.debug("Calculated Net Greeks:", netGreeks);
        return netGreeks;
    }

    /**
     * ========================================================================
     * State Management & Calculation Logic (ENHANCED)
     * ========================================================================
     */

     /** Applies user overrides to a deep copy of base definitions */
     function applyUserOverrides(baseDefinitions, overrides) {
        if (!baseDefinitions) return null; // No base defs
        if (!overrides || Object.keys(overrides).length === 0) return JSON.parse(JSON.stringify(baseDefinitions)); // No overrides, return copy

        logger.info("Applying user overrides to strategy definitions...");
        const modifiedDefs = JSON.parse(JSON.stringify(baseDefinitions)); // Deep copy

        for (const categoryKey in modifiedDefs) {
            if (Array.isArray(modifiedDefs[categoryKey])) {
                modifiedDefs[categoryKey].forEach(strategyDef => {
                    const override = overrides[strategyDef.id];
                    if (override) {
                        logger.debug(`Applying overrides for strategy: ${strategyDef.id}`);
                        // Override quantity
                        if (typeof override.quantity === 'number' && override.quantity >= 1) {
                            strategyDef.parameters.quantity = override.quantity;
                        } else if (override.hasOwnProperty('quantity')) { // Handle potential invalid override value
                             logger.warn(`Invalid quantity override (${override.quantity}) for ${strategyDef.id}, using default.`);
                        }
                        // Override leg parameters (strike, ivOverride)
                        if (Array.isArray(override.legs) && Array.isArray(strategyDef.parameters.legs)) {
                             // Ensure override length matches definition length for safety
                             const numLegs = strategyDef.parameters.legs.length;
                             override.legs.slice(0, numLegs).forEach((legOverride, index) => { // Use slice to prevent index out of bounds
                                const legDef = strategyDef.parameters.legs[index];
                                if (legDef && legOverride) { // Check both exist
                                     // Apply strike override
                                     if (typeof legOverride.strike === 'number' && legOverride.strike > 0) {
                                         legDef.strike = legOverride.strike;
                                     } else if (legOverride.hasOwnProperty('strike')) {
                                         logger.warn(`Invalid strike override (${legOverride.strike}) for ${strategyDef.id} leg ${index+1}, using default.`);
                                     }
                                     // Apply IV override
                                     if (typeof legOverride.ivOverride === 'number' && legOverride.ivOverride > 0) {
                                          legDef.ivOverride = legOverride.ivOverride;
                                     } else {
                                          // If override exists but is invalid/null/empty, remove it from the definition copy
                                          delete legDef.ivOverride;
                                     }
                                }
                            });
                        }
                        // Handle single leg strategy overrides (less common structure now)
                         else if (strategyDef.parameters.strike !== undefined && Array.isArray(override.legs) && override.legs[0]) {
                              const legOverride = override.legs[0];
                              if (typeof legOverride.strike === 'number' && legOverride.strike > 0) {
                                 strategyDef.parameters.strike = legOverride.strike;
                              }
                               if (typeof legOverride.ivOverride === 'number' && legOverride.ivOverride > 0) {
                                  strategyDef.parameters.ivOverride = legOverride.ivOverride;
                              } else {
                                   delete strategyDef.parameters.ivOverride;
                              }
                         }
                    }
                });
            }
        }
        return modifiedDefs;
    }


    /** Recalculates values for ONE strategy definition (including overrides) */
    function recalculateSingleStrategy(strategyDefinition) {
        logger.debug(`Recalculating single: ${strategyDefinition.id || strategyDefinition.name}`);
        if (!strategyDefinition?.parameters) return null;

        const { underlyingPrice: S, dte, rate: rPercent, vol: globalVPercent, dividendYield: qPercent, binomialSteps } = appState.globalInputs;
        // ... (Validate global inputs) ...
        const T = dte / DAYS_PER_YEAR; const r = rPercent / 100.0; const q = qPercent / 100.0; const globalV = globalVPercent / 100.0;

        const calculateFunc = appState.pricingModel === 'Binomial' ? binomialTreePricer : blackScholes;
        const modelArgs = { S, T, r, q };
        if (appState.pricingModel === 'Binomial') modelArgs.steps = binomialSteps;

        const calculatedStrategy = JSON.parse(JSON.stringify(strategyDefinition)); // Deep copy
        let calculationSuccess = true;
        let overallNetPremium = 0; let netType = 'N/A';
        const strategyQuantity = calculatedStrategy.parameters.quantity || 1;

        // --- Calculate Legs ---
        const processLeg = (leg) => { /* ... (As before: uses overrides, calculates price/greeks) ... */ };
        if (calculatedStrategy.parameters.legs) calculatedStrategy.parameters.legs.forEach(leg => processLeg(leg));
        else if (calculatedStrategy.parameters.type) processLeg(calculatedStrategy.parameters); // Single leg
        else calculationSuccess = false;

        // --- Calculate Net Greeks & Premium ---
        calculatedStrategy.calculatedNetGreeks = calculateNetGreeks(/* ... */);
        // ... (Determine overallNetPremium, netType based on leg results) ...
        calculatedStrategy.calculatedNet = { premium: overallNetPremium, type: netType };

        // --- Calculate Numerical Breakevens ---
        calculatedStrategy.calculatedBreakevens = [];
        if (calculationSuccess) {
             const payoffAtExpiry = (priceAtExpiry) => { /* ... define using calculated premiums ... */ };
             // ... (Define search range) ...
             calculatedStrategy.calculatedBreakevens = findBreakevens(payoffAtExpiry, searchMin, searchMax, strategyQuantity);
        }

        // --- Calculate Theoretical Max P/L ---
        calculatedStrategy.calculatedMaxPL = calculateTheoreticalMaxPL(calculatedStrategy);

        if (!calculationSuccess) logger.warn(/* ... */);
        return calculatedStrategy;
    }


    /** Recalculates ALL strategies and updates `appState.calculatedStrategies` */
    function recalculateAllStrategies() {
        logger.info(`Recalculating all strategies using ${appState.pricingModel} model.`);
        if (appState.calculationInProgress) {
             logger.warn("Calculation already in progress, skipping redundant call.");
             return false; // Avoid concurrent calculations
        }
         if (!appState.strategyDefinitions) { /* Handle error */ return false; }

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
                        const result = recalculateSingleStrategy(def);
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
    function calculateTheoreticalMaxPL(calculatedStrategy) { /* ... As implemented before ... */ }

    /**
     * ========================================================================
     * DOM Manipulation and Rendering (ENHANCED)
     * ========================================================================
     * Functions to update the UI based on `appState`.
     */

     /** Clears content and status areas, purges Plotly charts */
     function clearContentAreas() {
         DOM.contentContainer.innerHTML = '';
         DOM.statusMessageArea.innerHTML = '';
         // Purge Plotly charts to release memory
         const charts = DOM.contentContainer.querySelectorAll('.plotly-chart-container');
         charts.forEach(chartDiv => {
             if (chartDiv._fullLayout && typeof Plotly !== 'undefined') {
                 try { Plotly.purge(chartDiv); } catch (e) { /* Ignore purge errors */ }
             }
         });
         logger.debug("Content areas cleared and charts purged.");
     }

    /** Updates the status message area */
    function updateStatusMessage() {
         DOM.statusMessageArea.innerHTML = ''; // Clear previous
         let message = appState.infoMessage || appState.error || (appState.isLoading ? 'Loading...' : '');
         let className = 'status-message';

         if (appState.isLoading) className += ' loading-message';
         else if (appState.error) className += ' error-message';
         else if (appState.infoMessage) className += ' info-message';
         else if (appState.isOffline && !appState.calculatedStrategies) className += ' offline-message';
         else if (!appState.calculatedStrategies && !appState.isLoading) { message = 'No data available.'; className += ' error-message'; }

         if (message) {
             const msgDiv = document.createElement('div');
             msgDiv.className = className;
             msgDiv.textContent = message;
             DOM.statusMessageArea.appendChild(msgDiv);
         }
         // Clear info message after displaying it once
         if (appState.infoMessage) appState.infoMessage = null;
    }

    /** Updates header status indicators */
    function updateStatusIndicators() {
         DOM.statusIndicators.innerHTML = ''; // Clear existing
         let indicatorsHTML = '';
         // Data Source Tag
         if (appState.dataSource) {
            let colorClass = 'tag-source-initial'; // Default
            switch(appState.dataSource) {
                case 'Network': colorClass = 'tag-source-network'; break;
                case 'Cache': colorClass = 'tag-source-cache'; break;
                case 'IndexedDB': colorClass = 'tag-source-indexeddb'; break;
                case 'None': case 'Error': colorClass = 'tag-source-none'; break;
            }
            indicatorsHTML += `<span class="w3-tag w3-round ${colorClass}">Data: ${appState.dataSource}</span>`;
         }
         // Offline Tag
         if (appState.isOffline) {
             indicatorsHTML += `<span class="w3-tag w3-round tag-offline w3-margin-left">Offline</span>`;
         }
         DOM.statusIndicators.innerHTML = indicatorsHTML;
    }

    /** Renders sidebar links based on available strategy DEFINITIONS */
    function renderSidebarLinks() { /* ... as before ... */ }

    /** Renders the About section from DEFINITIONS */
    function renderAboutSection() { /* ... as before ... */ }

    /** Updates the 'active' class on sidebar links */
    function updateSidebarActiveState() { /* ... as before ... */ }

    /** Creates the HTML for a single strategy detail panel (using CALCULATED data) */
    function createStrategyDetailPanel(calculatedStrategy) {
        // ... (Get panel element, set data-strategy-id) ...

        // --- Helpers ---
        // ... (createHeading, createDetailPara, createListSection, createDetailSection, formatGreek) ...

        // --- Build Panel HTML ---
        let panelHTML = createHeading(calculatedStrategy.name);
        // ... (Basic Info: Outlook, Desc) ...

        // --- Parameters Section with Inputs ---
        panelHTML += `<div class="strategy-params-section"><h5>Parameters & Construction</h5>`;
        // Quantity Input
        panelHTML += `<div class="param-input-group"><label ...>Quantity:</label><input type="number" id="qty_${calculatedStrategy.id}" class="strategy-input" data-strategy-id="${calculatedStrategy.id}" data-param="quantity" min="1" value="${calculatedStrategy.parameters.quantity || 1}" required> ... </div>`;
        // Leg Inputs (Strike & IV Override)
        if (calculatedStrategy.parameters?.legs) {
             calculatedStrategy.parameters.legs.forEach((leg, index) => {
                 panelHTML += `<div class="param-input-group">
                               <label ...>Leg ${index + 1} (...):</label>
                               <input type="number" id="strike_${calculatedStrategy.id}_${index}" class="strategy-input" ... value="${leg.strike}" ...>
                               <label ...>IV%:</label>
                               <input type="number" id="iv_${calculatedStrategy.id}_${index}" class="strategy-input iv-override" ... value="${leg.ivOverride || ''}" placeholder="${appState.globalInputs.vol.toFixed(1)}" ...>
                             </div>`;
             });
        } else { /* Single leg inputs */ }
        if (calculatedStrategy.construction) panelHTML += createListSection(calculatedStrategy.construction, "Structure");
        if (calculatedStrategy.notes) panelHTML += `<p class="strategy-notes"><em>Note: ${calculatedStrategy.notes}</em></p>`;
        panelHTML += `</div>`; // End params section

        // --- Calculated Values ---
        panelHTML += `<div class="strategy-detail-section"><strong>Theoretical Value <span class="model-name-display">(${appState.pricingModel})</span>:</strong>`;
        const netCalc = calculatedStrategy.calculatedNet;
        if (netCalc && netCalc.type !== 'Error') {
            panelHTML += ` Net ${netCalc.type}: <span class="calculated-value">${'$'+netCalc.premium.toFixed(2)}</span>`;
        } else { panelHTML += ` <span class="calculated-value">Error</span>`; }
        panelHTML += `<span class="point-value-note">($${ES_POINT_VALUE}/pt Multiplier applies)</span></div>`;

        // --- Greeks Table (Net) ---
        let greeksHTML = `<div class="strategy-detail-section"><strong>Net Strategy Greeks (Approximate):</strong>`;
        const netGreeks = calculatedStrategy.calculatedNetGreeks;
        if (netGreeks && !netGreeks.error) {
             greeksHTML += `<table class="greeks-table"> ... (Table with Net Delta, Gamma, Vega, Theta, Rho using formatGreek(netGreeks.X)) ... </table>`;
        } else { greeksHTML += `<p><small><i>Net Greeks calculation failed or not applicable.</i></small></p>`; }
        greeksHTML += `</div>`;
        panelHTML += greeksHTML;

        // --- Structural & Calculated Metrics ---
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
        if (calculatedStrategy.plotlyDivId) panelHTML += `<div id="${calculatedStrategy.plotlyDivId}" class="plotly-chart-container"></div>`;

        // Example & Action Buttons
        if (calculatedStrategy.example) panelHTML += `<p class="strategy-example"><em>Example: ${calculatedStrategy.example}</em></p>`;
        panelHTML += `<div class="panel-actions">
                        <button class="w3-button recalculate-button action-button" data-strategy-id="${calculatedStrategy.id}" title="Recalculate this strategy using current parameters"><i class="fa fa-calculator"></i> Recalculate This Strategy</button>
                        <button class="w3-button w3-light-grey w3-small action-button calendar-button" data-strategy-name="${calculatedStrategy.name || 'Unknown'}"><i class="fa fa-calendar-plus-o"></i> Add to Calendar (Placeholder)</button>
                      </div>`;

        panel.innerHTML = panelHTML;
        // Add pending modification style if needed (based on comparison with overrides maybe?)
        if (appState.userOverrides[calculatedStrategy.id]) {
            // Simple check: if overrides exist, mark as potentially needing recalc (user might have changed *global* inputs since last panel recalc)
            // A more complex check would compare current calculated params vs override state.
             // panel.classList.add('modified-pending');
             // Could also check a timestamp on the override vs last calculation timestamp.
        }

        return panel;
    }

    /** Renders the currently selected section */
    function renderCurrentSection() { /* ... (As implemented before, orchestrates checks, recalc ALL if needed, renders section) ... */ }

    /** Renders a strategy section using CALCULATED data */
    function renderStrategySection(sectionKey) { /* ... (As implemented before, uses createStrategyDetailPanel & renderPlotlyChart) ... */ }

    /** Re-renders a single strategy panel */
    function renderSingleStrategyPanel(strategyId) { /* ... (As implemented before, calls createStrategyDetailPanel & renderPlotlyChart) ... */ }

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

        // Check if calculation was successful
        if (calculatedStrategy.calculatedNet?.type === 'Error') {
             plotContainer.innerHTML = `<p class="error-message">Calculation error prevents chart rendering.</p>`;
             return;
        }

        // Get traces and base layout from specific plot function
        if (calculatedStrategy.plotFunction && calculatedStrategy.parameters && plotFunctions[calculatedStrategy.plotFunction]) {
            try {
                // The plot function should return { traces: [], layout: { title: { text: '...' } } }
                // It uses the calculated data embedded within calculatedStrategy.parameters
                const { traces, layout: baseLayout } = plotFunctions[calculatedStrategy.plotFunction](calculatedStrategy.parameters);

                // Generate the final enhanced layout using calculated metrics
                const finalLayout = getPlotlyLayout(baseLayout.title.text, calculatedStrategy);

                // Filter traces based on chart settings
                const tracesToShow = traces.filter(trace =>
                    trace.name?.toLowerCase().includes('net p/l') || appState.chartSettings.showLegs
                );

                 // Add Profit/Loss Shading if enabled
                 if (appState.chartSettings.shadeProfitLoss && tracesToShow.length > 0) {
                      const netTrace = tracesToShow.find(t => t.name?.toLowerCase().includes('net p/l'));
                      if (netTrace && netTrace.x && netTrace.y) {
                         // Create shapes for shading based on the net profit line crossing zero
                         const xData = netTrace.x;
                         const yData = netTrace.y;
                         let startX = null;
                         for(let i = 0; i < xData.length; i++) {
                             const currentY = yData[i];
                             const isProfit = currentY > NUMERICAL_PRECISION; // Add tolerance
                             const isLoss = currentY < -NUMERICAL_PRECISION;

                             if ((isProfit || isLoss) && startX === null) {
                                 startX = xData[i]; // Start of a shaded region
                             } else if (startX !== null && (!isProfit && !isLoss)) {
                                 // End of region (crossed zero or near zero)
                                 const endX = xData[i];
                                 const lastY = yData[i-1]; // Use previous point to determine zone type
                                 finalLayout.shapes.push({
                                     type: 'rect', xref: 'x', yref: 'paper',
                                     x0: startX, y0: 0, x1: endX, y1: 1,
                                     fillcolor: lastY > 0 ? 'rgba(0, 200, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)', // Light green/red
                                     layer: 'below', line: { width: 0 }
                                 });
                                 startX = null; // Reset for next region
                             }
                         }
                          // Handle case where region extends to the end
                          if (startX !== null) {
                                const endX = xData[xData.length - 1];
                                const lastY = yData[yData.length -1];
                                finalLayout.shapes.push({
                                     type: 'rect', xref: 'x', yref: 'paper',
                                     x0: startX, y0: 0, x1: endX, y1: 1,
                                     fillcolor: lastY > 0 ? 'rgba(0, 200, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                                     layer: 'below', line: { width: 0 }
                                 });
                          }
                      }
                 }


                // Draw the plot
                Plotly.newPlot(plotContainer, tracesToShow, finalLayout, { responsive: true, displaylogo: false });

            } catch (plotError) {
                logger.error(`Error rendering Plotly chart ${calculatedStrategy.plotlyDivId}:`, plotError);
                plotContainer.innerHTML = `<p class="error-message">Chart Error: ${plotError.message}</p>`;
            }
        } else {
             plotContainer.innerHTML = `<p class="info-message">Plotting function not defined for this strategy.</p>`;
        }
    }

    /** Enhanced Plotly layout generator */
    function getPlotlyLayout(title, calculatedStrategy) {
        // ... (Base layout definition as before: title, axes, legend, margins, hovermode) ...
         const layout = { /* ... base layout ... */ shapes: [], annotations: [] };
         const params = calculatedStrategy.parameters; // Contains legs with calculated data
         const S = appState.globalInputs.underlyingPrice;
         const prices = generatePriceRange(S, PLOT_PRICE_RANGE_FACTOR * 1.1); // Wider range for context
         layout.xaxis.range = [prices[0], prices[prices.length - 1]]; // Set initial X range
         const yRangeLimits = {min: null, max: null}; // Track min/max for Y axis


         // --- Add Lines & Annotations ---
         const addShape = (shape) => layout.shapes.push(shape);
         const addAnnotation = (anno) => layout.annotations.push(anno);
         const addVerticalLine = (xVal, color, dash = 'dash', text = null, textY = 0.95, textAnchor = null) => {
            // ... (Implementation as before, updating yRangeLimits and layout.xaxis.range) ...
         };
         const addHorizontalLine = (yVal, color, dash = 'dash', text = null, textAnchor = 'left') => {
              // ... (Implementation as before, updating yRangeLimits) ...
         };

         // 1. Zero P/L Line (always add)
         addHorizontalLine(0, 'rgba(50, 50, 50, 0.8)', 'solid', 'P/L = 0');

         // 2. Current Underlying Price
         addVerticalLine(S, 'rgba(255, 140, 0, 0.9)', 'solid', `Current ${S.toFixed(2)}`, 0.85);

         // 3. Strike Prices
         const strikes = new Set();
         params?.legs?.forEach(leg => strikes.add(leg.strike));
         if (!params?.legs && params?.strike) strikes.add(params.strike);
         strikes.forEach(k => addVerticalLine(k, 'rgba(100, 100, 100, 0.7)', 'dot', `K ${k}`, 0.9));

         // 4. Calculated Break-evens
         calculatedStrategy.calculatedBreakevens?.forEach(be => {
              if (be !== null && !isNaN(be)) {
                  addVerticalLine(be, 'rgba(34, 139, 34, 0.9)', 'dashdot', `BE ${be.toFixed(2)}`, 0.8);
              }
         });

         // 5. Calculated Max Profit / Max Loss
         const maxPL = calculatedStrategy.calculatedMaxPL;
         if (maxPL) {
             if (maxPL.maxProfit !== Infinity && maxPL.maxProfit !== null && !isNaN(maxPL.maxProfit)) {
                 addHorizontalLine(maxPL.maxProfit, 'rgba(0, 150, 0, 0.8)', 'dash', `Max Profit: ${maxPL.maxProfit.toFixed(2)}`);
             }
             if (maxPL.maxLoss !== -Infinity && maxPL.maxLoss !== null && !isNaN(maxPL.maxLoss)) {
                 addHorizontalLine(maxPL.maxLoss, 'rgba(200, 0, 0, 0.8)', 'dash', `Max Loss: ${maxPL.maxLoss.toFixed(2)}`);
             }
         }

         // --- Adjust Y Axis Range ---
         // Find min/max from the Net P/L trace data (if available)
          const netTrace = calculatedStrategy.plotFunction && plotFunctions[calculatedStrategy.plotFunction]
                              ? plotFunctions[calculatedStrategy.plotFunction](params).traces.find(t=>t.name?.toLowerCase().includes('net p/l'))
                              : null;
          if (netTrace && netTrace.y?.length > 0) {
                const yData = netTrace.y.filter(y => !isNaN(y) && isFinite(y)); // Filter out invalid numbers
                if (yData.length > 0) {
                    const dataMin = Math.min(...yData);
                    const dataMax = Math.max(...yData);
                    // Combine with Max P/L lines for overall range
                    const finalMin = Math.min(dataMin, yRangeLimits.min ?? dataMin, maxPL?.maxLoss ?? dataMin);
                    const finalMax = Math.max(dataMax, yRangeLimits.max ?? dataMax, maxPL?.maxProfit ?? dataMax);
                    // Add padding
                    const padding = (finalMax - finalMin) * 0.1 || Math.abs(finalMin || finalMax || 1) * 0.2; // Ensure some padding even if flat
                    layout.yaxis.range = [finalMin - padding, finalMax + padding];
                }
          } else if (yRangeLimits.min !== null && yRangeLimits.max !== null) {
               // Fallback if Net trace missing, use Max P/L lines
               const padding = (yRangeLimits.max - yRangeLimits.min) * 0.1 || Math.abs(yRangeLimits.min || yRangeLimits.max || 1) * 0.2;
               layout.yaxis.range = [yRangeLimits.min - padding, yRangeLimits.max + padding];
          }

         return layout;
    }

    /**
     * ========================================================================
     * Event Handlers & Application Flow (ENHANCED)
     * ========================================================================
     */
    // --- Navigation & Basic UI ---
    function handleNavLinkClick(event) { /* ... */ }
    function handleCalendarButtonClick(event) { /* ... */ }
    function handleRefreshDataClick() { initializeApp(true); } // Reload definitions
    function updateNetworkStatus() { /* ... (calls initializeApp(true) on reconnect) ... */ }
    function w3_open() { /* ... */ } function w3_close() { /* ... */ }
    function trackGAPageView(section) { /* ... */ }

    // --- Global Input Handling ---
    function handleGlobalInputChange(event) {
        // ... (Read input, update appState.globalInputs) ...
        if (changed) {
            appState.bsInputsChangedSinceLastRender = true; // Mark global state dirty
            renderCurrentSection(); // Trigger full recalculation & re-render
        }
    }

    // --- Strategy Input Handling ---
    function handleStrategyInputChange(event) {
        // ... (Read input, get strategyId, param, legIndex, value) ...
        // ... (Basic validation) ...
        if (isValid) {
            updateUserOverrideState(strategyId, param, legIndex, value); // Update override OBJECT
            // Mark panel visually as modified (e.g., change border color, highlight recalc button)
             const panel = event.target.closest('.strategy-panel');
             if (panel) panel.classList.add('modified-pending');
             const recalcButton = panel?.querySelector('.recalculate-button');
             if (recalcButton) recalcButton.classList.add('w3-pale-yellow');
             event.target.classList.remove('w3-border-red');
        } else { /* Mark input as invalid */ }
    }

    // --- Strategy Recalculate Handling ---
    function handleStrategyRecalculateClick(event) {
        const button = event.target.closest('.recalculate-button');
        if (!button) return;
        const strategyId = button.dataset.strategyId;
        logger.log(`Recalculate button clicked for strategy: ${strategyId}`);

        // --- Find definition WITH current overrides applied ---
        let strategyDef = null; let categoryKey = null;
        // ... (Find base definition) ...
        if (!strategyDef) return logger.error(`Definition not found: ${strategyId}`);
        const definitionWithOverrides = applyUserOverrides({ [categoryKey]: [strategyDef] }, appState.userOverrides)[categoryKey][0];
        // --- End finding definition ---

        // Recalculate this single strategy
        const updatedCalculatedStrategy = recalculateSingleStrategy(definitionWithOverrides);

        if (updatedCalculatedStrategy && updatedCalculatedStrategy.calculatedNet.type !== 'Error') {
            // --- Update the specific strategy in appState.calculatedStrategies ---
            if (appState.calculatedStrategies?.[categoryKey]) {
                const index = appState.calculatedStrategies[categoryKey].findIndex(s => s.id === strategyId);
                if (index > -1) appState.calculatedStrategies[categoryKey][index] = updatedCalculatedStrategy;
            }
            // --- Re-render ONLY this panel ---
            renderSingleStrategyPanel(strategyId); // Uses the updated data from calculatedStrategies
            // Reset visual cues
             const panel = button.closest('.strategy-panel');
             if (panel) panel.classList.remove('modified-pending');
             button.classList.remove('w3-pale-yellow');
        } else { updateStatusMessageInternal(`Recalculation failed for ${strategyId}.`, "error-message", 3000); }
    }

    // --- localStorage Button Handlers ---
    function handleSaveOverrides() { saveUserOverridesToLocalStorage(); }
    function handleLoadOverrides() {
        if (loadUserOverridesFromLocalStorage()) {
             // Overrides loaded into appState.userOverrides, now re-initialize
             // to apply them to definitions and recalculate everything.
             initializeApp(false); // False = don't force fetch, just apply overrides & recalc
        }
    }
    function handleClearOverrides() { clearUserOverrides(); }


    /** Helper for temporary info/error messages */
    let statusTimeoutId = null;
    function updateStatusMessageInternal(message, className = 'info-message', duration = 3000) {
        clearTimeout(statusTimeoutId); // Clear previous timeout
        DOM.statusMessageArea.innerHTML = ''; // Clear area
        if (message) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `status-message ${className}`;
            msgDiv.textContent = message;
            DOM.statusMessageArea.appendChild(msgDiv);
            // Set timeout to clear the message
            statusTimeoutId = setTimeout(() => {
                if (DOM.statusMessageArea.firstChild === msgDiv) { // Ensure it's the same message
                    DOM.statusMessageArea.innerHTML = '';
                }
            }, duration);
        }
    }

    /**
     * ========================================================================
     * Data Loading and Initialization (ENHANCED)
     * ========================================================================
     */
    async function initializeApp(forceRefresh = false) {
        logger.log(`>>> Initializing Application V2 - Force Refresh: ${forceRefresh}`);
        appState.isLoading = true; appState.error = null; appState.infoMessage = null;
        renderCurrentSection(); // Show initial loading state

        let loadedDefs = null; let source = 'Initial'; // Assume embedded initially if exists

        try {
            // --- Load Strategy DEFINITIONS (Network > Cache > DB > Embedded) ---
             // ... (Fetch, Cache, DB logic as before) ...

            // --- Process Loaded Definitions ---
             if (loadedDefs) {
                 appState.strategyDefinitions = loadedDefs; // Store base definitions
                 appState.dataSource = source;
                 logger.info(`Base definitions loaded from: ${source}`);
                 appState.error = null; // Clear loading errors if defs found
             } else {
                 logger.error("Failed to load strategy definitions from any source.");
                 appState.strategyDefinitions = null;
                 appState.calculatedStrategies = null;
                 appState.dataSource = 'None';
                 appState.error = "Could not load required strategy definitions.";
             }

        } catch (initError) {
             logger.error("Critical Initialization Error:", initError);
             appState.error = `Application failed to initialize: ${initError.message || initError}`;
             appState.strategyDefinitions = null; appState.calculatedStrategies = null; appState.dataSource = 'Error';
        } finally {
            appState.isLoading = false; // Loading finished (even if failed)
             if (appState.lastFetchTimestamp) DOM.lastUpdated.textContent = `Defs source checked: ${appState.lastFetchTimestamp.toLocaleTimeString()}`;
            DOM.refreshDataButton.disabled = appState.isOffline || appState.isLoading;
        }

        // --- Initial Render ---
        // This needs to happen *after* loading definitions and potentially overrides
        renderSidebarLinks(); // Build sidebar first
        // Then trigger the first full calculation & render cycle
        renderCurrentSection(); // This calls recalculateAllStrategies if needed
        logger.log(">>> Application Initialization Complete <<<");
    }

    /**
     * ========================================================================
     * Conceptual Placeholders & Initialization Trigger
     * ========================================================================
     */
    function conceptualSecretUsage() { /* ... as before ... */ }

    // --- DOMContentLoaded Event Listener ---
    document.addEventListener('DOMContentLoaded', () => {
        logger.log("DOM Content Loaded. Setting up listeners and initializing V2...");

        // --- Setup Event Listeners ---
        // Sidebar, Overlay, Network, Refresh
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
        DOM.contentContainer?.addEventListener('click', handleCalendarButtonClick);
        DOM.contentContainer?.addEventListener('change', handleStrategyInputChange); // Use 'change' for inputs usually
        DOM.contentContainer?.addEventListener('click', handleStrategyRecalculateClick);
        // localStorage Buttons
        DOM.saveModsButton?.addEventListener('click', handleSaveOverrides);
        DOM.loadModsButton?.addEventListener('click', handleLoadOverrides);
        DOM.clearModsButton?.addEventListener('click', handleClearOverrides);
        // Chart Settings Listener (if controls added)
        // DOM.chartSettingsContainer?.addEventListener('change', handleChartSettingsChange);


        // --- Set Initial Global Input Values ---
        // ... (Set ALL global input values from appState.globalInputs) ...

        // --- Log Placeholders ---
        conceptualSecretUsage();

        // --- Start Application ---
        loadUserOverridesFromLocalStorage(); // Load overrides *before* first calculation
        initializeApp(); // Load definitions, apply overrides, calculate, render
    });

})(); // End IIFE
