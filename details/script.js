
const LOADER = document.getElementById('loader');
const TITLE = document.getElementById('title');
const REGRESSION_RESULTS = document.getElementById('regression-results');
const CHART_CANVAS = document.getElementById('price-chart');

async function main() {
    try {
        // --- 1. Get parameters from URL ---
        const urlParams = new URLSearchParams(window.location.search);
        // The dbPath should be relative from the details page, e.g., '../requests/finance.dat'
        const dbPath = `../requests/${decodeURIComponent(urlParams.get('dbPath'))}`;
        const query = decodeURIComponent(urlParams.get('query'));
        // Params are not used in the new schema but kept for compatibility
        const params = JSON.parse(decodeURIComponent(urlParams.get('params')) || '{}');
        const title = decodeURIComponent(urlParams.get('title'));
        // xCol will now be 'time'
        const xCol = decodeURIComponent(urlParams.get('xCol'));
        // yCol can be multiple comma-separated values like 'price,MA_50'
        const yCol = decodeURIComponent(urlParams.get('yCol')).split(',');

        TITLE.textContent = title;

        // --- 2. Initialize SQL.js ---
        const SQL = await initSqlJs({
            locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
        });

        // --- 3. Fetch and decompress the database ---
        LOADER.textContent = 'Fetching and decompressing database...';
        // Add cache-busting query parameter to ensure latest data is fetched
        const response = await fetch(`${dbPath}?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const compressedData = new Uint8Array(await response.arrayBuffer());
        const decompressedData = pako.inflate(compressedData);

        // --- 4. Load the database and execute the query ---
        LOADER.textContent = 'Loading database...';
        const db = new SQL.Database(decompressedData);

        LOADER.textContent = 'Querying data...';
        const stmt = db.prepare(query);
        // Binding is kept for potential future use or complex queries
        if (Object.keys(params).length > 0) {
            stmt.bind(params);
        }

        // --- 5. Process the data for charting and regression ---
        const chartData = {
            labels: [],
            // Create a dataset for each column specified in the yCol parameter
            datasets: yCol.map((col, index) => ({
                label: col.toUpperCase(), // e.g., PRICE, MA_50
                data: [],
                // Use distinct colors for each line
                borderColor: index === 0 ? 'rgb(75, 192, 192)' : 'rgb(255, 99, 132)',
                backgroundColor: index === 0 ? 'rgba(75, 192, 192, 0.2)' : 'rgba(255, 99, 132, 0.2)',
                fill: false,
                tension: 0.1
            }))
        };

        const regressionData = [];

        while (stmt.step()) {
            const row = stmt.getAsObject();
            const xValue = row[xCol]; // This will be the 'time' value
            chartData.labels.push(xValue);

            yCol.forEach((col, index) => {
                chartData.datasets[index].data.push(Number(row[col]));
            });

            // Regression is performed on the first y-axis column (usually the price)
            // Ensure data is in the format [timestamp_ms, value]
            regressionData.push([new Date(xValue).getTime(), Number(row[yCol[0]])]);
        }
        stmt.free();

        LOADER.style.display = 'none';

        // --- 6. Render the chart ---
        new Chart(CHART_CANVAS, {
            type: 'line',
            data: chartData,
            options: {
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            tooltipFormat: 'MMM dd, yyyy'
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                       title: {
                           display: true,
                           text: 'Price (USD)'
                       }
                    }
                }
            }
        });

        // --- 7. Perform and display regression analysis ---
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
    // Perform linear regression: y = mx + b
    const regression = ss.linearRegression(data);
    const regressionLine = ss.linearRegressionLine(regression);

    // Calculate R-squared value to measure the fit of the model
    const rSquared = ss.rSquared(data, regressionLine);

    REGRESSION_RESULTS.innerHTML = `
        <p><strong>Linear Regression (y = mx + b)</strong></p>
        <ul>
            <li>Slope (m): <code>${regression.m.toFixed(4)}</code></li>
            <li>Intercept (b): <code>${regression.b.toFixed(4)}</code></li>
            <li>R-squared (r²): <code>${rSquared.toFixed(4)}</code></li>
        </ul>
    `;
}

main();
