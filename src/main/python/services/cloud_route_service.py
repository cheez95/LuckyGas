"""
Cloud-based route optimization service
Uses Google OR-Tools and cloud mapping services for advanced route planning
"""

from datetime import datetime, timedelta, time, date
from typing import List, Dict, Tuple, Optional, Any
import logging
from dataclasses import dataclass
import numpy as np
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import asyncio
from sqlalchemy.orm import Session

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from models.database_schema import Client, Delivery, Driver, Vehicle, Route, DeliveryStatus, VehicleType
from integrations.google_maps_client import GoogleMapsClient, Location
from config.cloud_config import cloud_config
from common.geo_utils import calculate_haversine_distance
from common.time_utils import parse_client_time_windows, calculate_service_time
from common.vehicle_utils import calculate_required_vehicle_type

logger = logging.getLogger(__name__)


@dataclass
class DeliveryNode:
    """Represents a delivery point in route optimization"""
    delivery_id: int
    client_id: int
    location: Location
    demand: Dict[str, int]  # Cylinder demands by type
    service_time: int  # Minutes
    time_window: Tuple[int, int]  # Start and end time in minutes from midnight
    priority: float = 1.0
    vehicle_type_required: Optional[VehicleType] = None


@dataclass
class VehicleInfo:
    """Vehicle information for routing"""
    vehicle_id: int
    driver_id: int
    start_location: Location
    end_location: Optional[Location] = None  # If None, returns to start
    capacity: Dict[str, int] = None  # Capacity by cylinder type
    max_distance: float = 200.0  # km
    max_duration: int = 480  # minutes (8 hours)
    speed_factor: float = 1.0  # Speed multiplier
    cost_per_km: float = 10.0  # Cost per kilometer
    vehicle_type: VehicleType = VehicleType.CAR


@dataclass
class OptimizedRoute:
    """Result of route optimization"""
    vehicle_id: int
    driver_id: int
    delivery_sequence: List[int]  # Delivery IDs in order
    total_distance: float  # km
    total_duration: int  # minutes
    total_cost: float
    arrival_times: List[datetime]
    departure_times: List[datetime]
    route_polyline: str
    warnings: List[str] = None


