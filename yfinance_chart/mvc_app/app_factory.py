from __future__ import annotations

import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from flask import Flask, g, request, Response

from .router import create_router


# Configuration defaults
DEFAULT_CONFIG = {
    "DEBUG": False,
    "TESTING": False,
    "LOG_LEVEL": "INFO",
    "MAX_CONTENT_LENGTH": 16 * 1024 * 1024,  # 16MB max upload
    "JSON_SORT_KEYS": False,
    "JSONIFY_PRETTYPRINT_REGULAR": True,
    "PREFERRED_URL_SCHEME": "https",
    "SESSION_COOKIE_SECURE": True,
    "SESSION_COOKIE_HTTPONLY": True,
    "SESSION_COOKIE_SAMESITE": "Lax",
}

# Environment-specific configurations
ENVIRONMENT_CONFIGS = {
    "development": {
        "DEBUG": True,
        "LOG_LEVEL": "DEBUG",
        "SESSION_COOKIE_SECURE": False,
        "PREFERRED_URL_SCHEME": "http",
    },
    "testing": {
        "TESTING": True,
        "DEBUG": True,
        "LOG_LEVEL": "DEBUG",
        "WTF_CSRF_ENABLED": False,
    },
    "production": {
        "DEBUG": False,
        "LOG_LEVEL": "WARNING",
        "SESSION_COOKIE_SECURE": True,
    },
}


def _get_environment() -> str:
    """Determine the current environment from environment variables.
    
    Returns:
        Environment name (development, testing, or production)
    """
    env = os.environ.get("FLASK_ENV", "").lower()
    if env in ENVIRONMENT_CONFIGS:
        return env
    if os.environ.get("TESTING"):
        return "testing"
    if os.environ.get("DEBUG"):
        return "development"
    return "production"


def _configure_logging(app: Flask, log_level: str) -> None:
    """Configure application logging with structured output.
    
    Args:
        app: Flask application instance
        log_level: Logging level string (DEBUG, INFO, WARNING, ERROR)
    """
    # Remove default handlers to avoid duplicate logs
    if app.logger.handlers:
        for handler in app.logger.handlers[:]:
            app.logger.removeHandler(handler)
    
    # Create console handler with structured format
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)
    
    # Set logging level
    level = getattr(logging, log_level.upper(), logging.INFO)
    handler.setLevel(level)
    app.logger.addHandler(handler)
    app.logger.setLevel(level)
    
    # Also configure werkzeug logger in development
    if log_level.upper() == "DEBUG":
        werkzeug_logger = logging.getLogger("werkzeug")
        werkzeug_logger.setLevel(logging.INFO)


def _register_error_handlers(app: Flask) -> None:
    """Register custom error handlers for common HTTP errors.
    
    Args:
        app: Flask application instance
    """
    from .views import render_error_page
    
    @app.errorhandler(400)
    def handle_bad_request(error):
        return render_error_page(
            400,
            "Bad Request",
            "The server could not understand your request."
        )
    
    @app.errorhandler(404)
    def handle_not_found(error):
        return render_error_page(
            404,
            "Page Not Found",
            f"The requested URL '{request.path}' was not found on this server."
        )
    
    @app.errorhandler(405)
    def handle_method_not_allowed(error):
        return render_error_page(
            405,
            "Method Not Allowed",
            f"The method '{request.method}' is not allowed for this endpoint."
        )
    
    @app.errorhandler(500)
    def handle_internal_error(error):
        app.logger.error("Internal server error: %s", str(error))
        return render_error_page(
            500,
            "Internal Server Error",
            "An unexpected error occurred. Please try again later."
        )
    
    @app.errorhandler(503)
    def handle_service_unavailable(error):
        return render_error_page(
            503,
            "Service Unavailable",
            "The service is temporarily unavailable. Please try again shortly."
        )


def _register_request_hooks(app: Flask) -> None:
    """Register request lifecycle hooks for timing and logging.
    
    Args:
        app: Flask application instance
    """
    @app.before_request
    def before_request_hook():
        """Store request start time and initialize request context."""
        g.start_time = time.time()
        g.request_id = f"{int(time.time() * 1000)}-{id(request)}"
    
    @app.after_request
    def after_request_hook(response: Response) -> Response:
        """Add standard headers and log request completion."""
        # Calculate request duration
        duration_ms = int((time.time() - getattr(g, "start_time", time.time())) * 1000)
        
        # Add standard security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["X-Request-ID"] = getattr(g, "request_id", "unknown")
        response.headers["X-Response-Time"] = f"{duration_ms}ms"
        
        # Add CORS headers for API endpoints
        if request.path.startswith("/api/"):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Client-Session"
        
        return response
    
    @app.teardown_request
    def teardown_request_hook(exception: Optional[Exception] = None):
        """Log any exceptions that occurred during request processing."""
        if exception:
            app.logger.error(
                "request_exception request_id=%s error=%s",
                getattr(g, "request_id", "unknown"),
                str(exception)
            )


