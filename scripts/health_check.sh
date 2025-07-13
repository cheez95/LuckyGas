#!/bin/bash

# 健康檢查腳本
# 用於檢查所有 Docker 服務的健康狀態

echo "=== LuckyGas 服務健康檢查 ==="
echo "時間: $(date)"
echo "==============================="

# 檢查 Docker Compose 服務狀態
echo -e "\n1. Docker 服務狀態:"
docker-compose ps

# 檢查 API 健康狀態
echo -e "\n2. API 健康檢查:"
if curl -f http://localhost:8000/health 2>/dev/null; then
    echo "✅ API 服務正常"
else
    echo "❌ API 服務異常"
fi

# 檢查資料庫連接
echo -e "\n3. 資料庫連接檢查:"
if docker-compose exec -T db pg_isready -U postgres -d luckygas 2>/dev/null; then
    echo "✅ PostgreSQL 正常"
else
    echo "❌ PostgreSQL 異常"
fi

# 檢查 Redis 連接
echo -e "\n4. Redis 連接檢查:"
if docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "✅ Redis 正常"
else
    echo "❌ Redis 異常"
fi

# 檢查 Nginx 狀態
echo -e "\n5. Nginx 狀態檢查:"
if docker-compose exec -T nginx nginx -t 2>/dev/null; then
    echo "✅ Nginx 配置正常"
else
    echo "❌ Nginx 配置異常"
fi

# 檢查磁碟空間
echo -e "\n6. 磁碟空間檢查:"
df -h | grep -E "(Filesystem|/dev/)"

# 檢查 Docker volumes
echo -e "\n7. Docker Volumes:"
docker volume ls | grep luckygas

# 檢查最近的錯誤日誌
echo -e "\n8. 最近的錯誤日誌 (最後 10 行):"
echo "API 錯誤:"
docker-compose logs --tail=10 api 2>&1 | grep -i error || echo "無錯誤"

echo -e "\n==============================="
echo "健康檢查完成"