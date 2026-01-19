import json
from pathlib import Path

# Check manifest
try:
    with open('manifest.json', 'r') as f:
        manifest = json.load(f)
    
    # Check for absolute paths
    issues = []
    if 'shortcuts' in manifest:
        for shortcut in manifest['shortcuts']:
            url = shortcut.get('url', '')
            if url.startswith('/yfinance'):
                issues.append(f"Absolute path in shortcut: {url}")
    
    if issues:
        print("❌ Manifest Issues:")
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("✅ Manifest: All paths are relative")
        print(f"  start_url: {manifest['start_url']}")
        print(f"  scope: {manifest['scope']}")
        print(f"  icons: {len(manifest['icons'])} defined")
        print(f"  shortcuts: {len(manifest.get('shortcuts', []))} defined")
except Exception as e:
    print(f"❌ Manifest error: {e}")

# Check data file
print()
data_file = Path('multi_timeframe.json')
if data_file.exists():
    size_mb = data_file.stat().st_size / (1024 * 1024)
    print(f"✅ Data file: multi_timeframe.json ({size_mb:.1f} MB)")
    try:
        with open(data_file, 'r') as f:
            data = json.load(f)
        print(f"  Indices: {len(data)}")
        if data:
            first_key = list(data.keys())[0]
            records = data[first_key].get('data', [])
            print(f"  Records per index: {len(records)}")
    except Exception as e:
        print(f"  ⚠️  JSON may be corrupted: {e}")
else:
    print("❌ Data file missing: multi_timeframe.json")
    print("   Run: python3 fetch_multi_timeframe.py")
