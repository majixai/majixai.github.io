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

// --- Global Variables ---
let strategyData = null; // To hold the loaded JSON data
const strategySections = document.querySelectorAll('.strategy-section');
const navLinks = document.querySelectorAll('.nav-link'); // Updated selector

// --- Content Section Switching ---
function showSection(sectionId) {
    strategySections.forEach(section => {
        section.style.display = 'none';
    });
    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        const activeLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        // Optional: If you want to ensure charts are visible after section switch
        // Plotly.restyle(targetSection.querySelectorAll('.plotly-chart')); // May help redraw if hidden
    } else {
        // Fallback to 'about' if the requested section doesn't exist
        const aboutSection = document.getElementById('about');
        if (aboutSection) {
            aboutSection.style.display = 'block';
            const aboutLink = document.querySelector(`.nav-link[href="#about"]`);
            if(aboutLink) aboutLink.classList.add('active');
        } else {
            console.error("'/about' section not found!");
        }
    }

    // Close sidebar on small screens after selection
    if (window.innerWidth <= 768) { // Adjust breakpoint as needed
         w3_close();
    }
}


// --- Plotly Chart Generation ---

// Helper function to create underlying price range
function generatePriceRange(centerPrice, rangePercentage = 0.15, steps = 200) { // Increased steps for smoother line
    if (typeof centerPrice !== 'number' || isNaN(centerPrice)) {
        // Fallback if center price is not valid
        centerPrice = 5975.00; // Use a reasonable default from MES data
        rangePercentage = 0.05; // Narrower range for generic default
    }
    const range = centerPrice * rangePercentage;
    const minPrice = Math.max(0.01, centerPrice - range); // Avoid exactly 0 for some calcs
    const maxPrice = centerPrice + range;
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
        title: { text: title, font: { size: 16 } },
        xaxis: {
            title: 'Underlying Price at Expiration',
            zeroline: true,
            zerolinewidth: 1,
            zerolinecolor: '#bdbdbd'
        },
        yaxis: {
            title: 'Profit / Loss',
            zeroline: true,
            zerolinewidth: 2,
            zerolinecolor: '#969696',
            tickformat: '$,.2f' // Format y-axis as currency
        },
        showlegend: false,
        margin: { l: 60, r: 30, b: 50, t: 50, pad: 4 }, // Adjusted margins
        hovermode: 'x unified', // Improved hover experience
        responsive: true // Make charts responsive
    };
}

// --- Payoff Calculation Functions ---

// Calculates P/L for a single option leg at expiration
function calculateLegPayoff(price, type, position, strike, premium) {
    const numericStrike = parseFloat(strike);
    const numericPremium = parseFloat(premium);
    if (isNaN(numericStrike) || isNaN(numericPremium)) return 0; // Handle invalid input

    let intrinsicValue = 0;
    if (type === 'call') {
        intrinsicValue = Math.max(0, price - numericStrike);
    } else { // put
        intrinsicValue = Math.max(0, numericStrike - price);
    }

    if (position === 'long') {
        return intrinsicValue - numericPremium;
    } else { // short
        return -intrinsicValue + numericPremium; // Premium received is positive initial cashflow
    }
}

// --- Strategy Plotting Functions ---
// These functions will read parameters from the DOM inputs
// They accept parameters, plot div id, and the full strategy object

