#!/bin/bash
#
# LuckyGas System Update Script
#
# Updates system packages, Python dependencies, and performs maintenance tasks

set -euo pipefail

# Configuration
DEPLOY_DIR="/opt/luckygas"
SERVICE_NAME="luckygas-api"
LOG_FILE="/var/log/luckygas/update.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging
log() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${GREEN}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

error() {
    local message="[ERROR] $1"
    echo -e "${RED}${message}${NC}" >&2
    echo "$message" >> "$LOG_FILE"
    exit 1
}

warning() {
    local message="[WARNING] $1"
    echo -e "${YELLOW}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

# Check permissions
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root or with sudo"
    fi
}

# Create backup before update
create_pre_update_backup() {
    log "Creating pre-update backup..."
    
    if [[ -x "$DEPLOY_DIR/scripts/backup.sh" ]]; then
        "$DEPLOY_DIR/scripts/backup.sh"
    else
        warning "Backup script not found, skipping backup"
    fi
}

# Update system packages
update_system_packages() {
    log "Updating system packages..."
    
    # Detect OS
    if [[ -f /etc/debian_version ]]; then
        # Debian/Ubuntu
        apt-get update
        apt-get upgrade -y
        apt-get autoremove -y
        apt-get autoclean
    elif [[ -f /etc/redhat-release ]]; then
        # RHEL/CentOS
        yum update -y
        yum autoremove -y
    else
        warning "Unknown OS, skipping system package updates"
    fi
    
    log "System packages updated"
}

# Update Python dependencies
update_python_dependencies() {
    log "Updating Python dependencies..."
    
    cd "$DEPLOY_DIR"
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Update pip itself
    pip install --upgrade pip setuptools wheel
    
    # Update all dependencies
    pip install --upgrade -r requirements.txt
    
    # Security audit
    if command -v pip-audit &> /dev/null; then
        log "Running security audit..."
        pip-audit || warning "Security vulnerabilities found in dependencies"
    else
        pip install pip-audit
        pip-audit || warning "Security vulnerabilities found in dependencies"
    fi
    
    deactivate
    
    log "Python dependencies updated"
}

# Update git repository
update_git_repository() {
    log "Checking for code updates..."
    
    cd "$DEPLOY_DIR"
    
    # Check if there are uncommitted changes
    if [[ -n $(git status --porcelain) ]]; then
        warning "Uncommitted changes detected, skipping git update"
        return
    fi
    
    # Fetch latest changes
    sudo -u luckygas git fetch origin
    
    # Check if update is needed
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    
    if [[ "$LOCAL" == "$REMOTE" ]]; then
        log "Code is already up to date"
    else
        log "New version available, updating..."
        
        # Stop service
        systemctl stop "$SERVICE_NAME"
        
        # Pull changes
        sudo -u luckygas git pull origin main
        
        # Run database migrations if needed
        if [[ -f "$DEPLOY_DIR/src/main/python/core/database.py" ]]; then
            log "Running database migrations..."
            sudo -u luckygas "$DEPLOY_DIR/venv/bin/python" "$DEPLOY_DIR/src/main/python/core/database.py"
        fi
        
        # Start service
        systemctl start "$SERVICE_NAME"
        
        log "Code updated successfully"
    fi
}

# Clean up old files
cleanup_old_files() {
    log "Cleaning up old files..."
    
    # Clean Python cache
    find "$DEPLOY_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$DEPLOY_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
    
    # Clean old logs (keep last 30 days)
    find /var/log/luckygas -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    # Clean old backups (handled by backup script, but double-check)
    if [[ -d "$DEPLOY_DIR/backups" ]]; then
        find "$DEPLOY_DIR/backups" -name "*.tar.gz" -mtime +30 -delete 2>/dev/null || true
    fi
    
    log "Cleanup completed"
}

