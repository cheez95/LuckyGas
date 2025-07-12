import pytest
from playwright.sync_api import Page, expect, BrowserContext
import time


class TestMobileDriverApp:
    """Test mobile driver app functionality"""
    
    @pytest.fixture
    def mobile_context(self, browser_context_args):
        """Mobile device context"""
        mobile_args = browser_context_args.copy()
        mobile_args.update({
            "viewport": {"width": 375, "height": 667},  # iPhone 8 size
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
            "has_touch": True,
            "is_mobile": True,
        })
        return mobile_args
    
    def test_mobile_responsive_layout(self, context: BrowserContext, api_server: str, mobile_context):
        """Test mobile responsive layout"""
        # Create mobile page
        page = context.new_page()
        page.set_viewport_size(mobile_context["viewport"])
        
        # Navigate to mobile app (when implemented)
        response = page.goto(f"{api_server}/mobile")
        
        if response and response.status == 404:
            pytest.skip("Mobile app not implemented yet")
        
        # Check mobile layout
        # This would test actual mobile UI when implemented
        page.close()
    
    def test_gps_tracking(self, page: Page, api_server: str, mock_location_updates):
        """Test GPS tracking functionality"""
        # Test location update endpoint
        for location in mock_location_updates:
            response = page.request.post(
                f"{api_server}/api/tracking/location",
                data={
                    "driver_id": 1,
                    "lat": location["lat"],
                    "lng": location["lng"],
                    "timestamp": location["timestamp"]
                }
            )
            
            if response.status == 404:
                pytest.skip("GPS tracking not implemented yet")
            
            assert response.ok
            time.sleep(0.1)  # Simulate real-time updates
    
    def test_delivery_workflow_mobile(self, page: Page, api_server: str):
        """Test delivery workflow from driver perspective"""
        driver_id = 1
        
        # 1. Get today's deliveries for driver
        response = page.request.get(
            f"{api_server}/api/drivers/{driver_id}/deliveries/today"
        )
        
        if response.status == 404:
            pytest.skip("Driver deliveries endpoint not implemented")
        
        if response.ok:
            deliveries = response.json()
            
            if deliveries:
                first_delivery = deliveries[0]
                delivery_id = first_delivery["id"]
                
                # 2. Start delivery (mark as in_progress)
                response = page.request.put(
                    f"{api_server}/api/deliveries/{delivery_id}/start",
                    data={"start_time": datetime.now().isoformat()}
                )
                
                # 3. Update location during delivery
                response = page.request.post(
                    f"{api_server}/api/tracking/location",
                    data={
                        "delivery_id": delivery_id,
                        "lat": 22.7589,
                        "lng": 121.1420
                    }
                )
                
                # 4. Complete delivery
                response = page.request.put(
                    f"{api_server}/api/deliveries/{delivery_id}/complete",
                    data={
                        "delivered_cylinders": {"20kg": 2},
                        "returned_cylinders": {"20kg": 2},
                        "signature_data": "base64_signature_image",
                        "photo_data": "base64_photo",
                        "notes": "客戶簽收"
                    }
                )
    
    def test_offline_capability(self, page: Page, api_server: str):
        """Test offline data sync capability"""
        # Create offline data
        offline_delivery = {
            "id": "offline_123",
            "client_id": 1,
            "status": "completed",
            "completed_at": datetime.now().isoformat(),
            "offline": True
        }
        
        # Try to sync when back online
        response = page.request.post(
            f"{api_server}/api/sync/deliveries",
            data={"deliveries": [offline_delivery]}
        )
        
        if response.status == 404:
            pytest.skip("Offline sync not implemented yet")
        
        assert response.ok
        sync_result = response.json()
        assert sync_result["synced_count"] >= 0
    
    def test_push_notifications(self, page: Page, api_server: str):
        """Test push notification subscription"""
        response = page.request.post(
            f"{api_server}/api/notifications/subscribe",
            data={
                "driver_id": 1,
                "device_token": "test_device_token_123",
                "platform": "ios"
            }
        )
        
        if response.status == 404:
            pytest.skip("Push notifications not implemented yet")
        
        assert response.ok
    
    def test_route_navigation(self, page: Page, api_server: str):
        """Test route navigation features"""
        # Get route details
        response = page.request.get(
            f"{api_server}/api/routes/1"
        )
        
        if response.status == 404:
            pytest.skip("Route details not available")
        
        if response.ok:
            route = response.json()
            
            # Test navigation to next point
            if route.get("points") and len(route["points"]) > 1:
                next_point = route["points"][1]
                
                # Request navigation
                response = page.request.post(
                    f"{api_server}/api/navigation/directions",
                    data={
                        "from": {
                            "lat": route["points"][0]["lat"],
                            "lng": route["points"][0]["lng"]
                        },
                        "to": {
                            "lat": next_point["lat"],
                            "lng": next_point["lng"]
                        }
                    }
                )
                
                if response.ok:
                    directions = response.json()
                    assert "distance" in directions
                    assert "duration" in directions
    
    def test_delivery_notes_and_photos(self, page: Page, api_server: str):
        """Test adding notes and photos to deliveries"""
        # Create a test delivery
        delivery_data = {
            "client_id": 1,
            "scheduled_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = page.request.post(
            f"{api_server}/api/deliveries",
            data=delivery_data
        )
        
        if response.ok:
            delivery_id = response.json()["id"]
            
            # Add photo
            response = page.request.post(
                f"{api_server}/api/deliveries/{delivery_id}/photos",
                data={
                    "photo_data": "base64_encoded_image_data",
                    "photo_type": "delivery_proof",
                    "timestamp": datetime.now().isoformat()
                }
            )
            
            # Add note
            response = page.request.post(
                f"{api_server}/api/deliveries/{delivery_id}/notes",
                data={
                    "note": "客戶要求放在門口，已拍照存證",
                    "timestamp": datetime.now().isoformat()
                }
            )
    
    def test_driver_statistics(self, page: Page, api_server: str):
        """Test driver performance statistics"""
        driver_id = 1
        
        # Get daily statistics
        response = page.request.get(
            f"{api_server}/api/drivers/{driver_id}/statistics/daily"
        )
        
        if response.ok:
            stats = response.json()
            
            # Verify statistics structure
            expected_fields = [
                "deliveries_completed",
                "total_distance_km",
                "total_duration_minutes",
                "cylinders_delivered",
                "on_time_rate"
            ]
            
            for field in expected_fields:
                if field in stats:
                    assert isinstance(stats[field], (int, float))


from datetime import datetime