#!/usr/bin/env python3
"""
Comprehensive test script for LuckyGas API endpoints
Tests all endpoints and provides clear output for debugging
"""

import requests
import json
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Tuple
import sys

# API base URL
BASE_URL = "http://localhost:8000"

# Test data
TEST_CLIENT = {
    "name": "測試客戶",
    "address": "台北市信義區測試路123號"
}

TEST_DRIVER = {
    "name": "測試司機",
    "employee_id": "EMP999",
    "phone": "0912345678",
    "id_number": "A123456789",
    "address": "台北市信義區測試路456號",
    "emergency_contact": "緊急聯絡人",
    "emergency_phone": "0987654321",
    "license_number": "TEST999",
    "license_type": "職業大貨車",
    "license_expiry_date": "2025-12-31",
    "hire_date": "2024-01-01",
    "base_salary": 35000,
    "commission_rate": 10
}

TEST_VEHICLE = {
    "plate_number": "TEST-999",
    "vehicle_type": "van",
    "brand": "Toyota",
    "model": "Hiace",
    "year": 2020,
    "fuel_type": "diesel",
    "engine_number": "ENGINE999999",
    "vin": "VIN999999999",
    "color": "白色",
    "registration_date": "2020-01-15",
    "insurance_expiry_date": "2025-12-31",
    "inspection_due_date": "2025-06-30",
    "max_load_kg": 1500,
    "max_cylinders": 20,
    "purchase_price": 800000,
    "purchase_date": "2020-01-01"
}

# Track test results
test_results = []
created_resources = {
    "client_id": None,
    "driver_id": None,
    "vehicle_id": None,
    "delivery_id": None
}


def print_section(title: str):
    """Print a section header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def print_test_result(endpoint: str, method: str, success: bool, message: str = ""):
    """Print test result with formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    result = f"{status} | {method:6} {endpoint}"
    if message:
        result += f" - {message}"
    print(result)
    test_results.append((endpoint, method, success, message))


