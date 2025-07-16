# API Client Migration Guide

This guide helps you migrate from direct `fetch()` calls to the new unified API client.

## Overview

The new API client provides:
- ✅ Automatic CSRF protection
- ✅ Automatic retry logic with exponential backoff
- ✅ Unified error handling with user-friendly messages
- ✅ Request cancellation support
- ✅ Loading state management
- ✅ Request/response interceptors
- ✅ Cleaner, more maintainable code

## Setup

1. Import the API module at the top of your file:

```javascript
import { api } from './modules/api/index.js';
```

2. Initialize if needed (optional, auto-initializes with defaults):

```javascript
import { initializeAPI } from './modules/api/index.js';

initializeAPI({
    baseURL: '/api',
    debug: true
});
```

## Migration Examples

### 1. Simple GET Request

**Before:**
```javascript
const response = await fetch(`${API_BASE}/dashboard/stats`);
if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
}
const stats = await response.json();
```

**After:**
```javascript
const stats = await api.dashboard.getStats();
```

### 2. GET with Query Parameters

**Before:**
```javascript
const params = new URLSearchParams({
    page: 1,
    page_size: 20,
    search: searchTerm,
    is_active: true
});
const response = await fetch(`${API_BASE}/clients?${params}`);
const data = await response.json();
```

**After:**
```javascript
const data = await api.clients.list({
    page: 1,
    page_size: 20,
    search: searchTerm,
    is_active: true
});
```

### 3. POST Request with CSRF

