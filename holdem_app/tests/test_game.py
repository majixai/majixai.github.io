# import unittest
# from game.game import Game
# from player.player import Player
# from cards.card import Card
# from unittest.mock import patch
#
# class TestGame(unittest.TestCase):
#     def setUp(self):
#         self.players = [Player("Alice", 1000), Player("Bob", 1000)]
#         self.game = Game(self.players)
#
#     @patch('player.player.get_db_connection')
#     def test_deal_hole_cards(self, mock_get_db_connection):
#         self.game.deal_hole_cards()
#         for player in self.game.players:
#             self.assertEqual(len(player.hand), 2)
#         self.assertEqual(len(self.game.deck.cards), 52 - 2 * len(self.players))
#
#     def test_deal_community_cards(self):
#         # Flop
#         self.game.deal_community_cards(3)
#         self.assertEqual(len(self.game.community_cards), 3)
#         self.assertEqual(len(self.game.deck.cards), 49)
#
#         # Turn
#         self.game.deal_community_cards(1)
#         self.assertEqual(len(self.game.community_cards), 4)
#         self.assertEqual(len(self.game.deck.cards), 48)
#
#         # River
#         self.game.deal_community_cards(1)
#         self.assertEqual(len(self.game.community_cards), 5)
#         self.assertEqual(len(self.game.deck.cards), 47)
#
#     @patch('game.game.evaluate_hand')
#     @patch('player.player.get_db_connection')
#     def test_determine_winner(self, mock_get_db_connection, mock_evaluate_hand):
#         # Set up a scenario with a clear winner
#         mock_evaluate_hand.side_effect = [(8, 12), (1, 2)]
#         self.game.players[0].hand = [Card("♠", "A"), Card("♠", "K")]
#         self.game.players[1].hand = [Card("♥", "2"), Card("♦", "3")]
#         self.game.community_cards = [
#             Card("♠", "Q"),
#             Card("♠", "J"),
#             Card("♠", "10"),
#             Card("♥", "5"),
#             Card("♦", "6"),
#         ]
#         winners = self.game.determine_winner()
#         self.assertEqual(len(winners), 1)
#         self.assertEqual(winners[0].name, "Alice")
#
# if __name__ == '__main__':
#     unittest.main()