function replotStrategy(strategy) {
    const parameters = {};
    const strategyPanel = document.querySelector(`.strategy-panel[data-strategy-id="${strategy.id}"]`);

    if (!strategyPanel) {
        console.error(`Strategy panel not found for strategy ID: ${strategy.id}`);
        return;
    }

    // Read current values from input fields within this strategy's panel
    for (const paramName in strategy.parameters) {
        const inputElement = strategyPanel.querySelector(`#${strategy.id}-${paramName}-input`);
        if (inputElement) {
             // Use parseFloat for numerical values, keep non-numerical as strings if necessary
            parameters[paramName] = parseFloat(inputElement.value);
             if (isNaN(parameters[paramName])) {
                 // If it's a string parameter (like expiry names), keep the string value
                 if (typeof strategy.parameters[paramName] === 'string' || inputElement.type === 'text') {
                      parameters[paramName] = inputElement.value;
                 } else { // Default to 0 for invalid numbers where a number is expected
                     parameters[paramName] = 0;
                     console.warn(`Invalid numeric input for ${strategy.id}-${paramName}, defaulted to 0.`);
                 }
             }
        } else {
            console.warn(`Input element not found for ${strategy.id}-${paramName}-input`);
            // Fallback to default parameter if input not found (shouldn't happen if population is correct)
            parameters[paramName] = strategy.parameters[paramName];
        }
    }

    const plotDivId = strategy.plotlyDivId;
    const plotFunction = plotFunctionMap[strategy.plotFunction];

    if (plotFunction && plotDivId) {
        // Pass the strategy object and the *current* parameters to the specific plot function
        // The plot function will read the parameters from the DOM inputs itself now
        // No, the parameters are already read into the `parameters` object. Pass that.
        plotFunction(parameters, plotDivId, strategy);
    } else {
        console.error(`Plot function "${strategy.plotFunction}" not found or plotDivId "${plotDivId}" missing for strategy: ${strategy.name}`);
    }
}

// Helper function to format currency for input placeholders/labels
function formatCurrency(value) {
    return value.toFixed(2);
}

function plotBasicOption(params, id, strategy) {
    const { type, position, strike, premium } = params;
    const prices = generatePriceRange(strike);
    const profits = prices.map(p => calculateLegPayoff(p, type, position, strike, premium));
    const trace = {
        x: prices, y: profits, type: 'scatter', mode: 'lines',
        line: { color: position === 'long' ? (type === 'call' ? 'green' : 'blue') : 'red' }
     };
     const posText = position.charAt(0).toUpperCase() + position.slice(1);
     const typeText = type.charAt(0).toUpperCase() + type.slice(1);
     const title = `${posText} ${strike.toFixed(2)} ${typeText} (Premium: ${premium.toFixed(2)})`;
    Plotly.newPlot(id, [trace], getPlotlyLayout(title));
}

function plotVerticalSpread(params, id, strategy) {
    const { type, position, strike1, strike2, premium1, premium2 } = params;
    // Ensure strikes are ordered correctly for calculation
    const lowerStrike = Math.min(strike1, strike2);
    const higherStrike = Math.max(strike1, strike2);
    // Premiums correspond to the specific strikes provided in params
    // Need to correctly map premium1/premium2 to lower/higher strike based on params.
    // The JSON structure maps premium1 to strike1 and premium2 to strike2.
    const lowerStrikePremium = strike1 === lowerStrike ? premium1 : premium2;
    const higherStrikePremium = strike1 === higherStrike ? premium1 : premium2;


    const centerPrice = (lowerStrike + higherStrike) / 2;
    const prices = generatePriceRange(centerPrice);
    let profits;
    let netCost;

    // Determine which leg is long and which is short based on type and position ('debit'/'credit')
    if (type === 'call') {
        if (position === 'debit') { // Bull Call: Buy K1 Call, Sell K2 Call (K1 < K2)
             netCost = lowerStrikePremium - higherStrikePremium;
             profits = prices.map(p =>
                 calculateLegPayoff(p, 'call', 'long', lowerStrike, lowerStrikePremium) +
                 calculateLegPayoff(p, 'call', 'short', higherStrike, higherStrikePremium)
             );
        } else { // position === 'credit' - Bear Call: Sell K1 Call, Buy K2 Call (K1 < K2)
            netCost = higherStrikePremium - lowerStrikePremium; // Credit is negative cost
             profits = prices.map(p =>
                 calculateLegPayoff(p, 'call', 'short', lowerStrike, lowerStrikePremium) +
                 calculateLegPayoff(p, 'call', 'long', higherStrike, higherStrikePremium)
             );
        }
    } else { // type === 'put'
         if (position === 'debit') { // Bear Put: Buy K2 Put, Sell K1 Put (K1 < K2)
            netCost = higherStrikePremium - lowerStrikePremium;
            profits = prices.map(p =>
                calculateLegPayoff(p, 'put', 'long', higherStrike, higherStrikePremium) +
                calculateLegPayoff(p, 'put', 'short', lowerStrike, lowerStrikePremium)
            );
        } else { // position === 'credit' - Bull Put: Sell K2 Put, Buy K1 Put (K1 < K2)
            netCost = lowerStrikePremium - higherStrikePremium; // Credit is negative cost
            profits = prices.map(p =>
                calculateLegPayoff(p, 'put', 'short', higherStrike, higherStrikePremium) +
                calculateLegPayoff(p, 'put', 'long', lowerStrike, lowerStrikePremium)
            );
        }
    }


    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'purple' } };
    const costType = netCost >= 0 ? 'Debit' : 'Credit';
    const costValue = Math.abs(netCost);
    const typeText = type.charAt(0).toUpperCase() + type.slice(1);
    const posText = position.charAt(0).toUpperCase() + position.slice(1);

    Plotly.newPlot(id, [trace], getPlotlyLayout(`${posText} ${typeText} Spread ${lowerStrike.toFixed(2)}/${higherStrike.toFixed(2)} (${costType}: ${costValue.toFixed(2)})`));
}

