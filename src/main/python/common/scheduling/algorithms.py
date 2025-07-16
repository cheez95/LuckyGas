"""Scheduling algorithms for LuckyGas delivery optimization."""
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime, timedelta
from abc import ABC, abstractmethod
import random
import math
from collections import defaultdict
import time as time_module
import logging

from ..time_utils import (
    ScheduleEntry, TimeSlot, calculate_travel_time,
    find_available_slots, optimize_schedule_order
)
from .models import (
    DeliveryRequest, DriverAvailability, SchedulingParameters,
    SchedulingResult, OptimizationObjective
)
from .constraints import SchedulingConstraint

logger = logging.getLogger(__name__)


class SchedulingAlgorithm(ABC):
    """Abstract base class for scheduling algorithms."""
    
    def __init__(self, name: str):
        """Initialize algorithm with name."""
        self.name = name
    
    @abstractmethod
    def schedule(self,
                delivery_requests: List[DeliveryRequest],
                driver_availability: List[DriverAvailability],
                parameters: SchedulingParameters,
                constraints: List[SchedulingConstraint]) -> SchedulingResult:
        """
        Generate schedule for deliveries.
        
        Args:
            delivery_requests: List of delivery requests
            driver_availability: List of available drivers
            parameters: Scheduling parameters
            constraints: List of constraints to satisfy
            
        Returns:
            SchedulingResult with optimized schedule
        """
        pass
    
    def evaluate_schedule(self, 
                         schedule: List[ScheduleEntry],
                         parameters: SchedulingParameters) -> float:
        """Evaluate schedule quality based on objectives."""
        score = 0.0
        
        # Calculate metrics
        total_distance = self._calculate_total_distance(schedule)
        utilization = self._calculate_utilization(schedule)
        time_compliance = self._calculate_time_compliance(schedule)
        workload_balance = self._calculate_workload_balance(schedule)
        
        # Apply weighted objectives
        for objective, weight in parameters.objective_weights.items():
            if objective == OptimizationObjective.MINIMIZE_DISTANCE:
                # Lower distance is better
                score += weight * (1000 / (total_distance + 1))
            elif objective == OptimizationObjective.MAXIMIZE_UTILIZATION:
                score += weight * utilization
            elif objective == OptimizationObjective.MAXIMIZE_TIME_COMPLIANCE:
                score += weight * time_compliance * 100
            elif objective == OptimizationObjective.BALANCE_WORKLOAD:
                score += weight * workload_balance * 100
        
        return score
    
    def _calculate_total_distance(self, schedule: List[ScheduleEntry]) -> float:
        """Calculate total travel distance."""
        driver_routes = defaultdict(list)
        for entry in schedule:
            if entry.location:
                driver_routes[entry.driver_id].append(entry)
        
        total_distance = 0.0
        for entries in driver_routes.values():
            sorted_entries = sorted(entries, key=lambda e: e.time_slot.start_time)
            for i in range(len(sorted_entries) - 1):
                if sorted_entries[i].location and sorted_entries[i+1].location:
                    travel_time = calculate_travel_time(
                        sorted_entries[i].location,
                        sorted_entries[i+1].location
                    )
                    # Approximate distance from travel time
                    distance = (travel_time / 60) * 30  # 30 km/h average
                    total_distance += distance
        
        return total_distance
    
    def _calculate_utilization(self, schedule: List[ScheduleEntry]) -> float:
        """Calculate driver utilization rate."""
        if not schedule:
            return 0.0
        
        driver_work_time = defaultdict(int)
        for entry in schedule:
            driver_work_time[entry.driver_id] += entry.service_duration
        
        # Assume 8-hour work day
        avg_utilization = sum(driver_work_time.values()) / (len(driver_work_time) * 480)
        return min(1.0, avg_utilization)
    
    def _calculate_time_compliance(self, schedule: List[ScheduleEntry]) -> float:
        """Calculate time window compliance rate."""
        # Simplified - in real implementation would check against actual time windows
        return 0.95
    
    def _calculate_workload_balance(self, schedule: List[ScheduleEntry]) -> float:
        """Calculate workload balance across drivers."""
        if not schedule:
            return 1.0
        
        driver_loads = defaultdict(int)
        for entry in schedule:
            driver_loads[entry.driver_id] += 1
        
        if not driver_loads:
            return 1.0
        
        loads = list(driver_loads.values())
        avg_load = sum(loads) / len(loads)
        variance = sum((load - avg_load) ** 2 for load in loads) / len(loads)
        std_dev = math.sqrt(variance)
        
        # Lower standard deviation means better balance
        return 1.0 / (1.0 + std_dev)


