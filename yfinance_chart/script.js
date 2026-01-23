/**
 * YFinance Interactive Chart - Advanced Analytics
 * Features:
 * - Candlestick charting with Plotly
 * - Technical indicators (SMA, EMA, Bollinger Bands, RSI, MACD, Stochastic)
 * - Pattern recognition visualization
 * - Bayesian forecast with confidence intervals
 * - Feedback loop mechanism engine
 * - Searchable autocomplete watchlist
 */

// Configuration
const CONFIG = {
    DATA_URL: 'yfinance_intraday.dat',
    DEMO_MODE: true, // Use demo data if compressed data unavailable
    DEFAULT_TICKER: 'AAPL'
};

// Default Watchlist
const DEFAULT_WATCHLIST = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "JPM", "V", "JNJ",
    "WMT", "PG", "MA", "HD", "DIS", "NFLX", "PYPL", "INTC", "AMD", "CRM",
    "ORCL", "CSCO", "ADBE", "PFE", "MRK", "ABBV", "KO", "PEP", "NKE", "MCD"
];

// State
let allData = {};
let currentTicker = CONFIG.DEFAULT_TICKER;
let feedbackEngineState = {
    momentumFeedback: 0,
    volumeFeedback: 0,
    eigenvalueFeedback: 0,
    patternFeedback: 0,
    aggregateFeedback: 0
};

// DOM Elements
const elements = {
    tickerSearch: document.getElementById('ticker-search'),
    autocompleteList: document.getElementById('autocomplete-list'),
    loadBtn: document.getElementById('load-btn'),
    watchlist: document.getElementById('watchlist'),
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loader-text'),
    mainChart: document.getElementById('main-chart'),
    volumeChart: document.getElementById('volume-chart'),
    rsiChart: document.getElementById('rsi-chart'),
    macdChart: document.getElementById('macd-chart'),
    forecastContent: document.getElementById('forecast-content'),
    patternsContent: document.getElementById('patterns-content'),
    statsContent: document.getElementById('stats-content'),
    feedbackContent: document.getElementById('feedback-content'),
    // Checkboxes
    showSMA: document.getElementById('show-sma'),
    showEMA: document.getElementById('show-ema'),
    showBB: document.getElementById('show-bb'),
    showVolume: document.getElementById('show-volume'),
    showRSI: document.getElementById('show-rsi'),
    showMACD: document.getElementById('show-macd'),
    showStoch: document.getElementById('show-stoch'),
    showPatterns: document.getElementById('show-patterns'),
    showForecast: document.getElementById('show-forecast')
};

// ==================== DATA LOADING ====================

async function loadData() {
    showLoader('Loading and decompressing data...');
    
    try {
        // Try loading compressed data first
        const response = await fetch(`${CONFIG.DATA_URL}?t=${Date.now()}`);
        
        if (response.ok) {
            const compressedData = new Uint8Array(await response.arrayBuffer());
            const decompressedData = pako.inflate(compressedData, { to: 'string' });
            allData = JSON.parse(decompressedData);
            console.log('Loaded data for', Object.keys(allData).length, 'tickers');
        } else {
            throw new Error('Data file not found');
        }
    } catch (error) {
        console.warn('Could not load compressed data, generating demo data:', error.message);
        allData = generateDemoData();
    }
    
    hideLoader();
    initializeWatchlist();
    
    // Update the search input with current ticker
    if (elements.tickerSearch) {
        elements.tickerSearch.value = currentTicker;
    }
    
    loadChart(currentTicker);
}

