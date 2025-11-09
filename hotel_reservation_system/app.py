from flask import Flask, jsonify, request, render_template
import sqlite3
import os
import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, template_folder='templates')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'a_default_secret_key_for_development')

# --- Database Setup ---
_basedir = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(_basedir, 'hotel_reservation_system.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Main Tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT,
            price REAL NOT NULL, available INTEGER NOT NULL DEFAULT 1,
            image_url TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER, guest_name TEXT NOT NULL,
            check_in_date TEXT NOT NULL, check_out_date TEXT NOT NULL,
            FOREIGN KEY (room_id) REFERENCES rooms (id)
        )
    ''')
    # Admin Monitoring Tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS visitor_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT, user_agent TEXT, request_path TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS interaction_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT, interaction_type TEXT, details TEXT
        )
    ''')
    # Seed data if rooms table is empty
    if cursor.execute('SELECT COUNT(*) FROM rooms').fetchone()[0] == 0:
        # Using a placeholder image for all rooms
        placeholder_img = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?fit=crop&w=1500&q=80'
        rooms = [
            (1, 'The Captain''s Quarters', 'A luxurious suite with a view of the sea.', 250.00, 1, placeholder_img),
            (2, 'The Crow''s Nest', 'A cozy room with a great view.', 150.00, 1, placeholder_img),
            (3, 'The Pirate''s Den', 'A spacious room with a rustic feel.', 200.00, 1, placeholder_img),
            (4, 'The Mermaid''s Grotto', 'A charming room with a water theme.', 175.00, 1, placeholder_img),
            (5, 'The Treasure Chamber', 'A room filled with golden decor.', 300.00, 1, placeholder_img),
            (6, 'The Sunken Ship', 'A unique room with a nautical theme.', 180.00, 1, placeholder_img),
            (7, 'The Island Paradise', 'A room with a tropical vibe.', 220.00, 1, placeholder_img),
            (8, 'The Buccaneer''s Bunk', 'A simple and affordable room.', 100.00, 1, placeholder_img),
            (9, 'The Siren''s Song', 'A room with a musical theme.', 190.00, 1, placeholder_img),
            (10, 'The Kraken''s Lair', 'A mysterious room with a deep sea theme.', 210.00, 1, placeholder_img)
        ]
        cursor.executemany('INSERT INTO rooms (id, name, description, price, available, image_url) VALUES (?, ?, ?, ?, ?, ?)', rooms)
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def log_interaction(ip, interaction_type, details=""):
    conn = get_db_connection()
    conn.execute(
        'INSERT INTO interaction_log (ip_address, interaction_type, details) VALUES (?, ?, ?)',
        (ip, interaction_type, str(details))
    )
    conn.commit()
    conn.close()

# Initialize the database when the application module is first imported.
init_db()

@app.before_request
def log_visitor_request():
    """Logs every incoming request, except for admin panel routes."""
    if '/admin' not in request.path:
        conn = get_db_connection()
        conn.execute(
            'INSERT INTO visitor_log (ip_address, user_agent, request_path) VALUES (?, ?, ?)',
            (request.remote_addr, request.headers.get('User-Agent'), request.path)
        )
        conn.commit()
        conn.close()

# --- Main Application Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    log_interaction(request.remote_addr, 'view_rooms', 'User requested list of rooms.')
    conn = get_db_connection()
    rooms = conn.execute('SELECT * FROM rooms').fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in rooms])

@app.route('/api/bookings', methods=['POST'])
def create_booking():
    data = request.get_json()
    log_interaction(request.remote_addr, 'create_booking_attempt', f"Payload: {data}")
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
        log_interaction(request.remote_addr, 'create_booking_failed', f"Room {room_id} not available or does not exist.")
        return jsonify({'error': 'Room not available or does not exist'}), 400

    cursor.execute('INSERT INTO bookings (room_id, guest_name, check_in_date, check_out_date) VALUES (?, ?, ?, ?)',
                   (room_id, guest_name, check_in_date, check_out_date))
    booking_id = cursor.lastrowid
    cursor.execute('UPDATE rooms SET available = 0 WHERE id = ?', (room_id,))
    conn.commit()
    conn.close()

    log_interaction(request.remote_addr, 'create_booking_success', f"Room {room_id} booked successfully. Booking ID: {booking_id}")
    return jsonify({'message': 'Booking successful', 'booking_id': booking_id}), 201

@app.route('/api/bookings', methods=['GET'])
def get_bookings():
    conn = get_db_connection()
    bookings = conn.execute('SELECT b.id, r.name as room_name, b.guest_name, b.check_in_date, b.check_out_date FROM bookings b JOIN rooms r ON b.room_id = r.id').fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in bookings])

# --- Admin Panel Routes ---
@app.route('/admin/')
def admin_panel():
    return render_template('admin/index.html')

@app.route('/api/admin/logs/visitors')
def get_visitor_logs():
    conn = get_db_connection()
    logs = conn.execute('SELECT * FROM visitor_log ORDER BY timestamp DESC LIMIT 100').fetchall()
    conn.close()
    return jsonify([dict(row) for row in logs])

@app.route('/api/admin/logs/interactions')
def get_interaction_logs():
    conn = get_db_connection()
    logs = conn.execute('SELECT * FROM interaction_log ORDER BY timestamp DESC LIMIT 100').fetchall()
    conn.close()
    return jsonify([dict(row) for row in logs])

@app.route('/api/admin/logs/bookings')
def get_admin_booking_logs():
    conn = get_db_connection()
    logs = conn.execute('''
        SELECT b.id, b.guest_name, b.check_in_date, b.check_out_date, r.name as room_name
        FROM bookings b JOIN rooms r ON b.room_id = r.id
        ORDER BY b.id DESC LIMIT 100
    ''').fetchall()
    conn.close()
    return jsonify([dict(row) for row in logs])
# --- End Admin Panel Routes ---

if __name__ == '__main__':
    app.run(debug=True, port=5001)
