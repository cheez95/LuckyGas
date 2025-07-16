"""Data models for scheduling system."""
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple, Any
from enum import Enum


class OptimizationObjective(Enum):
    """Optimization objectives for scheduling."""
    MINIMIZE_DISTANCE = "minimize_distance"
    MAXIMIZE_TIME_COMPLIANCE = "maximize_time_compliance"
    BALANCE_WORKLOAD = "balance_workload"
    MINIMIZE_OVERTIME = "minimize_overtime"
    MAXIMIZE_UTILIZATION = "maximize_utilization"


@dataclass
class DeliveryRequest:
    """Request for delivery scheduling."""
    delivery_id: int
    client_id: int
    location: Tuple[float, float]  # (lat, lon)
    time_windows: List[Tuple[datetime, datetime]]
    service_duration: int  # minutes
    cylinder_type: str
    quantity: int
    priority: int = 0
    special_requirements: List[str] = field(default_factory=list)
    preferred_driver_id: Optional[int] = None


@dataclass
class DriverAvailability:
    """Driver availability information."""
    driver_id: int
    employee_id: str
    name: str
    available_hours: List[Tuple[datetime, datetime]]
    current_location: Optional[Tuple[float, float]] = None
    max_deliveries: int = 20
    skills: List[str] = field(default_factory=list)
    vehicle_id: Optional[int] = None
    vehicle_capacity: Optional[Dict[str, int]] = None  # cylinder_type -> capacity


@dataclass
class VehicleInfo:
    """Vehicle information for scheduling."""
    vehicle_id: int
    plate_number: str
    capacity: Dict[str, int]  # cylinder_type -> max_quantity
    fuel_efficiency: float = 10.0  # km per liter
    max_distance: float = 200.0  # km per day
    current_location: Optional[Tuple[float, float]] = None


@dataclass
class SchedulingParameters:
    """Parameters for scheduling algorithm."""
    date: date
    optimization_objectives: List[OptimizationObjective]
    objective_weights: Dict[OptimizationObjective, float] = field(default_factory=dict)
    max_iterations: int = 1000
    time_limit_seconds: int = 300
    allow_overtime: bool = False
    overtime_penalty: float = 2.0
    travel_speed_kmh: float = 30.0
    service_time_buffer: float = 1.1  # 10% buffer
    
    def __post_init__(self):
        # Set default weights if not provided
        if not self.objective_weights:
            for obj in self.optimization_objectives:
                self.objective_weights[obj] = 1.0 / len(self.optimization_objectives)


@dataclass
class SchedulingResult:
    """Result of scheduling optimization."""
    schedule: List[Any]  # List of ScheduleEntry objects
    metrics: Dict[str, Any]
    conflicts: List[Any]  # List of SchedulingConflict objects
    optimization_score: float
    computation_time: float
    algorithm_used: str
    parameters_used: SchedulingParameters
    success: bool = True
    error_message: Optional[str] = None
    
    @property
    def is_feasible(self) -> bool:
        """Check if schedule is feasible (no hard constraint violations)."""
        return len([c for c in self.conflicts if c.severity >= 4]) == 0
    
    @property
    def total_distance(self) -> float:
        """Get total distance from metrics."""
        return self.metrics.get('total_distance', 0.0)
    
    @property
    def utilization_rate(self) -> float:
        """Get average utilization rate."""
        return self.metrics.get('average_utilization', 0.0)


@dataclass
class RouteSegment:
    """Segment of a delivery route."""
    from_location: Tuple[float, float]
    to_location: Tuple[float, float]
    departure_time: datetime
    arrival_time: datetime
    distance_km: float
    travel_time_minutes: int
    delivery_id: Optional[int] = None


@dataclass
class DeliveryRoute:
    """Complete route for a driver."""
    driver_id: int
    vehicle_id: int
    date: date
    segments: List[RouteSegment]
    total_distance: float
    total_time: int  # minutes
    total_deliveries: int
    start_time: datetime
    end_time: datetime
    
    def add_segment(self, segment: RouteSegment):
        """Add a segment to the route."""
        self.segments.append(segment)
        self.total_distance += segment.distance_km
        self.total_time += segment.travel_time_minutes
        if segment.delivery_id:
            self.total_deliveries += 1
    
    def get_timeline(self) -> List[Dict[str, Any]]:
        """Get timeline of route events."""
        timeline = []
        for segment in self.segments:
            timeline.append({
                'time': segment.departure_time,
                'event': 'departure',
                'location': segment.from_location,
                'delivery_id': segment.delivery_id
            })
            timeline.append({
                'time': segment.arrival_time,
                'event': 'arrival',
                'location': segment.to_location,
                'delivery_id': segment.delivery_id
            })
        return timeline


@dataclass
class SchedulingStats:
    """Statistics for scheduling performance."""
    total_requests: int
    scheduled_requests: int
    unscheduled_requests: int
    total_drivers: int
    active_drivers: int
    total_vehicles: int
    average_deliveries_per_driver: float
    average_distance_per_driver: float
    average_time_per_delivery: float
    time_window_compliance_rate: float
    conflicts_count: int
    computation_time: float
    
    @property
    def scheduling_success_rate(self) -> float:
        """Calculate scheduling success rate."""
        if self.total_requests == 0:
            return 0.0
        return (self.scheduled_requests / self.total_requests) * 100