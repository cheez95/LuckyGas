/**
 * Mock Data Factories for Testing
 * Provides factory functions for creating test data
 */

/**
 * Creates a mock user object
 * @param {Object} overrides - Properties to override
 * @returns {Object}
 */
export function createMockUser(overrides = {}) {
    return {
        id: Math.random().toString(36).substr(2, 9),
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        active: true,
        createdAt: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Creates a mock client object
 * @param {Object} overrides - Properties to override
 * @returns {Object}
 */
export function createMockClient(overrides = {}) {
    return {
        id: Math.random().toString(36).substr(2, 9),
        name: 'Test Client',
        phone: '0912345678',
        address: '123 Test Street',
        deliveryAddress: '123 Test Street',
        latitude: 25.0330,
        longitude: 121.5654,
        type: 'regular',
        active: true,
        createdAt: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Creates a mock delivery object
 * @param {Object} overrides - Properties to override
 * @returns {Object}
 */
export function createMockDelivery(overrides = {}) {
    return {
        id: Math.random().toString(36).substr(2, 9),
        clientId: 'client-123',
        driverId: 'driver-456',
        routeId: 'route-789',
        status: 'pending',
        scheduledDate: new Date().toISOString(),
        scheduledTime: '14:00',
        quantity: 2,
        price: 1000,
        notes: '',
        createdAt: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Creates a mock driver object
 * @param {Object} overrides - Properties to override
 * @returns {Object}
 */
export function createMockDriver(overrides = {}) {
    return {
        id: Math.random().toString(36).substr(2, 9),
        name: 'Test Driver',
        phone: '0987654321',
        vehicleId: 'vehicle-123',
        active: true,
        status: 'available',
        currentLocation: {
            latitude: 25.0330,
            longitude: 121.5654
        },
        createdAt: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Creates a mock vehicle object
 * @param {Object} overrides - Properties to override
 * @returns {Object}
 */
export function createMockVehicle(overrides = {}) {
    return {
        id: Math.random().toString(36).substr(2, 9),
        plateNumber: 'ABC-123',
        type: 'truck',
        capacity: 20,
        status: 'available',
        maintenanceStatus: 'good',
        lastMaintenance: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Creates a mock route object
 * @param {Object} overrides - Properties to override
 * @returns {Object}
 */
export function createMockRoute(overrides = {}) {
    return {
        id: Math.random().toString(36).substr(2, 9),
        name: 'Test Route',
        driverId: 'driver-123',
        vehicleId: 'vehicle-456',
        date: new Date().toISOString(),
        status: 'planned',
        deliveries: [],
        estimatedDuration: 180,
        estimatedDistance: 50,
        createdAt: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Creates a mock API response
 * @param {Object} data - Response data
 * @param {Object} options - Response options
 * @returns {Object}
 */
export function createMockApiResponse(data, options = {}) {
    return {
        status: 200,
        ok: true,
        data,
        headers: {
            'content-type': 'application/json',
            ...options.headers
        },
        ...options
    };
}

/**
 * Creates a mock error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Object}
 */
export function createMockErrorResponse(message = 'Error occurred', status = 500) {
    return {
        status,
        ok: false,
        data: {
            error: message,
            detail: message
        }
    };
}

/**
 * Creates a mock state object
 * @param {Object} overrides - State properties to override
 * @returns {Object}
 */
export function createMockState(overrides = {}) {
    return {
        user: createMockUser(),
        clients: {
            list: [createMockClient()],
            selected: null,
            loading: false,
            error: null
        },
        deliveries: {
            list: [createMockDelivery()],
            selected: null,
            loading: false,
            error: null,
            filters: {
                status: 'all',
                date: null
            }
        },
        drivers: {
            list: [createMockDriver()],
            selected: null,
            loading: false,
            error: null
        },
        vehicles: {
            list: [createMockVehicle()],
            selected: null,
            loading: false,
            error: null
        },
        routes: {
            list: [createMockRoute()],
            selected: null,
            loading: false,
            error: null
        },
        ui: {
            sidebarOpen: true,
            theme: 'light',
            notifications: [],
            modals: {
                active: null
            }
        },
        ...overrides
    };
}

/**
 * Creates a batch of mock objects
 * @param {Function} factory - Factory function
 * @param {number} count - Number of objects to create
 * @param {Function} modifier - Function to modify each object
 * @returns {Array}
 */
export function createBatch(factory, count, modifier = (obj, i) => obj) {
    return Array.from({ length: count }, (_, i) => {
        const obj = factory();
        return modifier(obj, i);
    });
}

/**
 * Creates mock form data
 * @param {Object} data - Form data
 * @returns {FormData}
 */
export function createMockFormData(data) {
    const formData = new FormData();
    
    Object.entries(data).forEach(([key, value]) => {
        if (value instanceof File) {
            formData.append(key, value);
        } else if (Array.isArray(value)) {
            value.forEach(item => formData.append(key, item));
        } else {
            formData.append(key, String(value));
        }
    });
    
    return formData;
}

/**
 * Creates a mock event object
 * @param {string} type - Event type
 * @param {Object} properties - Event properties
 * @returns {Event}
 */
export function createMockEvent(type, properties = {}) {
    const event = new Event(type, {
        bubbles: true,
        cancelable: true
    });
    
    Object.assign(event, {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn(),
        ...properties
    });
    
    return event;
}

/**
 * Creates mock localStorage
 * @param {Object} initialData - Initial data
 * @returns {Object}
 */
export function createMockLocalStorage(initialData = {}) {
    const storage = { ...initialData };
    
    return {
        getItem: jest.fn(key => storage[key] || null),
        setItem: jest.fn((key, value) => {
            storage[key] = String(value);
        }),
        removeItem: jest.fn(key => {
            delete storage[key];
        }),
        clear: jest.fn(() => {
            Object.keys(storage).forEach(key => delete storage[key]);
        }),
        get length() {
            return Object.keys(storage).length;
        },
        key: jest.fn(index => {
            const keys = Object.keys(storage);
            return keys[index] || null;
        })
    };
}

/**
 * Creates mock date/time utilities
 * @param {Date|string} fixedDate - Fixed date for testing
 * @returns {Object}
 */
export function createMockDateUtils(fixedDate = '2024-01-15T10:00:00Z') {
    const date = new Date(fixedDate);
    
    return {
        now: jest.fn(() => date.getTime()),
        today: jest.fn(() => new Date(date.toDateString())),
        format: jest.fn((d, format) => {
            // Simple date formatter for testing
            const dateObj = new Date(d);
            return format
                .replace('YYYY', dateObj.getFullYear())
                .replace('MM', String(dateObj.getMonth() + 1).padStart(2, '0'))
                .replace('DD', String(dateObj.getDate()).padStart(2, '0'));
        })
    };
}

export default {
    createMockUser,
    createMockClient,
    createMockDelivery,
    createMockDriver,
    createMockVehicle,
    createMockRoute,
    createMockApiResponse,
    createMockErrorResponse,
    createMockState,
    createBatch,
    createMockFormData,
    createMockEvent,
    createMockLocalStorage,
    createMockDateUtils
};