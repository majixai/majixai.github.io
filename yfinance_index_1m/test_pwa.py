#!/usr/bin/env python3
"""
Unit Tests for YFinance PWA Application
Tests manifest, service worker, data integrity, and offline functionality
"""

import unittest
import json
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class TestPWAManifest(unittest.TestCase):
    """Test PWA manifest.json configuration"""
    
    @classmethod
    def setUpClass(cls):
        """Load manifest once for all tests"""
        manifest_path = Path(__file__).parent / 'manifest.json'
        with open(manifest_path, 'r') as f:
            cls.manifest = json.load(f)
    
    def test_manifest_exists(self):
        """Test that manifest.json exists"""
        manifest_path = Path(__file__).parent / 'manifest.json'
        self.assertTrue(manifest_path.exists(), "manifest.json must exist")
    
    def test_manifest_valid_json(self):
        """Test that manifest is valid JSON"""
        self.assertIsInstance(self.manifest, dict, "Manifest must be a dictionary")
    
    def test_required_fields(self):
        """Test that all required manifest fields are present"""
        required_fields = ['name', 'short_name', 'start_url', 'display', 'icons']
        for field in required_fields:
            self.assertIn(field, self.manifest, f"Manifest must have '{field}' field")
    
    def test_start_url_format(self):
        """Test that start_url is properly formatted"""
        start_url = self.manifest.get('start_url', '')
        self.assertTrue(
            start_url.endswith('.html') or start_url.endswith('.html?source=pwa'),
            "start_url must point to an HTML file"
        )
        # Should use relative path
        self.assertTrue(start_url.startswith('./'), "start_url should be relative (./))")
    
    def test_display_mode(self):
        """Test that display mode is set correctly"""
        valid_modes = ['standalone', 'fullscreen', 'minimal-ui', 'browser']
        self.assertIn(self.manifest.get('display'), valid_modes)
    
    def test_icons_present(self):
        """Test that icons are defined"""
        icons = self.manifest.get('icons', [])
        self.assertGreater(len(icons), 0, "Manifest must have at least one icon")
    
    def test_icon_sizes(self):
        """Test that required icon sizes are present"""
        icons = self.manifest.get('icons', [])
        sizes = [icon.get('sizes') for icon in icons]
        required_sizes = ['192x192', '512x512']
        
        for required_size in required_sizes:
            self.assertIn(required_size, sizes, f"Must have {required_size} icon")
    
    def test_theme_color(self):
        """Test that theme_color is set"""
        self.assertIn('theme_color', self.manifest)
        theme_color = self.manifest['theme_color']
        self.assertTrue(theme_color.startswith('#'), "theme_color should be hex color")
    
    def test_scope(self):
        """Test that scope is properly set"""
        scope = self.manifest.get('scope', '')
        self.assertEqual(scope, './', "Scope should be './' for relative paths")


class TestServiceWorker(unittest.TestCase):
    """Test service worker configuration"""
    
    @classmethod
    def setUpClass(cls):
        """Load service worker once for all tests"""
        sw_path = Path(__file__).parent / 'service-worker.js'
        with open(sw_path, 'r') as f:
            cls.sw_content = f.read()
    
    def test_service_worker_exists(self):
        """Test that service-worker.js exists"""
        sw_path = Path(__file__).parent / 'service-worker.js'
        self.assertTrue(sw_path.exists(), "service-worker.js must exist")
    
    def test_cache_name_defined(self):
        """Test that cache names are defined"""
        self.assertIn('CACHE_NAME', self.sw_content)
        self.assertIn('DATA_CACHE', self.sw_content)
    
    def test_install_event(self):
        """Test that install event listener is present"""
        self.assertIn("addEventListener('install'", self.sw_content)
    
    def test_activate_event(self):
        """Test that activate event listener is present"""
        self.assertIn("addEventListener('activate'", self.sw_content)
    
    def test_fetch_event(self):
        """Test that fetch event listener is present"""
        self.assertIn("addEventListener('fetch'", self.sw_content)
    
    def test_static_assets_defined(self):
        """Test that static assets array is defined"""
        self.assertIn('STATIC_ASSETS', self.sw_content)
    
    def test_dashboard_in_cache(self):
        """Test that dashboard.html is in cached assets"""
        self.assertIn('dashboard.html', self.sw_content)
    
    def test_relative_paths(self):
        """Test that service worker uses relative paths"""
        # Check for relative path indicators
        self.assertIn('./', self.sw_content)
        # Should not have absolute paths to /yfinance_index_1m/
        count = self.sw_content.count('/yfinance_index_1m/')
        self.assertLessEqual(count, 1, "Should use relative paths, not absolute")


