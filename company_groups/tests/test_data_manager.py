"""
Unit tests for DataManager with compression and hashing
"""
import unittest
import os
import shutil
import tempfile

from company_groups.src.data_manager import (
    DataManager, CompanyDataManager, HashIndex,
    generate_hash, generate_md5_hash, verify_hash
)
from company_groups.src.company import Company
from company_groups.src.member import Member, MemberRole


class TestHashFunctions(unittest.TestCase):

    def test_generate_hash(self):
        """Test SHA-256 hash generation."""
        data = "test data"
        hash1 = generate_hash(data)
        hash2 = generate_hash(data)
        
        self.assertEqual(hash1, hash2)
        self.assertEqual(len(hash1), 64)  # SHA-256 produces 64 hex characters

    def test_generate_md5_hash(self):
        """Test MD5 hash generation."""
        data = "test data"
        hash1 = generate_md5_hash(data)
        
        self.assertEqual(len(hash1), 32)  # MD5 produces 32 hex characters

    def test_verify_hash(self):
        """Test hash verification."""
        data = "test data"
        expected_hash = generate_hash(data)
        
        self.assertTrue(verify_hash(data, expected_hash))
        self.assertFalse(verify_hash("different data", expected_hash))


class TestDataManager(unittest.TestCase):

    def setUp(self):
        """Set up test data directory."""
        self.test_dir = tempfile.mkdtemp()
        self.data_manager = DataManager(data_dir=self.test_dir)

    def tearDown(self):
        """Clean up test data directory."""
        shutil.rmtree(self.test_dir)

    def test_save_and_load_compressed_data(self):
        """Test saving and loading compressed data."""
        test_data = [
            {"id": 1, "name": "Item 1"},
            {"id": 2, "name": "Item 2"}
        ]
        
        metadata = self.data_manager.save_compressed_data(test_data, "test_data")
        
        self.assertIn("hash", metadata)
        self.assertEqual(metadata["record_count"], 2)
        
        loaded_data = self.data_manager.load_compressed_data("test_data")
        
        self.assertEqual(len(loaded_data), 2)
        self.assertEqual(loaded_data[0]["name"], "Item 1")

    def test_compression_ratio(self):
        """Test that compression reduces file size."""
        test_data = [{"key": "value" * 100} for _ in range(10)]
        
        metadata = self.data_manager.save_compressed_data(test_data, "compression_test")
        
        self.assertLess(metadata["compressed_size"], metadata["original_size"])

    def test_data_integrity_verification(self):
        """Test data integrity verification."""
        test_data = [{"id": 1, "data": "test"}]
        
        self.data_manager.save_compressed_data(test_data, "integrity_test")
        
        loaded_data = self.data_manager.load_compressed_data("integrity_test", verify=True)
        
        self.assertEqual(len(loaded_data), 1)

    def test_list_files(self):
        """Test listing data files."""
        self.data_manager.save_compressed_data([{"test": 1}], "file1")
        self.data_manager.save_compressed_data([{"test": 2}], "file2")
        
        files = self.data_manager.list_files()
        
        self.assertIn("file1", files)
        self.assertIn("file2", files)

    def test_delete_data(self):
        """Test deleting data files."""
        self.data_manager.save_compressed_data([{"test": 1}], "to_delete")
        
        files_before = self.data_manager.list_files()
        self.assertIn("to_delete", files_before)
        
        self.data_manager.delete_data("to_delete")
        
        files_after = self.data_manager.list_files()
        self.assertNotIn("to_delete", files_after)

    def test_get_file_info(self):
        """Test getting file information."""
        self.data_manager.save_compressed_data([{"test": 1}], "info_test")
        
        info = self.data_manager.get_file_info("info_test")
        
        self.assertIsNotNone(info)
        self.assertIn("size", info)
        self.assertIn("metadata", info)


class TestCompanyDataManager(unittest.TestCase):

    def setUp(self):
        """Set up test data directory."""
        self.test_dir = tempfile.mkdtemp()
        self.data_manager = CompanyDataManager(data_dir=self.test_dir)

    def tearDown(self):
        """Clean up test data directory."""
        shutil.rmtree(self.test_dir)

    def test_save_and_load_company(self):
        """Test saving and loading a single company."""
        company = Company(
            company_id=1,
            name="Test Company",
            description="A test company"
        )
        company.add_member(Member(1, "Test User", "test@test.com", MemberRole.PROFESSOR))
        
        self.data_manager.save_company(company)
        
        loaded = self.data_manager.load_company(1)
        
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["name"], "Test Company")

    def test_save_and_load_companies(self):
        """Test saving and loading multiple companies."""
        companies = [
            Company(1, "Company 1"),
            Company(2, "Company 2")
        ]
        
        self.data_manager.save_companies(companies)
        
        loaded = self.data_manager.load_companies()
        
        self.assertEqual(len(loaded), 2)


class TestHashIndex(unittest.TestCase):

    def setUp(self):
        """Set up test data directory."""
        self.test_dir = tempfile.mkdtemp()
        self.data_manager = DataManager(data_dir=self.test_dir)
        self.index = HashIndex(self.data_manager, "test_index")

    def tearDown(self):
        """Clean up test data directory."""
        shutil.rmtree(self.test_dir)

    def test_add_and_get_entry(self):
        """Test adding and getting index entries."""
        self.index.add_entry("key1", {"data": "value1"})
        
        result = self.index.get_entry("key1")
        
        self.assertEqual(result["data"], "value1")

    def test_has_entry(self):
        """Test checking if entry exists."""
        self.index.add_entry("exists", "value")
        
        self.assertTrue(self.index.has_entry("exists"))
        self.assertFalse(self.index.has_entry("not_exists"))

    def test_remove_entry(self):
        """Test removing entries."""
        self.index.add_entry("to_remove", "value")
        
        self.assertTrue(self.index.has_entry("to_remove"))
        
        self.index.remove_entry("to_remove")
        
        self.assertFalse(self.index.has_entry("to_remove"))

    def test_get_all_keys(self):
        """Test getting all keys."""
        self.index.add_entry("key1", "value1")
        self.index.add_entry("key2", "value2")
        
        keys = self.index.get_all_keys()
        
        self.assertIn("key1", keys)
        self.assertIn("key2", keys)


if __name__ == '__main__':
    unittest.main()
