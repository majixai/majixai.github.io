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
     * Fetches online user data from the API using pagination.
     * Returns an array of fetched user data or throws an error.
     * @returns {Promise<Array<Object>>} A promise that resolves with an array of user objects.
     */
    async getOnlineRooms() {
        console.log("ApiService: Starting online user data fetch...");
        let fetchedUsers = [];
        let offset = 0;
        let continueFetching = true;
        let totalFetchedCount = 0;

        while (continueFetching && totalFetchedCount < this.#maxApiFetchLimit) {
            const apiUrl = `${this.#apiUrlBase}&limit=${this.#apiLimit}&offset=${offset}`;
            console.log(`ApiService: Fetching page (limit ${this.#apiLimit}, offset ${offset}). URL: ${apiUrl}`);
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    console.warn(`ApiService: Aborting fetch for offset ${offset} due to timeout (${this.#apiFetchTimeout}ms).`);
                    controller.abort();
                }, this.#apiFetchTimeout);

                const response = await fetch(apiUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                console.log(`ApiService: Response status for offset ${offset}: ${response.status}`);

                if (!response.ok) {
                    const errorBody = await response.text().catch(() => `Status: ${response.statusText}`);
                    console.error(`ApiService: HTTP error fetching offset ${offset}. Status: ${response.status}, Body: ${errorBody}`);
                    throw new Error(`HTTP error ${response.status} while fetching ${apiUrl}. Body: ${errorBody}`);
                }

                const data = await response.json();

                if (data && data.results && Array.isArray(data.results)) {
                    console.log(`ApiService: Received ${data.results.length} results in batch from offset ${offset}.`);
                    if (data.results.length > 0) {
                        fetchedUsers = fetchedUsers.concat(data.results);
                        totalFetchedCount = fetchedUsers.length;

                        if (data.results.length < this.#apiLimit) {
                            console.log("ApiService: Last page reached (results < limit). Stopping fetch.");
                            continueFetching = false;
                        } else {
                            offset += this.#apiLimit;
                        }
                    } else {
                        console.log(`ApiService: Received 0 results in batch from offset ${offset}. Stopping fetch.`);
                        continueFetching = false;
                    }
                } else {
                    console.warn(`ApiService: Response JSON does not contain a valid 'results' array from offset ${offset}:`, data);
                    continueFetching = false; // Stop if data structure is invalid
                }
            } catch (error) {
                console.error(`ApiService: Error during fetch for offset ${offset}:`, error);
                // Rethrow the error to be handled by the caller in script.js
                // This allows script.js to update the UI with an error message.
                throw error; 
            }
        } // End while loop

        if (totalFetchedCount >= this.#maxApiFetchLimit) {
            console.warn(`ApiService: Fetch stopped after reaching safety limit (${this.#maxApiFetchLimit} users). Data might be incomplete.`);
            // It's up to the caller (script.js) to decide how to handle this (e.g., show a warning).
        }

        console.log(`ApiService: Fetch cycle finished. Total users fetched in this cycle: ${totalFetchedCount}`);
        return fetchedUsers;
    }
}

// If not using ES modules, ApiService will be available on the window if this file is included.
// To make it explicitly global (though not always recommended if not needed):
// window.ApiService = ApiService;
