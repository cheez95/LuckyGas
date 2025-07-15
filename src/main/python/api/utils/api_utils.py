"""Common API utility functions"""
from typing import Optional
from datetime import datetime
from models.database_schema import Delivery


def calculate_total_cylinders(delivery: Delivery) -> int:
    """Calculate total number of cylinders across all sizes"""
    return (
        delivery.delivered_50kg + 
        delivery.delivered_20kg + 
        delivery.delivered_16kg + 
        delivery.delivered_10kg + 
        delivery.delivered_4kg
    )


def calculate_returned_cylinders(delivery: Delivery) -> int:
    """Calculate total number of returned cylinders"""
    return (
        delivery.returned_50kg + 
        delivery.returned_20kg + 
        delivery.returned_16kg + 
        delivery.returned_10kg + 
        delivery.returned_4kg
    )


def calculate_total_amount(
    delivery: Delivery, 
    unit_price: float = 650.0, 
    delivery_fee: float = 0.0
) -> float:
    """Calculate total amount for a delivery"""
    total_cylinders = calculate_total_cylinders(delivery)
    return total_cylinders * unit_price + delivery_fee


def format_order_number(delivery_id: int, prefix: str = "D") -> str:
    """Generate a standard order number format"""
    today = datetime.now()
    return f"{prefix}{today.strftime('%Y%m%d')}{delivery_id:04d}"