class GreedyScheduler(SchedulingAlgorithm):
    """Greedy scheduling algorithm - fast but not optimal."""
    
    def __init__(self):
        """Initialize greedy scheduler."""
        super().__init__("Greedy Scheduler")
    
    def schedule(self,
                delivery_requests: List[DeliveryRequest],
                driver_availability: List[DriverAvailability],
                parameters: SchedulingParameters,
                constraints: List[SchedulingConstraint]) -> SchedulingResult:
        """Generate schedule using greedy approach."""
        start_time = time_module.time()
        schedule = []
        unscheduled = []
        
        # Sort requests by priority and earliest time window
        sorted_requests = sorted(
            delivery_requests,
            key=lambda r: (-r.priority, min(tw[0] for tw in r.time_windows))
        )
        
        # Track driver schedules
        driver_schedules = {driver.driver_id: [] for driver in driver_availability}
        
        for request in sorted_requests:
            scheduled = False
            
            # Try each driver
            for driver in driver_availability:
                # Find available slots for this driver
                driver_entries = driver_schedules[driver.driver_id]
                
                for window_start, window_end in request.time_windows:
                    # Try to fit in this time window
                    slot_start = window_start
                    
                    # Check if slot is available
                    conflicts = False
                    for existing in driver_entries:
                        if (slot_start < existing.end_time and 
                            slot_start + timedelta(minutes=request.service_duration) > existing.time_slot.start_time):
                            conflicts = True
                            # Try after this delivery
                            slot_start = existing.end_time + timedelta(minutes=10)
                    
                    if not conflicts and slot_start + timedelta(minutes=request.service_duration) <= window_end:
                        # Create schedule entry
                        time_slot = TimeSlot(
                            start_time=slot_start,
                            end_time=slot_start + timedelta(minutes=request.service_duration)
                        )
                        
                        entry = ScheduleEntry(
                            delivery_id=request.delivery_id,
                            client_id=request.client_id,
                            driver_id=driver.driver_id,
                            vehicle_id=driver.vehicle_id or 1,  # Default vehicle
                            time_slot=time_slot,
                            service_duration=request.service_duration,
                            priority=request.priority,
                            location=request.location
                        )
                        
                        # Add to schedule
                        schedule.append(entry)
                        driver_schedules[driver.driver_id].append(entry)
                        scheduled = True
                        break
                
                if scheduled:
                    break
            
            if not scheduled:
                unscheduled.append(request)
        
        # Optimize each driver's route
        optimized_schedule = []
        for driver_id, entries in driver_schedules.items():
            if entries:
                optimized_entries = optimize_schedule_order(entries, "distance")
                optimized_schedule.extend(optimized_entries)
        
        computation_time = time_module.time() - start_time
        
        # Calculate metrics
        metrics = {
            "total_deliveries": len(delivery_requests),
            "scheduled_deliveries": len(schedule),
            "unscheduled_deliveries": len(unscheduled),
            "drivers_used": len([d for d in driver_schedules.values() if d]),
            "total_distance": self._calculate_total_distance(optimized_schedule),
            "average_utilization": self._calculate_utilization(optimized_schedule)
        }
        
        # Detect conflicts
        from ..time_utils import detect_conflicts
        conflicts = detect_conflicts(optimized_schedule)
        
        return SchedulingResult(
            schedule=optimized_schedule,
            metrics=metrics,
            conflicts=conflicts,
            optimization_score=self.evaluate_schedule(optimized_schedule, parameters),
            computation_time=computation_time,
            algorithm_used=self.name,
            parameters_used=parameters,
            success=len(unscheduled) == 0,
            error_message=f"{len(unscheduled)} deliveries could not be scheduled" if unscheduled else None
        )


