/**
 * API Endpoints Module
 * Organized collection of all API endpoints
 */

import { apiClient } from './client.js';

/**
 * Dashboard API endpoints
 */
export const dashboard = {
    /**
     * Get dashboard statistics
     */
    getStats: () => apiClient.get('/dashboard/stats')
};

/**
 * Clients API endpoints
 */
export const clients = {
    /**
     * List clients with optional filters
     * @param {Object} params - Query parameters
     * @param {number} params.page - Page number
     * @param {number} params.page_size - Items per page
     * @param {string} params.search - Search term
     * @param {boolean} params.is_active - Filter by active status
     * @param {string} params.order_by - Sort field
     * @param {boolean} params.order_desc - Sort descending
     */
    list: (params = {}) => apiClient.get('/clients', params),

    /**
     * Get all clients (no pagination)
     * @param {number} limit - Maximum number of clients
     */
    getAll: (limit = 1000) => apiClient.get('/clients', { limit }),

    /**
     * Get client by code
     * @param {string} clientCode - Client code
     */
    getByCode: (clientCode) => apiClient.get(`/clients/by-code/${clientCode}`),

    /**
     * Create new client
     * @param {Object} data - Client data
     */
    create: (data) => apiClient.post('/clients', data),

    /**
     * Update client by code
     * @param {string} clientCode - Client code
     * @param {Object} data - Update data
     */
    updateByCode: (clientCode, data) => apiClient.put(`/clients/by-code/${clientCode}`, data),

    /**
     * Toggle client active status
     * @param {string} clientCode - Client code
     * @param {boolean} isActive - New active status
     */
    toggleStatus: (clientCode, isActive) => 
        apiClient.put(`/clients/by-code/${clientCode}`, { is_active: isActive }),

    /**
     * Get client deliveries
     * @param {string} clientCode - Client code
     * @param {Object} params - Query parameters
     */
    getDeliveries: (clientCode, params = {}) => 
        apiClient.get(`/clients/by-code/${clientCode}/deliveries`, params)
};

/**
 * Deliveries API endpoints
 */
export const deliveries = {
    /**
     * List deliveries with optional filters
     * @param {Object} params - Query parameters
     */
    list: (params = {}) => apiClient.get('/deliveries', params),

    /**
     * Get recent deliveries
     * @param {number} limit - Number of deliveries
     */
    getRecent: (limit = 5) => apiClient.get('/deliveries', {
        page_size: limit,
        order_by: 'created_at',
        order_desc: true
    }),

    /**
     * Get delivery by ID
     * @param {string} deliveryId - Delivery ID
     */
    getById: (deliveryId) => apiClient.get(`/deliveries/${deliveryId}`),

    /**
     * Create new delivery
     * @param {Object} data - Delivery data
     */
    create: (data) => apiClient.post('/deliveries', data),

    /**
     * Update delivery status
     * @param {string} deliveryId - Delivery ID
     * @param {string} status - New status
     */
    updateStatus: (deliveryId, status) => 
        apiClient.put(`/deliveries/${deliveryId}`, { status: status.toUpperCase() }),

    /**
     * Assign delivery to driver
     * @param {string} deliveryId - Delivery ID
     * @param {Object} assignment - Assignment data
     */
    assign: (deliveryId, assignment) => 
        apiClient.put(`/deliveries/${deliveryId}/assign`, assignment),

    /**
     * Update delivery
     * @param {string} deliveryId - Delivery ID
     * @param {Object} data - Update data
     */
    update: (deliveryId, data) => apiClient.put(`/deliveries/${deliveryId}`, data),

    /**
     * Get deliveries by driver
     * @param {string} driverId - Driver ID
     * @param {number} limit - Maximum results
     */
    getByDriver: (driverId, limit = 50) => 
        apiClient.get('/deliveries', { driver_id: driverId, limit })
};

/**
 * Drivers API endpoints
 */
