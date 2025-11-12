const DB_URL = 'finance.dat';
const TICKERS_URL = 'tickers.json';
const LOADER = document.getElementById('loader');
const DATA_CONTAINER = document.getElementById('data-container');
const PAGINATION_CONTAINER = document.getElementById('pagination-container');
const ROWS_PER_PAGE = 10;

let allRows = [];
let currentPage = 1;
let tickerMetadata = {};

async function fetchTickerMetadata() {
    try {
        const response = await fetch(TICKERS_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        tickerMetadata = await response.json();
    } catch (error) {
        console.error('Failed to load ticker metadata:', error);
        LOADER.textContent = `Error: Failed to load ticker metadata. ${error.message}`;
    }
}

function displayTablePage(page) {
    currentPage = page;
    DATA_CONTAINER.innerHTML = '';
    const startIndex = (page - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    const paginatedRows = allRows.slice(startIndex, endIndex);

    let tableHtml = '<table><thead><tr><th>Ticker</th><th>Name</th><th>Price</th><th>Last Scraped At</th></tr></thead><tbody>';
    paginatedRows.forEach(row => {
        // Use the metadata to get the full name
        const name = tickerMetadata[row.ticker] || 'N/A';
        tableHtml += `<tr>
            <td>${row.ticker}</td>
            <td>${name}</td>
            <td>${row.price}</td>
            <td>${row.time}</td>
        </tr>`;
    });
    tableHtml += '</tbody></table>';
    DATA_CONTAINER.innerHTML = tableHtml;

    // Add event listeners to table rows to link to the details page
    const tableRows = DATA_CONTAINER.querySelectorAll('tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('click', () => {
            const ticker = row.cells[0].textContent;
            // Sanitize ticker for use in a SQL query, same as in the scraper
            const tableName = ticker.replace(/[^a-zA-Z0-9_]/g, '_');
            const dbPath = 'finance.dat'; // Relative path to the db file from the details page
            const query = `
                SELECT
                    time,
                    price,
                    AVG(price) OVER (ORDER BY time ROWS BETWEEN 49 PRECEDING AND CURRENT ROW) as MA_50
                FROM ${tableName}
                ORDER BY time
            `;
            const params = JSON.stringify({}); // No params needed for this query structure
            const title = `${ticker} Price History`;
            const xCol = 'time';
            const yCol = 'price,MA_50';

            const url = `../details/index.html?dbPath=${encodeURIComponent(dbPath)}&query=${encodeURIComponent(query)}&params=${encodeURIComponent(params)}&title=${encodeURIComponent(title)}&xCol=${encodeURIComponent(xCol)}&yCol=${encodeURIComponent(yCol)}`;
            window.location.href = url;
        });
    });

    updatePaginationButtons();
}

function setupPagination() {
    PAGINATION_CONTAINER.innerHTML = ''; // Clear existing buttons
    const pageCount = Math.ceil(allRows.length / ROWS_PER_PAGE);
    for (let i = 1; i <= pageCount; i++) {
        const link = document.createElement('a');
        link.href = '#';
        link.innerText = i;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            displayTablePage(i);
        });
        PAGINATION_CONTAINER.appendChild(link);
    }
    updatePaginationButtons();
}

function updatePaginationButtons() {
    const links = PAGINATION_CONTAINER.querySelectorAll('a');
    links.forEach((link, index) => {
        if ((index + 1) === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

async function main() {
    LOADER.textContent = 'Loading ticker metadata...';
    await fetchTickerMetadata();

    try {
        LOADER.textContent = 'Initializing database engine...';
        const SQL = await initSqlJs({
            locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
        });

        LOADER.textContent = 'Fetching and decompressing database...';
        // Add cache-busting query parameter
        const response = await fetch(`${DB_URL}?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const compressedData = new Uint8Array(await response.arrayBuffer());
        const decompressedData = pako.inflate(compressedData);

        LOADER.textContent = 'Loading database...';
        const db = new SQL.Database(decompressedData);

        // Get all table names (which are the tickers)
        LOADER.textContent = 'Querying available tickers...';
        const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        if (!tablesResult || tablesResult.length === 0) {
            throw new Error("No ticker tables found in the database.");
        }
        const tickerTables = tablesResult[0].values.map(row => row[0]);

        // For each ticker, get the latest price
        LOADER.textContent = 'Fetching latest prices...';
        allRows = [];
        for (const table of tickerTables) {
            const stmt = db.prepare(`SELECT time, price FROM ${table} ORDER BY time DESC LIMIT 1`);
            if (stmt.step()) {
                const row = stmt.getAsObject();
                // Ticker name is the table name, which might have been sanitized
                // We find the original ticker from metadata to display correctly
                const originalTicker = Object.keys(tickerMetadata).find(k => k.replace(/[^a-zA-Z0-9_]/g, '_') === table);
                allRows.push({
                    ticker: originalTicker || table,
                    time: row.time,
                    price: row.price
                });
            }
            stmt.free();
        }

        // Sort tickers alphabetically for consistent order
        allRows.sort((a, b) => a.ticker.localeCompare(b.ticker));

        LOADER.style.display = 'none';
        displayTablePage(1);
        setupPagination();

    } catch (error) {
        LOADER.textContent = `Error: ${error.message}`;
        console.error(error);
    }
}

main();
