let priceChart = null;
let volumeChart = null;
let indicatorsChart = null;
let optionsChart = null;
let allData = {};
let currentSymbol = null;
let chartType = 'line';
let showBollinger = true;
let showCrosshair = true;
let optionStrategy = 'call';

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
    document.getElementById('current-spot').value = formatNumber(summary.current_price, 2);
}

// Calculate Bollinger Bands
function calculateBollingerBands(data, period = 20, stdDev = 2) {
    const bands = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            bands.push({ upper: null, middle: null, lower: null });
            continue;
        }
        
        const slice = data.slice(i - period + 1, i + 1);
        const closes = slice.map(d => d.Close);
        const sma = closes.reduce((a, b) => a + b, 0) / period;
        const variance = closes.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
        const std = Math.sqrt(variance);
        
        bands.push({
            upper: sma + (stdDev * std),
            middle: sma,
            lower: sma - (stdDev * std)
        });
    }
    return bands;
}

// Create enhanced price chart with multiple chart types
function createPriceChart(data, symbol) {
    const ctx = document.getElementById('price-chart').getContext('2d');
    
    if (priceChart) {
        priceChart.destroy();
    }
    
    const labels = data.map(d => {
        const date = new Date(d.Date);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });
    
    const bollingerBands = calculateBollingerBands(data);
    const datasets = [];
    
    // Main price dataset
    if (chartType === 'candlestick') {
        // For candlestick, we'll use OHLC data points
        datasets.push({
            label: 'Price',
            data: data.map((d, i) => ({
                x: i,
                o: d.Open,
                h: d.High,
                l: d.Low,
                c: d.Close
            })),
            type: 'line',
            borderColor: data.map(d => d.Close >= d.Open ? 'rgb(38, 166, 154)' : 'rgb(239, 83, 80)'),
            backgroundColor: data.map(d => d.Close >= d.Open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)'),
            borderWidth: 2,
            fill: false
        });
    } else {
        datasets.push({
            label: 'Close Price',
            data: data.map(d => d.Close),
            borderColor: 'rgb(102, 126, 234)',
            backgroundColor: chartType === 'area' ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.1)',
            borderWidth: 2,
            fill: chartType === 'area',
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6
        });
    }
    
    // Moving averages
    datasets.push(
        {
            label: 'SMA 20',
            data: data.map(d => d.SMA_20),
            borderColor: 'rgb(255, 99, 132)',
            borderWidth: 1.5,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 4
        },
        {
            label: 'SMA 50',
            data: data.map(d => d.SMA_50),
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1.5,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 4
        }
    );
    
    // Bollinger Bands
    if (showBollinger) {
        datasets.push(
            {
                label: 'BB Upper',
                data: bollingerBands.map(b => b.upper),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                fill: false,
                tension: 0.1,
                pointRadius: 0
            },
            {
                label: 'BB Lower',
                data: bollingerBands.map(b => b.lower),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                fill: '-1',
                backgroundColor: 'rgba(255, 159, 64, 0.05)',
                tension: 0.1,
                pointRadius: 0
            }
        );
    }
    
    const plugins = [
        {
            id: 'customCrosshair',
            afterDraw: (chart) => {
                if (!showCrosshair) return;
                if (chart.tooltip?._active?.length) {
                    const ctx = chart.ctx;
                    const activePoint = chart.tooltip._active[0];
                    const x = activePoint.element.x;
                    const y = activePoint.element.y;
                    const topY = chart.scales.y.top;
                    const bottomY = chart.scales.y.bottom;
                    const leftX = chart.scales.x.left;
                    const rightX = chart.scales.x.right;
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(x, topY);
                    ctx.lineTo(x, bottomY);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
                    ctx.setLineDash([5, 5]);
                    ctx.stroke();
                    
                    ctx.beginPath();
                    ctx.moveTo(leftX, y);
                    ctx.lineTo(rightX, y);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }
    ];
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: `${symbol} - Price Chart (1 Minute) - ${chartType.toUpperCase()}`,
                    font: { size: 18, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top',
                    onClick: (e, legendItem, legend) => {
                        const index = legendItem.datasetIndex;
                        const chart = legend.chart;
                        const meta = chart.getDatasetMeta(index);
                        meta.hidden = !meta.hidden;
                        chart.update();
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatNumber(context.parsed.y, 2);
                        }
                    }
                },
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                    },
                    limits: {
                        x: {min: 'original', max: 'original'},
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time'
                    },
                    ticks: {
                        maxTicksLimit: 20
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Price'
                    }
                }
            }
        },
        plugins: plugins
    });
}

