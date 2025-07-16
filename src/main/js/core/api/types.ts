/**
 * API Types and Interfaces
 * Defines all TypeScript types for the API client
 */

// Base response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  message?: string;
  success: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  status?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

// Request options
export interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
  timeout?: number;
  retry?: RetryOptions;
  cache?: CacheOptions;
  signal?: AbortSignal;
}

export interface RetryOptions {
  attempts?: number;
  delay?: number;
  backoff?: boolean;
  retryOnStatus?: number[];
}

export interface CacheOptions {
  enabled?: boolean;
  ttl?: number; // Time to live in milliseconds
  key?: string;
  invalidate?: boolean;
}

// API Configuration
export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  retry?: RetryOptions;
  cache?: CacheOptions;
  interceptors?: {
    request?: RequestInterceptor[];
    response?: ResponseInterceptor[];
  };
}

// Interceptors
export type RequestInterceptor = (
  config: RequestOptions
) => RequestOptions | Promise<RequestOptions>;

export type ResponseInterceptor = (
  response: Response
) => Response | Promise<Response>;

// Loading state
export interface LoadingState {
  isLoading: boolean;
  operation?: string;
  progress?: number;
}

// Domain models
export interface Client {
  id: number;
  client_code: string;
  name: string;
  district?: string;
  phone?: string;
  email?: string;
  address: string;
  landmark?: string;
  floor?: string;
  delivery_notes?: string;
  latitude?: number;
  longitude?: number;
  geofence_radius?: number;
  is_active: boolean;
  preferred_delivery_time?: string;
  delivery_frequency?: string;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: number;
  client_id: number;
  driver_id?: number;
  vehicle_id?: number;
  delivery_date: string;
  status: DeliveryStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  client?: Client;
  driver?: Driver;
  vehicle?: Vehicle;
}

export interface Driver {
  id: number;
  employee_id: string;
  name: string;
  phone: string;
  is_available: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: number;
  plate_number: string;
  vehicle_type: string;
  is_available: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: number;
  driver_id: number;
  vehicle_id: number;
  route_date: string;
  status: RouteStatus;
  deliveries: Delivery[];
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  overview: {
    total_clients: number;
    available_drivers: number;
    available_vehicles: number;
    active_deliveries: number;
  };
  today_deliveries: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
  recent_activities: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

// Enums
export enum DeliveryStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

export enum RouteStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// Export types
export type { RequestInit };