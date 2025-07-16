"""Advanced scheduling API endpoints"""
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import logging

from core.database import get_db
from models.database_schema import Client, Driver, Vehicle, Delivery, DeliveryStatus, Route
from common.scheduling.engine import SchedulingEngine
from common.scheduling.models import (
    DeliveryRequest, DriverAvailability, VehicleInfo,
    SchedulingParameters, OptimizationObjective,
    SchedulingResult
)
from common.time_utils import parse_client_time_windows
from api.schemas.base import ResponseMessage
from pydantic import BaseModel, Field


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scheduling", tags=["advanced-scheduling"])


class SchedulingRequest(BaseModel):
    """Request model for advanced scheduling"""
    schedule_date: date = Field(..., description="Date to schedule deliveries")
    optimization_objectives: List[str] = Field(
        default=["minimize_distance", "maximize_time_compliance"],
        description="Optimization objectives"
    )
    algorithm: Optional[str] = Field(
        default="greedy",
        description="Algorithm to use: greedy, genetic, simulated_annealing"
    )
    max_iterations: Optional[int] = Field(default=1000, description="Max optimization iterations")
    time_limit_seconds: Optional[int] = Field(default=300, description="Time limit for optimization")
    allow_overtime: Optional[bool] = Field(default=False, description="Allow driver overtime")
    travel_speed_kmh: Optional[float] = Field(default=30.0, description="Average travel speed")
    
    # Filters
    area: Optional[str] = Field(None, description="Filter by area")
    client_ids: Optional[List[int]] = Field(None, description="Specific clients to schedule")
    driver_ids: Optional[List[int]] = Field(None, description="Available drivers")
    vehicle_ids: Optional[List[int]] = Field(None, description="Available vehicles")
    
    # Advanced options
    service_time_buffer: Optional[float] = Field(default=1.1, description="Service time buffer multiplier")
    min_deliveries_per_route: Optional[int] = Field(default=5, description="Minimum deliveries per route")
    max_deliveries_per_route: Optional[int] = Field(default=20, description="Maximum deliveries per route")


class SchedulingResponse(BaseModel):
    """Response model for scheduling results"""
    success: bool
    message: str
    schedule_date: date
    algorithm_used: str
    computation_time: float
    
    # Metrics
    total_deliveries: int
    scheduled_deliveries: int
    unscheduled_deliveries: int
    total_routes: int
    total_distance: float
    average_utilization: float
    conflicts_count: int
    
    # Schedule details
    routes: List[Dict] = Field(default_factory=list)
    unscheduled_clients: List[Dict] = Field(default_factory=list)
    conflicts: List[Dict] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


