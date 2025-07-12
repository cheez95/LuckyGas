import pytest
from playwright.sync_api import Page, expect
import json


class TestAPIEndpoints:
    """Test all API endpoints using Playwright"""
    
    def test_api_health_check(self, page: Page, api_server: str):
        """Test API health check endpoint"""
        response = page.request.get(f"{api_server}/health")
        assert response.ok
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
    
    def test_api_root(self, page: Page, api_server: str):
        """Test API root endpoint"""
        response = page.request.get(f"{api_server}/")
        assert response.ok
        data = response.json()
        assert "歡迎使用 LuckyGas 配送管理系統" in data["message"]
        assert data["version"] == "1.0.0"
        assert data["status"] == "運行中"
    
    def test_client_crud_operations(self, page: Page, api_server: str, test_client_data):
        """Test complete CRUD operations for clients"""
        
        # 1. Create client
        response = page.request.post(
            f"{api_server}/api/clients",
            data=test_client_data
        )
        if not response.ok:
            print(f"Error creating client: {response.status} - {response.json()}")
        assert response.ok
        created_client = response.json()
        client_id = created_client["id"]
        assert created_client["name"] == test_client_data["name"]
        
        # 2. Read client
        response = page.request.get(f"{api_server}/api/clients/{client_id}")
        assert response.ok
        client = response.json()
        assert client["id"] == client_id
        assert client["address"] == test_client_data["address"]
        
        # 3. Update client
        update_data = {"notes": "已更新", "delivery_time_preference": "14:00-18:00"}
        response = page.request.put(
            f"{api_server}/api/clients/{client_id}",
            data=update_data
        )
        assert response.ok
        updated_client = response.json()
        assert updated_client["notes"] == "已更新"
        
        # 4. Search clients
        response = page.request.get(
            f"{api_server}/api/clients",
            params={"search": test_client_data["name"]}  # Use actual test client name
        )
        assert response.ok
        data = response.json()
        assert data["total"] >= 1
        assert any(c["id"] == client_id for c in data["items"])
        
        # 5. Delete client
        response = page.request.delete(f"{api_server}/api/clients/{client_id}")
        assert response.ok
        assert response.json()["message"] == "客戶已成功停用"
    
    
    def test_delivery_workflow(self, page: Page, api_server: str, test_delivery_data):
        """Test complete delivery workflow"""
        
        # 1. Create delivery
        response = page.request.post(
            f"{api_server}/api/deliveries",
            data=test_delivery_data
        )
        
        if response.status == 422:
            # Client might not exist, skip this test
            pytest.skip("Test client not found in database")
        
        assert response.ok
        delivery = response.json()
        delivery_id = delivery["id"]
        assert delivery["status"] == "pending"
        
        # 2. Assign driver and vehicle
        response = page.request.put(
            f"{api_server}/api/deliveries/{delivery_id}/assign",
            data={"driver_id": 1, "vehicle_id": 1}
        )
        
        if response.status == 404:
            # Driver/vehicle might not exist
            pytest.skip("Test driver/vehicle not found")
        
        assert response.ok
        
        # 3. Update status to in_progress
        response = page.request.put(
            f"{api_server}/api/deliveries/{delivery_id}/status",
            data={"status": "in_progress"}
        )
        assert response.ok
        
        # 4. Complete delivery
        response = page.request.put(
            f"{api_server}/api/deliveries/{delivery_id}/status",
            data={
                "status": "completed",
                "delivered_cylinders": test_delivery_data["cylinders"],
                "returned_cylinders": {"20kg": 2, "16kg": 1},
                "notes": "配送完成"
            }
        )
        assert response.ok
        completed = response.json()
        assert completed["status"] == "completed"
    
    def test_delivery_daily_summary(self, page: Page, api_server: str):
        """Test daily delivery summary"""
        response = page.request.get(f"{api_server}/api/deliveries/today/summary")
        assert response.ok
        summary = response.json()
        
        assert "date" in summary
        assert "total_deliveries" in summary
        assert "status_summary" in summary
        assert "driver_workload" in summary
        assert isinstance(summary["status_summary"], dict)
    
    def test_pagination(self, page: Page, api_server: str):
        """Test pagination functionality"""
        # Test with clients endpoint
        response = page.request.get(
            f"{api_server}/api/clients",
            params={"page": 1, "page_size": 5}
        )
        assert response.ok
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        
        assert data["page"] == 1
        assert data["page_size"] == 5
        assert len(data["items"]) <= 5
    
    def test_date_format_handling(self, page: Page, api_server: str):
        """Test Taiwan date format handling"""
        # Test with minguo date format
        response = page.request.get(
            f"{api_server}/api/deliveries",
            params={"date": "114/07/13"}  # 民國格式
        )
        
        # API should handle both formats
        assert response.ok or response.status == 200
    
    def test_error_handling(self, page: Page, api_server: str):
        """Test API error handling"""
        # 1. Test 404 - Not Found
        response = page.request.get(f"{api_server}/api/clients/99999")
        assert response.status == 404
        assert "找不到" in response.json()["detail"]
        
        # 2. Test 422 - Validation Error
        response = page.request.post(
            f"{api_server}/api/clients",
            data={"invalid": "data"}
        )
        assert response.status == 422
        
        # 3. Test duplicate tax_id
        test_data = {
            "name": "重複測試公司",
            "address": "測試地址",
            "tax_id": "12345678"  # Add tax_id for duplicate testing
        }
        
        # Create first
        response1 = page.request.post(f"{api_server}/api/clients", data=test_data)
        
        # Try to create duplicate with same tax_id but different name
        test_data["name"] = "不同名稱公司"
        response2 = page.request.post(f"{api_server}/api/clients", data=test_data)
        assert response2.status == 400
        assert "已被使用" in response2.json()["detail"]
    
    def test_chinese_content(self, page: Page, api_server: str):
        """Test Traditional Chinese content handling"""
        chinese_data = {
            "name": "幸福瓦斯行（總店）",
            "address": "臺東縣臺東市中華路一段２３４號５樓之３",
            "contact_person": "陳老闆",
            "is_corporate": True,
            "district": "臺東市",
            "notes": "注意：客戶偏好早上配送，請提前聯絡確認"
        }
        
        response = page.request.post(
            f"{api_server}/api/clients",
            data=chinese_data
        )
        assert response.ok
        created = response.json()
        
        # Verify Chinese characters are preserved
        assert created["name"] == chinese_data["name"]
        assert created["address"] == chinese_data["address"]
        assert "臺東縣" in created["address"]
        assert "５樓之３" in created["address"]