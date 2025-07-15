"""Route planning API endpoints"""
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
import logging
import time
import json

from core.database import get_db
from models.database_schema import Route, Driver, Vehicle, Delivery, Client, DeliveryStatus
from domain.services.route_optimizer import RouteOptimizationService
import services.routing  # Import to register optimizers
from services.driver_service import DriverService
from services.vehicle_service import VehicleService
from api.schemas.route import (
    RoutePlanRequest,
    RouteCreateRequest,
    RouteUpdateRequest,
    RouteResponse,
    RouteListResponse,
    RouteOptimizationResult,
    RouteMapData,
    RoutePointResponse
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/routes", tags=["routes"])


def parse_route_details(route: Route) -> List[RoutePointResponse]:
    """Parse route details JSON into RoutePointResponse objects"""
    if not route.route_details:
        return []
    
    try:
        details = json.loads(route.route_details)
        points = []
        
        for point_data in details.get('points', []):
            # Get client info for additional details
            client = route.driver.db.query(Client).filter(
                Client.id == point_data['client_id']
            ).first()
            
            if client:
                time_windows = []
                # Parse time windows from client hours
                for hour in range(8, 20):
                    attr_name = f'hour_{hour}_{hour+1}'
                    if hasattr(client, attr_name) and getattr(client, attr_name):
                        time_windows.append({"start": hour, "end": hour + 1})
                
                point = RoutePointResponse(
                    client_id=point_data['client_id'],
                    client_name=client.short_name or client.invoice_title,
                    client_code=client.client_code,
                    address=client.address,
                    latitude=point_data.get('lat', client.latitude),
                    longitude=point_data.get('lng', client.longitude),
                    sequence=point_data['sequence'],
                    estimated_arrival=datetime.fromisoformat(point_data['estimated_arrival']),
                    service_time=15,  # Default service time
                    distance_from_previous=point_data.get('distance_from_previous'),
                    time_windows=time_windows
                )
                points.append(point)
        
        return points
    except Exception as e:
        logger.error(f"Error parsing route details: {str(e)}")
        return []


@router.post("/plan", response_model=RouteOptimizationResult)
async def plan_routes(
    request: RoutePlanRequest,
    db: Session = Depends(get_db)
):
    """
    Generate optimized routes for a given date
    
    - **date**: Target date for route planning
    - **area**: Optional area filter
    - **vehicle_ids**: Optional list of available vehicles
    - **driver_ids**: Optional list of available drivers
    """
    try:
        start_time = time.time()
        
        # Initialize services
        # Configure route optimization service
        config = {
            'default_optimizer': 'cloud' if request.use_advanced_optimization else 'simple',
            'constraints': {
                'max_route_distance': request.max_route_distance_km or 200,
                'max_deliveries_per_route': request.max_deliveries_per_route or 20
            }
        }
        route_service = RouteOptimizationService(db, config)
        driver_service = DriverService(db)
        vehicle_service = VehicleService(db)
        
        # Get available resources
        if request.vehicle_ids:
            vehicles = db.query(Vehicle).filter(
                and_(
                    Vehicle.id.in_(request.vehicle_ids),
                    Vehicle.is_active == True,
                    Vehicle.is_available == True
                )
            ).all()
        else:
            vehicles = vehicle_service.get_available_vehicles()
        
        if request.driver_ids:
            drivers = db.query(Driver).filter(
                and_(
                    Driver.id.in_(request.driver_ids),
                    Driver.is_active == True,
                    Driver.is_available == True
                )
            ).all()
        else:
            drivers = driver_service.get_available_drivers()
        
        if not vehicles:
            raise HTTPException(status_code=400, detail="沒有可用的車輛")
        
        if not drivers:
            raise HTTPException(status_code=400, detail="沒有可用的司機")
        
        # Get deliveries for the date
        deliveries = db.query(Delivery).filter(
            Delivery.scheduled_date == request.delivery_date,
            Delivery.status.in_([DeliveryStatus.PENDING, DeliveryStatus.SCHEDULED])
        ).all()
        
        # Convert to format expected by optimizer
        delivery_data = []
        for delivery in deliveries:
            if delivery.client:
                delivery_data.append({
                    'id': delivery.id,
                    'client_id': delivery.client_id,
                    'cylinder_type': delivery.cylinder_type or '20kg',
                    'quantity': delivery.quantity or 1,
                    'priority': getattr(delivery.client, 'priority', 1.0),
                    'address': delivery.client.address
                })
        
        # Optimize routes using unified service
        optimization_result = await route_service.optimize_routes(
            date=request.delivery_date,
            deliveries=delivery_data,
            optimization_mode=request.optimization_objective or 'balanced'
        )
        
        if not optimization_result.success:
            raise HTTPException(
                status_code=500,
                detail=f"Route optimization failed: {', '.join(optimization_result.errors)}"
            )
        
        # Convert optimizer results to database routes
        routes = []
        for opt_route in optimization_result.routes:
            # Create route in database
            route = Route(
                driver_id=opt_route['driver']['id'],
                vehicle_id=opt_route['vehicle']['id'],
                route_date=request.delivery_date,
                status='optimized',
                total_clients=len(opt_route['deliveries']),
                total_distance_km=opt_route.get('total_distance', 0),
                estimated_duration_minutes=opt_route.get('estimated_duration', 0),
                is_optimized=True,
                optimization_score=0.8,
                route_details=json.dumps({
                    'points': opt_route['deliveries'],
                    'optimization_method': optimization_result.metrics.get('optimization_method', 'simple')
                }),
                created_at=datetime.now()
            )
            db.add(route)
            db.flush()
            
            # Update delivery assignments
            for delivery_info in opt_route['deliveries']:
                delivery = next(
                    (d for d in deliveries if d.client_id == delivery_info['client_id']),
                    None
                )
                if delivery:
                    delivery.route_id = route.id
                    delivery.status = DeliveryStatus.ASSIGNED
                    delivery.driver_id = route.driver_id
                    delivery.vehicle_id = route.vehicle_id
            
            routes.append(route)
        
        db.commit()
        
        # Calculate optimization metrics
        optimization_time = time.time() - start_time
        
        # Convert routes to response format
        route_responses = []
        for route in routes:
            driver = db.query(Driver).filter(Driver.id == route.driver_id).first()
            vehicle = db.query(Vehicle).filter(Vehicle.id == route.vehicle_id).first()
            
            route_response = RouteResponse(
                id=route.id,
                route_date=route.route_date,
                route_name=route.route_name,
                area=route.area,
                driver_id=route.driver_id,
                driver_name=driver.name if driver else None,
                vehicle_id=route.vehicle_id,
                vehicle_plate=vehicle.plate_number if vehicle else None,
                vehicle_type=vehicle.vehicle_type.name.lower() if vehicle and vehicle.vehicle_type else None,
                total_clients=route.total_clients,
                total_distance_km=route.total_distance_km,
                estimated_duration_minutes=route.estimated_duration_minutes,
                is_optimized=route.is_optimized,
                optimization_score=route.optimization_score,
                created_at=route.created_at,
                updated_at=route.updated_at,
                route_points=parse_route_details(route)
            )
            route_responses.append(route_response)
        
        # Get unassigned deliveries
        unassigned = []
        if optimization_result.metrics.get('unassigned_deliveries', 0) > 0:
            # Find which deliveries were not assigned
            assigned_client_ids = set()
            for route in routes:
                if route.route_details:
                    details = json.loads(route.route_details)
                    for point in details.get('points', []):
                        assigned_client_ids.add(point['client_id'])
            
            # Get unassigned deliveries
            for delivery in deliveries:
                if delivery.client_id not in assigned_client_ids:
                    client = delivery.client
                    if client:
                        unassigned.append({
                            'client_id': client.id,
                            'client_code': client.client_code,
                            'name': client.short_name or client.invoice_title,
                            'address': client.address,
                            'priority': getattr(client, 'priority', 1.0)
                        })
        
        result = RouteOptimizationResult(
            success=True,
            message=f"成功生成 {len(routes)} 條優化路線",
            routes=route_responses,
            total_routes=len(routes),
            optimization_time_seconds=optimization_time,
            unassigned_clients=unassigned if unassigned else None,
            warnings=["部分客戶未能分配到路線"] if unassigned else None
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Route planning failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"路線規劃失敗: {str(e)}")


@router.get("", response_model=RouteListResponse)
async def get_routes(
    skip: int = Query(0, ge=0, description="跳過筆數"),
    limit: int = Query(20, ge=1, le=100, description="每頁筆數"),
    start_date: Optional[date] = Query(None, description="開始日期"),
    end_date: Optional[date] = Query(None, description="結束日期"),
    area: Optional[str] = Query(None, description="區域"),
    driver_id: Optional[int] = Query(None, description="司機ID"),
    db: Session = Depends(get_db)
):
    """Get paginated list of routes"""
    try:
        query = db.query(Route)
        
        # Apply filters
        if start_date:
            query = query.filter(Route.route_date >= start_date)
        if end_date:
            query = query.filter(Route.route_date <= end_date)
        if area:
            query = query.filter(Route.area == area)
        if driver_id:
            query = query.filter(Route.driver_id == driver_id)
        
        # Get total count
        total = query.count()
        
        # Get paginated results
        routes = query.order_by(Route.route_date.desc(), Route.id.desc()) \
                     .offset(skip) \
                     .limit(limit) \
                     .all()
        
        # Convert to response format
        items = []
        for route in routes:
            driver = db.query(Driver).filter(Driver.id == route.driver_id).first()
            vehicle = db.query(Vehicle).filter(Vehicle.id == route.vehicle_id).first()
            
            items.append(RouteResponse(
                id=route.id,
                route_date=route.route_date,
                route_name=route.route_name,
                area=route.area,
                driver_id=route.driver_id,
                driver_name=driver.name if driver else None,
                vehicle_id=route.vehicle_id,
                vehicle_plate=vehicle.plate_number if vehicle else None,
                vehicle_type=vehicle.vehicle_type.name.lower() if vehicle and vehicle.vehicle_type else None,
                total_clients=route.total_clients,
                total_distance_km=route.total_distance_km,
                estimated_duration_minutes=route.estimated_duration_minutes,
                is_optimized=route.is_optimized,
                optimization_score=route.optimization_score,
                created_at=route.created_at,
                updated_at=route.updated_at
            ))
        
        return RouteListResponse(
            items=items,
            total=total,
            page=skip // limit + 1,
            page_size=limit,
            total_pages=(total + limit - 1) // limit
        )
        
    except Exception as e:
        logger.error(f"Failed to get routes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"查詢失敗: {str(e)}")


@router.get("/{route_id}", response_model=RouteResponse)
async def get_route(
    route_id: int = Path(..., description="路線ID"),
    db: Session = Depends(get_db)
):
    """Get route details by ID"""
    try:
        route = db.query(Route).filter(Route.id == route_id).first()
        
        if not route:
            raise HTTPException(status_code=404, detail="找不到指定的路線")
        
        driver = db.query(Driver).filter(Driver.id == route.driver_id).first()
        vehicle = db.query(Vehicle).filter(Vehicle.id == route.vehicle_id).first()
        
        # Parse route details with proper database session
        route.driver.db = db  # Temporary fix for session access
        route_points = parse_route_details(route)
        
        return RouteResponse(
            id=route.id,
            route_date=route.route_date,
            route_name=route.route_name,
            area=route.area,
            driver_id=route.driver_id,
            driver_name=driver.name if driver else None,
            vehicle_id=route.vehicle_id,
            vehicle_plate=vehicle.plate_number if vehicle else None,
            vehicle_type=vehicle.vehicle_type.name.lower() if vehicle and vehicle.vehicle_type else None,
            total_clients=route.total_clients,
            total_distance_km=route.total_distance_km,
            estimated_duration_minutes=route.estimated_duration_minutes,
            is_optimized=route.is_optimized,
            optimization_score=route.optimization_score,
            created_at=route.created_at,
            updated_at=route.updated_at,
            route_points=route_points
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get route {route_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"查詢失敗: {str(e)}")


@router.get("/{route_id}/map", response_model=RouteMapData)
async def get_route_map_data(
    route_id: int = Path(..., description="路線ID"),
    db: Session = Depends(get_db)
):
    """Get map visualization data for a route"""
    try:
        route = db.query(Route).filter(Route.id == route_id).first()
        
        if not route:
            raise HTTPException(status_code=404, detail="找不到指定的路線")
        
        # Parse route details
        waypoints = []
        markers = []
        
        if route.route_details:
            details = json.loads(route.route_details)
            
            for idx, point in enumerate(details.get('points', [])):
                client = db.query(Client).filter(Client.id == point['client_id']).first()
                
                if client and point.get('lat') and point.get('lng'):
                    waypoint = [point['lat'], point['lng']]
                    waypoints.append(waypoint)
                    
                    marker = {
                        'id': client.id,
                        'position': waypoint,
                        'title': client.short_name or client.invoice_title,
                        'address': client.address,
                        'sequence': point['sequence'],
                        'estimated_arrival': point['estimated_arrival'],
                        'type': 'delivery'
                    }
                    markers.append(marker)
        
        # Calculate map center
        if waypoints:
            center_lat = sum(p[0] for p in waypoints) / len(waypoints)
            center_lng = sum(p[1] for p in waypoints) / len(waypoints)
        else:
            # Default to Taitung city center
            center_lat = 22.7553
            center_lng = 121.1504
        
        # Get area boundary (simplified)
        area_boundary = None
        if route.area == 'A-瑞光':
            area_boundary = [
                [22.73, 121.12], [22.73, 121.18],
                [22.78, 121.18], [22.78, 121.12],
                [22.73, 121.12]
            ]
        
        return RouteMapData(
            route_id=route.id,
            center_lat=center_lat,
            center_lng=center_lng,
            zoom_level=13,
            waypoints=waypoints,
            markers=markers,
            area_boundary=area_boundary
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get route map data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"查詢失敗: {str(e)}")


@router.post("", response_model=RouteResponse)
async def create_route(
    request: RouteCreateRequest,
    db: Session = Depends(get_db)
):
    """Create a new route manually"""
    try:
        # Validate driver and vehicle
        driver = db.query(Driver).filter(Driver.id == request.driver_id).first()
        if not driver or not driver.is_active:
            raise HTTPException(status_code=400, detail="司機不可用")
        
        vehicle = db.query(Vehicle).filter(Vehicle.id == request.vehicle_id).first()
        if not vehicle or not vehicle.is_active:
            raise HTTPException(status_code=400, detail="車輛不可用")
        
        # Build route details
        route_details = {
            'points': []
        }
        
        total_distance = 0.0
        total_duration = 0
        
        for point in request.route_points:
            client = db.query(Client).filter(Client.id == point.client_id).first()
            if not client:
                raise HTTPException(
                    status_code=400, 
                    detail=f"找不到客戶 ID: {point.client_id}"
                )
            
            route_details['points'].append({
                'client_id': point.client_id,
                'name': client.short_name or client.invoice_title,
                'address': client.address,
                'lat': client.latitude or 0,
                'lng': client.longitude or 0,
                'sequence': point.sequence,
                'estimated_arrival': point.estimated_arrival.isoformat()
            })
            
            if point.distance_from_previous:
                total_distance += point.distance_from_previous
            total_duration += point.service_time
        
        # Create route
        route = Route(
            route_date=request.route_date,
            route_name=request.route_name,
            area=request.area,
            driver_id=request.driver_id,
            vehicle_id=request.vehicle_id,
            total_clients=len(request.route_points),
            total_distance_km=total_distance,
            estimated_duration_minutes=total_duration,
            is_optimized=False,  # Manual route
            route_details=json.dumps(route_details, ensure_ascii=False)
        )
        
        db.add(route)
        
        # Create deliveries
        for point in request.route_points:
            delivery = Delivery(
                client_id=point.client_id,
                scheduled_date=request.route_date,
                driver_id=request.driver_id,
                vehicle_id=request.vehicle_id,
                status=DeliveryStatus.ASSIGNED,
                route_sequence=point.sequence,
                estimated_duration_minutes=point.service_time
            )
            db.add(delivery)
        
        db.commit()
        db.refresh(route)
        
        return RouteResponse(
            id=route.id,
            route_date=route.route_date,
            route_name=route.route_name,
            area=route.area,
            driver_id=route.driver_id,
            driver_name=driver.name,
            vehicle_id=route.vehicle_id,
            vehicle_plate=vehicle.plate_number,
            vehicle_type=vehicle.vehicle_type.value,
            total_clients=route.total_clients,
            total_distance_km=route.total_distance_km,
            estimated_duration_minutes=route.estimated_duration_minutes,
            is_optimized=route.is_optimized,
            optimization_score=route.optimization_score,
            created_at=route.created_at,
            updated_at=route.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create route: {str(e)}")
        raise HTTPException(status_code=500, detail=f"建立失敗: {str(e)}")


@router.put("/{route_id}", response_model=RouteResponse)
async def update_route(
    route_id: int = Path(..., description="路線ID"),
    request: RouteUpdateRequest = ...,
    db: Session = Depends(get_db)
):
    """Update an existing route"""
    try:
        route = db.query(Route).filter(Route.id == route_id).first()
        
        if not route:
            raise HTTPException(status_code=404, detail="找不到指定的路線")
        
        # Update basic fields
        if request.route_name is not None:
            route.route_name = request.route_name
        
        if request.driver_id is not None:
            driver = db.query(Driver).filter(Driver.id == request.driver_id).first()
            if not driver or not driver.is_active:
                raise HTTPException(status_code=400, detail="司機不可用")
            route.driver_id = request.driver_id
        
        if request.vehicle_id is not None:
            vehicle = db.query(Vehicle).filter(Vehicle.id == request.vehicle_id).first()
            if not vehicle or not vehicle.is_active:
                raise HTTPException(status_code=400, detail="車輛不可用")
            route.vehicle_id = request.vehicle_id
        
        if request.is_optimized is not None:
            route.is_optimized = request.is_optimized
        
        # Update route points if provided
        if request.route_points is not None:
            # Rebuild route details
            route_details = {'points': []}
            total_distance = 0.0
            total_duration = 0
            
            for point in request.route_points:
                client = db.query(Client).filter(Client.id == point.client_id).first()
                if not client:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"找不到客戶 ID: {point.client_id}"
                    )
                
                route_details['points'].append({
                    'client_id': point.client_id,
                    'name': client.short_name or client.invoice_title,
                    'address': client.address,
                    'lat': client.latitude or 0,
                    'lng': client.longitude or 0,
                    'sequence': point.sequence,
                    'estimated_arrival': point.estimated_arrival.isoformat()
                })
                
                if point.distance_from_previous:
                    total_distance += point.distance_from_previous
                total_duration += point.service_time
            
            route.route_details = json.dumps(route_details, ensure_ascii=False)
            route.total_clients = len(request.route_points)
            route.total_distance_km = total_distance
            route.estimated_duration_minutes = total_duration
        
        route.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(route)
        
        driver = db.query(Driver).filter(Driver.id == route.driver_id).first()
        vehicle = db.query(Vehicle).filter(Vehicle.id == route.vehicle_id).first()
        
        return RouteResponse(
            id=route.id,
            route_date=route.route_date,
            route_name=route.route_name,
            area=route.area,
            driver_id=route.driver_id,
            driver_name=driver.name if driver else None,
            vehicle_id=route.vehicle_id,
            vehicle_plate=vehicle.plate_number if vehicle else None,
            vehicle_type=vehicle.vehicle_type.name.lower() if vehicle and vehicle.vehicle_type else None,
            total_clients=route.total_clients,
            total_distance_km=route.total_distance_km,
            estimated_duration_minutes=route.estimated_duration_minutes,
            is_optimized=route.is_optimized,
            optimization_score=route.optimization_score,
            created_at=route.created_at,
            updated_at=route.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update route: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新失敗: {str(e)}")


@router.delete("/{route_id}")
async def delete_route(
    route_id: int = Path(..., description="路線ID"),
    db: Session = Depends(get_db)
):
    """Delete a route and associated deliveries"""
    try:
        route = db.query(Route).filter(Route.id == route_id).first()
        
        if not route:
            raise HTTPException(status_code=404, detail="找不到指定的路線")
        
        # Check if route has completed deliveries
        completed_deliveries = db.query(Delivery).filter(
            and_(
                Delivery.scheduled_date == route.route_date,
                Delivery.driver_id == route.driver_id,
                Delivery.status == DeliveryStatus.COMPLETED
            )
        ).count()
        
        if completed_deliveries > 0:
            raise HTTPException(
                status_code=400, 
                detail="無法刪除已有完成配送的路線"
            )
        
        # Delete associated deliveries
        db.query(Delivery).filter(
            and_(
                Delivery.scheduled_date == route.route_date,
                Delivery.driver_id == route.driver_id,
                Delivery.status.in_([DeliveryStatus.PENDING, DeliveryStatus.ASSIGNED])
            )
        ).delete()
        
        # Delete route
        db.delete(route)
        db.commit()
        
        return {"message": f"成功刪除路線 ID: {route_id}"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete route: {str(e)}")
        raise HTTPException(status_code=500, detail=f"刪除失敗: {str(e)}")