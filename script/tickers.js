// Do not use "save_tickers"

const tickers = ["aapl", "amod", "amzn", "atch", "brdg", "cyd", "goev", "meta", "mlgo", "pepg", "qvcgb", "stec", "tsla", "yyai"];

// Save the tickers array to localStorage
localStorage.setItem('tickers', JSON.stringify(tickers));

// Retrieve the tickers array from localStorage (example of how to use it)
const retrievedTickers = JSON.parse(localStorage.getItem('tickers'));

// Check if retrievedTickers is valid and is an array
if (Array.isArray(retrievedTickers)) {
    console.log("Retrieved tickers:", retrievedTickers); // Output the retrieved tickers
} else {
    console.error("Failed to retrieve tickers from localStorage or data is invalid.");
}
