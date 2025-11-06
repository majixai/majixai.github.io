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
    #_onPerformerSelectCallback; // A hook to communicate with the main engine.
    #_paginationControls;
    #_goToTopButton;
    #_gridPanel;

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
     */
    constructor(selectors, onPerformerSelect) {
        // Object destructuring for cleaner access to selectors.
        const { grid, iframe, pagination, goToTop, gridPanel } = selectors;
        this.#_gridContainer = document.querySelector(grid);
        this.#_iframeViewer = document.querySelector(iframe);
        this.#_paginationControls = document.querySelector(pagination);
        this.#_goToTopButton = document.querySelector(goToTop);
        this.#_gridPanel = document.querySelector(gridPanel);
        this.#_onPerformerSelectCallback = onPerformerSelect;

        if (!this.#_gridContainer || !this.#_iframeViewer || !this.#_paginationControls || !this.#_goToTopButton || !this.#_gridPanel) {
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

        this.#_goToTopButton.addEventListener('click', () => {
            this.#_gridPanel.scrollTo({ top: 0, behavior: 'smooth' });
        });

        this.#_gridPanel.addEventListener('scroll', () => {
            if (this.#_gridPanel.scrollTop > 200) {
                this.#_goToTopButton.style.display = 'block';
            } else {
                this.#_goToTopButton.style.display = 'none';
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
        this.#_gridPanel.scrollTop = 0; // Scroll to top of grid on page change
    }

    /**
     * Renders the pagination controls.
     * @param {number} currentPage - The current active page.
     * @param {number} totalPages - The total number of pages.
     * @param {function(number): void} onPageChange - Callback for when a page button is clicked.
     */
    renderPagination(currentPage, totalPages, onPageChange) {
        this.#_paginationControls.innerHTML = '';
        if (totalPages <= 1) return;

        const fragment = document.createDocumentFragment();

        // Previous Button
        const prevButton = document.createElement('button');
        prevButton.textContent = '«';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => onPageChange(currentPage - 1));
        fragment.appendChild(prevButton);

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.disabled = i === currentPage;
            pageButton.addEventListener('click', () => onPageChange(i));
            fragment.appendChild(pageButton);
        }

        // Next Button
        const nextButton = document.createElement('button');
        nextButton.textContent = '»';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => onPageChange(currentPage + 1));
        fragment.appendChild(nextButton);

        this.#_paginationControls.appendChild(fragment);
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
}