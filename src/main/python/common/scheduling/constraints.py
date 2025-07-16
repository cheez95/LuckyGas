"""Scheduling constraints for the LuckyGas delivery system."""
from typing import List, Tuple, Optional, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict

from ..time_utils import SchedulingConstraint, ScheduleEntry, calculate_travel_time
from .models import DriverAvailability, VehicleInfo


class TimeWindowConstraint(SchedulingConstraint):
    """Ensures deliveries are scheduled within client time windows."""
    
    def __init__(self, time_windows: Dict[int, List[Tuple[datetime, datetime]]]):
        """
        Initialize time window constraint.
        
        Args:
            time_windows: Dict mapping client_id to list of time windows
        """
        super().__init__(name="Time Window Constraint", is_hard=True)
        self.time_windows = time_windows
    
    def check(self, schedule: List[ScheduleEntry]) -> Tuple[bool, Optional[str]]:
        """Check if all deliveries are within time windows."""
        violations = []
        
        for entry in schedule:
            if entry.client_id not in self.time_windows:
                continue
                
            windows = self.time_windows[entry.client_id]
            delivery_start = entry.time_slot.start_time
            delivery_end = entry.end_time
            
            # Check if delivery fits in any window
            fits_in_window = False
            for window_start, window_end in windows:
                if delivery_start >= window_start and delivery_end <= window_end:
                    fits_in_window = True
                    break
            
            if not fits_in_window:
                violations.append(f"Delivery {entry.delivery_id} for client {entry.client_id} outside time windows")
        
        if violations:
            return False, "; ".join(violations)
        return True, None


class CapacityConstraint(SchedulingConstraint):
    """Ensures vehicle capacity is not exceeded."""
    
    def __init__(self, vehicle_capacities: Dict[int, Dict[str, int]], 
                 delivery_demands: Dict[int, Tuple[str, int]]):
        """
        Initialize capacity constraint.
        
        Args:
            vehicle_capacities: Dict mapping vehicle_id to cylinder capacities
            delivery_demands: Dict mapping delivery_id to (cylinder_type, quantity)
        """
        super().__init__(name="Vehicle Capacity Constraint", is_hard=True)
        self.vehicle_capacities = vehicle_capacities
        self.delivery_demands = delivery_demands
    
    def check(self, schedule: List[ScheduleEntry]) -> Tuple[bool, Optional[str]]:
        """Check if vehicle capacities are respected."""
        # Group deliveries by vehicle and time
        vehicle_loads = defaultdict(lambda: defaultdict(int))
        
        for entry in schedule:
            if entry.delivery_id not in self.delivery_demands:
                continue
                
            cylinder_type, quantity = self.delivery_demands[entry.delivery_id]
            vehicle_loads[entry.vehicle_id][cylinder_type] += quantity
        
        violations = []
        for vehicle_id, loads in vehicle_loads.items():
            if vehicle_id not in self.vehicle_capacities:
                continue
                
            capacities = self.vehicle_capacities[vehicle_id]
            for cylinder_type, load in loads.items():
                if cylinder_type in capacities and load > capacities[cylinder_type]:
                    violations.append(
                        f"Vehicle {vehicle_id} exceeds capacity for {cylinder_type}: "
                        f"{load} > {capacities[cylinder_type]}"
                    )
        
        if violations:
            return False, "; ".join(violations)
        return True, None


