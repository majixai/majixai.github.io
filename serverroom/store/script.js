document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('product-grid');

    fetch('files.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(dataFiles => {
            dataFiles.forEach(file => {
                fetch(file)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.text();
                    })
                    .then(textData => {
                        try {
                            // The file content itself is a JSON string.
                            const fileData = JSON.parse(textData);

                            // The actual product information is in the 'value' field, which is a stringified JSON.
                            const product = JSON.parse(fileData.value);

                            // Check for essential product fields before creating a card.
                            if (product.name && product.price && product.description) {
                                const card = document.createElement('div');
                                card.className = 'product-card';

                                const name = document.createElement('h2');
                                name.textContent = product.name;
                                card.appendChild(name);

                                const price = document.createElement('div');
                                price.className = 'price';
                                // Format to 2 decimal places and add a dollar sign.
                                price.textContent = `$${Number(product.price).toFixed(2)}`;
                                card.appendChild(price);

                                if (product.category) {
                                    const category = document.createElement('div');
                                    category.className = 'category';
                                    category.textContent = `Category: ${product.category}`;
                                    card.appendChild(category);
                                }

                                const description = document.createElement('p');
                                description.className = 'description';
                                description.textContent = product.description;
                                card.appendChild(description);

                                productGrid.appendChild(card);
                            }
                        } catch (e) {
                            console.error(`Skipping file ${file} because it does not contain valid product data.`, e);
                        }
                    })
                    .catch(error => console.error(`Error fetching individual product file ${file}:`, error));
            });
        })
        .catch(error => console.error('Error fetching the product list `files.json`:', error));
});