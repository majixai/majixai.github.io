import random

class Card:
    def __init__(self, suit, rank):
        self.suit = suit
        self.rank = rank

    def __str__(self):
        return f"{self.rank}{self.suit}"

    def to_json(self):
        return str(self)

class Deck:
    def __init__(self):
        self.cards = [Card(s, r) for s in "♠♥♦♣" for r in "23456789TJQKA"]

    def shuffle(self):
        random.shuffle(self.cards)

    def deal(self):
        return self.cards.pop()
