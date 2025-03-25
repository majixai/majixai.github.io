import { handleFetchError, copyToClipboard } from './ErrorHandling.js';
import { updateChart } from './Chart.js';

// Decorator to log method calls
function logMethod(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args) {
        console.log(`Calling ${propertyKey} with arguments: ${JSON.stringify(args)}`);
        return originalMethod.apply(this, args);
    };
    return descriptor;
}

// Decorator for error handling
function handleErrors(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args) {
        try {
            return await originalMethod.apply(this, args);
        } catch (error) {
            handleFetchError(error);
        }
    };
    return descriptor;
}

class Market {
    static instance;
    
    constructor(apiUrl) {
        if (Market.instance) {
            return Market.instance;
        }
        this.apiUrl = apiUrl;
        Market.instance = this;
    }

    @logMethod
    @handleErrors
    async fetchMarketData() {
        const symbol = this.#getStockSymbol();
        if (!symbol) {
            alert('Please enter a stock symbol.');
            return;
        }

        const response = await fetch(`${this.apiUrl}/quote/${symbol}:NASDAQ`);
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        const html = await response.text();
        document.getElementById('market-data').innerHTML = html;
    }

    @logMethod
    @handleErrors
    async fetchDataAndUpdateChart() {
        const data = await this.#getChartData();
        updateChart(data);
    }

    async #getChartData() {
        // Example data fetching logic
        return {
            labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
            prices: [65, 59, 80, 81, 56, 55, 40]
        };
    }

    #getStockSymbol() {
        return document.getElementById('stock-symbol').value;
    }
}

export const market = new Market('https://www.google.com/finance');
