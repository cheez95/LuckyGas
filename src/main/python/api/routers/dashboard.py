"""Dashboard API Router - 儀表板統計 API"""
from typing import Dict, List, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, date, timedelta
from collections import defaultdict

from core.database import get_db
from models.database_schema import Client, Delivery, Driver, Vehicle, DeliveryStatus

router = APIRouter(
    prefix="/dashboard",
    tags=["儀表板"],
    responses={
        500: {"description": "內部伺服器錯誤"},
    }
)


@router.get("/stats", response_model=Dict[str, Any], summary="取得儀表板統計資料")
async def get_dashboard_stats(
    db: Session = Depends(get_db)
):
    """
    取得儀表板統計資料，包括：
    - 各類總數統計
    - 今日配送統計
    - 本週配送趨勢
    - 司機狀態統計
    """
    # 基本統計
    total_clients = db.query(func.count(Client.id)).filter(Client.is_active == True).scalar() or 0
    total_drivers = db.query(func.count(Driver.id)).filter(Driver.is_active == True).scalar() or 0
    total_vehicles = db.query(func.count(Vehicle.id)).filter(Vehicle.is_active == True).scalar() or 0
    
    # 今日配送統計
    today = date.today()
    today_deliveries = db.query(Delivery).filter(
        func.date(Delivery.scheduled_date) == today
    ).all()
    
    today_stats = {
        "total": len(today_deliveries),
        "pending": sum(1 for d in today_deliveries if d.status == DeliveryStatus.PENDING),
        "in_progress": sum(1 for d in today_deliveries if d.status == DeliveryStatus.IN_PROGRESS),
        "completed": sum(1 for d in today_deliveries if d.status == DeliveryStatus.COMPLETED),
        "cancelled": sum(1 for d in today_deliveries if d.status == DeliveryStatus.CANCELLED)
    }
    
    # 本週配送趨勢（最近7天）
    week_start = today - timedelta(days=6)
    week_deliveries = db.query(
        func.date(Delivery.scheduled_date).label('date'),
        func.count(Delivery.id).label('count'),
        Delivery.status
    ).filter(
        func.date(Delivery.scheduled_date) >= week_start,
        func.date(Delivery.scheduled_date) <= today
    ).group_by(
        func.date(Delivery.scheduled_date),
        Delivery.status
    ).all()
    
    # 組織每日數據
    daily_stats = defaultdict(lambda: {
        "total": 0,
        "completed": 0,
        "pending": 0,
        "cancelled": 0
    })
    
    for delivery in week_deliveries:
        # delivery.date is already a date object from func.date()
        date_str = delivery.date.strftime('%Y-%m-%d') if hasattr(delivery.date, 'strftime') else str(delivery.date)
        daily_stats[date_str]["total"] += delivery.count
        
        if delivery.status == DeliveryStatus.COMPLETED:
            daily_stats[date_str]["completed"] += delivery.count
        elif delivery.status == DeliveryStatus.PENDING:
            daily_stats[date_str]["pending"] += delivery.count
        elif delivery.status == DeliveryStatus.CANCELLED:
            daily_stats[date_str]["cancelled"] += delivery.count
    
    # 確保每一天都有數據
    week_trend = []
    for i in range(7):
        current_date = week_start + timedelta(days=i)
        date_str = current_date.strftime('%Y-%m-%d')
        day_data = daily_stats.get(date_str, {
            "total": 0,
            "completed": 0,
            "pending": 0,
            "cancelled": 0
        })
        week_trend.append({
            "date": date_str,
            "day": current_date.strftime('%A')[:3],  # Mon, Tue, etc.
            **day_data
        })
    
    # 司機狀態統計
    available_drivers = db.query(func.count(Driver.id)).filter(
        Driver.is_active == True,
        Driver.is_available == True
    ).scalar() or 0
    
    busy_drivers = db.query(func.count(Driver.id)).filter(
        Driver.is_active == True,
        Driver.is_available == False
    ).scalar() or 0
    
    # 車輛狀態統計
    available_vehicles = db.query(func.count(Vehicle.id)).filter(
        Vehicle.is_active == True,
        Vehicle.is_available == True
    ).scalar() or 0
    
    # 最近配送活動
    try:
        recent_deliveries = db.query(Delivery).filter(
            Delivery.status.in_([
                DeliveryStatus.PENDING,
                DeliveryStatus.ASSIGNED,
                DeliveryStatus.IN_PROGRESS,
                DeliveryStatus.COMPLETED,
                DeliveryStatus.CANCELLED
            ])
        ).order_by(
            Delivery.updated_at.desc()
        ).limit(5).all()
    except Exception as e:
        # If there's an issue with delivery status, just get empty list
        print(f"Error loading recent deliveries: {e}")
        recent_deliveries = []
    
    recent_activities = []
    for delivery in recent_deliveries:
        client = db.query(Client).filter(Client.id == delivery.client_id).first()
        driver = db.query(Driver).filter(Driver.id == delivery.driver_id).first() if delivery.driver_id else None
        
        recent_activities.append({
            "id": delivery.id,
            "client_name": client.name if client else "Unknown",
            "driver_name": driver.name if driver else "Unassigned",
            "status": delivery.status.value if hasattr(delivery.status, 'value') else str(delivery.status),
            "scheduled_date": delivery.scheduled_date.strftime('%Y-%m-%d'),
            "updated_at": delivery.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    return {
        "overview": {
            "total_clients": total_clients,
            "total_drivers": total_drivers,
            "total_vehicles": total_vehicles,
            "available_drivers": available_drivers,
            "available_vehicles": available_vehicles
        },
        "today_deliveries": today_stats,
        "week_trend": week_trend,
        "driver_stats": {
            "available": available_drivers,
            "busy": busy_drivers,
            "total": total_drivers
        },
        "recent_activities": recent_activities
    }


@router.get("/districts", response_model=List[Dict[str, Any]], summary="取得各區域統計")
async def get_district_stats(
    db: Session = Depends(get_db)
):
    """取得各區域的客戶與配送統計"""
    # 獲取所有區域
    districts = db.query(Client.district).filter(
        Client.district.isnot(None),
        Client.district != ""
    ).distinct().all()
    
    district_stats = []
    for (district,) in districts:
        # 客戶數量
        client_count = db.query(func.count(Client.id)).filter(
            Client.district == district,
            Client.is_active == True
        ).scalar() or 0
        
        # 本月配送數量
        month_start = date.today().replace(day=1)
        delivery_count = db.query(func.count(Delivery.id)).join(
            Client, Delivery.client_id == Client.id
        ).filter(
            Client.district == district,
            func.date(Delivery.scheduled_date) >= month_start
        ).scalar() or 0
        
        district_stats.append({
            "district": district,
            "client_count": client_count,
            "delivery_count": delivery_count
        })
    
    # 按客戶數量排序
    district_stats.sort(key=lambda x: x["client_count"], reverse=True)
    
    return district_stats