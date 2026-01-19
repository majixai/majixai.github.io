// TradingView Lightweight Charts Implementation with Technical Indicators and Patterns

let priceChart = null;
let volumeChart = null;
let rsiChart = null;
let macdChart = null;
let allData = {};
let currentSymbol = null;
let chartType = 'candlestick';
let showBollinger = true;
let showCrosshair = true;
let optionStrategy = 'call';

// Chart series references
let candleSeries = null;
let lineSeries = null;
let volumeSeries = null;
let bollingerUpperSeries = null;
let bollingerMiddleSeries = null;
let bollingerLowerSeries = null;
let sma20Series = null;
let sma50Series = null;
let sma200Series = null;
let rsiSeries = null;
let macdLineSeries = null;
let macdSignalSeries = null;
let macdHistogramSeries = null;

// Technical Indicators Calculations

function calculateRSI(data, period = 14) {
    const rsi = [];
    let gains = 0;
    let losses = 0;

    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            rsi.push(null);
            continue;
        }

        const change = data[i].Close - data[i - 1].Close;
        if (change > 0) gains += change;
        else losses += Math.abs(change);

        if (i < period) {
            rsi.push(null);
            continue;
        }

        if (i === period) {
            gains /= period;
            losses /= period;
        } else {
            gains = (gains * (period - 1) + (change > 0 ? change : 0)) / period;
            losses = (losses * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
        }

        const rs = losses === 0 ? 100 : gains / losses;
        const rsiValue = 100 - (100 / (1 + rs));
        rsi.push(rsiValue);
    }

    return rsi;
}

function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const closes = data.map(d => d.Close);
    const emaFast = calculateEMA(closes, fastPeriod);
    const emaSlow = calculateEMA(closes, slowPeriod);
    
    const macdLine = emaFast.map((fast, i) => {
        if (fast === null || emaSlow[i] === null) return null;
        return fast - emaSlow[i];
    });
    
    const signalLine = calculateEMA(macdLine.filter(v => v !== null), signalPeriod);
    
    // Pad signal line to match length
    const paddedSignal = new Array(macdLine.length - signalLine.length).fill(null).concat(signalLine);
    
    const histogram = macdLine.map((macd, i) => {
        if (macd === null || paddedSignal[i] === null) return null;
        return macd - paddedSignal[i];
    });
    
    return { macdLine, signalLine: paddedSignal, histogram };
}

function calculateEMA(data, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);
    
    // Find first non-null value for initial SMA
    let sum = 0;
    let count = 0;
    let startIndex = 0;
    
    for (let i = 0; i < data.length; i++) {
        if (data[i] === null || data[i] === undefined) {
            ema.push(null);
            continue;
        }
        
        if (count < period) {
            sum += data[i];
            count++;
            ema.push(null);
            
            if (count === period) {
                ema[i] = sum / period;
                startIndex = i;
            }
        } else {
            const newEma = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
            ema.push(newEma);
        }
    }
    
    return ema;
}

function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            sma.push(null);
            continue;
        }
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.Close, 0);
        sma.push(sum / period);
    }
    return sma;
}

function calculateBollingerBands(data, period = 20, stdDev = 2) {
    const bands = { upper: [], middle: [], lower: [] };
    
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            bands.upper.push(null);
            bands.middle.push(null);
            bands.lower.push(null);
            continue;
        }
        
        const slice = data.slice(i - period + 1, i + 1);
        const closes = slice.map(d => d.Close);
        const sma = closes.reduce((a, b) => a + b, 0) / period;
        const variance = closes.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
        const std = Math.sqrt(variance);
        
        bands.upper.push(sma + (stdDev * std));
        bands.middle.push(sma);
        bands.lower.push(sma - (stdDev * std));
    }
    
    return bands;
}

// Pattern Recognition

