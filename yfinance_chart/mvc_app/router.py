from __future__ import annotations

import time
import functools
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Any, Optional

from flask import Blueprint, current_app, jsonify, request, g, Response, make_response

from .controllers.api_controller import (
    candles_response,
    client_event_response,
    compression_search_response,
    overlays_response,
    session_state_response,
)
from .views import (
    render_compression_search_page,
    render_main_page,
    render_error_page,
    render_health_check_page,
    render_api_documentation_page,
)


# Route configuration constants
API_PREFIX = "/api"
API_VERSION = "v1"
REQUEST_TIMEOUT_WARNING_MS = 1000
CORS_ALLOWED_ORIGINS = ["*"]
CORS_ALLOWED_METHODS = ["GET", "POST", "OPTIONS", "HEAD"]
CORS_ALLOWED_HEADERS = ["Content-Type", "X-Client-Session", "X-Request-ID", "Authorization"]

# Comprehensive ticker list
_ALL_TICKERS = [
    # US Large-Cap / ETFs
    "SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "IVV", "GLD", "SLV", "USO",
    # Technology
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "TSLA", "META", "NVDA", "AVGO",
    "INTC", "AMD", "QCOM", "TXN", "MU", "AMAT", "LRCX", "KLAC", "MRVL",
    "CRM", "ORCL", "CSCO", "ADBE", "NOW", "SNOW", "PLTR", "PANW", "CRWD",
    "ZS", "OKTA", "DDOG", "NET", "MDB", "TEAM", "SHOP", "SQ", "PYPL",
    # Finance
    "JPM", "BAC", "WFC", "C", "GS", "MS", "BLK", "SCHW", "AXP", "V", "MA",
    "BRK-B", "ICE", "CME", "SPGI", "MCO", "FIS", "FISV", "TROW",
    # Healthcare
    "JNJ", "UNH", "PFE", "MRK", "ABBV", "LLY", "BMY", "AMGN", "GILD", "BIIB",
    "VRTX", "REGN", "CVS", "CI", "HUM", "MDT", "ABT", "SYK", "BSX", "ZBH",
    # Consumer
    "WMT", "AMZN", "HD", "TGT", "COST", "LOW", "MCD", "SBUX", "NKE", "PG",
    "KO", "PEP", "PM", "MO", "CL", "EL", "ULTA", "ROST", "TJX",
    # Energy
    "XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "VLO", "OXY", "PXD",
    # Industrials / Other
    "BA", "CAT", "HON", "GE", "MMM", "UPS", "FDX", "LMT", "RTX", "NOC",
    "DE", "EMR", "ETN", "PH", "ROK", "ITW", "CMI", "PCAR",
    # Telecom / Utilities
    "T", "VZ", "TMUS", "NEE", "DUK", "SO", "AEP", "D", "EXC", "XEL",
    # Real Estate
    "AMT", "PLD", "EQIX", "CCI", "SPG", "O", "VICI", "WELL",
]


def _add_cors_headers(response: Response) -> Response:
    """Add CORS headers to a response.
    
    Args:
        response: Flask response object
        
    Returns:
        Response with CORS headers added
    """
    response.headers["Access-Control-Allow-Origin"] = ", ".join(CORS_ALLOWED_ORIGINS)
    response.headers["Access-Control-Allow-Methods"] = ", ".join(CORS_ALLOWED_METHODS)
    response.headers["Access-Control-Allow-Headers"] = ", ".join(CORS_ALLOWED_HEADERS)
    response.headers["Access-Control-Max-Age"] = "86400"
    return response


def _rate_limit_key() -> str:
    """Generate a rate limit key for the current request.
    
    Returns:
        A string key combining IP and endpoint for rate limiting
    """
    return f"{request.remote_addr}:{request.endpoint}"


