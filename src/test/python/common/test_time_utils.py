"""Unit tests for time_utils module."""
import unittest
from datetime import datetime, time, timedelta, date
from typing import List, Tuple

from src.main.python.common.time_utils import (
    parse_client_time_windows,
    parse_client_hourly_windows,
    merge_consecutive_windows,
    generate_time_slots,
    is_within_time_window,
    calculate_service_time,
    format_time_window,
    parse_time_string,
    calculate_travel_time,
    find_available_slots,
    detect_conflicts,
    optimize_schedule_order,
    calculate_schedule_metrics,
    validate_schedule,
    TimeSlot,
    ScheduleEntry,
    SchedulingConflict,
    ConflictType,
    ScheduleStatus,
    SchedulingConstraint
)


class MockClient:
    """Mock client for testing."""
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class TestTimeWindowParsing(unittest.TestCase):
    """Test time window parsing functions."""
    
    def test_parse_client_time_windows_two_hour_slots(self):
        """Test parsing 2-hour time slots."""
        client = MockClient(
            hour_8_10=True,
            hour_10_12=False,
            hour_12_14=True,
            hour_14_16=True,
            hour_16_18=False,
            hour_18_20=True
        )
        
        windows = parse_client_time_windows(client)
        
        self.assertEqual(len(windows), 2)
        self.assertEqual(windows[0], (time(8, 0), time(10, 0)))
        self.assertEqual(windows[1], (time(12, 0), time(20, 0)))  # Merged consecutive
    
    def test_parse_client_hourly_windows(self):
        """Test parsing hourly time slots."""
        client = MockClient(
            hour_8_9=True,
            hour_9_10=True,
            hour_10_11=False,
            hour_11_12=True,
            hour_12_13=True,
            hour_13_14=True
        )
        
        windows = parse_client_hourly_windows(client)
        
        self.assertEqual(len(windows), 2)
        self.assertEqual(windows[0], (time(8, 0), time(10, 0)))
        self.assertEqual(windows[1], (time(11, 0), time(14, 0)))
    
    def test_merge_consecutive_windows(self):
        """Test merging consecutive time windows."""
        windows = [
            (time(8, 0), time(10, 0)),
            (time(10, 0), time(12, 0)),
            (time(14, 0), time(16, 0)),
            (time(15, 0), time(18, 0))  # Overlaps with previous
        ]
        
        merged = merge_consecutive_windows(windows)
        
        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0], (time(8, 0), time(12, 0)))
        self.assertEqual(merged[1], (time(14, 0), time(18, 0)))


class TestTimeSlotGeneration(unittest.TestCase):
    """Test time slot generation functions."""
    
    def test_generate_time_slots(self):
        """Test generating time slots."""
        start_date = datetime(2024, 1, 15, 8, 0)  # Monday
        end_date = datetime(2024, 1, 16, 18, 0)   # Tuesday
        
        slots = generate_time_slots(
            start_date, end_date,
            slot_duration_hours=2,
            operating_hours=(8, 18),
            exclude_times=[(12, 14)]
        )
        
        # Should have slots for 2 days (Mon, Tue)
        # Each day: 8-10, 10-12, 14-16, 16-18 = 4 slots
        self.assertEqual(len(slots), 8)
        
        # Check first slot
        first_slot = slots[0]
        self.assertEqual(first_slot['start_time'], time(8, 0))
        self.assertEqual(first_slot['end_time'], time(10, 0))
        self.assertEqual(first_slot['duration_hours'], 2)
        
        # Check no slots during lunch
        lunch_slots = [s for s in slots if s['start_time'] == time(12, 0)]
        self.assertEqual(len(lunch_slots), 0)
    
    def test_is_within_time_window(self):
        """Test checking if time is within windows."""
        windows = [
            (time(8, 0), time(12, 0)),
            (time(14, 0), time(18, 0))
        ]
        
        self.assertTrue(is_within_time_window(time(9, 0), windows))
        self.assertTrue(is_within_time_window(time(15, 30), windows))
        self.assertFalse(is_within_time_window(time(13, 0), windows))
        self.assertFalse(is_within_time_window(time(19, 0), windows))


