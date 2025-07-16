"""Unit tests for scheduling constraints."""
import unittest
from datetime import datetime, timedelta
from typing import List, Dict

from src.main.python.common.time_utils import ScheduleEntry, TimeSlot
from src.main.python.common.scheduling.constraints import (
    TimeWindowConstraint,
    CapacityConstraint,
    DriverAvailabilityConstraint,
    TravelTimeConstraint,
    MaxDeliveriesConstraint,
    WorkingHoursConstraint,
    GeographicClusteringConstraint
)


class TestSchedulingConstraints(unittest.TestCase):
    """Test scheduling constraint implementations."""
    
    def setUp(self):
        """Set up test data."""
        # Create test schedule entries
        self.base_date = datetime(2024, 1, 15)
        
        self.schedule = [
            ScheduleEntry(
                delivery_id=1,
                client_id=100,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=self.base_date.replace(hour=8),
                    end_time=self.base_date.replace(hour=9)
                ),
                service_duration=60,
                location=(25.0330, 121.5654)
            ),
            ScheduleEntry(
                delivery_id=2,
                client_id=101,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=self.base_date.replace(hour=10),
                    end_time=self.base_date.replace(hour=11)
                ),
                service_duration=60,
                location=(25.0478, 121.5170)
            ),
            ScheduleEntry(
                delivery_id=3,
                client_id=102,
                driver_id=11,
                vehicle_id=2,
                time_slot=TimeSlot(
                    start_time=self.base_date.replace(hour=14),
                    end_time=self.base_date.replace(hour=15)
                ),
                service_duration=60,
                location=(25.0600, 121.5300)
            )
        ]
    
    def test_time_window_constraint_valid(self):
        """Test time window constraint with valid schedule."""
        time_windows = {
            100: [(self.base_date.replace(hour=7), self.base_date.replace(hour=12))],
            101: [(self.base_date.replace(hour=9), self.base_date.replace(hour=16))],
            102: [(self.base_date.replace(hour=12), self.base_date.replace(hour=18))]
        }
        
        constraint = TimeWindowConstraint(time_windows)
        is_valid, error = constraint.check(self.schedule)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)
    
    def test_time_window_constraint_invalid(self):
        """Test time window constraint with invalid schedule."""
        time_windows = {
            100: [(self.base_date.replace(hour=9), self.base_date.replace(hour=12))],  # Too late
            101: [(self.base_date.replace(hour=9), self.base_date.replace(hour=16))],
            102: [(self.base_date.replace(hour=12), self.base_date.replace(hour=18))]
        }
        
        constraint = TimeWindowConstraint(time_windows)
        is_valid, error = constraint.check(self.schedule)
        
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        self.assertIn("outside time windows", error)
    
    def test_capacity_constraint_valid(self):
        """Test capacity constraint with valid schedule."""
        vehicle_capacities = {
            1: {"16kg": 10, "20kg": 8, "50kg": 4},
            2: {"16kg": 8, "20kg": 6, "50kg": 3}
        }
        
        delivery_demands = {
            1: ("16kg", 3),
            2: ("20kg", 2),
            3: ("16kg", 4)
        }
        
        constraint = CapacityConstraint(vehicle_capacities, delivery_demands)
        is_valid, error = constraint.check(self.schedule)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)
    
    def test_capacity_constraint_invalid(self):
        """Test capacity constraint with invalid schedule."""
        vehicle_capacities = {
            1: {"16kg": 5, "20kg": 3, "50kg": 2},  # Low capacity
            2: {"16kg": 8, "20kg": 6, "50kg": 3}
        }
        
        delivery_demands = {
            1: ("16kg", 4),
            2: ("20kg", 4),  # Exceeds capacity
            3: ("16kg", 2)
        }
        
        constraint = CapacityConstraint(vehicle_capacities, delivery_demands)
        is_valid, error = constraint.check(self.schedule)
        
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        self.assertIn("exceeds capacity", error)
    
    def test_driver_availability_constraint_valid(self):
        """Test driver availability constraint with valid schedule."""
        driver_availability = {
            10: [(self.base_date.replace(hour=6), self.base_date.replace(hour=18))],
            11: [(self.base_date.replace(hour=12), self.base_date.replace(hour=20))]
        }
        
        constraint = DriverAvailabilityConstraint(driver_availability)
        is_valid, error = constraint.check(self.schedule)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)
    
    def test_driver_availability_constraint_invalid(self):
        """Test driver availability constraint with invalid schedule."""
        driver_availability = {
            10: [(self.base_date.replace(hour=9), self.base_date.replace(hour=17))],  # Starts too late
            11: [(self.base_date.replace(hour=12), self.base_date.replace(hour=20))]
        }
        
        constraint = DriverAvailabilityConstraint(driver_availability)
        is_valid, error = constraint.check(self.schedule)
        
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        self.assertIn("outside available hours", error)
    
    def test_travel_time_constraint_valid(self):
        """Test travel time constraint with valid schedule."""
        # Schedule with sufficient time between deliveries
        constraint = TravelTimeConstraint(min_buffer_minutes=5, speed_kmh=30.0)
        is_valid, error = constraint.check(self.schedule)
        
        # Should be valid as deliveries have 1+ hour gap
        self.assertTrue(is_valid)
        self.assertIsNone(error)
    
    def test_travel_time_constraint_invalid(self):
        """Test travel time constraint with insufficient travel time."""
        # Create schedule with back-to-back deliveries far apart
        tight_schedule = [
            ScheduleEntry(
                delivery_id=1,
                client_id=100,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=self.base_date.replace(hour=8),
                    end_time=self.base_date.replace(hour=9)
                ),
                service_duration=60,
                location=(25.0000, 121.0000)  # Origin
            ),
            ScheduleEntry(
                delivery_id=2,
                client_id=101,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=self.base_date.replace(hour=9, minute=5),  # Only 5 minutes later
                    end_time=self.base_date.replace(hour=10, minute=5)
                ),
                service_duration=60,
                location=(25.1000, 121.1000)  # Far location
            )
        ]
        
        constraint = TravelTimeConstraint(min_buffer_minutes=5, speed_kmh=30.0)
        is_valid, error = constraint.check(tight_schedule)
        
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        self.assertIn("Insufficient travel time", error)
    
    def test_max_deliveries_constraint_valid(self):
        """Test max deliveries constraint with valid schedule."""
        max_deliveries = {
            10: 5,  # Driver 10 can do 5 deliveries
            11: 3   # Driver 11 can do 3 deliveries
        }
        
        constraint = MaxDeliveriesConstraint(max_deliveries)
        is_valid, error = constraint.check(self.schedule)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)
    
    def test_max_deliveries_constraint_invalid(self):
        """Test max deliveries constraint with too many deliveries."""
        max_deliveries = {
            10: 1,  # Driver 10 can only do 1 delivery
            11: 1
        }
        
        constraint = MaxDeliveriesConstraint(max_deliveries)
        is_valid, error = constraint.check(self.schedule)
        
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        self.assertIn("exceeds maximum", error)
    
    def test_max_deliveries_constraint_default(self):
        """Test max deliveries constraint with default limit."""
        # Don't specify limits for drivers, use default
        constraint = MaxDeliveriesConstraint({}, default_max=20)
        is_valid, error = constraint.check(self.schedule)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)
    
    def test_working_hours_constraint_valid(self):
        """Test working hours constraint with valid schedule."""
        constraint = WorkingHoursConstraint(max_hours_per_day=10.0)
        is_valid, error = constraint.check(self.schedule)
        
        # Schedule spans 8am-3pm = 7 hours for driver 10
        self.assertTrue(is_valid)
        self.assertIsNone(error)
    
    def test_working_hours_constraint_invalid(self):
        """Test working hours constraint with excessive hours."""
        # Add more deliveries to exceed working hours
        long_schedule = self.schedule.copy()
        long_schedule.append(
            ScheduleEntry(
                delivery_id=4,
                client_id=103,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=self.base_date.replace(hour=20),  # Late delivery
                    end_time=self.base_date.replace(hour=21)
                ),
                service_duration=60
            )
        )
        
        constraint = WorkingHoursConstraint(max_hours_per_day=8.0)
        is_valid, error = constraint.check(long_schedule)
        
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        self.assertIn("exceeds maximum", error)
    
    def test_geographic_clustering_constraint(self):
        """Test geographic clustering constraint."""
        # Create schedule with mixed distances
        clustered_schedule = [
            ScheduleEntry(
                delivery_id=1,
                client_id=100,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=self.base_date.replace(hour=8),
                    end_time=self.base_date.replace(hour=9)
                ),
                service_duration=60,
                location=(25.0000, 121.0000)
            ),
            ScheduleEntry(
                delivery_id=2,
                client_id=101,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=self.base_date.replace(hour=10),
                    end_time=self.base_date.replace(hour=11)
                ),
                service_duration=60,
                location=(25.0050, 121.0050)  # Close to first
            ),
            ScheduleEntry(
                delivery_id=3,
                client_id=102,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=self.base_date.replace(hour=14),
                    end_time=self.base_date.replace(hour=15)
                ),
                service_duration=60,
                location=(25.2000, 121.2000)  # Far from others
            )
        ]
        
        constraint = GeographicClusteringConstraint(max_distance_between_deliveries=10.0)
        is_valid, error = constraint.check(clustered_schedule)
        
        # Should fail due to large distance
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        self.assertIn("excessive distances", error)
        
        # Test cost calculation
        cost = constraint.cost(clustered_schedule)
        self.assertGreater(cost, 0)
    
    def test_constraint_soft_vs_hard(self):
        """Test soft vs hard constraint behavior."""
        # Create a soft constraint
        soft_constraint = GeographicClusteringConstraint(max_distance_between_deliveries=1.0)
        self.assertFalse(soft_constraint.is_hard)
        
        # Create a hard constraint
        hard_constraint = TimeWindowConstraint({})
        self.assertTrue(hard_constraint.is_hard)
        
        # Test cost calculation
        cost_when_violated = soft_constraint.cost(self.schedule)
        self.assertGreater(cost_when_violated, 0)
        
        # Hard constraint should have high cost when violated
        empty_windows = {client_id: [] for client_id in [100, 101, 102]}
        hard_constraint = TimeWindowConstraint(empty_windows)
        cost_hard = hard_constraint.cost(self.schedule)
        self.assertEqual(cost_hard, hard_constraint.weight)
    
    def test_constraint_weight(self):
        """Test constraint weight in cost calculation."""
        # Create constraints with different weights
        constraint1 = MaxDeliveriesConstraint({}, default_max=0)  # Will fail
        constraint1.weight = 10.0
        
        constraint2 = WorkingHoursConstraint(max_hours_per_day=0.1)  # Will fail
        constraint2.weight = 20.0
        
        cost1 = constraint1.cost(self.schedule)
        cost2 = constraint2.cost(self.schedule)
        
        # Cost should reflect weight
        self.assertEqual(cost1, 10.0)
        self.assertEqual(cost2, 20.0)
    
    def test_empty_schedule(self):
        """Test constraints with empty schedule."""
        constraints = [
            TimeWindowConstraint({}),
            CapacityConstraint({}, {}),
            DriverAvailabilityConstraint({}),
            TravelTimeConstraint(),
            MaxDeliveriesConstraint({}),
            WorkingHoursConstraint(),
            GeographicClusteringConstraint()
        ]
        
        for constraint in constraints:
            is_valid, error = constraint.check([])
            self.assertTrue(is_valid, f"{constraint.name} should pass with empty schedule")
            self.assertIsNone(error)


if __name__ == '__main__':
    unittest.main()