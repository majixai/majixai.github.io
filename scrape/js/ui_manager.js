/**
 * @fileoverview Manages all UI interactions and DOM updates for the scrape engine.
 */

class UIManager {
    #elements;
    #callbacks;
    #tickerData;

    constructor() {
        this.#elements = {
            loader: document.getElementById('loader'),
            dataContainer: document.getElementById('data-container'),
            totalTickers: document.getElementById('total-tickers'),
            lastUpdate: document.getElementById('last-update'),
            avgPrice: document.getElementById('avg-price'),
            searchInput: document.getElementById('search-input'),
        };
        this.#callbacks = {
            onRowClick: null,
        };
        this.#tickerData = [];

        this.#elements.searchInput.addEventListener('input', this.#handleSearch.bind(this));
    }

    /**
     * Registers a callback for a UI event.
     * @param {string} eventName The name of the event ('onRowClick').
     * @param {Function} callback The function to call.
     */
    on(eventName, callback) {
        if (eventName in this.#callbacks) {
            this.#callbacks[eventName] = callback;
        }
    }

    /**
     * Shows or hides the main loader.
     * @param {boolean} show True to show, false to hide.
     */
    showLoader(show) {
        this.#elements.loader.style.display = show ? 'block' : 'none';
    }

    /**
     * Updates the summary statistics display.
     * @param {Object} stats The statistics object.
     */
    updateSummary(stats) {
        console.log('Updating summary with stats:', stats);
        this.#elements.totalTickers.textContent = stats.totalTickers;
        this.#elements.lastUpdate.textContent = new Date(stats.lastUpdate).toLocaleString();
        this.#elements.avgPrice.textContent = (stats.avgPrice || 0).toFixed(2);
    }

    /**
     * Renders the ticker data into an HTML table.
     * @param {Array<Object>} data The ticker data to render.
     */
    renderTable(data) {
        this.#tickerData = data;
        this.filterAndRenderTable('');
    }

    /**
     * Filters the stored ticker data and re-renders the table.
     * @param {string} searchTerm The term to filter by.
     */
    filterAndRenderTable(searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filteredData = this.#tickerData.filter(row => {
            return row.ticker.toLowerCase().includes(lowerCaseSearchTerm) ||
                   (row.name && row.name.toLowerCase().includes(lowerCaseSearchTerm));
        });

        let tableHtml = '<table class="w3-table-all w3-hoverable"><thead><tr class="w3-theme"><th>Ticker</th><th>Name</th><th>Price</th><th>Scraped At</th></tr></thead><tbody>';
        filteredData.forEach(row => {
            tableHtml += `<tr data-ticker="${row.ticker}">
                <td>${row.ticker}</td>
                <td>${row.name || ''}</td>
                <td>${row.price}</td>
                <td>${new Date(row.scraped_at).toLocaleString()}</td>
            </tr>`;
        });
        tableHtml += '</tbody></table>';
        this.#elements.dataContainer.innerHTML = tableHtml;

        // Re-add event listeners
        this.#elements.dataContainer.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('click', () => {
                this.#callbacks.onRowClick?.(row.dataset.ticker);
            });
        });
    }

    /**
     * Handles the search input event.
     * @private
     */
    #handleSearch() {
        this.filterAndRenderTable(this.#elements.searchInput.value);
    }
}
