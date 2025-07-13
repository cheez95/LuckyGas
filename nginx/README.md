# LuckyGas Nginx 配置

本目錄包含 LuckyGas 專案的 Nginx 反向代理配置，提供完整的生產環境部署方案。

## 📋 功能特點

1. **SSL/TLS 支援** - 完整的 HTTPS 配置，支援 TLS 1.2/1.3
2. **反向代理** - 將請求代理到 FastAPI 後端服務
3. **靜態檔案服務** - 高效服務前端資源
4. **Gzip 壓縮** - 自動壓縮文字資源，減少傳輸量
5. **安全標頭** - 完整的安全標頭配置，防護常見攻擊
6. **速率限制** - API 和登入端點的請求速率限制
7. **WebSocket 支援** - 即時通訊功能支援
8. **詳細日誌** - 包含請求時間和上游回應時間

## 📁 檔案結構

```
nginx/
├── nginx.conf          # 生產環境主配置
├── nginx-dev.conf      # 開發環境配置
├── nginx-certbot.conf  # SSL 憑證申請用臨時配置
├── docker-compose.yml  # Docker Compose 配置
├── setup-ssl.sh        # SSL 憑證自動設定腳本
├── errors/             # 自訂錯誤頁面
│   ├── 404.html
│   └── 50x.html
└── README.md          # 本文件
```

## 🚀 快速開始

### 開發環境

1. 使用開發配置啟動：
```bash
docker-compose --profile dev up nginx-dev
```

2. 存取服務：
- 前端應用：http://localhost:8080
- API：http://localhost:8080/api/
- API 文件：http://localhost:8080/docs

### 生產環境

1. 設定 SSL 憑證：
```bash
sudo ./setup-ssl.sh
```

2. 啟動服務：
```bash
docker-compose up -d
```

3. 存取服務：
- 前端應用：https://luckygas.com
- API：https://luckygas.com/api/
- 健康檢查：https://luckygas.com/health

## ⚙️ 配置說明

### 主要配置項目

#### SSL 配置
- 支援 TLS 1.2 和 1.3
- 使用安全的加密套件
- 啟用 OCSP Stapling
- Session 快取優化

#### 安全標頭
- `X-Frame-Options`: 防止點擊劫持
- `X-Content-Type-Options`: 防止 MIME 類型嗅探
- `X-XSS-Protection`: 啟用 XSS 過濾
- `Strict-Transport-Security`: 強制使用 HTTPS
- `Content-Security-Policy`: 內容安全策略
- `Referrer-Policy`: 控制 Referrer 資訊
- `Permissions-Policy`: 限制瀏覽器功能

#### 速率限制
- API 請求：每秒 10 個請求（burst 20）
- 登入嘗試：每分鐘 5 次（burst 2）
- WebSocket 連線：每個 IP 最多 20 個

#### 效能優化
- Gzip 壓縮（壓縮等級 6）
- 靜態檔案快取（30 天）
- Keep-alive 連線
- 上游連線池

## 📊 監控

內部監控端點（僅本地存取）：
- Nginx 狀態：http://localhost:8080/nginx_status

## 🔧 自訂配置

### 修改域名
編輯 `nginx.conf`，將 `luckygas.com` 替換為您的域名：
```nginx
server_name your-domain.com www.your-domain.com;
```

### 調整速率限制
修改限制區域定義：
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;
```

### 新增上游伺服器
在 upstream 區塊新增伺服器：
```nginx
upstream luckygas_api {
    least_conn;
    server 127.0.0.1:8000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:8001 max_fails=3 fail_timeout=30s;
}
```

## 🔒 安全建議

1. **定期更新**：保持 Nginx 和系統套件最新
2. **憑證管理**：使用 Let's Encrypt 自動更新 SSL 憑證
3. **存取控制**：限制管理端點的存取 IP
4. **日誌審計**：定期檢查存取和錯誤日誌
5. **備份**：定期備份配置檔案

## 🐛 疑難排解

### 502 Bad Gateway
- 檢查後端服務是否運行：`docker ps`
- 查看 API 日誌：`docker logs luckygas-api`

### SSL 憑證問題
- 檢查憑證狀態：`certbot certificates`
- 手動更新：`certbot renew`

### 權限問題
- 確保 uploads 目錄可寫：`chmod 755 uploads`
- 檢查 nginx 使用者權限

## 📝 維護

### 日誌輪替
設定 logrotate：
```bash
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nginx nginx
    sharedscripts
    postrotate
        docker exec luckygas-nginx nginx -s reload
    endscript
}
```

### 效能調優
根據伺服器資源調整：
- `worker_processes`: CPU 核心數
- `worker_connections`: 根據記憶體調整
- `keepalive_timeout`: 根據網路狀況調整

## 📞 支援

如有問題，請查看：
1. Nginx 錯誤日誌：`/var/log/nginx/error.log`
2. 存取日誌：`/var/log/nginx/access.log`
3. API 文件：https://luckygas.com/docs