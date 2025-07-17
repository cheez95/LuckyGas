"""
CORS configuration management for different environments
Provides secure CORS settings to prevent unauthorized cross-origin requests
"""

import os
from typing import List

class CORSConfig:
    """Manages CORS settings for different environments"""
    
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'development').lower()
    
    def get_allowed_origins(self) -> List[str]:
        """
        Get the list of allowed origins based on the current environment
        
        Returns:
            List of allowed origin URLs
        """
        # Base allowed origins for all environments
        base_origins = []
        
        if self.environment == 'development':
            # Development environment - allow common local development servers
            return [
                "http://localhost:3000",      # React default
                "http://localhost:5173",      # Vite default
                "http://localhost:8000",      # FastAPI default
                "http://localhost:8080",      # Common alternative
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:8000",
                "http://127.0.0.1:8080",
            ]
        
        elif self.environment == 'staging':
            # Staging environment - add your staging URLs
            staging_domain = os.getenv('STAGING_DOMAIN', 'staging.luckygas.com')
            return [
                f"https://{staging_domain}",
                f"https://www.{staging_domain}",
                # Keep localhost for testing in staging
                "http://localhost:3000",
                "http://localhost:8000",
            ]
        
        elif self.environment == 'production':
            # Production environment - only allow production domains
            production_domain = os.getenv('PRODUCTION_DOMAIN', 'luckygas.com')
            allowed_domains = os.getenv('ALLOWED_DOMAINS', production_domain).split(',')
            
            origins = []
            for domain in allowed_domains:
                domain = domain.strip()
                origins.extend([
                    f"https://{domain}",
                    f"https://www.{domain}",
                ])
            
            return origins
        
        else:
            # Unknown environment - return minimal safe set
            return ["http://localhost:8000"]
    
    def get_cors_settings(self) -> dict:
        """
        Get complete CORS settings for the middleware
        
        Returns:
            Dictionary with CORS configuration
        """
        return {
            "allow_origins": self.get_allowed_origins(),
            "allow_credentials": True,
            "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            "allow_headers": [
                "Content-Type",
                "Authorization",
                "X-Requested-With",
                "Accept",
                "Origin",
                "X-CSRF-Token",
            ],
            "expose_headers": ["X-Total-Count"],  # For pagination
            "max_age": 600,  # 10 minutes
        }

# Global configuration instance
cors_config = CORSConfig()