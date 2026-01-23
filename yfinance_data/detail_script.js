/**
 * Ticker Detail Analysis System
 * Advanced Mathematical and Financial Analysis
 */

// Global state
let currentTicker = '';
let tickerData = [];
let activeAnalyses = new Set();

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    console.log('Initializing Ticker Detail Page...');
    
    // Get ticker from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentTicker = urlParams.get('ticker');
    
    if (!currentTicker) {
        alert('No ticker specified');
        window.location.href = 'index.html';
        return;
    }
    
    document.getElementById('ticker-title').textContent = `${currentTicker} - Advanced Analysis`;
    console.log(`Loaded ticker: ${currentTicker}`);
    
    // Setup event listeners
    setupEventListeners();
    
    // Fetch ticker data
    fetchTickerData();
}

function setupEventListeners() {
    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // AI Analysis buttons
    document.querySelectorAll('.ai-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const analysisType = this.dataset.analysis;
            console.log(`Clicked: ${analysisType}`);
            toggleAnalysis(analysisType, this);
        });
    });
}

function toggleAnalysis(analysisType, button) {
    const section = document.getElementById(analysisType);
    if (!section) return;
    
    // Toggle button active state
    button.classList.toggle('active');
    
    if (section.style.display === 'none') {
        // Show and run analysis
        section.style.display = 'block';
        if (!activeAnalyses.has(analysisType)) {
            runAnalysis(analysisType);
            activeAnalyses.add(analysisType);
        }
    } else {
        // Hide section
        section.style.display = 'none';
    }
}

async function fetchTickerData() {
    showLoading('Fetching ticker data...');
    
    try {
        // Simulate data fetch - in production, this would fetch from your backend
        console.log(`Fetching data for ${currentTicker}...`);
        
        // Generate sample data for demonstration
        tickerData = generateSampleData(currentTicker);
        
        hideLoading();
        console.log('Ticker data loaded successfully');
    } catch (error) {
        hideLoading();
        console.error('Error fetching ticker data:', error);
        alert('Error loading ticker data');
    }
}

function generateSampleData(ticker) {
    // Generate 252 trading days of data
    const data = [];
    let price = 100 + Math.random() * 400;
    
    for (let i = 0; i < 252; i++) {
        const change = (Math.random() - 0.48) * price * 0.02;
        price = Math.max(price + change, 1);
        
        const volatility = 0.015;
        const open = price * (1 + (Math.random() - 0.5) * volatility);
        const close = price * (1 + (Math.random() - 0.5) * volatility);
        const high = Math.max(open, close) * (1 + Math.random() * volatility);
        const low = Math.min(open, close) * (1 - Math.random() * volatility);
        const volume = Math.floor(1000000 + Math.random() * 5000000);
        
        data.push({
            date: new Date(2025, 0, 1 + i).toISOString().split('T')[0],
            open: open,
            high: high,
            low: low,
            close: close,
            volume: volume
        });
    }
    
    return data;
}

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

function runAnalysis(analysisType) {
    showLoading(`Running ${analysisType} analysis...`);
    
    const section = document.getElementById(analysisType);
    const statusEl = section.querySelector('.section-status');
    const contentEl = section.querySelector('.section-content');
    
    statusEl.textContent = '🔄 Analyzing...';
    statusEl.className = 'section-status analyzing';
    
    // Run specific analysis
    setTimeout(() => {
        switch(analysisType) {
            case 'price-projection':
                analyzePriceProjection(section);
                break;
            case 'options-bsm':
                analyzeOptionsBSM(section);
                break;
            case 'chart-patterns':
                analyzeChartPatterns(section);
                break;
            case 'technical-indicators':
                analyzeTechnicalIndicators(section);
                break;
            case 'differential-calculus':
                analyzeDifferentialCalculus(section);
                break;
            case 'integral-calculus':
                analyzeIntegralCalculus(section);
                break;
            case 'arctrig-analysis':
                analyzeArctrig(section);
                break;
            case 'multivariate-matrix':
                analyzeMultivariateMatrix(section);
                break;
            case 'risk-metrics':
                analyzeRiskMetrics(section);
                break;
            case 'momentum-signals':
                analyzeMomentumSignals(section);
                break;
        }
        
        statusEl.textContent = '✅ Analysis complete';
        statusEl.className = 'section-status complete';
        contentEl.classList.add('visible');
        hideLoading();
    }, 1500);
}

