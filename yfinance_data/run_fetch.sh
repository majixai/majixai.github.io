#!/bin/bash

# YFinance Data Fetcher - Comprehensive Script
# Fetches 1000 tickers with extensive logging

echo "============================================================="
echo "YFINANCE DATA FETCHER - 1000 TICKERS"
echo "============================================================="
echo ""
echo "This script will fetch data for 1000 tickers including:"
echo "  - S&P 500 components"
echo "  - NASDAQ 100 components"
echo "  - Popular ETFs"
echo "  - Cryptocurrency"
echo "  - Meme stocks and growth stocks"
echo ""
echo "Estimated time: 5-10 minutes"
echo "Output: yfinance_data/yfinance.dat (compressed database)"
echo ""
echo "============================================================="
echo ""

# Change to the correct directory
cd /workspaces/majixai.github.io

# Check if ticker list exists
if [ ! -f "yfinance_data/ticker_list.txt" ]; then
    echo "ERROR: ticker_list.txt not found!"
    echo "Run: python3 yfinance_data/generate_tickers_hardcoded.py"
    exit 1
fi

TICKER_COUNT=$(wc -l < yfinance_data/ticker_list.txt)
echo "Found $TICKER_COUNT tickers in ticker_list.txt"
echo ""

# Ask for confirmation
read -p "Start fetching data? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Fetch cancelled."
    exit 0
fi

echo ""
echo "Starting fetch... (logging to terminal)"
echo "============================================================="
echo ""

# Run the fetch script
python3 yfinance_data/fetch_data.py

EXIT_CODE=$?

echo ""
echo "============================================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ FETCH COMPLETED SUCCESSFULLY"
    
    if [ -f "yfinance_data/yfinance.dat" ]; then
        SIZE=$(stat -f%z "yfinance_data/yfinance.dat" 2>/dev/null || stat -c%s "yfinance_data/yfinance.dat")
        SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc)
        echo "✓ Database file: yfinance_data/yfinance.dat ($SIZE_MB MB)"
    fi
    
    echo ""
    echo "Next steps:"
    echo "  1. Test the page locally: open yfinance_data/index.html"
    echo "  2. Commit and push:"
    echo "     git add yfinance_data/yfinance.dat"
    echo "     git commit -m 'Update yfinance data with 1000 tickers'"
    echo "     git push origin Test"
else
    echo "✗ FETCH FAILED (exit code: $EXIT_CODE)"
    echo "Check the logs above for errors"
fi
echo "============================================================="
