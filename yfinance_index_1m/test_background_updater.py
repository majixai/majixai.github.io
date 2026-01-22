#!/usr/bin/env python3
"""
Quick test to verify the background updater works
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test that all required modules can be imported"""
    print("Testing imports...")
    try:
        import yfinance as yf
        print("  ✓ yfinance")
    except ImportError:
        print("  ✗ yfinance - Please install: pip install yfinance")
        return False
    
    try:
        import pandas as pd
        print("  ✓ pandas")
    except ImportError:
        print("  ✗ pandas - Please install: pip install pandas")
        return False
    
    try:
        import numpy as np
        print("  ✓ numpy")
    except ImportError:
        print("  ✗ numpy - Please install: pip install numpy")
        return False
    
    print("  All imports successful!\n")
    return True

def test_fetch_single():
    """Test fetching a single index"""
    print("Testing single index fetch (^GSPC)...")
    try:
        from update_data_background import YFinanceUpdater
        
        updater = YFinanceUpdater()
        result = updater.fetch_index_data('^GSPC', 'S&P 500')
        
        if result:
            print("  ✓ Successfully fetched S&P 500 data")
            if 'summary' in result and result['summary']:
                summary = result['summary']
                print(f"    Price: ${summary['current_price']:.2f}")
                print(f"    Change: {summary['change_pct']:+.2f}%")
            return True
        else:
            print("  ✗ No data returned")
            return False
            
    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_file_structure():
    """Test that required directories exist or can be created"""
    print("Testing file structure...")
    
    from pathlib import Path
    
    required_dirs = ['logs', 'data', 'backups']
    
    for dirname in required_dirs:
        dirpath = Path(dirname)
        if dirpath.exists():
            print(f"  ✓ {dirname}/ exists")
        else:
            try:
                dirpath.mkdir(parents=True, exist_ok=True)
                print(f"  ✓ {dirname}/ created")
            except Exception as e:
                print(f"  ✗ Failed to create {dirname}/: {e}")
                return False
    
    print("  File structure OK!\n")
    return True

def test_github_workflow():
    """Test that the GitHub workflow file exists"""
    print("Testing GitHub workflow...")
    
    from pathlib import Path
    
    workflow_file = Path('../.github/workflows/yfinance_background_updater.yml')
    
    if workflow_file.exists():
        print("  ✓ Workflow file exists")
        print(f"    Location: {workflow_file.absolute()}")
        return True
    else:
        print("  ✗ Workflow file not found")
        print(f"    Expected: {workflow_file.absolute()}")
        return False

def main():
    """Run all tests"""
    print("=" * 70)
    print("YFinance Background Updater - System Test")
    print("=" * 70)
    print()
    
    tests = [
        ("Imports", test_imports),
        ("File Structure", test_file_structure),
        ("GitHub Workflow", test_github_workflow),
        ("Single Index Fetch", test_fetch_single),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"  ✗ Test '{name}' crashed: {e}")
            results.append((name, False))
        print()
    
    # Summary
    print("=" * 70)
    print("Test Summary")
    print("=" * 70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status} - {name}")
    
    print()
    print(f"Total: {passed}/{total} tests passed")
    print("=" * 70)
    
    if passed == total:
        print("\n🎉 All tests passed! The background updater is ready to use.")
        print("\nNext steps:")
        print("  1. Commit and push the changes to GitHub")
        print("  2. Check GitHub Actions tab to see the workflow")
        print("  3. Manually trigger the workflow or wait for scheduled run")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please review the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