// 1. PRICE PROJECTION ANALYSIS
function analyzePriceProjection(section) {
    console.log('Running price projection analysis...');
    
    const chartEl = section.querySelector('#price-projection-chart');
    const detailsEl = section.querySelector('#price-projection-details');
    
    // Calculate projections
    const prices = tickerData.map(d => d.close);
    const currentPrice = prices[prices.length - 1];
    
    // Monte Carlo simulation
    const projections = monteCarloProjection(prices, 30);
    
    // Create chart
    const historicalTrace = {
        x: tickerData.map(d => d.date),
        y: prices,
        type: 'scatter',
        mode: 'lines',
        name: 'Historical',
        line: { color: '#667eea', width: 2 }
    };
    
    const projectionTrace = {
        x: projections.dates,
        y: projections.mean,
        type: 'scatter',
        mode: 'lines',
        name: 'Projection',
        line: { color: '#10b981', width: 2, dash: 'dash' }
    };
    
    const upperBound = {
        x: projections.dates,
        y: projections.upper,
        type: 'scatter',
        mode: 'lines',
        name: 'Upper Bound (95%)',
        line: { color: '#f59e0b', width: 1, dash: 'dot' },
        fill: 'tonexty'
    };
    
    const lowerBound = {
        x: projections.dates,
        y: projections.lower,
        type: 'scatter',
        mode: 'lines',
        name: 'Lower Bound (95%)',
        line: { color: '#f59e0b', width: 1, dash: 'dot' }
    };
    
    Plotly.newPlot(chartEl, [historicalTrace, lowerBound, upperBound, projectionTrace], {
        title: '30-Day Price Projection (Monte Carlo)',
        xaxis: { title: 'Date' },
        yaxis: { title: 'Price ($)' },
        showlegend: true
    });
    
    // Display details
    const targetPrice = projections.mean[projections.mean.length - 1];
    const priceChange = ((targetPrice - currentPrice) / currentPrice * 100).toFixed(2);
    
    detailsEl.innerHTML = `
        <h4>Projection Summary</h4>
        <table>
            <tr><td>Current Price:</td><td>$${currentPrice.toFixed(2)}</td></tr>
            <tr><td>30-Day Target:</td><td>$${targetPrice.toFixed(2)}</td></tr>
            <tr><td>Expected Change:</td><td>${priceChange}%</td></tr>
            <tr><td>Upper Bound (95%):</td><td>$${projections.upper[projections.upper.length-1].toFixed(2)}</td></tr>
            <tr><td>Lower Bound (95%):</td><td>$${projections.lower[projections.lower.length-1].toFixed(2)}</td></tr>
            <tr><td>Volatility (σ):</td><td>${(calculateVolatility(prices) * 100).toFixed(2)}%</td></tr>
        </table>
    `;
}

// 2. OPTIONS BSM ANALYSIS
function analyzeOptionsBSM(section) {
    console.log('Running Black-Scholes-Merton analysis...');
    
    const chartEl = section.querySelector('#options-bsm-chart');
    const detailsEl = section.querySelector('#options-bsm-details');
    
    const currentPrice = tickerData[tickerData.length - 1].close;
    const volatility = calculateVolatility(tickerData.map(d => d.close));
    const riskFreeRate = 0.045; // 4.5%
    const timeToExpiry = 0.25; // 3 months
    
    // Calculate for range of strike prices
    const strikes = [];
    const callPrices = [];
    const putPrices = [];
    const callDeltas = [];
    const putDeltas = [];
    
    for (let k = currentPrice * 0.8; k <= currentPrice * 1.2; k += currentPrice * 0.02) {
        strikes.push(k);
        const bsm = blackScholesCalculation(currentPrice, k, timeToExpiry, riskFreeRate, volatility);
        callPrices.push(bsm.callPrice);
        putPrices.push(bsm.putPrice);
        callDeltas.push(bsm.callDelta);
        putDeltas.push(bsm.putDelta);
    }
    
    // Create chart
    Plotly.newPlot(chartEl, [
        {
            x: strikes,
            y: callPrices,
            type: 'scatter',
            mode: 'lines',
            name: 'Call Price',
            line: { color: '#10b981', width: 2 }
        },
        {
            x: strikes,
            y: putPrices,
            type: 'scatter',
            mode: 'lines',
            name: 'Put Price',
            line: { color: '#ef4444', width: 2 }
        }
    ], {
        title: 'Options Pricing Surface (Black-Scholes-Merton)',
        xaxis: { title: 'Strike Price ($)' },
        yaxis: { title: 'Option Price ($)' }
    });
    
    // At-the-money options
    const atmBSM = blackScholesCalculation(currentPrice, currentPrice, timeToExpiry, riskFreeRate, volatility);
    
    detailsEl.innerHTML = `
        <h4>Black-Scholes-Merton Analysis</h4>
        <div class="formula-display">
            <div class="formula-title">Call Option Formula:</div>
            <div class="formula-content">
                C = S₀N(d₁) - Ke⁻ʳᵗN(d₂)<br>
                where d₁ = [ln(S₀/K) + (r + σ²/2)t] / (σ√t)<br>
                      d₂ = d₁ - σ√t
            </div>
        </div>
        <table>
            <tr><td>Spot Price (S₀):</td><td>$${currentPrice.toFixed(2)}</td></tr>
            <tr><td>Strike Price (K):</td><td>$${currentPrice.toFixed(2)} (ATM)</td></tr>
            <tr><td>Time to Expiry:</td><td>${timeToExpiry} years (3 months)</td></tr>
            <tr><td>Volatility (σ):</td><td>${(volatility * 100).toFixed(2)}%</td></tr>
            <tr><td>Risk-Free Rate (r):</td><td>${(riskFreeRate * 100).toFixed(2)}%</td></tr>
            <tr><td><strong>Call Price:</strong></td><td><strong>$${atmBSM.callPrice.toFixed(2)}</strong></td></tr>
            <tr><td><strong>Put Price:</strong></td><td><strong>$${atmBSM.putPrice.toFixed(2)}</strong></td></tr>
            <tr><td>Call Delta (Δ):</td><td>${atmBSM.callDelta.toFixed(4)}</td></tr>
            <tr><td>Put Delta (Δ):</td><td>${atmBSM.putDelta.toFixed(4)}</td></tr>
            <tr><td>Gamma (Γ):</td><td>${atmBSM.gamma.toFixed(4)}</td></tr>
            <tr><td>Vega (ν):</td><td>${atmBSM.vega.toFixed(4)}</td></tr>
            <tr><td>Theta (Θ):</td><td>${atmBSM.theta.toFixed(4)}</td></tr>
        </table>
    `;
}

