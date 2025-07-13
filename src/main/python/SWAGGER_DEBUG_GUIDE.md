# Swagger UI Debugging Guide for LuckyGas API

## 🔍 Debugging Steps

### 1. **Open Swagger UI**
Navigate to: http://localhost:8000/docs

### 2. **Open Browser Developer Tools**
- **Chrome/Edge**: Press F12 or right-click → Inspect
- **Firefox**: Press F12 or right-click → Inspect Element
- **Safari**: Enable Developer menu in Preferences, then Cmd+Option+I

### 3. **Check Console Tab**
Look for any JavaScript errors in red. Common errors:
- `Failed to load API definition`
- `NetworkError when attempting to fetch resource`
- `CORS policy` errors

### 4. **Check Network Tab**
1. Clear the network log
2. Refresh the Swagger UI page
3. Look for:
   - `openapi.json` request - should return 200 OK
   - Any failed requests (shown in red)
   - Check request/response headers

### 5. **Try a Simple Request**
1. In Swagger UI, expand `GET /api/clients`
2. Click "Try it out"
3. Click "Execute"
4. Watch the Network tab for the request

### 6. **Common Issues and Solutions**

#### Issue: "Failed to load API definition"
**Check:**
```bash
curl http://localhost:8000/openapi.json
```
**Solution:** Ensure FastAPI server is running

#### Issue: CORS Errors
**Check Console for:**
```
Access to fetch at 'http://localhost:8000/api/clients' from origin 'http://localhost:8000' has been blocked by CORS policy
```
**Solution:** Already configured in main.py, but verify CORS middleware is active

#### Issue: 404 Not Found
**Check:** API endpoints should have `/api` prefix
**Example:** `/api/clients` not `/clients`

#### Issue: Network Failed
**Check:** Server is running
```bash
lsof -i :8000
```

### 7. **Test with curl**
Copy the curl command from Swagger UI and run it directly:
```bash
curl -X GET "http://localhost:8000/api/clients" -H "accept: application/json"
```

### 8. **Browser-Specific Issues**

#### Chrome/Brave:
- Check for ad blockers or privacy extensions blocking requests
- Try incognito mode

#### Firefox:
- Check for enhanced tracking protection
- Try safe mode

#### Safari:
- Check for Intelligent Tracking Prevention
- Enable "Disable Cross-Origin Restrictions" in Develop menu

### 9. **Advanced Debugging**

#### Check Request Headers:
In Network tab, click on the failed request and check:
- Request Headers
- Response Headers
- Preview/Response tab

#### Test with Postman/Insomnia:
If Swagger UI fails but curl works, it's likely a browser/CORS issue

#### Check Server Logs:
```bash
# If running with uvicorn
tail -f server.log

# Or run server in foreground to see logs
python3 api/main.py
```

### 10. **Quick Test Scripts**

We've created these test files for you:
1. `test_swagger.html` - Basic API connectivity test
2. `swagger_browser_test.html` - Comprehensive browser-based diagnostics
3. `debug_swagger_requests.py` - Python script to test all endpoints

Open `swagger_browser_test.html` in your browser for a visual debugging interface.

## 🚀 Quick Fix Checklist

- [ ] FastAPI server is running on port 8000
- [ ] Can access http://localhost:8000/docs
- [ ] No JavaScript errors in browser console
- [ ] openapi.json loads successfully
- [ ] CORS headers are present in responses
- [ ] API requests work with curl
- [ ] No browser extensions blocking requests

## 📝 Report Format

When reporting issues, include:
1. Browser name and version
2. Exact error message from console
3. Network tab screenshot showing failed request
4. Response from `curl http://localhost:8000/openapi.json`
5. Any relevant server logs