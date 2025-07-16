"""Time utilities for time window parsing, slot generation, and scheduling."""
from datetime import datetime, time, timedelta
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import logging
from collections import defaultdict
import math

logger = logging.getLogger(__name__)


class ScheduleStatus(Enum):
    """Status of a scheduled delivery."""
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ConflictType(Enum):
    """Types of scheduling conflicts."""
    TIME_OVERLAP = "time_overlap"
    CAPACITY_EXCEEDED = "capacity_exceeded"
    TIME_WINDOW_VIOLATION = "time_window_violation"
    TRAVEL_TIME_INSUFFICIENT = "travel_time_insufficient"
    DRIVER_UNAVAILABLE = "driver_unavailable"
    VEHICLE_UNAVAILABLE = "vehicle_unavailable"


@dataclass
class TimeSlot:
    """Represents a time slot for scheduling."""
    start_time: datetime
    end_time: datetime
    capacity: int = 1
    reserved: int = 0
    slot_id: Optional[str] = None
    
    def __post_init__(self):
        if not self.slot_id:
            self.slot_id = f"{self.start_time.isoformat()}_{self.end_time.isoformat()}"
    
    @property
    def duration_minutes(self) -> int:
        """Get duration in minutes."""
        return int((self.end_time - self.start_time).total_seconds() / 60)
    
    @property
    def is_available(self) -> bool:
        """Check if slot has available capacity."""
        return self.reserved < self.capacity
    
    def reserve(self, count: int = 1) -> bool:
        """Reserve capacity in this slot."""
        if self.reserved + count <= self.capacity:
            self.reserved += count
            return True
        return False
    
    def release(self, count: int = 1):
        """Release reserved capacity."""
        self.reserved = max(0, self.reserved - count)
    
    def overlaps_with(self, other: 'TimeSlot') -> bool:
        """Check if this slot overlaps with another."""
        return not (self.end_time <= other.start_time or self.start_time >= other.end_time)


@dataclass
class ScheduleEntry:
    """Represents a scheduled delivery."""
    delivery_id: int
    client_id: int
    driver_id: int
    vehicle_id: int
    time_slot: TimeSlot
    service_duration: int  # minutes
    priority: int = 0
    status: ScheduleStatus = ScheduleStatus.DRAFT
    location: Optional[Tuple[float, float]] = None  # (lat, lon)
    notes: Optional[str] = None
    
    @property
    def end_time(self) -> datetime:
        """Calculate expected end time including service."""
        return self.time_slot.start_time + timedelta(minutes=self.service_duration)
    
    def conflicts_with(self, other: 'ScheduleEntry') -> bool:
        """Check if this entry conflicts with another."""
        if self.driver_id != other.driver_id:
            return False
        return self.time_slot.overlaps_with(other.time_slot)


@dataclass
class SchedulingConflict:
    """Represents a scheduling conflict."""
    conflict_type: ConflictType
    entries: List[ScheduleEntry]
    description: str
    severity: int = 1  # 1-5, 5 being most severe
    resolution_suggestions: List[str] = field(default_factory=list)


@dataclass
class SchedulingConstraint:
    """Base class for scheduling constraints."""
    name: str
    is_hard: bool = True  # Hard constraints must be satisfied
    weight: float = 1.0  # Weight for soft constraints
    
    def check(self, schedule: List[ScheduleEntry]) -> Tuple[bool, Optional[str]]:
        """Check if constraint is satisfied. Returns (satisfied, error_message)."""
        raise NotImplementedError
    
    def cost(self, schedule: List[ScheduleEntry]) -> float:
        """Calculate cost/penalty for violating this constraint."""
        satisfied, _ = self.check(schedule)
        return 0.0 if satisfied else self.weight


