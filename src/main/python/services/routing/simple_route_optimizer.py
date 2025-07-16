"""
Simple route optimizer implementation
Uses nearest neighbor algorithm for basic route optimization
"""
from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging
import numpy as np

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from domain.services.route_optimizer import IRouteOptimizer, OptimizationRequest, OptimizationResult
from services.route_optimization_service import RouteOptimizationService as LegacyRouteService
from models.database_schema import Route, DeliveryStatus
from common.geo_utils import calculate_haversine_distance

logger = logging.getLogger(__name__)


class SimpleRouteOptimizer(IRouteOptimizer):
    """
    Simple route optimizer using nearest neighbor algorithm
    Wraps the existing RouteOptimizationService for backward compatibility
    """
    
    def __init__(self, session: Any, config: Dict[str, Any]):
        self.session = session
        self.config = config
        self.legacy_service = LegacyRouteService(session)
        
    async def optimize(self, request: OptimizationRequest) -> OptimizationResult:
        """Optimize routes using nearest neighbor algorithm"""
        try:
            # Convert request to legacy format
            client_deliveries = self._convert_deliveries_to_legacy(request.deliveries)
            
            # Use legacy service to create delivery points
            delivery_points = await self.legacy_service.prepare_deliveries(
                client_deliveries,
                request.date
            )
            
            if not delivery_points:
                return OptimizationResult(
                    success=False,
                    routes=[],
                    metrics={},
                    errors=["No valid delivery points found"],
                    optimization_time=0
                )
            
            # Build distance matrix
            distance_matrix = self._build_distance_matrix(delivery_points)
            
            # Optimize routes using nearest neighbor
            routes = []
            unassigned = list(range(len(delivery_points)))
            route_id = 1
            
            # Assign drivers and vehicles
            driver_idx = 0
            vehicle_idx = 0
            
            while unassigned and driver_idx < len(request.drivers):
                driver = request.drivers[driver_idx]
                vehicle = request.vehicles[vehicle_idx] if vehicle_idx < len(request.vehicles) else None
                
                if not vehicle:
                    break
                
                # Create route for this driver/vehicle
                route_points = []
                current_idx = unassigned[0]  # Start with first unassigned
                route_points.append(current_idx)
                unassigned.remove(current_idx)
                
                # Add points using nearest neighbor
                while unassigned and len(route_points) < 15:  # Max 15 deliveries per route
                    nearest_idx = self._find_nearest(
                        current_idx,
                        unassigned,
                        distance_matrix
                    )
                    
                    if nearest_idx >= 0:
                        route_points.append(nearest_idx)
                        unassigned.remove(nearest_idx)
                        current_idx = nearest_idx
                
                # Create route result
                route_deliveries = [delivery_points[idx] for idx in route_points]
                total_distance = self._calculate_route_distance(
                    route_points,
                    distance_matrix
                )
                
                route = {
                    'id': route_id,
                    'driver': driver,
                    'vehicle': vehicle,
                    'deliveries': [
                        {
                            'client_id': dp.client_id,
                            'client_name': dp.name,
                            'address': dp.address,
                            'lat': dp.lat,
                            'lng': dp.lng,
                            'sequence': i + 1
                        }
                        for i, dp in enumerate(route_deliveries)
                    ],
                    'total_distance': total_distance,
                    'estimated_duration': total_distance * 3,  # 3 min per km estimate
                    'status': 'optimized'
                }
                
                routes.append(route)
                route_id += 1
                driver_idx += 1
                vehicle_idx += 1
            
            # Calculate metrics
            metrics = {
                'total_routes': len(routes),
                'total_deliveries': sum(len(r['deliveries']) for r in routes),
                'unassigned_deliveries': len(unassigned),
                'total_distance': sum(r['total_distance'] for r in routes),
                'average_route_distance': sum(r['total_distance'] for r in routes) / len(routes) if routes else 0,
                'optimization_method': 'nearest_neighbor'
            }
            
            return OptimizationResult(
                success=True,
                routes=routes,
                metrics=metrics,
                errors=[],
                optimization_time=0  # Will be set by service
            )
            
        except Exception as e:
            logger.error(f"Simple route optimization failed: {str(e)}")
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
            'name': 'Simple Route Optimizer',
            'algorithm': 'Nearest Neighbor',
            'max_deliveries': 200,
            'supports_time_windows': True,
            'supports_vehicle_capacity': True,
            'supports_traffic': False,
            'supports_multi_depot': False,
            'average_optimization_time': '< 1 second'
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
        
        if len(request.deliveries) > 200:
            errors.append("Too many deliveries (max 200)")
        
        return len(errors) == 0, errors
    
    def _convert_deliveries_to_legacy(
        self,
        deliveries: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Convert modern delivery format to legacy format"""
        return [
            {
                'client_id': d.get('client_id'),
                'priority_score': d.get('priority', 1.0),
                'cylinder_type': d.get('cylinder_type', '20kg'),
                'quantity': d.get('quantity', 1)
            }
            for d in deliveries
        ]
    
    def _build_distance_matrix(
        self,
        delivery_points: List[Any]
    ) -> np.ndarray:
        """Build distance matrix between all delivery points"""
        n = len(delivery_points)
        matrix = np.zeros((n, n))
        
        for i in range(n):
            for j in range(n):
                if i != j:
                    distance = calculate_haversine_distance(
                        delivery_points[i].lat,
                        delivery_points[i].lng,
                        delivery_points[j].lat,
                        delivery_points[j].lng
                    )
                    matrix[i][j] = distance
        
        return matrix
    
    def _find_nearest(
        self,
        current_idx: int,
        unassigned: List[int],
        distance_matrix: np.ndarray
    ) -> int:
        """Find nearest unassigned point"""
        min_distance = float('inf')
        nearest_idx = -1
        
        for idx in unassigned:
            distance = distance_matrix[current_idx][idx]
            if distance < min_distance:
                min_distance = distance
                nearest_idx = idx
        
        return nearest_idx
    
    def _calculate_route_distance(
        self,
        route_points: List[int],
        distance_matrix: np.ndarray
    ) -> float:
        """Calculate total distance for a route"""
        if len(route_points) < 2:
            return 0
        
        total_distance = 0
        for i in range(len(route_points) - 1):
            total_distance += distance_matrix[route_points[i]][route_points[i + 1]]
        
        return round(total_distance, 2)