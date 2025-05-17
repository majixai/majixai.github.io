document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements (same as before)
    const strategyListElement = document.getElementById('strategyList');
    const payoffChartCanvas = document.getElementById('payoffChart');
    const plotlyChartArea = document.getElementById('plotlyChartArea');
    let payoffChart = null;

    const metricUnderlyingEl = document.getElementById('metricUnderlying');
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

    let currentOptionData = null;
    let db = null;

    const DB_NAME = 'OptionsDataDB_JSON'; // Slightly different name to avoid old schema conflicts
    const DB_VERSION = 1; // Can increment if schema changes
    const OS_NAME_CHAIN = 'optionsChainJSON'; // Object store for JSON data

    // --- IndexedDB Helper Functions (same as before) ---
    async function initDB() {
        console.log(`Initializing IndexedDB: ${DB_NAME}, Version: ${DB_VERSION}`);
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                console.log('IndexedDB upgrade needed.');
                const dbInstance = event.target.result;
                if (!dbInstance.objectStoreNames.contains(OS_NAME_CHAIN)) {
                    console.log(`Creating object store: ${OS_NAME_CHAIN}`);
                    dbInstance.createObjectStore(OS_NAME_CHAIN, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                console.log('IndexedDB initialized successfully.');
                resolve(db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.errorCode, event.target.error);
                reject(event.target.error);
            };
        });
    }

    async function storeDataInDB(objectStoreName, data, key = 'optionsChainData') {
        if (!db) {
            console.error('DB not initialized. Cannot store data.');
            return Promise.reject('DB not initialized');
        }
        console.log(`Attempting to store data in ${objectStoreName} with key ${key}`);
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([objectStoreName], 'readwrite');
                const store = transaction.objectStore(objectStoreName);
                // The data from JSON is an object, we add an 'id' for IndexedDB keyPath
                const dataToStore = { id: key, ...data };
                const request = store.put(dataToStore);

                request.onsuccess = () => {
                    console.log(`Data stored successfully in ${objectStoreName} with key ${key}`);
                    resolve();
                };
                request.onerror = (event) => {
                    console.error(`Error storing data in ${objectStoreName}:`, event.target.error);
                    reject(event.target.error);
                };
            } catch (e) {
                console.error(`Exception during DB transaction for storing data:`, e);
                reject(e);
            }
        });
    }

    async function getDataFromDB(objectStoreName, key = 'optionsChainData') {
        if (!db) {
            console.error('DB not initialized. Cannot get data.');
            return Promise.resolve(null); // Resolve with null if DB isn't ready
        }
        console.log(`Attempting to get data from ${objectStoreName} with key ${key}`);
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([objectStoreName], 'readonly');
                const store = transaction.objectStore(objectStoreName);
                const request = store.get(key);

                request.onsuccess = (event) => {
                    const result = event.target.result;
                    if (result) {
                        console.log(`Data retrieved successfully from ${objectStoreName} for key ${key}:`, result);
                        // Remove the 'id' field before returning, as the app expects the pure data object
                        const { id, ...actualData } = result;
                        resolve(actualData);
                    } else {
                        console.log(`No data found in ${objectStoreName} for key ${key}`);
                        resolve(null);
                    }
                };
                request.onerror = (event) => {
                    console.error(`Error getting data from ${objectStoreName}:`, event.target.error);
                    reject(event.target.error); // Keep as reject for errors
                };
            } catch (e) {
                console.error(`Exception during DB transaction for getting data:`, e);
                reject(e);
            }
        });
    }

    // --- Fetch, Process, and Store Data from JSON File ---
    async function loadAndProcessJsonData() {
        loadDataBtn.disabled = true;
        loadDataBtn.textContent = 'Loading...';
        expirationSelect.innerHTML = '<option>Loading data...</option>';
        expirationSelect.disabled = true;
        console.log('Starting loadAndProcessJsonData...');

        try {
            console.log('Fetching mock_options_chain.json...');
            const response = await fetch('mock_options_chain.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} when fetching JSON.`);
            }
            const jsonData = await response.json();
            console.log('JSON data fetched successfully:', jsonData);

            // Calculate DTE (Days To Expiration) dynamically
            const currentDate = new Date(); // Use today's actual date
            const expirationDateObj = new Date(jsonData.expirationDate + "T00:00:00Z"); // Ensure UTC for consistency
            const daysToExpiration = Math.max(1, Math.round((expirationDateObj.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));
            
            const processedData = {
                ...jsonData,
                daysToExpiration: daysToExpiration,
                // Ensure riskFreeRate from JSON is used, or fallback to input if JSON doesn't have it
                riskFreeRate: typeof jsonData.riskFreeRate === 'number' ? jsonData.riskFreeRate : (parseFloat(riskFreeRateInput.value) / 100 || 0.052)
            };
            console.log('Data processed with DTE and risk-free rate:', processedData);

            await storeDataInDB(OS_NAME_CHAIN, processedData);
            currentOptionData = processedData;
            console.log('JSON data processed and stored in IndexedDB.');
            alert('Options data loaded from JSON and processed successfully!');
            populateUIData();
        } catch (error) {
            console.error('Error loading or processing JSON data:', error);
            alert(`Error loading data: ${error.message}. Check console. Trying to use stored data if available.`);
            try {
                const existingData = await getDataFromDB(OS_NAME_CHAIN);
                if (existingData) {
                    currentOptionData = existingData;
                    console.log('Using previously stored data due to JSON load error.');
                    alert('Using previously stored data.');
                    populateUIData();
                } else {
                    currentOptionData = null; // Ensure it's null if everything fails
                    console.log('No previously stored data available after JSON load error.');
                }
            } catch (dbError) {
                console.error('Error trying to load from DB after JSON fetch error:', dbError);
                currentOptionData = null;
            }
        } finally {
            loadDataBtn.disabled = false;
            loadDataBtn.textContent = 'Load/Refresh Options Data';
            console.log('loadAndProcessJsonData finished.');
        }
    }

    function populateUIData() {
        if (currentOptionData) {
            console.log('Populating UI with currentOptionData:', currentOptionData);
            expirationSelect.innerHTML = `<option value="${currentOptionData.expirationDate}">${currentOptionData.expirationDate} (DTE: ${currentOptionData.daysToExpiration})</option>`;
            expirationSelect.disabled = false;
            metricUnderlyingEl.textContent = `${currentOptionData.underlyingPrice.toFixed(2)} USD`;
            riskFreeRateInput.value = (currentOptionData.riskFreeRate * 100).toFixed(2);
            initializeAppUIWithData(); // This will populate strategies and select the first one
        } else {
            console.log('No currentOptionData to populate UI.');
            expirationSelect.innerHTML = '<option>No data loaded</option>';
            expirationSelect.disabled = true;
            metricUnderlyingEl.textContent = 'N/A';
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
    // Ensure these strategies use strikes present in mock_options_chain.json
    const strategies = [
        {
            id: 'longCall_ATM', name: 'Long Call (ATM)', type: 'bullish',
            legs: [{ type: 'call', position: 'long', strike: 5975, ratio: 1 }],
        },
        {
            id: 'shortPut_OTM', name: 'Short Put (OTM)', type: 'bullish',
            legs: [{ type: 'put', position: 'short', strike: 5900, ratio: 1 }],
        },
        {
            id: 'shortStrangle', name: 'Short Strangle', type: 'neutral',
            legs: [
                { type: 'put', position: 'short', strike: 5900, ratio: 1 },
                { type: 'call', position: 'short', strike: 6050, ratio: 1 }
            ],
        },
        {
            id: 'ironCondor', name: 'Short Iron Condor', type: 'neutral',
            legs: [
                { type: 'put',  position: 'long',  strike: 5850, ratio: 1 },
                { type: 'put',  position: 'short', strike: 5900, ratio: 1 },
                { type: 'call', position: 'short', strike: 6050, ratio: 1 },
                { type: 'call', position: 'long',  strike: 6100, ratio: 1 }
            ],
        }
    ];

    // --- P&L and Charting Logic (adjust to use `currentOptionData` correctly) ---
    // Make sure calculateExpirationPL, drawPayoffChart, updateMetricsDisplay
    // correctly access `currentOptionData.options[...].call.last` or `.put.last` for premium
    // and `.call.iv` or `.put.iv` for implied volatility.

    function calculateExpirationPL(S_expiration, strategyLegs) {
        // ... (same as previous version that uses .last for premium)
        if (!currentOptionData || !currentOptionData.options) {
            console.warn("calculateExpirationPL: No option data available.");
            return 0;
        }
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
        // ... (largely same as previous version, ensuring data access is correct)
        // Using Chart.js
        payoffChartCanvas.style.display = 'block';
        plotlyChartArea.style.display = 'none';

        if (!currentOptionData || !currentOptionData.options || currentOptionData.options.length === 0) {
            console.warn("Cannot draw chart: Option data not available or empty.");
            if (payoffChart) { payoffChart.destroy(); payoffChart = null; }
            return;
        }

        const strategy = strategies.find(s => s.id === strategyId);
        if (!strategy) {
            console.warn(`Strategy ${strategyId} not found.`);
            return;
        }
        console.log(`Drawing chart for strategy: ${strategy.name}`);

        const S_current = currentOptionData.underlyingPrice;
        const r = currentOptionData.riskFreeRate;
        const T_initial = currentOptionData.daysToExpiration / 365.0;

        const pricePoints = [];
        const expirationPL_values = [];
        const t0_PL_values = [];

        let allStrikesInStrategy = strategy.legs.map(l => l.strike);
        const minStrikeInStrategy = Math.min(...allStrikesInStrategy, S_current);
        const maxStrikeInStrategy = Math.max(...allStrikesInStrategy, S_current);
        
        const chartRangeFactor = 0.07; // 7% around the strikes/current price
        const minPrice = minStrikeInStrategy * (1 - chartRangeFactor);
        const maxPrice = maxStrikeInStrategy * (1 + chartRangeFactor);
        const step = (maxPrice - minPrice) / 100;

        let portfolioGreeks = { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 };

        strategy.legs.forEach(leg => {
            const optionChainEntry = currentOptionData.options.find(opt => opt.strike === leg.strike);
            if (!optionChainEntry) {
                 console.warn(`Greeks Calc: No data for strike ${leg.strike} in currentOptionData.options.`);
                 return; 
            }
            const legData = leg.type === 'call' ? optionChainEntry.call : optionChainEntry.put;
            if (!legData || typeof legData.iv !== 'number' || isNaN(legData.iv)) {
                console.warn(`Greeks Calc: IV invalid for ${leg.type} at ${leg.strike}. Skipping greeks for this leg.`);
                return;
            }
            const iv = legData.iv;
            const greeks = getGreeks(S_current, leg.strike, T_initial, r, iv, leg.type);
            const multiplier = (leg.position === 'long' ? 1 : -1) * leg.ratio;

            portfolioGreeks.delta += (greeks.delta || 0) * multiplier;
            portfolioGreeks.gamma += (greeks.gamma || 0) * multiplier;
            portfolioGreeks.vega += (greeks.vega || 0) * multiplier;
            portfolioGreeks.theta += (greeks.theta || 0) * multiplier;
        });

        for (let S_axis = minPrice; S_axis <= maxPrice; S_axis += step) {
            pricePoints.push(S_axis.toFixed(2));
            expirationPL_values.push(calculateExpirationPL(S_axis, strategy.legs).toFixed(2));

            let currentPortfolioValue_T0 = 0;
            strategy.legs.forEach(leg => {
                const optionChainEntry = currentOptionData.options.find(opt => opt.strike === leg.strike);
                if (!optionChainEntry) return;
                const legData = leg.type === 'call' ? optionChainEntry.call : optionChainEntry.put;
                 if (!legData || typeof legData.iv !== 'number' || isNaN(legData.iv) || typeof legData.last !== 'number' || isNaN(legData.last)) {
                    console.warn(`T+0 Calc: IV or Last invalid for ${leg.type} at ${leg.strike}.`); return;
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
        
        const chartConfig = { /* ... your Chart.js config (same as previous) ... */ 
            type: 'line',
            data: { 
                labels: pricePoints,
                datasets: [
                    {
                        label: 'P&L at Expiration', data: expirationPL_values,
                        borderColor: (ctx) => parseFloat(ctx.p0?.parsed?.y || ctx.p1?.parsed?.y || 0) >= 0 ? getComputedStyle(document.documentElement).getPropertyValue('--tv-profit-green-border') : getComputedStyle(document.documentElement).getPropertyValue('--tv-loss-red-border'),
                        borderWidth: 2,
                        fill: { target: 'origin', above: getComputedStyle(document.documentElement).getPropertyValue('--tv-profit-green'), below: getComputedStyle(document.documentElement).getPropertyValue('--tv-loss-red')},
                        tension: 0.1, pointRadius: 0,
                    },
                    {
                        label: 'T+0 P&L (Est.)', data: t0_PL_values,
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--tv-t0-line-color'),
                        borderWidth: 2, borderDash: [5, 5], fill: false, tension: 0.2, pointRadius: 0,
                    }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false,
                scales: { x: { title: { display: true, text: 'Underlying Price'}, ticks: {color: getComputedStyle(document.documentElement).getPropertyValue('--tv-text-secondary')}, grid:{color: getComputedStyle(document.documentElement).getPropertyValue('--tv-border-color')}}, 
                          y: { title: { display: true, text: 'Profit / Loss'}, ticks: {color: getComputedStyle(document.documentElement).getPropertyValue('--tv-text-secondary')}, grid:{color: getComputedStyle(document.documentElement).getPropertyValue('--tv-border-color')}}},
                plugins: {
                    legend: { display: true, labels: {color: getComputedStyle(document.documentElement).getPropertyValue('--tv-text-primary')} },
                    tooltip: {mode: 'index', intersect: false},
                    annotation: {
                        annotations: {
                            currentPriceLine: {
                                type: 'line', xMin: S_current, xMax: S_current,
                                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--tv-current-price-line'),
                                borderWidth: 2, borderDash: [6, 6],
                                label: { content: `Current: ${S_current.toFixed(2)}`, enabled: true, position: 'start', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', font:{size:10}}
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
        // ... (same as previous version, ensures currentOptionData is checked)
        if(!currentOptionData) { 
            Object.values(metricElements).forEach(el => el.textContent = 'N/A'); // Example clear
            return;
        }
        metricUnderlyingEl.textContent = `${currentOptionData.underlyingPrice.toFixed(2)} USD`;

        let maxProfit = -Infinity, maxLoss = Infinity;
        expirationPLs.forEach(plStr => { 
            const pl = parseFloat(plStr);
            if (pl > maxProfit) maxProfit = pl;
            if (pl < maxLoss) maxLoss = pl;
        });
       
        // Simplified unlimited check
        let hasNakedShortCall = false, hasNakedShortPut = false;
        let hasNakedLongCall = false;

        strategy.legs.forEach(leg => {
            if (leg.position === 'short' && leg.type === 'call' && !strategy.legs.find(p => p.type === 'call' && p.position === 'long' && p.strike > leg.strike)) hasNakedShortCall = true;
            if (leg.position === 'short' && leg.type === 'put' && !strategy.legs.find(p => p.type === 'put' && p.position === 'long' && p.strike < leg.strike)) hasNakedShortPut = true;
            if (leg.position === 'long' && leg.type === 'call' && !strategy.legs.find(p => p.type === 'call' && p.position === 'short' && p.strike > leg.strike)) hasNakedLongCall = true;
        });

        if (hasNakedShortCall || hasNakedShortPut) maxLoss = -Infinity; // Simplified to "Unlimited"
        if (hasNakedLongCall) maxProfit = Infinity;


        metricMaxProfitEl.textContent = isFinite(maxProfit) ? maxProfit.toFixed(2) : 'Unlimited';
        metricMaxLossEl.textContent = isFinite(maxLoss) ? maxLoss.toFixed(2) : 'Unlimited';
        
        const breakevens = []; 
        for (let i = 0; i < expirationPLs.length - 1; i++) {
            const pl1 = parseFloat(expirationPLs[i]), pl2 = parseFloat(expirationPLs[i+1]);
            if ((pl1 < 0 && pl2 >=0) || (pl1 > 0 && pl2 <=0) || (pl1 === 0 && i > 0 && parseFloat(expirationPLs[i-1]) !==0) ) { // Check previous to avoid multiple 0s
                if (pl1 === 0) breakevens.push(parseFloat(pricePointsArr[i]).toFixed(2));
                else if (pl2 !== pl1) { // Interpolate
                    const p1 = parseFloat(pricePointsArr[i]), p2 = parseFloat(pricePointsArr[i+1]);
                    breakevens.push((p1 - pl1 * (p2 - p1) / (pl2 - pl1)).toFixed(2));
                }
            }
        }
        metricBreakevenEl.textContent = breakevens.length > 0 ? breakevens.filter((v,i,a)=>a.indexOf(v)===i).join(', ') : 'N/A'; // Unique breakevens
        
        metricDeltaEl.textContent = greeks.delta.toFixed(3);
        metricGammaEl.textContent = greeks.gamma.toFixed(4);
        metricThetaEl.textContent = greeks.theta.toFixed(3);
        metricVegaEl.textContent = greeks.vega.toFixed(3);
        metricRhoEl.textContent = 'N/A';
    }

    function populateStrategyList() {
        // ... (same as previous version)
        strategyListElement.innerHTML = '';
        strategies.forEach(strategy => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';
            listItem.dataset.strategyId = strategy.id;
            listItem.innerHTML = `${strategy.name} <span class="strategy-tag tag-${strategy.type}">${strategy.type.toUpperCase()}</span>`;
            listItem.addEventListener('click', async () => {
                document.querySelectorAll('#strategyList .list-group-item.active').forEach(el => el.classList.remove('active'));
                listItem.classList.add('active');
                console.log(`Strategy list item clicked: ${strategy.name}`);
                await drawPayoffChart(strategy.id);
            });
            strategyListElement.appendChild(listItem);
        });
    }

    function initializeAppUIWithData() {
        // ... (same as previous version - populates strategies, selects first one)
        if (!currentOptionData) {
            console.log("No current option data to initialize UI.");
            return;
        }
        console.log("Initializing app UI with data...");
        populateStrategyList();

        if (strategies.length > 0 && currentOptionData.options && currentOptionData.options.length > 0) {
            const firstStrategyItem = strategyListElement.querySelector('.list-group-item');
            if (firstStrategyItem) {
                console.log("Automatically selecting first strategy.");
                firstStrategyItem.click();
            }
        } else {
            console.warn("No strategies or no option data to select first strategy.");
        }
    }

    // --- App Initialization ---
    async function main() {
        console.log('Application main() started.');
        try {
            await initDB();
        } catch (dbInitError) {
            console.error("CRITICAL: Failed to initialize IndexedDB. App might not work correctly.", dbInitError);
            alert("Error: Could not initialize the local database. Some features might be unavailable.");
            // Proceed without DB if necessary, or show a more prominent error.
        }

        loadDataBtn.addEventListener('click', loadAndProcessJsonData);
        riskFreeRateInput.addEventListener('change', () => {
            if (currentOptionData) {
                const newRate = parseFloat(riskFreeRateInput.value) / 100;
                if (!isNaN(newRate)) {
                    currentOptionData.riskFreeRate = newRate;
                    console.log(`Risk-free rate changed to: ${currentOptionData.riskFreeRate}`);
                    // Re-trigger chart draw if a strategy is selected
                    const activeStrategy = strategyListElement.querySelector('.list-group-item.active');
                    if (activeStrategy) {
                        console.log(`Re-drawing chart for active strategy due to RFR change.`);
                        drawPayoffChart(activeStrategy.dataset.strategyId);
                    }
                    // Optionally re-store in DB if RFR is part of the main stored object
                    // await storeDataInDB(OS_NAME_CHAIN, currentOptionData); 
                }
            }
        });

        // Try to load data from DB on startup
        try {
            const storedData = await getDataFromDB(OS_NAME_CHAIN);
            if (storedData) {
                currentOptionData = storedData;
                console.log('Loaded data from IndexedDB on startup.');
                populateUIData();
            } else {
                console.log('No data in IndexedDB, click "Load/Refresh" to fetch from JSON file.');
                expirationSelect.innerHTML = '<option>Click Load Data</option>';
                expirationSelect.disabled = true;
                populateStrategyList(); // Show strategies even if no data
            }
        } catch (dbError) {
            console.error('Error loading data from DB on startup:', dbError);
            expirationSelect.innerHTML = '<option>DB Error</option>';
            expirationSelect.disabled = true;
            populateStrategyList();
        }
        console.log('Application main() finished.');
    }

    main();
});
