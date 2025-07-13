#!/bin/bash

# LuckyGas SSL 憑證設定腳本
# 使用 Let's Encrypt 自動申請和更新 SSL 憑證

set -e

# 設定變數
DOMAIN="luckygas.com"
WWW_DOMAIN="www.luckygas.com"
EMAIL="admin@luckygas.com"
NGINX_DIR="/Users/lgee258/Desktop/LuckyGas/nginx"
WEBROOT="/var/www/certbot"

echo "🔒 LuckyGas SSL 憑證設定"
echo "========================"

# 檢查是否有 root 權限
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 請使用 sudo 執行此腳本"
    exit 1
fi

# 檢查 certbot 是否安裝
if ! command -v certbot &> /dev/null; then
    echo "📦 安裝 Certbot..."
    
    # 根據作業系統安裝
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Ubuntu/Debian
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install certbot
    else
        echo "❌ 不支援的作業系統"
        exit 1
    fi
fi

# 建立 webroot 目錄
echo "📁 建立 webroot 目錄..."
mkdir -p $WEBROOT

# 停止現有的 Nginx (如果正在運行)
echo "🛑 停止 Nginx..."
docker-compose -f $NGINX_DIR/docker-compose.yml down 2>/dev/null || true

# 啟動臨時 Nginx 用於驗證
echo "🚀 啟動臨時 Nginx..."
docker run -d \
    --name certbot-nginx \
    -p 80:80 \
    -v $NGINX_DIR/nginx-certbot.conf:/etc/nginx/nginx.conf:ro \
    -v $WEBROOT:/var/www/certbot:rw \
    nginx:alpine

# 等待 Nginx 啟動
sleep 5

# 申請憑證
echo "📜 申請 SSL 憑證..."
certbot certonly \
    --webroot \
    --webroot-path=$WEBROOT \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN \
    -d $WWW_DOMAIN

# 停止臨時 Nginx
echo "🛑 停止臨時 Nginx..."
docker stop certbot-nginx
docker rm certbot-nginx

# 建立憑證目錄連結
echo "🔗 設定憑證連結..."
mkdir -p $NGINX_DIR/ssl
ln -sf /etc/letsencrypt/live/$DOMAIN $NGINX_DIR/ssl/

# 設定自動更新
echo "⏰ 設定自動更新..."
cat > /etc/cron.d/certbot-luckygas << EOF
# 每天凌晨 2:30 檢查並更新憑證
30 2 * * * root certbot renew --quiet --deploy-hook "docker-compose -f $NGINX_DIR/docker-compose.yml restart nginx"
EOF

# 建立 Diffie-Hellman 參數
echo "🔐 生成 Diffie-Hellman 參數..."
openssl dhparam -out $NGINX_DIR/ssl/dhparam.pem 2048

echo "✅ SSL 設定完成！"
echo ""
echo "📋 憑證資訊："
echo "   域名: $DOMAIN, $WWW_DOMAIN"
echo "   憑證路徑: /etc/letsencrypt/live/$DOMAIN/"
echo "   自動更新: 已設定 (每天凌晨 2:30)"
echo ""
echo "🚀 現在可以啟動 Nginx："
echo "   cd $NGINX_DIR"
echo "   docker-compose up -d"