def test_endpoint(method: str, endpoint: str, data: Dict[str, Any] = None, 
                 expected_status: int = 200) -> Tuple[bool, Dict[str, Any], str]:
    """Test a single endpoint"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"} if data else {}
    
    try:
        if method == "GET":
            response = requests.get(url)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers)
        elif method == "DELETE":
            response = requests.delete(url)
        else:
            return False, {}, f"Unknown method: {method}"
        
        success = response.status_code == expected_status
        message = ""
        
        if not success:
            message = f"Status {response.status_code}"
            if response.status_code == 422:
                try:
                    errors = response.json()
                    if "detail" in errors:
                        error_details = []
                        for error in errors["detail"]:
                            field = ".".join(str(x) for x in error["loc"])
                            msg = error["msg"]
                            error_details.append(f"{field}: {msg}")
                        message += f" - {', '.join(error_details)}"
                except:
                    pass
        
        try:
            response_data = response.json()
        except:
            response_data = {}
            
        return success, response_data, message
        
    except requests.exceptions.ConnectionError:
        return False, {}, "Connection refused - is the server running?"
    except Exception as e:
        return False, {}, f"Error: {str(e)}"


def test_health_check():
    """Test the health check endpoint"""
    print_section("Health Check")
    success, data, msg = test_endpoint("GET", "/health")
    print_test_result("/health", "GET", success, msg)
    return success


def test_clients_api():
    """Test all client endpoints"""
    print_section("Client API Tests")
    
    # List clients
    success, data, msg = test_endpoint("GET", "/api/clients")
    print_test_result("/api/clients", "GET", success, msg)
    
    # Create client
    success, data, msg = test_endpoint("POST", "/api/clients", TEST_CLIENT, 201)
    print_test_result("/api/clients", "POST", success, msg)
    
    if success and "id" in data:
        created_resources["client_id"] = data["id"]
        
        # Get specific client
        success, data, msg = test_endpoint("GET", f"/api/clients/{created_resources['client_id']}")
        print_test_result(f"/api/clients/{created_resources['client_id']}", "GET", success, msg)
    
    # Get districts
    success, data, msg = test_endpoint("GET", "/api/clients/districts/list")
    print_test_result("/api/clients/districts/list", "GET", success, msg)


def test_drivers_api():
    """Test all driver endpoints"""
    print_section("Driver API Tests")
    
    # List drivers
    success, data, msg = test_endpoint("GET", "/api/drivers")
    print_test_result("/api/drivers", "GET", success, msg)
    
    # Create driver
    success, data, msg = test_endpoint("POST", "/api/drivers", TEST_DRIVER, 201)
    print_test_result("/api/drivers", "POST", success, msg)
    
    if success and "id" in data:
        created_resources["driver_id"] = data["id"]
        
        # Get specific driver
        success, data, msg = test_endpoint("GET", f"/api/drivers/{created_resources['driver_id']}")
        print_test_result(f"/api/drivers/{created_resources['driver_id']}", "GET", success, msg)
        
        # Get driver deliveries
        success, data, msg = test_endpoint("GET", f"/api/drivers/{created_resources['driver_id']}/deliveries")
        print_test_result(f"/api/drivers/{created_resources['driver_id']}/deliveries", "GET", success, msg)
    
    # Get available drivers
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    success, data, msg = test_endpoint("GET", f"/api/drivers/available/list?scheduled_date={tomorrow}")
    print_test_result("/api/drivers/available/list", "GET", success, msg)


def test_vehicles_api():
    """Test all vehicle endpoints"""
    print_section("Vehicle API Tests")
    
    # List vehicles
    success, data, msg = test_endpoint("GET", "/api/vehicles")
    print_test_result("/api/vehicles", "GET", success, msg)
    
    # Create vehicle
    success, data, msg = test_endpoint("POST", "/api/vehicles", TEST_VEHICLE, 201)
    print_test_result("/api/vehicles", "POST", success, msg)
    
    if success and "id" in data:
        created_resources["vehicle_id"] = data["id"]
        
        # Get specific vehicle
        success, data, msg = test_endpoint("GET", f"/api/vehicles/{created_resources['vehicle_id']}")
        print_test_result(f"/api/vehicles/{created_resources['vehicle_id']}", "GET", success, msg)
    
    # Get available vehicles
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    success, data, msg = test_endpoint("GET", f"/api/vehicles/available/list?scheduled_date={tomorrow}")
    print_test_result("/api/vehicles/available/list", "GET", success, msg)
    
    # Get maintenance due
    success, data, msg = test_endpoint("GET", "/api/vehicles/maintenance/due")
    print_test_result("/api/vehicles/maintenance/due", "GET", success, msg)


def test_deliveries_api():
    """Test all delivery endpoints"""
    print_section("Delivery API Tests")
    
    # Get today's summary
    success, data, msg = test_endpoint("GET", "/api/deliveries/today/summary")
    print_test_result("/api/deliveries/today/summary", "GET", success, msg)
    
    # List deliveries - This might fail due to past date validation
    success, data, msg = test_endpoint("GET", "/api/deliveries")
    print_test_result("/api/deliveries", "GET", success, msg)
    
    # Create delivery if we have a client
    if created_resources["client_id"]:
        delivery_data = {
            "client_id": created_resources["client_id"],
            "scheduled_date": (date.today() + timedelta(days=1)).isoformat(),
            "scheduled_time_slot": "上午 9:00-12:00",
            "gas_quantity": 2,
            "unit_price": 800,
            "delivery_fee": 50,
            "delivery_address": "測試地址123號",
            "delivery_district": "信義區",
            "payment_method": "cash",
            "notes": "測試訂單",
            "requires_empty_cylinder_return": True,
            "empty_cylinders_to_return": 2
        }
        
        success, data, msg = test_endpoint("POST", "/api/deliveries", delivery_data, 201)
        print_test_result("/api/deliveries", "POST", success, msg)
        
        if success and "id" in data:
            created_resources["delivery_id"] = data["id"]
            
            # Get specific delivery
            success, data, msg = test_endpoint("GET", f"/api/deliveries/{created_resources['delivery_id']}")
            print_test_result(f"/api/deliveries/{created_resources['delivery_id']}", "GET", success, msg)
            
            # Assign delivery if we have driver and vehicle
            if created_resources["driver_id"] and created_resources["vehicle_id"]:
                assign_data = {
                    "driver_id": created_resources["driver_id"],
                    "vehicle_id": created_resources["vehicle_id"]
                }
                success, data, msg = test_endpoint("PUT", 
                    f"/api/deliveries/{created_resources['delivery_id']}/assign", 
                    assign_data)
                print_test_result(f"/api/deliveries/{created_resources['delivery_id']}/assign", 
                                "PUT", success, msg)


def print_summary():
    """Print test summary"""
    print_section("Test Summary")
    
    total_tests = len(test_results)
    passed_tests = sum(1 for _, _, success, _ in test_results if success)
    failed_tests = total_tests - passed_tests
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"Passed: {passed_tests} ✅")
    print(f"Failed: {failed_tests} ❌")
    print(f"Success Rate: {passed_tests/total_tests*100:.1f}%")
    
    if failed_tests > 0:
        print("\nFailed Tests:")
        for endpoint, method, success, message in test_results:
            if not success:
                print(f"  - {method} {endpoint}: {message}")
    
    print("\nCreated Resources:")
    for resource, resource_id in created_resources.items():
        if resource_id:
            print(f"  - {resource}: {resource_id}")


def main():
    """Run all tests"""
    print("\n🚀 LuckyGas API Test Suite")
    print("Testing API at:", BASE_URL)
    
    # Check if server is running
    if not test_health_check():
        print("\n❌ Server is not running! Please start the server first.")
        print("Run: cd src/main/python && uvicorn api.main:app --reload")
        sys.exit(1)
    
    # Run all tests
    test_clients_api()
    test_drivers_api()
    test_vehicles_api()
    test_deliveries_api()
    
    # Print summary
    print_summary()
    
    print("\n✨ Test suite completed!")


if __name__ == "__main__":
    main()