function createVolumeChart(data, symbol) {
    const ctx = document.getElementById('volume-chart').getContext('2d');
    
    if (volumeChart) {
        volumeChart.destroy();
    }
    
    const labels = data.map(d => {
        const date = new Date(d.Date);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });
    
    const colors = data.map((d, i) => {
        if (i === 0) return 'rgba(118, 75, 162, 0.6)';
        return d.Close >= data[i-1].Close ? 'rgba(38, 166, 154, 0.6)' : 'rgba(239, 83, 80, 0.6)';
    });
    
    volumeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Volume',
                data: data.map(d => d.Volume),
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.6', '1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 3,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: `${symbol} - Volume Chart`,
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: false
                },
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxTicksLimit: 20
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Volume'
                    }
                }
            }
        }
    });
}

function createIndicatorsChart(data, symbol) {
    const ctx = document.getElementById('indicators-chart').getContext('2d');
    
    if (indicatorsChart) {
        indicatorsChart.destroy();
    }
    
    const labels = data.map(d => {
        const date = new Date(d.Date);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });
    
    indicatorsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'RSI',
                    data: data.map(d => d.RSI),
                    borderColor: 'rgb(255, 159, 64)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y',
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'MACD',
                    data: data.map(d => d.MACD),
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y1',
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'MACD Signal',
                    data: data.map(d => d.MACD_Signal),
                    borderColor: 'rgb(255, 99, 132)',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y1',
                    pointRadius: 0,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 3,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: `${symbol} - Technical Indicators`,
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top',
                    onClick: (e, legendItem, legend) => {
                        const index = legendItem.datasetIndex;
                        const chart = legend.chart;
                        const meta = chart.getDatasetMeta(index);
                        meta.hidden = !meta.hidden;
                        chart.update();
                    }
                },
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                    }
                },
                annotation: {
                    annotations: {
                        rsi70: {
                            type: 'line',
                            yMin: 70,
                            yMax: 70,
                            yScaleID: 'y',
                            borderColor: 'rgba(255, 99, 132, 0.5)',
                            borderWidth: 1,
                            borderDash: [5, 5],
                            label: {
                                content: 'Overbought (70)',
                                enabled: true,
                                position: 'end'
                            }
                        },
                        rsi30: {
                            type: 'line',
                            yMin: 30,
                            yMax: 30,
                            yScaleID: 'y',
                            borderColor: 'rgba(75, 192, 192, 0.5)',
                            borderWidth: 1,
                            borderDash: [5, 5],
                            label: {
                                content: 'Oversold (30)',
                                enabled: true,
                                position: 'end'
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxTicksLimit: 20
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'RSI'
                    },
                    min: 0,
                    max: 100
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'MACD'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Options Payout Calculations
function calculateOptionPayout(spotPrices, strikes, premiums, type) {
    const payouts = [];
    
    for (const spot of spotPrices) {
        let payout = 0;
        
        switch(type) {
            case 'call':
                payout = Math.max(0, spot - strikes[0]) - premiums[0];
                break;
            case 'put':
                payout = Math.max(0, strikes[0] - spot) - premiums[0];
                break;
            case 'straddle':
                // Long call + long put at same strike
                payout = Math.max(0, spot - strikes[0]) + Math.max(0, strikes[0] - spot) - (premiums[0] + premiums[1]);
                break;
            case 'strangle':
                // Long call at higher strike + long put at lower strike
                payout = Math.max(0, spot - strikes[1]) + Math.max(0, strikes[0] - spot) - (premiums[0] + premiums[1]);
                break;
            case 'spread':
                // Bull call spread: long lower strike, short higher strike
                payout = Math.max(0, spot - strikes[0]) - Math.max(0, spot - strikes[1]) - premiums[0] + premiums[1];
                break;
            case 'butterfly':
                // Long 1 lower, short 2 middle, long 1 higher
                payout = Math.max(0, spot - strikes[0]) - 2 * Math.max(0, spot - strikes[1]) + Math.max(0, spot - strikes[2]) 
                         - premiums[0] + 2 * premiums[1] - premiums[2];
                break;
            case 'iron-condor':
                // Short put spread + short call spread
                payout = -Math.max(0, strikes[0] - spot) + Math.max(0, strikes[1] - spot) 
                         - Math.max(0, spot - strikes[2]) + Math.max(0, spot - strikes[3])
                         + premiums[0] - premiums[1] + premiums[2] - premiums[3];
                break;
        }
        
        payouts.push(payout);
    }
    
    return payouts;
}

function calculateOptionsStats(spotPrices, payouts, strikes, premiums, type) {
    const maxProfit = Math.max(...payouts);
    const maxLoss = Math.min(...payouts);
    
    // Find break-even points
    const breakEvens = [];
    for (let i = 1; i < payouts.length; i++) {
        if ((payouts[i-1] < 0 && payouts[i] >= 0) || (payouts[i-1] >= 0 && payouts[i] < 0)) {
            // Linear interpolation for break-even
            const x1 = spotPrices[i-1];
            const x2 = spotPrices[i];
            const y1 = payouts[i-1];
            const y2 = payouts[i];
            const breakEven = x1 - y1 * (x2 - x1) / (y2 - y1);
            breakEvens.push(breakEven);
        }
    }
    
    const riskReward = maxLoss !== 0 ? (maxProfit / Math.abs(maxLoss)).toFixed(2) : 'Unlimited';
    
    return {
        maxProfit: maxProfit.toFixed(2),
        maxLoss: maxLoss.toFixed(2),
        breakEvens: breakEvens.map(be => be.toFixed(2)),
        riskReward: riskReward
    };
}

function createOptionsChart() {
    const currentSpot = parseFloat(document.getElementById('current-spot').value);
    const strike1 = parseFloat(document.getElementById('strike-price').value);
    const premium1 = parseFloat(document.getElementById('premium').value);
    
    // Get additional strikes based on strategy
    const strike2 = parseFloat(document.getElementById('strike-price-2').value) || strike1 + 100;
    const premium2 = parseFloat(document.getElementById('premium-2').value) || premium1 * 0.6;
    const strike3 = parseFloat(document.getElementById('strike-price-3').value) || strike1 + 200;
    const premium3 = parseFloat(document.getElementById('premium-3').value) || premium1 * 0.4;
    const strike4 = parseFloat(document.getElementById('strike-price-4').value) || strike1 + 300;
    const premium4 = parseFloat(document.getElementById('premium-4').value) || premium1 * 0.2;
    
    const strikes = [strike1, strike2, strike3, strike4];
    const premiums = [premium1, premium2, premium3, premium4];
    
    // Create spot price range (±30% of current price)
    const minSpot = currentSpot * 0.7;
    const maxSpot = currentSpot * 1.3;
    const spotPrices = [];
    const step = (maxSpot - minSpot) / 200;
    for (let i = minSpot; i <= maxSpot; i += step) {
        spotPrices.push(i);
    }
    
    // Calculate payouts
    const payouts = calculateOptionPayout(spotPrices, strikes, premiums, optionStrategy);
    const stats = calculateOptionsStats(spotPrices, payouts, strikes, premiums, optionStrategy);
    
    // Update stats display
    document.getElementById('max-profit').textContent = '$' + stats.maxProfit;
    document.getElementById('max-profit').className = 'value positive';
    document.getElementById('max-loss').textContent = '$' + stats.maxLoss;
    document.getElementById('max-loss').className = 'value negative';
    document.getElementById('break-even').textContent = stats.breakEvens.join(', ') || 'N/A';
    document.getElementById('risk-reward').textContent = stats.riskReward;
    
    // Create chart
    const ctx = document.getElementById('options-chart').getContext('2d');
    
    if (optionsChart) {
        optionsChart.destroy();
    }
    
    const annotations = {
        currentPrice: {
            type: 'line',
            xMin: currentSpot,
            xMax: currentSpot,
            borderColor: 'rgba(102, 126, 234, 0.8)',
            borderWidth: 2,
            label: {
                content: 'Current Price',
                enabled: true,
                position: 'start'
            }
        },
        profitZone: {
            type: 'box',
            xMin: minSpot,
            xMax: maxSpot,
            yMin: 0,
            yMax: Math.max(...payouts),
            backgroundColor: 'rgba(38, 166, 154, 0.1)',
            borderWidth: 0
        },
        lossZone: {
            type: 'box',
            xMin: minSpot,
            xMax: maxSpot,
            yMin: Math.min(...payouts),
            yMax: 0,
            backgroundColor: 'rgba(239, 83, 80, 0.1)',
            borderWidth: 0
        }
    };
    
    // Add strike price lines
    strikes.forEach((strike, idx) => {
        annotations[`strike${idx}`] = {
            type: 'line',
            xMin: strike,
            xMax: strike,
            borderColor: `rgba(255, 99, 132, 0.${5 - idx})`,
            borderWidth: 1,
            borderDash: [5, 5],
            label: {
                content: `K${idx + 1}: ${strike.toFixed(0)}`,
                enabled: true,
                position: 'start'
            }
        };
    });
    
    optionsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: spotPrices.map(p => p.toFixed(0)),
            datasets: [
                {
                    label: 'Profit/Loss',
                    data: payouts,
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: (context) => {
                        const value = context.parsed?.y;
                        return value >= 0 ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)';
                    },
                    borderWidth: 3,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 8,
                    segment: {
                        borderColor: (ctx) => {
                            const value = ctx.p1.parsed.y;
                            return value >= 0 ? 'rgb(38, 166, 154)' : 'rgb(239, 83, 80)';
                        }
                    }
                },
                {
                    label: 'Break Even',
                    data: spotPrices.map(() => 0),
                    borderColor: 'rgba(0, 0, 0, 0.5)',
                    borderWidth: 2,
                    borderDash: [10, 5],
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: `Options Payout Diagram - ${optionStrategy.toUpperCase().replace('-', ' ')}`,
                    font: { size: 18, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            const label = context.dataset.label;
                            if (label === 'Break Even') return null;
                            const profit = value >= 0 ? 'Profit' : 'Loss';
                            return `${profit}: $${Math.abs(value).toFixed(2)}`;
                        },
                        title: function(context) {
                            return `Spot Price: $${context[0].label}`;
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                },
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'xy',
                    },
                    pan: {
                        enabled: true,
                        mode: 'xy',
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    display: true,
                    title: {
                        display: true,
                        text: 'Underlying Price at Expiration'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        },
                        maxTicksLimit: 15
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Profit / Loss'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

function loadChart(symbol) {
    hideError();
    showLoader();
    
    if (!allData[symbol]) {
        hideLoader();
        showError(`No data available for ${symbol}. Please run fetch_data.py to collect data.`);
        return;
    }
    
    currentSymbol = symbol;
    const indexData = allData[symbol];
    
    updateInfoPanel(indexData.summary);
    createPriceChart(indexData.data, symbol);
    createVolumeChart(indexData.data, symbol);
    createIndicatorsChart(indexData.data, symbol);
    
    hideLoader();
}

function updateStrikeInputs(strategy) {
    // Hide all optional inputs first
    document.getElementById('strike2-group').style.display = 'none';
    document.getElementById('premium2-group').style.display = 'none';
    document.getElementById('strike3-group').style.display = 'none';
    document.getElementById('premium3-group').style.display = 'none';
    document.getElementById('strike4-group').style.display = 'none';
    document.getElementById('premium4-group').style.display = 'none';
    
    // Show inputs based on strategy
    switch(strategy) {
        case 'straddle':
        case 'strangle':
            document.getElementById('strike2-group').style.display = 'block';
            document.getElementById('premium2-group').style.display = 'block';
            break;
        case 'spread':
            document.getElementById('strike2-group').style.display = 'block';
            document.getElementById('premium2-group').style.display = 'block';
            break;
        case 'butterfly':
            document.getElementById('strike2-group').style.display = 'block';
            document.getElementById('premium2-group').style.display = 'block';
            document.getElementById('strike3-group').style.display = 'block';
            document.getElementById('premium3-group').style.display = 'block';
            break;
        case 'iron-condor':
            document.getElementById('strike2-group').style.display = 'block';
            document.getElementById('premium2-group').style.display = 'block';
            document.getElementById('strike3-group').style.display = 'block';
            document.getElementById('premium3-group').style.display = 'block';
            document.getElementById('strike4-group').style.display = 'block';
            document.getElementById('premium4-group').style.display = 'block';
            break;
    }
}

// Event listeners
document.getElementById('load-btn').addEventListener('click', () => {
    const symbol = document.getElementById('index-select').value;
    if (!symbol) {
        showError('Please select an index');
        return;
    }
    loadChart(symbol);
});

document.getElementById('index-select').addEventListener('change', (e) => {
    if (e.target.value) {
        loadChart(e.target.value);
    }
});

// Chart type selector
document.querySelectorAll('.btn-chart-type').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-chart-type').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        chartType = e.target.dataset.type;
        if (currentSymbol && allData[currentSymbol]) {
            createPriceChart(allData[currentSymbol].data, currentSymbol);
        }
    });
});

// Toggle controls
document.getElementById('show-bollinger').addEventListener('change', (e) => {
    showBollinger = e.target.checked;
    if (currentSymbol && allData[currentSymbol]) {
        createPriceChart(allData[currentSymbol].data, currentSymbol);
    }
});

document.getElementById('show-crosshair').addEventListener('change', (e) => {
    showCrosshair = e.target.checked;
    if (currentSymbol && allData[currentSymbol]) {
        createPriceChart(allData[currentSymbol].data, currentSymbol);
    }
});

// Option strategy selector
document.querySelectorAll('.btn-option-type').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-option-type').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        optionStrategy = e.target.dataset.type;
        updateStrikeInputs(optionStrategy);
    });
});

