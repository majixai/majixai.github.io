#!/bin/bash
# Comprehensive System Test
# Tests all prediction components

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Prediction System Test"
echo "=========================================="
echo

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

test_passed() {
    echo -e "${GREEN}✓ PASSED${NC}: $1"
    ((PASSED++))
}

test_failed() {
    echo -e "${RED}✗ FAILED${NC}: $1"
    ((FAILED++))
}

test_warning() {
    echo -e "${YELLOW}⚠ WARNING${NC}: $1"
}

# Test 1: Check prediction service exists
echo "Test 1: Prediction service files..."
if [ -f "prediction_service.py" ] && [ -x "prediction_service.py" ]; then
    test_passed "prediction_service.py exists and is executable"
else
    test_failed "prediction_service.py missing or not executable"
fi

# Test 2: Check scheduler exists
echo "Test 2: Prediction scheduler..."
if [ -f "run_predictions.sh" ] && [ -x "run_predictions.sh" ]; then
    test_passed "run_predictions.sh exists and is executable"
else
    test_failed "run_predictions.sh missing or not executable"
fi

# Test 3: Check webhook receiver exists
echo "Test 3: Webhook receiver..."
if [ -f "webhook_receiver.py" ] && [ -x "webhook_receiver.py" ]; then
    test_passed "webhook_receiver.py exists and is executable"
else
    test_failed "webhook_receiver.py missing or not executable"
fi

# Test 4: Check GitHub Actions workflows
echo "Test 4: GitHub Actions workflows..."
if [ -f "../../.github/workflows/predict_prices.yml" ]; then
    test_passed "predict_prices.yml workflow exists"
else
    test_failed "predict_prices.yml workflow missing"
fi

if [ -f "../../.github/workflows/webhook_predict.yml" ]; then
    test_passed "webhook_predict.yml workflow exists"
else
    test_failed "webhook_predict.yml workflow missing"
fi

# Test 5: Check data databases exist
echo "Test 5: Data databases..."
if [ -f "dbs/ticker_data_1m.db" ]; then
    SIZE=$(du -h dbs/ticker_data_1m.db | cut -f1)
    RECORDS=$(sqlite3 dbs/ticker_data_1m.db "SELECT COUNT(*) FROM ticker_data_1m" 2>/dev/null || echo "0")
    test_passed "1-minute database exists: $SIZE, $RECORDS records"
else
    test_failed "1-minute database missing"
fi

# Test 6: Test prediction service import
echo "Test 6: Python imports..."
if python3 -c "import prediction_service" 2>/dev/null; then
    test_passed "prediction_service module imports successfully"
else
    test_failed "prediction_service import error"
fi

if python3 -c "import webhook_receiver" 2>/dev/null; then
    test_passed "webhook_receiver module imports successfully"
else
    test_failed "webhook_receiver import error"
fi

# Test 7: Run single ticker prediction
echo "Test 7: Single ticker prediction..."
if timeout 10 python3 prediction_service.py --ticker AAPL --horizons 4 > /tmp/pred_test.txt 2>&1; then
    if grep -q "predicted_change_pct" /tmp/pred_test.txt; then
        test_passed "AAPL prediction generated successfully"
    else
        test_failed "AAPL prediction output invalid"
    fi
else
    test_failed "AAPL prediction execution failed"
fi

# Test 8: Check predictions database
echo "Test 8: Predictions database..."
if [ -f "dbs/predictions.db" ]; then
    PRED_COUNT=$(sqlite3 dbs/predictions.db "SELECT COUNT(*) FROM predictions" 2>/dev/null || echo "0")
    TICKERS=$(sqlite3 dbs/predictions.db "SELECT COUNT(DISTINCT ticker) FROM predictions" 2>/dev/null || echo "0")
    test_passed "Predictions database: $PRED_COUNT predictions for $TICKERS tickers"
else
    test_warning "Predictions database not yet created (will be created on first run)"
fi

# Test 9: Check required Python packages
echo "Test 9: Python dependencies..."
MISSING_DEPS=""

for pkg in numpy pandas; do
    if ! python3 -c "import $pkg" 2>/dev/null; then
        MISSING_DEPS="$MISSING_DEPS $pkg"
    fi
done

if [ -z "$MISSING_DEPS" ]; then
    test_passed "All required Python packages installed"
else
    test_warning "Missing packages:$MISSING_DEPS (optional: scikit-learn)"
fi

# Test 10: Check cron setup script
echo "Test 10: Automation setup..."
if [ -f "setup_prediction_cron.sh" ] && [ -x "setup_prediction_cron.sh" ]; then
    test_passed "setup_prediction_cron.sh exists and is executable"
else
    test_failed "setup_prediction_cron.sh missing or not executable"
fi

# Test 11: Check documentation
echo "Test 11: Documentation..."
if [ -f "README_PREDICTIONS.md" ]; then
    LINES=$(wc -l < README_PREDICTIONS.md)
    test_passed "README_PREDICTIONS.md exists ($LINES lines)"
else
    test_failed "README_PREDICTIONS.md missing"
fi

# Test 12: Validate workflow syntax
echo "Test 12: Workflow syntax..."
if command -v yamllint >/dev/null 2>&1; then
    if yamllint ../../.github/workflows/predict_prices.yml 2>/dev/null; then
        test_passed "predict_prices.yml syntax valid"
    else
        test_warning "predict_prices.yml has yaml warnings"
    fi
else
    test_warning "yamllint not installed, skipping syntax check"
fi

# Summary
echo
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical tests passed!${NC}"
    echo
    echo "System is ready for:"
    echo "  1. Manual predictions: python3 prediction_service.py"
    echo "  2. Scheduled runs: ./run_predictions.sh"
    echo "  3. Cron setup: ./setup_prediction_cron.sh"
    echo "  4. Webhook server: python3 webhook_receiver.py"
    echo "  5. GitHub Actions: Commit workflows to enable automation"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please fix issues before deployment.${NC}"
    exit 1
fi
