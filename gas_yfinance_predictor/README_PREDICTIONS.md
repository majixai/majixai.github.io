# Price Action Prediction System

Automated ML-based price prediction service with percentage change and time estimates. Runs at 1 AM, 6 AM, and 5 PM PST daily with GitHub Actions and webhook integration.

## 🎯 Features

- **Multi-Model ML Predictions**: Ensemble predictions using 4 models:
  - Momentum-based prediction
  - Mean reversion model
  - Trend following model
  - Volatility-adjusted prediction

- **Multiple Time Horizons**:
  - 1 AM: 2, 4, 8 hour predictions (day trading)
  - 6 AM: 4, 8, 12 hour predictions (intraday)
  - 5 PM: 12, 24, 48 hour predictions (next day)

- **Automated Scheduling**:
  - GitHub Actions workflows (cloud-based)
  - Cron jobs (local server)
  - Webhook triggers (on-demand)

- **Comprehensive Analysis**:
  - Percentage change predictions
  - Confidence scores (0-1)
  - Trading signals (BUY/SELL/HOLD)
  - Technical indicators (RSI, Bollinger Bands, Moving Averages)

## 📋 Components

### 1. Prediction Service (`prediction_service.py`)

Core ML prediction engine that:
- Fetches data from ticker databases (1m, 1h, 1d)
- Calculates technical indicators
- Runs ensemble ML models
- Generates trading signals
- Stores predictions in database
- Sends webhook notifications

**Usage:**
```bash
# Predict all tickers with default horizons (4, 12, 24 hours)
python3 prediction_service.py

# Predict single ticker
python3 prediction_service.py --ticker AAPL --horizons 4 12 24

# Custom time horizons
python3 prediction_service.py --horizons 2 6 12 24 48
```

**Output:**
```json
{
  "ticker": "AAPL",
  "current_price": 248.36,
  "predicted_price": 248.33,
  "predicted_change_pct": -0.011,
  "confidence": 0.525,
  "time_horizon_hours": 4,
  "target_timestamp": "2026-01-23 03:34:41",
  "signals": {
    "action": "HOLD",
    "strength": 0,
    "reasons": ["RSI approaching oversold", "Low volume warning"]
  },
  "indicators": {
    "rsi": 33.74,
    "sma_20": 248.57,
    "bb_upper": 248.96,
    "bb_lower": 248.17,
    "volume_trend": 0.0,
    "momentum": -0.125,
    "volatility": 0.079
  }
}
```

### 2. Prediction Scheduler (`run_predictions.sh`)

Automated scheduler that:
- Manages process locking (prevents concurrent runs)
- Checks system resources (memory, disk)
- Determines run time (1am/6am/5pm)
- Updates data (5 PM only)
- Runs predictions with appropriate horizons
- Generates reports
- Sends webhook notifications
- Monitors database size and performance

**Manual Execution:**
```bash
./run_predictions.sh
```

**Logs:**
- `logs/prediction_scheduler_YYYYMMDD.log` - Main log
- `logs/prediction_report_YYYYMMDD_HHMMSS.txt` - Prediction reports

### 3. Webhook Receiver (`webhook_receiver.py`)

Flask-based webhook server that:
- Receives prediction notifications from GitHub Actions
- Logs webhook events to database
- Processes prediction payloads
- Exposes REST API for predictions
- Sends notifications based on signals

**API Endpoints:**

```bash
# Health check
curl http://localhost:5000/health

# Latest predictions
curl http://localhost:5000/api/predictions/latest

# Predictions summary (last 24 hours)
curl http://localhost:5000/api/predictions/summary

# Webhook endpoint (for GitHub Actions)
curl -X POST http://localhost:5000/webhook/predictions \
  -H "Content-Type: application/json" \
  -d '{"run_time": "1am", "status": "success"}'
```

**Start Server:**
```bash
python3 webhook_receiver.py
# Or with custom port:
PORT=8080 python3 webhook_receiver.py
```

