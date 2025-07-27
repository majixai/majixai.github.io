from flask import Flask, request, jsonify
import threading

app = Flask(__name__)

@app.route('/genai/ask', methods=['POST'])
def genai_ask():
    data = request.json
    # TODO: Integrate with GenAI backend
    return jsonify({'response': f"GenAI (standalone) received: {data.get('prompt', '')}"})

@app.route('/genai/handshake', methods=['POST'])
def handshake():
    # Used for server-to-server communication
    return jsonify({'status': 'GenAI server online'})

if __name__ == '__main__':
    app.run(port=5050, debug=True)
