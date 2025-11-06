const DB_URL = 'finance.dat';
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

    let tableHtml = '<table><thead><tr><th>Ticker</th><th>Name</th><th>Price</th><th>Scraped At</th></tr></thead><tbody>';
    paginatedRows.forEach(row => {
        tableHtml += `<tr>
            <td>${row.ticker}</td>
            <td>${row.name}</td>
            <td>${row.price}</td>
            <td>${row.scraped_at}</td>
        </tr>`;
    });
    tableHtml += '</tbody></table>';
    DATA_CONTAINER.innerHTML = tableHtml;

    const tableRows = DATA_CONTAINER.querySelectorAll('tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('click', () => {
            const ticker = row.cells[0].textContent;
            const dbPath = '/requests/finance.dat';
            const query = `
                SELECT
                    scraped_at,
                    price,
                    AVG(price) OVER (ORDER BY scraped_at ROWS BETWEEN 49 PRECEDING AND CURRENT ROW) as MA_50
                FROM prices
                WHERE ticker = :ticker
                ORDER BY scraped_at
            `;
            const params = JSON.stringify({ ':ticker': ticker });
            const title = `${ticker} Price History with 50-Day Moving Average`;
            const xCol = 'scraped_at';
            const yCol = 'price,MA_50';

            const url = `/details/index.html?dbPath=${encodeURIComponent(dbPath)}&query=${encodeURIComponent(query)}&params=${encodeURIComponent(params)}&title=${encodeURIComponent(title)}&xCol=${encodeURIComponent(xCol)}&yCol=${encodeURIComponent(yCol)}`;
            window.location.href = url;
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
        const response = await fetch(DB_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const compressedData = new Uint8Array(await response.arrayBuffer());
        const decompressedData = pako.inflate(compressedData);

        LOADER.textContent = 'Loading database...';
        const db = new SQL.Database(decompressedData);

        LOADER.textContent = 'Querying data...';
        const stmt = db.prepare(`
            SELECT ticker, name, price, scraped_at
            FROM prices p
            WHERE p.id = (SELECT MAX(id) FROM prices WHERE ticker = p.ticker)
            ORDER BY ticker
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
