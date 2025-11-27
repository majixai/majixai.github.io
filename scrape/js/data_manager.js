/**
 * @fileoverview Manages data fetching, decompression, and querying for the scrape engine.
 */

class DataManager {
    #db;

    constructor() {
        this.#db = null;
    }

    /**
     * Initializes the database by fetching, decompressing, and loading it.
     * @param {string} url The URL of the compressed database file.
     * @returns {Promise<void>}
     */
    async init(url) {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
        });
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const compressedData = new Uint8Array(await response.arrayBuffer());
        const decompressedData = pako.inflate(compressedData);
        this.#db = new SQL.Database(decompressedData);

    }

    /**
     * Gets the latest price for all tickers.
     * @returns {Array<Object>} An array of ticker data objects.
     */
    getTickerData() {
        const stmt = this.#db.prepare(`
            SELECT ticker, name, price, scraped_at
            FROM prices p
            WHERE p.id = (SELECT MAX(id) FROM prices WHERE ticker = p.ticker)
            ORDER BY ticker
        `);
        const data = [];
        while (stmt.step()) {
            data.push(stmt.getAsObject());
        }
        stmt.free();
        return data;
    }

    /**
     * Calculates and returns summary statistics from the database.
     * @returns {Object} An object containing total tickers, last update time, and average price.
     */
    getSummaryStatistics() {
        const totalStmt = this.#db.prepare('SELECT COUNT(DISTINCT ticker) as count FROM prices');
        totalStmt.step();
        const totalTickers = totalStmt.getAsObject().count;
        totalStmt.free();

        const lastUpdateStmt = this.#db.prepare('SELECT MAX(scraped_at) as last_update FROM prices');
        lastUpdateStmt.step();
        const lastUpdate = lastUpdateStmt.getAsObject().last_update;
        lastUpdateStmt.free();

        const avgPriceStmt = this.#db.prepare(`
            SELECT AVG(CAST(price as REAL)) as avg_price
            FROM prices
            WHERE id IN (SELECT MAX(id) FROM prices GROUP BY ticker)
        `);
        avgPriceStmt.step();
        const avgPriceResult = avgPriceStmt.getAsObject();
        const avgPrice = avgPriceResult.avg_price || 0;
        avgPriceStmt.free();

        return { totalTickers, lastUpdate, avgPrice };
    }
}
