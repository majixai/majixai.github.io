from texas_holdem.cards.card import Deck
from texas_holdem.player.player import Player

class Game:
    def __init__(self, players):
        self.players = players
        self.deck = Deck()
        self.community_cards = []
        self.pot = 0
        self.current_bet = 0

    def deal_hole_cards(self):
        for _ in range(2):
            for player in self.players:
                if player.is_playing:
                    player.hand.append(self.deck.deal())

    def betting_round(self):
        for player in self.players:
            if player.is_playing:
                # Basic betting logic for now
                try:
                    bet_amount = 10
                    self.pot += player.bet(bet_amount)
                    self.current_bet = bet_amount
                except ValueError:
                    player.fold()

    def deal_community_cards(self, count):
        for _ in range(count):
            self.community_cards.append(self.deck.deal())

    def play_round(self):
        self.deck.shuffle()
        self.deal_hole_cards()
        self.betting_round()
        self.deal_community_cards(3) # Flop
        self.betting_round()
        self.deal_community_cards(1) # Turn
        self.betting_round()
        self.deal_community_cards(1) # River
        self.betting_round()
        # Determine winner (not implemented yet)
