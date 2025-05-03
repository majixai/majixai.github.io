// --- W3.CSS Sidebar Logic ---
var mySidebar = document.getElementById("mySidebar");
var overlayBg = document.getElementById("myOverlay");

function w3_open() {
    if (mySidebar.style.display === 'block') {
        mySidebar.style.display = 'none';
        overlayBg.style.display = "none";
    } else {
        mySidebar.style.display = 'block';
        overlayBg.style.display = "block";
    }
}

function w3_close() {
    mySidebar.style.display = "none";
    overlayBg.style.display = "none";
}

// --- Content Section Switching ---
const strategySections = document.querySelectorAll('.strategy-section');
const navLinks = document.querySelectorAll('.w3-sidebar .w3-button');

function showSection(sectionId) {
    // Hide all sections
    strategySections.forEach(section => {
        section.style.display = 'none';
    });

    // Remove active class from all links
    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    // Show the target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        // Add active class to the clicked link (match href)
        const activeLink = document.querySelector(`.w3-sidebar .w3-button[href="#${sectionId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        // Trigger chart generation if needed (or do it on load)
        // generateChartsForSection(sectionId); // Optional: generate charts on demand
    } else {
        // If target not found, show 'about' or default section
         document.getElementById('about').style.display = 'block';
         const aboutLink = document.querySelector(`.w3-sidebar .w3-button[href="#about"]`);
         if(aboutLink) aboutLink.classList.add('active');
    }
}

// --- Plotly Chart Generation ---

// Helper function to create underlying price range
function generatePriceRange(centerPrice, rangePercentage = 0.3) {
    const range = centerPrice * rangePercentage;
    const minPrice = Math.max(0, centerPrice - range); // Ensure price doesn't go below 0
    const maxPrice = centerPrice + range;
    const steps = 100;
    const stepSize = (maxPrice - minPrice) / steps;
    let prices = [];
    for (let i = 0; i <= steps; i++) {
        prices.push(minPrice + i * stepSize);
    }
    return prices;
}

// Helper function for Plotly layout
function getPlotlyLayout(title) {
    return {
        title: title,
        xaxis: {
            title: 'Underlying Price at Expiration',
            zeroline: true,
            zerolinewidth: 2,
            zerolinecolor: '#969696'
        },
        yaxis: {
            title: 'Profit / Loss',
            zeroline: true,
            zerolinewidth: 2,
            zerolinecolor: '#969696'
        },
        showlegend: false, // Keep it simple for single trace diagrams
        margin: { l: 50, r: 30, b: 50, t: 50, pad: 4 } // Adjust margins
    };
}

// --- Individual Strategy Plotting Functions ---

function plotLongCall(id = 'plotly-long-call') {
    const strike = 100;
    const premium = 2.50;
    const prices = generatePriceRange(strike);
    const profits = prices.map(p => Math.max(0, p - strike) - premium);
    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'green' } };
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Long ${strike} Call (Premium: ${premium.toFixed(2)})`));
}

function plotShortPut(id = 'plotly-short-put') {
    const strike = 95;
    const premium = 1.80;
    const prices = generatePriceRange(strike);
    const profits = prices.map(p => Math.min(0, strike - p) + premium);
    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'red' } };
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Short ${strike} Put (Premium: ${premium.toFixed(2)})`));
}

function plotBullCallSpread(id = 'plotly-bull-call-spread') {
    const longStrike = 100;
    const shortStrike = 105;
    const longPremium = 3.00;
    const shortPremium = 1.20;
    const netDebit = longPremium - shortPremium;
    const prices = generatePriceRange(longStrike);
    const profits = prices.map(p =>
        (Math.max(0, p - longStrike) - longPremium) + // Long Call P/L
        (Math.min(0, shortStrike - p) + shortPremium) // Short Call P/L - Treat premium as positive cash flow
    );
     // Alternative calc: clip profit/loss
    // const profits = prices.map(p => {
    //    let profit = (p <= longStrike) ? -netDebit : (p >= shortStrike ? (shortStrike - longStrike - netDebit) : (p - longStrike - netDebit));
    //    return profit;
    // });

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'blue' } };
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Bull Call Spread ${longStrike}/${shortStrike} (Debit: ${netDebit.toFixed(2)})`));
}


function plotBearPutSpread(id = 'plotly-bear-put-spread') {
    const longStrike = 100;
    const shortStrike = 95;
    const longPremium = 2.80;
    const shortPremium = 1.10;
    const netDebit = longPremium - shortPremium;
    const prices = generatePriceRange(longStrike);
    const profits = prices.map(p =>
        (Math.max(0, longStrike - p) - longPremium) + // Long Put P/L
        (Math.min(0, p - shortStrike) + shortPremium) // Short Put P/L
    );

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'orange' } };
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Bear Put Spread ${longStrike}/${shortStrike} (Debit: ${netDebit.toFixed(2)})`));
}


function plotCallButterfly(id = 'plotly-call-butterfly') {
    const lowStrike = 95;
    const midStrike = 100;
    const highStrike = 105;
    const lowPremium = 6.00; // Buy
    const midPremium = 3.00; // Sell x2
    const highPremium = 1.00; // Buy
    const netDebit = lowPremium - (2 * midPremium) + highPremium;

    const prices = generatePriceRange(midStrike);
    const profits = prices.map(p =>
        (Math.max(0, p - lowStrike) - lowPremium) +    // Long Call 1
        (-2 * (Math.max(0, p - midStrike) - midPremium)) + // Short Calls 2 (opposite P/L)
        (Math.max(0, p - highStrike) - highPremium)   // Long Call 3
    );

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'purple' } };
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Call Butterfly ${lowStrike}/${midStrike}/${highStrike} (Debit: ${netDebit.toFixed(2)})`));
}


