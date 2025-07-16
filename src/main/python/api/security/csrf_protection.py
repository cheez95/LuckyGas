"""
CSRF Protection Module
Provides middleware and utilities for Cross-Site Request Forgery protection
"""

import secrets
import time
from typing import Optional, Dict, Any
from functools import wraps

from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.datastructures import Headers, MutableHeaders


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF Protection Middleware for FastAPI
    """
    
    # Configuration
    TOKEN_HEADER = "X-CSRF-Token"
    TOKEN_LENGTH = 64
    TOKEN_EXPIRY = 86400  # 24 hours in seconds
    PROTECTED_METHODS = {"POST", "PUT", "DELETE", "PATCH"}
    EXEMPT_PATHS = {"/api/docs", "/api/redoc", "/api/openapi.json", "/health"}
    
    def __init__(self, app, secret_key: Optional[str] = None):
        super().__init__(app)
        self.secret_key = secret_key or secrets.token_hex(32)
        self._token_store = {}  # In production, use Redis or similar
        
    async def dispatch(self, request: Request, call_next):
        """
        Process request through CSRF protection
        """
        # Skip CSRF check for exempt paths
        if self._is_exempt_path(request.url.path):
            return await call_next(request)
            
        # Skip CSRF check for safe methods
        if request.method not in self.PROTECTED_METHODS:
            return await call_next(request)
            
        # Check for CSRF exemption flag (set by @csrf_exempt decorator)
        if hasattr(request.state, "csrf_exempt") and request.state.csrf_exempt:
            return await call_next(request)
            
        # Validate CSRF token
        token = request.headers.get(self.TOKEN_HEADER)
        
        if not token:
            return self._csrf_error_response("Missing CSRF token")
            
        if not self._validate_token(token):
            return self._csrf_error_response("Invalid CSRF token")
            
        # Process request
        response = await call_next(request)
        return response
        
    def _is_exempt_path(self, path: str) -> bool:
        """
        Check if path is exempt from CSRF protection
        """
        # Check exact matches
        if path in self.EXEMPT_PATHS:
            return True
            
        # Check prefixes (for API documentation)
        for exempt_path in self.EXEMPT_PATHS:
            if path.startswith(exempt_path):
                return True
                
        return False
        
    def _validate_token(self, token: str) -> bool:
        """
        Validate CSRF token
        """
        # Basic format validation
        if not token or len(token) != self.TOKEN_LENGTH:
            return False
            
        # Check if token exists in store
        if token not in self._token_store:
            return False
            
        # Check token expiry
        token_data = self._token_store[token]
        if time.time() - token_data["created_at"] > self.TOKEN_EXPIRY:
            # Clean up expired token
            del self._token_store[token]
            return False
            
        return True
        
    def _csrf_error_response(self, detail: str) -> JSONResponse:
        """
        Create CSRF error response
        """
        return JSONResponse(
            status_code=403,
            content={"detail": detail, "error": "csrf_validation_failed"},
            headers={"X-CSRF-Error": "invalid-token"}
        )
        
    def generate_token(self) -> str:
        """
        Generate a new CSRF token
        """
        token = secrets.token_hex(self.TOKEN_LENGTH // 2)
        self._token_store[token] = {
            "created_at": time.time()
        }
        
        # Clean up old tokens periodically
        self._cleanup_expired_tokens()
        
        return token
        
    def _cleanup_expired_tokens(self):
        """
        Remove expired tokens from store
        """
        current_time = time.time()
        expired_tokens = [
            token for token, data in self._token_store.items()
            if current_time - data["created_at"] > self.TOKEN_EXPIRY
        ]
        
        for token in expired_tokens:
            del self._token_store[token]


def csrf_exempt(func):
    """
    Decorator to exempt a route from CSRF protection
    """
    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        request.state.csrf_exempt = True
        return await func(request, *args, **kwargs)
    return wrapper


class CSRFTokenManager:
    """
    Utility class for CSRF token management
    """
    
    @staticmethod
    def validate_token_format(token: str) -> bool:
        """
        Validate token format
        """
        if not token:
            return False
            
        # Check length (64 hex characters)
        if len(token) != 64:
            return False
            
        # Check if it's valid hex
        try:
            int(token, 16)
            return True
        except ValueError:
            return False
            
    @staticmethod
    def extract_token_from_headers(headers: Headers) -> Optional[str]:
        """
        Extract CSRF token from request headers
        """
        return headers.get(CSRFMiddleware.TOKEN_HEADER)
        
    @staticmethod
    def add_token_to_response(response: Response, token: str):
        """
        Add CSRF token to response headers
        """
        response.headers[CSRFMiddleware.TOKEN_HEADER] = token
        return response