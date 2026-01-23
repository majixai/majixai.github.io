const DB_URL = 'yfinance.dat';
const LOADER = document.getElementById('loader');
const LOADER_TEXT = document.getElementById('loader-text');
const LOADER_DETAILS = document.getElementById('loader-details');
const LOADER_PROGRESS = document.getElementById('loader-progress-bar');
const DATA_CONTAINER = document.getElementById('data-container');
const PAGINATION_CONTAINER = document.getElementById('pagination-container');
const ROWS_PER_PAGE = 50; // Increased from 10 to 50 for better performance with 1000 tickers

let allRows = [];
let currentPage = 1;
let totalPages = 0;

console.log('=== YFinance Data Viewer Initialized ===');

// Enhanced loading state management
function updateLoadingState(text, details = '', progress = 0) {
    console.log(`[Loading] ${text} ${details ? '- ' + details : ''} (${progress}%)`);
    if (LOADER_TEXT) LOADER_TEXT.textContent = text;
    if (LOADER_DETAILS) LOADER_DETAILS.textContent = details;
    if (LOADER_PROGRESS) LOADER_PROGRESS.style.width = `${progress}%`;
}

function hideLoader() {
    console.log('[Loading] Complete - hiding loader');
    if (LOADER) {
        LOADER.classList.add('hidden');
    }
}

function showLoader() {
    console.log('[Loading] Showing loader');
    if (LOADER) {
        LOADER.classList.remove('hidden');
    }
}

function displayTablePage(page) {
    console.log(`Displaying page ${page} of ${totalPages}`);
    currentPage = page;
    DATA_CONTAINER.innerHTML = '';
    const startIndex = (page - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    const paginatedRows = allRows.slice(startIndex, endIndex);

    console.log(`Showing rows ${startIndex + 1} to ${Math.min(endIndex, allRows.length)} of ${allRows.length}`);

    let tableHtml = '<table><thead><tr><th>Ticker</th><th>Close</th><th>Date</th></tr></thead><tbody>';
    paginatedRows.forEach(row => {
        tableHtml += `<tr>
            <td>${row.Ticker}</td>
            <td>${row.Close}</td>
            <td>${row.Date}</td>
        </tr>`;
    });
    tableHtml += '</tbody></table>';
    DATA_CONTAINER.innerHTML = tableHtml;

    const tableRows = DATA_CONTAINER.querySelectorAll('tbody tr');
    tableRows.forEach(row => {
        // Add click handler to ticker cell (first column) for detail page
        const tickerCell = row.cells[0];
        tickerCell.style.cursor = 'pointer';
        tickerCell.style.fontWeight = 'bold';
        tickerCell.style.color = '#667eea';
        
        tickerCell.addEventListener('click', (e) => {
            e.stopPropagation();
            const ticker = tickerCell.textContent;
            console.log(`Clicked ticker (detail): ${ticker}`);
            // Link to ticker detail page
            window.open(`ticker_detail.html?ticker=${ticker}`, '_blank');
        });
        
        // Add click handler to rest of row for chart page
        row.addEventListener('click', () => {
            const ticker = row.cells[0].textContent;
            console.log(`Clicked row (chart): ${ticker}`);
            // Link to yfinance_chart page with the ticker as a URL parameter
            const url = `../yfinance_chart/index.html?ticker=${ticker}`;
            window.open(url, '_blank');
        });
    });

    updatePaginationButtons();
}

function setupPagination() {
    totalPages = Math.ceil(allRows.length / ROWS_PER_PAGE);
    console.log(`Setting up pagination: ${totalPages} pages for ${allRows.length} rows`);
    
    PAGINATION_CONTAINER.innerHTML = '';
    
    // Add "First" button
    const firstBtn = document.createElement('a');
    firstBtn.href = '#';
    firstBtn.innerText = '« First';
    firstBtn.className = 'pagination-nav';
    firstBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            displayTablePage(1);
        }
    });
    PAGINATION_CONTAINER.appendChild(firstBtn);
    
    // Add "Previous" button
    const prevBtn = document.createElement('a');
    prevBtn.href = '#';
    prevBtn.innerText = '‹ Prev';
    prevBtn.className = 'pagination-nav';
    prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            displayTablePage(currentPage - 1);
        }
    });
    PAGINATION_CONTAINER.appendChild(prevBtn);
    
    // Smart pagination: show first page, current page neighborhood, and last page
    const pagesToShow = [];
    const range = 2; // Show 2 pages on each side of current page
    
    // Always show first page
    pagesToShow.push(1);
    
    // Show pages around current page
    for (let i = Math.max(2, currentPage - range); i <= Math.min(totalPages - 1, currentPage + range); i++) {
        if (!pagesToShow.includes(i)) {
            pagesToShow.push(i);
        }
    }
    
    // Always show last page
    if (totalPages > 1 && !pagesToShow.includes(totalPages)) {
        pagesToShow.push(totalPages);
    }
    
    // Sort pages
    pagesToShow.sort((a, b) => a - b);
    
    // Add page links with ellipsis
    for (let i = 0; i < pagesToShow.length; i++) {
        const pageNum = pagesToShow[i];
        
        // Add ellipsis if there's a gap
        if (i > 0 && pagesToShow[i] - pagesToShow[i-1] > 1) {
            const ellipsis = document.createElement('span');
            ellipsis.innerText = '...';
            ellipsis.className = 'pagination-ellipsis';
            PAGINATION_CONTAINER.appendChild(ellipsis);
        }
        
        const link = document.createElement('a');
        link.href = '#';
        link.innerText = pageNum;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            displayTablePage(pageNum);
        });
        PAGINATION_CONTAINER.appendChild(link);
    }
    
    // Add "Next" button
    const nextBtn = document.createElement('a');
    nextBtn.href = '#';
    nextBtn.innerText = 'Next ›';
    nextBtn.className = 'pagination-nav';
    nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
            displayTablePage(currentPage + 1);
        }
    });
    PAGINATION_CONTAINER.appendChild(nextBtn);
    
    // Add "Last" button
    const lastBtn = document.createElement('a');
    lastBtn.href = '#';
    lastBtn.innerText = 'Last »';
    lastBtn.className = 'pagination-nav';
    lastBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
            displayTablePage(totalPages);
        }
    });
    PAGINATION_CONTAINER.appendChild(lastBtn);
    
    // Add page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.innerText = `Showing ${allRows.length} tickers`;
    PAGINATION_CONTAINER.appendChild(pageInfo);
    
    updatePaginationButtons();
}

