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
        // Charts are plotted on load, no need to replot here unless dynamic data changes
    } else {
        document.getElementById('about').style.display = 'block'; // Fallback
        const aboutLink = document.querySelector(`.nav-link[href="#about"]`);
         if(aboutLink) aboutLink.classList.add('active');
    }
}


// --- Plotly Chart Generation ---

// Helper function to create underlying price range
function generatePriceRange(centerPrice, rangePercentage = 0.3, steps = 100) {
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
        hovermode: 'x unified' // Improved hover experience
    };
}

// --- Payoff Calculation Functions ---

// Calculates P/L for a single option leg at expiration
function calculateLegPayoff(price, type, position, strike, premium) {
    let intrinsicValue = 0;
    if (type === 'call') {
        intrinsicValue = Math.max(0, price - strike);
    } else { // put
        intrinsicValue = Math.max(0, strike - price);
    }

    if (position === 'long') {
        return intrinsicValue - premium;
    } else { // short
        return -intrinsicValue + premium; // Premium received is positive initial cashflow
    }
}

// --- Strategy Plotting Functions ---
// These now accept parameters from the JSON

function plotBasicOption(params, id) {
    const { type, position, strike, premium } = params;
    const prices = generatePriceRange(strike);
    const profits = prices.map(p => calculateLegPayoff(p, type, position, strike, premium));
    const trace = {
        x: prices, y: profits, type: 'scatter', mode: 'lines',
        line: { color: position === 'long' ? (type === 'call' ? 'green' : 'blue') : 'red' }
     };
     const posText = position.charAt(0).toUpperCase() + position.slice(1);
     const typeText = type.charAt(0).toUpperCase() + type.slice(1);
    Plotly.newPlot(id, [trace], getPlotlyLayout(`${posText} ${strike} ${typeText} (Premium: ${premium.toFixed(2)})`));
}

function plotVerticalSpread(params, id) {
    const { type, position, strike1, strike2, premium1, premium2 } = params;
    // Ensure strikes are ordered correctly for calculation
    const lowerStrike = Math.min(strike1, strike2);
    const higherStrike = Math.max(strike1, strike2);
    // Premiums correspond to the specific strikes provided in JSON
    const lowerStrikePremium = (strike1 === lowerStrike) ? premium1 : premium2;
    const higherStrikePremium = (strike1 === higherStrike) ? premium1 : premium2;

    const centerPrice = (lowerStrike + higherStrike) / 2;
    const prices = generatePriceRange(centerPrice);
    let profits;
    let netCost; // Can be debit (positive) or credit (negative)

    if (position === 'debit') { // Buying the lower strike spread (Bull Call or Bear Put)
        const longLegPos = (type === 'call') ? 'long' : 'long'; // Long lower call or higher put
        const shortLegPos = (type === 'call') ? 'short' : 'short'; // Short higher call or lower put
        const longStrike = (type === 'call') ? lowerStrike : higherStrike;
        const shortStrike = (type === 'call') ? higherStrike : lowerStrike;
        const longPremium = (type === 'call') ? lowerStrikePremium : higherStrikePremium;
        const shortPremium = (type === 'call') ? higherStrikePremium : lowerStrikePremium;
        netCost = longPremium - shortPremium; // Net Debit
        profits = prices.map(p =>
            calculateLegPayoff(p, type, longLegPos, longStrike, longPremium) +
            calculateLegPayoff(p, type, shortLegPos, shortStrike, shortPremium)
        );
    } else { // 'credit' - Selling the lower strike spread (Bear Call or Bull Put)
         const shortLegPos = (type === 'call') ? 'short' : 'short'; // Short lower call or higher put
         const longLegPos = (type === 'call') ? 'long' : 'long'; // Long higher call or lower put
         const shortStrike = (type === 'call') ? lowerStrike : higherStrike;
         const longStrike = (type === 'call') ? higherStrike : lowerStrike;
         const shortPremium = (type === 'call') ? lowerStrikePremium : higherStrikePremium;
         const longPremium = (type === 'call') ? higherStrikePremium : lowerStrikePremium;
         netCost = longPremium - shortPremium; // Net Credit (will be negative cost)
         profits = prices.map(p =>
             calculateLegPayoff(p, type, shortLegPos, shortStrike, shortPremium) +
             calculateLegPayoff(p, type, longLegPos, longStrike, longPremium)
         );
    }

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'purple' } };
    const costType = netCost >= 0 ? 'Debit' : 'Credit';
    const costValue = Math.abs(netCost);
    const typeText = type.charAt(0).toUpperCase() + type.slice(1);
    const posText = position.charAt(0).toUpperCase() + position.slice(1);

    Plotly.newPlot(id, [trace], getPlotlyLayout(`${posText} ${typeText} Spread ${lowerStrike}/${higherStrike} (${costType}: ${costValue.toFixed(2)})`));
}