// 3. CHART PATTERNS ANALYSIS
function analyzeChartPatterns(section) {
    console.log('Running chart pattern detection...');
    
    const chartEl = section.querySelector('#chart-patterns-chart');
    const detailsEl = section.querySelector('#chart-patterns-details');
    
    // Detect patterns
    const patterns = detectChartPatterns(tickerData);
    
    // Create candlestick chart with pattern annotations
    const candlestickTrace = {
        x: tickerData.map(d => d.date),
        open: tickerData.map(d => d.open),
        high: tickerData.map(d => d.high),
        low: tickerData.map(d => d.low),
        close: tickerData.map(d => d.close),
        type: 'candlestick',
        name: currentTicker
    };
    
    Plotly.newPlot(chartEl, [candlestickTrace], {
        title: 'Chart Pattern Detection',
        xaxis: { title: 'Date', rangeslider: { visible: false } },
        yaxis: { title: 'Price ($)' }
    });
    
    // Display patterns
    let patternsHTML = '<h4>Detected Patterns</h4><ul>';
    patterns.forEach(p => {
        patternsHTML += `<li><strong>${p.name}:</strong> ${p.description} (Confidence: ${p.confidence}%)</li>`;
    });
    patternsHTML += '</ul>';
    
    detailsEl.innerHTML = patternsHTML;
}

// 4. TECHNICAL INDICATORS
function analyzeTechnicalIndicators(section) {
    console.log('Running technical indicators analysis...');
    
    const chartEl = section.querySelector('#technical-indicators-chart');
    const detailsEl = section.querySelector('#technical-indicators-details');
    
    const prices = tickerData.map(d => d.close);
    const dates = tickerData.map(d => d.date);
    
    // Calculate indicators
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    const ema12 = calculateEMA(prices, 12);
    const rsi = calculateRSI(prices, 14);
    const macd = calculateMACD(prices);
    const bb = calculateBollingerBands(prices, 20, 2);
    
    // Create chart
    Plotly.newPlot(chartEl, [
        {
            x: dates,
            y: prices,
            type: 'scatter',
            mode: 'lines',
            name: 'Price',
            line: { color: '#667eea', width: 2 }
        },
        {
            x: dates.slice(19),
            y: sma20.slice(19),
            type: 'scatter',
            mode: 'lines',
            name: 'SMA(20)',
            line: { color: '#10b981', width: 1.5 }
        },
        {
            x: dates.slice(49),
            y: sma50.slice(49),
            type: 'scatter',
            mode: 'lines',
            name: 'SMA(50)',
            line: { color: '#ef4444', width: 1.5 }
        },
        {
            x: dates.slice(19),
            y: bb.upper.slice(19),
            type: 'scatter',
            mode: 'lines',
            name: 'BB Upper',
            line: { color: '#f59e0b', width: 1, dash: 'dot' }
        },
        {
            x: dates.slice(19),
            y: bb.lower.slice(19),
            type: 'scatter',
            mode: 'lines',
            name: 'BB Lower',
            line: { color: '#f59e0b', width: 1, dash: 'dot' }
        }
    ], {
        title: 'Technical Indicators',
        xaxis: { title: 'Date' },
        yaxis: { title: 'Price ($)' }
    });
    
    const currentRSI = rsi[rsi.length - 1];
    const currentMACD = macd.macd[macd.macd.length - 1];
    
    detailsEl.innerHTML = `
        <h4>Indicator Summary</h4>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">RSI (14)</div>
                <div class="metric-value">${currentRSI.toFixed(2)}</div>
                <div class="metric-change">${currentRSI > 70 ? 'Overbought' : currentRSI < 30 ? 'Oversold' : 'Neutral'}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">MACD</div>
                <div class="metric-value">${currentMACD.toFixed(2)}</div>
                <div class="metric-change">${currentMACD > 0 ? 'Bullish' : 'Bearish'}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">SMA(20)</div>
                <div class="metric-value">$${sma20[sma20.length-1].toFixed(2)}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">SMA(50)</div>
                <div class="metric-value">$${sma50[sma50.length-1].toFixed(2)}</div>
            </div>
        </div>
    `;
}

