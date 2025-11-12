// Shopify CSV generation module
export function generateShopifyCsv(products) {
    const headers = [
        'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
        'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Option3 Name', 'Option3 Value',
        'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Qty',
        'Variant Inventory Policy', 'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price',
        'Variant Requires Shipping', 'Variant Taxable', 'Variant Barcode', 'Image Src', 'Image Position', 'Image Alt Text'
    ];
    let csv = headers.join(',') + '\n';
    products.forEach(product => {
        const row = [
            product.title.toLowerCase().replace(/\s+/g, '-'),
            product.title,
            `"${product.description}"`,
            'Jump', // Vendor
            'Default', // Type
            '', // Tags
            'true', // Published
            'Title', // Option1 Name
            'Default Title', // Option1 Value
            '', '', '', '', '', '', '', '', '', '', // Options 2 & 3
            product.sku,
            '0',
            '',
            '100', // Variant Inventory Qty
            'deny',
            'manual',
            product.price,
            '',
            'true',
            'true',
            '',
            '',
            '',
            ''
        ];
        csv += row.join(',') + '\n';
    });
    return csv;
}
