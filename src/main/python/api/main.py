from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from core.database import db_manager
from api.routers import clients_router, deliveries_router, drivers_router, vehicles_router

# 應用程式生命週期管理
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 啟動時初始化資料庫
    db_manager.initialize()
    yield
    # 關閉時清理資源
    db_manager.close()

# 建立 FastAPI 應用程式
app = FastAPI(
    title="LuckyGas API",
    description="幸福瓦斯配送管理系統 API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 設定 (允許前端應用程式存取)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8000", "*"],  # React/Vue 開發伺服器 + Swagger UI
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由註冊 - 加上 /api 前綴
app.include_router(clients_router, prefix="/api")
app.include_router(deliveries_router, prefix="/api")
app.include_router(drivers_router, prefix="/api")
app.include_router(vehicles_router, prefix="/api")

# 根路徑
@app.get("/")
async def root():
    return {
        "message": "歡迎使用 LuckyGas 配送管理系統",
        "version": "1.0.0",
        "status": "運行中"
    }

# 管理介面
@app.get("/admin")
async def admin():
    return FileResponse(str(Path(__file__).parent.parent / "web" / "index.html"))

# 靜態文件
app.mount("/static", StaticFiles(directory=str(Path(__file__).parent.parent / "web")), name="static")

# 健康檢查
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected"
    }

# API 資訊
@app.get("/api")
async def api_info():
    return {
        "title": "LuckyGas API",
        "version": "1.0.0",
        "endpoints": {
            "clients": "/clients",
            "deliveries": "/deliveries",
            "drivers": "/drivers",
            "vehicles": "/vehicles"
        },
        "documentation": "/docs",
        "redoc": "/redoc"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)