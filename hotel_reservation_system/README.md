# The Grand Tortuga Inn - Reservation System

This project is a full-stack web application that provides a hotel reservation system for the fabled Grand Tortuga Inn. It was built using a Python Flask backend and a vanilla JavaScript frontend.

## Features

*   View a list of 10 unique, pirate-themed hotel rooms.
*   Book a room using a simple and intuitive form.
*   Receive an instant booking confirmation.
*   A responsive frontend using a mix of W3.CSS and Bootstrap.
*   Advanced frontend features like parallax scrolling, layout toggling (Flexbox/Grid), and animations.

## Configuration

This application uses a `.env` file for managing secrets and configuration.

1.  **Create a `.env` file:**
    Copy the example file to a new `.env` file in the `hotel_reservation_system` directory:
    ```bash
    cp .env.example .env
    ```

2.  **Set your secrets:**
    Open the `.env` file and replace the placeholder values with your actual secrets. For example:
    ```
    SECRET_KEY="a_very_long_and_secure_random_string"
    ```

## Running the Application

To run the application, follow these steps:

1.  **Install Dependencies:**
    Make sure you have Python 3 installed. Then, install the required packages using pip:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Run the Server:**
    Execute the main application script:
    ```bash
    python3 app.py
    ```
    The server will start, and the database will be automatically initialized.

3.  **Access the Application:**
    Open your web browser and navigate to the following link:
    [http://127.0.0.1:5001](http://127.0.0.1:5001)

Enjoy your stay at The Grand Tortuga Inn! 🏴‍☠️
