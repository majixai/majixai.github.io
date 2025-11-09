(function() {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const owner = "majixai";
        const repo = "majixai.github.io";

        const uiManager = new UIManager();
        const githubService = new GitHubService(owner, repo);

        uiManager.toggleLoader(true);

        githubService.getLatestCommits()
            .then(commits => {
                uiManager.toggleLoader(false);
                uiManager.renderCommits(commits);
            })
            .catch(error => {
                uiManager.toggleLoader(false);
                uiManager.displayError("Failed to fetch commits. Please try again later.");
                console.error(error);
            });
    });
})();
