// Google Marketplace CSV generation module
export function generateGoogleCsv(products) {
    const headers = [
        'id', 'title', 'description', 'price', 'condition', 'link'
    ];
    let csv = headers.join(',') + '\n';
    products.forEach(product => {
        const row = [
            product.id,
            product.title,
            `"${product.description}"`,
            product.price,
            'new',
            `https://example.com/products/${product.id}`
        ];
        csv += row.join(',') + '\n';
    });
    return csv;
}
