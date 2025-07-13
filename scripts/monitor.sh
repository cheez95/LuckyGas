#!/bin/bash
#
# LuckyGas System Monitoring Script
#
# Monitors system health and sends alerts when issues are detected

set -euo pipefail

# Load environment variables
if [[ -f "/opt/luckygas/.env" ]]; then
    source /opt/luckygas/.env
fi

# Configuration
API_URL="${API_URL:-http://localhost:8000}"
CHECK_INTERVAL="${MONITOR_CHECK_INTERVAL:-60}"  # seconds
ALERT_THRESHOLD="${MONITOR_ALERT_THRESHOLD:-3}"  # failures before alert
CPU_THRESHOLD="${CPU_THRESHOLD:-80}"
MEMORY_THRESHOLD="${MEMORY_THRESHOLD:-85}"
DISK_THRESHOLD="${DISK_THRESHOLD:-90}"
LOG_FILE="/var/log/luckygas/monitor.log"

# State tracking
FAILURE_COUNT=0
LAST_ALERT_TIME=0

# Logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[ERROR] $1" | tee -a "$LOG_FILE" >&2
}

warning() {
    echo "[WARNING] $1" | tee -a "$LOG_FILE"
}

# Send alert
send_alert() {
    local severity=$1
    local message=$2
    local details=$3
    
    # Rate limiting - don't send same alert more than once per hour
    local current_time=$(date +%s)
    if [[ $((current_time - LAST_ALERT_TIME)) -lt 3600 ]]; then
        return
    fi
    LAST_ALERT_TIME=$current_time
    
    # Log alert
    log "ALERT [$severity]: $message"
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"text\": \"🚨 LuckyGas Alert [$severity]\",
                \"attachments\": [{
                    \"color\": \"$([ \"$severity\" = \"CRITICAL\" ] && echo \"danger\" || echo \"warning\")\",
                    \"title\": \"$message\",
                    \"text\": \"$details\",
                    \"footer\": \"$(hostname)\",
                    \"ts\": \"$current_time\"
                }]
            }" 2>/dev/null
    fi
    
    # Email alert
    if [[ -n "${ALERT_EMAIL:-}" ]] && command -v mail &> /dev/null; then
        echo -e "Alert: $message\n\nDetails:\n$details\n\nHost: $(hostname)\nTime: $(date)" | \
            mail -s "LuckyGas Alert [$severity]: $message" "$ALERT_EMAIL"
    fi
    
    # LINE Notify
    if [[ -n "${LINE_NOTIFY_TOKEN:-}" ]]; then
        curl -X POST https://notify-api.line.me/api/notify \
            -H "Authorization: Bearer $LINE_NOTIFY_TOKEN" \
            -F "message=
🚨 LuckyGas Alert [$severity]
$message
$details" 2>/dev/null
    fi
}

# Check API health
check_api_health() {
    local response
    local status_code
    
    response=$(curl -s -w "\n%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")
    status_code=$(echo "$response" | tail -n 1)
    
    if [[ "$status_code" == "200" ]]; then
        log "API health check: OK"
        FAILURE_COUNT=0
        return 0
    else
        error "API health check failed (HTTP $status_code)"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        
        if [[ $FAILURE_COUNT -ge $ALERT_THRESHOLD ]]; then
            send_alert "CRITICAL" "API is not responding" \
                "The API at $API_URL is not responding. HTTP status: $status_code"
        fi
        return 1
    fi
}

# Check system resources
check_system_resources() {
    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | cut -d'.' -f1)
    if [[ $cpu_usage -gt $CPU_THRESHOLD ]]; then
        warning "High CPU usage: $cpu_usage%"
        send_alert "WARNING" "High CPU usage detected" \
            "CPU usage is at $cpu_usage% (threshold: $CPU_THRESHOLD%)"
    fi
    
    # Memory usage
    local memory_usage=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    if [[ $memory_usage -gt $MEMORY_THRESHOLD ]]; then
        warning "High memory usage: $memory_usage%"
        send_alert "WARNING" "High memory usage detected" \
            "Memory usage is at $memory_usage% (threshold: $MEMORY_THRESHOLD%)"
    fi
    
    # Disk usage
    local disk_usage=$(df -h /opt/luckygas | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ $disk_usage -gt $DISK_THRESHOLD ]]; then
        warning "High disk usage: $disk_usage%"
        send_alert "WARNING" "High disk usage detected" \
            "Disk usage is at $disk_usage% (threshold: $DISK_THRESHOLD%)"
    fi
    
    log "System resources - CPU: $cpu_usage%, Memory: $memory_usage%, Disk: $disk_usage%"
}

