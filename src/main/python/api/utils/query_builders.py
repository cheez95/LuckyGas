"""Query builder utilities for API endpoints"""
from typing import Optional, Any
from datetime import date, datetime
from sqlalchemy.orm import Query
from sqlalchemy import or_, and_, func


def apply_date_range_filter(
    query: Query,
    model_field: Any,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> Query:
    """
    Apply date range filter to a query
    
    Args:
        query: The SQLAlchemy query to filter
        model_field: The date field to filter on
        start_date: Start date (inclusive)
        end_date: End date (inclusive)
        
    Returns:
        Filtered query
    """
    if start_date:
        query = query.filter(model_field >= start_date)
    if end_date:
        query = query.filter(model_field <= end_date)
    return query


def apply_keyword_search(
    query: Query,
    keyword: str,
    *search_fields: Any
) -> Query:
    """
    Apply keyword search across multiple fields
    
    Args:
        query: The SQLAlchemy query to filter
        keyword: The search keyword
        *search_fields: Fields to search in
        
    Returns:
        Filtered query
    """
    if not keyword or not search_fields:
        return query
    
    search_pattern = f"%{keyword}%"
    conditions = [field.ilike(search_pattern) for field in search_fields]
    
    if len(conditions) == 1:
        return query.filter(conditions[0])
    else:
        return query.filter(or_(*conditions))


def apply_sorting(
    query: Query,
    order_column: Any,
    order_desc: bool = False
) -> Query:
    """
    Apply sorting to a query
    
    Args:
        query: The SQLAlchemy query to sort
        order_column: The column to order by
        order_desc: Whether to sort descending
        
    Returns:
        Sorted query
    """
    if order_desc:
        return query.order_by(order_column.desc())
    else:
        return query.order_by(order_column)


def apply_pagination(
    query: Query,
    page: int = 1,
    page_size: int = 20
) -> Query:
    """
    Apply pagination to a query
    
    Args:
        query: The SQLAlchemy query to paginate
        page: Page number (1-based)
        page_size: Number of items per page
        
    Returns:
        Paginated query
    """
    offset = (page - 1) * page_size
    return query.offset(offset).limit(page_size)


def build_filter_conditions(filters: dict, model_mapping: dict) -> list:
    """
    Build filter conditions from a dictionary of filters
    
    Args:
        filters: Dictionary of field_name: value pairs
        model_mapping: Dictionary mapping field names to model fields
        
    Returns:
        List of filter conditions
    """
    conditions = []
    for field_name, value in filters.items():
        if value is not None and field_name in model_mapping:
            model_field = model_mapping[field_name]
            conditions.append(model_field == value)
    return conditions