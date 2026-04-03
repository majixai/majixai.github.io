/**
 * Options Strategy Reference – Beta Viewer
 * Loads strategies.json from parent directory, renders a filterable
 * grid/list of strategy cards, and shows detailed info + payoff
 * diagrams in a modal.
 */

'use strict';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STRATEGIES_URL = '../strategies.json';
const CATEGORY_META = {
    oneLeg:   { label: '1-Leg Strategies',       legClass: 'leg-one',   legText: '1-Leg'  },
    twoLeg:   { label: '2-Leg Strategies',        legClass: 'leg-two',   legText: '2-Leg'  },
    threeLeg: { label: '3-Leg Strategies',        legClass: 'leg-three', legText: '3-Leg'  },
    fourLeg:  { label: '4-Leg Strategies',        legClass: 'leg-four',  legText: '4-Leg'  },
    multiLeg: { label: 'Multi-Leg Strategies',    legClass: 'leg-multi', legText: 'Multi'  },
};

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let allStrategies = [];     // flat array: { ...strategyObj, _category }
let currentStrategy = null;
let isGridView = true;

/* ------------------------------------------------------------------ */
/*  Init                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    fetchStrategies();

    document.getElementById('search-input').addEventListener('input', applyFilters);
    document.getElementById('category-filter').addEventListener('change', applyFilters);
    document.getElementById('outlook-filter').addEventListener('change', applyFilters);
    document.getElementById('view-grid').addEventListener('click', () => setView(true));
    document.getElementById('view-list').addEventListener('click', () => setView(false));
    document.getElementById('calc-btn').addEventListener('click', recalcAndPlot);
});

async function fetchStrategies() {
    try {
        const res = await fetch(STRATEGIES_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        buildFlatList(data);
        renderAll(allStrategies);
        updateCount(allStrategies.length);
    } catch (err) {
        document.getElementById('loading-state').innerHTML =
            `<i class="fa-solid fa-circle-exclamation text-danger fa-2x mb-2"></i>
             <p class="text-danger">Failed to load strategies: ${err.message}</p>`;
    }
}

function buildFlatList(data) {
    allStrategies = [];
    for (const cat of Object.keys(CATEGORY_META)) {
        const list = data[cat] || [];
        for (const s of list) {
            allStrategies.push({ ...s, _category: cat });
        }
    }
}

/* ------------------------------------------------------------------ */
/*  View Toggle                                                        */
/* ------------------------------------------------------------------ */

function setView(grid) {
    isGridView = grid;
    document.getElementById('view-grid').classList.toggle('active', grid);
    document.getElementById('view-list').classList.toggle('active', !grid);
    applyFilters();
}

/* ------------------------------------------------------------------ */
/*  Filtering & Rendering                                              */
/* ------------------------------------------------------------------ */

function applyFilters() {
    const q   = document.getElementById('search-input').value.toLowerCase().trim();
    const cat = document.getElementById('category-filter').value;
    const out = document.getElementById('outlook-filter').value;

    const filtered = allStrategies.filter(s => {
        if (cat !== 'all' && s._category !== cat) return false;
        if (out !== 'all' && !outlookMatch(s.outlook, out)) return false;
        if (q && !nameMatch(s, q)) return false;
        return true;
    });

    renderAll(filtered);
    updateCount(filtered.length);
}

function outlookMatch(outlook, filter) {
    const o = (outlook || '').toLowerCase();
    switch (filter) {
        case 'bullish':   return o.includes('bullish') && !o.includes('bearish');
        case 'bearish':   return o.includes('bearish');
        case 'neutral':   return o.includes('neutral');
        case 'volatile':  return o.includes('volatile') || o.includes('volatility');
        case 'synthetic': return o.includes('synthetic');
        default: return true;
    }
}

function nameMatch(s, q) {
    return (s.name || '').toLowerCase().includes(q) ||
           (s.id   || '').toLowerCase().includes(q) ||
           (s.outlook || '').toLowerCase().includes(q);
}

function updateCount(n) {
    document.getElementById('strategy-count').textContent = `${n} strateg${n === 1 ? 'y' : 'ies'}`;
}

