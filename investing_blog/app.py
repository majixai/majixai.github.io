from flask import Flask, render_template, request, redirect, url_for, send_from_directory
import os
import sqlite3
from processing import add_post_to_db

print("Starting Flask app...")
app = Flask(__name__, static_folder='../dist/static', template_folder='templates')
UPLOAD_FOLDER = 'investing_blog/pdfs'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
DATABASE = 'blog.db'
DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'dist'))

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def serve_index():
    return send_from_directory(DIST_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(DIST_DIR, path)

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
            add_post_to_db(filepath)

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
    app.run(debug=True, port=5001, use_reloader=False)