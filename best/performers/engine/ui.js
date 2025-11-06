/**
 * @file UI Manager for the Performer Application.
 * @author Jules
 * @description This class is responsible for all DOM manipulations, rendering, and user event handling.
 * It follows the principle of Separation of Concerns, keeping presentation logic
 * separate from the core application (data) logic.
 */

class UIManager {
    // Private fields to hold DOM element references and state.
    #_gridContainer;
    #_iframeViewer;
    #_searchInput;
    #_refreshButton;
    #_onPerformerSelectCallback; // A hook to communicate with the main engine.
    #_onRefreshCallback;

    /**
     * Represents a single performer in the UI.
     * This is a simple data structure, an "interface" in spirit, to ensure consistency.
     * @typedef {object} Performer
     * @property {string} username
     * @property {string} display_name
     * @property {string} image_url
     * @property {string} iframe_embed
     */

    /**
     * The constructor for the UIManager.
     * @param {object} selectors - A map of CSS selectors for required elements.
     * @param {function(Performer): void} onPerformerSelect - A callback function to execute when a performer is selected.
     * @param {function(): void} onRefresh - A callback function to execute when the refresh button is clicked.
     */
    constructor(selectors, onPerformerSelect, onRefresh) {
        // Object destructuring for cleaner access to selectors.
        const { grid, iframe, searchInput, refreshButton } = selectors;
        this.#_gridContainer = document.querySelector(grid);
        this.#_iframeViewer = document.querySelector(iframe);
        this.#_searchInput = document.querySelector(searchInput);
        this.#_refreshButton = document.querySelector(refreshButton);
        this.#_onPerformerSelectCallback = onPerformerSelect;
        this.#_onRefreshCallback = onRefresh;


        if (!this.#_gridContainer || !this.#_iframeViewer || !this.#_searchInput || !this.#_refreshButton) {
            throw new Error("UIManager could not find all required elements in the DOM.");
        }

        this.#_initEventListeners();
    }

    /**
     * @private
     * Sets up all necessary event listeners for the UI controls.
     * This demonstrates encapsulation of the component's behavior.
     */
    #_initEventListeners() {
        // Use event delegation for the performer cards for better performance.
        this.#_gridContainer.addEventListener('click', (event) => {
            const card = event.target.closest('.performer-card');
            if (card && this.#_onPerformerSelectCallback) {
                // The performer data is retrieved from the element itself.
                const performerData = JSON.parse(card.dataset.performer);
                this.#_onPerformerSelectCallback(performerData);
            }
        });

        this.#_searchInput.addEventListener('input', (event) => {
            this.filterPerformers(event.target.value);
        });

        this.#_refreshButton.addEventListener('click', () => {
            if (this.#_onRefreshCallback) {
                this.#_onRefreshCallback();
            }
        });
    }

    /**
     * @private
     * Creates the HTML structure for a single performer card.
     * This method uses template literals and includes an inline SVG for a modern look.
     * @param {Performer} performer - The performer object.
     * @returns {HTMLElement} The created card element.
     */
    #_createPerformerCard(performer) {
        const card = document.createElement('div');
        card.className = 'performer-card';
        // Store the full object on a data attribute for easy access on click.
        card.dataset.performer = JSON.stringify(performer);

        const name = performer.display_name || performer.username;
        const imageUrl = performer.image_url || 'placeholder.svg'; // Placeholder for missing images

        // Using a more complex structure with an SVG icon and modern CSS properties.
        card.innerHTML = `
            <div class="card-image-container">
                <img src="${imageUrl}" alt="${name}" loading="lazy">
                <div class="card-overlay">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                </div>
            </div>
            <div class="card-content">
                <h3>${name}</h3>
            </div>
        `;
        return card;
    }

    /**
     * Renders a list of performers into the grid.
     * @param {Performer[]} performers - An array of performer objects.
     */
    renderPerformers(performers) {
        this.#_gridContainer.innerHTML = ''; // Clear previous content
        const fragment = document.createDocumentFragment();
        performers.forEach(performer => {
            fragment.appendChild(this.#_createPerformerCard(performer));
        });
        this.#_gridContainer.appendChild(fragment);
    }

    /**
     * Updates the main iframe viewer with a performer's stream.
     * @param {Performer} performer - The selected performer.
     */
    updateViewer(performer) {
        if (performer && performer.iframe_embed) {
            this.#_iframeViewer.src = performer.iframe_embed;

            // Highlight the selected card
            document.querySelectorAll('.performer-card.selected').forEach(c => c.classList.remove('selected'));
            const cardToSelect = this.#_gridContainer.querySelector(`[data-performer*='"username":"${performer.username}"']`);
            if(cardToSelect) {
                cardToSelect.classList.add('selected');
            }
        }
    }


    /**
     * Displays a loading message in the grid.
     */
    showLoading() {
        this.#_gridContainer.innerHTML = '<p class="loading-message">Loading performers...</p>';
    }

    /**
     * Displays an error message in the grid.
     */
    showError() {
        this.#_gridContainer.innerHTML = '<p class="error-message">Could not load performers. Please try again later.</p>';
    }

    /**
     * Filters the displayed performers based on the search query.
     * @param {string} query - The search query.
     */
    filterPerformers(query) {
        const lowerCaseQuery = query.toLowerCase();
        const cards = this.#_gridContainer.querySelectorAll('.performer-card');
        cards.forEach(card => {
            const performerData = JSON.parse(card.dataset.performer);
            const name = (performerData.display_name || performerData.username).toLowerCase();
            if (name.includes(lowerCaseQuery)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }
}