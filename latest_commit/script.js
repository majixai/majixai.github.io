document.addEventListener("DOMContentLoaded", () => {
    const owner = "majixai";
    const repo = "majixai.github.io";
    const url = `https://api.github.com/repos/${owner}/${repo}/commits`;

    fetch(url)
    .then(response => response.json())
    .then(data => {
        if (data && data.length > 0) {
            const commits = data.slice(0, 5);
            const commitList = document.getElementById("commit-list");
            commits.forEach(commitData => {
                const listItem = document.createElement("li");
                listItem.innerHTML = `
                    <strong>Author:</strong> ${commitData.commit.author.name} <br>
                    <strong>Date:</strong> ${new Date(commitData.commit.author.date).toLocaleString()} <br>
                    <strong>Message:</strong> ${commitData.commit.message} <br>
                    <strong>SHA:</strong> ${commitData.sha}
                `;
                commitList.appendChild(listItem);
            });
        } else {
            throw new Error("No commits found.");
        }
    })
    .catch(error => {
        console.error("Error fetching data:", error);
        document.getElementById("commit-list").textContent = "Error fetching data.";
    });
});
