"""Time utilities for time window parsing, slot generation, and scheduling."""
from datetime import datetime, time, timedelta
from typing import List, Tuple, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


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