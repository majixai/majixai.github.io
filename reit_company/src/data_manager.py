import json
import gzip

def save_compressed_data(data, filename):
    """Serializes, compresses, and saves data to a file."""
    # Convert Python objects to dictionaries
    dict_data = [
        {
            "address": p.address,
            "price": p.get_price(),
            "type": p.get_property_type()
        }
        for p in data
    ]
    # Serialize to JSON and encode to bytes
    json_bytes = json.dumps(dict_data, indent=4).encode('utf-8')

    # Compress and write to file
    with gzip.open(filename, 'wb') as f:
        f.write(json_bytes)
    print(f"Data saved to {filename}")

def load_compressed_data(filename):
    """Loads, decompresses, and deserializes data from a file."""
    with gzip.open(filename, 'rb') as f:
        json_bytes = f.read()

    # Decode from bytes and deserialize from JSON
    data_list = json.loads(json_bytes.decode('utf-8'))
    return data_list