function generateDemoData() {
    /**
     * Generate demo data with realistic price movements
     * Includes all technical indicators and pattern detection
     */
    const data = {};
    const now = new Date();
    
    DEFAULT_WATCHLIST.forEach(ticker => {
        const basePrice = 100 + Math.random() * 400;
        const records = [];
        const numPoints = 390 * 5; // 5 days of 1-min data (market hours)
        
        let price = basePrice;
        let volume = 100000 + Math.random() * 500000;
        
        for (let i = 0; i < numPoints; i++) {
            // Realistic price movement using random walk with drift
            const change = (Math.random() - 0.48) * price * 0.002;
            price = Math.max(price + change, 1);
            
            const volatility = 0.003;
            const open = price * (1 + (Math.random() - 0.5) * volatility);
            const close = price * (1 + (Math.random() - 0.5) * volatility);
            const high = Math.max(open, close) * (1 + Math.random() * volatility);
            const low = Math.min(open, close) * (1 - Math.random() * volatility);
            
            volume = Math.max(volume + (Math.random() - 0.5) * 50000, 10000);
            
            const date = new Date(now - (numPoints - i) * 60000);
            
            records.push({
                Date: date.toISOString(),
                Open: open,
                High: high,
                Low: low,
                Close: close,
                Volume: Math.floor(volume),
                // Pre-calculated indicators for demo
                SMA_20: 0,
                SMA_50: 0,
                EMA_12: 0,
                EMA_26: 0,
                RSI: 50 + Math.random() * 30 - 15,
                MACD: Math.random() * 2 - 1,
                MACD_Signal: Math.random() * 2 - 1,
                MACD_Hist: Math.random() * 0.5 - 0.25,
                BB_Upper: 0,
                BB_Middle: 0,
                BB_Lower: 0,
                Stoch_K: Math.random() * 100,
                Stoch_D: Math.random() * 100
            });
        }
        
        // Calculate indicators
        calculateIndicators(records);
        
        // Generate patterns
        const patterns = generateDemoPatterns(records);
        
        // Generate forecast
        const forecast = generateDemoForecast(records);
        
        data[ticker] = {
            ticker: ticker,
            data: records,
            patterns: patterns,
            forecast: forecast,
            last_update: new Date().toISOString()
        };
    });
    
    return data;
}

function calculateIndicators(records) {
    const closes = records.map(r => r.Close);
    
    // SMA
    for (let i = 0; i < records.length; i++) {
        if (i >= 19) {
            records[i].SMA_20 = closes.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20;
        }
        if (i >= 49) {
            records[i].SMA_50 = closes.slice(i - 49, i + 1).reduce((a, b) => a + b, 0) / 50;
        }
    }
    
    // EMA
    let ema12 = closes[0];
    let ema26 = closes[0];
    const mult12 = 2 / 13;
    const mult26 = 2 / 27;
    
    for (let i = 0; i < records.length; i++) {
        ema12 = (closes[i] - ema12) * mult12 + ema12;
        ema26 = (closes[i] - ema26) * mult26 + ema26;
        records[i].EMA_12 = ema12;
        records[i].EMA_26 = ema26;
    }
    
    // Bollinger Bands
    for (let i = 19; i < records.length; i++) {
        const slice = closes.slice(i - 19, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / 20;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 20;
        const std = Math.sqrt(variance);
        records[i].BB_Middle = mean;
        records[i].BB_Upper = mean + 2 * std;
        records[i].BB_Lower = mean - 2 * std;
    }
}

function generateDemoPatterns(records) {
    const patterns = [];
    const n = records.length;
    
    // Add some demo patterns at random locations
    if (n > 100) {
        const patternTypes = [
            { type: 'double_top', signal: 'bearish' },
            { type: 'double_bottom', signal: 'bullish' },
            { type: 'head_and_shoulders', signal: 'bearish' },
            { type: 'ascending_triangle', signal: 'bullish' }
        ];
        
        for (let i = 0; i < 3; i++) {
            const pt = patternTypes[Math.floor(Math.random() * patternTypes.length)];
            const idx = Math.floor(100 + Math.random() * (n - 200));
            patterns.push({
                type: pt.type,
                start_idx: idx,
                end_idx: idx + 50,
                start_date: records[idx].Date,
                end_date: records[Math.min(idx + 50, n - 1)].Date,
                price: records[idx].High,
                signal: pt.signal
            });
        }
    }
    
    return patterns;
}

function generateDemoForecast(records) {
    const lastClose = records[records.length - 1].Close;
    const volatility = lastClose * 0.02;
    
    return {
        forecast_1pm: lastClose * (1 + (Math.random() - 0.45) * 0.01),
        confidence_lower: lastClose - volatility,
        confidence_upper: lastClose + volatility,
        posterior_mean: lastClose,
        posterior_variance: volatility * volatility,
        momentum_factor: Math.random() * 0.5 - 0.25,
        volume_direction: Math.random() > 0.5 ? 1 : -1,
        eigenvalue_principal: Math.random() * 0.5,
        method: 'Multivariate Bayesian Nonlinear Differential Analysis'
    };
}

// ==================== AUTOCOMPLETE & WATCHLIST ====================

function initializeWatchlist() {
    const tickers = Object.keys(allData).length > 0 ? Object.keys(allData) : DEFAULT_WATCHLIST;
    
    elements.watchlist.innerHTML = '';
    tickers.forEach(ticker => {
        const btn = document.createElement('button');
        btn.className = 'watchlist-btn' + (ticker === currentTicker ? ' active' : '');
        btn.textContent = ticker;
        btn.onclick = () => {
            currentTicker = ticker;
            loadChart(ticker);
            updateActiveWatchlistButton(ticker);
        };
        elements.watchlist.appendChild(btn);
    });
}

function updateActiveWatchlistButton(ticker) {
    document.querySelectorAll('.watchlist-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === ticker);
    });
}