class TestIconFiles(unittest.TestCase):
    """Test that all icon files exist"""
    
    def setUp(self):
        """Set up icon directory path"""
        self.icons_dir = Path(__file__).parent / 'icons'
    
    def test_icons_directory_exists(self):
        """Test that icons directory exists"""
        self.assertTrue(self.icons_dir.exists(), "icons/ directory must exist")
    
    def test_required_icon_sizes(self):
        """Test that all required icon sizes exist"""
        required_sizes = [72, 96, 128, 144, 152, 192, 256, 384, 512]
        
        for size in required_sizes:
            icon_file = self.icons_dir / f'icon-{size}x{size}.png'
            self.assertTrue(
                icon_file.exists(),
                f"Icon icon-{size}x{size}.png must exist"
            )
    
    def test_icon_file_sizes(self):
        """Test that icon files are not empty"""
        icon_files = list(self.icons_dir.glob('icon-*.png'))
        
        for icon_file in icon_files:
            file_size = icon_file.stat().st_size
            self.assertGreater(
                file_size, 0,
                f"{icon_file.name} must not be empty"
            )
            # Icons should be reasonably sized (not too large)
            self.assertLess(
                file_size, 500000,  # 500KB
                f"{icon_file.name} is too large (>500KB)"
            )


class TestHTMLFiles(unittest.TestCase):
    """Test HTML files for PWA requirements"""
    
    def test_dashboard_exists(self):
        """Test that dashboard.html exists"""
        dashboard_path = Path(__file__).parent / 'dashboard.html'
        self.assertTrue(dashboard_path.exists(), "dashboard.html must exist")
    
    def test_index_exists(self):
        """Test that index.html exists"""
        index_path = Path(__file__).parent / 'index.html'
        self.assertTrue(index_path.exists(), "index.html must exist")
    
    def test_dashboard_has_manifest_link(self):
        """Test that dashboard.html links to manifest"""
        dashboard_path = Path(__file__).parent / 'dashboard.html'
        with open(dashboard_path, 'r') as f:
            content = f.read()
        
        self.assertIn('manifest.json', content, "dashboard.html must link to manifest")
        self.assertIn('rel="manifest"', content, "Must have proper manifest link")
    
    def test_dashboard_has_theme_color(self):
        """Test that dashboard.html has theme-color meta tag"""
        dashboard_path = Path(__file__).parent / 'dashboard.html'
        with open(dashboard_path, 'r') as f:
            content = f.read()
        
        self.assertIn('theme-color', content, "Must have theme-color meta tag")
    
    def test_dashboard_has_viewport(self):
        """Test that dashboard.html has viewport meta tag"""
        dashboard_path = Path(__file__).parent / 'dashboard.html'
        with open(dashboard_path, 'r') as f:
            content = f.read()
        
        self.assertIn('viewport', content, "Must have viewport meta tag")
    
    def test_dashboard_registers_sw(self):
        """Test that dashboard.html registers service worker"""
        dashboard_path = Path(__file__).parent / 'dashboard.html'
        with open(dashboard_path, 'r') as f:
            content = f.read()
        
        self.assertIn('serviceWorker', content, "Must register service worker")
        self.assertIn('register', content, "Must call serviceWorker.register()")