function plotButterfly(params, id, strategy) {
    const { type, strike1, strike2, strike3, premium1, premium2, premium3 } = params;
     // Assume strikes are ordered K1 < K2 < K3 as per description
    // Legs: Long K1, Short 2x K2, Long K3
    const netDebit = premium1 - (2 * premium2) + premium3;
    const centerPrice = strike2;
    const prices = generatePriceRange(centerPrice);

    const profits = prices.map(p =>
        calculateLegPayoff(p, type, 'long', strike1, premium1) +
        (2 * calculateLegPayoff(p, type, 'short', strike2, premium2)) + // Sell 2
        calculateLegPayoff(p, type, 'long', strike3, premium3)
    );

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'orange' } };
    const typeText = type.charAt(0).toUpperCase() + type.slice(1);
     const costType = netDebit >= 0 ? 'Net Debit' : 'Net Credit';
     const costValue = Math.abs(netDebit);
    Plotly.newPlot(id, [trace], getPlotlyLayout(`${typeText} Butterfly ${strike1.toFixed(2)}/${strike2.toFixed(2)}/${strike3.toFixed(2)} (${costType}: ${costValue.toFixed(2)})`));
}

function plotRatioSpread(params, id, strategy) {
    const { type, position, ratio1, ratio2, strike1, strike2, premium1, premium2 } = params;
    // Ratio spread (e.g., 1:2 Buy K1, Sell 2x K2) or Backspread (e.g., 1:2 Sell K1, Buy 2x K2)
    // The `position` and `ratio` values in params define the legs and their quantities
    // Ensure K1 < K2 assumption holds based on typical ratio/backspread construction
    const lowerStrike = Math.min(strike1, strike2);
    const higherStrike = Math.max(strike1, strike2);
    const lowerStrikePremium = strike1 === lowerStrike ? premium1 : premium2;
    const higherStrikePremium = strike1 === higherStrike ? premium1 : premium2;

    // Determine leg positions and ratios based on the strategy type (implied by name/construction)
    let leg1Strike, leg1Ratio, leg1Premium, leg1Position;
    let leg2Strike, leg2Ratio, leg2Premium, leg2Position;
    let netCost;

    // Simplified logic based on common 1:2 ratio spread/backspread
    if (strategy.id === 'call-ratio-spread' || strategy.id === 'put-ratio-spread') { // Buy 1 Lower, Sell 2 Higher
        leg1Strike = lowerStrike;
        leg1Ratio = 1;
        leg1Premium = lowerStrikePremium;
        leg1Position = (type === 'call') ? 'long' : 'short'; // Buy Call or Sell Put at Lower Strike
        leg2Strike = higherStrike;
        leg2Ratio = 2; // Sold legs
        leg2Premium = higherStrikePremium;
        leg2Position = (type === 'call') ? 'short' : 'long'; // Sell Call or Buy Put at Higher Strike
        netCost = (leg1Ratio * leg1Premium) - (leg2Ratio * leg2Premium);

    } else if (strategy.id === 'call-backspread' || strategy.id === 'put-backspread') { // Sell 1 Lower, Buy 2 Higher
         leg1Strike = lowerStrike;
         leg1Ratio = 1; // Sold leg
         leg1Premium = lowerStrikePremium;
         leg1Position = (type === 'call') ? 'short' : 'long'; // Sell Call or Buy Put at Lower Strike
         leg2Strike = higherStrike;
         leg2Ratio = 2; // Bought legs
         leg2Premium = higherStrikePremium;
         leg2Position = (type === 'call') ? 'long' : 'short'; // Buy Call or Sell Put at Higher Strike
         netCost = (leg2Ratio * leg2Premium) - (leg1Ratio * leg1Premium); // Debit usually
    } else {
        console.error(`Unknown ratio spread type for plotting: ${strategy.id}`);
        return; // Cannot plot
    }


    const centerPrice = (lowerStrike + higherStrike) / 2;
     const prices = generatePriceRange(centerPrice, 0.25); // Wider range for ratio spreads


    const profits = prices.map(p =>
        (leg1Ratio * calculateLegPayoff(p, type, leg1Position, leg1Strike, leg1Premium)) +
        (leg2Ratio * calculateLegPayoff(p, type, leg2Position, leg2Strike, leg2Premium))
    );


     const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'teal' } };
     const costType = netCost >= 0 ? 'Debit' : 'Credit';
     const costValue = Math.abs(netCost);
     const typeText = type.charAt(0).toUpperCase() + type.slice(1);
     const strategyName = strategy.name.replace(/\s*\(.*\)/, ''); // Remove (Debit/Credit/Ratio) from name for title
     Plotly.newPlot(id, [trace], getPlotlyLayout(`${strategyName} ${lowerStrike.toFixed(2)}/${higherStrike.toFixed(2)} ${typeText} (${leg1Ratio}:${leg2Ratio}) (${costType}: ${costValue.toFixed(2)})`));
}


