import os
import json
import zlib
import PyPDF2
from datetime import datetime

UPLOADS_DIR = "pdf_summarizer_blog/uploads"
POSTS_DIR = "pdf_summarizer_blog/posts"
SUMMARY_LENGTH = 500  # Characters

def generate_summary(text):
    """Generates a summary from the given text."""
    return text[:SUMMARY_LENGTH]

def process_pdf(file_path):
    """
    Processes a single PDF file, extracts text, generates a summary,
    and saves it as a compressed .dat file.
    """
    try:
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ""
            for page in reader.pages:
                text += page.extract_text()

        if not text.strip():
            print(f"Warning: No text could be extracted from {os.path.basename(file_path)}")
            return

        summary = generate_summary(text)

        post_data = {
            "title": f"Summary of {os.path.basename(file_path)}",
            "summary": summary,
            "originalFileName": os.path.basename(file_path),
            "uploadDate": datetime.utcnow().isoformat()
        }

        # Create a unique filename for the post
        base_filename = os.path.splitext(os.path.basename(file_path))[0]
        dat_filename = f"{base_filename}.dat"
        dat_filepath = os.path.join(POSTS_DIR, dat_filename)

        # Compress and write the data
        compressed_data = zlib.compress(json.dumps(post_data).encode('utf-8'))
        with open(dat_filepath, 'wb') as df:
            df.write(compressed_data)

        print(f"Successfully processed {os.path.basename(file_path)} -> {dat_filename}")
        os.remove(file_path) # Clean up the original PDF
        print(f"Removed original file: {os.path.basename(file_path)}")

    except Exception as e:
        print(f"Error processing {os.path.basename(file_path)}: {e}")

def main():
    """Main function to process all PDFs in the uploads directory."""
    if not os.path.exists(UPLOADS_DIR):
        print(f"Uploads directory '{UPLOADS_DIR}' not found. No files to process.")
        return

    for filename in os.listdir(UPLOADS_DIR):
        if filename.lower().endswith(".pdf"):
            file_path = os.path.join(UPLOADS_DIR, filename)
            process_pdf(file_path)

if __name__ == "__main__":
    main()