@router.post("/generate", response_model=SchedulingResponse)
async def generate_schedule(
    request: SchedulingRequest,
    db: Session = Depends(get_db)
):
    """
    Generate optimized schedule using advanced algorithms
    
    - Uses constraint-based scheduling with multiple optimization objectives
    - Supports different algorithms: greedy (fast), genetic (optimal), simulated annealing (balanced)
    - Handles time windows, capacity constraints, and driver availability
    - Provides conflict detection and resolution
    """
    try:
        logger.info(f"Generating schedule for {request.schedule_date} using {request.algorithm}")
        
        # Get pending deliveries
        query = db.query(Delivery).filter(
            and_(
                Delivery.scheduled_date == request.schedule_date,
                Delivery.status.in_([DeliveryStatus.PENDING, DeliveryStatus.SCHEDULED])
            )
        )
        
        if request.area:
            query = query.join(Client).filter(Client.area == request.area)
        
        if request.client_ids:
            query = query.filter(Delivery.client_id.in_(request.client_ids))
        
        deliveries = query.all()
        
        if not deliveries:
            return SchedulingResponse(
                success=True,
                message="No deliveries to schedule",
                schedule_date=request.schedule_date,
                algorithm_used=request.algorithm,
                computation_time=0.0,
                total_deliveries=0,
                scheduled_deliveries=0,
                unscheduled_deliveries=0,
                total_routes=0,
                total_distance=0.0,
                average_utilization=0.0,
                conflicts_count=0
            )
        
        # Convert deliveries to scheduling requests
        delivery_requests = []
        for delivery in deliveries:
            client = delivery.client
            if not client:
                continue
            
            # Parse client time windows
            time_windows = parse_client_time_windows(client)
            
            # Convert to datetime windows for the specific date
            datetime_windows = []
            for start_time, end_time in time_windows:
                datetime_windows.append((
                    datetime.combine(request.schedule_date, start_time),
                    datetime.combine(request.schedule_date, end_time)
                ))
            
            # Calculate service time
            from common.time_utils import calculate_service_time
            service_duration = calculate_service_time(
                delivery.cylinder_type or "20kg",
                delivery.quantity or 1,
                "commercial" if client.client_type == "business" else "residential"
            )
            
            delivery_request = DeliveryRequest(
                delivery_id=delivery.id,
                client_id=client.id,
                location=(client.latitude or 22.7553, client.longitude or 121.1504),
                time_windows=datetime_windows,
                service_duration=service_duration,
                cylinder_type=delivery.cylinder_type or "20kg",
                quantity=delivery.quantity or 1,
                priority=getattr(client, 'priority', 1),
                special_requirements=[]
            )
            delivery_requests.append(delivery_request)
        
        # Get available drivers
        driver_query = db.query(Driver).filter(
            and_(
                Driver.is_active == True,
                Driver.is_available == True
            )
        )
        
        if request.driver_ids:
            driver_query = driver_query.filter(Driver.id.in_(request.driver_ids))
        
        drivers = driver_query.all()
        
        if not drivers:
            raise HTTPException(status_code=400, detail="No available drivers")
        
        # Convert to driver availability
        driver_availability = []
        for driver in drivers:
            # Assume full day availability for now
            availability = DriverAvailability(
                driver_id=driver.id,
                employee_id=driver.employee_id,
                name=driver.name,
                available_hours=[
                    (datetime.combine(request.schedule_date, datetime.min.time()).replace(hour=8),
                     datetime.combine(request.schedule_date, datetime.min.time()).replace(hour=18))
                ],
                current_location=(22.7553, 121.1504),  # Default location
                max_deliveries=request.max_deliveries_per_route or 20,
                skills=[],
                vehicle_id=None
            )
            driver_availability.append(availability)
        
        # Get available vehicles
        vehicle_query = db.query(Vehicle).filter(
            and_(
                Vehicle.is_active == True,
                Vehicle.is_available == True
            )
        )
        
        if request.vehicle_ids:
            vehicle_query = vehicle_query.filter(Vehicle.id.in_(request.vehicle_ids))
        
        vehicles = vehicle_query.all()
        
        # Convert to vehicle info
        vehicle_info = []
        for vehicle in vehicles:
            # Default capacities based on vehicle type
            capacity = {
                "16kg": 30,
                "20kg": 25,
                "50kg": 10
            }
            
            if vehicle.vehicle_type.name == "TRUCK":
                capacity = {"16kg": 50, "20kg": 40, "50kg": 15}
            elif vehicle.vehicle_type.name == "VAN":
                capacity = {"16kg": 30, "20kg": 25, "50kg": 10}
            
            info = VehicleInfo(
                vehicle_id=vehicle.id,
                plate_number=vehicle.plate_number,
                capacity=capacity,
                fuel_efficiency=10.0,
                max_distance=200.0,
                current_location=(22.7553, 121.1504)
            )
            vehicle_info.append(info)
        
        # Map string objectives to enum
        objective_map = {
            "minimize_distance": OptimizationObjective.MINIMIZE_DISTANCE,
            "maximize_time_compliance": OptimizationObjective.MAXIMIZE_TIME_COMPLIANCE,
            "balance_workload": OptimizationObjective.BALANCE_WORKLOAD,
            "minimize_overtime": OptimizationObjective.MINIMIZE_OVERTIME,
            "maximize_utilization": OptimizationObjective.MAXIMIZE_UTILIZATION
        }
        
        objectives = []
        for obj_str in request.optimization_objectives:
            if obj_str in objective_map:
                objectives.append(objective_map[obj_str])
        
        if not objectives:
            objectives = [OptimizationObjective.MINIMIZE_DISTANCE]
        
        # Create scheduling parameters
        parameters = SchedulingParameters(
            date=request.schedule_date,
            optimization_objectives=objectives,
            max_iterations=request.max_iterations,
            time_limit_seconds=request.time_limit_seconds,
            allow_overtime=request.allow_overtime,
            travel_speed_kmh=request.travel_speed_kmh,
            service_time_buffer=request.service_time_buffer
        )
        
        # Run scheduling engine
        engine = SchedulingEngine()
        result = engine.generate_schedule(
            delivery_requests=delivery_requests,
            driver_availability=driver_availability,
            vehicle_info=vehicle_info,
            parameters=parameters,
            algorithm=request.algorithm
        )
        
        # Convert result to response
        routes = []
        if result.schedule:
            # Group by driver/vehicle
            from collections import defaultdict
            driver_routes = defaultdict(list)
            
            for entry in result.schedule:
                driver_routes[entry.driver_id].append(entry)
            
            for driver_id, entries in driver_routes.items():
                driver = next(d for d in drivers if d.id == driver_id)
                
                # Sort entries by time
                sorted_entries = sorted(entries, key=lambda e: e.time_slot.start_time)
                
                route_deliveries = []
                for entry in sorted_entries:
                    client = db.query(Client).filter(Client.id == entry.client_id).first()
                    route_deliveries.append({
                        "delivery_id": entry.delivery_id,
                        "client_id": entry.client_id,
                        "client_name": client.short_name or client.invoice_title if client else "",
                        "address": client.address if client else "",
                        "scheduled_time": entry.time_slot.start_time.isoformat(),
                        "service_duration": entry.service_duration,
                        "location": list(entry.location) if entry.location else None
                    })
                
                routes.append({
                    "driver_id": driver_id,
                    "driver_name": driver.name,
                    "vehicle_id": sorted_entries[0].vehicle_id,
                    "deliveries": route_deliveries,
                    "total_deliveries": len(route_deliveries),
                    "start_time": sorted_entries[0].time_slot.start_time.isoformat(),
                    "end_time": sorted_entries[-1].end_time.isoformat()
                })
        
        # Get unscheduled clients
        scheduled_delivery_ids = {e.delivery_id for e in result.schedule}
        unscheduled_clients = []
        
        for delivery in deliveries:
            if delivery.id not in scheduled_delivery_ids:
                client = delivery.client
                if client:
                    unscheduled_clients.append({
                        "client_id": client.id,
                        "client_name": client.short_name or client.invoice_title,
                        "address": client.address,
                        "reason": "Could not fit in schedule"
                    })
        
        # Format conflicts
        conflicts = []
        for conflict in result.conflicts:
            conflicts.append({
                "type": conflict.conflict_type.value,
                "description": conflict.description,
                "severity": conflict.severity,
                "affected_deliveries": [e.delivery_id for e in conflict.entries]
            })
        
        # Prepare warnings
        warnings = []
        if result.conflicts:
            warnings.append(f"{len(result.conflicts)} scheduling conflicts detected")
        if unscheduled_clients:
            warnings.append(f"{len(unscheduled_clients)} clients could not be scheduled")
        if result.metrics.get('average_utilization', 0) < 50:
            warnings.append("Low driver utilization - consider reducing number of drivers")
        
        response = SchedulingResponse(
            success=result.success,
            message=result.error_message or f"Successfully scheduled {len(result.schedule)} deliveries",
            schedule_date=request.schedule_date,
            algorithm_used=result.algorithm_used,
            computation_time=result.computation_time,
            total_deliveries=len(delivery_requests),
            scheduled_deliveries=len(result.schedule),
            unscheduled_deliveries=len(unscheduled_clients),
            total_routes=len(routes),
            total_distance=result.metrics.get('total_distance', 0),
            average_utilization=result.metrics.get('average_utilization', 0),
            conflicts_count=len(result.conflicts),
            routes=routes,
            unscheduled_clients=unscheduled_clients,
            conflicts=conflicts,
            warnings=warnings
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Schedule generation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Schedule generation failed: {str(e)}")


@router.post("/apply", response_model=ResponseMessage)
async def apply_schedule(
    schedule_date: date = Body(..., description="Date of schedule to apply"),
    route_data: List[Dict] = Body(..., description="Route data from scheduling"),
    db: Session = Depends(get_db)
):
    """
    Apply generated schedule to create routes and update deliveries
    
    Takes the output from /generate endpoint and creates actual routes in the database
    """
    try:
        created_routes = 0
        
        for route_info in route_data:
            # Create route record
            route = Route(
                driver_id=route_info['driver_id'],
                vehicle_id=route_info['vehicle_id'],
                route_date=schedule_date,
                route_name=f"{route_info['driver_name']} - {schedule_date}",
                total_clients=route_info['total_deliveries'],
                is_optimized=True,
                optimization_score=0.9,  # High score for advanced scheduling
                created_at=datetime.now()
            )
            
            # Build route details
            route_details = {'points': []}
            total_distance = 0.0
            
            for idx, delivery_info in enumerate(route_info['deliveries']):
                client = db.query(Client).filter(
                    Client.id == delivery_info['client_id']
                ).first()
                
                if client:
                    route_details['points'].append({
                        'client_id': client.id,
                        'name': client.short_name or client.invoice_title,
                        'address': client.address,
                        'lat': client.latitude or 0,
                        'lng': client.longitude or 0,
                        'sequence': idx + 1,
                        'estimated_arrival': delivery_info['scheduled_time']
                    })
                    
                    # Update delivery
                    delivery = db.query(Delivery).filter(
                        Delivery.id == delivery_info['delivery_id']
                    ).first()
                    
                    if delivery:
                        delivery.driver_id = route.driver_id
                        delivery.vehicle_id = route.vehicle_id
                        delivery.status = DeliveryStatus.ASSIGNED
                        delivery.route_sequence = idx + 1
                        delivery.estimated_arrival_time = datetime.fromisoformat(
                            delivery_info['scheduled_time']
                        )
            
            import json
            route.route_details = json.dumps(route_details, ensure_ascii=False)
            route.total_distance_km = total_distance
            
            db.add(route)
            created_routes += 1
        
        db.commit()
        
        return ResponseMessage(
            success=True,
            message=f"Successfully created {created_routes} routes",
            data={
                "routes_created": created_routes,
                "schedule_date": str(schedule_date)
            }
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to apply schedule: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to apply schedule: {str(e)}")


@router.get("/conflicts/{schedule_date}")
async def get_schedule_conflicts(
    schedule_date: date,
    db: Session = Depends(get_db)
):
    """
    Detect conflicts in existing schedule for a date
    
    Analyzes current routes and deliveries to identify:
    - Time overlaps
    - Capacity violations
    - Travel time issues
    - Driver availability conflicts
    """
    try:
        # Get all routes for the date
        routes = db.query(Route).filter(
            Route.route_date == schedule_date
        ).all()
        
        if not routes:
            return {
                "schedule_date": schedule_date,
                "conflicts": [],
                "message": "No routes found for this date"
            }
        
        # Build schedule entries from routes
        from common.time_utils import ScheduleEntry, TimeSlot, detect_conflicts
        schedule_entries = []
        
        for route in routes:
            if not route.route_details:
                continue
                
            import json
            details = json.loads(route.route_details)
            
            for point in details.get('points', []):
                if 'estimated_arrival' in point:
                    # Create schedule entry
                    arrival = datetime.fromisoformat(point['estimated_arrival'])
                    
                    entry = ScheduleEntry(
                        delivery_id=0,  # Not tracked in route details
                        client_id=point['client_id'],
                        driver_id=route.driver_id,
                        vehicle_id=route.vehicle_id,
                        time_slot=TimeSlot(
                            start_time=arrival,
                            end_time=arrival + timedelta(minutes=15)  # Default service time
                        ),
                        service_duration=15,
                        location=(point.get('lat'), point.get('lng')) if point.get('lat') else None
                    )
                    schedule_entries.append(entry)
        
        # Detect conflicts
        conflicts = detect_conflicts(schedule_entries)
        
        # Format conflicts for response
        conflict_list = []
        for conflict in conflicts:
            conflict_list.append({
                "type": conflict.conflict_type.value,
                "description": conflict.description,
                "severity": conflict.severity,
                "suggestions": conflict.resolution_suggestions,
                "affected_clients": [e.client_id for e in conflict.entries]
            })
        
        return {
            "schedule_date": schedule_date,
            "total_routes": len(routes),
            "total_deliveries": len(schedule_entries),
            "conflicts": conflict_list,
            "conflict_count": len(conflict_list)
        }
        
    except Exception as e:
        logger.error(f"Failed to get conflicts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to analyze conflicts: {str(e)}")


@router.get("/metrics/{schedule_date}")
async def get_schedule_metrics(
    schedule_date: date,
    db: Session = Depends(get_db)
):
    """
    Get performance metrics for scheduled routes
    
    Returns:
    - Total distance
    - Driver utilization
    - Time window compliance
    - Workload balance
    """
    try:
        # Get all routes for the date
        routes = db.query(Route).filter(
            Route.route_date == schedule_date
        ).all()
        
        if not routes:
            return {
                "schedule_date": schedule_date,
                "metrics": {},
                "message": "No routes found for this date"
            }
        
        # Calculate metrics
        total_distance = sum(r.total_distance_km or 0 for r in routes)
        total_deliveries = sum(r.total_clients or 0 for r in routes)
        
        # Driver utilization
        driver_stats = {}
        for route in routes:
            if route.driver_id not in driver_stats:
                driver_stats[route.driver_id] = {
                    'deliveries': 0,
                    'distance': 0,
                    'duration': 0
                }
            
            driver_stats[route.driver_id]['deliveries'] += route.total_clients or 0
            driver_stats[route.driver_id]['distance'] += route.total_distance_km or 0
            driver_stats[route.driver_id]['duration'] += route.estimated_duration_minutes or 0
        
        # Calculate balance
        if driver_stats:
            delivery_counts = [s['deliveries'] for s in driver_stats.values()]
            avg_deliveries = sum(delivery_counts) / len(delivery_counts)
            
            # Standard deviation
            variance = sum((x - avg_deliveries) ** 2 for x in delivery_counts) / len(delivery_counts)
            std_dev = variance ** 0.5
            
            # Balance score (0-100, higher is better)
            balance_score = max(0, 100 - (std_dev / avg_deliveries * 100)) if avg_deliveries > 0 else 100
        else:
            balance_score = 0
        
        # Average utilization (assuming 8-hour work day)
        avg_utilization = 0
        if driver_stats:
            total_work_minutes = sum(s['duration'] for s in driver_stats.values())
            available_minutes = len(driver_stats) * 8 * 60
            avg_utilization = (total_work_minutes / available_minutes * 100) if available_minutes > 0 else 0
        
        metrics = {
            "total_routes": len(routes),
            "total_deliveries": total_deliveries,
            "total_distance_km": total_distance,
            "average_distance_per_route": total_distance / len(routes) if routes else 0,
            "average_deliveries_per_route": total_deliveries / len(routes) if routes else 0,
            "driver_utilization_percent": min(100, avg_utilization),
            "workload_balance_score": balance_score,
            "drivers_used": len(driver_stats),
            "driver_statistics": driver_stats
        }
        
        return {
            "schedule_date": schedule_date,
            "metrics": metrics
        }
        
    except Exception as e:
        logger.error(f"Failed to get metrics: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to calculate metrics: {str(e)}")