function plotCondor(params, id, strategy) {
    const { type, position, strike1, strike2, strike3, strike4, premium1, premium2, premium3, premium4 } = params;
     // Assume strikes are ordered K1 < K2 < K3 < K4 as per description
    let netCost; // Debit or Credit

    const lowerWingStrike = strike1;
    const lowerShortStrike = strike2;
    const upperShortStrike = strike3;
    const upperWingStrike = strike4;

    const lowerWingPremium = premium1;
    const lowerShortPremium = premium2;
    const upperShortPremium = premium3;
    const upperWingPremium = premium4;

    const centerPrice = (strike2 + strike3) / 2;
    const prices = generatePriceRange(centerPrice, 0.2); // Slightly wider range for condors


    let profits;
    if (position === 'short') { // Short Condor (Sell K2, K3; Buy K1, K4)
        netCost = (lowerShortPremium + upperShortPremium) - (lowerWingPremium + upperWingPremium); // Credit is positive cost
        profits = prices.map(p =>
            calculateLegPayoff(p, type, 'long', lowerWingStrike, lowerWingPremium) +
            calculateLegPayoff(p, type, 'short', lowerShortStrike, lowerShortPremium) +
            calculateLegPayoff(p, type, 'short', upperShortStrike, upperShortPremium) +
            calculateLegPayoff(p, type, 'long', upperWingStrike, upperWingPremium)
        );
    } else if (position === 'long') { // Long Condor (Buy K2, K3; Sell K1, K4)
        netCost = (lowerWingPremium + upperWingPremium) - (lowerShortPremium + upperShortPremium); // Debit is positive cost
         profits = prices.map(p =>
             calculateLegPayoff(p, type, 'short', lowerWingStrike, lowerWingPremium) +
             calculateLegPayoff(p, type, 'long', lowerShortStrike, lowerShortPremium) +
             calculateLegPayoff(p, type, 'long', upperShortStrike, upperShortPremium) +
             calculateLegPayoff(p, type, 'short', upperWingStrike, upperWingPremium)
         );
    } else {
         console.error(`Unknown condor position for plotting: ${position}`);
         return; // Cannot plot
    }


    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#17a2b8' } }; // Cyan/Info color
     const costType = netCost >= 0 ? 'Credit' : 'Debit'; // Condors are typically credit (short) or debit (long)
     const costValue = Math.abs(netCost);
     const typeText = type.charAt(0).toUpperCase() + type.slice(1);
     const posText = position.charAt(0).toUpperCase() + position.slice(1);

    Plotly.newPlot(id, [trace], getPlotlyLayout(`${posText} ${typeText} Condor ${strike1.toFixed(2)}/${strike2.toFixed(2)}/${strike3.toFixed(2)}/${strike4.toFixed(2)} (${costType}: ${costValue.toFixed(2)})`));
}


