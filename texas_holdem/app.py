from flask import Flask, jsonify, render_template, request
from game.game import Game
from player.player import Player

app = Flask(__name__)

players = [Player("Alice"), Player("Bob")]
game = Game(players)
game.start_round()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/game_state')
def game_state():
    return jsonify(game.get_state())

@app.route('/bet', methods=['POST'])
def bet():
    player_name = request.json['player']
    amount = request.json['amount']
    player = next((p for p in game.players if p.name == player_name), None)
    if player:
        try:
            game.pot += player.bet(amount)
            return jsonify({'success': True})
        except ValueError as e:
            return jsonify({'success': False, 'message': str(e)})
    return jsonify({'success': False, 'message': 'Player not found'})

@app.route('/fold', methods=['POST'])
def fold():
    player_name = request.json['player']
    player = next((p for p in game.players if p.name == player_name), None)
    if player:
        player.fold()
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Player not found'})

@app.route('/next_round')
def next_round():
    if not game.community_cards:
        game.deal_community_cards(3) # Flop
    elif len(game.community_cards) == 3:
        game.deal_community_cards(1) # Turn
    elif len(game.community_cards) == 4:
        game.deal_community_cards(1) # River
    return jsonify(game.get_state())

if __name__ == '__main__':
    app.run(debug=True)
