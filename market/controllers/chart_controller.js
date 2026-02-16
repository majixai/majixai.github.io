/**
 * Chart Controller for orchestrating chart operations.
 */
import { ChartModel } from '../models/chart_model.js';

export class ChartController {
    constructor(model = null, chartInstance = null) {
        this.model = model || new ChartModel();
        this.chart = chartInstance;
    }

    /**
     * Set the Chart.js instance.
     * @param {Object} chart - Chart.js chart instance
     */
    setChart(chart) {
        this.chart = chart;
    }

    /**
     * Update chart with new price data.
     * @param {Array} priceData - Array of price objects
     * @param {string} symbol - Stock symbol
     * @returns {Object}
     */
    updateChartWithPrices(priceData, symbol) {
        try {
            const formattedData = this.model.formatPriceData(priceData, symbol);
            this.model.setChartData(formattedData);

            if (this.chart) {
                this.chart.data = formattedData;
                this.chart.update();
            }

            return {
                success: true,
                message: 'Chart updated',
                dataPoints: priceData.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Add a new dataset to the chart.
     * @param {Array} priceData - Array of price objects
     * @param {string} symbol - Stock symbol
     * @param {string} color - Line color
     * @returns {Object}
     */
    addDataset(priceData, symbol, color = 'rgb(255, 99, 132)') {
        const dataset = {
            label: symbol,
            data: priceData.map(d => d.price),
            borderColor: color,
            backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.2)'),
            tension: 0.1
        };

        this.model.addDataset(dataset);

        if (this.chart) {
            this.chart.data.datasets.push(dataset);
            this.chart.update();
        }

        return {
            success: true,
            message: `Added ${symbol} to chart`
        };
    }

    /**
     * Update chart configuration.
     * @param {Object} config - Configuration updates
     * @returns {Object}
     */
    updateConfig(config) {
        this.model.updateConfig(config);

        if (this.chart) {
            Object.assign(this.chart.options, config);
            this.chart.update();
        }

        return {
            success: true,
            message: 'Configuration updated'
        };
    }

    /**
     * Clear the chart.
     * @returns {Object}
     */
    clearChart() {
        this.model.clearData();

        if (this.chart) {
            this.chart.data.labels = [];
            this.chart.data.datasets = [];
            this.chart.update();
        }

        return {
            success: true,
            message: 'Chart cleared'
        };
    }

    /**
     * Get current chart data.
     * @returns {Object}
     */
    getChartData() {
        return {
            success: true,
            data: this.model.getChartData(),
            config: this.model.getConfig()
        };
    }
}