// Simplified plot for Calendar/Diagonal - Plots payoff at the NEAR expiry.
// Uses a simplified time value proxy for the further option.
const CURRENT_UNDERLYING_PRICE = 5975.5; // Fixed based on the provided image

function plotCalendarSpread(params, id, strategy) {
    const { type, strike, nearPremium, furtherPremium } = params; // strike is the same for both legs
    const netDebit = furtherPremium - nearPremium;
    const centerPrice = strike;
    const prices = generatePriceRange(centerPrice);

     // Calculate initial time value for the further leg
     const initialIntrinsicFurther = type === 'call' ? Math.max(0, CURRENT_UNDERLYING_PRICE - strike) : Math.max(0, strike - CURRENT_UNDERLYING_PRICE);
     const initialTimeValueFurther = Math.max(0, furtherPremium - initialIntrinsicFurther); // Time value cannot be negative


     const profits = prices.map(p => {
         // Payoff of the Short Near leg (standard at its expiry)
         const nearLegPayoff = calculateLegPayoff(p, type, 'short', strike, nearPremium);

         // Simplified Value of the Long Further leg at the Near expiry
         // Intrinsic Value at price p + a Time Value proxy
         const furtherIntrinsicAtP = type === 'call' ? Math.max(0, p - strike) : Math.max(0, strike - p);
         // Time Value Proxy: Initial time value, decaying slightly with distance from strike.
         // This exponential decay is a guess to give a curve.
         const timeValueProxyAtP = initialTimeValueFurther * Math.exp(-0.0005 * Math.pow(p - strike, 2)); // Decay factor 0.0005 is a guess

         const furtherLegValueAtNearExpiry = furtherIntrinsicAtP + timeValueProxyAtP;


         // Total P/L at Near Expiry
         return nearLegPayoff + furtherLegValueAtNearExpiry - furtherPremium; // Subtract initial premium paid for the further leg
     });

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'darkorange' } }; // Darker orange
    const typeText = type.charAt(0).toUpperCase() + type.slice(1);
    const costType = netDebit >= 0 ? 'Debit' : 'Credit';
    const costValue = Math.abs(netDebit);
    // Note in title that it's at Near Expiry
    Plotly.newPlot(id, [trace], getPlotlyLayout(`${typeText} Calendar Spread ${strike.toFixed(2)} (At Near Expiry) (${costType}: ${costValue.toFixed(2)})`));
}


function plotDiagonalSpread(params, id, strategy) {
    const { type, position, strike1, expiry1, premium1, strike2, expiry2, premium2 } = params;

    // Assume 'Further' is strike1/premium1 and 'Near' is strike2/premium2 based on typical diagonal construction (Buy Further, Sell Near)
    // And strike1 < strike2 for call diagonal (debit), strike1 < strike2 for put diagonal (credit/debit possible)
    const furtherStrike = strike1;
    const furtherPremium = premium1;
    const nearStrike = strike2;
    const nearPremium = premium2;

    const netDebit = furtherPremium - nearPremium; // Usually a debit

    const centerPrice = (furtherStrike + nearStrike) / 2; // Center plot range between strikes
    const prices = generatePriceRange(centerPrice, 0.2); // Wider range


    // Calculate initial time value for the further leg
     const initialIntrinsicFurther = type === 'call' ? Math.max(0, CURRENT_UNDERLYING_PRICE - furtherStrike) : Math.max(0, furtherStrike - CURRENT_UNDERLYING_PRICE);
     const initialTimeValueFurther = Math.max(0, furtherPremium - initialIntrinsicFurther); // Time value cannot be negative


    const profits = prices.map(p => {
        // Payoff of the Short Near leg (standard at its expiry)
        const nearLegPayoff = calculateLegPayoff(p, type, 'short', nearStrike, nearPremium); // Near leg is usually short

        // Simplified Value of the Long Further leg at the Near expiry
        // Intrinsic Value at price p + a Time Value proxy
        const furtherIntrinsicAtP = type === 'call' ? Math.max(0, p - furtherStrike) : Math.max(0, furtherStrike - p);
        // Time Value Proxy: Initial time value, decaying with distance from the further strike.
        const timeValueProxyAtP = initialTimeValueFurther * Math.exp(-0.0005 * Math.pow(p - furtherStrike, 2)); // Decay factor 0.0005 is a guess

        const furtherLegValueAtNearExpiry = furtherIntrinsicAtP + timeValueProxyAtP;


        // Total P/L at Near Expiry
        return nearLegPayoff + furtherLegValueAtNearExpiry - furtherPremium; // Subtract initial premium paid for the further leg
    });


    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'darkviolet' } }; // Dark violet
     const costType = netDebit >= 0 ? 'Debit' : 'Credit';
     const costValue = Math.abs(netDebit);
     const typeText = type.charAt(0).toUpperCase() + type.slice(1);

    // Note in title that it's at Near Expiry
    Plotly.newPlot(id, [trace], getPlotlyLayout(`${typeText} Diagonal Spread ${furtherStrike.toFixed(2)} ${expiry1} / ${nearStrike.toFixed(2)} ${expiry2} (At Near Expiry) (${costType}: ${costValue.toFixed(2)})`));
}