function updatePaginationButtons() {
    const links = PAGINATION_CONTAINER.querySelectorAll('a:not(.pagination-nav)');
    links.forEach((link) => {
        const pageNum = parseInt(link.innerText);
        if (pageNum === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // Update navigation buttons state
    const navButtons = PAGINATION_CONTAINER.querySelectorAll('.pagination-nav');
    navButtons.forEach(btn => {
        const isDisabled = 
            (btn.innerText.includes('First') || btn.innerText.includes('Prev')) && currentPage === 1 ||
            (btn.innerText.includes('Last') || btn.innerText.includes('Next')) && currentPage === totalPages;
        
        if (isDisabled) {
            btn.classList.add('disabled');
        } else {
            btn.classList.remove('disabled');
        }
    });
    
    console.log(`Pagination updated: current page ${currentPage} of ${totalPages}`);
}

async function main() {
    console.log('=== Starting YFinance Data Viewer ===');
    console.log('Database URL:', DB_URL);
    
    try {
        // Step 1: Initialize SQL.js with proper configuration
        updateLoadingState(
            'Initializing SQL.js library...',
            'Loading WebAssembly database engine',
            5
        );
        console.log('Initializing SQL.js...');
        
        // Fix WebAssembly import error by using correct SQL.js version and config
        const SQL = await initSqlJs({
            locateFile: file => `https://sql.js.org/dist/${file}`
        });
        console.log('✓ SQL.js initialized');

        // Step 2: Fetch compressed database
        updateLoadingState(
            'Fetching database...',
            'Downloading compressed data from server',
            15
        );
        console.log('Fetching database from:', `${DB_URL}?t=${new Date().getTime()}`);
        
        const response = await fetch(`${DB_URL}?t=${new Date().getTime()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log('✓ Database fetched');
        
        // Step 3: Load compressed data
        updateLoadingState(
            'Loading compressed data...',
            'Reading data into memory',
            30
        );
        const compressedData = new Uint8Array(await response.arrayBuffer());
        const compressedSizeMB = (compressedData.length / 1024 / 1024).toFixed(2);
        console.log(`Compressed data size: ${compressedData.length.toLocaleString()} bytes (${compressedSizeMB} MB)`);
        
        // Step 4: Decompress database
        updateLoadingState(
            'Decompressing database...',
            `Inflating ${compressedSizeMB} MB of compressed data`,
            45
        );
        console.log('Decompressing database...');
        const decompressedData = pako.inflate(compressedData);
        const decompressedSizeMB = (decompressedData.length / 1024 / 1024).toFixed(2);
        console.log(`✓ Decompressed data size: ${decompressedData.length.toLocaleString()} bytes (${decompressedSizeMB} MB)`);

        // Step 5: Load into SQL.js
        updateLoadingState(
            'Initializing database...',
            'Loading decompressed data into SQL engine',
            60
        );
        console.log('Loading database into SQL.js...');
        const db = new SQL.Database(decompressedData);
        console.log('✓ Database loaded');

        // Step 6: Execute query
        updateLoadingState(
            'Querying database...',
            'Retrieving latest prices for all tickers',
            75
        );
        console.log('Executing query to get latest prices...');
        const stmt = db.prepare(`
            SELECT Ticker, Close, Date
            FROM prices p
            WHERE p.rowid IN (SELECT MAX(rowid) FROM prices GROUP BY Ticker)
            ORDER BY Ticker
        `);

        // Step 7: Process results
        updateLoadingState(
            'Processing results...',
            'Loading ticker data into memory',
            85
        );
        let rowCount = 0;
        while (stmt.step()) {
            allRows.push(stmt.getAsObject());
            rowCount++;
            
            // Update progress during loading
            if (rowCount % 100 === 0) {
                const progressPercent = 85 + (rowCount / 1000) * 10; // 85-95% range
                updateLoadingState(
                    'Processing results...',
                    `Loaded ${rowCount} tickers so far...`,
                    Math.min(progressPercent, 95)
                );
                console.log(`  Loaded ${rowCount} rows...`);
            }
        }
        stmt.free();
        console.log(`✓ Query complete: ${allRows.length} tickers loaded`);

        // Step 8: Setup UI
        updateLoadingState(
            'Preparing interface...',
            `Setting up display for ${allRows.length} tickers`,
            95
        );
        console.log('Displaying page 1...');
        displayTablePage(1);
        
        console.log('Setting up pagination...');
        setupPagination();
        
        // Step 9: Complete
        updateLoadingState(
            'Ready!',
            `Successfully loaded ${allRows.length} tickers`,
            100
        );
        
        // Wait a moment to show completion, then hide
        setTimeout(() => {
            hideLoader();
            console.log('=== YFinance Data Viewer Ready ===');
            console.log(`Total tickers: ${allRows.length}`);
            console.log(`Rows per page: ${ROWS_PER_PAGE}`);
            console.log(`Total pages: ${totalPages}`);
            
            // Initialize search and filter
            initializeSearchAndFilter();
        }, 800);

    } catch (error) {
        updateLoadingState(
            '❌ Error Loading Data',
            error.message,
            0
        );
        console.error('✗ Error loading data:', error);
        console.error('Stack trace:', error.stack);
        
        // Log to error tracker
        if (window.ErrorTracker) {
            window.ErrorTracker.logError({
                type: 'database_load',
                message: error.message,
                stack: error.stack,
                context: 'main_data_load'
            });
        }
        
        // Show error details in loader
        if (LOADER_DETAILS) {
            LOADER_DETAILS.innerHTML = `
                <strong>Error:</strong> ${error.message}<br>
                <small>Check the browser console for more details</small><br>
                <button onclick="window.location.href='client-tracking.html'" style="margin-top: 10px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    🔍 View Error Tracking
                </button>
            `;
            LOADER_DETAILS.style.color = '#dc3545';
        }
    }
}

// ============================================
// ENHANCED SEARCH AND FILTER FUNCTIONALITY
// ============================================

let filteredRows = [];
let allTickers = [];
let tickerMetadata = new Map(); // Store additional metadata for each ticker

function initializeSearchAndFilter() {
    console.log('Initializing enhanced search and filter...');
    
    // Store all ticker symbols and metadata for advanced search
    allTickers = [...new Set(allRows.map(row => row.Ticker))].sort();
    
    // Build metadata map with price trends
    allRows.forEach(row => {
        const ticker = row.Ticker;
        if (!tickerMetadata.has(ticker)) {
            tickerMetadata.set(ticker, {
                ticker,
                currentPrice: parseFloat(row.Close),
                date: row.Date,
                priceRange: 'unknown',
                trend: 'unknown'
            });
        }
    });
    
    console.log(`Found ${allTickers.length} unique tickers with metadata`);
    
    const searchInput = document.getElementById('ticker-search');
    const sortSelect = document.getElementById('sort-select');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
    
    // Enhanced search input with debounce and fuzzy matching
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim().toUpperCase();
        
        if (query.length > 0) {
            searchTimeout = setTimeout(() => {
                showAutocomplete(query);
            }, 150); // Faster debounce for better UX
        } else {
            hideAutocomplete();
            applyFilters();
        }
    });
    
    // Autocomplete selection with keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
        const selected = autocompleteDropdown.querySelector('.autocomplete-item.selected');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selected && selected.nextElementSibling) {
                selected.classList.remove('selected');
                selected.nextElementSibling.classList.add('selected');
                selected.nextElementSibling.scrollIntoView({ block: 'nearest' });
            } else if (items.length > 0) {
                items[0].classList.add('selected');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selected && selected.previousElementSibling) {
                selected.classList.remove('selected');
                selected.previousElementSibling.classList.add('selected');
                selected.previousElementSibling.scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selected) {
                const tickerText = selected.querySelector('.ticker-symbol')?.textContent || selected.textContent;
                selectTicker(tickerText);
            }
        } else if (e.key === 'Escape') {
            hideAutocomplete();
        }
    });
    
    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
            hideAutocomplete();
        }
    });
    
    // Sort selection with more options
    sortSelect.addEventListener('change', () => {
        applyFilters();
    });
    
    // Price filter
    const priceFilter = document.getElementById('price-filter');
    priceFilter.addEventListener('change', () => {
        applyFilters();
    });
    
    // Clear filters
    clearFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        sortSelect.value = 'date-desc';
        priceFilter.value = 'all';
        hideAutocomplete();
        applyFilters();
    });
}

/**
 * Fuzzy match algorithm using Levenshtein distance
 * Ranks results by similarity to query
 */
function fuzzyMatch(query, ticker) {
    // Exact match gets highest priority
    if (ticker === query) return 1000;
    if (ticker.startsWith(query)) return 900 - query.length;
    
    // Calculate Levenshtein distance
    const distance = levenshteinDistance(query, ticker);
    const maxLen = Math.max(query.length, ticker.length);
    const similarity = 1 - (distance / maxLen);
    
    // Contains match gets medium priority
    if (ticker.includes(query)) return 500 + similarity * 100;
    
    // Fuzzy match gets lower priority based on similarity
    return similarity * 300;
}

/**
 * Levenshtein distance - edit distance between two strings
 */
function levenshteinDistance(a, b) {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
}

/**
 * Enhanced autocomplete with fuzzy matching and metadata display
 */
function showAutocomplete(query) {
    const dropdown = document.getElementById('autocomplete-dropdown');
    
    // Rank tickers by fuzzy match score
    const rankedMatches = allTickers
        .map(ticker => ({
            ticker,
            score: fuzzyMatch(query, ticker),
            metadata: tickerMetadata.get(ticker)
        }))
        .filter(item => item.score > 100) // Filter out very poor matches
        .sort((a, b) => b.score - a.score)
        .slice(0, 15); // Show top 15 results
    
    if (rankedMatches.length === 0) {
        dropdown.innerHTML = `
            <div class="autocomplete-item" style="color: #999; font-style: italic;">
                No matches found for "${query}"
            </div>
        `;
        dropdown.classList.add('active');
        return;
    }
    
    // Build enhanced dropdown with metadata
    dropdown.innerHTML = rankedMatches.map((item, index) => {
        const meta = item.metadata || {};
        const priceDisplay = meta.currentPrice ? `$${meta.currentPrice.toFixed(2)}` : 'N/A';
        const matchType = item.score >= 900 ? '⭐ Exact' : 
                         item.score >= 500 ? '✓ Contains' : 
                         '≈ Similar';
        
        return `
            <div class="autocomplete-item ${index === 0 ? 'selected' : ''}" data-ticker="${item.ticker}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span class="ticker-symbol" style="font-weight: bold; color: #667eea;">${item.ticker}</span>
                        <span style="font-size: 0.75rem; color: #999; margin-left: 8px;">${matchType}</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: #10b981;">${priceDisplay}</div>
                        <div style="font-size: 0.7rem; color: #999;">${meta.date || ''}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        const ticker = item.getAttribute('data-ticker');
        if (ticker) {
            item.addEventListener('click', () => {
                selectTicker(ticker);
            });
            
            item.addEventListener('mouseenter', () => {
                dropdown.querySelectorAll('.autocomplete-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
        }
    });
    
    dropdown.classList.add('active');
}

function hideAutocomplete() {
    const dropdown = document.getElementById('autocomplete-dropdown');
    dropdown.classList.remove('active');
}

function selectTicker(ticker) {
    console.log(`Selected ticker: ${ticker}`);
    const searchInput = document.getElementById('ticker-search');
    searchInput.value = ticker;
    hideAutocomplete();
    applyFilters();
}

function applyFilters() {
    const searchQuery = document.getElementById('ticker-search').value.trim().toUpperCase();
    const sortValue = document.getElementById('sort-select').value;
    const priceFilterValue = document.getElementById('price-filter').value;
    
    console.log(`Applying filters: search="${searchQuery}", sort="${sortValue}", priceFilter="${priceFilterValue}"`);
    
    // Start with original dataset
    let tempRows = [...allRows];
    
    // Apply search filter
    if (searchQuery) {
        // Use fuzzy matching for search
        const rankedResults = tempRows
            .map(row => ({
                row,
                score: fuzzyMatch(searchQuery, row.Ticker)
            }))
            .filter(item => item.score > 50) // Keep reasonable matches
            .sort((a, b) => b.score - a.score)
            .map(item => item.row);
        
        tempRows = rankedResults;
        console.log(`Fuzzy search filtered to ${tempRows.length} rows`);
    }
    
    // Apply price range filter
    if (priceFilterValue !== 'all') {
        tempRows = tempRows.filter(row => {
            const price = parseFloat(row.Close);
            switch(priceFilterValue) {
                case 'under-10':
                    return price < 10;
                case '10-50':
                    return price >= 10 && price < 50;
                case '50-100':
                    return price >= 50 && price < 100;
                case '100-500':
                    return price >= 100 && price < 500;
                case 'over-500':
                    return price >= 500;
                default:
                    return true;
            }
        });
        console.log(`Price filter applied: ${tempRows.length} rows in range`);
    }
    
    // Sort rows (skip if relevance and search query exists)
    if (sortValue === 'relevance' && searchQuery) {
        // Already sorted by fuzzy match score
        console.log('Sorting by relevance (fuzzy match score)');
    } else {
        tempRows.sort((a, b) => {
            switch(sortValue) {
                case 'ticker-asc':
                    return a.Ticker.localeCompare(b.Ticker);
                case 'ticker-desc':
                    return b.Ticker.localeCompare(a.Ticker);
                case 'price-asc':
                    return parseFloat(a.Close) - parseFloat(b.Close);
                case 'price-desc':
                    return parseFloat(b.Close) - parseFloat(a.Close);
                case 'date-asc':
                    return new Date(a.Date) - new Date(b.Date);
                case 'date-desc':
                    return new Date(b.Date) - new Date(a.Date);
                default:
                    return 0;
            }
        });
    }
    
    // Update display with filtered rows
    filteredRows = tempRows;
    allRows = filteredRows;
    currentPage = 1;
    totalPages = Math.ceil(allRows.length / ROWS_PER_PAGE);
    
    displayTablePage(1);
    setupPagination();
    updatePaginationButtons();
    
    // Update status message
    const filterStatus = document.querySelector('.page-info');
    if (filterStatus) {
        const appliedFilters = [];
        if (searchQuery) appliedFilters.push(`search: "${searchQuery}"`);
        if (priceFilterValue !== 'all') appliedFilters.push(`price: ${priceFilterValue}`);
        
        const statusText = appliedFilters.length > 0 
            ? `Showing ${allRows.length} tickers (${appliedFilters.join(', ')})`
            : `Showing ${allRows.length} tickers`;
        filterStatus.textContent = statusText;
    }
    
    console.log(`Displaying ${allRows.length} rows in ${totalPages} pages`);
}

console.log('Initializing...');
main();
