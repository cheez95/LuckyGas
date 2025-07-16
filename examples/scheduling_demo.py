"""Demo script showing how to use the advanced scheduling system."""
import requests
import json
from datetime import date, datetime, timedelta
from typing import Dict, List


class SchedulingDemo:
    """Demo class for the scheduling API."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize demo with API base URL."""
        self.base_url = base_url
        self.api_url = f"{base_url}/api/scheduling"
    
    def generate_schedule(self, schedule_date: str, algorithm: str = "greedy") -> Dict:
        """
        Generate optimized schedule for a given date.
        
        Args:
            schedule_date: Date in YYYY-MM-DD format
            algorithm: Algorithm to use (greedy, genetic, simulated_annealing)
            
        Returns:
            Schedule response
        """
        request_data = {
            "schedule_date": schedule_date,
            "algorithm": algorithm,
            "optimization_objectives": ["minimize_distance", "balance_workload"],
            "max_iterations": 1000,
            "time_limit_seconds": 30,
            "allow_overtime": False,
            "travel_speed_kmh": 30.0,
            "max_deliveries_per_route": 20
        }
        
        response = requests.post(
            f"{self.api_url}/generate",
            json=request_data
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return None
    
    def apply_schedule(self, schedule_date: str, routes: List[Dict]) -> bool:
        """
        Apply generated schedule to create routes in database.
        
        Args:
            schedule_date: Date of the schedule
            routes: Route data from generate_schedule
            
        Returns:
            True if successful
        """
        request_data = {
            "schedule_date": schedule_date,
            "route_data": routes
        }
        
        response = requests.post(
            f"{self.api_url}/apply",
            json=request_data
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ {result['message']}")
            return True
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return False
    
    def get_conflicts(self, schedule_date: str) -> Dict:
        """
        Get scheduling conflicts for a date.
        
        Args:
            schedule_date: Date to check
            
        Returns:
            Conflict information
        """
        response = requests.get(f"{self.api_url}/conflicts/{schedule_date}")
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return None
    
    def get_metrics(self, schedule_date: str) -> Dict:
        """
        Get performance metrics for scheduled routes.
        
        Args:
            schedule_date: Date to analyze
            
        Returns:
            Performance metrics
        """
        response = requests.get(f"{self.api_url}/metrics/{schedule_date}")
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return None
    
    def print_schedule_summary(self, schedule: Dict):
        """Print a summary of the generated schedule."""
        print("\n=== Schedule Summary ===")
        print(f"Date: {schedule['schedule_date']}")
        print(f"Algorithm: {schedule['algorithm_used']}")
        print(f"Computation Time: {schedule['computation_time']:.2f} seconds")
        print(f"\nDeliveries: {schedule['scheduled_deliveries']}/{schedule['total_deliveries']}")
        print(f"Routes: {schedule['total_routes']}")
        print(f"Total Distance: {schedule['total_distance']:.1f} km")
        print(f"Average Utilization: {schedule['average_utilization']:.1f}%")
        
        if schedule['conflicts_count'] > 0:
            print(f"\n⚠️  Conflicts: {schedule['conflicts_count']}")
            for conflict in schedule['conflicts'][:3]:  # Show first 3
                print(f"  - {conflict['type']}: {conflict['description']}")
        
        if schedule['unscheduled_deliveries'] > 0:
            print(f"\n❌ Unscheduled: {schedule['unscheduled_deliveries']} clients")
            for client in schedule['unscheduled_clients'][:5]:  # Show first 5
                print(f"  - {client['client_name']} ({client['address']})")
        
        if schedule['warnings']:
            print("\n⚠️  Warnings:")
            for warning in schedule['warnings']:
                print(f"  - {warning}")
    
    def print_route_details(self, schedule: Dict):
        """Print detailed route information."""
        print("\n=== Route Details ===")
        
        for i, route in enumerate(schedule['routes'], 1):
            print(f"\nRoute {i}: {route['driver_name']}")
            print(f"  Vehicle: {route['vehicle_id']}")
            print(f"  Deliveries: {route['total_deliveries']}")
            print(f"  Time: {route['start_time']} - {route['end_time']}")
            
            # Show first few deliveries
            for j, delivery in enumerate(route['deliveries'][:3], 1):
                print(f"  {j}. {delivery['client_name']} - {delivery['scheduled_time']}")
            
            if len(route['deliveries']) > 3:
                print(f"  ... and {len(route['deliveries']) - 3} more")
    
    def compare_algorithms(self, schedule_date: str):
        """Compare performance of different algorithms."""
        algorithms = ['greedy', 'genetic', 'simulated_annealing']
        results = {}
        
        print(f"\n=== Algorithm Comparison for {schedule_date} ===")
        
        for algorithm in algorithms:
            print(f"\nTesting {algorithm}...")
            schedule = self.generate_schedule(schedule_date, algorithm)
            
            if schedule:
                results[algorithm] = {
                    'time': schedule['computation_time'],
                    'scheduled': schedule['scheduled_deliveries'],
                    'total': schedule['total_deliveries'],
                    'distance': schedule['total_distance'],
                    'utilization': schedule['average_utilization'],
                    'conflicts': schedule['conflicts_count']
                }
        
        # Print comparison table
        print("\n" + "=" * 80)
        print(f"{'Algorithm':<20} {'Time(s)':<10} {'Scheduled':<12} {'Distance(km)':<15} {'Utilization%':<15} {'Conflicts':<10}")
        print("=" * 80)
        
        for algo, metrics in results.items():
            print(f"{algo:<20} {metrics['time']:<10.2f} "
                  f"{metrics['scheduled']}/{metrics['total']:<11} "
                  f"{metrics['distance']:<15.1f} "
                  f"{metrics['utilization']:<15.1f} "
                  f"{metrics['conflicts']:<10}")


def main():
    """Main demo function."""
    demo = SchedulingDemo()
    
    # Use tomorrow's date for demo
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    
    print("🚚 LuckyGas Advanced Scheduling Demo")
    print("=" * 50)
    
    # 1. Generate schedule with greedy algorithm
    print(f"\n1. Generating schedule for {tomorrow} using Greedy algorithm...")
    schedule = demo.generate_schedule(tomorrow, "greedy")
    
    if schedule and schedule['success']:
        demo.print_schedule_summary(schedule)
        demo.print_route_details(schedule)
        
        # 2. Check for conflicts
        print("\n2. Checking for conflicts...")
        conflicts = demo.get_conflicts(tomorrow)
        if conflicts:
            print(f"Found {conflicts['conflict_count']} conflicts")
        
        # 3. Get performance metrics
        print("\n3. Getting performance metrics...")
        metrics = demo.get_metrics(tomorrow)
        if metrics and 'metrics' in metrics:
            m = metrics['metrics']
            print(f"  Total Distance: {m['total_distance_km']:.1f} km")
            print(f"  Driver Utilization: {m['driver_utilization_percent']:.1f}%")
            print(f"  Workload Balance: {m['workload_balance_score']:.1f}/100")
        
        # 4. Apply schedule (optional - uncomment to actually create routes)
        # print("\n4. Applying schedule...")
        # if demo.apply_schedule(tomorrow, schedule['routes']):
        #     print("Schedule successfully applied!")
        
        # 5. Compare algorithms
        print("\n5. Comparing different algorithms...")
        demo.compare_algorithms(tomorrow)
    
    else:
        print("❌ Failed to generate schedule")


if __name__ == "__main__":
    # Make sure the API server is running on localhost:8000
    try:
        main()
    except requests.exceptions.ConnectionError:
        print("❌ Error: Cannot connect to API server. Make sure it's running on http://localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")