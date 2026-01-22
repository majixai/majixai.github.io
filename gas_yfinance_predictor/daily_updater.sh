#!/bin/bash
################################################################################
# Daily 1-minute Data Updater - Runs at 5 PM PST
# Uses Unix process operations for robust automated data fetching
# Integrates with systemd, cron, and process monitoring
################################################################################

set -euo pipefail
IFS=$'\n\t'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
PID_FILE="${SCRIPT_DIR}/.updater.pid"
LOCK_FILE="${SCRIPT_DIR}/.updater.lock"
DATA_FILE="${SCRIPT_DIR}/DATA.txt"
PYTHON_SCRIPT="${SCRIPT_DIR}/fetch_1m_daily.py"
LOG_FILE="${LOG_DIR}/daily_update_$(date +%Y%m%d).log"

# Create log directory
mkdir -p "${LOG_DIR}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

# Error handler
error_exit() {
    log "ERROR: $1"
    cleanup
    exit 1
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    [ -f "${LOCK_FILE}" ] && rm -f "${LOCK_FILE}"
    [ -f "${PID_FILE}" ] && rm -f "${PID_FILE}"
}

# Signal handlers
trap cleanup EXIT INT TERM

# Check if already running using process lock
acquire_lock() {
    if [ -f "${LOCK_FILE}" ]; then
        OLD_PID=$(cat "${LOCK_FILE}")
        if kill -0 "${OLD_PID}" 2>/dev/null; then
            error_exit "Another instance is running (PID: ${OLD_PID})"
        else
            log "Removing stale lock file"
            rm -f "${LOCK_FILE}"
        fi
    fi
    
    echo $$ > "${LOCK_FILE}"
    echo $$ > "${PID_FILE}"
    log "Lock acquired (PID: $$)"
}

# Check system resources
check_resources() {
    log "Checking system resources..."
    
    # Check available memory (require at least 1GB free)
    FREE_MEM=$(free -m | awk 'NR==2{print $7}')
    if [ "${FREE_MEM}" -lt 1000 ]; then
        error_exit "Insufficient memory: ${FREE_MEM}MB available"
    fi
    
    # Check disk space (require at least 5GB free)
    FREE_DISK=$(df -BG "${SCRIPT_DIR}" | awk 'NR==2{print $4}' | tr -d 'G')
    if [ "${FREE_DISK}" -lt 5 ]; then
        error_exit "Insufficient disk space: ${FREE_DISK}GB available"
    fi
    
    # Check if Python is available
    if ! command -v python3 &> /dev/null; then
        error_exit "Python3 not found"
    fi
    
    log "Resource check passed: ${FREE_MEM}MB RAM, ${FREE_DISK}GB disk"
}

# Monitor process with timeout
monitor_process() {
    local PID=$1
    local TIMEOUT=${2:-3600}  # Default 1 hour timeout
    local ELAPSED=0
    local CHECK_INTERVAL=10
    
    log "Monitoring process ${PID} (timeout: ${TIMEOUT}s)"
    
    while kill -0 "${PID}" 2>/dev/null; do
        sleep "${CHECK_INTERVAL}"
        ELAPSED=$((ELAPSED + CHECK_INTERVAL))
        
        if [ "${ELAPSED}" -ge "${TIMEOUT}" ]; then
            log "WARNING: Process ${PID} exceeded timeout, terminating..."
            kill -TERM "${PID}" 2>/dev/null || true
            sleep 5
            kill -KILL "${PID}" 2>/dev/null || true
            return 1
        fi
        
        # Log progress every 5 minutes
        if [ $((ELAPSED % 300)) -eq 0 ]; then
            log "Process ${PID} still running (${ELAPSED}s elapsed)"
        fi
    done
    
    wait "${PID}"
    return $?
}

# Run data fetch with process management
run_data_fetch() {
    log "Starting 1-minute data fetch for all tickers"
    
    # Start Python script in background
    python3 "${PYTHON_SCRIPT}" >> "${LOG_FILE}" 2>&1 &
    local FETCH_PID=$!
    
    log "Data fetch process started (PID: ${FETCH_PID})"
    
    # Monitor the process
    if monitor_process "${FETCH_PID}" 7200; then  # 2 hour timeout
        log "Data fetch completed successfully"
        return 0
    else
        log "Data fetch failed or timed out"
        return 1
    fi
}

# Compile C extensions if needed
compile_extensions() {
    local C_FILE="${SCRIPT_DIR}/ticker_analyzer.c"
    local SO_FILE="${SCRIPT_DIR}/ticker_analyzer.so"
    
    if [ -f "${C_FILE}" ]; then
        if [ ! -f "${SO_FILE}" ] || [ "${C_FILE}" -nt "${SO_FILE}" ]; then
            log "Compiling C extensions..."
            gcc -O3 -march=native -fPIC -shared -o "${SO_FILE}" "${C_FILE}" || {
                log "WARNING: C extension compilation failed"
                return 1
            }
            log "C extensions compiled successfully"
        fi
    fi
}

# Compile Cython modules if needed
compile_cython() {
    local PYX_FILE="${SCRIPT_DIR}/data_processor.pyx"
    
    if [ -f "${PYX_FILE}" ]; then
        log "Compiling Cython modules..."
        cd "${SCRIPT_DIR}"
        python3 -c "from Cython.Build import cythonize; cythonize('data_processor.pyx', compiler_directives={'language_level': '3'})" 2>&1 | tee -a "${LOG_FILE}" || {
            log "WARNING: Cython compilation failed"
            return 1
        }
        python3 setup_cython.py build_ext --inplace 2>&1 | tee -a "${LOG_FILE}" || {
            log "WARNING: Cython build failed"
            return 1
        }
        log "Cython modules compiled successfully"
    fi
}

# Database maintenance
maintain_databases() {
    log "Performing database maintenance..."
    
    for db in "${SCRIPT_DIR}"/dbs/*.db; do
        if [ -f "${db}" ]; then
            log "Vacuuming database: ${db}"
            sqlite3 "${db}" "VACUUM;" 2>&1 | tee -a "${LOG_FILE}"
            
            # Get database size
            DB_SIZE=$(du -h "${db}" | cut -f1)
            log "Database ${db} size: ${DB_SIZE}"
        fi
    done
}

# Rotate old logs (keep last 30 days)
rotate_logs() {
    log "Rotating old logs..."
    find "${LOG_DIR}" -name "daily_update_*.log" -mtime +30 -delete
    log "Old logs cleaned up"
}

# Send notification (can be customized for email, Slack, etc.)
send_notification() {
    local STATUS=$1
    local MESSAGE=$2
    
    log "NOTIFICATION: ${STATUS} - ${MESSAGE}"
    
    # Example: Send to system log
    logger -t ticker_updater "${STATUS}: ${MESSAGE}"
    
    # TODO: Add email/Slack/webhook notifications here
}

# Main execution
main() {
    log "=========================================="
    log "Daily Ticker Data Update Started"
    log "=========================================="
    
    # Acquire process lock
    acquire_lock
    
    # Check system resources
    check_resources
    
    # Compile extensions
    compile_extensions
    compile_cython
    
    # Run data fetch
    if run_data_fetch; then
        log "Data fetch successful"
        
        # Database maintenance
        maintain_databases
        
        # Rotate logs
        rotate_logs
        
        send_notification "SUCCESS" "Daily 1-minute data update completed"
        
        log "=========================================="
        log "Daily Update Completed Successfully"
        log "=========================================="
        exit 0
    else
        send_notification "FAILURE" "Daily 1-minute data update failed"
        error_exit "Data fetch failed"
    fi
}

# Execute main function
main "$@"