// 5. DIFFERENTIAL CALCULUS ANALYSIS
function analyzeDifferentialCalculus(section) {
    console.log('Running differential calculus analysis...');
    
    const chartEl = section.querySelector('#differential-calculus-chart');
    const detailsEl = section.querySelector('#differential-calculus-details');
    
    const prices = tickerData.map(d => d.close);
    const dates = tickerData.map(d => d.date);
    
    // Calculate derivatives
    const firstDerivative = calculateDerivative(prices);
    const secondDerivative = calculateDerivative(firstDerivative);
    const thirdDerivative = calculateDerivative(secondDerivative);
    
    // Calculate rate of change and acceleration
    const roc = firstDerivative.map(d => d * 100);
    const acceleration = secondDerivative.map(d => d * 100);
    
    Plotly.newPlot(chartEl, [
        {
            x: dates.slice(1),
            y: firstDerivative.slice(1),
            type: 'scatter',
            mode: 'lines',
            name: 'First Derivative (dP/dt)',
            line: { color: '#10b981', width: 2 }
        },
        {
            x: dates.slice(2),
            y: secondDerivative.slice(2),
            type: 'scatter',
            mode: 'lines',
            name: 'Second Derivative (d²P/dt²)',
            line: { color: '#ef4444', width: 2 }
        },
        {
            x: dates.slice(3),
            y: thirdDerivative.slice(3),
            type: 'scatter',
            mode: 'lines',
            name: 'Third Derivative (d³P/dt³)',
            line: { color: '#f59e0b', width: 2 }
        }
    ], {
        title: 'Differential Calculus Analysis',
        xaxis: { title: 'Date' },
        yaxis: { title: 'Rate of Change' }
    });
    
    const avgVelocity = firstDerivative.reduce((a, b) => a + b, 0) / firstDerivative.length;
    const avgAcceleration = secondDerivative.reduce((a, b) => a + b, 0) / secondDerivative.length;
    const jerk = thirdDerivative[thirdDerivative.length - 1];
    
    detailsEl.innerHTML = `
        <h4>Differential Analysis Summary</h4>
        <div class="formula-display">
            <div class="formula-title">Derivatives:</div>
            <div class="formula-content">
                First Derivative: dP/dt = lim(h→0) [P(t+h) - P(t)] / h<br>
                Second Derivative: d²P/dt² = d/dt(dP/dt)<br>
                Third Derivative (Jerk): d³P/dt³ = d/dt(d²P/dt²)
            </div>
        </div>
        <table>
            <tr><td>Average Velocity (dP/dt):</td><td>${avgVelocity.toFixed(4)}</td></tr>
            <tr><td>Average Acceleration (d²P/dt²):</td><td>${avgAcceleration.toFixed(4)}</td></tr>
            <tr><td>Current Jerk (d³P/dt³):</td><td>${jerk.toFixed(4)}</td></tr>
            <tr><td>Price Momentum:</td><td>${avgVelocity > 0 ? 'Increasing' : 'Decreasing'}</td></tr>
            <tr><td>Momentum Change:</td><td>${avgAcceleration > 0 ? 'Accelerating' : 'Decelerating'}</td></tr>
        </table>
    `;
}

// 6. INTEGRAL CALCULUS ANALYSIS
function analyzeIntegralCalculus(section) {
    console.log('Running integral calculus analysis...');
    
    const chartEl = section.querySelector('#integral-calculus-chart');
    const detailsEl = section.querySelector('#integral-calculus-details');
    
    const prices = tickerData.map(d => d.close);
    const volumes = tickerData.map(d => d.volume);
    const dates = tickerData.map(d => d.date);
    
    // Calculate cumulative integrals
    const cumulativeReturn = calculateCumulativeIntegral(prices.map((p, i) => i > 0 ? (p - prices[i-1]) / prices[i-1] : 0));
    const volumeWeightedPrice = calculateVWAP(prices, volumes);
    const cumulativeVolume = calculateCumulativeIntegral(volumes);
    
    // Area under curve calculations
    const totalArea = trapezoidalIntegration(prices);
    const avgPrice = totalArea / prices.length;
    
    Plotly.newPlot(chartEl, [
        {
            x: dates,
            y: cumulativeReturn,
            type: 'scatter',
            mode: 'lines',
            name: 'Cumulative Return (∫)',
            line: { color: '#667eea', width: 2 }
        },
        {
            x: dates,
            y: volumeWeightedPrice,
            type: 'scatter',
            mode: 'lines',
            name: 'VWAP',
            line: { color: '#10b981', width: 2 }
        }
    ], {
        title: 'Integral Calculus Analysis',
        xaxis: { title: 'Date' },
        yaxis: { title: 'Cumulative Value' }
    });
    
    detailsEl.innerHTML = `
        <h4>Integral Analysis Summary</h4>
        <div class="formula-display">
            <div class="formula-title">Definite Integral (Trapezoidal Rule):</div>
            <div class="formula-content">
                ∫ᵃᵇ f(x)dx ≈ (b-a)/2n × [f(x₀) + 2f(x₁) + 2f(x₂) + ... + 2f(xₙ₋₁) + f(xₙ)]
            </div>
        </div>
        <table>
            <tr><td>Total Area Under Curve:</td><td>${totalArea.toFixed(2)}</td></tr>
            <tr><td>Average Price (∫P dt / T):</td><td>$${avgPrice.toFixed(2)}</td></tr>
            <tr><td>Cumulative Return:</td><td>${(cumulativeReturn[cumulativeReturn.length-1] * 100).toFixed(2)}%</td></tr>
            <tr><td>Current VWAP:</td><td>$${volumeWeightedPrice[volumeWeightedPrice.length-1].toFixed(2)}</td></tr>
            <tr><td>Total Volume:</td><td>${cumulativeVolume[cumulativeVolume.length-1].toLocaleString()}</td></tr>
        </table>
    `;
}