function detectPatterns(data) {
    const patterns = {
        dojis: [],
        hammers: [],
        shootingStars: [],
        engulfing: [],
        morningStars: [],
        eveningStars: [],
        support: [],
        resistance: []
    };
    
    // Detect candlestick patterns
    for (let i = 2; i < data.length; i++) {
        const curr = data[i];
        const prev = data[i - 1];
        const prev2 = data[i - 2];
        
        const body = Math.abs(curr.Close - curr.Open);
        const range = curr.High - curr.Low;
        const upperWick = curr.High - Math.max(curr.Open, curr.Close);
        const lowerWick = Math.min(curr.Open, curr.Close) - curr.Low;
        
        // Doji pattern (small body)
        if (body / range < 0.1 && range > 0) {
            patterns.dojis.push({ index: i, time: curr.Date, price: curr.Close });
        }
        
        // Hammer pattern (long lower wick, small upper wick)
        if (lowerWick > body * 2 && upperWick < body && curr.Close > curr.Open) {
            patterns.hammers.push({ index: i, time: curr.Date, price: curr.Close });
        }
        
        // Shooting Star pattern (long upper wick, small lower wick)
        if (upperWick > body * 2 && lowerWick < body && curr.Close < curr.Open) {
            patterns.shootingStars.push({ index: i, time: curr.Date, price: curr.Close });
        }
        
        // Bullish Engulfing
        if (prev.Close < prev.Open && curr.Close > curr.Open &&
            curr.Open < prev.Close && curr.Close > prev.Open) {
            patterns.engulfing.push({ 
                index: i, 
                time: curr.Date, 
                price: curr.Close, 
                type: 'bullish' 
            });
        }
        
        // Bearish Engulfing
        if (prev.Close > prev.Open && curr.Close < curr.Open &&
            curr.Open > prev.Close && curr.Close < prev.Open) {
            patterns.engulfing.push({ 
                index: i, 
                time: curr.Date, 
                price: curr.Close, 
                type: 'bearish' 
            });
        }
        
        // Morning Star (bullish reversal)
        if (prev2.Close < prev2.Open && // First candle bearish
            Math.abs(prev.Close - prev.Open) < (prev2.Close - prev2.Open) * 0.3 && // Small middle candle
            curr.Close > curr.Open && // Third candle bullish
            curr.Close > (prev2.Open + prev2.Close) / 2) { // Closes above midpoint
            patterns.morningStars.push({ index: i, time: curr.Date, price: curr.Close });
        }
        
        // Evening Star (bearish reversal)
        if (prev2.Close > prev2.Open && // First candle bullish
            Math.abs(prev.Close - prev.Open) < (prev2.Open - prev2.Close) * 0.3 && // Small middle candle
            curr.Close < curr.Open && // Third candle bearish
            curr.Close < (prev2.Open + prev2.Close) / 2) { // Closes below midpoint
            patterns.eveningStars.push({ index: i, time: curr.Date, price: curr.Close });
        }
    }
    
    // Detect support and resistance levels
    const pivotPoints = findPivotPoints(data);
    patterns.support = pivotPoints.support;
    patterns.resistance = pivotPoints.resistance;
    
    return patterns;
}

function findPivotPoints(data, lookback = 5) {
    const support = [];
    const resistance = [];
    
    for (let i = lookback; i < data.length - lookback; i++) {
        const curr = data[i];
        let isResistance = true;
        let isSupport = true;
        
        // Check if current point is a local maximum (resistance)
        for (let j = i - lookback; j <= i + lookback; j++) {
            if (j !== i && data[j].High > curr.High) {
                isResistance = false;
                break;
            }
        }
        
        // Check if current point is a local minimum (support)
        for (let j = i - lookback; j <= i + lookback; j++) {
            if (j !== i && data[j].Low < curr.Low) {
                isSupport = false;
                break;
            }
        }
        
        if (isResistance) {
            resistance.push({ index: i, time: curr.Date, price: curr.High });
        }
        if (isSupport) {
            support.push({ index: i, time: curr.Date, price: curr.Low });
        }
    }
    
    return { support, resistance };
}

