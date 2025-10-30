
// IIFE to encapsulate the entire script
(function() {
    'use strict';
    class DataManager {
        #db = null;
        static #instances = new Map();

        /**
         * @private
         */
        constructor() {
            // Private constructor
        }

        /**
         * @param {string} dbPath - The path to the database file.
         * @returns {Promise<DataManager>}
         */
        static async getInstance(dbPath) {
            if (!DataManager.#instances.has(dbPath)) {
                const instance = new DataManager();
                await instance.#init(dbPath);
                DataManager.#instances.set(dbPath, instance);
            }
            return DataManager.#instances.get(dbPath);
        }

        async #init(dbPath) {
            try {
                const SQL = await initSqlJs({
                    locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
                });
                const response = await fetch(dbPath);
                const compressedData = new Uint8Array(await response.arrayBuffer());
                const decompressedData = pako.inflate(compressedData);
                this.#db = new SQL.Database(decompressedData);
            } catch (error) {
                console.error(`Failed to initialize DataManager for ${dbPath}:`, error);
                throw error;
            }
        }

        /**
         * @param {string} query
         * @param {Object} params
         * @returns {Promise<Object[]>}
         */
        async executeQuery(query, params = {}) {
            console.log(`Executing query:`, query, `with params:`, params);
            const result = await new Promise((resolve, reject) => {
                if (!this.#db) return reject("Database not initialized.");
                try {
                    const stmt = this.#db.prepare(query);
                    stmt.bind(params);
                    const data = [];
                    while (stmt.step()) {
                        const row = stmt.getAsObject();
                        // Convert numeric values
                        for (const key in row) {
                            if (typeof row[key] === 'string' && !isNaN(row[key])) {
                                row[key] = Number(row[key]);
                            }
                        }
                        data.push(row);
                    }
                    stmt.free();
                    resolve(data);
                } catch (e) {
                    reject(e);
                }
            });
            console.log(`Query result:`, result);
            return result;
        }
    }
    window.DataManager = DataManager;
})();
