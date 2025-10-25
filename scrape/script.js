const DB_URL = 'finance.db.gz';
const LOADER = document.getElementById('loader');
const DATA_CONTAINER = document.getElementById('data-container');

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

    } catch (error) {
        LOADER.textContent = `Error: ${error.message}`;
        console.error(error);
    }
}

main();
