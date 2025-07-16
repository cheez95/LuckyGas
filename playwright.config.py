"""
Playwright configuration for LuckyGas webpage testing
"""

# Test configuration
BASE_URL = "http://localhost:8000"
TIMEOUT = 30000  # 30 seconds
VIEWPORT = {"width": 1280, "height": 720}

# Browser options
BROWSER_OPTIONS = {
    "headless": True,  # Run in headless mode for CI
    "slow_mo": 0,      # No artificial slowdown
}

# Test categories
TEST_CATEGORIES = {
    "pages": [
        {"name": "Homepage", "url": "/", "title": "LuckyGas"},
        {"name": "Admin Dashboard", "url": "/admin", "title": "LuckyGas - 管理介面"},
    ],
    "api_docs": [
        {"name": "Swagger UI", "url": "/docs", "contains": "swagger-ui"},
        {"name": "ReDoc", "url": "/redoc", "contains": "redoc"},
    ],
    "api_endpoints": [
        {"name": "Dashboard Stats", "url": "/api/dashboard/stats", "type": "json"},
        {"name": "Clients List", "url": "/api/clients", "type": "json"},
        {"name": "Deliveries List", "url": "/api/deliveries", "type": "json"},
        {"name": "Drivers List", "url": "/api/drivers", "type": "json"},
        {"name": "Vehicles List", "url": "/api/vehicles", "type": "json"},
    ],
}

# Visual regression test viewports
VIEWPORTS = [
    {"name": "Desktop", "width": 1920, "height": 1080},
    {"name": "Laptop", "width": 1366, "height": 768},
    {"name": "Tablet", "width": 768, "height": 1024},
    {"name": "Mobile", "width": 375, "height": 667},
]

# Coverage options
COVERAGE_OPTIONS = {
    "enabled": True,
    "include": ["src/**/*.js", "static/**/*.js"],
    "exclude": ["**/node_modules/**", "**/test/**"],
    "threshold": {
        "lines": 80,
        "functions": 80,
        "branches": 80,
        "statements": 80,
    },
}