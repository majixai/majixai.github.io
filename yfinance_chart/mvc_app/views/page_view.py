from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from flask import Response, make_response, render_template_string, send_file


# Page metadata constants
PAGE_METADATA = {
    "main": {
        "title": "YFinance Interactive Chart",
        "description": "Interactive stock chart with pattern detection and Bayesian forecasting",
        "keywords": "stock, chart, yfinance, pattern detection, technical analysis",
        "author": "Majixai Development Team",
    },
    "compression_search": {
        "title": "Compression Database Search",
        "description": "Search and explore compressed datastore manifests",
        "keywords": "datastore, compression, search, manifest, data pipeline",
        "author": "Majixai Development Team",
    },
    "api_docs": {
        "title": "API Documentation",
        "description": "YFinance Chart API reference documentation",
        "keywords": "API, documentation, endpoints, reference",
        "author": "Majixai Development Team",
    },
}

# Cache control settings for different page types
CACHE_SETTINGS = {
    "html": {"max_age": 300, "cache_control": "public, max-age=300"},
    "static": {"max_age": 3600, "cache_control": "public, max-age=3600"},
    "api_docs": {"max_age": 600, "cache_control": "public, max-age=600"},
    "no_cache": {"max_age": 0, "cache_control": "no-store, no-cache, must-revalidate"},
}


def _apply_cache_headers(response: Response, cache_type: str = "html") -> Response:
    """Apply appropriate cache headers to the response.
    
    Args:
        response: Flask response object to modify
        cache_type: Type of caching to apply (html, static, api_docs, no_cache)
        
    Returns:
        Modified response with cache headers
    """
    settings = CACHE_SETTINGS.get(cache_type, CACHE_SETTINGS["html"])
    response.headers["Cache-Control"] = settings["cache_control"]
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    return response


def _add_page_metadata(response: Response, page_type: str) -> Response:
    """Add page metadata headers for SEO and debugging.
    
    Args:
        response: Flask response object to modify
        page_type: Type of page (main, compression_search, api_docs)
        
    Returns:
        Modified response with metadata headers
    """
    metadata = PAGE_METADATA.get(page_type, PAGE_METADATA["main"])
    response.headers["X-Page-Title"] = metadata["title"]
    response.headers["X-Page-Author"] = metadata["author"]
    response.headers["X-Generated-At"] = datetime.now().isoformat()
    return response


def render_main_page(base_dir: Path) -> Response:
    """Render the main interactive chart page.
    
    Serves the simple_interactive_view.html file with appropriate
    headers for caching and security.
    
    Args:
        base_dir: Base directory containing the HTML files
        
    Returns:
        Flask response serving the main page HTML
    """
    file_path = base_dir / "simple_interactive_view.html"
    response = make_response(send_file(file_path))
    response = _apply_cache_headers(response, "html")
    response = _add_page_metadata(response, "main")
    return response


def render_compression_search_page(base_dir: Path) -> Response:
    """Render the compression database search page.
    
    Serves the compression_db_search.html file with appropriate
    headers for caching and security.
    
    Args:
        base_dir: Base directory containing the HTML files
        
    Returns:
        Flask response serving the compression search page HTML
    """
    file_path = base_dir / "compression_db_search.html"
    response = make_response(send_file(file_path))
    response = _apply_cache_headers(response, "html")
    response = _add_page_metadata(response, "compression_search")
    return response


