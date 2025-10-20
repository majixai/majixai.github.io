(function(window) {
    class ProductService {
        #cacheService;
        #productStore;

        constructor() {
            this.#cacheService = new CacheService('JinxGenProductCache', 2);
            this.#productStore = 'products';
        }

        async #fetchProductFiles() {
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

        async #fetchProductData(file) {
            const cachedProduct = await this.#cacheService.get(this.#productStore, file);
            if (cachedProduct) {
                return cachedProduct;
            }

            try {
                const response = await fetch(file);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const textData = await response.text();
                const fileData = JSON.parse(textData);
                const rawProduct = JSON.parse(fileData.value);

                if (rawProduct && rawProduct.name) {
                    const product = ProductMapper.map(rawProduct);
                    await this.#cacheService.set(this.#productStore, file, product);
                    return product;
                } else {
                    console.error(`Skipping file ${file} because it does not contain a valid product object.`);
                }
            } catch (e) {
                console.error(`Skipping file ${file} because it does not contain valid product data.`, e);
            }
            return null;
        }

        async getAllProducts() {
            const productFiles = await this.#fetchProductFiles();
            const productPromises = productFiles.map(file => this.#fetchProductData(file));
            const products = await Promise.all(productPromises);
            return products.filter(p => p !== null);
        }

        async *getProductGenerator() {
            const products = await this.getAllProducts();
            for (const product of products) {
                yield product;
            }
        }

        async getProduct(productId) {
            const products = await this.getAllProducts();
            return products.find(p => p.id === productId);
        }

        static getProductId(product) {
            return product.name.toLowerCase().replace(/\s+/g, '-');
        }
    }

    window.ProductService = ProductService;
})(window);
