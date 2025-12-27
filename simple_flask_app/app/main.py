from flask import Flask
from . import database

app = Flask(__name__)
database.init_app(app)

@app.route("/")
def index():
    db = database.get_db()
    links = db.execute("SELECT * FROM links").fetchall()
    # In a real app, you'd pass this to a template
    return "<p>Links:</p>" + "".join(f"<p>{link['text']}: {link['url']}</p>" for link in links)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