function plotButterfly(params, id) {
    const { type, strike1, strike2, strike3, premium1, premium2, premium3 } = params;
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
    Plotly.newPlot(id, [trace], getPlotlyLayout(`${typeText} Butterfly ${strike1}/${strike2}/${strike3} (Debit: ${netDebit.toFixed(2)})`));
}

function plotIronCondor(params, id) {
    const { strikeP1, strikeP2, strikeC3, strikeC4, premiumP1, premiumP2, premiumC3, premiumC4 } = params;
    // Legs: Long P1, Short P2, Short C3, Long C4 (Premiums already signed in calcLegPayoff)
    // Premiums passed here are absolute values as typically quoted
    const netCredit = premiumP2 + premiumC3 - premiumP1 - premiumC4;
    const centerPrice = (strikeP2 + strikeC3) / 2;
    const prices = generatePriceRange(centerPrice);

    const profits = prices.map(p =>
        calculateLegPayoff(p, 'put', 'long', strikeP1, premiumP1) +
        calculateLegPayoff(p, 'put', 'short', strikeP2, premiumP2) +
        calculateLegPayoff(p, 'call', 'short', strikeC3, premiumC3) +
        calculateLegPayoff(p, 'call', 'long', strikeC4, premiumC4)
    );

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#007bff' } }; // Blue
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Iron Condor ${strikeP1}/${strikeP2}P ${strikeC3}/${strikeC4}C (Credit: ${netCredit.toFixed(2)})`));
}

function plotIronButterfly(params, id) {
     const { strikeP1, strikePC2, strikeC3, premiumP1, premiumP2, premiumC2, premiumC3 } = params;
    // Legs: Long P1, Short P2, Short C2, Long C3
    const netCredit = premiumP2 + premiumC2 - premiumP1 - premiumC3;
    const centerPrice = strikePC2;
    const prices = generatePriceRange(centerPrice);

    const profits = prices.map(p =>
        calculateLegPayoff(p, 'put', 'long', strikeP1, premiumP1) +
        calculateLegPayoff(p, 'put', 'short', strikePC2, premiumP2) + // Short Put at K2
        calculateLegPayoff(p, 'call', 'short', strikePC2, premiumC2) + // Short Call at K2
        calculateLegPayoff(p, 'call', 'long', strikeC3, premiumC3)
    );

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#ffc107' } }; // Gold
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Iron Butterfly ${strikeP1}P / ${strikePC2}PC / ${strikeC3}C (Credit: ${netCredit.toFixed(2)})`));
}

