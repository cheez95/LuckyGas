FROM python:3.9-slim

# 設定工作目錄
WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 複製需求檔案
COPY requirements.txt .

# 安裝 Python 套件
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式碼
COPY src/ ./src/
COPY data/ ./data/

# 建立必要目錄
RUN mkdir -p /app/logs /app/uploads

# 設定 Python 路徑
ENV PYTHONPATH=/app

# 暴露埠號
EXPOSE 8000

# 啟動命令
CMD ["uvicorn", "src.main.python.api.main:app", "--host", "0.0.0.0", "--port", "8000"]