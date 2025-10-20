class ProductRenderer {
    #productGrid;

    constructor(productGrid) {
        this.#productGrid = productGrid;
    }

    renderProduct(product) {
        const col = document.createElement('div');
        col.className = 'col-md-4 mb-4';

        const card = document.createElement('a');
        card.className = 'card product-card text-decoration-none text-dark animated';
        card.href = `product.html?product=${ProductService.getProductId(product)}`;

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
        this.#productGrid.appendChild(col);
    }

    render(products) {
        this.#productGrid.innerHTML = '';
        products.forEach(product => this.renderProduct(product));
    }
}

class App {
    #productService;
    #productGrid;
    #productRenderer;
    #sortBy;
    #filterByCategory;
    #search;
    #products;
    #currentPage;
    #productsPerPage;

    constructor() {
        this.#productService = new ProductService();
        this.#productGrid = document.getElementById('product-grid');
        this.#productRenderer = new ProductRenderer(this.#productGrid);
        this.#sortBy = document.getElementById('sort-by');
        this.#filterByCategory = document.getElementById('filter-by-category');
        this.#search = document.getElementById('search');
        this.#products = [];
        this.#currentPage = 1;
        this.#productsPerPage = 6;
    }

    async init() {
        const cartService = new CartService();
        cartService.updateCartCount();
        for await (const product of this.#productService.getProductGenerator()) {
            this.#products.push(product);
        }
        this.#populateCategoryFilter();
        this.renderProducts();
        this.#addEventListeners();
    }

    #populateCategoryFilter() {
        const categories = [...new Set(this.#products.map(p => p.category).filter(Boolean))];
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            this.#filterByCategory.appendChild(option);
        });
    }

    #addEventListeners() {
        this.#sortBy.addEventListener('change', () => this.renderProducts());
        this.#filterByCategory.addEventListener('change', () => this.renderProducts());
        this.#search.addEventListener('input', () => this.renderProducts());
    }

    #searchProducts(products) {
        const searchTerm = this.#search.value.toLowerCase();
        if (!searchTerm) {
            return products;
        }
        return products.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm)
        );
    }

    #sortProducts(products) {
        const [sortBy, order] = this.#sortBy.value.split('-');
        return [...products].sort((a, b) => {
            if (sortBy === 'name') {
                return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            return order === 'asc' ? a.price - b.price : b.price - a.price;
        });
    }

    #filterProducts(products) {
        const category = this.#filterByCategory.value;
        if (category === 'all') {
            return products;
        }
        return products.filter(p => p.category === category);
    }

    renderProducts() {
        let productsToRender = this.#searchProducts(this.#products);
        productsToRender = this.#filterProducts(productsToRender);
        productsToRender = this.#sortProducts(productsToRender);

        const startIndex = (this.#currentPage - 1) * this.#productsPerPage;
        const endIndex = startIndex + this.#productsPerPage;
        const paginatedProducts = productsToRender.slice(startIndex, endIndex);

        this.#productRenderer.render(paginatedProducts);
        this.#renderPagination(productsToRender.length);
    }

    #renderPagination(totalProducts) {
        const totalPages = Math.ceil(totalProducts / this.#productsPerPage);
        const paginationContainer = document.getElementById('pagination');
        paginationContainer.innerHTML = '';

        if (totalPages <= 1) return;

        for (let i = 1; i <= totalPages; i++) {
            const pageLink = document.createElement('button');
            pageLink.className = `w3-button ${this.#currentPage === i ? 'w3-theme-d1' : ''}`;
            pageLink.textContent = i;
            pageLink.addEventListener('click', () => {
                this.#currentPage = i;
                this.renderProducts();
            });
            paginationContainer.appendChild(pageLink);
        }
    }
}

class Autocomplete {
    #searchEl;
    #resultsEl;
    #productService;
    #products;

    constructor(searchEl, resultsEl, productService) {
        this.#searchEl = searchEl;
        this.#resultsEl = resultsEl;
        this.#productService = productService;
        this.#products = [];
    }

    async init() {
        this.#products = await this.#productService.getAllProducts();
        this.#searchEl.addEventListener('input', () => this.render());
        document.addEventListener('click', (e) => {
            if (!this.#searchEl.contains(e.target)) {
                this.#resultsEl.innerHTML = '';
            }
        });
    }

    render() {
        const searchTerm = this.#searchEl.value.toLowerCase();
        if (!searchTerm) {
            this.#resultsEl.innerHTML = '';
            return;
        }

        const matchingProducts = this.#products.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm)
        ).slice(0, 5); // Limit to 5 suggestions

        this.#resultsEl.innerHTML = matchingProducts.map(p => `
            <a href="product.html?product=${ProductService.getProductId(p)}" class="list-group-item list-group-item-action">
                ${p.name}
            </a>
        `).join('');
    }
}

function toggleMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu.classList.contains('w3-show')) {
        menu.classList.remove('w3-show');
    } else {
        menu.classList.add('w3-show');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();

    const searchEl = document.getElementById('search');
    const resultsEl = document.getElementById('autocomplete-results');
    const productService = new ProductService();
    const autocomplete = new Autocomplete(searchEl, resultsEl, productService);
    autocomplete.init();

    const animationsToggle = document.getElementById('animations-toggle');
    animationsToggle.addEventListener('change', () => {
        const productCards = document.querySelectorAll('.product-card');
        if (animationsToggle.checked) {
            productCards.forEach(card => card.classList.add('animated'));
        } else {
            productCards.forEach(card => card.classList.remove('animated'));
        }
    });
});