**Before:**
```javascript
const response = await secureFetch(`${API_BASE}/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clientData)
});
if (!response.ok) {
    const error = await response.json();
    showToast(error.message || 'Error creating client', 'error');
    return;
}
const newClient = await response.json();
```

**After:**
```javascript
const newClient = await api.clients.create(clientData);
// Error handling is automatic
```

### 4. PUT Request

**Before:**
```javascript
const response = await secureFetch(`${API_BASE}/deliveries/${deliveryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'DELIVERED' })
});
```

**After:**
```javascript
await api.deliveries.updateStatus(deliveryId, 'DELIVERED');
```

### 5. DELETE Request

**Before:**
```javascript
const response = await fetch(`${API_BASE}/routes/${routeId}`, {
    method: 'DELETE'
});
if (!response.ok) {
    throw new Error('Failed to delete route');
}
```

**After:**
```javascript
await api.routes.delete(routeId);
```

### 6. Error Handling

**Before:**
```javascript
try {
    const response = await fetch(`${API_BASE}/clients/by-code/${clientCode}`);
    if (!response.ok) {
        if (response.status === 404) {
            showToast('Client not found', 'error');
        } else {
            showToast('Error loading client', 'error');
        }
        return;
    }
    const client = await response.json();
} catch (error) {
    console.error('Error:', error);
    showToast('Network error', 'error');
}
```

**After:**
```javascript
try {
    const client = await api.clients.getByCode(clientCode);
} catch (error) {
    // Specific error handling if needed
    // Default error messages are shown automatically
}
```

### 7. Loading States

**Before:**
```javascript
showLoading(true);
try {
    const response = await fetch(`${API_BASE}/deliveries`);
    const data = await response.json();
    renderDeliveries(data);
} finally {
    showLoading(false);
}
```

**After:**
```javascript
// Loading states are managed automatically
const data = await api.deliveries.list();
renderDeliveries(data);
```

### 8. Request Cancellation

**Before:**
```javascript
// Complex AbortController setup
const controller = new AbortController();
try {
    const response = await fetch(url, { signal: controller.signal });
} catch (error) {
    if (error.name === 'AbortError') {
        console.log('Request cancelled');
    }
}
```

**After:**
```javascript
// Automatic cancellation support
const data = await api.deliveries.list({}, { 
    requestId: 'delivery-list' 
});

// Cancel if needed
apiClient.cancelRequest('delivery-list');
```

## Complete Migration Example

Here's a complete function migration:

**Before:**
```javascript
async function loadDashboard() {
    try {
        // Show loading
        document.getElementById('loading').style.display = 'block';
        
        // Load stats
        const statsRes = await fetch(`${API_BASE}/dashboard/stats`);
        if (!statsRes.ok) {
            throw new Error(`HTTP error! status: ${statsRes.status}`);
        }
        const stats = await statsRes.json();
        
        // Load recent deliveries
        const deliveriesRes = await fetch(`${API_BASE}/deliveries?page_size=5&order_by=created_at&order_desc=true`);
        const deliveries = await deliveriesRes.json();
        
        // Update UI
        updateDashboard(stats, deliveries);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('載入儀表板失敗', 'error');
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}
```

**After:**
```javascript
async function loadDashboard() {
    try {
        // Load data in parallel
        const [stats, deliveries] = await Promise.all([
            api.dashboard.getStats(),
            api.deliveries.getRecent(5)
        ]);
        
        // Update UI
        updateDashboard(stats, deliveries);
        
    } catch (error) {
        // Error is handled automatically
        // Add specific handling only if needed
    }
}
```

## API Reference

### Available Endpoints

```javascript
// Dashboard
api.dashboard.getStats()

// Clients
api.clients.list(params)
api.clients.getAll(limit)
api.clients.getByCode(clientCode)
api.clients.create(data)
api.clients.updateByCode(clientCode, data)
api.clients.toggleStatus(clientCode, isActive)
api.clients.getDeliveries(clientCode, params)

// Deliveries
api.deliveries.list(params)
api.deliveries.getRecent(limit)
api.deliveries.getById(deliveryId)
api.deliveries.create(data)
api.deliveries.updateStatus(deliveryId, status)
api.deliveries.assign(deliveryId, assignment)
api.deliveries.update(deliveryId, data)
api.deliveries.getByDriver(driverId, limit)

// Drivers
api.drivers.list(params)
api.drivers.getAvailable()
api.drivers.getActive()
api.drivers.getById(driverId)
api.drivers.create(data)
api.drivers.update(driverId, data)
api.drivers.toggleStatus(driverId, isActive)
api.drivers.updateAvailability(driverId, isAvailable)

// Vehicles
api.vehicles.list(params)
api.vehicles.getActive()
api.vehicles.getAvailable()
api.vehicles.getById(vehicleId)
api.vehicles.create(data)
api.vehicles.update(vehicleId, data)
api.vehicles.toggleStatus(vehicleId, isActive)

// Routes
api.routes.list(params)
api.routes.getById(routeId)
api.routes.getMap(routeId)
api.routes.create(data)
api.routes.plan(data)
api.routes.update(routeId, data)
api.routes.delete(routeId)

// Scheduling
api.scheduling.generate(data)
api.scheduling.getMetrics(date)
api.scheduling.getConflicts(date)
api.scheduling.apply(data)
```

## Advanced Features

### Custom Request Options

```javascript
// With custom headers
const data = await api.clients.list({}, {
    headers: {
        'X-Custom-Header': 'value'
    }
});

// With request ID for cancellation
const data = await api.deliveries.list({}, {
    requestId: 'my-request'
});

// Cancel the request
apiClient.cancelRequest('my-request');
```

### Global Interceptors

```javascript
// Add request interceptor
apiClient.addRequestInterceptor((config) => {
    console.log('Request:', config);
    return config;
});

// Add response interceptor
apiClient.addResponseInterceptor((response) => {
    console.log('Response:', response);
    return response;
});

// Add error interceptor
apiClient.addErrorInterceptor((error) => {
    console.error('Error:', error);
    return error;
});
```

### Direct API Client Usage

For endpoints not yet in the endpoints file:

```javascript
// Direct GET
const data = await apiClient.get('/custom/endpoint', { param: 'value' });

// Direct POST
const result = await apiClient.post('/custom/endpoint', { data: 'value' });
```

## Migration Checklist

- [ ] Import API module
- [ ] Replace `fetch()` with appropriate `api.*` method
- [ ] Remove manual error handling (unless specific handling needed)
- [ ] Remove manual CSRF token handling
- [ ] Remove manual loading state management
- [ ] Test the migrated code
- [ ] Remove old `secureFetch` calls if all migrated

## Benefits Summary

1. **Less Code**: 50-70% reduction in boilerplate
2. **Better Error Handling**: Automatic user-friendly messages
3. **Improved UX**: Automatic loading states and retry logic
4. **Type Safety**: Clear API structure with IntelliSense support
5. **Maintainability**: Centralized API logic, easy to update
6. **Performance**: Request deduplication and caching support
7. **Security**: Automatic CSRF protection on all requests