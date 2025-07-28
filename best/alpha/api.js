class ApiService {
    #apiUrlBase;
    #apiLimit;
    #maxApiFetchLimit;
    #apiFetchTimeout;

    constructor(apiUrlBase, apiLimit, maxApiFetchLimit, apiFetchTimeout) {
        this.#apiUrlBase = apiUrlBase;
        this.#apiLimit = apiLimit;
        this.#maxApiFetchLimit = maxApiFetchLimit;
        this.#apiFetchTimeout = apiFetchTimeout;
    }

    /**
     * Fetches a single page of online user data from the API.
     * Returns an object containing the users for the page, the next offset, and a flag indicating if more data is available.
     * @param {number} requestedOffset - The offset to use for fetching the page. Defaults to 0.
     * @returns {Promise<Object>} A promise that resolves with an object: { users: Array, nextOffset: number, hasMore: boolean }.
     */
    async getOnlineRooms(requestedOffset = 0) {
        console.log(`ApiService: Fetching page (limit ${this.#apiLimit}, offset ${requestedOffset}).`);
        const apiUrl = `${this.#apiUrlBase}&limit=${this.#apiLimit}&offset=${requestedOffset}`;
        
        let usersForThisPage = [];
        let hasMoreData = false;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.warn(`ApiService: Aborting fetch for offset ${requestedOffset} due to timeout (${this.#apiFetchTimeout}ms).`);
                controller.abort();
            }, this.#apiFetchTimeout);

            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            console.log(`ApiService: Response status for offset ${requestedOffset}: ${response.status}`);

            if (!response.ok) {
                const errorBody = await response.text().catch(() => `Status: ${response.statusText}`);
                console.error(`ApiService: HTTP error fetching offset ${requestedOffset}. Status: ${response.status}, Body: ${errorBody}`);
                throw new Error(`HTTP error ${response.status} while fetching ${apiUrl}. Body: ${errorBody}`);
            }

            const data = await response.json();

            if (data && data.results && Array.isArray(data.results)) {
                usersForThisPage = data.results;
                console.log(`ApiService: Received ${usersForThisPage.length} results for offset ${requestedOffset}.`);
                hasMoreData = usersForThisPage.length === this.#apiLimit;
            } else {
                console.warn(`ApiService: Response JSON does not contain a valid 'results' array from offset ${requestedOffset}:`, data);
                // usersForThisPage remains [], hasMoreData remains false
            }
        } catch (error) {
            console.error(`ApiService: Error during fetch for offset ${requestedOffset}:`, error);
            // Rethrow the error to be handled by the caller in script.js
            throw error; 
        }

        return {
            users: usersForThisPage,
            nextOffset: requestedOffset + usersForThisPage.length,
            hasMore: hasMoreData
        };
    }
}

// If not using ES modules, ApiService will be available on the window if this file is included.
// To make it explicitly global (though not always recommended if not needed):
window.ApiService = ApiService;
