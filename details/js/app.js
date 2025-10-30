
// IIFE to encapsulate the entire script
(function() {
    'use strict';
    /**
     * @file Manages the generic details page, including data fetching, caching, and UI rendering.
     * @author Jules
     */

    /**
     * @callback AnimationHook
     * @param {boolean} isRunning
     */

    // --- Bitwise Operations for Feature Flags ---
    window.FeatureFlags = {
        ANIMATIONS_ENABLED: 1 << 0, // 1
        CHART_ENABLED: 1 << 1, // 2
        TABLE_ENABLED: 1 << 2, // 4
    };
    window.appFeatures = window.FeatureFlags.ANIMATIONS_ENABLED | window.FeatureFlags.CHART_ENABLED | window.FeatureFlags.TABLE_ENABLED;


    async function main() {
        console.log("Details page loaded.");
        const urlParams = new URLSearchParams(window.location.search);
        const dbPath = urlParams.get('dbPath');
        const query = urlParams.get('query');
        const params = JSON.parse(urlParams.get('params') || '{}');
        const title = urlParams.get('title');
        const xCol = urlParams.get('xCol');
        const yCol = urlParams.get('yCol');

        console.log({ dbPath, query, params, title, xCol, yCol });

        if (!dbPath || !query || !title || !xCol || !yCol) {
            document.body.innerHTML = '<h1 style="color: red;">Error: Missing required URL parameters.</h1>';
            console.error("Missing required URL parameters.", { dbPath, query, title, xCol, yCol });
            return;
        }


        try {
            const dataManager = await DataManager.getInstance(dbPath);
            const uiManager = new UIManager();

            uiManager.registerAnimationHook((isRunning) => {
                // Re-render chart with new animation setting
                dataManager.executeQuery(query, params).then(data => uiManager.renderChart(data, xCol, yCol));
            });

            const data = await dataManager.executeQuery(query, params);
            uiManager.render(title, data, xCol, yCol);

        } catch (error) {
            console.error("Failed to load details:", error);
            document.body.innerHTML = `<h1 style="color: red;">Error: ${error.message}</h1>`;
        }
    }

    document.addEventListener('DOMContentLoaded', main);
})();
