# chaturbate_app/shared/logger.py

"""
Logging Setup for the Chaturbate Enhanced Overlay Application.

This module provides a centralized logging configuration, ensuring consistent
log formatting and output across the application.
"""

import logging
import sys
from .config import LOG_LEVEL, LOG_FILE_PATH, APP_NAME, DEBUG_MODE

def setup_logger():
    """
    Configures and returns a logger instance.
    """
    numeric_level = getattr(logging, LOG_LEVEL.upper(), None)
    if not isinstance(numeric_level, int):
        raise ValueError(f"Invalid log level: {LOG_LEVEL}")

    logger = logging.getLogger(APP_NAME)
    logger.setLevel(numeric_level)

    # Prevent duplicate handlers if logger is already configured
    if logger.hasHandlers():
        logger.handlers.clear()

    # Define log format
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(module)s.%(funcName)s:%(lineno)d - %(message)s"
    )

    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File Handler (optional)
    if LOG_FILE_PATH:
        try:
            file_handler = logging.FileHandler(LOG_FILE_PATH, mode='a')
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
            logger.info(f"Logging to file: {LOG_FILE_PATH}")
        except Exception as e:
            logger.error(f"Failed to set up file logger at {LOG_FILE_PATH}: {e}", exc_info=True)


    if DEBUG_MODE:
        logger.info("Logger configured in DEBUG mode.")
    else:
        logger.info(f"Logger configured with level {LOG_LEVEL}.")

    return logger

# Initialize and export the logger instance
log = setup_logger()

if __name__ == "__main__":
    # Example usage for testing the logger setup
    log.debug("This is a debug message.")
    log.info("This is an info message.")
    log.warning("This is a warning message.")
    log.error("This is an error message.")
    log.critical("This is a critical message.")

    try:
        1 / 0
    except ZeroDivisionError:
        log.error("A handled exception occurred.", exc_info=True) # exc_info=True logs stack trace

    log.info(f"Logger name: {log.name}")
    log.info(f"Logger level: {logging.getLevelName(log.level)}")
    log.info(f"Logger handlers: {log.handlers}")
