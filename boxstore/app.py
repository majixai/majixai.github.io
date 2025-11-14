from flask import Flask, jsonify, request
import sqlite3
from flask_cors import CORS
import math

app = Flask(__name__)
CORS(app)

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect('boxstore/data/products.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/products')
def get_products():
    """
    API endpoint to get a paginated, searchable, and sortable list of products.
    Query Parameters:
    - page: The page number to retrieve (default: 1).
    - limit: The number of products per page (default: 20).
    - search: A search term to filter products by title or description.
    - sort_by: The column to sort by ('title' or 'price', default: 'title').
    - order: The sort order ('asc' or 'desc', default: 'asc').
    """
    # --- 1. Get and Validate Query Parameters ---
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid 'page' or 'limit' parameter. Must be an integer."}), 400

    search_term = request.args.get('search', '', type=str)
    sort_by = request.args.get('sort_by', 'title', type=str)
    order = request.args.get('order', 'asc', type=str).lower()

    # --- 2. Sanitize Inputs to Prevent SQL Injection ---
    # Whitelist the allowed columns for sorting
    allowed_sort_columns = ['title', 'price']
    if sort_by not in allowed_sort_columns:
        sort_by = 'title'  # Default to a safe column if the input is invalid

    # Ensure order is either 'asc' or 'desc'
    if order not in ['asc', 'desc']:
        order = 'asc'

    offset = (page - 1) * limit
    conn = get_db_connection()

    # --- 3. Build SQL Query Dynamically ---
    base_query = 'FROM products'
    where_clauses = []
    # Use named parameters for safe query construction
    params = {}

    if search_term:
        # Add a WHERE clause for searching title and description
        where_clauses.append('(title LIKE :search OR description LIKE :search)')
        params['search'] = f'%{search_term}%'

    if where_clauses:
        base_query += ' WHERE ' + ' AND '.join(where_clauses)

    # --- 4. Execute Count Query for Pagination Metadata ---
    try:
        count_query = 'SELECT COUNT(*) ' + base_query
        total_products = conn.execute(count_query, params).fetchone()[0]
        total_pages = math.ceil(total_products / limit) if limit > 0 else 0
    except sqlite3.Error as e:
        return jsonify({"error": f"Database error during count: {e}"}), 500

    # --- 5. Build and Execute Data Query ---
    # The 'price' column is stored as a string (e.g., "49.99 USD").
    # We must cast it to a number for correct numerical sorting.
    # The CASE statement handles potential malformed data gracefully.
    if sort_by == 'price':
        order_clause = f"ORDER BY CASE WHEN price LIKE '%USD' THEN CAST(REPLACE(price, ' USD', '') AS REAL) ELSE 999999 END {order}"
    else:
        # Safely use the validated `sort_by` column
        order_clause = f'ORDER BY "{sort_by}" {order}'

    data_query = f'SELECT * {base_query} {order_clause} LIMIT :limit OFFSET :offset'

    # Add pagination parameters to the dictionary for the final query
    params['limit'] = limit
    params['offset'] = offset

    try:
        products_cursor = conn.execute(data_query, params)
        products = products_cursor.fetchall()
    except sqlite3.Error as e:
        return jsonify({"error": f"Database error during data fetch: {e}"}), 500
    finally:
        conn.close()

    # --- 6. Format and Return the JSON Response ---
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
    # Running in debug mode is not recommended for production
    app.run(debug=True, port=5000)
