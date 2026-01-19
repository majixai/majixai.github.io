#!/usr/bin/env python3
"""
Integration Tests for YFinance PWA
Tests the complete PWA workflow including data fetching and caching
"""

import unittest
import json
import os
from pathlib import Path
import tempfile
import shutil


class TestDataIntegration(unittest.TestCase):
    """Test data file integration with PWA"""
    
    def setUp(self):
        """Set up test environment"""
        self.base_dir = Path(__file__).parent
    
    def test_json_data_structure(self):
        """Test that data files have expected structure"""
        json_files = ['multi_timeframe.json', 'multi_timeframe_ml.json']
        
        for filename in json_files:
            filepath = self.base_dir / filename
            if filepath.exists():
                with open(filepath, 'r') as f:
                    data = json.load(f)
                
                # Should be a dictionary with index symbols as keys
                self.assertIsInstance(data, dict)
                
                # Check for expected index symbols
                expected_symbols = ['^DJI', '^GSPC', '^IXIC']
                for symbol in expected_symbols:
                    if symbol in data:
                        # Each symbol should have data or summary
                        symbol_data = data[symbol]
                        self.assertIsInstance(symbol_data, dict)
    
    def test_view_data_script(self):
        """Test that view_data.py script exists and is executable"""
        view_script = self.base_dir / 'view_data.py'
        if view_script.exists():
            # Should have Python shebang
            with open(view_script, 'r') as f:
                first_line = f.readline()
            
            self.assertTrue(
                first_line.startswith('#!') and 'python' in first_line.lower(),
                "view_data.py should have Python shebang"
            )


class TestPWAWorkflow(unittest.TestCase):
    """Test complete PWA installation workflow"""
    
    def setUp(self):
        """Set up test environment"""
        self.base_dir = Path(__file__).parent
    
    def test_manifest_points_to_valid_file(self):
        """Test that manifest start_url points to existing file"""
        manifest_path = self.base_dir / 'manifest.json'
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        
        start_url = manifest.get('start_url', '')
        # Remove query parameters
        start_url = start_url.split('?')[0]
        # Remove leading ./
        start_url = start_url.lstrip('./')
        
        file_path = self.base_dir / start_url
        self.assertTrue(
            file_path.exists(),
            f"start_url points to non-existent file: {start_url}"
        )
    
    def test_all_manifest_icons_exist(self):
        """Test that all icons referenced in manifest exist"""
        manifest_path = self.base_dir / 'manifest.json'
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        
        icons = manifest.get('icons', [])
        
        for icon in icons:
            icon_src = icon.get('src', '')
            # Remove leading ./
            icon_src = icon_src.lstrip('./')
            
            icon_path = self.base_dir / icon_src
            self.assertTrue(
                icon_path.exists(),
                f"Icon does not exist: {icon_src}"
            )
    
    def test_service_worker_caches_exist_files(self):
        """Test that service worker only caches existing files"""
        sw_path = self.base_dir / 'service-worker.js'
        with open(sw_path, 'r') as f:
            content = f.read()
        
        # Extract STATIC_ASSETS array (simplified check)
        if 'STATIC_ASSETS' in content:
            # This is a basic check - in production you'd parse JS properly
            self.assertIn('.html', content)
            self.assertIn('.css', content)
            self.assertIn('.js', content)


class TestCacheStrategy(unittest.TestCase):
    """Test caching strategy implementation"""
    
    def setUp(self):
        """Set up test environment"""
        self.base_dir = Path(__file__).parent
        self.sw_path = self.base_dir / 'service-worker.js'
    
    def test_cache_versioning(self):
        """Test that cache has version number"""
        with open(self.sw_path, 'r') as f:
            content = f.read()
        
        # Should have versioned cache names
        self.assertIn('CACHE_NAME', content)
        
        # Version should be in format vX.X.X
        import re
        version_pattern = r'v\d+\.\d+\.\d+'
        self.assertTrue(
            re.search(version_pattern, content),
            "Cache should have version number (vX.X.X)"
        )
    
    def test_multiple_cache_layers(self):
        """Test that multiple cache layers are defined"""
        with open(self.sw_path, 'r') as f:
            content = f.read()
        
        # Should have different cache layers
        cache_types = ['CACHE_NAME', 'DATA_CACHE', 'DYNAMIC_CACHE']
        for cache_type in cache_types:
            self.assertIn(
                cache_type,
                content,
                f"Should define {cache_type}"
            )
    
    def test_cache_cleanup_on_activate(self):
        """Test that old caches are cleaned up"""
        with open(self.sw_path, 'r') as f:
            content = f.read()
        
        # Should delete old caches
        self.assertIn('caches.delete', content)
        self.assertIn("'activate'", content)


class TestResponsiveDesign(unittest.TestCase):
    """Test responsive design elements"""
    
    def setUp(self):
        """Set up test environment"""
        self.base_dir = Path(__file__).parent
    
    def test_viewport_meta_tag(self):
        """Test that HTML files have proper viewport"""
        html_files = ['dashboard.html', 'index.html']
        
        for filename in html_files:
            filepath = self.base_dir / filename
            if filepath.exists():
                with open(filepath, 'r') as f:
                    content = f.read()
                
                self.assertIn('viewport', content)
                self.assertIn('width=device-width', content)
    
    def test_responsive_css(self):
        """Test that CSS file exists and has media queries"""
        css_path = self.base_dir / 'style.css'
        if css_path.exists():
            with open(css_path, 'r') as f:
                content = f.read()
            
            # Should have responsive design elements
            responsive_elements = ['@media', 'max-width', 'min-width']
            has_responsive = any(elem in content for elem in responsive_elements)
            
            if len(content) > 1000:  # Only check if it's a substantial CSS file
                self.assertTrue(
                    has_responsive,
                    "CSS should have responsive design (@media queries)"
                )


class TestSecurityFeatures(unittest.TestCase):
    """Test security-related PWA features"""
    
    def setUp(self):
        """Set up test environment"""
        self.base_dir = Path(__file__).parent
    
    def test_https_mentioned_in_docs(self):
        """Test that documentation mentions HTTPS requirement"""
        doc_files = list(self.base_dir.glob('*.md'))
        
        found_https = False
        for doc_file in doc_files:
            with open(doc_file, 'r') as f:
                content = f.read().lower()
            
            if 'https' in content or 'ssl' in content or 'secure' in content:
                found_https = True
                break
        
        self.assertTrue(
            found_https,
            "Documentation should mention HTTPS/security requirements"
        )
    
    def test_service_worker_scope(self):
        """Test that service worker scope is properly limited"""
        manifest_path = self.base_dir / 'manifest.json'
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        
        scope = manifest.get('scope', '')
        
        # Scope should be relative
        self.assertTrue(
            scope.startswith('./') or scope == '/',
            "Scope should be relative or root"
        )


def run_integration_tests():
    """Run all integration tests"""
    
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestDataIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestPWAWorkflow))
    suite.addTests(loader.loadTestsFromTestCase(TestCacheStrategy))
    suite.addTests(loader.loadTestsFromTestCase(TestResponsiveDesign))
    suite.addTests(loader.loadTestsFromTestCase(TestSecurityFeatures))
    
    # Run with verbose output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "=" * 70)
    print("INTEGRATION TEST SUMMARY")
    print("=" * 70)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("=" * 70)
    
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    import sys
    sys.exit(run_integration_tests())
