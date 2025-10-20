from flask import Flask, jsonify, render_template
from src.property import Property  # Assuming property.py is in the src directory

app = Flask(__name__, template_folder='templates', static_folder='static')

# In-memory data store
properties_db = [
    Property("789 Pine St", 600000, "Residential"),
    Property("101 Maple Dr", 900000, "Commercial"),
    Property("212 Birch Rd", 450000, "Residential")
]

# Object mapping function
def property_to_dict(prop):
    return {
        "address": prop.address,
        "price": prop.get_price(),
        "type": prop.get_property_type()
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/properties')
def get_properties():
    properties_json = [property_to_dict(p) for p in properties_db]
    return jsonify(properties_json)

if __name__ == '__main__':
    app.run(debug=True, port=5001)