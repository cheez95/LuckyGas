#!/bin/bash

# LuckyGas API 啟動腳本

echo "🚀 Starting LuckyGas API Server..."

# 檢查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

# 檢查虛擬環境
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# 啟動虛擬環境
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# 安裝/更新套件
echo "📚 Installing/updating dependencies..."
pip install -r requirements.txt

# 檢查資料庫
if [ ! -f "data/luckygas.db" ]; then
    echo "🗄️ Initializing database..."
    python src/main/python/core/database.py
    
    # 詢問是否匯入資料
    read -p "Import existing Excel data? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📊 Importing data..."
        python src/main/python/utils/data_importer.py
    fi
fi

# 生成預測（選擇性）
read -p "Generate delivery predictions? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔮 Generating predictions..."
    python -c "
from src.main.python.services.prediction_service import GasPredictionService
from src.main.python.core.database import DatabaseManager
db_manager = DatabaseManager()
db_manager.initialize()
session = db_manager.get_session()
service = GasPredictionService(session)
predictions = service.generate_delivery_predictions(days_ahead=7)
print(f'Generated {len(predictions)} predictions')
session.close()
"
fi

# 設定 PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:${PWD}/src/main/python"

# 啟動 API
echo "✅ Starting API server..."
echo "📋 API Documentation: http://localhost:8000/docs"
echo "📊 ReDoc: http://localhost:8000/redoc"
echo ""

uvicorn src.main.python.api.main:app --reload --host 0.0.0.0 --port 8000