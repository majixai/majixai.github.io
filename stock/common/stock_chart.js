/**
 * Stock Chart component for displaying price charts.
 */
export class StockChart {
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;
        this.options = {
            type: 'line',
            responsive: true,
            ...options
        };
        this.chart = null;
        this.data = [];
    }

    /**
     * Initialize the chart.
     * @param {Object} chartLib - Chart library instance (e.g., Chart.js)
     */
    init(chartLib) {
        if (!this.container) return;

        const canvas = document.createElement('canvas');
        this.container.appendChild(canvas);

        this.chart = new chartLib(canvas.getContext('2d'), {
            type: this.options.type,
            data: {
                labels: [],
                datasets: []
            },
            options: this.getChartOptions()
        });
    }

    /**
     * Get chart configuration options.
     * @returns {Object}
     */
    getChartOptions() {
        return {
            responsive: this.options.responsive,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: true,
                    grid: { display: false }
                },
                y: {
                    display: true,
                    position: 'right'
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            elements: {
                line: { tension: 0.1 },
                point: { radius: 0 }
            }
        };
    }

    /**
     * Set chart data.
     * @param {Array} data - Array of price data objects
     */
    setData(data) {
        this.data = data;
        this.updateChart();
    }

    /**
     * Update the chart with current data.
     */
    updateChart() {
        if (!this.chart) return;

        this.chart.data.labels = this.data.map(d => d.date || d.timestamp);
        this.chart.data.datasets = [{
            label: 'Price',
            data: this.data.map(d => d.close || d.price),
            borderColor: this.getLineColor(),
            backgroundColor: this.getBackgroundColor(),
            fill: true
        }];

        this.chart.update();
    }

    /**
     * Get line color based on price trend.
     * @returns {string}
     */
    getLineColor() {
        if (this.data.length < 2) return 'rgb(75, 192, 192)';
        const first = this.data[0].close || this.data[0].price;
        const last = this.data[this.data.length - 1].close || this.data[this.data.length - 1].price;
        return last >= first ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';
    }

    /**
     * Get background gradient color.
     * @returns {string}
     */
    getBackgroundColor() {
        if (this.data.length < 2) return 'rgba(75, 192, 192, 0.2)';
        const first = this.data[0].close || this.data[0].price;
        const last = this.data[this.data.length - 1].close || this.data[this.data.length - 1].price;
        return last >= first ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    }

    /**
     * Add volume data as secondary dataset.
     * @param {Array} volumeData - Volume data array
     */
    addVolumeOverlay(volumeData) {
        if (!this.chart) return;

        this.chart.data.datasets.push({
            label: 'Volume',
            data: volumeData,
            type: 'bar',
            backgroundColor: 'rgba(100, 100, 100, 0.3)',
            yAxisID: 'volume'
        });

        this.chart.options.scales.volume = {
            display: false,
            position: 'left',
            grid: { display: false }
        };

        this.chart.update();
    }

    /**
     * Destroy the chart.
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}