# Check database connection
check_database() {
    if command -v psql &> /dev/null && [[ -n "${DB_HOST:-}" ]]; then
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null; then
            log "Database connection: OK"
            return 0
        else
            error "Database connection failed"
            send_alert "CRITICAL" "Database connection failed" \
                "Cannot connect to PostgreSQL database at $DB_HOST"
            return 1
        fi
    fi
    
    # Check SQLite if exists
    if [[ -f "/opt/luckygas/data/luckygas.db" ]]; then
        if sqlite3 "/opt/luckygas/data/luckygas.db" "SELECT 1" &>/dev/null; then
            log "SQLite database: OK"
            return 0
        else
            error "SQLite database check failed"
            return 1
        fi
    fi
}

# Check log files for errors
check_logs() {
    local error_count=0
    local log_dir="/var/log/luckygas"
    
    if [[ -d "$log_dir" ]]; then
        # Check for errors in last 5 minutes
        error_count=$(find "$log_dir" -name "*.log" -mmin -5 -exec grep -i "error\|exception\|critical" {} \; | wc -l)
        
        if [[ $error_count -gt 10 ]]; then
            warning "Found $error_count errors in recent logs"
            send_alert "WARNING" "High error rate in logs" \
                "Found $error_count errors in logs within last 5 minutes"
        fi
    fi
}

# Check service status
check_services() {
    local services=("luckygas-api" "postgresql" "nginx" "redis")
    
    for service in "${services[@]}"; do
        if systemctl is-active "$service" &>/dev/null; then
            log "Service $service: active"
        else
            # Check if service exists
            if systemctl list-unit-files | grep -q "$service"; then
                warning "Service $service is not active"
                
                # Try to restart if it's our service
                if [[ "$service" == "luckygas-api" ]]; then
                    log "Attempting to restart $service..."
                    if systemctl restart "$service"; then
                        log "Successfully restarted $service"
                        send_alert "WARNING" "Service restarted" \
                            "The $service was down and has been automatically restarted"
                    else
                        send_alert "CRITICAL" "Service restart failed" \
                            "Failed to restart $service. Manual intervention required."
                    fi
                fi
            fi
        fi
    done
}

# Performance metrics
collect_metrics() {
    local timestamp=$(date +%s)
    local metrics_file="/var/log/luckygas/metrics.json"
    
    # Collect various metrics
    local api_response_time=$(curl -o /dev/null -s -w '%{time_total}' "$API_URL/health" || echo "0")
    local active_connections=$(ss -tn state established '( sport = :8000 )' | wc -l)
    
    # Write metrics
    cat > "$metrics_file" << EOF
{
    "timestamp": $timestamp,
    "api_response_time": $api_response_time,
    "active_connections": $active_connections,
    "cpu_usage": $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1),
    "memory_usage": $(free | grep Mem | awk '{print int($3/$2 * 100)}'),
    "disk_usage": $(df -h /opt/luckygas | tail -1 | awk '{print $5}' | sed 's/%//')
}
EOF
}

# Main monitoring loop
main() {
    log "=== LuckyGas Monitor Started ==="
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Main loop
    while true; do
        # Run checks
        check_api_health
        check_system_resources
        check_database
        check_logs
        check_services
        collect_metrics
        
        # Sleep until next check
        sleep "$CHECK_INTERVAL"
    done
}

# Handle signals
trap 'log "Monitor shutting down..."; exit 0' SIGTERM SIGINT

# Run main function
main