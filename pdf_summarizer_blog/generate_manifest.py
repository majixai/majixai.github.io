import os
import json

POSTS_DIR = "pdf_summarizer_blog/posts"
MANIFEST_FILE = os.path.join(POSTS_DIR, "posts.json")

def generate_manifest():
    """
    Generates a posts.json manifest file containing a list of all .dat files
    in the posts directory. Handles the case where no .dat files exist.
    """
    dat_files = [f for f in os.listdir(POSTS_DIR) if f.lower().endswith(".dat")]

    manifest_data = {
        "files": dat_files
    }

    with open(MANIFEST_FILE, 'w') as f:
        json.dump(manifest_data, f, indent=2)

    print(f"Successfully generated manifest with {len(dat_files)} posts.")

if __name__ == "__main__":
    generate_manifest()