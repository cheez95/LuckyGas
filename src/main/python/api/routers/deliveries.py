"""Delivery API Router - 配送管理 API"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date

from core.database import get_db
from models.database_schema import Delivery, Client, Driver, Vehicle, DeliveryStatus
from ..schemas.delivery import (
    DeliveryCreate,
    DeliveryUpdate,
    DeliveryResponse,
    DeliveryListResponse,
    DeliverySearchParams
)
from ..schemas.base import PaginationParams, ResponseMessage
from ..utils import (
    build_delivery_response,
    normalize_status,
    format_status_for_response,
    apply_date_range_filter,
    apply_keyword_search,
    apply_sorting
)

router = APIRouter(
    prefix="/deliveries",
    tags=["配送管理"],
    responses={
        404: {"description": "找不到配送單"},
        400: {"description": "請求參數錯誤"},
    }
)




@router.get("", response_model=DeliveryListResponse, summary="取得配送單列表")
async def get_deliveries(
    # Pagination
    pagination: PaginationParams = Depends(),
    # Search params
    search: DeliverySearchParams = Depends(),
    db: Session = Depends(get_db)
):
    """
    取得配送單列表，支援分頁、搜尋與篩選
    
    - **keyword**: 搜尋關鍵字（訂單編號、客戶名稱、地址）
    - **client_id**: 客戶ID
    - **driver_id**: 司機ID
    - **status**: 配送狀態
    - **payment_status**: 付款狀態
    - **scheduled_date_from**: 預定配送日期起
    - **scheduled_date_to**: 預定配送日期迄
    - **district**: 配送區域
    """
    # Build query
    query = db.query(Delivery).join(Client)
    
    # Apply filters
    if search.keyword:
        query = apply_keyword_search(query, search.keyword, Client.name, Client.address)
    
    if search.client_id:
        query = query.filter(Delivery.client_id == search.client_id)
    
    if search.driver_id:
        query = query.filter(Delivery.driver_id == search.driver_id)
    
    if search.status:
        status_enum = normalize_status(search.status)
        if status_enum:
            query = query.filter(Delivery.status == status_enum)
    
    query = apply_date_range_filter(
        query, Delivery.scheduled_date,
        search.scheduled_date_from, search.scheduled_date_to
    )
    
    if search.district:
        query = query.filter(Client.district == search.district)
    
    # Get total count
    total = query.count()
    
    # Apply sorting
    order_column_map = {
        "scheduled_date": Delivery.scheduled_date,
        "created_at": Delivery.created_at,
        "status": Delivery.status
    }
    order_column = order_column_map.get(search.order_by, Delivery.scheduled_date)
    query = apply_sorting(query, order_column, search.order_desc)
    
    # Apply pagination
    deliveries = query.offset(pagination.offset).limit(pagination.page_size).all()
    
    # Convert to response model
    delivery_responses = []
    for delivery in deliveries:
        delivery_data = build_delivery_response(delivery, db)
        delivery_responses.append(DeliveryResponse.model_validate(delivery_data))
    
    return DeliveryListResponse(
        items=delivery_responses,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size
    )


@router.get("/{delivery_id}", response_model=DeliveryResponse, summary="取得配送單詳細資料")
async def get_delivery(delivery_id: int, db: Session = Depends(get_db)):
    """
    取得特定配送單的詳細資料
    """
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該配送單"
        )
    
    # Build response using utility
    delivery_data = build_delivery_response(delivery, db)
    return DeliveryResponse.model_validate(delivery_data)


@router.post("", response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED, summary="新增配送單")
async def create_delivery(delivery: DeliveryCreate, db: Session = Depends(get_db)):
    """
    新增配送單
    
    - **client_id**: 客戶ID（必填）
    - **scheduled_date**: 預定配送日期（必填）
    - **gas_quantity**: 瓦斯桶數（必填）
    - **delivery_address**: 配送地址（必填）
    """
    # Verify client exists
    client = db.query(Client).filter(Client.id == delivery.client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該客戶"
        )
    
    # Create delivery record
    # Map gas_quantity to appropriate cylinder type (assuming 20kg as default)
    db_delivery = Delivery(
        client_id=delivery.client_id,
        scheduled_date=delivery.scheduled_date,
        scheduled_time_start=delivery.scheduled_time_slot.split('-')[0] if delivery.scheduled_time_slot and '-' in delivery.scheduled_time_slot else None,
        scheduled_time_end=delivery.scheduled_time_slot.split('-')[1] if delivery.scheduled_time_slot and '-' in delivery.scheduled_time_slot else None,
        status=DeliveryStatus.PENDING,
        delivered_20kg=delivery.gas_quantity,  # Default to 20kg cylinders
        returned_20kg=delivery.empty_cylinders_to_return if delivery.requires_empty_cylinder_return else 0,
        notes=delivery.notes,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(db_delivery)
    db.commit()
    db.refresh(db_delivery)
    
    # Build response using utility and merge with additional create-specific data
    delivery_data = build_delivery_response(db_delivery, db)
    # Override/add create-specific fields
    delivery_data.update({
        "unit_price": float(delivery.unit_price),
        "delivery_fee": float(delivery.delivery_fee),
        "total_amount": delivery.gas_quantity * float(delivery.unit_price) + float(delivery.delivery_fee),
        "delivery_address": delivery.delivery_address,
        "delivery_district": delivery.delivery_district,
        "delivery_latitude": delivery.delivery_latitude,
        "delivery_longitude": delivery.delivery_longitude,
        "payment_method": delivery.payment_method,
        "scheduled_time_slot": delivery.scheduled_time_slot,
        "empty_cylinders_to_return": delivery.empty_cylinders_to_return,
        "requires_empty_cylinder_return": delivery.requires_empty_cylinder_return
    })
    
    return DeliveryResponse.model_validate(delivery_data)


@router.put("/{delivery_id}", response_model=DeliveryResponse, summary="更新配送單")
async def update_delivery(
    delivery_id: int,
    delivery_update: DeliveryUpdate,
    db: Session = Depends(get_db)
):
    """
    更新配送單資料
    """
    # Get existing delivery
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該配送單"
        )
    
    # Check if delivery is already completed
    if delivery.status == DeliveryStatus.COMPLETED and delivery_update.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已完成的配送單無法修改狀態"
        )
    
    # Update only provided fields
    update_data = delivery_update.model_dump(exclude_unset=True)
    
    # Handle status update
    if "status" in update_data:
        status_enum = normalize_status(update_data["status"])
        if not status_enum:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {update_data['status']}"
            )
        
        delivery.status = status_enum
        
        # If marking as completed, set delivered_at
        if status_enum == DeliveryStatus.COMPLETED and not delivery.actual_delivery_time:
            delivery.actual_delivery_time = update_data.get("delivered_at", datetime.now())
    
    # Handle driver assignment
    if "driver_id" in update_data:
        if update_data["driver_id"]:
            driver = db.query(Driver).filter(Driver.id == update_data["driver_id"]).first()
            if not driver:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="找不到該司機"
                )
        delivery.driver_id = update_data["driver_id"]
    
    # Handle vehicle assignment
    if "vehicle_id" in update_data:
        if update_data["vehicle_id"]:
            vehicle = db.query(Vehicle).filter(Vehicle.id == update_data["vehicle_id"]).first()
            if not vehicle:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="找不到該車輛"
                )
        delivery.vehicle_id = update_data["vehicle_id"]
    
    # Handle time slot update
    if "scheduled_time_slot" in update_data and update_data["scheduled_time_slot"]:
        parts = update_data["scheduled_time_slot"].split('-')
        if len(parts) == 2:
            delivery.scheduled_time_start = parts[0]
            delivery.scheduled_time_end = parts[1]
    
    # Handle cylinder quantity updates
    if "gas_quantity" in update_data:
        delivery.delivered_20kg = update_data["gas_quantity"]
    
    if "empty_cylinders_returned" in update_data:
        delivery.returned_20kg = update_data["empty_cylinders_returned"]
    
    # Update other fields
    if "scheduled_date" in update_data:
        delivery.scheduled_date = update_data["scheduled_date"]
    
    if "notes" in update_data:
        delivery.notes = update_data["notes"]
    
    if "delivery_photo_url" in update_data:
        delivery.photo_url = update_data["delivery_photo_url"]
    
    if "customer_signature_url" in update_data:
        delivery.signature_url = update_data["customer_signature_url"]
    
    delivery.updated_at = datetime.now()
    
    db.commit()
    db.refresh(delivery)
    
    # Build response using utility and merge with update-specific data
    delivery_data = build_delivery_response(delivery, db)
    # Add update-specific fields that might have been provided
    if "payment_method" in update_data:
        delivery_data["payment_method"] = update_data["payment_method"]
    if "payment_status" in update_data:
        delivery_data["payment_status"] = update_data["payment_status"]
    if "paid_at" in update_data:
        delivery_data["paid_at"] = update_data["paid_at"]
    
    return DeliveryResponse.model_validate(delivery_data)


@router.delete("/{delivery_id}", response_model=ResponseMessage, summary="取消配送單")
async def cancel_delivery(delivery_id: int, db: Session = Depends(get_db)):
    """
    取消配送單（將狀態設為 cancelled）
    """
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該配送單"
        )
    
    # Check if delivery can be cancelled
    if delivery.status in [DeliveryStatus.COMPLETED, DeliveryStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"狀態為 {format_status_for_response(delivery.status)} 的配送單無法取消"
        )
    
    # Cancel delivery
    delivery.status = DeliveryStatus.CANCELLED
    delivery.updated_at = datetime.now()
    
    db.commit()
    
    return ResponseMessage(
        success=True,
        message="配送單已成功取消",
        data={"delivery_id": delivery_id}
    )


@router.post("/{delivery_id}/assign", response_model=DeliveryResponse, summary="指派司機與車輛")
async def assign_delivery(
    delivery_id: int,
    driver_id: int = Query(..., description="司機ID"),
    vehicle_id: int = Query(..., description="車輛ID"),
    db: Session = Depends(get_db)
):
    """
    指派司機與車輛給配送單
    """
    # Get delivery
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該配送單"
        )
    
    # Check if already completed
    if delivery.status == DeliveryStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已完成的配送單無法重新指派"
        )
    
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
            detail="該司機已離職"
        )
    
    # Verify vehicle exists and is available
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該車輛"
        )
    
    if not vehicle.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="該車輛已停用"
        )
    
    # Assign driver and vehicle
    delivery.driver_id = driver_id
    delivery.vehicle_id = vehicle_id
    delivery.status = DeliveryStatus.ASSIGNED
    delivery.updated_at = datetime.now()
    
    db.commit()
    db.refresh(delivery)
    
    # Return updated delivery
    return await get_delivery(delivery_id, db)


@router.get("/today/summary", response_model=dict, summary="取得今日配送統計")
async def get_today_summary(db: Session = Depends(get_db)):
    """
    取得今日配送統計資料
    """
    today = date.today()
    
    # Total deliveries today
    total = db.query(func.count(Delivery.id)).filter(
        Delivery.scheduled_date == today
    ).scalar() or 0
    
    # Status breakdown
    status_counts = db.query(
        Delivery.status,
        func.count(Delivery.id)
    ).filter(
        Delivery.scheduled_date == today
    ).group_by(Delivery.status).all()
    
    status_summary = {
        "pending": 0,
        "assigned": 0,
        "in_progress": 0,
        "completed": 0,
        "cancelled": 0
    }
    
    for status, count in status_counts:
        # Use utility to format status
        status_key = format_status_for_response(status)
        if status_key in status_summary:
            status_summary[status_key] = count
    
    # Driver workload
    driver_counts = db.query(
        Driver.name,
        func.count(Delivery.id)
    ).join(
        Delivery, Driver.id == Delivery.driver_id
    ).filter(
        Delivery.scheduled_date == today
    ).group_by(Driver.id, Driver.name).all()
    
    return {
        "date": today.isoformat(),
        "date_taiwan": f"民國{today.year - 1911}年{today.month}月{today.day}日",
        "total_deliveries": total,
        "status_summary": status_summary,
        "completion_rate": round(status_summary["completed"] / total * 100, 1) if total > 0 else 0,
        "driver_workload": [
            {"driver_name": name, "delivery_count": count}
            for name, count in driver_counts
        ]
    }