def parse_client_time_windows(client: Any) -> List[Tuple[time, time]]:
    """
    Parse client operating hours into time windows.
    Supports both 2-hour slots (hour_8_10) and individual hour slots (hour_8_9).
    
    Args:
        client: Client object with hour_X_Y boolean fields
        
    Returns:
        List of time window tuples (start_time, end_time)
    """
    time_windows = []
    
    # Check for 2-hour slots first
    two_hour_slots = [
        (8, 10, 'hour_8_10'),
        (10, 12, 'hour_10_12'),
        (12, 14, 'hour_12_14'),
        (14, 16, 'hour_14_16'),
        (16, 18, 'hour_16_18'),
        (18, 20, 'hour_18_20')
    ]
    
    has_two_hour_slots = False
    for _, _, field_name in two_hour_slots:
        if hasattr(client, field_name):
            has_two_hour_slots = True
            break
    
    if has_two_hour_slots:
        # Use 2-hour slots
        for start_hour, end_hour, field_name in two_hour_slots:
            if hasattr(client, field_name) and getattr(client, field_name):
                time_windows.append((
                    time(start_hour, 0),
                    time(end_hour, 0)
                ))
    else:
        # Use individual hour slots
        time_windows = parse_client_hourly_windows(client)
    
    # Merge consecutive windows
    return merge_consecutive_windows(time_windows)


def parse_client_hourly_windows(client: Any) -> List[Tuple[time, time]]:
    """
    Parse client operating hours from individual hour slots.
    
    Args:
        client: Client object with hour_X_Y boolean fields (e.g., hour_8_9, hour_9_10)
        
    Returns:
        List of time window tuples (start_time, end_time)
    """
    # Define all individual hour slots
    hourly_slots = [
        (8, 9, 'hour_8_9'),
        (9, 10, 'hour_9_10'),
        (10, 11, 'hour_10_11'),
        (11, 12, 'hour_11_12'),
        (12, 13, 'hour_12_13'),
        (13, 14, 'hour_13_14'),
        (14, 15, 'hour_14_15'),
        (15, 16, 'hour_15_16'),
        (16, 17, 'hour_16_17'),
        (17, 18, 'hour_17_18'),
        (18, 19, 'hour_18_19'),
        (19, 20, 'hour_19_20')
    ]
    
    # Find continuous available time periods
    windows = []
    start_hour = None
    
    for hour_start, hour_end, field_name in hourly_slots:
        is_available = hasattr(client, field_name) and getattr(client, field_name, False)
        
        if is_available:
            if start_hour is None:
                start_hour = hour_start
        else:
            if start_hour is not None:
                windows.append((
                    time(start_hour, 0),
                    time(hour_start, 0)
                ))
                start_hour = None
    
    # Handle case where availability extends to the last slot
    if start_hour is not None:
        windows.append((
            time(start_hour, 0),
            time(20, 0)  # Last slot ends at 20:00
        ))
    
    return windows


def merge_consecutive_windows(
    windows: List[Tuple[time, time]]
) -> List[Tuple[time, time]]:
    """
    Merge consecutive time windows.
    
    Args:
        windows: List of time window tuples
        
    Returns:
        List of merged time windows
    """
    if not windows:
        return []
    
    # Sort windows by start time
    sorted_windows = sorted(windows, key=lambda x: x[0])
    
    merged = [sorted_windows[0]]
    
    for current in sorted_windows[1:]:
        last_start, last_end = merged[-1]
        current_start, current_end = current
        
        # Check if windows are consecutive or overlapping
        if last_end >= current_start:
            # Merge windows
            merged[-1] = (last_start, max(last_end, current_end))
        else:
            merged.append(current)
    
    return merged


