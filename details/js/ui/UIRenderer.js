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
     * Renders a loading state.
     */
    renderLoading() {
        this.#outputElement.innerHTML = '<div class="w3-panel w3-blue"><p>Loading...</p></div>';
    }

    /**
     * Renders an error state.
     * @param {Error} error
     */
    renderError(error) {
        this.#outputElement.innerHTML = `<div class="w3-panel w3-red"><p>Error: ${error.message}</p></div>`;
    }

    /**
     * Renders the data.
     * @param {IProduct[]} data
     */
    renderData(data) {
        this.#outputElement.innerHTML = '';
        if (!data || data.length === 0) {
            this.#outputElement.innerHTML = '<p>No data to display.</p>';
            this.#renderCompleteCallback();
            return;
        }

        const cardGenerator = this.#createCardGenerator(data);
        for (const card of cardGenerator) {
            this.#outputElement.appendChild(card);
        }
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
                    <h3>${item.name}</h3>
                </header>
                <div class="w3-container">
                    <p>Price: $${item.price}</p>
                    <p>Features: ${item.features}</p>
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
}

export default UIRenderer;
