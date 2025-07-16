/**
 * API Endpoints (JavaScript version)
 * Centralized endpoint definitions for the LuckyGas API
 */

export class LuckyGasAPI {
  constructor(client) {
    this.client = client;

    // Dashboard endpoints
    this.dashboard = {
      getStats: () => 
        this.client.get('/dashboard/stats', {
          cache: { enabled: true, ttl: 60000 } // Cache for 1 minute
        })
    };

    // Client endpoints
    this.clients = {
      list: (params) => 
        this.client.get('/clients', {
          params,
          cache: { enabled: true, ttl: 30000 } // Cache for 30 seconds
        }),

      getByCode: (clientCode) => 
        this.client.get(`/clients/by-code/${clientCode}`, {
          cache: { enabled: true, ttl: 60000 }
        }),

      getById: (id) => 
        this.client.get(`/clients/${id}`, {
          cache: { enabled: true, ttl: 60000 }
        }),

      create: (data) => 
        this.client.post('/clients', data, {
          cache: { invalidate: true }
        }),

      update: (clientCode, data) => 
        this.client.put(`/clients/by-code/${clientCode}`, data, {
          cache: { invalidate: true }
        }),

      delete: (clientCode) => 
        this.client.delete(`/clients/by-code/${clientCode}`, {
          cache: { invalidate: true }
        }),

      getDeliveries: (clientCode, params) => 
        this.client.get(`/clients/by-code/${clientCode}/deliveries`, { params }),

      export: (params) => 
        this.client.get('/clients', {
          params: { ...params, export: 'csv' },
          headers: { Accept: 'text/csv' }
        })
    };

    // Delivery endpoints
    this.deliveries = {
      list: (params) => 
        this.client.get('/deliveries', {
          params,
          cache: { enabled: true, ttl: 10000 } // Cache for 10 seconds
        }),

      get: (id) => 
        this.client.get(`/deliveries/${id}`, {
          cache: { enabled: true, ttl: 30000 }
        }),

      create: (data) => 
        this.client.post('/deliveries', data, {
          cache: { invalidate: true }
        }),

      update: (id, data) => 
        this.client.put(`/deliveries/${id}`, data, {
          cache: { invalidate: true }
        }),

      updateStatus: (id, status) => 
        this.client.patch(`/deliveries/${id}/status`, { status }, {
          cache: { invalidate: true }
        }),

      delete: (id) => 
        this.client.delete(`/deliveries/${id}`, {
          cache: { invalidate: true }
        }),

      export: (params) => 
        this.client.get('/deliveries', {
          params: { ...params, export: 'csv' },
          headers: { Accept: 'text/csv' }
        })
    };

    // Driver endpoints
    this.drivers = {
      list: (params) => 
        this.client.get('/drivers', {
          params,
          cache: { enabled: true, ttl: 30000 }
        }),

      get: (id) => 
        this.client.get(`/drivers/${id}`, {
          cache: { enabled: true, ttl: 60000 }
        }),

      create: (data) => 
        this.client.post('/drivers', data, {
          cache: { invalidate: true }
        }),

      update: (id, data) => 
        this.client.put(`/drivers/${id}`, data, {
          cache: { invalidate: true }
        }),

      delete: (id) => 
        this.client.delete(`/drivers/${id}`, {
          cache: { invalidate: true }
        }),

      getDeliveries: (id, params) => 
        this.client.get('/deliveries', {
          params: { driver_id: id, ...params }
        })
    };

    // Vehicle endpoints
    this.vehicles = {
      list: (params) => 
        this.client.get('/vehicles', {
          params,
          cache: { enabled: true, ttl: 30000 }
        }),

      get: (id) => 
        this.client.get(`/vehicles/${id}`, {
          cache: { enabled: true, ttl: 60000 }
        }),

      create: (data) => 
        this.client.post('/vehicles', data, {
          cache: { invalidate: true }
        }),

      update: (id, data) => 
        this.client.put(`/vehicles/${id}`, data, {
          cache: { invalidate: true }
        }),

      delete: (id) => 
        this.client.delete(`/vehicles/${id}`, {
          cache: { invalidate: true }
        })
    };

    // Route endpoints
    this.routes = {
      list: (params) => 
        this.client.get('/routes', {
          params,
          cache: { enabled: true, ttl: 20000 }
        }),

      get: (id) => 
        this.client.get(`/routes/${id}`, {
          cache: { enabled: true, ttl: 30000 }
        }),

      create: (data) => 
        this.client.post('/routes', data, {
          cache: { invalidate: true }
        }),

      update: (id, data) => 
        this.client.put(`/routes/${id}`, data, {
          cache: { invalidate: true }
        }),

      delete: (id) => 
        this.client.delete(`/routes/${id}`, {
          cache: { invalidate: true }
        }),

      getMap: (id) => 
        this.client.get(`/routes/${id}/map`, {
          cache: { enabled: true, ttl: 300000 } // Cache for 5 minutes
        }),

      planBulk: (data) => 
        this.client.post('/routes/plan', data, {
          cache: { invalidate: true }
        })
    };

    // Scheduling endpoints  
    this.scheduling = {
      getCalendar: (params) => 
        this.client.get('/scheduling/calendar', { params }),

      createSchedule: (data) => 
        this.client.post('/scheduling/schedule', data, {
          cache: { invalidate: true }
        })
    };

    // Utility methods
    this.utils = {
      invalidateCache: (pattern) => {
        if (pattern) {
          this.client.cache?.invalidatePattern(pattern);
        } else {
          this.client.cache?.clear();
        }
      },

      cancelAllRequests: () => {
        this.client.cancelAllRequests();
      }
    };
  }
}