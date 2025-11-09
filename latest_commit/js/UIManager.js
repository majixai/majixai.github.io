/**
 * Manages the user interface, including DOM manipulation, animations, and event listeners.
 */
class UIManager {
    #commitListEl;
    #loaderEl;
    #startAnimationBtn;
    #stopAnimationBtn;
    #animationInterval = null;

    constructor() {
        this.#commitListEl = document.getElementById("commit-list");
        this.#loaderEl = document.getElementById("loader");
        this.#startAnimationBtn = document.getElementById("start-animation");
        this.#stopAnimationBtn = document.getElementById("stop-animation");

        this.#startAnimationBtn.addEventListener("click", () => this.startAnimation());
        this.#stopAnimationBtn.addEventListener("click", () => this.stopAnimation());
    }

    /**
     * Toggles the visibility of the loading spinner.
     * @param {boolean} show - Whether to show or hide the loader.
     */
    toggleLoader(show) {
        this.#loaderEl.style.display = show ? "block" : "none";
    }

    /**
     * Renders the list of commits to the UI.
     * @param {Array<Commit>} commits - An array of Commit instances to display.
     */
    renderCommits(commits) {
        this.#commitListEl.innerHTML = ""; // Clear existing content
        commits.slice(0, 5).forEach(commit => {
            const commitEl = this.#createCommitElement(commit);
            this.#commitListEl.appendChild(commitEl);
        });
    }

    /**
     * Creates an HTML element for a single commit.
     * @private
     * @param {Commit} commit - The commit object.
     * @returns {HTMLElement} The created commit element.
     */
    #createCommitElement(commit) {
        const item = document.createElement("div");
        item.className = "w3-panel w3-card-2 w3-light-grey commit-item";
        item.innerHTML = `
            <p><strong>SHA:</strong> <a href="${commit.url}" target="_blank">${commit.sha.substring(0, 7)}</a></p>
            <p><strong>Author:</strong> ${commit.author.name}</p>
            <p><strong>Message:</strong> ${commit.message}</p>
            <p><strong>Date:</strong> ${commit.author.date.toLocaleString()}</p>
        `;
        return item;
    }

    /**
     * Starts the commit list animation.
     */
    startAnimation() {
        this.stopAnimation(); // Stop any existing animation
        const commits = Array.from(this.#commitListEl.children);
        let i = 0;
        this.#animationInterval = setInterval(() => {
            if (i < commits.length) {
                commits[i].classList.add("visible");
                i++;
            } else {
                // Reset for the next loop
                i = 0;
                commits.forEach(c => c.classList.remove("visible"));
            }
        }, 600);
    }

    /**
     * Stops the commit list animation.
     */
    stopAnimation() {
        if (this.#animationInterval) {
            clearInterval(this.#animationInterval);
            this.#animationInterval = null;
        }
    }

    /**
     * Displays an error message to the user.
     * @param {string} message - The error message to display.
     */
    displayError(message) {
        this.#commitListEl.innerHTML = `<div class="w3-panel w3-red"><p>${message}</p></div>`;
    }
}
