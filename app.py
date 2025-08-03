from flask import Flask, jsonify, request
from transformers import pipeline
import database
from app.controllers import git_action_controller

app = Flask(__name__)
database.init_app(app)

generator = pipeline('text-generation', model='gpt2')

@app.route('/api/links', methods=['GET'])
def get_links():
    db = database.get_db()
    cursor = db.execute('SELECT * FROM links')
    links = cursor.fetchall()
    return jsonify([dict(link) for link in links])

@app.route('/api/links', methods=['POST'])
def add_link():
    new_link = request.get_json()
    db = database.get_db()
    db.execute('INSERT INTO links (text, url) VALUES (?, ?)',
               [new_link['text'], new_link['url']])
    db.commit()
    return jsonify(new_link)

@app.route('/api/links/<int:link_id>/click', methods=['POST'])
def increment_click_count(link_id):
    db = database.get_db()
    db.execute('UPDATE links SET click_count = click_count + 1 WHERE id = ?', [link_id])
    db.commit()
    return jsonify({'message': 'Click count incremented'})

@app.route('/api/generate', methods=['POST'])
def generate_text():
    prompt = request.get_json()['prompt']
    generated_text = generator(prompt, max_length=50, num_return_sequences=1)
    return jsonify({'generated_text': generated_text[0]['generated_text']})

@app.route('/api/git-action', methods=['POST'])
def trigger_git_action():
    git_action_controller.run_git_action()
    return jsonify({'message': 'Git action triggered'})

@app.route('/api/python-action', methods=['POST'])
def python_action():
    # In a real application, you would have some python logic here
    return jsonify({'message': 'Python action triggered'})

@app.route('/api/genai-action', methods=['POST'])
def genai_action():
    prompt = request.get_json()['prompt']
    generated_text = generator(prompt, max_length=50, num_return_sequences=1)
    return jsonify({'generated_text': generated_text[0]['generated_text']})

@app.route('/api/data-storage-action', methods=['POST'])
def data_storage_action():
    new_link = request.get_json()
    db = database.get_db()
    db.execute('INSERT INTO links (text, url) VALUES (?, ?)',
               [new_link['text'], new_link['url']])
    db.commit()
    return jsonify(new_link)

if __name__ == '__main__':
    app.run(debug=True)