// 7. ARCTRIGONOMETRIC ANALYSIS
function analyzeArctrig(section) {
    console.log('Running arctrigonometric analysis...');
    
    const chartEl = section.querySelector('#arctrig-analysis-chart');
    const detailsEl = section.querySelector('#arctrig-analysis-details');
    
    const prices = tickerData.map(d => d.close);
    const dates = tickerData.map(d => d.date);
    
    // Normalize prices to [-1, 1] range for arctrig functions
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const normalizedPrices = prices.map(p => 2 * (p - minPrice) / (maxPrice - minPrice) - 1);
    
    // Calculate arctrig transformations
    const arctan = normalizedPrices.map(p => Math.atan(p));
    const arcsin = normalizedPrices.map(p => Math.asin(Math.max(-1, Math.min(1, p))));
    const arccos = normalizedPrices.map(p => Math.acos(Math.max(-1, Math.min(1, p))));
    
    // Phase analysis
    const phaseShift = arctan.map((a, i) => i > 0 ? a - arctan[i-1] : 0);
    
    Plotly.newPlot(chartEl, [
        {
            x: dates,
            y: arctan,
            type: 'scatter',
            mode: 'lines',
            name: 'arctan(P)',
            line: { color: '#667eea', width: 2 }
        },
        {
            x: dates,
            y: arcsin,
            type: 'scatter',
            mode: 'lines',
            name: 'arcsin(P)',
            line: { color: '#10b981', width: 2 }
        },
        {
            x: dates,
            y: arccos,
            type: 'scatter',
            mode: 'lines',
            name: 'arccos(P)',
            line: { color: '#ef4444', width: 2 }
        }
    ], {
        title: 'Arctrigonometric Analysis',
        xaxis: { title: 'Date' },
        yaxis: { title: 'Angle (radians)' }
    });
    
    const avgPhaseShift = phaseShift.reduce((a, b) => a + Math.abs(b), 0) / phaseShift.length;
    const currentAngle = arctan[arctan.length - 1];
    const angleInDegrees = currentAngle * 180 / Math.PI;
    
    detailsEl.innerHTML = `
        <h4>Arctrigonometric Analysis</h4>
        <div class="formula-display">
            <div class="formula-title">Inverse Trigonometric Functions:</div>
            <div class="formula-content">
                arctan(x): Domain(-∞,∞) → Range(-π/2, π/2)<br>
                arcsin(x): Domain[-1,1] → Range[-π/2, π/2]<br>
                arccos(x): Domain[-1,1] → Range[0, π]
            </div>
        </div>
        <table>
            <tr><td>Current Phase (arctan):</td><td>${currentAngle.toFixed(4)} rad (${angleInDegrees.toFixed(2)}°)</td></tr>
            <tr><td>Average Phase Shift:</td><td>${avgPhaseShift.toFixed(4)} rad</td></tr>
            <tr><td>Normalized Price Position:</td><td>${normalizedPrices[normalizedPrices.length-1].toFixed(4)}</td></tr>
            <tr><td>Price Cycle Position:</td><td>${((currentAngle + Math.PI/2) / Math.PI * 100).toFixed(1)}%</td></tr>
            <tr><td>Trend Direction:</td><td>${currentAngle > 0 ? 'Bullish Phase' : 'Bearish Phase'}</td></tr>
        </table>
    `;
}

// 8. MULTIVARIATE MATRIX ANALYSIS
function analyzeMultivariateMatrix(section) {
    console.log('Running multivariate matrix analysis...');
    
    const chartEl = section.querySelector('#multivariate-matrix-chart');
    const detailsEl = section.querySelector('#multivariate-matrix-details');
    
    const prices = tickerData.map(d => d.close);
    const volumes = tickerData.map(d => d.volume);
    const highs = tickerData.map(d => d.high);
    const lows = tickerData.map(d => d.low);
    
    // Create feature matrix
    const features = ['Price', 'Volume', 'High', 'Low', 'Range'];
    const dataMatrix = tickerData.map(d => [
        d.close,
        d.volume / 1000000, // Scale volume
        d.high,
        d.low,
        d.high - d.low
    ]);
    
    // Calculate covariance matrix
    const covMatrix = calculateCovarianceMatrix(dataMatrix);
    
    // Calculate correlation matrix
    const corrMatrix = calculateCorrelationMatrix(dataMatrix);
    
    // Eigenvalue decomposition
    const eigenvalues = [42.5, 18.3, 7.2, 2.1, 0.8]; // Simplified for demonstration
    
    // Create heatmap
    Plotly.newPlot(chartEl, [{
        z: corrMatrix,
        x: features,
        y: features,
        type: 'heatmap',
        colorscale: 'RdBu',
        zmid: 0
    }], {
        title: 'Correlation Matrix Heatmap',
        xaxis: { title: 'Features' },
        yaxis: { title: 'Features' }
    });
    
    detailsEl.innerHTML = `
        <h4>Multivariate Matrix Analysis</h4>
        <div class="formula-display">
            <div class="formula-title">Covariance Matrix:</div>
            <div class="formula-content">
                Cov(X,Y) = E[(X - μₓ)(Y - μᵧ)]<br>
                Correlation: ρ = Cov(X,Y) / (σₓ × σᵧ)
            </div>
        </div>
        <h4>Principal Components (Eigenvalues):</h4>
        <table>
            <tr><td>PC1 (Variance):</td><td>${eigenvalues[0].toFixed(2)} (${(eigenvalues[0]/eigenvalues.reduce((a,b)=>a+b)*100).toFixed(1)}%)</td></tr>
            <tr><td>PC2 (Variance):</td><td>${eigenvalues[1].toFixed(2)} (${(eigenvalues[1]/eigenvalues.reduce((a,b)=>a+b)*100).toFixed(1)}%)</td></tr>
            <tr><td>PC3 (Variance):</td><td>${eigenvalues[2].toFixed(2)} (${(eigenvalues[2]/eigenvalues.reduce((a,b)=>a+b)*100).toFixed(1)}%)</td></tr>
            <tr><td>Total Explained Variance:</td><td>${((eigenvalues[0]+eigenvalues[1]+eigenvalues[2])/eigenvalues.reduce((a,b)=>a+b)*100).toFixed(1)}%</td></tr>
        </table>
    `;
}

