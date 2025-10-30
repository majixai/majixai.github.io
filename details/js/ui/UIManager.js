
// IIFE to encapsulate the entire script
(function() {
    'use strict';
    class UIManager {
        #chart = null;
        #animationHook = null;

        constructor() {
            this.titleEl = document.querySelector('[data-title]');
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
                window.appFeatures ^= window.FeatureFlags.ANIMATIONS_ENABLED;
                const isRunning = (window.appFeatures & window.FeatureFlags.ANIMATIONS_ENABLED) > 0;
                this.toggleAnimationBtn.textContent = isRunning ? 'Stop Animations' : 'Start Animations';
                if (this.#animationHook) this.#animationHook(isRunning);
            });
        }

        /**
         * @param {string} title
         * @param {Object[]} data
         * @param {string} xCol
         * @param {string} yCol
         */
        render(title, data, xCol, yCol) {
            this.titleEl.textContent = title;
            if (window.appFeatures & window.FeatureFlags.TABLE_ENABLED) {
                this.renderTable(data, xCol, yCol);
            }
            if (window.appFeatures & window.FeatureFlags.CHART_ENABLED) {
                this.renderChart(data, xCol, yCol);
            }
        }

        /**
         * @param {Object[]} data
         * @param {string} xCol
         * @param {string} yCol
         */
        renderTable(data, xCol, yCol) {
            console.log('Rendering table with data:', data);
            if (!data || data.length === 0) {
                this.dataTableEl.innerHTML = '<p>No data available.</p>';
                return;
            }
            const yValues = data.map(row => row[yCol]);
            const average = yValues.reduce((a, b) => a + b, 0) / yValues.length;
            const high = Math.max(...yValues);
            const low = Math.min(...yValues);

            const table = `
                <div class="summary">
                    <p><strong>Average:</strong> ${average.toFixed(2)}</p>
                    <p><strong>High:</strong> ${high.toFixed(2)}</p>
                    <p><strong>Low:</strong> ${low.toFixed(2)}</p>
                </div>
                <table class="table table-dark table-striped">
                    <thead><tr><th>${xCol}</th><th>${yCol}</th></tr></thead>
                    <tbody>
                        ${data.map(row => `<tr><td>${new Date(row[xCol]).toLocaleString()}</td><td>${typeof row[yCol] === 'number' ? row[yCol].toFixed(2) : row[yCol]}</td></tr>`).join('')}
                    </tbody>
                </table>`;
            this.dataTableEl.innerHTML = table;
        }

        /**
         * @param {Object[]} data
         * @param {string} xCol
         * @param {string} yCol
         */
        renderChart(data, xCol, yCol) {
            const ctx = this.chartCanvas.getContext('2d');
            if (this.#chart) this.#chart.destroy();

            const chartData = {
                labels: data.map(row => new Date(row[xCol]).toLocaleTimeString()),
                datasets: [{
                    label: yCol,
                    data: data.map(row => row[yCol]),
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
                    animation: (window.appFeatures & window.FeatureFlags.ANIMATIONS_ENABLED) > 0,
                    scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } }
                }
            });
        }
    }
    window.UIManager = UIManager;
})();
