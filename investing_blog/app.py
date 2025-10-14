from flask import Flask, render_template, request, redirect, url_for
import os
import PyPDF2
import sqlite3
import json

app = Flask(__name__)
UPLOAD_FOLDER = 'investing_blog/pdfs'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
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


@app.route("/")
def index():
    return "Investing Blog Backend is running!"

@app.route("/upload", methods=['GET', 'POST'])
def upload_page():
    if request.method == 'POST':
        if 'pdfFile' not in request.files:
            return 'No file part'
        file = request.files['pdfFile']
        if file.filename == '':
            return 'No selected file'
        if file and file.filename.endswith('.pdf'):
            filename = file.filename
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)

            # Process the PDF to generate a blog post
            post_data = process_pdf(filepath)
            if post_data:
                conn = get_db()
                c = conn.cursor()
                c.execute(
                    'INSERT INTO posts (title, content, tags) VALUES (?, ?, ?)',
                    (os.path.splitext(filename)[0], post_data['content'], json.dumps(post_data['tags']))
                )
                conn.commit()
                conn.close()

            return redirect(url_for('drafts_page'))
    return render_template("upload.html")

@app.route("/drafts")
def drafts_page():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM posts WHERE status = 'draft' ORDER BY created_at DESC")
    posts = c.fetchall()
    conn.close()
    return render_template("drafts.html", posts=posts)

if __name__ == "__main__":
    app.run(debug=True, port=5001)