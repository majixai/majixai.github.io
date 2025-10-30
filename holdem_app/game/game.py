from cards.card import Deck, Card
from player.player import Player
from database import get_db_connection
import json
from statistics.hand_evaluator import evaluate_hand
from statistics.odds import calculate_pot_odds

class Game:
    def __init__(self, players, id=None):
        self.id = id
        self.players = players
        self.deck = Deck()
        self.community_cards = []
        self.pot = 0
        self.current_bet = 0
        self.round_of_betting_complete = False

    def save(self):
        conn = get_db_connection()
        if self.id is None:
            cursor = conn.execute('INSERT INTO game (community_cards, pot, current_bet) VALUES (?, ?, ?)',
                                  (json.dumps([c.to_json() for c in self.community_cards]), self.pot, self.current_bet))
            self.id = cursor.lastrowid
        else:
            conn.execute('UPDATE game SET community_cards = ?, pot = ?, current_bet = ? WHERE id = ?',
                         (json.dumps([c.to_json() for c in self.community_cards]), self.pot, self.current_bet, self.id))
        conn.commit()
        conn.close()

    @staticmethod
    def get(id):
        conn = get_db_connection()
        game_row = conn.execute('SELECT * FROM game WHERE id = ?', (id,)).fetchone()
        conn.close()
        if game_row:
            # Note: Players are not loaded here. This needs to be handled separately.
            game = Game([], id=game_row['id'])
            game.community_cards = [Card(c[1], c[0]) for c in json.loads(game_row['community_cards'])]
            game.pot = game_row['pot']
            game.current_bet = game_row['current_bet']
            return game
        return None


    def start_round(self):
        self.deck.shuffle()
        self.deal_hole_cards()

    def deal_hole_cards(self):
        for _ in range(2):
            for player in self.players:
                if player.is_playing:
                    player.hand.append(self.deck.deal())

    def betting_round(self):
        self.round_of_betting_complete = False
        for player in self.players:
            if player.is_playing:
                # Basic betting logic for now
                try:
                    bet_amount = 10
                    self.pot += player.bet(bet_amount)
                    self.current_bet = bet_amount
                except ValueError:
                    player.fold()
        self.round_of_betting_complete = True


    def deal_community_cards(self, count):
        for _ in range(count):
            self.community_cards.append(self.deck.deal())

    def get_state(self):
        game_state = {
            'players': [],
            'community_cards': [str(c) for c in self.community_cards],
            'pot': self.pot
        }

        for p in self.players:
            player_state = {
                'id': p.id,
                'name': p.name,
                'chips': p.chips,
                'hand': [str(c) for c in p.hand],
                'pot_odds': calculate_pot_odds(self.pot, self.current_bet)
            }
            game_state['players'].append(player_state)

        return game_state

    def determine_winner(self):
        best_hand_rank = (-1,)
        winners = []

        for player in self.players:
            if player.is_playing:
                player_hand = player.hand + self.community_cards
                hand_rank = evaluate_hand(player_hand)
                if hand_rank > best_hand_rank:
                    best_hand_rank = hand_rank
                    winners = [player]
                elif hand_rank == best_hand_rank:
                    winners.append(player)

        return winners
