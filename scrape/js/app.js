// IIFE to encapsulate the application
(function() {
    'use strict';

    class App {
        #dataService;
        #uiManager;

        constructor() {
            this.#dataService = new DataService();
            this.#uiManager = new UIManager();
            this.#router();
        }

        /**
         * A simple router to handle different pages.
         * @private
         */
        #router() {
            const params = new URLSearchParams(window.location.search);
            const ticker = params.get('ticker');

            if (ticker) {
                this.#loadTickerDetails(ticker);
            } else {
                this.#loadTickerList();
            }
        }

        /**
         * Loads and displays the main list of tickers.
         * @private
         */
        async #loadTickerList() {
            try {
                this.#uiManager.showLoader('Loading ticker data...');
                const priceGenerator = this.#dataService.getLatestPrices();
                await this.#uiManager.renderTickerTable(priceGenerator);
            } catch (error) {
                this.#uiManager.showLoader(`Error: ${error.message}`);
                console.error(error);
            } finally {
                this.#uiManager.hideLoader();
            }
        }

        /**
         * Loads and displays the details for a single ticker.
         * @private
         * @param {string} ticker
         */
        async #loadTickerDetails(ticker) {
            try {
                this.#uiManager.showLoader(`Loading details for ${ticker}...`);
                const tickerDetails = await this.#dataService.getTickerDetails(ticker);
                this.#uiManager.renderTickerDetails(tickerDetails);
            } catch (error) {
                this.#uiManager.showLoader(`Error: ${error.message}`);
                console.error(error);
            } finally {
                this.#uiManager.hideLoader();
            }
        }
    }

    // Start the application on DOM content loaded
    document.addEventListener('DOMContentLoaded', () => new App());
})();
