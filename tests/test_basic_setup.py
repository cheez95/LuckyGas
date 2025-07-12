import pytest
from playwright.sync_api import Page
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent / "src" / "main" / "python"))


def test_playwright_setup(page: Page):
    """Test that Playwright is properly set up"""
    page.goto("https://www.google.com")
    assert page.title() == "Google"


def test_api_import():
    """Test that API modules can be imported"""
    try:
        from api.main import app
        from models.database_schema import Client, Delivery
        from services.client_service import ClientService
        assert app is not None
        assert Client is not None
        assert ClientService is not None
    except ImportError as e:
        pytest.fail(f"Failed to import modules: {e}")


def test_database_connection():
    """Test database connection"""
    from core.database import DatabaseManager
    
    db_manager = DatabaseManager("sqlite:///data/test_basic.db")
    db_manager.initialize()
    
    session = db_manager.get_session()
    assert session is not None
    
    session.close()
    db_manager.close()
    
    # Cleanup
    import os
    if os.path.exists("data/test_basic.db"):
        os.remove("data/test_basic.db")