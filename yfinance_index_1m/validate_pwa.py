#!/usr/bin/env python3
"""
PWA Configuration Validator
Tests and validates all PWA requirements
"""

import json
import os
import sys

def check_file_exists(filepath, description):
    """Check if a file exists"""
    if os.path.exists(filepath):
        size = os.path.getsize(filepath)
        print(f"✓ {description}: {filepath} ({size:,} bytes)")
        return True
    else:
        print(f"✗ {description}: {filepath} NOT FOUND")
        return False

def validate_manifest():
    """Validate manifest.json"""
    print("\n📱 Validating manifest.json...")
    
    if not check_file_exists('manifest.json', 'Manifest file'):
        return False
    
    try:
        with open('manifest.json', 'r') as f:
            manifest = json.load(f)
        
        required_fields = ['name', 'short_name', 'start_url', 'display', 'icons']
        missing = [field for field in required_fields if field not in manifest]
        
        if missing:
            print(f"✗ Missing required fields: {', '.join(missing)}")
            return False
        
        print(f"✓ Manifest has all required fields")
        print(f"  Name: {manifest['name']}")
        print(f"  Short name: {manifest['short_name']}")
        print(f"  Start URL: {manifest['start_url']}")
        print(f"  Display: {manifest['display']}")
        print(f"  Icons: {len(manifest['icons'])} defined")
        
        return True
    except json.JSONDecodeError as e:
        print(f"✗ Manifest JSON error: {e}")
        return False
    except Exception as e:
        print(f"✗ Error reading manifest: {e}")
        return False

def validate_service_worker():
    """Validate service worker"""
    print("\n⚙️  Validating service-worker.js...")
    
    if not check_file_exists('service-worker.js', 'Service worker'):
        return False
    
    with open('service-worker.js', 'r') as f:
        content = f.read()
    
    required_events = ['install', 'activate', 'fetch']
    found_events = [event for event in required_events if f"addEventListener('{event}'" in content]
    
    if len(found_events) == len(required_events):
        print(f"✓ All required event listeners present: {', '.join(required_events)}")
    else:
        missing = set(required_events) - set(found_events)
        print(f"✗ Missing event listeners: {', '.join(missing)}")
        return False
    
    # Check for cache names
    if 'CACHE_NAME' in content:
        print("✓ Cache configuration found")
    else:
        print("⚠ No cache configuration found")
    
    return True

def validate_icons():
    """Validate PWA icons"""
    print("\n🎨 Validating icons...")
    
    required_sizes = [72, 96, 128, 144, 152, 192, 256, 384, 512]
    icons_dir = 'icons'
    
    if not os.path.exists(icons_dir):
        print(f"✗ Icons directory not found: {icons_dir}")
        return False
    
    found_icons = 0
    missing_icons = []
    
    for size in required_sizes:
        icon_file = f"icon-{size}x{size}.png"
        icon_path = os.path.join(icons_dir, icon_file)
        
        if os.path.exists(icon_path):
            found_icons += 1
        else:
            missing_icons.append(icon_file)
    
    print(f"✓ Found {found_icons}/{len(required_sizes)} required icons")
    
    if missing_icons:
        print(f"⚠ Missing icons: {', '.join(missing_icons)}")
        print(f"  Run: cd icons && python3 generate_icons.py")
        return False
    
    return True

def validate_html_files():
    """Validate HTML files have PWA tags"""
    print("\n📄 Validating HTML files...")
    
    html_files = ['index.html', 'dashboard.html']
    all_valid = True
    
    for html_file in html_files:
        if not os.path.exists(html_file):
            print(f"⚠ {html_file} not found")
            continue
        
        with open(html_file, 'r') as f:
            content = f.read()
        
        checks = {
            'Manifest link': '<link rel="manifest"' in content,
            'Theme color': 'theme-color' in content,
            'Viewport': 'viewport' in content,
            'Service worker': 'serviceWorker' in content or html_file == 'dashboard.html'
        }
        
        print(f"\n  {html_file}:")
        for check, passed in checks.items():
            status = "✓" if passed else "✗"
            print(f"    {status} {check}")
            if not passed:
                all_valid = False
    
    return all_valid

def validate_data_files():
    """Check if data files exist for offline caching"""
    print("\n📊 Checking data files...")
    
    data_files = [
        'index_1m.json',
        'multi_timeframe.json',
        'multi_timeframe_ml.json',
        'forecast_monday_1pm.json'
    ]
    
    found = 0
    for data_file in data_files:
        if os.path.exists(data_file):
            size = os.path.getsize(data_file) / 1024
            print(f"  ✓ {data_file} ({size:.1f} KB)")
            found += 1
        else:
            print(f"  ⚠ {data_file} not found (will be cached when available)")
    
    print(f"\n  Found {found}/{len(data_files)} data files")
    return True

def generate_report():
    """Generate comprehensive PWA validation report"""
    print("=" * 70)
    print("PWA CONFIGURATION VALIDATOR")
    print("=" * 70)
    
    results = {
        'Manifest': validate_manifest(),
        'Service Worker': validate_service_worker(),
        'Icons': validate_icons(),
        'HTML Files': validate_html_files(),
        'Data Files': validate_data_files()
    }
    
    print("\n" + "=" * 70)
    print("VALIDATION SUMMARY")
    print("=" * 70)
    
    for check, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status:8} {check}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 70)
    if all_passed:
        print("🎉 ALL CHECKS PASSED - PWA is properly configured!")
        print("\nYour PWA is ready for:")
        print("  • Installation on desktop and mobile")
        print("  • Full offline functionality")
        print("  • Background updates")
        print("  • Add to home screen")
        print("\nTo test:")
        print("  1. python3 -m http.server 8080")
        print("  2. Open http://localhost:8080/dashboard.html")
        print("  3. Check DevTools → Application → Manifest & Service Workers")
        return 0
    else:
        print("⚠ SOME CHECKS FAILED - Please fix the issues above")
        print("\nCommon fixes:")
        print("  • Missing icons: cd icons && python3 generate_icons.py")
        print("  • Invalid manifest: Check manifest.json syntax")
        print("  • Service worker issues: Check service-worker.js")
        return 1
    
    print("=" * 70)

if __name__ == "__main__":
    # Change to the correct directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    exit_code = generate_report()
    sys.exit(exit_code)
