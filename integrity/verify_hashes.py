import os
import json
import hashlib
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

def load_hashes(hashes_file='integrity/hashes.json'):
    """Loads the hashes from the JSON file."""
    try:
        with open(hashes_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Hashes file not found at {hashes_file}.")
        print("Please run generate_hashes.py first.")
        return None
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {hashes_file}.")
        return None

def verify_hashes(root_dir='.'):
    """
    Verifies the integrity of files against the stored hashes.
    """
    print("Starting hash verification...")
    stored_hashes = load_hashes()
    if stored_hashes is None:
        return

    ignore_patterns = get_ignore_patterns(root_dir)
    current_files = set()
    changed_files = []

    for root, dirs, files in os.walk(root_dir, topdown=True):
        dirs[:] = [d for d in dirs if not is_ignored(os.path.relpath(os.path.join(root, d), root_dir), ignore_patterns)]

        for name in files:
            filepath = os.path.join(root, name)
            relative_path = os.path.relpath(filepath, root_dir)

            if not is_ignored(relative_path, ignore_patterns):
                relative_path_posix = relative_path.replace(os.sep, '/')
                current_files.add(relative_path_posix)

                new_hash = calculate_sha256(filepath)
                if new_hash is None:
                    continue

                if relative_path_posix in stored_hashes:
                    if stored_hashes[relative_path_posix] != new_hash:
                        changed_files.append(relative_path_posix)

    stored_files = set(stored_hashes.keys())
    new_files = current_files - stored_files
    deleted_files = stored_files - current_files

    # --- Reporting ---
    if not new_files and not changed_files and not deleted_files:
        print("\nVerification successful: All files are intact.")
    else:
        print("\nVerification finished. Issues found:")
        if new_files:
            print("\n--- New Files ---")
            for f in sorted(new_files):
                print(f)
        if changed_files:
            print("\n--- Modified Files ---")
            for f in sorted(changed_files):
                print(f)
        if deleted_files:
            print("\n--- Deleted Files ---")
            for f in sorted(deleted_files):
                print(f)

if __name__ == "__main__":
    verify_hashes()
