#!/bin/bash

# LuckyGas Unnecessary Code Cleanup Script
# Generated from deep analysis on July 17, 2025
# 
# IMPORTANT: This script removes ~21,000 lines of unnecessary code
# Review each section before executing. Some removals require architectural decisions.
#
# Usage: 
#   ./cleanup_unnecessary_code.sh --dry-run    # Preview what will be removed
#   ./cleanup_unnecessary_code.sh --safe       # Remove only safe items
#   ./cleanup_unnecessary_code.sh --all        # Remove all (requires confirmation)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script mode
MODE="interactive"
if [[ "$1" == "--dry-run" ]]; then
    MODE="dry-run"
elif [[ "$1" == "--safe" ]]; then
    MODE="safe"
elif [[ "$1" == "--all" ]]; then
    MODE="all"
fi

# Dry run function
remove_file() {
    if [[ "$MODE" == "dry-run" ]]; then
        echo -e "${BLUE}[DRY-RUN]${NC} Would remove: $1"
    else
        if [[ -f "$1" ]]; then
            rm -f "$1"
            echo -e "${GREEN}[REMOVED]${NC} $1"
        else
            echo -e "${YELLOW}[SKIPPED]${NC} $1 (not found)"
        fi
    fi
}

remove_directory() {
    if [[ "$MODE" == "dry-run" ]]; then
        echo -e "${BLUE}[DRY-RUN]${NC} Would remove directory: $1"
    else
        if [[ -d "$1" ]]; then
            rm -rf "$1"
            echo -e "${GREEN}[REMOVED]${NC} Directory: $1"
        else
            echo -e "${YELLOW}[SKIPPED]${NC} Directory: $1 (not found)"
        fi
    fi
}

echo "================================================"
echo "LuckyGas Unnecessary Code Cleanup"
echo "Mode: $MODE"
echo "Estimated removal: ~21,000 lines"
echo "================================================"
echo ""

# ==============================================================================
# SECTION 1: SAFE REMOVALS (Low Risk)
# These are clearly unnecessary files that can be safely removed
# ==============================================================================

echo -e "${GREEN}=== SECTION 1: SAFE REMOVALS (Demo/Example/Test Files) ===${NC}"
echo "These files are safe to remove - no production impact"
echo ""

# Obsolete test files
echo "Removing obsolete test files..."
remove_file "tests/simple_test.py"
remove_file "tests/webpage_test.py"
remove_file "tests/verify_test_fixes.py"
remove_file "tests/test_delivery_tabs_simple.py"
remove_file "tests/debug/swagger_browser_test.html"

# Demo and example files
echo "Removing demo/example files..."
remove_file "examples/scheduling_demo.py"
remove_file "setup_demo_data.py"
remove_file "src/main/python/web/modules/components/features/settings-demo.html"
remove_file "src/main/python/web/modules/components/examples/component-examples.js"
remove_file "src/main/python/web/modules/components/__tests__/example.test.js"
remove_file "src/main/js/state/example-integration.js"
remove_file "security/xss_migration_examples.js"

# Remove entire examples directory if it exists
remove_directory "examples"
remove_directory "src/main/python/web/modules/components/examples"
remove_directory "src/main/python/web/modules/components/__tests__"

# Duplicate files
echo "Removing duplicate files..."
remove_file "src/main/python/web/ClientManager 2.js"  # Note the space in filename

# Empty/unnecessary files
echo "Removing empty/unnecessary files..."
remove_file "package.json"  # Empty file in root
remove_file "src/main/js/index.html"  # Unused HTML file

# ==============================================================================
# SECTION 2: UNIMPLEMENTED FEATURES (Medium Risk)
# Code for features that were never built or integrated
# ==============================================================================

if [[ "$MODE" == "safe" ]]; then
    echo ""
    echo -e "${YELLOW}=== Stopping at safe removals only ===${NC}"
    echo "Use --all flag to remove unimplemented features and architectural decisions"
    exit 0
fi

echo ""
echo -e "${YELLOW}=== SECTION 2: UNIMPLEMENTED FEATURES (Medium Risk) ===${NC}"
echo "These are for features that don't exist in the product"

if [[ "$MODE" == "interactive" ]]; then
    echo -e "${YELLOW}Remove unimplemented feature code? (y/n)${NC}"
    read -r response
    if [[ "$response" != "y" ]]; then
        echo "Skipping unimplemented features..."
    else
        MODE="continue"
    fi
fi

if [[ "$MODE" == "all" || "$MODE" == "continue" || "$MODE" == "dry-run" ]]; then
    # Test files for non-existent features
    echo "Removing tests for non-existent features..."
    remove_file "tests/e2e/test_mobile_driver_app.py"
    remove_file "tests/e2e/test_prediction_optimization.py"
    
    # Unused services (never imported anywhere)
    echo "Removing unused service files..."
    remove_file "src/main/python/services/prediction_service.py"
    remove_file "src/main/python/services/delivery_tracking_service.py"
    remove_file "src/main/python/services/cloud_scheduling_service.py"
    remove_file "src/main/python/services/cloud_route_service.py"
    
    # Note: client_service.py might be used indirectly, needs verification
    echo -e "${YELLOW}[MANUAL CHECK REQUIRED]${NC} src/main/python/services/client_service.py"
