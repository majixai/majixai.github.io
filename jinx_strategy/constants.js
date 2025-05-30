import React from 'react'; // This will need to be available globally or via CDN
import { OptionType, Action } from './types.js'; // Assuming types.js is in the same directory

export const MAX_LEGS = 10;
export const DEFAULT_POINT_VALUE = "100";
export const DEFAULT_NUM_POINTS = "200";
export const DB_NAME = 'OptionPlotterDB';
export const DB_VERSION = 5; // Incremented DB_VERSION for new store
export const PLOT_OPTIONS_STORE_NAME = 'plotOptionsStore';
export const LEGS_STORE_NAME = 'legsStore';
export const APP_STATE_STORE_NAME = 'appStateStore';
export const GITHUB_SETTINGS_STORE_NAME = 'githubSettingsStore';
export const HISTORICAL_BULLISH_SUGGESTIONS_STORE_NAME = 'historicalBullishSuggestionsStore';
export const SQLITE_DB_STORE_NAME = 'sqliteDbStore';
export const SQLITE_DB_FILE_KEY = 'sqliteDbFile';
export const FMP_CACHE_STORE_NAME = 'fmpCacheStore';
export const FMP_HISTORICAL_CACHE_STORE_NAME = 'fmpHistoricalCacheStore'; // New store name
export const PRICE_PROJECTIONS_HISTORY_TABLE_NAME = 'price_projection_history';

export const SINGLE_ITEM_KEY = 'current';

// New Color Palette
export const DUKE_BLUE = '#001A57'; // Primary
export const STANFORD_CARDINAL_RED = '#8C1515'; // Accent/Warning
export const OREGON_GREEN = '#154734'; // Positive/Bullish
export const OREGON_YELLOW = '#FEE123'; // Highlight/Attention
export const LIGHT_NEUTRAL_BACKGROUND = '#F0F4F8'; // Main app background
export const PANEL_BACKGROUND = '#FFFFFF'; // For panels
export const TEXT_COLOR_PRIMARY = '#1A202C'; // Dark gray for text (Tailwind gray-800)
export const TEXT_COLOR_SECONDARY = '#4A5568'; // Medium gray for text (Tailwind gray-600)
export const BORDER_COLOR = '#CBD5E0'; // Light gray for borders (Tailwind gray-400)


// FMP Constants
export const FMP_API_BASE_URL = 'https://financialmodelingprep.com/api/v3';
export const FMP_API_KEYS = [
  "BVkrsPt4yVls2mqGj7I940rkBWHkh2p7",
  "GjvRcffgBuM2aKbRniZhkNNJSCGczkTb",
  "0RmtzaahLcfZWdJdTQ4uorxCcoTLHUGC",
  "xozaFTVLQUGUq2hYf47xODFrCrt6DLVO",
  "KtvhRgQ4dMNuwY2TLwFkYosGOXNxThV3"
];
let currentFMPKeyIndex = 0;
export const getFMPApiKey = () => {
  const key = FMP_API_KEYS[currentFMPKeyIndex];
  currentFMPKeyIndex = (currentFMPKeyIndex + 1) % FMP_API_KEYS.length;
  return key;
};
export const PREDEFINED_TICKERS_FOR_PREFETCH = ["SPY"]; // Reduced to 1 ticker
export const FMP_PROFILE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
export const FMP_QUOTE_CACHE_DURATION = 4 * 60 * 60 * 1000;   // 4 hours (simplified)
export const FMP_HISTORICAL_CACHE_DURATION_DAILY = 24 * 60 * 60 * 1000; // 24 hours for daily data
export const FMP_HISTORICAL_CACHE_DURATION_INTRADAY = 1 * 60 * 60 * 1000; // 1 hour for intraday data


// SQLite Table Name
export const AI_INTERACTIONS_TABLE_NAME = 'ai_interactions';
export const FMP_PROFILES_TABLE_NAME = 'fmp_profiles';
export const FMP_QUOTES_TABLE_NAME = 'fmp_quotes';

/**
 * @type {import('./types.js').PredefinedStrategy[]}
 */
