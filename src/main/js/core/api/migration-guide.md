# API Client Migration Guide

This guide shows how to migrate from direct fetch calls to the unified API client.

## Setup

First, include the API client in your HTML:

```html
<!-- Add to index.html before app.js -->
<script type="module" src="/src/main/js/core/api/index.js"></script>
```

## Migration Examples

### 1. Basic GET Request

**Before:**
```javascript
// Direct fetch
const response = await fetch(`${API_BASE}/clients?page=${page}&page_size=20`);
const data = await response.json();
```

**After:**
```javascript
// Using unified API client
const { data, success, error } = await api.clients.list({
  page: page,
  page_size: 20
});

if (success) {
  // Use data
} else {
  // Handle error
  console.error(error);
}
```

### 2. GET with Error Handling

**Before:**
```javascript
try {
  const response = await fetch(`${API_BASE}/deliveries/${deliveryId}`);
  if (!response.ok) throw new Error('Failed to fetch delivery');
  const delivery = await response.json();
  // Use delivery
} catch (error) {
  console.error('Error:', error);
  showNotification('載入失敗', 'error');
}
```

**After:**
```javascript
const { data: delivery, success, error } = await api.deliveries.get(deliveryId);

if (success) {
  // Use delivery
} else {
  showNotification(error.message || '載入失敗', 'error');
}
```

### 3. POST Request

**Before:**
```javascript
const response = await fetch(`${API_BASE}/clients`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(formData)
});

if (response.ok) {
  const newClient = await response.json();
  showNotification('客戶新增成功', 'success');
}
```

**After:**
```javascript
const { data: newClient, success, error } = await api.clients.create(formData);

if (success) {
  showNotification('客戶新增成功', 'success');
} else {
  showNotification(error.message || '新增失敗', 'error');
}
```

### 4. PUT Request with Form Data

**Before:**
```javascript
const response = await fetch(`${API_BASE}/drivers/${driverId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: formData.get('name'),
    phone: formData.get('phone'),
    is_available: formData.get('is_available') === 'on'
  })
});
```

**After:**
```javascript
const { success, error } = await api.drivers.update(driverId, {
  name: formData.get('name'),
  phone: formData.get('phone'),
  is_available: formData.get('is_available') === 'on'
});
```

### 5. Complex Query Parameters

**Before:**
```javascript
const params = new URLSearchParams();
if (deliveryFilters.search) params.append('search', deliveryFilters.search);
if (deliveryFilters.status) params.append('status', deliveryFilters.status);
if (deliveryFilters.dateFrom) params.append('date_from', deliveryFilters.dateFrom);
if (deliveryFilters.dateTo) params.append('date_to', deliveryFilters.dateTo);
params.append('page', page);
params.append('page_size', 20);

const response = await fetch(`${API_BASE}/deliveries?${params}`);
```

**After:**
```javascript
const { data, success } = await api.deliveries.list({
  search: deliveryFilters.search,
  status: deliveryFilters.status,
  date_from: deliveryFilters.dateFrom,
  date_to: deliveryFilters.dateTo,
  page: page,
  page_size: 20
});
```

### 6. File Export (Blob Response)

**Before:**
```javascript
const response = await fetch(`${API_BASE}/clients?${params}&export=csv`);
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
a.click();
```

**After:**
```javascript
const { data: blob, success } = await api.clients.export(params);

if (success) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
```

### 7. Loading State Management

**Before:**
```javascript
// Manual loading state
let isLoading = true;
showLoadingSpinner();

try {
  const response = await fetch(url);
  // ... process response
} finally {
  isLoading = false;
  hideLoadingSpinner();
}
```

**After:**
```javascript
// Automatic loading state management
import { loadingManager } from '/src/main/js/core/api/index.js';

// Subscribe to loading changes
loadingManager.subscribe((state) => {
  if (state.isLoading) {
    showLoadingSpinner();
  } else {
    hideLoadingSpinner();
  }
});

// API calls automatically manage loading state
const { data } = await api.clients.list();
```

### 8. Request Cancellation

**Before:**
```javascript
// No easy way to cancel fetch requests
```

**After:**
```javascript
// Cancel specific request
const controller = new AbortController();
const { data } = await api.clients.list({}, {
  signal: controller.signal
});

// Cancel when needed
controller.abort();

// Or cancel all pending requests
api.utils.cancelAllRequests();
```

### 9. Cache Management

**Before:**
```javascript
// Manual caching logic
const cacheKey = `clients_${page}`;
const cached = sessionStorage.getItem(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const response = await fetch(url);
const data = await response.json();
sessionStorage.setItem(cacheKey, JSON.stringify(data));
```

**After:**
```javascript
// Automatic caching with TTL
const { data } = await api.clients.list({ page });
// Automatically cached for 30 seconds

// Force refresh
const { data: fresh } = await api.clients.list({ page }, {
  cache: { invalidate: true }
});

// Clear all cache
api.utils.invalidateCache();

// Clear specific pattern
api.utils.invalidateCache(/clients/);
```

### 10. Batch Operations

**Before:**
```javascript
// Sequential requests
const driversRes = await fetch(`${API_BASE}/drivers?is_available=true`);
const drivers = await driversRes.json();

const vehiclesRes = await fetch(`${API_BASE}/vehicles?is_active=true`);  
const vehicles = await vehiclesRes.json();
```

**After:**
```javascript
// Parallel requests with better error handling
const [driversResult, vehiclesResult] = await Promise.all([
  api.drivers.list({ is_available: true }),
  api.vehicles.list({ is_active: true })
]);

if (driversResult.success && vehiclesResult.success) {
  const drivers = driversResult.data;
  const vehicles = vehiclesResult.data;
  // Use data
}
```

## Benefits of Migration

1. **Consistent Error Handling**: All errors follow the same pattern
2. **Automatic Retries**: Failed requests retry automatically
3. **Request Caching**: Reduce server load with intelligent caching
4. **Loading States**: Automatic loading state management
5. **Type Safety**: Full TypeScript support
6. **Interceptors**: Add auth tokens, logging, etc. automatically
7. **Cancellation**: Easy request cancellation
8. **Better DX**: Cleaner, more maintainable code

## Gradual Migration Strategy

1. Start with new features using the API client
2. Migrate high-traffic endpoints first (dashboard, lists)
3. Update error-prone areas (complex error handling)
4. Convert remaining endpoints module by module
5. Remove old fetch code once fully migrated

## Testing

The API client is fully testable:

```javascript
// Mock the API client in tests
import { ApiClient } from '/src/main/js/core/api/client.js';

const mockClient = new ApiClient({
  baseURL: 'http://localhost:3000/mock-api'
});

// Or use fetch mocks
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ data: 'test' })
  })
);
```