#!/usr/bin/env python3
"""
PWA Installation Verification Script
Tests that the PWA can be properly installed and works offline
"""
import json
import os
from pathlib import Path

def print_header(text):
    print(f"\n{'='*70}")
    print(f"{text:^70}")
    print('='*70)

def check_mark(passed):
    return "✅" if passed else "❌"

def main():
    print_header("YFinance PWA - Installation Verification")
    
    base_dir = Path(__file__).parent
    checks = []
    
    # Check 1: Manifest validation
    print("\n📋 Checking manifest.json...")
    manifest_path = base_dir / "manifest.json"
    try:
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        
        # Check start_url uses relative path
        start_url = manifest.get('start_url', '')
        relative_start = start_url.startswith('./')
        checks.append(('Manifest start_url is relative', relative_start))
        print(f"  {check_mark(relative_start)} start_url: {start_url}")
        
        # Check scope
        scope = manifest.get('scope', '')
        relative_scope = scope.startswith('./')
        checks.append(('Manifest scope is relative', relative_scope))
        print(f"  {check_mark(relative_scope)} scope: {scope}")
        
        # Check icon paths
        icons = manifest.get('icons', [])
        all_relative = all(icon.get('src', '').startswith('./') for icon in icons)
        checks.append(('All icon paths are relative', all_relative))
        print(f"  {check_mark(all_relative)} Icon paths: {len(icons)} icons, all relative")
        
    except Exception as e:
        print(f"  ❌ Error reading manifest: {e}")
        checks.append(('Manifest valid', False))
    
    # Check 2: Service Worker
    print("\n⚙️  Checking service-worker.js...")
    sw_path = base_dir / "service-worker.js"
    try:
        with open(sw_path, 'r') as f:
            sw_content = f.read()
        
        # Check for relative paths (no absolute paths)
        has_absolute = '/yfinance_index_1m/' in sw_content
        checks.append(('No absolute paths in service worker', not has_absolute))
        print(f"  {check_mark(not has_absolute)} No absolute paths found")
        
        # Check for dashboard.html in cache
        has_dashboard = './dashboard.html' in sw_content or 'dashboard.html' in sw_content
        checks.append(('Dashboard in service worker cache', has_dashboard))
        print(f"  {check_mark(has_dashboard)} Dashboard.html cached")
        
        # Check cache version
        has_version = 'CACHE_NAME' in sw_content or 'v3' in sw_content
        checks.append(('Service worker has cache version', has_version))
        print(f"  {check_mark(has_version)} Cache versioning present")
        
    except Exception as e:
        print(f"  ❌ Error reading service worker: {e}")
        checks.append(('Service worker valid', False))
    
    # Check 3: Icons
    print("\n🎨 Checking icon files...")
    icons_dir = base_dir / "icons"
    required_sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    
    if icons_dir.exists():
        icon_files = list(icons_dir.glob("icon-*.png"))
        icon_count = len(icon_files)
        checks.append(('Icon files exist', icon_count >= 8))
        print(f"  {check_mark(icon_count >= 8)} Found {icon_count} icon files")
        
        for size in required_sizes:
            icon_file = icons_dir / f"icon-{size}x{size}.png"
            exists = icon_file.exists()
            if exists:
                file_size = icon_file.stat().st_size
                print(f"  {check_mark(exists)} {size}x{size}: {file_size:,} bytes")
    else:
        print("  ❌ Icons directory not found")
        checks.append(('Icon files exist', False))
    
    # Check 4: HTML files
    print("\n📄 Checking HTML files...")
    dashboard_path = base_dir / "dashboard.html"
    if dashboard_path.exists():
        with open(dashboard_path, 'r') as f:
            dashboard_content = f.read()
        
        # Check for manifest link
        has_manifest_link = 'manifest.json' in dashboard_content
        checks.append(('Dashboard links to manifest', has_manifest_link))
        print(f"  {check_mark(has_manifest_link)} Manifest link present")
        
        # Check for service worker registration
        has_sw_reg = 'service-worker.js' in dashboard_content
        checks.append(('Dashboard registers service worker', has_sw_reg))
        print(f"  {check_mark(has_sw_reg)} Service worker registration present")
        
        # Check for offline indicator
        has_offline = 'offline' in dashboard_content.lower()
        checks.append(('Dashboard has offline indicator', has_offline))
        print(f"  {check_mark(has_offline)} Offline indicator present")
    else:
        print("  ❌ dashboard.html not found")
        checks.append(('Dashboard exists', False))
    
    # Check 5: Data files
    print("\n💾 Checking data files...")
    data_file = base_dir / "multi_timeframe.json"
    if data_file.exists():
        size_mb = data_file.stat().st_size / (1024 * 1024)
        checks.append(('Data file exists', True))
        print(f"  ✅ multi_timeframe.json: {size_mb:.2f} MB")
        
        # Validate JSON
        try:
            with open(data_file, 'r') as f:
                data = json.load(f)
            checks.append(('Data file is valid JSON', True))
            print(f"  ✅ Valid JSON with {len(data)} indices")
        except:
            checks.append(('Data file is valid JSON', False))
            print("  ❌ Invalid JSON")
    else:
        print("  ❌ multi_timeframe.json not found")
        checks.append(('Data file exists', False))
    
    # Summary
    print_header("VERIFICATION SUMMARY")
    
    passed = sum(1 for _, result in checks if result)
    total = len(checks)
    
    print(f"\nTotal Checks: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"\nSuccess Rate: {passed/total*100:.1f}%")
    
    if passed == total:
        print("\n✅ PWA IS READY FOR INSTALLATION!")
        print("\nTo test the PWA:")
        print("1. Run: python3 -m http.server 8080")
        print("2. Open: http://localhost:8080/dashboard.html")
        print("3. Click the install button")
        print("4. Open the installed app")
        print("5. Test offline: DevTools → Application → Service Workers → Offline")
        return 0
    else:
        print("\n❌ PWA HAS ISSUES - SEE DETAILS ABOVE")
        print("\nFailed checks:")
        for check, result in checks:
            if not result:
                print(f"  - {check}")
        return 1

if __name__ == '__main__':
    exit(main())
