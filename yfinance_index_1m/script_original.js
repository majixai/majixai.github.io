let priceChart = null;
let volumeChart = null;
let indicatorsChart = null;
let allData = {};

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
}

function createPriceChart(data, symbol) {
    const ctx = document.getElementById('price-chart').getContext('2d');
    
    if (priceChart) {
        priceChart.destroy();
    }
    
    const labels = data.map(d => {
        const date = new Date(d.Date);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Close Price',
                    data: data.map(d => d.Close),
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                },
                {
                    label: 'SMA 20',
                    data: data.map(d => d.SMA_20),
                    borderColor: 'rgb(255, 99, 132)',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0
                },
                {
                    label: 'SMA 50',
                    data: data.map(d => d.SMA_50),
                    borderColor: 'rgb(75, 192, 192)',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.1,
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
                    text: `${symbol} - Price Chart (1 Minute)`,
                    font: { size: 18, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatNumber(context.parsed.y, 2);
                        }
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
        }
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
    
    volumeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Volume',
                data: data.map(d => d.Volume),
                backgroundColor: 'rgba(118, 75, 162, 0.6)',
                borderColor: 'rgb(118, 75, 162)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 3,
            plugins: {
                title: {
                    display: true,
                    text: `${symbol} - Volume Chart`,
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: false
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
                    yAxisID: 'y'
                },
                {
                    label: 'MACD',
                    data: data.map(d => d.MACD),
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y1'
                },
                {
                    label: 'MACD Signal',
                    data: data.map(d => d.MACD_Signal),
                    borderColor: 'rgb(255, 99, 132)',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y1'
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
                    position: 'top'
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

function loadChart(symbol) {
    hideError();
    showLoader();
    
    if (!allData[symbol]) {
        hideLoader();
        showError(`No data available for ${symbol}. Please run fetch_data.py to collect data.`);
        return;
    }
    
    const indexData = allData[symbol];
    
    updateInfoPanel(indexData.summary);
    createPriceChart(indexData.data, symbol);
    createVolumeChart(indexData.data, symbol);
    createIndicatorsChart(indexData.data, symbol);
    
    hideLoader();
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
    }
});