class CloudRouteOptimizationService:
    """Advanced route optimization using cloud services and OR-Tools"""
    
    def __init__(self, session: Session):
        self.session = session
        self.maps_client = GoogleMapsClient()
        self.config = cloud_config.app_settings
        
    async def optimize_routes(
        self,
        delivery_date: datetime,
        vehicles: List[VehicleInfo],
        constraints: Optional[Dict[str, Any]] = None
    ) -> List[OptimizedRoute]:
        """
        Optimize routes for multiple vehicles on a given date
        
        Args:
            delivery_date: Date to optimize routes for
            vehicles: List of available vehicles with their info
            constraints: Additional constraints (area, time windows, etc.)
            
        Returns:
            List of optimized routes
        """
        try:
            # Get deliveries for the date
            deliveries = await self._get_pending_deliveries(delivery_date, constraints)
            
            if not deliveries:
                logger.info("No deliveries to optimize")
                return []
            
            # Geocode delivery addresses
            delivery_nodes = await self._prepare_delivery_nodes(deliveries)
            
            # Calculate distance/time matrix
            distance_matrix, time_matrix = await self._calculate_matrices(
                vehicles, delivery_nodes
            )
            
            # Run optimization
            solution = self._run_optimization(
                vehicles, delivery_nodes, distance_matrix, time_matrix
            )
            
            # Build optimized routes
            routes = await self._build_routes(
                solution, vehicles, delivery_nodes, distance_matrix, time_matrix
            )
            
            return routes
            
        except Exception as e:
            logger.error(f"Route optimization error: {e}")
            raise
    
    async def _get_pending_deliveries(
        self,
        delivery_date: datetime,
        constraints: Optional[Dict[str, Any]] = None
    ) -> List[Delivery]:
        """Get pending deliveries for optimization"""
        query = self.session.query(Delivery).join(Client).filter(
            Delivery.scheduled_date == delivery_date.date(),
            Delivery.status.in_([DeliveryStatus.PENDING, DeliveryStatus.ASSIGNED])
        )
        
        # Apply area constraint if specified
        if constraints and 'area' in constraints:
            query = query.filter(Client.area == constraints['area'])
        
        # Apply client priority if specified
        if constraints and 'priority_clients' in constraints:
            query = query.filter(Client.id.in_(constraints['priority_clients']))
        
        deliveries = query.all()
        logger.info(f"Found {len(deliveries)} deliveries to optimize")
        
        return deliveries
    
    async def _prepare_delivery_nodes(self, deliveries: List[Delivery]) -> List[DeliveryNode]:
        """Prepare delivery nodes with geocoded locations"""
        nodes = []
        
        # Geocode addresses in batch
        addresses = [d.client.address for d in deliveries]
        locations = await self.maps_client.geocode_batch_async(addresses)
        
        for delivery, location in zip(deliveries, locations):
            if not location:
                logger.warning(f"Failed to geocode address for delivery {delivery.id}")
                continue
            
            # Calculate time window
            start_time = self._time_to_minutes(delivery.scheduled_time_start or time(8, 0))
            end_time = self._time_to_minutes(delivery.scheduled_time_end or time(18, 0))
            
            # Calculate demand
            demand = {
                '50kg': delivery.delivered_50kg,
                '20kg': delivery.delivered_20kg,
                '16kg': delivery.delivered_16kg,
                '10kg': delivery.delivered_10kg,
                '4kg': delivery.delivered_4kg
            }
            
            node = DeliveryNode(
                delivery_id=delivery.id,
                client_id=delivery.client_id,
                location=location,
                demand=demand,
                service_time=15,  # Default 15 minutes per delivery
                time_window=(start_time, end_time),
                priority=getattr(delivery.client, 'priority', 1.0),
                vehicle_type_required=self._get_required_vehicle_type(demand)
            )
            nodes.append(node)
        
        logger.info(f"Prepared {len(nodes)} delivery nodes")
        return nodes
    
    async def _calculate_matrices(
        self,
        vehicles: List[VehicleInfo],
        nodes: List[DeliveryNode]
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Calculate distance and time matrices between all locations"""
        # Collect all locations (vehicle starts + delivery points)
        all_locations = []
        
        # Add vehicle start locations
        for vehicle in vehicles:
            all_locations.append(vehicle.start_location)
        
        # Add delivery locations
        for node in nodes:
            all_locations.append(node.location)
        
        n_locations = len(all_locations)
        distance_matrix = np.zeros((n_locations, n_locations), dtype=int)
        time_matrix = np.zeros((n_locations, n_locations), dtype=int)
        
        # Calculate matrices using Google Maps Distance Matrix API
        # Process in chunks to avoid API limits
        chunk_size = 10
        
        for i in range(0, n_locations, chunk_size):
            origins = all_locations[i:i+chunk_size]
            
            for j in range(0, n_locations, chunk_size):
                destinations = all_locations[j:j+chunk_size]
                
                matrix_result = self.maps_client.calculate_distance_matrix(
                    origins, destinations,
                    departure_time=datetime.now().replace(hour=8, minute=0)
                )
                
                if matrix_result:
                    for oi, row in enumerate(matrix_result['matrix']):
                        for di, element in enumerate(row):
                            if 'distance_meters' in element:
                                distance_matrix[i+oi][j+di] = element['distance_meters'] // 1000  # Convert to km
                                time_matrix[i+oi][j+di] = element['duration_in_traffic_seconds'] // 60  # Convert to minutes
                            else:
                                # Set high values for impossible routes
                                distance_matrix[i+oi][j+di] = 999999
                                time_matrix[i+oi][j+di] = 999999
        
        logger.info(f"Calculated {n_locations}x{n_locations} distance/time matrices")
        return distance_matrix, time_matrix
    
    def _run_optimization(
        self,
        vehicles: List[VehicleInfo],
        nodes: List[DeliveryNode],
        distance_matrix: np.ndarray,
        time_matrix: np.ndarray
    ) -> Any:
        """Run OR-Tools optimization algorithm"""
        # Create routing model
        n_vehicles = len(vehicles)
        n_locations = len(vehicles) + len(nodes)  # Vehicle starts + deliveries
        depot_indices = list(range(n_vehicles))  # First n indices are depots
        
        manager = pywrapcp.RoutingIndexManager(
            n_locations,
            n_vehicles,
            depot_indices,
            depot_indices  # Vehicles return to their start location
        )
        
        routing = pywrapcp.RoutingModel(manager)
        
        # Create distance callback
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int(distance_matrix[from_node][to_node])
        
        distance_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(distance_callback_index)
        
        # Create time callback
        def time_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int(time_matrix[from_node][to_node])
        
        time_callback_index = routing.RegisterTransitCallback(time_callback)
        
        # Add time dimension
        routing.AddDimension(
            time_callback_index,
            30,  # Allow 30 minutes waiting time
            [v.max_duration for v in vehicles],  # Maximum time per vehicle
            False,  # Don't force start cumul to zero
            'Time'
        )
        
        time_dimension = routing.GetDimensionOrDie('Time')
        
        # Add time window constraints
        for i, node in enumerate(nodes):
            index = manager.NodeToIndex(n_vehicles + i)
            time_dimension.CumulVar(index).SetRange(node.time_window[0], node.time_window[1])
        
        # Add capacity constraints for each cylinder type
        for cylinder_type in ['50kg', '20kg', '16kg', '10kg', '4kg']:
            def demand_callback(from_index):
                from_node = manager.IndexToNode(from_index)
                if from_node < n_vehicles:
                    return 0  # Depots have no demand
                node = nodes[from_node - n_vehicles]
                return node.demand.get(cylinder_type, 0)
            
            demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
            
            capacities = [v.capacity.get(cylinder_type, 0) for v in vehicles]
            
            routing.AddDimensionWithVehicleCapacity(
                demand_callback_index,
                0,  # No slack
                capacities,
                True,  # Start cumul to zero
                f'Capacity_{cylinder_type}'
            )
        
        # Add distance constraint
        routing.AddDimension(
            distance_callback_index,
            0,  # No slack
            [int(v.max_distance) for v in vehicles],
            True,
            'Distance'
        )
        
        # Set search parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.AUTOMATIC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = self.config['max_route_calculation_time']
        
        # Solve
        solution = routing.SolveWithParameters(search_parameters)
        
        if solution:
            logger.info(f"Optimization completed. Total cost: {solution.ObjectiveValue()}")
        else:
            logger.warning("No solution found")
        
        return solution
    
    async def _build_routes(
        self,
        solution: Any,
        vehicles: List[VehicleInfo],
        nodes: List[DeliveryNode],
        distance_matrix: np.ndarray,
        time_matrix: np.ndarray
    ) -> List[OptimizedRoute]:
        """Build optimized routes from OR-Tools solution"""
        if not solution:
            return []
        
        manager = solution.manager
        routing = solution.routing
        routes = []
        
        for vehicle_idx in range(len(vehicles)):
            vehicle = vehicles[vehicle_idx]
            index = routing.Start(vehicle_idx)
            
            delivery_sequence = []
            arrival_times = []
            departure_times = []
            route_distance = 0
            route_duration = 0
            
            # Extract route
            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                
                if node_index >= len(vehicles):  # Not a depot
                    delivery_node = nodes[node_index - len(vehicles)]
                    delivery_sequence.append(delivery_node.delivery_id)
                    
                    # Calculate arrival/departure times
                    time_var = solution.Min(routing.GetDimensionOrDie('Time').CumulVar(index))
                    arrival_time = datetime.now().replace(hour=0, minute=0) + timedelta(minutes=time_var)
                    departure_time = arrival_time + timedelta(minutes=delivery_node.service_time)
                    
                    arrival_times.append(arrival_time)
                    departure_times.append(departure_time)
                
                next_index = solution.Value(routing.NextVar(index))
                route_distance += distance_matrix[node_index][manager.IndexToNode(next_index)]
                route_duration += time_matrix[node_index][manager.IndexToNode(next_index)]
                
                index = next_index
            
            if delivery_sequence:  # Only create route if it has deliveries
                # Get route polyline from Google Maps
                waypoints = [nodes[d-1].location for d in delivery_sequence]
                route_result = self.maps_client.calculate_route(
                    vehicle.start_location,
                    vehicle.start_location,  # Return to start
                    waypoints=waypoints,
                    optimize_waypoints=False  # Keep OR-Tools order
                )
                
                route = OptimizedRoute(
                    vehicle_id=vehicle.vehicle_id,
                    driver_id=vehicle.driver_id,
                    delivery_sequence=delivery_sequence,
                    total_distance=route_distance,
                    total_duration=route_duration,
                    total_cost=route_distance * vehicle.cost_per_km,
                    arrival_times=arrival_times,
                    departure_times=departure_times,
                    route_polyline=route_result['overview_polyline'] if route_result else '',
                    warnings=[]
                )
                
                routes.append(route)
                
                logger.info(
                    f"Route for vehicle {vehicle.vehicle_id}: "
                    f"{len(delivery_sequence)} deliveries, "
                    f"{route_distance}km, {route_duration}min"
                )
        
        return routes
    
    def _time_to_minutes(self, t: time) -> int:
        """Convert time to minutes from midnight"""
        return t.hour * 60 + t.minute
    
    def _get_required_vehicle_type(self, demand: Dict[str, int]) -> VehicleType:
        """Determine required vehicle type based on demand"""
        # Use shared utility to calculate vehicle requirements
        deliveries = [{'cylinder_type': k, 'quantity': v} for k, v in demand.items()]
        vehicle_type_needed = calculate_required_vehicle_type(deliveries)
        
        # Map our vehicle utilities types to database VehicleType
        # Since database only has CAR and MOTORCYCLE, we map accordingly
        from common.vehicle_utils import VehicleType as UtilVehicleType
        
        if vehicle_type_needed in [UtilVehicleType.SMALL, UtilVehicleType.MEDIUM]:
            return VehicleType.MOTORCYCLE if sum(demand.values()) <= 5 else VehicleType.CAR
        else:
            # For LARGE and EXTRA_LARGE, always use CAR
            return VehicleType.CAR
    
    async def recalculate_route(
        self,
        route_id: int,
        current_location: Location,
        completed_deliveries: List[int]
    ) -> OptimizedRoute:
        """
        Recalculate route from current position (dynamic re-routing)
        
        Args:
            route_id: Current route ID
            current_location: Current vehicle location
            completed_deliveries: List of already completed delivery IDs
            
        Returns:
            Updated optimized route
        """
        # Get original route
        route = self.session.query(Route).filter(Route.id == route_id).first()
        if not route:
            raise ValueError(f"Route {route_id} not found")
        
        # Get remaining deliveries
        remaining_deliveries = []
        for delivery in route.deliveries:
            if delivery.id not in completed_deliveries:
                remaining_deliveries.append(delivery)
        
        if not remaining_deliveries:
            logger.info("No remaining deliveries")
            return None
        
        # Create vehicle info with current location as start
        vehicle_info = VehicleInfo(
            vehicle_id=route.vehicle_id,
            driver_id=route.driver_id,
            start_location=current_location,
            capacity={'50kg': 50, '20kg': 100, '16kg': 100, '10kg': 200, '4kg': 300},
            max_distance=100,  # Reduced for remaining route
            max_duration=300   # Reduced for remaining route
        )
        
        # Re-optimize for remaining deliveries
        nodes = await self._prepare_delivery_nodes(remaining_deliveries)
        
        # Simple nearest neighbor for quick re-routing
        optimized_sequence = self._nearest_neighbor_route(current_location, nodes)
        
        # Calculate route details
        route_result = self.maps_client.calculate_route(
            current_location,
            vehicle_info.start_location,  # Return to depot
            waypoints=[nodes[i].location for i in optimized_sequence]
        )
        
        if route_result:
            return OptimizedRoute(
                vehicle_id=vehicle_info.vehicle_id,
                driver_id=vehicle_info.driver_id,
                delivery_sequence=[nodes[i].delivery_id for i in optimized_sequence],
                total_distance=route_result['total_distance_meters'] / 1000,
                total_duration=route_result['total_duration_in_traffic_seconds'] / 60,
                total_cost=0,  # Recalculated routes don't affect cost
                arrival_times=[],  # Would need to calculate based on current time
                departure_times=[],
                route_polyline=route_result['overview_polyline'],
                warnings=['Route recalculated due to deviation']
            )
        
        return None
    
    def _nearest_neighbor_route(
        self,
        start: Location,
        nodes: List[DeliveryNode]
    ) -> List[int]:
        """Simple nearest neighbor algorithm for quick routing"""
        unvisited = list(range(len(nodes)))
        sequence = []
        current = start
        
        while unvisited:
            # Find nearest unvisited node
            min_dist = float('inf')
            nearest = -1
            
            for idx in unvisited:
                dist = calculate_haversine_distance(
                    current.lat, current.lng,
                    nodes[idx].location.lat, nodes[idx].location.lng
                )
                
                if dist < min_dist:
                    min_dist = dist
                    nearest = idx
            
            if nearest >= 0:
                sequence.append(nearest)
                current = nodes[nearest].location
                unvisited.remove(nearest)
        
        return sequence
    
    async def preview_routes_for_schedule(
        self,
        schedule_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Preview routes for a given schedule"""
        routes = []
        
        # Extract deliveries from all time slots
        all_deliveries = []
        for slot in schedule_data.get('time_slots', []):
            all_deliveries.extend(slot.get('deliveries', []))
        
        if not all_deliveries:
            return routes
        
        # Group deliveries by area or some logical grouping
        delivery_groups = {}
        for delivery in all_deliveries:
            area = delivery.get('area', 'default')
            if area not in delivery_groups:
                delivery_groups[area] = []
            delivery_groups[area].append(delivery)
        
        # Create preview routes for each group
        route_id = 1
        for area, deliveries in delivery_groups.items():
            route = {
                'route_id': f"preview_{route_id}",
                'area': area,
                'deliveries': deliveries,
                'estimated_distance': len(deliveries) * 5.5,  # Rough estimate
                'estimated_duration': len(deliveries) * 15,  # 15 min per delivery
                'driver': f"Driver {route_id}",
                'vehicle': f"Vehicle {route_id}",
                'optimization_status': 'preview'
            }
            routes.append(route)
            route_id += 1
        
        return routes
    
    async def optimize_for_date(
        self,
        target_date: date,
        delivery_ids: List[int]
    ) -> Dict[str, Any]:
        """Optimize routes for deliveries on a specific date"""
        try:
            # Get deliveries
            deliveries = self.session.query(Delivery).filter(
                Delivery.id.in_(delivery_ids)
            ).all()
            
            if not deliveries:
                return {'success': False, 'error': 'No deliveries found'}
            
            # Get available drivers and vehicles
            drivers = self.session.query(Driver).filter(
                Driver.is_active == True
            ).all()
            
            vehicles = self.session.query(Vehicle).filter(
                Vehicle.is_active == True
            ).all()
            
            # Prepare optimization request
            # In a real implementation, this would call the full optimization
            # For now, create simple routes
            routes_created = []
            deliveries_per_route = 10
            
            for i in range(0, len(deliveries), deliveries_per_route):
                route_deliveries = deliveries[i:i+deliveries_per_route]
                driver = drivers[i % len(drivers)] if drivers else None
                vehicle = vehicles[i % len(vehicles)] if vehicles else None
                
                if not driver or not vehicle:
                    continue
                
                # Create route
                route = Route(
                    driver_id=driver.id,
                    vehicle_id=vehicle.id,
                    route_date=target_date,
                    status='planned',
                    created_at=datetime.now()
                )
                self.session.add(route)
                self.session.flush()
                
                # Assign deliveries to route
                for delivery in route_deliveries:
                    delivery.route_id = route.id
                    delivery.status = DeliveryStatus.ASSIGNED
                
                routes_created.append(route)
            
            self.session.commit()
            
            return {
                'success': True,
                'routes': [
                    {
                        'id': r.id,
                        'driver_id': r.driver_id,
                        'vehicle_id': r.vehicle_id,
                        'delivery_count': len([d for d in deliveries if d.route_id == r.id])
                    }
                    for r in routes_created
                ]
            }
            
        except Exception as e:
            logger.error(f"Error optimizing routes: {str(e)}")
            self.session.rollback()
            return {'success': False, 'error': str(e)}
    
