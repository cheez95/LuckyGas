# Docker 部署指南

## 概述

本專案使用 Docker Compose 管理多個服務，包含：
- FastAPI 應用程式
- PostgreSQL 資料庫
- Redis 快取
- Nginx 反向代理
- 自動備份服務

## 快速開始

### 1. 環境設定

複製環境變數範例檔案並修改：

```bash
cp .env.example .env
```

編輯 `.env` 檔案，設定必要的環境變數：
- 資料庫密碼
- Redis 密碼
- Secret Keys
- CORS 來源

### 2. 建立必要目錄

```bash
mkdir -p logs uploads backup static nginx/ssl
```

### 3. SSL 證書設定（生產環境）

將 SSL 證書放置在 `nginx/ssl/` 目錄：
- `cert.pem` - SSL 證書
- `key.pem` - 私鑰

使用 Let's Encrypt 的範例：
```bash
certbot certonly --webroot -w /var/www/certbot \
  -d luckygas.com -d www.luckygas.com
```

### 4. 啟動服務

開發環境：
```bash
docker-compose up -d
```

生產環境：
```bash
docker-compose -f docker-compose.yml up -d
```

### 5. 檢查服務狀態

```bash
docker-compose ps
docker-compose logs -f
```

## 服務配置詳情

### API 服務
- 端口：8000
- 健康檢查：`http://localhost:8000/health`
- 日誌：`./logs/`
- 上傳檔案：`./uploads/`

### PostgreSQL
- 端口：5432
- 資料持久化：Docker volume
- 備份：每日 2:00 AM 自動備份到 `./backup/`

### Redis
- 端口：6379
- 持久化：AOF (Append Only File)
- 密碼保護：透過環境變數設定

### Nginx
- HTTP 端口：80
- HTTPS 端口：443
- 配置檔案：`./nginx/conf.d/`
- 日誌：Docker volume

## 維護操作

### 查看日誌
```bash
# 所有服務日誌
docker-compose logs -f

# 特定服務日誌
docker-compose logs -f api
docker-compose logs -f nginx
```

### 資料庫備份
```bash
# 手動備份
docker-compose exec db pg_dump -U postgres luckygas > backup/manual_backup.sql

# 還原備份
docker-compose exec -T db psql -U postgres luckygas < backup/backup_file.sql
```

### 更新應用程式
```bash
# 重新建構映像
docker-compose build api

# 重啟服務
docker-compose up -d api
```

### 清理資源
```bash
# 停止所有服務
docker-compose down

# 移除所有資料（謹慎使用）
docker-compose down -v
```

## 監控與健康檢查

所有服務都配置了健康檢查：

- API: `curl http://localhost:8000/health`
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- Nginx: `wget http://localhost/health`

使用以下命令查看健康狀態：
```bash
docker-compose ps
```

## 故障排除

### 服務無法啟動
1. 檢查端口是否被佔用
2. 檢查環境變數設定
3. 查看服務日誌

### 資料庫連接失敗
1. 確認資料庫服務正在運行
2. 檢查環境變數中的資料庫連接字串
3. 確認網路配置正確

### Nginx 502 錯誤
1. 確認 API 服務正在運行
2. 檢查 upstream 配置
3. 查看 Nginx 錯誤日誌

## 安全建議

1. **密碼管理**
   - 使用強密碼
   - 定期更換密碼
   - 不要將密碼提交到版本控制

2. **網路安全**
   - 限制資料庫端口對外開放
   - 使用 SSL/TLS 加密
   - 配置防火牆規則

3. **備份策略**
   - 定期測試備份還原
   - 異地備份重要資料
   - 加密敏感備份

## 效能優化

1. **資源限制**
   ```yaml
   services:
     api:
       deploy:
         resources:
           limits:
             cpus: '1.0'
             memory: 1G
   ```

2. **快取配置**
   - 調整 Redis 記憶體限制
   - 配置 Nginx 快取策略
   - 使用 CDN 分發靜態資源

3. **資料庫優化**
   - 定期執行 VACUUM
   - 監控查詢效能
   - 適當配置連接池大小