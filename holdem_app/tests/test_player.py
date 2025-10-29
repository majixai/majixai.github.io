# import unittest
# from player.player import Player
#
# class TestPlayer(unittest.TestCase):
#     def test_player_creation(self):
#         player = Player("Alice", 1000)
#         self.assertEqual(player.name, "Alice")
#         self.assertEqual(player.chips, 1000)
#         self.assertEqual(player.hand, [])
#         self.assertTrue(player.is_playing)
#
#     def test_player_bet(self):
#         player = Player("Alice", 1000)
#         bet_amount = player.bet(100)
#         self.assertEqual(player.chips, 900)
#         self.assertEqual(bet_amount, 100)
#
#     def test_player_bet_not_enough_chips(self):
#         player = Player("Alice", 100)
#         with self.assertRaises(ValueError):
#             player.bet(200)
#
#     def test_player_fold(self):
#         player = Player("Alice", 1000)
#         player.fold()
#         self.assertFalse(player.is_playing)
#
# if __name__ == '__main__':
#     unittest.main()