// Load and decompress data
async function loadData() {
    try {
        const response = await fetch('index_1m.dat');
        if (!response.ok) {
            throw new Error('Data file not found. Please run fetch_data.py first.');
        }
        
        const compressedData = await response.arrayBuffer();
        const decompressed = pako.inflate(new Uint8Array(compressedData), { to: 'string' });
        allData = JSON.parse(decompressed);
        
        console.log('Data loaded successfully:', Object.keys(allData));
        return true;
    } catch (error) {
        console.error('Error loading data:', error);
        showError(error.message);
        return false;
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

function showLoader() {
    document.getElementById('loader').style.display = 'block';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

function formatNumber(num, decimals = 2) {
    return Number(num).toFixed(decimals);
}

function updateInfoPanel(summary) {
    document.getElementById('current-price').textContent = formatNumber(summary.current_price, 2);
    
    const change = summary.change;
    const changeEl = document.getElementById('change');
    changeEl.textContent = (change >= 0 ? '+' : '') + formatNumber(change, 2);
    changeEl.className = 'value ' + (change >= 0 ? 'positive' : 'negative');
    
    const changePct = summary.change_pct;
    const changePctEl = document.getElementById('change-pct');
    changePctEl.textContent = (changePct >= 0 ? '+' : '') + formatNumber(changePct, 2) + '%';
    changePctEl.className = 'value ' + (changePct >= 0 ? 'positive' : 'negative');
    
    document.getElementById('volatility').textContent = formatNumber(summary.volatility, 2) + '%';
    document.getElementById('rsi').textContent = formatNumber(summary.rsi, 1);
    document.getElementById('data-points').textContent = summary.data_points;
    
    // Update options current price
    if (document.getElementById('current-spot')) {
        document.getElementById('current-spot').value = formatNumber(summary.current_price, 2);
    }
}

// Create price chart with Lightweight Charts
function createPriceChart(data, symbol) {
    const chartContainer = document.getElementById('price-chart');
    chartContainer.innerHTML = ''; // Clear previous chart
    
    // Create chart
    priceChart = LightweightCharts.createChart(chartContainer, {
        layout: {
            background: { color: '#1a1a2e' },
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: '#2a2e39' },
            horzLines: { color: '#2a2e39' },
        },
        width: chartContainer.clientWidth,
        height: 500,
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
        },
        crosshair: {
            mode: showCrosshair ? LightweightCharts.CrosshairMode.Normal : LightweightCharts.CrosshairMode.Hidden,
        },
    });
    
    // Prepare data for candlestick chart
    const candleData = data.map(d => ({
        time: new Date(d.Date).getTime() / 1000,
        open: d.Open,
        high: d.High,
        low: d.Low,
        close: d.Close
    }));
    
    // Add candlestick series
    if (chartType === 'candlestick') {
        candleSeries = priceChart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });
        candleSeries.setData(candleData);
    } else if (chartType === 'line') {
        lineSeries = priceChart.addLineSeries({
            color: '#667eea',
            lineWidth: 2,
        });
        lineSeries.setData(candleData.map(d => ({ time: d.time, value: d.close })));
    } else if (chartType === 'area') {
        lineSeries = priceChart.addAreaSeries({
            topColor: 'rgba(102, 126, 234, 0.56)',
            bottomColor: 'rgba(102, 126, 234, 0.04)',
            lineColor: 'rgba(102, 126, 234, 1)',
            lineWidth: 2,
        });
        lineSeries.setData(candleData.map(d => ({ time: d.time, value: d.close })));
    }
    
    // Add Bollinger Bands
    if (showBollinger) {
        const bollingerBands = calculateBollingerBands(data);
        
        const upperBandData = data.map((d, i) => ({
            time: new Date(d.Date).getTime() / 1000,
            value: bollingerBands.upper[i]
        })).filter(d => d.value !== null);
        
        const middleBandData = data.map((d, i) => ({
            time: new Date(d.Date).getTime() / 1000,
            value: bollingerBands.middle[i]
        })).filter(d => d.value !== null);
        
        const lowerBandData = data.map((d, i) => ({
            time: new Date(d.Date).getTime() / 1000,
            value: bollingerBands.lower[i]
        })).filter(d => d.value !== null);
        
        bollingerUpperSeries = priceChart.addLineSeries({
            color: 'rgba(255, 159, 64, 0.5)',
            lineWidth: 1,
            lineStyle: 2, // Dashed
        });
        bollingerUpperSeries.setData(upperBandData);
        
        bollingerMiddleSeries = priceChart.addLineSeries({
            color: 'rgba(255, 159, 64, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
        });
        bollingerMiddleSeries.setData(middleBandData);
        
        bollingerLowerSeries = priceChart.addLineSeries({
            color: 'rgba(255, 159, 64, 0.5)',
            lineWidth: 1,
            lineStyle: 2,
        });
        bollingerLowerSeries.setData(lowerBandData);
    }
    
    // Add Moving Averages
    const sma20 = calculateSMA(data, 20);
    const sma50 = calculateSMA(data, 50);
    const sma200 = calculateSMA(data, 200);
    
    if (sma20.some(v => v !== null)) {
        const sma20Data = data.map((d, i) => ({
            time: new Date(d.Date).getTime() / 1000,
            value: sma20[i]
        })).filter(d => d.value !== null);
        
        sma20Series = priceChart.addLineSeries({
            color: '#ff6384',
            lineWidth: 1.5,
        });
        sma20Series.setData(sma20Data);
    }
    
    if (sma50.some(v => v !== null)) {
        const sma50Data = data.map((d, i) => ({
            time: new Date(d.Date).getTime() / 1000,
            value: sma50[i]
        })).filter(d => d.value !== null);
        
        sma50Series = priceChart.addLineSeries({
            color: '#4bc0c0',
            lineWidth: 1.5,
        });
        sma50Series.setData(sma50Data);
    }
    
    if (sma200.some(v => v !== null)) {
        const sma200Data = data.map((d, i) => ({
            time: new Date(d.Date).getTime() / 1000,
            value: sma200[i]
        })).filter(d => d.value !== null);
        
        sma200Series = priceChart.addLineSeries({
            color: '#9966ff',
            lineWidth: 2,
        });
        sma200Series.setData(sma200Data);
    }
    
    // Add pattern markers
    const patterns = detectPatterns(data);
    addPatternMarkers(priceChart, candleSeries || lineSeries, patterns, data);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        priceChart.applyOptions({ width: chartContainer.clientWidth });
    });
}

