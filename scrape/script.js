/**
 * scrape/script.js — Scraped Financial Data Viewer (overhauled)
 *
 * Architecture:
 *   • ES module: imports the root-level MajixAI Router for URL-state management
 *     and breadcrumb navigation.
 *   • Uses MajixProbability (probability/probability-core.js) for statistical
 *     analytics: mean, variance, autocorrelation, OU parameter estimation,
 *     GBM volatility, Monte-Carlo stats.
 *   • Uses MajixInformation (information_theory/information-core.js) for
 *     Shannon entropy and approximate entropy of the return series.
 *   • Uses MajixOptimization (optimization/optimization-core.js) for
 *     gradient-based trend fitting.
 *   • Inline OLS for the trend-line overlay (keeps it fast for large series).
 *   • Inline SMA / EMA / Bollinger-Band computation for chart overlays.
 *
 * Key fixes vs. previous version:
 *   1. Dynamic Y-field detection: ALL numeric columns found in the DB schema
 *      are offered as Y-axis choices — not a hardcoded list.
 *   2. Dynamic date-column detection: any column whose name contains "date",
 *      "time", "at", or "stamp" is tried as the X-axis; the first parseable
 *      one wins.  Rows are no longer silently dropped just because
 *      `scraped_at` is absent.
 *   3. Multi-series chart: SMA 20, SMA 50, EMA 20, Bollinger Bands, and an
 *      OLS trend line can be overlaid simultaneously.
 *   4. "All numeric fields" mode renders every detected numeric column as its
 *      own dataset in one chart.
 *   5. URL state: ?ticker=AAPL&field=price&range=30d&chart=line&overlays=sma20
 *      is both written on change and read on load, so links are shareable.
 *   6. Analytics panel below the chart: summary stats, trend slope & R²,
 *      daily volatility, annualised vol, Sharpe proxy, lag-1 autocorrelation,
 *      Shannon entropy of returns, OU mean-reversion parameters.
 */

import router from '../router/router.js';

// ─── Shorthand ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const LOADER          = $('loader');
const STATUS          = $('status');
const DATA_CONTAINER  = $('data-container');
const TICKER_ROWS     = $('ticker-rows');
const CHART_TITLE     = $('chart-title');
const CHART_SUBTITLE  = $('chart-subtitle');
const SEL_TICKER      = $('selected-ticker');
const PRICE_CANVAS    = $('price-chart');

const SEARCH_INPUT    = $('search');
const SORT_SELECT     = $('sort');
const LIMIT_SELECT    = $('limit');
const Y_FIELD_SELECT  = $('y-field');
const CHART_TYPE_SEL  = $('chart-type');
const RANGE_SELECT    = $('range');
const SHOW_POINTS_CB  = $('show-points');
const NORMALIZE_CB    = $('normalize');
const LOG_SCALE_CB    = $('log-scale');
const EXPORT_BTN      = $('export-csv');
const RESET_ZOOM_BTN  = $('reset-zoom');
const THEME_BTN       = $('theme-toggle');
const ANALYTICS_PANEL = $('analytics-panel');
const BACK_LINK       = $('back-link');

const OVL_SMA20       = $('overlay-sma20');
const OVL_SMA50       = $('overlay-sma50');
const OVL_EMA20       = $('overlay-ema20');
const OVL_BB          = $('overlay-bb');
const OVL_TREND       = $('overlay-trend');
const MULTI_FIELD_CB  = $('multi-field');

// ─── Constants ────────────────────────────────────────────────────────────────
const DB_URL = 'finance.db.gz';

const RANGE_MS = {
    '7d':  7   * 86400000,
    '30d': 30  * 86400000,
    '90d': 90  * 86400000,
    '1y':  365 * 86400000,
};

const DATASET_COLORS = [
    '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
];

const OVERLAY_COLORS = {
    sma20:    '#f59e0b',
    sma50:    '#10b981',
    ema20:    '#3b82f6',
    bb_upper: 'rgba(239,68,68,0.55)',
    bb_lower: 'rgba(239,68,68,0.55)',
    bb_mid:   'rgba(239,68,68,0.25)',
    trend:    '#a855f7',
};

// Columns that are never interesting as a numeric Y-axis
const SKIP_COLS = new Set([
    'id', 'rowid', 'ticker', 'symbol', 'name', 'description',
    'exchange', 'sector', 'industry', 'currency', 'country',
]);

// Candidate column names for the X-axis (date/time)
const DATE_COL_PATTERNS = [
    /scraped_at/i, /date/i, /time/i, /timestamp/i, /datetime/i, /at$/i,
];

// ─── State ────────────────────────────────────────────────────────────────────
let db              = null;
let schemaColumns   = [];      // all column names in `prices`
let numericColumns  = [];      // subset that look numeric
let dateColumn      = null;    // best column to use as X-axis
let latestRows      = [];      // one row per ticker (overview)
let selectedTicker  = null;
let selectedRows    = [];
let selectedColumns = [];
let chart           = null;
let selectedRowEl   = null;
const tickerCache   = new Map();

