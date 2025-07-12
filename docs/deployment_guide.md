# LuckyGas 部署指南

## 系統需求

- Python 3.8+
- SQLite (開發) 或 PostgreSQL (生產)
- 2GB+ RAM
- 10GB+ 磁碟空間

## 快速開始

### 1. 複製專案

```bash
git clone https://github.com/cheez95/LuckyGas.git
cd LuckyGas
```

### 2. 設定 Python 環境

```bash
# 建立虛擬環境
python3 -m venv venv

# 啟動虛擬環境
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 安裝套件
pip install -r requirements.txt
```

### 3. 初始化資料庫

```bash
# 建立資料庫結構
python src/main/python/core/database.py

# 匯入現有資料（選擇性）
python src/main/python/utils/data_importer.py
```

### 4. 啟動 API 伺服器

```bash
# 開發模式
uvicorn src.main.python.api.main:app --reload --host 0.0.0.0 --port 8000

# 生產模式
uvicorn src.main.python.api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 5. 存取系統

- API 文件：http://localhost:8000/docs
- ReDoc 文件：http://localhost:8000/redoc
- API 根路徑：http://localhost:8000/api

## 環境變數設定

建立 `.env` 檔案：

```env
# 資料庫設定
DATABASE_URL=sqlite:///./data/luckygas.db
# DATABASE_URL=postgresql://user:password@localhost/luckygas  # PostgreSQL

# API 設定
API_HOST=0.0.0.0
API_PORT=8000

# 安全設定
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Google Maps API (選擇性)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# SMS 設定 (選擇性)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+886912345678
```

## 生產環境部署

### 使用 Docker

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "src.main.python.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

建置並執行：

```bash
docker build -t luckygas .
docker run -d -p 8000:8000 --name luckygas-api luckygas
```

### 使用 Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db/luckygas
    depends_on:
      - db
    volumes:
      - ./data:/app/data

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=luckygas
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name luckygas.example.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 系統維護

### 資料備份

```bash
# SQLite 備份
cp data/luckygas.db data/backup/luckygas_$(date +%Y%m%d).db

# PostgreSQL 備份
pg_dump -U postgres luckygas > backup/luckygas_$(date +%Y%m%d).sql
```

### 日誌管理

```python
# 在 main.py 中設定日誌
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)
```

### 效能監控

1. **API 效能**：使用 FastAPI 內建的 metrics
2. **資料庫效能**：監控查詢時間和連線數
3. **系統資源**：使用 htop 或 glances 監控

## 故障排除

### 常見問題

1. **資料庫連線失敗**
   - 檢查 DATABASE_URL 設定
   - 確認資料庫服務正在執行
   - 檢查防火牆設定

2. **API 無法啟動**
   - 確認 port 8000 未被佔用
   - 檢查 Python 套件是否完整安裝
   - 查看錯誤日誌

3. **預測功能異常**
   - 確認有足夠的歷史資料
   - 檢查日期格式是否正確
   - 驗證客戶資料完整性

### 技術支援

- GitHub Issues: https://github.com/cheez95/LuckyGas/issues
- Email: support@luckygas.com
- 電話: 089-123456 (上班時間)

## 安全建議

1. **定期更新**：保持系統和套件最新
2. **存取控制**：限制 API 存取權限
3. **資料加密**：使用 HTTPS 傳輸
4. **備份策略**：每日自動備份
5. **監控告警**：設定異常通知

## 授權

本系統採用 MIT 授權條款。詳見 LICENSE 檔案。