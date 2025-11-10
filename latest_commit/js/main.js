(function() {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const owner = "majixai";
        const repo = "majixai.github.io";

        // Initialize the singleton StateManager
        const stateManager = StateManager.getInstance();

        // UIManager will subscribe to the StateManager and render automatically
        new UIManager();

        // GitHubService will fetch data and update the StateManager
        const githubService = new GitHubService(owner, repo);

        // Initial data fetch
        githubService.fetchLatestCommits();
    });
})();