def render_error_page(
    error_code: int,
    error_message: str,
    error_details: Optional[str] = None
) -> Response:
    """Render a custom error page.
    
    Generates an HTML error page with consistent styling and
    helpful information for debugging.
    
    Args:
        error_code: HTTP error code (e.g., 404, 500)
        error_message: Short error message
        error_details: Optional detailed error information
        
    Returns:
        Flask response with error page HTML
    """
    error_template = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error {{ error_code }} - YFinance Chart</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #e2e8f0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0;
                padding: 20px;
            }
            .error-container {
                text-align: center;
                max-width: 600px;
                padding: 40px;
                background: rgba(30, 41, 59, 0.8);
                border-radius: 16px;
                border: 1px solid rgba(148, 163, 184, 0.2);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            }
            .error-code {
                font-size: 6rem;
                font-weight: 700;
                color: #ef4444;
                margin: 0;
                line-height: 1;
            }
            .error-message {
                font-size: 1.5rem;
                color: #94a3b8;
                margin: 20px 0;
            }
            .error-details {
                font-family: monospace;
                font-size: 0.875rem;
                color: #64748b;
                background: rgba(0, 0, 0, 0.3);
                padding: 15px;
                border-radius: 8px;
                text-align: left;
                overflow-x: auto;
            }
            .back-button {
                display: inline-block;
                margin-top: 30px;
                padding: 12px 24px;
                background: #3b82f6;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 500;
                transition: background 0.2s;
            }
            .back-button:hover {
                background: #2563eb;
            }
        </style>
    </head>
    <body>
        <div class="error-container">
            <p class="error-code">{{ error_code }}</p>
            <p class="error-message">{{ error_message }}</p>
            {% if error_details %}
            <pre class="error-details">{{ error_details }}</pre>
            {% endif %}
            <a href="/" class="back-button">Return to Home</a>
        </div>
    </body>
    </html>
    """
    html_content = render_template_string(
        error_template,
        error_code=error_code,
        error_message=error_message,
        error_details=error_details
    )
    response = make_response(html_content, error_code)
    response = _apply_cache_headers(response, "no_cache")
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    return response


def render_json_response(
    data: dict[str, Any],
    status_code: int = 200,
    cache_type: str = "no_cache"
) -> Response:
    """Render a JSON response with appropriate headers.
    
    Creates a JSON response with proper content type and
    optional caching headers.
    
    Args:
        data: Dictionary to serialize as JSON
        status_code: HTTP status code
        cache_type: Type of caching to apply
        
    Returns:
        Flask response with JSON content
    """
    response = make_response(json.dumps(data, indent=2), status_code)
    response.headers["Content-Type"] = "application/json; charset=utf-8"
    response = _apply_cache_headers(response, cache_type)
    return response


def render_health_check_page() -> Response:
    """Render a simple health check response.
    
    Returns a minimal JSON response indicating the service
    is healthy, with no caching.
    
    Returns:
        Flask response with health status JSON
    """
    health_data = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "yfinance-chart",
        "version": "2.0.0",
    }
    return render_json_response(health_data, cache_type="no_cache")


def render_api_documentation_page() -> Response:
    """Render API documentation page.
    
    Generates a dynamically rendered HTML page documenting
    all available API endpoints and their usage.
    
    Returns:
        Flask response with API documentation HTML
    """
    api_docs_template = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>API Documentation - YFinance Chart</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #0f172a;
                color: #e2e8f0;
                margin: 0;
                padding: 40px;
                line-height: 1.6;
            }
            .container {
                max-width: 1000px;
                margin: 0 auto;
            }
            h1 {
                color: #3b82f6;
                border-bottom: 2px solid #1e293b;
                padding-bottom: 15px;
            }
            h2 {
                color: #22c55e;
                margin-top: 40px;
            }
            .endpoint {
                background: #1e293b;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                border-left: 4px solid #3b82f6;
            }
            .method {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 4px;
                font-weight: 600;
                font-size: 0.875rem;
            }
            .get { background: #22c55e; color: white; }
            .post { background: #3b82f6; color: white; }
            .path {
                font-family: monospace;
                font-size: 1.1rem;
                color: #f8fafc;
                margin-left: 10px;
            }
            .description {
                margin: 15px 0;
                color: #94a3b8;
            }
            .params {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 8px;
                padding: 15px;
                margin-top: 15px;
            }
            .param-name {
                color: #fbbf24;
                font-family: monospace;
            }
            code {
                background: rgba(59, 130, 246, 0.2);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.9em;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>YFinance Chart API Documentation</h1>
            <p>This API provides access to stock data, pattern detection, and forecasting capabilities.</p>
            
            <h2>Endpoints</h2>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/candles</span>
                <p class="description">Fetch OHLCV candlestick data for a stock ticker.</p>
                <div class="params">
                    <p><span class="param-name">ticker</span> - Stock symbol (default: SPY)</p>
                    <p><span class="param-name">period</span> - Data period (default: 6mo)</p>
                    <p><span class="param-name">interval</span> - Data interval (default: 1d)</p>
                </div>
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/overlays</span>
                <p class="description">Get pattern overlays and calculus-based scoring.</p>
                <div class="params">
                    <p><span class="param-name">ticker</span> - Stock symbol (default: SPY)</p>
                    <p><span class="param-name">period</span> - Data period (default: 6mo)</p>
                    <p><span class="param-name">interval</span> - Data interval (default: 1d)</p>
                    <p><span class="param-name">max_patterns</span> - Maximum patterns to return (default: 60)</p>
                    <p><span class="param-name">min_score</span> - Minimum pattern score (default: 0.18)</p>
                    <p><span class="param-name">projection_horizon</span> - Forecast horizon bars (default: 24)</p>
                </div>
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/compression-search</span>
                <p class="description">Search the compressed datastore manifests.</p>
                <div class="params">
                    <p><span class="param-name">q</span> - Search query string</p>
                    <p><span class="param-name">ticker</span> - Filter by ticker symbol</p>
                    <p><span class="param-name">limit</span> - Maximum results (default: 50, max: 200)</p>
                    <p><span class="param-name">include_preview</span> - Include data preview (0/1)</p>
                </div>
            </div>
            
            <div class="endpoint">
                <span class="method post">POST</span>
                <span class="path">/api/client-event</span>
                <p class="description">Log a client-side event for analytics.</p>
                <div class="params">
                    <p><span class="param-name">event</span> - Event name (in JSON body)</p>
                    <p><span class="param-name">...payload</span> - Additional event data</p>
                </div>
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/session-state</span>
                <p class="description">Get current session state information.</p>
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/health</span>
                <p class="description">Health check endpoint.</p>
            </div>
            
            <h2>Response Format</h2>
            <p>All API responses are in JSON format with the following structure:</p>
            <pre><code>{
    "ticker": "SPY",
    "data": [...],
    "session_hash": "abc123..."
}</code></pre>
            
            <p style="margin-top: 40px; color: #64748b; font-size: 0.875rem;">
                Generated at {{ timestamp }}
            </p>
        </div>
    </body>
    </html>
    """
    html_content = render_template_string(
        api_docs_template,
        timestamp=datetime.now().isoformat()
    )
    response = make_response(html_content)
    response = _apply_cache_headers(response, "api_docs")
    response = _add_page_metadata(response, "api_docs")
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    return response
