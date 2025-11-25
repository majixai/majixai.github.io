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
        "SELECT p.id, p.title, p.price, ci.quantity FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.user_id = ?",
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
    existing_item = conn.execute("SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?", (user_id, product_id)).fetchone()
    if existing_item:
        new_quantity = existing_item['quantity'] + quantity
        conn.execute("UPDATE cart_items SET quantity = ? WHERE id = ?", (new_quantity, existing_item['id']))
    else:
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

# --- Checkout and Order History API ---
@app.route('/api/checkout', methods=['POST'])
@jwt_required()
def checkout():
    """Creates an order from the user's cart and clears the cart."""
    user_id = get_jwt_identity()
    data = request.get_json()
    shipping_address = data.get('shipping_address')
    if not shipping_address:
        return jsonify({"error": "Shipping address is required"}), 400

    conn = get_db_connection()
    cart_items = conn.execute("SELECT p.id, p.price, ci.quantity FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.user_id = ?", (user_id,)).fetchall()

    if not cart_items:
        return jsonify({"error": "Cart is empty"}), 400

    total_price = sum(float(item['price'].replace(' USD', '')) * item['quantity'] for item in cart_items)

    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO orders (user_id, total_price, shipping_address) VALUES (?, ?, ?)", (user_id, total_price, shipping_address))
        order_id = cursor.lastrowid

        for item in cart_items:
            price = float(item['price'].replace(' USD', ''))
            cursor.execute("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)", (order_id, item['id'], item['quantity'], price))

        conn.execute("DELETE FROM cart_items WHERE user_id = ?", (user_id,))
        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"error": f"Database error during checkout: {e}"}), 500
    finally:
        conn.close()

    return jsonify({"message": "Checkout successful", "order_id": order_id}), 201

@app.route('/api/orders', methods=['GET'])
@jwt_required()
def get_orders():
    """Retrieves the order history for the authenticated user."""
    user_id = get_jwt_identity()
    conn = get_db_connection()
    orders = conn.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC", (user_id,)).fetchall()

    orders_list = []
    for order in orders:
        order_dict = dict(order)
        order_items = conn.execute("SELECT p.title, oi.quantity, oi.price FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?", (order['id'],)).fetchall()
        order_dict['items'] = [dict(ix) for ix in order_items]
        orders_list.append(order_dict)

    conn.close()
    return jsonify(orders_list)

# --- Product API ---
@app.route('/api/products')
def get_products():
    """API endpoint for products with pagination, search, and sort."""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    search_term = request.args.get('search', '', type=str)
    sort_by = request.args.get('sort_by', 'title', type=str)
    order = request.args.get('order', 'asc', type=str).lower()

    allowed_sort_columns = ['title', 'price']
    sort_by = sort_by if sort_by in allowed_sort_columns else 'title'
    order = order if order in ['asc', 'desc'] else 'asc'
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

    count_query = 'SELECT COUNT(*) ' + base_query
    total_products = conn.execute(count_query, params).fetchone()[0]
    total_pages = math.ceil(total_products / limit)

    order_clause = f'ORDER BY "{sort_by}" {order}'
    if sort_by == 'price':
        order_clause = f"ORDER BY CAST(REPLACE(price, ' USD', '') AS REAL) {order}"

    data_query = f'SELECT * {base_query} {order_clause} LIMIT :limit OFFSET :offset'
    params.update({'limit': limit, 'offset': offset})

    products = conn.execute(data_query, params).fetchall()
    conn.close()

    return jsonify({
        'products': [dict(ix) for ix in products],
        'pagination': {
            'total_products': total_products,
            'total_pages': total_pages,
            'current_page': page,
            'limit': limit,
        }
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
