"""Client API Router - 客戶管理 API"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from datetime import datetime

from core.database import get_db
from models.database_schema import Client, Delivery
from ..schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientListResponse,
    ClientSearchParams
)
from ..schemas.base import PaginationParams, ResponseMessage

router = APIRouter(
    prefix="/clients",
    tags=["客戶管理"],
    responses={
        404: {"description": "找不到客戶"},
        400: {"description": "請求參數錯誤"},
    }
)


@router.get("", response_model=ClientListResponse, summary="取得客戶列表")
async def get_clients(
    # Pagination
    pagination: PaginationParams = Depends(),
    # Search params
    search: ClientSearchParams = Depends(),
    # Additional filters
    area: Optional[str] = Query(None, description="區域篩選（area欄位）"),
    db: Session = Depends(get_db)
):
    """
    取得客戶列表，支援分頁、搜尋與篩選
    
    - **keyword**: 搜尋關鍵字（客戶名稱、地址）
    - **district**: 區域篩選
    - **is_corporate**: 是否為公司戶
    - **is_active**: 是否啟用
    - **page**: 頁數
    - **page_size**: 每頁筆數
    """
    # Build query
    query = db.query(Client)
    
    # Apply filters
    if search.keyword:
        keyword_filters = []
        if hasattr(Client, 'name'):
            keyword_filters.append(Client.name.ilike(f"%{search.keyword}%"))
        if hasattr(Client, 'address'):
            keyword_filters.append(Client.address.ilike(f"%{search.keyword}%"))
        if hasattr(Client, 'contact_person'):
            keyword_filters.append(Client.contact_person.ilike(f"%{search.keyword}%"))
        
        if keyword_filters:
            query = query.filter(or_(*keyword_filters))
    
    if search.district:
        query = query.filter(Client.district == search.district)
    
    if search.is_corporate is not None:
        query = query.filter(Client.is_corporate == search.is_corporate)
    
    if search.is_active is not None:
        query = query.filter(Client.is_active == search.is_active)
    
    # Handle area parameter (for backward compatibility)
    if area:
        query = query.filter(Client.area == area)
    
    # Get total count
    total = query.count()
    
    # Apply sorting
    order_column = getattr(Client, search.order_by, Client.created_at)
    if search.order_desc:
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column)
    
    # Apply pagination
    clients = query.offset(pagination.offset).limit(pagination.page_size).all()
    
    # Get statistics for each client
    client_responses = []
    for client in clients:
        # Get order statistics
        total_orders = db.query(func.count(Delivery.id)).filter(
            Delivery.client_id == client.id
        ).scalar() or 0
        
        last_order = db.query(Delivery).filter(
            Delivery.client_id == client.id
        ).order_by(Delivery.created_at.desc()).first()
        
        client_data = {
            **client.__dict__,
            "total_orders": total_orders,
            "last_order_date": last_order.created_at if last_order else None
        }
        client_responses.append(ClientResponse.model_validate(client_data))
    
    return ClientListResponse(
        items=client_responses,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size
    )


@router.get("/{client_id}", response_model=ClientResponse, summary="取得客戶詳細資料")
async def get_client(client_id: int, db: Session = Depends(get_db)):
    """
    取得特定客戶的詳細資料
    """
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該客戶"
        )
    
    # Get order statistics
    total_orders = db.query(func.count(Delivery.id)).filter(
        Delivery.client_id == client.id
    ).scalar() or 0
    
    last_order = db.query(Delivery).filter(
        Delivery.client_id == client.id
    ).order_by(Delivery.created_at.desc()).first()
    
    client_data = {
        **client.__dict__,
        "total_orders": total_orders,
        "last_order_date": last_order.created_at if last_order else None
    }
    
    return ClientResponse.model_validate(client_data)


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED, summary="新增客戶")
async def create_client(client: ClientCreate, db: Session = Depends(get_db)):
    """
    新增客戶資料
    
    - **name**: 客戶名稱（必填）
    - **address**: 地址（必填）
    - **tax_id**: 統一編號（選填，8碼數字）
    """
    # Check if tax_id already exists (if provided)
    if client.tax_id:
        existing_tax = db.query(Client).filter(Client.tax_id == client.tax_id).first()
        if existing_tax:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="該統一編號已被使用"
            )
    
    # Generate client code
    import uuid
    client_code = f"C{str(uuid.uuid4())[:8].upper()}"
    
    # Create new client
    client_data = client.model_dump()
    db_client = Client(
        **client_data,
        client_code=client_code,
        invoice_title=client_data.get('name', ''),  # Use name as invoice title
        short_name=client_data.get('name', '')[:50] if client_data.get('name') else '',  # Short version
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    
    return ClientResponse.model_validate(db_client)


@router.put("/{client_id}", response_model=ClientResponse, summary="更新客戶資料")
async def update_client(
    client_id: int,
    client_update: ClientUpdate,
    db: Session = Depends(get_db)
):
    """
    更新客戶資料
    """
    # Get existing client
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該客戶"
        )
    
    # Update only provided fields
    update_data = client_update.model_dump(exclude_unset=True)
    
    # Check tax_id uniqueness if updating
    if "tax_id" in update_data and update_data["tax_id"] != client.tax_id:
        existing_tax = db.query(Client).filter(
            Client.tax_id == update_data["tax_id"],
            Client.id != client_id
        ).first()
        if existing_tax:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="該統一編號已被使用"
            )
    
    # Update fields
    for field, value in update_data.items():
        setattr(client, field, value)
    
    client.updated_at = datetime.now()
    
    db.commit()
    db.refresh(client)
    
    # Get statistics
    total_orders = db.query(func.count(Delivery.id)).filter(
        Delivery.client_id == client.id
    ).scalar() or 0
    
    last_order = db.query(Delivery).filter(
        Delivery.client_id == client.id
    ).order_by(Delivery.created_at.desc()).first()
    
    client_data = {
        **client.__dict__,
        "total_orders": total_orders,
        "last_order_date": last_order.created_at if last_order else None
    }
    
    return ClientResponse.model_validate(client_data)


@router.delete("/{client_id}", response_model=ResponseMessage, summary="刪除客戶")
async def delete_client(client_id: int, db: Session = Depends(get_db)):
    """
    刪除客戶（軟刪除，將 is_active 設為 False）
    """
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到該客戶"
        )
    
    # Check if client has active deliveries
    active_deliveries = db.query(Delivery).filter(
        Delivery.client_id == client_id,
        Delivery.status.in_(["pending", "assigned", "in_progress"])
    ).count()
    
    if active_deliveries > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"該客戶還有 {active_deliveries} 筆進行中的配送單，無法刪除"
        )
    
    # Soft delete
    client.is_active = False
    client.updated_at = datetime.now()
    
    db.commit()
    
    return ResponseMessage(
        success=True,
        message="客戶已成功停用",
        data={"client_id": client_id}
    )


@router.get("/districts/list", response_model=List[str], summary="取得所有區域列表")
async def get_districts(db: Session = Depends(get_db)):
    """
    取得系統中所有客戶的區域列表（去重複）
    """
    districts = db.query(Client.district).filter(
        Client.district.isnot(None),
        Client.is_active == True
    ).distinct().all()
    
    return [d[0] for d in districts if d[0]]


