/**
 * A service class for interacting with the GitHub API.
 */
class GitHubService {
    #owner;
    #repo;
    #url;
    #cache;
    #stateManager;

    /**
     * @param {string} owner - The owner of the repository.
     * @param {string} repo - The name of the repository.
     */
    constructor(owner, repo) {
        this.#owner = owner;
        this.#repo = repo;
        this.#url = `https://api.github.com/repos/${this.#owner}/${this.#repo}/commits`;
        this.#cache = new CacheService();
        this.#stateManager = StateManager.getInstance();
    }

    /**
     * Fetches the latest commits and updates the central state.
     */
    async fetchLatestCommits() {
        this.#stateManager.setState({ isLoading: true, error: null });
        try {
            const cachedData = await this.#cache.getCachedCommits();
            if (cachedData && cachedData.length > 0) {
                console.log("Loading commits from cache.");
                const commits = Commit.fromApiData(cachedData);
                this.#stateManager.setState({ commits, isLoading: false });
                return; // Exit early if we have cached data
            }

            console.log("Fetching fresh data from the GitHub API.");
            const response = await fetch(this.#url);
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            const data = await response.json();

            await this.#cache.cacheCommits(data);
            const commits = Commit.fromApiData(data);
            this.#stateManager.setState({ commits, isLoading: false });

        } catch (error) {
            console.error("Error fetching or caching commits:", error);
            this.#stateManager.setState({ isLoading: false, error: "Failed to fetch commits. Please try again later." });
        }
    }
}
