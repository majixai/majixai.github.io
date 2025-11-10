/**
 * Manages the user interface, including DOM manipulation, animations, and event listeners.
 * This class is state-driven and subscribes to the StateManager.
 */
class UIManager {
    #commitListEl;
    #loaderEl;
    #startAnimationBtn;
    #stopAnimationBtn;
    #searchInput;
    #stateManager;
    #animationGenerator = null;
    #isAnimating = false;

    constructor() {
        this.#commitListEl = document.getElementById("commit-list");
        this.#loaderEl = document.getElementById("loader");
        this.#startAnimationBtn = document.getElementById("start-animation");
        this.#stopAnimationBtn = document.getElementById("stop-animation");
        this.#searchInput = document.getElementById("search-input");

        this.#stateManager = StateManager.getInstance();
        this.#stateManager.subscribe(() => this.render());

        this.#startAnimationBtn.addEventListener("click", () => this.startAnimation());
        this.#stopAnimationBtn.addEventListener("click", () => this.stopAnimation());
        this.#searchInput.addEventListener("input", (e) => this.#handleSearch(e));
    }

    /**
     * Handles the search input event.
     * @private
     * @param {Event} e - The input event.
     */
    #handleSearch(e) {
        this.#stateManager.setState({ searchQuery: e.target.value });
    }

    /**
     * Renders the entire UI based on the current state.
     */
    render() {
        const state = this.#stateManager.getState();
        const filteredCommits = this.#stateManager.getFilteredCommits();

        this.#loaderEl.style.display = state.isLoading ? "block" : "none";

        if (state.error) {
            this.#commitListEl.innerHTML = `<div class="w3-panel w3-red"><p>${state.error}</p></div>`;
            return;
        }

        if (!state.isLoading) {
            this.#renderCommitTimeline(filteredCommits);
        }
    }

    /**
     * Renders the commit timeline, including links to affected directories.
     * @private
     * @param {Array<Commit>} commits - An array of Commit instances to display.
     */
    #renderCommitTimeline(commits) {
        this.#commitListEl.innerHTML = ""; // Clear existing content
        if (commits.length === 0) {
            this.#commitListEl.innerHTML = "<p>No commits found matching your search.</p>";
            return;
        }

        commits.forEach((commit, index) => {
            const directoryLinks = commit.affectedDirectories
                .map(dir => `<a href="https://majixai.github.io/${dir}/" class="badge badge-primary mr-1">${dir}</a>`)
                .join('');

            const item = document.createElement("div");
            item.className = `timeline-item ${index % 2 === 0 ? 'left' : 'right'}`;
            item.innerHTML = `
                <div class="timeline-content">
                    <h5>${commit.message}</h5>
                    <p class="mb-2"><small>${commit.author.name} - ${commit.author.date.toLocaleString()}</small></p>
                    <div class="mb-2">
                        ${directoryLinks}
                    </div>
                    <a href="${commit.url}" target="_blank" class="w3-button w3-small w3-light-grey">View Commit</a>
                </div>
            `;
            this.#commitListEl.appendChild(item);
        });
    }

    /**
     * A generator function to control the staggered animation of timeline items.
     * @private
     */
    *#animationPlayer() {
        const commits = Array.from(this.#commitListEl.children);
        for (const commit of commits) {
            commit.classList.add("visible");
            yield; // Pause execution until the next frame
        }
    }

    /**
     * Starts the commit list animation.
     */
    startAnimation() {
        if (this.#isAnimating) return;
        this.#isAnimating = true;
        this.#animationGenerator = this.#animationPlayer();
        const animate = () => {
            if (this.#animationGenerator && !this.#animationGenerator.next().done) {
                setTimeout(() => requestAnimationFrame(animate), 300);
            } else {
                this.#isAnimating = false;
            }
        };
        requestAnimationFrame(animate);
    }

    /**
     * Stops the commit list animation.
     */
    stopAnimation() {
        this.#animationGenerator = null;
        this.#isAnimating = false;
        // Optionally remove visible classes to reset the animation
        Array.from(this.#commitListEl.children).forEach(c => c.classList.remove("visible"));
    }
}
