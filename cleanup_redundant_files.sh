#!/bin/bash
# LuckyGas Redundancy Cleanup Script
# Generated from REDUNDANCY_CLEANUP_REPORT.md

echo "🧹 LuckyGas Redundancy Cleanup Script"
echo "====================================="
echo ""

# Dry run mode by default
DRY_RUN=true
if [ "$1" == "--execute" ]; then
    DRY_RUN=false
    echo "⚠️  EXECUTING CLEANUP (not a dry run)"
else
    echo "📋 DRY RUN MODE - No files will be deleted"
    echo "   To execute cleanup, run: ./cleanup_redundant_files.sh --execute"
fi
echo ""

# Function to remove files/directories
remove_item() {
    local item=$1
    local type=$2
    
    if [ -e "$item" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo "   Would remove $type: $item"
        else
            if [ "$type" = "directory" ]; then
                rm -rf "$item"
            else
                rm -f "$item"
            fi
            echo "   ✓ Removed $type: $item"
        fi
    fi
}

# 1. Remove log files
echo "1. Cleaning up log files..."
for log in server_test.log server_final.log server_new.log server.log server_fresh.log; do
    remove_item "$log" "file"
done
remove_item "src/main/js/node_modules/nwsapi/dist/lint.log" "file"
echo ""

# 2. Remove Python cache directories
echo "2. Cleaning up Python cache..."
find . -type d -name "__pycache__" 2>/dev/null | while read dir; do
    remove_item "$dir" "directory"
done
remove_item ".pytest_cache" "directory"
remove_item ".coverage" "file"
echo ""

# 3. Remove test artifacts
echo "3. Cleaning up test artifacts..."
remove_item "tests/screenshots" "directory"
remove_item "tests/playwright_test_report.html" "file"
remove_item "tests/playwright-junit.xml" "file"
remove_item "test_modal_fix.html" "file"
remove_item "tests/debug/test_management_interface.html" "file"
remove_item "tests/debug/management_interface_test.png" "file"
remove_item "src/main/python/web/security/test_xss_prevention.html" "file"
echo ""

# 4. Remove OS system files
echo "4. Cleaning up OS system files..."
find . -name ".DS_Store" -type f 2>/dev/null | while read file; do
    remove_item "$file" "file"
done
echo ""

# 5. Count migration examples (but don't remove automatically)
echo "5. Migration examples found (review before removal):"
find . -name "*migration-example*" -type f 2>/dev/null | while read file; do
    echo "   - $file"
done
echo ""

# Summary
if [ "$DRY_RUN" = true ]; then
    echo "✅ Dry run complete. Review the files above."
    echo "   To execute cleanup, run: ./cleanup_redundant_files.sh --execute"
else
    echo "✅ Cleanup complete!"
    
    # Update .gitignore if needed
    if ! grep -q "__pycache__" .gitignore 2>/dev/null; then
        echo ""
        echo "📝 Adding entries to .gitignore..."
        cat >> .gitignore << 'EOF'

# Redundancy cleanup additions
__pycache__/
.pytest_cache/
.coverage
*.log
server*.log
.DS_Store
tests/screenshots/
tests/*.html
tests/*.xml
*.tmp
*.bak
*~
EOF
        echo "   ✓ Updated .gitignore"
    fi
fi

echo ""
echo "For detailed analysis, see: docs/REDUNDANCY_CLEANUP_REPORT.md"