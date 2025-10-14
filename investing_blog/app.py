from flask import Flask, render_template, request, redirect, url_for
import os
import sqlite3
from investing_blog.processing import add_post_to_db

app = Flask(__name__)
UPLOAD_FOLDER = 'investing_blog/pdfs'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
DATABASE = 'blog.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

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
    app.run(debug=True, port=5001)