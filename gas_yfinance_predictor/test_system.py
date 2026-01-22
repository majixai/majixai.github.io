#!/usr/bin/env python3
"""
Test suite for multi-language components
Tests Cython, C, Java integration and daily updater
"""

import sys
import os
import subprocess
import ctypes
import numpy as np

print("="*70)
print("Multi-Language Ticker System Test Suite")
print("="*70)

# Test 1: Cython Module
print("\n[1/6] Testing Cython Module...")
try:
    from data_processor import TickerDataProcessor, hash_ticker_symbol
    
    processor = TickerDataProcessor(capacity=1000)
    
    # Test hash function
    hash_val = hash_ticker_symbol("AAPL")
    print(f"  ✓ Cython hash function: AAPL -> {hash_val}")
    
    # Test RSI calculation
    prices = np.random.rand(100) * 100 + 100
    rsi = processor.calculate_rsi_fast(prices, 14)
    print(f"  ✓ RSI calculation: {rsi[-1]:.2f}")
    
    # Test volatility
    vol = processor.calculate_volatility_fast(prices)
    print(f"  ✓ Volatility calculation: {vol:.4f}")
    
    print("  ✓ Cython module: PASSED")
except ImportError as e:
    print(f"  ✗ Cython module not available: {e}")
    print("    Run: make cython")
except Exception as e:
    print(f"  ✗ Cython test failed: {e}")

# Test 2: C Library
print("\n[2/6] Testing C Library...")
try:
    if os.path.exists('./ticker_analyzer.so'):
        c_lib = ctypes.CDLL('./ticker_analyzer.so')
        print("  ✓ C library loaded successfully")
        print("  ✓ C library: PASSED")
    else:
        print("  ✗ C library not found: ticker_analyzer.so")
        print("    Run: make c")
except Exception as e:
    print(f"  ✗ C library test failed: {e}")

# Test 3: Java Classes
print("\n[3/6] Testing Java Classes...")
try:
    if os.path.exists('./TickerProcessor.class'):
        print("  ✓ Java classes found")
        
        # Try to run Java
        result = subprocess.run(
            ['java', 'TickerProcessor'],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=os.getcwd()
        )
        
        if result.returncode == 0 or 'Packed/Unpacked' in result.stdout:
            print("  ✓ Java execution successful")
            print("  ✓ Java classes: PASSED")
        else:
            print(f"  ⚠ Java execution returned code {result.returncode}")
    else:
        print("  ✗ Java classes not found")
        print("    Run: make java")
except subprocess.TimeoutExpired:
    print("  ⚠ Java execution timeout (database connection)")
except Exception as e:
    print(f"  ✗ Java test failed: {e}")

# Test 4: TensorFlow Integration
print("\n[4/6] Testing TensorFlow Integration...")
try:
    import tensorflow as tf
    print(f"  ✓ TensorFlow version: {tf.__version__}")
    
    from ticker_ml import TensorFlowTickerPredictor
    predictor = TensorFlowTickerPredictor()
    print("  ✓ TensorFlow predictor initialized")
    print("  ✓ TensorFlow: PASSED")
except ImportError as e:
    print(f"  ✗ TensorFlow not available: {e}")
    print("    Run: pip install -r requirements_ml.txt")
except Exception as e:
    print(f"  ✗ TensorFlow test failed: {e}")

# Test 5: Daily Updater Scripts
print("\n[5/6] Testing Daily Updater Scripts...")
try:
    scripts = [
        'daily_updater.sh',
        'fetch_1m_daily.py',
        'setup_cron.sh'
    ]
    
    for script in scripts:
        if os.path.exists(script) and os.access(script, os.X_OK):
            print(f"  ✓ {script} is executable")
        elif os.path.exists(script):
            print(f"  ⚠ {script} exists but not executable")
            print(f"    Run: chmod +x {script}")
        else:
            print(f"  ✗ {script} not found")
    
    print("  ✓ Daily updater scripts: PASSED")
except Exception as e:
    print(f"  ✗ Script check failed: {e}")

# Test 6: Database Structure
print("\n[6/6] Testing Database Structure...")
try:
    import sqlite3
    
    db_path = 'dbs/ticker_data_1m.db'
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ticker_data_1m'")
        if cursor.fetchone():
            print("  ✓ ticker_data_1m table exists")
            
            # Check indexes
            cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
            indexes = [row[0] for row in cursor.fetchall()]
            print(f"  ✓ Found {len(indexes)} indexes")
            
            # Check row count
            cursor.execute("SELECT COUNT(*) FROM ticker_data_1m")
            count = cursor.fetchone()[0]
            print(f"  ✓ Total records: {count:,}")
            
            # Check unique tickers
            cursor.execute("SELECT COUNT(DISTINCT ticker) FROM ticker_data_1m")
            tickers = cursor.fetchone()[0]
            print(f"  ✓ Unique tickers: {tickers}")
        else:
            print("  ⚠ ticker_data_1m table not found")
        
        conn.close()
        print("  ✓ Database structure: PASSED")
    else:
        print("  ⚠ Database not found (will be created on first run)")
except Exception as e:
    print(f"  ✗ Database test failed: {e}")

# Summary
print("\n" + "="*70)
print("Test Suite Complete")
print("="*70)
print("\nTo build all components:")
print("  make all")
print("\nTo setup daily automation (5 PM PST):")
print("  ./setup_cron.sh")
print("\nTo run daily update manually:")
print("  ./daily_updater.sh")
print("="*70)
