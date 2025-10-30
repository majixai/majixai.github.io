# import unittest
# from statistics.odds import calculate_pot_odds
# from statistics.hand_evaluator import evaluate_hand
# from cards.card import Card
#
# class TestStatistics(unittest.TestCase):
#     def test_calculate_pot_odds(self):
#         self.assertAlmostEqual(calculate_pot_odds(100, 10), 10.0)
#         self.assertAlmostEqual(calculate_pot_odds(50, 25), 2.0)
#         self.assertEqual(calculate_pot_odds(100, 0), float('inf'))
#
#     def test_evaluate_hand_high_card(self):
#         hand = [Card('♠', 'A'), Card('♥', 'K'), Card('♦', 'Q'), Card('♣', 'J'), Card('♠', '9'), Card('♥', '7'), Card('♦', '2')]
#         self.assertEqual(evaluate_hand(hand)[0], 0)
#
#     def test_evaluate_hand_one_pair(self):
#         hand = [Card('♠', 'A'), Card('♥', 'A'), Card('♦', 'Q'), Card('♣', 'J'), Card('♠', '9'), Card('♥', '7'), Card('♦', '2')]
#         self.assertEqual(evaluate_hand(hand)[0], 1)
#
#     def test_evaluate_hand_two_pair(self):
#         hand = [Card('♠', 'A'), Card('♥', 'A'), Card('♦', 'Q'), Card('♣', 'Q'), Card('♠', '9'), Card('♥', '7'), Card('♦', '2')]
#         self.assertEqual(evaluate_hand(hand)[0], 2)
#
#     def test_evaluate_hand_three_of_a_kind(self):
#         hand = [Card('♠', 'A'), Card('♥', 'A'), Card('♦', 'A'), Card('♣', 'J'), Card('♠', '9'), Card('♥', '7'), Card('♦', '2')]
#         self.assertEqual(evaluate_hand(hand)[0], 3)
#
#     def test_evaluate_hand_straight(self):
#         hand = [Card('♠', 'A'), Card('♥', 'K'), Card('♦', 'Q'), Card('♣', 'J'), Card('♠', '10'), Card('♥', '7'), Card('♦', '2')]
#         self.assertEqual(evaluate_hand(hand)[0], 4)
#
#     def test_evaluate_hand_flush(self):
#         hand = [Card('♠', 'A'), Card('♠', 'K'), Card('♠', 'Q'), Card('♠', 'J'), Card('♠', '9'), Card('♥', '7'), Card('♦', '2')]
#         self.assertEqual(evaluate_hand(hand)[0], 5)
#
#     def test_evaluate_hand_full_house(self):
#         hand = [Card('♠', 'A'), Card('♥', 'A'), Card('♦', 'A'), Card('♣', 'K'), Card('♠', 'K'), Card('♥', '7'), Card('♦', '2')]
#         self.assertEqual(evaluate_hand(hand)[0], 6)
#
#     def test_evaluate_hand_four_of_a_kind(self):
#         hand = [Card('♠', 'A'), Card('♥', 'A'), Card('♦', 'A'), Card('♣', 'A'), Card('♠', '9'), Card('♥', '7'), Card('♦', '2')]
#         self.assertEqual(evaluate_hand(hand)[0], 7)
#
#     def test_evaluate_hand_straight_flush(self):
#         hand = [Card('♠', 'A'), Card('♠', 'K'), Card('♠', 'Q'), Card('♠', 'J'), Card('♠', '10'), Card('♥', '7'), Card('♦', '2')]
#         self.assertEqual(evaluate_hand(hand)[0], 8)
#
# if __name__ == '__main__':
#     unittest.main()
