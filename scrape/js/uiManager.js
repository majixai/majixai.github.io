class UIManager {
    // Protected members (by convention)
    _loader = document.getElementById('loader');
    _dataContainer = document.getElementById('data-container');
    _animationToggle = document.getElementById('animation-toggle');

    constructor() {
        this.#setupEventListeners();
    }

    /**
     * Sets up event listeners for UI elements.
     * @private
     */
    #setupEventListeners() {
        if (this._animationToggle) {
            this._animationToggle.addEventListener('click', () => {
                document.body.classList.toggle('animations-off');
            });
        }
    }

    /**
     * Displays a loading message.
     * @public
     * @param {string} message
     */
    showLoader(message) {
        if (this._loader) {
            this._loader.textContent = message;
            this._loader.style.display = 'block';
        }
    }

    /**
     * Hides the loading message.
     * @public
     */
    hideLoader() {
        if (this._loader) {
            this._loader.style.display = 'none';
        }
    }

    /**
     * Renders the main table of tickers.
     * @public
     * @param {Generator<IPriceData>} priceGenerator
     */
    async renderTickerTable(priceGenerator) {
        let tableHtml = `
            <table class="w3-table-all w3-hoverable">
                <thead>
                    <tr class="w3-light-grey">
                        <th>Ticker</th>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Scraped At</th>
                    </tr>
                </thead>
                <tbody>`;

        for await (const row of priceGenerator) {
            tableHtml += `
                <tr>
                    <td><a href="details.html?ticker=${row.ticker}">${row.ticker}</a></td>
                    <td>${row.name}</td>
                    <td>${row.price}</td>
                    <td>${row.scraped_at}</td>
                </tr>`;
        }

        tableHtml += '</tbody></table>';
        this._dataContainer.innerHTML = tableHtml;
    }

    /**
     * Renders the details page for a single ticker, including a Plotly chart.
     * @public
     * @param {ITickerDetail} tickerDetails
     */
    renderTickerDetails(tickerDetails) {
        const { name, historicalData } = tickerDetails;
        document.querySelector('h1').textContent = name;

        const plotData = [{
            x: historicalData.map(d => d.scraped_at),
            y: historicalData.map(d => parseFloat(d.price.replace('$', '').replace(',', ''))),
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Price'
        }];

        const layout = {
            title: `Price History for ${name}`,
            xaxis: { title: 'Date' },
            yaxis: { title: 'Price (USD)' }
        };

        Plotly.newPlot('chart-container', plotData, layout);
    }
}