function plotBoxSpread(params, id, strategy) {
    const { strike1, strike2, premC1, premC2, premP1, premP2 } = params;
    // Legs: Buy C1, Sell C2, Buy P2, Sell P1
    // Premiums passed are absolute values
    // Assuming strike1 < strike2
    const lowerStrike = Math.min(strike1, strike2);
    const higherStrike = Math.max(strike1, strike2);
     // Map premiums to strikes assuming premC1/premP1 are for strike1 and premC2/premP2 are for strike2
    const lowerStrikePremC = strike1 === lowerStrike ? premC1 : premC2;
    const higherStrikePremC = strike1 === higherStrike ? premC1 : premC2;
    const lowerStrikePremP = strike1 === lowerStrike ? premP1 : premP2;
    const higherStrikePremP = strike1 === higherStrike ? premP1 : premP2;


    // Buy Lower Call, Sell Higher Call (Bull Call Spread)
    const bullCallNetDebit = lowerStrikePremC - higherStrikePremC;
    // Buy Higher Put, Sell Lower Put (Bear Put Spread)
    const bearPutNetDebit = higherStrikePremP - lowerStrikePremP;

    // Total Net Debit for the Box
    const netDebit = bullCallNetDebit + bearPutNetDebit; // (premC1 - premC2) + (premP2 - premP1)

    const valueAtExpiry = higherStrike - lowerStrike;
    const profit = valueAtExpiry - netDebit;


    const centerPrice = (lowerStrike + higherStrike) / 2;
    const prices = generatePriceRange(centerPrice, 0.4); // Wider range

    const profits = prices.map(p => {
        // Payoff of Bull Call Spread at expiration
        const bullCallPayoff = calculateLegPayoff(p, 'call', 'long', lowerStrike, lowerStrikePremC) +
                                calculateLegPayoff(p, 'call', 'short', higherStrike, higherStrikePremC);

        // Payoff of Bear Put Spread at expiration
        const bearPutPayoff = calculateLegPayoff(p, 'put', 'long', higherStrike, higherStrikePremP) +
                              calculateLegPayoff(p, 'put', 'short', lowerStrike, lowerStrikePremP);

         // Total payoff = Bull Call Spread Payoff + Bear Put Spread Payoff
         // Note: We already accounted for premiums in calculateLegPayoff, so the net cost/credit is inherent
         // The total payoff should be constant at K2-K1
         return bullCallPayoff + bearPutPayoff;
    });


    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'grey' } };
    const costType = netDebit >= 0 ? 'Debit' : 'Credit';
    const costValue = Math.abs(netDebit);
     // Calculate Profit based on the consistent payoff at expiry vs the actual cost
     const finalProfit = valueAtExpiry - netDebit; // Show the final P/L including cost

    Plotly.newPlot(id, [trace], getPlotlyLayout(`Box Spread ${lowerStrike.toFixed(2)}/${higherStrike.toFixed(2)} (Value: ${valueAtExpiry.toFixed(2)}, Net ${costType}: ${costValue.toFixed(2)}, P/L: ${finalProfit.toFixed(2)})`));
}


