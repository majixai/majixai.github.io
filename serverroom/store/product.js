class ProductDetailRenderer {
    #productDetailContainer;

    constructor(productDetailContainer) {
        this.#productDetailContainer = productDetailContainer;
    }

    render(product) {
        let options = '';
        if (product.sizes) {
            options += `
                <div class="mb-3">
                    <label for="size-select" class="form-label">Size:</label>
                    <select id="size-select" class="form-select">
                        ${product.sizes.map(size => `<option>${size}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        options += `
            <div class="mb-3">
                <label for="quantity-input" class="form-label">Quantity:</label>
                <input type="number" id="quantity-input" class="form-control" value="1" min="1">
            </div>
        `;

        this.#productDetailContainer.innerHTML = `
            <div class="col-md-6">
                <img src="https://source.unsplash.com/500x500/?${product.name}" class="img-fluid" alt="${product.name}">
            </div>
            <div class="col-md-6">
                <h2>${product.name}</h2>
                <p class="price">$${Number(product.price).toFixed(2)}</p>
                <p class="category">Category: ${product.category}</p>
                <p class="description">${product.description}</p>
                ${options}
                <button class="btn btn-primary">Add to Cart</button>
            </div>
        `;
    }
}

class RecentlyViewed {
    #key = 'recentlyViewed';
    #maxItems = 5;

    add(productId) {
        let items = this.#get();
        // Remove the item if it already exists to avoid duplicates and move it to the front
        items = items.filter(item => item !== productId);
        items.unshift(productId);
        // Keep the list at a max size
        if (items.length > this.#maxItems) {
            items.pop();
        }
        localStorage.setItem(this.#key, JSON.stringify(items));
    }

    #get() {
        return JSON.parse(localStorage.getItem(this.#key)) || [];
    }

    async render(container, currentProductId) {
        const items = this.#get().filter(id => id !== currentProductId);
        if (items.length === 0) {
            container.innerHTML = '<p>No recently viewed items.</p>';
            return;
        }

        const productService = new ProductService();
        const allProducts = await productService.getAllProducts();
        const products = items.map(id => allProducts.find(p => p.id === id));

        container.innerHTML = products
            .filter(Boolean)
            .map(product => `
                <div class="col-md-3">
                    <a href="product.html?product=${ProductService.getProductId(product)}" class="card product-card text-decoration-none text-dark">
                        <div class="card-body">
                            <h5 class="card-title">${product.name}</h5>
                            <p class="card-text price">$${Number(product.price).toFixed(2)}</p>
                        </div>
                    </a>
                </div>
            `).join('');
    }
}

async function main() {
    const cartService = new CartService();
    cartService.updateCartCount();

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');

    if (productId) {
        console.log("Product ID:", productId);
        const productService = new ProductService();
        const product = await productService.getProduct(productId);
        console.log("Product:", product);

        if (product) {
            const productDetailContainer = document.getElementById('product-detail');
            const renderer = new ProductDetailRenderer(productDetailContainer);
            renderer.render(product);

            document.title = product.name;

            const recentlyViewed = new RecentlyViewed();
            recentlyViewed.add(productId);
            recentlyViewed.render(document.getElementById('recently-viewed'), productId);

            document.querySelector('.btn-primary').addEventListener('click', () => {
                const sizeEl = document.getElementById('size-select');
                const quantityEl = document.getElementById('quantity-input');

                const selectedOptions = {
                    size: sizeEl ? sizeEl.value : null,
                    quantity: quantityEl ? parseInt(quantityEl.value, 10) : 1
                };

                cartService.addProduct(product, selectedOptions);
            });
        } else {
            // Handle product not found
            document.getElementById('product-detail').innerHTML = '<p>Product not found.</p>';
        }
    }
}

window.addEventListener('DOMContentLoaded', main);
