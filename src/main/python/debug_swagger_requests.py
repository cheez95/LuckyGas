#!/usr/bin/env python3
"""
Debug script to simulate Swagger UI API requests and identify issues
"""
import requests
import json
import sys

def test_swagger_ui_access():
    """Test if Swagger UI HTML is accessible"""
    print("1. Testing Swagger UI HTML access...")
    try:
        response = requests.get("http://localhost:8000/docs")
        print(f"   Status: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('content-type')}")
        print(f"   Contains swagger-ui: {'swagger-ui' in response.text}")
        print("   ✓ Swagger UI HTML accessible\n")
    except Exception as e:
        print(f"   ✗ Error: {e}\n")
        return False
    return True

def test_openapi_schema():
    """Test OpenAPI schema endpoint"""
    print("2. Testing OpenAPI schema...")
    try:
        response = requests.get("http://localhost:8000/openapi.json")
        schema = response.json()
        print(f"   Status: {response.status_code}")
        print(f"   Title: {schema.get('info', {}).get('title')}")
        print(f"   Version: {schema.get('info', {}).get('version')}")
        print(f"   Paths: {len(schema.get('paths', {}))}")
        print("   ✓ OpenAPI schema valid\n")
        return schema
    except Exception as e:
        print(f"   ✗ Error: {e}\n")
        return None

def test_cors_headers():
    """Test CORS configuration"""
    print("3. Testing CORS headers...")
    try:
        # Test preflight request
        response = requests.options("http://localhost:8000/api/clients", 
                                  headers={
                                      "Origin": "http://localhost:8000",
                                      "Access-Control-Request-Method": "GET"
                                  })
        cors_headers = {k: v for k, v in response.headers.items() 
                       if k.lower().startswith('access-control')}
        print(f"   Status: {response.status_code}")
        for header, value in cors_headers.items():
            print(f"   {header}: {value}")
        print("   ✓ CORS headers present\n")
    except Exception as e:
        print(f"   ✗ Error: {e}\n")

def test_api_endpoints(schema):
    """Test actual API endpoints"""
    print("4. Testing API endpoints...")
    
    # Test GET /api/clients
    print("   Testing GET /api/clients...")
    try:
        response = requests.get("http://localhost:8000/api/clients",
                              headers={"Accept": "application/json"})
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response type: {type(data)}")
        print(f"   Items count: {len(data.get('items', []))}")
        print("   ✓ GET request successful\n")
    except Exception as e:
        print(f"   ✗ Error: {e}\n")
    
    # Test POST /api/clients
    print("   Testing POST /api/clients...")
    try:
        test_client = {
            "name": "測試客戶 Swagger Debug",
            "address": "測試地址 123 號",
            "is_corporate": False
        }
        response = requests.post("http://localhost:8000/api/clients",
                               json=test_client,
                               headers={"Content-Type": "application/json"})
        print(f"   Status: {response.status_code}")
        if response.status_code == 200 or response.status_code == 201:
            created_client = response.json()
            print(f"   Created client ID: {created_client.get('id')}")
            print("   ✓ POST request successful")
            
            # Clean up - delete the test client
            if created_client.get('id'):
                delete_response = requests.delete(
                    f"http://localhost:8000/api/clients/{created_client['id']}")
                print(f"   Cleanup: Deleted test client (status: {delete_response.status_code})")
        else:
            print(f"   Response: {response.text}")
        print()
    except Exception as e:
        print(f"   ✗ Error: {e}\n")

def test_swagger_api_execution():
    """Simulate how Swagger UI executes API calls"""
    print("5. Simulating Swagger UI API execution...")
    
    # This mimics what Swagger UI does internally
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Origin": "http://localhost:8000",
        "Referer": "http://localhost:8000/docs"
    }
    
    print("   Headers that Swagger UI would send:")
    for k, v in headers.items():
        print(f"     {k}: {v}")
    
    try:
        response = requests.get("http://localhost:8000/api/clients", headers=headers)
        print(f"\n   Response Status: {response.status_code}")
        print(f"   Response Headers:")
        for k, v in response.headers.items():
            if k.lower() in ['content-type', 'access-control-allow-origin', 'access-control-allow-credentials']:
                print(f"     {k}: {v}")
        print("   ✓ Swagger-style request successful\n")
    except Exception as e:
        print(f"   ✗ Error: {e}\n")

def main():
    print("=" * 60)
    print("Swagger UI Debug Script")
    print("=" * 60)
    print()
    
    # Run all tests
    if not test_swagger_ui_access():
        print("Server might not be running. Please start the FastAPI server first.")
        sys.exit(1)
    
    schema = test_openapi_schema()
    test_cors_headers()
    if schema:
        test_api_endpoints(schema)
    test_swagger_api_execution()
    
    print("=" * 60)
    print("Debug Summary:")
    print("- If all tests pass, Swagger UI should work correctly")
    print("- Open http://localhost:8000/docs in your browser")
    print("- Check browser console (F12) for any JavaScript errors")
    print("- Try executing a simple GET request from Swagger UI")
    print("=" * 60)

if __name__ == "__main__":
    main()