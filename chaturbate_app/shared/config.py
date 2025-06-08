# chaturbate_app/shared/config.py

"""
Configuration Settings for the Chaturbate Enhanced Overlay Application.

This module centralizes all configuration variables, making them easily
accessible and manageable. Settings might include API keys, default values,
or paths to resources.
"""

# General Application Settings
APP_TITLE = "Chaturbate Overlay Control Panel"
DEBUG_MODE = True  # Set to False in production

# API Settings (Placeholders - replace with actual secure handling)
CHATURBATE_API_URL = "https://api.chaturbate.com/..." # Fictional API URL
CHATURBATE_USERNAME = "your_username"
CHATURBATE_API_TOKEN = "your_api_token" # Store securely, e.g., via environment variables

# Overlay Settings
DEFAULT_OVERLAY_BACKGROUND_COLOR = "rgba(0, 0, 0, 0.5)"
MAX_TIP_MENU_ITEMS = 10

# Event Handling Settings
MINIMUM_TIP_AMOUNT_FOR_ALERT = 100  # e.g., 100 tokens
WELCOME_NEW_FOLLOWERS = True
NEW_FOLLOWER_MESSAGE = "Thanks for the follow, {username}!"

# Logging Configuration
LOG_LEVEL = "INFO"  # Options: DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_FILE_PATH = "app.log" # Set to None to disable file logging

# --- Helper function to load config from environment variables or a file ---
# (This is a more advanced setup, for now, we use direct assignments)
def load_config():
    """
    Placeholder for a function that could load configuration
    from environment variables, a .env file, or a config file (e.g., JSON, YAML).
    """
    # Example:
    # import os
    # CHATURBATE_USERNAME = os.getenv("CB_USERNAME", CHATURBATE_USERNAME)
    # CHATURBATE_API_TOKEN = os.getenv("CB_API_TOKEN", CHATURBATE_API_TOKEN)
    print("Configuration loaded/initialized.")

# Initialize or load configuration when this module is imported
if __name__ == "__main__":
    # This block can be used for testing the config module directly
    print("Displaying current configuration:")
    print(f"  App Title: {APP_TITLE}")
    print(f"  Debug Mode: {DEBUG_MODE}")
    print(f"  Chaturbate Username: {CHATURBATE_USERNAME}")
    print(f"  Log Level: {LOG_LEVEL}")
else:
    load_config() # Or simply rely on the direct assignments above for now.