### 4. GitHub Actions Workflows

#### a) Scheduled Predictions (`.github/workflows/predict_prices.yml`)

Runs automatically at:
- **1 AM PST** (9 AM UTC) - Day trading predictions
- **6 AM PST** (2 PM UTC) - Intraday predictions  
- **5 PM PST** (1 AM UTC) - Next day predictions

**Features:**
- Downloads latest data
- Runs predictions with time-appropriate horizons
- Generates reports
- Uploads prediction database as artifact
- Sends webhook notifications
- Creates GitHub issue on failure

**Manual Trigger:**
```bash
# Via GitHub UI: Actions > Price Action Predictions > Run workflow

# Via API:
curl -X POST \
  https://api.github.com/repos/majixai/majixai.github.io/actions/workflows/predict_prices.yml/dispatches \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ref": "main"}'
```

#### b) Webhook-Triggered Predictions (`.github/workflows/webhook_predict.yml`)

Runs on-demand via repository dispatch event.

**Trigger Prediction:**
```bash
curl -X POST \
  https://api.github.com/repos/majixai/majixai.github.io/dispatches \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "predict-prices",
    "client_payload": {
      "ticker": "AAPL",
      "horizons": "4 12 24",
      "source": "manual"
    }
  }'
```

## 🚀 Setup Instructions

### 1. GitHub Actions Setup (Recommended)

**a) Configure Secrets:**
```bash
# Go to: Settings > Secrets and variables > Actions > New repository secret

# Add secrets:
PREDICTION_WEBHOOK_URL=https://your-webhook-endpoint.com/webhook/predictions
WEBHOOK_SECRET=your-secure-secret-key-here
```

**b) Enable Workflows:**
```bash
# Workflows are automatically enabled when committed
# Check status: Actions tab in GitHub repository
```

**c) Test Workflow:**
```bash
# Trigger manually from Actions tab
# Or use API (see above)
```

### 2. Local Cron Setup

**Install Cron Jobs:**
```bash
cd gas_yfinance_predictor
./setup_prediction_cron.sh
```

This installs three cron jobs:
- `0 9 * * *` (1 AM PST) → Day trading predictions
- `0 14 * * *` (6 AM PST) → Intraday predictions
- `0 1 * * *` (5 PM PST) → Next day predictions + data update

**Verify Installation:**
```bash
crontab -l | grep "Prediction Scheduler"
```

**Manual Test:**
```bash
./run_predictions.sh
# Check logs: tail -f logs/prediction_scheduler_*.log
```

### 3. Systemd Setup (Alternative to Cron)

If crontab is not available, use systemd timers:

```bash
# Setup creates systemd files in /tmp
./setup_prediction_cron.sh

# Install (requires root):
sudo cp /tmp/prediction-scheduler.service /etc/systemd/system/
sudo cp /tmp/prediction-scheduler-1am.timer /etc/systemd/system/
sudo cp /tmp/prediction-scheduler-6am.timer /etc/systemd/system/
sudo cp /tmp/prediction-scheduler-5pm.timer /etc/systemd/system/

# Enable and start:
sudo systemctl daemon-reload
sudo systemctl enable prediction-scheduler-1am.timer
sudo systemctl enable prediction-scheduler-6am.timer
sudo systemctl enable prediction-scheduler-5pm.timer
sudo systemctl start prediction-scheduler-1am.timer
sudo systemctl start prediction-scheduler-6am.timer
sudo systemctl start prediction-scheduler-5pm.timer

# Check status:
sudo systemctl status prediction-scheduler-*.timer
```

### 4. Webhook Server Setup

**Local Development:**
```bash
python3 webhook_receiver.py
# Server runs on http://localhost:5000
```

**Production (with gunicorn):**
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 webhook_receiver:app
```

**Docker:**
```bash
# Create Dockerfile
cat > Dockerfile.webhook <<EOF
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt webhook_receiver.py ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "webhook_receiver:app"]
EOF

