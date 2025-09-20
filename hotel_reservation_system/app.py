from flask import Flask, jsonify, request, render_template
import sqlite3
import os

app = Flask(__name__)

# --- Database Setup ---
_basedir = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(_basedir, 'hotel_reservation_system.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT,
            price REAL NOT NULL, available INTEGER NOT NULL DEFAULT 1
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER, guest_name TEXT NOT NULL,
            check_in_date TEXT NOT NULL, check_out_date TEXT NOT NULL,
            FOREIGN KEY (room_id) REFERENCES rooms (id)
        )
    ''')
    if cursor.execute('SELECT COUNT(*) FROM rooms').fetchone()[0] == 0:
        rooms = [
            (1, 'The Captain''s Quarters', 'A luxurious suite with a view of the sea.', 250.00, 1),
            (2, 'The Crow''s Nest', 'A cozy room with a great view.', 150.00, 1),
            (3, 'The Pirate''s Den', 'A spacious room with a rustic feel.', 200.00, 1),
            (4, 'The Mermaid''s Grotto', 'A charming room with a water theme.', 175.00, 1),
            (5, 'The Treasure Chamber', 'A room filled with golden decor.', 300.00, 1),
            (6, 'The Sunken Ship', 'A unique room with a nautical theme.', 180.00, 1),
            (7, 'The Island Paradise', 'A room with a tropical vibe.', 220.00, 1),
            (8, 'The Buccaneer''s Bunk', 'A simple and affordable room.', 100.00, 1),
            (9, 'The Siren''s Song', 'A room with a musical theme.', 190.00, 1),
            (10, 'The Kraken''s Lair', 'A mysterious room with a deep sea theme.', 210.00, 1)
        ]
        cursor.executemany('INSERT INTO rooms (id, name, description, price, available) VALUES (?, ?, ?, ?, ?)', rooms)
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize the database right away
init_db()
# --- End Database Setup ---


@app.route('/')
def index():
    # This route is now handled by the frontend serving index.html directly
    # but we can keep it for API discoverability or a simple health check.
    return "API is running."

@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    conn = get_db_connection()
    rooms = conn.execute('SELECT * FROM rooms').fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in rooms])

@app.route('/api/bookings', methods=['POST'])
def create_booking():
    data = request.get_json()
    room_id = data.get('room_id')
    guest_name = data.get('guest_name')
    check_in_date = data.get('check_in_date')
    check_out_date = data.get('check_out_date')

    if not all([room_id, guest_name, check_in_date, check_out_date]):
        return jsonify({'error': 'Missing required booking information'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    room = cursor.execute('SELECT * FROM rooms WHERE id = ? AND available = 1', (room_id,)).fetchone()
    if not room:
        conn.close()
        return jsonify({'error': 'Room not available or does not exist'}), 400

    cursor.execute('INSERT INTO bookings (room_id, guest_name, check_in_date, check_out_date) VALUES (?, ?, ?, ?)',
                   (room_id, guest_name, check_in_date, check_out_date))

    cursor.execute('UPDATE rooms SET available = 0 WHERE id = ?', (room_id,))

    conn.commit()
    booking_id = cursor.lastrowid
    conn.close()

    return jsonify({'message': 'Booking successful', 'booking_id': booking_id}), 201

@app.route('/api/bookings', methods=['GET'])
def get_bookings():
    conn = get_db_connection()
    bookings = conn.execute('SELECT b.id, r.name as room_name, b.guest_name, b.check_in_date, b.check_out_date FROM bookings b JOIN rooms r ON b.room_id = r.id').fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in bookings])

if __name__ == '__main__':
    app.run(debug=True, port=5001)
