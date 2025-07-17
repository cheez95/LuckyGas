# CORS Security Configuration

## Overview

This document explains the Cross-Origin Resource Sharing (CORS) security configuration for the LuckyGas API. The configuration has been updated to remove the wildcard "*" origin and implement environment-specific allowed origins for better security.

## Security Improvements

### Before (Security Risk)
```python
allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8000", "*"]
```

The wildcard "*" allowed ANY website to make requests to our API, which is a significant security risk.

### After (Secure)
```python
# Environment-specific allowed origins
allow_origins = cors_config.get_allowed_origins()
```

Now only explicitly allowed origins can make requests to the API.

## Configuration

### Environment Variables

Set the environment in your `.env` file:

```bash
# Options: development, staging, production
ENVIRONMENT=development

# For staging
STAGING_DOMAIN=staging.luckygas.com

# For production (comma-separated list)
PRODUCTION_DOMAIN=luckygas.com
ALLOWED_DOMAINS=luckygas.com,app.luckygas.com
```

### Environment-Specific Origins

#### Development
- `http://localhost:3000` (React)
- `http://localhost:5173` (Vite)
- `http://localhost:8000` (FastAPI)
- `http://localhost:8080` (Alternative)
- `http://127.0.0.1:*` (All localhost variants)

#### Staging
- `https://staging.luckygas.com`
- `https://www.staging.luckygas.com`
- `http://localhost:3000` (for testing)
- `http://localhost:8000` (for testing)

#### Production
- `https://luckygas.com`
- `https://www.luckygas.com`
- Any additional domains in `ALLOWED_DOMAINS`
- NO localhost access

## CORS Settings

The configuration includes:

- **Allowed Methods**: GET, POST, PUT, DELETE, PATCH, OPTIONS
- **Allowed Headers**: Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token
- **Exposed Headers**: X-Total-Count (for pagination)
- **Credentials**: Enabled (for cookies/auth)
- **Max Age**: 600 seconds (10 minutes)

## Testing

Run the CORS security tests:

```bash
pytest tests/test_cors_security.py -v
```

## Common Issues

### 1. CORS Error in Development
If you get CORS errors in development, ensure:
- Your frontend is running on an allowed port
- The `ENVIRONMENT` variable is set to `development`

### 2. CORS Error in Production
For production CORS errors:
- Verify your domain is in `ALLOWED_DOMAINS`
- Ensure you're using HTTPS in production
- Check that the domain includes/excludes "www" as needed

### 3. Adding New Origins
To add a new allowed origin:

1. For development: Add to the `development` list in `cors_config.py`
2. For production: Add to `ALLOWED_DOMAINS` environment variable

## Security Best Practices

1. **Never use wildcard "*"** in production
2. **Use HTTPS** for all production origins
3. **Limit origins** to only what's necessary
4. **Separate environments** with different allowed origins
5. **Regular audits** of allowed origins list

## Migration Guide

If you're updating from the old configuration:

1. Update your `.env` file with the `ENVIRONMENT` variable
2. For production, set `PRODUCTION_DOMAIN` and `ALLOWED_DOMAINS`
3. Deploy the updated `main.py` and `cors_config.py`
4. Test all frontend applications to ensure they still work
5. Monitor for any CORS-related errors

## Troubleshooting

### Debug CORS Issues

1. Check the browser's Network tab for CORS errors
2. Verify the Origin header being sent
3. Check server logs for the actual allowed origins
4. Use the test script to verify configuration:

```python
from config.cors_config import CORSConfig
config = CORSConfig()
print(f"Environment: {config.environment}")
print(f"Allowed origins: {config.get_allowed_origins()}")
```

### Common Error Messages

- **"CORS policy: No 'Access-Control-Allow-Origin' header"**: Origin not in allowed list
- **"CORS policy: Cannot use wildcard in 'Access-Control-Allow-Origin'"**: Credentials issue
- **"Preflight request failed"**: Check allowed methods/headers