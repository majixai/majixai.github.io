document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const strategyListElement = document.getElementById('strategyList');
    const payoffChartCanvas = document.getElementById('payoffChart');
    const plotlyChartArea = document.getElementById('plotlyChartArea'); // For Plotly
    let payoffChart = null; // For Chart.js

    const metricUnderlyingEl = document.getElementById('metricUnderlying');
    // ... (all other metric elements)
    const metricMaxProfitEl = document.getElementById('metricMaxProfit');
    const metricMaxLossEl = document.getElementById('metricMaxLoss');
    const metricWinRateEl = document.getElementById('metricWinRate');
    const metricBreakevenEl = document.getElementById('metricBreakeven');
    const metricDeltaEl = document.getElementById('metricDelta');
    const metricGammaEl = document.getElementById('metricGamma');
    const metricThetaEl = document.getElementById('metricTheta');
    const metricVegaEl = document.getElementById('metricVega');
    const metricRhoEl = document.getElementById('metricRho');

    const expirationSelect = document.getElementById('expiration');
    const riskFreeRateInput = document.getElementById('riskFreeRateInput');
    const loadDataBtn = document.getElementById('load-data-btn');

    let currentOptionData = null; // Holds the structured options chain data
    let db = null; // IndexedDB database instance

    const DB_NAME = 'OptionsDataDB';
    const DB_VERSION = 1;
    const OS_NAME_CHAIN = 'optionsChain'; // Object store for the full chain data

    // --- IndexedDB Helper Functions ---
    async function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const dbInstance = event.target.result;
                if (!dbInstance.objectStoreNames.contains(OS_NAME_CHAIN)) {
                    // Using 'key' as the key path, assuming we store one main chain object
                    dbInstance.createObjectStore(OS_NAME_CHAIN, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                console.log('IndexedDB initialized successfully.');
                resolve(db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    }

    async function storeDataInDB(objectStoreName, data, key = 'fullChainData') {
        if (!db) {
            console.error('DB not initialized.');
            return;
        }
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([objectStoreName], 'readwrite');
            const store = transaction.objectStore(objectStoreName);
            const dataToStore = { id: key, ...data }; // Add an 'id' property for the keyPath
            const request = store.put(dataToStore);

            request.onsuccess = () => {
                console.log(`Data stored in ${objectStoreName} with key ${key}`);
                resolve();
            };
            request.onerror = (event) => {
                console.error(`Error storing data in ${objectStoreName}:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    async function getDataFromDB(objectStoreName, key = 'fullChainData') {
        if (!db) {
            console.error('DB not initialized.');
            return null;
        }
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([objectStoreName], 'readonly');
            const store = transaction.objectStore(objectStoreName);
            const request = store.get(key);

            request.onsuccess = (event) => {
                resolve(event.target.result ? event.target.result : null);
            };
            request.onerror = (event) => {
                console.error(`Error getting data from ${objectStoreName}:`, event.target.error);
                reject(event.target.error);
            };
        });
    }


    // --- Text Data Parser ---
    // This is a SIMPLIFIED parser. A robust one for TradingView's complex HTML/text output
    // would be significantly more complex and require careful handling of its structure.
    function parseTradingViewTextData(textData) {
        const lines = textData.split('\n').map(line => line.trim()).filter(line => line);
        let parsedData = {
            underlyingSymbol: "MES1!", // Default
            underlyingPrice: 0,
            riskFreeRate: parseFloat(riskFreeRateInput.value) / 100 || 0.052, // From input or default
            expirationDate: "2025-06-20", // Placeholder, needs to be parsed or set
            options: []
        };

        // Attempt to find underlying price (very naive)
        // Example: "MES1! 5,975.50 USD"
        const underlyingPriceRegex1 = /(\w+!)\s*([\d,]+\.\d{2})\s*USD/;
        const underlyingPriceRegex2 = /^([\d,]+\.\d{2})$/; // If just the price is on a line

        for (let i = 0; i < lines.length; i++) {
            let match = lines[i].match(underlyingPriceRegex1);
            if (match) {
                parsedData.underlyingSymbol = match[1];
                parsedData.underlyingPrice = parseFloat(match[2].replace(/,/g, ''));
                // Try to find the "+42.25 +0.71%" part on the next lines
                if (lines[i+1] && lines[i+1].startsWith("+") || lines[i+1].startsWith("-")) {
                    // Could parse change and %change here
                }
                break; // Found main underlying info
            }
            match = lines[i].match(underlyingPriceRegex2);
             // Check a few lines before and after for "MES1!" to confirm it's the main price
            if (match && (lines[i-1]?.includes("MES1!") || lines[i-2]?.includes("MES1!") || lines[i+1]?.includes("MES1!"))) {
                 parsedData.underlyingPrice = parseFloat(match[0].replace(/,/g, ''));
                 break;
            }
        }
         if(parsedData.underlyingPrice === 0) { // Fallback if not found above
            const firstPriceMatch = textData.match(/([\d,]+\.\d{2})\s*USD/);
            if(firstPriceMatch) parsedData.underlyingPrice = parseFloat(firstPriceMatch[1].replace(/,/g, ''));
            else parsedData.underlyingPrice = 5975.50; // Hardcoded fallback
            console.warn("Could not reliably parse underlying price, using: " + parsedData.underlyingPrice);
        }


        // Find the start of the options chain table
        // "Rho	Vega	Theta	Gamma	Delta	Price	Ask	Bid Strike IV, %	Bid	Ask	Price	Delta	Gamma	Theta	Vega	Rho"
        let tableHeaderIndex = -1;
        const headerPattern = /Rho\s+Vega\s+Theta\s+Gamma\s+Delta\s+Price\s+Ask\s+Bid\s+Strike\s+IV, %\s+Bid\s+Ask\s+Price\s+Delta\s+Gamma\s+Theta\s+Vega\s+Rho/i;

        for (let i = 0; i < lines.length; i++) {
            if (headerPattern.test(lines[i])) {
                tableHeaderIndex = i;
                break;
            }
        }

        if (tableHeaderIndex === -1) {
            console.error("Could not find options chain table header in the text data.");
            alert("Parser Error: Options chain table header not found. Data might be incomplete.");
            return parsedData; // Return what we have
        }

        // Parse table rows
        for (let i = tableHeaderIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            // A line looks roughly like:
            // Call_Rho Call_Vega Call_Theta Call_Gamma Call_Delta Call_Price Call_Ask Call_Bid STRIKE Put_IV Put_Bid Put_Ask Put_Price Put_Delta Put_Gamma Put_Theta Put_Vega Put_Rho
            // Example numbers:
            // 2.01	6.51	−1.69	0.0017	0.46	80.52	83.00	78.00	 5,980 14.1	109.25	114.25	112.00	−0.54	0.0017	−1.69	6.51	−2.56
            // This regex is highly dependent on the exact spacing and number of columns.
            // It assumes tab or multiple spaces as delimiters.
            // It also tries to handle '–' as NaN or 0.
            const parts = line.split(/\s+/).map(p => p === '–' ? 'NaN' : p.replace(/,/g, ''));

            if (parts.length >= 17 && !isNaN(parseFloat(parts[8]))) { // Check for at least 17 parts and if strike is a number
                try {
                    const optionRow = {
                        strike: parseFloat(parts[8]),
                        call: {
                            rho: parseFloat(parts[0]),
                            vega: parseFloat(parts[1]),
                            theta: parseFloat(parts[2]),
                            gamma: parseFloat(parts[3]),
                            delta: parseFloat(parts[4]),
                            last: parseFloat(parts[5]), // Using "Price" as "last"
                            ask: parseFloat(parts[6]),
                            bid: parseFloat(parts[7]),
                            // IV is for the Put side in this column order, we need to find call IV if it exists
                            // TradingView text output doesn't typically list Call IV in this main table view directly.
                            // We will use the Put IV for the call if no other IV is available, or assume a default.
                            // For a proper solution, the text data needs to be clearer or a different source used.
                            iv: parseFloat(parts[9])/100 || 0.15 // Using Put's IV / 100 or default. THIS IS A GUESS.
                        },
                        put: {
                            iv: parseFloat(parts[9]) / 100, // IV, % column
                            bid: parseFloat(parts[10]),
                            ask: parseFloat(parts[11]),
                            last: parseFloat(parts[12]), // Using "Price" as "last"
                            delta: parseFloat(parts[13]),
                            gamma: parseFloat(parts[14]),
                            theta: parseFloat(parts[15]),
                            vega: parseFloat(parts[16]),
                            rho: parseFloat(parts[17] || 'NaN') // Rho might be the 18th element or missing
                        }
                    };
                     // A more robust parser would look for "MESM2025 5,975.5" line to determine expiration more reliably
                    // For now, we assume one expiration from the text.

                    // If call IV is listed separately or can be inferred, update here.
                    // The provided text has "IV, %" between STRIKE and Put_Bid. This is typically Put IV.
                    // Call IV is not explicitly in each row of *this specific text dump's main table*.
                    // We'll use the put's IV for the call's IV as a placeholder for calculation.
                    // If the text format were different, this would need adjustment.
                    if (isNaN(optionRow.call.iv) && !isNaN(optionRow.put.iv)) {
                        optionRow.call.iv = optionRow.put.iv; // Use put's IV if call's is not found
                    } else if (isNaN(optionRow.call.iv)) {
                        optionRow.call.iv = 0.15; // Default if none found
                    }


                    parsedData.options.push(optionRow);
                } catch (e) {
                    console.warn(`Skipping line, could not parse: "${line}"`, e);
                }
            } else if (line.includes("Implied Volatility") || line.includes("Select market data")) {
                // End of relevant table data
                break;
            }
        }
        // Placeholder for expiration date logic.
        // The text "MESM2025 5,975.5" suggests an expiration.
        // M is June. So "MESM2025" implies June 2025 expiration.
        // Standard options usually expire on the 3rd Friday. June 20, 2025 is the 3rd Friday.
        const expMatch = textData.match(/MES([FGHJKMNQUVXZ])(\d{4})/i);
        if (expMatch) {
            const monthChar = expMatch[1].toUpperCase();
            const year = parseInt(expMatch[2]);
            const monthMap = {F:0,G:1,H:2,J:3,K:4,M:5,N:6,Q:7,U:8,V:9,X:10,Z:11}; // 0-indexed months
            if (monthMap[monthChar] !== undefined && year) {
                // Find 3rd Friday of that month
                let date = new Date(year, monthMap[monthChar], 1);
                let fridays = 0;
                while(fridays < 3){
                    if(date.getDay() === 5) fridays++; // 5 is Friday
                    if(fridays < 3) date.setDate(date.getDate() + 1);
                }
                parsedData.expirationDate = date.toISOString().split('T')[0];
            }
        } else {
             console.warn("Could not parse expiration from text, using default.");
             // Use a default or try another method to find it.
        }


        if (parsedData.options.length === 0) {
            alert("Parser Error: No option rows were successfully parsed. Check console and raw data.");
        } else {
            console.log(`Parsed ${parsedData.options.length} option rows.`);
        }

        return parsedData;
    }


    // --- Fetch, Parse, and Store Data from Text File ---
    async function loadAndProcessRawData() {
        loadDataBtn.disabled = true;
        loadDataBtn.textContent = 'Loading...';
        expirationSelect.innerHTML = '<option>Loading data...</option>';
        expirationSelect.disabled = true;

        try {
            const response = await fetch('raw_tradingview_data.txt');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const rawText = await response.text();
            const parsedData = parseTradingViewTextData(rawText);

            // Calculate DTE (Days To Expiration)
            const mockCurrentDate = new Date(); // Use today's date
            const expirationDateObj = new Date(parsedData.expirationDate + "T00:00:00"); // Ensure it's treated as local midnight
            const daysToExpiration = Math.max(1, Math.round((expirationDateObj - mockCurrentDate) / (1000 * 60 * 60 * 24)));
            parsedData.daysToExpiration = daysToExpiration;
            parsedData.riskFreeRate = parseFloat(riskFreeRateInput.value) / 100;


            await storeDataInDB(OS_NAME_CHAIN, parsedData);
            currentOptionData = parsedData;
            console.log('Raw data fetched, parsed, and stored in IndexedDB.');
            alert('Options data loaded and processed successfully!');
            populateExpirationDropdown(); // Update dropdown
            initializeAppUIWithData(); // Refresh UI
        } catch (error) {
            console.error('Error loading or processing raw data:', error);
            alert(`Error loading data: ${error.message}. Check console.`);
            // Optionally, try to load from DB as a fallback if parsing fresh file fails
            const existingData = await getDataFromDB(OS_NAME_CHAIN);
            if (existingData) {
                currentOptionData = existingData;
                 alert('Using previously stored data due to load error.');
                populateExpirationDropdown();
                initializeAppUIWithData();
            } else {
                currentOptionData = null; // Ensure it's null if everything fails
            }
        } finally {
            loadDataBtn.disabled = false;
            loadDataBtn.textContent = 'Load/Refresh Options Data';
        }
    }

    function populateExpirationDropdown() {
        if (currentOptionData && currentOptionData.expirationDate) {
            expirationSelect.innerHTML = `<option value="${currentOptionData.expirationDate}">${currentOptionData.expirationDate} (DTE: ${currentOptionData.daysToExpiration})</option>`;
            expirationSelect.disabled = false;
        } else {
            expirationSelect.innerHTML = '<option>No data</option>';
            expirationSelect.disabled = true;
        }
    }


    // --- Black-Scholes and Greeks (Keep these from previous version) ---
    function norm_cdf(x) { /* ... */ 
        var t = 1 / (1 + 0.2316419 * Math.abs(x));
        var d = 0.3989423 * Math.exp(-x * x / 2);
        var prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        if (x > 0) prob = 1 - prob;
        return prob;
    }
    function norm_pdf(x) { /* ... */ 
        return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
    }
    function blackScholes(S, K, T, r, v, optionType) { /* ... as before ... */ 
        if (T <= 0) {
            if (optionType === 'call') return Math.max(0, S - K);
            if (optionType === 'put') return Math.max(0, K - S);
            return 0;
        }
        if (v <= 0 || isNaN(v)) v = 0.00001; 

        const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
        const d2 = d1 - v * Math.sqrt(T);

        if (optionType === 'call') {
            return S * norm_cdf(d1) - K * Math.exp(-r * T) * norm_cdf(d2);
        } else if (optionType === 'put') {
            return K * Math.exp(-r * T) * norm_cdf(-d2) - S * norm_cdf(-d1);
        }
        return 0;
    }
    function getGreeks(S, K, T, r, v, optionType) { /* ... as before ... */
        if (T <= 0 || v <= 0 || isNaN(v)) { 
           let delta = 0, gamma = 0, vega = 0, theta = 0;
           if (T <=0) { 
               if (optionType === 'call') {
                   if (S > K) delta = 1;
                   else if (S == K) delta = 0.5; 
                   else delta = 0;
               } else { 
                   if (S < K) delta = -1;
                   else if (S == K) delta = -0.5; 
                   else delta = 0;
               }
           }
            return { delta, gamma, vega, theta };
        }

        const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
        const d2 = d1 - v * Math.sqrt(T);
        const N_d1_pdf = norm_pdf(d1);

        let delta, gamma, vega, theta;

        gamma = N_d1_pdf / (S * v * Math.sqrt(T));
        vega = S * N_d1_pdf * Math.sqrt(T) / 100; 

        if (optionType === 'call') {
            delta = norm_cdf(d1);
            theta = (- (S * N_d1_pdf * v) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * norm_cdf(d2)) / 365;
        } else { 
            delta = norm_cdf(d1) - 1;
            theta = (- (S * N_d1_pdf * v) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * norm_cdf(-d2)) / 365;
        }
        return { delta, gamma, vega, theta };
    }

    // --- Sample Strategies Definitions ---
    // Update these to use strikes that are LIKELY to be in the parsed data
    const strategies = [
        {
            id: 'longCall_ATM', name: 'Long Call (ATM-ish)', type: 'bullish',
            legs: [{ type: 'call', position: 'long', strike: 5970, ratio: 1 }], // Adjust strike
        },
        {
            id: 'shortPut_OTM', name: 'Short Put (OTM)', type: 'bullish',
            legs: [{ type: 'put', position: 'short', strike: 5900, ratio: 1 }], // Adjust strike
        },
        {
            id: 'shortStrangle', name: 'Short Strangle', type: 'neutral',
            legs: [
                { type: 'put', position: 'short', strike: 5900, ratio: 1 },
                { type: 'call', position: 'short', strike: 6050, ratio: 1 }
            ],
        },
        // Add more if needed
    ];


    // --- P&L and Charting Logic (adjust to use `currentOptionData` correctly) ---
    function calculateExpirationPL(S_expiration, strategyLegs) {
        if (!currentOptionData || !currentOptionData.options) return 0;
        let totalPL = 0;
        strategyLegs.forEach(leg => {
            const optionContractData = currentOptionData.options.find(opt => opt.strike === leg.strike);
            if (!optionContractData) {
                console.warn(`Expiration P&L: Data for strike ${leg.strike} not found.`);
                return;
            }
            const premiumData = leg.type === 'call' ? optionContractData.call : optionContractData.put;
            if (!premiumData || typeof premiumData.last === 'undefined' || isNaN(premiumData.last)) {
                console.warn(`Expiration P&L: 'last' price not found or NaN for ${leg.type} at strike ${leg.strike}`);
                return;
            }
            const premium = premiumData.last;

            let legPL = 0;
            if (leg.type === 'call') legPL = Math.max(0, S_expiration - leg.strike) - premium;
            else legPL = Math.max(0, leg.strike - S_expiration) - premium;
            if (leg.position === 'short') legPL = -legPL;
            totalPL += legPL * leg.ratio;
        });
        return totalPL;
    }


    async function drawPayoffChart(strategyId) {
        // Use Chart.js for now. Plotly switch can be added later if desired.
        payoffChartCanvas.style.display = 'block';
        plotlyChartArea.style.display = 'none';


        if (!currentOptionData || !currentOptionData.options || currentOptionData.options.length === 0) {
            console.warn("Cannot draw chart: Option data not available or empty.");
            alert("Please load options data first by clicking the 'Load/Refresh' button.");
             // Clear chart if it exists
            if (payoffChart) { payoffChart.destroy(); payoffChart = null; }
            return;
        }

        const strategy = strategies.find(s => s.id === strategyId);
        if (!strategy) {
            console.warn(`Strategy ${strategyId} not found.`);
            return;
        }

        const S_current = currentOptionData.underlyingPrice;
        const r = currentOptionData.riskFreeRate;
        const T_initial = currentOptionData.daysToExpiration / 365.0;

        const pricePoints = [];
        const expirationPL_values = [];
        const t0_PL_values = [];

        let allStrikesInStrategy = strategy.legs.map(l => l.strike);
        const minStrikeInStrategy = Math.min(...allStrikesInStrategy);
        const maxStrikeInStrategy = Math.max(...allStrikesInStrategy);
        
        const chartRangeFactor = 0.05; // 5% around the strategy's effective range / current price
        const midPointStrategy = (minStrikeInStrategy + maxStrikeInStrategy) / 2 || S_current;
        const rangeHalfWidth = Math.max((maxStrikeInStrategy - minStrikeInStrategy) / 2 * 1.5, S_current * chartRangeFactor * 2);


        const minPrice = Math.min(S_current * (1-chartRangeFactor*2), midPointStrategy - rangeHalfWidth);
        const maxPrice = Math.max(S_current * (1+chartRangeFactor*2), midPointStrategy + rangeHalfWidth);
        const step = (maxPrice - minPrice) / 100;

        let portfolioGreeks = { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 };

        strategy.legs.forEach(leg => {
            const optionChainEntry = currentOptionData.options.find(opt => opt.strike === leg.strike);
            if (!optionChainEntry) {
                 console.warn(`Greeks Calc: Data for strike ${leg.strike} not found.`);
                 return; // Skip this leg if no data
            }
            const legData = leg.type === 'call' ? optionChainEntry.call : optionChainEntry.put;
            if (!legData || typeof legData.iv === 'undefined' || isNaN(legData.iv)) {
                console.warn(`Greeks Calc: IV not found or NaN for ${leg.type} at ${leg.strike}. Using default for this leg.`);
                // Don't calculate greeks for this leg if IV is missing, or use a default IV if appropriate.
                // For simplicity, we'll skip greek contribution if IV is bad.
                return;
            }
            const iv = legData.iv;
            const greeks = getGreeks(S_current, leg.strike, T_initial, r, iv, leg.type);
            const multiplier = (leg.position === 'long' ? 1 : -1) * leg.ratio;

            portfolioGreeks.delta += (greeks.delta || 0) * multiplier;
            portfolioGreeks.gamma += (greeks.gamma || 0) * multiplier;
            portfolioGreeks.vega += (greeks.vega || 0) * multiplier;
            portfolioGreeks.theta += (greeks.theta || 0) * multiplier;
            // Rho calculation can be added to getGreeks if needed
        });


        for (let S_axis = minPrice; S_axis <= maxPrice; S_axis += step) {
            pricePoints.push(S_axis.toFixed(2));
            expirationPL_values.push(calculateExpirationPL(S_axis, strategy.legs).toFixed(2));

            let currentPortfolioValue_T0 = 0;
            strategy.legs.forEach(leg => {
                const optionChainEntry = currentOptionData.options.find(opt => opt.strike === leg.strike);
                 if (!optionChainEntry) {  /* console.warn for missing strike */ return; }
                const legData = leg.type === 'call' ? optionChainEntry.call : optionChainEntry.put;
                if (!legData || typeof legData.iv === 'undefined' || isNaN(legData.iv) || typeof legData.last === 'undefined' || isNaN(legData.last)) {
                    /* console.warn for missing iv/last */ return;
                }
                const iv = legData.iv;
                const initialOptionPremium = legData.last;
                const currentBSPrice = blackScholes(S_axis, leg.strike, T_initial, r, iv, leg.type);
                
                let pnlForLeg = currentBSPrice - initialOptionPremium;
                if (leg.position === 'short') pnlForLeg = -pnlForLeg;
                currentPortfolioValue_T0 += pnlForLeg * leg.ratio;
            });
            t0_PL_values.push(currentPortfolioValue_T0.toFixed(2));
        }

        if (payoffChart) payoffChart.destroy();
        
        // Chart.js rendering (similar to before, ensure colors and annotations are correct)
        const chartConfig = { /* ... your Chart.js config ... */ 
            type: 'line',
            data: { /* ... datasets for expirationPL and t0_PL ... */ 
                labels: pricePoints,
                datasets: [
                    {
                        label: 'P&L at Expiration',
                        data: expirationPL_values,
                        borderColor: (ctx) => { /* ... */ return parseFloat(ctx.p0?.parsed?.y || ctx.p1?.parsed?.y || 0) >= 0 ? 'green' : 'red'; },
                        borderWidth: 2,
                        fill: { target: 'origin', above: 'rgba(0,255,0,0.1)', below: 'rgba(255,0,0,0.1)'},
                        tension: 0.1, pointRadius: 0,
                    },
                    {
                        label: 'T+0 P&L (Est.)', data: t0_PL_values,
                        borderColor: 'orange', borderWidth: 2, borderDash: [5, 5],
                        fill: false, tension: 0.2, pointRadius: 0,
                    }
                ]
            },
            options: { /* ... scales, plugins, annotation for S_current ... */
                responsive: true, maintainAspectRatio: false,
                scales: { x: { title: { display: true, text: 'Underlying Price'}}, y: { title: { display: true, text: 'Profit / Loss'}}},
                plugins: {
                    legend: { display: true },
                    annotation: {
                        annotations: {
                            currentPriceLine: {
                                type: 'line', xMin: S_current, xMax: S_current,
                                borderColor: 'blue', borderWidth: 2, borderDash: [6, 6],
                                label: { content: `Current: ${S_current.toFixed(2)}`, enabled: true, position: 'start'}
                            }
                        }
                    }
                }
            }
        };
        payoffChart = new Chart(payoffChartCanvas, chartConfig);

        updateMetricsDisplay(strategy, expirationPL_values, pricePoints, portfolioGreeks);
    }


    function updateMetricsDisplay(strategy, expirationPLs, pricePointsArr, greeks) {
        if(!currentOptionData) { /* clear metrics or show N/A */ return; }
        metricUnderlyingEl.textContent = `${currentOptionData.underlyingPrice.toFixed(2)} USD`;

        let maxProfit = -Infinity, maxLoss = Infinity;
        expirationPLs.forEach(plStr => { /* ... calculate maxP/maxL ... */ 
            const pl = parseFloat(plStr);
            if (pl > maxProfit) maxProfit = pl;
            if (pl < maxLoss) maxLoss = pl;
        });
        // Simplified unlimited check (can be more robust by checking strategy structure)
        if (strategy.legs.some(l => l.position === 'short' && (l.type==='call' || l.type ==='put'))) { // Naked short implies large/unlimited risk
            if (!strategy.legs.some(prot => prot.position === 'long' && prot.type === (strategy.legs.find(l=>l.position ==='short').type) && (prot.type === 'call' ? prot.strike > strategy.legs.find(l=>l.position ==='short').strike : prot.strike < strategy.legs.find(l=>l.position ==='short').strike))) {
                 maxLoss = -Infinity; // More specific check needed for true unlimited
            }
        }
        if (strategy.legs.some(l => l.position === 'long' && l.type==='call')) {
             if (!strategy.legs.some(prot => prot.position === 'short' && prot.type === 'call' && prot.strike > strategy.legs.find(l=>l.position ==='long' && l.type==='call').strike)) {
                 maxProfit = Infinity;
             }
        }

        metricMaxProfitEl.textContent = isFinite(maxProfit) ? maxProfit.toFixed(2) : 'Unlimited';
        metricMaxLossEl.textContent = isFinite(maxLoss) ? maxLoss.toFixed(2) : 'Unlimited';
        
        const breakevens = []; /* ... calculate breakevens ... */
        for (let i = 0; i < expirationPLs.length - 1; i++) {
            const pl1 = parseFloat(expirationPLs[i]), pl2 = parseFloat(expirationPLs[i+1]);
            if ((pl1 < 0 && pl2 >=0) || (pl1 > 0 && pl2 <=0) || (pl1 === 0 && i > 0)) {
                if (pl1 === 0) breakevens.push(parseFloat(pricePointsArr[i]).toFixed(2));
                else if (pl2 !== pl1) {
                    const p1 = parseFloat(pricePointsArr[i]), p2 = parseFloat(pricePointsArr[i+1]);
                    breakevens.push((p1 - pl1 * (p2 - p1) / (pl2 - pl1)).toFixed(2));
                }
            }
        }
        metricBreakevenEl.textContent = breakevens.length > 0 ? breakevens.join(', ') : 'N/A';
        
        metricDeltaEl.textContent = greeks.delta.toFixed(3);
        metricGammaEl.textContent = greeks.gamma.toFixed(4);
        metricThetaEl.textContent = greeks.theta.toFixed(3);
        metricVegaEl.textContent = greeks.vega.toFixed(3);
        metricRhoEl.textContent = 'N/A'; // Rho not fully implemented here
    }

    function populateStrategyList() {
        strategyListElement.innerHTML = '';
        // Filter logic can be re-added here if desired
        strategies.forEach(strategy => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';
            listItem.dataset.strategyId = strategy.id;
            listItem.innerHTML = `${strategy.name} <span class="strategy-tag tag-${strategy.type}">${strategy.type.toUpperCase()}</span>`;
            listItem.addEventListener('click', async () => {
                document.querySelectorAll('#strategyList .list-group-item.active').forEach(el => el.classList.remove('active'));
                listItem.classList.add('active');
                await drawPayoffChart(strategy.id);
            });
            strategyListElement.appendChild(listItem);
        });
    }

    function initializeAppUIWithData() {
        if (!currentOptionData) {
            console.log("No current option data to initialize UI.");
            metricUnderlyingEl.textContent = 'N/A (Load Data)';
            return;
        }
        metricUnderlyingEl.textContent = `${currentOptionData.underlyingPrice.toFixed(2)} USD`;
        riskFreeRateInput.value = (currentOptionData.riskFreeRate * 100).toFixed(2);
        populateStrategyList();

        // Select first strategy by default if data is available
        if (strategies.length > 0 && currentOptionData.options && currentOptionData.options.length > 0) {
            const firstStrategyItem = strategyListElement.querySelector('.list-group-item');
            if (firstStrategyItem) {
                firstStrategyItem.click(); // Trigger click to draw chart
            }
        } else if (currentOptionData.options && currentOptionData.options.length === 0){
            alert("Warning: Options chain is empty after parsing. Check parser logic and raw data.");
        }
    }

    // --- App Initialization ---
    async function main() {
        await initDB();
        loadDataBtn.addEventListener('click', loadAndProcessRawData);
        riskFreeRateInput.addEventListener('change', () => {
            if (currentOptionData) {
                currentOptionData.riskFreeRate = parseFloat(riskFreeRateInput.value) / 100;
                // Re-trigger chart draw if a strategy is selected
                const activeStrategy = strategyListElement.querySelector('.list-group-item.active');
                if (activeStrategy) {
                    drawPayoffChart(activeStrategy.dataset.strategyId);
                }
            }
        });


        // Try to load data from DB on startup
        const storedData = await getDataFromDB(OS_NAME_CHAIN);
        if (storedData) {
            currentOptionData = storedData;
            console.log('Loaded data from IndexedDB on startup.');
            populateExpirationDropdown();
            initializeAppUIWithData();
        } else {
            console.log('No data in IndexedDB, click "Load/Refresh" to parse from text file.');
            expirationSelect.innerHTML = '<option>Click Load Data</option>';
            expirationSelect.disabled = true;
            // Still populate strategy list so user can see them
            populateStrategyList();
        }
    }

    main(); // Start the application
});