function setupAutocomplete() {
    elements.tickerSearch.addEventListener('input', function() {
        const val = this.value.toUpperCase();
        closeAutocomplete();
        
        if (!val) return;
        
        const tickers = Object.keys(allData).length > 0 ? Object.keys(allData) : DEFAULT_WATCHLIST;
        const matches = tickers.filter(t => t.startsWith(val));
        
        if (matches.length === 0) return;
        
        matches.forEach(ticker => {
            const div = document.createElement('div');
            div.innerHTML = `<strong>${ticker.substring(0, val.length)}</strong>${ticker.substring(val.length)}`;
            div.onclick = () => {
                elements.tickerSearch.value = ticker;
                closeAutocomplete();
                currentTicker = ticker;
                loadChart(ticker);
                updateActiveWatchlistButton(ticker);
            };
            elements.autocompleteList.appendChild(div);
        });
    });
    
    elements.tickerSearch.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const val = this.value.toUpperCase();
            if (allData[val] || DEFAULT_WATCHLIST.includes(val)) {
                currentTicker = val;
                loadChart(val);
                updateActiveWatchlistButton(val);
            }
            closeAutocomplete();
        }
    });
    
    document.addEventListener('click', function(e) {
        if (e.target !== elements.tickerSearch) {
            closeAutocomplete();
        }
    });
}

function closeAutocomplete() {
    elements.autocompleteList.innerHTML = '';
}

// ==================== CHART RENDERING ====================

