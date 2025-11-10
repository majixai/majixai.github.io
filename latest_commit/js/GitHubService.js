/**
 * A service class for interacting with the GitHub API.
 */
class GitHubService {
    #owner;
    #repo;
    #baseUrl;
    #cache;
    #stateManager;

    /**
     * @param {string} owner - The owner of the repository.
     * @param {string} repo - The name of the repository.
     */
    constructor(owner, repo) {
        this.#owner = owner;
        this.#repo = repo;
        this.#baseUrl = `https://api.github.com/repos/${this.#owner}/${this.#repo}`;
        this.#cache = new CacheService();
        this.#stateManager = StateManager.getInstance();
    }

    /**
     * Fetches the details for a single commit.
     * Checks the cache first, otherwise fetches from the API.
     * @private
     * @param {string} sha - The SHA of the commit to fetch.
     * @returns {Promise<object>} A promise that resolves with the detailed commit data.
     */
    async #getCommitDetails(sha) {
        const cachedCommit = await this.#cache.getCachedCommits(sha);
        if (cachedCommit) {
            console.log(`Loading commit ${sha.substring(0,7)} from cache.`);
            return cachedCommit;
        }
        console.log(`Fetching details for commit ${sha.substring(0,7)} from API.`);
        const response = await fetch(`${this.#baseUrl}/commits/${sha}`);
        if (!response.ok) {
            throw new Error(`GitHub API error for commit ${sha}: ${response.status}`);
        }
        const commitData = await response.json();
        await this.#cache.cacheCommits(sha, commitData);
        return commitData;
    }

    /**
     * Fetches the latest commits, gets their details, and updates the central state.
     */
    async fetchLatestCommits() {
        this.#stateManager.setState({ isLoading: true, error: null });
        try {
            // Step 1: Fetch the list of recent commit SHAs with a cache-busting parameter.
            const timestamp = new Date().getTime();
            const url = `${this.#baseUrl}/commits?per_page=5&t=${timestamp}`;
            console.log("Fetching latest commit list from:", url);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            const commitsOverview = await response.json();
            const shas = commitsOverview.map(c => c.sha);

            // Step 2: Fetch detailed data for each commit concurrently
            const commitDetailsPromises = shas.map(sha => this.#getCommitDetails(sha));
            const detailedCommitsData = await Promise.all(commitDetailsPromises);

            // Step 3: Create Commit instances and update state
            const commits = Commit.fromApiData(detailedCommitsData);
            this.#stateManager.setState({ commits, isLoading: false });

        } catch (error) {
            console.error("Error fetching or caching commits:", error);
            this.#stateManager.setState({ isLoading: false, error: "Failed to fetch commit details. Please try again later." });
        }
    }
}
