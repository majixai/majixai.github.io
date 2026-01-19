#!/bin/bash

# PWA Setup and Testing Script
# This script helps setup and test the PWA enhancements

echo "==============================================="
echo "  PWA Enhancement Setup & Testing Script"
echo "==============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "ℹ $1"
}

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    print_error "index.html not found. Please run this script from the yfinance_index_1m directory."
    exit 1
fi

print_success "Found index.html"

# Check for required files
echo ""
print_info "Checking required files..."

FILES=(
    "index.html"
    "style.css"
    "script.js"
    "pwa-installer.js"
    "webhook-handler.js"
    "service-worker.js"
    "manifest.json"
)

MISSING_FILES=0
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file exists"
    else
        print_error "$file is missing!"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
done

if [ $MISSING_FILES -gt 0 ]; then
    print_error "$MISSING_FILES file(s) missing. Please ensure all files are present."
    exit 1
fi

# Check for icons directory
echo ""
print_info "Checking icons directory..."
if [ -d "icons" ]; then
    print_success "Icons directory exists"
    ICON_COUNT=$(ls -1 icons/icon-*.png 2>/dev/null | wc -l)
    if [ $ICON_COUNT -eq 0 ]; then
        print_warning "No icon files found in icons/ directory"
        print_info "Generate icons by opening: icons/generate_icons.html in your browser"
    else
        print_success "Found $ICON_COUNT icon file(s)"
    fi
else
    print_error "Icons directory missing"
    mkdir -p icons
    print_success "Created icons directory"
fi

# Check for screenshots directory
if [ -d "screenshots" ]; then
    print_success "Screenshots directory exists"
else
    mkdir -p screenshots
    print_success "Created screenshots directory"
fi

# Validate JSON files
echo ""
print_info "Validating JSON files..."

if command -v python3 &> /dev/null; then
    python3 -m json.tool manifest.json > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_success "manifest.json is valid JSON"
    else
        print_error "manifest.json has syntax errors"
    fi
else
    print_warning "Python3 not found, skipping JSON validation"
fi

# Check file permissions
echo ""
print_info "Checking file permissions..."
for file in "${FILES[@]}"; do
    if [ -r "$file" ]; then
        print_success "$file is readable"
    else
        print_warning "$file is not readable"
    fi
done

# Provide next steps
echo ""
echo "==============================================="
echo "  Setup Complete! Next Steps:"
echo "==============================================="
echo ""
echo "1. Generate Icons (if not done):"
echo "   Open: icons/generate_icons.html in your browser"
echo "   Download all icons and save them in the icons/ directory"
echo ""
echo "2. Test Locally (requires HTTPS):"
echo "   npx http-server -S -p 8080"
echo "   or"
echo "   python3 -m http.server 8080"
echo ""
echo "3. Test PWA Features:"
echo "   - Open DevTools > Application tab"
echo "   - Check Service Worker status"
echo "   - Check Manifest"
echo "   - Test offline mode"
echo "   - Test install prompt"
echo ""
echo "4. Run Lighthouse Audit:"
echo "   - Open DevTools > Lighthouse tab"
echo "   - Select 'Progressive Web App'"
echo "   - Click 'Generate report'"
echo ""
echo "5. Deploy to GitHub Pages:"
echo "   git add ."
echo "   git commit -m 'feat: Add PWA support'"
echo "   git push origin main"
echo ""
echo "==============================================="
echo "  Documentation:"
echo "==============================================="
echo ""
echo "• PWA_ENHANCEMENTS.md - Complete implementation guide"
echo "• ENHANCEMENTS_README.md - Feature documentation"
echo "• SUMMARY.md - Quick reference"
echo "• COMPLETION.md - Enhancement summary"
echo ""
echo "==============================================="
echo "  Troubleshooting:"
echo "==============================================="
echo ""
echo "• Check browser console for errors"
echo "• Verify HTTPS is enabled (required for PWA)"
echo "• Clear cache and reload if changes not appearing"
echo "• Test in incognito/private mode"
echo "• Check DevTools > Application > Service Workers"
echo ""

print_success "Setup check complete!"
echo ""
