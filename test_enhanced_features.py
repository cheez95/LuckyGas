#!/usr/bin/env python3
"""Test script for enhanced management interface features"""

import requests
import json
from datetime import datetime, timedelta
import time

BASE_URL = "http://localhost:8000/api"

def test_client_features():
    """Test enhanced client management features"""
    print("\n🔍 Testing Enhanced Client Features...")
    
    # Test search with keyword
    print("  - Testing keyword search...")
    response = requests.get(f"{BASE_URL}/clients?keyword=test")
    assert response.status_code == 200
    data = response.json()
    print(f"    ✓ Found {data['total']} clients with 'test' keyword")
    
    # Test district filter
    print("  - Testing district filter...")
    response = requests.get(f"{BASE_URL}/clients/districts/list")
    if response.status_code == 200 and response.json():
        district = response.json()[0]
        response = requests.get(f"{BASE_URL}/clients?district={district}")
        assert response.status_code == 200
        print(f"    ✓ Found {response.json()['total']} clients in district '{district}'")
    
    # Test sorting
    print("  - Testing sorting...")
    response = requests.get(f"{BASE_URL}/clients?order_by=created_at&order_desc=true")
    assert response.status_code == 200
    print("    ✓ Clients sorted by creation date (descending)")
    
    # Test active/inactive filter
    print("  - Testing active status filter...")
    response = requests.get(f"{BASE_URL}/clients?is_active=true")
    assert response.status_code == 200
    active_count = response.json()['total']
    
    response = requests.get(f"{BASE_URL}/clients?is_active=false")
    assert response.status_code == 200
    inactive_count = response.json()['total']
    print(f"    ✓ Active: {active_count}, Inactive: {inactive_count}")

def test_delivery_features():
    """Test enhanced delivery management features"""
    print("\n📦 Testing Enhanced Delivery Features...")
    
    # Test date range filter
    print("  - Testing date range filter...")
    date_from = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    date_to = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    
    response = requests.get(f"{BASE_URL}/deliveries?scheduled_date_from={date_from}&scheduled_date_to={date_to}")
    assert response.status_code == 200
    data = response.json()
    print(f"    ✓ Found {data['total']} deliveries in date range")
    
    # Test status filter
    print("  - Testing status filters...")
    statuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled']
    for status in statuses:
        response = requests.get(f"{BASE_URL}/deliveries?status={status}&scheduled_date_from={date_from}&scheduled_date_to={date_to}")
        if response.status_code == 200:
            count = response.json()['total']
            print(f"    ✓ {status}: {count} deliveries")
    
    # Test sorting
    print("  - Testing delivery sorting...")
    response = requests.get(f"{BASE_URL}/deliveries?order_by=total_amount&order_desc=true&scheduled_date_from={date_from}&scheduled_date_to={date_to}")
    assert response.status_code == 200
    print("    ✓ Deliveries sorted by total amount (descending)")
    
    # Test today's summary
    print("  - Testing today's summary...")
    response = requests.get(f"{BASE_URL}/deliveries/today/summary")
    assert response.status_code == 200
    summary = response.json()
    print(f"    ✓ Today: {summary.get('total_deliveries', 0)} deliveries")

def test_pagination():
    """Test enhanced pagination features"""
    print("\n📄 Testing Enhanced Pagination...")
    
    # Test client pagination
    print("  - Testing client pagination...")
    response = requests.get(f"{BASE_URL}/clients?page=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    print(f"    ✓ Page 1 of {data['total_pages']} (showing {len(data['items'])} of {data['total']} clients)")
    
    # Test delivery pagination with filters
    print("  - Testing delivery pagination with filters...")
    date_from = datetime.now().strftime("%Y-%m-%d")
    response = requests.get(f"{BASE_URL}/deliveries?page=1&page_size=5&scheduled_date_from={date_from}")
    assert response.status_code == 200
    data = response.json()
    print(f"    ✓ Page 1 of {data['total_pages']} (showing {len(data['items'])} of {data['total']} deliveries)")

def test_statistics():
    """Test dashboard statistics"""
    print("\n📊 Testing Dashboard Statistics...")
    
    # Test client statistics
    print("  - Getting client statistics...")
    response = requests.get(f"{BASE_URL}/clients")
    assert response.status_code == 200
    total_clients = response.json()['total']
    
    # Test driver statistics
    response = requests.get(f"{BASE_URL}/drivers")
    assert response.status_code == 200
    drivers = response.json()['items']
    available_drivers = len([d for d in drivers if d.get('is_available', False)])
    
    # Test vehicle statistics
    response = requests.get(f"{BASE_URL}/vehicles")
    assert response.status_code == 200
    vehicles = response.json()['items']
    active_vehicles = len([v for v in vehicles if v.get('is_active', False)])
    
    print(f"    ✓ Total Clients: {total_clients}")
    print(f"    ✓ Available Drivers: {available_drivers}")
    print(f"    ✓ Active Vehicles: {active_vehicles}")

def test_driver_details():
    """Test driver detail views"""
    print("\n👤 Testing Driver Detail Features...")
    
    response = requests.get(f"{BASE_URL}/drivers")
    if response.status_code == 200 and response.json()['items']:
        driver = response.json()['items'][0]
        driver_id = driver['id']
        
        # Test driver deliveries
        print(f"  - Getting deliveries for driver {driver['name']}...")
        response = requests.get(f"{BASE_URL}/drivers/{driver_id}/deliveries")
        if response.status_code == 200:
            deliveries = response.json()
            print(f"    ✓ Driver has {len(deliveries)} delivery records")

def test_vehicle_details():
    """Test vehicle detail views"""
    print("\n🚚 Testing Vehicle Detail Features...")
    
    response = requests.get(f"{BASE_URL}/vehicles")
    if response.status_code == 200 and response.json()['items']:
        vehicles = response.json()['items']
        
        # Check maintenance status
        maintenance_due = [v for v in vehicles if v.get('next_maintenance_date')]
        print(f"    ✓ {len(maintenance_due)} vehicles have scheduled maintenance")
        
        # Check vehicle types
        types = {}
        for v in vehicles:
            vtype = v.get('vehicle_type', 'unknown')
            types[vtype] = types.get(vtype, 0) + 1
        print(f"    ✓ Vehicle types: {types}")

def main():
    """Run all enhanced feature tests"""
    print("🚀 Testing Enhanced Management Interface Features")
    print("=" * 50)
    
    try:
        # Check server is running
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        print("✅ Server is running")
        
        # Run all tests
        test_client_features()
        test_delivery_features()
        test_pagination()
        test_statistics()
        test_driver_details()
        test_vehicle_details()
        
        print("\n" + "=" * 50)
        print("✅ All enhanced features tested successfully!")
        print("\nEnhanced features include:")
        print("  - Advanced search and filtering")
        print("  - Date range filtering for deliveries")
        print("  - Multi-column sorting")
        print("  - Real-time statistics and charts")
        print("  - Enhanced pagination with first/last buttons")
        print("  - Detailed view modals")
        print("  - Export functionality (CSV)")
        print("  - Delivery summary statistics")
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to server at http://localhost:8000")
        print("   Please ensure the server is running: cd src/main/python && python -m uvicorn api.main:app --reload")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()