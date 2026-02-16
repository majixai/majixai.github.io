/**
 * Ticker Card component for displaying stock information.
 */
export class TickerCard {
    constructor(container, symbol) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        this.symbol = symbol;
        this.data = null;
    }

    /**
     * Set ticker data.
     * @param {Object} data - Stock data
     */
    setData(data) {
        this.data = data;
    }

    /**
     * Render the ticker card.
     * @returns {HTMLElement}
     */
    render() {
        const card = document.createElement('div');
        card.className = 'ticker-card';
        card.innerHTML = `
            <div class="ticker-header">
                <h2 class="ticker-symbol">${this.symbol}</h2>
                <span class="ticker-name">${this.data?.name || ''}</span>
            </div>
            <div class="ticker-body">
                <div class="ticker-price">
                    <span class="price-value">${this.formatPrice(this.data?.price)}</span>
                    <span class="price-change ${this.getPriceChangeClass()}">${this.formatChange()}</span>
                </div>
                <div class="ticker-details">
                    <div class="detail-item">
                        <span class="detail-label">Open</span>
                        <span class="detail-value">${this.formatPrice(this.data?.open)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">High</span>
                        <span class="detail-value">${this.formatPrice(this.data?.high)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Low</span>
                        <span class="detail-value">${this.formatPrice(this.data?.low)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Volume</span>
                        <span class="detail-value">${this.formatVolume(this.data?.volume)}</span>
                    </div>
                </div>
            </div>
        `;

        if (this.container) {
            this.container.innerHTML = '';
            this.container.appendChild(card);
        }

        return card;
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
     * Format price change.
     * @returns {string}
     */
    formatChange() {
        if (!this.data?.change) return '--';
        const sign = this.data.change >= 0 ? '+' : '';
        return `${sign}${this.data.change.toFixed(2)} (${sign}${(this.data.changePercent * 100).toFixed(2)}%)`;
    }

    /**
     * Get CSS class for price change.
     * @returns {string}
     */
    getPriceChangeClass() {
        if (!this.data?.change) return '';
        return this.data.change >= 0 ? 'price-up' : 'price-down';
    }

    /**
     * Format volume.
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
}
