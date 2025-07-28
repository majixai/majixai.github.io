from flask import Blueprint, request, jsonify
from app.server_comm import notify_other_server

server_comm_bp = Blueprint('server_comm', __name__)

@server_comm_bp.route('/server/notify', methods=['POST'])
def notify():
    data = request.json
    url = data.get('url')
    payload = data.get('payload', {})
    result = notify_other_server(url, payload)
    return jsonify(result)
