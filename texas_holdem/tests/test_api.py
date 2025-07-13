import unittest
import json
from texas_holdem.app import app

class TestApi(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()

    def test_game_state(self):
        response = self.app.get('/game_state')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('players', data)
        self.assertIn('community_cards', data)
        self.assertIn('pot', data)

    def test_bet(self):
        response = self.app.post('/bet',
                                 data=json.dumps({'player': 'Alice', 'amount': 10}),
                                 content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

    def test_fold(self):
        response = self.app.post('/fold',
                                 data=json.dumps({'player': 'Alice'}),
                                 content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

    def test_next_round(self):
        response = self.app.get('/next_round')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data['community_cards']), 3)

if __name__ == '__main__':
    unittest.main()