// Calculate options button
document.getElementById('calculate-options').addEventListener('click', () => {
    createOptionsChart();
});

// Reset zoom on double click for all charts
document.getElementById('price-chart').addEventListener('dblclick', () => {
    if (priceChart) priceChart.resetZoom();
});

document.getElementById('volume-chart').addEventListener('dblclick', () => {
    if (volumeChart) volumeChart.resetZoom();
});

document.getElementById('indicators-chart').addEventListener('dblclick', () => {
    if (indicatorsChart) indicatorsChart.resetZoom();
});

document.getElementById('options-chart').addEventListener('dblclick', () => {
    if (optionsChart) optionsChart.resetZoom();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'r':
            case 'R':
                e.preventDefault();
                if (priceChart) priceChart.resetZoom();
                if (volumeChart) volumeChart.resetZoom();
                if (indicatorsChart) indicatorsChart.resetZoom();
                if (optionsChart) optionsChart.resetZoom();
                break;
        }
    }
});

// Initialize
window.addEventListener('load', async () => {
    showLoader();
    const loaded = await loadData();
    hideLoader();
    
    if (loaded && Object.keys(allData).length > 0) {
        // Auto-load first available index
        const firstIndex = Object.keys(allData)[0];
        document.getElementById('index-select').value = firstIndex;
        loadChart(firstIndex);
        
        // Calculate initial options chart
        createOptionsChart();
    }
});
