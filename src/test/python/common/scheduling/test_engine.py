"""Unit tests for scheduling engine."""
import unittest
from datetime import datetime, date, timedelta
from typing import List

from src.main.python.common.time_utils import ScheduleEntry, TimeSlot
from src.main.python.common.scheduling.engine import SchedulingEngine
from src.main.python.common.scheduling.models import (
    DeliveryRequest, DriverAvailability, VehicleInfo,
    SchedulingParameters, OptimizationObjective,
    DeliveryRoute, SchedulingStats
)
from src.main.python.common.scheduling.constraints import (
    TimeWindowConstraint, CapacityConstraint,
    DriverAvailabilityConstraint, TravelTimeConstraint
)


class TestSchedulingEngine(unittest.TestCase):
    """Test scheduling engine functionality."""
    
    def setUp(self):
        """Set up test data."""
        self.engine = SchedulingEngine()
        self.test_date = date(2024, 1, 15)
        
        # Create test delivery requests
        self.delivery_requests = [
            DeliveryRequest(
                delivery_id=1,
                client_id=100,
                location=(25.0330, 121.5654),
                time_windows=[
                    (datetime(2024, 1, 15, 8, 0), datetime(2024, 1, 15, 12, 0))
                ],
                service_duration=30,
                cylinder_type="16kg",
                quantity=2,
                priority=1
            ),
            DeliveryRequest(
                delivery_id=2,
                client_id=101,
                location=(25.0478, 121.5170),
                time_windows=[
                    (datetime(2024, 1, 15, 10, 0), datetime(2024, 1, 15, 14, 0))
                ],
                service_duration=45,
                cylinder_type="20kg",
                quantity=1,
                priority=2
            ),
            DeliveryRequest(
                delivery_id=3,
                client_id=102,
                location=(25.0600, 121.5300),
                time_windows=[
                    (datetime(2024, 1, 15, 14, 0), datetime(2024, 1, 15, 18, 0))
                ],
                service_duration=20,
                cylinder_type="16kg",
                quantity=3,
                priority=0
            )
        ]
        
        # Create test driver availability
        self.driver_availability = [
            DriverAvailability(
                driver_id=10,
                employee_id="EMP001",
                name="Driver A",
                available_hours=[
                    (datetime(2024, 1, 15, 8, 0), datetime(2024, 1, 15, 18, 0))
                ],
                current_location=(25.0400, 121.5600),
                max_deliveries=10,
                vehicle_id=1,
                vehicle_capacity={"16kg": 20, "20kg": 15, "50kg": 5}
            ),
            DriverAvailability(
                driver_id=11,
                employee_id="EMP002",
                name="Driver B",
                available_hours=[
                    (datetime(2024, 1, 15, 10, 0), datetime(2024, 1, 15, 16, 0))
                ],
                current_location=(25.0500, 121.5200),
                max_deliveries=8,
                vehicle_id=2,
                vehicle_capacity={"16kg": 15, "20kg": 10, "50kg": 3}
            )
        ]
        
        # Create test vehicles
        self.vehicles = [
            VehicleInfo(
                vehicle_id=1,
                plate_number="ABC-123",
                capacity={"16kg": 20, "20kg": 15, "50kg": 5},
                fuel_efficiency=10.0,
                max_distance=200.0
            ),
            VehicleInfo(
                vehicle_id=2,
                plate_number="XYZ-789",
                capacity={"16kg": 15, "20kg": 10, "50kg": 3},
                fuel_efficiency=12.0,
                max_distance=150.0
            )
        ]
    
    def test_generate_schedule_greedy(self):
        """Test schedule generation with greedy algorithm."""
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE],
            max_iterations=100,
            time_limit_seconds=60
        )
        
        result = self.engine.generate_schedule(
            self.delivery_requests,
            self.driver_availability,
            self.vehicles,
            parameters,
            algorithm='greedy'
        )
        
        self.assertTrue(result.success)
        self.assertGreater(len(result.schedule), 0)
        self.assertEqual(result.algorithm_used, "Greedy Scheduler")
        
        # Check metrics
        self.assertIn('scheduled_deliveries', result.metrics)
        self.assertIn('unscheduled_deliveries', result.metrics)
        self.assertIn('drivers_used', result.metrics)
        
        # Verify all scheduled entries have required fields
        for entry in result.schedule:
            self.assertIsInstance(entry, ScheduleEntry)
            self.assertIsNotNone(entry.delivery_id)
            self.assertIsNotNone(entry.driver_id)
            self.assertIsNotNone(entry.time_slot)
    
    def test_generate_schedule_genetic(self):
        """Test schedule generation with genetic algorithm."""
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[
                OptimizationObjective.MINIMIZE_DISTANCE,
                OptimizationObjective.BALANCE_WORKLOAD
            ],
            max_iterations=50,  # Less iterations for testing
            time_limit_seconds=10
        )
        
        result = self.engine.generate_schedule(
            self.delivery_requests,
            self.driver_availability,
            self.vehicles,
            parameters,
            algorithm='genetic'
        )
        
        self.assertTrue(result.success)
        self.assertEqual(result.algorithm_used, "Genetic Algorithm Scheduler")
        self.assertIn('generations_completed', result.metrics)
    
    def test_generate_schedule_simulated_annealing(self):
        """Test schedule generation with simulated annealing."""
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MAXIMIZE_UTILIZATION],
            max_iterations=100,
            time_limit_seconds=10
        )
        
        result = self.engine.generate_schedule(
            self.delivery_requests,
            self.driver_availability,
            self.vehicles,
            parameters,
            algorithm='simulated_annealing'
        )
        
        self.assertTrue(result.success)
        self.assertEqual(result.algorithm_used, "Simulated Annealing Scheduler")
        self.assertIn('iterations', result.metrics)
    
    def test_optimize_existing_schedule(self):
        """Test optimizing an existing schedule."""
        # Create existing schedule
        existing_schedule = [
            ScheduleEntry(
                delivery_id=1,
                client_id=100,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=datetime(2024, 1, 15, 8, 0),
                    end_time=datetime(2024, 1, 15, 8, 30)
                ),
                service_duration=30,
                priority=1,
                location=(25.0330, 121.5654)
            ),
            ScheduleEntry(
                delivery_id=2,
                client_id=101,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=datetime(2024, 1, 15, 14, 0),
                    end_time=datetime(2024, 1, 15, 14, 45)
                ),
                service_duration=45,
                priority=2,
                location=(25.0478, 121.5170)
            )
        ]
        
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE]
        )
        
        result = self.engine.optimize_existing_schedule(
            existing_schedule, parameters
        )
        
        self.assertTrue(result.success)
        self.assertEqual(len(result.schedule), 2)
    
    def test_constraint_handling(self):
        """Test constraint handling in schedule generation."""
        # Add tight time window constraint
        tight_requests = [
            DeliveryRequest(
                delivery_id=1,
                client_id=100,
                location=(25.0330, 121.5654),
                time_windows=[
                    (datetime(2024, 1, 15, 8, 0), datetime(2024, 1, 15, 9, 0))
                ],
                service_duration=45,  # Hard to fit in 1 hour window
                cylinder_type="16kg",
                quantity=2,
                priority=3
            )
        ]
        
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MAXIMIZE_TIME_COMPLIANCE]
        )
        
        result = self.engine.generate_schedule(
            tight_requests,
            self.driver_availability,
            self.vehicles,
            parameters
        )
        
        # Check if conflicts were detected
        if result.schedule:
            # Validate against constraints
            is_valid, errors = self.engine.validate_schedule(result.schedule)
            
            if not is_valid:
                self.assertGreater(len(errors), 0)
    
    def test_route_generation(self):
        """Test route generation from schedule."""
        # Generate a schedule first
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE]
        )
        
        result = self.engine.generate_schedule(
            self.delivery_requests,
            self.driver_availability,
            self.vehicles,
            parameters
        )
        
        self.assertTrue(result.success)
        
        # Check if routes were generated
        self.assertIn('routes', result.metrics)
        routes_count = result.metrics['routes']
        self.assertGreater(routes_count, 0)
    
    def test_statistics_calculation(self):
        """Test statistics calculation."""
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.BALANCE_WORKLOAD]
        )
        
        result = self.engine.generate_schedule(
            self.delivery_requests,
            self.driver_availability,
            self.vehicles,
            parameters
        )
        
        self.assertTrue(result.success)
        self.assertIn('statistics', result.metrics)
        
        stats = result.metrics['statistics']
        self.assertIn('total_requests', stats)
        self.assertIn('scheduled_requests', stats)
        self.assertIn('average_deliveries_per_driver', stats)
        self.assertIn('time_window_compliance_rate', stats)
    
    def test_conflict_resolution(self):
        """Test conflict resolution functionality."""
        # Create requests that will conflict
        conflicting_requests = [
            DeliveryRequest(
                delivery_id=1,
                client_id=100,
                location=(25.0330, 121.5654),
                time_windows=[
                    (datetime(2024, 1, 15, 10, 0), datetime(2024, 1, 15, 11, 0))
                ],
                service_duration=30,
                cylinder_type="16kg",
                quantity=2,
                priority=2
            ),
            DeliveryRequest(
                delivery_id=2,
                client_id=101,
                location=(25.0478, 121.5170),
                time_windows=[
                    (datetime(2024, 1, 15, 10, 15), datetime(2024, 1, 15, 11, 0))
                ],
                service_duration=30,
                cylinder_type="20kg",
                quantity=1,
                priority=1
            )
        ]
        
        # Use single driver to force conflict
        single_driver = [self.driver_availability[0]]
        
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MAXIMIZE_TIME_COMPLIANCE]
        )
        
        result = self.engine.generate_schedule(
            conflicting_requests,
            single_driver,
            self.vehicles,
            parameters
        )
        
        # Should handle conflicts somehow
        if result.success:
            # Check if conflicts were resolved
            conflicts = self.engine.detect_schedule_conflicts(result.schedule)
            
            # Log any remaining conflicts
            if conflicts:
                self.assertIn('conflicts_resolved', result.metrics)
    
    def test_empty_inputs(self):
        """Test handling of empty inputs."""
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE]
        )
        
        # Empty delivery requests
        result = self.engine.generate_schedule(
            [],
            self.driver_availability,
            self.vehicles,
            parameters
        )
        
        self.assertTrue(result.success)
        self.assertEqual(len(result.schedule), 0)
        
        # Empty drivers
        result = self.engine.generate_schedule(
            self.delivery_requests,
            [],
            self.vehicles,
            parameters
        )
        
        # Should fail or have unscheduled deliveries
        if result.success:
            self.assertEqual(result.metrics['scheduled_deliveries'], 0)
    
    def test_schedule_metrics(self):
        """Test schedule metrics calculation."""
        # Create a simple schedule
        schedule = [
            ScheduleEntry(
                delivery_id=1,
                client_id=100,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=datetime(2024, 1, 15, 8, 0),
                    end_time=datetime(2024, 1, 15, 8, 30)
                ),
                service_duration=30,
                location=(25.0330, 121.5654)
            ),
            ScheduleEntry(
                delivery_id=2,
                client_id=101,
                driver_id=10,
                vehicle_id=1,
                time_slot=TimeSlot(
                    start_time=datetime(2024, 1, 15, 9, 0),
                    end_time=datetime(2024, 1, 15, 9, 45)
                ),
                service_duration=45,
                location=(25.0478, 121.5170)
            )
        ]
        
        metrics = self.engine.get_schedule_metrics(schedule)
        
        self.assertIn('total_deliveries', metrics)
        self.assertEqual(metrics['total_deliveries'], 2)
        self.assertIn('drivers_used', metrics)
        self.assertEqual(metrics['drivers_used'], 1)
        self.assertIn('total_service_time', metrics)
        self.assertEqual(metrics['total_service_time'], 75)  # 30 + 45
        
    def test_invalid_algorithm(self):
        """Test handling of invalid algorithm name."""
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE]
        )
        
        result = self.engine.generate_schedule(
            self.delivery_requests,
            self.driver_availability,
            self.vehicles,
            parameters,
            algorithm='invalid_algorithm'
        )
        
        # Should default to greedy
        self.assertTrue(result.success)
        self.assertEqual(result.algorithm_used, "Greedy Scheduler")


if __name__ == '__main__':
    unittest.main()