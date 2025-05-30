document.addEventListener('DOMContentLoaded', () => {
    const dataContainer = document.getElementById('data-container');
    const LOCAL_STORAGE_KEY = 'stockDataHistory';
    const MAX_LOCAL_STORAGE_ENTRIES = 10;
    const MAX_DISPLAY_ENTRIES = 20; // Max entries to show in the DOM

    // --- LocalStorage Functions ---

    function getStoredData() {
        const rawData = localStorage.getItem(LOCAL_STORAGE_KEY);
        try {
            return rawData ? JSON.parse(rawData) : [];
        } catch (e) {
            console.error("Error parsing data from LocalStorage:", e);
            return []; // Return empty array on error
        }
    }

    function saveToLocalStorage(timestamp, data) {
        let storedData = getStoredData();
        storedData.unshift({ timestamp, data }); // Add new data to the beginning

        // Keep only the latest MAX_LOCAL_STORAGE_ENTRIES
        if (storedData.length > MAX_LOCAL_STORAGE_ENTRIES) {
            storedData = storedData.slice(0, MAX_LOCAL_STORAGE_ENTRIES);
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedData));
    }

    // --- Display Functions ---

    function renderDataEntries(entries) {
        if (!dataContainer) return;
        
        // Clear only if it's the initial "Loading..." message or if entries exist
        if (dataContainer.innerHTML.includes("Loading...") || entries.length > 0) {
            dataContainer.innerHTML = ''; // Clear previous entries or "Loading..."
        }

        const entriesToDisplay = entries.slice(0, MAX_DISPLAY_ENTRIES);

        entriesToDisplay.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'data-entry';

            const timePara = document.createElement('p');
            timePara.className = 'timestamp';
            timePara.textContent = `Time: ${entry.timestamp}`;

            const dataPara = document.createElement('p');
            dataPara.className = 'data-content';
            // Handle if data is an object (from placeholder) or string
            let dataText = entry.data;
            if (typeof entry.data === 'object') {
                dataText = JSON.stringify(entry.data, null, 2);
            }
            dataPara.textContent = `Data: ${dataText}`;

            entryDiv.appendChild(timePara);
            entryDiv.appendChild(dataPara);
            dataContainer.appendChild(entryDiv); // Append, then will reverse with flex for new-on-top
        });
        
        // If using appendChild, new items are at bottom.
        // To show newest on top with current appendChild, CSS flex can be used:
        // dataContainer.style.display = 'flex';
        // dataContainer.style.flexDirection = 'column-reverse';
        // OR, more simply, use prepend for new items if not loading from storage initially.
        // For now, this function is mainly for loading from storage.
    }
    
    function displayNewDataEntry(timestamp, data) {
        if (!dataContainer) return;

        // Remove "Loading..." if it's there
        const loadingMessage = dataContainer.querySelector('p');
        if (loadingMessage && loadingMessage.textContent.includes("Loading...")) {
            dataContainer.innerHTML = '';
        }

        const entryDiv = document.createElement('div');
        entryDiv.className = 'data-entry';

        const timePara = document.createElement('p');
        timePara.className = 'timestamp';
        timePara.textContent = `Time: ${timestamp}`;

        const dataPara = document.createElement('p');
        dataPara.className = 'data-content';
        let dataText = data;
        if (typeof data === 'object') {
            dataText = JSON.stringify(data, null, 2);
        }
        dataPara.textContent = `Data: ${dataText}`;
        
        entryDiv.appendChild(timePara);
        entryDiv.appendChild(dataPara);

        dataContainer.prepend(entryDiv); // Add new entry at the top

        // Limit displayed entries in the DOM
        while (dataContainer.children.length > MAX_DISPLAY_ENTRIES) {
            dataContainer.removeChild(dataContainer.lastChild);
        }
    }


    // --- Data Fetching ---

    async function fetchStockData() {
        const currentTimestamp = new Date().toISOString();
        let dataToStore;

        /*
        // --- Attempt for a real stock API (e.g., Polygon.io) ---
        // NOTE: This requires an API key and might be rate-limited or have CORS issues
        // when run directly in the browser without a backend proxy.
        // Replace YOUR_API_KEY with an actual API key if you have one.
        const apiKey = 'YOUR_API_KEY'; // Replace with your actual API key
        const stockSymbol = 'TSLA'; // Example stock symbol
        const polygonURL = `https://api.polygon.io/v2/aggs/ticker/${stockSymbol}/prev?adjusted=true&apiKey=${apiKey}`;

        try {
            // const response = await fetch(polygonURL);
            // if (!response.ok) {
            //     throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
            // }
            // const fetchedData = await response.json();
            // dataToStore = fetchedData; // Or process it as needed
            // console.log('Fetched data from Polygon:', dataToStore);
            // displayNewDataEntry(currentTimestamp, dataToStore);
            // saveToLocalStorage(currentTimestamp, dataToStore);
            // return; // Exit if successful
        } catch (error) {
            // console.warn(`Could not fetch from primary source (Polygon): ${error.message}. Falling back.`);
            // displayNewDataEntry(currentTimestamp, `Error fetching primary data: ${error.message}. Falling back.`);
            // No saveToLocalStorage here for primary source error, wait for fallback.
        }
        */

        // --- Fallback/Default Data Source: JSONPlaceholder ---
        // This is used because direct calls to Google Finance are not feasible from client-side JS
        // due to CORS and parsing complexity, and a free, keyless, reliable stock API
        // for direct browser use is not guaranteed to be available or stable.
        const placeholderURL = 'https://jsonplaceholder.typicode.com/todos/1';
        try {
            const response = await fetch(placeholderURL);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const fetchedData = await response.json();
            dataToStore = fetchedData; // Using the placeholder data
            
            console.log('Fetched data from JSONPlaceholder:', dataToStore);
            displayNewDataEntry(currentTimestamp, dataToStore);
            saveToLocalStorage(currentTimestamp, dataToStore);

        } catch (error) {
            console.error('Error fetching stock data (fallback):', error);
            dataToStore = `Error fetching data: ${error.message}`;
            displayNewDataEntry(currentTimestamp, dataToStore);
            // Optionally save error to LocalStorage, or decide not to.
            // saveToLocalStorage(currentTimestamp, dataToStore); // Uncomment to save errors
        }
    }

    // --- Initialization ---

    function initialize() {
        if (!dataContainer) {
            console.error("Data container not found. Aborting initialization.");
            return;
        }
        // Clear "Loading..." message
        const loadingMessage = dataContainer.querySelector('p');
        if (loadingMessage && loadingMessage.textContent.includes("Loading...")) {
            dataContainer.innerHTML = '';
        }
        
        const storedEntries = getStoredData();
        // Display stored entries (newest first, as they are stored unshifted)
        renderDataEntries(storedEntries); 

        // Start fetching data periodically
        fetchStockData(); // Initial fetch
        setInterval(fetchStockData, 1000); // Fetch every 1 second
        console.log("Stock data viewer initialized. Fetching data every 1 second.");
    }

    initialize();
});
