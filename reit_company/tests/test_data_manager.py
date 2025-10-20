import unittest
import os
import json
import gzip
from reit_company.src.property import Property
from reit_company.src.data_manager import save_compressed_data, load_compressed_data

class TestDataManager(unittest.TestCase):

    def setUp(self):
        self.test_file = "test_properties.dat.gz"
        self.properties = [
            Property("1 Test Ln", 100, "Test"),
            Property("2 Test Ct", 200, "Test")
        ]

    def tearDown(self):
        if os.path.exists(self.test_file):
            os.remove(self.test_file)

    def test_save_and_load_compressed_data(self):
        # Save the data
        save_compressed_data(self.properties, self.test_file)
        self.assertTrue(os.path.exists(self.test_file))

        # Load the data
        loaded_data = load_compressed_data(self.test_file)

        # Verify the data
        self.assertEqual(len(loaded_data), 2)
        self.assertEqual(loaded_data[0]['address'], "1 Test Ln")
        self.assertEqual(loaded_data[1]['price'], 200)

        # Verify the file is actually compressed
        with open(self.test_file, 'rb') as f:
            # Gzip magic numbers
            self.assertTrue(f.read().startswith(b'\x1f\x8b'))

if __name__ == '__main__':
    unittest.main()