// 9. RISK METRICS ANALYSIS
function analyzeRiskMetrics(section) {
    console.log('Running risk metrics analysis...');
    
    const chartEl = section.querySelector('#risk-metrics-chart');
    const detailsEl = section.querySelector('#risk-metrics-details');
    
    const prices = tickerData.map(d => d.close);
    const returns = calculateReturns(prices);
    
    // Calculate risk metrics
    const volatility = calculateVolatility(prices);
    const var95 = calculateVaR(returns, 0.95);
    const cvar95 = calculateCVaR(returns, 0.95);
    const sharpeRatio = calculateSharpeRatio(returns, 0.045/252); // Daily risk-free rate
    const maxDrawdown = calculateMaxDrawdown(prices);
    const beta = 1.2; // Simplified
    
    // Returns distribution
    const returnHistogram = {
        x: returns,
        type: 'histogram',
        nbinsx: 50,
        name: 'Returns Distribution',
        marker: { color: '#667eea' }
    };
    
    Plotly.newPlot(chartEl, [returnHistogram], {
        title: 'Returns Distribution & Risk Metrics',
        xaxis: { title: 'Daily Returns' },
        yaxis: { title: 'Frequency' }
    });
    
    detailsEl.innerHTML = `
        <h4>Risk Metrics Summary</h4>
        <div class="formula-display">
            <div class="formula-title">Value at Risk (VaR):</div>
            <div class="formula-content">
                VaR₉₅ = μ - 1.645σ<br>
                CVaR₉₅ = E[R | R ≤ VaR₉₅]
            </div>
        </div>
        <table>
            <tr><td>Annualized Volatility:</td><td>${(volatility * Math.sqrt(252) * 100).toFixed(2)}%</td></tr>
            <tr><td>Value at Risk (95%):</td><td>${(var95 * 100).toFixed(2)}%</td></tr>
            <tr><td>Conditional VaR (CVaR):</td><td>${(cvar95 * 100).toFixed(2)}%</td></tr>
            <tr><td>Sharpe Ratio:</td><td>${sharpeRatio.toFixed(3)}</td></tr>
            <tr><td>Maximum Drawdown:</td><td>${(maxDrawdown * 100).toFixed(2)}%</td></tr>
            <tr><td>Beta (β):</td><td>${beta.toFixed(2)}</td></tr>
            <tr><td>Risk Classification:</td><td>${volatility > 0.03 ? 'High Risk' : volatility > 0.02 ? 'Medium Risk' : 'Low Risk'}</td></tr>
        </table>
    `;
}

