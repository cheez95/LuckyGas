# LuckyGas API 文件

## 概述

LuckyGas API 提供完整的瓦斯配送管理功能，包含客戶管理、配送排程、路線優化等功能。

基礎 URL：`http://localhost:8000/api`

## 認證

目前 API 尚未實作認證機制。生產環境建議加入 JWT 認證。

## API 端點

### 客戶管理 `/clients`

#### 取得客戶列表
```http
GET /api/clients?page=1&page_size=10&search=王&sort_by=created_at&sort_order=desc
```

查詢參數：
- `page`: 頁碼（預設 1）
- `page_size`: 每頁筆數（預設 10）
- `search`: 搜尋關鍵字（名稱、地址、電話）
- `area`: 區域篩選
- `is_active`: 是否啟用（true/false）
- `sort_by`: 排序欄位
- `sort_order`: 排序方向（asc/desc）

回應範例：
```json
{
  "items": [
    {
      "id": 1,
      "client_code": "1400103",
      "invoice_title": "豐年國小",
      "short_name": "豐年附幼",
      "address": "臺東市中興路三段320號",
      "area": "A-瑞光",
      "daily_usage_avg": 2.5,
      "is_active": true
    }
  ],
  "total": 1267,
  "page": 1,
  "page_size": 10,
  "total_pages": 127
}
```

#### 建立客戶
```http
POST /api/clients
```

請求內容：
```json
{
  "client_code": "1400999",
  "invoice_title": "測試餐廳",
  "short_name": "測試店",
  "address": "臺東市中正路100號",
  "phone": "089-123456",
  "tax_id": "12345678",
  "area": "A-瑞光",
  "cylinder_20kg": 2,
  "payment_method": "monthly",
  "time_windows": [
    {"start": 9, "end": 12},
    {"start": 14, "end": 18}
  ]
}
```

#### 更新客戶
```http
PUT /api/clients/{client_id}
```

#### 刪除客戶（軟刪除）
```http
DELETE /api/clients/{client_id}
```

#### 搜尋客戶（電話）
```http
GET /api/clients/search/by-phone?phone=089-123456
```

#### 取得客戶統計
```http
GET /api/clients/{client_id}/statistics
```

回應範例：
```json
{
  "total_deliveries": 45,
  "avg_delivery_interval_days": 28,
  "total_kg_delivered": 900,
  "avg_monthly_usage": 32.5,
  "last_delivery_date": "2025-07-01"
}
```

### 配送管理 `/deliveries`

#### 取得配送列表
```http
GET /api/deliveries?date=2025-07-12&status=pending&driver_id=1
```

查詢參數：
- `date`: 配送日期（YYYY-MM-DD）
- `start_date`: 開始日期
- `end_date`: 結束日期
- `status`: 狀態（pending/assigned/in_progress/completed）
- `driver_id`: 司機 ID
- `area`: 區域

#### 建立配送
```http
POST /api/deliveries
```

請求內容：
```json
{
  "client_id": 1,
  "scheduled_date": "2025-07-13",
  "scheduled_time_start": "09:00",
  "scheduled_time_end": "12:00",
  "cylinders": {
    "20kg": 2,
    "16kg": 1
  },
  "notes": "請先電話聯絡"
}
```

#### 更新配送狀態
```http
PUT /api/deliveries/{delivery_id}/status
```

請求內容：
```json
{
  "status": "completed",
  "delivered_cylinders": {
    "20kg": 2,
    "16kg": 1
  },
  "returned_cylinders": {
    "20kg": 2,
    "16kg": 1
  },
  "notes": "配送完成",
  "signature_url": "https://example.com/signatures/12345.png"
}
```

#### 分配司機和車輛
```http
PUT /api/deliveries/{delivery_id}/assign
```

請求內容：
```json
{
  "driver_id": 1,
  "vehicle_id": 2
}
```

#### 今日配送總覽
```http
GET /api/deliveries/today/summary
```

