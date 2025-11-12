// Product data generation module
export function generateProducts(count = 100) {
    const products = [];
    for (let i = 0; i < count; i++) {
        products.push({
            id: i,
            title: `Product ${i}`,
            description: `This is a description for product ${i}`,
            price: (Math.random() * 100).toFixed(2),
            sku: `SKU-${i}`
        });
    }
    return products;
}