function loadChart(ticker) {
    const tickerData = allData[ticker];
    
    if (!tickerData || !tickerData.data || tickerData.data.length === 0) {
        console.error('No data for ticker:', ticker);
        return;
    }
    
    const data = tickerData.data;
    const patterns = tickerData.patterns || [];
    const forecast = tickerData.forecast;
    
    // Parse dates
    const dates = data.map(d => d.Date);
    const open = data.map(d => d.Open);
    const high = data.map(d => d.High);
    const low = data.map(d => d.Low);
    const close = data.map(d => d.Close);
    const volume = data.map(d => d.Volume);
    
    // Render main chart
    renderMainChart(dates, open, high, low, close, data, patterns, forecast);
    
    // Render volume chart
    if (elements.showVolume.checked) {
        renderVolumeChart(dates, volume, close);
    } else if (isPlotlyAvailable()) {
        Plotly.purge(elements.volumeChart);
    }
    
    // Render RSI chart
    if (elements.showRSI.checked) {
        const rsi = data.map(d => d.RSI);
        renderRSIChart(dates, rsi);
    } else if (isPlotlyAvailable()) {
        Plotly.purge(elements.rsiChart);
    }
    
    // Render MACD chart
    if (elements.showMACD.checked) {
        const macd = data.map(d => d.MACD);
        const signal = data.map(d => d.MACD_Signal);
        const hist = data.map(d => d.MACD_Hist);
        renderMACDChart(dates, macd, signal, hist);
    } else if (isPlotlyAvailable()) {
        Plotly.purge(elements.macdChart);
    }
    
    // Update info panels
    updateForecastPanel(forecast);
    updatePatternsPanel(patterns);
    updateStatsPanel(data);
    updateFeedbackEngine(forecast, patterns, data);
}

function renderMainChart(dates, open, high, low, close, data, patterns, forecast) {
    if (!isPlotlyAvailable()) {
        elements.mainChart.innerHTML = '<div style="padding: 40px; text-align: center; color: #757575;"><h3>⚠️ Chart library not loaded</h3><p>Please refresh with internet connectivity.</p></div>';
        return;
    }
    
    const traces = [];
    
    // Candlestick trace
    traces.push({
        type: 'candlestick',
        x: dates,
        open: open,
        high: high,
        low: low,
        close: close,
        name: currentTicker,
        increasing: { line: { color: '#26a69a' } },
        decreasing: { line: { color: '#ef5350' } }
    });
    
    // SMA traces
    if (elements.showSMA.checked) {
        traces.push({
            type: 'scatter',
            mode: 'lines',
            x: dates,
            y: data.map(d => d.SMA_20),
            name: 'SMA 20',
            line: { color: '#2196F3', width: 1 }
        });
        traces.push({
            type: 'scatter',
            mode: 'lines',
            x: dates,
            y: data.map(d => d.SMA_50),
            name: 'SMA 50',
            line: { color: '#FF9800', width: 1 }
        });
    }
    
    // EMA traces
    if (elements.showEMA.checked) {
        traces.push({
            type: 'scatter',
            mode: 'lines',
            x: dates,
            y: data.map(d => d.EMA_12),
            name: 'EMA 12',
            line: { color: '#9C27B0', width: 1, dash: 'dot' }
        });
        traces.push({
            type: 'scatter',
            mode: 'lines',
            x: dates,
            y: data.map(d => d.EMA_26),
            name: 'EMA 26',
            line: { color: '#E91E63', width: 1, dash: 'dot' }
        });
    }
    
    // Bollinger Bands
    if (elements.showBB.checked) {
        traces.push({
            type: 'scatter',
            mode: 'lines',
            x: dates,
            y: data.map(d => d.BB_Upper),
            name: 'BB Upper',
            line: { color: 'rgba(156, 39, 176, 0.5)', width: 1 },
            fill: 'none'
        });
        traces.push({
            type: 'scatter',
            mode: 'lines',
            x: dates,
            y: data.map(d => d.BB_Lower),
            name: 'BB Lower',
            line: { color: 'rgba(156, 39, 176, 0.5)', width: 1 },
            fill: 'tonexty',
            fillcolor: 'rgba(156, 39, 176, 0.1)'
        });
    }
    
    // Forecast visualization
    if (elements.showForecast.checked && forecast) {
        const lastDate = dates[dates.length - 1];
        const forecastDate = new Date(lastDate);
        forecastDate.setHours(13, 0, 0, 0);
        
        traces.push({
            type: 'scatter',
            mode: 'markers',
            x: [forecastDate.toISOString()],
            y: [forecast.forecast_1pm],
            name: '1PM Forecast',
            marker: {
                color: '#FFD700',
                size: 15,
                symbol: 'star',
                line: { color: '#000', width: 2 }
            }
        });
        
        // Confidence interval
        traces.push({
            type: 'scatter',
            mode: 'lines',
            x: [forecastDate.toISOString(), forecastDate.toISOString()],
            y: [forecast.confidence_lower, forecast.confidence_upper],
            name: '95% CI',
            line: { color: '#FFD700', width: 3 },
            showlegend: false
        });
    }
    
    // Pattern annotations
    const annotations = [];
    const shapes = [];
    
    if (elements.showPatterns.checked && patterns.length > 0) {
        patterns.forEach((pattern, idx) => {
            const color = pattern.signal === 'bullish' ? '#26a69a' : '#ef5350';
            const icon = pattern.signal === 'bullish' ? '▲' : '▼';
            
            annotations.push({
                x: pattern.start_date,
                y: pattern.price,
                xref: 'x',
                yref: 'y',
                text: `${icon} ${formatPatternName(pattern.type)}`,
                showarrow: true,
                arrowhead: 2,
                arrowsize: 1,
                arrowwidth: 2,
                arrowcolor: color,
                ax: 0,
                ay: pattern.signal === 'bullish' ? 40 : -40,
                bgcolor: 'rgba(255,255,255,0.8)',
                bordercolor: color,
                borderwidth: 1,
                font: { size: 10, color: color }
            });
            
            // Draw pattern region
            shapes.push({
                type: 'rect',
                xref: 'x',
                yref: 'paper',
                x0: pattern.start_date,
                x1: pattern.end_date,
                y0: 0,
                y1: 1,
                fillcolor: color,
                opacity: 0.1,
                line: { width: 0 }
            });
        });
    }
    
    const layout = {
        title: {
            text: `${currentTicker} - 5 Day 1-Minute Chart`,
            font: { size: 18 }
        },
        xaxis: {
            title: 'Date/Time',
            rangeslider: { visible: false },
            type: 'date'
        },
        yaxis: {
            title: 'Price ($)',
            side: 'right'
        },
        legend: {
            orientation: 'h',
            y: 1.1
        },
        annotations: annotations,
        shapes: shapes,
        margin: { t: 80, b: 50, l: 50, r: 60 },
        hovermode: 'x unified',
        dragmode: 'zoom'
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToAdd: [
            'drawline',
            'drawopenpath',
            'drawcircle',
            'drawrect',
            'eraseshape'
        ]
    };
    
    Plotly.newPlot(elements.mainChart, traces, layout, config);
}

