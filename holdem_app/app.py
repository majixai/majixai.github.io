from flask import Flask, jsonify, render_template, request, send_from_directory
from game.game import Game
from player.player import Player
from database import init_db, get_db_connection
import json
import os

app = Flask(__name__, template_folder='templates', static_folder='web_v2')

def init_app(app):
    with app.app_context():
        db_path = os.path.join(os.path.dirname(__file__), 'holdem.db')
        if os.path.exists(db_path):
            os.remove(db_path)
        init_db()
        with get_db_connection() as conn:
            if not conn.execute('SELECT * FROM players').fetchall():
                Player("Alice").save()
                Player("Bob").save()
            if not conn.execute('SELECT * FROM game').fetchall():
                Game([]).save()

def get_game():
    with app.app_context():
        game = Game.get(1)
        game.players = [Player.get(1), Player.get(2)]
        return game

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/game_state')
def game_state():
    game = get_game()
    return jsonify(game.get_state())

@app.route('/bet', methods=['POST'])
def bet():
    player_id = request.json['player_id']
    amount = request.json['amount']
    with app.app_context():
        player = Player.get(player_id)
        if player:
            try:
                game = get_game()
                game.pot += player.bet(amount)
                player.save()
                game.save()
                return jsonify({'success': True})
            except ValueError as e:
                return jsonify({'success': False, 'message': str(e)})
    return jsonify({'success': False, 'message': 'Player not found'})

@app.route('/fold', methods=['POST'])
def fold():
    player_id = request.json['player_id']
    with app.app_context():
        player = Player.get(player_id)
        if player:
            player.fold()
            return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Player not found'})

@app.route('/next_round')
def next_round():
    game = get_game()
    if not game.community_cards:
        game.deal_community_cards(3)
    elif len(game.community_cards) == 3:
        game.deal_community_cards(1)
    elif len(game.community_cards) == 4:
        game.deal_community_cards(1)
    else:
        winners = game.determine_winner()
        print("Winner(s):", ", ".join([w.name for w in winners]))
    game.save()
    return jsonify(game.get_state())

if __name__ == '__main__':
    init_app(app)
    app.run(debug=True, host='0.0.0.0', port=5000)
