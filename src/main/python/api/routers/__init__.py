"""API Routers for LuckyGas delivery system"""
from .clients import router as clients_router
from .deliveries import router as deliveries_router
from .drivers import router as drivers_router
from .vehicles import router as vehicles_router
from .dashboard import router as dashboard_router
from .routes import router as routes_router

__all__ = [
    "clients_router",
    "deliveries_router",
    "drivers_router",
    "vehicles_router",
    "dashboard_router",
    "routes_router",
]