export const PREDEFINED_STRATEGIES = [
  {
    name: "Select a Strategy...",
    legs: [],
  },
  // Basic
  { name: "Long Call", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Call" }] },
  { name: "Short Call", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Call" }] },
  { name: "Long Put", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Put" }] },
  { name: "Short Put (Cash-Secured)", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Put" }] },
  // Spreads - Vertical
  { name: "Bull Call Spread", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Lower Strike Call" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Higher Strike Call" }] },
  { name: "Bear Call Spread", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Lower Strike Call" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Higher Strike Call" }] },
  { name: "Bull Put Spread", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Higher Strike Put" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Lower Strike Put" }] },
  { name: "Bear Put Spread", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Higher Strike Put" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Lower Strike Put" }] },
  // Volatility
  { name: "Long Straddle", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ATM Call" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ATM Put" }] },
  { name: "Short Straddle", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ATM Call" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ATM Put" }] },
  { name: "Long Strangle", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy OTM Call" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy OTM Put" }] },
  { name: "Short Strangle", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put" }] },
  { name: "Strap (Long Vol, Bullish Bias)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 2, role: "Buy ATM Calls (Qty 2)" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ATM Put (Qty 1)" }] },
  { name: "Strip (Long Vol, Bearish Bias)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ATM Call (Qty 1)" },{ type: OptionType.Put, action: Action.Buy, quantity: 2, role: "Buy ATM Puts (Qty 2)" }] },
  { name: "Gut Straddle (Long ITM Straddle)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ITM Call" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ITM Put" }] },
  // Butterflies & Condors
  { name: "Long Call Butterfly", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Lower Wing Call (K1)" },{ type: OptionType.Call, action: Action.Sell, quantity: 2, role: "Sell Body Calls (K2, Qty 2)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Upper Wing Call (K3)" }] },
  { name: "Long Put Butterfly", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Upper Wing Put (K1)" },{ type: OptionType.Put, action: Action.Sell, quantity: 2, role: "Sell Body Puts (K2, Qty 2)" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Lower Wing Put (K3)" }] },
  { name: "Iron Butterfly", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy OTM Put Wing" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ATM Put Body" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ATM Call Body" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy OTM Call Wing" }] },
  { name: "Iron Condor", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Far OTM Put (Lowest K)" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far OTM Call (Highest K)" }] },
  { name: "Short Call Butterfly", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Lower Wing Call (K1)" },{ type: OptionType.Call, action: Action.Buy, quantity: 2, role: "Buy Body Calls (K2, Qty 2)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Upper Wing Call (K3)" }] },
  { name: "Short Put Butterfly", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Upper Wing Put (K1)" },{ type: OptionType.Put, action: Action.Buy, quantity: 2, role: "Buy Body Puts (K2, Qty 2)" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Buy Lower Wing Put (K3)" }] },
  { name: "Reverse Iron Butterfly", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put Wing" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ATM Put Body" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ATM Call Body" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call Wing" }] },
  { name: "Reverse Iron Condor", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Far OTM Put (Lowest K)" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy OTM Put" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy OTM Call" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Far OTM Call (Highest K)" }] },
  // Ladders & Ratio Spreads
  { name: "Long Call Ladder", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ITM Call (Lowest K)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ATM Call (Middle K)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call (Highest K)" }] },
  { name: "Long Put Ladder", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ITM Put (Highest K)" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ATM Put (Middle K)" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put (Lowest K)" }] },
  { name: "Call Ratio Spread (1x2 Sell)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Lower K Call (Qty 1)" }, { type: OptionType.Call, action: Action.Sell, quantity: 2, role: "Sell Higher K Calls (Qty 2)" }] },
  { name: "Put Ratio Spread (1x2 Sell)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Higher K Put (Qty 1)" }, { type: OptionType.Put, action: Action.Sell, quantity: 2, role: "Sell Lower K Puts (Qty 2)" }] },
  { name: "Call Ratio Backspread (1x2 Buy)", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ATM Call (Qty 1)" },{ type: OptionType.Call, action: Action.Buy, quantity: 2, role: "Buy OTM Calls (Qty 2)" }] },
  { name: "Put Ratio Backspread (1x2 Buy)", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ATM Put (Qty 1)" },{ type: OptionType.Put, action: Action.Buy, quantity: 2, role: "Buy OTM Puts (Qty 2)" }] },
  // Synthetics & Conversions
  { name: "Synthetic Long Stock", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ATM Call" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ATM Put" }] },
  { name: "Synthetic Short Stock", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ATM Call" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ATM Put" }] },
  // Complex / Multi-Leg
  { name: "Jade Lizard", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Further OTM Call (Protective)" }] },
  { name: "Long Call Condor", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far ITM Call (K1 lowest)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ITM Call (K2)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call (K3)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far OTM Call (K4 highest)" }] },
  { name: "Long Put Condor", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Far ITM Put (K1 highest)" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ITM Put (K2)" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put (K3)" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Far OTM Put (K4 lowest)" }] },
  { name: "Broken Wing Butterfly (Call, Wider Upside)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Lower Wing Call (K1)" },{ type: OptionType.Call, action: Action.Sell, quantity: 2, role: "Sell Body Calls (K2, Qty 2)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Wider Upper Wing Call (K3, K3-K2 > K2-K1)" }] },
  { name: "Broken Wing Butterfly (Put, Wider Downside)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Higher Wing Put (K1)" },{ type: OptionType.Put, action: Action.Sell, quantity: 2, role: "Sell Body Puts (K2, Qty 2)" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Wider Lower Wing Put (K3, K2-K3 > K1-K2)" }] },
  { name: "Christmas Tree Call Spread (1-3-2 Ratio)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Lower K Call (Qty 1)" },{ type: OptionType.Call, action: Action.Sell, quantity: 3, role: "Sell Middle K Calls (Qty 3)" },{ type: OptionType.Call, action: Action.Buy, quantity: 2, role: "Buy Higher K Calls (Qty 2)" }] },
  { name: "Christmas Tree Put Spread (1-3-2 Ratio)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Higher K Put (Qty 1)" },{ type: OptionType.Put, action: Action.Sell, quantity: 3, role: "Sell Middle K Puts (Qty 3)" },{ type: OptionType.Put, action: Action.Buy, quantity: 2, role: "Buy Lower K Puts (Qty 2)" }] },
  // Complex 6-leg
  { name: "Iron Condor with Far Protective Wings", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Farthest OTM Put (Outer Wing 1)" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy OTM Put (Inner Wing 2)" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Less OTM Put (Short Body 3)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Less OTM Call (Short Body 4)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy OTM Call (Inner Wing 5)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Farthest OTM Call (Outer Wing 6)" }] },
  { name: "Layered Call Butterflies (Two Butterflies)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Lower K1 Call (BFly 1)" },{ type: OptionType.Call, action: Action.Sell, quantity: 2, role: "Sell Middle K2 Calls (BFly 1, Qty 2)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Upper K3 Call (BFly 1 & Lower K BFly2)" },{ type: OptionType.Call, action: Action.Sell, quantity: 2, role: "Sell Middle K4 Calls (BFly 2, Qty 2)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Upper K5 Call (BFly 2)" }] },
  // Calendar/Diagonal Spreads
  { name: "Long Call Calendar Spread", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Near-Term ATM Call" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far-Term ATM Call" }] },
  { name: "Long Put Calendar Spread", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Near-Term ATM Put" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Far-Term ATM Put" }] },
  { name: "Double Calendar Spread (Calls)", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Near-Term OTM Call (Lower K)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far-Term OTM Call (Lower K)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Near-Term OTM Call (Higher K)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far-Term OTM Call (Higher K)" }] },
  { name: "Diagonal Call Spread (Bullish)", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Near-Term OTM Call" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far-Term ITM Call" }] },
  { name: "Diagonal Put Spread (Bearish)", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Near-Term OTM Put" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Far-Term ITM Put" }] },
  // Exotic/Variations (Original Set)
  { name: "Iron Albatross", legs: [ { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Farthest OTM Call (K4)" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Far OTM Call (K3)" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Far OTM Put (K2)" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Farthest OTM Put (K1)" } ] }, // K1<K2<K3<K4, K2-K1 < K4-K3
  { name: "Call Broken Wing Condor (Skipped Strike Butterfly)", legs: [ { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy K1 Call" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell K2 Call" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell K3 Call" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy K4 Call (K4-K3 < K2-K1)" } ] },
  { name: "Put Broken Wing Condor (Skipped Strike Butterfly)", legs: [ { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy K4 Put" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell K3 Put" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell K2 Put" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy K1 Put (K4-K3 > K2-K1)" } ] },
  { name: "Covered Call (Stock + Short Call)", legs: [ { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call (vs 100 shares)" }] },
  { name: "Protective Put (Stock + Long Put)", legs: [ { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ATM/OTM Put (vs 100 shares)" }] },
  { name: "Collar (Stock + Short Call + Long Put)", legs: [ { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy OTM Put" }] },
  { name: "Fence (Short Strangle + Protective Wings)", legs: [ { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Far OTM Put Wing" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far OTM Call Wing" } ] }, // Same as Iron Condor
  { name: "Custom Ratio Spread Call (1x3 Sell)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Lower K Call (Qty 1)" }, { type: OptionType.Call, action: Action.Sell, quantity: 3, role: "Sell Higher K Calls (Qty 3)" }] },
  { name: "Custom Ratio Spread Put (1x3 Sell)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Higher K Put (Qty 1)" }, { type: OptionType.Put, action: Action.Sell, quantity: 3, role: "Sell Lower K Puts (Qty 3)" }] },
  { name: "Call Condor Ladder (Hybrid)", legs: [ { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy K1 Call" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell K2 Call" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell K3 Call" }, { type: OptionType.Call, action: Action.Buy, quantity: 2, role: "Buy K4 Calls (Qty 2)" } ] },

  // Previously added "NEW STRATEGIES" (Approx 52 more)
  { name: "Modified Call Butterfly (Wider Lower Wing)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Lower Wing Call (K1, K2-K1 wide)" },{ type: OptionType.Call, action: Action.Sell, quantity: 2, role: "Sell Body Calls (K2, Qty 2)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Upper Wing Call (K3, K3-K2 narrow)" }] },
  { name: "Modified Put Butterfly (Wider Upper Wing)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Upper Wing Put (K1, K1-K2 wide)" },{ type: OptionType.Put, action: Action.Sell, quantity: 2, role: "Sell Body Puts (K2, Qty 2)" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Lower Wing Put (K3, K2-K3 narrow)" }] },
  { name: "Unbalanced Call Butterfly (Body near K1)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Lower Wing Call (K1)" },{ type: OptionType.Call, action: Action.Sell, quantity: 2, role: "Sell Body Calls (K2, near K1, Qty 2)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Upper Wing Call (K3)" }] },
  { name: "Unbalanced Put Butterfly (Body near K1)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Upper Wing Put (K1)" },{ type: OptionType.Put, action: Action.Sell, quantity: 2, role: "Sell Body Puts (K2, near K1, Qty 2)" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Lower Wing Put (K3)" }] },
  { name: "Skip-Strike Call Butterfly", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy K1 Call" }, { type: OptionType.Call, action: Action.Sell, quantity: 2, role: "Sell K3 Calls (Qty 2, K2 skipped)" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy K5 Call (K4 skipped)" }] },
  { name: "Skip-Strike Put Butterfly", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy K5 Put" }, { type: OptionType.Put, action: Action.Sell, quantity: 2, role: "Sell K3 Puts (Qty 2, K4 skipped)" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy K1 Put (K2 skipped)" }] },
  { name: "Short Call Condor", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Far ITM Call (K1 lowest)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ITM Call (K2)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy OTM Call (K3)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Far OTM Call (K4 highest)" }] },
  { name: "Short Put Condor", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Far ITM Put (K1 highest)" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ITM Put (K2)" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Sell OTM Put (K3)" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Buy Far OTM Put (K4 lowest)" }] },
  { name: "Call Ladder (Buy-Sell-Buy)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Lower K Call (K1)" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Middle K Call (K2)" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Higher K Call (K3)" }] },
  { name: "Put Ladder (Buy-Sell-Buy)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Higher K Put (K1)" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Middle K Put (K2)" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Lower K Put (K3)" }] },
  { name: "Short Call Ladder (Sell-Buy-Buy)", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Lower K Call (K1)" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Middle K Call (K2)" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Higher K Call (K3)" }] },
  { name: "Short Put Ladder (Sell-Buy-Buy)", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Higher K Put (K1)" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Middle K Put (K2)" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Lower K Put (K3)" }] },
  { name: "Bull Ratio Call Ladder", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ITM Call (K1 Qty 1)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ATM Call (K2 Qty 1)" },{ type: OptionType.Call, action: Action.Sell, quantity: 2, role: "Sell OTM Calls (K3 Qty 2)" }] },
  { name: "Bear Ratio Put Ladder", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ITM Put (K1 Qty 1)" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ATM Put (K2 Qty 1)" },{ type: OptionType.Put, action: Action.Sell, quantity: 2, role: "Sell OTM Puts (K3 Qty 2)" }] },
  { name: "Seagull Spread (Bullish)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ATM Call" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put" }] },
  { name: "Seagull Spread (Bearish)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ATM Put" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call" }] },
  { name: "Long Risk Reversal", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy OTM Call" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put" }] },
  { name: "Short Risk Reversal", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy OTM Put" }] },
  { name: "Box Spread (Arbitrage)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Call K1" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Put K1" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Call K2" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Put K2" }] },
  { name: "Short Gut Strangle", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ITM Call" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ITM Put (Different Strike)" }] },
  { name: "Long Gut Strangle", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ITM Call" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ITM Put (Different Strike)" }] },
  { name: "Call Spread Collar", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Lower Call (K1)" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Higher Call (K2)" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Lowest Put (K0)" }] },
  { name: "Put Spread Collar", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Higher Put (K2)" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Lower Put (K1)" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Highest Call (K3)" }] },
  { name: "Poor Man's Covered Call (Diagonal)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Long-Dated Deep ITM Call" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Near-Term OTM Call" }] },
  { name: "Poor Man's Covered Put (Diagonal)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Long-Dated Deep ITM Put" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Near-Term OTM Put" }] },
  { name: "Short Call Calendar Spread", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Near-Term ATM Call" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Far-Term ATM Call" }] },
  { name: "Short Put Calendar Spread", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Near-Term ATM Put" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Far-Term ATM Put" }] },
  { name: "Short Diagonal Call Spread", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Near-Term OTM Call" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Far-Term ITM Call" }] },
  { name: "Short Diagonal Put Spread", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Near-Term OTM Put" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Far-Term ITM Put" }] },
  { name: "Double Short Calendar (Calls)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Near-Term OTM Call (Lower K)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Far-Term OTM Call (Lower K)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Near-Term OTM Call (Higher K)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Far-Term OTM Call (Higher K)" }] },
  { name: "Iron Double Calendar Spread", legs: [
    { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Near-Term OTM Put (K1)" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Far-Term OTM Put (K1)" },
    { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Near-Term OTM Call (K2)" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far-Term OTM Call (K2)" }
  ]},
  { name: "Big Lizard (Call Type)", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ATM Call" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Further OTM Call (Protective)" }] },
  { name: "Big Lizard (Put Type)", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ATM Put" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Further OTM Put (Protective)" }] },
  { name: "Alligator Spread (Call)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ITM Call (K1)" }, { type: OptionType.Call, action: Action.Sell, quantity: 2, role: "Sell ATM Calls (K2, Qty 2)" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy OTM Call (K3)" }] },
  { name: "Alligator Spread (Put)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ITM Put (K3)" }, { type: OptionType.Put, action: Action.Sell, quantity: 2, role: "Sell ATM Puts (K2, Qty 2)" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy OTM Put (K1)" }] },
  { name: "Iron Condor (Wider Put Wing)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Far OTM Put (Wide K1-K2)" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put (K2)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call (K3)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far OTM Call (Narrow K4-K3)" }] },
  { name: "Iron Condor (Wider Call Wing)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Far OTM Put (Narrow K1-K2)" },{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put (K2)" },{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call (K3)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far OTM Call (Wide K4-K3)" }] },
  { name: "Asymmetric Iron Butterfly (Call Tilt)", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ATM Call Body" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy OTM Call Wing" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put Body" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Further OTM Put Wing" }] },
  { name: "Asymmetric Iron Butterfly (Put Tilt)", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ATM Put Body" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy OTM Put Wing" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call Body" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Further OTM Call Wing" }] },
  { name: "Call Wheel (Strategy Component)", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell OTM Call (Weekly/Monthly)" }] },
  { name: "Put Wheel (Strategy Component)", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell OTM Put (Weekly/Monthly)" }] },
  { name: "Long Straddle Ladder", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Call K1 (Straddle 1)" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Put K1 (Straddle 1)" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Call K2 (Straddle 2)" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Put K2 (Straddle 2)" }] },
  { name: "Long Strangle Ladder", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Call K1C (Strangle 1)" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Put K1P (Strangle 1)" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Call K2C (Strangle 2)" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Put K2P (Strangle 2)" }] },
  { name: "Call Butterfly Calendar", legs: [
    { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Near K1 Call (Wing)" }, { type: OptionType.Call, action: Action.Buy, quantity: 2, role: "Buy Near K2 Calls (Body Qty 2)" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Near K3 Call (Wing)" },
    { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far K1 Call (Wing)" }, { type: OptionType.Call, action: Action.Sell, quantity: 2, role: "Sell Far K2 Calls (Body Qty 2)" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far K3 Call (Wing)" }
  ]},
  { name: "Iron Condor Calendar", legs: [
    { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Near K1 Put (Wing)" }, { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Near K2 Put (Body)" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Near K3 Call (Body)" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Near K4 Call (Wing)" },
    { type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy Far K1 Put (Wing)" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell Far K2 Put (Body)" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell Far K3 Call (Body)" }, { type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy Far K4 Call (Wing)" }
  ]},
  { name: "Bear Call Ladder (Ratio Buy Heavy)", legs: [{ type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ITM Call (K1 Qty 1)" },{ type: OptionType.Call, action: Action.Buy, quantity: 1, role: "Buy ATM Call (K2 Qty 1)" },{ type: OptionType.Call, action: Action.Buy, quantity: 2, role: "Buy OTM Calls (K3 Qty 2)" }] },
  { name: "Bull Put Ladder (Ratio Buy Heavy)", legs: [{ type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ITM Put (K1 Qty 1)" },{ type: OptionType.Put, action: Action.Buy, quantity: 1, role: "Buy ATM Put (K2 Qty 1)" },{ type: OptionType.Put, action: Action.Buy, quantity: 2, role: "Buy OTM Puts (K3 Qty 2)" }] },
  { name: "Zebra (Calls - Stock Replacement)", legs: [{ type: OptionType.Call, action: Action.Buy, quantity: 2, role: "Buy Deep ITM Calls (Qty 2, ~70-90 Delta each)" }, { type: OptionType.Call, action: Action.Sell, quantity: 1, role: "Sell ATM Call (Qty 1, reduces cost)" }] },
  { name: "Zebra (Puts - Short Stock Replacement)", legs: [{ type: OptionType.Put, action: Action.Buy, quantity: 2, role: "Buy Deep ITM Puts (Qty 2, ~70-90 Delta each)" }, { type: OptionType.Put, action: Action.Sell, quantity: 1, role: "Sell ATM Put (Qty 1, reduces cost)" }] },
];

// React functional components need to be converted.
// They will rely on React being available globally (e.g., via CDN script in HTML)
// And `React.createElement` will be used instead of JSX.

export const PlusIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "currentColor",
    className: className || "bi bi-plus-circle mr-1",
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", {
      d: "M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"
    }),
    React.createElement("path", {
      d: "M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"
    })
  )
);

export const ChartIcon = ({ className: passedClassName, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "currentColor",
    className: passedClassName || "bi bi-bar-chart-line-fill mr-1",
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", {
      d: "M11 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h1V7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7h1V2z"
    })
  )
);

