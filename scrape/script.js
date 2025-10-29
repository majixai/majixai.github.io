const DB_URL = 'finance.db.gz';
const LOADER = document.getElementById('loader');
const DATA_CONTAINER = document.getElementById('data-container');
let priceChart;

/**
 * @async
 * @function displayPriceChart
 * @description Queries the database for the price history of a given ticker
 * and displays it as a line chart.
 * @param {import('sql.js').Database} db - The SQL.js database instance.
 * @param {string} ticker - The stock ticker to display the chart for.
 */
async function displayPriceChart(db, ticker) {
    const stmt = db.prepare(`
        SELECT scraped_at, price
        FROM prices
        WHERE ticker = :ticker
        ORDER BY scraped_at
    `);
    stmt.bind({ ':ticker': ticker });

    const labels = [];
    const data = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        labels.push(new Date(row.scraped_at).toLocaleTimeString());
        data.push(row.price);
    }
    stmt.free();

    const chartData = {
        labels: labels,
        datasets: [{
            label: `${ticker} Price History`,
            data: data,
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
        }]
    };

    if (priceChart) {
        priceChart.destroy();
    }

    priceChart = new Chart(document.getElementById('price-chart'), {
        type: 'line',
        data: chartData,
        options: {
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}


/**
 * @async
 * @function main
 * @description Main function to fetch, decompress, and display financial data.
 * It initializes SQL.js, fetches a compressed database file,
 * decompresses it using pako, loads the database, queries the latest
 * price for each stock ticker, and dynamically generates an HTML table
 * to display the results.
 * @throws {Error} If there is an issue with fetching the database,
 * decompressing the data, or executing the SQL query.
 */
async function main() {
    try {
        // Initialize the SQL.js library
        const SQL = await initSqlJs({
            locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
        });

        // Fetch and decompress the database
        LOADER.textContent = 'Fetching and decompressing database...';
        const response = await fetch(DB_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const compressedData = new Uint8Array(await response.arrayBuffer());
        const decompressedData = pako.inflate(compressedData);

        // Load the database
        LOADER.textContent = 'Loading database...';
        const db = new SQL.Database(decompressedData);

        // Query the database
        LOADER.textContent = 'Querying data...';
        const stmt = db.prepare(`
            SELECT ticker, name, price, scraped_at
            FROM prices p
            WHERE p.id = (SELECT MAX(id) FROM prices WHERE ticker = p.ticker)
            ORDER BY ticker
        `);

        // Generate the HTML table
        let tableHtml = '<table><thead><tr><th>Ticker</th><th>Name</th><th>Price</th><th>Scraped At</th></tr></thead><tbody>';
        while (stmt.step()) {
            const row = stmt.getAsObject();
            tableHtml += `<tr>
                <td>${row.ticker}</td>
                <td>${row.name}</td>
                <td>${row.price}</td>
                <td>${row.scraped_at}</td>
            </tr>`;
        }
        tableHtml += '</tbody></table>';
        stmt.free();

        // Display the table
        DATA_CONTAINER.innerHTML = tableHtml;
        LOADER.style.display = 'none';

        // Add event listeners to table rows
        const tableRows = DATA_CONTAINER.querySelectorAll('tbody tr');
        tableRows.forEach(row => {
            row.addEventListener('click', () => {
                const ticker = row.cells[0].textContent;
                window.location.href = `details/index.html?ticker=${ticker}`;
            });
        });

    } catch (error) {
        LOADER.textContent = `Error: ${error.message}`;
        console.error(error);
    }
}

main();
