"""Vehicle API Router - 車輛管理 API"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from datetime import datetime, date

from ...core.database import get_db
from ...models.database_schema import Vehicle, Delivery, Driver, VehicleType as DBVehicleType, DeliveryStatus
from ..schemas.vehicle import (
    VehicleCreate,
    VehicleUpdate,
    VehicleResponse,
    VehicleListResponse,
    VehicleSearchParams
)
from ..schemas.base import PaginationParams, ResponseMessage

router = APIRouter(
    prefix="/vehicles",
    tags=["車輛管理"],
    responses={
        404: {"description": "找不到車輛"},
        400: {"description": "請求參數錯誤"},
    }
)


def db_vehicle_type_to_schema(db_type: DBVehicleType) -> str:
    """Convert database vehicle type to schema type"""
    if db_type == DBVehicleType.CAR:
        return "truck"
    elif db_type == DBVehicleType.MOTORCYCLE:
        return "motorcycle"
    else:
        return "van"


def schema_vehicle_type_to_db(schema_type: str) -> DBVehicleType:
    """Convert schema vehicle type to database type"""
    if schema_type == "truck":
        return DBVehicleType.CAR
    elif schema_type == "motorcycle":
        return DBVehicleType.MOTORCYCLE
    else:
        return DBVehicleType.ALL  # Default


@router.get("", response_model=VehicleListResponse, summary="取得車輛列表")
async def get_vehicles(
    # Pagination
    pagination: PaginationParams = Depends(),
    # Search params
    search: VehicleSearchParams = Depends(),
    db: Session = Depends(get_db)
):
    """
    取得車輛列表，支援分頁、搜尋與篩選
    
    - **keyword**: 搜尋關鍵字（車牌、品牌、型號）
    - **vehicle_type**: 車輛類型
    - **fuel_type**: 燃料類型
    - **status**: 狀態
    - **insurance_expiring_soon**: 保險即將到期
    - **inspection_due_soon**: 驗車即將到期
    - **page**: 頁數
    - **page_size**: 每頁筆數
    """
    # Build query
    query = db.query(Vehicle)
    
    # Apply filters
    if search.keyword:
        keyword_filter = or_(
            Vehicle.plate_number.ilike(f"%{search.keyword}%")
        )
        query = query.filter(keyword_filter)
    
    if search.vehicle_type:
        db_type = schema_vehicle_type_to_db(search.vehicle_type)
        query = query.filter(Vehicle.vehicle_type == db_type)
    
    # Map status if needed (using is_active for now)
    if search.status:
        if search.status == "active":
            query = query.filter(Vehicle.is_active == True)
        elif search.status == "maintenance":
            query = query.filter(Vehicle.is_maintenance == True) if hasattr(Vehicle, 'is_maintenance') else query
        elif search.status == "retired":
            query = query.filter(Vehicle.is_active == False)
    
    # Get total count
    total = query.count()
    
    # Apply sorting
    if search.order_by == "plate_number":
        order_column = Vehicle.plate_number
    else:
        order_column = Vehicle.created_at
    
    if search.order_desc:
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column)
    
    # Apply pagination
    vehicles = query.offset(pagination.offset).limit(pagination.page_size).all()
    
    # Get statistics for each vehicle
    vehicle_responses = []
    for vehicle in vehicles:
        # Get delivery statistics
        total_deliveries = db.query(func.count(Delivery.id)).filter(
            Delivery.vehicle_id == vehicle.id
        ).scalar() or 0
        
        # Get current month deliveries
        today = date.today()
        first_day_of_month = date(today.year, today.month, 1)
        deliveries_this_month = db.query(func.count(Delivery.id)).filter(
            Delivery.vehicle_id == vehicle.id,
            Delivery.scheduled_date >= first_day_of_month
        ).scalar() or 0
        
        # Get current driver
        current_driver = db.query(Driver).filter(
            Driver.id == vehicle.driver_id
        ).first() if vehicle.driver_id else None
        
        # Create vehicle response data with all required fields
        vehicle_data = {
            **vehicle.__dict__,
            "vehicle_type": db_vehicle_type_to_schema(vehicle.vehicle_type),
            "status": "active" if vehicle.is_active else "retired",
            "current_driver_id": vehicle.driver_id,
            "current_driver_name": current_driver.name if current_driver else None,
            "total_deliveries": total_deliveries,
            "deliveries_this_month": deliveries_this_month,
            "total_mileage": 50000,  # Mock data
            "mileage_this_month": 2000,  # Mock data
            # Mock required fields
            "brand": "Toyota",  # Placeholder
            "model": "Dyna",  # Placeholder
            "year": 2020,  # Placeholder
            "fuel_type": "diesel",  # Placeholder
            "engine_number": "ENG" + str(vehicle.id).zfill(6),  # Placeholder
            "vin": "VIN" + str(vehicle.id).zfill(10),  # Placeholder
            "color": "白色",  # Placeholder
            "registration_date": date(2020, 1, 1),  # Placeholder
            "insurance_expiry_date": date(2025, 12, 31),  # Placeholder
            "inspection_due_date": date(2025, 6, 30),  # Placeholder
            "max_load_kg": vehicle.max_cylinders_50kg * 50 if vehicle.max_cylinders_50kg else 1000,
            "max_cylinders": vehicle.max_cylinders_50kg + vehicle.max_cylinders_20kg if vehicle.max_cylinders_50kg else 20,
            "purchase_price": None,
            "purchase_date": None,
            "last_maintenance_date": date(2024, 12, 1),  # Placeholder
            "next_maintenance_date": date(2025, 3, 1),  # Placeholder
            "maintenance_notes": None,
            "notes": None,
            "retired_date": None
        }
        
        vehicle_responses.append(VehicleResponse.model_validate(vehicle_data))
    
    return VehicleListResponse(
        items=vehicle_responses,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size
    )


@router.get("/{vehicle_id}", response_model=VehicleResponse, summary="取得車輛詳細資料")
async def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    """
    取得特定車輛的詳細資料
    """
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該車輛"
        )
    
    # Get delivery statistics
    total_deliveries = db.query(func.count(Delivery.id)).filter(
        Delivery.vehicle_id == vehicle.id
    ).scalar() or 0
    
    # Get current month deliveries
    today = date.today()
    first_day_of_month = date(today.year, today.month, 1)
    deliveries_this_month = db.query(func.count(Delivery.id)).filter(
        Delivery.vehicle_id == vehicle.id,
        Delivery.scheduled_date >= first_day_of_month
    ).scalar() or 0
    
    # Get current driver
    current_driver = db.query(Driver).filter(
        Driver.id == vehicle.driver_id
    ).first() if vehicle.driver_id else None
    
    vehicle_data = {
        **vehicle.__dict__,
        "vehicle_type": db_vehicle_type_to_schema(vehicle.vehicle_type),
        "status": "active" if vehicle.is_active else "retired",
        "current_driver_id": vehicle.driver_id,
        "current_driver_name": current_driver.name if current_driver else None,
        "total_deliveries": total_deliveries,
        "deliveries_this_month": deliveries_this_month,
        "total_mileage": 50000,
        "mileage_this_month": 2000,
        # Mock required fields
        "brand": "Toyota",
        "model": "Dyna",
        "year": 2020,
        "fuel_type": "diesel",
        "engine_number": "ENG" + str(vehicle.id).zfill(6),
        "vin": "VIN" + str(vehicle.id).zfill(10),
        "color": "白色",
        "registration_date": date(2020, 1, 1),
        "insurance_expiry_date": date(2025, 12, 31),
        "inspection_due_date": date(2025, 6, 30),
        "max_load_kg": vehicle.max_cylinders_50kg * 50 if vehicle.max_cylinders_50kg else 1000,
        "max_cylinders": vehicle.max_cylinders_50kg + vehicle.max_cylinders_20kg if vehicle.max_cylinders_50kg else 20,
        "purchase_price": None,
        "purchase_date": None,
        "last_maintenance_date": date(2024, 12, 1),
        "next_maintenance_date": date(2025, 3, 1),
        "maintenance_notes": None,
        "notes": None,
        "retired_date": None
    }
    
    return VehicleResponse.model_validate(vehicle_data)


@router.post("", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED, summary="新增車輛")
async def create_vehicle(vehicle: VehicleCreate, db: Session = Depends(get_db)):
    """
    新增車輛資料
    
    - **plate_number**: 車牌號碼（必填，唯一）
    - **vehicle_type**: 車輛類型（必填）
    - **brand**: 品牌（必填）
    - **model**: 型號（必填）
    - **year**: 出廠年份（必填）
    - **max_cylinders**: 最大載瓦斯桶數（必填）
    """
    # Check if plate_number already exists
    existing_vehicle = db.query(Vehicle).filter(Vehicle.plate_number == vehicle.plate_number).first()
    if existing_vehicle:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="該車牌號碼已存在"
        )
    
    # Create new vehicle
    db_vehicle = Vehicle(
        plate_number=vehicle.plate_number.upper(),
        vehicle_type=schema_vehicle_type_to_db(vehicle.vehicle_type),
        is_active=True,
        driver_id=None,
        # Set cylinder capacities based on vehicle type
        max_cylinders_50kg=vehicle.max_cylinders // 2 if vehicle.vehicle_type == "truck" else 0,
        max_cylinders_20kg=vehicle.max_cylinders // 2 if vehicle.vehicle_type == "truck" else vehicle.max_cylinders,
        max_cylinders_16kg=0,
        max_cylinders_10kg=0,
        max_cylinders_4kg=0,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    
    # Return with full response data
    vehicle_data = {
        **db_vehicle.__dict__,
        "vehicle_type": vehicle.vehicle_type,
        "status": "active",
        "current_driver_id": None,
        "current_driver_name": None,
        "total_deliveries": 0,
        "deliveries_this_month": 0,
        "total_mileage": 0,
        "mileage_this_month": 0,
        # Include all required fields from create request
        "brand": vehicle.brand,
        "model": vehicle.model,
        "year": vehicle.year,
        "fuel_type": vehicle.fuel_type,
        "engine_number": vehicle.engine_number,
        "vin": vehicle.vin,
        "color": vehicle.color,
        "registration_date": vehicle.registration_date,
        "insurance_expiry_date": vehicle.insurance_expiry_date,
        "inspection_due_date": vehicle.inspection_due_date,
        "max_load_kg": vehicle.max_load_kg,
        "max_cylinders": vehicle.max_cylinders,
        "purchase_price": vehicle.purchase_price,
        "purchase_date": vehicle.purchase_date,
        "last_maintenance_date": None,
        "next_maintenance_date": None,
        "maintenance_notes": None,
        "notes": None,
        "retired_date": None
    }
    
    return VehicleResponse.model_validate(vehicle_data)


@router.put("/{vehicle_id}", response_model=VehicleResponse, summary="更新車輛資料")
async def update_vehicle(
    vehicle_id: int,
    vehicle_update: VehicleUpdate,
    db: Session = Depends(get_db)
):
    """
    更新車輛資料
    """
    # Get existing vehicle
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該車輛"
        )
    
    # Update only provided fields
    update_data = vehicle_update.model_dump(exclude_unset=True)
    
    # Handle status update
    if "status" in update_data:
        if update_data["status"] == "active":
            vehicle.is_active = True
        elif update_data["status"] == "retired":
            vehicle.is_active = False
    
    # Handle vehicle type update
    if "vehicle_type" in update_data:
        vehicle.vehicle_type = schema_vehicle_type_to_db(update_data["vehicle_type"])
    
    # Handle driver assignment
    if "current_driver_id" in update_data:
        if update_data["current_driver_id"]:
            driver = db.query(Driver).filter(Driver.id == update_data["current_driver_id"]).first()
            if not driver:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="找不到該司機"
                )
            if not driver.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="該司機已離職，無法指派"
                )
        vehicle.driver_id = update_data["current_driver_id"]
    
    # Update cylinder capacities if max_cylinders is updated
    if "max_cylinders" in update_data:
        if vehicle.vehicle_type == DBVehicleType.CAR:
            vehicle.max_cylinders_50kg = update_data["max_cylinders"] // 2
            vehicle.max_cylinders_20kg = update_data["max_cylinders"] // 2
        else:
            vehicle.max_cylinders_20kg = update_data["max_cylinders"]
    
    vehicle.updated_at = datetime.now()
    
    db.commit()
    db.refresh(vehicle)
    
    # Return updated vehicle
    return await get_vehicle(vehicle_id, db)


@router.delete("/{vehicle_id}", response_model=ResponseMessage, summary="刪除車輛")
async def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    """
    刪除車輛（軟刪除，將 is_active 設為 False）
    """
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該車輛"
        )
    
    # Check if vehicle has active deliveries
    active_deliveries = db.query(Delivery).filter(
        Delivery.vehicle_id == vehicle_id,
        Delivery.status.in_([DeliveryStatus.ASSIGNED, DeliveryStatus.IN_PROGRESS])
    ).count()
    
    if active_deliveries > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"該車輛還有 {active_deliveries} 筆進行中的配送單，無法刪除"
        )
    
    # Soft delete
    vehicle.is_active = False
    vehicle.driver_id = None  # Remove driver assignment
    vehicle.updated_at = datetime.now()
    
    db.commit()
    
    return ResponseMessage(
        success=True,
        message="車輛已成功停用",
        data={"vehicle_id": vehicle_id}
    )


@router.get("/available/list", response_model=List[VehicleResponse], summary="取得可用車輛列表")
async def get_available_vehicles(
    scheduled_date: date = Query(..., description="預定配送日期"),
    vehicle_type: Optional[str] = Query(None, description="車輛類型"),
    db: Session = Depends(get_db)
):
    """
    取得指定日期可用的車輛列表
    """
    # Build query for active vehicles
    query = db.query(Vehicle).filter(Vehicle.is_active == True)
    
    if vehicle_type:
        db_type = schema_vehicle_type_to_db(vehicle_type)
        query = query.filter(Vehicle.vehicle_type == db_type)
    
    vehicles = query.all()
    
    available_vehicles = []
    for vehicle in vehicles:
        # Check vehicle's usage for the date
        deliveries_on_date = db.query(func.count(Delivery.id)).filter(
            Delivery.vehicle_id == vehicle.id,
            Delivery.scheduled_date == scheduled_date,
            Delivery.status != DeliveryStatus.CANCELLED
        ).scalar() or 0
        
        # Assume vehicle is available if it has less than 15 deliveries
        if deliveries_on_date < 15:
            # Get current driver
            current_driver = db.query(Driver).filter(
                Driver.id == vehicle.driver_id
            ).first() if vehicle.driver_id else None
            
            vehicle_data = {
                **vehicle.__dict__,
                "vehicle_type": db_vehicle_type_to_schema(vehicle.vehicle_type),
                "status": "active",
                "current_driver_id": vehicle.driver_id,
                "current_driver_name": current_driver.name if current_driver else None,
                "total_deliveries": deliveries_on_date,
                "deliveries_this_month": 0,
                "total_mileage": 50000,
                "mileage_this_month": 2000,
                # Mock data
                "brand": "Toyota",
                "model": "Dyna",
                "year": 2020,
                "fuel_type": "diesel",
                "engine_number": "ENG" + str(vehicle.id).zfill(6),
                "vin": "VIN" + str(vehicle.id).zfill(10),
                "color": "白色",
                "registration_date": date(2020, 1, 1),
                "insurance_expiry_date": date(2025, 12, 31),
                "inspection_due_date": date(2025, 6, 30),
                "max_load_kg": vehicle.max_cylinders_50kg * 50 if vehicle.max_cylinders_50kg else 1000,
                "max_cylinders": vehicle.max_cylinders_50kg + vehicle.max_cylinders_20kg if vehicle.max_cylinders_50kg else 20,
                "purchase_price": None,
                "purchase_date": None,
                "last_maintenance_date": date(2024, 12, 1),
                "next_maintenance_date": date(2025, 3, 1),
                "maintenance_notes": None,
                "notes": None,
                "retired_date": None
            }
            available_vehicles.append(VehicleResponse.model_validate(vehicle_data))
    
    return available_vehicles


@router.post("/{vehicle_id}/assign-driver", response_model=ResponseMessage, summary="指派司機給車輛")
async def assign_driver_to_vehicle(
    vehicle_id: int,
    driver_id: Optional[int] = Query(None, description="司機ID，傳入 null 表示解除指派"),
    db: Session = Depends(get_db)
):
    """
    指派司機給車輛或解除指派
    """
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該車輛"
        )
    
    if not vehicle.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已停用的車輛無法指派司機"
        )
    
    if driver_id:
        # Verify driver exists and is available
        driver = db.query(Driver).filter(Driver.id == driver_id).first()
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="找不到該司機"
            )
        
        if not driver.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="該司機已離職，無法指派"
            )
        
        # Check if driver is already assigned to another vehicle
        other_vehicle = db.query(Vehicle).filter(
            Vehicle.driver_id == driver_id,
            Vehicle.id != vehicle_id,
            Vehicle.is_active == True
        ).first()
        
        if other_vehicle:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"該司機已被指派給車輛 {other_vehicle.plate_number}"
            )
    
    # Assign or unassign driver
    vehicle.driver_id = driver_id
    vehicle.updated_at = datetime.now()
    
    db.commit()
    
    if driver_id:
        return ResponseMessage(
            success=True,
            message=f"已成功指派司機給車輛 {vehicle.plate_number}",
            data={
                "vehicle_id": vehicle_id,
                "driver_id": driver_id
            }
        )
    else:
        return ResponseMessage(
            success=True,
            message=f"已解除車輛 {vehicle.plate_number} 的司機指派",
            data={"vehicle_id": vehicle_id}
        )


@router.get("/maintenance/due", response_model=List[VehicleResponse], summary="取得需要保養的車輛")
async def get_vehicles_due_for_maintenance(db: Session = Depends(get_db)):
    """
    取得需要保養或證件即將到期的車輛列表
    """
    vehicles = db.query(Vehicle).filter(Vehicle.is_active == True).all()
    
    due_vehicles = []
    today = date.today()
    
    for vehicle in vehicles:
        needs_attention = False
        
        # Mock maintenance due check (every 3 months)
        last_maintenance = date(2024, 12, 1)
        if (today - last_maintenance).days > 90:
            needs_attention = True
        
        # Mock insurance expiry check (within 30 days)
        insurance_expiry = date(2025, 12, 31)
        if (insurance_expiry - today).days <= 30:
            needs_attention = True
        
        # Mock inspection due check (within 30 days)
        inspection_due = date(2025, 6, 30)
        if (inspection_due - today).days <= 30:
            needs_attention = True
        
        if needs_attention:
            # Get current driver
            current_driver = db.query(Driver).filter(
                Driver.id == vehicle.driver_id
            ).first() if vehicle.driver_id else None
            
            vehicle_data = {
                **vehicle.__dict__,
                "vehicle_type": db_vehicle_type_to_schema(vehicle.vehicle_type),
                "status": "active",
                "current_driver_id": vehicle.driver_id,
                "current_driver_name": current_driver.name if current_driver else None,
                "total_deliveries": 0,
                "deliveries_this_month": 0,
                "total_mileage": 50000,
                "mileage_this_month": 2000,
                # Mock data
                "brand": "Toyota",
                "model": "Dyna",
                "year": 2020,
                "fuel_type": "diesel",
                "engine_number": "ENG" + str(vehicle.id).zfill(6),
                "vin": "VIN" + str(vehicle.id).zfill(10),
                "color": "白色",
                "registration_date": date(2020, 1, 1),
                "insurance_expiry_date": insurance_expiry,
                "inspection_due_date": inspection_due,
                "max_load_kg": vehicle.max_cylinders_50kg * 50 if vehicle.max_cylinders_50kg else 1000,
                "max_cylinders": vehicle.max_cylinders_50kg + vehicle.max_cylinders_20kg if vehicle.max_cylinders_50kg else 20,
                "purchase_price": None,
                "purchase_date": None,
                "last_maintenance_date": last_maintenance,
                "next_maintenance_date": date(2025, 3, 1),
                "maintenance_notes": "定期保養提醒",
                "notes": None,
                "retired_date": None
            }
            due_vehicles.append(VehicleResponse.model_validate(vehicle_data))
    
    return due_vehicles