# LuckyGas 生產環境部署指南

本指南詳細說明如何在生產環境中部署 LuckyGas 系統。

## 目錄

1. [系統需求](#系統需求)
2. [部署方式選擇](#部署方式選擇)
3. [Docker 部署](#docker-部署)
4. [Systemd 部署](#systemd-部署)
5. [安全設定](#安全設定)
6. [監控與維護](#監控與維護)
7. [故障排除](#故障排除)

## 系統需求

### 硬體需求
- CPU: 2 核心以上
- RAM: 4GB 以上（建議 8GB）
- 硬碟: 50GB 以上 SSD
- 網路: 100Mbps 以上

### 軟體需求
- 作業系統: Ubuntu 20.04 LTS 或 CentOS 8+
- Python: 3.9+
- PostgreSQL: 13+
- Nginx: 1.18+
- Docker: 20.10+（如使用 Docker 部署）

## 部署方式選擇

### 1. Docker 部署（推薦）
適合快速部署、易於擴展的場景。

### 2. Systemd 部署
適合需要更細緻控制的傳統部署場景。

## Docker 部署

### 1. 準備環境

```bash
# 安裝 Docker 和 Docker Compose
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER

# 安裝 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 克隆專案

```bash
cd /opt
sudo git clone https://github.com/cheez95/LuckyGas.git luckygas
cd luckygas
```

### 3. 設定環境變數

```bash
# 複製環境變數範例
cp .env.example .env

# 編輯環境變數
sudo nano .env
```

重要設定項目：
- `DATABASE_URL`: PostgreSQL 連接字串
- `SECRET_KEY`: 加密金鑰（使用 `openssl rand -hex 32` 生成）
- `API_URL`: API 的公開 URL
- `ALLOWED_ORIGINS`: CORS 允許的來源

### 4. 啟動服務

```bash
# 構建映像
docker-compose build

# 啟動所有服務
docker-compose up -d

# 檢查服務狀態
docker-compose ps
```

### 5. 初始化資料庫

```bash
# 執行資料庫遷移
docker-compose exec api python src/main/python/core/database.py

# 匯入初始資料（如有需要）
docker-compose exec api python src/main/python/utils/data_importer.py
```

## Systemd 部署

### 1. 建立系統使用者

```bash
# 建立 luckygas 使用者
sudo useradd -r -s /bin/bash -d /opt/luckygas luckygas

# 建立目錄結構
sudo mkdir -p /opt/luckygas/{backups,logs,data}
sudo chown -R luckygas:luckygas /opt/luckygas
```

### 2. 安裝 Python 環境

```bash
# 切換到 luckygas 使用者
sudo su - luckygas

# 克隆專案
git clone https://github.com/cheez95/LuckyGas.git .

# 建立虛擬環境
python3 -m venv venv
source venv/bin/activate

# 安裝依賴
pip install -r requirements.txt
pip install gunicorn

# 退出 luckygas 使用者
exit
```

### 3. 設定 PostgreSQL

```bash
# 安裝 PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# 建立資料庫和使用者
sudo -u postgres psql << EOF
CREATE USER luckygas WITH PASSWORD 'your_secure_password';
CREATE DATABASE luckygas OWNER luckygas;
GRANT ALL PRIVILEGES ON DATABASE luckygas TO luckygas;
EOF
```

### 4. 安裝 Systemd 服務

```bash
# 複製 systemd 服務檔案
sudo cp systemd/*.service /etc/systemd/system/
sudo cp systemd/*.timer /etc/systemd/system/

# 重新載入 systemd
sudo systemctl daemon-reload

# 啟用並啟動服務
sudo systemctl enable luckygas-api luckygas-backup.timer luckygas-monitor
sudo systemctl start luckygas-api luckygas-backup.timer luckygas-monitor

# 檢查服務狀態
sudo systemctl status luckygas-api
```

### 5. 設定 Nginx

```bash
# 安裝 Nginx
sudo apt-get install nginx

# 複製配置檔案
sudo cp nginx/nginx.conf /etc/nginx/sites-available/luckygas
sudo ln -s /etc/nginx/sites-available/luckygas /etc/nginx/sites-enabled/

# 測試配置
sudo nginx -t

# 重啟 Nginx
sudo systemctl restart nginx
```

## 安全設定

### 1. 防火牆設定

```bash
# 允許必要的端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 2. SSL 憑證設定

```bash
# 使用 Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. 安全檢查清單

- [ ] 修改預設密碼
- [ ] 設定強密碼政策
- [ ] 啟用防火牆
- [ ] 設定 SSL/TLS
- [ ] 定期更新系統
- [ ] 設定備份策略
- [ ] 啟用日誌監控
- [ ] 設定入侵偵測

## 監控與維護

### 1. 健康檢查

```bash
# API 健康檢查
curl http://localhost:8000/health

# 系統狀態檢查
./scripts/health_check.sh
```

### 2. 日誌檢視

```bash
# 檢視 API 日誌
journalctl -u luckygas-api -f

# 檢視 Docker 日誌
docker-compose logs -f api
```

### 3. 備份管理

```bash
# 手動備份
sudo ./scripts/backup.sh

# 檢視備份
ls -la /opt/luckygas/backups/
```

### 4. 系統更新

```bash
# 完整更新
sudo ./scripts/update.sh all

# 僅更新程式碼
sudo ./scripts/update.sh code
```

### 5. 效能監控

使用內建的監控服務：
```bash
# 檢視監控狀態
sudo systemctl status luckygas-monitor

# 檢視效能指標
cat /var/log/luckygas/metrics.json
```

## 故障排除

### 常見問題

#### 1. 服務無法啟動
```bash
# 檢查日誌
journalctl -u luckygas-api -n 100

# 檢查權限
ls -la /opt/luckygas/
```

#### 2. 資料庫連線失敗
```bash
# 測試連線
psql -h localhost -U luckygas -d luckygas

# 檢查 PostgreSQL 狀態
sudo systemctl status postgresql
```

#### 3. Nginx 502 錯誤
```bash
# 檢查上游服務
curl http://localhost:8000/health

# 檢查 Nginx 錯誤日誌
tail -f /var/log/nginx/error.log
```

### 緊急回復

```bash
# 回復到上一個版本
sudo ./scripts/deploy-production.sh --rollback

# 從備份還原
sudo ./scripts/restore.sh
```

## 聯絡支援

如果遇到無法解決的問題：

1. 檢查 [GitHub Issues](https://github.com/cheez95/LuckyGas/issues)
2. 查看完整日誌並準備相關資訊
3. 聯絡技術支援團隊

---

**注意事項**：
- 定期檢查並應用安全更新
- 保持備份策略的執行
- 監控系統資源使用情況
- 定期審查日誌檔案