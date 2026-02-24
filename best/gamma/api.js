class ApiService {
    #apiUrlBase;
    #apiLimit;
    #maxApiFetchLimit;
    #apiFetchTimeout;
    #retryAttempts;
    #retryBaseDelay;

    constructor(apiUrlBase, apiLimit, maxApiFetchLimit, apiFetchTimeout, retryAttempts = 3, retryBaseDelay = 1000) {
        this.#apiUrlBase = apiUrlBase;
        this.#apiLimit = apiLimit;
        this.#maxApiFetchLimit = maxApiFetchLimit;
        this.#apiFetchTimeout = apiFetchTimeout;
        this.#retryAttempts = retryAttempts;
        this.#retryBaseDelay = retryBaseDelay;
    }

    #delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

        for (let attempt = 0; attempt <= this.#retryAttempts; attempt++) {
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
                    const httpError = new Error(`HTTP error ${response.status} while fetching ${apiUrl}. Body: ${errorBody}`);
                    httpError.status = response.status;
                    throw httpError;
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

                // Success — break out of the retry loop
                break;
            } catch (error) {
                // Do not retry on HTTP 4xx client errors
                if (error.status && error.status >= 400 && error.status < 500) {
                    console.error(`ApiService: Client error (${error.status}) for offset ${requestedOffset}, not retrying.`);
                    throw error;
                }

                if (attempt < this.#retryAttempts) {
                    const backoff = this.#retryBaseDelay * Math.pow(2, attempt);
                    console.warn(`ApiService: Attempt ${attempt + 1}/${this.#retryAttempts + 1} failed for offset ${requestedOffset}. Retrying in ${backoff}ms...`, error.message);
                    await this.#delay(backoff);
                } else {
                    console.error(`ApiService: All ${this.#retryAttempts + 1} attempts failed for offset ${requestedOffset}:`, error);
                    throw error;
                }
            }
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
// window.ApiService = ApiService;
