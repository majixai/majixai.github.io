const DB_URL = 'yfinance.dat';
const LOADER = document.getElementById('loader');
const DATA_CONTAINER = document.getElementById('data-container');
const PAGINATION_CONTAINER = document.getElementById('pagination-container');
const ROWS_PER_PAGE = 50; // Increased from 10 to 50 for better performance with 1000 tickers

let allRows = [];
let currentPage = 1;
let totalPages = 0;

console.log('=== YFinance Data Viewer Initialized ===');

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
        row.addEventListener('click', () => {
            const ticker = row.cells[0].textContent;
            console.log(`Clicked ticker: ${ticker}`);
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
        console.log('Initializing SQL.js...');
        const SQL = await initSqlJs({
            locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.6.2/dist/${file}`
        });
        console.log('✓ SQL.js initialized');

        LOADER.textContent = 'Fetching and decompressing database...';
        console.log('Fetching database from:', `${DB_URL}?t=${new Date().getTime()}`);
        
        // Add cache busting query parameter
        const response = await fetch(`${DB_URL}?t=${new Date().getTime()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log('✓ Database fetched');
        
        const compressedData = new Uint8Array(await response.arrayBuffer());
        console.log(`Compressed data size: ${compressedData.length.toLocaleString()} bytes`);
        
        console.log('Decompressing database...');
        const decompressedData = pako.inflate(compressedData);
        console.log(`✓ Decompressed data size: ${decompressedData.length.toLocaleString()} bytes`);

        LOADER.textContent = 'Loading database...';
        console.log('Loading database into SQL.js...');
        const db = new SQL.Database(decompressedData);
        console.log('✓ Database loaded');

        LOADER.textContent = 'Querying data...';
        console.log('Executing query to get latest prices...');
        const stmt = db.prepare(`
            SELECT Ticker, Close, Date
            FROM prices p
            WHERE p.rowid IN (SELECT MAX(rowid) FROM prices GROUP BY Ticker)
            ORDER BY Ticker
        `);

        let rowCount = 0;
        while (stmt.step()) {
            allRows.push(stmt.getAsObject());
            rowCount++;
            if (rowCount % 100 === 0) {
                console.log(`  Loaded ${rowCount} rows...`);
            }
        }
        stmt.free();
        console.log(`✓ Query complete: ${allRows.length} tickers loaded`);

        LOADER.style.display = 'none';
        console.log('Displaying page 1...');
        displayTablePage(1);
        console.log('Setting up pagination...');
        setupPagination();
        
        console.log('=== YFinance Data Viewer Ready ===');
        console.log(`Total tickers: ${allRows.length}`);
        console.log(`Rows per page: ${ROWS_PER_PAGE}`);
        console.log(`Total pages: ${totalPages}`);

    } catch (error) {
        LOADER.textContent = `Error: ${error.message}`;
        console.error('✗ Error loading data:', error);
        console.error('Stack trace:', error.stack);
    }
}

console.log('Initializing...');
main();
