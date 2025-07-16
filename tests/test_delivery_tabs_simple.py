"""Simple test script for delivery tab functionality using requests."""
import requests
import json
from datetime import datetime
import time


def test_multi_status_api():
    """Test the API's multi-status filtering capability."""
    base_url = "http://localhost:8000/api/deliveries"
    
    print("\n🧪 Testing Delivery Tab Functionality")
    print("=" * 50)
    
    # Test 1: Planned Tab (pending, assigned, in_progress)
    print("\n1️⃣ Testing Planned Tab Filter")
    print("-" * 30)
    
    try:
        # Test multiple status parameters
        response = requests.get(base_url, params={
            "status": ["pending", "assigned", "in_progress"]
        })
        
        if response.status_code == 200:
            data = response.json()
            total = data.get("total", 0)
            items = data.get("items", [])
            
            # Count each status
            status_counts = {}
            for item in items:
                status = item.get("status")
                status_counts[status] = status_counts.get(status, 0) + 1
            
            print(f"✅ API Response: {response.status_code}")
            print(f"📊 Total planned deliveries: {total}")
            print(f"📋 Status breakdown:")
            for status, count in status_counts.items():
                print(f"   - {status}: {count}")
            
            # Verify all items have correct status
            invalid_items = [item for item in items if item["status"] not in ["pending", "assigned", "in_progress"]]
            if invalid_items:
                print(f"❌ Found {len(invalid_items)} items with wrong status!")
            else:
                print("✅ All items have correct status")
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
    
    # Test 2: History Tab (completed, cancelled)
    print("\n2️⃣ Testing History Tab Filter")
    print("-" * 30)
    
    try:
        response = requests.get(base_url, params={
            "status": ["completed", "cancelled"]
        })
        
        if response.status_code == 200:
            data = response.json()
            total = data.get("total", 0)
            items = data.get("items", [])
            
            # Calculate completion rate
            completed = sum(1 for item in items if item["status"] == "completed")
            cancelled = sum(1 for item in items if item["status"] == "cancelled")
            
            print(f"✅ API Response: {response.status_code}")
            print(f"📊 Total history deliveries: {total}")
            print(f"📋 Status breakdown:")
            print(f"   - completed: {completed}")
            print(f"   - cancelled: {cancelled}")
            
            if total > 0:
                completion_rate = (completed / total) * 100
                print(f"📈 Completion rate: {completion_rate:.1f}%")
            
            # Verify all items have correct status
            invalid_items = [item for item in items if item["status"] not in ["completed", "cancelled"]]
            if invalid_items:
                print(f"❌ Found {len(invalid_items)} items with wrong status!")
            else:
                print("✅ All items have correct status")
        else:
            print(f"❌ API Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
    
    # Test 3: Performance
    print("\n3️⃣ Testing Performance")
    print("-" * 30)
    
    test_cases = [
        ("No filter", {}),
        ("Single status", {"status": "pending"}),
        ("Multiple statuses", {"status": ["pending", "assigned", "in_progress"]})
    ]
    
    for name, params in test_cases:
        try:
            start_time = time.time()
            response = requests.get(base_url, params=params)
            end_time = time.time()
            
            response_time = (end_time - start_time) * 1000  # ms
            
            if response_time < 500:
                status = "✅ FAST"
            elif response_time < 1000:
                status = "⚠️ ACCEPTABLE"
            else:
                status = "❌ SLOW"
            
            print(f"{status} {name}: {response_time:.0f}ms")
            
        except Exception as e:
            print(f"❌ {name}: Error - {str(e)}")
    
    # Test 4: Edge Cases
    print("\n4️⃣ Testing Edge Cases")
    print("-" * 30)
    
    # Invalid status
    try:
        response = requests.get(base_url, params={"status": "invalid_status"})
        print(f"Invalid status test: HTTP {response.status_code} {'✅ Handled' if response.status_code in [200, 400, 422] else '❌ Unexpected'}")
    except Exception as e:
        print(f"❌ Invalid status test failed: {str(e)}")
    
    # Mixed valid/invalid
    try:
        response = requests.get(base_url, params={"status": ["pending", "invalid", "completed"]})
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            statuses = set(item["status"] for item in items)
            print(f"Mixed status test: ✅ Filtered to valid statuses: {statuses}")
        else:
            print(f"Mixed status test: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Mixed status test failed: {str(e)}")
    
    # UI Test Instructions
    print("\n5️⃣ Manual UI Testing Steps")
    print("-" * 30)
    print("Please test the following in your browser:")
    print("\n1. Navigate to http://localhost:8000")
    print("2. Go to the Deliveries section")
    print("3. Click '計劃中' tab - verify it shows pending/assigned/in_progress")
    print("4. Click '歷史記錄' tab - verify it shows completed/cancelled")
    print("5. Refresh the page - verify selected tab persists")
    print("6. Open browser console and check: localStorage.getItem('deliveryTab')")
    print("7. Verify summary statistics update for each tab")
    
    print("\n" + "=" * 50)
    print("✅ Automated tests complete!")
    print("📋 Please complete manual UI tests listed above")
    print("=" * 50)


if __name__ == "__main__":
    try:
        # Check if server is running
        response = requests.get("http://localhost:8000/api/health", timeout=2)
        print("✅ Server is running")
        
        # Run tests
        test_multi_status_api()
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Cannot connect to server at http://localhost:8000")
        print("Please start the server with: python src/main/python/main.py")
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")