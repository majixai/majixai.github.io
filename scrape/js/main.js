/**
 * @fileoverview Main entry point for the Scrape Financial Data Engine.
 */

(async function() {
    'use strict';

    const DB_URL = 'finance.db.gz';

    async function main() {
        const dataManager = new DataManager();
        const uiManager = new UIManager();

        try {
            // Initialize the data manager
            await dataManager.init(DB_URL);

            // Get data and update UI
            const tickerData = dataManager.getTickerData();
            const summaryStats = dataManager.getSummaryStatistics();

            uiManager.updateSummary(summaryStats);
            uiManager.renderTable(tickerData);

            // Hide loader
            uiManager.showLoader(false);

            // Set up row click handler
            uiManager.on('onRowClick', (ticker) => {
                const dbPath = '/scrape/finance.db.gz';
                const query = "SELECT scraped_at, price FROM prices WHERE ticker = :ticker ORDER BY scraped_at";
                const params = JSON.stringify({ ':ticker': ticker });
                const title = `${ticker} Price History`;
                const xCol = 'scraped_at';
                const yCol = 'price';

                const url = `/details/index.html?dbPath=${encodeURIComponent(dbPath)}&query=${encodeURIComponent(query)}&params=${encodeURIComponent(params)}&title=${encodeURIComponent(title)}&xCol=${encodeURIComponent(xCol)}&yCol=${encodeURIComponent(yCol)}`;
                window.location.href = url;
            });

        } catch (error) {
            console.error(error);
            document.getElementById('loader').textContent = `Error: ${error.message}`;
        }
    }

    // Run the main function when the DOM is ready
    document.addEventListener('DOMContentLoaded', main);

})();