class TestServiceTime(unittest.TestCase):
    """Test service time calculation."""
    
    def test_calculate_service_time(self):
        """Test calculating service time."""
        # Test different cylinder types
        self.assertEqual(calculate_service_time('16kg', 1, 'residential'), 10)
        self.assertEqual(calculate_service_time('20kg', 1, 'residential'), 12)
        self.assertEqual(calculate_service_time('50kg', 1, 'residential'), 15)
        
        # Test quantity
        self.assertEqual(calculate_service_time('16kg', 3, 'residential'), 20)
        
        # Test location types
        self.assertEqual(calculate_service_time('16kg', 1, 'commercial'), 11)
        self.assertEqual(calculate_service_time('16kg', 1, 'industrial'), 12)
        
        # Test maximum cap
        self.assertEqual(calculate_service_time('50kg', 10, 'industrial'), 60)


class TestTimeFormatting(unittest.TestCase):
    """Test time formatting functions."""
    
    def test_format_time_window(self):
        """Test formatting time windows."""
        window = (time(8, 30), time(10, 45))
        formatted = format_time_window(window)
        self.assertEqual(formatted, "08:30-10:45")
    
    def test_parse_time_string(self):
        """Test parsing time strings."""
        # Test various formats
        self.assertEqual(parse_time_string("14:30"), time(14, 30))
        self.assertEqual(parse_time_string("2:30 PM"), time(14, 30))
        self.assertEqual(parse_time_string("1430"), time(14, 30))
        self.assertEqual(parse_time_string("08:15:30"), time(8, 15, 30))
        
        # Test invalid format
        self.assertIsNone(parse_time_string("invalid"))


class TestSchedulingClasses(unittest.TestCase):
    """Test scheduling data classes."""
    
    def test_time_slot(self):
        """Test TimeSlot class."""
        slot = TimeSlot(
            start_time=datetime(2024, 1, 15, 8, 0),
            end_time=datetime(2024, 1, 15, 10, 0),
            capacity=3
        )
        
        self.assertEqual(slot.duration_minutes, 120)
        self.assertTrue(slot.is_available)
        
        # Test reservation
        self.assertTrue(slot.reserve(2))
        self.assertEqual(slot.reserved, 2)
        self.assertTrue(slot.is_available)
        
        self.assertFalse(slot.reserve(2))  # Would exceed capacity
        self.assertEqual(slot.reserved, 2)
        
        # Test release
        slot.release(1)
        self.assertEqual(slot.reserved, 1)
    
    def test_time_slot_overlap(self):
        """Test time slot overlap detection."""
        slot1 = TimeSlot(
            start_time=datetime(2024, 1, 15, 8, 0),
            end_time=datetime(2024, 1, 15, 10, 0)
        )
        
        # Overlapping slot
        slot2 = TimeSlot(
            start_time=datetime(2024, 1, 15, 9, 0),
            end_time=datetime(2024, 1, 15, 11, 0)
        )
        self.assertTrue(slot1.overlaps_with(slot2))
        
        # Non-overlapping slot
        slot3 = TimeSlot(
            start_time=datetime(2024, 1, 15, 10, 0),
            end_time=datetime(2024, 1, 15, 12, 0)
        )
        self.assertFalse(slot1.overlaps_with(slot3))
    
    def test_schedule_entry(self):
        """Test ScheduleEntry class."""
        slot = TimeSlot(
            start_time=datetime(2024, 1, 15, 8, 0),
            end_time=datetime(2024, 1, 15, 8, 30)
        )
        
        entry = ScheduleEntry(
            delivery_id=1,
            client_id=100,
            driver_id=10,
            vehicle_id=5,
            time_slot=slot,
            service_duration=45,
            priority=2,
            location=(25.0761, 121.5435)
        )
        
        expected_end = datetime(2024, 1, 15, 8, 45)
        self.assertEqual(entry.end_time, expected_end)
    
    def test_schedule_entry_conflict(self):
        """Test schedule entry conflict detection."""
        slot1 = TimeSlot(
            start_time=datetime(2024, 1, 15, 8, 0),
            end_time=datetime(2024, 1, 15, 9, 0)
        )
        
        slot2 = TimeSlot(
            start_time=datetime(2024, 1, 15, 8, 30),
            end_time=datetime(2024, 1, 15, 9, 30)
        )
        
        entry1 = ScheduleEntry(
            delivery_id=1, client_id=100, driver_id=10,
            vehicle_id=5, time_slot=slot1, service_duration=60
        )
        
        # Same driver, overlapping time
        entry2 = ScheduleEntry(
            delivery_id=2, client_id=101, driver_id=10,
            vehicle_id=5, time_slot=slot2, service_duration=60
        )
        self.assertTrue(entry1.conflicts_with(entry2))
        
        # Different driver, same time
        entry3 = ScheduleEntry(
            delivery_id=3, client_id=102, driver_id=11,
            vehicle_id=6, time_slot=slot2, service_duration=60
        )
        self.assertFalse(entry1.conflicts_with(entry3))


