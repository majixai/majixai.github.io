# import unittest
# from cards.card import Card, Deck
#
# class TestCard(unittest.TestCase):
#     def test_card_creation(self):
#         card = Card("♠", "A")
#         self.assertEqual(card.suit, "♠")
#         self.assertEqual(card.rank, "A")
#
#     def test_card_str(self):
#         card = Card("♠", "A")
#         self.assertEqual(str(card), "A♠")
#
# class TestDeck(unittest.TestCase):
#     def test_deck_creation(self):
#         deck = Deck()
#         self.assertEqual(len(deck.cards), 52)
#
#     def test_deck_shuffle(self):
#         deck1 = Deck()
#         deck2 = Deck()
#         deck2.shuffle()
#         self.assertNotEqual([str(c) for c in deck1.cards], [str(c) for c in deck2.cards])
#
#     def test_deck_deal(self):
#         deck = Deck()
#         card = deck.deal()
#         self.assertEqual(len(deck.cards), 51)
#         self.assertIsInstance(card, Card)
#
# if __name__ == '__main__':
#     unittest.main()
