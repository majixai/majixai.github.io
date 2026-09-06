// main.js — Showcase application entry point
// Loads projects.json from the repository root and drives all showcase sections.

(async () => {
    'use strict';

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /** Escape a value for safe HTML insertion. */
    const esc = (s) =>
        String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                       .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

    /** Format an ISO date string as a short locale date. */
    const fmtDate = (iso) => {
        if (!iso) return '';
        try { return new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }); }
        catch (_) { return iso.slice(0, 10); }
    };

    // ─── Category meta ──────────────────────────────────────────────────────────

    const CAT_META = {
        finance:     { icon: '💰', label: 'Finance',     color: '#52b788' },
        tools:       { icon: '🛠️', label: 'Tools',       color: '#4895ef' },
        web:         { icon: '🌐', label: 'Web',         color: '#9b72cf' },
        data:        { icon: '📊', label: 'Data',        color: '#f4a261' },
        gaming:      { icon: '🎮', label: 'Gaming',      color: '#f4845f' },
        mathematics: { icon: '📐', label: 'Mathematics', color: '#43a047' },
        ai:          { icon: '🤖', label: 'AI',          color: '#e91e8c' },
        ml:          { icon: '🧠', label: 'ML',          color: '#26a69a' },
        gpu:         { icon: '⚡', label: 'GPU',         color: '#8e24aa' },
    };

    // ─── Module Spotlights ───────────────────────────────────────────────────────

    const SPOTLIGHTS = [
        {
            name: 'yFinance Dashboard',
            path: '../yfinance/',
            category: 'finance',
            icon: '📈',
            desc: 'Python-powered financial data pipeline with Expansion/Consolidation/Bull-Trigger zone detection, Top-Heavy reporting, and a Bootstrap dashboard. Includes Stochastic OU drift, vector curl, Frenet curvature, Higuchi FD, and differential-form zone detectors.',
            tags: ['Python', 'yfinance', 'Bootstrap', 'SQLite', 'Zone Detection'],
        },
        {
            name: 'MetaTrader5 Engine',
            path: '../metatrader5/',
            category: 'finance',
            icon: '🏦',
            desc: 'Pure-Python MT5 mock API facade with an ActionRegistry + Router dispatcher. Includes a full backtesting engine with Ornstein-Uhlenbeck and Geometric Brownian Motion strategies and a FeedbackEngine for adaptive parameter tuning.',
            tags: ['Python', 'MT5', 'OU Process', 'GBM', 'Backtesting'],
        },
        {
            name: 'TradingView Integration',
            path: '../tradingview_integration/',
            category: 'finance',
            icon: '📉',
            desc: 'Pine Script with 101 candlestick patterns (single-bar through harmonic), a Complex Situations Engine for HC/CLSTR/SQZ/SR/DIV/EXH signals, a Bayesian Next-Pattern Predictor, and 19-section advanced_indicator.pine covering stochastic calculus, vector calculus, Frenet geometry, and differential forms.',
            tags: ['Pine Script', 'Patterns', 'Bayesian', 'Stochastic Calc', 'TradingView'],
        },
        {
            name: 'GPU Kernel Library',
            path: '../gpu/',
            category: 'gpu',
            icon: '⚡',
            desc: 'GPUManager auto-selects CUDA, MPS, TensorFlow, or CPU. GPUDispatcher uses a thread-pool with @register decorator. Kernels include: HOSVD, Kalman smoother, Monte Carlo, regime softmax, Haar wavelet, PCA, SVD, covariance, and normalization.',
            tags: ['CUDA', 'CuPy', 'NumPy', 'TensorFlow', 'Thread Pool'],
        },
        {
            name: 'Tensor Financial',
            path: '../tensor/',
            category: 'ml',
            icon: '🧮',
            desc: 'High-dimensional financial tensor analysis: feature matrix construction, Tucker decomposition, Kalman filtering, Haar wavelet decomposition, 5-regime classification, Monte Carlo forecasting (HORIZON=20, N_MC=400), cross-asset summary, and VaR computation.',
            tags: ['Tensor Decomp', 'Kalman', 'Haar Wavelet', 'Regime Classification', 'VaR'],
        },
        {
            name: 'MajixAI Wiki',
            path: '../wiki/',
            category: 'web',
            icon: '📚',
            desc: 'Shared browser-native wiki module. MajixWiki class in wiki-core.js with full CRUD, markdown rendering, tag support, search, and an interactive browser demo. Designed as a reusable module importable across any sub-project in the repository.',
            tags: ['JavaScript', 'Markdown', 'IndexedDB', 'ES Module', 'Search'],
        },
        {
            name: 'Bitcoin Miner Demo',
            path: '../bitcoin_miner/',
            category: 'tools',
            icon: '₿',
            desc: 'Educational proof-of-work simulator in C (builds via Makefile). Supports debug builds and live Bitcoin data fetched by a Python script committed via GitHub Actions workflow. Demonstrates SHA-256 mining loop, difficulty adjustment, and nonce scanning.',
            tags: ['C', 'SHA-256', 'Makefile', 'GitHub Actions', 'Live Data'],
        },
        {
            name: 'yFinance Chart',
            path: '../yfinance_chart/',
            category: 'data',
            icon: '🔬',
            desc: 'Lightweight pattern chart with 12 math-based detectors: OU reversion, GBM drift, Brownian volatility clusters, vector divergence/curl, Frenet inflection, geodesic support/resistance, Higuchi fractal dimension, exterior derivative spikes, harmonic XABCD, Elliott waves, and advanced candlestick analysis.',
            tags: ['Python', 'Calculus', 'Fractals', 'Elliott Wave', 'Harmonic Patterns'],
        },
    ];

    // ─── Data loading ────────────────────────────────────────────────────────────

    let projects = [];

    async function loadProjects() {
        try {
            const res = await fetch('../projects.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            projects = await res.json();
        } catch (err) {
            console.warn('[Showcase] Could not load projects.json:', err);
            projects = [];
        }
    }

    // ─── Stats bar ───────────────────────────────────────────────────────────────

    function renderStats() {
        const counts = {};
        for (const p of projects) {
            const c = (p.category || 'tools').toLowerCase();
            counts[c] = (counts[c] || 0) + 1;
        }

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('stat-total',   projects.length);
        set('stat-cats',    Object.keys(counts).length);
        set('stat-finance', counts.finance     || 0);
        set('stat-tools',   counts.tools       || 0);
        set('stat-math',    counts.mathematics || 0);
        set('stat-ml',      (counts.ml || 0) + (counts.ai || 0) + (counts.gpu || 0));
    }

    // ─── Category dashboard ──────────────────────────────────────────────────────

    function renderCategories() {
        const counts = {};
        for (const p of projects) {
            const c = (p.category || 'tools').toLowerCase();
            counts[c] = (counts[c] || 0) + 1;
        }

        const grid = document.getElementById('cat-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        const frag = document.createDocumentFragment();

        for (const cat of sorted) {
            const meta = CAT_META[cat] || { icon: '📁', label: cat, color: '#888' };
            const a = document.createElement('a');
            a.className = 'cat-card';
            a.href = '#section-explorer';
            a.dataset.cat = cat;
            a.setAttribute('role', 'button');
            a.setAttribute('aria-label', `Filter projects by ${meta.label}`);
            a.innerHTML = `
                <div class="cat-icon" style="background:${meta.color}22;">${esc(meta.icon)}</div>
                <span class="cat-name">${esc(meta.label)}</span>
                <span class="cat-count">${counts[cat]} project${counts[cat] !== 1 ? 's' : ''}</span>
            `;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                filterExplorer(cat);
                document.getElementById('section-explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            frag.appendChild(a);
        }
        grid.appendChild(frag);
    }

    // ─── Module spotlights ───────────────────────────────────────────────────────

    function renderSpotlights() {
        const grid = document.getElementById('spotlight-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const frag = document.createDocumentFragment();
        for (const s of SPOTLIGHTS) {
            const meta = CAT_META[s.category] || { color: '#888', label: s.category };
            const card = document.createElement('div');
            card.className = 'spotlight-card';
            card.innerHTML = `
                <div class="spotlight-header">
                    <div class="spotlight-icon" style="background:${meta.color}22; font-size:1.6rem;">${esc(s.icon)}</div>
                    <div>
                        <div class="spotlight-title">${esc(s.name)}</div>
                        <div class="spotlight-cat">${esc(meta.label)}</div>
                    </div>
                </div>
                <div class="spotlight-body">${esc(s.desc)}</div>
                <div class="spotlight-tags">
                    ${s.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
                </div>
                <div class="spotlight-footer">
                    <a href="${esc(s.path)}" class="btn-spotlight filled" target="_blank" rel="noopener noreferrer">
                        <i class="fa fa-arrow-up-right-from-square"></i> Open Module
                    </a>
                </div>
            `;
            frag.appendChild(card);
        }
        grid.appendChild(frag);
    }

    // ─── Project explorer ────────────────────────────────────────────────────────

    let explorerFilter = 'all';
    let explorerSearch = '';

    function filterExplorer(cat) {
        explorerFilter = cat || 'all';
        renderExplorer();
    }

    function stripeClass(cat) {
        const known = ['finance','tools','web','data','gaming','mathematics','ai','ml','gpu'];
        return known.includes(cat) ? `stripe-${cat}` : 'stripe-tools';
    }

    function badgeClass(cat) {
        const known = ['finance','tools','web','data','gaming','mathematics','ai','ml','gpu'];
        return known.includes(cat) ? `badge-${cat}` : 'badge-tools';
    }

    function renderExplorer() {
        const grid   = document.getElementById('project-grid');
        const empty  = document.getElementById('proj-empty');
        const countEl = document.getElementById('explorer-count');
        const totalEl = document.getElementById('explorer-total');
        if (!grid) return;

        let list = [...projects];
        if (explorerFilter !== 'all') {
            list = list.filter(p => (p.category || 'tools').toLowerCase() === explorerFilter);
        }
        if (explorerSearch) {
            const terms = explorerSearch.toLowerCase().split(/\s+/);
            list = list.filter(p => {
                const hay = `${p.name} ${p.desc} ${p.category}`.toLowerCase();
                return terms.every(t => hay.includes(t));
            });
        }

        // Remove existing cards
        [...grid.querySelectorAll('.project-card')].forEach(el => el.remove());

        if (totalEl) totalEl.textContent = projects.length;

        if (list.length === 0) {
            if (empty) empty.style.display = '';
            if (countEl) countEl.textContent = '0 results';
            return;
        }
        if (empty) empty.style.display = 'none';
        if (countEl) countEl.textContent = `${list.length} project${list.length !== 1 ? 's' : ''}`;

        const frag = document.createDocumentFragment();
        for (const p of list) {
            const cat  = (p.category || 'tools').toLowerCase();
            const meta = CAT_META[cat] || { label: cat };
            const href = `https://majixai.github.io/${esc(p.path || p.name + '/')}`;
            const a = document.createElement('a');
            a.className = 'project-card';
            a.href = href;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.setAttribute('aria-label', `${p.name}: ${p.desc}`);
            a.innerHTML = `
                <div class="project-stripe ${stripeClass(cat)}"></div>
                <div class="project-body">
                    <div class="project-name">${esc(p.name)}</div>
                    <div class="project-desc">${esc(p.desc || '')}</div>
                </div>
                <div class="project-footer">
                    <span class="proj-badge ${badgeClass(cat)}">${esc(meta.label || cat)}</span>
                    <span class="proj-date">${fmtDate(p.lastUpdated)}</span>
                </div>
            `;
            frag.appendChild(a);
        }
        grid.insertBefore(frag, empty);
    }

    // ─── Recently updated ────────────────────────────────────────────────────────

    function renderRecent() {
        const grid = document.getElementById('recent-grid');
        if (!grid) return;

        const sorted = [...projects]
            .filter(p => p.lastUpdated)
            .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
            .slice(0, 10);

        grid.innerHTML = '';
        const frag = document.createDocumentFragment();
        for (const p of sorted) {
            const href = `https://majixai.github.io/${esc(p.path || p.name + '/')}`;
            const card = document.createElement('div');
            card.className = 'recent-card';
            card.innerHTML = `
                <div class="recent-name">${esc(p.name)}</div>
                <div class="recent-msg">${esc(p.desc || '—')}</div>
                <div class="recent-meta">
                    <span>${esc((p.category || 'tools').toLowerCase())}</span>
                    <span>${fmtDate(p.lastUpdated)}</span>
                </div>
                <a class="recent-link" href="${href}" target="_blank" rel="noopener noreferrer">
                    Open <i class="fa fa-arrow-right fa-xs"></i>
                </a>
            `;
            frag.appendChild(card);
        }
        grid.appendChild(frag);
    }

    // ─── Concepts section (from assets/data.json) ────────────────────────────────

    class CacheService {
        #dbName; #dbVersion; #db = null;
        constructor(dbName, dbVersion) { this.#dbName = dbName; this.#dbVersion = dbVersion; }
        async #getDB() {
            if (this.#db) return this.#db;
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(this.#dbName, this.#dbVersion);
                req.onerror = () => reject('Error opening DB.');
                req.onsuccess = (e) => { this.#db = e.target.result; resolve(this.#db); };
                req.onupgradeneeded = (e) => e.target.result.createObjectStore('concepts', { keyPath: 'id' });
            });
        }
        async setData(store, data) {
            const db = await this.#getDB();
            const tx = db.transaction(store, 'readwrite');
            const st = tx.objectStore(store);
            data.forEach(item => st.put(item));
            return new Promise(resolve => { tx.oncomplete = () => resolve(); });
        }
        async getData(store) {
            const db = await this.#getDB();
            const tx = db.transaction(store, 'readonly');
            const req = tx.objectStore(store).getAll();
            return new Promise(resolve => { req.onsuccess = () => resolve(req.result.length > 0 ? req.result : null); });
        }
    }

    class AnimationController {
        #elements; #intervalId = null;
        constructor(selector) { this.#elements = document.querySelectorAll(selector); }
        refresh() { this.#elements = document.querySelectorAll('.data-card'); }
        start() {
            this.refresh();
            if (this.#intervalId) return;
            this.#elements.forEach(el => el.classList.add('animated'));
            this.#intervalId = setInterval(() => {
                this.#elements.forEach(el => { el.classList.remove('animated'); void el.offsetWidth; el.classList.add('animated'); });
            }, 3000);
        }
        stop() {
            clearInterval(this.#intervalId); this.#intervalId = null;
            this.#elements.forEach(el => el.classList.remove('animated'));
        }
    }

    function renderConcepts(concepts) {
        const container = document.getElementById('data-container');
        if (!container) return;
        container.innerHTML = '';
        const FEATURE_FLAGS = { OOP: 1, ASYNC: 2, CACHE: 4, ANIMATION: 8, STATE_MGT: 16, GENERATOR: 32, MODULE: 64, GPU: 128, ML: 256 };

        for (const rawItem of concepts) {
            const features = [];
            for (const [key, bit] of Object.entries(FEATURE_FLAGS)) {
                if (rawItem.features & bit) features.push(key);
            }
            const card = document.createElement('div');
            card.className = 'data-card';
            card.innerHTML = `
                <h5 style="font-weight:700;color:#2c3e50;margin-bottom:.4rem;">${esc(rawItem.name)}</h5>
                <p style="font-size:.88rem;color:#555;margin-bottom:.5rem;">${esc(rawItem.description)}</p>
                <div>
                    ${features.map(f => `<span class="badge bg-secondary me-1" style="font-size:.7rem;">${esc(f)}</span>`).join('')}
                </div>
            `;
            container.appendChild(card);
        }
    }

    async function loadConcepts(animCtrl) {
        const cache = new CacheService('ShowcaseDB', 1);
        try {
            let data = await cache.getData('concepts');
            if (!data) {
                const res = await fetch('assets/data.json');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                data = await res.json();
                await cache.setData('concepts', data);
            }
            renderConcepts(data);
            animCtrl.refresh();
            animCtrl.start();
        } catch (err) {
            const c = document.getElementById('data-container');
            if (c) c.innerHTML = `<div class="alert alert-danger">Failed to load concepts: ${esc(err.message)}</div>`;
        }
    }

    // ─── Commit info ─────────────────────────────────────────────────────────────

    async function loadCommitInfo() {
        const container = document.getElementById('commit-info-container');
        if (!container) return;
        try {
            const res = await fetch('assets/commit-info.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const info = await res.json();
            container.innerHTML = `
                <table class="table table-sm table-borderless mb-0" style="max-width:600px;">
                    <tr><th style="width:140px;color:#555;">Commit</th><td><code>${esc(info.sha)}</code></td></tr>
                    <tr><th style="color:#555;">Author</th><td>${esc(info.author)}</td></tr>
                    <tr><th style="color:#555;">Date</th><td>${esc(info.date)}</td></tr>
                    <tr><th style="color:#555;">Message</th><td><em>${esc(info.message)}</em></td></tr>
                    <tr><th style="color:#555;">Directories</th><td>
                        ${(info.directories || []).map(d => `<span class="badge bg-light text-dark border me-1 mb-1">${esc(d)}</span>`).join('')}
                    </td></tr>
                </table>`;
        } catch (err) {
            container.innerHTML = `<div class="alert alert-warning mb-0">Commit info unavailable: ${esc(err.message)}</div>`;
        }
    }

    // ─── Bootstrap ───────────────────────────────────────────────────────────────

    const animCtrl = new AnimationController('.data-card');

    document.getElementById('start-animation-btn')?.addEventListener('click', () => animCtrl.start());
    document.getElementById('stop-animation-btn')?.addEventListener('click',  () => animCtrl.stop());

    document.getElementById('explorer-search')?.addEventListener('input', (e) => {
        explorerSearch = e.target.value.trim();
        renderExplorer();
    });

    await loadProjects();

    renderStats();
    renderCategories();
    renderSpotlights();
    renderExplorer();
    renderRecent();

    // Load concepts and commit info concurrently
    await Promise.all([
        loadConcepts(animCtrl),
        loadCommitInfo(),
    ]);

})();
