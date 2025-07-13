from flask import Flask, jsonify, render_template, request
from texas_holdem.game.game import Game
from texas_holdem.player.player import Player
from texas_holdem.database import init_db, get_db_connection
import json

app = Flask(__name__)
init_db()

# Create players and game if they don't exist
with get_db_connection() as conn:
    if not conn.execute('SELECT * FROM players').fetchall():
        Player("Alice").save()
        Player("Bob").save()
    if not conn.execute('SELECT * FROM game').fetchall():
        Game([]).save()


def get_game():
    game = Game.get(1)
    # This is a simplification. In a real app, you'd have a players table for the game
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
    player = Player.get(player_id)
    if player:
        player.fold()
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Player not found'})

@app.route('/next_round')
def next_round():
    game = get_game()
    if not game.community_cards:
        game.deal_community_cards(3) # Flop
    elif len(game.community_cards) == 3:
        game.deal_community_cards(1) # Turn
    elif len(game.community_cards) == 4:
        game.deal_community_cards(1) # River
    game.save()
    return jsonify(game.get_state())

if __name__ == '__main__':
    app.run(debug=True)
