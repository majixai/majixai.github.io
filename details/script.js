
const LOADER = document.getElementById('loader');
const TITLE = document.getElementById('title');
const REGRESSION_RESULTS = document.getElementById('regression-results');
const CHART_CANVAS = document.getElementById('price-chart');

async function main() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const dbPath = decodeURIComponent(urlParams.get('dbPath'));
        const query = decodeURIComponent(urlParams.get('query'));
        const params = JSON.parse(decodeURIComponent(urlParams.get('params')));
        const title = decodeURIComponent(urlParams.get('title'));
        const xCol = decodeURIComponent(urlParams.get('xCol'));
        const yCol = decodeURIComponent(urlParams.get('yCol')).split(',');

        TITLE.textContent = title;

        const SQL = await initSqlJs({
            locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
        });

        LOADER.textContent = 'Fetching and decompressing database...';
        const response = await fetch(dbPath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const compressedData = new Uint8Array(await response.arrayBuffer());
        const decompressedData = pako.inflate(compressedData);

        LOADER.textContent = 'Loading database...';
        const db = new SQL.Database(decompressedData);

        LOADER.textContent = 'Querying data...';
        const stmt = db.prepare(query);
        stmt.bind(params);

        const chartData = {
            labels: [],
            datasets: yCol.map(col => ({
                label: col,
                data: [],
                borderColor: '#' + Math.floor(Math.random()*16777215).toString(16),
                fill: false
            }))
        };

        const regressionData = [];

        while (stmt.step()) {
            const row = stmt.getAsObject();
            chartData.labels.push(row[xCol]);
            yCol.forEach((col, index) => {
                chartData.datasets[index].data.push(row[col]);
            });
            regressionData.push([new Date(row[xCol]).getTime(), Number(row[yCol[0]])]);
        }
        stmt.free();

        LOADER.style.display = 'none';

        new Chart(CHART_CANVAS, {
            type: 'line',
            data: chartData,
            options: {
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        }
                    }
                }
            }
        });

        performRegression(regressionData);

    } catch (error) {
        LOADER.textContent = `Error: ${error.message}`;
        console.error(error);
    }
}

function performRegression(data) {
    if (data.length < 2) {
        REGRESSION_RESULTS.textContent = 'Insufficient data for regression analysis.';
        return;
    }
    const regression = ss.linearRegression(data);
    const regressionLine = ss.linearRegressionLine(regression);

    REGRESSION_RESULTS.textContent = `
        Slope (m): ${regression.m.toFixed(4)}
        Intercept (b): ${regression.b.toFixed(4)}
        R-squared (r²): ${ss.rSquared(data, regressionLine).toFixed(4)}
    `;
}

main();
