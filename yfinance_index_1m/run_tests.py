#!/usr/bin/env python3
"""
Master Test Runner for YFinance PWA
Executes all unit and integration tests with detailed reporting
"""
import unittest
import sys
import os
from io import StringIO

def run_test_suite(test_module_name):
    """Run tests from a specific module and return results"""
    # Load the test module
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromName(test_module_name)
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(verbosity=2, stream=sys.stdout)
    result = runner.run(suite)
    
    return result

def main():
    """Run all test suites and provide summary"""
    print("=" * 70)
    print("YFinance PWA Test Suite Runner")
    print("=" * 70)
    print()
    
    # Test modules to run
    test_modules = [
        'test_pwa',
        'test_integration'
    ]
    
    all_results = []
    
    for module in test_modules:
        print(f"\n{'=' * 70}")
        print(f"Running {module}.py")
        print('=' * 70)
        
        try:
            result = run_test_suite(module)
            all_results.append((module, result))
        except Exception as e:
            print(f"❌ Error running {module}: {e}")
            all_results.append((module, None))
    
    # Print summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    total_tests = 0
    total_failures = 0
    total_errors = 0
    total_skipped = 0
    
    for module, result in all_results:
        if result:
            tests = result.testsRun
            failures = len(result.failures)
            errors = len(result.errors)
            skipped = len(result.skipped)
            
            total_tests += tests
            total_failures += failures
            total_errors += errors
            total_skipped += skipped
            
            status = "✅ PASSED" if (failures == 0 and errors == 0) else "❌ FAILED"
            print(f"\n{module}:")
            print(f"  Tests: {tests}")
            print(f"  Failures: {failures}")
            print(f"  Errors: {errors}")
            print(f"  Skipped: {skipped}")
            print(f"  Status: {status}")
        else:
            print(f"\n{module}: ❌ FAILED TO RUN")
    
    print(f"\n{'=' * 70}")
    print(f"OVERALL RESULTS:")
    print(f"  Total Tests: {total_tests}")
    print(f"  Passed: {total_tests - total_failures - total_errors}")
    print(f"  Failed: {total_failures}")
    print(f"  Errors: {total_errors}")
    print(f"  Skipped: {total_skipped}")
    
    if total_failures == 0 and total_errors == 0:
        print(f"\n✅ ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n❌ TESTS FAILED")
        return 1

if __name__ == '__main__':
    sys.exit(main())
