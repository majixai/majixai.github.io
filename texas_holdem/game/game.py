from texas_holdem.cards.card import Deck
from texas_holdem.player.player import Player

class Game:
    def __init__(self, players):
        self.players = players
        self.deck = Deck()
        self.community_cards = []
        self.pot = 0
        self.current_bet = 0
        self.round_of_betting_complete = False

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
        return {
            'players': [{'name': p.name, 'chips': p.chips, 'hand': [str(c) for c in p.hand]} for p in self.players],
            'community_cards': [str(c) for c in self.community_cards],
            'pot': self.pot
        }
