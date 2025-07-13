#!/bin/bash
#
# LuckyGas Production Deployment Script
# 
# Usage: ./deploy-production.sh [options]
# Options:
#   --full        Full deployment with database migration
#   --quick       Quick deployment (code only)
#   --rollback    Rollback to previous version
#   --help        Show this help message

set -euo pipefail

# Configuration
DEPLOY_USER="luckygas"
DEPLOY_DIR="/opt/luckygas"
BACKUP_DIR="/opt/luckygas/backups"
LOG_DIR="/var/log/luckygas"
SERVICE_NAME="luckygas-api"
REPO_URL="https://github.com/cheez95/LuckyGas.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root or with sudo
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root or with sudo"
        exit 1
    fi
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check if deployment directory exists
    if [[ ! -d "$DEPLOY_DIR" ]]; then
        error "Deployment directory $DEPLOY_DIR does not exist"
        exit 1
    fi
    
    # Check if user exists
    if ! id "$DEPLOY_USER" &>/dev/null; then
        error "User $DEPLOY_USER does not exist"
        exit 1
    fi
    
    # Check if systemd service exists
    if ! systemctl list-unit-files | grep -q "$SERVICE_NAME"; then
        warning "Service $SERVICE_NAME not found. Will need to install it."
    fi
    
    # Check disk space (need at least 1GB free)
    available_space=$(df -BG "$DEPLOY_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ $available_space -lt 1 ]]; then
        error "Insufficient disk space. At least 1GB required."
        exit 1
    fi
    
    log "Pre-deployment checks passed"
}

# Backup current deployment
backup_current() {
    log "Backing up current deployment..."
    
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    # Create backup directory
    sudo -u "$DEPLOY_USER" mkdir -p "$backup_path"
    
    # Backup code
    sudo -u "$DEPLOY_USER" cp -r "$DEPLOY_DIR/src" "$backup_path/"
    
    # Backup configuration
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        sudo -u "$DEPLOY_USER" cp "$DEPLOY_DIR/.env" "$backup_path/"
    fi
    
    # Backup database
    if command -v pg_dump &> /dev/null; then
        log "Backing up PostgreSQL database..."
        sudo -u postgres pg_dump luckygas > "$backup_path/database.sql"
        chown "$DEPLOY_USER:$DEPLOY_USER" "$backup_path/database.sql"
    fi
    
    # Create backup metadata
    cat > "$backup_path/metadata.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "git_commit": "$(cd $DEPLOY_DIR && git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "deployment_type": "$1"
}
EOF
    
    # Keep only last 10 backups
    ls -t "$BACKUP_DIR" | tail -n +11 | xargs -I {} rm -rf "$BACKUP_DIR/{}"
    
    log "Backup completed: $backup_path"
}

# Deploy new code
deploy_code() {
    log "Deploying new code..."
    
    cd "$DEPLOY_DIR"
    
    # Stop service
    log "Stopping $SERVICE_NAME service..."
    systemctl stop "$SERVICE_NAME" || true
    
    # Pull latest code
    log "Pulling latest code from repository..."
    sudo -u "$DEPLOY_USER" git fetch origin
    sudo -u "$DEPLOY_USER" git reset --hard origin/main
    
    # Update Python dependencies
    log "Installing Python dependencies..."
    sudo -u "$DEPLOY_USER" "$DEPLOY_DIR/venv/bin/pip" install -r requirements.txt --upgrade
    
    # Run database migrations if needed
    if [[ "$1" == "--full" ]]; then
        log "Running database initialization..."
        sudo -u "$DEPLOY_USER" "$DEPLOY_DIR/venv/bin/python" "$DEPLOY_DIR/src/main/python/core/database.py"
    fi
    
    # Set correct permissions
    chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR"
    chmod -R 755 "$DEPLOY_DIR"
    chmod 600 "$DEPLOY_DIR/.env"
    
    # Ensure log directory exists
    mkdir -p "$LOG_DIR"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$LOG_DIR"
}

# Post-deployment tasks
post_deployment() {
    log "Running post-deployment tasks..."
    
    # Reload systemd
    systemctl daemon-reload
    
    # Start service
    log "Starting $SERVICE_NAME service..."
    systemctl start "$SERVICE_NAME"
    
    # Wait for service to be ready
    sleep 5
    
    # Health check
    log "Running health check..."
    if curl -f -s http://localhost:8000/health > /dev/null; then
        log "Health check passed"
    else
        error "Health check failed"
        systemctl status "$SERVICE_NAME" --no-pager
        exit 1
    fi
    
    # Enable service if not already enabled
    systemctl enable "$SERVICE_NAME" 2>/dev/null || true
    systemctl enable luckygas-backup.timer 2>/dev/null || true
    systemctl enable luckygas-monitor 2>/dev/null || true
    
    log "Post-deployment tasks completed"
}

# Rollback to previous version
rollback() {
    log "Rolling back to previous version..."
    
    # Find latest backup
    latest_backup=$(ls -t "$BACKUP_DIR" | head -n 1)
    
    if [[ -z "$latest_backup" ]]; then
        error "No backup found to rollback to"
        exit 1
    fi
    
    backup_path="$BACKUP_DIR/$latest_backup"
    log "Rolling back to: $latest_backup"
    
    # Stop service
    systemctl stop "$SERVICE_NAME"
    
    # Restore code
    rm -rf "$DEPLOY_DIR/src"
    cp -r "$backup_path/src" "$DEPLOY_DIR/"
    
    # Restore configuration
    if [[ -f "$backup_path/.env" ]]; then
        cp "$backup_path/.env" "$DEPLOY_DIR/"
    fi
    
    # Restore database if available
    if [[ -f "$backup_path/database.sql" ]]; then
        log "Restoring database..."
        sudo -u postgres psql luckygas < "$backup_path/database.sql"
    fi
    
    # Set permissions
    chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR"
    
    # Start service
    systemctl start "$SERVICE_NAME"
    
    log "Rollback completed"
}

# Show deployment status
show_status() {
    echo "=== LuckyGas Deployment Status ==="
    echo
    echo "Service Status:"
    systemctl status "$SERVICE_NAME" --no-pager | head -n 5
    echo
    echo "Recent Logs:"
    journalctl -u "$SERVICE_NAME" -n 10 --no-pager
    echo
    echo "API Health:"
    curl -s http://localhost:8000/health | jq . 2>/dev/null || echo "API not responding"
    echo
    echo "Disk Usage:"
    df -h "$DEPLOY_DIR"
    echo
    echo "Recent Backups:"
    ls -lh "$BACKUP_DIR" | head -n 5
}

# Main deployment flow
main() {
    local deployment_type="${1:---quick}"
    
    case "$deployment_type" in
        --full)
            check_permissions
            pre_deployment_checks
            backup_current "full"
            deploy_code "--full"
            post_deployment
            show_status
            log "Full deployment completed successfully!"
            ;;
        --quick)
            check_permissions
            pre_deployment_checks
            backup_current "quick"
            deploy_code "--quick"
            post_deployment
            show_status
            log "Quick deployment completed successfully!"
            ;;
        --rollback)
            check_permissions
            rollback
            show_status
            ;;
        --status)
            show_status
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --full        Full deployment with database migration"
            echo "  --quick       Quick deployment (code only) [default]"
            echo "  --rollback    Rollback to previous version"
            echo "  --status      Show deployment status"
            echo "  --help        Show this help message"
            ;;
        *)
            error "Unknown option: $deployment_type"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"