"""
DataManager module - Handles data persistence with compression and hashing
"""
import json
import gzip
import hashlib
import os
from datetime import datetime
from typing import List, Optional, Dict, Any


def generate_hash(data: str) -> str:
    """Generate SHA-256 hash of data."""
    return hashlib.sha256(data.encode('utf-8')).hexdigest()


def generate_md5_hash(data: str) -> str:
    """Generate MD5 hash of data for quick checksums."""
    return hashlib.md5(data.encode('utf-8')).hexdigest()


def verify_hash(data: str, expected_hash: str) -> bool:
    """Verify data against expected hash."""
    return generate_hash(data) == expected_hash


class DataManager:
    """Manages data persistence with compression and hashing."""
    
    def __init__(self, data_dir: str = "data"):
        self._data_dir = data_dir
        self._ensure_data_dir()
    
    def _ensure_data_dir(self) -> None:
        """Ensure data directory exists."""
        if not os.path.exists(self._data_dir):
            os.makedirs(self._data_dir)
    
    def _get_file_path(self, filename: str, compressed: bool = True) -> str:
        """Get full file path."""
        ext = ".gz" if compressed else ".json"
        return os.path.join(self._data_dir, f"{filename}{ext}")
    
    def save_compressed_data(self, data: List[Any], filename: str) -> Dict[str, str]:
        """
        Serializes, compresses, and saves data to a file.
        Returns metadata including hash for verification.
        """
        # Convert objects to dictionaries if they have to_dict method
        dict_data = []
        for item in data:
            if hasattr(item, 'to_dict'):
                dict_data.append(item.to_dict())
            elif isinstance(item, dict):
                dict_data.append(item)
            else:
                dict_data.append(str(item))
        
        # Serialize to JSON
        json_str = json.dumps(dict_data, indent=2)
        
        # Generate hash before compression
        data_hash = generate_hash(json_str)
        
        # Compress and write to file
        file_path = self._get_file_path(filename)
        json_bytes = json_str.encode('utf-8')
        
        with gzip.open(file_path, 'wb') as f:
            f.write(json_bytes)
        
        # Create metadata
        metadata = {
            "filename": filename,
            "file_path": file_path,
            "hash": data_hash,
            "record_count": len(dict_data),
            "compressed_size": os.path.getsize(file_path),
            "original_size": len(json_bytes),
            "compression_ratio": round(os.path.getsize(file_path) / len(json_bytes), 4),
            "saved_at": datetime.now().isoformat()
        }
        
        # Save metadata
        self._save_metadata(filename, metadata)
        
        print(f"Data saved to {file_path}")
        print(f"Compression ratio: {metadata['compression_ratio']:.2%}")
        
        return metadata
    
    def load_compressed_data(self, filename: str, verify: bool = True) -> List[Dict]:
        """
        Loads, decompresses, and deserializes data from a file.
        Optionally verifies data integrity using hash.
        """
        file_path = self._get_file_path(filename)
        
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return []
        
        with gzip.open(file_path, 'rb') as f:
            json_bytes = f.read()
        
        # Decode and deserialize
        json_str = json_bytes.decode('utf-8')
        
        # Verify hash if requested
        if verify:
            metadata = self._load_metadata(filename)
            if metadata and metadata.get("hash"):
                if not verify_hash(json_str, metadata["hash"]):
                    print("Warning: Data integrity check failed!")
                    return []
                print("Data integrity verified.")
        
        data_list = json.loads(json_str)
        return data_list
    
    def _save_metadata(self, filename: str, metadata: Dict) -> None:
        """Save metadata for a data file."""
        meta_path = os.path.join(self._data_dir, f"{filename}.meta.json")
        with open(meta_path, 'w') as f:
            json.dump(metadata, f, indent=2)
    
    def _load_metadata(self, filename: str) -> Optional[Dict]:
        """Load metadata for a data file."""
        meta_path = os.path.join(self._data_dir, f"{filename}.meta.json")
        if os.path.exists(meta_path):
            with open(meta_path, 'r') as f:
                return json.load(f)
        return None
    
    def get_metadata(self, filename: str) -> Optional[Dict]:
        """Get metadata for a data file."""
        return self._load_metadata(filename)
    
    def save_single_record(self, data: Any, filename: str) -> Dict[str, str]:
        """Save a single record with compression."""
        return self.save_compressed_data([data], filename)
    
    def delete_data(self, filename: str) -> bool:
        """Delete a data file and its metadata."""
        file_path = self._get_file_path(filename)
        meta_path = os.path.join(self._data_dir, f"{filename}.meta.json")
        
        success = True
        if os.path.exists(file_path):
            os.remove(file_path)
        else:
            success = False
        
        if os.path.exists(meta_path):
            os.remove(meta_path)
        
        return success
    
    def list_files(self) -> List[str]:
        """List all compressed data files."""
        if not os.path.exists(self._data_dir):
            return []
        
        files = []
        for f in os.listdir(self._data_dir):
            if f.endswith('.gz'):
                files.append(f.replace('.gz', ''))
        return files
    
    def get_file_info(self, filename: str) -> Optional[Dict]:
        """Get information about a data file."""
        file_path = self._get_file_path(filename)
        if not os.path.exists(file_path):
            return None
        
        metadata = self._load_metadata(filename)
        file_stat = os.stat(file_path)
        
        return {
            "filename": filename,
            "file_path": file_path,
            "size": file_stat.st_size,
            "modified": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
            "metadata": metadata
        }


