#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime

# Base URL
BASE_URL = "http://localhost:8000"

def test_api_endpoints():
    """Test all API endpoints"""
    print("Testing LuckyGas API Endpoints...")
    print("=" * 50)
    
    # Test root endpoint
    print("\n1. Testing root endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test health check
    print("\n2. Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test API info
    print("\n3. Testing API info...")
    try:
        response = requests.get(f"{BASE_URL}/api")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test getting all clients
    print("\n4. Testing GET all clients...")
    try:
        response = requests.get(f"{BASE_URL}/api/clients")
        print(f"   Status: {response.status_code}")
        print(f"   Number of clients: {len(response.json())}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test creating a new client
    print("\n5. Testing POST new client...")
    try:
        new_client = {
            "name": "Test Client " + datetime.now().strftime("%Y%m%d%H%M%S"),
            "address": "123 Test Street",
            "phone": "0912-345-678",
            "contact_person": "Test Person",
            "gas_quantity": 50,
            "cylinder_quantity": 2,
            "notes": "API test client"
        }
        response = requests.post(f"{BASE_URL}/api/clients", json=new_client)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            client_data = response.json()
            print(f"   Created client ID: {client_data.get('id')}")
            print(f"   Client name: {client_data.get('name')}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test getting all drivers
    print("\n6. Testing GET all drivers...")
    try:
        response = requests.get(f"{BASE_URL}/api/drivers")
        print(f"   Status: {response.status_code}")
        print(f"   Number of drivers: {len(response.json())}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test creating a new driver
    print("\n7. Testing POST new driver...")
    try:
        new_driver = {
            "name": "Test Driver " + datetime.now().strftime("%Y%m%d%H%M%S"),
            "license_number": "TEST-" + datetime.now().strftime("%Y%m%d%H%M%S"),
            "phone": "0923-456-789",
            "employee_id": "EMP-" + datetime.now().strftime("%Y%m%d%H%M%S")[:10],
            "status": "active"
        }
        response = requests.post(f"{BASE_URL}/api/drivers", json=new_driver)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            driver_data = response.json()
            print(f"   Created driver ID: {driver_data.get('id')}")
            print(f"   Driver name: {driver_data.get('name')}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test getting all vehicles
    print("\n8. Testing GET all vehicles...")
    try:
        response = requests.get(f"{BASE_URL}/api/vehicles")
        print(f"   Status: {response.status_code}")
        print(f"   Number of vehicles: {len(response.json())}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test creating a new vehicle
    print("\n9. Testing POST new vehicle...")
    try:
        new_vehicle = {
            "plate_number": "TEST-" + datetime.now().strftime("%H%M"),
            "type": "truck",
            "capacity": 100,
            "status": "active"
        }
        response = requests.post(f"{BASE_URL}/api/vehicles", json=new_vehicle)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            vehicle_data = response.json()
            print(f"   Created vehicle ID: {vehicle_data.get('id')}")
            print(f"   Vehicle plate: {vehicle_data.get('plate_number')}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test getting all deliveries
    print("\n10. Testing GET all deliveries...")
    try:
        response = requests.get(f"{BASE_URL}/api/deliveries")
        print(f"   Status: {response.status_code}")
        print(f"   Number of deliveries: {len(response.json())}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test admin interface availability
    print("\n11. Testing admin interface...")
    try:
        response = requests.get(f"{BASE_URL}/admin")
        print(f"   Status: {response.status_code}")
        print(f"   Content length: {len(response.content)} bytes")
        print(f"   Content type: {response.headers.get('content-type')}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test static files
    print("\n12. Testing static files (app.js)...")
    try:
        response = requests.get(f"{BASE_URL}/static/app.js")
        print(f"   Status: {response.status_code}")
        print(f"   Content length: {len(response.content)} bytes")
        print(f"   Content type: {response.headers.get('content-type')}")
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n" + "=" * 50)
    print("API testing completed!")

if __name__ == "__main__":
    test_api_endpoints()