// Mapping strategy plot function names from JSON to actual JS functions
const plotFunctionMap = {
    plotBasicOption,
    plotVerticalSpread,
    plotButterfly,
    plotRatioSpread,
    plotCondor,
    plotIronCondor,
    plotIronButterfly,
    plotReverseIronCondor,
    plotBoxSpread,
    plotCalendarSpread, // Add Calendar
    plotDiagonalSpread, // Add Diagonal
    plotCoveredCall, // Add Covered Call
    plotProtectivePut // Add Protective Put
};


// --- Data Loading and HTML Population ---

function populateStrategyDetails(strategy, targetContainer) {
    const panel = document.createElement('div');
    panel.className = 'w3-panel w3-card-4 w3-padding strategy-panel';
    panel.setAttribute('data-strategy-id', strategy.id); // Add ID for potential styling hooks

    let constructionHTML = '';
    if (strategy.construction && strategy.construction.length > 0) {
        constructionHTML = `<div class="strategy-construction"><strong>Construction:</strong><ul>${strategy.construction.map(item => `<li>${item}</li>`).join('')}</ul></div>`;
    }

    let notesHTML = strategy.notes ? `<p class="strategy-notes w3-small"><em>Notes: ${strategy.notes}</em></p>` : '';
    let exampleHTML = strategy.example ? `<p class="strategy-example w3-small"><em>Example: ${strategy.example}</em></p>` : '';
    let greeksHTML = strategy.greeksImpact ?
        `<div class="strategy-greeks w3-small"><strong>Greeks Impact:</strong><ul>${Object.entries(strategy.greeksImpact).map(([greek, impact]) => `<li><strong>${greek.charAt(0).toUpperCase() + greek.slice(1)}:</strong> ${impact}</li>`).join('')}</ul></div>` : '';

    // Create input fields HTML
    let inputFieldsHTML = '<div class="strategy-inputs"><strong>Parameters:</strong><div class="w3-row w3-small">';
    for (const paramName in strategy.parameters) {
        const paramValue = strategy.parameters[paramName];
        const paramType = typeof paramValue === 'number' ? 'number' : 'text';
        const stepAttribute = paramType === 'number' ? 'step="any"' : '';
        const valueAttribute = paramType === 'number' ? `value="${paramValue.toFixed(2)}"` : `value="${paramValue}"`;
        // Basic formatting for parameter names
        const labelText = paramName
            .replace(/([A-Z])/g, ' $1').trim() // Add space before uppercase
            .replace('Prem', ' Premium')
            .replace('Pc', ' PC')
            .replace('P1', ' Put 1').replace('P2', ' Put 2').replace('P3', ' Put 3').replace('P4', ' Put 4') // Numbered legs
            .replace('C1', ' Call 1').replace('C2', ' Call 2').replace('C3', ' Call 3').replace('C4', ' Call 4')
            .replace('Kc', ' K Call').replace('Kp', ' K Put') // Specific strike types
            .replace('Strike1', 'Strike 1').replace('Strike2', 'Strike 2').replace('Strike3', 'Strike 3').replace('Strike4', 'Strike 4') // General numbered strikes
             .replace('PutStrike', 'Put Strike').replace('CallStrike', 'Call Strike')
             .replace('NearPremium', 'Near Premium').replace('FurtherPremium', 'Further Premium');


        const inputId = `${strategy.id}-${paramName}-input`;

         // Wrap each input in a column for layout
         inputFieldsHTML += `
            <div class="w3-col s6 m4 l3 w3-padding-small">
                <label for="${inputId}">${labelText}:</label>
                <input id="${inputId}" class="w3-input w3-border w3-round-small" type="${paramType}" ${stepAttribute} ${valueAttribute}>
            </div>
         `;
    }
     inputFieldsHTML += '</div></div>';


    panel.innerHTML = `
        <h3>${strategy.name}</h3>
        <p><strong>Outlook:</strong> <span class="strategy-outlook w3-tag">${strategy.outlook}</span></p>
        <p class="strategy-description">${strategy.description}</p>
        ${constructionHTML}
        ${notesHTML}
        ${greeksHTML}
        <p><strong>Max Profit:</strong> <span class="strategy-max-profit">${strategy.maxProfit}</span></p>
        <p><strong>Max Loss:</strong> <span class="strategy-max-loss">${strategy.maxLoss}</span></p>
        <p><strong>Breakeven:</strong> <span class="strategy-breakeven">${strategy.breakeven}</span></p>
        ${inputFieldsHTML} <!-- Insert inputs here -->
        <div id="${strategy.plotlyDivId}" class="plotly-chart"></div>
        ${exampleHTML}
    `;
    targetContainer.appendChild(panel);

    // Attach event listeners to the newly created input fields
    const inputElements = panel.querySelectorAll('.strategy-inputs input');
    inputElements.forEach(input => {
        input.addEventListener('input', () => replotStrategy(strategy));
    });

    // Initial plot - call replotStrategy now that inputs are in the DOM
    replotStrategy(strategy);

}

