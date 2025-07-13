#!/bin/bash
#
# LuckyGas Database Backup Script
#
# This script creates backups of the PostgreSQL database
# and important configuration files

set -euo pipefail

# Load environment variables
if [[ -f "/opt/luckygas/.env" ]]; then
    source /opt/luckygas/.env
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/luckygas/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DB_NAME="${DB_NAME:-luckygas}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="luckygas_backup_${TIMESTAMP}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[ERROR] $1" >&2
    exit 1
}

# Create backup
create_backup() {
    log "Starting backup process..."
    
    # Create temporary backup directory
    TEMP_BACKUP_DIR="$BACKUP_DIR/$BACKUP_NAME"
    mkdir -p "$TEMP_BACKUP_DIR"
    
    # Backup PostgreSQL database
    if command -v pg_dump &> /dev/null; then
        log "Backing up PostgreSQL database..."
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -f "$TEMP_BACKUP_DIR/database.sql" \
            --verbose \
            --clean \
            --if-exists \
            --no-owner \
            --no-privileges
        
        if [[ $? -eq 0 ]]; then
            log "Database backup completed successfully"
        else
            error "Database backup failed"
        fi
    else
        log "PostgreSQL not found, skipping database backup"
    fi
    
    # Backup SQLite database if exists
    if [[ -f "/opt/luckygas/data/luckygas.db" ]]; then
        log "Backing up SQLite database..."
        cp "/opt/luckygas/data/luckygas.db" "$TEMP_BACKUP_DIR/luckygas.db"
    fi
    
    # Backup configuration files
    log "Backing up configuration files..."
    if [[ -f "/opt/luckygas/.env" ]]; then
        cp "/opt/luckygas/.env" "$TEMP_BACKUP_DIR/.env"
    fi
    
    # Backup uploaded files if directory exists
    if [[ -d "/opt/luckygas/data/uploads" ]]; then
        log "Backing up uploaded files..."
        tar -czf "$TEMP_BACKUP_DIR/uploads.tar.gz" -C "/opt/luckygas/data" uploads/
    fi
    
    # Create backup metadata
    cat > "$TEMP_BACKUP_DIR/metadata.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_type": "scheduled",
    "database_type": "$(command -v pg_dump &> /dev/null && echo 'postgresql' || echo 'sqlite')",
    "hostname": "$(hostname)",
    "luckygas_version": "$(cd /opt/luckygas && git describe --tags --always 2>/dev/null || echo 'unknown')"
}
EOF
    
    # Compress backup
    log "Compressing backup..."
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    
    # Remove temporary directory
    rm -rf "$TEMP_BACKUP_DIR"
    
    # Calculate backup size
    BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
    log "Backup created: ${BACKUP_NAME}.tar.gz (Size: $BACKUP_SIZE)"
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    # Find and delete old backups
    find "$BACKUP_DIR" -name "luckygas_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    # Count remaining backups
    REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "luckygas_backup_*.tar.gz" -type f | wc -l)
    log "Remaining backups: $REMAINING_BACKUPS"
}

# Upload to cloud storage (optional)
upload_to_cloud() {
    if [[ -n "${AWS_S3_BUCKET:-}" ]] && command -v aws &> /dev/null; then
        log "Uploading backup to S3..."
        aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "s3://$AWS_S3_BUCKET/backups/" \
            --storage-class GLACIER_IR
        
        if [[ $? -eq 0 ]]; then
            log "Backup uploaded to S3 successfully"
        else
            log "Failed to upload backup to S3"
        fi
    fi
    
    # Google Cloud Storage
    if [[ -n "${GCS_BUCKET:-}" ]] && command -v gsutil &> /dev/null; then
        log "Uploading backup to Google Cloud Storage..."
        gsutil cp "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "gs://$GCS_BUCKET/backups/"
        
        if [[ $? -eq 0 ]]; then
            log "Backup uploaded to GCS successfully"
        else
            log "Failed to upload backup to GCS"
        fi
    fi
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"text\": \"LuckyGas Backup $status\",
                \"attachments\": [{
                    \"color\": \"$([ \"$status\" = \"Success\" ] && echo \"good\" || echo \"danger\")\",
                    \"text\": \"$message\"
                }]
            }" 2>/dev/null
    fi
    
    # Email notification
    if [[ -n "${ALERT_EMAIL:-}" ]] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "LuckyGas Backup $status" "$ALERT_EMAIL"
    fi
}

# Main execution
main() {
    log "=== LuckyGas Backup Script Started ==="
    
    # Create lock file to prevent concurrent backups
    LOCK_FILE="/var/run/luckygas_backup.lock"
    if [[ -f "$LOCK_FILE" ]]; then
        error "Another backup is already running"
    fi
    
    # Create lock file
    echo $$ > "$LOCK_FILE"
    trap "rm -f $LOCK_FILE" EXIT
    
    # Run backup
    if create_backup; then
        cleanup_old_backups
        upload_to_cloud
        send_notification "Success" "Backup completed: ${BACKUP_NAME}.tar.gz (Size: $BACKUP_SIZE)"
        log "=== Backup completed successfully ==="
        exit 0
    else
        send_notification "Failed" "Backup failed. Check logs for details."
        error "Backup failed"
    fi
}

# Run main function
main