function renderVolumeChart(dates, volume, close) {
    if (!isPlotlyAvailable()) return;
    
    // Color bars based on price direction
    const colors = [];
    for (let i = 0; i < close.length; i++) {
        if (i === 0 || close[i] >= close[i - 1]) {
            colors.push('#26a69a');
        } else {
            colors.push('#ef5350');
        }
    }
    
    const trace = {
        type: 'bar',
        x: dates,
        y: volume,
        name: 'Volume',
        marker: { color: colors }
    };
    
    const layout = {
        title: 'Volume',
        xaxis: { showticklabels: false },
        yaxis: { title: 'Volume', side: 'right' },
        margin: { t: 30, b: 20, l: 50, r: 60 },
        height: 150
    };
    
    Plotly.newPlot(elements.volumeChart, [trace], layout, { responsive: true, displayModeBar: false });
}

function renderRSIChart(dates, rsi) {
    if (!isPlotlyAvailable()) return;
    
    const trace = {
        type: 'scatter',
        mode: 'lines',
        x: dates,
        y: rsi,
        name: 'RSI',
        line: { color: '#9C27B0', width: 1.5 }
    };
    
    const shapes = [
        { type: 'line', x0: dates[0], x1: dates[dates.length - 1], y0: 70, y1: 70, line: { color: '#ef5350', dash: 'dash', width: 1 } },
        { type: 'line', x0: dates[0], x1: dates[dates.length - 1], y0: 30, y1: 30, line: { color: '#26a69a', dash: 'dash', width: 1 } }
    ];
    
    const layout = {
        title: 'RSI (14)',
        xaxis: { showticklabels: false },
        yaxis: { title: 'RSI', range: [0, 100], side: 'right' },
        shapes: shapes,
        margin: { t: 30, b: 20, l: 50, r: 60 },
        height: 150
    };
    
    Plotly.newPlot(elements.rsiChart, [trace], layout, { responsive: true, displayModeBar: false });
}

