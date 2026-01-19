#!/usr/bin/env python3
"""
Master Script: Generate Complete Forecast Package
Runs all engines: base forecaster, enhanced ML, 2D charts, 3D visualizations
"""

import os
import sys
import json
from datetime import datetime

def run_step(name, command):
    """Execute a step and report status"""
    print(f"\n{'='*80}")
    print(f"STEP: {name}")
    print(f"{'='*80}\n")
    
    result = os.system(command)
    
    if result == 0:
        print(f"\n✓ {name} completed successfully")
        return True
    else:
        print(f"\n✗ {name} failed with code {result}")
        return False

def main():
    """Generate complete forecast package"""
    
    print("\n" + "="*80)
    print("COMPREHENSIVE FORECAST GENERATION")
    print("Starting at:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("="*80)
    
    steps = [
        ("Base Forecast Generation", "python genai_forecaster.py"),
        ("Enhanced ML Ensemble", "python enhanced_ml_engine.py"),
        ("Enhanced 2D Charts", "python enhanced_visualizer.py"),
        ("Advanced 3D Visualizations", "python advanced_3d_visualizer.py")
    ]
    
    results = {}
    
    for name, command in steps:
        results[name] = run_step(name, command)
    
    # Summary
    print("\n" + "="*80)
    print("GENERATION SUMMARY")
    print("="*80)
    
    for name, success in results.items():
        status = "✓ SUCCESS" if success else "✗ FAILED"
        print(f"{status}: {name}")
    
    # Check outputs
    print("\n" + "="*80)
    print("OUTPUT FILES")
    print("="*80)
    
    expected_files = [
        "forecast_monday_1pm.json",
        "forecast_GSPC_chart.png",
        "forecast_DJI_chart.png",
        "forecast_GSPC_enhanced_chart.png",
        "forecast_DJI_enhanced_chart.png",
        "forecast_GSPC_3d_interactive.html",
        "forecast_DJI_3d_interactive.html"
    ]
    
    for filename in expected_files:
        if os.path.exists(filename):
            size = os.path.getsize(filename)
            size_str = f"{size/1024/1024:.2f} MB" if size > 1024*1024 else f"{size/1024:.2f} KB"
            print(f"✓ {filename} ({size_str})")
        else:
            print(f"✗ {filename} (missing)")
    
    print("\n" + "="*80)
    print("FORECAST GENERATION COMPLETE")
    print("Finished at:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("="*80 + "\n")
    
    # Exit with appropriate code
    if all(results.values()):
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
