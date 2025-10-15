document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('product-grid');
    const prevPage = document.getElementById('previous-page');
    const nextPage = document.getElementById('next-page');
    let products = [];
    let currentPage = 1;
    const itemsPerPage = 6;

    function renderProducts() {
        productGrid.innerHTML = '';
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const productsToRender = products.slice(startIndex, endIndex);

        productsToRender.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';

            const name = document.createElement('h2');
            name.textContent = product.name;
            card.appendChild(name);

            const price = document.createElement('div');
            price.className = 'price';
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
        });

        renderPagination();
    }

    function renderPagination() {
        const totalPages = Math.ceil(products.length / itemsPerPage);
        currentPage === 1 ? prevPage.classList.add('disabled') : prevPage.classList.remove('disabled');
        currentPage === totalPages ? nextPage.classList.add('disabled') : nextPage.classList.remove('disabled');
    }

    prevPage.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            renderProducts();
        }
    });

    nextPage.addEventListener('click', (e) => {
        e.preventDefault();
        const totalPages = Math.ceil(products.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderProducts();
        }
    });

    fetch('files.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(dataFiles => {
            const productPromises = dataFiles.map(file =>
                fetch(file)
                    .then(response => response.text())
                    .then(textData => {
                        try {
                            const fileData = JSON.parse(textData);
                            return JSON.parse(fileData.value);
                        } catch (e) {
                            console.error(`Skipping file ${file} because it does not contain valid product data.`, e);
                            return null;
                        }
                    })
            );
            return Promise.all(productPromises);
        })
        .then(productData => {
            products = productData.filter(p => p && p.name && p.price && p.description);
            renderProducts();
        })
        .catch(error => console.error('Error fetching the product list `files.json`:', error));
});