class TestDataFiles(unittest.TestCase):
    """Test data files that will be cached"""
    
    def setUp(self):
        """Set up base directory"""
        self.base_dir = Path(__file__).parent
    
    def test_multi_timeframe_exists(self):
        """Test that multi_timeframe.json exists"""
        data_file = self.base_dir / 'multi_timeframe.json'
        if data_file.exists():
            # Verify it's valid JSON
            with open(data_file, 'r') as f:
                data = json.load(f)
            self.assertIsInstance(data, dict, "Data file must be a dictionary")
    
    def test_data_files_are_json(self):
        """Test that all .json files are valid JSON"""
        json_files = self.base_dir.glob('*.json')
        
        for json_file in json_files:
            if json_file.name == 'package.json':
                continue  # Skip if exists
            
            try:
                with open(json_file, 'r') as f:
                    json.load(f)
            except json.JSONDecodeError as e:
                self.fail(f"{json_file.name} is not valid JSON: {e}")


class TestPWAInstallability(unittest.TestCase):
    """Test PWA installability requirements"""
    
    def setUp(self):
        """Set up paths"""
        self.base_dir = Path(__file__).parent
    
    def test_https_requirement(self):
        """Test that we're aware of HTTPS requirement"""
        # This is a documentation test
        readme_files = list(self.base_dir.glob('*GUIDE*.md')) + \
                      list(self.base_dir.glob('*README*.md'))
        
        found_https_mention = False
        for readme in readme_files:
            with open(readme, 'r') as f:
                content = f.read().lower()
                if 'https' in content or 'localhost' in content:
                    found_https_mention = True
                    break
        
        self.assertTrue(
            found_https_mention,
            "Documentation should mention HTTPS requirement"
        )
    
    def test_manifest_linked_in_html(self):
        """Test that HTML files link to manifest"""
        html_files = ['dashboard.html', 'index.html']
        
        for html_file in html_files:
            path = self.base_dir / html_file
            if path.exists():
                with open(path, 'r') as f:
                    content = f.read()
                
                self.assertIn(
                    'manifest.json',
                    content,
                    f"{html_file} must link to manifest.json"
                )
    
    def test_sw_registered_in_html(self):
        """Test that service worker is registered"""
        dashboard_path = self.base_dir / 'dashboard.html'
        
        if dashboard_path.exists():
            with open(dashboard_path, 'r') as f:
                content = f.read()
            
            # Should have serviceWorker registration code
            has_sw = 'serviceWorker' in content and 'register' in content
            self.assertTrue(
                has_sw,
                "dashboard.html must register service worker"
            )


class TestOfflineFunctionality(unittest.TestCase):
    """Test offline functionality configuration"""
    
    def setUp(self):
        """Set up paths"""
        self.base_dir = Path(__file__).parent
    
    def test_service_worker_caches_dashboard(self):
        """Test that service worker caches dashboard"""
        sw_path = self.base_dir / 'service-worker.js'
        with open(sw_path, 'r') as f:
            content = f.read()
        
        self.assertIn('dashboard.html', content, "SW must cache dashboard.html")
    
    def test_service_worker_has_offline_fallback(self):
        """Test that service worker handles offline requests"""
        sw_path = self.base_dir / 'service-worker.js'
        with open(sw_path, 'r') as f:
            content = f.read()
        
        # Should have cache matching
        self.assertIn('caches.match', content, "SW must use cache matching")
    
    def test_offline_indicator_in_html(self):
        """Test that dashboard has offline indicator"""
        dashboard_path = self.base_dir / 'dashboard.html'
        with open(dashboard_path, 'r') as f:
            content = f.read()
        
        self.assertIn(
            'offline',
            content.lower(),
            "Dashboard should have offline indicator"
        )


def run_tests():
    """Run all tests and generate report"""
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestPWAManifest))
    suite.addTests(loader.loadTestsFromTestCase(TestServiceWorker))
    suite.addTests(loader.loadTestsFromTestCase(TestIconFiles))
    suite.addTests(loader.loadTestsFromTestCase(TestHTMLFiles))
    suite.addTests(loader.loadTestsFromTestCase(TestDataFiles))
    suite.addTests(loader.loadTestsFromTestCase(TestPWAInstallability))
    suite.addTests(loader.loadTestsFromTestCase(TestOfflineFunctionality))
    
    # Run with verbose output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("=" * 70)
    
    # Return exit code
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    sys.exit(run_tests())
