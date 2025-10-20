(function() {
    'use strict';

    const DB_NAME = 'REIT_DB';
    const STORE_NAME = 'properties';
    const DB_VERSION = 1;

    // --- IndexedDB Helper Functions ---
    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'address' });
                }
            };
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(event.target.error);
        });
    }

    function cacheProperties(db, properties) {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        properties.forEach(prop => store.put(prop));
        return transaction.complete;
    }

    function getCachedProperties(db) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // --- Display Logic ---
    function displayProperties(properties) {
        const grid = document.getElementById('property-grid');
        grid.innerHTML = ''; // Clear existing content
        if (!properties || properties.length === 0) {
            grid.innerHTML = '<p>No properties available.</p>';
            return;
        }
        properties.forEach(prop => {
            const card = document.createElement('div');
            card.className = 'property-card';
            card.innerHTML = `
                <h5>${prop.address}</h5>
                <p>Type: ${prop.type}</p>
                <p>Price: $${prop.price.toLocaleString()}</p>
            `;
            grid.appendChild(card);
        });
    }

    // --- Main Application Logic ---
    async function main() {
        let db;
        try {
            db = await openDb();
            const cachedData = await getCachedProperties(db);
            if (cachedData.length > 0) {
                console.log("Displaying data from cache.");
                displayProperties(cachedData);
            }
        } catch (err) {
            console.error("IndexedDB error:", err);
        }

        try {
            console.log("Fetching fresh data...");
            const response = await fetch('/api/properties');
            if (!response.ok) throw new Error('Network response failed');
            const properties = await response.json();

            console.log("Displaying fresh data and updating cache.");
            displayProperties(properties);

            if (db) {
                await cacheProperties(db, properties);
                console.log("Cache updated.");
            }
        } catch (error) {
            console.error('Failed to fetch properties:', error);
            const grid = document.getElementById('property-grid');
            if (!grid.hasChildNodes()) {
                 grid.innerHTML = '<p>Error loading properties. Please try again later.</p>';
            }
        }
    }

    document.addEventListener('DOMContentLoaded', main);

})();