fi

# ==============================================================================
# SECTION 3: ARCHITECTURAL DECISION REQUIRED (High Risk)
# The ES6 module system - requires explicit decision
# ==============================================================================

echo ""
echo -e "${RED}=== SECTION 3: ARCHITECTURAL DECISION REQUIRED ===${NC}"
echo "ES6 Module System: ~15,000 lines of modernized but disconnected code"
echo "Location: src/main/python/web/modules/"
echo ""
echo "This represents a complete frontend rewrite that was never integrated."
echo "Options:"
echo "  1. Keep and complete migration (2-3 weeks effort)"
echo "  2. Remove entirely (immediate 15K line reduction)"
echo ""

if [[ "$MODE" == "all" || "$MODE" == "dry-run" ]]; then
    if [[ "$MODE" != "dry-run" ]]; then
        echo -e "${RED}CRITICAL: Remove the entire ES6 module system? (yes/no - type full word)${NC}"
        read -r response
        if [[ "$response" == "yes" ]]; then
            echo "Removing ES6 module system..."
            remove_directory "src/main/python/web/modules"
            
            # Also remove migration-related files
            echo "Removing migration guides..."
            remove_file "src/main/js/core/api/migration-guide.md"
            remove_file "modules/api/MIGRATION_GUIDE.md"
            remove_file "modules/components/MIGRATION_GUIDE.md"
            remove_file "modules/state/MIGRATION_PROGRESS.md"
        else
            echo "Keeping ES6 module system. Consider completing the migration."
        fi
    else
        echo -e "${BLUE}[DRY-RUN]${NC} Would prompt for ES6 module system removal"
        remove_directory "src/main/python/web/modules"
    fi
else
    echo -e "${YELLOW}Skipping ES6 module decision (requires --all flag)${NC}"
fi

# ==============================================================================
# SECTION 4: UNUSED UTILITIES (Low-Medium Risk)
# Utility functions that are never called
# ==============================================================================

echo ""
echo -e "${YELLOW}=== SECTION 4: UNUSED UTILITIES ===${NC}"
echo "These utilities are defined but never used in the codebase"

# These would need to be removed carefully from their respective files
echo -e "${YELLOW}[MANUAL REMOVAL REQUIRED]${NC} Unused GoogleMapsClient methods in google_maps_client.py:"
echo "  - reverse_geocode() (lines 108-131)"
echo "  - get_place_details() (lines 320-342)"
echo "  - find_nearby_places() (lines 344-378)"
echo "  - get_timezone() (lines 380-407)"
echo "  - validate_api_key() (lines 432-445)"

echo ""
echo -e "${YELLOW}[MANUAL REMOVAL REQUIRED]${NC} Unused data.js utilities in modules/utils/data.js:"
echo "  - sortByMultiple(), avgBy(), minBy(), maxBy()"
echo "  - deepClone(), deepMerge(), pick(), omit()"
echo "  - toLookup(), flatten(), chunk()"

# ==============================================================================
# SECTION 5: CONSOLIDATION OPPORTUNITIES
# ==============================================================================

echo ""
echo -e "${BLUE}=== SECTION 5: CONSOLIDATION OPPORTUNITIES ===${NC}"
echo "These require manual consolidation:"
echo ""
echo "1. Service Layer Pattern:"
echo "   - Either fully adopt service pattern or remove service layer"
echo "   - Currently using direct database queries in routers"
echo ""
echo "2. Security Utilities:"
echo "   - Multiple implementations across different files"
echo "   - Need consolidation into single security module"
echo ""
echo "3. Unused API Endpoints:"
echo "   - Review and remove from routers if confirmed unused:"
echo "     • /api/deliveries/{id}/assign"
echo "     • /api/drivers/{id}/toggle-availability"
echo "     • /api/drivers/{id}/deliveries"
echo "     • /api/vehicles/{id}/assign-driver"
echo "     • /api/vehicles/maintenance/due"
echo "     • /api/scheduling/* endpoints"

# ==============================================================================
# SUMMARY
# ==============================================================================

echo ""
echo "================================================"
echo "CLEANUP SUMMARY"
echo "================================================"

if [[ "$MODE" == "dry-run" ]]; then
    echo -e "${BLUE}DRY RUN COMPLETE${NC}"
    echo "No files were actually removed."
    echo "Run without --dry-run to perform actual cleanup."
else
    echo -e "${GREEN}CLEANUP COMPLETE${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Review any [MANUAL CHECK REQUIRED] items above"
    echo "2. Run tests to ensure nothing broke"
    echo "3. Consider the architectural decisions highlighted"
    echo "4. Commit changes with clear message about cleanup"
fi

echo ""
echo "Estimated code reduction: ~21,000 lines"
echo "================================================"