export const drivers = {
    /**
     * List all drivers
     * @param {Object} params - Query parameters
     */
    list: (params = {}) => apiClient.get('/drivers', params),

    /**
     * Get available drivers
     */
    getAvailable: () => apiClient.get('/drivers', { is_available: true }),

    /**
     * Get active drivers
     */
    getActive: () => apiClient.get('/drivers', { is_active: true }),

    /**
     * Get driver by ID
     * @param {string} driverId - Driver ID
     */
    getById: (driverId) => apiClient.get(`/drivers/${driverId}`),

    /**
     * Create new driver
     * @param {Object} data - Driver data
     */
    create: (data) => apiClient.post('/drivers', data),

    /**
     * Update driver
     * @param {string} driverId - Driver ID
     * @param {Object} data - Update data
     */
    update: (driverId, data) => apiClient.put(`/drivers/${driverId}`, data),

    /**
     * Toggle driver active status
     * @param {string} driverId - Driver ID
     * @param {boolean} isActive - New active status
     */
    toggleStatus: (driverId, isActive) => 
        apiClient.put(`/drivers/${driverId}`, { is_active: isActive }),

    /**
     * Update driver availability
     * @param {string} driverId - Driver ID
     * @param {boolean} isAvailable - New availability status
     */
    updateAvailability: (driverId, isAvailable) => 
        apiClient.put(`/drivers/${driverId}`, { is_available: isAvailable })
};

/**
 * Vehicles API endpoints
 */
export const vehicles = {
    /**
     * List all vehicles
     * @param {Object} params - Query parameters
     */
    list: (params = {}) => apiClient.get('/vehicles', params),

    /**
     * Get active vehicles
     */
    getActive: () => apiClient.get('/vehicles', { is_active: true }),

    /**
     * Get available vehicles
     */
    getAvailable: () => apiClient.get('/vehicles', { is_available: true }),

    /**
     * Get vehicle by ID
     * @param {string} vehicleId - Vehicle ID
     */
    getById: (vehicleId) => apiClient.get(`/vehicles/${vehicleId}`),

    /**
     * Create new vehicle
     * @param {Object} data - Vehicle data
     */
    create: (data) => apiClient.post('/vehicles', data),

    /**
     * Update vehicle
     * @param {string} vehicleId - Vehicle ID
     * @param {Object} data - Update data
     */
    update: (vehicleId, data) => apiClient.put(`/vehicles/${vehicleId}`, data),

    /**
     * Toggle vehicle active status
     * @param {string} vehicleId - Vehicle ID
     * @param {boolean} isActive - New active status
     */
    toggleStatus: (vehicleId, isActive) => 
        apiClient.put(`/vehicles/${vehicleId}`, { is_active: isActive })
};

/**
 * Routes API endpoints
 */
export const routes = {
    /**
     * List routes with filters
     * @param {Object} params - Query parameters
     */
    list: (params = {}) => apiClient.get('/routes', params),

    /**
     * Get route by ID
     * @param {string} routeId - Route ID
     */
    getById: (routeId) => apiClient.get(`/routes/${routeId}`),

    /**
     * Get route map data
     * @param {string} routeId - Route ID
     */
    getMap: (routeId) => apiClient.get(`/routes/${routeId}/map`),

    /**
     * Create new route
     * @param {Object} data - Route data
     */
    create: (data) => apiClient.post('/routes', data),

    /**
     * Plan route optimization
     * @param {Object} data - Planning data
     */
    plan: (data) => apiClient.post('/routes/plan', data),

    /**
     * Update route
     * @param {string} routeId - Route ID
     * @param {Object} data - Update data
     */
    update: (routeId, data) => apiClient.put(`/routes/${routeId}`, data),

    /**
     * Delete route
     * @param {string} routeId - Route ID
     */
    delete: (routeId) => apiClient.delete(`/routes/${routeId}`)
};

/**
 * Scheduling API endpoints
 */
export const scheduling = {
    /**
     * Generate schedule
     * @param {Object} data - Schedule generation data
     */
    generate: (data) => apiClient.post('/scheduling/generate', data),

    /**
     * Get scheduling metrics
     * @param {string} date - Date for metrics
     */
    getMetrics: (date) => apiClient.get(`/scheduling/metrics/${date}`),

    /**
     * Get scheduling conflicts
     * @param {string} date - Date for conflicts
     */
    getConflicts: (date) => apiClient.get(`/scheduling/conflicts/${date}`),

    /**
     * Apply schedule
     * @param {Object} data - Schedule data to apply
     */
    apply: (data) => apiClient.post('/scheduling/apply', data)
};

/**
 * CSRF API endpoints
 */
export const csrf = {
    /**
     * Get CSRF token
     */
    getToken: () => apiClient.get('/csrf/token')
};

/**
 * Combined API object for easy access
 */
export const api = {
    dashboard,
    clients,
    deliveries,
    drivers,
    vehicles,
    routes,
    scheduling,
    csrf
};

// Default export
export default api;