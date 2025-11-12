// Facebook Marketplace CSV generation module
export function generateFacebookCsv(products) {
    const headers = [
        'id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand'
    ];
    let csv = headers.join(',') + '\n';
    products.forEach(product => {
        const row = [
            product.id,
            product.title,
            `"${product.description}"`,
            'in stock',
            'new',
            product.price,
            `https://example.com/products/${product.id}`,
            `https://example.com/products/${product.id}/image.jpg`,
            'Jump'
        ];
        csv += row.join(',') + '\n';
    });
    return csv;
}
