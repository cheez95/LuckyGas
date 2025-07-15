# Swagger UI 使用指南

## 問題說明

當您在 Swagger UI 中看到 `{"detail":"找不到該客戶"}` 錯誤時，這是因為您嘗試查詢一個不存在的客戶 ID。

## 正確的測試步驟

### 1. 先取得有效的資料 ID

#### 取得客戶列表
1. 在 Swagger UI 中找到 `GET /api/clients`
2. 點擊 "Try it out"
3. 點擊 "Execute"
4. 從回應中找到實際存在的客戶 ID（例如：1, 2, 1283 等）

#### 取得司機列表
1. 在 Swagger UI 中找到 `GET /api/drivers`
2. 點擊 "Try it out"
3. 點擊 "Execute"
4. 從回應中找到實際存在的司機 ID

#### 取得車輛列表
1. 在 Swagger UI 中找到 `GET /api/vehicles`
2. 點擊 "Try it out"
3. 點擊 "Execute"
4. 從回應中找到實際存在的車輛 ID

### 2. 使用有效 ID 測試特定資源

#### 查詢特定客戶
1. 在 Swagger UI 中找到 `GET /api/clients/{client_id}`
2. 點擊 "Try it out"
3. 將 `client_id` 改為您從列表中找到的有效 ID（例如：1283）
4. 點擊 "Execute"

### 3. 測試 POST 請求

#### 新增客戶
```json
{
  "name": "測試客戶",
  "address": "台北市信義區測試路123號"
}
```

#### 新增配送單
```json
{
  "client_id": 1283,  // 使用實際存在的客戶 ID
  "scheduled_date": "2025-07-15",
  "scheduled_time_slot": "上午 9:00-12:00",
  "gas_quantity": 2,
  "unit_price": 800,
  "delivery_fee": 50,
  "delivery_address": "台北市信義區測試路123號",
  "delivery_district": "信義區",
  "payment_method": "cash",
  "notes": "請按門鈴",
  "requires_empty_cylinder_return": true,
  "empty_cylinders_to_return": 2
}
```

## 常見錯誤及解決方法

### 404 Not Found - "找不到該客戶"
- **原因**：使用了不存在的 ID
- **解決**：先用 GET 列表端點找到有效的 ID

### 400 Bad Request
- **原因**：資料格式錯誤或違反唯一性約束
- **解決**：檢查請求資料格式，確保唯一欄位（如 employee_id）不重複

### 422 Unprocessable Entity
- **原因**：資料驗證失敗
- **解決**：檢查必填欄位和資料格式

## 快速測試腳本

您也可以使用以下 curl 命令快速測試：

```bash
# 取得客戶列表
curl http://localhost:8000/api/clients

# 取得特定客戶（使用實際存在的 ID）
curl http://localhost:8000/api/clients/1283

# 新增客戶
curl -X POST http://localhost:8000/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name": "新客戶", "address": "新地址"}'
```

## 提示

1. Swagger UI 中的預設值只是範例，通常需要修改為實際值
2. 先執行 GET 請求了解資料結構和現有資料
3. 使用實際存在的 ID 進行測試
4. 注意台灣特定的驗證規則（電話、身分證等）