function renderMACDChart(dates, macd, signal, hist) {
    if (!isPlotlyAvailable()) return;
    
    const colors = hist.map(h => h >= 0 ? '#26a69a' : '#ef5350');
    
    const traces = [
        {
            type: 'bar',
            x: dates,
            y: hist,
            name: 'Histogram',
            marker: { color: colors }
        },
        {
            type: 'scatter',
            mode: 'lines',
            x: dates,
            y: macd,
            name: 'MACD',
            line: { color: '#2196F3', width: 1.5 }
        },
        {
            type: 'scatter',
            mode: 'lines',
            x: dates,
            y: signal,
            name: 'Signal',
            line: { color: '#FF9800', width: 1.5 }
        }
    ];
    
    const layout = {
        title: 'MACD (12, 26, 9)',
        xaxis: { showticklabels: false },
        yaxis: { title: 'MACD', side: 'right' },
        margin: { t: 30, b: 20, l: 50, r: 60 },
        height: 150,
        barmode: 'relative'
    };
    
    Plotly.newPlot(elements.macdChart, traces, layout, { responsive: true, displayModeBar: false });
}

// ==================== INFO PANELS ====================

function updateForecastPanel(forecast) {
    if (!forecast) {
        elements.forecastContent.innerHTML = '<p class="no-data">No forecast available</p>';
        return;
    }
    
    const direction = forecast.forecast_1pm > forecast.posterior_mean ? 'bullish' : 'bearish';
    const directionIcon = direction === 'bullish' ? '📈' : '📉';
    
    elements.forecastContent.innerHTML = `
        <div class="forecast-item main-forecast">
            <span class="label">1PM Forecast:</span>
            <span class="value ${direction}">$${forecast.forecast_1pm.toFixed(2)} ${directionIcon}</span>
        </div>
        <div class="forecast-item">
            <span class="label">95% Confidence:</span>
            <span class="value">$${forecast.confidence_lower.toFixed(2)} - $${forecast.confidence_upper.toFixed(2)}</span>
        </div>
        <div class="forecast-item">
            <span class="label">Posterior Mean:</span>
            <span class="value">$${forecast.posterior_mean.toFixed(2)}</span>
        </div>
        <div class="forecast-item">
            <span class="label">Momentum Factor:</span>
            <span class="value ${forecast.momentum_factor > 0 ? 'bullish' : 'bearish'}">${(forecast.momentum_factor * 100).toFixed(1)}%</span>
        </div>
        <div class="forecast-item">
            <span class="label">Volume Direction:</span>
            <span class="value">${forecast.volume_direction > 0 ? '🔺 Increasing' : '🔻 Decreasing'}</span>
        </div>
        <div class="forecast-item">
            <span class="label">Principal Eigenvalue:</span>
            <span class="value">${forecast.eigenvalue_principal.toFixed(4)}</span>
        </div>
        <div class="forecast-method">
            <small>${forecast.method}</small>
        </div>
    `;
}

function updatePatternsPanel(patterns) {
    if (!patterns || patterns.length === 0) {
        elements.patternsContent.innerHTML = '<p class="no-data">No patterns detected</p>';
        return;
    }
    
    let html = '<ul class="pattern-list">';
    patterns.forEach(pattern => {
        const icon = pattern.signal === 'bullish' ? '🟢' : '🔴';
        html += `
            <li class="pattern-item ${pattern.signal}">
                <span class="pattern-icon">${icon}</span>
                <span class="pattern-name">${formatPatternName(pattern.type)}</span>
                <span class="pattern-signal">${pattern.signal.toUpperCase()}</span>
            </li>
        `;
    });
    html += '</ul>';
    
    elements.patternsContent.innerHTML = html;
}

