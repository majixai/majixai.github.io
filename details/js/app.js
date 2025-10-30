
// IIFE to encapsulate the entire script
(function() {
    'use strict';
    /**
     * @file Manages the ticker details page, including data fetching, caching, and UI rendering.
     * @author Jules
     */

    /**
     * @typedef {Object} PriceData
     * @property {string} scraped_at
     * @property {number} price
     */

    /**
     * @callback AnimationHook
     * @param {boolean} isRunning
     */

    // --- Bitwise Operations for Feature Flags ---
    const FeatureFlags = {
        ANIMATIONS_ENABLED: 1 << 0, // 1
        CHART_ENABLED: 1 << 1,      // 2
        TABLE_ENABLED: 1 << 2,      // 4
    };
    window.FeatureFlags = {
        ANIMATIONS_ENABLED: 1 << 0, // 1
        CHART_ENABLED: 1 << 1,      // 2
        TABLE_ENABLED: 1 << 2,      // 4
    };
    window.appFeatures = FeatureFlags.ANIMATIONS_ENABLED | FeatureFlags.CHART_ENABLED | FeatureFlags.TABLE_ENABLED;


    async function main() {
        const urlParams = new URLSearchParams(window.location.search);
        const ticker = urlParams.get('ticker');
        if (!ticker) {
            console.error("No ticker specified.");
            return;
        }

        try {
            const dataManager = await DataManager.getInstance();
            const uiManager = new UIManager();

            uiManager.registerAnimationHook((isRunning) => {
                // Re-render chart with new animation setting
                dataManager.getTickerData(ticker).then(data => uiManager.renderChart(data));
            });

            const tickerData = await dataManager.getTickerData(ticker);
            uiManager.render(ticker, tickerData);

        } catch (error) {
            console.error("Failed to load ticker details:", error);
        }
    }

    document.addEventListener('DOMContentLoaded', main);
})();