export const TrashIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "currentColor",
    className: className || "bi bi-trash",
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", {
      d: "M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"
    }),
    React.createElement("path", {
      fillRule: "evenodd",
      d: "M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
    })
  )
);

export const ClearIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "currentColor",
    className: className || "bi bi-eraser mr-1",
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", {
      d: "M8.086 2.207a2 2 0 0 1 2.828 0l3.879 3.879a2 2 0 0 1 0 2.828l-5.5 5.5A2 2 0 0 1 7.879 15H5.12a2 2 0 0 1-1.414-.586l-2.5-2.5a2 2 0 0 1 0-2.828l6.879-6.879zm.66 11.34L3.453 8.254 1.914 9.793a1 1 0 0 0 0 1.414l2.5 2.5a1 1 0 0 0 .707.293H7.88a1 1 0 0 0 .707-.293l.16-.16z"
    }),
    React.createElement("path", {
      d: "M12.736 3.736a1.5 1.5 0 0 0-2.121 0L6.293 8.058l2.121 2.122 4.322-4.322a1.5 1.5 0 0 0 0-2.121z"
    })
  )
);

export const DownloadIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "currentColor",
    className: `bi bi-cloud-download ${className || 'mr-1'}`,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", {
      d: "M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10.5a.5.5 0 0 1 0-1h2.188C13.939 10 15 8.984 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0 1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z"
    }),
    React.createElement("path", {
      d: "M7.646 15.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 14.293V5.5a.5.5 0 0 0-1 0v8.793l-2.146-2.147a.5.5 0 0 0-.708.708l3 3z"
    })
  )
);
export const FetchIcon = DownloadIcon;

