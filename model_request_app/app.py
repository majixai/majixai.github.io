import os
import asyncio
from functools import wraps
from flask import Flask, request, render_template, jsonify
from flask_compress import Compress
from file_manager import FileManager
from model_request import ModelRequest

# Configuration
UPLOAD_FOLDER = 'model_request_app/uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'mp4'}
SECRET_KEY = 'supersecretkey'

# Bitwise flags for permissions
PERM_READ = 1 << 0  # 1
PERM_WRITE = 1 << 1 # 2
PERM_EXEC = 1 << 2  # 4

# Simulate a user's permissions
user_permissions = PERM_READ | PERM_WRITE

app = Flask(__name__)
app.config.from_mapping(
    UPLOAD_FOLDER=UPLOAD_FOLDER,
    SECRET_KEY=SECRET_KEY
)
Compress(app)

file_manager = FileManager(app.config['UPLOAD_FOLDER'], ALLOWED_EXTENSIONS)

def log_request(f):
    """A decorator to log requests."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        print(f"Request: {request.method} {request.path}")
        return f(*args, **kwargs)
    return decorated_function

@app.route('/', methods=['GET', 'POST'])
@log_request
def upload_file():
    if request.method == 'POST':
        if not (user_permissions & PERM_WRITE):
            return jsonify({"success": False, "message": "You do not have permission to upload files."})

        if 'file' not in request.files:
            return jsonify({"success": False, "message": "No file part"})

        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "message": "No selected file"})

        name = request.form.get('name')
        email = request.form.get('email')
        project_description = request.form.get('project_description')

        if not all([name, email, project_description]):
            return jsonify({"success": False, "message": "All fields are required."})

        saved_filename = file_manager.save(file)
        if saved_filename:
            model_request = ModelRequest(name, email, project_description, saved_filename)
            print(f"Created new model request: {model_request.to_dict()}")
            return jsonify({"success": True, "message": "File successfully uploaded"})
        else:
            return jsonify({"success": False, "message": "Invalid file type"})

    return render_template('index.html')

@app.route('/files')
@log_request
def list_files():
    """An endpoint to list uploaded files, demonstrating generators."""
    if not (user_permissions & PERM_READ):
        return jsonify({"error": "You do not have permission to view files."}), 403

    # Using the generator from file_manager.list()
    files_generator = file_manager.list()
    return jsonify(list(files_generator))

@app.route('/async-task')
@log_request
async def async_task():
    """
    An endpoint to demonstrate asynchronous operations.
    Note: For this to be truly non-blocking in a production environment,
    you would need to run Flask with an ASGI server like Gunicorn and a
    Uvicorn worker. The built-in Flask development server will still
    block on this route. This is for demonstration purposes only.
    """
    print("Starting async task...")
    await asyncio.sleep(2)  # Simulate a non-blocking I/O operation
    print("Async task finished.")
    return jsonify({"message": "Asynchronous task completed successfully!"})

@app.route('/permissions')
@log_request
def check_permissions():
    """An endpoint to demonstrate bitwise operations."""
    can_read = "Yes" if user_permissions & PERM_READ else "No"
    can_write = "Yes" if user_permissions & PERM_WRITE else "No"
    can_execute = "Yes" if user_permissions & PERM_EXEC else "No"

    return jsonify({
        "permissions": bin(user_permissions),
        "can_read": can_read,
        "can_write": can_write,
        "can_execute": can_execute
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001)