def rate_limit(max_requests: int = 100, window_seconds: int = 60):
    """Decorator to apply rate limiting to a route.
    
    Adds ``X-RateLimit-Limit``, ``X-RateLimit-Remaining``, and
    ``X-RateLimit-Reset`` headers to every response from the decorated view.
    
    Args:
        max_requests: Maximum requests allowed in the window
        window_seconds: Time window in seconds
        
    Returns:
        Decorated function with rate limiting
    """
    # Simple in-memory rate limiting (in production, use Redis)
    _rate_limits: dict[str, list[float]] = {}
    
    def decorator(f: Callable) -> Callable:
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            key = _rate_limit_key()
            now = time.time()
            
            if key not in _rate_limits:
                _rate_limits[key] = []
            
            # Remove old timestamps outside the current window
            window_start = now - window_seconds
            _rate_limits[key] = [ts for ts in _rate_limits[key] if ts > window_start]
            
            remaining = max_requests - len(_rate_limits[key])
            reset_ts   = int((_rate_limits[key][0] if _rate_limits[key] else now) + window_seconds)
            
            if remaining <= 0:
                resp = jsonify({
                    "error": "Rate limit exceeded",
                    "retry_after": window_seconds,
                })
                resp.status_code = 429
                resp.headers["X-RateLimit-Limit"]     = str(max_requests)
                resp.headers["X-RateLimit-Remaining"] = "0"
                resp.headers["X-RateLimit-Reset"]     = str(reset_ts)
                resp.headers["Retry-After"]           = str(window_seconds)
                return resp
            
            _rate_limits[key].append(now)
            
            result = f(*args, **kwargs)
            
            # Attach rate-limit headers to the response
            response = result if isinstance(result, Response) else make_response(result)
            response.headers.setdefault("X-RateLimit-Limit",     str(max_requests))
            response.headers.setdefault("X-RateLimit-Remaining", str(remaining - 1))
            response.headers.setdefault("X-RateLimit-Reset",     str(reset_ts))
            return response
        
        return wrapper
    return decorator


def require_json(f: Callable) -> Callable:
    """Decorator to require JSON content type for POST requests.
    
    Returns:
        Decorated function that validates JSON content type
    """
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if request.method == "POST" and not request.is_json:
            return jsonify({
                "error": "Content-Type must be application/json",
            }), 415
        return f(*args, **kwargs)
    return wrapper


def validate_params(**validators: Callable[[Any], bool]):
    """Decorator to validate query parameters.
    
    Args:
        **validators: Parameter name to validator function mapping
        
    Returns:
        Decorated function with parameter validation
    """
    def decorator(f: Callable) -> Callable:
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            for param_name, validator in validators.items():
                value = request.args.get(param_name)
                if value is not None and not validator(value):
                    return jsonify({
                        "error": f"Invalid parameter: {param_name}",
                        "value": value,
                    }), 400
            return f(*args, **kwargs)
        return wrapper
    return decorator