function addPatternMarkers(chart, series, patterns, data) {
    const markers = [];
    
    // Add Hammer markers
    patterns.hammers.forEach(pattern => {
        markers.push({
            time: new Date(pattern.time).getTime() / 1000,
            position: 'belowBar',
            color: '#26a69a',
            shape: 'arrowUp',
            text: 'Hammer',
        });
    });
    
    // Add Shooting Star markers
    patterns.shootingStars.forEach(pattern => {
        markers.push({
            time: new Date(pattern.time).getTime() / 1000,
            position: 'aboveBar',
            color: '#ef5350',
            shape: 'arrowDown',
            text: 'Shooting Star',
        });
    });
    
    // Add Engulfing markers
    patterns.engulfing.forEach(pattern => {
        markers.push({
            time: new Date(pattern.time).getTime() / 1000,
            position: pattern.type === 'bullish' ? 'belowBar' : 'aboveBar',
            color: pattern.type === 'bullish' ? '#26a69a' : '#ef5350',
            shape: pattern.type === 'bullish' ? 'arrowUp' : 'arrowDown',
            text: pattern.type === 'bullish' ? 'Bull Engulf' : 'Bear Engulf',
        });
    });
    
    // Add Morning Star markers
    patterns.morningStars.forEach(pattern => {
        markers.push({
            time: new Date(pattern.time).getTime() / 1000,
            position: 'belowBar',
            color: '#4caf50',
            shape: 'arrowUp',
            text: '⭐ Morning',
        });
    });
    
    // Add Evening Star markers
    patterns.eveningStars.forEach(pattern => {
        markers.push({
            time: new Date(pattern.time).getTime() / 1000,
            position: 'aboveBar',
            color: '#f44336',
            shape: 'arrowDown',
            text: '⭐ Evening',
        });
    });
    
    if (markers.length > 0) {
        series.setMarkers(markers);
    }
}

