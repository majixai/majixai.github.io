import os
import hashlib
import json
import fnmatch

def get_ignore_patterns(gitignore_path='.'):
    """
    Reads ignore patterns from .gitignore and adds default ignores.
    """
    ignore_list = [
        '.git',
        'integrity/hashes.json', # Ignore the output file itself
        'jules-scratch' # Ignore scratch directory
    ]
    try:
        with open(os.path.join(gitignore_path, '.gitignore'), 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    ignore_list.append(line)
    except FileNotFoundError:
        print("Warning: .gitignore not found. Using default ignores.")
    return ignore_list

def is_ignored(path, ignore_patterns):
    """
    Checks if a file or directory path matches any of the ignore patterns.
    """
    path = path.replace(os.sep, '/')
    for pattern in ignore_patterns:
        if fnmatch.fnmatch(path, pattern):
            return True
        if fnmatch.fnmatch(os.path.basename(path), pattern):
            return True
        if pattern.endswith('/') and (pattern[:-1] in path.split('/')):
             return True
        if pattern in path.split('/'):
            return True
    return False

def calculate_sha256(filepath):
    """Calculates the SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    try:
        with open(filepath, 'rb') as f:
            while chunk := f.read(4096):
                sha256.update(chunk)
        return sha256.hexdigest()
    except (IOError, PermissionError) as e:
        print(f"Could not read {filepath}: {e}")
        return None

def generate_hashes(root_dir='.'):
    """
    Generates SHA-256 hashes for all non-ignored files in a directory.
    """
    print("Starting hash generation...")
    ignore_patterns = get_ignore_patterns(root_dir)
    hashes = {}

    for root, dirs, files in os.walk(root_dir, topdown=True):
        # Use relative paths for checking against ignore patterns
        dirs[:] = [d for d in dirs if not is_ignored(os.path.relpath(os.path.join(root, d), root_dir), ignore_patterns)]

        for name in files:
            filepath = os.path.join(root, name)
            relative_path = os.path.relpath(filepath, root_dir)

            if not is_ignored(relative_path, ignore_patterns):
                # Store with forward slashes for consistency
                relative_path_posix = relative_path.replace(os.sep, '/')
                hash_value = calculate_sha256(filepath)
                if hash_value:
                    hashes[relative_path_posix] = hash_value

    print(f"Hashed {len(hashes)} files.")
    return hashes

def save_hashes(hashes, output_file='integrity/hashes.json'):
    """
    Saves the dictionary of hashes to a JSON file.
    """
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(hashes, f, indent=4, sort_keys=True)
    print(f"Hashes saved to {output_file}")

if __name__ == "__main__":
    all_hashes = generate_hashes()
    save_hashes(all_hashes)
