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

// IIFE to encapsulate the entire script
(function() {
    'use strict';

    // --- Bitwise Operations for Feature Flags ---
    const FeatureFlags = {
        ANIMATIONS_ENABLED: 1 << 0, // 1
        CHART_ENABLED: 1 << 1,      // 2
        TABLE_ENABLED: 1 << 2,      // 4
    };
    let appFeatures = FeatureFlags.ANIMATIONS_ENABLED | FeatureFlags.CHART_ENABLED | FeatureFlags.TABLE_ENABLED;

    class DataManager {
        #db = null;
        static #instance = null;

        /**
         * @private
         */
        constructor() {
            if (DataManager.#instance) {
                return DataManager.#instance;
            }
            DataManager.#instance = this;
        }

        /**
         * @returns {Promise<DataManager>}
         */
        static async getInstance() {
            if (!DataManager.#instance) {
                DataManager.#instance = new DataManager();
                await DataManager.#instance.#init();
            }
            return DataManager.#instance;
        }

        async #init() {
            try {
                const SQL = await initSqlJs({
                    locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
                });
                const response = await fetch('../finance.db.gz');
                const compressedData = new Uint8Array(await response.arrayBuffer());
                const decompressedData = pako.inflate(compressedData);
                this.#db = new SQL.Database(decompressedData);
            } catch (error) {
                console.error("Failed to initialize DataManager:", error);
                throw error;
            }
        }

        /**
         * @param {string} ticker
         * @returns {Promise<PriceData[]>}
         */
        async getTickerData(ticker) {
            console.log(`Calling getTickerData with args:`, [ticker]);
            const result = await new Promise((resolve, reject) => {
                if (!this.#db) return reject("Database not initialized.");
                const stmt = this.#db.prepare("SELECT scraped_at, price FROM prices WHERE ticker = :ticker ORDER BY scraped_at");
                stmt.bind({ ':ticker': ticker });
                const data = [];
                while (stmt.step()) {
                    data.push(stmt.getAsObject());
                }
                stmt.free();
                resolve(data);
            });
            console.log(`Called getTickerData, result:`, result);
            return result;
        }
    }

    class UIManager {
        #chart = null;
        #animationHook = null;

        constructor() {
            this.tickerNameEl = document.getElementById('ticker-name');
            this.dataTableEl = document.getElementById('data-table');
            this.chartCanvas = document.getElementById('price-chart');
            this.toggleAnimationBtn = document.getElementById('toggle-animation');
            this.#attachEventListeners();
        }

        /**
         * @param {AnimationHook} hook
         */
        registerAnimationHook(hook) {
            this.#animationHook = hook;
        }

        /**
         * @private
         */
        #attachEventListeners() {
            this.toggleAnimationBtn.addEventListener('click', () => {
                appFeatures ^= FeatureFlags.ANIMATIONS_ENABLED;
                const isRunning = (appFeatures & FeatureFlags.ANIMATIONS_ENABLED) > 0;
                this.toggleAnimationBtn.textContent = isRunning ? 'Stop Animations' : 'Start Animations';
                if (this.#animationHook) this.#animationHook(isRunning);
            });
        }

        /**
         * @param {string} ticker
         * @param {PriceData[]} data
         */
        render(ticker, data) {
            this.tickerNameEl.textContent = ticker;
            if (appFeatures & FeatureFlags.TABLE_ENABLED) {
                this.renderTable(data);
            }
            if (appFeatures & FeatureFlags.CHART_ENABLED) {
                this.renderChart(data);
            }
        }

        /**
         * @param {PriceData[]} data
         */
        renderTable(data) {
            const table = `
                <table class="table table-dark table-striped">
                    <thead><tr><th>Timestamp</th><th>Price</th></tr></thead>
                    <tbody>
                        ${data.map(row => `<tr><td>${new Date(row.scraped_at).toLocaleString()}</td><td>${row.price.toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>`;
            this.dataTableEl.innerHTML = table;
        }

        /**
         * @param {PriceData[]} data
         */
        renderChart(data) {
            const ctx = this.chartCanvas.getContext('2d');
            if (this.#chart) this.#chart.destroy();

            const chartData = {
                labels: data.map(row => new Date(row.scraped_at).toLocaleTimeString()),
                datasets: [{
                    label: 'Price',
                    data: data.map(row => row.price),
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true,
                }]
            };

            this.#chart = new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    animation: (appFeatures & FeatureFlags.ANIMATIONS_ENABLED) > 0,
                    scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } }
                }
            });
        }
    }

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
