#!/bin/bash

# LuckyGas Test Runner Script

echo "🧪 LuckyGas Test Suite Runner"
echo "============================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pip install -q -r requirements.txt
pip install -q playwright pytest-playwright pytest-cov

# Install playwright browsers if needed
if [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo -e "${YELLOW}Installing Playwright browsers...${NC}"
    playwright install
fi

# Parse command line arguments
TEST_TYPE=${1:-"all"}
HEADLESS=${2:-"true"}

# Function to run tests
run_tests() {
    local test_path=$1
    local test_name=$2
    
    echo -e "\n${YELLOW}Running $test_name tests...${NC}"
    
    if [ "$HEADLESS" == "false" ]; then
        pytest $test_path --headed
    else
        pytest $test_path
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $test_name tests passed!${NC}"
    else
        echo -e "${RED}❌ $test_name tests failed!${NC}"
        exit 1
    fi
}

# Start API server in background for E2E tests
start_api_server() {
    echo -e "${YELLOW}Starting API server for testing...${NC}"
    
    # Use test database
    export DATABASE_URL="sqlite:///data/test_luckygas.db"
    
    # Initialize test database
    python src/main/python/core/database.py
    
    # Start server in background
    uvicorn src.main.python.api.main:app --host 0.0.0.0 --port 8001 &
    API_PID=$!
    
    # Wait for server to start
    sleep 3
    
    # Check if server is running
    if ! curl -s http://localhost:8001/health > /dev/null; then
        echo -e "${RED}❌ Failed to start API server${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ API server started (PID: $API_PID)${NC}"
}

# Stop API server
stop_api_server() {
    if [ ! -z "$API_PID" ]; then
        echo -e "${YELLOW}Stopping API server...${NC}"
        kill $API_PID 2>/dev/null
        wait $API_PID 2>/dev/null
    fi
}

# Cleanup function
cleanup() {
    stop_api_server
    
    # Remove test database
    if [ -f "data/test_luckygas.db" ]; then
        rm data/test_luckygas.db
    fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Main test execution
case $TEST_TYPE in
    "api")
        start_api_server
        run_tests "tests/e2e/test_api_endpoints.py" "API"
        ;;
    
    "prediction")
        start_api_server
        run_tests "tests/e2e/test_prediction_optimization.py" "Prediction & Optimization"
        ;;
    
    "mobile")
        start_api_server
        run_tests "tests/e2e/test_mobile_driver_app.py" "Mobile Driver App"
        ;;
    
    "admin")
        start_api_server
        run_tests "tests/e2e/test_admin_dashboard.py" "Admin Dashboard"
        ;;
    
    "e2e")
        start_api_server
        run_tests "tests/e2e/" "All E2E"
        ;;
    
    "unit")
        echo -e "${YELLOW}Unit tests not yet implemented${NC}"
        ;;
    
    "coverage")
        start_api_server
        echo -e "${YELLOW}Running tests with coverage...${NC}"
        pytest tests/ --cov=src/main/python --cov-report=html --cov-report=term
        echo -e "${GREEN}Coverage report generated in htmlcov/index.html${NC}"
        ;;
    
    "all"|*)
        start_api_server
        run_tests "tests/" "All"
        ;;
esac

echo -e "\n${GREEN}🎉 Test suite completed!${NC}"

# Show usage if needed
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: ./run_tests.sh [test_type] [headless]"
    echo ""
    echo "Test types:"
    echo "  all        - Run all tests (default)"
    echo "  api        - Run API endpoint tests"
    echo "  prediction - Run prediction & optimization tests"
    echo "  mobile     - Run mobile app tests"
    echo "  admin      - Run admin dashboard tests"
    echo "  e2e        - Run all E2E tests"
    echo "  unit       - Run unit tests"
    echo "  coverage   - Run tests with coverage report"
    echo ""
    echo "Headless options:"
    echo "  true  - Run in headless mode (default)"
    echo "  false - Run with browser UI"
    echo ""
    echo "Examples:"
    echo "  ./run_tests.sh              # Run all tests in headless mode"
    echo "  ./run_tests.sh api false    # Run API tests with browser UI"
    echo "  ./run_tests.sh coverage     # Run all tests with coverage"
fi