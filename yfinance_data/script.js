const DB_URL = 'yfinance.dat';
const LOADER = document.getElementById('loader');
const DATA_CONTAINER = document.getElementById('data-container');
const PAGINATION_CONTAINER = document.getElementById('pagination-container');
const ROWS_PER_PAGE = 10;

let allRows = [];
let currentPage = 1;

function displayTablePage(page) {
    currentPage = page;
    DATA_CONTAINER.innerHTML = '';
    const startIndex = (page - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    const paginatedRows = allRows.slice(startIndex, endIndex);

    let tableHtml = '<table><thead><tr><th>Ticker</th><th>Close</th><th>Date</th></tr></thead><tbody>';
    paginatedRows.forEach(row => {
        tableHtml += `<tr>
            <td>${row.Ticker}</td>
            <td>${row.Close}</td>
            <td>${row.Date}</td>
        </tr>`;
    });
    tableHtml += '</tbody></table>';
    DATA_CONTAINER.innerHTML = tableHtml;

    const tableRows = DATA_CONTAINER.querySelectorAll('tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('click', () => {
            const ticker = row.cells[0].textContent;
            // Link to Google Finance. Note: Exchange might be needed for some tickers for accuracy.
            // For this example, we'll assume the ticker is sufficient for major exchanges.
            const url = `https://www.google.com/finance/quote/${ticker}`;
            window.open(url, '_blank');
        });
    });

    updatePaginationButtons();
}

function setupPagination() {
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
    try {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
        });

        LOADER.textContent = 'Fetching and decompressing database...';
        // Add cache busting query parameter
        const response = await fetch(`${DB_URL}?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const compressedData = new Uint8Array(await response.arrayBuffer());
        const decompressedData = pako.inflate(compressedData);

        LOADER.textContent = 'Loading database...';
        const db = new SQL.Database(decompressedData);

        LOADER.textContent = 'Querying data...';
        const stmt = db.prepare(`
            SELECT Ticker, Close, Date
            FROM prices p
            WHERE p.rowid IN (SELECT MAX(rowid) FROM prices GROUP BY Ticker)
            ORDER BY Ticker
        `);

        while (stmt.step()) {
            allRows.push(stmt.getAsObject());
        }
        stmt.free();

        LOADER.style.display = 'none';
        displayTablePage(1);
        setupPagination();

    } catch (error) {
        LOADER.textContent = `Error: ${error.message}`;
        console.error(error);
    }
}

main();