class CompanyDataManager(DataManager):
    """Specialized data manager for company data."""
    
    def __init__(self, data_dir: str = "company_data"):
        super().__init__(data_dir)
        self._companies_file = "companies"
    
    def save_companies(self, companies: List) -> Dict[str, str]:
        """Save all companies to compressed file."""
        return self.save_compressed_data(companies, self._companies_file)
    
    def load_companies(self) -> List[Dict]:
        """Load all companies from compressed file."""
        return self.load_compressed_data(self._companies_file)
    
    def save_company(self, company, filename: Optional[str] = None) -> Dict[str, str]:
        """Save a single company to its own file."""
        if filename is None:
            # Use company ID as filename
            if hasattr(company, 'company_id'):
                filename = f"company_{company.company_id}"
            else:
                filename = f"company_{generate_md5_hash(str(company))[:8]}"
        
        return self.save_single_record(company, filename)
    
    def load_company(self, company_id: int) -> Optional[Dict]:
        """Load a single company by ID."""
        filename = f"company_{company_id}"
        data = self.load_compressed_data(filename)
        if data:
            return data[0]
        return None
    
    def get_all_company_ids(self) -> List[int]:
        """Get all saved company IDs."""
        files = self.list_files()
        ids = []
        for f in files:
            if f.startswith("company_") and f != "companies":
                try:
                    company_id = int(f.replace("company_", ""))
                    ids.append(company_id)
                except ValueError:
                    pass
        return ids


class HashIndex:
    """Creates and manages hash-based indexes for quick lookups."""
    
    def __init__(self, data_manager: DataManager, index_name: str = "index"):
        self._data_manager = data_manager
        self._index_name = index_name
        self._index: Dict[str, Any] = {}
        self._load_index()
    
    def _load_index(self) -> None:
        """Load existing index from storage."""
        data = self._data_manager.load_compressed_data(self._index_name, verify=False)
        if data:
            self._index = data[0] if data else {}
    
    def _save_index(self) -> None:
        """Save index to storage."""
        self._data_manager.save_single_record(self._index, self._index_name)
    
    def add_entry(self, key: str, value: Any) -> str:
        """Add an entry to the index."""
        key_hash = generate_hash(key)
        self._index[key_hash] = {
            "key": key,
            "value": value,
            "added_at": datetime.now().isoformat()
        }
        self._save_index()
        return key_hash
    
    def get_entry(self, key: str) -> Optional[Any]:
        """Get an entry by key."""
        key_hash = generate_hash(key)
        entry = self._index.get(key_hash)
        if entry:
            return entry.get("value")
        return None
    
    def remove_entry(self, key: str) -> bool:
        """Remove an entry from the index."""
        key_hash = generate_hash(key)
        if key_hash in self._index:
            del self._index[key_hash]
            self._save_index()
            return True
        return False
    
    def has_entry(self, key: str) -> bool:
        """Check if an entry exists."""
        key_hash = generate_hash(key)
        return key_hash in self._index
    
    def get_all_keys(self) -> List[str]:
        """Get all keys in the index."""
        return [entry["key"] for entry in self._index.values()]
    
    def clear(self) -> None:
        """Clear the index."""
        self._index = {}
        self._save_index()
    
    def __len__(self) -> int:
        return len(self._index)
