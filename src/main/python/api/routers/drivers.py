"""Driver API Router - 司機管理 API"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from datetime import datetime, date
import json

from ...core.database import get_db
from ...models.database_schema import Driver, Delivery, Vehicle, DeliveryStatus
from ..schemas.driver import (
    DriverCreate,
    DriverUpdate,
    DriverResponse,
    DriverListResponse,
    DriverSearchParams
)
from ..schemas.base import PaginationParams, ResponseMessage

router = APIRouter(
    prefix="/drivers",
    tags=["司機管理"],
    responses={
        404: {"description": "找不到司機"},
        400: {"description": "請求參數錯誤"},
    }
)


@router.get("", response_model=DriverListResponse, summary="取得司機列表")
async def get_drivers(
    # Pagination
    pagination: PaginationParams = Depends(),
    # Search params
    search: DriverSearchParams = Depends(),
    db: Session = Depends(get_db)
):
    """
    取得司機列表，支援分頁、搜尋與篩選
    
    - **keyword**: 搜尋關鍵字（姓名、員工編號、電話）
    - **status**: 狀態篩選
    - **license_expiring_soon**: 駕照即將到期
    - **has_vehicle_assigned**: 是否有指派車輛
    - **page**: 頁數
    - **page_size**: 每頁筆數
    """
    # Build query
    query = db.query(Driver)
    
    # Apply filters
    if search.keyword:
        keyword_filter = or_(
            Driver.name.ilike(f"%{search.keyword}%"),
            Driver.employee_id.ilike(f"%{search.keyword}%"),
            Driver.phone.ilike(f"%{search.keyword}%")
        )
        query = query.filter(keyword_filter)
    
    # Map status if needed (using is_active for now)
    if search.status:
        if search.status == "active":
            query = query.filter(Driver.is_active == True)
        elif search.status == "terminated":
            query = query.filter(Driver.is_active == False)
    
    # Get total count
    total = query.count()
    
    # Apply sorting
    order_column = getattr(Driver, search.order_by, Driver.created_at)
    if search.order_desc:
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column)
    
    # Apply pagination
    drivers = query.offset(pagination.offset).limit(pagination.page_size).all()
    
    # Get statistics for each driver
    driver_responses = []
    for driver in drivers:
        # Get delivery statistics
        total_deliveries = db.query(func.count(Delivery.id)).filter(
            Delivery.driver_id == driver.id
        ).scalar() or 0
        
        # Get current month deliveries
        today = date.today()
        first_day_of_month = date(today.year, today.month, 1)
        deliveries_this_month = db.query(func.count(Delivery.id)).filter(
            Delivery.driver_id == driver.id,
            Delivery.scheduled_date >= first_day_of_month
        ).scalar() or 0
        
        # Get today's deliveries
        deliveries_today = db.query(func.count(Delivery.id)).filter(
            Delivery.driver_id == driver.id,
            Delivery.scheduled_date == today
        ).scalar() or 0
        
        # Get current vehicle assignment
        current_vehicle = db.query(Vehicle).filter(
            Vehicle.driver_id == driver.id,
            Vehicle.is_active == True
        ).first() if hasattr(Vehicle, 'driver_id') else None
        
        # Create driver response data
        driver_data = {
            **driver.__dict__,
            "status": "active" if driver.is_active else "terminated",
            "total_deliveries": total_deliveries,
            "deliveries_this_month": deliveries_this_month,
            "deliveries_today": deliveries_today,
            "current_vehicle_id": current_vehicle.id if current_vehicle else None,
            "current_vehicle_plate": current_vehicle.plate_number if current_vehicle else None,
            # Mock data for required fields
            "id_number": "A123456789",  # Placeholder
            "address": "台北市信義區",  # Placeholder
            "emergency_contact": driver.name + "緊急聯絡人",  # Placeholder
            "emergency_phone": driver.phone if driver.phone else "0912345678",  # Placeholder
            "license_number": "DL" + str(driver.id).zfill(6),  # Placeholder
            "license_type": driver.license_type if driver.license_type else "職業大貨車",
            "license_expiry_date": date(2025, 12, 31),  # Placeholder
            "hire_date": driver.created_at.date() if driver.created_at else date.today(),
            "base_salary": 35000,  # Placeholder
            "commission_rate": 5,  # Placeholder
            "notes": None,
            "termination_date": None
        }
        
        driver_responses.append(DriverResponse.model_validate(driver_data))
    
    return DriverListResponse(
        items=driver_responses,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size
    )


@router.get("/{driver_id}", response_model=DriverResponse, summary="取得司機詳細資料")
async def get_driver(driver_id: int, db: Session = Depends(get_db)):
    """
    取得特定司機的詳細資料
    """
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該司機"
        )
    
    # Get delivery statistics
    total_deliveries = db.query(func.count(Delivery.id)).filter(
        Delivery.driver_id == driver.id
    ).scalar() or 0
    
    # Get current month deliveries
    today = date.today()
    first_day_of_month = date(today.year, today.month, 1)
    deliveries_this_month = db.query(func.count(Delivery.id)).filter(
        Delivery.driver_id == driver.id,
        Delivery.scheduled_date >= first_day_of_month
    ).scalar() or 0
    
    # Get today's deliveries
    deliveries_today = db.query(func.count(Delivery.id)).filter(
        Delivery.driver_id == driver.id,
        Delivery.scheduled_date == today
    ).scalar() or 0
    
    # Get current vehicle assignment
    current_vehicle = db.query(Vehicle).filter(
        Vehicle.driver_id == driver.id,
        Vehicle.is_active == True
    ).first() if hasattr(Vehicle, 'driver_id') else None
    
    driver_data = {
        **driver.__dict__,
        "status": "active" if driver.is_active else "terminated",
        "total_deliveries": total_deliveries,
        "deliveries_this_month": deliveries_this_month,
        "deliveries_today": deliveries_today,
        "current_vehicle_id": current_vehicle.id if current_vehicle else None,
        "current_vehicle_plate": current_vehicle.plate_number if current_vehicle else None,
        # Mock data for required fields
        "id_number": "A123456789",
        "address": "台北市信義區",
        "emergency_contact": driver.name + "緊急聯絡人",
        "emergency_phone": driver.phone if driver.phone else "0912345678",
        "license_number": "DL" + str(driver.id).zfill(6),
        "license_type": driver.license_type if driver.license_type else "職業大貨車",
        "license_expiry_date": date(2025, 12, 31),
        "hire_date": driver.created_at.date() if driver.created_at else date.today(),
        "base_salary": 35000,
        "commission_rate": 5,
        "notes": None,
        "termination_date": None
    }
    
    return DriverResponse.model_validate(driver_data)


@router.post("", response_model=DriverResponse, status_code=status.HTTP_201_CREATED, summary="新增司機")
async def create_driver(driver: DriverCreate, db: Session = Depends(get_db)):
    """
    新增司機資料
    
    - **name**: 司機姓名（必填）
    - **employee_id**: 員工編號（必填，唯一）
    - **phone**: 電話號碼（必填，格式：0912345678）
    - **id_number**: 身分證字號（必填，格式：A123456789）
    - **license_number**: 駕照號碼（必填）
    - **license_expiry_date**: 駕照到期日（必填）
    """
    # Check if employee_id already exists
    existing_driver = db.query(Driver).filter(Driver.employee_id == driver.employee_id).first()
    if existing_driver:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="該員工編號已存在"
        )
    
    # Create new driver
    db_driver = Driver(
        name=driver.name,
        employee_id=driver.employee_id,
        phone=driver.phone,
        license_type=driver.license_type,
        is_active=True,
        is_available=True,
        experience_years=0,
        familiar_areas=json.dumps([]) if not hasattr(driver, 'familiar_areas') else json.dumps(driver.familiar_areas),
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(db_driver)
    db.commit()
    db.refresh(db_driver)
    
    # Return with full response data
    driver_data = {
        **db_driver.__dict__,
        "status": "active",
        "total_deliveries": 0,
        "deliveries_this_month": 0,
        "deliveries_today": 0,
        "current_vehicle_id": None,
        "current_vehicle_plate": None,
        # Include all required fields from create request
        "id_number": driver.id_number,
        "address": driver.address,
        "emergency_contact": driver.emergency_contact,
        "emergency_phone": driver.emergency_phone,
        "license_number": driver.license_number,
        "license_expiry_date": driver.license_expiry_date,
        "hire_date": driver.hire_date,
        "base_salary": driver.base_salary,
        "commission_rate": driver.commission_rate,
        "notes": None,
        "termination_date": None
    }
    
    return DriverResponse.model_validate(driver_data)


@router.put("/{driver_id}", response_model=DriverResponse, summary="更新司機資料")
async def update_driver(
    driver_id: int,
    driver_update: DriverUpdate,
    db: Session = Depends(get_db)
):
    """
    更新司機資料
    """
    # Get existing driver
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該司機"
        )
    
    # Update only provided fields
    update_data = driver_update.model_dump(exclude_unset=True)
    
    # Handle status update
    if "status" in update_data:
        if update_data["status"] == "active":
            driver.is_active = True
            driver.is_available = True
        elif update_data["status"] == "on_leave":
            driver.is_available = False
        elif update_data["status"] in ["suspended", "terminated"]:
            driver.is_active = False
            driver.is_available = False
    
    # Update basic fields
    for field in ["name", "phone", "license_type"]:
        if field in update_data:
            setattr(driver, field, update_data[field])
    
    driver.updated_at = datetime.now()
    
    db.commit()
    db.refresh(driver)
    
    # Return updated driver
    return await get_driver(driver_id, db)


@router.delete("/{driver_id}", response_model=ResponseMessage, summary="刪除司機")
async def delete_driver(driver_id: int, db: Session = Depends(get_db)):
    """
    刪除司機（軟刪除，將 is_active 設為 False）
    """
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該司機"
        )
    
    # Check if driver has active deliveries
    active_deliveries = db.query(Delivery).filter(
        Delivery.driver_id == driver_id,
        Delivery.status.in_([DeliveryStatus.ASSIGNED, DeliveryStatus.IN_PROGRESS])
    ).count()
    
    if active_deliveries > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"該司機還有 {active_deliveries} 筆進行中的配送單，無法刪除"
        )
    
    # Soft delete
    driver.is_active = False
    driver.is_available = False
    driver.updated_at = datetime.now()
    
    db.commit()
    
    return ResponseMessage(
        success=True,
        message="司機已成功停用",
        data={"driver_id": driver_id}
    )


@router.get("/available/list", response_model=List[DriverResponse], summary="取得可用司機列表")
async def get_available_drivers(
    scheduled_date: date = Query(..., description="預定配送日期"),
    db: Session = Depends(get_db)
):
    """
    取得指定日期可用的司機列表
    """
    # Get active and available drivers
    drivers = db.query(Driver).filter(
        Driver.is_active == True,
        Driver.is_available == True
    ).all()
    
    available_drivers = []
    for driver in drivers:
        # Check driver's workload for the date
        deliveries_on_date = db.query(func.count(Delivery.id)).filter(
            Delivery.driver_id == driver.id,
            Delivery.scheduled_date == scheduled_date,
            Delivery.status != DeliveryStatus.CANCELLED
        ).scalar() or 0
        
        # Assume max 20 deliveries per day per driver
        if deliveries_on_date < 20:
            driver_data = {
                **driver.__dict__,
                "status": "active",
                "total_deliveries": deliveries_on_date,
                "deliveries_this_month": 0,
                "deliveries_today": deliveries_on_date,
                "current_vehicle_id": None,
                "current_vehicle_plate": None,
                # Mock data
                "id_number": "A123456789",
                "address": "台北市信義區",
                "emergency_contact": driver.name + "緊急聯絡人",
                "emergency_phone": driver.phone if driver.phone else "0912345678",
                "license_number": "DL" + str(driver.id).zfill(6),
                "license_type": driver.license_type if driver.license_type else "職業大貨車",
                "license_expiry_date": date(2025, 12, 31),
                "hire_date": driver.created_at.date() if driver.created_at else date.today(),
                "base_salary": 35000,
                "commission_rate": 5,
                "notes": None,
                "termination_date": None
            }
            available_drivers.append(DriverResponse.model_validate(driver_data))
    
    return available_drivers


@router.post("/{driver_id}/toggle-availability", response_model=ResponseMessage, summary="切換司機可用狀態")
async def toggle_driver_availability(driver_id: int, db: Session = Depends(get_db)):
    """
    切換司機的可用狀態（請假/復職）
    """
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該司機"
        )
    
    if not driver.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已離職的司機無法更改可用狀態"
        )
    
    # Toggle availability
    driver.is_available = not driver.is_available
    driver.updated_at = datetime.now()
    
    db.commit()
    
    status_text = "可派遣" if driver.is_available else "請假中"
    
    return ResponseMessage(
        success=True,
        message=f"司機狀態已更新為：{status_text}",
        data={
            "driver_id": driver_id,
            "is_available": driver.is_available
        }
    )


@router.get("/{driver_id}/deliveries", response_model=dict, summary="取得司機配送記錄")
async def get_driver_deliveries(
    driver_id: int,
    start_date: Optional[date] = Query(None, description="開始日期"),
    end_date: Optional[date] = Query(None, description="結束日期"),
    db: Session = Depends(get_db)
):
    """
    取得司機的配送記錄
    """
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該司機"
        )
    
    # Build query
    query = db.query(Delivery).filter(Delivery.driver_id == driver_id)
    
    if start_date:
        query = query.filter(Delivery.scheduled_date >= start_date)
    
    if end_date:
        query = query.filter(Delivery.scheduled_date <= end_date)
    
    deliveries = query.order_by(Delivery.scheduled_date.desc()).all()
    
    # Group by status
    status_summary = {}
    for delivery in deliveries:
        status = delivery.status.value
        if status not in status_summary:
            status_summary[status] = 0
        status_summary[status] += 1
    
    return {
        "driver_id": driver_id,
        "driver_name": driver.name,
        "total_deliveries": len(deliveries),
        "status_summary": status_summary,
        "deliveries": [
            {
                "id": d.id,
                "scheduled_date": d.scheduled_date.isoformat(),
                "status": d.status.value,
                "client_name": d.client.invoice_title if d.client else None,
                "address": d.client.address if d.client else None
            }
            for d in deliveries[:20]  # Limit to recent 20
        ]
    }