export const InfoIcon = ({ size = 16, className = "bi bi-info-circle", style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    fill: "currentColor",
    className: className,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", {
      d: "M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"
    }),
    React.createElement("path", {
      d: "m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.064.293.006.399.287.47l.45.082.082-.38-.229-.045c-.246-.063-.262-.215-.185-.418l.738-3.468c.079-.37.036-.461-.164-.557l-.287-.075a.5.5 0 0 1-.117-.466l.082-.38zM8 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"
    })
  )
);

export const ChartInfoIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg", width: "12", height: "12",
    fill: "currentColor",
    className: className || "bi bi-info-circle inline-block ml-0.5 text-slate-500 hover:text-slate-700 cursor-help", viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", { d: "M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" }),
    React.createElement("path", { d: "m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.064.293.006.399.287.47l.45.082.082-.38-.229-.045c-.246-.063-.262-.215-.185-.418l.738-3.468c.079-.37.036-.461-.164-.557l-.287-.075a.5.5 0 0 1-.117-.466l.082-.38zM8 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" })
  )
);


export const AISuggestIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "currentColor",
    className: className || "bi bi-robot mr-1",
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", {
      d: "M6 12.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5ZM3 8.062C3 6.76 4.235 5.765 5.53 5.5H6a.5.5 0 0 1 0-1h.53C5.235 4.235 4 3.24 4 1.938V1.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v.438c0 1.302-1.235 2.297-2.03 2.562H10a.5.5 0 0 1 0 1h.53c1.295.265 2.53.96 2.53 2.562V11.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V8.062Zm1 0V11h8V8.062c0-1.217-1.144-2.062-2.373-2.284A.5.5 0 0 1 9.5 5.5v-1A.5.5 0 0 1 9 4h-.539C7.24 3.765 6 2.762 6 1.5V2.438c0 1.302-1.235 2.297-2.03 2.562H3.5a.5.5 0 0 1 0-1H4Z"
    }),
    React.createElement("path", {
      d: "M8 1a2.5 2.5 0 0 1 2.5 2.5V4.5a.5.5 0 0 1-1 0V4a1.5 1.5 0 0 0-3 0v.5a.5.5 0 0 1-1 0V3.5A2.5 2.5 0 0 1 8 1Z"
    })
  )
);

