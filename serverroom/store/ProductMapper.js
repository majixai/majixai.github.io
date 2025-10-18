class ProductMapper {
    /**
     * @param {object} rawProduct
     * @returns {IProduct}
     */
    static map(rawProduct) {
        const FEATURE_FLAG_NEW = 1; // 001
        const FEATURE_FLAG_SALE = 2; // 010

        let featureFlags = 0;
        if (rawProduct.isNew) {
            featureFlags |= FEATURE_FLAG_NEW;
        }
        if (rawProduct.onSale) {
            featureFlags |= FEATURE_FLAG_SALE;
        }

        return {
            id: ProductService.getProductId(rawProduct),
            name: rawProduct.name,
            price: Number(rawProduct.price),
            description: rawProduct.description,
            category: rawProduct.category,
            featureFlags: featureFlags
        };
    }
}
