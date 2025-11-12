import { generateProducts } from './product-generator.js';
import { generateShopifyCsv } from './shopify-csv-generator.js';
import { generateGoogleCsv } from './google-csv-generator.js';
import { generateFacebookCsv } from './facebook-csv-generator.js';

document.getElementById('generate-btn').addEventListener('click', () => {
    const products = generateProducts(100);
    const output = document.getElementById('output');
    output.innerHTML = '';

    const shopifyCsv = generateShopifyCsv(products);
    const googleCsv = generateGoogleCsv(products);
    const facebookCsv = generateFacebookCsv(products);

    createDownloadLink(shopifyCsv, 'shopify.csv', 'Shopify CSV');
    createDownloadLink(googleCsv, 'google.csv', 'Google CSV');
    createDownloadLink(facebookCsv, 'facebook.csv', 'Facebook CSV');
});

function createDownloadLink(csv, filename, text) {
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
    link.target = '_blank';
    link.download = filename;
    link.textContent = text;
    document.getElementById('output').appendChild(link);
}
