# import unittest
# import json
# from app import app
# from database import init_db, get_db_connection
# from player.player import Player
# from game.game import Game
#
# class TestApi(unittest.TestCase):
#     def setUp(self):
#         app.config['TESTING'] = True
#         app.config['DATABASE'] = 'test.db'
#         self.app = app.test_client()
#         with app.app_context():
#             init_db()
#             Player("Alice").save()
#             Player("Bob").save()
#             Game([]).save()
#
#
#     def test_game_state(self):
#         response = self.app.get('/game_state')
#         self.assertEqual(response.status_code, 200)
#         data = json.loads(response.data)
#         self.assertIn('players', data)
#         self.assertIn('community_cards', data)
#         self.assertIn('pot', data)
#
#     def test_bet(self):
#         response = self.app.post('/bet',
#                                  data=json.dumps({'player_id': 1, 'amount': 10}),
#                                  content_type='application/json')
#         self.assertEqual(response.status_code, 200)
#         data = json.loads(response.data)
#         self.assertTrue(data['success'])
#
#     def test_fold(self):
#         response = self.app.post('/fold',
#                                  data=json.dumps({'player_id': 1}),
#                                  content_type='application/json')
#         self.assertEqual(response.status_code, 200)
#         data = json.loads(response.data)
#         self.assertTrue(data['success'])
#
#     def test_next_round(self):
#         response = self.app.get('/next_round')
#         self.assertEqual(response.status_code, 200)
#         data = json.loads(response.data)
#         self.assertEqual(len(data['community_cards']), 3)
#
# if __name__ == '__main__':
#     unittest.main()
