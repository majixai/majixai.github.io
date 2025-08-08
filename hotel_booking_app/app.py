
from flask import Flask, request, jsonify, render_template

import time
import threading
import sqlite3


app = Flask(__name__)

# In-memory SQLite3 DB setup
def get_db():
    if not hasattr(app, 'db_conn'):
        app.db_conn = sqlite3.connect(':memory:', check_same_thread=False)
        c = app.db_conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_name TEXT,
            check_in TEXT,
            check_out TEXT,
            room_count INTEGER,
            room_type TEXT,
            hotel_name TEXT,
            hotel_address TEXT,
            payment_status TEXT
        )''')
        app.db_conn.commit()
    return app.db_conn

# Synchronous Rate Limiter
class RateLimiter:
    def __init__(self, calls_per_minute):
        self.calls_per_minute = calls_per_minute
        self.lock = threading.Lock()
        self.calls = []

    def __call__(self, func):
        def wrapper(*args, **kwargs):
            with self.lock:
                now = time.time()
                # Remove calls older than 60 seconds
                self.calls = [t for t in self.calls if now - t < 60]
                if len(self.calls) >= self.calls_per_minute:
                    return jsonify({'error': 'Rate limit exceeded'}), 429
                self.calls.append(now)
            return func(*args, **kwargs)
        return wrapper

# Example GenAI function (mocked)
def generate_ai_response(prompt):
    # Simulate AI response
    return f"AI says: {prompt[::-1]}"

@app.route('/genai', methods=['POST'])
@RateLimiter(5)  # 5 calls per minute
def genai():
    data = request.get_json()
    prompt = data.get('prompt', '')
    # Simulate processing delay
    time.sleep(0.5)
    response = generate_ai_response(prompt)
    return jsonify({'response': response})


# API: Add booking (from frontend)
@app.route('/api/book', methods=['POST'])
def api_book():
    data = request.get_json()
    db = get_db()
    c = db.cursor()
    c.execute('''INSERT INTO bookings (guest_name, check_in, check_out, room_count, room_type, hotel_name, hotel_address, payment_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', (
        data.get('guestName'), data.get('checkIn'), data.get('checkOut'),
        data.get('roomCount'), data.get('roomType'),
        data.get('hotelName'), data.get('hotelAddress'), data.get('paymentStatus', 'pending')
    ))
    db.commit()
    return jsonify({'status': 'ok', 'id': c.lastrowid})

# API: Get all bookings
@app.route('/api/bookings')
def api_bookings():
    db = get_db()
    c = db.cursor()
    c.execute('SELECT * FROM bookings')
    rows = c.fetchall()
    keys = ['id', 'guestName', 'checkIn', 'checkOut', 'roomCount', 'roomType', 'hotelName', 'hotelAddress', 'paymentStatus']
    bookings = [dict(zip(keys, row)) for row in rows]
    return jsonify(bookings)

# Main page
@app.route('/')
def index():
    # Google Maps/Pay keys can be set via env or config
    return render_template('hotel_booking.html',
        google_maps_api_key='YOUR_GOOGLE_MAPS_API_KEY',
        google_pay_merchant_id='YOUR_GOOGLE_PAY_MERCHANT_ID')

if __name__ == '__main__':
    app.run(debug=True)
