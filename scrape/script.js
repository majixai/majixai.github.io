const DB_URL = 'finance.db.gz';

const LOADER = document.getElementById('loader');
const STATUS = document.getElementById('status');
const DATA_CONTAINER = document.getElementById('data-container');
const TICKER_ROWS_CONTAINER = document.getElementById('ticker-rows');
const CHART_TITLE = document.getElementById('chart-title');
const CHART_SUBTITLE = document.getElementById('chart-subtitle');
const SELECTED_TICKER = document.getElementById('selected-ticker');
const PRICE_CHART = document.getElementById('price-chart');

const SEARCH_INPUT = document.getElementById('search');
const SORT_SELECT = document.getElementById('sort');
const LIMIT_SELECT = document.getElementById('limit');
const Y_FIELD_SELECT = document.getElementById('y-field');
const CHART_TYPE_SELECT = document.getElementById('chart-type');
const RANGE_SELECT = document.getElementById('range');
const SHOW_POINTS_CHECKBOX = document.getElementById('show-points');
const NORMALIZE_CHECKBOX = document.getElementById('normalize');
const LOG_SCALE_CHECKBOX = document.getElementById('log-scale');
const EXPORT_CSV_BUTTON = document.getElementById('export-csv');
const RESET_ZOOM_BUTTON = document.getElementById('reset-zoom');
const THEME_TOGGLE_BUTTON = document.getElementById('theme-toggle');

const PREFERRED_Y_FIELDS = ['price', 'change', 'change_percent', 'volume', 'market_cap'];
const RANGE_MS = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000
};

let db;
let priceColumns = [];
let latestRows = [];
let selectedTicker = null;
let selectedTickerRawRows = [];
let selectedTickerColumns = [];
let chart;
let selectedRowElement = null;
let displayedSeries = [];
let displayedYField = null;
let tickerStmt;
const tickerCache = new Map();

function escapeHtml(value) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return String(value ?? '').replace(/[&<>"']/g, (char) => map[char]);
}

function showStatus(message, type = 'info') {
    if (!message) {
        STATUS.hidden = true;
        STATUS.textContent = '';
        STATUS.className = 'status';
        return;
    }

    STATUS.hidden = false;
    STATUS.textContent = message;
    STATUS.className = `status ${type}`;
}

function parseNumeric(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    let text = String(value).trim();
    if (!text) {
        return null;
    }

    let sign = 1;
    if (/^\(.*\)$/.test(text)) {
        sign = -1;
        text = text.slice(1, -1);
    }

    const suffix = text.slice(-1).toUpperCase();
    let multiplier = 1;
    if (suffix === 'K') multiplier = 1e3;
    if (suffix === 'M') multiplier = 1e6;
    if (suffix === 'B') multiplier = 1e9;
    if (suffix === 'T') multiplier = 1e12;
    if (multiplier !== 1) text = text.slice(0, -1);

    const cleaned = text.replace(/[$,%\s,]/g, '');
    const numeric = Number.parseFloat(cleaned);
    if (!Number.isFinite(numeric)) {
        return null;
    }

    return sign * numeric * multiplier;
}

function parseScrapedAt(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        const ms = value < 1e12 ? value * 1000 : value;
        const date = new Date(ms);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    let text = String(value).trim();
    if (!text) {
        return null;
    }

    if (/^\d{4}-\d{2}-\d{2}\s/.test(text)) {
        text = text.replace(' ', 'T');
    }

    text = text.replace(/\.(\d{3})\d+/, '.$1');

    const candidates = [text];
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
        candidates.push(`${text}Z`);
    }

    for (const candidate of candidates) {
        const parsed = new Date(candidate);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }

    return null;
}

function formatCellValue(value) {
    if (value === null || value === undefined || value === '') {
        return '—';
    }
    return String(value);
}

