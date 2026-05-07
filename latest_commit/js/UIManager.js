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
    #resultCountEl;
    #stateManager;
    #animationGenerator = null;
    #isAnimating = false;

    /** Number of commits shown before "Load more" is needed. */
    static #PAGE_SIZE = 10;

    /** How many commits are currently being shown. */
    #shownCount = UIManager.#PAGE_SIZE;

    constructor() {
        this.#commitListEl = document.getElementById("commit-list");
        this.#loaderEl = document.getElementById("loader");
        this.#startAnimationBtn = document.getElementById("start-animation");
        this.#stopAnimationBtn = document.getElementById("stop-animation");
        this.#searchInput = document.getElementById("search-input");
        this.#resultCountEl = document.getElementById("result-count");

        this.#stateManager = StateManager.getInstance();
        this.#stateManager.subscribe(() => this.render());

        this.#startAnimationBtn.addEventListener("click", () => this.startAnimation());
        this.#stopAnimationBtn.addEventListener("click", () => this.stopAnimation());
        this.#searchInput.addEventListener("input", (e) => this.#handleSearch(e));
    }

    /**
     * Escapes a string for safe insertion into HTML.
     * @private
     */
    static #escHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Handles the search input event.
     * @private
     */
    #handleSearch(e) {
        this.#shownCount = UIManager.#PAGE_SIZE;
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
            this.#commitListEl.innerHTML = `
                <div class="w3-panel w3-red w3-round p-3 m-3">
                    <p class="mb-2"><strong>⚠ Error:</strong> ${UIManager.#escHtml(state.error)}</p>
                    <button id="retry-btn" class="w3-button w3-white w3-border w3-border-red w3-small">
                        ↺ Retry
                    </button>
                </div>`;
            document.getElementById("retry-btn")?.addEventListener("click", () => {
                const githubService = new GitHubService("majixai", "majixai.github.io");
                githubService.fetchLatestCommits();
            });
            return;
        }

        if (!state.isLoading) {
            this.#renderLatestSiteBanner(state.latestSite);
            this.#updateResultCount(filteredCommits.length);
            this.#renderCommitTimeline(filteredCommits.slice(0, this.#shownCount));
            this.#renderLoadMore(filteredCommits.length);
            // Auto-animate newly rendered items so they are visible without requiring a button click.
            this.startAnimation();
        }
    }

    /**
     * Updates the result-count indicator.
     * @private
     */
    #updateResultCount(total) {
        if (!this.#resultCountEl) return;
        const shown = Math.min(this.#shownCount, total);
        if (total === 0) {
            this.#resultCountEl.textContent = 'No commits found';
        } else {
            this.#resultCountEl.textContent = `Showing ${shown} of ${total} commit${total !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Renders (or removes) a "Load more" button below the timeline.
     * @private
     */
    #renderLoadMore(total) {
        const existingBtn = document.getElementById("load-more-btn");
        if (existingBtn) existingBtn.remove();

        if (total <= this.#shownCount) return;

        const btn = document.createElement("div");
        btn.className = "text-center py-3";
        btn.innerHTML = `<button id="load-more-btn" class="load-more-btn">
            Load more (${total - this.#shownCount} remaining)
        </button>`;
        btn.querySelector("button").addEventListener("click", () => {
            this.#shownCount += UIManager.#PAGE_SIZE;
            this.render();
        });
        this.#commitListEl.after(btn);
    }

    /**
     * Renders (or updates) the banner that links to the most recently changed site.
     * @private
     */
    #renderLatestSiteBanner(latestSite) {
        const bannerId = 'latest-site-banner';
        let banner = document.getElementById(bannerId);

        if (!latestSite || !latestSite.latestSite) {
            if (banner) banner.remove();
            return;
        }

        if (!banner) {
            banner = document.createElement('div');
            banner.id = bannerId;
            banner.className = 'w3-panel w3-pale-blue w3-border w3-border-blue w3-round mb-3 mx-3 p-3';
            this.#commitListEl.parentNode.insertBefore(banner, this.#commitListEl);
        }

        const date = latestSite.latestDate
            ? new Date(latestSite.latestDate).toLocaleString()
            : '';
        const author = latestSite.latestAuthor
            ? ` by <strong>${UIManager.#escHtml(latestSite.latestAuthor)}</strong>`
            : '';
        const msg = latestSite.latestMessage
            ? `<em>${UIManager.#escHtml(latestSite.latestMessage)}</em>`
            : 'View latest site';
        const siteUrl = UIManager.#escHtml(latestSite.latestSite);

        banner.innerHTML = `
            <p class="mb-1"><strong>🚀 Most Recently Updated Site</strong>${date ? ' &mdash; ' + UIManager.#escHtml(date) : ''}${author}</p>
            <p class="mb-1">${msg}</p>
            <a href="${siteUrl}" target="_blank" rel="noopener noreferrer" class="w3-button w3-blue w3-small">Open Site →</a>
        `;
    }

    /**
     * Renders the commit timeline.
     * @private
     */
    #renderCommitTimeline(commits) {
        this.#commitListEl.innerHTML = "";

        const query = this.#stateManager.getState().searchQuery.trim();
        if (commits.length === 0) {
            const msg = query ? `No commits match "<strong>${UIManager.#escHtml(query)}</strong>".` : 'No commits found.';
            this.#commitListEl.innerHTML = `<p class="text-center p-4 text-muted">${msg}</p>`;
            return;
        }

        commits.forEach((commit, index) => {
            const shortSha = commit.sha ? commit.sha.slice(0, 7) : '';
            const item = document.createElement("div");
            item.className = `timeline-item ${index % 2 === 0 ? 'left' : 'right'}`;
            item.innerHTML = `
                <div class="timeline-content">
                    <div class="commit-sha">${UIManager.#escHtml(shortSha)}</div>
                    <h5>${UIManager.#escHtml(commit.message)}</h5>
                    <p class="commit-meta">
                        <span class="commit-author">${UIManager.#escHtml(commit.author.name)}</span>
                        &mdash;
                        <span class="commit-date">${commit.author.date.toLocaleString()}</span>
                    </p>
                    <a href="${UIManager.#escHtml(commit.url)}" target="_blank" rel="noopener noreferrer"
                       class="w3-button w3-small w3-light-grey">View Commit</a>
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
        const items = Array.from(this.#commitListEl.querySelectorAll('.timeline-item'));
        for (const item of items) {
            item.classList.add("visible");
            yield;
        }
    }

    /**
     * Starts (or replays) the commit list entrance animation.
     */
    startAnimation() {
        // Reset any in-progress animation first.
        if (this.#isAnimating) {
            this.#animationGenerator = null;
            this.#isAnimating = false;
        }
        // Reset visibility so the animation plays from the start.
        Array.from(this.#commitListEl.querySelectorAll('.timeline-item')).forEach(c => c.classList.remove("visible"));

        this.#isAnimating = true;
        this.#animationGenerator = this.#animationPlayer();
        const animate = () => {
            if (this.#animationGenerator && !this.#animationGenerator.next().done) {
                setTimeout(() => requestAnimationFrame(animate), 120);
            } else {
                this.#isAnimating = false;
            }
        };
        requestAnimationFrame(animate);
    }

    /**
     * Stops the animation and makes all items immediately visible.
     */
    stopAnimation() {
        this.#animationGenerator = null;
        this.#isAnimating = false;
        Array.from(this.#commitListEl.querySelectorAll('.timeline-item')).forEach(c => c.classList.add("visible"));
    }
}