export const DatabaseIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16, height: 16, fill: "currentColor",
    className: `bi bi-database ${className || 'mr-1'}`,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", { d: "M4 3a4 4 0 1 1 8 0v1a4 4 0 1 1-8 0V3zm0 2.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1h-8zm0 3a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1h-8zm0 3a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1h-8z" }),
    React.createElement("path", { d: "M2 2.047a4.5 4.5 0 0 0 0 .906V13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2.953a4.5 4.5 0 0 0 0-.906A4.502 4.502 0 0 0 8 0a4.502 4.502 0 0 0-6 2.047zM13 13H3V3.052A3.5 3.5 0 0 1 8 1.5a3.5 3.5 0 0 1 5 1.552V13z" })
  )
);

export const BullishIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16, height: 16, fill: "currentColor",
    className: `bi bi-graph-up-arrow ${className || 'mr-1'}`,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", { fillRule: "evenodd", d: "M0 0h1v15h15v1H0V0Zm10 3.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V4.9l-3.613 4.417a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61L13.445 4H10.5a.5.5 0 0 1-.5-.5Z" })
  )
);

export const ExportIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16, height: 16, fill: "currentColor",
    className: `bi bi-box-arrow-up-right ${className || 'mr-1'}`,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", { fillRule: "evenodd", d: "M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" }),
    React.createElement("path", { fillRule: "evenodd", d: "M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" })
  )
);