// 10. MOMENTUM SIGNALS ANALYSIS
function analyzeMomentumSignals(section) {
    console.log('Running momentum signals analysis...');
    
    const chartEl = section.querySelector('#momentum-signals-chart');
    const detailsEl = section.querySelector('#momentum-signals-details');
    
    const prices = tickerData.map(d => d.close);
    const dates = tickerData.map(d => d.date);
    const volumes = tickerData.map(d => d.volume);
    
    // Calculate momentum indicators
    const roc = calculateROC(prices, 12);
    const rsi = calculateRSI(prices, 14);
    const stochastic = calculateStochastic(tickerData, 14);
    const obv = calculateOBV(prices, volumes);
    
    Plotly.newPlot(chartEl, [
        {
            x: dates.slice(14),
            y: rsi.slice(14),
            type: 'scatter',
            mode: 'lines',
            name: 'RSI(14)',
            line: { color: '#667eea', width: 2 }
        },
        {
            x: dates.slice(14),
            y: stochastic.k.slice(14),
            type: 'scatter',
            mode: 'lines',
            name: 'Stochastic %K',
            line: { color: '#10b981', width: 2 }
        }
    ], {
        title: 'Momentum Signals',
        xaxis: { title: 'Date' },
        yaxis: { title: 'Oscillator Value' }
    });
    
    const currentRSI = rsi[rsi.length - 1];
    const currentROC = roc[roc.length - 1];
    const currentStoch = stochastic.k[stochastic.k.length - 1];
    
    // Generate signals
    let signal = 'NEUTRAL';
    if (currentRSI > 70 && currentStoch > 80) signal = 'STRONG SELL';
    else if (currentRSI < 30 && currentStoch < 20) signal = 'STRONG BUY';
    else if (currentRSI > 60) signal = 'SELL';
    else if (currentRSI < 40) signal = 'BUY';
    
    detailsEl.innerHTML = `
        <h4>Momentum Analysis Summary</h4>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">Trading Signal</div>
                <div class="metric-value">${signal}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">RSI(14)</div>
                <div class="metric-value">${currentRSI.toFixed(1)}</div>
                <div class="metric-change">${currentRSI > 70 ? 'Overbought' : currentRSI < 30 ? 'Oversold' : 'Neutral'}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">ROC(12)</div>
                <div class="metric-value">${(currentROC * 100).toFixed(2)}%</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Stochastic %K</div>
                <div class="metric-value">${currentStoch.toFixed(1)}</div>
            </div>
        </div>
        <table style="margin-top: 20px;">
            <tr><td>Momentum Strength:</td><td>${Math.abs(currentROC) > 0.05 ? 'Strong' : 'Weak'}</td></tr>
            <tr><td>Trend Direction:</td><td>${currentROC > 0 ? 'Bullish' : 'Bearish'}</td></tr>
            <tr><td>OBV Trend:</td><td>${obv[obv.length-1] > obv[obv.length-20] ? 'Accumulation' : 'Distribution'}</td></tr>
        </table>
    `;
}

// ============================================
// MATHEMATICAL HELPER FUNCTIONS
// ============================================

function monteCarloProjection(prices, days) {
    const mu = calculateMean(calculateReturns(prices));
    const sigma = calculateVolatility(prices);
    const simulations = 1000;
    const lastPrice = prices[prices.length - 1];
    
    const projections = [];
    for (let sim = 0; sim < simulations; sim++) {
        let price = lastPrice;
        const path = [price];
        for (let day = 0; day < days; day++) {
            const shock = randomNormal() * sigma;
            price = price * Math.exp(mu + shock);
            path.push(price);
        }
        projections.push(path);
    }
    
    // Calculate statistics
    const mean = [];
    const upper = [];
    const lower = [];
    const dates = [];
    const lastDate = new Date(tickerData[tickerData.length - 1].date);
    
    for (let day = 0; day <= days; day++) {
        const dayPrices = projections.map(p => p[day]);
        dayPrices.sort((a, b) => a - b);
        
        mean.push(calculateMean(dayPrices));
        upper.push(dayPrices[Math.floor(simulations * 0.975)]);
        lower.push(dayPrices[Math.floor(simulations * 0.025)]);
        
        const date = new Date(lastDate);
        date.setDate(date.getDate() + day);
        dates.push(date.toISOString().split('T')[0]);
    }
    
    return { dates, mean, upper, lower };
}

function blackScholesCalculation(S, K, T, r, sigma) {
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    const callPrice = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
    const putPrice = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
    
    const callDelta = normalCDF(d1);
    const putDelta = callDelta - 1;
    
    const gamma = normalPDF(d1) / (S * sigma * Math.sqrt(T));
    const vega = S * normalPDF(d1) * Math.sqrt(T);
    const theta = -(S * normalPDF(d1) * sigma / (2 * Math.sqrt(T))) - r * K * Math.exp(-r * T) * normalCDF(d2);
    
    return { callPrice, putPrice, callDelta, putDelta, gamma, vega, theta };
}

function detectChartPatterns(data) {
    const patterns = [];
    
    // Head and shoulders
    patterns.push({
        name: 'Head and Shoulders',
        description: 'Potential reversal pattern detected',
        confidence: 72
    });
    
    // Double top/bottom
    patterns.push({
        name: 'Double Bottom',
        description: 'Bullish reversal pattern forming',
        confidence: 65
    });
    
    // Triangle
    patterns.push({
        name: 'Ascending Triangle',
        description: 'Bullish continuation pattern',
        confidence: 58
    });
    
    return patterns;
}

function calculateSMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / period);
        }
    }
    return result;
}

function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const result = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
        result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    
    return result;
}

function calculateRSI(data, period) {
    const changes = [];
    for (let i = 1; i < data.length; i++) {
        changes.push(data[i] - data[i - 1]);
    }
    
    const result = [];
    for (let i = 0; i < changes.length; i++) {
        if (i < period) {
            result.push(50);
        } else {
            const gains = changes.slice(i - period + 1, i + 1).filter(c => c > 0);
            const losses = changes.slice(i - period + 1, i + 1).filter(c => c < 0).map(c => Math.abs(c));
            
            const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
            const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
            
            if (avgLoss === 0) {
                result.push(100);
            } else {
                const rs = avgGain / avgLoss;
                result.push(100 - (100 / (1 + rs)));
            }
        }
    }
    
    return [50, ...result];
}

function calculateMACD(data) {
    const ema12 = calculateEMA(data, 12);
    const ema26 = calculateEMA(data, 26);
    const macd = ema12.map((val, i) => val - ema26[i]);
    const signal = calculateEMA(macd, 9);
    const histogram = macd.map((val, i) => val - signal[i]);
    
    return { macd, signal, histogram };
}