function initializeChart() {
    if (window.ChartZoom) {
        Chart.register(window.ChartZoom);
    } else if (window['chartjs-plugin-zoom']) {
        Chart.register(window['chartjs-plugin-zoom']);
    }

    chart = new Chart(PRICE_CHART, {
        type: CHART_TYPE_SELECT.value,
        data: {
            datasets: [{
                label: 'No ticker selected',
                data: [],
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.16)',
                tension: 0.2,
                borderWidth: 2,
                pointRadius: SHOW_POINTS_CHECKBOX.checked ? 2 : 0,
                pointHoverRadius: 4,
                fill: CHART_TYPE_SELECT.value === 'line'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: false
            },
            parsing: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.parsed?.y;
                            if (value === null || value === undefined || Number.isNaN(value)) {
                                return 'No value';
                            }
                            return `${context.dataset.label}: ${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
                        }
                    }
                },
                zoom: {
                    pan: { enabled: true, mode: 'x', modifierKey: 'shift' },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        drag: { enabled: true },
                        mode: 'x'
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        tooltipFormat: 'PPpp'
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true
                    }
                },
                y: {
                    type: 'linear',
                    ticks: {
                        callback: (value) => Number(value).toLocaleString()
                    }
                }
            }
        }
    });
}

function setupThemeToggle() {
    if (!THEME_TOGGLE_BUTTON) {
        return;
    }

    const key = 'scrape-theme';
    const stored = localStorage.getItem(key);
    if (stored === 'dark') {
        document.body.dataset.theme = 'dark';
    }

    THEME_TOGGLE_BUTTON.addEventListener('click', () => {
        const isDark = document.body.dataset.theme === 'dark';
        if (isDark) {
            delete document.body.dataset.theme;
            localStorage.setItem(key, 'light');
        } else {
            document.body.dataset.theme = 'dark';
            localStorage.setItem(key, 'dark');
        }
    });
}

function normalizeText(value) {
    return String(value ?? '').toLowerCase();
}

function buildLatestRowsQuery() {
    return `
        SELECT ticker, name, price, scraped_at
        FROM prices p
        WHERE p.id = (
            SELECT MAX(id)
            FROM prices
            WHERE ticker = p.ticker
        )
        ORDER BY ticker
    `;
}

function queryRows(sql, bindParams = null) {
    const stmt = db.prepare(sql);
    if (bindParams) {
        stmt.bind(bindParams);
    }

    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }

    stmt.free();
    return rows;
}

function renderLatestTable() {
    const searchTerm = normalizeText(SEARCH_INPUT.value);
    const sortBy = SORT_SELECT.value;
    const limitValue = Number.parseInt(LIMIT_SELECT.value, 10);

    let filtered = latestRows.filter((row) => {
        if (!searchTerm) {
            return true;
        }

        const ticker = normalizeText(row.ticker);
        const name = normalizeText(row.name);
        return ticker.includes(searchTerm) || name.includes(searchTerm);
    });

    filtered.sort((a, b) => {
        if (sortBy === 'name') {
            return String(a.name ?? '').localeCompare(String(b.name ?? ''));
        }

        if (sortBy === 'price_desc') {
            return (parseNumeric(b.price) ?? Number.NEGATIVE_INFINITY) - (parseNumeric(a.price) ?? Number.NEGATIVE_INFINITY);
        }

        if (sortBy === 'price_asc') {
            return (parseNumeric(a.price) ?? Number.POSITIVE_INFINITY) - (parseNumeric(b.price) ?? Number.POSITIVE_INFINITY);
        }

        if (sortBy === 'scraped_desc') {
            return (parseScrapedAt(b.scraped_at)?.getTime() ?? 0) - (parseScrapedAt(a.scraped_at)?.getTime() ?? 0);
        }

        if (sortBy === 'scraped_asc') {
            return (parseScrapedAt(a.scraped_at)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (parseScrapedAt(b.scraped_at)?.getTime() ?? Number.MAX_SAFE_INTEGER);
        }

        return String(a.ticker ?? '').localeCompare(String(b.ticker ?? ''));
    });

    if (limitValue > 0) {
        filtered = filtered.slice(0, limitValue);
    }

    if (!filtered.length) {
        DATA_CONTAINER.innerHTML = '<div class="empty">No rows match your filter.</div>';
        return;
    }

    const rowsHtml = filtered.map((row) => {
        const ticker = String(row.ticker ?? '');
        const selectedClass = selectedTicker === ticker ? ' class="selected" aria-selected="true"' : ' aria-selected="false"';
        return `
            <tr role="row" tabindex="0" data-ticker="${escapeHtml(ticker)}"${selectedClass}>
                <td>
                    <button class="ticker-link" type="button" data-ticker="${escapeHtml(ticker)}" aria-label="Load ${escapeHtml(ticker)} history">${escapeHtml(ticker)}</button>
                </td>
                <td>${escapeHtml(formatCellValue(row.name))}</td>
                <td>${escapeHtml(formatCellValue(row.price))}</td>
                <td>${escapeHtml(formatCellValue(row.scraped_at))}</td>
            </tr>
        `;
    }).join('');

    DATA_CONTAINER.innerHTML = `
        <div class="table-wrap">
            <table class="latest-table" aria-label="Latest per ticker data">
                <thead>
                    <tr><th>Ticker</th><th>Name</th><th>Price</th><th>Scraped At</th></tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;

    bindTableInteractions();
}

function setSelectedRow(element) {
    if (selectedRowElement && selectedRowElement !== element) {
        selectedRowElement.classList.remove('selected');
        selectedRowElement.setAttribute('aria-selected', 'false');
    }

    selectedRowElement = element;
    if (selectedRowElement) {
        selectedRowElement.classList.add('selected');
        selectedRowElement.setAttribute('aria-selected', 'true');
    }
}

function bindTableInteractions() {
    const tableRows = DATA_CONTAINER.querySelectorAll('tbody tr');

    tableRows.forEach((row) => {
        row.addEventListener('click', (event) => {
            const ticker = event.target?.dataset?.ticker || row.dataset.ticker;
            if (!ticker) {
                return;
            }

            setSelectedRow(row);
            selectTicker(ticker);
        });

        row.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }

            event.preventDefault();
            const ticker = row.dataset.ticker;
            if (!ticker) {
                return;
            }

            setSelectedRow(row);
            selectTicker(ticker);
        });
    });
}