export const EyeIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16, height: 16, fill: "currentColor",
    className: `bi bi-eye-fill ${className || 'mr-1'}`,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", { d: "M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" }),
    React.createElement("path", { d: "M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" })
  )
);

export const WalletIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16, height: 16, fill: "currentColor",
    className: `bi bi-wallet2 ${className || 'mr-1'}`,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", { d: "M12.136.326A1.5 1.5 0 0 1 14 1.78V3h.5A1.5 1.5 0 0 1 16 4.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-9A1.5 1.5 0 0 1 1.5 3H2V1.78a1.5 1.5 0 0 1 1.404-1.454L4.562.078A1.5 1.5 0 0 1 5.82.326l1.904.952L9.68.326a1.5 1.5 0 0 1 1.258-.252L12.136.326zM5.562 1.078L4.158.369A.5.5 0 0 0 3.5.78V3h2V1.78a.5.5 0 0 0-.26-.445L5.562 1.078zM12.438 1.078L11.034.37A.5.5 0 0 0 10.5.78V3h2V1.78a.5.5 0 0 0-.26-.445l-1.47-.333zM15 4.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5H14.5z" })
  )
);

export const MessageIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16, height: 16, fill: "currentColor",
    className: `bi bi-chat-left-text-fill ${className || 'mr-1'}`,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", { d: "M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4.414a1 1 0 0 0-.707.293L.854 15.146A.5.5 0 0 1 0 14.793V2zm3.5 1a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9zm0 2.5a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9zm0 2.5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5z" })
  )
);