def generate_time_slots(
    start_date: datetime,
    end_date: datetime,
    slot_duration_hours: int = 2,
    operating_hours: Tuple[int, int] = (8, 18),
    exclude_times: List[Tuple[int, int]] = [(12, 14)]
) -> List[Dict[str, Any]]:
    """
    Generate time slots for scheduling.
    
    Args:
        start_date: Start date for slot generation
        end_date: End date for slot generation
        slot_duration_hours: Duration of each slot in hours
        operating_hours: Tuple of (start_hour, end_hour) for daily operations
        exclude_times: List of time ranges to exclude (e.g., lunch breaks)
        
    Returns:
        List of time slot dictionaries
    """
    slots = []
    current_date = start_date.date()
    end_date_only = end_date.date()
    
    while current_date <= end_date_only:
        # Skip weekends if needed
        if current_date.weekday() < 6:  # Monday = 0, Sunday = 6
            daily_slots = generate_daily_slots(
                current_date,
                slot_duration_hours,
                operating_hours,
                exclude_times
            )
            slots.extend(daily_slots)
        
        current_date += timedelta(days=1)
    
    return slots


def generate_daily_slots(
    date: Any,
    slot_duration_hours: int,
    operating_hours: Tuple[int, int],
    exclude_times: List[Tuple[int, int]]
) -> List[Dict[str, Any]]:
    """
    Generate time slots for a single day.
    
    Args:
        date: Date for slot generation
        slot_duration_hours: Duration of each slot
        operating_hours: Daily operating hours
        exclude_times: Times to exclude
        
    Returns:
        List of time slots for the day
    """
    slots = []
    start_hour, end_hour = operating_hours
    current_hour = start_hour
    
    while current_hour < end_hour:
        slot_end = min(current_hour + slot_duration_hours, end_hour)
        
        # Check if slot overlaps with excluded times
        is_excluded = False
        for exclude_start, exclude_end in exclude_times:
            if not (slot_end <= exclude_start or current_hour >= exclude_end):
                is_excluded = True
                break
        
        if not is_excluded:
            slots.append({
                'date': date,
                'start_time': time(current_hour, 0),
                'end_time': time(slot_end, 0),
                'start_datetime': datetime.combine(date, time(current_hour, 0)),
                'end_datetime': datetime.combine(date, time(slot_end, 0)),
                'duration_hours': slot_end - current_hour,
                'slot_id': f"{date}_{current_hour:02d}_{slot_end:02d}"
            })
        
        current_hour = slot_end
    
    return slots


def is_within_time_window(
    check_time: time,
    windows: List[Tuple[time, time]]
) -> bool:
    """
    Check if a time falls within any of the given time windows.
    
    Args:
        check_time: Time to check
        windows: List of time windows
        
    Returns:
        True if time is within any window
    """
    for start, end in windows:
        if start <= check_time <= end:
            return True
    return False


def calculate_service_time(
    cylinder_type: str,
    quantity: int,
    location_type: str = 'residential'
) -> int:
    """
    Calculate estimated service time in minutes.
    
    Args:
        cylinder_type: Type of gas cylinder
        quantity: Number of cylinders
        location_type: Type of location (residential, commercial, industrial)
        
    Returns:
        Estimated service time in minutes
    """
    # Base times by cylinder type (in minutes)
    base_times = {
        '16kg': 5,
        '20kg': 7,
        '50kg': 10,
        'custom': 15
    }
    
    # Location multipliers
    location_multipliers = {
        'residential': 1.0,
        'commercial': 1.2,
        'industrial': 1.5
    }
    
    base_time = base_times.get(cylinder_type.lower(), 10)
    multiplier = location_multipliers.get(location_type.lower(), 1.0)
    
    # Calculate total time
    service_time = int(base_time * quantity * multiplier)
    
    # Add setup/teardown time
    service_time += 5
    
    # Cap at reasonable maximum
    return min(service_time, 60)


def format_time_window(window: Tuple[time, time]) -> str:
    """
    Format a time window as a string.
    
    Args:
        window: Tuple of (start_time, end_time)
        
    Returns:
        Formatted string like "08:00-10:00"
    """
    start, end = window
    return f"{start.strftime('%H:%M')}-{end.strftime('%H:%M')}"


