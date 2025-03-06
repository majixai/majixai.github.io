const fs = require('fs');
const path = require('path');
const { LinearRegression } = require('ml-regression-polynomial');
const numeric = require('numeric');
const { GoogleGenerativeAI } = require("@google/generative-ai");
// Configure your Gemini API key in the .env file or directly here
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_FILE_HTML = path.join(__dirname, 'output.json');

/**
 * Parses a CSV string into an array of objects.
 * @param {string} csvText
 * @returns {Array<object>}
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length === headers.length) {
            const row = {};
            for (let j = 0; j < headers.length; j++) {
                if (headers[j].toLowerCase() === 'date') {
                    row[headers[j]] = new Date(values[j]);
                } else {
                    row[headers[j]] = parseFloat(values[j]);
                }
            }
            data.push(row);
        } else {
            console.warn(`Skipping row due to incorrect number of columns: ${values}`);
        }
    }
    return data;
}

/**
 * Calculates the covariance between two arrays of numbers.
 * @param {Array<number>} arr1
 * @param {Array<number>} arr2
 * @returns {number}
 */
function calculateCovariance(arr1, arr2) {
    if (!arr1 || !arr2 || arr1.length !== arr2.length || arr1.length < 2) return NaN;
    const n = arr1.length;
    const mean1 = arr1.reduce((a, b) => a + b, 0) / n;
    const mean2 = arr2.reduce((a, b) => a + b, 0) / n;
    let covarianceSum = 0;
    for (let i = 0; i < n; i++) {
        covarianceSum += (arr1[i] - mean1) * (arr2[i] - mean2);
    }
    return covarianceSum / (n - 1);
}

/**
 * Calculates the standard deviation of an array of numbers.
 * @param {Array<number>} arr
 * @returns {number}
 */
function calculateStandardDeviation(arr) {
    if (!arr || arr.length < 2) return NaN;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sqDiffArray = arr.map(val => (val - mean) ** 2);
    const avgSqDiff = sqDiffArray.reduce((a, b) => a + b, 0) / (arr.length - 1);
    return Math.sqrt(avgSqDiff);
}

/**
 * Performs linear regression on the given data.
 * @param {Array<number>} xValues - The x values.
 * @param {Array<number>} yValues - The y values.
 * @returns {object} - The slope and intercept of the linear regression.
 */
function calculateLinearRegression(xValues, yValues) {
    if (xValues.length !== yValues.length || xValues.length < 2) {
        return { slope: NaN, intercept: NaN };
    }

    const regression = new LinearRegression(xValues, yValues);
    return { slope: regression.slope, intercept: regression.intercept };
}

/**
 * Calculates the eigenvalues of a covariance matrix.
 * @param {Array<Array<number>>} matrix - The covariance matrix.
 * @returns {Array<number>} - The eigenvalues.
 */
function calculateEigenvalues(matrix) {
    try {
      const eig = numeric.eig(matrix);
      return eig.lambda.x; // Return real parts of eigenvalues
    } catch (error) {
      console.error('Error calculating eigenvalues:', error);
      return [NaN];
    }
}

/**
 * Calculates the Black-Scholes call option price (simplified).
 * @param {number} spotPrice - Current stock price.
 * @param {number} strikePrice - Option strike price.
 * @param {number} riskFreeRate - Risk-free interest rate.
 * @param {number} timeToExpiry - Time to expiration (in years).
 * @param {number} volatility - Implied volatility.
 * @returns {number} - The call option price.
 */
function blackScholesSimplified(spotPrice, strikePrice, riskFreeRate, timeToExpiry, volatility) {
    const d1 = (Math.log(spotPrice / strikePrice) + (riskFreeRate + 0.5 * volatility ** 2) * timeToExpiry) / (volatility * Math.sqrt(timeToExpiry));
    const d2 = d1 - volatility * Math.sqrt(timeToExpiry);

    const normCDF = (x) => {
        return 0.5 + 0.5 * erf(x / Math.sqrt(2));
    };
    const erf = (x) => {
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;

        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x);

        const t = 1 / (1 + p * x);
        const y = 1 - ((((a5 * t + a4) * t) + a3) * t + a2) * t + a1 * t * Math.exp(-x * x);
        return sign * y;
    };

    const callPrice = spotPrice * normCDF(d1) - strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normCDF(d2);
    return callPrice;
}

