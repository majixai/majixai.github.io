#!/usr/bin/env python3
"""
Webhook Receiver for Prediction Notifications
Receives and processes prediction webhooks from GitHub Actions
"""

from flask import Flask, request, jsonify
import sqlite3
import json
import logging
from datetime import datetime
from pathlib import Path
import hmac
import hashlib
import os

app = Flask(__name__)

# Configuration
WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET', 'your-secret-key-here')
DB_PATH = Path('dbs/predictions.db')
WEBHOOK_LOG_DB = Path('dbs/webhook_logs.db')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def init_webhook_db():
    """Initialize webhook logs database"""
    conn = sqlite3.connect(WEBHOOK_LOG_DB)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS webhook_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            run_time TEXT,
            workflow_run INTEGER,
            status TEXT,
            predictions_count INTEGER,
            payload TEXT
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notification_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notification_type TEXT,
            recipient TEXT,
            message TEXT,
            status TEXT
        )
    """)
    
    conn.commit()
    conn.close()

def verify_signature(payload_body, signature_header):
    """Verify webhook signature"""
    if not signature_header:
        return False
        
    hash_object = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        msg=payload_body,
        digestmod=hashlib.sha256
    )
    expected_signature = 'sha256=' + hash_object.hexdigest()
    
    return hmac.compare_digest(expected_signature, signature_header)

@app.route('/webhook/predictions', methods=['POST'])
def receive_predictions_webhook():
    """Receive predictions webhook from GitHub Actions"""
    
    # Verify signature (optional but recommended)
    signature = request.headers.get('X-Hub-Signature-256', '')
    if WEBHOOK_SECRET != 'your-secret-key-here':
        if not verify_signature(request.data, signature):
            logger.warning("Invalid webhook signature")
            return jsonify({'error': 'Invalid signature'}), 401
    
    try:
        data = request.json
        
        # Log webhook receipt
        conn = sqlite3.connect(WEBHOOK_LOG_DB)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO webhook_logs (
                run_time, workflow_run, status, predictions_count, payload
            ) VALUES (?, ?, ?, ?, ?)
        """, (
            data.get('run_time', 'unknown'),
            data.get('workflow_run', 0),
            data.get('status', 'unknown'),
            data.get('predictions_count', 0),
            json.dumps(data)
        ))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Received webhook for {data.get('run_time')} run: {data.get('status')}")
        
        # Process predictions if included
        if 'predictions' in data:
            process_predictions(data['predictions'])
        
        # Send notifications based on signals
        if 'summary' in data:
            send_notifications(data['summary'], data.get('run_time', 'scheduled'))
        
        return jsonify({
            'status': 'success',
            'message': 'Webhook received and processed',
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/webhook/github', methods=['POST'])
def receive_github_webhook():
    """Receive general GitHub webhooks"""
    
    event_type = request.headers.get('X-GitHub-Event', 'unknown')
    
    try:
        data = request.json
        
        logger.info(f"Received GitHub webhook: {event_type}")
        
        # Handle different event types
        if event_type == 'workflow_run':
            handle_workflow_run(data)
        elif event_type == 'push':
            handle_push_event(data)
        elif event_type == 'issues':
            handle_issues_event(data)
        
        return jsonify({'status': 'success'}), 200
        
    except Exception as e:
        logger.error(f"Error processing GitHub webhook: {e}")
        return jsonify({'error': str(e)}), 500

def process_predictions(predictions):
    """Process received predictions"""
    logger.info(f"Processing {len(predictions)} predictions")
    
    # Find high-confidence predictions
    strong_signals = [
        p for p in predictions
        if p.get('confidence', 0) > 0.7 and 
           abs(p.get('predicted_change_pct', 0)) > 3
    ]
    
    if strong_signals:
        logger.info(f"Found {len(strong_signals)} strong signals")
        for signal in strong_signals:
            logger.info(
                f"  {signal['ticker']}: {signal['predicted_change_pct']:+.2f}% "
                f"(confidence: {signal['confidence']:.2f})"
            )

def send_notifications(summary, run_time):
    """Send notifications based on prediction summary"""
    conn = sqlite3.connect(WEBHOOK_LOG_DB)
    cursor = conn.cursor()
    
    # Check for significant market predictions
    avg_change = summary.get('avg_predicted_change', 0)
    buy_signals = summary.get('buy_signals', 0)
    sell_signals = summary.get('sell_signals', 0)
    
    message = f"""
Prediction Summary - {run_time}:
- Average predicted change: {avg_change:+.2f}%
- Buy signals: {buy_signals}
- Sell signals: {sell_signals}
- Total tickers: {summary.get('total_tickers', 0)}
"""
    
    # Log notification
    cursor.execute("""
        INSERT INTO notification_history (
            notification_type, recipient, message, status
        ) VALUES (?, ?, ?, ?)
    """, ('summary', 'system', message, 'logged'))
    
    conn.commit()
    conn.close()
    
    logger.info(f"Notification logged: {run_time}")

def handle_workflow_run(data):
    """Handle workflow run events"""
    workflow_name = data.get('workflow', {}).get('name', 'unknown')
    status = data.get('workflow_run', {}).get('status', 'unknown')
    conclusion = data.get('workflow_run', {}).get('conclusion', 'unknown')
    
    logger.info(f"Workflow '{workflow_name}': {status} ({conclusion})")

def handle_push_event(data):
    """Handle push events"""
    ref = data.get('ref', 'unknown')
    commits_count = len(data.get('commits', []))
    
    logger.info(f"Push to {ref}: {commits_count} commits")

def handle_issues_event(data):
    """Handle issue events"""
    action = data.get('action', 'unknown')
    issue_title = data.get('issue', {}).get('title', 'unknown')
    
    logger.info(f"Issue {action}: {issue_title}")

@app.route('/api/predictions/latest', methods=['GET'])
def get_latest_predictions():
    """API endpoint to fetch latest predictions"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT ticker, prediction_time, predicted_change_pct, 
                   confidence, time_horizon_hours, status
            FROM predictions
            ORDER BY prediction_time DESC
            LIMIT 50
        """)
        
        predictions = [
            {
                'ticker': row[0],
                'prediction_time': row[1],
                'predicted_change_pct': row[2],
                'confidence': row[3],
                'time_horizon_hours': row[4],
                'status': row[5]
            }
            for row in cursor.fetchall()
        ]
        
        conn.close()
        
        return jsonify({
            'predictions': predictions,
            'count': len(predictions)
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching predictions: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/predictions/summary', methods=['GET'])
def get_predictions_summary():
    """API endpoint for predictions summary"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get recent predictions stats
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                AVG(predicted_change_pct) as avg_change,
                AVG(confidence) as avg_confidence,
                MIN(prediction_time) as oldest,
                MAX(prediction_time) as latest
            FROM predictions
            WHERE prediction_time > datetime('now', '-24 hours')
        """)
        
        row = cursor.fetchone()
        conn.close()
        
        return jsonify({
            'total_predictions_24h': row[0],
            'avg_predicted_change': row[1],
            'avg_confidence': row[2],
            'oldest_prediction': row[3],
            'latest_prediction': row[4]
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching summary: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'prediction-webhook-receiver'
    }), 200

if __name__ == '__main__':
    # Initialize databases
    init_webhook_db()
    
    # Run server
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
