#!/usr/bin/env python3
"""
Webpage Testing Script for LuckyGas Application
Tests all main pages and API endpoints
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Tuple

class WebpageTestRunner:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.results = []
        
    def test_endpoint(self, path: str, method: str = "GET", 
                     expected_status: int = 200, data: dict = None) -> Tuple[bool, str]:
        """Test a single endpoint"""
        url = f"{self.base_url}{path}"
        try:
            if method == "GET":
                response = self.session.get(url, timeout=5)
            elif method == "POST":
                response = self.session.post(url, json=data, timeout=5)
            elif method == "PUT":
                response = self.session.put(url, json=data, timeout=5)
            else:
                return False, f"Unsupported method: {method}"
                
            success = response.status_code == expected_status
            message = f"{method} {path}: {response.status_code}"
            
            if success and path.endswith('.js'):
                # For JavaScript files, check if content is valid
                if 'text/javascript' not in response.headers.get('content-type', ''):
                    success = False
                    message += " (Invalid content-type)"
                    
            return success, message
            
        except requests.exceptions.ConnectionError:
            return False, f"{method} {path}: Connection refused - is server running?"
        except requests.exceptions.Timeout:
            return False, f"{method} {path}: Request timeout"
        except Exception as e:
            return False, f"{method} {path}: Error - {str(e)}"
    
    def run_tests(self):
        """Run all webpage tests"""
        print("🧪 LuckyGas Webpage Testing")
        print("=" * 50)
        print(f"Base URL: {self.base_url}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 50)
        
        # Test cases
        test_cases = [
            # Static pages
            ("Homepage", "/", "GET", 200),
            ("Admin Dashboard", "/admin", "GET", 200),
            
            # API Documentation
            ("API Docs (Swagger)", "/docs", "GET", 200),
            ("API Docs (ReDoc)", "/redoc", "GET", 200),
            ("OpenAPI Schema", "/openapi.json", "GET", 200),
            
            # API Endpoints
            ("Dashboard Stats", "/api/dashboard/stats", "GET", 200),
            ("Clients List", "/api/clients", "GET", 200),
            ("Deliveries List", "/api/deliveries", "GET", 200),
            ("Drivers List", "/api/drivers", "GET", 200),
            ("Vehicles List", "/api/vehicles", "GET", 200),
            
            # Static Assets
            ("Main JavaScript", "/static/app.js", "GET", 200),
            ("Main CSS", "/static/styles.css", "GET", 200),
            
            # Module files (if served)
            ("Config Module", "/src/main/python/web/config/config.js", "GET", 200),
            ("API Module", "/src/main/js/modules/api/index.js", "GET", 200),
        ]
        
        passed = 0
        failed = 0
        
        for name, path, method, expected_status in test_cases:
            success, message = self.test_endpoint(path, method, expected_status)
            
            if success:
                print(f"✅ {name}: {message}")
                passed += 1
            else:
                print(f"❌ {name}: {message}")
                failed += 1
                
            self.results.append({
                "name": name,
                "path": path,
                "method": method,
                "success": success,
                "message": message
            })
            
            # Small delay between tests
            time.sleep(0.1)
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 Test Summary")
        print("=" * 50)
        print(f"Total Tests: {passed + failed}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed / (passed + failed) * 100):.1f}%")
        
        # Save results
        self.save_results()
        
        return passed, failed
    
    def save_results(self):
        """Save test results to file"""
        results_file = "webpage_test_results.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "base_url": self.base_url,
                "results": self.results
            }, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Results saved to: {results_file}")
    
    def test_admin_functionality(self):
        """Test admin page specific functionality"""
        print("\n🔧 Testing Admin Functionality")
        print("-" * 50)
        
        # Test if admin page loads
        success, message = self.test_endpoint("/admin", "GET", 200)
        if not success:
            print(f"❌ Cannot access admin page: {message}")
            return
            
        print("✅ Admin page accessible")
        
        # Test API calls from admin page
        api_tests = [
            ("Client Search", "/api/clients?keyword=test", "GET", 200),
            ("Delivery Filter by Status", "/api/deliveries?status=pending", "GET", 200),
            ("Driver Availability", "/api/drivers?available=true", "GET", 200),
        ]
        
        for name, path, method, expected in api_tests:
            success, message = self.test_endpoint(path, method, expected)
            if success:
                print(f"✅ {name}: Working")
            else:
                print(f"❌ {name}: {message}")

def main():
    """Main test runner"""
    # Check if server is running
    try:
        response = requests.get("http://localhost:8000/", timeout=2)
        print("✅ Server is running")
    except:
        print("❌ Server is not running on http://localhost:8000")
        print("Please start the server with: uv run uvicorn src.main.python.api.main:app --reload")
        return
    
    # Run tests
    runner = WebpageTestRunner()
    passed, failed = runner.run_tests()
    
    # Run additional functionality tests
    if passed > 0:
        runner.test_admin_functionality()
    
    # Exit code based on results
    exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()