def parse_time_string(time_str: str) -> Optional[time]:
    """
    Parse a time string in various formats.
    
    Args:
        time_str: Time string (e.g., "14:30", "2:30 PM", "1430")
        
    Returns:
        time object or None if parsing fails
    """
    formats = [
        '%H:%M',
        '%I:%M %p',
        '%H%M',
        '%H:%M:%S'
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(time_str.strip(), fmt).time()
        except ValueError:
            continue
    
    logger.warning(f"Could not parse time string: {time_str}")
    return None


def calculate_travel_time(
    from_location: Tuple[float, float],
    to_location: Tuple[float, float],
    speed_kmh: float = 30.0
) -> int:
    """
    Calculate travel time between two locations.
    
    Args:
        from_location: Starting location (lat, lon)
        to_location: Destination location (lat, lon)
        speed_kmh: Average travel speed in km/h
        
    Returns:
        Travel time in minutes
    """
    # Haversine formula for distance calculation
    lat1, lon1 = from_location
    lat2, lon2 = to_location
    
    R = 6371  # Earth's radius in kilometers
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    # Calculate time in minutes
    travel_time = int((distance / speed_kmh) * 60)
    
    # Add buffer for traffic and stops
    return travel_time + 5


def find_available_slots(
    time_windows: List[Tuple[time, time]],
    date: datetime,
    duration_minutes: int,
    existing_schedule: List[ScheduleEntry] = None
) -> List[TimeSlot]:
    """
    Find available time slots within given time windows.
    
    Args:
        time_windows: List of available time windows
        date: Date for scheduling
        duration_minutes: Required slot duration
        existing_schedule: Existing schedule entries to avoid
        
    Returns:
        List of available time slots
    """
    available_slots = []
    existing_schedule = existing_schedule or []
    
    for start_time, end_time in time_windows:
        # Convert to datetime
        window_start = datetime.combine(date.date(), start_time)
        window_end = datetime.combine(date.date(), end_time)
        
        # Generate potential slots
        current = window_start
        while current + timedelta(minutes=duration_minutes) <= window_end:
            slot = TimeSlot(
                start_time=current,
                end_time=current + timedelta(minutes=duration_minutes)
            )
            
            # Check if slot conflicts with existing schedule
            has_conflict = False
            for entry in existing_schedule:
                if slot.overlaps_with(entry.time_slot):
                    has_conflict = True
                    break
            
            if not has_conflict:
                available_slots.append(slot)
            
            # Move to next potential slot
            current += timedelta(minutes=15)  # 15-minute increments
    
    return available_slots


def detect_conflicts(schedule: List[ScheduleEntry]) -> List[SchedulingConflict]:
    """
    Detect all conflicts in a schedule.
    
    Args:
        schedule: List of schedule entries
        
    Returns:
        List of detected conflicts
    """
    conflicts = []
    
    # Check time overlaps by driver
    driver_schedules = defaultdict(list)
    for entry in schedule:
        driver_schedules[entry.driver_id].append(entry)
    
    for driver_id, entries in driver_schedules.items():
        # Sort by start time
        sorted_entries = sorted(entries, key=lambda e: e.time_slot.start_time)
        
        # Check for overlaps
        for i in range(len(sorted_entries) - 1):
            current = sorted_entries[i]
            next_entry = sorted_entries[i + 1]
            
            if current.end_time > next_entry.time_slot.start_time:
                conflict = SchedulingConflict(
                    conflict_type=ConflictType.TIME_OVERLAP,
                    entries=[current, next_entry],
                    description=f"Driver {driver_id} has overlapping deliveries",
                    severity=5,
                    resolution_suggestions=[
                        f"Reschedule delivery {next_entry.delivery_id} to a later time",
                        f"Assign delivery {next_entry.delivery_id} to a different driver"
                    ]
                )
                conflicts.append(conflict)
            
            # Check travel time between consecutive deliveries
            if current.location and next_entry.location:
                travel_time = calculate_travel_time(current.location, next_entry.location)
                available_time = int((next_entry.time_slot.start_time - current.end_time).total_seconds() / 60)
                
                if available_time < travel_time:
                    conflict = SchedulingConflict(
                        conflict_type=ConflictType.TRAVEL_TIME_INSUFFICIENT,
                        entries=[current, next_entry],
                        description=f"Insufficient travel time between deliveries ({available_time} min < {travel_time} min required)",
                        severity=4,
                        resolution_suggestions=[
                            f"Add {travel_time - available_time} minutes buffer between deliveries",
                            "Consider geographic clustering for this driver's route"
                        ]
                    )
                    conflicts.append(conflict)
    
    return conflicts


def optimize_schedule_order(
    entries: List[ScheduleEntry],
    optimization_goal: str = "distance"
) -> List[ScheduleEntry]:
    """
    Optimize the order of schedule entries.
    
    Args:
        entries: List of schedule entries for a single driver
        optimization_goal: "distance" or "time_windows"
        
    Returns:
        Optimized list of schedule entries
    """
    if not entries or len(entries) <= 1:
        return entries
    
    if optimization_goal == "distance" and all(e.location for e in entries):
        # Use nearest neighbor heuristic
        optimized = []
        remaining = entries.copy()
        current = remaining.pop(0)
        optimized.append(current)
        
        while remaining:
            # Find nearest delivery
            nearest = min(
                remaining,
                key=lambda e: calculate_travel_time(current.location, e.location)
            )
            remaining.remove(nearest)
            optimized.append(nearest)
            current = nearest
        
        return optimized
    else:
        # Sort by time window start
        return sorted(entries, key=lambda e: e.time_slot.start_time)


def calculate_schedule_metrics(schedule: List[ScheduleEntry]) -> Dict[str, Any]:
    """
    Calculate metrics for a schedule.
    
    Args:
        schedule: List of schedule entries
        
    Returns:
        Dictionary of metrics
    """
    if not schedule:
        return {
            "total_deliveries": 0,
            "drivers_used": 0,
            "total_service_time": 0,
            "total_travel_time": 0,
            "average_utilization": 0.0
        }
    
    metrics = {
        "total_deliveries": len(schedule),
        "drivers_used": len(set(e.driver_id for e in schedule)),
        "total_service_time": sum(e.service_duration for e in schedule),
        "total_travel_time": 0,
        "time_window_compliance": 0,
        "conflicts": len(detect_conflicts(schedule))
    }
    
    # Calculate travel time by driver
    driver_schedules = defaultdict(list)
    for entry in schedule:
        driver_schedules[entry.driver_id].append(entry)
    
    total_travel_time = 0
    for driver_id, entries in driver_schedules.items():
        sorted_entries = sorted(entries, key=lambda e: e.time_slot.start_time)
        for i in range(len(sorted_entries) - 1):
            if sorted_entries[i].location and sorted_entries[i+1].location:
                travel_time = calculate_travel_time(
                    sorted_entries[i].location,
                    sorted_entries[i+1].location
                )
                total_travel_time += travel_time
    
    metrics["total_travel_time"] = total_travel_time
    
    # Calculate utilization
    if metrics["drivers_used"] > 0:
        total_work_time = metrics["total_service_time"] + metrics["total_travel_time"]
        # Assume 8-hour work day
        available_time = metrics["drivers_used"] * 8 * 60
        metrics["average_utilization"] = min(100, (total_work_time / available_time) * 100)
    
    return metrics


def validate_schedule(
    schedule: List[ScheduleEntry],
    constraints: List[SchedulingConstraint] = None
) -> Tuple[bool, List[str]]:
    """
    Validate a schedule against constraints.
    
    Args:
        schedule: List of schedule entries
        constraints: List of constraints to check
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    # Check for conflicts
    conflicts = detect_conflicts(schedule)
    for conflict in conflicts:
        errors.append(f"{conflict.conflict_type.value}: {conflict.description}")
    
    # Check custom constraints
    if constraints:
        for constraint in constraints:
            satisfied, error_msg = constraint.check(schedule)
            if not satisfied and constraint.is_hard:
                errors.append(f"Constraint '{constraint.name}' violated: {error_msg}")
    
    return len(errors) == 0, errors