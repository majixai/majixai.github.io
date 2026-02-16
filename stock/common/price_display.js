/**
 * Price Display component for showing real-time price updates.
 */
export class PriceDisplay {
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;
        this.options = {
            showChange: true,
            showVolume: false,
            animated: true,
            ...options
        };
        this.currentPrice = null;
        this.previousPrice = null;
    }

    /**
     * Update the price display.
     * @param {Object} data - Price data
     */
    update(data) {
        this.previousPrice = this.currentPrice;
        this.currentPrice = data.price;

        this.render(data);

        if (this.options.animated) {
            this.animatePriceChange();
        }
    }

    /**
     * Render the price display.
     * @param {Object} data - Price data
     */
    render(data) {
        if (!this.container) return;

        const changeClass = this.getChangeClass(data.change);
        const changeSign = data.change >= 0 ? '+' : '';

        this.container.innerHTML = `
            <div class="price-display ${changeClass}">
                <span class="current-price">${this.formatPrice(data.price)}</span>
                ${this.options.showChange ? `
                    <span class="price-change">
                        <span class="change-value">${changeSign}${this.formatPrice(data.change)}</span>
                        <span class="change-percent">(${changeSign}${(data.changePercent * 100).toFixed(2)}%)</span>
                    </span>
                ` : ''}
                ${this.options.showVolume ? `
                    <span class="volume">Vol: ${this.formatVolume(data.volume)}</span>
                ` : ''}
            </div>
        `;
    }

    /**
     * Get CSS class based on price change.
     * @param {number} change - Price change value
     * @returns {string}
     */
    getChangeClass(change) {
        if (change > 0) return 'positive';
        if (change < 0) return 'negative';
        return 'neutral';
    }

    /**
     * Animate price change.
     */
    animatePriceChange() {
        if (!this.container) return;

        const priceElement = this.container.querySelector('.current-price');
        if (!priceElement) return;

        const animationClass = this.currentPrice > this.previousPrice 
            ? 'price-tick-up' 
            : this.currentPrice < this.previousPrice 
                ? 'price-tick-down' 
                : '';

        if (animationClass) {
            priceElement.classList.add(animationClass);
            setTimeout(() => {
                priceElement.classList.remove(animationClass);
            }, 500);
        }
    }

    /**
     * Format price value.
     * @param {number} price - Price value
     * @returns {string}
     */
    formatPrice(price) {
        if (price === null || price === undefined) return '--';
        return `$${parseFloat(price).toFixed(2)}`;
    }

    /**
     * Format volume value.
     * @param {number} volume - Volume value
     * @returns {string}
     */
    formatVolume(volume) {
        if (!volume) return '--';
        if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
        if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
        if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
        return volume.toString();
    }

    /**
     * Set animated mode.
     * @param {boolean} enabled - Whether animations are enabled
     */
    setAnimated(enabled) {
        this.options.animated = enabled;
    }
}
