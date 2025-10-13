class ProductDetailRenderer {
    constructor(productDetailContainer) {
        this.productDetailContainer = productDetailContainer;
    }

    render(product) {
        this.productDetailContainer.innerHTML = `
            <div class="col-md-6">
                <img src="https://via.placeholder.com/500" class="img-fluid" alt="${product.name}">
            </div>
            <div class="col-md-6">
                <h2>${product.name}</h2>
                <p class="price">$${Number(product.price).toFixed(2)}</p>
                <p class="category">Category: ${product.category}</p>
                <p class="description">${product.description}</p>
                <button class="btn btn-primary">Add to Cart</button>
            </div>
        `;
    }
}

class RecentlyViewed {
    constructor() {
        this.key = 'recentlyViewed';
        this.maxItems = 5;
    }

    add(productId) {
        let items = this.get();
        // Remove the item if it already exists to avoid duplicates and move it to the front
        items = items.filter(item => item !== productId);
        items.unshift(productId);
        // Keep the list at a max size
        if (items.length > this.maxItems) {
            items.pop();
        }
        localStorage.setItem(this.key, JSON.stringify(items));
    }

    get() {
        return JSON.parse(localStorage.getItem(this.key)) || [];
    }

    async render(container, currentProductId) {
        const items = this.get().filter(id => id !== currentProductId);
        if (items.length === 0) {
            container.innerHTML = '<p>No recently viewed items.</p>';
            return;
        }

        const productService = new ProductService();
        const products = await Promise.all(items.map(id => productService.getProduct(id)));

        container.innerHTML = products
            .filter(Boolean)
            .map(product => `
                <div class="col-md-3">
                    <a href="product.html?product=${productService.getProductId(product)}" class="card product-card text-decoration-none text-dark">
                        <div class="card-body">
                            <h5 class="card-title">${product.name}</h5>
                            <p class="card-text price">$${Number(product.price).toFixed(2)}</p>
                        </div>
                    </a>
                </div>
            `).join('');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');

    if (productId) {
        const productService = new ProductService();
        const product = await productService.getProduct(productId);

        if (product) {
            const productDetailContainer = document.getElementById('product-detail');
            const renderer = new ProductDetailRenderer(productDetailContainer);
            renderer.render(product);

            document.title = product.name;

            const recentlyViewed = new RecentlyViewed();
            recentlyViewed.add(productId);
            recentlyViewed.render(document.getElementById('recently-viewed'), productId);
        } else {
            // Handle product not found
            document.getElementById('product-detail').innerHTML = '<p>Product not found.</p>';
        }
    }
});