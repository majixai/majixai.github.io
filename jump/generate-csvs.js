// Node.js script to generate CSV files
import { generateProducts } from './js/product-generator.js';
import { generateShopifyCsv } from './js/shopify-csv-generator.js';
import { generateGoogleCsv } from './js/google-csv-generator.js';
import { generateFacebookCsv } from './js/facebook-csv-generator.js';
import fs from 'fs';
import path from 'path';

const productCount = process.argv[2] ? parseInt(process.argv[2], 10) : 100;
const products = generateProducts(productCount);

const shopifyCsv = generateShopifyCsv(products);
const googleCsv = generateGoogleCsv(products);
const facebookCsv = generateFacebookCsv(products);

const outputDir = 'jump/products';
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(path.join(outputDir, 'shopify.csv'), shopifyCsv);
fs.writeFileSync(path.join(outputDir, 'google.csv'), googleCsv);
fs.writeFileSync(path.join(outputDir, 'facebook.csv'), facebookCsv);

console.log(`${productCount} products generated and saved to CSV files in ${outputDir}`);
