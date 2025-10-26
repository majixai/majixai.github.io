import { log } from '../utils/Logger.js';

class CacheService {
    // Protected member (by convention)
    _cache;

    constructor() {
        this._cache = new Map();
        log('In-memory cache service initialized.');
    }

    /**
     * @param {string} key
     * @param {any} value
     */
    set(key, value) {
        log(`Setting cache for key: ${key}`);
        this._cache.set(key, value);
    }

    /**
     * @param {string} key
     * @returns {any}
     */
    get(key) {
        log(`Getting cache for key: ${key}`);
        return this._cache.get(key);
    }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this._cache.has(key);
    }

    clear() {
        this._cache.clear();
        log('Cache cleared.');
    }
}

export default CacheService;
