from database import get_db_connection

class Player:
    def __init__(self, name, chips=1000, id=None):
        self.id = id
        self.name = name
        self.chips = chips
        self.hand = []
        self.is_playing = True

    def save(self):
        conn = get_db_connection()
        if self.id is None:
            cursor = conn.execute('INSERT INTO players (name, chips) VALUES (?, ?)', (self.name, self.chips))
            self.id = cursor.lastrowid
        else:
            conn.execute('UPDATE players SET name = ?, chips = ? WHERE id = ?', (self.name, self.chips, self.id))
        conn.commit()
        conn.close()

    @staticmethod
    def get(id):
        conn = get_db_connection()
        player_row = conn.execute('SELECT * FROM players WHERE id = ?', (id,)).fetchone()
        conn.close()
        if player_row:
            return Player(player_row['name'], player_row['chips'], player_row['id'])
        return None

    def bet(self, amount):
        if amount > self.chips:
            raise ValueError("Not enough chips")
        self.chips -= amount
        return amount

    def fold(self):
        self.is_playing = False

    def __str__(self):
        return f"{self.name} ({self.chips} chips)"