// Create volume chart
function createVolumeChart(data, symbol) {
    const chartContainer = document.getElementById('volume-chart');
    chartContainer.innerHTML = '';
    
    volumeChart = LightweightCharts.createChart(chartContainer, {
        layout: {
            background: { color: '#1a1a2e' },
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: '#2a2e39' },
            horzLines: { color: '#2a2e39' },
        },
        width: chartContainer.clientWidth,
        height: 150,
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
        },
    });
    
    const volumeData = data.map(d => ({
        time: new Date(d.Date).getTime() / 1000,
        value: d.Volume,
        color: d.Close >= d.Open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
    }));
    
    volumeSeries = volumeChart.addHistogramSeries({
        priceFormat: {
            type: 'volume',
        },
    });
    volumeSeries.setData(volumeData);
    
    window.addEventListener('resize', () => {
        volumeChart.applyOptions({ width: chartContainer.clientWidth });
    });
}

// Create RSI chart
function createRSIChart(data, symbol) {
    const chartContainer = document.getElementById('indicators-chart');
    chartContainer.innerHTML = '';
    
    rsiChart = LightweightCharts.createChart(chartContainer, {
        layout: {
            background: { color: '#1a1a2e' },
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: '#2a2e39' },
            horzLines: { color: '#2a2e39' },
        },
        width: chartContainer.clientWidth,
        height: 200,
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
        },
    });
    
    const rsi = calculateRSI(data);
    const rsiData = data.map((d, i) => ({
        time: new Date(d.Date).getTime() / 1000,
        value: rsi[i]
    })).filter(d => d.value !== null);
    
    rsiSeries = rsiChart.addLineSeries({
        color: '#2196F3',
        lineWidth: 2,
    });
    rsiSeries.setData(rsiData);
    
    // Add RSI levels (30 and 70)
    const rsiLevel70 = rsiChart.addLineSeries({
        color: 'rgba(239, 83, 80, 0.5)',
        lineWidth: 1,
        lineStyle: 2,
    });
    rsiLevel70.setData(rsiData.map(d => ({ time: d.time, value: 70 })));
    
    const rsiLevel30 = rsiChart.addLineSeries({
        color: 'rgba(38, 166, 154, 0.5)',
        lineWidth: 1,
        lineStyle: 2,
    });
    rsiLevel30.setData(rsiData.map(d => ({ time: d.time, value: 30 })));
    
    window.addEventListener('resize', () => {
        rsiChart.applyOptions({ width: chartContainer.clientWidth });
    });
}

// Create MACD chart
function createMACDChart(data, symbol) {
    const chartContainer = document.createElement('div');
    chartContainer.id = 'macd-chart';
    chartContainer.style.marginTop = '20px';
    document.getElementById('indicators-chart').parentElement.appendChild(chartContainer);
    
    macdChart = LightweightCharts.createChart(chartContainer, {
        layout: {
            background: { color: '#1a1a2e' },
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: '#2a2e39' },
            horzLines: { color: '#2a2e39' },
        },
        width: chartContainer.clientWidth,
        height: 200,
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
        },
    });
    
    const macd = calculateMACD(data);
    
    const macdLineData = data.map((d, i) => ({
        time: new Date(d.Date).getTime() / 1000,
        value: macd.macdLine[i]
    })).filter(d => d.value !== null);
    
    const signalLineData = data.map((d, i) => ({
        time: new Date(d.Date).getTime() / 1000,
        value: macd.signalLine[i]
    })).filter(d => d.value !== null);
    
    const histogramData = data.map((d, i) => ({
        time: new Date(d.Date).getTime() / 1000,
        value: macd.histogram[i],
        color: macd.histogram[i] >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
    })).filter(d => d.value !== null);
    
    macdLineSeries = macdChart.addLineSeries({
        color: '#2196F3',
        lineWidth: 2,
    });
    macdLineSeries.setData(macdLineData);
    
    macdSignalSeries = macdChart.addLineSeries({
        color: '#ff6384',
        lineWidth: 2,
    });
    macdSignalSeries.setData(signalLineData);
    
    macdHistogramSeries = macdChart.addHistogramSeries({
        priceFormat: {
            type: 'price',
            precision: 4,
            minMove: 0.0001,
        },
    });
    macdHistogramSeries.setData(histogramData);
    
    window.addEventListener('resize', () => {
        macdChart.applyOptions({ width: chartContainer.clientWidth });
    });
}