class GeneticScheduler(SchedulingAlgorithm):
    """Genetic algorithm for schedule optimization."""
    
    def __init__(self, population_size: int = 50, generations: int = 100):
        """Initialize genetic scheduler."""
        super().__init__("Genetic Algorithm Scheduler")
        self.population_size = population_size
        self.generations = generations
    
    def schedule(self,
                delivery_requests: List[DeliveryRequest],
                driver_availability: List[DriverAvailability],
                parameters: SchedulingParameters,
                constraints: List[SchedulingConstraint]) -> SchedulingResult:
        """Generate schedule using genetic algorithm."""
        start_time = time_module.time()
        
        # Generate initial population
        population = self._generate_initial_population(
            delivery_requests, driver_availability, parameters
        )
        
        best_schedule = None
        best_score = -float('inf')
        
        for generation in range(self.generations):
            # Evaluate fitness
            fitness_scores = []
            for chromosome in population:
                schedule = self._chromosome_to_schedule(
                    chromosome, delivery_requests, driver_availability
                )
                score = self.evaluate_schedule(schedule, parameters)
                
                # Penalty for constraint violations
                for constraint in constraints:
                    score -= constraint.cost(schedule)
                
                fitness_scores.append((score, chromosome, schedule))
            
            # Sort by fitness
            fitness_scores.sort(key=lambda x: x[0], reverse=True)
            
            # Update best
            if fitness_scores[0][0] > best_score:
                best_score = fitness_scores[0][0]
                best_schedule = fitness_scores[0][2]
            
            # Check time limit
            if time_module.time() - start_time > parameters.time_limit_seconds:
                break
            
            # Selection and crossover
            new_population = []
            
            # Elite selection
            elite_count = self.population_size // 10
            for i in range(elite_count):
                new_population.append(fitness_scores[i][1])
            
            # Generate rest of population
            while len(new_population) < self.population_size:
                parent1 = self._tournament_selection(fitness_scores)
                parent2 = self._tournament_selection(fitness_scores)
                
                if random.random() < 0.8:  # Crossover probability
                    child1, child2 = self._crossover(parent1, parent2)
                    new_population.extend([child1, child2])
                else:
                    new_population.extend([parent1, parent2])
            
            # Mutation
            for i in range(elite_count, len(new_population)):
                if random.random() < 0.1:  # Mutation probability
                    new_population[i] = self._mutate(new_population[i])
            
            population = new_population[:self.population_size]
        
        computation_time = time_module.time() - start_time
        
        # Calculate final metrics
        if best_schedule:
            metrics = {
                "total_deliveries": len(delivery_requests),
                "scheduled_deliveries": len(best_schedule),
                "unscheduled_deliveries": len(delivery_requests) - len(best_schedule),
                "drivers_used": len(set(e.driver_id for e in best_schedule)),
                "total_distance": self._calculate_total_distance(best_schedule),
                "average_utilization": self._calculate_utilization(best_schedule),
                "generations_completed": generation + 1
            }
            
            from ..time_utils import detect_conflicts
            conflicts = detect_conflicts(best_schedule)
            
            return SchedulingResult(
                schedule=best_schedule,
                metrics=metrics,
                conflicts=conflicts,
                optimization_score=best_score,
                computation_time=computation_time,
                algorithm_used=self.name,
                parameters_used=parameters,
                success=True
            )
        else:
            return SchedulingResult(
                schedule=[],
                metrics={},
                conflicts=[],
                optimization_score=0,
                computation_time=computation_time,
                algorithm_used=self.name,
                parameters_used=parameters,
                success=False,
                error_message="Failed to generate valid schedule"
            )
    
    def _generate_initial_population(self,
                                   delivery_requests: List[DeliveryRequest],
                                   driver_availability: List[DriverAvailability],
                                   parameters: SchedulingParameters) -> List[Dict]:
        """Generate initial population of chromosomes."""
        population = []
        
        for _ in range(self.population_size):
            chromosome = {
                'assignments': {},  # delivery_id -> (driver_id, start_time)
                'order': {}  # driver_id -> [delivery_ids in order]
            }
            
            # Random assignment
            for request in delivery_requests:
                driver = random.choice(driver_availability)
                window = random.choice(request.time_windows)
                start_time = window[0] + timedelta(
                    minutes=random.randint(0, 
                        int((window[1] - window[0]).total_seconds() / 60 - request.service_duration))
                )
                
                chromosome['assignments'][request.delivery_id] = (driver.driver_id, start_time)
                
                if driver.driver_id not in chromosome['order']:
                    chromosome['order'][driver.driver_id] = []
                chromosome['order'][driver.driver_id].append(request.delivery_id)
            
            # Shuffle order for each driver
            for driver_id in chromosome['order']:
                random.shuffle(chromosome['order'][driver_id])
            
            population.append(chromosome)
        
        return population
    
    def _chromosome_to_schedule(self,
                              chromosome: Dict,
                              delivery_requests: List[DeliveryRequest],
                              driver_availability: List[DriverAvailability]) -> List[ScheduleEntry]:
        """Convert chromosome to schedule entries."""
        schedule = []
        request_map = {r.delivery_id: r for r in delivery_requests}
        
        for delivery_id, (driver_id, start_time) in chromosome['assignments'].items():
            if delivery_id in request_map:
                request = request_map[delivery_id]
                
                time_slot = TimeSlot(
                    start_time=start_time,
                    end_time=start_time + timedelta(minutes=request.service_duration)
                )
                
                entry = ScheduleEntry(
                    delivery_id=delivery_id,
                    client_id=request.client_id,
                    driver_id=driver_id,
                    vehicle_id=1,  # Simplified
                    time_slot=time_slot,
                    service_duration=request.service_duration,
                    priority=request.priority,
                    location=request.location
                )
                
                schedule.append(entry)
        
        return schedule
    
    def _tournament_selection(self, fitness_scores: List[Tuple]) -> Dict:
        """Select parent using tournament selection."""
        tournament_size = 5
        tournament = random.sample(fitness_scores, min(tournament_size, len(fitness_scores)))
        winner = max(tournament, key=lambda x: x[0])
        return winner[1]
    
    def _crossover(self, parent1: Dict, parent2: Dict) -> Tuple[Dict, Dict]:
        """Perform crossover between two parents."""
        child1 = {'assignments': {}, 'order': {}}
        child2 = {'assignments': {}, 'order': {}}
        
        # Split point
        delivery_ids = list(parent1['assignments'].keys())
        split_point = len(delivery_ids) // 2
        
        # First half from parent1, second half from parent2
        for i, delivery_id in enumerate(delivery_ids):
            if i < split_point:
                child1['assignments'][delivery_id] = parent1['assignments'][delivery_id]
                child2['assignments'][delivery_id] = parent2['assignments'][delivery_id]
            else:
                child1['assignments'][delivery_id] = parent2['assignments'][delivery_id]
                child2['assignments'][delivery_id] = parent1['assignments'][delivery_id]
        
        # Rebuild order
        for child in [child1, child2]:
            child['order'] = defaultdict(list)
            for delivery_id, (driver_id, _) in child['assignments'].items():
                child['order'][driver_id].append(delivery_id)
        
        return child1, child2
    
    def _mutate(self, chromosome: Dict) -> Dict:
        """Mutate chromosome."""
        mutated = {
            'assignments': chromosome['assignments'].copy(),
            'order': {k: v.copy() for k, v in chromosome['order'].items()}
        }
        
        # Random mutation type
        mutation_type = random.choice(['reassign', 'reorder', 'retime'])
        
        if mutation_type == 'reassign' and mutated['assignments']:
            # Change driver assignment
            delivery_id = random.choice(list(mutated['assignments'].keys()))
            old_driver_id, start_time = mutated['assignments'][delivery_id]
            
            # Remove from old driver's order
            if old_driver_id in mutated['order']:
                mutated['order'][old_driver_id].remove(delivery_id)
            
            # Assign to random new driver
            new_driver_id = random.choice(list(mutated['order'].keys()))
            mutated['assignments'][delivery_id] = (new_driver_id, start_time)
            
            if new_driver_id not in mutated['order']:
                mutated['order'][new_driver_id] = []
            mutated['order'][new_driver_id].append(delivery_id)
            
        elif mutation_type == 'reorder' and mutated['order']:
            # Shuffle one driver's route
            driver_id = random.choice([d for d in mutated['order'] if len(mutated['order'][d]) > 1])
            random.shuffle(mutated['order'][driver_id])
            
        elif mutation_type == 'retime' and mutated['assignments']:
            # Change start time
            delivery_id = random.choice(list(mutated['assignments'].keys()))
            driver_id, old_time = mutated['assignments'][delivery_id]
            
            # Random time shift
            shift_minutes = random.randint(-30, 30)
            new_time = old_time + timedelta(minutes=shift_minutes)
            mutated['assignments'][delivery_id] = (driver_id, new_time)
        
        return mutated


