"""
Test CORS security configuration
Ensures that only allowed origins can access the API
"""

import pytest
from fastapi.testclient import TestClient
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent / "src" / "main" / "python"))

from api.main import app
from config.cors_config import CORSConfig

def test_cors_config_development():
    """Test CORS configuration for development environment"""
    os.environ['ENVIRONMENT'] = 'development'
    config = CORSConfig()
    allowed_origins = config.get_allowed_origins()
    
    # Should include common development servers
    assert "http://localhost:3000" in allowed_origins
    assert "http://localhost:5173" in allowed_origins
    assert "http://localhost:8000" in allowed_origins
    
    # Should NOT include wildcard
    assert "*" not in allowed_origins

def test_cors_config_staging():
    """Test CORS configuration for staging environment"""
    os.environ['ENVIRONMENT'] = 'staging'
    os.environ['STAGING_DOMAIN'] = 'staging.example.com'
    config = CORSConfig()
    allowed_origins = config.get_allowed_origins()
    
    # Should include staging domain
    assert "https://staging.example.com" in allowed_origins
    assert "https://www.staging.example.com" in allowed_origins
    
    # Should still include localhost for testing
    assert "http://localhost:3000" in allowed_origins
    
    # Should NOT include wildcard
    assert "*" not in allowed_origins

def test_cors_config_production():
    """Test CORS configuration for production environment"""
    os.environ['ENVIRONMENT'] = 'production'
    os.environ['PRODUCTION_DOMAIN'] = 'example.com'
    os.environ['ALLOWED_DOMAINS'] = 'example.com,app.example.com'
    config = CORSConfig()
    allowed_origins = config.get_allowed_origins()
    
    # Should include production domains
    assert "https://example.com" in allowed_origins
    assert "https://www.example.com" in allowed_origins
    assert "https://app.example.com" in allowed_origins
    assert "https://www.app.example.com" in allowed_origins
    
    # Should NOT include localhost
    assert "http://localhost:3000" not in allowed_origins
    assert "http://localhost:8000" not in allowed_origins
    
    # Should NOT include wildcard
    assert "*" not in allowed_origins

def test_cors_headers_allowed_origin():
    """Test that CORS headers are set correctly for allowed origins"""
    os.environ['ENVIRONMENT'] = 'development'
    client = TestClient(app)
    
    # Test with allowed origin
    response = client.get(
        "/api",
        headers={"Origin": "http://localhost:3000"}
    )
    
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"

def test_cors_headers_forbidden_origin():
    """Test that CORS headers are not set for forbidden origins"""
    os.environ['ENVIRONMENT'] = 'production'
    os.environ['PRODUCTION_DOMAIN'] = 'example.com'
    client = TestClient(app)
    
    # Test with forbidden origin
    response = client.get(
        "/api",
        headers={"Origin": "http://malicious-site.com"}
    )
    
    # The response should still be 200, but without CORS headers
    assert response.status_code == 200
    # FastAPI will not include the access-control-allow-origin header for forbidden origins
    assert response.headers.get("access-control-allow-origin") != "http://malicious-site.com"

def test_cors_preflight_request():
    """Test CORS preflight request handling"""
    os.environ['ENVIRONMENT'] = 'development'
    client = TestClient(app)
    
    # Simulate preflight request
    response = client.options(
        "/api/clients",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        }
    )
    
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert "POST" in response.headers.get("access-control-allow-methods", "")
    assert "content-type" in response.headers.get("access-control-allow-headers", "").lower()

def test_cors_settings_complete():
    """Test that CORS settings include all necessary configurations"""
    config = CORSConfig()
    settings = config.get_cors_settings()
    
    # Check all required settings are present
    assert "allow_origins" in settings
    assert "allow_credentials" in settings
    assert "allow_methods" in settings
    assert "allow_headers" in settings
    assert "expose_headers" in settings
    assert "max_age" in settings
    
    # Check specific values
    assert settings["allow_credentials"] is True
    assert "GET" in settings["allow_methods"]
    assert "POST" in settings["allow_methods"]
    assert "Content-Type" in settings["allow_headers"]
    assert "Authorization" in settings["allow_headers"]
    assert "X-CSRF-Token" in settings["allow_headers"]
    assert settings["max_age"] == 600

if __name__ == "__main__":
    pytest.main([__file__, "-v"])