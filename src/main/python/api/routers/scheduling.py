"""
REST API endpoints for scheduling service
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import date, datetime, timedelta
from pydantic import BaseModel, Field
import logging

from core.database import get_db
from services.cloud_scheduling_service import CloudSchedulingService
from services.cloud_route_service import CloudRouteOptimizationService
# Authentication and response formatting will be added later
from api.schemas.base import ResponseMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scheduling", tags=["scheduling"])


# Request/Response Models
class ScheduleGenerationRequest(BaseModel):
    """Request for schedule generation"""
    target_date: date = Field(..., description="Date to generate schedule for")
    optimization_mode: str = Field("balanced", description="Optimization mode: efficiency, customer_satisfaction, cost")
    include_predictions: bool = Field(True, description="Include demand predictions")
    confidence_threshold: float = Field(0.7, description="Minimum confidence for predictions")
    
    class Config:
        schema_extra = {
            "example": {
                "target_date": "2024-01-15",
                "optimization_mode": "balanced",
                "include_predictions": True,
                "confidence_threshold": 0.7
            }
        }


class SchedulePreviewRequest(BaseModel):
    """Request for schedule preview"""
    schedule_data: Dict[str, Any] = Field(..., description="Schedule data to preview")
    include_routes: bool = Field(True, description="Include route optimization in preview")
    
    
class ScheduleApplicationRequest(BaseModel):
    """Request to apply a schedule"""
    schedule_id: str = Field(..., description="ID of schedule to apply")
    create_deliveries: bool = Field(True, description="Create delivery records")
    optimize_routes: bool = Field(True, description="Optimize routes after applying")


class TimeSlotResponse(BaseModel):
    """Time slot information"""
    slot_id: str
    start_time: str
    end_time: str
    capacity: int
    allocated: int
    available: int
    deliveries: List[Dict[str, Any]]


class ScheduleResponse(BaseModel):
    """Schedule generation response"""
    schedule_id: str
    target_date: str
    status: str
    optimization_mode: str
    time_slots: List[TimeSlotResponse]
    summary: Dict[str, Any]
    created_at: datetime


@router.post("/generate", response_model=ResponseMessage)
async def generate_schedule(
    request: ScheduleGenerationRequest,
    session: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Authentication to be added later
):
    """
    Generate optimized delivery schedule for a specific date
    
    This endpoint:
    1. Analyzes historical delivery patterns
    2. Predicts demand using AI
    3. Checks resource availability
    4. Generates optimized time slot assignments
    5. Returns preview of the schedule
    """
    try:
        logger.info(f"Generating schedule for {request.target_date}")
        
        # Initialize scheduling service
        scheduling_service = CloudSchedulingService(session)
        
        # Generate schedule
        schedule_result = await scheduling_service.generate_daily_schedule(
            target_date=request.target_date,
            optimization_mode=request.optimization_mode,
            include_predictions=request.include_predictions,
            confidence_threshold=request.confidence_threshold
        )
        
        if not schedule_result:
            raise HTTPException(status_code=500, detail="Failed to generate schedule")
        
        # Format response
        time_slots = []
        for slot in schedule_result.get('time_slots', []):
            time_slots.append(TimeSlotResponse(
                slot_id=slot['slot_id'],
                start_time=slot['start_time'],
                end_time=slot['end_time'],
                capacity=slot['capacity'],
                allocated=slot['allocated'],
                available=slot['available'],
                deliveries=slot.get('deliveries', [])
            ))
        
        response_data = ScheduleResponse(
            schedule_id=schedule_result['schedule_id'],
            target_date=str(request.target_date),
            status='draft',
            optimization_mode=request.optimization_mode,
            time_slots=time_slots,
            summary=schedule_result.get('summary', {}),
            created_at=datetime.now()
        )
        
        return format_response(
            data=response_data.dict(),
            message=f"Schedule generated successfully for {request.target_date}"
        )
        
    except Exception as e:
        logger.error(f"Error generating schedule: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preview", response_model=ResponseMessage)
async def preview_schedule(
    request: SchedulePreviewRequest,
    session: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Authentication to be added later
):
    """
    Preview schedule with optional route optimization
    
    Shows:
    - Time slot allocations
    - Driver assignments
    - Vehicle assignments
    - Estimated routes (if requested)
    - Cost estimates
    """
    try:
        scheduling_service = CloudSchedulingService(session)
        
        # Preview schedule
        preview_result = await scheduling_service.preview_schedule(
            schedule_data=request.schedule_data,
            include_routes=request.include_routes
        )
        
        if request.include_routes:
            # Add route optimization preview
            route_service = CloudRouteOptimizationService(session)
            routes = await route_service.preview_routes_for_schedule(
                schedule_data=request.schedule_data
            )
            preview_result['routes'] = routes
        
        return format_response(
            data=preview_result,
            message="Schedule preview generated successfully"
        )
        
    except Exception as e:
        logger.error(f"Error previewing schedule: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/apply", response_model=ResponseMessage)
async def apply_schedule(
    request: ScheduleApplicationRequest,
    session: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Authentication to be added later
):
    """
    Apply a generated schedule
    
    This will:
    1. Create delivery records for scheduled items
    2. Assign drivers and vehicles
    3. Optimize routes (if requested)
    4. Update system state
    """
    try:
        scheduling_service = CloudSchedulingService(session)
        
        # Apply schedule
        result = await scheduling_service.apply_schedule(
            schedule_id=request.schedule_id,
            create_deliveries=request.create_deliveries
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Failed to apply schedule'))
        
        # Optimize routes if requested
        if request.optimize_routes and result.get('deliveries_created'):
            route_service = CloudRouteOptimizationService(session)
            route_result = await route_service.optimize_for_date(
                target_date=result['target_date'],
                delivery_ids=result['delivery_ids']
            )
            result['routes_optimized'] = route_result.get('success', False)
            result['route_count'] = len(route_result.get('routes', []))
        
        return format_response(
            data=result,
            message=f"Schedule applied successfully. Created {result.get('deliveries_created', 0)} deliveries."
        )
        
    except Exception as e:
        logger.error(f"Error applying schedule: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/modify/{schedule_id}", response_model=ResponseMessage)
async def modify_schedule(
    schedule_id: str,
    modifications: Dict[str, Any],
    session: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Authentication to be added later
):
    """
    Modify an existing schedule
    
    Allows:
    - Moving deliveries between time slots
    - Adding/removing deliveries
    - Changing driver/vehicle assignments
    - Adjusting priorities
    """
    try:
        scheduling_service = CloudSchedulingService(session)
        
        result = await scheduling_service.modify_schedule(
            schedule_id=schedule_id,
            modifications=modifications
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Failed to modify schedule'))
        
        return format_response(
            data=result,
            message="Schedule modified successfully"
        )
        
    except Exception as e:
        logger.error(f"Error modifying schedule: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cancel/{schedule_id}", response_model=ResponseMessage)
async def cancel_schedule(
    schedule_id: str,
    cascade: bool = Query(False, description="Cancel all related deliveries"),
    session: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Authentication to be added later
):
    """
    Cancel a schedule
    
    Options:
    - Cascade: Also cancel all deliveries created from this schedule
    - Keep deliveries but mark schedule as cancelled
    """
    try:
        scheduling_service = CloudSchedulingService(session)
        
        result = await scheduling_service.cancel_schedule(
            schedule_id=schedule_id,
            cascade=cascade
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Failed to cancel schedule'))
        
        return format_response(
            data=result,
            message=f"Schedule cancelled. {'Deliveries also cancelled.' if cascade else 'Deliveries retained.'}"
        )
        
    except Exception as e:
        logger.error(f"Error cancelling schedule: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/availability", response_model=ResponseMessage)
async def check_availability(
    check_date: date = Query(..., description="Date to check availability"),
    resource_type: Optional[str] = Query(None, description="drivers, vehicles, or all"),
    session: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Authentication to be added later
):
    """
    Check resource availability for scheduling
    
    Returns:
    - Available drivers with working hours
    - Available vehicles with capacity
    - Time slot availability
    - Existing commitments
    """
    try:
        scheduling_service = CloudSchedulingService(session)
        
        availability = await scheduling_service.check_resource_availability(
            target_date=check_date,
            resource_type=resource_type or 'all'
        )
        
        return format_response(
            data=availability,
            message=f"Availability checked for {check_date}"
        )
        
    except Exception as e:
        logger.error(f"Error checking availability: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/predictions", response_model=ResponseMessage)
async def get_demand_predictions(
    start_date: date = Query(..., description="Start date for predictions"),
    end_date: Optional[date] = Query(None, description="End date (default: 7 days)"),
    client_ids: Optional[List[int]] = Query(None, description="Specific clients to predict"),
    session: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Authentication to be added later
):
    """
    Get demand predictions for scheduling
    
    Uses AI to predict:
    - Expected orders by client
    - Cylinder type requirements
    - Optimal delivery timing
    - Confidence scores
    """
    try:
        if not end_date:
            end_date = start_date + timedelta(days=7)
        
        scheduling_service = CloudSchedulingService(session)
        
        predictions = await scheduling_service.get_demand_predictions(
            start_date=start_date,
            end_date=end_date,
            client_ids=client_ids
        )
        
        return format_response(
            data=predictions,
            message=f"Predictions generated for {start_date} to {end_date}"
        )
        
    except Exception as e:
        logger.error(f"Error getting predictions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics", response_model=ResponseMessage)
async def get_scheduling_analytics(
    start_date: date = Query(..., description="Start date for analytics"),
    end_date: date = Query(..., description="End date for analytics"),
    metrics: Optional[List[str]] = Query(None, description="Specific metrics to include"),
    session: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Authentication to be added later
):
    """
    Get scheduling performance analytics
    
    Metrics include:
    - Schedule adherence rates
    - Time slot utilization
    - Prediction accuracy
    - Resource utilization
    - Cost analysis
    """
    try:
        scheduling_service = CloudSchedulingService(session)
        
        analytics = await scheduling_service.get_scheduling_analytics(
            start_date=start_date,
            end_date=end_date,
            metrics=metrics
        )
        
        return format_response(
            data=analytics,
            message=f"Analytics generated for {start_date} to {end_date}"
        )
        
    except Exception as e:
        logger.error(f"Error getting analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Include router in main API
def include_router(app):
    """Include scheduling router in main application"""
    app.include_router(router)