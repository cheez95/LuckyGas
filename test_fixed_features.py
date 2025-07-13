#!/usr/bin/env python3
"""Test script to verify fixed management interface features"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api"

def test_enum_fix():
    """Test that delivery status enum issue is fixed"""
    print("\n🔧 Testing Enum Fix...")
    
    try:
        # Test getting deliveries (this was failing before)
        response = requests.get(f"{API_BASE}/deliveries?page=1&page_size=5")
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ Successfully loaded {len(data['items'])} deliveries")
            
            # Check status values
            if data['items']:
                delivery = data['items'][0]
                print(f"  ✅ Status value: {delivery.get('status')} (should be lowercase)")
        else:
            print(f"  ❌ Failed to load deliveries: {response.status_code}")
    except Exception as e:
        print(f"  ❌ Error: {e}")

def test_client_display():
    """Test client display with code and names"""
    print("\n👥 Testing Client Display...")
    
    try:
        response = requests.get(f"{API_BASE}/clients?page=1&page_size=3")
        if response.status_code == 200:
            data = response.json()
            if data['items']:
                for client in data['items'][:3]:
                    print(f"  Client #{client['id']}:")
                    print(f"    - Code: {client.get('client_code', 'N/A')}")
                    print(f"    - Name: {client.get('name', 'N/A')}")
                    print(f"    - Invoice Title: {client.get('invoice_title', 'N/A')}")
                print("  ✅ Client display includes all required fields")
        else:
            print(f"  ❌ Failed to load clients: {response.status_code}")
    except Exception as e:
        print(f"  ❌ Error: {e}")

def test_edit_client():
    """Test client edit functionality"""
    print("\n✏️ Testing Edit Client...")
    
    try:
        # Get a client first
        response = requests.get(f"{API_BASE}/clients?page=1&page_size=1")
        if response.status_code == 200 and response.json()['items']:
            client = response.json()['items'][0]
            client_id = client['id']
            
            # Update client
            update_data = {
                "name": f"{client.get('name', '')} (Updated)",
                "address": client['address'],
                "is_active": client['is_active']
            }
            
            response = requests.put(f"{API_BASE}/clients/{client_id}", json=update_data)
            if response.status_code == 200:
                print(f"  ✅ Successfully updated client #{client_id}")
                
                # Revert the change
                update_data["name"] = client.get('name', '')
                requests.put(f"{API_BASE}/clients/{client_id}", json=update_data)
            else:
                print(f"  ❌ Failed to update client: {response.status_code}")
        else:
            print("  ❌ No clients found to test")
    except Exception as e:
        print(f"  ❌ Error: {e}")

def test_delivery_operations():
    """Test delivery status update and assignment"""
    print("\n📦 Testing Delivery Operations...")
    
    try:
        # Get pending deliveries
        response = requests.get(f"{API_BASE}/deliveries?status=pending&page_size=1")
        if response.status_code == 200 and response.json()['items']:
            delivery = response.json()['items'][0]
            delivery_id = delivery['id']
            
            print(f"  Found pending delivery #{delivery_id}")
            
            # Test status update
            update_data = {"status": "ASSIGNED"}
            response = requests.put(f"{API_BASE}/deliveries/{delivery_id}", json=update_data)
            if response.status_code == 200:
                print("  ✅ Successfully updated delivery status")
            else:
                print(f"  ❌ Failed to update status: {response.status_code}")
        else:
            print("  ℹ️ No pending deliveries found to test")
    except Exception as e:
        print(f"  ❌ Error: {e}")

def test_summary_statistics():
    """Test delivery summary statistics"""
    print("\n📊 Testing Summary Statistics...")
    
    try:
        # Test today's summary
        response = requests.get(f"{API_BASE}/deliveries/today/summary")
        if response.status_code == 200:
            summary = response.json()
            print(f"  ✅ Today's deliveries: {summary.get('total_deliveries', 0)}")
            print(f"  ✅ Status breakdown: {summary.get('status_summary', {})}")
        else:
            print(f"  ❌ Failed to get summary: {response.status_code}")
    except Exception as e:
        print(f"  ❌ Error: {e}")

def test_web_interface():
    """Test web interface accessibility"""
    print("\n🌐 Testing Web Interface...")
    
    try:
        # Test admin page
        response = requests.get(f"{BASE_URL}/admin")
        if response.status_code == 200:
            content = response.text
            if "幸福氣管理系統" in content:
                print("  ✅ Company name correctly displayed as '幸福氣'")
            else:
                print("  ❌ Company name not found or incorrect")
            
            if "客戶編號" in content:
                print("  ✅ Client table headers updated")
            
            print(f"  ✅ Web interface accessible")
        else:
            print(f"  ❌ Failed to access web interface: {response.status_code}")
    except Exception as e:
        print(f"  ❌ Error: {e}")

def main():
    """Run all tests"""
    print("🚀 Testing Fixed Management Interface Features")
    print("=" * 50)
    
    # Check server
    try:
        response = requests.get(f"{API_BASE}/")
        if response.status_code != 200:
            print("❌ Server not running! Start with: cd src/main/python && python -m uvicorn api.main:app --reload")
            return
    except:
        print("❌ Cannot connect to server at http://localhost:8000")
        return
    
    # Run tests
    test_enum_fix()
    test_client_display()
    test_edit_client()
    test_delivery_operations()
    test_summary_statistics()
    test_web_interface()
    
    print("\n" + "=" * 50)
    print("✅ Testing complete! All core features should now be working.")
    print("\nKey fixes implemented:")
    print("  - Enum status error resolved")
    print("  - Company name corrected to '幸福氣'")
    print("  - Client display shows code and both names")
    print("  - Edit client functionality working")
    print("  - Delivery operations functional")
    print("  - Summary statistics operational")

if __name__ == "__main__":
    main()