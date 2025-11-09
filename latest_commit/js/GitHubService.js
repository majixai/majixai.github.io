/**
 * A service class for interacting with the GitHub API.
 */
class GitHubService {
    #owner;
    #repo;
    #url;
    #cache;

    /**
     * @param {string} owner - The owner of the repository.
     * @param {string} repo - The name of the repository.
     */
    constructor(owner, repo) {
        this.#owner = owner;
        this.#repo = repo;
        this.#url = `https://api.github.com/repos/${this.#owner}/${this.#repo}/commits`;
        this.#cache = new CacheService();
    }

    /**
     * Fetches the latest commits, using the cache if available.
     * @returns {Promise<Array<Commit>>} A promise that resolves with an array of Commit instances.
     */
    async getLatestCommits() {
        try {
            const cachedData = await this.#cache.getCachedCommits();
            if (cachedData && cachedData.length > 0) {
                console.log("Loading commits from cache.");
                // The cached data is already raw, so we can pass it directly
                return Commit.fromApiData(cachedData);
            }

            console.log("Fetching fresh data from the GitHub API.");
            const response = await fetch(this.#url);
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            const data = await response.json();

            // The data from the API is what we want to cache
            await this.#cache.cacheCommits(data);

            return Commit.fromApiData(data);
        } catch (error) {
            console.error("Error fetching or caching commits:", error);
            throw error;
        }
    }
}
