# LuckyGas API Reference Documentation

## API Overview

**Base URL**: `http://localhost:8000/api`  
**Version**: 1.0.0  
**Framework**: FastAPI  
**Authentication**: Currently not implemented (planned: JWT)

### Available Documentation
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Response Format
All API responses follow a consistent JSON format:

#### Success Response
```json
{
  "status": "success",
  "data": { ... },
  "message": "Operation completed successfully"
}
```

#### Error Response
```json
{
  "detail": "Error message describing what went wrong"
}
```

#### Paginated Response
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 10,
  "total_pages": 10
}
```

---

## 🏢 Client Management API

### List Clients
**GET** `/api/clients`

Get paginated list of clients with optional filters.

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| page_size | integer | 10 | Items per page (max: 100) |
| keyword | string | - | Search in name, address, contact, code |
| district | string | - | Filter by district |
| is_corporate | boolean | - | Corporate customer filter |
| is_active | boolean | - | Active status filter |
| area | string | - | Area filter (backward compatibility) |
| order_by | string | created_at | Sort field |
| order_desc | boolean | false | Sort descending |

#### Response
```json
{
  "items": [
    {
      "id": 1,
      "client_code": "C001",
      "name": "王小明瓦斯行",
      "address": "台東市中正路123號",
      "district": "台東市",
      "phone": "089-123456",
      "contact_person": "王小明",
      "is_active": true,
      "cylinder_50kg_count": 10,
      "cylinder_20kg_count": 20,
      "created_at": "2024-01-01T00:00:00"
    }
  ],
  "total": 150,
  "page": 1,
  "page_size": 10,
  "total_pages": 15
}
```

### Get Client Details
**GET** `/api/clients/{client_id}`

Get detailed information about a specific client.

#### Path Parameters
- `client_id` (integer, required): Client ID

#### Response
```json
{
  "id": 1,
  "client_code": "C001",
  "name": "王小明瓦斯行",
  "invoice_title": "王小明瓦斯行有限公司",
  "tax_id": "12345678",
  "address": "台東市中正路123號",
  "district": "台東市",
  "phone": "089-123456",
  "contact_person": "王小明",
  "email": "contact@example.com",
  "latitude": 22.754547,
  "longitude": 121.145523,
  "cylinder_50kg_count": 10,
  "cylinder_20kg_count": 20,
  "cylinder_16kg_count": 5,
  "cylinder_10kg_count": 0,
  "cylinder_4kg_count": 0,
  "flow_meter_20kg": 2,
  "flow_meter_50kg": 1,
  "business_hours": {
    "monday": ["08:00-12:00", "13:00-18:00"],
    "tuesday": ["08:00-12:00", "13:00-18:00"]
  },
  "payment_method": "月結",
  "monthly_credit_limit": 50000,
  "is_subscription_member": false,
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-15T10:30:00",
  "statistics": {
    "total_deliveries": 45,
    "completed_deliveries": 43,
    "pending_deliveries": 2,
    "last_delivery_date": "2024-03-15",
    "average_days_between_deliveries": 14
  }
}
```

### Create Client
**POST** `/api/clients`

Create a new client record.

#### Request Body
```json
{
  "name": "新客戶瓦斯行",
  "address": "台東市新生路456號",
  "district": "台東市",
  "phone": "089-234567",
  "contact_person": "陳經理",
  "tax_id": "87654321",
  "email": "new@example.com",
  "cylinder_50kg_count": 5,
  "cylinder_20kg_count": 10,
  "payment_method": "現金"
}
```

#### Response
- **Status**: 201 Created
- **Body**: Created client object

### Update Client
**PUT** `/api/clients/{client_id}`

Update existing client information.

#### Path Parameters
- `client_id` (integer, required): Client ID

#### Request Body
```json
{
  "phone": "089-345678",
  "email": "updated@example.com",
  "cylinder_20kg_count": 15
}
```

#### Response
- Updated client object

### Delete Client
**DELETE** `/api/clients/{client_id}`

Soft delete a client (marks as inactive).

#### Path Parameters
- `client_id` (integer, required): Client ID

#### Response
```json
{
  "message": "客戶已刪除"
}
```

---

## 🚚 Delivery Management API

### List Deliveries
**GET** `/api/deliveries`

Get paginated list of deliveries with filters.

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| page_size | integer | 10 | Items per page |
| keyword | string | - | Search keyword |
| client_id | integer | - | Filter by client |
| driver_id | integer | - | Filter by driver |
| status | string | - | PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED |
| payment_status | string | - | pending, paid, overdue |
| scheduled_date_from | date | - | Start date (YYYY-MM-DD) |
| scheduled_date_to | date | - | End date (YYYY-MM-DD) |
| district | string | - | District filter |

#### Response
```json
{
  "items": [
    {
      "id": 1,
      "client_id": 1,
      "client_name": "王小明瓦斯行",
      "client_address": "台東市中正路123號",
      "scheduled_date": "2024-03-20",
      "scheduled_time_start": "09:00",
      "scheduled_time_end": "12:00",
      "status": "PENDING",
      "delivered_quantity_50kg": 5,
      "delivered_quantity_20kg": 10,
      "returned_quantity_50kg": 2,
      "returned_quantity_20kg": 5,
      "driver_id": null,
      "driver_name": null,
      "vehicle_id": null,
      "vehicle_plate": null,
      "total_amount": 15000,
      "payment_status": "pending"
    }
  ],
  "total": 250,
  "page": 1,
  "page_size": 10,
  "total_pages": 25
}
```

### Create Delivery
**POST** `/api/deliveries`

Create a new delivery order.

#### Request Body
```json
{
  "client_id": 1,
  "scheduled_date": "2024-03-25",
  "scheduled_time_start": "09:00",
  "scheduled_time_end": "12:00",
  "delivery_address": "台東市中正路123號",
  "delivered_quantity_50kg": 3,
  "delivered_quantity_20kg": 6,
  "notes": "請先電話聯繫"
}
```

#### Response
- **Status**: 201 Created
- **Body**: Created delivery object

### Assign Driver and Vehicle
**POST** `/api/deliveries/{delivery_id}/assign`

Assign a driver and vehicle to a delivery.

#### Path Parameters
- `delivery_id` (integer, required): Delivery ID

#### Query Parameters
- `driver_id` (integer, required): Driver ID
- `vehicle_id` (integer, required): Vehicle ID

#### Response
- Updated delivery object with assignments

### Get Today's Summary
**GET** `/api/deliveries/today/summary`

Get delivery statistics for today.

#### Response
```json
{
  "date": "2024-03-20",
  "total_deliveries": 25,
  "status_breakdown": {
    "PENDING": 5,
    "ASSIGNED": 3,
    "IN_PROGRESS": 7,
    "COMPLETED": 10,
    "CANCELLED": 0
  },
  "driver_workload": [
    {
      "driver_id": 1,
      "driver_name": "張司機",
      "delivery_count": 8,
      "completed_count": 5
    }
  ],
  "district_summary": [
    {
      "district": "台東市",
      "delivery_count": 15
    }
  ]
}
```

---

## 👤 Driver Management API

### List Drivers
**GET** `/api/drivers`

Get paginated list of drivers.

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| page_size | integer | 10 | Items per page |
| keyword | string | - | Search in name, employee ID, phone |
| status | string | - | active, inactive, on_leave |
| license_expiring_soon | boolean | - | License expires within 30 days |
| has_vehicle_assigned | boolean | - | Currently has vehicle |

#### Response
```json
{
  "items": [
    {
      "id": 1,
      "name": "張大明",
      "employee_id": "EMP001",
      "phone": "0912-345678",
      "id_number": "A123456789",
      "license_number": "DL123456",
      "license_expiry_date": "2025-06-30",
      "status": "active",
      "is_available": true,
      "current_vehicle_id": 1,
      "current_vehicle_plate": "ABC-123",
      "experience_years": 5,
      "familiar_areas": ["台東市", "卑南鄉"]
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 10,
  "total_pages": 1
}
```

### Get Available Drivers
**GET** `/api/drivers/available/list`

Get list of available drivers for a specific date.

#### Query Parameters
- `scheduled_date` (date, required): Date to check availability (YYYY-MM-DD)

#### Response
- Array of available driver objects

### Get Driver Deliveries
**GET** `/api/drivers/{driver_id}/deliveries`

Get delivery history and statistics for a driver.

#### Path Parameters
- `driver_id` (integer, required): Driver ID

#### Query Parameters
- `start_date` (date): Start date for history
- `end_date` (date): End date for history

#### Response
```json
{
  "driver_id": 1,
  "driver_name": "張大明",
  "statistics": {
    "total_deliveries": 150,
    "completed_deliveries": 145,
    "average_deliveries_per_day": 6,
    "total_distance_km": 2500
  },
  "recent_deliveries": [...]
}
```

---

## 🚗 Vehicle Management API

### List Vehicles
**GET** `/api/vehicles`

Get paginated list of vehicles.

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| page_size | integer | 10 | Items per page |
| keyword | string | - | Search in plate number |
| vehicle_type | string | - | CAR, MOTORCYCLE |
| fuel_type | string | - | gasoline, diesel, electric |
| status | string | - | active, maintenance, retired |
| insurance_expiring_soon | boolean | - | Insurance expires within 30 days |
| inspection_due_soon | boolean | - | Inspection due within 30 days |

#### Response
```json
{
  "items": [
    {
      "id": 1,
      "plate_number": "ABC-123",
      "vehicle_type": "CAR",
      "brand": "Toyota",
      "model": "Hiace",
      "year": 2020,
      "fuel_type": "diesel",
      "status": "active",
      "max_cylinders_50kg": 20,
      "max_cylinders_20kg": 40,
      "max_cylinders_16kg": 50,
      "current_driver_id": 1,
      "current_driver_name": "張大明",
      "insurance_expiry_date": "2024-12-31",
      "inspection_due_date": "2024-06-30",
      "last_maintenance_date": "2024-02-15"
    }
  ],
  "total": 5,
  "page": 1,
  "page_size": 10,
  "total_pages": 1
}
```

### Get Available Vehicles
**GET** `/api/vehicles/available/list`

Get list of available vehicles for a specific date.

#### Query Parameters
- `scheduled_date` (date, required): Date to check availability
- `vehicle_type` (string): Filter by vehicle type

#### Response
- Array of available vehicle objects

### Assign Driver to Vehicle
**POST** `/api/vehicles/{vehicle_id}/assign-driver`

Assign or unassign a driver to a vehicle.

#### Path Parameters
- `vehicle_id` (integer, required): Vehicle ID

#### Query Parameters
- `driver_id` (integer): Driver ID (null to unassign)

#### Response
```json
{
  "message": "司機指派成功"
}
```

---

## 🗺️ Route Optimization API

### Generate Optimized Routes
**POST** `/api/routes/plan`

Generate optimized delivery routes for a given date.

#### Request Body
```json
{
  "delivery_date": "2024-03-25",
  "area": "台東市",
  "vehicle_ids": [1, 2],
  "driver_ids": [1, 2],
  "optimization_params": {
    "consider_traffic": true,
    "max_deliveries_per_route": 20,
    "start_time": "08:00",
    "end_time": "18:00"
  }
}
```

#### Response
```json
{
  "success": true,
  "routes": [
    {
      "route_number": 1,
      "driver_id": 1,
      "driver_name": "張大明",
      "vehicle_id": 1,
      "vehicle_plate": "ABC-123",
      "total_deliveries": 15,
      "total_distance_km": 45.2,
      "estimated_duration_minutes": 180,
      "deliveries": [...],
      "waypoints": [...]
    }
  ],
  "optimization_score": 0.85,
  "total_distance_saved_km": 12.5
}
```

### Get Route Map Data
**GET** `/api/routes/{route_id}/map`

Get map visualization data for a route.

#### Path Parameters
- `route_id` (integer, required): Route ID

#### Response
```json
{
  "center": {
    "lat": 22.754547,
    "lng": 121.145523
  },
  "waypoints": [
    {
      "position": {
        "lat": 22.754547,
        "lng": 121.145523
      },
      "type": "start",
      "label": "起點"
    },
    {
      "position": {
        "lat": 22.756789,
        "lng": 121.148901
      },
      "type": "delivery",
      "label": "王小明瓦斯行",
      "delivery_id": 1
    }
  ],
  "polyline": "encoded_polyline_string",
  "bounds": {
    "north": 22.758,
    "south": 22.752,
    "east": 121.150,
    "west": 121.140
  }
}
```

---

## 📊 Dashboard API

### Get Dashboard Statistics
**GET** `/api/dashboard/stats`

Get comprehensive dashboard statistics.

#### Response
```json
{
  "overview": {
    "total_clients": 150,
    "active_clients": 145,
    "total_drivers": 10,
    "available_drivers": 7,
    "total_vehicles": 5,
    "active_vehicles": 4
  },
  "today_deliveries": {
    "date": "2024-03-20",
    "total": 25,
    "by_status": {
      "PENDING": 5,
      "ASSIGNED": 3,
      "IN_PROGRESS": 7,
      "COMPLETED": 10
    }
  },
  "weekly_trend": [
    {
      "date": "2024-03-14",
      "deliveries": 22,
      "completed": 20
    }
  ],
  "recent_activities": [
    {
      "timestamp": "2024-03-20T10:30:00",
      "type": "delivery_completed",
      "description": "配送完成 - 王小明瓦斯行",
      "user": "張大明"
    }
  ]
}
```

### Get District Statistics
**GET** `/api/dashboard/districts`

Get statistics grouped by district.

#### Response
```json
[
  {
    "district": "台東市",
    "client_count": 85,
    "delivery_count": 120,
    "pending_deliveries": 15
  },
  {
    "district": "卑南鄉",
    "client_count": 35,
    "delivery_count": 45,
    "pending_deliveries": 5
  }
]
```

---

## 🔧 Utility Endpoints

### Health Check
**GET** `/health`

Check system health status.

#### Response
```json
{
  "status": "healthy",
  "timestamp": "2024-03-20T10:30:00",
  "version": "1.0.0",
  "database": "connected",
  "services": {
    "google_maps": "operational",
    "twilio": "operational",
    "sendgrid": "operational"
  }
}
```

### API Information
**GET** `/api`

Get API metadata.

#### Response
```json
{
  "title": "LuckyGas API",
  "version": "1.0.0",
  "description": "幸福氣配送管理系統 API",
  "endpoints": [
    "/api/clients",
    "/api/deliveries",
    "/api/drivers",
    "/api/vehicles",
    "/api/routes",
    "/api/dashboard"
  ]
}
```

---

## 📝 Data Models

### Client Schema
```typescript
interface Client {
  id: number;
  client_code: string;
  name: string;
  invoice_title?: string;
  tax_id?: string;
  address: string;
  district: string;
  phone: string;
  contact_person?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  cylinder_50kg_count: number;
  cylinder_20kg_count: number;
  cylinder_16kg_count: number;
  cylinder_10kg_count: number;
  cylinder_4kg_count: number;
  flow_meter_20kg: number;
  flow_meter_50kg: number;
  business_hours: object;
  payment_method: string;
  monthly_credit_limit?: number;
  is_subscription_member: boolean;
  is_active: boolean;
  created_at: datetime;
  updated_at: datetime;
}
```

### Delivery Schema
```typescript
interface Delivery {
  id: number;
  client_id: number;
  scheduled_date: date;
  scheduled_time_start?: string;
  scheduled_time_end?: string;
  status: DeliveryStatus;
  delivery_address: string;
  delivered_quantity_50kg: number;
  delivered_quantity_20kg: number;
  delivered_quantity_16kg: number;
  returned_quantity_50kg: number;
  returned_quantity_20kg: number;
  driver_id?: number;
  vehicle_id?: number;
  route_id?: number;
  route_sequence?: number;
  actual_delivery_time?: datetime;
  signature_url?: string;
  photo_url?: string;
  notes?: string;
  total_amount: number;
  payment_status: string;
  created_at: datetime;
  updated_at: datetime;
}
```

### Error Codes
| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate resource |
| 422 | Unprocessable Entity - Validation error |
| 500 | Internal Server Error |

---

## 🚀 Advanced Features

### Batch Operations
Some endpoints support batch operations for efficiency:

- **Batch Create Deliveries**: POST `/api/deliveries/batch`
- **Batch Update Client Cylinders**: PUT `/api/clients/batch/cylinders`

### Webhooks (Planned)
Future versions will support webhooks for:
- Delivery status changes
- Route optimization completion
- Driver availability changes

### Rate Limiting
API rate limits (when implemented):
- 1000 requests per hour per IP
- 100 requests per minute per IP

---

*Last Updated: 2025-07-15*  
*API Version: 1.0.0*