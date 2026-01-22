#!/bin/bash
# Automated Prediction Scheduler
# Runs predictions at 1 AM, 6 AM, and 5 PM PST daily

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
LOCK_FILE="/tmp/prediction_scheduler.lock"
PID_FILE="/tmp/prediction_scheduler.pid"
LOG_DIR="logs"
LOG_FILE="$LOG_DIR/prediction_scheduler_$(date +%Y%m%d).log"

# Create log directory
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    rm -f "$LOCK_FILE"
    rm -f "$PID_FILE"
}

trap cleanup EXIT INT TERM

# Acquire lock
acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local old_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            log "Another instance is running (PID: $old_pid). Exiting."
            exit 0
        else
            log "Removing stale lock file"
            rm -f "$LOCK_FILE"
        fi
    fi
    
    echo $$ > "$LOCK_FILE"
    echo $$ > "$PID_FILE"
    log "Lock acquired (PID: $$)"
}

# Check resources
check_resources() {
    local free_mem=$(free -m | awk '/^Mem:/{print $7}')
    local free_disk=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
    
    log "Available memory: ${free_mem}MB"
    log "Available disk: ${free_disk}GB"
    
    if [ "$free_mem" -lt 100 ]; then
        error_exit "Insufficient memory (< 100MB free)"
    fi
    
    if [ "$free_disk" -lt 1 ]; then
        error_exit "Insufficient disk space (< 1GB free)"
    fi
}

# Determine run time
get_run_time() {
    local hour=$(date +%H)
    
    case "$hour" in
        01) echo "1am" ;;
        06) echo "6am" ;;
        17) echo "5pm" ;;
        *) echo "manual" ;;
    esac
}

# Run predictions
run_predictions() {
    local run_time="$1"
    local horizons="${2:-4 12 24}"
    
    log "Starting prediction run: $run_time"
    log "Time horizons: $horizons"
    
    # Run prediction service
    if python3 prediction_service.py --horizons $horizons 2>&1 | tee -a "$LOG_FILE"; then
        log "Predictions completed successfully"
        return 0
    else
        log "Predictions failed with error code $?"
        return 1
    fi
}

# Send results via webhook
send_webhook() {
    local run_time="$1"
    local status="$2"
    local webhook_url="${PREDICTION_WEBHOOK_URL:-}"
    
    if [ -z "$webhook_url" ]; then
        log "No webhook URL configured, skipping notification"
        return 0
    fi
    
    log "Sending webhook notification..."
    
    local payload=$(cat <<EOF
{
    "run_time": "$run_time",
    "status": "$status",
    "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
    "hostname": "$(hostname)",
    "log_file": "$LOG_FILE"
}
EOF
)
    
    if curl -X POST "$webhook_url" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        --max-time 10 \
        --silent \
        --show-error 2>&1 | tee -a "$LOG_FILE"; then
        log "Webhook sent successfully"
    else
        log "Failed to send webhook"
    fi
}

# Monitor database size
monitor_database() {
    local db_file="dbs/predictions.db"
    
    if [ -f "$db_file" ]; then
        local size_mb=$(du -m "$db_file" | cut -f1)
        local record_count=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM predictions" 2>/dev/null || echo "0")
        
        log "Predictions database: ${size_mb}MB, $record_count records"
        
        # Vacuum if database is large
        if [ "$size_mb" -gt 500 ]; then
            log "Database size exceeds 500MB, running VACUUM..."
            sqlite3 "$db_file" "VACUUM;" || log "VACUUM failed"
        fi
        
        # Archive old predictions (older than 90 days)
        local archived=$(sqlite3 "$db_file" "DELETE FROM predictions WHERE prediction_time < datetime('now', '-90 days')" 2>/dev/null || echo "0")
        if [ "$archived" != "0" ]; then
            log "Archived $archived old predictions"
        fi
    fi
}

# Update data before predictions
update_data() {
    local run_time="$1"
    
    log "Checking if data update is needed..."
    
    # Only update data at 5 PM (after market close)
    if [ "$run_time" = "5pm" ]; then
        log "Running daily data update..."
        if timeout 600 python3 fetch_1m_daily.py 2>&1 | tee -a "$LOG_FILE"; then
            log "Data update completed"
        else
            log "Data update failed or timed out"
        fi
    else
        log "Skipping data update (run time: $run_time)"
    fi
}

# Generate report
generate_report() {
    local run_time="$1"
    local report_file="$LOG_DIR/prediction_report_$(date +%Y%m%d_%H%M%S).txt"
    
    log "Generating prediction report..."
    
    cat > "$report_file" <<EOF
===============================================
Prediction Report - $(date '+%Y-%m-%d %H:%M:%S')
Run Time: $run_time
===============================================

Database Statistics:
$(sqlite3 dbs/predictions.db "
SELECT 
    'Total Predictions: ' || COUNT(*),
    'Today: ' || COUNT(*) FILTER (WHERE prediction_time > datetime('now', 'start of day')),
    'Avg Confidence: ' || ROUND(AVG(confidence), 3),
    'Avg Predicted Change: ' || ROUND(AVG(predicted_change_pct), 2) || '%'
FROM predictions
WHERE prediction_time > datetime('now', '-24 hours')
" 2>/dev/null || echo "Database query failed")

Recent High-Confidence Predictions:
$(sqlite3 dbs/predictions.db "
SELECT 
    ticker || ': ' || ROUND(predicted_change_pct, 2) || '% (' || 
    time_horizon_hours || 'h, conf: ' || ROUND(confidence, 2) || ')'
FROM predictions
WHERE confidence > 0.75 
  AND prediction_time > datetime('now', '-1 hour')
ORDER BY ABS(predicted_change_pct) DESC
LIMIT 10
" 2>/dev/null || echo "No predictions available")

===============================================
EOF
    
    cat "$report_file" | tee -a "$LOG_FILE"
    log "Report saved to: $report_file"
}

# Main execution
main() {
    log "=========================================="
    log "Prediction Scheduler Started"
    log "=========================================="
    
    # Acquire lock
    acquire_lock
    
    # Check resources
    check_resources
    
    # Determine run time
    RUN_TIME=$(get_run_time)
    log "Run time identified: $RUN_TIME"
    
    # Time horizon configuration based on run time
    case "$RUN_TIME" in
        1am)
            # Early morning: shorter horizons for day trading
            HORIZONS="2 4 8"
            ;;
        6am)
            # Morning: medium horizons for intraday
            HORIZONS="4 8 12"
            ;;
        5pm)
            # Evening: longer horizons for next day
            HORIZONS="12 24 48"
            # Update data first
            update_data "$RUN_TIME"
            ;;
        *)
            # Manual: all horizons
            HORIZONS="4 12 24"
            ;;
    esac
    
    # Monitor database
    monitor_database
    
    # Run predictions
    if run_predictions "$RUN_TIME" "$HORIZONS"; then
        PRED_STATUS="success"
    else
        PRED_STATUS="failed"
    fi
    
    # Generate report
    generate_report "$RUN_TIME"
    
    # Send webhook
    send_webhook "$RUN_TIME" "$PRED_STATUS"
    
    log "=========================================="
    log "Prediction Scheduler Completed: $PRED_STATUS"
    log "=========================================="
}

# Run main function
main "$@"
