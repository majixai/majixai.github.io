/**
 * Quote Service for real-time quote updates.
 */
export class QuoteService {
    constructor(options = {}) {
        this.subscribers = new Map();
        this.pollingInterval = options.pollingInterval || 5000;
        this.pollerId = null;
        this.quotes = new Map();
    }

    /**
     * Subscribe to quote updates for a symbol.
     * @param {string} symbol - Stock symbol
     * @param {Function} callback - Callback function for updates
     * @returns {string} Subscription ID
     */
    subscribe(symbol, callback) {
        const subId = `${symbol}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        if (!this.subscribers.has(symbol)) {
            this.subscribers.set(symbol, new Map());
        }
        
        this.subscribers.get(symbol).set(subId, callback);
        
        // Start polling if not already running
        if (!this.pollerId) {
            this.startPolling();
        }
        
        return subId;
    }

    /**
     * Unsubscribe from quote updates.
     * @param {string} symbol - Stock symbol
     * @param {string} subId - Subscription ID
     */
    unsubscribe(symbol, subId) {
        const symbolSubs = this.subscribers.get(symbol);
        if (symbolSubs) {
            symbolSubs.delete(subId);
            
            if (symbolSubs.size === 0) {
                this.subscribers.delete(symbol);
            }
        }
        
        // Stop polling if no more subscribers
        if (this.subscribers.size === 0) {
            this.stopPolling();
        }
    }

    /**
     * Unsubscribe all for a symbol.
     * @param {string} symbol - Stock symbol
     */
    unsubscribeAll(symbol) {
        this.subscribers.delete(symbol);
        
        if (this.subscribers.size === 0) {
            this.stopPolling();
        }
    }

    /**
     * Start polling for quote updates.
     */
    startPolling() {
        if (this.pollerId) return;
        
        this.pollerId = setInterval(() => {
            this.pollQuotes();
        }, this.pollingInterval);
    }

    /**
     * Stop polling.
     */
    stopPolling() {
        if (this.pollerId) {
            clearInterval(this.pollerId);
            this.pollerId = null;
        }
    }

    /**
     * Poll quotes for all subscribed symbols in parallel.
     */
    async pollQuotes() {
        const symbols = Array.from(this.subscribers.keys());

        const results = await Promise.all(
            symbols.map(async (symbol) => {
                try {
                    const quote = await this.fetchQuote(symbol);
                    return { symbol, quote, error: null };
                } catch (error) {
                    return { symbol, quote: null, error };
                }
            })
        );

        for (const { symbol, quote, error } of results) {
            if (error) {
                console.error(`Failed to fetch quote for ${symbol}:`, error);
            } else {
                this.quotes.set(symbol, quote);
                this.notifySubscribers(symbol, quote);
            }
        }
    }

    /**
     * Fetch quote for a symbol.
     * @param {string} symbol - Stock symbol
     * @returns {Promise<Object>}
     */
    async fetchQuote(symbol) {
        // Placeholder for actual quote fetch
        // In a real implementation, this would call an API
        return {
            symbol: symbol.toUpperCase(),
            price: null,
            change: null,
            changePercent: null,
            volume: null,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Notify subscribers of quote update.
     * @param {string} symbol - Stock symbol
     * @param {Object} quote - Quote data
     */
    notifySubscribers(symbol, quote) {
        const symbolSubs = this.subscribers.get(symbol);
        if (symbolSubs) {
            for (const callback of symbolSubs.values()) {
                try {
                    callback(quote);
                } catch (error) {
                    console.error('Subscriber callback error:', error);
                }
            }
        }
    }

    /**
     * Get last known quote for a symbol.
     * @param {string} symbol - Stock symbol
     * @returns {Object|null}
     */
    getLastQuote(symbol) {
        return this.quotes.get(symbol.toUpperCase()) || null;
    }

    /**
     * Set polling interval.
     * @param {number} interval - Interval in milliseconds
     */
    setPollingInterval(interval) {
        this.pollingInterval = interval;
        
        if (this.pollerId) {
            this.stopPolling();
            this.startPolling();
        }
    }

    /**
     * Get list of subscribed symbols.
     * @returns {string[]}
     */
    getSubscribedSymbols() {
        return Array.from(this.subscribers.keys());
    }

    /**
     * Manually update a quote (for testing or external updates).
     * @param {string} symbol - Stock symbol
     * @param {Object} quote - Quote data
     */
    updateQuote(symbol, quote) {
        const normalizedSymbol = symbol.toUpperCase();
        this.quotes.set(normalizedSymbol, {
            ...quote,
            timestamp: new Date().toISOString()
        });
        this.notifySubscribers(normalizedSymbol, this.quotes.get(normalizedSymbol));
    }
}