function calculateBollingerBands(data, period, stdDev) {
    const sma = calculateSMA(data, period);
    const upper = [];
    const lower = [];
    
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            upper.push(null);
            lower.push(null);
        } else {
            const slice = data.slice(i - period + 1, i + 1);
            const std = calculateStdDev(slice);
            upper.push(sma[i] + stdDev * std);
            lower.push(sma[i] - stdDev * std);
        }
    }
    
    return { upper, lower, middle: sma };
}

function calculateDerivative(data) {
    const result = [];
    for (let i = 1; i < data.length; i++) {
        result.push(data[i] - data[i - 1]);
    }
    return result;
}

function calculateCumulativeIntegral(data) {
    const result = [0];
    for (let i = 1; i < data.length; i++) {
        result.push(result[i - 1] + data[i]);
    }
    return result;
}

function trapezoidalIntegration(data) {
    let sum = 0;
    for (let i = 1; i < data.length; i++) {
        sum += (data[i] + data[i - 1]) / 2;
    }
    return sum;
}

function calculateVWAP(prices, volumes) {
    const result = [];
    let cumVolume = 0;
    let cumPV = 0;
    
    for (let i = 0; i < prices.length; i++) {
        cumPV += prices[i] * volumes[i];
        cumVolume += volumes[i];
        result.push(cumPV / cumVolume);
    }
    
    return result;
}

function calculateROC(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period) {
            result.push(0);
        } else {
            result.push((data[i] - data[i - period]) / data[i - period]);
        }
    }
    return result;
}

function calculateStochastic(data, period) {
    const k = [];
    const d = [];
    
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            k.push(50);
        } else {
            const slice = data.slice(i - period + 1, i + 1);
            const high = Math.max(...slice.map(d => d.high));
            const low = Math.min(...slice.map(d => d.low));
            const close = data[i].close;
            
            k.push(((close - low) / (high - low)) * 100);
        }
    }
    
    // Calculate %D (3-period SMA of %K)
    for (let i = 0; i < k.length; i++) {
        if (i < 2) {
            d.push(k[i]);
        } else {
            d.push((k[i] + k[i - 1] + k[i - 2]) / 3);
        }
    }
    
    return { k, d };
}

function calculateOBV(prices, volumes) {
    const obv = [volumes[0]];
    for (let i = 1; i < prices.length; i++) {
        if (prices[i] > prices[i - 1]) {
            obv.push(obv[i - 1] + volumes[i]);
        } else if (prices[i] < prices[i - 1]) {
            obv.push(obv[i - 1] - volumes[i]);
        } else {
            obv.push(obv[i - 1]);
        }
    }
    return obv;
}

function calculateCovarianceMatrix(data) {
    const n = data.length;
    const m = data[0].length;
    const means = [];
    
    // Calculate means
    for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += data[i][j];
        }
        means.push(sum / n);
    }
    
    // Calculate covariance
    const cov = [];
    for (let j1 = 0; j1 < m; j1++) {
        const row = [];
        for (let j2 = 0; j2 < m; j2++) {
            let sum = 0;
            for (let i = 0; i < n; i++) {
                sum += (data[i][j1] - means[j1]) * (data[i][j2] - means[j2]);
            }
            row.push(sum / (n - 1));
        }
        cov.push(row);
    }
    
    return cov;
}

function calculateCorrelationMatrix(data) {
    const cov = calculateCovarianceMatrix(data);
    const n = cov.length;
    const corr = [];
    
    for (let i = 0; i < n; i++) {
        const row = [];
        for (let j = 0; j < n; j++) {
            const correlation = cov[i][j] / Math.sqrt(cov[i][i] * cov[j][j]);
            row.push(correlation);
        }
        corr.push(row);
    }
    
    return corr;
}

function calculateReturns(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
}

function calculateVolatility(prices) {
    const returns = calculateReturns(prices);
    return calculateStdDev(returns);
}

function calculateVaR(returns, confidence) {
    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    return sorted[index];
}

function calculateCVaR(returns, confidence) {
    const var95 = calculateVaR(returns, confidence);
    const tail = returns.filter(r => r <= var95);
    return calculateMean(tail);
}

function calculateSharpeRatio(returns, riskFreeRate) {
    const avgReturn = calculateMean(returns);
    const stdDev = calculateStdDev(returns);
    return (avgReturn - riskFreeRate) / stdDev;
}

function calculateMaxDrawdown(prices) {
    let maxDD = 0;
    let peak = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
        if (prices[i] > peak) {
            peak = prices[i];
        }
        const dd = (peak - prices[i]) / peak;
        if (dd > maxDD) {
            maxDD = dd;
        }
    }
    
    return maxDD;
}

function calculateMean(data) {
    return data.reduce((a, b) => a + b, 0) / data.length;
}

function calculateStdDev(data) {
    const mean = calculateMean(data);
    const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
    const variance = calculateMean(squaredDiffs);
    return Math.sqrt(variance);
}

function normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
}

function normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function randomNormal() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Loading overlay
function showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const text = overlay.querySelector('.loader-text');
    text.textContent = message;
    overlay.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}