/**
 * Calculates the stochastic oscillator (%K and %D).
 * @param {Array<object>} data - The OHLCV data.
 * @param {number} periodK - The %K period.
 * @param {number} periodD - The %D period.
 * @returns {object} - An object with %K and %D arrays.
 */
function calculateStochasticOscillator(data, periodK = 14, periodD = 3) {
    if (data.length < periodK) return { K: [], D: [] };

    const K = [];
    for (let i = periodK - 1; i < data.length; i++) {
        const subData = data.slice(i - periodK + 1, i + 1);
        const lowestLow = Math.min(...subData.map(item => item.Low));
        const highestHigh = Math.max(...subData.map(item => item.High));
        const currentClose = data[i].Close;
        const k = ((currentClose - lowestLow) / (highestHigh - lowestHigh)) * 100;
        K.push(k);
    }

    const D = [];
    for (let i = periodD - 1; i < K.length; i++) {
        const subK = K.slice(i - periodD + 1, i + 1);
        const d = subK.reduce((sum, val) => sum + val, 0) / periodD;
        D.push(d);
    }

    return { K, D };
}

/**
 * Calculates the Average True Range (ATR).
 * @param {Array<object>} data - The OHLCV data.
 * @param {number} period - The ATR period.
 * @returns {Array<number>} - The ATR values.
 */
function calculateATR(data, period = 14) {
    if (data.length < period) return [];

    const TR = [];
    for (let i = 1; i < data.length; i++) {
        const high = data[i].High;
        const low = data[i].Low;
        const prevClose = data[i - 1].Close;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        TR.push(tr);
    }

    const ATR = [];
    ATR.push(TR.slice(0, period).reduce((a, b) => a + b, 0) / period);

    for (let i = period; i < TR.length; i++) {
        const currentATR = (ATR[ATR.length - 1] * (period - 1) + TR[i]) / period;
        ATR.push(currentATR);
    }
    return ATR;
}

/**
 * Calculates the Bollinger Bands (BB) and Bollinger Band Width (BBW).
 * @param {Array<object>} data - The OHLCV data.
 * @param {number} period - The BB period.
 * @param {number} stdMultiplier - The standard deviation multiplier.
 * @returns {object} - An object with upper, middle, lower BB, and BBW arrays.
 */
function calculateBollingerBands(data, period = 20, stdMultiplier = 2) {
    if (data.length < period) return { upper: [], middle: [], lower: [], bbw: [] };

    const middle = [];
    for (let i = period - 1; i < data.length; i++) {
        const subData = data.slice(i - period + 1, i + 1);
        const avgClose = subData.reduce((sum, item) => sum + item.Close, 0) / period;
        middle.push(avgClose);
    }

    const upper = [];
    const lower = [];
    const bbw = [];
    for (let i = 0; i < middle.length; i++) {
        const subData = data.slice(i, i + period);
        const stdDev = calculateStandardDeviation(subData.map(item => item.Close));
        upper.push(middle[i] + stdMultiplier * stdDev);
        lower.push(middle[i] - stdMultiplier * stdDev);
        bbw.push(((upper[i] - lower[i]) / middle[i]) * 100);
    }
    return { upper, middle, lower, bbw };
}

/**
 * Generates a buy/sell signal based on various indicators.
 * @param {Array<object>} data - The OHLCV data.
 * @param {object} indicators - The pre-calculated indicators.
 * @param {number} currentIndex - The index of the current data point.
 * @returns {string} - "Buy", "Sell", or "Hold".
 */
function generateSignal(data, indicators, currentIndex) {
    if (currentIndex < 1) return "Hold";
    const { K, D } = indicators.stochastic;
    const { upper, lower } = indicators.bollinger;
    const currentClose = data[currentIndex].Close;
    const prevClose = data[currentIndex - 1].Close;
    const currentK = K[currentIndex-1];
    const currentD = D[currentIndex-1];
    const prevK = K[currentIndex-2];
    const prevD = D[currentIndex-2];
    const currentUpper = upper[currentIndex-1];
    const currentLower = lower[currentIndex-1];
    const signal = "Hold";
    // Example logic:
    if (currentK < 20 && currentD < 20 && prevK < prevD && currentK > currentD ) return "Buy";
    if (currentK > 80 && currentD > 80 && prevK > prevD && currentK < currentD) return "Sell";
    if (currentClose > currentUpper && prevClose < currentUpper) return "Sell";
    if (currentClose < currentLower && prevClose > currentLower) return "Buy";
    return signal;
}
/**
 * Processes a CSV file to calculate various financial metrics, generates buy/sell signals, and uses Gemini AI for analysis.
 * @param {string} filePath - The path to the CSV file.
 * @returns {Promise<object>} - An object containing all calculated data.
 */