# Build and run
docker build -f Dockerfile.webhook -t prediction-webhook .
docker run -p 5000:5000 \
  -e WEBHOOK_SECRET=your-secret \
  -v $(pwd)/dbs:/app/dbs \
  prediction-webhook
```

## 📊 Database Schema

### Predictions Database (`dbs/predictions.db`)

**predictions table:**
```sql
CREATE TABLE predictions (
    id INTEGER PRIMARY KEY,
    ticker TEXT NOT NULL,
    prediction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_price REAL,
    predicted_price REAL,
    predicted_change_pct REAL,
    confidence REAL,
    time_horizon_hours INTEGER,
    target_timestamp TIMESTAMP,
    model_type TEXT,
    features_used TEXT,
    actual_price REAL,
    actual_change_pct REAL,
    prediction_error REAL,
    status TEXT DEFAULT 'pending'
);
```

**prediction_performance table:**
```sql
CREATE TABLE prediction_performance (
    id INTEGER PRIMARY KEY,
    ticker TEXT NOT NULL,
    evaluation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    predictions_evaluated INTEGER,
    avg_error REAL,
    rmse REAL,
    mae REAL,
    directional_accuracy REAL,
    model_type TEXT
);
```

### Webhook Logs Database (`dbs/webhook_logs.db`)

**webhook_logs table:**
```sql
CREATE TABLE webhook_logs (
    id INTEGER PRIMARY KEY,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    run_time TEXT,
    workflow_run INTEGER,
    status TEXT,
    predictions_count INTEGER,
    payload TEXT
);
```

## 🔧 Configuration

### Environment Variables

```bash
# Webhook configuration
export PREDICTION_WEBHOOK_URL="https://your-webhook-endpoint.com/webhook"
export WEBHOOK_SECRET="your-secure-secret-key"
export GITHUB_TOKEN="ghp_your_github_token"

# Server configuration
export PORT=5000

# Database paths (default: dbs/)
export DB_DIR="dbs"
```

### GitHub Secrets Required

| Secret | Description | Example |
|--------|-------------|---------|
| `PREDICTION_WEBHOOK_URL` | Webhook endpoint for notifications | `https://hooks.slack.com/services/...` |
| `WEBHOOK_SECRET` | Secret for webhook signature verification | `your-random-secret-key` |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions | (automatic) |

## 📈 Prediction Models

### 1. Momentum Model
- Uses recent price momentum and RSI
- Adjusts for overbought/oversold conditions
- Volume confirmation increases confidence
- Best for trending markets

### 2. Mean Reversion Model
- Predicts return to moving average
- Uses Bollinger Bands for extremes
- High confidence at band edges
- Best for range-bound markets

### 3. Trend Following Model
- Analyzes SMA crossovers
- Linear regression for trend strength
- Confidence based on trend consistency
- Best for sustained trends

### 4. Volatility Model
- Predicts based on historical volatility
- Direction from RSI
- Confidence inversely related to volatility
- Best for risk assessment

### Ensemble Method
- Weighted average of all models
- Weights based on individual confidence
- Reduces single-model bias
- More robust predictions

## 🎲 Trading Signals

**Signal Generation:**
- Score calculated from RSI, Bollinger Bands, predictions, volume
- Actions: STRONG BUY, BUY, HOLD, SELL, STRONG SELL
- Strength: -5 to +5

**Signal Thresholds:**
- Score ≥ 3: STRONG BUY
- Score ≥ 1: BUY
- Score between -1 and 1: HOLD
- Score ≤ -1: SELL
- Score ≤ -3: STRONG SELL

## 📝 Example Predictions

```bash
# Run predictions for top movers
python3 prediction_service.py

# Output shows:
# Top 5 Predicted Gainers:
#   NVDA: +3.45% (24h)
#   TSLA: +2.87% (24h)
#   AMD: +2.34% (24h)
# 
# Top 5 Predicted Losers:
#   META: -2.12% (24h)
#   GOOGL: -1.98% (24h)
```

