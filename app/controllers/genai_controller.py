from flask import Blueprint, request, jsonify

genai_bp = Blueprint('genai', __name__)

# Example endpoint for GenAI
@genai_bp.route('/genai/ask', methods=['POST'])
def genai_ask():
    data = request.json
    # TODO: Integrate with GenAI backend
    return jsonify({'response': f"GenAI received: {data.get('prompt', '')}"})
