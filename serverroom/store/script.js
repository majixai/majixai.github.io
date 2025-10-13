class ProductService {
    constructor() {
        this.productCache = new Map();
    }

    async fetchProductFiles() {
        try {
            const response = await fetch('files.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching the product list `files.json`:', error);
            return [];
        }
    }

    async fetchProductData(file) {
        if (this.productCache.has(file)) {
            return this.productCache.get(file);
        }

        try {
            const response = await fetch(file);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const textData = await response.text();
            const fileData = JSON.parse(textData);
            const product = JSON.parse(fileData.value);

            if (product.name && product.price && product.description) {
                this.productCache.set(file, product);
                return product;
            }
        } catch (e) {
            console.error(`Skipping file ${file} because it does not contain valid product data.`, e);
        }
        return null;
    }

    async getAllProducts() {
        const productFiles = await this.fetchProductFiles();
        const productPromises = productFiles.map(file => this.fetchProductData(file));
        const products = await Promise.all(productPromises);
        return products.filter(p => p !== null);
    }
}

class ProductRenderer {
    constructor(productGrid) {
        this.productGrid = productGrid;
    }

    renderProduct(product) {
        const col = document.createElement('div');
        col.className = 'col-md-4 mb-4';

        const card = document.createElement('div');
        card.className = 'card product-card';

        const cardBody = document.createElement('div');
        cardBody.className = 'card-body d-flex flex-column';

        const name = document.createElement('h5');
        name.className = 'card-title';
        name.textContent = product.name;
        cardBody.appendChild(name);

        const price = document.createElement('p');
        price.className = 'card-text price';
        price.textContent = `$${Number(product.price).toFixed(2)}`;
        cardBody.appendChild(price);

        if (product.category) {
            const category = document.createElement('p');
            category.className = 'card-text category';
            category.textContent = `Category: ${product.category}`;
            cardBody.appendChild(category);
        }

        const description = document.createElement('p');
        description.className = 'card-text description';
        description.textContent = product.description;
        cardBody.appendChild(description);

        card.appendChild(cardBody);
        col.appendChild(card);
        this.productGrid.appendChild(col);
    }

    render(products) {
        this.productGrid.innerHTML = '';
        products.forEach(product => this.renderProduct(product));
    }
}

class App {
    constructor() {
        this.productService = new ProductService();
        this.productGrid = document.getElementById('product-grid');
        this.productRenderer = new ProductRenderer(this.productGrid);
        this.sortBy = document.getElementById('sort-by');
        this.filterByCategory = document.getElementById('filter-by-category');
        this.products = [];
    }

    async init() {
        this.products = await this.productService.getAllProducts();
        this.populateCategoryFilter();
        this.renderProducts();
        this.addEventListeners();
    }

    populateCategoryFilter() {
        const categories = [...new Set(this.products.map(p => p.category).filter(Boolean))];
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            this.filterByCategory.appendChild(option);
        });
    }

    addEventListeners() {
        this.sortBy.addEventListener('change', () => this.renderProducts());
        this.filterByCategory.addEventListener('change', () => this.renderProducts());
    }

    sortProducts(products) {
        const [sortBy, order] = this.sortBy.value.split('-');
        return [...products].sort((a, b) => {
            if (sortBy === 'name') {
                return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            return order === 'asc' ? a.price - b.price : b.price - a.price;
        });
    }

    filterProducts(products) {
        const category = this.filterByCategory.value;
        if (category === 'all') {
            return products;
        }
        return products.filter(p => p.category === category);
    }

    renderProducts() {
        let productsToRender = this.filterProducts(this.products);
        productsToRender = this.sortProducts(productsToRender);
        this.productRenderer.render(productsToRender);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});