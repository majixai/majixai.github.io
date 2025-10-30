
// IIFE to encapsulate the entire script
(function() {
    'use strict';
    class DataManager {
        #db = null;
        static #instance = null;

        /**
         * @private
         */
        constructor() {
            if (DataManager.#instance) {
                return DataManager.#instance;
            }
            DataManager.#instance = this;
        }

        /**
         * @returns {Promise<DataManager>}
         */
        static async getInstance() {
            if (!DataManager.#instance) {
                DataManager.#instance = new DataManager();
                await DataManager.#instance.#init();
            }
            return DataManager.#instance;
        }

        async #init() {
            try {
                const SQL = await initSqlJs({
                    locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
                });
                const response = await fetch('/scrape/finance.db.gz');
                const compressedData = new Uint8Array(await response.arrayBuffer());
                const decompressedData = pako.inflate(compressedData);
                this.#db = new SQL.Database(decompressedData);
            } catch (error) {
                console.error("Failed to initialize DataManager:", error);
                throw error;
            }
        }

        /**
         * @param {string} ticker
         * @returns {Promise<PriceData[]>}
         */
        async getTickerData(ticker) {
            console.log(`Calling getTickerData with args:`, [ticker]);
            const result = await new Promise((resolve, reject) => {
                if (!this.#db) return reject("Database not initialized.");
                const stmt = this.#db.prepare("SELECT scraped_at, price FROM prices WHERE ticker = :ticker ORDER BY scraped_at");
                stmt.bind({ ':ticker': ticker });
                const data = [];
                while (stmt.step()) {
                    const row = stmt.getAsObject();
                    row.price = Number(row.price);
                    data.push(row);
                }
                stmt.free();
                resolve(data);
            });
            console.log(`Called getTickerData, result:`, result);
            return result;
        }
    }
    window.DataManager = DataManager;
})();
