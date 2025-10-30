document.addEventListener("DOMContentLoaded", () => {
    const owner = "majixai";
    const repo = "majixai.github.io";

    const url = `https://api.github.com/repos/${owner}/${repo}/commits`;

    fetch(url)
    .then(response => response.json())
    .then(data => {
        if (data && data.length > 0) {
            const latestCommitSha = data[0].sha;
            return fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${latestCommitSha}`);
        } else {
            throw new Error("No commits found.");
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data && data.files && data.files.length > 0) {
            const lastCommittedFile = data.files[data.files.length - 1].filename;
            document.getElementById("last-committed-file").textContent = lastCommittedFile;
        } else {
            document.getElementById("last-committed-file").textContent = "No files found in the latest commit.";
        }
    })
    .catch(error => {
        console.error("Error fetching data:", error);
        document.getElementById("last-committed-file").textContent = "Error fetching data.";
    });
});