class TestTravelCalculation(unittest.TestCase):
    """Test travel time calculation."""
    
    def test_calculate_travel_time(self):
        """Test travel time calculation between locations."""
        # Taipei 101 to Taipei Main Station (approx 5km)
        location1 = (25.0330, 121.5654)
        location2 = (25.0478, 121.5170)
        
        travel_time = calculate_travel_time(location1, location2, speed_kmh=30.0)
        
        # Should be around 10-15 minutes for 5km at 30km/h + buffer
        self.assertGreater(travel_time, 5)
        self.assertLess(travel_time, 20)


class TestSchedulingUtilities(unittest.TestCase):
    """Test scheduling utility functions."""
    
    def test_find_available_slots(self):
        """Test finding available time slots."""
        time_windows = [
            (time(8, 0), time(12, 0)),
            (time(14, 0), time(18, 0))
        ]
        
        test_date = datetime(2024, 1, 15)
        duration = 60  # 1 hour
        
        # No existing schedule
        slots = find_available_slots(time_windows, test_date, duration)
        
        # Should have multiple 1-hour slots in each window
        self.assertGreater(len(slots), 0)
        
        # Check first slot
        first_slot = slots[0]
        self.assertEqual(first_slot.duration_minutes, 60)
        self.assertGreaterEqual(first_slot.start_time.time(), time(8, 0))
    
    def test_detect_conflicts(self):
        """Test conflict detection."""
        # Create schedule with conflicts
        slot1 = TimeSlot(
            start_time=datetime(2024, 1, 15, 8, 0),
            end_time=datetime(2024, 1, 15, 9, 0)
        )
        
        slot2 = TimeSlot(
            start_time=datetime(2024, 1, 15, 8, 30),
            end_time=datetime(2024, 1, 15, 9, 30)
        )
        
        entry1 = ScheduleEntry(
            delivery_id=1, client_id=100, driver_id=10,
            vehicle_id=5, time_slot=slot1, service_duration=60,
            location=(25.0330, 121.5654)
        )
        
        entry2 = ScheduleEntry(
            delivery_id=2, client_id=101, driver_id=10,
            vehicle_id=5, time_slot=slot2, service_duration=60,
            location=(25.0478, 121.5170)
        )
        
        schedule = [entry1, entry2]
        conflicts = detect_conflicts(schedule)
        
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0].conflict_type, ConflictType.TIME_OVERLAP)
        self.assertEqual(len(conflicts[0].entries), 2)
    
    def test_optimize_schedule_order(self):
        """Test schedule order optimization."""
        # Create entries with locations
        entries = [
            ScheduleEntry(
                delivery_id=1, client_id=100, driver_id=10,
                vehicle_id=5, time_slot=TimeSlot(
                    datetime(2024, 1, 15, 8, 0),
                    datetime(2024, 1, 15, 9, 0)
                ),
                service_duration=60,
                location=(25.0330, 121.5654)  # Location A
            ),
            ScheduleEntry(
                delivery_id=2, client_id=101, driver_id=10,
                vehicle_id=5, time_slot=TimeSlot(
                    datetime(2024, 1, 15, 10, 0),
                    datetime(2024, 1, 15, 11, 0)
                ),
                service_duration=60,
                location=(25.1000, 121.6000)  # Location C (far)
            ),
            ScheduleEntry(
                delivery_id=3, client_id=102, driver_id=10,
                vehicle_id=5, time_slot=TimeSlot(
                    datetime(2024, 1, 15, 14, 0),
                    datetime(2024, 1, 15, 15, 0)
                ),
                service_duration=60,
                location=(25.0478, 121.5170)  # Location B (near A)
            )
        ]
        
        # Optimize by distance
        optimized = optimize_schedule_order(entries, "distance")
        
        # Should reorder to minimize travel distance
        self.assertEqual(len(optimized), 3)
        # First delivery should still be first (nearest neighbor from first)
        self.assertEqual(optimized[0].delivery_id, 1)
    
    def test_calculate_schedule_metrics(self):
        """Test schedule metrics calculation."""
        entries = [
            ScheduleEntry(
                delivery_id=1, client_id=100, driver_id=10,
                vehicle_id=5, time_slot=TimeSlot(
                    datetime(2024, 1, 15, 8, 0),
                    datetime(2024, 1, 15, 9, 0)
                ),
                service_duration=60,
                location=(25.0330, 121.5654)
            ),
            ScheduleEntry(
                delivery_id=2, client_id=101, driver_id=10,
                vehicle_id=5, time_slot=TimeSlot(
                    datetime(2024, 1, 15, 10, 0),
                    datetime(2024, 1, 15, 11, 0)
                ),
                service_duration=45,
                location=(25.0478, 121.5170)
            ),
            ScheduleEntry(
                delivery_id=3, client_id=102, driver_id=11,
                vehicle_id=6, time_slot=TimeSlot(
                    datetime(2024, 1, 15, 9, 0),
                    datetime(2024, 1, 15, 10, 0)
                ),
                service_duration=50
            )
        ]
        
        metrics = calculate_schedule_metrics(entries)
        
        self.assertEqual(metrics['total_deliveries'], 3)
        self.assertEqual(metrics['drivers_used'], 2)
        self.assertEqual(metrics['total_service_time'], 155)  # 60 + 45 + 50
        self.assertGreater(metrics['total_travel_time'], 0)
        self.assertGreater(metrics['average_utilization'], 0)


