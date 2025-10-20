(function() {
    'use strict';

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

    // --- Main Application Logic for Static Site ---
    async function main() {
        try {
            // Fetch data from the local JSON file
            const response = await fetch('static/properties.json');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const properties = await response.json();
            displayProperties(properties);
        } catch (error) {
            console.error('Failed to fetch properties:', error);
            const grid = document.getElementById('property-grid');
            grid.innerHTML = '<p>Error loading properties. Please try again later.</p>';
        }
    }

    document.addEventListener('DOMContentLoaded', main);

})();