function renderAll(strategies) {
    const container = document.getElementById('strategies-container');
    container.innerHTML = '';

    if (strategies.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-search fa-2x mb-2"></i><p>No strategies found.</p></div>';
        return;
    }

    // Group by category (preserving order)
    const groups = {};
    for (const s of strategies) {
        (groups[s._category] = groups[s._category] || []).push(s);
    }

    for (const [cat, list] of Object.entries(groups)) {
        const meta = CATEGORY_META[cat];
        const section = document.createElement('div');
        section.className = 'mb-4';
        section.innerHTML = `
            <div class="category-header d-flex align-items-center gap-2 mb-3">
                <h5>${meta.label}</h5>
                <small class="text-muted">(${list.length})</small>
            </div>`;

        if (isGridView) {
            const grid = document.createElement('div');
            grid.className = 'row g-3';
            for (const s of list) {
                const col = document.createElement('div');
                col.className = 'col-12 col-sm-6 col-lg-4 col-xl-3';
                col.innerHTML = buildCardHTML(s, meta);
                col.querySelector('.strategy-card').addEventListener('click', () => openModal(s));
                grid.appendChild(col);
            }
            section.appendChild(grid);
        } else {
            const listDiv = document.createElement('div');
            for (const s of list) {
                const row = document.createElement('div');
                row.className = 'list-view-row';
                row.innerHTML = buildListRowHTML(s, meta);
                row.addEventListener('click', () => openModal(s));
                listDiv.appendChild(row);
            }
            section.appendChild(listDiv);
        }

        container.appendChild(section);
        if (Object.keys(groups).indexOf(cat) < Object.keys(groups).length - 1) {
            const sep = document.createElement('div');
            sep.className = 'section-separator';
            container.appendChild(sep);
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Card HTML Builder                                                  */
/* ------------------------------------------------------------------ */

function buildCardHTML(s, meta) {
    const oc = outlookClass(s.outlook);
    return `
    <div class="strategy-card">
        <div class="card-header">
            <span class="badge-leg ${meta.legClass}">${meta.legText}</span>
            <span class="fw-semibold flex-fill text-truncate small" title="${s.name}">${s.name}</span>
        </div>
        <div class="card-body">
            <div class="mb-2">
                <span class="badge-outlook ${oc}">${s.outlook || 'N/A'}</span>
            </div>
            <div class="mb-2 text-muted small" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
                ${s.description ? s.description.substring(0, 100) + '…' : ''}
            </div>
            <div>
                <span class="stat-pill stat-profit">&#9650; ${s.maxProfit || '—'}</span>
                <span class="stat-pill stat-loss">&#9660; ${s.maxLoss || '—'}</span>
            </div>
        </div>
    </div>`;
}

function buildListRowHTML(s, meta) {
    const oc = outlookClass(s.outlook);
    return `
        <span class="badge-leg ${meta.legClass}">${meta.legText}</span>
        <span class="strategy-name">${s.name}</span>
        <span class="badge-outlook ${oc} d-none d-md-inline">${s.outlook || ''}</span>
        <span class="text-muted small d-none d-lg-inline" style="max-width:300px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">
            ${s.description ? s.description.substring(0, 80) + '…' : ''}
        </span>
        <i class="fa-solid fa-chevron-right text-muted ms-auto"></i>`;
}

function outlookClass(outlook) {
    const o = (outlook || '').toLowerCase();
    if (o.includes('synthetic')) return 'outlook-synthetic';
    if (o.includes('bearish'))   return 'outlook-bearish';
    if (o.includes('bullish'))   return 'outlook-bullish';
    if (o.includes('volatile') || o.includes('volatility')) return 'outlook-volatile';
    return 'outlook-neutral';
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

function openModal(s) {
    currentStrategy = s;

    document.getElementById('modal-title').textContent   = s.name || '';
    document.getElementById('modal-outlook').textContent = s.outlook || '';
    document.getElementById('modal-description').textContent = s.description || '';
    document.getElementById('modal-max-profit').textContent  = s.maxProfit || '—';
    document.getElementById('modal-max-loss').textContent    = s.maxLoss   || '—';
    document.getElementById('modal-breakeven').textContent   = s.breakeven || '—';
    document.getElementById('modal-example').textContent     = s.example   || '—';

    // Construction
    const ul = document.getElementById('modal-construction');
    ul.innerHTML = (s.construction || []).map(l =>
        `<li class="mb-1 text-light"><i class="fa-solid fa-circle-dot text-accent me-2 small"></i>${l}</li>`
    ).join('');

    // Greeks
    const greekDiv = document.getElementById('modal-greeks');
    if (s.greeksImpact) {
        greekDiv.innerHTML = ['delta','gamma','theta','vega'].map(g => {
            const val = s.greeksImpact[g] || '—';
            const sym = { delta:'Δ', gamma:'Γ', theta:'Θ', vega:'ν' }[g];
            return `<div class="greek-row text-light">
                        <span class="greek-sym">${sym}</span>
                        <span class="text-muted">${escapeHTML(val)}</span>
                    </div>`;
        }).join('');
    } else {
        greekDiv.innerHTML = '<span class="text-muted">Not available</span>';
    }

    // Parameters
    buildParamInputs(s);

    // Plot
    plotPayoff(s);

    const modal = new bootstrap.Modal(document.getElementById('strategyModal'));
    modal.show();

    // Re-plot once modal is fully shown (handles display:none sizing issues)
    document.getElementById('strategyModal').addEventListener('shown.bs.modal', () => {
        plotPayoff(s);
    }, { once: true });
}

function buildParamInputs(s) {
    const params = s.parameters || {};
    const container = document.getElementById('modal-params');
    container.innerHTML = '';

    for (const [key, val] of Object.entries(params)) {
        if (key.startsWith('_')) continue;
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4';
        col.innerHTML = `
            <div class="param-label">${formatParamLabel(key)}</div>
            <input type="number" class="form-control form-control-sm bg-input border-input text-light"
                   id="param-${key}" value="${val}" step="0.01">`;
        container.appendChild(col);
    }

    if (Object.keys(params).length === 0) {
        container.innerHTML = '<p class="text-muted small col-12">No adjustable parameters.</p>';
    }
}

function formatParamLabel(key) {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function recalcAndPlot() {
    if (!currentStrategy) return;
    const params = { ...currentStrategy.parameters };
    const paramInputs = document.querySelectorAll('#modal-params input');
    paramInputs.forEach(input => {
        const key = input.id.replace('param-', '');
        const val = parseFloat(input.value);
        if (!isNaN(val)) params[key] = val;
    });
    plotPayoff({ ...currentStrategy, parameters: params });
}

/* ------------------------------------------------------------------ */
/*  Payoff Diagram                                                     */
/* ------------------------------------------------------------------ */

const PLOT_LAYOUT = {
    paper_bgcolor: '#1c2128',
    plot_bgcolor:  '#1c2128',
    font: { color: '#e6edf3', size: 11 },
    margin: { l: 50, r: 20, t: 20, b: 40 },
    xaxis: { gridcolor: '#30363d', zerolinecolor: '#444c56', title: 'Underlying Price at Expiry' },
    yaxis: { gridcolor: '#30363d', zerolinecolor: '#444c56', title: 'Profit / Loss', zeroline: true },
    showlegend: false,
    hovermode: 'x unified',
};

function plotPayoff(s) {
    const div = document.getElementById('modal-plot');
    if (!div) return;

    const p = s.parameters || {};
    const prices = linspace(
        Math.max(1, (p.strike || p.strike1 || p.strikeP || p.strikeP1 || 5000) - 500),
        (p.strike || p.strike2 || p.strikeC4 || p.strikeC || 6500) + 500,
        300
    );

    let pnl;
    try {
        pnl = computePayoff(s, prices);
    } catch (e) {
        div.innerHTML = `<div class="empty-state small text-muted">Payoff diagram unavailable: ${e.message}</div>`;
        return;
    }

    const profitX = [], profitY = [], lossX = [], lossY = [];
    for (let i = 0; i < prices.length; i++) {
        if (pnl[i] >= 0) { profitX.push(prices[i]); profitY.push(pnl[i]); }
        else             { lossX.push(prices[i]);   lossY.push(pnl[i]);   }
    }

    const traces = [
        { x: prices, y: pnl, mode: 'lines', line: { color: '#58a6ff', width: 2 }, name: 'P&L' },
        { x: profitX, y: profitY, fill: 'tozeroy', mode: 'none', fillcolor: 'rgba(63,185,80,0.15)', name: 'Profit' },
        { x: lossX,   y: lossY,   fill: 'tozeroy', mode: 'none', fillcolor: 'rgba(248,81,73,0.15)',  name: 'Loss'   },
    ];

    Plotly.react(div, traces, PLOT_LAYOUT, { responsive: true, displayModeBar: false });
}

function computePayoff(s, prices) {
    const p = s.parameters || {};
    const fn = s.plotFunction || '';

    switch (fn) {
        case 'plotBasicOption':
            return prices.map(x => basicOption(x, p.type, p.position, p.strike, p.premium));

        case 'plotVerticalSpread':
            return prices.map(x => {
                const leg1 = basicOption(x, p.type, 'long',  p.strike1, p.premium1);
                const leg2 = basicOption(x, p.type, 'short', p.strike2, p.premium2);
                return p.position === 'credit'
                    ? leg2 + leg1   // credit spread: net credit
                    : leg1 + leg2;  // debit spread
            });

        case 'plotButterfly': {
            const l1 = prices.map(x => basicOption(x, p.type, 'long',  p.strike1, p.premium1));
            const s2 = prices.map(x => basicOption(x, p.type, 'short', p.strike2, p.premium2) * 2);
            const l3 = prices.map(x => basicOption(x, p.type, 'long',  p.strike3, p.premium3));
            return prices.map((_, i) => l1[i] + s2[i] + l3[i]);
        }

        case 'plotIronCondor':
            return prices.map(x => {
                const lp1 = basicOption(x, 'put',  'long',  p.strikeP1, p.premiumP1);
                const sp2 = basicOption(x, 'put',  'short', p.strikeP2, p.premiumP2);
                const sc3 = basicOption(x, 'call', 'short', p.strikeC3, p.premiumC3);
                const lc4 = basicOption(x, 'call', 'long',  p.strikeC4, p.premiumC4);
                return lp1 + sp2 + sc3 + lc4;
            });

        case 'plotCalendarSpread':
            // Simplified: near-term short, same strike, further long – at near expiry
            return prices.map(x => {
                const short = basicOption(x, p.type, 'short', p.strike, p.nearPremium);
                // Near expiry: long option worth intrinsic + residual (approx furtherPremium - nearPremium + intrinsic change)
                const residual = Math.max(0, (p.furtherPremium - p.nearPremium) * 0.6);
                const intrinsicChange = p.type === 'call'
                    ? Math.max(0, x - p.strike) * 0.4
                    : Math.max(0, p.strike - x) * 0.4;
                const longVal = residual + intrinsicChange - p.furtherPremium;
                return short + longVal;
            });

        case 'plotRiskReversal':
            return prices.map(x => {
                const shortPut  = basicOption(x, 'put',  'short', p.strikeP, p.premiumP);
                const longCall  = basicOption(x, 'call', 'long',  p.strikeC, p.premiumC);
                return shortPut + longCall;
            });

        case 'plotSyntheticLong':
            return prices.map(x => {
                const lc = basicOption(x, 'call', 'long',  p.strike, p.callPremium);
                const sp = basicOption(x, 'put',  'short', p.strike, p.putPremium);
                return lc + sp;
            });

        case 'plotSyntheticShort':
            return prices.map(x => {
                const sc = basicOption(x, 'call', 'short', p.strike, p.callPremium);
                const lp = basicOption(x, 'put',  'long',  p.strike, p.putPremium);
                return sc + lp;
            });

        case 'plotDiagonalSpread':
            // Simplified: treat as vertical spread at near expiry
            return prices.map(x => {
                if (p.type === 'call') {
                    const buy  = basicOption(x, 'call', 'long',  p.strike1, p.premium1);
                    const sell = basicOption(x, 'call', 'short', p.strike2, p.premium2);
                    return buy + sell;
                } else {
                    const buy  = basicOption(x, 'put', 'long',  p.strike2, p.premium2);
                    const sell = basicOption(x, 'put', 'short', p.strike1, p.premium1);
                    return buy + sell;
                }
            });

        default:
            // Generic: try to compute from construction if possible
            return prices.map(() => 0);
    }
}

function basicOption(price, type, position, strike, premium) {
    let intrinsic;
    if (type === 'call') intrinsic = Math.max(0, price - strike);
    else                 intrinsic = Math.max(0, strike - price);

    return position === 'long'
        ? intrinsic - premium
        : premium - intrinsic;
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function linspace(start, end, n) {
    const step = (end - start) / (n - 1);
    return Array.from({ length: n }, (_, i) => start + i * step);
}