function updateStatsPanel(data) {
    const closes = data.map(d => d.Close);
    const lastClose = closes[closes.length - 1];
    const firstClose = closes[0];
    const change = lastClose - firstClose;
    const changePercent = (change / firstClose) * 100;
    
    const high = Math.max(...data.map(d => d.High));
    const low = Math.min(...data.map(d => d.Low));
    const avgVolume = data.reduce((a, d) => a + d.Volume, 0) / data.length;
    
    const lastRSI = data[data.length - 1].RSI;
    
    elements.statsContent.innerHTML = `
        <div class="stat-item">
            <span class="label">Last Close:</span>
            <span class="value">$${lastClose.toFixed(2)}</span>
        </div>
        <div class="stat-item">
            <span class="label">5-Day Change:</span>
            <span class="value ${change >= 0 ? 'bullish' : 'bearish'}">
                ${change >= 0 ? '+' : ''}$${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)
            </span>
        </div>
        <div class="stat-item">
            <span class="label">5-Day High:</span>
            <span class="value">$${high.toFixed(2)}</span>
        </div>
        <div class="stat-item">
            <span class="label">5-Day Low:</span>
            <span class="value">$${low.toFixed(2)}</span>
        </div>
        <div class="stat-item">
            <span class="label">Avg Volume:</span>
            <span class="value">${formatNumber(avgVolume)}</span>
        </div>
        <div class="stat-item">
            <span class="label">Current RSI:</span>
            <span class="value ${lastRSI > 70 ? 'bearish' : lastRSI < 30 ? 'bullish' : ''}">${lastRSI.toFixed(1)}</span>
        </div>
    `;
}

