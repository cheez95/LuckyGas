"""Status handling utilities for API endpoints"""
from typing import Dict, Optional
from models.database_schema import DeliveryStatus


# Standard status mapping for consistency across all endpoints
DELIVERY_STATUS_MAP = {
    'pending': DeliveryStatus.PENDING,
    'assigned': DeliveryStatus.ASSIGNED,
    'in_progress': DeliveryStatus.IN_PROGRESS,
    'in progress': DeliveryStatus.IN_PROGRESS,  # Alternative format
    'completed': DeliveryStatus.COMPLETED,
    'cancelled': DeliveryStatus.CANCELLED,
    'canceled': DeliveryStatus.CANCELLED  # Alternative spelling
}


def get_delivery_status_map() -> Dict[str, DeliveryStatus]:
    """Get the standard delivery status mapping"""
    return DELIVERY_STATUS_MAP.copy()


def normalize_status(status_string: str) -> Optional[DeliveryStatus]:
    """
    Normalize status string to DeliveryStatus enum
    
    Args:
        status_string: The status string to normalize
        
    Returns:
        DeliveryStatus enum or None if invalid
    """
    if not status_string:
        return None
    
    # Try lowercase mapping first
    normalized = status_string.lower()
    if normalized in DELIVERY_STATUS_MAP:
        return DELIVERY_STATUS_MAP[normalized]
    
    # Try uppercase enum name as fallback
    try:
        return DeliveryStatus[status_string.upper()]
    except (KeyError, AttributeError):
        return None


def format_status_for_response(status: DeliveryStatus) -> str:
    """
    Format DeliveryStatus enum for API response
    
    Args:
        status: DeliveryStatus enum
        
    Returns:
        Lowercase string representation
    """
    if hasattr(status, 'value'):
        return status.value.lower()
    else:
        # Handle string representation from database
        return str(status).replace('DeliveryStatus.', '').lower()