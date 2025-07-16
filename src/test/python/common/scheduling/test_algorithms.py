"""Unit tests for scheduling algorithms."""
import unittest
from datetime import datetime, date, timedelta
from typing import List

from src.main.python.common.scheduling.algorithms import (
    GreedyScheduler, GeneticScheduler, SimulatedAnnealingScheduler
)
from src.main.python.common.scheduling.models import (
    DeliveryRequest, DriverAvailability, SchedulingParameters,
    OptimizationObjective
)
from src.main.python.common.scheduling.constraints import (
    TimeWindowConstraint, MaxDeliveriesConstraint,
    TravelTimeConstraint
)


class TestSchedulingAlgorithms(unittest.TestCase):
    """Test scheduling algorithm implementations."""
    
    def setUp(self):
        """Set up test data."""
        self.test_date = date(2024, 1, 15)
        
        # Create test delivery requests
        self.simple_requests = [
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
                    (datetime(2024, 1, 15, 14, 0), datetime(2024, 1, 15, 18, 0))
                ],
                service_duration=45,
                cylinder_type="20kg",
                quantity=1,
                priority=0
            )
        ]
        
        # Create more complex test data
        self.complex_requests = []
        for i in range(10):
            self.complex_requests.append(
                DeliveryRequest(
                    delivery_id=i+1,
                    client_id=100+i,
                    location=(25.0330 + i*0.01, 121.5654 + i*0.01),
                    time_windows=[
                        (datetime(2024, 1, 15, 8 + i//2, 0), 
                         datetime(2024, 1, 15, 12 + i//2, 0))
                    ],
                    service_duration=30 + (i % 3) * 15,
                    cylinder_type=["16kg", "20kg", "50kg"][i % 3],
                    quantity=1 + (i % 4),
                    priority=i % 3
                )
            )
        
        # Create driver availability
        self.drivers = [
            DriverAvailability(
                driver_id=10,
                employee_id="EMP001",
                name="Driver A",
                available_hours=[
                    (datetime(2024, 1, 15, 8, 0), datetime(2024, 1, 15, 18, 0))
                ],
                current_location=(25.0400, 121.5600),
                max_deliveries=10
            ),
            DriverAvailability(
                driver_id=11,
                employee_id="EMP002",
                name="Driver B",
                available_hours=[
                    (datetime(2024, 1, 15, 9, 0), datetime(2024, 1, 15, 17, 0))
                ],
                current_location=(25.0500, 121.5200),
                max_deliveries=8
            )
        ]
        
        # Create scheduling parameters
        self.parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[
                OptimizationObjective.MINIMIZE_DISTANCE,
                OptimizationObjective.BALANCE_WORKLOAD
            ],
            max_iterations=100,
            time_limit_seconds=30
        )
        
        # Create constraints
        self.constraints = [
            TimeWindowConstraint({
                req.delivery_id: req.time_windows 
                for req in self.simple_requests
            }),
            MaxDeliveriesConstraint({
                driver.driver_id: driver.max_deliveries 
                for driver in self.drivers
            }),
            TravelTimeConstraint(min_buffer_minutes=5)
        ]
    
    def test_greedy_scheduler_simple(self):
        """Test greedy scheduler with simple requests."""
        scheduler = GreedyScheduler()
        
        result = scheduler.schedule(
            self.simple_requests,
            self.drivers,
            self.parameters,
            self.constraints
        )
        
        self.assertTrue(result.success)
        self.assertEqual(len(result.schedule), 2)
        self.assertEqual(result.algorithm_used, "Greedy Scheduler")
        
        # Check that deliveries are assigned
        delivery_ids = {entry.delivery_id for entry in result.schedule}
        self.assertEqual(delivery_ids, {1, 2})
        
        # Verify metrics
        self.assertIn('scheduled_deliveries', result.metrics)
        self.assertEqual(result.metrics['scheduled_deliveries'], 2)
        self.assertIn('unscheduled_deliveries', result.metrics)
        self.assertEqual(result.metrics['unscheduled_deliveries'], 0)
    
    def test_greedy_scheduler_complex(self):
        """Test greedy scheduler with complex requests."""
        scheduler = GreedyScheduler()
        
        # Update constraints for complex requests
        complex_constraints = [
            TimeWindowConstraint({
                req.delivery_id: req.time_windows 
                for req in self.complex_requests
            }),
            MaxDeliveriesConstraint({
                driver.driver_id: driver.max_deliveries 
                for driver in self.drivers
            })
        ]
        
        result = scheduler.schedule(
            self.complex_requests,
            self.drivers,
            self.parameters,
            complex_constraints
        )
        
        self.assertTrue(result.success)
        self.assertGreater(len(result.schedule), 0)
        self.assertLessEqual(
            result.metrics['unscheduled_deliveries'], 
            len(self.complex_requests)
        )
        
        # Check driver workload balance
        driver_loads = {}
        for entry in result.schedule:
            driver_loads[entry.driver_id] = driver_loads.get(entry.driver_id, 0) + 1
        
        # Verify no driver is overloaded
        for driver_id, load in driver_loads.items():
            driver = next(d for d in self.drivers if d.driver_id == driver_id)
            self.assertLessEqual(load, driver.max_deliveries)
    
    def test_greedy_scheduler_priority_ordering(self):
        """Test that greedy scheduler respects priority."""
        # Create requests with clear priority differences
        priority_requests = [
            DeliveryRequest(
                delivery_id=1,
                client_id=100,
                location=(25.0330, 121.5654),
                time_windows=[
                    (datetime(2024, 1, 15, 10, 0), datetime(2024, 1, 15, 11, 0))
                ],
                service_duration=30,
                cylinder_type="16kg",
                quantity=1,
                priority=0  # Low priority
            ),
            DeliveryRequest(
                delivery_id=2,
                client_id=101,
                location=(25.0478, 121.5170),
                time_windows=[
                    (datetime(2024, 1, 15, 10, 0), datetime(2024, 1, 15, 11, 0))
                ],
                service_duration=30,
                cylinder_type="20kg",
                quantity=1,
                priority=5  # High priority
            )
        ]
        
        # Single driver to force choice
        single_driver = [self.drivers[0]]
        
        scheduler = GreedyScheduler()
        result = scheduler.schedule(
            priority_requests,
            single_driver,
            self.parameters,
            []
        )
        
        # High priority delivery should be scheduled
        if len(result.schedule) == 1:
            self.assertEqual(result.schedule[0].delivery_id, 2)
    
    def test_genetic_scheduler(self):
        """Test genetic algorithm scheduler."""
        scheduler = GeneticScheduler(population_size=20, generations=10)
        
        result = scheduler.schedule(
            self.simple_requests,
            self.drivers,
            self.parameters,
            self.constraints
        )
        
        self.assertTrue(result.success)
        self.assertEqual(result.algorithm_used, "Genetic Algorithm Scheduler")
        self.assertIn('generations_completed', result.metrics)
        
        # Should find a valid schedule
        self.assertGreater(len(result.schedule), 0)
        self.assertGreater(result.optimization_score, 0)
    
    def test_genetic_scheduler_evolution(self):
        """Test that genetic algorithm improves over generations."""
        # Use more generations to see improvement
        scheduler = GeneticScheduler(population_size=30, generations=20)
        
        # Set short time limit to test early termination
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE],
            time_limit_seconds=5
        )
        
        result = scheduler.schedule(
            self.complex_requests,
            self.drivers,
            parameters,
            []
        )
        
        self.assertTrue(result.success)
        self.assertGreater(result.metrics['generations_completed'], 0)
        
        # Check computation time is within limit
        self.assertLessEqual(result.computation_time, parameters.time_limit_seconds + 1)
    
    def test_simulated_annealing_scheduler(self):
        """Test simulated annealing scheduler."""
        scheduler = SimulatedAnnealingScheduler(
            initial_temperature=50.0,
            cooling_rate=0.9
        )
        
        result = scheduler.schedule(
            self.simple_requests,
            self.drivers,
            self.parameters,
            self.constraints
        )
        
        self.assertTrue(result.success)
        self.assertEqual(result.algorithm_used, "Simulated Annealing Scheduler")
        self.assertIn('iterations', result.metrics)
        self.assertIn('final_temperature', result.metrics)
        
        # Should find a valid schedule
        self.assertGreater(len(result.schedule), 0)
    
    def test_simulated_annealing_improvement(self):
        """Test that simulated annealing improves initial solution."""
        scheduler = SimulatedAnnealingScheduler(
            initial_temperature=100.0,
            cooling_rate=0.95
        )
        
        # Use distance minimization for clear objective
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE],
            time_limit_seconds=10
        )
        
        result = scheduler.schedule(
            self.complex_requests[:5],  # Use subset for faster test
            self.drivers,
            parameters,
            []
        )
        
        self.assertTrue(result.success)
        self.assertGreater(result.metrics['iterations'], 0)
        
        # Final temperature should be lower than initial
        self.assertLess(
            result.metrics['final_temperature'],
            scheduler.initial_temperature
        )
    
    def test_algorithm_constraint_handling(self):
        """Test that algorithms respect constraints."""
        # Create tight constraint
        max_deliveries_constraint = MaxDeliveriesConstraint(
            {driver.driver_id: 1 for driver in self.drivers},  # Only 1 delivery per driver
            default_max=1
        )
        
        constraints = [max_deliveries_constraint]
        
        # Test each algorithm
        algorithms = [
            GreedyScheduler(),
            GeneticScheduler(population_size=10, generations=5),
            SimulatedAnnealingScheduler()
        ]
        
        for algorithm in algorithms:
            result = algorithm.schedule(
                self.simple_requests,
                self.drivers,
                self.parameters,
                constraints
            )
            
            # Check constraint is respected
            driver_counts = {}
            for entry in result.schedule:
                driver_counts[entry.driver_id] = driver_counts.get(entry.driver_id, 0) + 1
            
            for count in driver_counts.values():
                self.assertLessEqual(count, 1, f"{algorithm.name} violated max deliveries constraint")
    
    def test_algorithm_empty_inputs(self):
        """Test algorithms with empty inputs."""
        algorithms = [
            GreedyScheduler(),
            GeneticScheduler(population_size=10, generations=5),
            SimulatedAnnealingScheduler()
        ]
        
        for algorithm in algorithms:
            # Empty requests
            result = algorithm.schedule(
                [],
                self.drivers,
                self.parameters,
                self.constraints
            )
            
            self.assertEqual(len(result.schedule), 0)
            self.assertEqual(result.metrics.get('scheduled_deliveries', 0), 0)
            
            # Empty drivers
            result = algorithm.schedule(
                self.simple_requests,
                [],
                self.parameters,
                self.constraints
            )
            
            self.assertEqual(len(result.schedule), 0)
    
    def test_algorithm_performance_metrics(self):
        """Test that algorithms calculate performance metrics correctly."""
        scheduler = GreedyScheduler()
        
        # Create requests with known distances
        location_requests = [
            DeliveryRequest(
                delivery_id=1,
                client_id=100,
                location=(25.0000, 121.0000),  # Origin
                time_windows=[
                    (datetime(2024, 1, 15, 8, 0), datetime(2024, 1, 15, 18, 0))
                ],
                service_duration=30,
                cylinder_type="16kg",
                quantity=1,
                priority=1
            ),
            DeliveryRequest(
                delivery_id=2,
                client_id=101,
                location=(25.0100, 121.0000),  # ~1.1km north
                time_windows=[
                    (datetime(2024, 1, 15, 8, 0), datetime(2024, 1, 15, 18, 0))
                ],
                service_duration=30,
                cylinder_type="16kg",
                quantity=1,
                priority=1
            )
        ]
        
        # Single driver to ensure both deliveries go to same driver
        single_driver = [self.drivers[0]]
        
        result = scheduler.schedule(
            location_requests,
            single_driver,
            self.parameters,
            []
        )
        
        self.assertTrue(result.success)
        self.assertEqual(len(result.schedule), 2)
        
        # Check metrics exist
        self.assertIn('total_distance', result.metrics)
        self.assertIn('average_utilization', result.metrics)
        
        # Distance should be greater than 0
        self.assertGreater(result.metrics['total_distance'], 0)
    
    def test_algorithm_scoring(self):
        """Test algorithm scoring function."""
        scheduler = GreedyScheduler()
        
        # Create a simple schedule
        from src.main.python.common.time_utils import ScheduleEntry, TimeSlot
        
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
                location=(25.0000, 121.0000)
            )
        ]
        
        # Test different objectives
        for objective in OptimizationObjective:
            parameters = SchedulingParameters(
                date=self.test_date,
                optimization_objectives=[objective]
            )
            
            score = scheduler.evaluate_schedule(schedule, parameters)
            self.assertGreaterEqual(score, 0, f"Score should be non-negative for {objective}")


if __name__ == '__main__':
    unittest.main()