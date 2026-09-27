#!/usr/bin/env python3
"""
TradingView Webhook Handler for GitHub Repository Dispatch

This script handles incoming webhooks from TradingView and forwards them
to GitHub's repository_dispatch API with proper authentication.

Usage:
  python webhook.py

Environment variables required:
  GITHUB_TOKEN: Personal access token with 'repo' scope
  GITHUB_OWNER: Repository owner (default: majixai)
  GITHUB_REPO: Repository name (default: majixai.github.io)
  WEBHOOK_SECRET: Optional secret for request verification
  PORT: Port to run server on (default: 5000)
"""

import os
import json
import hmac
import hashlib
from datetime import datetime
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# Configuration from environment
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_OWNER = os.environ.get("GITHUB_OWNER", "majixai")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "majixai.github.io")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
PORT = int(os.environ.get("PORT", 5000))

GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/dispatches"


def verify_signature(payload_body, signature):
    """Verify webhook signature using HMAC SHA256"""
    if not WEBHOOK_SECRET:
        return True
    
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload_body,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_signature, signature)


@app.route("/webhook", methods=["POST"])
def handle_webhook():
    """
    Handle incoming TradingView webhook alerts.
    
    Expected payload format (JSON):
    {
      "ticker": "AAPL",
      "exchange": "NASDAQ",
      "timeframe": "1",
      "rvol_multiplier": 5.25,
      "price": 150.30
    }
    """
    
    try:
        # Verify signature if secret is configured
        if WEBHOOK_SECRET:
            signature = request.headers.get("X-Signature", "")
            if not verify_signature(request.data, signature):
                return jsonify({"error": "Invalid signature"}), 401
        
        # Parse payload
        payload = request.get_json()
        
        if not payload:
            return jsonify({"error": "No JSON payload"}), 400
        
        # Validate required fields
        required_fields = ["ticker", "exchange", "timeframe", "rvol_multiplier", "price"]
        missing = [f for f in required_fields if f not in payload]
        if missing:
            return jsonify({
                "error": f"Missing required fields: {', '.join(missing)}"
            }), 400
        
        # Prepare GitHub dispatch payload
        github_payload = {
            "event_type": "tradingview_rvol_alert",
            "client_payload": {
                "ticker": payload.get("ticker"),
                "exchange": payload.get("exchange"),
                "timeframe": payload.get("timeframe"),
                "rvol_multiplier": float(payload.get("rvol_multiplier")),
                "price": float(payload.get("price")),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "source": "tradingview_webhook"
            }
        }
        
        # Send to GitHub
        headers = {
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        
        response = requests.post(
            GITHUB_API_URL,
            json=github_payload,
            headers=headers,
            timeout=3
        )
        
        if response.status_code == 204:
            return jsonify({
                "success": True,
                "message": "Alert dispatched to GitHub",
                "ticker": payload.get("ticker"),
                "rvol": payload.get("rvol_multiplier")
            }), 200
        else:
            return jsonify({
                "error": "GitHub dispatch failed",
                "status": response.status_code,
                "details": response.text
            }), response.status_code
    
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400
    except requests.RequestException as e:
        return jsonify({"error": f"Request failed: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "TradingView Webhook Handler",
        "github_repo": f"{GITHUB_OWNER}/{GITHUB_REPO}"
    }), 200


@app.route("/", methods=["GET"])
def index():
    """Index endpoint with configuration info"""
    return jsonify({
        "service": "TradingView Webhook Handler",
        "webhook_endpoint": "/webhook",
        "health_endpoint": "/health",
        "github_target": f"{GITHUB_OWNER}/{GITHUB_REPO}",
        "expected_payload": {
            "ticker": "string",
            "exchange": "string",
            "timeframe": "string",
            "rvol_multiplier": "number",
            "price": "number"
        }
    }), 200


if __name__ == "__main__":
    if not GITHUB_TOKEN:
        print("ERROR: GITHUB_TOKEN environment variable not set")
        exit(1)
    
    print(f"Starting TradingView Webhook Handler on port {PORT}")
    print(f"GitHub target: {GITHUB_OWNER}/{GITHUB_REPO}")
    print(f"Webhook endpoint: http://localhost:{PORT}/webhook")
    
    app.run(host="0.0.0.0", port=PORT, debug=False)
