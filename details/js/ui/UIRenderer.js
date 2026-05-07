/**
 * @typedef {import('../types.js').IProduct} IProduct
 */

class UIRenderer {
    #outputElement;
    #renderCompleteCallback = () => {};

    /**
     * @param {string} outputElementId
     */
    constructor(outputElementId) {
        this.#outputElement = document.getElementById(outputElementId);
        if (!this.#outputElement) {
            throw new Error(`Output element with id ${outputElementId} not found.`);
        }
    }

    /**
     * Renders an animated loading state with a spinner.
     */
    renderLoading() {
        this.#outputElement.innerHTML = `
            <div class="w3-panel w3-pale-yellow w3-padding w3-round" role="status" aria-live="polite">
                <div style="display:flex;align-items:center;gap:.75rem;">
                    <div class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></div>
                    <span>Loading data&hellip;</span>
                </div>
            </div>`;
    }

    /**
     * Renders a styled error state with the error message.
     * @param {Error} error
     */
    renderError(error) {
        const msg = (error && error.message) ? error.message : String(error ?? 'Unknown error');
        this.#outputElement.innerHTML = `
            <div class="w3-panel w3-pale-red w3-border w3-border-red w3-round w3-padding" role="alert">
                <p style="margin:0;font-weight:600;">⚠ Failed to load data</p>
                <p style="margin:.4rem 0 0;font-size:.87rem;color:#555;">${UIRenderer.#escHtml(msg)}</p>
            </div>`;
    }

    /**
     * Renders the data as a grid of cards using a generator for memory efficiency.
     * @param {IProduct[]} data
     */
    renderData(data) {
        this.#outputElement.innerHTML = '';
        if (!data || data.length === 0) {
            this.#outputElement.innerHTML = '<p class="w3-panel w3-light-grey w3-round w3-padding">No data to display.</p>';
            this.#renderCompleteCallback();
            return;
        }

        const frag = document.createDocumentFragment();
        for (const card of this.#createCardGenerator(data)) {
            frag.appendChild(card);
        }
        this.#outputElement.appendChild(frag);
        this.#renderCompleteCallback();
    }

    /**
     * A generator function to create card elements.
     * @param {IProduct[]} data
     */
    *#createCardGenerator(data) {
        for (const item of data) {
            const card = document.createElement('div');
            card.className = 'w3-card-4 card';
            card.innerHTML = `
                <header class="w3-container w3-light-grey">
                    <h3>${UIRenderer.#escHtml(item.name)}</h3>
                </header>
                <div class="w3-container">
                    <p>Price: $${UIRenderer.#escHtml(String(item.price ?? '—'))}</p>
                    <p>Features: ${UIRenderer.#escHtml(item.features ?? '—')}</p>
                </div>
            `;
            yield card;
        }
    }

    /**
     * Sets a callback to be executed after rendering is complete.
     * @param {() => void} callback
     */
    onRenderComplete(callback) {
        this.#renderCompleteCallback = callback;
    }

    /**
     * Escapes a string for safe insertion into HTML.
     * @private
     */
    static #escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

export default UIRenderer;