// Load chart
function loadChart(symbol) {
    if (!allData[symbol]) {
        showError(`No data available for ${symbol}`);
        return;
    }
    
    showLoader();
    hideError();
    currentSymbol = symbol;
    
    const indexData = allData[symbol];
    const data = indexData.data;
    
    updateInfoPanel(indexData.summary);
    
    createPriceChart(data, symbol);
    createVolumeChart(data, symbol);
    createRSIChart(data, symbol);
    createMACDChart(data, symbol);
    
    hideLoader();
    
    // Display pattern information
    const patterns = detectPatterns(data);
    displayPatternInfo(patterns);
}

function displayPatternInfo(patterns) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'pattern-info';
    infoDiv.style.cssText = 'background: #2a2e39; padding: 15px; margin: 20px 0; border-radius: 8px;';
    
    let html = '<h3 style="color: #667eea; margin-top: 0;">📊 Detected Patterns</h3>';
    
    html += `<p>🔨 Hammers: ${patterns.hammers.length}</p>`;
    html += `<p>⭐ Shooting Stars: ${patterns.shootingStars.length}</p>`;
    html += `<p>🎯 Engulfing: ${patterns.engulfing.length}</p>`;
    html += `<p>🌅 Morning Stars: ${patterns.morningStars.length}</p>`;
    html += `<p>🌆 Evening Stars: ${patterns.eveningStars.length}</p>`;
    html += `<p>📊 Support Levels: ${patterns.support.length}</p>`;
    html += `<p>📈 Resistance Levels: ${patterns.resistance.length}</p>`;
    
    infoDiv.innerHTML = html;
    
    const existingInfo = document.querySelector('.pattern-info');
    if (existingInfo) {
        existingInfo.remove();
    }
    
    const chartsSection = document.querySelector('.charts-section');
    if (chartsSection) {
        chartsSection.insertAdjacentElement('beforebegin', infoDiv);
    }
}

// Event listeners
document.getElementById('load-btn').addEventListener('click', () => {
    const symbol = document.getElementById('index-select').value;
    if (symbol) {
        loadChart(symbol);
    }
});

document.getElementById('index-select').addEventListener('change', (e) => {
    if (e.target.value) {
        loadChart(e.target.value);
    }
});

// Chart type buttons
document.querySelectorAll('.btn-chart-type').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-chart-type').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        chartType = e.target.dataset.type;
        
        if (currentSymbol) {
            createPriceChart(allData[currentSymbol].data, currentSymbol);
        }
    });
});

// Bollinger Bands toggle
document.getElementById('show-bollinger').addEventListener('change', (e) => {
    showBollinger = e.target.checked;
    if (currentSymbol) {
        createPriceChart(allData[currentSymbol].data, currentSymbol);
    }
});

// Crosshair toggle
document.getElementById('show-crosshair').addEventListener('change', (e) => {
    showCrosshair = e.target.checked;
    if (priceChart) {
        priceChart.applyOptions({
            crosshair: {
                mode: showCrosshair ? LightweightCharts.CrosshairMode.Normal : LightweightCharts.CrosshairMode.Hidden,
            }
        });
    }
});

// Initialize
(async () => {
    const loaded = await loadData();
    if (loaded) {
        const firstIndex = Object.keys(allData)[0];
        if (firstIndex) {
            document.getElementById('index-select').value = firstIndex;
            loadChart(firstIndex);
        }
    }
})();
