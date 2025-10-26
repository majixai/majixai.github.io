import CacheService from './CacheService.js';
import DataMapper from '../models/DataMapper.js';
import { log } from '../utils/Logger.js';

/**
 * @typedef {import('../types.js').IProduct} IProduct
 */

class DataService {
    #cache; // Private member

    constructor() {
        this.#cache = new CacheService();
    }

    /**
     * Public method to fetch data based on type.
     * @param {string} type - 'json' or 'sqlite'
     * @returns {Promise<IProduct[]>}
     */
    async fetchData(type) {
        const cacheKey = `data-${type}`;
        if (this.#cache.has(cacheKey)) {
            log(`Fetching ${type} data from cache.`);
            return this.#cache.get(cacheKey);
        }

        log(`Fetching ${type} data from source.`);
        let data;
        switch (type) {
            case 'json':
                data = await this.#fetchJsonData();
                break;
            case 'sqlite':
                data = await this.#fetchSqliteData();
                break;
            default:
                throw new Error('Unsupported data type');
        }

        this.#cache.set(cacheKey, data);
        return data;
    }

    /**
     * Private method to fetch and process JSON data.
     * @returns {Promise<IProduct[]>}
     */
    async #fetchJsonData() {
        // In a real app, this would be a fetch call.
        // Simulating with a delay.
        await new Promise(resolve => setTimeout(resolve, 500));
        const rawData = [
            { id: 1, name: 'Product A', price: 100, features: 1 }, // Feature: Basic
            { id: 2, name: 'Product B', price: 200, features: 3 }, // Features: Basic, Premium
            { id: 3, name: 'Product C', price: 300, features: 5 }  // Features: Basic, Pro
        ];
        return rawData.map(DataMapper.mapProduct);
    }

    /**
     * Private method to fetch and process gzipped SQLite data.
     * @returns {Promise<IProduct[]>}
     */
    async #fetchSqliteData() {
        const sqlPromise = initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.5.0/${file}` });
        const dataPromise = fetch('db/finance.db.gz').then(res => res.arrayBuffer());
        const [SQL, buffer] = await Promise.all([sqlPromise, dataPromise]);

        const gunzipped = pako.inflate(new Uint8Array(buffer));
        const db = new SQL.Database(gunzipped);

        const stmt = db.prepare("SELECT * FROM prices LIMIT 10");
        const results = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push({
                id: row.ticker,
                name: row.ticker,
                price: row.price,
                features: 1 // Example feature
            });
        }
        stmt.free();
        db.close();
        return results.map(DataMapper.mapProduct);
    }
}

export default DataService;