async function processCSV(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const parsedData = parseCSV(data);

        if (parsedData.length < 20 || !parsedData[0].Open || !parsedData[0].Close || !parsedData[0].High || !parsedData[0].Low) {
            throw new Error(`Invalid CSV data in ${filePath}. Ensure the CSV has Open, Close, High, Low columns and at least 20 rows.`);
        }

        const openPrices = parsedData.map(row => row.Open);
        const closePrices = parsedData.map(row => row.Close);
        const highPrices = parsedData.map(row => row.High);
        const lowPrices = parsedData.map(row => row.Low);

        // Basic calculations
        const covariance = calculateCovariance(openPrices, closePrices);
        const standardDeviation = calculateStandardDeviation(closePrices);

        // Linear regression
        const xValues = Array.from({ length: closePrices.length }, (_, i) => i);
        const linearRegression = calculateLinearRegression(xValues, closePrices);

        // Eigenvalues (example covariance matrix - needs adjustment for real use)
        const covarianceMatrix = [
            [calculateCovariance(openPrices, openPrices), calculateCovariance(openPrices, closePrices)],
            [calculateCovariance(closePrices, openPrices), calculateCovariance(closePrices, closePrices)]
        ];
        const eigenvalues = calculateEigenvalues(covarianceMatrix);

        // Black-Scholes (example values - needs adjustment for real use)
        const spotPrice = closePrices[closePrices.length - 1]; // Last close price as example
        const strikePrice = spotPrice * 1.05; // 5% above spot as example
        const riskFreeRate = 0.05;
        const timeToExpiry = 1; // 1 year
        const volatility = standardDeviation / spotPrice ; // Using stdev as a proxy
        const blackScholesPrice = blackScholesSimplified(spotPrice, strikePrice, riskFreeRate, timeToExpiry, volatility);

        // Technical indicators
        const stochastic = calculateStochasticOscillator(parsedData);
        const atr = calculateATR(parsedData);
        const bollinger = calculateBollingerBands(parsedData);

        // Generate signals
        const currentSignal = generateSignal(parsedData, { stochastic, bollinger }, parsedData.length - 1);
        const nextDaySignal = generateSignal(parsedData, { stochastic, bollinger }, parsedData.length - 2);
        // Gemini AI analysis
        const geminiAnalysis = await analyzeWithGemini(parsedData);

        return {
            covariance,
            standardDeviation,
            linearRegression,
            eigenvalues,
            blackScholesPrice,
            stochastic,
            atr,
            bollinger,
            currentSignal,
            nextDaySignal,
            geminiAnalysis,
        };
    } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message);
        return {
            covariance: NaN,
            standardDeviation: NaN,
            linearRegression: { slope: NaN, intercept: NaN },
            eigenvalues: [NaN],
            blackScholesPrice: NaN,
            stochastic: { K: [], D: [] },
            atr: [],
            bollinger: { upper: [], middle: [], lower: [], bbw: [] },
            currentSignal: "Error",
            nextDaySignal: "Error",
            geminiAnalysis: "Error analyzing with gemini.",
        };
    }
}

/**
 * Analyzes the data using the Gemini AI model.
 * @param {Array<object>} parsedData - The parsed CSV data.
 * @returns {Promise<string>} - The Gemini AI analysis result.
 */
