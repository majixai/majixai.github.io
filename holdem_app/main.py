

"""
Texas Hold'em Poker CLI, Python API, and Flask Web App

Usage (CLI):
    python main.py start --players Alice Bob
    python main.py deal
    python main.py bet --player Alice --amount 50
    python main.py fold --player Bob
    python main.py show

Usage (Python API):
    from main import PokerGame
    game = PokerGame(["Alice", "Bob"])
    game.start()
    game.deal()
    game.bet("Alice", 50)
    game.fold("Bob")
    print(game.get_state())

Usage (Flask Web App):
    python main.py runserver
    # Then visit http://localhost:5000

    # Or with Gunicorn/external runner:
    # gunicorn 'main:create_app()'
    # Or set FLASK_APP=main:create_app and run flask run

Usage (Python Action):
    from texas_holdem.main import run_holdem_server
    run_holdem_server(host="0.0.0.0", port=5000, debug=True)
"""


import argparse
from flask import Flask, jsonify, request, render_template
from texas_holdem.game.game import Game
from texas_holdem.player.player import Player

# Placeholder for GenAI integration
try:
    from texas_holdem.genai import genai_agent  # Example: import your GenAI agent here
except ImportError:
    genai_agent = None  # Or define a stub if needed

# Placeholder for extension/extense integration
try:
    from texas_holdem.extense import extensions  # Example: import your extensions here
except ImportError:
    extensions = None  # Or define a stub if needed

# Flask app factory for CLI and external runners (Gunicorn, GitHub Actions, etc.)
# Flask app factory for CLI and external runners (Gunicorn, GitHub Actions, etc.)

# Flask app factory for CLI, external runners, and Python actions
def create_app():
    app = Flask(__name__)
    global _web_game
    _web_game = None  # Global for web app state (demo only)

    @app.route("/")
    def index():
        return render_template("index.html") if app.jinja_env.loader else "Texas Hold'em Poker Web App"

    @app.route("/api/start", methods=["POST"])
    def api_start():
        global _web_game
        data = request.json or {}
        player_names = data.get("players", ["Alice", "Bob"])
        _web_game = PokerGame(player_names)
        _web_game.start()
        return jsonify({"status": "started", "players": player_names})

    @app.route("/api/deal", methods=["POST"])
    def api_deal():
        if not _web_game:
            return jsonify({"error": "Start a game first."}), 400
        _web_game.deal()
        return jsonify({"status": "dealt"})

    @app.route("/api/bet", methods=["POST"])
    def api_bet():
        if not _web_game:
            return jsonify({"error": "Start a game first."}), 400
        data = request.json or {}
        player = data.get("player")
        amount = data.get("amount")
        try:
            _web_game.bet(player, amount)
            return jsonify({"status": "bet", "player": player, "amount": amount})
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app.route("/api/fold", methods=["POST"])
    def api_fold():
        if not _web_game:
            return jsonify({"error": "Start a game first."}), 400
        data = request.json or {}
        player = data.get("player")
        try:
            _web_game.fold(player)
            return jsonify({"status": "folded", "player": player})
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app.route("/api/state")
    def api_state():
        if not _web_game:
            return jsonify({"error": "Start a game first."}), 400
        return jsonify(_web_game.get_state())

    return app

# Python action to run the holdem server programmatically
def run_holdem_server(host="0.0.0.0", port=5000, debug=True):
    """
    Run the Texas Hold'em Flask server from Python code.
    Example:
        from texas_holdem.main import run_holdem_server
        run_holdem_server(host="0.0.0.0", port=5000, debug=True)
    """
    app = create_app()
    app.run(host=host, port=port, debug=debug)

class PokerGame:
    """Python API for Texas Hold'em Poker actions."""
    def __init__(self, player_names):
        self.players = [Player(name) for name in player_names]
        self.game = Game(self.players)

    def start(self):
        self.game.start_round()

    def deal(self):
        self.game.deal_community_cards(3)  # Flop
        self.game.deal_community_cards(1)  # Turn
        self.game.deal_community_cards(1)  # River

    def bet(self, player_name, amount):
        player = next((p for p in self.players if p.name == player_name), None)
        if player:
            self.game.pot += player.bet(amount)
            self.game.current_bet = amount
        else:
            raise ValueError(f"Player {player_name} not found.")

    def fold(self, player_name):
        player = next((p for p in self.players if p.name == player_name), None)
        if player:
            player.fold()
        else:
            raise ValueError(f"Player {player_name} not found.")

    def get_state(self):
        return self.game.get_state()

    def show(self):
        state = self.get_state()
        print("Community cards:", ", ".join(state['community_cards']))
        for player in state['players']:
            print(f"{player['name']}'s hand:", ", ".join(player['hand']))
            print(f"{player['name']}'s chips:", player['chips'])
        print("Pot:", state['pot'])



def main():
    parser = argparse.ArgumentParser(description="Texas Hold'em Poker CLI and Web App")
    subparsers = parser.add_subparsers(dest="command")

    start_parser = subparsers.add_parser("start", help="Start a new game")
    start_parser.add_argument("--players", nargs='+', required=True, help="Player names")

    deal_parser = subparsers.add_parser("deal", help="Deal community cards")

    bet_parser = subparsers.add_parser("bet", help="Place a bet")
    bet_parser.add_argument("--player", required=True, help="Player name")
    bet_parser.add_argument("--amount", type=int, required=True, help="Bet amount")

    fold_parser = subparsers.add_parser("fold", help="Fold a player")
    fold_parser.add_argument("--player", required=True, help="Player name")

    show_parser = subparsers.add_parser("show", help="Show game state")

    runserver_parser = subparsers.add_parser("runserver", help="Run Flask web server")
    runserver_parser.add_argument("--host", default="127.0.0.1", help="Host for Flask app")
    runserver_parser.add_argument("--port", type=int, default=5000, help="Port for Flask app")

    args = parser.parse_args()

    # For demo: keep game state in memory (could be extended to persist)
    if args.command == "start":
        global poker_game
        poker_game = PokerGame(args.players)
        poker_game.start()
        print(f"Game started with players: {', '.join(args.players)}")
    elif args.command == "deal":
        try:
            poker_game.deal()
            print("Community cards dealt.")
        except NameError:
            print("Start a game first with 'start' command.")
    elif args.command == "bet":
        try:
            poker_game.bet(args.player, args.amount)
            print(f"{args.player} bet {args.amount} chips.")
        except NameError:
            print("Start a game first with 'start' command.")
        except ValueError as e:
            print(e)
    elif args.command == "fold":
        try:
            poker_game.fold(args.player)
            print(f"{args.player} folded.")
        except NameError:
            print("Start a game first with 'start' command.")
        except ValueError as e:
            print(e)
    elif args.command == "show":
        try:
            poker_game.show()
        except NameError:
            print("Start a game first with 'start' command.")
    elif args.command == "runserver":
        # Use the app factory for CLI run
        app = create_app()
        app.run(host=args.host, port=args.port, debug=True)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
