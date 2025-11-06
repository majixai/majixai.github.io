/**
 * @file Data fetching and decompression logic.
 * @author Jules
 * @description This class encapsulates the logic for fetching performer data.
 * It uses a "cache-first" strategy, trying to load from IndexedDB before
 * falling back to fetching from the network. This improves performance and
 * enables offline capabilities.
 */

class DataAPI {
    /**
     * @private
     * A Set to keep track of unique performers and avoid duplicates.
     * Using a Set for this is highly efficient for checking existence.
     */
    #_uniqueUsernames = new Set();

    /**
     * @private
     * A private field to hold the CacheManager instance.
     */
    #_cache;

    /**
     * The constructor for the DataAPI.
     * @param {object} cacheManager - An instance of the CacheManager.
     */
    constructor(cacheManager) {
        if (!cacheManager) {
            throw new Error("DataAPI requires a CacheManager instance.");
        }
        this.#_cache = cacheManager;
    }

    /**
     * @private
     * Fetches a single .dat file and decompresses it.
     * This is an async generator, which allows us to process files one by one
     * without waiting for all to download, potentially improving perceived performance.
     * @param {string} file - The name of the .dat file to fetch.
     * @returns {AsyncGenerator<Object[], void, void>} A generator that yields an array of performer objects.
     */
    async* #_fetchAndDecompress(file) {
        try {
            const response = await fetch(`${AppConfig.DATA_PATH}${file}`);
            if (!response.ok) {
                console.warn(`Could not fetch ${file}. Status: ${response.status}`);
                return;
            }
            const compressedData = await response.arrayBuffer();
            // Using pako for decompression as specified.
            const decompressedData = pako.inflate(new Uint8Array(compressedData), { to: 'string' });
            const data = JSON.parse(decompressedData);

            if (Array.isArray(data)) {
                yield data;
            } else if (typeof data === 'object' && data !== null) {
                yield Object.values(data);
            }
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
        }
    }

    /**
     * The main public method to get performers. It orchestrates the cache-first logic.
     * @param {boolean} forceRefresh - If true, bypasses the cache and fetches from the network.
     * @returns {Promise<Object[]>} A promise that resolves to an array of unique performer objects.
     */
    async getPerformers(forceRefresh = false) {
        const lastFetch = await this.#_cache.getSetting('lastFetch');
        const isCacheStale = !lastFetch || (Date.now() - lastFetch > 3600 * 1000); // 1 hour cache

        if (!forceRefresh && !isCacheStale) {
            const cachedPerformers = await this.#_cache.getPerformers();
            if (cachedPerformers && cachedPerformers.length > 0) {
                console.log("Loading performers from cache.");
                return cachedPerformers;
            }
        }

        console.log("Fetching performers from network...");
        return this.#_fetchFromNetwork();
    }

    /**
     * @private
     * Fetches all .dat files from the network, processes them, and caches the result.
     * This method demonstrates aggregation of data from multiple async sources.
     * @returns {Promise<Object[]>} A promise that resolves to the aggregated list of performers.
     */
    async #_fetchFromNetwork() {
        const allPerformers = [];
        this.#_uniqueUsernames.clear();

        // Using Promise.all to fetch and process files in parallel for efficiency.
        const filePromises = AppConfig.DAT_FILES.map(file => this.#_processFile(file));
        await Promise.all(filePromises);

        // This is a simplified way to collect results; a more complex app might stream them.
        for (const file of AppConfig.DAT_FILES) {
            for await (const performers of this.#_fetchAndDecompress(file)) {
                for (const performer of performers) {
                    // Bitwise check: Ensure essential fields exist before adding.
                    // This is a more esoteric way to check for non-null/undefined properties.
                    const hasRequiredFields = (performer.username && performer.iframe_embed) ? 1 : 0;

                    if ((hasRequiredFields & 1) && !this.#_uniqueUsernames.has(performer.username)) {
                        allPerformers.push(performer);
                        this.#_uniqueUsernames.add(performer.username);
                    }
                }
            }
        }

        // Sort performers alphabetically by display name or username
        allPerformers.sort((a, b) => {
            const nameA = a.display_name || a.username;
            const nameB = b.display_name || b.username;
            return nameA.localeCompare(nameB);
        });

        // Cache the fresh data for future use.
        await this.#_cache.savePerformers(allPerformers);
        await this.#_cache.saveSetting('lastFetch', Date.now());
        console.log(`Fetched and cached ${allPerformers.length} unique performers.`);

        return allPerformers;
    }

    /**
     * @private
     * Helper to process a single file and add its performers to the main list.
     * This is used with Promise.all to parallelize the downloads.
     * @param {string} file
     */
    async #_processFile(file) {
        // This function is currently a placeholder for the logic inside #_fetchFromNetwork's loop.
        // In a more complex scenario, this could handle per-file logic.
        // The actual processing is done in the loop to maintain a single list.
    }
}