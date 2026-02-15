/**
 * Chart Model for managing chart data and configurations.
 */
export class ChartModel {
    constructor() {
        this.chartData = null;
        this.chartConfig = this.getDefaultConfig();
    }

    /**
     * Get default chart configuration.
     * @returns {Object}
     */
    getDefaultConfig() {
        return {
            type: 'line',
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Price'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    enabled: true
                }
            }
        };
    }

    /**
     * Set chart data.
     * @param {Object} data - Chart data object with labels and datasets
     */
    setChartData(data) {
        this.chartData = {
            labels: data.labels || [],
            datasets: data.datasets || []
        };
    }

    /**
     * Get current chart data.
     * @returns {Object|null}
     */
    getChartData() {
        return this.chartData;
    }

    /**
     * Update chart configuration.
     * @param {Object} config - Configuration updates
     */
    updateConfig(config) {
        this.chartConfig = {
            ...this.chartConfig,
            ...config
        };
    }

    /**
     * Get current chart configuration.
     * @returns {Object}
     */
    getConfig() {
        return this.chartConfig;
    }

    /**
     * Format price data for chart display.
     * @param {Array} priceData - Array of price objects
     * @param {string} symbol - Stock symbol
     * @returns {Object}
     */
    formatPriceData(priceData, symbol) {
        const labels = priceData.map(d => d.date);
        const prices = priceData.map(d => d.price);

        return {
            labels: labels,
            datasets: [{
                label: symbol,
                data: prices,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1
            }]
        };
    }

    /**
     * Add a dataset to the chart.
     * @param {Object} dataset - Dataset object
     */
    addDataset(dataset) {
        if (!this.chartData) {
            this.chartData = { labels: [], datasets: [] };
        }
        this.chartData.datasets.push(dataset);
    }

    /**
     * Clear chart data.
     */
    clearData() {
        this.chartData = null;
    }
}
