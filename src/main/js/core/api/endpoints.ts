/**
 * API Endpoints
 * Centralized endpoint definitions for the LuckyGas API
 */

import { ApiClient } from './client';
import type {
  Client,
  Delivery,
  Driver,
  Vehicle,
  Route,
  DashboardStats,
  PaginatedResponse,
  ApiResponse
} from './types';

export class LuckyGasAPI {
  private client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  // Dashboard endpoints
  dashboard = {
    getStats: () => 
      this.client.get<DashboardStats>('/dashboard/stats', {
        cache: { enabled: true, ttl: 60000 } // Cache for 1 minute
      })
  };

  // Client endpoints
  clients = {
    list: (params?: {
      page?: number;
      page_size?: number;
      search?: string;
      district?: string;
      is_active?: boolean;
      order_by?: string;
      order_desc?: boolean;
    }) => 
      this.client.get<PaginatedResponse<Client>>('/clients', {
        params,
        cache: { enabled: true, ttl: 30000 } // Cache for 30 seconds
      }),

    getByCode: (clientCode: string) => 
      this.client.get<Client>(`/clients/by-code/${clientCode}`, {
        cache: { enabled: true, ttl: 60000 }
      }),

    getById: (id: number) => 
      this.client.get<Client>(`/clients/${id}`, {
        cache: { enabled: true, ttl: 60000 }
      }),

    create: (data: Partial<Client>) => 
      this.client.post<Client>('/clients', data, {
        cache: { invalidate: true }
      }),

    update: (clientCode: string, data: Partial<Client>) => 
      this.client.put<Client>(`/clients/by-code/${clientCode}`, data, {
        cache: { invalidate: true }
      }),

    delete: (clientCode: string) => 
      this.client.delete(`/clients/by-code/${clientCode}`, {
        cache: { invalidate: true }
      }),

    getDeliveries: (clientCode: string, params?: {
      page?: number;
      page_size?: number;
    }) => 
      this.client.get<PaginatedResponse<Delivery>>(
        `/clients/by-code/${clientCode}/deliveries`,
        { params }
      ),

    export: (params?: any) => 
      this.client.get<Blob>('/clients', {
        params: { ...params, export: 'csv' },
        headers: { Accept: 'text/csv' }
      })
  };

  // Delivery endpoints
  deliveries = {
    list: (params?: {
      page?: number;
      page_size?: number;
      search?: string;
      status?: string | string[];
      driver_id?: number;
      vehicle_id?: number;
      date_from?: string;
      date_to?: string;
      order_by?: string;
      order_desc?: boolean;
    }) => 
      this.client.get<PaginatedResponse<Delivery>>('/deliveries', {
        params,
        cache: { enabled: true, ttl: 10000 } // Cache for 10 seconds
      }),

    get: (id: number) => 
      this.client.get<Delivery>(`/deliveries/${id}`, {
        cache: { enabled: true, ttl: 30000 }
      }),

    create: (data: Partial<Delivery>) => 
      this.client.post<Delivery>('/deliveries', data, {
        cache: { invalidate: true }
      }),

    update: (id: number, data: Partial<Delivery>) => 
      this.client.put<Delivery>(`/deliveries/${id}`, data, {
        cache: { invalidate: true }
      }),

    updateStatus: (id: number, status: string) => 
      this.client.patch<Delivery>(`/deliveries/${id}/status`, { status }, {
        cache: { invalidate: true }
      }),

    delete: (id: number) => 
      this.client.delete(`/deliveries/${id}`, {
        cache: { invalidate: true }
      }),

    export: (params?: any) => 
      this.client.get<Blob>('/deliveries', {
        params: { ...params, export: 'csv' },
        headers: { Accept: 'text/csv' }
      })
  };

  // Driver endpoints
  drivers = {
    list: (params?: {
      is_available?: boolean;
      is_active?: boolean;
    }) => 
      this.client.get<PaginatedResponse<Driver>>('/drivers', {
        params,
        cache: { enabled: true, ttl: 30000 }
      }),

    get: (id: number) => 
      this.client.get<Driver>(`/drivers/${id}`, {
        cache: { enabled: true, ttl: 60000 }
      }),

    create: (data: Partial<Driver>) => 
      this.client.post<Driver>('/drivers', data, {
        cache: { invalidate: true }
      }),

    update: (id: number, data: Partial<Driver>) => 
      this.client.put<Driver>(`/drivers/${id}`, data, {
        cache: { invalidate: true }
      }),

    delete: (id: number) => 
      this.client.delete(`/drivers/${id}`, {
        cache: { invalidate: true }
      }),

    getDeliveries: (id: number, params?: {
      limit?: number;
    }) => 
      this.client.get<PaginatedResponse<Delivery>>('/deliveries', {
        params: { driver_id: id, ...params }
      })
  };

  // Vehicle endpoints
  vehicles = {
    list: (params?: {
      is_available?: boolean;
      is_active?: boolean;
    }) => 
      this.client.get<PaginatedResponse<Vehicle>>('/vehicles', {
        params,
        cache: { enabled: true, ttl: 30000 }
      }),

    get: (id: number) => 
      this.client.get<Vehicle>(`/vehicles/${id}`, {
        cache: { enabled: true, ttl: 60000 }
      }),

    create: (data: Partial<Vehicle>) => 
      this.client.post<Vehicle>('/vehicles', data, {
        cache: { invalidate: true }
      }),

    update: (id: number, data: Partial<Vehicle>) => 
      this.client.put<Vehicle>(`/vehicles/${id}`, data, {
        cache: { invalidate: true }
      }),

    delete: (id: number) => 
      this.client.delete(`/vehicles/${id}`, {
        cache: { invalidate: true }
      })
  };

  // Route endpoints
  routes = {
    list: (params?: {
      page?: number;
      page_size?: number;
      driver_id?: number;
      date?: string;
      status?: string;
    }) => 
      this.client.get<PaginatedResponse<Route>>('/routes', {
        params,
        cache: { enabled: true, ttl: 20000 }
      }),

    get: (id: number) => 
      this.client.get<Route>(`/routes/${id}`, {
        cache: { enabled: true, ttl: 30000 }
      }),

    create: (data: Partial<Route>) => 
      this.client.post<Route>('/routes', data, {
        cache: { invalidate: true }
      }),

    update: (id: number, data: Partial<Route>) => 
      this.client.put<Route>(`/routes/${id}`, data, {
        cache: { invalidate: true }
      }),

    delete: (id: number) => 
      this.client.delete(`/routes/${id}`, {
        cache: { invalidate: true }
      }),

    getMap: (id: number) => 
      this.client.get(`/routes/${id}/map`, {
        cache: { enabled: true, ttl: 300000 } // Cache for 5 minutes
      }),

    planBulk: (data: {
      date: string;
      driver_ids: number[];
      vehicle_ids: number[];
    }) => 
      this.client.post('/routes/plan', data, {
        cache: { invalidate: true }
      })
  };

  // Scheduling endpoints  
  scheduling = {
    getCalendar: (params?: {
      start_date?: string;
      end_date?: string;
    }) => 
      this.client.get('/scheduling/calendar', { params }),

    createSchedule: (data: any) => 
      this.client.post('/scheduling/schedule', data, {
        cache: { invalidate: true }
      })
  };

  // Utility methods
  utils = {
    invalidateCache: (pattern?: string | RegExp) => {
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

// Export types for convenience
export type { 
  Client, 
  Delivery, 
  Driver, 
  Vehicle, 
  Route, 
  DashboardStats,
  PaginatedResponse,
  ApiResponse 
};