export const BrainIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16, height: 16, fill: "currentColor",
    className: `bi bi-brain ${className || 'mr-1'}`,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", { d: "M6.275 0a.75.75 0 0 0-.[622.26C2.347.342 0 2.953 0 6.39C0 9.158 1.47 11.155 3.5 12.33C3.786 14.304 5.686 16 8 16s4.214-1.696 4.5-3.67c2.03-1.175 3.5-3.172 3.5-5.94C16 2.953 13.653.341 10.347.26a.75.75 0 0 0-.622-.26h-3.45zM4.75 11.45C3.3 10.56 2 8.654 2 6.39C2 4.073 3.576 2.041 6.001 2.041c.712 0 1.313.167 1.74.46V12c-.882.353-1.824.65-2.991.65c-.65 0-1.23-.076-1.74-.198V11.45zM8 14c-1.193 0-2.185-.328-3.034-.819V3.361C5.887 3.108 6.886 3 8.001 3c1.114 0 2.113.108 3.033.361V13.18C10.185 13.672 9.193 14 8 14zm2.26-2.36V2.5c.427-.293 1.028-.46 1.74-.46c2.424 0 4 2.032 4 4.35c0 2.264-1.3 4.17-2.75 5.06V12c-.882.353-1.824.65-2.99.65c-.65 0-1.23-.076-1.74-.198V11.64z" })
  )
);

