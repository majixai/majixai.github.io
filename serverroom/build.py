import os
import json

def create_file_list():
    store_dir = 'store'
    db_dir = os.path.join(store_dir, 'db')

    script_dir = os.path.dirname(os.path.abspath(__file__))

    db_path = os.path.join(script_dir, db_dir)

    dat_files = [f for f in os.listdir(db_path) if f.endswith('.dat')]

    file_paths = [f'db/{f}' for f in dat_files]

    output_path = os.path.join(script_dir, store_dir, 'files.json')
    with open(output_path, 'w') as f:
        json.dump(file_paths, f)

    print(f"File list generated at {output_path}")

if __name__ == '__main__':
    create_file_list()