function plotReverseIronCondor(params, id) {
    const { strikeP1, strikeP2, strikeC3, strikeC4, premiumP1, premiumP2, premiumC3, premiumC4 } = params;
    // Legs: Short P1, Long P2, Long C3, Short C4
    const netDebit = premiumP2 + premiumC3 - premiumP1 - premiumC4; // Same premium values, but interpretation changes
    const centerPrice = (strikeP2 + strikeC3) / 2;
    const prices = generatePriceRange(centerPrice);

    const profits = prices.map(p =>
        calculateLegPayoff(p, 'put', 'short', strikeP1, premiumP1) +
        calculateLegPayoff(p, 'put', 'long', strikeP2, premiumP2) +
        calculateLegPayoff(p, 'call', 'long', strikeC3, premiumC3) +
        calculateLegPayoff(p, 'call', 'short', strikeC4, premiumC4)
    );

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: '#dc3545' } }; // Red
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Reverse Iron Condor ${strikeP1}/${strikeP2}P ${strikeC3}/${strikeC4}C (Debit: ${netDebit.toFixed(2)})`));
}


function plotBoxSpread(params, id) {
    const { strike1, strike2, premC1, premC2, premP1, premP2 } = params;
    // Legs: Buy C1, Sell C2, Buy P2, Sell P1
    // Premiums passed are absolute values
    const netDebit = premC1 - premC2 + premP2 - premP1;
    const valueAtExpiry = strike2 - strike1;
    const profit = valueAtExpiry - netDebit;

    const centerPrice = strike1 + (strike2-strike1)/2;
    const prices = generatePriceRange(centerPrice, 0.4); // Wider range

    const profits = prices.map(p => profit); // Profit is constant

    const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: 'grey' } };
    Plotly.newPlot(id, [trace], getPlotlyLayout(`Box Spread ${strike1}/${strike2} (Value: ${valueAtExpiry.toFixed(2)}, Debit: ${netDebit.toFixed(2)}, P/L: ${profit.toFixed(2)})`));
}

// Mapping strategy plot function names from JSON to actual JS functions
const plotFunctionMap = {
    plotBasicOption,
    plotVerticalSpread,
    plotButterfly,
    plotIronCondor,
    plotIronButterfly,
    plotReverseIronCondor,
    plotBoxSpread
};

// --- Data Loading and HTML Population ---

function populateStrategyDetails(strategy, targetContainer) {
    const panel = document.createElement('div');
    panel.className = 'w3-panel w3-card-4 w3-padding strategy-panel';
    panel.setAttribute('data-strategy-id', strategy.id); // Add ID for potential styling hooks

    let constructionHTML = '';
    if (strategy.construction && strategy.construction.length > 0) {
        constructionHTML = `<ul>${strategy.construction.map(item => `<li>${item}</li>`).join('')}</ul>`;
    }

    let notesHTML = strategy.notes ? `<p class="strategy-notes">${strategy.notes}</p>` : '';
    let exampleHTML = strategy.example ? `<p class="strategy-example"><em>Example: ${strategy.example}</em></p>` : '';


    panel.innerHTML = `
        <h3>${strategy.name}</h3>
        <p><strong>Outlook:</strong> <span class="strategy-outlook">${strategy.outlook}</span></p>
        <p class="strategy-description">${strategy.description}</p>
        <div class="strategy-construction">
            <strong>Construction:</strong>
            ${constructionHTML}
            ${notesHTML}
        </div>
        <p><strong>Max Profit:</strong> <span class="strategy-max-profit">${strategy.maxProfit}</span></p>
        <p><strong>Max Loss:</strong> <span class="strategy-max-loss">${strategy.maxLoss}</span></p>
        <p><strong>Breakeven:</strong> <span class="strategy-breakeven">${strategy.breakeven}</span></p>
        <div id="${strategy.plotlyDivId}" class="plotly-chart"></div>
        ${exampleHTML}
    `;
    targetContainer.appendChild(panel);
}

function populateAboutSection(aboutData) {
     const aboutContainer = document.getElementById('about');
     aboutContainer.innerHTML = `<h2>${aboutData.title}</h2>`;
     aboutData.content.forEach(p_content => {
         const p = document.createElement('p');
         p.innerHTML = p_content; // Use innerHTML to render the <strong> tag
         aboutContainer.appendChild(p);
     });
}


async function loadAndDisplayStrategies() {
    try {
        const response = await fetch('strategies.json');
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
                        populateStrategyDetails(strategy, container);
                         // Call the corresponding plot function
                         if (strategy.plotFunction && plotFunctionMap[strategy.plotFunction] && strategy.parameters && strategy.plotlyDivId) {
                           plotFunctionMap[strategy.plotFunction](strategy.parameters, strategy.plotlyDivId);
                       } else {
                           console.warn(`Plot function or parameters missing for strategy: ${strategy.name}`);
                       }
                    });
                } else {
                     console.warn(`Container element not found for leg type: ${containerId}`);
                }
            }
        }

         // Set initial active section (e.g., 'about' or 'four-leg')
         showSection('about'); // Or change to 'four-leg' to default there
         // showSection('four-leg');


    } catch (error) {
        console.error("Failed to load or process strategies:", error);
        // Display an error message to the user on the page
        const mainContent = document.querySelector('.w3-main');
        if (mainContent) {
            mainContent.innerHTML = `<div class="w3-panel w3-red w3-padding"><h2>Error</h2><p>Could not load strategy data. Please try again later.</p><p><small>${error}</small></p></div>` + mainContent.innerHTML;
        }
    }
}

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    loadAndDisplayStrategies(); // Load data, populate HTML, and plot charts
});