class TestSchedulingConstraints(unittest.TestCase):
    """Test scheduling constraint validation."""
    
    def test_custom_constraint(self):
        """Test custom constraint implementation."""
        class MaxDeliveriesConstraint(SchedulingConstraint):
            def __init__(self, max_deliveries: int):
                super().__init__(name="Max Deliveries", is_hard=True)
                self.max_deliveries = max_deliveries
            
            def check(self, schedule: List[ScheduleEntry]) -> Tuple[bool, str]:
                if len(schedule) > self.max_deliveries:
                    return False, f"Schedule has {len(schedule)} deliveries, max is {self.max_deliveries}"
                return True, None
        
        constraint = MaxDeliveriesConstraint(max_deliveries=2)
        
        # Test with valid schedule
        schedule = [
            ScheduleEntry(
                delivery_id=1, client_id=100, driver_id=10,
                vehicle_id=5, time_slot=TimeSlot(
                    datetime(2024, 1, 15, 8, 0),
                    datetime(2024, 1, 15, 9, 0)
                ),
                service_duration=60
            )
        ]
        
        is_valid, error = constraint.check(schedule)
        self.assertTrue(is_valid)
        self.assertIsNone(error)
        
        # Test with invalid schedule
        schedule.extend([
            ScheduleEntry(
                delivery_id=2, client_id=101, driver_id=10,
                vehicle_id=5, time_slot=TimeSlot(
                    datetime(2024, 1, 15, 10, 0),
                    datetime(2024, 1, 15, 11, 0)
                ),
                service_duration=60
            ),
            ScheduleEntry(
                delivery_id=3, client_id=102, driver_id=10,
                vehicle_id=5, time_slot=TimeSlot(
                    datetime(2024, 1, 15, 14, 0),
                    datetime(2024, 1, 15, 15, 0)
                ),
                service_duration=60
            )
        ])
        
        is_valid, error = constraint.check(schedule)
        self.assertFalse(is_valid)
        self.assertIn("max is 2", error)
    
    def test_validate_schedule(self):
        """Test schedule validation with constraints."""
        # Create a simple constraint
        class TimeRangeConstraint(SchedulingConstraint):
            def __init__(self, start_hour: int, end_hour: int):
                super().__init__(name="Time Range", is_hard=True)
                self.start_hour = start_hour
                self.end_hour = end_hour
            
            def check(self, schedule: List[ScheduleEntry]) -> Tuple[bool, str]:
                for entry in schedule:
                    start_hour = entry.time_slot.start_time.hour
                    end_hour = entry.end_time.hour
                    
                    if start_hour < self.start_hour or end_hour > self.end_hour:
                        return False, f"Delivery {entry.delivery_id} outside allowed hours"
                
                return True, None
        
        # Create schedule
        schedule = [
            ScheduleEntry(
                delivery_id=1, client_id=100, driver_id=10,
                vehicle_id=5, time_slot=TimeSlot(
                    datetime(2024, 1, 15, 8, 0),
                    datetime(2024, 1, 15, 9, 0)
                ),
                service_duration=60
            ),
            ScheduleEntry(
                delivery_id=2, client_id=101, driver_id=10,
                vehicle_id=5, time_slot=TimeSlot(
                    datetime(2024, 1, 15, 20, 0),  # Too late
                    datetime(2024, 1, 15, 21, 0)
                ),
                service_duration=60
            )
        ]
        
        constraints = [TimeRangeConstraint(8, 18)]
        
        is_valid, errors = validate_schedule(schedule, constraints)
        
        self.assertFalse(is_valid)
        self.assertGreater(len(errors), 0)


if __name__ == '__main__':
    unittest.main()