class DriverAvailabilityConstraint(SchedulingConstraint):
    """Ensures drivers are scheduled only during available hours."""
    
    def __init__(self, driver_availability: Dict[int, List[Tuple[datetime, datetime]]]):
        """
        Initialize driver availability constraint.
        
        Args:
            driver_availability: Dict mapping driver_id to available time periods
        """
        super().__init__(name="Driver Availability Constraint", is_hard=True)
        self.driver_availability = driver_availability
    
    def check(self, schedule: List[ScheduleEntry]) -> Tuple[bool, Optional[str]]:
        """Check if all drivers are scheduled within their available hours."""
        violations = []
        
        for entry in schedule:
            if entry.driver_id not in self.driver_availability:
                continue
                
            available_periods = self.driver_availability[entry.driver_id]
            delivery_start = entry.time_slot.start_time
            delivery_end = entry.end_time
            
            # Check if delivery fits in any available period
            fits_in_period = False
            for period_start, period_end in available_periods:
                if delivery_start >= period_start and delivery_end <= period_end:
                    fits_in_period = True
                    break
            
            if not fits_in_period:
                violations.append(
                    f"Driver {entry.driver_id} scheduled outside available hours "
                    f"for delivery {entry.delivery_id}"
                )
        
        if violations:
            return False, "; ".join(violations)
        return True, None


class TravelTimeConstraint(SchedulingConstraint):
    """Ensures sufficient travel time between consecutive deliveries."""
    
    def __init__(self, min_buffer_minutes: int = 5, speed_kmh: float = 30.0):
        """
        Initialize travel time constraint.
        
        Args:
            min_buffer_minutes: Minimum buffer time between deliveries
            speed_kmh: Average travel speed
        """
        super().__init__(name="Travel Time Constraint", is_hard=True)
        self.min_buffer_minutes = min_buffer_minutes
        self.speed_kmh = speed_kmh
    
    def check(self, schedule: List[ScheduleEntry]) -> Tuple[bool, Optional[str]]:
        """Check if there's sufficient travel time between deliveries."""
        # Group by driver
        driver_schedules = defaultdict(list)
        for entry in schedule:
            driver_schedules[entry.driver_id].append(entry)
        
        violations = []
        for driver_id, entries in driver_schedules.items():
            # Sort by time
            sorted_entries = sorted(entries, key=lambda e: e.time_slot.start_time)
            
            for i in range(len(sorted_entries) - 1):
                current = sorted_entries[i]
                next_entry = sorted_entries[i + 1]
                
                if current.location and next_entry.location:
                    # Calculate required travel time
                    travel_time = calculate_travel_time(
                        current.location, 
                        next_entry.location,
                        self.speed_kmh
                    )
                    
                    # Calculate available time
                    available_time = int(
                        (next_entry.time_slot.start_time - current.end_time).total_seconds() / 60
                    )
                    
                    if available_time < travel_time + self.min_buffer_minutes:
                        violations.append(
                            f"Insufficient travel time for driver {driver_id} between "
                            f"deliveries {current.delivery_id} and {next_entry.delivery_id}: "
                            f"{available_time} min < {travel_time + self.min_buffer_minutes} min required"
                        )
        
        if violations:
            return False, "; ".join(violations)
        return True, None


class MaxDeliveriesConstraint(SchedulingConstraint):
    """Ensures drivers don't exceed maximum deliveries per day."""
    
    def __init__(self, max_deliveries_per_driver: Dict[int, int], default_max: int = 20):
        """
        Initialize max deliveries constraint.
        
        Args:
            max_deliveries_per_driver: Dict mapping driver_id to max deliveries
            default_max: Default maximum if driver not in dict
        """
        super().__init__(name="Max Deliveries Constraint", is_hard=False, weight=10.0)
        self.max_deliveries_per_driver = max_deliveries_per_driver
        self.default_max = default_max
    
    def check(self, schedule: List[ScheduleEntry]) -> Tuple[bool, Optional[str]]:
        """Check if any driver exceeds their maximum deliveries."""
        delivery_counts = defaultdict(int)
        for entry in schedule:
            delivery_counts[entry.driver_id] += 1
        
        violations = []
        for driver_id, count in delivery_counts.items():
            max_allowed = self.max_deliveries_per_driver.get(driver_id, self.default_max)
            if count > max_allowed:
                violations.append(
                    f"Driver {driver_id} has {count} deliveries, exceeds maximum of {max_allowed}"
                )
        
        if violations:
            return False, "; ".join(violations)
        return True, None


