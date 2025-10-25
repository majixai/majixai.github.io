// JSDoc for IPriceData interface
/**
 * @typedef {object} IPriceData
 * @property {string} ticker
 * @property {string} name
 * @property {string} price
 * @property {string} scraped_at
 */

// JSDoc for ITickerDetail interface
/**
 * @typedef {object} ITickerDetail
 * @property {string} name
 * @property {IPriceData[]} historicalData
 */

class DataService {
    // Private members
    #db = null;
    #cache = new Map();

    // Public static members
    static TICKER_TYPE = {
        TECH: 1,    // 001
        FINANCE: 2, // 010
        RETAIL: 4,  // 100
    };

    constructor() {
        if (DataService.instance) {
            return DataService.instance;
        }
        DataService.instance = this;
    }

    /**
     * Initializes the database, fetching and decompressing it if not cached.
     * @private
     */
    async #initializeDatabase() {
        if (this.#db) return;

        if (this.#cache.has('db')) {
            this.#db = this.#cache.get('db');
            return;
        }

        const SQL = await initSqlJs({
            locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
        });

        const response = await fetch('finance.db.gz');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const compressedData = new Uint8Array(await response.arrayBuffer());
        const decompressedData = pako.inflate(compressedData);

        this.#db = new SQL.Database(decompressedData);
        this.#cache.set('db', this.#db);
    }

    /**
     * A generator function to yield the latest price data for each ticker.
     * @public
     * @returns {Generator<IPriceData>}
     */
    async *getLatestPrices() {
        await this.#initializeDatabase();
        const stmt = this.#db.prepare(`
            SELECT ticker, name, price, scraped_at
            FROM prices p
            WHERE p.id = (SELECT MAX(id) FROM prices WHERE ticker = p.ticker)
            ORDER BY ticker
        `);

        while (stmt.step()) {
            yield stmt.getAsObject();
        }
        stmt.free();
    }

    /**
     * Retrieves all historical data for a given ticker.
     * @public
     * @param {string} ticker
     * @returns {Promise<ITickerDetail>}
     */
    async getTickerDetails(ticker) {
        await this.#initializeDatabase();
        const stmt = this.#db.prepare("SELECT * FROM prices WHERE ticker = :ticker ORDER BY scraped_at DESC", { ':ticker': ticker });

        const historicalData = [];
        let name = "Unknown Ticker";
        while (stmt.step()) {
            const row = stmt.getAsObject();
            if (name === "Unknown Ticker") name = row.name;
            historicalData.push(row);
        }
        stmt.free();

        return { name, historicalData };
    }
}