function plotIronCondor(id = 'plotly-iron-condor') {
    // Legs: Buy Put Wing, Sell Put, Sell Call, Buy Call Wing
    const buyPutStrike = 90;
    const sellPutStrike = 95;
    const sellCallStrike = 105;
    const buyCallStrike = 110;
    // Premiums (example): positive for selling, negative for buying
    const buyPutPrem = -0.50;
    const sellPutPrem = 1.80;
    const sellCallPrem = 1.50;
    const buyCallPrem = -0.40;
    const netCredit = sellPutPrem + sellCallPrem + buyPutPrem + buyCallPrem; // Summing premiums (signs matter)

    const prices = generatePriceRange((sellPutStrike + sellCallStrike) / 2); // Center around middle

    const profits = prices.map(p => {
        const longPutProfit = Math.max(0, buyPutStrike - p) + buyPutPrem;
        const shortPutProfit = -Math.max(0, sellPutStrike - p) + sellPutPrem; // P/L of short put = -(P/L of long put) + premium
        const shortCallProfit = -Math.max(0, p - sellCallStrike) + sellCallPrem; // P/L of short call = -(P/L of long call) + premium
        const longCallProfit = Math.max(0, p - buyCallStrike) + buyCallPrem;
        return longPutProfit + shortPutProfit + shortCallProfit + longCallProfit;
    });

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#007bff' } }; // A distinct blue
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Iron Condor ${buyPutStrike}/${sellPutStrike}P ${sellCallStrike}/${buyCallStrike}C (Credit: ${netCredit.toFixed(2)})`));
}

function plotIronButterfly(id = 'plotly-iron-butterfly') {
    // Legs: Buy Put Wing, Sell ATM Put, Sell ATM Call, Buy Call Wing
    const buyPutStrike = 90;
    const sellStrike = 100; // Same strike for Put and Call
    const buyCallStrike = 110;
    // Premiums (example): positive for selling, negative for buying
    const buyPutPrem = -0.50;
    const sellPutPrem = 4.00; // Higher premium for ATM
    const sellCallPrem = 3.80; // Higher premium for ATM
    const buyCallPrem = -0.40;
    const netCredit = sellPutPrem + sellCallPrem + buyPutPrem + buyCallPrem;

    const prices = generatePriceRange(sellStrike); // Center around middle strike

     const profits = prices.map(p => {
        const longPutProfit = Math.max(0, buyPutStrike - p) + buyPutPrem;
        const shortPutProfit = -Math.max(0, sellStrike - p) + sellPutPrem;
        const shortCallProfit = -Math.max(0, p - sellStrike) + sellCallPrem;
        const longCallProfit = Math.max(0, p - buyCallStrike) + buyCallPrem;
        return longPutProfit + shortPutProfit + shortCallProfit + longCallProfit;
    });

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#ffc107' } }; // A distinct yellow/gold
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Iron Butterfly ${buyPutStrike}P / ${sellStrike}PC / ${buyCallStrike}C (Credit: ${netCredit.toFixed(2)})`));
}

function plotBoxSpread(id = 'plotly-box-spread') {
    // Legs: Buy C1, Sell C2, Buy P2, Sell P1
    const k1 = 100; // Lower Strike
    const k2 = 110; // Higher Strike
    // Example Premiums (signs matter: negative for buy, positive for sell)
    const buyCallPrem = -6.00;
    const sellCallPrem = 1.50;
    const buyPutPrem = -1.20; // Buy K2 Put
    const sellPutPrem = 4.00; // Sell K1 Put
    const netDebit = -(buyCallPrem + sellCallPrem + buyPutPrem + sellPutPrem); // Net cost = negative of sum of premiums

    const valueAtExpiry = k2 - k1;
    const profit = valueAtExpiry - netDebit;

    const prices = generatePriceRange(k1 + (k2-k1)/2, 0.4); // Wider range to show flatness

    // Profit is constant regardless of price
    const profits = prices.map(p => profit);

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'grey' } };
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Box Spread ${k1}/${k2} (Value: ${valueAtExpiry}, Debit: ${netDebit.toFixed(2)}, P/L: ${profit.toFixed(2)})`));
}


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Plot charts for the initially visible section (or all sections)
    // Showing 'about' first, but let's plot all charts on load for simplicity.
    // If performance becomes an issue with many charts, switch to plotting on demand
    // inside showSection().
    plotLongCall();
    plotShortPut();
    plotBullCallSpread();
    plotBearPutSpread();
    plotCallButterfly();
    plotIronCondor();
    plotIronButterfly();
    plotBoxSpread();

    // Set the initial active link/section if not 'about'
    // showSection('four-leg'); // Example: Start on 4-leg section
    showSection('about'); // Start on about section by default
});
