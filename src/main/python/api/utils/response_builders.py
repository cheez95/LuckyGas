"""Response builder utilities for API endpoints"""
from typing import Dict, Any, List, Callable
from sqlalchemy.orm import Session, Query
from datetime import datetime

from models.database_schema import Delivery, Client, Driver, Vehicle
from ..schemas.delivery import DeliveryResponse
from ..schemas.base import PaginationParams
from .api_utils import (
    calculate_total_cylinders, 
    calculate_returned_cylinders,
    calculate_total_amount,
    format_order_number
)


def build_delivery_response(delivery: Delivery, db: Session) -> Dict[str, Any]:
    """Build standardized delivery response data"""
    client = delivery.client
    driver = delivery.driver if delivery.driver_id else None
    vehicle = delivery.vehicle if delivery.vehicle_id else None
    
    # Calculate totals
    total_cylinders = calculate_total_cylinders(delivery)
    returned_cylinders = calculate_returned_cylinders(delivery)
    
    # Standard pricing
    unit_price = 650.0
    delivery_fee = 0.0
    total_amount = calculate_total_amount(delivery, unit_price, delivery_fee)
    
    # Format status
    if hasattr(delivery.status, 'value'):
        status = delivery.status.value.lower()
    else:
        status = str(delivery.status).replace('DeliveryStatus.', '').lower()
    
    # Build response data
    return {
        **delivery.__dict__,
        "status": status,
        "order_number": format_order_number(delivery.id),
        "gas_quantity": total_cylinders,
        "unit_price": unit_price,
        "delivery_fee": delivery_fee,
        "total_amount": total_amount,
        "delivery_address": client.address,
        "delivery_district": client.district if hasattr(client, 'district') else client.area,
        "payment_method": "cash",  # Default
        "payment_status": "pending",  # Default
        "client_name": client.name if client.name else client.invoice_title,
        "client_phone": getattr(client, 'phone', None),
        "driver_name": driver.name if driver else None,
        "vehicle_plate": vehicle.plate_number if vehicle else None,
        "scheduled_time_slot": f"{delivery.scheduled_time_start}-{delivery.scheduled_time_end}" 
            if delivery.scheduled_time_start else None,
        "delivered_at": delivery.actual_delivery_time,
        "delivery_photo_url": getattr(delivery, 'photo_url', None),
        "customer_signature_url": getattr(delivery, 'signature_url', None),
        "empty_cylinders_to_return": returned_cylinders,
        "empty_cylinders_returned": returned_cylinders,
        "requires_empty_cylinder_return": returned_cylinders > 0
    }


def build_paginated_response(
    query: Query,
    pagination: PaginationParams,
    items_builder: Callable[[List[Any]], List[Dict[str, Any]]],
    response_class: type
) -> Dict[str, Any]:
    """Build standardized paginated response"""
    # Get total count
    total = query.count()
    
    # Apply pagination
    items = query.offset(pagination.offset).limit(pagination.page_size).all()
    
    # Transform items
    transformed_items = items_builder(items)
    
    # Calculate total pages
    total_pages = (total + pagination.page_size - 1) // pagination.page_size
    
    return {
        "items": transformed_items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
        "total_pages": total_pages
    }