## 🔍 Monitoring

### Check Prediction Status

```bash
# View recent predictions
sqlite3 dbs/predictions.db "
SELECT ticker, predicted_change_pct, confidence, time_horizon_hours
FROM predictions 
WHERE prediction_time > datetime('now', '-1 hour')
ORDER BY ABS(predicted_change_pct) DESC
LIMIT 10"

# View prediction summary
sqlite3 dbs/predictions.db "
SELECT 
    COUNT(*) as total,
    AVG(predicted_change_pct) as avg_change,
    AVG(confidence) as avg_confidence
FROM predictions 
WHERE prediction_time > datetime('now', '-24 hours')"
```

### Check Logs

```bash
# Scheduler logs
tail -f logs/prediction_scheduler_$(date +%Y%m%d).log

# Cron logs
tail -f logs/cron_1am.log
tail -f logs/cron_6am.log
tail -f logs/cron_5pm.log

# Webhook logs
tail -f logs/systemd.log
```

### GitHub Actions Monitoring

- Navigate to: `Actions` tab in GitHub repository
- View workflow runs: `Price Action Predictions`
- Download artifacts: Prediction database from each run
- Check notifications: Issues created on failures

## 🛠️ Troubleshooting

### No Predictions Generated

```bash
# Check if data exists
sqlite3 dbs/ticker_data_1m.db "SELECT COUNT(*), MIN(datetime), MAX(datetime) FROM ticker_data_1m"

# Update data manually
python3 fetch_1m_daily.py
```

### Workflow Not Running

```bash
# Check workflow syntax
cat .github/workflows/predict_prices.yml

# View workflow logs in GitHub Actions tab
# Ensure secrets are configured in repository settings
```

### Database Locked

```bash
# Check for running processes
ps aux | grep prediction

# Kill stale processes
kill $(cat /tmp/prediction_scheduler.pid)

# Remove lock files
rm -f /tmp/prediction_scheduler.lock
```

### Low Confidence Predictions

- Normal for low-volatility periods
- Requires more historical data
- Check data quality: `python3 monitor_progress.py`

## 📚 Dependencies

```bash
# Core dependencies (already installed)
pip install yfinance pandas numpy sqlite3

# Additional for predictions
pip install scikit-learn

# For webhook server
pip install flask gunicorn

# Optional: TensorFlow for advanced ML
pip install -r requirements_ml.txt
```

## 🚦 Quick Start

```bash
# 1. Test prediction service
python3 prediction_service.py --ticker AAPL --horizons 4 12 24

# 2. Run full prediction cycle
./run_predictions.sh

# 3. Set up automation
./setup_prediction_cron.sh

# 4. Start webhook server (optional)
python3 webhook_receiver.py

# 5. Enable GitHub Actions workflows (commit to repository)
git add .github/workflows/predict_prices.yml
git commit -m "Enable automated predictions"
git push
```

## 📊 Performance

- **Prediction Speed**: ~0.5 seconds per ticker per horizon
- **Database Size**: ~1-2 MB per 1000 predictions
- **Memory Usage**: ~100-200 MB during execution
- **Concurrent Capacity**: Supports 300+ tickers efficiently

## 🔐 Security

- Webhook signature verification with HMAC-SHA256
- Process locking prevents concurrent runs
- Database backups before VACUUM operations
- Secure GitHub secrets storage
- No credentials in code or logs

## 📄 License

Part of the gas_yfinance_predictor project. See main README for license details.

## 🤝 Contributing

Improvements welcome:
- Additional prediction models
- Enhanced signal generation
- Performance optimizations
- Documentation updates

## 📞 Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review GitHub Actions workflow runs
3. Verify database integrity with `test_system.py`
4. Check documentation in README files

---

**Last Updated**: January 22, 2026
**Status**: ✅ Fully Operational
**Automation**: GitHub Actions (1 AM, 6 AM, 5 PM PST)