# Update SSL certificates
update_ssl_certificates() {
    log "Checking SSL certificates..."
    
    if command -v certbot &> /dev/null; then
        # Renew certificates if needed
        certbot renew --quiet --non-interactive
        
        # Reload nginx if certificates were renewed
        if [[ -f /var/log/letsencrypt/letsencrypt.log ]]; then
            if grep -q "Cert is due for renewal" /var/log/letsencrypt/letsencrypt.log; then
                systemctl reload nginx || true
                log "SSL certificates renewed"
            fi
        fi
    else
        log "Certbot not installed, skipping SSL certificate check"
    fi
}

# Database maintenance
database_maintenance() {
    log "Performing database maintenance..."
    
    # PostgreSQL maintenance
    if command -v psql &> /dev/null && [[ -n "${DB_HOST:-}" ]]; then
        log "Running PostgreSQL VACUUM..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "VACUUM ANALYZE;" || true
        
        log "Running PostgreSQL REINDEX..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "REINDEX DATABASE $DB_NAME;" || true
    fi
    
    # SQLite maintenance
    if [[ -f "$DEPLOY_DIR/data/luckygas.db" ]]; then
        log "Running SQLite VACUUM..."
        sqlite3 "$DEPLOY_DIR/data/luckygas.db" "VACUUM;" || true
        
        log "Running SQLite integrity check..."
        sqlite3 "$DEPLOY_DIR/data/luckygas.db" "PRAGMA integrity_check;" || true
    fi
    
    log "Database maintenance completed"
}

# Service health check
service_health_check() {
    log "Checking service health..."
    
    # Check systemd services
    local services=("luckygas-api" "luckygas-monitor" "nginx" "postgresql" "redis")
    
    for service in "${services[@]}"; do
        if systemctl is-active "$service" &>/dev/null; then
            log "✓ $service is running"
        else
            if systemctl list-unit-files | grep -q "$service"; then
                warning "✗ $service is not running"
            fi
        fi
    done
    
    # Check API endpoint
    if curl -f -s http://localhost:8000/health > /dev/null; then
        log "✓ API is responding"
    else
        error "✗ API health check failed"
    fi
}

# Generate update report
generate_report() {
    local report_file="/var/log/luckygas/update_report_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "=== LuckyGas Update Report ==="
        echo "Date: $(date)"
        echo "Hostname: $(hostname)"
        echo
        echo "System Information:"
        echo "- OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '"')"
        echo "- Kernel: $(uname -r)"
        echo "- Python: $(python3 --version)"
        echo
        echo "Service Status:"
        systemctl status luckygas-api --no-pager | head -5
        echo
        echo "Disk Usage:"
        df -h "$DEPLOY_DIR"
        echo
        echo "Recent Errors (last 24h):"
        grep -i "error\|critical" /var/log/luckygas/*.log 2>/dev/null | tail -10 || echo "No recent errors"
        echo
        echo "Update completed at: $(date)"
    } > "$report_file"
    
    log "Update report saved to: $report_file"
}

# Main update process
main() {
    log "=== LuckyGas Update Script Started ==="
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    
    check_permissions
    
    # Load environment variables
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        source "$DEPLOY_DIR/.env"
    fi
    
    # Run updates based on arguments
    case "${1:-all}" in
        system)
            update_system_packages
            ;;
        python)
            update_python_dependencies
            ;;
        code)
            create_pre_update_backup
            update_git_repository
            ;;
        maintenance)
            cleanup_old_files
            database_maintenance
            ;;
        ssl)
            update_ssl_certificates
            ;;
        all)
            create_pre_update_backup
            update_system_packages
            update_python_dependencies
            update_git_repository
            cleanup_old_files
            update_ssl_certificates
            database_maintenance
            ;;
        *)
            echo "Usage: $0 [all|system|python|code|maintenance|ssl]"
            echo "  all         - Run all updates (default)"
            echo "  system      - Update system packages only"
            echo "  python      - Update Python dependencies only"
            echo "  code        - Update application code only"
            echo "  maintenance - Run maintenance tasks only"
            echo "  ssl         - Update SSL certificates only"
            exit 1
            ;;
    esac
    
    # Always run health check at the end
    service_health_check
    generate_report
    
    log "=== Update completed successfully ==="
}

# Run main function
main "$@"