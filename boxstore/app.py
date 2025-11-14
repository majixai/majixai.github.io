from flask import Flask, jsonify, request
import sqlite3
from flask_cors import CORS
import math
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, JWTManager

app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = "super-secret-key-change-in-production"  # Change this in production!
jwt = JWTManager(app)
CORS(app)

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect('boxstore/data/products.db')
    conn.row_factory = sqlite3.Row
    return conn

# --- User Authentication API ---

@app.route('/api/register', methods=['POST'])
def register():
    """Registers a new user."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    hashed_password = generate_password_hash(password)

    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 409
    finally:
        conn.close()

    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    """Logs in a user and returns a JWT."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()

    if user and check_password_hash(user['password'], password):
        access_token = create_access_token(identity=str(user['id']))
        return jsonify(access_token=access_token)

    return jsonify({"error": "Invalid credentials"}), 401

# --- Cart API ---

@app.route('/api/cart', methods=['GET'])
@jwt_required()
def get_cart():
    """Gets the contents of the user's cart."""
    user_id = get_jwt_identity()
    conn = get_db_connection()
    cart_items = conn.execute(
        "SELECT p.id, p.title, p.price, p.description, p.brand, p.color, p.size, ci.quantity FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.user_id = ?",
        (user_id,)
    ).fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in cart_items])

@app.route('/api/cart', methods=['POST'])
@jwt_required()
def add_to_cart():
    """Adds an item to the user's cart."""
    user_id = get_jwt_identity()
    data = request.get_json()
    product_id = data.get('product_id')
    quantity = data.get('quantity', 1)

    if not product_id:
        return jsonify({"error": "Product ID is required"}), 400

    conn = get_db_connection()
    # Check if the item is already in the cart
    existing_item = conn.execute("SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?", (user_id, product_id)).fetchone()
    if existing_item:
        # If it exists, update the quantity
        new_quantity = existing_item['quantity'] + quantity
        conn.execute("UPDATE cart_items SET quantity = ? WHERE id = ?", (new_quantity, existing_item['id']))
    else:
        # If it's a new item, insert it
        conn.execute("INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)", (user_id, product_id, quantity))
    conn.commit()
    conn.close()

    return jsonify({"message": "Item added to cart"}), 200

@app.route('/api/cart/<product_id>', methods=['DELETE'])
@jwt_required()
def remove_from_cart(product_id):
    """Removes an item from the user's cart."""
    user_id = get_jwt_identity()
    conn = get_db_connection()
    conn.execute("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", (user_id, product_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "Item removed from cart"}), 200

# --- Product API ---
@app.route('/api/products')
def get_products():
    """
    API endpoint to get a paginated, searchable, and sortable list of products.
    """
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid 'page' or 'limit' parameter. Must be an integer."}), 400

    search_term = request.args.get('search', '', type=str)
    sort_by = request.args.get('sort_by', 'title', type=str)
    order = request.args.get('order', 'asc', type=str).lower()

    allowed_sort_columns = ['title', 'price']
    if sort_by not in allowed_sort_columns:
        sort_by = 'title'

    if order not in ['asc', 'desc']:
        order = 'asc'

    offset = (page - 1) * limit
    conn = get_db_connection()

    base_query = 'FROM products'
    where_clauses = []
    params = {}

    if search_term:
        where_clauses.append('(title LIKE :search OR description LIKE :search)')
        params['search'] = f'%{search_term}%'

    if where_clauses:
        base_query += ' WHERE ' + ' AND '.join(where_clauses)

    try:
        count_query = 'SELECT COUNT(*) ' + base_query
        total_products = conn.execute(count_query, params).fetchone()[0]
        total_pages = math.ceil(total_products / limit) if limit > 0 else 0
    except sqlite3.Error as e:
        return jsonify({"error": f"Database error during count: {e}"}), 500

    if sort_by == 'price':
        order_clause = f"ORDER BY CASE WHEN price LIKE '%USD' THEN CAST(REPLACE(price, ' USD', '') AS REAL) ELSE 999999 END {order}"
    else:
        order_clause = f'ORDER BY "{sort_by}" {order}'

    data_query = f'SELECT * {base_query} {order_clause} LIMIT :limit OFFSET :offset'

    params['limit'] = limit
    params['offset'] = offset

    try:
        products_cursor = conn.execute(data_query, params)
        products = products_cursor.fetchall()
    except sqlite3.Error as e:
        return jsonify({"error": f"Database error during data fetch: {e}"}), 500
    finally:
        conn.close()

    response_data = {
        'products': [dict(ix) for ix in products],
        'pagination': {
            'total_products': total_products,
            'total_pages': total_pages,
            'current_page': page,
            'limit': limit,
            'has_next': page < total_pages,
            'has_prev': page > 1,
        }
    }

    return jsonify(response_data)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