export const ClipboardIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16, height: 16, fill: "currentColor",
    className: `bi bi-clipboard ${className || 'mr-1'}`,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", { d: "M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" }),
    React.createElement("path", { d: "M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" })
  )
);

export const HistoryIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16, height: 16, fill: "currentColor",
    className: `bi bi-clock-history ${className || 'mr-1'}`,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", { d: "M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zM2.25 2.693a7 7 0 0 0 0 10.614l.707-.708a6 6 0 0 1 0-9.198l-.707-.708zM13.074 3.966l.707.707A7 7 0 0 1 15 8a7 7 0 0 1-1.219 4.328l-.707-.707A6 6 0 0 0 14 8a6 6 0 0 0-1.015-3.458zM8 3a5 5 0 1 1-2.672 9.339L3.5 14.207V11.5a.5.5 0 0 1 .5-.5h.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H3.5a.5.5 0 0 1-.354-.854l2.146-2.147A5 5 0 0 1 8 3zm.5-2A.5.5 0 0 1 9 1.5v1a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5zM12 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5zM4 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5z" })
  )
);

export const AnalyticsIcon = ({ className, style }) => (
  React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16, height: 16, fill: "currentColor",
    className: `bi bi-pie-chart-fill ${className || 'mr-1'}`,
    viewBox: "0 0 16 16",
    style: style
  },
    React.createElement("path", { d: "M15.985 8.5H8.207l.075.075c.03.03.064.055.1.075v.001a.53.53 0 0 0 .12.075.503.503 0 0 0 .24.065h.003c.091.017.183.03.275.038a.5.5 0 0 0 .314-.145L15.873 1.5H16v7zM1 8.465a7 7 0 1 1 14 0a7 7 0 0 1-14 0zM8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM5.5 8.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V12a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5V8.5z" })
  )
);

export const LoadingSpinner = ({ className, style }) => (
  React.createElement("svg", {
    className: `animate-spin ${className || 'h-5 w-5 text-white'}`,
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 24 24",
    style: style
  },
    React.createElement("circle", {
      className: "opacity-25",
      cx: "12",
      cy: "12",
      r: "10",
      stroke: "currentColor",
      strokeWidth: "4"
    }),
    React.createElement("path", {
      className: "opacity-75",
      fill: "currentColor",
      d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    })
  )
);
