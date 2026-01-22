#!/bin/bash
# Quick Start Script for YFinance Background Updater

echo "═══════════════════════════════════════════════════════════"
echo "  YFinance Background Updater - Quick Start"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if we're in the right directory
if [ ! -f "update_data_background.py" ]; then
    echo "❌ Error: Please run this script from the yfinance_index_1m directory"
    exit 1
fi

echo "✓ Located in correct directory"
echo ""

# Create necessary directories
echo "Creating required directories..."
mkdir -p logs data backups
echo "✓ Directories created"
echo ""

# Check Python dependencies
echo "Checking Python dependencies..."
python3 -c "import yfinance, pandas, numpy" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ All dependencies installed"
else
    echo "⚠️  Installing missing dependencies..."
    pip install yfinance pandas numpy
    if [ $? -eq 0 ]; then
        echo "✓ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi
echo ""

# Run a test fetch
echo "Running test fetch for S&P 500..."
python3 update_data_background.py --single ^GSPC
if [ $? -eq 0 ]; then
    echo "✓ Test fetch successful"
else
    echo "❌ Test fetch failed"
    exit 1
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "  Setup Complete! ✓"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "1. Commit and push to GitHub:"
echo "   git add ."
echo "   git commit -m 'Add YFinance background updater'"
echo "   git push"
echo ""
echo "2. Check GitHub Actions:"
echo "   - Go to your repository on GitHub"
echo "   - Click the 'Actions' tab"
echo "   - You should see 'YFinance Background Data Updater'"
echo ""
echo "3. Manual trigger (optional):"
echo "   - Click on the workflow"
echo "   - Click 'Run workflow'"
echo "   - Click 'Run workflow' button"
echo ""
echo "4. Monitor updates:"
echo "   cat logs/last_update.txt"
echo ""
echo "═══════════════════════════════════════════════════════════"