async function analyzeWithGemini(parsedData) {
    if (!GEMINI_API_KEY) {
        console.error("Gemini API key not configured.");
        return "Gemini API key not configured.";
    }
    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const last10Days = parsedData.slice(-10); // Analyze the last 10 days
        const prompt = `Analyze the following stock data and provide a brief summary of the trends and any potential investment opportunities. Data format is [date, open, high, low, close, volume]. Here is the Data:\n${JSON.stringify(last10Days)}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return text;
    } catch (error) {
        console.error("Error analyzing with Gemini:", error);
        return "Error analyzing with Gemini.";
    }
}

/**
 * Processes multiple CSV files and prints the results to the console and an output file.
 * @param {Array<string>} filePaths - Array containing the paths to the CSV files
 */
async function processMultipleCSVs(filePaths) {
    const outputData = [];
    for (const filePath of filePaths) {
        const result = await processCSV(filePath);
        const filename = path.basename(filePath); // Extract the filename

        if (isNaN(result.covariance) && isNaN(result.standardDeviation)) {
            console.log(`File: ${filename}: Data not valid`);
            outputData.push({ filename, status: "Data not valid" });
        } else {
            console.log(`File: ${filename}`);
            console.log(`  Covariance: ${result.covariance.toFixed(4)}`);
            console.log(`  Standard Deviation: ${result.standardDeviation.toFixed(4)}`);
            console.log(`  Linear Regression - Slope: ${result.linearRegression.slope.toFixed(4)}, Intercept: ${result.linearRegression.intercept.toFixed(4)}`);
            console.log(`  Eigenvalues: ${result.eigenvalues.map(e => e.toFixed(4)).join(', ')}`);
            console.log(`  Black-Scholes Call Price: ${result.blackScholesPrice.toFixed(4)}`);
            console.log(`  Stochastic Oscillator - %K: [${result.stochastic.K.slice(-5).map(k => k.toFixed(2)).join(', ')}], %D: [${result.stochastic.D.slice(-5).map(d => d.toFixed(2)).join(', ')}]`);
            console.log(`  ATR (Last Value): ${result.atr.length > 0 ? result.atr[result.atr.length - 1].toFixed(4) : 'N/A'}`);
            console.log(`  Bollinger Bands - Upper: [${result.bollinger.upper.slice(-5).map(u => u.toFixed(2)).join(', ')}], Middle: [${result.bollinger.middle.slice(-5).map(m => m.toFixed(2)).join(', ')}], Lower: [${result.bollinger.lower.slice(-5).map(l => l.toFixed(2)).join(', ')}]`);
            console.log(`  Bollinger Band Width (Last Value): ${result.bollinger.bbw.length > 0 ? result.bollinger.bbw[result.bollinger.bbw.length - 1].toFixed(4) : 'N/A'}`);
            console.log(`  Current Day Signal: ${result.currentSignal}`);
            console.log(`  Next Day Signal: ${result.nextDaySignal}`);
            console.log(`  Gemini AI Analysis: ${result.geminiAnalysis}`);
             outputData.push({
                filename,
                covariance: result.covariance,
                standardDeviation: result.standardDeviation,
                linearRegression: result.linearRegression,
                eigenvalues: result.eigenvalues,
                blackScholesPrice: result.blackScholesPrice,
                stochastic: result.stochastic,
                atr: result.atr,
                bollinger: result.bollinger,
                currentSignal: result.currentSignal,
                nextDaySignal: result.nextDaySignal,
                geminiAnalysis: result.geminiAnalysis,
            });
        }
        console.log("\n--- End of File ---\n");
    }

     // Save the outputData to the JSON file
    try {
        fs.writeFileSync(OUTPUT_FILE_HTML, JSON.stringify(outputData, null, 2));
        console.log(`Data saved to ${OUTPUT_FILE_HTML}`);
    } catch (error) {
        console.error(`Error saving data to ${OUTPUT_FILE_HTML}:`, error);
    }
}

/**
 * Main function to run the CSV processing.
 */
async function main() {
    // Example Usage (Adjust file paths as needed):
    const filePaths = [
        path.join(__dirname, 'ATCH_1d_1y.csv'),
        path.join(__dirname, 'ATCH_1h_10d.csv'),
        path.join(__dirname, 'TSLA_1d_1y.csv'),
        path.join(__dirname, 'TSLA_1h_10d.csv'),
        // Add more file paths here...
    ];

    const exampleCSVContent = path.join(__dirname, 'AAPL_1d_1y.csv');
    filePaths.forEach((file)=>{
        try{
            fs.writeFileSync(file,exampleCSVContent);
        } catch (e){
            console.error(`Could not create file ${file}`);
        }
    });
    await processMultipleCSVs(filePaths);
}

main();
