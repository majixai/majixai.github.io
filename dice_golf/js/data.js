/**
 * @fileoverview Service for fetching and caching game data.
 */

class DataService {
    /** @private {?Array<Object>} */
    static #cache = null;

    /**
     * Fetches the course data from a JSON file.
     * Implements a simple static cache to avoid redundant fetches.
     * @param {string} url The URL of the JSON file.
     * @returns {Promise<Array<Object>>} A promise that resolves with the hole data.
     */
    static async getHoleData(url) {
        if (DataService.#cache) {
            console.log("Returning course data from cache.");
            return Promise.resolve(DataService.#cache);
        }

        console.log("Fetching and parsing course data...");
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const jsonData = await response.json();

            DataService.#cache = jsonData; // Cache the result
            return jsonData;
        } catch (error) {
            console.error("Failed to load or parse course data:", error);
            return []; // Return empty array on failure
        }
    }
}