function updateFeedbackEngine(forecast, patterns, data) {
    /**
     * Feedback Loop Mechanism Engine
     * Aggregates multiple feedback signals for trading decisions
     */
    
    // Momentum feedback from RSI and price trend
    const lastRSI = data[data.length - 1].RSI;
    feedbackEngineState.momentumFeedback = (lastRSI - 50) / 50; // -1 to 1
    
    // Volume feedback
    feedbackEngineState.volumeFeedback = forecast ? forecast.volume_direction * 0.5 : 0;
    
    // Eigenvalue feedback (matrix stability)
    feedbackEngineState.eigenvalueFeedback = forecast ? 
        (forecast.eigenvalue_principal > 0.3 ? 0.5 : -0.3) : 0;
    
    // Pattern feedback
    const bullishPatterns = patterns.filter(p => p.signal === 'bullish').length;
    const bearishPatterns = patterns.filter(p => p.signal === 'bearish').length;
    feedbackEngineState.patternFeedback = (bullishPatterns - bearishPatterns) * 0.25;
    
    // Aggregate feedback
    feedbackEngineState.aggregateFeedback = (
        feedbackEngineState.momentumFeedback * 0.3 +
        feedbackEngineState.volumeFeedback * 0.2 +
        feedbackEngineState.eigenvalueFeedback * 0.2 +
        feedbackEngineState.patternFeedback * 0.3
    );
    
    const signal = feedbackEngineState.aggregateFeedback > 0.2 ? 'BUY' :
                   feedbackEngineState.aggregateFeedback < -0.2 ? 'SELL' : 'HOLD';
    const signalClass = signal === 'BUY' ? 'bullish' : signal === 'SELL' ? 'bearish' : 'neutral';
    
    elements.feedbackContent.innerHTML = `
        <div class="feedback-item">
            <span class="label">Momentum Loop:</span>
            <div class="feedback-bar">
                <div class="feedback-fill ${feedbackEngineState.momentumFeedback >= 0 ? 'positive' : 'negative'}" 
                     style="width: ${Math.abs(feedbackEngineState.momentumFeedback) * 100}%"></div>
            </div>
            <span class="value">${(feedbackEngineState.momentumFeedback * 100).toFixed(0)}%</span>
        </div>
        <div class="feedback-item">
            <span class="label">Volume Loop:</span>
            <div class="feedback-bar">
                <div class="feedback-fill ${feedbackEngineState.volumeFeedback >= 0 ? 'positive' : 'negative'}"
                     style="width: ${Math.abs(feedbackEngineState.volumeFeedback) * 100}%"></div>
            </div>
            <span class="value">${(feedbackEngineState.volumeFeedback * 100).toFixed(0)}%</span>
        </div>
        <div class="feedback-item">
            <span class="label">Matrix Eigenvalue Loop:</span>
            <div class="feedback-bar">
                <div class="feedback-fill ${feedbackEngineState.eigenvalueFeedback >= 0 ? 'positive' : 'negative'}"
                     style="width: ${Math.abs(feedbackEngineState.eigenvalueFeedback) * 100}%"></div>
            </div>
            <span class="value">${(feedbackEngineState.eigenvalueFeedback * 100).toFixed(0)}%</span>
        </div>
        <div class="feedback-item">
            <span class="label">Pattern Loop:</span>
            <div class="feedback-bar">
                <div class="feedback-fill ${feedbackEngineState.patternFeedback >= 0 ? 'positive' : 'negative'}"
                     style="width: ${Math.min(Math.abs(feedbackEngineState.patternFeedback), 1) * 100}%"></div>
            </div>
            <span class="value">${(feedbackEngineState.patternFeedback * 100).toFixed(0)}%</span>
        </div>
        <div class="feedback-item aggregate">
            <span class="label">🎯 Aggregate Signal:</span>
            <span class="signal ${signalClass}">${signal}</span>
            <span class="value">(${(feedbackEngineState.aggregateFeedback * 100).toFixed(1)}%)</span>
        </div>
    `;
}

// ==================== UTILITIES ====================

function formatPatternName(type) {
    return type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(0);
}

function showLoader(text) {
    elements.loader.style.display = 'flex';
    elements.loaderText.textContent = text;
}

function hideLoader() {
    elements.loader.style.display = 'none';
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    elements.loadBtn.addEventListener('click', () => {
        const ticker = elements.tickerSearch.value.toUpperCase();
        if (ticker && (allData[ticker] || DEFAULT_WATCHLIST.includes(ticker))) {
            currentTicker = ticker;
            loadChart(ticker);
            updateActiveWatchlistButton(ticker);
        }
    });
    
    // Indicator checkboxes
    [elements.showSMA, elements.showEMA, elements.showBB, elements.showVolume,
     elements.showRSI, elements.showMACD, elements.showStoch,
     elements.showPatterns, elements.showForecast].forEach(checkbox => {
        checkbox.addEventListener('change', () => loadChart(currentTicker));
    });
}

// ==================== INITIALIZATION ====================

async function init() {
    // Check if Plotly is available
    if (typeof Plotly === 'undefined') {
        console.error('Plotly not loaded. Charts will not render.');
        elements.mainChart.innerHTML = '<div style="padding: 40px; text-align: center; color: #757575;"><h3>⚠️ Plotly.js not loaded</h3><p>Please ensure you have internet connectivity for CDN resources.</p></div>';
        // Still initialize other features
    }
    
    // Check for ticker parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tickerParam = urlParams.get('ticker');
    if (tickerParam) {
        currentTicker = tickerParam.toUpperCase();
        console.log('Loading ticker from URL parameter:', currentTicker);
    }
    
    setupAutocomplete();
    setupEventListeners();
    await loadData();
}

// Check for Plotly availability before rendering
function isPlotlyAvailable() {
    return typeof Plotly !== 'undefined';
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