function escapeCsv(value) {
    const raw = value === null || value === undefined ? '' : String(value);
    if (/[,"\n]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
}

function exportDisplayedCsv() {
    if (!selectedTicker || !displayedSeries.length) {
        showStatus('Nothing to export yet. Select a ticker first.', 'info');
        return;
    }

    const yField = displayedYField || Y_FIELD_SELECT.value;
    const lines = ['ticker,scraped_at,date_iso,field,value'];
    for (const point of displayedSeries) {
        lines.push([
            escapeCsv(selectedTicker),
            escapeCsv(point.scraped_at),
            escapeCsv(point.date.toISOString()),
            escapeCsv(yField),
            escapeCsv(point.value)
        ].join(','));
    }

    const csvBlob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${selectedTicker}_${yField}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
}

function resolveYField(columns) {
    const selected = Y_FIELD_SELECT.value;

    if (columns.includes(selected)) {
        return { field: selected, warning: null };
    }

    const fallback = PREFERRED_Y_FIELDS.find((field) => columns.includes(field));
    if (fallback) {
        return {
            field: fallback,
            warning: `Column "${selected}" is not available for this dataset. Showing "${fallback}" instead.`
        };
    }

    return {
        field: null,
        warning: 'None of the supported Y-axis columns are available for this ticker.'
    };
}

function applyRange(points) {
    const range = RANGE_SELECT.value;
    if (range === 'all') {
        return points;
    }

    const ms = RANGE_MS[range];
    if (!ms || !points.length) {
        return points;
    }

    const maxTime = points[points.length - 1].date.getTime();
    const minTime = maxTime - ms;
    return points.filter((point) => point.date.getTime() >= minTime);
}

function applyNormalization(points) {
    if (!NORMALIZE_CHECKBOX.checked || !points.length) {
        return points;
    }

    const baseline = points[0].value;
    if (!Number.isFinite(baseline) || baseline === 0) {
        showStatus('Unable to normalize: first point is missing or zero.', 'warning');
        return points;
    }

    return points.map((point) => ({
        ...point,
        value: (point.value / baseline) * 100
    }));
}

function buildSeries(rows, columns) {
    const { field, warning } = resolveYField(columns);
    if (!field) {
        return { points: [], yField: null, warning };
    }

    const invalidTimestamps = { count: 0 };
    const invalidY = { count: 0 };

    let points = rows.map((row) => {
        const date = parseScrapedAt(row.scraped_at);
        if (!date) {
            invalidTimestamps.count += 1;
            return null;
        }

        const value = parseNumeric(row[field]);
        if (!Number.isFinite(value)) {
            invalidY.count += 1;
            return null;
        }

        return {
            ticker: row.ticker,
            scraped_at: row.scraped_at,
            date,
            value
        };
    }).filter(Boolean);

    points.sort((a, b) => a.date - b.date);
    points = applyRange(points);
    points = applyNormalization(points);

    let status = warning || null;
    if (invalidTimestamps.count > 0 || invalidY.count > 0) {
        const pieces = [];
        if (invalidTimestamps.count > 0) {
            pieces.push(`${invalidTimestamps.count} row(s) had invalid scraped_at`);
        }
        if (invalidY.count > 0) {
            pieces.push(`${invalidY.count} row(s) had invalid ${field}`);
        }
        const invalidMessage = `${pieces.join('; ')} and were skipped.`;
        status = status ? `${status} ${invalidMessage}` : invalidMessage;
    }

    return { points, yField: field, warning: status };
}

function updateChart() {
    if (!selectedTickerRawRows.length) {
        displayedSeries = [];
        displayedYField = null;
        chart.data.datasets[0].label = 'No data';
        chart.data.datasets[0].data = [];
        chart.update();
        return;
    }

    const { points, yField, warning } = buildSeries(selectedTickerRawRows, selectedTickerColumns);
    displayedSeries = points;
    displayedYField = yField;

    if (warning) {
        showStatus(warning, 'warning');
    } else {
        showStatus('');
    }

    if (!points.length || !yField) {
        chart.data.datasets[0].label = `${selectedTicker} (${Y_FIELD_SELECT.value})`;
        chart.data.datasets[0].data = [];
        chart.update();
        CHART_SUBTITLE.textContent = 'No plottable points found for current settings.';
        return;
    }

    const useLogScale = LOG_SCALE_CHECKBOX.checked;
    const hasNonPositive = points.some((point) => point.value <= 0);
    chart.options.scales.y.type = useLogScale && !hasNonPositive ? 'logarithmic' : 'linear';

    if (useLogScale && hasNonPositive) {
        showStatus('Log scale requires positive values only. Falling back to linear scale.', 'warning');
    }

    const chartType = CHART_TYPE_SELECT.value;
    chart.config.type = chartType;

    chart.data.datasets[0].label = `${selectedTicker} ${yField}`;
    chart.data.datasets[0].data = points.map((point) => ({ x: point.date, y: point.value }));
    chart.data.datasets[0].pointRadius = SHOW_POINTS_CHECKBOX.checked ? 2 : 0;
    chart.data.datasets[0].pointHoverRadius = SHOW_POINTS_CHECKBOX.checked ? 4 : 2;
    chart.data.datasets[0].showLine = chartType !== 'scatter';
    chart.data.datasets[0].fill = chartType === 'line';

    chart.update();

    const range = RANGE_SELECT.value === 'all' ? 'all' : `range: ${RANGE_SELECT.value}`;
    const normalized = NORMALIZE_CHECKBOX.checked ? 'normalized' : 'raw';
    CHART_SUBTITLE.textContent = `${points.length} points • ${range} • ${normalized} • Y: ${yField}`;
}

function renderTickerRows(columns, rows) {
    if (!rows.length) {
        TICKER_ROWS_CONTAINER.innerHTML = '<div class="empty">No rows found for the selected ticker.</div>';
        return;
    }

    const headerHtml = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
    const bodyHtml = rows.map((row) => {
        const cells = columns.map((column) => `<td>${escapeHtml(formatCellValue(row[column]))}</td>`).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    TICKER_ROWS_CONTAINER.innerHTML = `
        <div class="table-wrap">
            <table class="raw-table" aria-label="Raw rows for selected ticker">
                <thead><tr>${headerHtml}</tr></thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        </div>
    `;
}

function getTickerData(ticker) {
    if (tickerCache.has(ticker)) {
        return tickerCache.get(ticker);
    }

    if (!tickerStmt) {
        tickerStmt = db.prepare('SELECT * FROM prices WHERE ticker = :ticker ORDER BY scraped_at, id');
    }

    tickerStmt.reset();
    tickerStmt.bind({ ':ticker': ticker });

    const columns = tickerStmt.getColumnNames();
    const rows = [];
    while (tickerStmt.step()) {
        rows.push(tickerStmt.getAsObject());
    }

    const payload = { columns, rows };
    tickerCache.set(ticker, payload);
    return payload;
}

function selectTicker(ticker) {
    try {
        selectedTicker = ticker;
        SELECTED_TICKER.textContent = ticker;
        CHART_TITLE.textContent = `${ticker} full history`;

        const { columns, rows } = getTickerData(ticker);
        selectedTickerColumns = columns;
        selectedTickerRawRows = rows;

        if (!rows.length) {
            showStatus(`No rows found for ${ticker}.`, 'warning');
            CHART_SUBTITLE.textContent = 'No data available.';
            renderTickerRows(columns, rows);
            updateChart();
            return;
        }

        renderTickerRows(columns, rows);
        updateChart();
    } catch (error) {
        console.error(error);
        showStatus(`Failed to load ticker ${ticker}: ${error.message}`, 'error');
    }
}

function attachControlHandlers() {
    SEARCH_INPUT.addEventListener('input', renderLatestTable);
    SORT_SELECT.addEventListener('change', renderLatestTable);
    LIMIT_SELECT.addEventListener('change', renderLatestTable);

    const chartControlHandler = () => {
        if (!selectedTicker) {
            return;
        }
        updateChart();
    };

    Y_FIELD_SELECT.addEventListener('change', chartControlHandler);
    CHART_TYPE_SELECT.addEventListener('change', chartControlHandler);
    RANGE_SELECT.addEventListener('change', chartControlHandler);
    SHOW_POINTS_CHECKBOX.addEventListener('change', chartControlHandler);
    NORMALIZE_CHECKBOX.addEventListener('change', chartControlHandler);
    LOG_SCALE_CHECKBOX.addEventListener('change', chartControlHandler);

    EXPORT_CSV_BUTTON.addEventListener('click', exportDisplayedCsv);
    RESET_ZOOM_BUTTON.addEventListener('click', () => {
        if (chart?.resetZoom) {
            chart.resetZoom();
        }
    });
}

async function loadDatabase() {
    const SQL = await initSqlJs({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
    });

    const response = await fetch(`${DB_URL}?t=${Date.now()}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const compressedData = new Uint8Array(await response.arrayBuffer());
    const decompressedData = pako.inflate(compressedData);
    db = new SQL.Database(decompressedData);

    const schemaStmt = db.prepare('PRAGMA table_info(prices)');
    const columns = [];
    while (schemaStmt.step()) {
        columns.push(schemaStmt.getAsObject().name);
    }
    schemaStmt.free();
    priceColumns = columns;
}

async function main() {
    try {
        setupThemeToggle();
        attachControlHandlers();

        LOADER.textContent = 'Fetching and decompressing database...';
        await loadDatabase();

        LOADER.textContent = 'Querying latest rows...';
        latestRows = queryRows(buildLatestRowsQuery());

        initializeChart();
        renderLatestTable();
        LOADER.style.display = 'none';

        if (!priceColumns.includes('scraped_at')) {
            showStatus('Column "scraped_at" is missing in prices table; charting is limited.', 'warning');
        }
    } catch (error) {
        LOADER.textContent = `Error: ${error.message}`;
        showStatus(`Failed to load scrape data: ${error.message}`, 'error');
        console.error(error);
    }
}

main();