class SimulatedAnnealingScheduler(SchedulingAlgorithm):
    """Simulated annealing algorithm for schedule optimization."""
    
    def __init__(self, initial_temperature: float = 100.0, cooling_rate: float = 0.95):
        """Initialize simulated annealing scheduler."""
        super().__init__("Simulated Annealing Scheduler")
        self.initial_temperature = initial_temperature
        self.cooling_rate = cooling_rate
    
    def schedule(self,
                delivery_requests: List[DeliveryRequest],
                driver_availability: List[DriverAvailability],
                parameters: SchedulingParameters,
                constraints: List[SchedulingConstraint]) -> SchedulingResult:
        """Generate schedule using simulated annealing."""
        start_time = time_module.time()
        
        # Generate initial solution using greedy
        greedy = GreedyScheduler()
        initial_result = greedy.schedule(
            delivery_requests, driver_availability, parameters, constraints
        )
        
        current_solution = initial_result.schedule
        current_score = initial_result.optimization_score
        
        best_solution = current_solution.copy()
        best_score = current_score
        
        temperature = self.initial_temperature
        iteration = 0
        
        while temperature > 0.1 and time_module.time() - start_time < parameters.time_limit_seconds:
            # Generate neighbor solution
            neighbor = self._generate_neighbor(current_solution, delivery_requests)
            neighbor_score = self.evaluate_schedule(neighbor, parameters)
            
            # Apply penalty for constraints
            for constraint in constraints:
                neighbor_score -= constraint.cost(neighbor)
            
            # Accept or reject
            delta = neighbor_score - current_score
            
            if delta > 0 or random.random() < math.exp(delta / temperature):
                current_solution = neighbor
                current_score = neighbor_score
                
                if current_score > best_score:
                    best_solution = current_solution.copy()
                    best_score = current_score
            
            # Cool down
            temperature *= self.cooling_rate
            iteration += 1
        
        computation_time = time_module.time() - start_time
        
        # Calculate final metrics
        metrics = {
            "total_deliveries": len(delivery_requests),
            "scheduled_deliveries": len(best_solution),
            "unscheduled_deliveries": len(delivery_requests) - len(best_solution),
            "drivers_used": len(set(e.driver_id for e in best_solution)),
            "total_distance": self._calculate_total_distance(best_solution),
            "average_utilization": self._calculate_utilization(best_solution),
            "iterations": iteration,
            "final_temperature": temperature
        }
        
        from ..time_utils import detect_conflicts
        conflicts = detect_conflicts(best_solution)
        
        return SchedulingResult(
            schedule=best_solution,
            metrics=metrics,
            conflicts=conflicts,
            optimization_score=best_score,
            computation_time=computation_time,
            algorithm_used=self.name,
            parameters_used=parameters,
            success=True
        )
    
    def _generate_neighbor(self, 
                         current: List[ScheduleEntry],
                         delivery_requests: List[DeliveryRequest]) -> List[ScheduleEntry]:
        """Generate neighbor solution."""
        neighbor = [entry for entry in current]  # Deep copy would be better
        
        if not neighbor:
            return neighbor
        
        # Random perturbation
        operation = random.choice(['swap', 'move', 'shift'])
        
        if operation == 'swap' and len(neighbor) >= 2:
            # Swap two deliveries
            idx1, idx2 = random.sample(range(len(neighbor)), 2)
            
            # Swap time slots
            neighbor[idx1].time_slot, neighbor[idx2].time_slot = \
                neighbor[idx2].time_slot, neighbor[idx1].time_slot
                
        elif operation == 'move':
            # Move delivery to different driver
            entry = random.choice(neighbor)
            drivers = list(set(e.driver_id for e in neighbor))
            
            if len(drivers) > 1:
                new_driver = random.choice([d for d in drivers if d != entry.driver_id])
                entry.driver_id = new_driver
                
        elif operation == 'shift':
            # Shift delivery time
            entry = random.choice(neighbor)
            shift_minutes = random.randint(-30, 30)
            
            new_start = entry.time_slot.start_time + timedelta(minutes=shift_minutes)
            new_end = new_start + timedelta(minutes=entry.service_duration)
            
            entry.time_slot = TimeSlot(start_time=new_start, end_time=new_end)
        
        return neighbor