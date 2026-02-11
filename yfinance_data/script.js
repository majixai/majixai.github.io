const DB_URL = 'yfinance.dat';
const LOADER = document.getElementById('loader');
const DATA_CONTAINER = document.getElementById('data-container');

function displayData(rows) {
    let tableHtml = '<table><thead><tr><th>Ticker</th><th>Close</th><th>Datetime</th></tr></thead><tbody>';
    rows.forEach(row => {
        tableHtml += `<tr>
            <td>${row.Ticker}</td>
            <td>${row.Close}</td>
            <td>${row.Datetime}</td>
        </tr>`;
    });
    tableHtml += '</tbody></table>';
    DATA_CONTAINER.innerHTML = tableHtml;

    const tableRows = DATA_CONTAINER.querySelectorAll('tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('click', () => {
            const ticker = row.cells[0].textContent;
            // Link to Google Finance for SPX
            const url = `https://www.google.com/finance/quote/SPX:INDEXSP`;
            window.open(url, '_blank');
        });
    });
}

async function main() {
    try {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
        });

        LOADER.textContent = 'Fetching and decompressing database...';
        const response = await fetch(`${DB_URL}?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const compressedData = new Uint8Array(await response.arrayBuffer());
        const decompressedData = pako.inflate(compressedData);

        LOADER.textContent = 'Loading database...';
        const db = new SQL.Database(decompressedData);

        LOADER.textContent = 'Querying data...';
        const stmt = db.prepare(`
            SELECT Ticker, Close, Datetime
            FROM prices
            ORDER BY Datetime DESC
            LIMIT 1
        `);

        let rows = [];
        if (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();

        LOADER.style.display = 'none';
        displayData(rows);

    } catch (error) {
        LOADER.textContent = `Error: ${error.message}`;
        console.error(error);
    }
}

main();
