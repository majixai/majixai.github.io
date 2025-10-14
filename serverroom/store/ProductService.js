(function(window) {
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
                    product.id = this.getProductId(product);
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

        async getProduct(productId) {
            const products = await this.getAllProducts();
            return products.find(p => this.getProductId(p) === productId);
        }

        getProductId(product) {
            return product.name.toLowerCase().replace(/\s+/g, '-');
        }

    async updateCartCount() {
        const cartService = new CartService();
        await cartService.updateCartCount();
    }
    }

    window.ProductService = ProductService;
})(window);