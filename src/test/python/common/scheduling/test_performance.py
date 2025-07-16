"""Performance tests for the scheduling system."""
import unittest
import time
import random
from datetime import datetime, date, timedelta
from typing import List

from src.main.python.common.scheduling.engine import SchedulingEngine
from src.main.python.common.scheduling.models import (
    DeliveryRequest, DriverAvailability, VehicleInfo,
    SchedulingParameters, OptimizationObjective
)


class TestSchedulingPerformance(unittest.TestCase):
    """Performance tests for scheduling algorithms."""
    
    def setUp(self):
        """Set up test data."""
        self.engine = SchedulingEngine()
        self.test_date = date(2024, 1, 15)
        
    def generate_test_data(self, num_deliveries: int, num_drivers: int, num_vehicles: int):
        """Generate test data for performance testing."""
        # Generate delivery requests
        delivery_requests = []
        for i in range(num_deliveries):
            # Random location in Taitung area
            lat = 22.7553 + random.uniform(-0.1, 0.1)
            lon = 121.1504 + random.uniform(-0.1, 0.1)
            
            # Random time windows
            start_hour = random.choice([8, 9, 10, 14, 15, 16])
            end_hour = start_hour + random.choice([2, 3, 4])
            
            request = DeliveryRequest(
                delivery_id=i + 1,
                client_id=i + 100,
                location=(lat, lon),
                time_windows=[
                    (datetime.combine(self.test_date, datetime.min.time()).replace(hour=start_hour),
                     datetime.combine(self.test_date, datetime.min.time()).replace(hour=end_hour))
                ],
                service_duration=random.randint(15, 45),
                cylinder_type=random.choice(["16kg", "20kg", "50kg"]),
                quantity=random.randint(1, 5),
                priority=random.randint(0, 3)
            )
            delivery_requests.append(request)
        
        # Generate driver availability
        driver_availability = []
        for i in range(num_drivers):
            availability = DriverAvailability(
                driver_id=i + 10,
                employee_id=f"EMP{i+1:03d}",
                name=f"Driver {i+1}",
                available_hours=[
                    (datetime.combine(self.test_date, datetime.min.time()).replace(hour=8),
                     datetime.combine(self.test_date, datetime.min.time()).replace(hour=18))
                ],
                current_location=(22.7553, 121.1504),
                max_deliveries=20
            )
            driver_availability.append(availability)
        
        # Generate vehicle info
        vehicle_info = []
        for i in range(num_vehicles):
            info = VehicleInfo(
                vehicle_id=i + 1,
                plate_number=f"ABC-{i+100:03d}",
                capacity={"16kg": 40, "20kg": 30, "50kg": 10},
                fuel_efficiency=10.0,
                max_distance=200.0
            )
            vehicle_info.append(info)
        
        return delivery_requests, driver_availability, vehicle_info
    
    def test_greedy_performance_small(self):
        """Test greedy algorithm performance with small dataset."""
        # Small dataset: 20 deliveries, 3 drivers, 3 vehicles
        deliveries, drivers, vehicles = self.generate_test_data(20, 3, 3)
        
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE]
        )
        
        start_time = time.time()
        result = self.engine.generate_schedule(
            deliveries, drivers, vehicles, parameters, algorithm='greedy'
        )
        end_time = time.time()
        
        self.assertTrue(result.success)
        self.assertLess(end_time - start_time, 1.0)  # Should complete in under 1 second
        self.assertGreater(len(result.schedule), 0)
        
        print(f"\nGreedy (Small): {len(deliveries)} deliveries in {end_time - start_time:.3f}s")
        print(f"  Scheduled: {len(result.schedule)}/{len(deliveries)}")
        print(f"  Routes: {result.metrics.get('drivers_used', 0)}")
    
    def test_greedy_performance_medium(self):
        """Test greedy algorithm performance with medium dataset."""
        # Medium dataset: 100 deliveries, 10 drivers, 10 vehicles
        deliveries, drivers, vehicles = self.generate_test_data(100, 10, 10)
        
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[
                OptimizationObjective.MINIMIZE_DISTANCE,
                OptimizationObjective.BALANCE_WORKLOAD
            ]
        )
        
        start_time = time.time()
        result = self.engine.generate_schedule(
            deliveries, drivers, vehicles, parameters, algorithm='greedy'
        )
        end_time = time.time()
        
        self.assertTrue(result.success)
        self.assertLess(end_time - start_time, 5.0)  # Should complete in under 5 seconds
        
        print(f"\nGreedy (Medium): {len(deliveries)} deliveries in {end_time - start_time:.3f}s")
        print(f"  Scheduled: {len(result.schedule)}/{len(deliveries)}")
        print(f"  Routes: {result.metrics.get('drivers_used', 0)}")
        print(f"  Distance: {result.metrics.get('total_distance', 0):.1f}km")
    
    def test_greedy_performance_large(self):
        """Test greedy algorithm performance with large dataset."""
        # Large dataset: 500 deliveries, 20 drivers, 20 vehicles
        deliveries, drivers, vehicles = self.generate_test_data(500, 20, 20)
        
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE]
        )
        
        start_time = time.time()
        result = self.engine.generate_schedule(
            deliveries, drivers, vehicles, parameters, algorithm='greedy'
        )
        end_time = time.time()
        
        self.assertTrue(result.success)
        self.assertLess(end_time - start_time, 30.0)  # Should complete in under 30 seconds
        
        print(f"\nGreedy (Large): {len(deliveries)} deliveries in {end_time - start_time:.3f}s")
        print(f"  Scheduled: {len(result.schedule)}/{len(deliveries)}")
        print(f"  Routes: {result.metrics.get('drivers_used', 0)}")
        print(f"  Utilization: {result.metrics.get('average_utilization', 0):.1f}%")
    
    def test_genetic_performance_small(self):
        """Test genetic algorithm performance with small dataset."""
        deliveries, drivers, vehicles = self.generate_test_data(20, 3, 3)
        
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE],
            max_iterations=50,
            time_limit_seconds=10
        )
        
        start_time = time.time()
        result = self.engine.generate_schedule(
            deliveries, drivers, vehicles, parameters, algorithm='genetic'
        )
        end_time = time.time()
        
        self.assertTrue(result.success)
        self.assertLess(end_time - start_time, 15.0)  # Should respect time limit
        
        print(f"\nGenetic (Small): {len(deliveries)} deliveries in {end_time - start_time:.3f}s")
        print(f"  Scheduled: {len(result.schedule)}/{len(deliveries)}")
        print(f"  Generations: {result.metrics.get('generations_completed', 0)}")
        print(f"  Score: {result.optimization_score:.2f}")
    
    def test_simulated_annealing_performance_small(self):
        """Test simulated annealing performance with small dataset."""
        deliveries, drivers, vehicles = self.generate_test_data(20, 3, 3)
        
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE],
            time_limit_seconds=5
        )
        
        start_time = time.time()
        result = self.engine.generate_schedule(
            deliveries, drivers, vehicles, parameters, algorithm='simulated_annealing'
        )
        end_time = time.time()
        
        self.assertTrue(result.success)
        self.assertLess(end_time - start_time, 10.0)
        
        print(f"\nSimulated Annealing (Small): {len(deliveries)} deliveries in {end_time - start_time:.3f}s")
        print(f"  Scheduled: {len(result.schedule)}/{len(deliveries)}")
        print(f"  Iterations: {result.metrics.get('iterations', 0)}")
        print(f"  Final Temperature: {result.metrics.get('final_temperature', 0):.2f}")
    
    def test_algorithm_comparison(self):
        """Compare performance of different algorithms."""
        # Generate common test data
        deliveries, drivers, vehicles = self.generate_test_data(50, 5, 5)
        
        parameters = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[
                OptimizationObjective.MINIMIZE_DISTANCE,
                OptimizationObjective.MAXIMIZE_TIME_COMPLIANCE
            ],
            time_limit_seconds=10
        )
        
        algorithms = ['greedy', 'genetic', 'simulated_annealing']
        results = {}
        
        print("\n=== Algorithm Comparison (50 deliveries) ===")
        
        for algorithm in algorithms:
            start_time = time.time()
            result = self.engine.generate_schedule(
                deliveries, drivers, vehicles, parameters, algorithm=algorithm
            )
            end_time = time.time()
            
            results[algorithm] = {
                'time': end_time - start_time,
                'scheduled': len(result.schedule),
                'distance': result.metrics.get('total_distance', 0),
                'utilization': result.metrics.get('average_utilization', 0),
                'score': result.optimization_score
            }
            
            print(f"\n{algorithm.title()}:")
            print(f"  Time: {results[algorithm]['time']:.3f}s")
            print(f"  Scheduled: {results[algorithm]['scheduled']}/{len(deliveries)}")
            print(f"  Distance: {results[algorithm]['distance']:.1f}km")
            print(f"  Utilization: {results[algorithm]['utilization']:.1f}%")
            print(f"  Score: {results[algorithm]['score']:.2f}")
        
        # Verify greedy is fastest
        self.assertLess(results['greedy']['time'], results['genetic']['time'])
        self.assertLess(results['greedy']['time'], results['simulated_annealing']['time'])
    
    def test_scaling_performance(self):
        """Test how performance scales with problem size."""
        sizes = [10, 50, 100, 200]
        
        print("\n=== Scaling Performance Test (Greedy) ===")
        print("Size\tTime(s)\tScheduled\tTime/Delivery")
        
        for size in sizes:
            deliveries, drivers, vehicles = self.generate_test_data(
                size, 
                max(3, size // 10),  # Scale drivers with deliveries
                max(3, size // 10)   # Scale vehicles with deliveries
            )
            
            parameters = SchedulingParameters(
                date=self.test_date,
                optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE]
            )
            
            start_time = time.time()
            result = self.engine.generate_schedule(
                deliveries, drivers, vehicles, parameters, algorithm='greedy'
            )
            end_time = time.time()
            
            elapsed = end_time - start_time
            scheduled = len(result.schedule)
            time_per_delivery = elapsed / size
            
            print(f"{size}\t{elapsed:.3f}\t{scheduled}\t\t{time_per_delivery:.4f}")
            
            # Performance should scale reasonably
            self.assertLess(time_per_delivery, 0.1)  # Less than 100ms per delivery
    
    def test_constraint_impact_on_performance(self):
        """Test how constraints impact performance."""
        deliveries, drivers, vehicles = self.generate_test_data(50, 5, 5)
        
        # Test with minimal constraints
        parameters_minimal = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[OptimizationObjective.MINIMIZE_DISTANCE],
            allow_overtime=True
        )
        
        start_time = time.time()
        result_minimal = self.engine.generate_schedule(
            deliveries, drivers, vehicles, parameters_minimal, algorithm='greedy'
        )
        time_minimal = time.time() - start_time
        
        # Test with strict constraints
        parameters_strict = SchedulingParameters(
            date=self.test_date,
            optimization_objectives=[
                OptimizationObjective.MINIMIZE_DISTANCE,
                OptimizationObjective.MAXIMIZE_TIME_COMPLIANCE,
                OptimizationObjective.BALANCE_WORKLOAD
            ],
            allow_overtime=False
        )
        
        start_time = time.time()
        result_strict = self.engine.generate_schedule(
            deliveries, drivers, vehicles, parameters_strict, algorithm='greedy'
        )
        time_strict = time.time() - start_time
        
        print("\n=== Constraint Impact ===")
        print(f"Minimal constraints: {time_minimal:.3f}s, scheduled: {len(result_minimal.schedule)}")
        print(f"Strict constraints: {time_strict:.3f}s, scheduled: {len(result_strict.schedule)}")
        
        # Strict constraints should take more time but might schedule fewer deliveries
        self.assertGreater(time_strict, time_minimal * 0.8)  # Allow some variance


def run_performance_tests():
    """Run performance tests and print summary."""
    suite = unittest.TestLoader().loadTestsFromTestCase(TestSchedulingPerformance)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    run_performance_tests()