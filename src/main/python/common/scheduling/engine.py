"""Main scheduling engine for LuckyGas delivery system."""
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, date, timedelta
import logging
from collections import defaultdict

from ..time_utils import (
    ScheduleEntry, SchedulingConflict, validate_schedule,
    calculate_schedule_metrics, detect_conflicts
)
from .models import (
    DeliveryRequest, DriverAvailability, VehicleInfo,
    SchedulingParameters, SchedulingResult, OptimizationObjective,
    DeliveryRoute, RouteSegment, SchedulingStats
)
from .algorithms import (
    SchedulingAlgorithm, GreedyScheduler, 
    GeneticScheduler, SimulatedAnnealingScheduler
)
from .constraints import (
    SchedulingConstraint, TimeWindowConstraint, CapacityConstraint,
    DriverAvailabilityConstraint, TravelTimeConstraint,
    MaxDeliveriesConstraint, WorkingHoursConstraint,
    GeographicClusteringConstraint
)
from .conflicts import ConflictResolver

logger = logging.getLogger(__name__)


class SchedulingEngine:
    """Main scheduling engine that orchestrates the scheduling process."""
    
    def __init__(self):
        """Initialize scheduling engine."""
        self.algorithms = {
            'greedy': GreedyScheduler(),
            'genetic': GeneticScheduler(),
            'simulated_annealing': SimulatedAnnealingScheduler()
        }
        self.default_algorithm = 'greedy'
    
    def generate_schedule(self,
                         delivery_requests: List[DeliveryRequest],
                         driver_availability: List[DriverAvailability],
                         vehicle_info: List[VehicleInfo],
                         parameters: Optional[SchedulingParameters] = None,
                         algorithm: Optional[str] = None) -> SchedulingResult:
        """
        Generate optimized schedule for deliveries.
        
        Args:
            delivery_requests: List of delivery requests
            driver_availability: List of available drivers
            vehicle_info: List of available vehicles
            parameters: Scheduling parameters (optional)
            algorithm: Algorithm to use (optional)
            
        Returns:
            SchedulingResult with optimized schedule
        """
        # Use defaults if not provided
        if not parameters:
            parameters = SchedulingParameters(
                date=date.today(),
                optimization_objectives=[
                    OptimizationObjective.MINIMIZE_DISTANCE,
                    OptimizationObjective.MAXIMIZE_TIME_COMPLIANCE
                ]
            )
        
        algorithm_name = algorithm or self.default_algorithm
        
        if algorithm_name not in self.algorithms:
            logger.warning(f"Unknown algorithm {algorithm_name}, using {self.default_algorithm}")
            algorithm_name = self.default_algorithm
        
        logger.info(f"Generating schedule using {algorithm_name} algorithm")
        logger.info(f"Processing {len(delivery_requests)} deliveries with {len(driver_availability)} drivers")
        
        # Build constraints
        constraints = self._build_constraints(
            delivery_requests, driver_availability, vehicle_info, parameters
        )
        
        # Run scheduling algorithm
        scheduler = self.algorithms[algorithm_name]
        result = scheduler.schedule(
            delivery_requests, driver_availability, parameters, constraints
        )
        
        # Post-process schedule
        if result.success and result.schedule:
            # Resolve conflicts if any
            if result.conflicts:
                result = self._resolve_conflicts(
                    result, delivery_requests, driver_availability
                )
            
            # Generate routes
            routes = self._generate_routes(result.schedule, parameters.date)
            result.metrics['routes'] = len(routes)
            
            # Calculate statistics
            stats = self._calculate_statistics(
                result, delivery_requests, driver_availability
            )
            result.metrics['statistics'] = stats.__dict__
        
        logger.info(f"Schedule generated: {result.metrics.get('scheduled_deliveries', 0)}/{len(delivery_requests)} deliveries scheduled")
        
        return result
    
    def optimize_existing_schedule(self,
                                 current_schedule: List[ScheduleEntry],
                                 parameters: SchedulingParameters,
                                 algorithm: str = 'simulated_annealing') -> SchedulingResult:
        """
        Optimize an existing schedule.
        
        Args:
            current_schedule: Current schedule to optimize
            parameters: Scheduling parameters
            algorithm: Optimization algorithm to use
            
        Returns:
            Optimized SchedulingResult
        """
        logger.info(f"Optimizing existing schedule with {len(current_schedule)} entries")
        
        # Extract delivery requests from current schedule
        delivery_requests = []
        driver_ids = set()
        
        for entry in current_schedule:
            # Create delivery request from schedule entry
            request = DeliveryRequest(
                delivery_id=entry.delivery_id,
                client_id=entry.client_id,
                location=entry.location,
                time_windows=[(
                    entry.time_slot.start_time - timedelta(hours=2),
                    entry.time_slot.end_time + timedelta(hours=2)
                )],
                service_duration=entry.service_duration,
                cylinder_type="standard",  # Default
                quantity=1,
                priority=entry.priority
            )
            delivery_requests.append(request)
            driver_ids.add(entry.driver_id)
        
        # Create driver availability
        driver_availability = []
        for driver_id in driver_ids:
            availability = DriverAvailability(
                driver_id=driver_id,
                employee_id=f"EMP{driver_id}",
                name=f"Driver {driver_id}",
                available_hours=[(
                    datetime.combine(parameters.date, datetime.min.time()),
                    datetime.combine(parameters.date, datetime.max.time())
                )],
                max_deliveries=25
            )
            driver_availability.append(availability)
        
        # Run optimization
        return self.generate_schedule(
            delivery_requests, driver_availability, [], parameters, algorithm
        )
    
    def _build_constraints(self,
                         delivery_requests: List[DeliveryRequest],
                         driver_availability: List[DriverAvailability],
                         vehicle_info: List[VehicleInfo],
                         parameters: SchedulingParameters) -> List[SchedulingConstraint]:
        """Build constraint list based on inputs."""
        constraints = []
        
        # Time window constraint
        time_windows = {req.delivery_id: req.time_windows for req in delivery_requests}
        constraints.append(TimeWindowConstraint(time_windows))
        
        # Driver availability constraint
        driver_hours = {
            driver.driver_id: driver.available_hours 
            for driver in driver_availability
        }
        constraints.append(DriverAvailabilityConstraint(driver_hours))
        
        # Travel time constraint
        constraints.append(TravelTimeConstraint(
            min_buffer_minutes=5,
            speed_kmh=parameters.travel_speed_kmh
        ))
        
        # Max deliveries constraint
        max_deliveries = {
            driver.driver_id: driver.max_deliveries
            for driver in driver_availability
        }
        constraints.append(MaxDeliveriesConstraint(max_deliveries))
        
        # Working hours constraint
        if not parameters.allow_overtime:
            constraints.append(WorkingHoursConstraint(max_hours_per_day=8.0))
        
        # Vehicle capacity constraint if vehicles provided
        if vehicle_info:
            vehicle_capacities = {
                v.vehicle_id: v.capacity for v in vehicle_info
            }
            delivery_demands = {
                req.delivery_id: (req.cylinder_type, req.quantity)
                for req in delivery_requests
            }
            constraints.append(CapacityConstraint(vehicle_capacities, delivery_demands))
        
        # Geographic clustering (soft constraint)
        constraints.append(GeographicClusteringConstraint(max_distance_between_deliveries=15.0))
        
        return constraints
    
    def _resolve_conflicts(self,
                         result: SchedulingResult,
                         delivery_requests: List[DeliveryRequest],
                         driver_availability: List[DriverAvailability]) -> SchedulingResult:
        """Resolve conflicts in the schedule."""
        logger.info(f"Resolving {len(result.conflicts)} conflicts")
        
        # Create resolver
        request_map = {req.delivery_id: req for req in delivery_requests}
        driver_map = {driver.driver_id: driver for driver in driver_availability}
        
        resolver = ConflictResolver(request_map, driver_map)
        
        # Attempt resolution
        resolved_schedule, remaining_conflicts = resolver.resolve_conflicts(
            result.schedule, result.conflicts
        )
        
        # Update result
        result.schedule = resolved_schedule
        result.conflicts = remaining_conflicts
        
        # Recalculate metrics
        result.metrics = calculate_schedule_metrics(resolved_schedule)
        result.metrics['conflicts_resolved'] = len(result.conflicts) - len(remaining_conflicts)
        
        if remaining_conflicts:
            logger.warning(f"Could not resolve {len(remaining_conflicts)} conflicts")
        
        return result
    
    def _generate_routes(self, 
                        schedule: List[ScheduleEntry],
                        schedule_date: date) -> List[DeliveryRoute]:
        """Generate delivery routes from schedule."""
        routes = []
        
        # Group by driver
        driver_schedules = defaultdict(list)
        for entry in schedule:
            driver_schedules[entry.driver_id].append(entry)
        
        for driver_id, entries in driver_schedules.items():
            # Sort by time
            sorted_entries = sorted(entries, key=lambda e: e.time_slot.start_time)
            
            if not sorted_entries:
                continue
            
            # Create route
            route = DeliveryRoute(
                driver_id=driver_id,
                vehicle_id=sorted_entries[0].vehicle_id,
                date=schedule_date,
                segments=[],
                total_distance=0.0,
                total_time=0,
                total_deliveries=len(sorted_entries),
                start_time=sorted_entries[0].time_slot.start_time,
                end_time=sorted_entries[-1].end_time
            )
            
            # Add segments
            for i, entry in enumerate(sorted_entries):
                if i > 0 and sorted_entries[i-1].location and entry.location:
                    # Travel segment
                    from ..time_utils import calculate_travel_time
                    travel_time = calculate_travel_time(
                        sorted_entries[i-1].location,
                        entry.location
                    )
                    
                    segment = RouteSegment(
                        from_location=sorted_entries[i-1].location,
                        to_location=entry.location,
                        departure_time=sorted_entries[i-1].end_time,
                        arrival_time=entry.time_slot.start_time,
                        distance_km=(travel_time / 60) * 30,  # Approximate
                        travel_time_minutes=travel_time
                    )
                    route.add_segment(segment)
                
                # Delivery segment
                if entry.location:
                    segment = RouteSegment(
                        from_location=entry.location,
                        to_location=entry.location,
                        departure_time=entry.time_slot.start_time,
                        arrival_time=entry.end_time,
                        distance_km=0,
                        travel_time_minutes=0,
                        delivery_id=entry.delivery_id
                    )
                    route.segments.append(segment)
            
            routes.append(route)
        
        return routes
    
    def _calculate_statistics(self,
                            result: SchedulingResult,
                            delivery_requests: List[DeliveryRequest],
                            driver_availability: List[DriverAvailability]) -> SchedulingStats:
        """Calculate scheduling statistics."""
        scheduled_ids = {e.delivery_id for e in result.schedule}
        unscheduled = [r for r in delivery_requests if r.delivery_id not in scheduled_ids]
        
        driver_loads = defaultdict(int)
        driver_distances = defaultdict(float)
        
        for entry in result.schedule:
            driver_loads[entry.driver_id] += 1
        
        # Calculate average metrics
        avg_deliveries = sum(driver_loads.values()) / len(driver_loads) if driver_loads else 0
        avg_distance = result.metrics.get('total_distance', 0) / len(driver_loads) if driver_loads else 0
        
        total_service_time = sum(e.service_duration for e in result.schedule)
        avg_time_per_delivery = total_service_time / len(result.schedule) if result.schedule else 0
        
        # Time window compliance
        compliant = len(result.schedule) - len([c for c in result.conflicts 
                                               if c.conflict_type.value == 'time_window_violation'])
        compliance_rate = compliant / len(result.schedule) if result.schedule else 0
        
        return SchedulingStats(
            total_requests=len(delivery_requests),
            scheduled_requests=len(result.schedule),
            unscheduled_requests=len(unscheduled),
            total_drivers=len(driver_availability),
            active_drivers=len(driver_loads),
            total_vehicles=len(driver_loads),  # Simplified
            average_deliveries_per_driver=avg_deliveries,
            average_distance_per_driver=avg_distance,
            average_time_per_delivery=avg_time_per_delivery,
            time_window_compliance_rate=compliance_rate,
            conflicts_count=len(result.conflicts),
            computation_time=result.computation_time
        )
    
    def validate_schedule(self,
                        schedule: List[ScheduleEntry],
                        constraints: Optional[List[SchedulingConstraint]] = None) -> Tuple[bool, List[str]]:
        """
        Validate a schedule against constraints.
        
        Args:
            schedule: Schedule to validate
            constraints: Optional list of constraints
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        return validate_schedule(schedule, constraints)
    
    def get_schedule_metrics(self, schedule: List[ScheduleEntry]) -> Dict[str, Any]:
        """
        Get metrics for a schedule.
        
        Args:
            schedule: Schedule to analyze
            
        Returns:
            Dictionary of metrics
        """
        return calculate_schedule_metrics(schedule)
    
    def detect_schedule_conflicts(self, schedule: List[ScheduleEntry]) -> List[SchedulingConflict]:
        """
        Detect conflicts in a schedule.
        
        Args:
            schedule: Schedule to check
            
        Returns:
            List of conflicts
        """
        return detect_conflicts(schedule)