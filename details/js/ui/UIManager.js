
// IIFE to encapsulate the entire script
(function() {
    'use strict';
    class UIManager {
        #chart = null;
        #animationHook = null;

        constructor() {
            this.tickerNameEl = document.querySelector('[data-ticker-name]');
            this.dataTableEl = document.querySelector('[data-data-table]');
            this.chartCanvas = document.querySelector('[data-price-chart]');
            this.toggleAnimationBtn = document.querySelector('[data-toggle-animation]');
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
            console.log('Rendering table with data:', data);
            if (!data || data.length === 0) {
                this.dataTableEl.innerHTML = '<p>No data available.</p>';
                return;
            }
            const prices = data.map(row => row.price);
            const average = prices.reduce((a, b) => a + b, 0) / prices.length;
            const high = Math.max(...prices);
            const low = Math.min(...prices);

            const table = `
                <div class="summary">
                    <p><strong>Average Price:</strong> ${average.toFixed(2)}</p>
                    <p><strong>High:</strong> ${high.toFixed(2)}</p>
                    <p><strong>Low:</strong> ${low.toFixed(2)}</p>
                </div>
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
    window.UIManager = UIManager;
})();
