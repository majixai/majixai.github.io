import PyPDF2
import sqlite3
import json
import os

DATABASE = 'blog.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def process_pdf(pdf_path):
    """
    Extracts text from a PDF and generates a summary and tags.
    This is a placeholder for a real AI model.
    """
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ""
            for page in reader.pages:
                text += page.extract_text()

        # Placeholder for AI summarization and tagging
        summary = text[:200] + "..." if len(text) > 200 else text
        tags = ["pdf", "generated", "draft", "bullish", "tech", "economy"]

        return {"content": summary, "tags": tags}
    except Exception as e:
        print(f"Error processing PDF: {e}")
        return None

def add_post_to_db(pdf_path):
    post_data = process_pdf(pdf_path)
    if post_data:
        conn = get_db()
        c = conn.cursor()
        c.execute(
            'INSERT INTO posts (title, content, tags) VALUES (?, ?, ?)',
            (os.path.splitext(os.path.basename(pdf_path))[0], post_data['content'], json.dumps(post_data['tags']))
        )
        conn.commit()
        conn.close()
        print(f"Successfully processed and added {pdf_path} to the database.")

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        for pdf_path in sys.argv[1:]:
            add_post_to_db(pdf_path)
    else:
        print("Please provide one or more PDF file paths as arguments.")