function populateAboutSection(aboutData) {
     const aboutContainer = document.getElementById('about');
     aboutContainer.innerHTML = `<h2>${aboutData.title}</h2>`;
     aboutData.content.forEach(p_content => {
         const p = document.createElement('p');
         p.innerHTML = p_content; // Use innerHTML to render the <strong> tag
         aboutContainer.appendChild(p);
     });
      // Add specific note about calendar/diagonal plots
     const noteDiv = document.createElement('div');
     noteDiv.className = 'w3-panel w3-light-grey w3-padding-small w3-round-large w3-small';
     noteDiv.innerHTML = "<strong>Note on Multi-Expiry Plots:</strong> Payoff diagrams for Calendar and Diagonal spreads on this page represent the theoretical Profit/Loss at the expiration of the <strong>near-term option</strong>. Calculating the exact value of the longer-term option at that time requires a full options pricing model (like Black-Scholes), which is not included here. The plots use a simplified proxy for the longer-term option's time value, designed to illustrate the characteristic peak payoff shape, but may not be perfectly accurate.";
     aboutContainer.appendChild(noteDiv);

}


async function loadAndDisplayStrategies() {
    try {
        const response = await fetch('strategies.json'); // Assuming the JSON is named strategies.json
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        strategyData = await response.json();

        // Populate About section
        if (strategyData.about) {
            populateAboutSection(strategyData.about);
        }

        // Populate strategy sections
        for (const legType in strategyData) {
            if (legType !== 'about' && Array.isArray(strategyData[legType])) {
                const containerId = legType.toLowerCase().replace('leg', '-leg'); // e.g., oneLeg -> one-leg
                const container = document.getElementById(containerId);
                if (container) {
                    strategyData[legType].forEach(strategy => {
                        // Pass the full strategy object to populateDetails
                        populateStrategyDetails(strategy, container);
                         // replotStrategy is called inside populateStrategyDetails after inputs are added
                    });
                } else {
                     console.warn(`Container element not found for leg type: ${containerId}`);
                }
            }
        }

         // Set initial active section (e.g., 'about' or 'four-leg')
         // Check if a hash is present in the URL to show a specific section on load
         const initialSectionId = window.location.hash ? window.location.hash.substring(1) : 'about';
         showSection(initialSectionId);


    } catch (error) {
        console.error("Failed to load or process strategies:", error);
        // Display an error message to the user on the page
        const mainContent = document.querySelector('.w3-main');
        if (mainContent) {
             mainContent.innerHTML = `
                <div class="w3-container w3-padding">
                    <div class="w3-panel w3-red w3-padding w3-round-large">
                        <h2>Error</h2>
                        <p>Could not load strategy data. Please ensure 'strategies.json' is in the same directory and try again.</p>
                        <p><small>${error}</small></p>
                    </div>
                </div>
             ` + mainContent.innerHTML; // Add error message at the top of the main content
             // Also hide all strategy sections
             strategySections.forEach(section => section.style.display = 'none');
        }
    }
}

// --- Handle initial hash and hash changes ---
window.addEventListener('hashchange', () => {
    const sectionId = window.location.hash ? window.location.hash.substring(1) : 'about';
    showSection(sectionId);
});


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    loadAndDisplayStrategies(); // Load data, populate HTML, and plot charts
});
