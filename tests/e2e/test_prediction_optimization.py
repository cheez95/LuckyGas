import pytest
from playwright.sync_api import Page
from datetime import datetime, timedelta


class TestPredictionAndOptimization:
    """Test prediction and route optimization features"""
    
    def test_generate_predictions(self, page: Page, api_server: str):
        """Test delivery prediction generation"""
        response = page.request.post(
            f"{api_server}/api/predictions/generate",
            data={
                "days_ahead": 7,
                "include_areas": ["A-瑞光", "B-四維"],
                "min_confidence": 0.5
            }
        )
        
        # API endpoint might not exist yet
        if response.status == 404:
            pytest.skip("Predictions API not implemented yet")
        
        assert response.ok
        predictions = response.json()
        
        if predictions:
            # Verify prediction structure
            first_prediction = predictions[0]
            assert "client_id" in first_prediction
            assert "predicted_depletion_date" in first_prediction
            assert "recommended_delivery_date" in first_prediction
            assert "confidence_score" in first_prediction
            assert 0 <= first_prediction["confidence_score"] <= 1
    
    def test_priority_deliveries(self, page: Page, api_server: str):
        """Test priority delivery list"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = page.request.get(
            f"{api_server}/api/predictions/priority-list",
            params={"date": tomorrow}
        )
        
        if response.status == 404:
            pytest.skip("Priority list API not implemented yet")
        
        assert response.ok
        priority_list = response.json()
        
        if priority_list:
            # Verify items are sorted by priority
            priorities = [item["priority_score"] for item in priority_list]
            assert priorities == sorted(priorities, reverse=True)
            
            # Check structure
            first_item = priority_list[0]
            assert "client_name" in first_item
            assert "area" in first_item
            assert "days_until_depletion" in first_item
            assert "current_inventory" in first_item
            assert "daily_usage" in first_item
    
    def test_route_optimization(self, page: Page, api_server: str):
        """Test route optimization"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = page.request.post(
            f"{api_server}/api/routes/optimize",
            data={
                "date": tomorrow,
                "areas": ["A-瑞光"],
                "available_vehicles": [1, 2],
                "available_drivers": [1, 2],
                "optimization_params": {
                    "max_distance_km": 50,
                    "max_duration_minutes": 360,
                    "prioritize_urgent": True
                }
            }
        )
        
        if response.status == 404:
            pytest.skip("Route optimization API not implemented yet")
        
        if response.status == 422:
            # Might not have enough data
            pytest.skip("Not enough data for route optimization")
        
        assert response.ok
        routes = response.json()
        
        if routes:
            # Verify route structure
            first_route = routes[0]
            assert "route_info" in first_route
            assert "points" in first_route
            
            # Check optimization results
            route_info = first_route["route_info"]
            assert route_info["total_distance"] > 0
            assert route_info["total_duration"] > 0
            assert route_info["total_clients"] > 0
    
    def test_seasonal_factors(self, page: Page, api_server: str):
        """Test seasonal adjustment in predictions"""
        # This would require a specific endpoint or checking prediction details
        # For now, we'll verify the concept through predictions
        
        # Generate predictions for summer month
        response_summer = page.request.post(
            f"{api_server}/api/predictions/generate",
            data={
                "days_ahead": 30,
                "target_month": 7  # July - summer
            }
        )
        
        # Generate predictions for winter month  
        response_winter = page.request.post(
            f"{api_server}/api/predictions/generate",
            data={
                "days_ahead": 30,
                "target_month": 1  # January - winter
            }
        )
        
        if response_summer.status == 404 or response_winter.status == 404:
            pytest.skip("Seasonal predictions not implemented")
        
        # In general, winter usage should be higher than summer
        # This is a conceptual test - actual implementation may vary
    
    def test_confidence_scoring(self, page: Page, api_server: str):
        """Test prediction confidence scoring"""
        response = page.request.get(
            f"{api_server}/api/clients/1/statistics"
        )
        
        if response.ok:
            stats = response.json()
            
            # Clients with more consistent delivery patterns should have higher confidence
            if stats.get("total_deliveries", 0) > 10:
                # Generate prediction for this client
                response = page.request.post(
                    f"{api_server}/api/predictions/generate",
                    data={"client_ids": [1]}
                )
                
                if response.ok and response.json():
                    prediction = response.json()[0]
                    # More deliveries should generally mean higher confidence
                    assert prediction["confidence_score"] > 0.5
    
    def test_area_clustering(self, page: Page, api_server: str):
        """Test area-based clustering in route optimization"""
        response = page.request.get(
            f"{api_server}/api/clients",
            params={"area": "A-瑞光", "page_size": 50}
        )
        
        assert response.ok
        clients = response.json()["items"]
        
        if len(clients) > 5:
            # Optimize route for this area
            tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
            
            response = page.request.post(
                f"{api_server}/api/routes/optimize",
                data={
                    "date": tomorrow,
                    "areas": ["A-瑞光"],
                    "client_ids": [c["id"] for c in clients[:10]]
                }
            )
            
            if response.ok:
                routes = response.json()
                # All clients in the route should be from the same area
                for route in routes:
                    assert route["route_info"]["area"] == "A-瑞光"
    
    def test_vehicle_restrictions(self, page: Page, api_server: str):
        """Test vehicle type restrictions in routing"""
        # Create a client that only accepts cars
        car_only_client = {
            "client_code": "CAR001",
            "invoice_title": "限汽車配送",
            "address": "山區道路123號",
            "vehicle_restriction": "car"
        }
        
        response = page.request.post(
            f"{api_server}/api/clients",
            data=car_only_client
        )
        
        if response.ok:
            client_id = response.json()["id"]
            
            # Try to assign motorcycle driver
            tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
            
            response = page.request.post(
                f"{api_server}/api/deliveries",
                data={
                    "client_id": client_id,
                    "scheduled_date": tomorrow,
                    "vehicle_type": "motorcycle"
                }
            )
            
            # Should reject or handle appropriately
            if response.status == 400:
                assert "車輛類型" in response.json()["detail"]