def create_router(base_dir: Path, data_base_dir: Path) -> Blueprint:
    """Create and configure the main router blueprint.
    
    Args:
        base_dir: Base directory containing HTML templates
        data_base_dir: Directory containing datastore files
        
    Returns:
        Configured Flask Blueprint with all routes
    """
    router = Blueprint("router", __name__)

    # Request timing and logging middleware
    @router.before_app_request
    def _start_request_timer():
        """Start timing the request and initialize request context."""
        g.start_ts = time.time()
        # Honour a client-provided request ID (alphanumeric, hyphens, underscores only),
        # or generate one server-side. Strict validation prevents log injection.
        import re as _re
        client_id = request.headers.get("X-Request-ID", "").strip()
        if client_id and _re.fullmatch(r"[\w\-]{1,64}", client_id):
            g.request_id = client_id
        else:
            g.request_id = f"{int(time.time() * 1000)}-{id(request)}"

    @router.after_app_request
    def _log_request(response: Response) -> Response:
        """Log request completion and add standard headers."""
        elapsed_ms = int((time.time() - getattr(g, "start_ts", time.time())) * 1000)
        
        # Log the request
        log_level = "warning" if elapsed_ms > REQUEST_TIMEOUT_WARNING_MS else "info"
        getattr(current_app.logger, log_level)(
            "http_request method=%s path=%s status=%s ms=%s ip=%s ua=%s request_id=%s",
            request.method,
            request.path,
            response.status_code,
            elapsed_ms,
            request.remote_addr,
            request.user_agent.string[:80] if request.user_agent else "unknown",
            getattr(g, "request_id", "unknown")[:16],
        )
        
        # Add standard response headers
        response.headers["X-Request-ID"] = getattr(g, "request_id", "unknown")
        response.headers["X-Response-Time"] = f"{elapsed_ms}ms"
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Add CORS headers for API routes
        if request.path.startswith("/api"):
            response = _add_cors_headers(response)
        
        return response

    # ========== Page Routes ==========
    
    @router.get("/")
    def home():
        """Serve the main interactive chart page."""
        return render_main_page(base_dir)

    @router.get("/compression-search")
    def compression_search_page():
        """Serve the compression database search page."""
        return render_compression_search_page(base_dir)

    @router.get("/api-docs")
    def api_docs_page():
        """Serve the API documentation page."""
        return render_api_documentation_page()

    # ========== API Routes ==========

    @router.get("/api/candles")
    @rate_limit(max_requests=100, window_seconds=60)
    def candles():
        """Get OHLCV candlestick data for a ticker.
        
        Query Parameters:
            ticker: Stock symbol (default: SPY)
            period: Data period (default: 6mo)
            interval: Data interval (default: 1d)
            
        Returns:
            JSON with candle data, count, and session hash
        """
        return candles_response()

    @router.get("/api/overlays")
    @rate_limit(max_requests=60, window_seconds=60)
    def overlays():
        """Get pattern overlays and calculus-based scoring.
        
        Query Parameters:
            ticker: Stock symbol (default: SPY)
            period: Data period (default: 6mo)
            interval: Data interval (default: 1d)
            max_patterns: Maximum patterns to return (default: 60)
            min_score: Minimum pattern score (default: 0.18)
            projection_horizon: Forecast horizon in bars (default: 24)
            
        Returns:
            JSON with overlays, calculus scores, and projections
        """
        return overlays_response()

    @router.get("/api/compression-search")
    @rate_limit(max_requests=100, window_seconds=60)
    def compression_search():
        """Search the compressed datastore manifests.
        
        Query Parameters:
            q: Search query string
            ticker: Filter by ticker symbol
            limit: Maximum results (default: 50, max: 200)
            include_preview: Include data preview (0/1)
            
        Returns:
            JSON with matching manifest records
        """
        return compression_search_response(data_base_dir)

    @router.post("/api/client-event")
    @require_json
    @rate_limit(max_requests=200, window_seconds=60)
    def client_event():
        """Log a client-side event for analytics.
        
        Request Body (JSON):
            event: Event name
            ...additional event data
            
        Returns:
            JSON with confirmation and session state
        """
        return client_event_response()

    @router.get("/api/session-state")
    @rate_limit(max_requests=100, window_seconds=60)
    def session_state():
        """Get current session state information.
        
        Returns:
            JSON with session hash and state data
        """
        return session_state_response()

    @router.get("/api/tickers")
    @rate_limit(max_requests=50, window_seconds=60)
    def get_tickers():
        """Get list of supported stock tickers.
        
        Query Parameters:
            search: Filter tickers by search string (case-insensitive, searches symbol and prefix)
            limit: Maximum tickers to return (default: 100, max: 500)
            
        Returns:
            JSON with list of ticker symbols
        """
        search = request.args.get("search", "").upper().strip()
        limit  = min(int(request.args.get("limit", 100)), 500)
        
        tickers = _ALL_TICKERS
        if search:
            tickers = [t for t in tickers if search in t]
        
        return jsonify({
            "count": min(len(tickers), limit),
            "tickers": tickers[:limit],
        })

    @router.get("/api/intervals")
    def get_intervals():
        """Get list of supported data intervals.
        
        Returns:
            JSON with list of intervals and their descriptions
        """
        intervals = [
            {"value": "1m", "label": "1 Minute", "intraday": True},
            {"value": "2m", "label": "2 Minutes", "intraday": True},
            {"value": "5m", "label": "5 Minutes", "intraday": True},
            {"value": "15m", "label": "15 Minutes", "intraday": True},
            {"value": "30m", "label": "30 Minutes", "intraday": True},
            {"value": "60m", "label": "60 Minutes", "intraday": True},
            {"value": "90m", "label": "90 Minutes", "intraday": True},
            {"value": "1h", "label": "1 Hour", "intraday": True},
            {"value": "1d", "label": "1 Day", "intraday": False},
            {"value": "5d", "label": "5 Days", "intraday": False},
            {"value": "1wk", "label": "1 Week", "intraday": False},
            {"value": "1mo", "label": "1 Month", "intraday": False},
            {"value": "3mo", "label": "3 Months", "intraday": False},
        ]
        resp = jsonify({"intervals": intervals})
        resp.headers["Cache-Control"] = "public, max-age=86400"
        return resp

    @router.get("/api/periods")
    def get_periods():
        """Get list of supported data periods.
        
        Returns:
            JSON with list of periods and their descriptions
        """
        periods = [
            {"value": "1d", "label": "1 Day"},
            {"value": "5d", "label": "5 Days"},
            {"value": "1mo", "label": "1 Month"},
            {"value": "3mo", "label": "3 Months"},
            {"value": "6mo", "label": "6 Months"},
            {"value": "1y", "label": "1 Year"},
            {"value": "2y", "label": "2 Years"},
            {"value": "5y", "label": "5 Years"},
            {"value": "10y", "label": "10 Years"},
            {"value": "ytd", "label": "Year to Date"},
            {"value": "max", "label": "Maximum Available"},
        ]
        resp = jsonify({"periods": periods})
        resp.headers["Cache-Control"] = "public, max-age=86400"
        return resp

    @router.get("/api/stats")
    def get_api_stats():
        """Get API usage statistics.
        
        Returns:
            JSON with API statistics
        """
        from ..models import get_session_analytics
        
        analytics = get_session_analytics()
        return jsonify({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sessions": analytics,
            "version": "2.0.0",
        })

    # ========== CORS Preflight Handling ==========
    
    @router.route("/api/<path:path>", methods=["OPTIONS"])
    def handle_preflight(path):
        """Handle CORS preflight requests for all API routes."""
        response = make_response()
        response = _add_cors_headers(response)
        return response

    # ========== Health & Monitoring Routes ==========

    @router.get("/health")
    def health():
        """Health check endpoint for monitoring.
        
        Returns:
            JSON with health status
        """
        return render_health_check_page()

    @router.get("/ready")
    def ready():
        """Readiness check endpoint for Kubernetes.
        
        Returns:
            JSON with readiness status
        """
        # Check if required resources are available
        checks = {
            "base_dir_exists": base_dir.exists(),
            "data_dir_exists": data_base_dir.exists(),
        }
        
        all_ready = all(checks.values())
        status_code = 200 if all_ready else 503
        
        return jsonify({
            "ready": all_ready,
            "checks": checks,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }), status_code

    @router.get("/live")
    def live():
        """Liveness check endpoint for Kubernetes.
        
        Returns:
            JSON with liveness status
        """
        return jsonify({
            "live": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    @router.get("/metrics")
    def metrics():
        """Prometheus-style metrics endpoint.
        
        Returns:
            Plain text metrics in Prometheus format
        """
        from ..models import get_session_analytics
        
        analytics = get_session_analytics()
        
        metrics_lines = [
            "# HELP yfinance_active_sessions Number of active sessions",
            "# TYPE yfinance_active_sessions gauge",
            f"yfinance_active_sessions {analytics.get('active_sessions', 0)}",
            "",
            "# HELP yfinance_total_events Total events logged",
            "# TYPE yfinance_total_events counter",
            f"yfinance_total_events {analytics.get('total_events_logged', 0)}",
            "",
            "# HELP yfinance_up Application health status",
            "# TYPE yfinance_up gauge",
            "yfinance_up 1",
        ]
        
        response = make_response("\n".join(metrics_lines))
        response.headers["Content-Type"] = "text/plain; charset=utf-8"
        return response

    @router.get("/version")
    def version():
        """Get API version information.
        
        Returns:
            JSON with version details
        """
        resp = jsonify({
            "version": "2.0.0",
            "api_version": API_VERSION,
            "name": "YFinance Chart API",
            "documentation": "/api-docs",
            "health_endpoint": "/health",
        })
        resp.headers["Cache-Control"] = "public, max-age=3600"
        return resp

    @router.get("/api/routes")
    def list_routes():
        """Introspection endpoint — lists all registered routes.
        
        Returns:
            JSON with all URL rules, methods, and endpoint names for this app.
        """
        from flask import current_app

        rules = []
        for rule in sorted(current_app.url_map.iter_rules(), key=lambda r: r.rule):
            rules.append({
                "path":     rule.rule,
                "methods":  sorted(m for m in rule.methods if m not in ("HEAD", "OPTIONS")),
                "endpoint": rule.endpoint,
            })
        resp = jsonify({
            "count":     len(rules),
            "routes":    rules,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        resp.headers["Cache-Control"] = "no-store"
        return resp

    return router
