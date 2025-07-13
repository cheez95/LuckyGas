#!/bin/bash
#
# LuckyGas Database Restore Script
#
# Restores database and configuration from backup

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/luckygas/backups}"
DEPLOY_DIR="/opt/luckygas"
SERVICE_NAME="luckygas-api"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check permissions
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root or with sudo"
    fi
}

# List available backups
list_backups() {
    echo "Available backups:"
    echo "=================="
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        error "Backup directory not found: $BACKUP_DIR"
    fi
    
    local backups=($(ls -t "$BACKUP_DIR"/luckygas_backup_*.tar.gz 2>/dev/null))
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        error "No backups found in $BACKUP_DIR"
    fi
    
    for i in "${!backups[@]}"; do
        local backup_file="${backups[$i]}"
        local backup_name=$(basename "$backup_file")
        local backup_size=$(du -h "$backup_file" | cut -f1)
        local backup_date=$(stat -c %y "$backup_file" 2>/dev/null || stat -f %Sm "$backup_file")
        
        echo "$((i+1)). $backup_name ($backup_size) - $backup_date"
    done
    
    echo
}

# Select backup
select_backup() {
    list_backups
    
    local backups=($(ls -t "$BACKUP_DIR"/luckygas_backup_*.tar.gz 2>/dev/null))
    
    echo -n "Select backup number to restore (or enter filename): "
    read selection
    
    # Check if selection is a number
    if [[ "$selection" =~ ^[0-9]+$ ]]; then
        local index=$((selection - 1))
        if [[ $index -ge 0 && $index -lt ${#backups[@]} ]]; then
            SELECTED_BACKUP="${backups[$index]}"
        else
            error "Invalid selection"
        fi
    else
        # Check if it's a valid filename
        if [[ -f "$BACKUP_DIR/$selection" ]]; then
            SELECTED_BACKUP="$BACKUP_DIR/$selection"
        elif [[ -f "$selection" ]]; then
            SELECTED_BACKUP="$selection"
        else
            error "Backup file not found: $selection"
        fi
    fi
    
    log "Selected backup: $(basename "$SELECTED_BACKUP")"
}

# Confirm restore
confirm_restore() {
    warning "This will restore the database and configuration from the selected backup."
    warning "Current data will be overwritten!"
    echo
    echo -n "Are you sure you want to continue? (yes/no): "
    read confirmation
    
    if [[ "$confirmation" != "yes" ]]; then
        log "Restore cancelled"
        exit 0
    fi
}

# Extract backup
extract_backup() {
    log "Extracting backup..."
    
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT
    
    tar -xzf "$SELECTED_BACKUP" -C "$TEMP_DIR"
    
    # Find the backup directory
    BACKUP_CONTENT_DIR=$(find "$TEMP_DIR" -name "luckygas_backup_*" -type d | head -1)
    
    if [[ -z "$BACKUP_CONTENT_DIR" ]]; then
        error "Invalid backup format"
    fi
    
    log "Backup extracted to temporary directory"
}

# Stop services
stop_services() {
    log "Stopping services..."
    
    systemctl stop "$SERVICE_NAME" || true
    systemctl stop luckygas-monitor || true
    
    # Wait for services to stop
    sleep 3
}

# Restore database
restore_database() {
    log "Restoring database..."
    
    # PostgreSQL restore
    if [[ -f "$BACKUP_CONTENT_DIR/database.sql" ]] && command -v psql &> /dev/null; then
        log "Restoring PostgreSQL database..."
        
        # Load environment variables
        if [[ -f "$DEPLOY_DIR/.env" ]]; then
            source "$DEPLOY_DIR/.env"
        fi
        
        # Drop and recreate database
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
        
        # Restore data
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_CONTENT_DIR/database.sql"
        
        if [[ $? -eq 0 ]]; then
            log "PostgreSQL database restored successfully"
        else
            error "PostgreSQL restore failed"
        fi
    fi
    
    # SQLite restore
    if [[ -f "$BACKUP_CONTENT_DIR/luckygas.db" ]]; then
        log "Restoring SQLite database..."
        
        # Backup current database
        if [[ -f "$DEPLOY_DIR/data/luckygas.db" ]]; then
            mv "$DEPLOY_DIR/data/luckygas.db" "$DEPLOY_DIR/data/luckygas.db.before_restore"
        fi
        
        # Copy restored database
        cp "$BACKUP_CONTENT_DIR/luckygas.db" "$DEPLOY_DIR/data/luckygas.db"
        chown luckygas:luckygas "$DEPLOY_DIR/data/luckygas.db"
        chmod 640 "$DEPLOY_DIR/data/luckygas.db"
        
        log "SQLite database restored successfully"
    fi
}

# Restore configuration
restore_configuration() {
    log "Restoring configuration..."
    
    # Restore .env file
    if [[ -f "$BACKUP_CONTENT_DIR/.env" ]]; then
        # Backup current .env
        if [[ -f "$DEPLOY_DIR/.env" ]]; then
            cp "$DEPLOY_DIR/.env" "$DEPLOY_DIR/.env.before_restore"
        fi
        
        cp "$BACKUP_CONTENT_DIR/.env" "$DEPLOY_DIR/.env"
        chown luckygas:luckygas "$DEPLOY_DIR/.env"
        chmod 600 "$DEPLOY_DIR/.env"
        
        log "Configuration file restored"
    fi
    
    # Restore uploads
    if [[ -f "$BACKUP_CONTENT_DIR/uploads.tar.gz" ]]; then
        log "Restoring uploaded files..."
        
        # Backup current uploads
        if [[ -d "$DEPLOY_DIR/data/uploads" ]]; then
            mv "$DEPLOY_DIR/data/uploads" "$DEPLOY_DIR/data/uploads.before_restore"
        fi
        
        # Extract uploads
        tar -xzf "$BACKUP_CONTENT_DIR/uploads.tar.gz" -C "$DEPLOY_DIR/data/"
        chown -R luckygas:luckygas "$DEPLOY_DIR/data/uploads"
        
        log "Uploaded files restored"
    fi
}

# Start services
start_services() {
    log "Starting services..."
    
    systemctl start "$SERVICE_NAME"
    systemctl start luckygas-monitor || true
    
    # Wait for services to start
    sleep 5
    
    # Health check
    if curl -f -s http://localhost:8000/health > /dev/null; then
        log "Services started successfully"
    else
        error "Service health check failed"
    fi
}

# Show restore summary
show_summary() {
    echo
    echo "=== Restore Summary ==="
    echo "Backup file: $(basename "$SELECTED_BACKUP")"
    echo "Restore completed at: $(date)"
    echo
    echo "Restored components:"
    
    if [[ -f "$BACKUP_CONTENT_DIR/database.sql" ]]; then
        echo "✓ PostgreSQL database"
    fi
    
    if [[ -f "$BACKUP_CONTENT_DIR/luckygas.db" ]]; then
        echo "✓ SQLite database"
    fi
    
    if [[ -f "$BACKUP_CONTENT_DIR/.env" ]]; then
        echo "✓ Configuration file"
    fi
    
    if [[ -f "$BACKUP_CONTENT_DIR/uploads.tar.gz" ]]; then
        echo "✓ Uploaded files"
    fi
    
    echo
    echo "Service status:"
    systemctl status "$SERVICE_NAME" --no-pager | head -5
    echo
    
    # Show metadata if available
    if [[ -f "$BACKUP_CONTENT_DIR/metadata.json" ]]; then
        echo "Backup metadata:"
        cat "$BACKUP_CONTENT_DIR/metadata.json" | jq . 2>/dev/null || cat "$BACKUP_CONTENT_DIR/metadata.json"
    fi
}

# Main restore process
main() {
    log "=== LuckyGas Restore Script ==="
    
    check_permissions
    
    # Check if backup file was provided as argument
    if [[ $# -eq 1 ]]; then
        if [[ -f "$1" ]]; then
            SELECTED_BACKUP="$1"
            log "Using backup file: $1"
        else
            error "Backup file not found: $1"
        fi
    else
        select_backup
    fi
    
    confirm_restore
    extract_backup
    stop_services
    restore_database
    restore_configuration
    start_services
    show_summary
    
    log "Restore completed successfully!"
    
    # Cleanup
    warning "Previous data has been preserved with .before_restore suffix"
    warning "You can manually remove these files after verifying the restore"
}

# Run main function
main "$@"