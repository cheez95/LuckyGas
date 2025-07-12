import pytest
from playwright.sync_api import Page
import subprocess
import time
import os


@pytest.fixture(scope="module")
def api_server_simple():
    """Start API server for testing without complex imports"""
    # Start server
    env = os.environ.copy()
    env["DATABASE_URL"] = "sqlite:///data/test_simple.db"
    
    process = subprocess.Popen(
        ["uvicorn", "src.main.python.api.main:app", "--host", "0.0.0.0", "--port", "8002"],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    # Wait for server to start
    time.sleep(5)
    
    yield "http://localhost:8002"
    
    # Cleanup
    process.terminate()
    process.wait()
    
    # Remove test database
    if os.path.exists("data/test_simple.db"):
        os.remove("data/test_simple.db")


def test_api_health_simple(page: Page, api_server_simple: str):
    """Test API is running"""
    response = page.request.get(f"{api_server_simple}/health")
    assert response.ok
    data = response.json()
    assert data["status"] == "healthy"


def test_api_docs_available(page: Page, api_server_simple: str):
    """Test API documentation is available"""
    # Swagger UI
    response = page.goto(f"{api_server_simple}/docs")
    assert response.ok
    assert page.title() == "LuckyGas API - Swagger UI"
    
    # ReDoc
    response = page.goto(f"{api_server_simple}/redoc")
    assert response.ok