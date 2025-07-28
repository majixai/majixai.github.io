from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/git-action/trigger', methods=['POST'])
def trigger_action():
    data = request.json
    # TODO: Implement git action logic
    return jsonify({'status': 'Git action triggered (standalone)', 'data': data})

@app.route('/git-action/handshake', methods=['POST'])
def handshake():
    # Used for server-to-server communication
    return jsonify({'status': 'Git Action server online'})

if __name__ == '__main__':
    app.run(port=5051, debug=True)
