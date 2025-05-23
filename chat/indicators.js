// chat/indicators.js

class MovingAverage {
    #period; // Private property

    constructor(period) {
        if (period <= 0) throw new Error("Period must be greater than 0.");
        this.#period = period;
    }

    calculate(dataArray) {
        if (!dataArray || dataArray.length < this.#period) {
            // Not enough data to calculate
            return null; 
        }
        const relevantData = dataArray.slice(dataArray.length - this.#period);
        const sum = relevantData.reduce((acc, val) => acc + val, 0);
        return sum / this.#period;
    }
}

class RSIIndicator {
    #period; // Private property

    constructor(period) {
        if (period <= 0) throw new Error("Period must be greater than 0.");
        this.#period = period;
    }

    calculate(dataArray) {
        if (!dataArray || dataArray.length < this.#period + 1) {
             // Need at least period + 1 data points to get 'period' changes
            return null;
        }

        let gains = 0;
        let losses = 0;

        // Calculate initial average gain and loss from the first '#period' changes
        for (let i = 1; i <= this.#period; i++) {
            const change = dataArray[i] - dataArray[i - 1];
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }

        let avgGain = gains / this.#period;
        let avgLoss = losses / this.#period;

        // Smooth RSI for subsequent periods (if more data was provided for a full RSI series)
        // For a single RSI value from a limited dataset, this initial calculation is often used.
        // If we were calculating a series, we'd iterate from period + 1 to dataArray.length -1:
        // for (let i = this.#period + 1; i < dataArray.length; i++) {
        // const change = dataArray[i] - dataArray[i-1];
        // gains = (gains * (this.#period -1) + (change > 0 ? change : 0)) / this.#period;
        // losses = (losses * (this.#period -1) + (change < 0 ? Math.abs(change) :0)) / this.#period;
        // }
        
        if (avgLoss === 0) {
            return 100; // Prevent division by zero; if all losses are zero, RSI is 100
        }

        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        return rsi;
    }
}
