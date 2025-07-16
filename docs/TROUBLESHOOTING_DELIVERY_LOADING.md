# Troubleshooting: 載入配送單失敗 (Failed to Load Deliveries)

## Issue Description
Users were experiencing "載入配送單失敗" (Failed to load deliveries) error when trying to view deliveries in the tabbed interface.

## Root Cause Analysis

### Primary Issue
The frontend was sending status parameters incorrectly to the API:
- **Wrong**: `?status=pending,assigned,in_progress` (comma-separated string)
- **Correct**: `?status=pending&status=assigned&status=in_progress` (multiple parameters)

### Code Location
File: `/src/main/python/web/app.js`
Function: `loadDeliveries()` (lines 609-616)

## Solution Applied

### 1. Fixed Status Parameter Construction
Changed from:
```javascript
params.append('status', 'pending,assigned,in_progress');
```

To:
```javascript
params.append('status', 'pending');
params.append('status', 'assigned');
params.append('status', 'in_progress');
```

### 2. Enhanced Error Handling
Added detailed error logging to help diagnose future issues:
```javascript
if (!response.ok) {
    console.error('API response error:', response.status, response.statusText);
    const errorText = await response.text();
    console.error('Error details:', errorText);
    throw new Error(`API error: ${response.status} ${response.statusText}`);
}
```

### 3. Added Debug Logging
Added console logging for troubleshooting:
- Current tab state
- Final API URL being called
- Response status and details

## Testing & Verification

### Browser Console Test
Created `/tests/fix_verification.js` to verify:
1. Tab initialization
2. API URL construction
3. Manual API calls
4. Function availability

### Quick Test Steps
1. Open browser console (F12)
2. Navigate to Deliveries section
3. Check console for debug messages
4. Verify URLs contain multiple status parameters
5. Confirm deliveries load without error

### Expected API URLs
- **Planned Tab**: `/api/deliveries?page=1&page_size=10&status=pending&status=assigned&status=in_progress`
- **History Tab**: `/api/deliveries?page=1&page_size=10&status=completed&status=cancelled`

## Prevention

### Best Practices
1. Always check API documentation for parameter format
2. Use browser DevTools Network tab to verify API calls
3. Add error handling with detailed logging
4. Test with different parameter combinations

### Code Review Checklist
- [ ] URLSearchParams usage matches API expectations
- [ ] Error responses properly handled
- [ ] Console logging added for debugging
- [ ] Test with actual API endpoints

## Related Files
- `/src/main/python/web/app.js` - Frontend delivery loading
- `/src/main/python/api/routers/deliveries.py` - Backend API endpoint
- `/src/main/python/api/schemas/delivery.py` - API schema definitions
- `/tests/fix_verification.js` - Browser console test script

## Additional Notes
The backend API was correctly implemented to handle multiple status parameters using SQLAlchemy's IN operator. The issue was purely on the frontend side with how the parameters were being constructed.