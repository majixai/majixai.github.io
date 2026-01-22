#!/bin/bash
# Setup cron jobs for prediction scheduler
# Runs at 1 AM, 6 AM, and 5 PM PST daily

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==================================================="
echo "Prediction Scheduler Cron Setup"
echo "==================================================="

# Convert PST times to UTC for cron
# 1 AM PST = 9 AM UTC
# 6 AM PST = 2 PM UTC
# 5 PM PST = 1 AM UTC (next day)

CRON_1AM="0 9 * * *"
CRON_6AM="0 14 * * *"
CRON_5PM="0 1 * * *"

# Create cron entries
CRON_ENTRIES="
# Prediction Scheduler - 1 AM PST (9 AM UTC)
$CRON_1AM cd $SCRIPT_DIR && ./run_predictions.sh >> logs/cron_1am.log 2>&1

# Prediction Scheduler - 6 AM PST (2 PM UTC)
$CRON_6AM cd $SCRIPT_DIR && ./run_predictions.sh >> logs/cron_6am.log 2>&1

# Prediction Scheduler - 5 PM PST (1 AM UTC next day)
$CRON_5PM cd $SCRIPT_DIR && ./run_predictions.sh >> logs/cron_5pm.log 2>&1
"

echo "Cron entries to be added:"
echo "$CRON_ENTRIES"
echo

# Check if crontab command is available
if command -v crontab >/dev/null 2>&1; then
    echo "Adding to crontab..."
    
    # Backup existing crontab
    crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Remove old prediction scheduler entries
    (crontab -l 2>/dev/null | grep -v "Prediction Scheduler" || true) | crontab -
    
    # Add new entries
    (crontab -l 2>/dev/null; echo "$CRON_ENTRIES") | crontab -
    
    echo "✅ Cron jobs installed successfully!"
    echo
    echo "Current crontab:"
    crontab -l | grep -A 1 "Prediction Scheduler" || true
    
else
    echo "⚠️  crontab command not available in this environment"
    echo
    echo "Alternative setup using systemd timers:"
    echo
    
    # Create systemd service file
    SERVICE_FILE="/tmp/prediction-scheduler.service"
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Prediction Scheduler Service
After=network.target

[Service]
Type=oneshot
WorkingDirectory=$SCRIPT_DIR
ExecStart=$SCRIPT_DIR/run_predictions.sh
User=$(whoami)
StandardOutput=append:$SCRIPT_DIR/logs/systemd.log
StandardError=append:$SCRIPT_DIR/logs/systemd.log

[Install]
WantedBy=multi-user.target
EOF
    
    # Create systemd timer files
    TIMER_1AM="/tmp/prediction-scheduler-1am.timer"
    cat > "$TIMER_1AM" <<EOF
[Unit]
Description=Run predictions at 1 AM PST (9 AM UTC)

[Timer]
OnCalendar=*-*-* 09:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
    
    TIMER_6AM="/tmp/prediction-scheduler-6am.timer"
    cat > "$TIMER_6AM" <<EOF
[Unit]
Description=Run predictions at 6 AM PST (2 PM UTC)

[Timer]
OnCalendar=*-*-* 14:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
    
    TIMER_5PM="/tmp/prediction-scheduler-5pm.timer"
    cat > "$TIMER_5PM" <<EOF
[Unit]
Description=Run predictions at 5 PM PST (1 AM UTC)

[Timer]
OnCalendar=*-*-* 01:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
    
    echo "Systemd files created in /tmp:"
    echo "  - $SERVICE_FILE"
    echo "  - $TIMER_1AM"
    echo "  - $TIMER_6AM"
    echo "  - $TIMER_5PM"
    echo
    echo "To install systemd timers (requires root):"
    echo "  sudo cp $SERVICE_FILE /etc/systemd/system/"
    echo "  sudo cp $TIMER_1AM /etc/systemd/system/"
    echo "  sudo cp $TIMER_6AM /etc/systemd/system/"
    echo "  sudo cp $TIMER_5PM /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable prediction-scheduler-1am.timer"
    echo "  sudo systemctl enable prediction-scheduler-6am.timer"
    echo "  sudo systemctl enable prediction-scheduler-5pm.timer"
    echo "  sudo systemctl start prediction-scheduler-1am.timer"
    echo "  sudo systemctl start prediction-scheduler-6am.timer"
    echo "  sudo systemctl start prediction-scheduler-5pm.timer"
fi

echo
echo "==================================================="
echo "Manual Testing"
echo "==================================================="
echo "To test the prediction scheduler manually:"
echo "  cd $SCRIPT_DIR"
echo "  ./run_predictions.sh"
echo
echo "To test with specific ticker:"
echo "  python3 prediction_service.py --ticker AAPL --horizons 4 12 24"
echo
echo "==================================================="
echo "GitHub Actions"
echo "==================================================="
echo "GitHub Actions workflows are configured in:"
echo "  .github/workflows/predict_prices.yml (scheduled)"
echo "  .github/workflows/webhook_predict.yml (webhook triggered)"
echo
echo "Required GitHub secrets:"
echo "  PREDICTION_WEBHOOK_URL - Webhook endpoint URL"
echo "  WEBHOOK_SECRET - Secret for webhook signature verification"
echo
echo "Trigger webhook manually:"
echo "  curl -X POST https://api.github.com/repos/\$OWNER/\$REPO/dispatches \\"
echo "    -H 'Authorization: token \$GITHUB_TOKEN' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"event_type\": \"predict-prices\", \"client_payload\": {\"ticker\": \"AAPL\"}}'"
echo
echo "==================================================="
