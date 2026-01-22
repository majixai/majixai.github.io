#!/bin/bash
################################################################################
# Setup Cron Job for Daily 5 PM PST Updates
# Installs daily updater as cron job and systemd service
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATER_SCRIPT="${SCRIPT_DIR}/daily_updater.sh"
CRON_TIME="0 17 * * *"  # 5 PM daily (adjust for PST timezone)

echo "Setting up daily ticker data updater..."
echo "Script directory: ${SCRIPT_DIR}"

# Make scripts executable
chmod +x "${UPDATER_SCRIPT}"
chmod +x "${SCRIPT_DIR}/fetch_1m_daily.py"

echo "Creating systemd service..."

# Create systemd service file
cat > /tmp/ticker-updater.service << EOF
[Unit]
Description=Daily Ticker 1-Minute Data Updater
After=network.target

[Service]
Type=oneshot
ExecStart=${UPDATER_SCRIPT}
WorkingDirectory=${SCRIPT_DIR}
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ticker-updater

[Install]
WantedBy=multi-user.target
EOF

# Create systemd timer file for 5 PM PST
cat > /tmp/ticker-updater.timer << EOF
[Unit]
Description=Daily Ticker Data Update Timer
Requires=ticker-updater.service

[Timer]
OnCalendar=*-*-* 17:00:00
Persistent=true
Unit=ticker-updater.service

[Install]
WantedBy=timers.target
EOF

echo "To install systemd service (requires sudo):"
echo "  sudo cp /tmp/ticker-updater.service /etc/systemd/system/"
echo "  sudo cp /tmp/ticker-updater.timer /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable ticker-updater.timer"
echo "  sudo systemctl start ticker-updater.timer"
echo ""

# Setup cron job
echo "Setting up cron job for user: $(whoami)"
CRON_CMD="${CRON_TIME} ${UPDATER_SCRIPT} >> ${SCRIPT_DIR}/logs/cron.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "${UPDATER_SCRIPT}"; then
    echo "Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "${CRON_CMD}") | crontab -
    echo "Cron job added successfully"
fi

echo ""
echo "Current crontab:"
crontab -l

echo ""
echo "============================================================"
echo "Setup Complete!"
echo "============================================================"
echo "The updater will run daily at 5:00 PM"
echo "Logs will be stored in: ${SCRIPT_DIR}/logs/"
echo ""
echo "To test the updater manually:"
echo "  ${UPDATER_SCRIPT}"
echo ""
echo "To check cron jobs:"
echo "  crontab -l"
echo ""
echo "To remove cron job:"
echo "  crontab -e  # then delete the line with ${UPDATER_SCRIPT}"
echo "============================================================"
