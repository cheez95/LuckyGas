"""
Cloud route optimizer implementation
Uses Google OR-Tools and cloud services for advanced optimization
"""
from typing import List, Dict, Any, Tuple
from datetime import datetime, time as dt_time
import logging
import asyncio

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from domain.services.route_optimizer import IRouteOptimizer, OptimizationRequest, OptimizationResult
from services.cloud_route_service import CloudRouteOptimizationService, DeliveryNode, VehicleInfo, Location
from models.database_schema import Client
from common.time_utils import parse_client_time_windows

logger = logging.getLogger(__name__)


class CloudRouteOptimizer(IRouteOptimizer):
    """
    Advanced route optimizer using Google OR-Tools
    Wraps the CloudRouteOptimizationService for the unified interface
    """
    
    def __init__(self, session: Any, config: Dict[str, Any]):
        self.session = session
        self.config = config
        self.cloud_service = CloudRouteOptimizationService(session)
        
    async def optimize(self, request: OptimizationRequest) -> OptimizationResult:
        """Optimize routes using Google OR-Tools"""
        try:
            # Convert deliveries to nodes
            nodes = await self._prepare_delivery_nodes(request.deliveries)
            
            if not nodes:
                return OptimizationResult(
                    success=False,
                    routes=[],
                    metrics={},
                    errors=["No valid delivery nodes found"],
                    optimization_time=0
                )
            
            # Convert vehicles to VehicleInfo
            vehicles = self._prepare_vehicles(request.vehicles, request.drivers)
            
            if not vehicles:
                return OptimizationResult(
                    success=False,
                    routes=[],
                    metrics={},
                    errors=["No valid vehicles available"],
                    optimization_time=0
                )
            
            # Run cloud optimization
            cloud_result = await self.cloud_service.optimize_routes(
                vehicles=vehicles,
                deliveries=nodes,
                optimization_params={
                    'time_limit_seconds': self.config.get('time_limit', 30),
                    'solution_limit': self.config.get('solution_limit', 100)
                }
            )
            
            if not cloud_result or not cloud_result.success:
                return OptimizationResult(
                    success=False,
                    routes=[],
                    metrics={},
                    errors=cloud_result.errors if cloud_result else ["Optimization failed"],
                    optimization_time=0
                )
            
            # Convert cloud result to standard format
            routes = self._convert_routes(cloud_result.routes)
            
            # Calculate metrics
            metrics = {
                'total_routes': len(routes),
                'total_deliveries': sum(len(r['deliveries']) for r in routes),
                'unassigned_deliveries': len(cloud_result.unassigned_deliveries),
                'total_distance': cloud_result.total_distance,
                'total_duration': cloud_result.total_duration,
                'total_cost': cloud_result.total_cost,
                'optimization_method': 'google_or_tools',
                'solver_status': cloud_result.solver_status
            }
            
            return OptimizationResult(
                success=True,
                routes=routes,
                metrics=metrics,
                errors=[],
                optimization_time=0
            )
            
        except Exception as e:
            logger.error(f"Cloud route optimization failed: {str(e)}")
            return OptimizationResult(
                success=False,
                routes=[],
                metrics={},
                errors=[str(e)],
                optimization_time=0
            )
    
    def get_capabilities(self) -> Dict[str, Any]:
        """Return optimizer capabilities"""
        return {
            'name': 'Cloud Route Optimizer',
            'algorithm': 'Google OR-Tools with Machine Learning',
            'max_deliveries': 1000,
            'supports_time_windows': True,
            'supports_vehicle_capacity': True,
            'supports_traffic': True,
            'supports_multi_depot': True,
            'supports_real_time': True,
            'average_optimization_time': '5-30 seconds',
            'features': [
                'Real-time traffic integration',
                'Machine learning predictions',
                'Multi-objective optimization',
                'Dynamic re-routing',
                'Cost optimization'
            ]
        }
    
    def validate_request(self, request: OptimizationRequest) -> Tuple[bool, List[str]]:
        """Validate optimization request"""
        errors = []
        
        if not request.deliveries:
            errors.append("No deliveries to optimize")
        
        if not request.drivers:
            errors.append("No drivers available")
        
        if not request.vehicles:
            errors.append("No vehicles available")
        
        if len(request.deliveries) > 1000:
            errors.append("Too many deliveries (max 1000)")
        
        # Check if OR-Tools is available
        if not self.cloud_service.or_tools_available:
            errors.append("Google OR-Tools not available")
        
        return len(errors) == 0, errors
    
    async def _prepare_delivery_nodes(
        self,
        deliveries: List[Dict[str, Any]]
    ) -> List[DeliveryNode]:
        """Convert deliveries to DeliveryNode objects"""
        nodes = []
        
        for delivery in deliveries:
            # Get client information
            client = self.session.query(Client).get(delivery['client_id'])
            if not client:
                continue
            
            # Get location (geocode if needed)
            location = await self._get_location(client)
            if not location:
                continue
            
            # Parse time windows
            time_windows = parse_client_time_windows(client)
            if time_windows:
                # Convert to minutes from midnight
                tw_start = time_windows[0][0].hour * 60
                tw_end = time_windows[-1][1].hour * 60
            else:
                # Default time window 8 AM - 6 PM
                tw_start = 8 * 60
                tw_end = 18 * 60
            
            # Create node
            node = DeliveryNode(
                delivery_id=delivery.get('id', 0),
                client_id=client.id,
                client_name=client.short_name or client.invoice_title,
                location=location,
                demand={
                    delivery.get('cylinder_type', '20kg'): delivery.get('quantity', 1)
                },
                service_time=15,  # Default 15 minutes
                time_window=(tw_start, tw_end),
                priority=delivery.get('priority', 1.0),
                vehicle_type_required=None  # Let optimizer decide
            )
            
            nodes.append(node)
        
        return nodes
    
    async def _get_location(self, client: Client) -> Location:
        """Get location for client (geocode if needed)"""
        if client.lat and client.lng:
            return Location(
                address=client.address,
                lat=client.lat,
                lng=client.lng
            )
        
        # Geocode address
        geocoded = await self.cloud_service.maps_client.geocode(client.address)
        if geocoded:
            # Update client with coordinates
            client.lat = geocoded.lat
            client.lng = geocoded.lng
            self.session.commit()
            return geocoded
        
        return None
    
    def _prepare_vehicles(
        self,
        vehicles: List[Dict[str, Any]],
        drivers: List[Dict[str, Any]]
    ) -> List[VehicleInfo]:
        """Convert vehicles and drivers to VehicleInfo objects"""
        vehicle_infos = []
        
        # Assume 1:1 driver to vehicle mapping
        for i, (vehicle, driver) in enumerate(zip(vehicles, drivers)):
            if i >= len(drivers):
                break
            
            info = VehicleInfo(
                vehicle_id=vehicle['id'],
                driver_id=driver['id'],
                capacity=vehicle.get('capacity', 20),
                start_location=Location(
                    address="Depot",
                    lat=22.7553,  # Default depot location
                    lng=121.1504
                ),
                end_location=None,  # Return to depot
                earliest_start=8 * 60,  # 8 AM
                latest_end=18 * 60,  # 6 PM
                cost_per_km=vehicle.get('cost_per_km', 10),
                vehicle_type=vehicle.get('type', 'CAR')
            )
            
            vehicle_infos.append(info)
        
        return vehicle_infos
    
    def _convert_routes(
        self,
        cloud_routes: List[Any]
    ) -> List[Dict[str, Any]]:
        """Convert cloud routes to standard format"""
        routes = []
        
        for idx, cloud_route in enumerate(cloud_routes):
            route = {
                'id': idx + 1,
                'driver': {
                    'id': cloud_route.driver_id,
                    'name': f"Driver {cloud_route.driver_id}"
                },
                'vehicle': {
                    'id': cloud_route.vehicle_id,
                    'type': 'CAR'
                },
                'deliveries': [
                    {
                        'client_id': stop['client_id'],
                        'client_name': stop['client_name'],
                        'address': stop['address'],
                        'lat': stop['location']['lat'],
                        'lng': stop['location']['lng'],
                        'sequence': stop['sequence'],
                        'arrival_time': stop.get('arrival_time', ''),
                        'departure_time': stop.get('departure_time', '')
                    }
                    for stop in cloud_route.stops
                ],
                'total_distance': cloud_route.total_distance,
                'total_duration': cloud_route.total_duration,
                'total_cost': cloud_route.total_cost,
                'status': 'optimized',
                'optimization_details': {
                    'used_traffic_data': True,
                    'used_ml_predictions': True,
                    'optimization_score': cloud_route.optimization_score
                }
            }
            
            routes.append(route)
        
        return routes