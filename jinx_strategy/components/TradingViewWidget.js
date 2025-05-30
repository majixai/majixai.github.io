// Assuming React is available globally e.g. via CDN
// import React, { useEffect, useRef, memo } from 'react'; // No longer needed if React is global

// Since types.js is now types.js, ensure imports reflect that if needed,
// but for pure JS, type imports are not functional, relying on JSDoc.
// import { TradingViewWidgetConfig } from '../types.js';

const DEFAULT_STUDIES = [
    "MASimple@tv-basicstudies",
    "MAExp@tv-basicstudies",
    "RSI@tv-basicstudies",
    "MACD@tv-basicstudies",
    "BB@tv-basicstudies",
    "VWAP@tv-basicstudies",
    "IchimokuCloud@tv-basicstudies",
    "ATR@tv-basicstudies",
    "StochasticRSI@tv-basicstudies",
    "DM@tv-basicstudies"
];

const DEFAULT_COMPARE_SYMBOLS = ["SPY", "QQQ"]; // Note: compareSymbols are not directly used in widgetConfig in this version

/**
 * @typedef {Object} TradingViewWidgetConfig
 * @property {string} symbol
 * @property {string} [theme="light"]
 * @property {string} [interval="D"]
 * @property {string[]} [studies]
 * @property {string[]} [compareSymbols] // Not directly used in script config, for future use or manual setup
 * @property {string} [timezone="America/New_York"]
 * @property {string} [style="1"]
 * @property {string} [locale="en"]
 * @property {boolean} [withdateranges=true]
 * @property {string} [range="6M"]
 * @property {boolean} [allow_symbol_change=true]
 */

/**
 * @param {TradingViewWidgetConfig} props
 * @returns {React.ReactElement}
 */
const TradingViewWidget = ({
  symbol,
  theme = "light",
  interval = "D",
  studies = DEFAULT_STUDIES,
  compareSymbols = DEFAULT_COMPARE_SYMBOLS, // Kept for prop consistency, though not in widget script
  timezone = "America/New_York",
  style = "1",
  locale = "en",
  withdateranges = true,
  range = "6M",
  allow_symbol_change = true,
}) => {
  if (typeof React === 'undefined') {
    console.error("React is not loaded. TradingViewWidget component cannot render.");
    return null; 
  }
  const { useEffect, useRef, memo } = React; // Destructure from global React

  const containerRef = useRef(null);
  const scriptAddedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !symbol) return;

    // Clear previous widget
    if (containerRef.current) {
        while (containerRef.current.firstChild) {
            containerRef.current.removeChild(containerRef.current.firstChild);
        }
    }
    scriptAddedRef.current = false;

    const widgetConfig = {
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: timezone,
      theme: theme,
      style: style,
      locale: locale,
      toolbar_bg: "#f1f3f6",
      enable_publishing: false,
      withdateranges: withdateranges,
      range: range,
      studies: studies,
      hide_side_toolbar: false,
      allow_symbol_change: allow_symbol_change,
      // Comparison symbols are typically added via the UI or specific "Compare" study.
      // The `compareSymbols` prop is not directly fed into this basic script config.
    };

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify(widgetConfig);

    if (containerRef.current && !scriptAddedRef.current) {
      containerRef.current.appendChild(script);
      scriptAddedRef.current = true;
    }

    return () => {
        if (containerRef.current) {
            while (containerRef.current.firstChild) {
                containerRef.current.removeChild(containerRef.current.firstChild);
            }
        }
        scriptAddedRef.current = false;
    };
  }, [symbol, theme, interval, studies, timezone, style, locale, withdateranges, range, allow_symbol_change, compareSymbols]);
  // Note: `compareSymbols` is in dependency array for completeness, though not directly used in scriptConfig.

  return React.createElement(
    'div',
    { className: "tradingview-widget-container", ref: containerRef, style: { height: "100%", width: "100%" } },
    React.createElement(
      'div',
      { className: "tradingview-widget-container__widget", style: { height: "calc(100% - 32px)", width: "100%" } }
    )
    // TradingView adds its own copyright.
  );
}

export default React.memo(TradingViewWidget);
