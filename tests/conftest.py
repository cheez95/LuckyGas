import pytest
from playwright.sync_api import Playwright, Browser, Page
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent / "src" / "main" / "python"))

from core.database import DatabaseManager
from utils.data_importer import ExcelDataImporter
import subprocess
import time
import os


# Test configuration
TEST_API_URL = os.getenv("TEST_API_URL", "http://localhost:8001")
TEST_DB_PATH = "data/test_luckygas.db"


@pytest.fixture(scope="session")
def api_server():
    """Start the API server for testing"""
    # Initialize test database
    test_db_url = f"sqlite:///{TEST_DB_PATH}"
    db_manager = DatabaseManager(test_db_url)
    db_manager.initialize()
    
    # Import test data
    session = db_manager.get_session()
    importer = ExcelDataImporter(session)
    
    project_root = Path(__file__).parent.parent
    client_file = project_root / "src" / "main" / "resources" / "assets" / "2025-05 client list.xlsx"
    delivery_file = project_root / "src" / "main" / "resources" / "assets" / "2025-05 deliver history.xlsx"
    
    # Import sample data (first 100 clients for faster testing)
    if client_file.exists() and delivery_file.exists():
        importer.import_client_data(client_file)
        session.commit()
    
    session.close()
    db_manager.close()
    
    # Start API server
    env = os.environ.copy()
    env["DATABASE_URL"] = test_db_url
    
    process = subprocess.Popen(
        ["uvicorn", "src.main.python.api.main:app", "--host", "0.0.0.0", "--port", "8001"],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    # Wait for server to start
    time.sleep(3)
    
    yield TEST_API_URL
    
    # Cleanup
    process.terminate()
    process.wait()
    
    # Remove test database
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)


@pytest.fixture(scope="session")
def browser_context_args():
    """Browser context configuration"""
    return {
        "viewport": {"width": 1280, "height": 720},
        "locale": "zh-TW",
        "timezone_id": "Asia/Taipei",
        "permissions": ["geolocation"],
        "geolocation": {"latitude": 22.7553, "longitude": 121.1504},  # 台東市
    }


@pytest.fixture(scope="function")
def authenticated_page(page: Page):
    """Page with authentication (when implemented)"""
    # For now, just return the page
    # In future, add login logic here
    yield page


@pytest.fixture
def test_client_data():
    """Sample client data for testing"""
    import time
    # Use timestamp to ensure unique tax_id
    unique_suffix = str(int(time.time()))[-8:]
    return {
        "name": f"測試餐廳_{unique_suffix}",
        "address": "臺東市中正路100號",
        "contact_person": "張經理",
        "tax_id": unique_suffix,  # Unique 8-digit tax_id
        "is_corporate": True,
        "district": "瑞光區",
        "delivery_time_preference": "09:00-12:00",
        "notes": "測試客戶資料"
    }


@pytest.fixture
def test_delivery_data():
    """Sample delivery data for testing"""
    return {
        "client_id": 1,
        "scheduled_date": "2025-07-13",
        "scheduled_time_start": "09:00",
        "scheduled_time_end": "12:00",
        "cylinders": {
            "20kg": 2,
            "16kg": 1
        },
        "notes": "測試配送"
    }


@pytest.fixture
def mock_location_updates():
    """Mock GPS location updates for testing"""
    return [
        {"lat": 22.7553, "lng": 121.1504, "timestamp": "2025-07-12T09:00:00"},
        {"lat": 22.7589, "lng": 121.1420, "timestamp": "2025-07-12T09:05:00"},
        {"lat": 22.7625, "lng": 121.1336, "timestamp": "2025-07-12T09:10:00"},
    ]