回應範例：
```json
{
  "date": "2025-07-12",
  "total_deliveries": 85,
  "by_status": {
    "pending": 20,
    "assigned": 30,
    "in_progress": 25,
    "completed": 10
  },
  "by_area": {
    "A-瑞光": 25,
    "B-四維": 20,
    "C-復國": 15
  },
  "total_cylinders": {
    "50kg": 10,
    "20kg": 120,
    "16kg": 80,
    "10kg": 40
  }
}
```

### 路線優化 `/routes`

#### 生成優化路線
```http
POST /api/routes/optimize
```

請求內容：
```json
{
  "date": "2025-07-13",
  "areas": ["A-瑞光", "B-四維"],
  "available_vehicles": [1, 2, 3],
  "available_drivers": [1, 2, 3],
  "optimization_params": {
    "max_distance_km": 100,
    "max_duration_minutes": 480,
    "prioritize_urgent": true
  }
}
```

#### 取得路線詳情
```http
GET /api/routes/{route_id}
```

回應範例：
```json
{
  "route_info": {
    "id": 1,
    "date": "2025-07-13",
    "name": "A-瑞光-張三",
    "area": "A-瑞光",
    "driver": "張三",
    "vehicle": "BDV-2827",
    "total_distance": 45.3,
    "total_duration": 360,
    "total_clients": 25
  },
  "points": [
    {
      "client_id": 1,
      "name": "豐年附幼",
      "address": "臺東市中興路三段320號",
      "lat": 22.7553,
      "lng": 121.1504,
      "sequence": 1,
      "estimated_arrival": "2025-07-13T08:00:00"
    }
  ]
}
```

### 預測服務 `/predictions`

#### 生成配送預測
```http
POST /api/predictions/generate
```

請求內容：
```json
{
  "days_ahead": 7,
  "include_areas": ["A-瑞光", "B-四維"],
  "min_confidence": 0.7
}
```

#### 取得優先配送清單
```http
GET /api/predictions/priority-list?date=2025-07-13
```

回應範例：
```json
[
  {
    "client_id": 1,
    "client_name": "豐年附幼",
    "address": "臺東市中興路三段320號",
    "area": "A-瑞光",
    "predicted_depletion": "2025-07-15",
    "days_until_depletion": 3,
    "current_inventory": 15.5,
    "daily_usage": 5.2,
    "confidence_score": 0.85,
    "priority_score": 0.92
  }
]
```

### 司機管理 `/drivers`

#### 取得可用司機
```http
GET /api/drivers/available/list?date=2025-07-13
```

#### 取得司機工作統計
```http
GET /api/drivers/{driver_id}/workload?month=2025-07
```

### 車輛管理 `/vehicles`

#### 取得需要保養的車輛
```http
GET /api/vehicles/maintenance/due?days=30
```

#### 分配司機到車輛
```http
PUT /api/vehicles/{vehicle_id}/assign-driver
```

## 錯誤處理

API 使用標準 HTTP 狀態碼：

- `200 OK`: 請求成功
- `201 Created`: 資源建立成功
- `400 Bad Request`: 請求參數錯誤
- `404 Not Found`: 資源不存在
- `422 Unprocessable Entity`: 驗證錯誤
- `500 Internal Server Error`: 伺服器錯誤

錯誤回應格式：
```json
{
  "detail": "客戶編號已存在"
}
```

## 日期格式

API 支援兩種日期格式：
- ISO 8601：`2025-07-12`
- 民國格式：`114/07/12`

回應中包含 `date_minguo` 欄位提供民國格式日期。

## 分頁

所有列表端點都支援分頁：
- `page`: 頁碼（從 1 開始）
- `page_size`: 每頁筆數（預設 10，最大 100）

回應包含分頁資訊：
- `total`: 總筆數
- `page`: 當前頁碼
- `page_size`: 每頁筆數
- `total_pages`: 總頁數

## WebSocket 即時更新

即時追蹤端點：`ws://localhost:8000/ws/tracking`

連線後發送：
```json
{
  "type": "subscribe",
  "driver_id": 1
}
```

接收更新：
```json
{
  "type": "location_update",
  "driver_id": 1,
  "lat": 22.7553,
  "lng": 121.1504,
  "timestamp": "2025-07-12T10:30:00"
}
```