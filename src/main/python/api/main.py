from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from contextlib import asynccontextmanager
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from core.database import db_manager
from api.routers import clients_router, deliveries_router, drivers_router, vehicles_router, dashboard_router, routes_router
from api.routers.scheduling import router as scheduling_router
from api.security import CSRFMiddleware
from config.cors_config import cors_config

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
    description="幸福氣配送管理系統 API",
    version="1.0.0",
    lifespan=lifespan,
    redoc_url=None  # Disable default ReDoc to use our custom one
)

# CORS 設定 (允許前端應用程式存取)
# Using secure CORS configuration based on environment
cors_settings = cors_config.get_cors_settings()
app.add_middleware(
    CORSMiddleware,
    **cors_settings
)

# CSRF Protection Middleware
app.add_middleware(CSRFMiddleware)

# 路由註冊 - 加上 /api 前綴
app.include_router(clients_router, prefix="/api")
app.include_router(deliveries_router, prefix="/api")
app.include_router(drivers_router, prefix="/api")
app.include_router(vehicles_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(routes_router, prefix="/api")
app.include_router(scheduling_router, prefix="/api")

# 根路徑
@app.get("/", response_class=HTMLResponse)
async def root():
    html_content = """
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LuckyGas</title>
        <style>
            body { 
                font-family: system-ui, -apple-system, sans-serif; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                margin: 0;
                background-color: #f3f4f6;
            }
            .container { 
                text-align: center; 
                background: white;
                padding: 2rem 3rem;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            h1 { color: #1f2937; margin-bottom: 1rem; }
            p { color: #6b7280; margin: 0.5rem 0; }
            .links { margin-top: 2rem; }
            .links a { 
                color: #3b82f6; 
                text-decoration: none; 
                margin: 0 0.5rem;
                padding: 0.5rem 1rem;
                border: 1px solid #3b82f6;
                border-radius: 4px;
                display: inline-block;
                transition: all 0.2s;
            }
            .links a:hover { 
                background-color: #3b82f6;
                color: white;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>歡迎使用 LuckyGas 配送管理系統</h1>
            <p>版本: 1.0.0</p>
            <p>狀態: 運行中</p>
            <div class="links">
                <a href="/admin">管理介面</a>
                <a href="/docs">API 文件</a>
                <a href="/redoc">API 文件 (ReDoc)</a>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

# 管理介面
@app.get("/admin")
async def admin():
    return FileResponse(str(Path(__file__).parent.parent / "web" / "index.html"))

# 靜態文件
app.mount("/static", StaticFiles(directory=str(Path(__file__).parent.parent / "web")), name="static")

# Mount JavaScript modules directories from web folder
web_base_path = Path(__file__).parent.parent / "web"
if (web_base_path / "js" / "modules").exists():
    app.mount("/js/modules", StaticFiles(directory=str(web_base_path / "js" / "modules")), name="js_modules")
if (web_base_path / "config").exists():
    app.mount("/config", StaticFiles(directory=str(web_base_path / "config")), name="config")

# Mount utils directory from web folder for validation and sanitization
if (web_base_path / "utils").exists():
    app.mount("/utils", StaticFiles(directory=str(web_base_path / "utils")), name="utils")

# Mount js/utils for chart utilities
if (web_base_path / "js" / "utils").exists():
    app.mount("/js/utils", StaticFiles(directory=str(web_base_path / "js" / "utils")), name="js_utils")

# Custom ReDoc endpoint with id="redoc"
@app.get("/redoc", include_in_schema=False)
async def custom_redoc_html():
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>LuckyGas API - ReDoc</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
        body {
            margin: 0;
            padding: 0;
        }
        #redoc {
            display: block;
            min-height: 100vh;
        }
        </style>
    </head>
    <body>
        <div id="redoc"></div>
        <noscript>
            ReDoc requires Javascript to function. Please enable it to browse the documentation.
        </noscript>
        <redoc spec-url="/openapi.json"></redoc>
        <script src="https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js"></script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

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
            "vehicles": "/vehicles",
            "routes": "/routes",
            "scheduling": "/scheduling",
            "dashboard": "/dashboard"
        },
        "documentation": "/docs",
        "redoc": "/redoc"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)