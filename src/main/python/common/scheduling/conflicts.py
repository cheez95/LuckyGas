"""Conflict detection and resolution for scheduling."""
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
from collections import defaultdict
import logging

from ..time_utils import (
    ScheduleEntry, SchedulingConflict, ConflictType, 
    TimeSlot, detect_conflicts, calculate_travel_time
)
from .models import DeliveryRequest, DriverAvailability

logger = logging.getLogger(__name__)


class ConflictResolver:
    """Resolves scheduling conflicts using various strategies."""
    
    def __init__(self, 
                 delivery_requests: Dict[int, DeliveryRequest],
                 driver_availability: Dict[int, DriverAvailability],
                 travel_speed_kmh: float = 30.0):
        """
        Initialize conflict resolver.
        
        Args:
            delivery_requests: Dict of delivery requests by ID
            driver_availability: Dict of driver availability by ID
            travel_speed_kmh: Average travel speed
        """
        self.delivery_requests = delivery_requests
        self.driver_availability = driver_availability
        self.travel_speed_kmh = travel_speed_kmh
    
    def resolve_conflicts(self, 
                         schedule: List[ScheduleEntry], 
                         conflicts: List[SchedulingConflict],
                         max_attempts: int = 10) -> Tuple[List[ScheduleEntry], List[SchedulingConflict]]:
        """
        Attempt to resolve conflicts in the schedule.
        
        Args:
            schedule: Current schedule
            conflicts: List of conflicts to resolve
            max_attempts: Maximum resolution attempts
            
        Returns:
            Tuple of (updated_schedule, remaining_conflicts)
        """
        resolved_schedule = schedule.copy()
        remaining_conflicts = []
        
        # Sort conflicts by severity (highest first)
        sorted_conflicts = sorted(conflicts, key=lambda c: c.severity, reverse=True)
        
        for conflict in sorted_conflicts:
            resolved = False
            attempts = 0
            
            while not resolved and attempts < max_attempts:
                attempts += 1
                
                if conflict.conflict_type == ConflictType.TIME_OVERLAP:
                    resolved = self._resolve_time_overlap(resolved_schedule, conflict)
                elif conflict.conflict_type == ConflictType.TRAVEL_TIME_INSUFFICIENT:
                    resolved = self._resolve_travel_time(resolved_schedule, conflict)
                elif conflict.conflict_type == ConflictType.TIME_WINDOW_VIOLATION:
                    resolved = self._resolve_time_window(resolved_schedule, conflict)
                elif conflict.conflict_type == ConflictType.CAPACITY_EXCEEDED:
                    resolved = self._resolve_capacity(resolved_schedule, conflict)
                elif conflict.conflict_type == ConflictType.DRIVER_UNAVAILABLE:
                    resolved = self._resolve_driver_availability(resolved_schedule, conflict)
                
                if resolved:
                    logger.info(f"Resolved conflict: {conflict.conflict_type.value}")
                    # Re-detect conflicts after resolution
                    new_conflicts = detect_conflicts(resolved_schedule)
                    if not any(c.conflict_type == conflict.conflict_type and 
                             set(e.delivery_id for e in c.entries) == 
                             set(e.delivery_id for e in conflict.entries) 
                             for c in new_conflicts):
                        break
                    else:
                        resolved = False
            
            if not resolved:
                remaining_conflicts.append(conflict)
                logger.warning(f"Could not resolve conflict: {conflict.description}")
        
        return resolved_schedule, remaining_conflicts
    
    def _resolve_time_overlap(self, schedule: List[ScheduleEntry], 
                            conflict: SchedulingConflict) -> bool:
        """Resolve time overlap conflicts."""
        if len(conflict.entries) < 2:
            return False
        
        # Try to reschedule the second delivery
        entry1, entry2 = conflict.entries[0], conflict.entries[1]
        
        # Find alternative time slot for entry2
        new_start = entry1.end_time + timedelta(minutes=5)
        new_slot = TimeSlot(
            start_time=new_start,
            end_time=new_start + timedelta(minutes=entry2.service_duration)
        )
        
        # Check if new slot is within client time windows
        if entry2.delivery_id in self.delivery_requests:
            request = self.delivery_requests[entry2.delivery_id]
            valid_slot = False
            
            for window_start, window_end in request.time_windows:
                if new_slot.start_time >= window_start and new_slot.end_time <= window_end:
                    valid_slot = True
                    break
            
            if valid_slot:
                # Update schedule
                for i, entry in enumerate(schedule):
                    if entry.delivery_id == entry2.delivery_id:
                        schedule[i].time_slot = new_slot
                        return True
        
        # Try reassigning to different driver
        return self._reassign_delivery(schedule, entry2)
    
    def _resolve_travel_time(self, schedule: List[ScheduleEntry], 
                           conflict: SchedulingConflict) -> bool:
        """Resolve insufficient travel time conflicts."""
        if len(conflict.entries) < 2:
            return False
        
        entry1, entry2 = conflict.entries[0], conflict.entries[1]
        
        # Calculate required travel time
        if entry1.location and entry2.location:
            travel_time = calculate_travel_time(
                entry1.location, entry2.location, self.travel_speed_kmh
            )
            
            # Add buffer time
            required_gap = travel_time + 10  # 10 minutes buffer
            new_start = entry1.end_time + timedelta(minutes=required_gap)
            
            new_slot = TimeSlot(
                start_time=new_start,
                end_time=new_start + timedelta(minutes=entry2.service_duration)
            )
            
            # Update if within time windows
            if self._is_slot_valid_for_delivery(new_slot, entry2.delivery_id):
                for i, entry in enumerate(schedule):
                    if entry.delivery_id == entry2.delivery_id:
                        schedule[i].time_slot = new_slot
                        return True
        
        return False
    
    def _resolve_time_window(self, schedule: List[ScheduleEntry], 
                           conflict: SchedulingConflict) -> bool:
        """Resolve time window violations."""
        for entry in conflict.entries:
            if entry.delivery_id in self.delivery_requests:
                request = self.delivery_requests[entry.delivery_id]
                
                # Find first available slot within time windows
                for window_start, window_end in request.time_windows:
                    slot_duration = timedelta(minutes=entry.service_duration)
                    
                    # Try slots at 15-minute intervals
                    current_time = window_start
                    while current_time + slot_duration <= window_end:
                        new_slot = TimeSlot(
                            start_time=current_time,
                            end_time=current_time + slot_duration
                        )
                        
                        # Check if slot conflicts with other deliveries
                        has_conflict = False
                        for other_entry in schedule:
                            if (other_entry.delivery_id != entry.delivery_id and
                                other_entry.driver_id == entry.driver_id and
                                new_slot.overlaps_with(other_entry.time_slot)):
                                has_conflict = True
                                break
                        
                        if not has_conflict:
                            # Update schedule
                            for i, sched_entry in enumerate(schedule):
                                if sched_entry.delivery_id == entry.delivery_id:
                                    schedule[i].time_slot = new_slot
                                    return True
                        
                        current_time += timedelta(minutes=15)
        
        return False
    
    def _resolve_capacity(self, schedule: List[ScheduleEntry], 
                        conflict: SchedulingConflict) -> bool:
        """Resolve capacity exceeded conflicts."""
        # Group deliveries by vehicle
        vehicle_deliveries = defaultdict(list)
        for entry in schedule:
            vehicle_deliveries[entry.vehicle_id].append(entry)
        
        # Try to redistribute deliveries
        for entry in conflict.entries:
            # Find alternative vehicle with capacity
            for vehicle_id, deliveries in vehicle_deliveries.items():
                if vehicle_id != entry.vehicle_id:
                    # Check if vehicle has capacity
                    # This is simplified - in reality would check actual capacity
                    if len(deliveries) < 15:  # Assume max 15 deliveries per vehicle
                        # Reassign to this vehicle
                        for i, sched_entry in enumerate(schedule):
                            if sched_entry.delivery_id == entry.delivery_id:
                                schedule[i].vehicle_id = vehicle_id
                                return True
        
        return False
    
    def _resolve_driver_availability(self, schedule: List[ScheduleEntry], 
                                   conflict: SchedulingConflict) -> bool:
        """Resolve driver unavailability conflicts."""
        for entry in conflict.entries:
            # Try to find available driver
            for driver_id, availability in self.driver_availability.items():
                if driver_id != entry.driver_id:
                    # Check if driver is available during delivery time
                    for period_start, period_end in availability.available_hours:
                        if (entry.time_slot.start_time >= period_start and 
                            entry.end_time <= period_end):
                            # Reassign to available driver
                            for i, sched_entry in enumerate(schedule):
                                if sched_entry.delivery_id == entry.delivery_id:
                                    schedule[i].driver_id = driver_id
                                    return True
        
        return False
    
    def _reassign_delivery(self, schedule: List[ScheduleEntry], 
                         entry: ScheduleEntry) -> bool:
        """Try to reassign delivery to different driver."""
        # Find drivers with fewer deliveries
        driver_loads = defaultdict(int)
        for sched_entry in schedule:
            driver_loads[sched_entry.driver_id] += 1
        
        # Sort drivers by load
        sorted_drivers = sorted(driver_loads.items(), key=lambda x: x[1])
        
        for driver_id, load in sorted_drivers:
            if driver_id != entry.driver_id and load < 20:  # Max 20 deliveries
                # Check if driver is available
                if driver_id in self.driver_availability:
                    availability = self.driver_availability[driver_id]
                    for period_start, period_end in availability.available_hours:
                        if (entry.time_slot.start_time >= period_start and 
                            entry.end_time <= period_end):
                            # Reassign
                            for i, sched_entry in enumerate(schedule):
                                if sched_entry.delivery_id == entry.delivery_id:
                                    schedule[i].driver_id = driver_id
                                    return True
        
        return False
    
    def _is_slot_valid_for_delivery(self, slot: TimeSlot, delivery_id: int) -> bool:
        """Check if time slot is valid for given delivery."""
        if delivery_id not in self.delivery_requests:
            return False
        
        request = self.delivery_requests[delivery_id]
        for window_start, window_end in request.time_windows:
            if slot.start_time >= window_start and slot.end_time <= window_end:
                return True
        
        return False
    
    def suggest_resolution_strategies(self, 
                                    conflict: SchedulingConflict) -> List[str]:
        """Suggest resolution strategies for a conflict."""
        suggestions = []
        
        if conflict.conflict_type == ConflictType.TIME_OVERLAP:
            suggestions.extend([
                "Reschedule one delivery to a later time",
                "Assign deliveries to different drivers",
                "Extend service time estimates if too optimistic"
            ])
        elif conflict.conflict_type == ConflictType.TRAVEL_TIME_INSUFFICIENT:
            suggestions.extend([
                "Add more buffer time between deliveries",
                "Reorder deliveries to minimize travel distance",
                "Assign geographically distant deliveries to different drivers"
            ])
        elif conflict.conflict_type == ConflictType.TIME_WINDOW_VIOLATION:
            suggestions.extend([
                "Negotiate flexible time windows with client",
                "Prioritize this delivery earlier in the route",
                "Consider split delivery if time window is too narrow"
            ])
        elif conflict.conflict_type == ConflictType.CAPACITY_EXCEEDED:
            suggestions.extend([
                "Use larger capacity vehicle",
                "Split route into multiple trips",
                "Redistribute deliveries among vehicles"
            ])
        elif conflict.conflict_type == ConflictType.DRIVER_UNAVAILABLE:
            suggestions.extend([
                "Schedule delivery for different day",
                "Use backup/substitute driver",
                "Adjust driver shift schedule"
            ])
        
        return suggestions