def _register_cli_commands(app: Flask) -> None:
    """Register custom CLI commands for the application.
    
    Args:
        app: Flask application instance
    """
    @app.cli.command("health")
    def health_command():
        """Check application health status."""
        print("Application is healthy")
        print(f"Base directory: {app.config.get('BASE_DIR')}")
        print(f"Data directory: {app.config.get('DATA_BASE_DIR')}")
    
    @app.cli.command("info")
    def info_command():
        """Display application configuration information."""
        print("YFinance Chart Application")
        print("=" * 40)
        print(f"Environment: {_get_environment()}")
        print(f"Debug mode: {app.config.get('DEBUG')}")
        print(f"Base directory: {app.config.get('BASE_DIR')}")
        print(f"Data directory: {app.config.get('DATA_BASE_DIR')}")
        print(f"Log level: {app.config.get('LOG_LEVEL')}")


def _load_config_from_env(app: Flask) -> None:
    """Load additional configuration from environment variables.
    
    Args:
        app: Flask application instance
    """
    # Load any YF_ prefixed environment variables
    for key, value in os.environ.items():
        if key.startswith("YF_"):
            config_key = key[3:]  # Remove YF_ prefix
            app.config[config_key] = value
    
    # Load specific environment variables
    if os.environ.get("SECRET_KEY"):
        app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]
    else:
        # Generate a default secret key - warn if in production
        environment = app.config.get("ENVIRONMENT", "development")
        if environment == "production":
            app.logger.warning(
                "SECRET_KEY not set in production environment. "
                "Set the SECRET_KEY environment variable for security."
            )
        # Use a random key for development/testing (changes each restart)
        import secrets
        app.config["SECRET_KEY"] = secrets.token_hex(32)


def create_app(
    base_dir: Path | None = None,
    data_base_dir: Path | None = None,
    config_overrides: dict[str, Any] | None = None
) -> Flask:
    """Create and configure the Flask application.
    
    This is the application factory function that creates a configured
    Flask app instance with all routes, error handlers, and middleware
    registered.
    
    Args:
        base_dir: Base directory for the application (contains HTML files)
        data_base_dir: Directory for the datastore (level1/level2 data)
        config_overrides: Optional dictionary of config values to override
        
    Returns:
        Configured Flask application instance
        
    Example:
        >>> from mvc_app import create_app
        >>> app = create_app()
        >>> app.run(debug=True)
    """
    # Resolve directory paths
    resolved_base_dir = (base_dir or Path(__file__).resolve().parents[1]).resolve()
    resolved_data_base = (data_base_dir or resolved_base_dir.parent / "github_data").resolve()

    # Create Flask app
    app = Flask(__name__)
    
    # Apply default configuration
    app.config.update(DEFAULT_CONFIG)
    
    # Apply environment-specific configuration
    environment = _get_environment()
    env_config = ENVIRONMENT_CONFIGS.get(environment, {})
    app.config.update(env_config)
    
    # Store directory paths in config
    app.config["BASE_DIR"] = str(resolved_base_dir)
    app.config["DATA_BASE_DIR"] = str(resolved_data_base)
    app.config["ENVIRONMENT"] = environment
    
    # Load configuration from environment variables
    _load_config_from_env(app)
    
    # Apply any config overrides
    if config_overrides:
        app.config.update(config_overrides)

    # Configure logging
    log_level = app.config.get("LOG_LEVEL", "INFO")
    _configure_logging(app, log_level)

    # Register error handlers
    _register_error_handlers(app)
    
    # Register request lifecycle hooks
    _register_request_hooks(app)
    
    # Register CLI commands
    _register_cli_commands(app)

    # Create and register routes
    router = create_router(base_dir=resolved_base_dir, data_base_dir=resolved_data_base)
    app.register_blueprint(router)

    # Log application startup
    app.logger.info(
        "app_start environment=%s base_dir=%s data_base_dir=%s",
        environment,
        resolved_base_dir,
        resolved_data_base
    )
    
    return app


def create_test_app(
    base_dir: Path | None = None,
    data_base_dir: Path | None = None
) -> Flask:
    """Create a Flask app configured for testing.
    
    This is a convenience function that creates an app with testing-specific
    configuration applied.
    
    Args:
        base_dir: Base directory for the application
        data_base_dir: Directory for the datastore
        
    Returns:
        Flask application configured for testing
    """
    return create_app(
        base_dir=base_dir,
        data_base_dir=data_base_dir,
        config_overrides={
            "TESTING": True,
            "DEBUG": True,
            "WTF_CSRF_ENABLED": False,
        }
    )


def create_production_app(
    base_dir: Path | None = None,
    data_base_dir: Path | None = None
) -> Flask:
    """Create a Flask app configured for production.
    
    This is a convenience function that creates an app with production-specific
    configuration and security settings applied.
    
    Args:
        base_dir: Base directory for the application
        data_base_dir: Directory for the datastore
        
    Returns:
        Flask application configured for production
    """
    return create_app(
        base_dir=base_dir,
        data_base_dir=data_base_dir,
        config_overrides={
            "DEBUG": False,
            "TESTING": False,
            "SESSION_COOKIE_SECURE": True,
            "SESSION_COOKIE_HTTPONLY": True,
            "PREFERRED_URL_SCHEME": "https",
        }
    )
