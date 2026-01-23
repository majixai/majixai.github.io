# PWA Icons and Screenshots

## Icon Requirements

The PWA requires icons in multiple sizes for different devices and contexts:

### Required Sizes
- 72x72 (iOS, Android)
- 96x96 (Android)
- 128x128 (Desktop, Chrome)
- 144x144 (Android, Microsoft)
- 152x152 (iOS)
- 192x192 (Android, Chrome standard)
- 384x384 (Android splash)
- 512x512 (PWA standard, maskable)

### Icon Design Guidelines
1. **Background**: Gradient from #0f0c29 (dark purple) to #667eea (blue)
2. **Symbol**: White stock chart line with upward trend
3. **Text**: "YF" or stock chart icon in the center
4. **Format**: PNG with transparency
5. **Safe Zone**: Keep important content within 80% of canvas (maskable icons)

## Generate Icons

### Using Online Tools
1. Visit https://www.pwabuilder.com/imageGenerator
2. Upload a 512x512 base icon
3. Generate all required sizes
4. Download and place in `/yfinance_data/icons/` directory

### Using ImageMagick (Command Line)
```bash
# Start with a 512x512 source icon
convert icon-512x512.png -resize 72x72 icon-72x72.png
convert icon-512x512.png -resize 96x96 icon-96x96.png
convert icon-512x512.png -resize 128x128 icon-128x128.png
convert icon-512x512.png -resize 144x144 icon-144x144.png
convert icon-512x512.png -resize 152x152 icon-152x152.png
convert icon-512x512.png -resize 192x192 icon-192x192.png
convert icon-512x512.png -resize 384x384 icon-384x384.png
```

### Using Node.js Script
```javascript
const sharp = require('sharp');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
    sharp('source-icon.png')
        .resize(size, size)
        .toFile(`icon-${size}x${size}.png`)
        .then(() => console.log(`Generated ${size}x${size}`));
});
```

## Screenshots

### Requirements
- **Dimensions**: 1280x720 or 1920x1080 (16:9 ratio)
- **Format**: PNG
- **Content**: Show key features of the app
- **Count**: At least 2 (main list and detail analysis views)

### Recommended Screenshots
1. **main-list.png**: Show the main ticker list with pagination
2. **detail-analysis.png**: Show the detail page with charts and analysis

### Capture Instructions
1. Open the app in desktop browser
2. Set viewport to 1280x720 (use DevTools Device Mode)
3. Take full-page screenshot using browser DevTools
4. Crop and optimize for filesize
5. Save to `/yfinance_data/screenshots/` directory

## Temporary Placeholders

Until proper icons are generated, you can use placeholder SVG data URIs in manifest.json:

```json
{
    "src": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Crect width='512' height='512' fill='%23667eea'/%3E%3Ctext x='256' y='256' font-size='200' fill='white' text-anchor='middle' dominant-baseline='middle'%3EYF%3C/text%3E%3C/svg%3E",
    "sizes": "512x512",
    "type": "image/svg+xml"
}
```

## Verification

After adding icons, verify PWA requirements:

1. **Lighthouse Audit**:
   - Open DevTools → Lighthouse
   - Run PWA audit
   - Check for installability criteria

2. **Manual Test**:
   - Open in Chrome/Edge
   - Look for install prompt in address bar
   - Check "Install App" in browser menu

3. **Manifest Validation**:
   - Visit https://manifest-validator.appspot.com/
   - Paste your manifest.json content
   - Fix any validation errors

## Current Status

⚠️ **Placeholder icons needed** - Create icons following the guidelines above.

Icons will be automatically picked up when placed in the `/icons/` directory with filenames matching the manifest.json references.