class WorkingHoursConstraint(SchedulingConstraint):
    """Ensures drivers don't exceed maximum working hours."""
    
    def __init__(self, max_hours_per_day: float = 8.0, include_travel: bool = True):
        """
        Initialize working hours constraint.
        
        Args:
            max_hours_per_day: Maximum working hours per day
            include_travel: Whether to include travel time in working hours
        """
        super().__init__(name="Working Hours Constraint", is_hard=False, weight=15.0)
        self.max_hours_per_day = max_hours_per_day
        self.include_travel = include_travel
    
    def check(self, schedule: List[ScheduleEntry]) -> Tuple[bool, Optional[str]]:
        """Check if any driver exceeds maximum working hours."""
        driver_schedules = defaultdict(list)
        for entry in schedule:
            driver_schedules[entry.driver_id].append(entry)
        
        violations = []
        for driver_id, entries in driver_schedules.items():
            if not entries:
                continue
                
            # Sort by time
            sorted_entries = sorted(entries, key=lambda e: e.time_slot.start_time)
            
            # Calculate total working time
            first_start = sorted_entries[0].time_slot.start_time
            last_end = sorted_entries[-1].end_time
            total_hours = (last_end - first_start).total_seconds() / 3600
            
            if total_hours > self.max_hours_per_day:
                violations.append(
                    f"Driver {driver_id} works {total_hours:.1f} hours, "
                    f"exceeds maximum of {self.max_hours_per_day} hours"
                )
        
        if violations:
            return False, "; ".join(violations)
        return True, None


class GeographicClusteringConstraint(SchedulingConstraint):
    """Soft constraint to encourage geographic clustering of deliveries."""
    
    def __init__(self, max_distance_between_deliveries: float = 10.0):
        """
        Initialize geographic clustering constraint.
        
        Args:
            max_distance_between_deliveries: Max distance in km between consecutive deliveries
        """
        super().__init__(name="Geographic Clustering", is_hard=False, weight=5.0)
        self.max_distance = max_distance_between_deliveries
    
    def check(self, schedule: List[ScheduleEntry]) -> Tuple[bool, Optional[str]]:
        """Check if deliveries are geographically clustered."""
        driver_schedules = defaultdict(list)
        for entry in schedule:
            if entry.location:
                driver_schedules[entry.driver_id].append(entry)
        
        total_excessive_distances = 0
        for driver_id, entries in driver_schedules.items():
            sorted_entries = sorted(entries, key=lambda e: e.time_slot.start_time)
            
            for i in range(len(sorted_entries) - 1):
                current = sorted_entries[i]
                next_entry = sorted_entries[i + 1]
                
                # Calculate distance
                travel_time = calculate_travel_time(current.location, next_entry.location, 30.0)
                distance = (travel_time / 60) * 30.0  # Approximate distance in km
                
                if distance > self.max_distance:
                    total_excessive_distances += 1
        
        if total_excessive_distances > 0:
            return False, f"{total_excessive_distances} excessive distances between consecutive deliveries"
        return True, None
    
    def cost(self, schedule: List[ScheduleEntry]) -> float:
        """Calculate cost based on total distance."""
        driver_schedules = defaultdict(list)
        for entry in schedule:
            if entry.location:
                driver_schedules[entry.driver_id].append(entry)
        
        total_distance = 0.0
        for driver_id, entries in driver_schedules.items():
            sorted_entries = sorted(entries, key=lambda e: e.time_slot.start_time)
            
            for i in range(len(sorted_entries) - 1):
                current = sorted_entries[i]
                next_entry = sorted_entries[i + 1]
                
                travel_time = calculate_travel_time(current.location, next_entry.location, 30.0)
                distance = (travel_time / 60) * 30.0
                total_distance += distance
        
        # Return weighted cost based on total distance
        return self.weight * (total_distance / 100)  # Normalize by 100km