// ─── Utilities ────────────────────────────────────────────────────────────────
function escHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function parseNumeric(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let s = String(v).trim();
    let sign = 1;
    if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
    const suffix = s.slice(-1).toUpperCase();
    let mul = 1;
    if (suffix === 'K') { mul = 1e3;  s = s.slice(0, -1); }
    if (suffix === 'M') { mul = 1e6;  s = s.slice(0, -1); }
    if (suffix === 'B') { mul = 1e9;  s = s.slice(0, -1); }
    if (suffix === 'T') { mul = 1e12; s = s.slice(0, -1); }
    const n = Number.parseFloat(s.replace(/[$,%\s,]/g, ''));
    return Number.isFinite(n) ? sign * n * mul : null;
}

function parseDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number' && Number.isFinite(v)) {
        const ms = v < 1e12 ? v * 1000 : v;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    let s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}\s/.test(s)) s = s.replace(' ', 'T');
    s = s.replace(/\.(\d{3})\d+/, '.$1');
    const attempts = [s];
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) attempts.push(`${s}Z`);
    for (const a of attempts) {
        const d = new Date(a);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
}

function fmtNum(v, digits = 4) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtCell(v) {
    return v === null || v === undefined || v === '' ? '—' : String(v);
}

// ─── DB Layer ─────────────────────────────────────────────────────────────────
async function loadDatabase() {
    const SQL = await initSqlJs({
        locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${f}`,
    });
    const res = await fetch(`${DB_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const compressed = new Uint8Array(await res.arrayBuffer());
    const raw = pako.inflate(compressed);
    db = new SQL.Database(raw);
}

function detectSchema() {
    // Get all column names
    const schemaQ = db.prepare('PRAGMA table_info(prices)');
    const cols = [];
    while (schemaQ.step()) {
        cols.push(schemaQ.getAsObject());
    }
    schemaQ.free();
    schemaColumns = cols.map(c => c.name);

    // Detect best date column
    for (const pat of DATE_COL_PATTERNS) {
        const match = schemaColumns.find(c => pat.test(c));
        if (match) { dateColumn = match; break; }
    }
    // Fallback: try every column and see if a sample value parses as date
    if (!dateColumn) {
        const sample = queryRows('SELECT * FROM prices LIMIT 5');
        for (const col of schemaColumns) {
            if (SKIP_COLS.has(col.toLowerCase())) continue;
            if (sample.some(r => parseDate(r[col]) !== null)) {
                dateColumn = col;
                break;
            }
        }
    }

    // Detect numeric columns from a sample
    const sample = queryRows('SELECT * FROM prices LIMIT 30');
    numericColumns = schemaColumns.filter(col => {
        if (SKIP_COLS.has(col.toLowerCase())) return false;
        if (col === dateColumn) return false;
        const vals = sample.map(r => r[col]).filter(v => v != null && v !== '');
        if (!vals.length) return false;
        return vals.filter(v => parseNumeric(v) !== null).length >= vals.length * 0.5;
    });

    // Populate Y-field selector
    Y_FIELD_SELECT.innerHTML = '';
    numericColumns.forEach((col, i) => {
        const opt = document.createElement('option');
        opt.value = col;
        opt.textContent = col;
        if (i === 0) opt.selected = true;
        Y_FIELD_SELECT.appendChild(opt);
    });

    if (!numericColumns.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(no numeric columns found)';
        opt.disabled = true;
        Y_FIELD_SELECT.appendChild(opt);
    }
}

function queryRows(sql, params = null) {
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

function buildLatestQuery() {
    // Pick the date column for sorting if available
    const dateOrder = dateColumn ? `, ${dateColumn} DESC` : '';
    return `
        SELECT *
        FROM prices p
        WHERE p.id = (
            SELECT MAX(id) FROM prices WHERE ticker = p.ticker
        )
        ORDER BY ticker${dateOrder}
    `;
}

function getTickerData(ticker) {
    if (tickerCache.has(ticker)) return tickerCache.get(ticker);
    const dateOrder = dateColumn ? `, ${dateColumn}` : '';
    const stmt = db.prepare(
        `SELECT * FROM prices WHERE ticker = :ticker ORDER BY id${dateOrder}`
    );
    stmt.bind({ ':ticker': ticker });
    const columns = stmt.getColumnNames();
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    const payload = { columns, rows };
    tickerCache.set(ticker, payload);
    return payload;
}

// ─── Series Builder ───────────────────────────────────────────────────────────
/**
 * Build a sorted array of { date, value, raw } for a given field.
 * Returns { points, skippedDate, skippedValue, total, field }.
 */
function buildSeries(rows, field) {
    let skippedDate = 0, skippedValue = 0;
    const xCol = dateColumn;
    const points = [];

    for (const row of rows) {
        const date = xCol ? parseDate(row[xCol]) : null;
        if (!date) { skippedDate++; continue; }

        const value = parseNumeric(row[field]);
        if (!Number.isFinite(value)) { skippedValue++; continue; }

        points.push({ date, value, raw: row });
    }

    points.sort((a, b) => a.date - b.date);
    return { points, skippedDate, skippedValue, total: rows.length, field };
}

function applyRange(points) {
    const range = RANGE_SELECT.value;
    if (range === 'all' || !points.length) return points;
    const ms = RANGE_MS[range];
    if (!ms) return points;
    const maxT = points[points.length - 1].date.getTime();
    return points.filter(p => p.date.getTime() >= maxT - ms);
}

function applyNormalize(points) {
    if (!NORMALIZE_CB.checked || !points.length) return points;
    const base = points[0].value;
    if (!Number.isFinite(base) || base === 0) {
        showStatus('Cannot normalize: first value is 0 or missing.', 'warning');
        return points;
    }
    return points.map(p => ({ ...p, value: (p.value / base) * 100 }));
}

// ─── Math / Indicators ────────────────────────────────────────────────────────
/** Simple Moving Average. Returns array aligned with `values` (nulls for warm-up). */
function computeSMA(values, period) {
    const result = new Array(values.length).fill(null);
    for (let i = period - 1; i < values.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j];
        result[i] = sum / period;
    }
    return result;
}

/** Exponential Moving Average. */
function computeEMA(values, period) {
    const result = new Array(values.length).fill(null);
    const k = 2 / (period + 1);
    let ema = null;
    for (let i = 0; i < values.length; i++) {
        if (ema === null) {
            // Seed with first value
            ema = values[i];
        } else {
            ema = values[i] * k + ema * (1 - k);
        }
        if (i >= period - 1) result[i] = ema;
    }
    return result;
}

/** Bollinger Bands (SMA ± k·σ). */
function computeBollingerBands(values, period = 20, k = 2) {
    const upper  = new Array(values.length).fill(null);
    const middle = new Array(values.length).fill(null);
    const lower  = new Array(values.length).fill(null);
    for (let i = period - 1; i < values.length; i++) {
        const slice = values.slice(i - period + 1, i + 1);
        const mean  = slice.reduce((s, x) => s + x, 0) / period;
        const std   = Math.sqrt(slice.reduce((s, x) => s + (x - mean) ** 2, 0) / period);
        middle[i]   = mean;
        upper[i]    = mean + k * std;
        lower[i]    = mean - k * std;
    }
    return { upper, middle, lower };
}

/**
 * OLS trend line over time-indexed points.
 * x = index 0..n-1, y = values.
 * Returns { slope, intercept, r2, predicted[] }.
 */
function computeTrendLine(values) {
    const n = values.length;
    if (n < 2) return null;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    for (let i = 0; i < n; i++) {
        sx  += i;
        sy  += values[i];
        sxy += i * values[i];
        sx2 += i * i;
    }
    const denom = n * sx2 - sx * sx;
    if (Math.abs(denom) < 1e-12) return null;
    const slope     = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    const predicted = Array.from({ length: n }, (_, i) => slope * i + intercept);
    const yMean     = sy / n;
    const ssTot     = values.reduce((s, y) => s + (y - yMean) ** 2, 0);
    const ssRes     = values.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0);
    const r2        = ssTot > 1e-12 ? 1 - ssRes / ssTot : 0;
    return { slope, intercept, r2, predicted };
}

/**
 * Estimate Ornstein-Uhlenbeck parameters from a discrete time series
 * using AR(1) regression (method of moments).
 * Returns { kappa, mu, sigma } or null if not enough data.
 */
function estimateOU(values, dt = 1) {
    const n = values.length - 1;
    if (n < 10 || typeof MajixProbability === 'undefined') return null;
    const x = values.slice(0, n);
    const y = values.slice(1);
    const mx = MajixProbability.mean(x);
    const my = MajixProbability.mean(y);
    let cov = 0, varx = 0;
    for (let i = 0; i < n; i++) {
        cov  += (x[i] - mx) * (y[i] - my);
        varx += (x[i] - mx) ** 2;
    }
    if (varx < 1e-14) return null;
    const a         = cov / varx;
    const b         = my - a * mx;
    const kappa     = -Math.log(Math.abs(a)) / dt;
    const mu        = Math.abs(1 - a) > 1e-10 ? b / (1 - a) : mx;
    const eps       = y.map((yi, i) => yi - a * x[i] - b);
    const sigmaEps  = Math.sqrt(Math.max(0, MajixProbability.variance(eps)));
    const denom2    = 1 - a * a;
    const sigma     = denom2 > 1e-14 ? sigmaEps * Math.sqrt(2 * kappa / denom2) : sigmaEps;
    return { kappa, mu, sigma, a, r2ar: 1 - (sigmaEps ** 2 * n) / (varx + 1e-14) };
}

/**
 * Compute simple period-over-period returns: (v[i] - v[i-1]) / |v[i-1]|.
 * Uses the absolute value of the denominator to handle negative price series
 * (e.g., spread or synthetic data) while still producing a signed return.
 * An epsilon guard prevents division by zero for near-zero values.
 */
function computeReturns(values) {
    return values.slice(1).map((v, i) => (v - values[i]) / (Math.abs(values[i]) + 1e-10));
}

/**
 * Compute Shannon entropy of the binned returns distribution.
 * Uses MajixInformation if available, otherwise computes inline.
 */
function returnsEntropy(values) {
    if (values.length < 5) return null;
    const returns = computeReturns(values);
    if (!returns.length) return null;
    const mn  = Math.min(...returns);
    const mx  = Math.max(...returns);
    const rng = mx - mn + 1e-10;
    const nB  = Math.max(4, Math.min(30, Math.ceil(Math.sqrt(returns.length))));
    const cnt = new Array(nB).fill(0);
    returns.forEach(r => {
        const bin = Math.min(Math.floor((r - mn) / rng * nB), nB - 1);
        cnt[bin]++;
    });
    const probs = cnt.map(c => c / returns.length);
    if (typeof MajixInformation !== 'undefined') {
        return MajixInformation.entropy(probs);
    }
    return -probs.reduce((s, p) => p > 0 ? s + p * Math.log2(p + 1e-300) : s, 0);
}

/** Daily returns statistics using MajixProbability where available. */
function computeVolatility(values) {
    if (values.length < 2) return null;
    const returns = computeReturns(values);
    let mu, sigma;
    if (typeof MajixProbability !== 'undefined') {
        mu    = MajixProbability.mean(returns);
        sigma = Math.sqrt(MajixProbability.variance(returns));
    } else {
        mu    = returns.reduce((s, r) => s + r, 0) / returns.length;
        sigma = Math.sqrt(returns.reduce((s, r) => s + (r - mu) ** 2, 0) / Math.max(1, returns.length - 1));
    }
    const annVol   = sigma * Math.sqrt(252);
    const sharpe   = sigma > 1e-10 ? (mu * 252) / (sigma * Math.sqrt(252)) : null;
    let ac1 = null;
    if (typeof MajixProbability !== 'undefined' && returns.length >= 3) {
        ac1 = MajixProbability.autocorrelation(returns, 1);
    }
    return { mu, sigma, annVol, sharpe, ac1, nReturns: returns.length };
}

// ─── Analytics Panel ─────────────────────────────────────────────────────────
function renderAnalytics(points) {
    if (!ANALYTICS_PANEL) return;
    if (!points.length) {
        ANALYTICS_PANEL.innerHTML = '<div class="analytics-empty">Not enough data to compute analytics.</div>';
        return;
    }

    const values  = points.map(p => p.value);
    const n       = values.length;
    const mn      = Math.min(...values);
    const mx      = Math.max(...values);
    const mu      = typeof MajixProbability !== 'undefined'
        ? MajixProbability.mean(values)
        : values.reduce((s, v) => s + v, 0) / n;
    const variance = typeof MajixProbability !== 'undefined'
        ? MajixProbability.variance(values)
        : values.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(1, n - 1);
    const sigma    = Math.sqrt(Math.max(0, variance));

    const trend    = computeTrendLine(values);
    const vol      = computeVolatility(values);
    const ou       = estimateOU(values);
    const entropyV = returnsEntropy(values);

    const rows = [
        ['Observations', n],
        ['Min', fmtNum(mn)],
        ['Max', fmtNum(mx)],
        ['Mean', fmtNum(mu)],
        ['Std Dev', fmtNum(sigma)],
        trend ? ['Trend slope (per step)', fmtNum(trend.slope, 6)] : null,
        trend ? ['Trend R²', fmtNum(trend.r2, 4)] : null,
        vol   ? ['Daily vol (σ)', fmtNum(vol.sigma, 5)] : null,
        vol   ? ['Ann. vol (√252·σ)', fmtNum(vol.annVol, 4)] : null,
        vol   ? ['Sharpe proxy', fmtNum(vol.sharpe, 3)] : null,
        vol   ? ['Lag-1 autocorr', fmtNum(vol.ac1, 4)] : null,
        entropyV !== null ? ['Returns entropy (bits)', fmtNum(entropyV, 4)] : null,
        ou ? ['OU κ (mean-reversion speed)', fmtNum(ou.kappa, 5)] : null,
        ou ? ['OU μ (equilibrium)', fmtNum(ou.mu, 4)] : null,
        ou ? ['OU σ (vol)', fmtNum(ou.sigma, 5)] : null,
    ].filter(Boolean);

    const html = rows.map(([label, val]) => `
        <div class="analytics-row">
            <span class="analytics-label">${escHtml(label)}</span>
            <span class="analytics-value">${escHtml(String(val))}</span>
        </div>
    `).join('');

    ANALYTICS_PANEL.innerHTML = `<div class="analytics-grid">${html}</div>`;

    // Open the details panel automatically
    const det = $('analytics-details');
    if (det) det.open = true;
}

// ─── Chart Engine ─────────────────────────────────────────────────────────────
function registerZoomPlugin() {
    const plugin = window.ChartZoom || window['chartjs-plugin-zoom'];
    if (plugin) {
        try { Chart.register(plugin); } catch (_) { /* already registered */ }
    }
}

function makeDatasetBase(label, color, fill = false) {
    return {
        label,
        data: [],
        borderColor: color,
        backgroundColor: color.startsWith('rgba') ? color : color + '28',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        fill,
        tension: 0.2,
        parsing: false,
    };
}

function initChart() {
    registerZoomPlugin();
    chart = new Chart(PRICE_CANVAS, {
        type: CHART_TYPE_SEL.value,
        data: { datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: false },
            parsing: false,
            animation: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const y = ctx.parsed?.y;
                            if (y === null || y === undefined || !Number.isFinite(y)) return 'No value';
                            return `${ctx.dataset.label}: ${y.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
                        },
                    },
                },
                zoom: {
                    pan:  { enabled: true, mode: 'x', modifierKey: 'shift' },
                    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, drag: { enabled: true }, mode: 'x' },
                },
            },
            scales: {
                x: {
                    type: 'time',
                    time: { tooltipFormat: 'PPpp' },
                    ticks: { maxRotation: 0, autoSkip: true },
                },
                y: {
                    type: 'linear',
                    ticks: { callback: v => Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 }) },
                },
            },
        },
    });
}

/**
 * Build all Chart.js datasets for the selected ticker.
 * `primaryPoints` is already range-filtered + normalized.
 * `allRows` is the raw unfiltered rows for overlay computation.
 */
function buildDatasets(primaryPoints, allRows, yField) {
    const datasets = [];
    const values   = primaryPoints.map(p => p.value);
    const dates    = primaryPoints.map(p => p.date);
    const chartType = CHART_TYPE_SEL.value;

    // ── Primary dataset ──────────────────────────────────────────────────────
    if (!MULTI_FIELD_CB.checked) {
        const ds = makeDatasetBase(
            `${selectedTicker} ${yField}`,
            DATASET_COLORS[0],
            chartType === 'line',
        );
        ds.data = primaryPoints.map(p => ({ x: p.date, y: p.value }));
        ds.pointRadius     = SHOW_POINTS_CB.checked ? 2 : 0;
        ds.pointHoverRadius = SHOW_POINTS_CB.checked ? 4 : 2;
        ds.showLine = chartType !== 'scatter';
        datasets.push(ds);
    } else {
        // ── All numeric fields ───────────────────────────────────────────────
        numericColumns.forEach((col, ci) => {
            const series = buildSeries(allRows, col);
            let pts = applyRange(series.points);
            pts = applyNormalize(pts);
            if (!pts.length) return;
            const ds = makeDatasetBase(col, DATASET_COLORS[ci % DATASET_COLORS.length]);
            ds.data = pts.map(p => ({ x: p.date, y: p.value }));
            ds.showLine = chartType !== 'scatter';
            datasets.push(ds);
        });
    }

    if (!values.length) return datasets;

    // ── SMA 20 ───────────────────────────────────────────────────────────────
    if (OVL_SMA20.checked) {
        const sma = computeSMA(values, 20);
        const ds  = makeDatasetBase('SMA 20', OVERLAY_COLORS.sma20);
        ds.data       = sma.map((v, i) => v !== null ? { x: dates[i], y: v } : null).filter(Boolean);
        ds.borderDash  = [5, 3];
        ds.borderWidth = 1.5;
        datasets.push(ds);
    }

    // ── SMA 50 ───────────────────────────────────────────────────────────────
    if (OVL_SMA50.checked) {
        const sma = computeSMA(values, 50);
        const ds  = makeDatasetBase('SMA 50', OVERLAY_COLORS.sma50);
        ds.data       = sma.map((v, i) => v !== null ? { x: dates[i], y: v } : null).filter(Boolean);
        ds.borderDash  = [5, 3];
        ds.borderWidth = 1.5;
        datasets.push(ds);
    }

    // ── EMA 20 ───────────────────────────────────────────────────────────────
    if (OVL_EMA20.checked) {
        const ema = computeEMA(values, 20);
        const ds  = makeDatasetBase('EMA 20', OVERLAY_COLORS.ema20);
        ds.data       = ema.map((v, i) => v !== null ? { x: dates[i], y: v } : null).filter(Boolean);
        ds.borderDash  = [3, 2];
        ds.borderWidth = 1.5;
        datasets.push(ds);
    }

    // ── Bollinger Bands ──────────────────────────────────────────────────────
    if (OVL_BB.checked) {
        const bb = computeBollingerBands(values, 20, 2);
        const toPoints = arr => arr.map((v, i) => v !== null ? { x: dates[i], y: v } : null).filter(Boolean);

        const dsMid = makeDatasetBase('BB Mid (20)', OVERLAY_COLORS.bb_mid);
        dsMid.data = toPoints(bb.middle);
        dsMid.borderDash = [2, 2];
        dsMid.borderWidth = 1;
        datasets.push(dsMid);

        const dsUpper = makeDatasetBase('BB Upper (+2σ)', OVERLAY_COLORS.bb_upper);
        dsUpper.data = toPoints(bb.upper);
        dsUpper.borderDash = [4, 2];
        dsUpper.borderWidth = 1;
        datasets.push(dsUpper);

        const dsLower = makeDatasetBase('BB Lower (−2σ)', OVERLAY_COLORS.bb_lower);
        dsLower.data = toPoints(bb.lower);
        dsLower.borderDash = [4, 2];
        dsLower.borderWidth = 1;
        datasets.push(dsLower);
    }

    // ── Trend Line ───────────────────────────────────────────────────────────
    if (OVL_TREND.checked && values.length >= 2) {
        const tl = computeTrendLine(values);
        if (tl) {
            const ds = makeDatasetBase(`Trend (R²=${tl.r2.toFixed(3)})`, OVERLAY_COLORS.trend);
            ds.data = tl.predicted.map((y, i) => ({ x: dates[i], y }));
            ds.borderDash  = [6, 3];
            ds.borderWidth = 2;
            datasets.push(ds);
        }
    }

    return datasets;
}

function updateChart() {
    if (!chart) return;

    const yField = Y_FIELD_SELECT.value;
    if (!yField || !selectedRows.length) {
        chart.data.datasets = [];
        chart.update();
        CHART_SUBTITLE.textContent = 'No data.';
        return;
    }

    const series = buildSeries(selectedRows, yField);
    let points   = applyRange(series.points);
    points       = applyNormalize(points);

    // Warn about skipped rows
    const skipped = series.skippedDate + series.skippedValue;
    if (skipped > 0) {
        showStatus(
            `Loaded ${series.total} rows; skipped ${series.skippedDate} (no date) + ` +
            `${series.skippedValue} (non-numeric). Showing ${points.length} points.`,
            'warning',
        );
    } else {
        showStatus('');
    }

    if (!points.length) {
        chart.data.datasets = [];
        chart.update();
        CHART_SUBTITLE.textContent = 'No plottable points for current settings.';
        renderAnalytics([]);
        return;
    }

    // Log / linear scale
    const useLog     = LOG_SCALE_CB.checked;
    const hasNonPos  = points.some(p => p.value <= 0);
    chart.options.scales.y.type = useLog && !hasNonPos ? 'logarithmic' : 'linear';
    if (useLog && hasNonPos) showStatus('Log scale needs all positive values — using linear.', 'warning');

    chart.config.type          = CHART_TYPE_SEL.value;
    chart.data.datasets        = buildDatasets(points, selectedRows, yField);
    chart.update();

    const rangeLabel = RANGE_SELECT.value === 'all' ? 'all' : `range: ${RANGE_SELECT.value}`;
    const normLabel  = NORMALIZE_CB.checked ? 'normalized' : 'raw';
    CHART_SUBTITLE.textContent =
        `${points.length} pts • ${series.total} total rows • ${rangeLabel} • ${normLabel} • Y: ${yField}`;

    renderAnalytics(points);
}

// ─── Ticker Table ─────────────────────────────────────────────────────────────
function renderLatestTable() {
    const q     = (SEARCH_INPUT.value || '').toLowerCase();
    const sortK = SORT_SELECT.value;
    const lim   = Number.parseInt(LIMIT_SELECT.value, 10);

    let rows = latestRows.filter(r => {
        if (!q) return true;
        return (r.ticker || '').toLowerCase().includes(q) ||
               (r.name   || '').toLowerCase().includes(q);
    });

    rows.sort((a, b) => {
        if (sortK === 'name')         return String(a.name ?? '').localeCompare(String(b.name ?? ''));
        if (sortK === 'price_desc')   return (parseNumeric(b.price) ?? -Infinity) - (parseNumeric(a.price) ?? -Infinity);
        if (sortK === 'price_asc')    return (parseNumeric(a.price) ??  Infinity) - (parseNumeric(b.price) ??  Infinity);
        const dc = dateColumn;
        if (dc && sortK === 'scraped_desc') return (parseDate(b[dc])?.getTime() ?? 0) - (parseDate(a[dc])?.getTime() ?? 0);
        if (dc && sortK === 'scraped_asc')  return (parseDate(a[dc])?.getTime() ?? Infinity) - (parseDate(b[dc])?.getTime() ?? Infinity);
        return String(a.ticker ?? '').localeCompare(String(b.ticker ?? ''));
    });

    if (lim > 0) rows = rows.slice(0, lim);

    if (!rows.length) {
        DATA_CONTAINER.innerHTML = '<div class="empty">No rows match your filter.</div>';
        return;
    }

    // Show up to 4 columns: ticker, name + first two numeric cols
    const displayCols = ['ticker', 'name'];
    if (numericColumns.length > 0) displayCols.push(numericColumns[0]);
    if (dateColumn) displayCols.push(dateColumn);

    const thead = displayCols.map(c => `<th>${escHtml(c)}</th>`).join('');
    const tbody = rows.map(row => {
        const ticker = String(row.ticker ?? '');
        const sel    = selectedTicker === ticker;
        return `<tr data-ticker="${escHtml(ticker)}" ${sel ? 'class="selected" aria-selected="true"' : 'aria-selected="false"'} tabindex="0" role="row">
            <td><button class="ticker-link" type="button" data-ticker="${escHtml(ticker)}">${escHtml(ticker)}</button></td>
            ${displayCols.slice(1).map(c => `<td>${escHtml(fmtCell(row[c]))}</td>`).join('')}
        </tr>`;
    }).join('');

    DATA_CONTAINER.innerHTML = `
        <div class="table-wrap">
            <table class="latest-table" aria-label="Latest per ticker">
                <thead><tr>${thead}</tr></thead>
                <tbody>${tbody}</tbody>
            </table>
        </div>`;

    bindTableInteractions();
}

function setSelectedRow(el) {
    if (selectedRowEl && selectedRowEl !== el) {
        selectedRowEl.classList.remove('selected');
        selectedRowEl.setAttribute('aria-selected', 'false');
    }
    selectedRowEl = el;
    if (el) {
        el.classList.add('selected');
        el.setAttribute('aria-selected', 'true');
    }
}

function bindTableInteractions() {
    DATA_CONTAINER.querySelectorAll('tbody tr').forEach(row => {
        const activate = () => {
            const ticker = row.dataset.ticker;
            if (ticker) { setSelectedRow(row); selectTicker(ticker); }
        };
        row.addEventListener('click', e => {
            const ticker = e.target?.dataset?.ticker || row.dataset.ticker;
            if (ticker) { setSelectedRow(row); selectTicker(ticker); }
        });
        row.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
        });
    });
}

function renderTickerRows(columns, rows) {
    if (!rows.length) {
        TICKER_ROWS.innerHTML = '<div class="empty">No rows found for selected ticker.</div>';
        return;
    }
    const head = columns.map(c => `<th>${escHtml(c)}</th>`).join('');
    const body = rows.map(row =>
        `<tr>${columns.map(c => `<td>${escHtml(fmtCell(row[c]))}</td>`).join('')}</tr>`
    ).join('');
    TICKER_ROWS.innerHTML = `
        <div class="table-wrap">
            <table class="raw-table" aria-label="Raw rows for selected ticker">
                <thead><tr>${head}</tr></thead>
                <tbody>${body}</tbody>
            </table>
        </div>`;
}

function selectTicker(ticker) {
    try {
        selectedTicker = ticker;
        SEL_TICKER.textContent = ticker;
        CHART_TITLE.textContent = `${ticker} - full history`;

        const { columns, rows } = getTickerData(ticker);
        selectedColumns = columns;
        selectedRows    = rows;

        if (!rows.length) {
            showStatus(`No rows found for ${ticker}.`, 'warning');
            CHART_SUBTITLE.textContent = 'No data available.';
            renderTickerRows(columns, rows);
            renderAnalytics([]);
            updateChart();
            return;
        }

        renderTickerRows(columns, rows);
        updateChart();
        syncUrlState();
    } catch (err) {
        console.error(err);
        showStatus(`Failed to load ${ticker}: ${err.message}`, 'error');
    }
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function escapeCsv(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv() {
    const yField = Y_FIELD_SELECT.value;
    if (!selectedTicker || !yField) {
        showStatus('Select a ticker first.', 'info');
        return;
    }
    const series  = buildSeries(selectedRows, yField);
    const points  = applyRange(series.points);
    if (!points.length) { showStatus('No data to export.', 'info'); return; }
    const lines = [`ticker,${dateColumn || 'date'},${yField}`];
    for (const p of points) {
        lines.push([escapeCsv(selectedTicker), escapeCsv(p.date.toISOString()), escapeCsv(p.value)].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${selectedTicker}_${yField}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ─── Status Banner ────────────────────────────────────────────────────────────
function showStatus(msg, type = 'info') {
    if (!msg) { STATUS.hidden = true; STATUS.textContent = ''; STATUS.className = 'status'; return; }
    STATUS.hidden    = false;
    STATUS.textContent = msg;
    STATUS.className = `status ${type}`;
}

// ─── URL State ────────────────────────────────────────────────────────────────
function getUrlState() {
    const p = new URLSearchParams(location.search);
    const overlays = new Set((p.get('overlays') || '').split(',').filter(Boolean));
    return {
        ticker:  p.get('ticker')  || null,
        field:   p.get('field')   || null,
        range:   p.get('range')   || 'all',
        chart:   p.get('chart')   || 'line',
        overlays,
    };
}

function syncUrlState() {
    const p = new URLSearchParams();
    if (selectedTicker)            p.set('ticker', selectedTicker);
    if (Y_FIELD_SELECT.value)      p.set('field', Y_FIELD_SELECT.value);
    if (RANGE_SELECT.value !== 'all') p.set('range', RANGE_SELECT.value);
    if (CHART_TYPE_SEL.value !== 'line') p.set('chart', CHART_TYPE_SEL.value);
    const ovls = [];
    if (OVL_SMA20.checked) ovls.push('sma20');
    if (OVL_SMA50.checked) ovls.push('sma50');
    if (OVL_EMA20.checked) ovls.push('ema20');
    if (OVL_BB.checked)    ovls.push('bb');
    if (OVL_TREND.checked) ovls.push('trend');
    if (ovls.length)       p.set('overlays', ovls.join(','));
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function restoreUrlState() {
    const state = getUrlState();

    // Chart type / range
    if (state.chart) CHART_TYPE_SEL.value = state.chart;
    if (state.range) RANGE_SELECT.value   = state.range;

    // Overlays
    if (state.overlays.has('sma20')) OVL_SMA20.checked = true;
    if (state.overlays.has('sma50')) OVL_SMA50.checked = true;
    if (state.overlays.has('ema20')) OVL_EMA20.checked = true;
    if (state.overlays.has('bb'))    OVL_BB.checked    = true;
    if (state.overlays.has('trend')) OVL_TREND.checked = true;

    // Y-field (after schema is known)
    if (state.field) {
        const opt = Array.from(Y_FIELD_SELECT.options).find(o => o.value === state.field);
        if (opt) Y_FIELD_SELECT.value = state.field;
    }

    // Ticker (must come last — triggers a full render)
    if (state.ticker) {
        // Try to find and highlight the row
        const row = DATA_CONTAINER.querySelector(`[data-ticker="${CSS.escape(state.ticker)}"]`);
        if (row) setSelectedRow(row);
        selectTicker(state.ticker);
    }
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function setupTheme() {
    const KEY = 'scrape-theme';
    if (localStorage.getItem(KEY) === 'dark') document.body.dataset.theme = 'dark';
    THEME_BTN.addEventListener('click', () => {
        const dark = document.body.dataset.theme === 'dark';
        if (dark) { delete document.body.dataset.theme; localStorage.setItem(KEY, 'light'); }
        else       { document.body.dataset.theme = 'dark'; localStorage.setItem(KEY, 'dark'); }
    });
}

// ─── Router breadcrumb ────────────────────────────────────────────────────────
function setupBreadcrumb() {
    if (!BACK_LINK) return;
    router.ready().then(() => {
        const home = router.resolve('/') || router.resolve('home') || router.routes[0];
        BACK_LINK.href = home ? router.toSiteUrl(home.path) : '/';
        BACK_LINK.addEventListener('click', e => {
            e.preventDefault();
            router.navigate(BACK_LINK.getAttribute('href'));
        });
    }).catch(() => { /* router optional */ });
}

// ─── Event Handlers ───────────────────────────────────────────────────────────
function attachHandlers() {
    SEARCH_INPUT.addEventListener('input', renderLatestTable);
    SORT_SELECT.addEventListener('change', renderLatestTable);
    LIMIT_SELECT.addEventListener('change', renderLatestTable);

    const rerender = () => { if (selectedTicker) updateChart(); syncUrlState(); };

    Y_FIELD_SELECT.addEventListener('change', rerender);
    CHART_TYPE_SEL.addEventListener('change', rerender);
    RANGE_SELECT.addEventListener('change', rerender);
    SHOW_POINTS_CB.addEventListener('change', rerender);
    NORMALIZE_CB.addEventListener('change', rerender);
    LOG_SCALE_CB.addEventListener('change', rerender);

    // Overlay toggles
    [OVL_SMA20, OVL_SMA50, OVL_EMA20, OVL_BB, OVL_TREND, MULTI_FIELD_CB].forEach(cb => {
        cb.addEventListener('change', () => { if (selectedTicker) { updateChart(); syncUrlState(); } });
    });

    EXPORT_BTN.addEventListener('click', exportCsv);
    RESET_ZOOM_BTN.addEventListener('click', () => { if (chart?.resetZoom) chart.resetZoom(); });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    try {
        setupTheme();
        attachHandlers();
        setupBreadcrumb();

        LOADER.textContent = 'Fetching and decompressing database…';
        await loadDatabase();

        LOADER.textContent = 'Analysing schema…';
        detectSchema();

        LOADER.textContent = 'Querying latest rows…';
        latestRows = queryRows(buildLatestQuery());

        initChart();
        renderLatestTable();
        LOADER.style.display = 'none';

        if (!dateColumn) {
            showStatus('No date/time column found — charts may not display correctly.', 'warning');
        }

        // Restore URL state last (may trigger selectTicker)
        restoreUrlState();
    } catch (err) {
        LOADER.textContent = `Error: ${err.message}`;
        showStatus(`Failed to load data: ${err.message}`, 'error');
        console.error(err);
    }
}

main();
