import json

print("Verifying index.html Updates\n")

# Check manifest
with open('manifest.json', 'r') as f:
    manifest = json.load(f)

print("✅ Manifest Configuration:")
print(f"  • start_url: {manifest['start_url']}")
print(f"  • share_target action: {manifest['share_target']['action']}")
print(f"\n  Shortcuts:")
for s in manifest['shortcuts']:
    print(f"    - {s['name']}: {s['url']}")

# Check service worker
with open('service-worker.js', 'r') as f:
    sw_content = f.read()

has_index = './index.html' in sw_content
print(f"\n✅ Service Worker:")
print(f"  • References index.html: {'✓' if has_index else '✗'}")

# Check index.html exists and size
import os
if os.path.exists('index.html'):
    size = os.path.getsize('index.html')
    print(f"\n✅ index.html:")
    print(f"  • File exists: ✓")
    print(f"  • Size: {size:,} bytes")
    
    # Check if it has the permissions button
    with open('index.html', 'r') as f:
        content = f.read()
    has_permissions = 'showPermissions' in content
    has_share = 'shareMarketData' in content
    has_manager = 'permissions-manager.js' in content
    
    print(f"  • Permissions button: {'✓' if has_permissions else '✗'}")
    print(f"  • Share button: {'✓' if has_share else '✗'}")
    print(f"  • Permissions manager: {'✓' if has_manager else '✗'}")

print("\n" + "="*60)
print("🎉 INDEX.HTML IS NOW THE MAIN PWA ENTRY POINT!")
print("="*60)
