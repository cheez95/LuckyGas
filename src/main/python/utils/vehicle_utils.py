"""Vehicle utilities for requirement calculations and capacity management."""
from typing import List, Dict, Any, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class VehicleType(Enum):
    """Vehicle types with their capacities."""
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    EXTRA_LARGE = "extra_large"


# Vehicle capacity definitions
VEHICLE_CAPACITIES = {
    VehicleType.SMALL: {
        'max_weight_kg': 500,
        'max_cylinders': 20,
        'fuel_efficiency': 12,  # km per liter
        'base_cost_per_km': 3.0
    },
    VehicleType.MEDIUM: {
        'max_weight_kg': 1000,
        'max_cylinders': 40,
        'fuel_efficiency': 10,
        'base_cost_per_km': 4.0
    },
    VehicleType.LARGE: {
        'max_weight_kg': 2000,
        'max_cylinders': 80,
        'fuel_efficiency': 8,
        'base_cost_per_km': 5.5
    },
    VehicleType.EXTRA_LARGE: {
        'max_weight_kg': 3500,
        'max_cylinders': 150,
        'fuel_efficiency': 6,
        'base_cost_per_km': 7.5
    }
}

# Cylinder specifications
CYLINDER_SPECS = {
    '16kg': {'weight': 16, 'volume': 0.03},
    '20kg': {'weight': 20, 'volume': 0.04},
    '50kg': {'weight': 50, 'volume': 0.1},
    'custom': {'weight': 30, 'volume': 0.06}  # Average for custom
}


def calculate_required_vehicle_type(
    deliveries: List[Dict[str, Any]]
) -> VehicleType:
    """
    Calculate the minimum required vehicle type for a set of deliveries.
    
    Args:
        deliveries: List of delivery dictionaries with cylinder_type and quantity
        
    Returns:
        Required VehicleType
    """
    total_weight = 0
    total_cylinders = 0
    
    for delivery in deliveries:
        cylinder_type = delivery.get('cylinder_type', '20kg')
        quantity = delivery.get('quantity', 1)
        
        # Get cylinder specifications
        specs = CYLINDER_SPECS.get(cylinder_type, CYLINDER_SPECS['20kg'])
        
        total_weight += specs['weight'] * quantity
        total_cylinders += quantity
    
    # Find suitable vehicle type
    for vehicle_type in VehicleType:
        capacity = VEHICLE_CAPACITIES[vehicle_type]
        if (total_weight <= capacity['max_weight_kg'] and 
            total_cylinders <= capacity['max_cylinders']):
            return vehicle_type
    
    # If no vehicle can handle it, return the largest
    logger.warning(
        f"Deliveries exceed maximum vehicle capacity: "
        f"{total_weight}kg, {total_cylinders} cylinders"
    )
    return VehicleType.EXTRA_LARGE


def can_vehicle_handle_delivery(
    vehicle_type: VehicleType,
    current_load: Dict[str, float],
    new_delivery: Dict[str, Any]
) -> bool:
    """
    Check if a vehicle can handle an additional delivery.
    
    Args:
        vehicle_type: Type of vehicle
        current_load: Current load {'weight_kg': X, 'cylinders': Y}
        new_delivery: New delivery to add
        
    Returns:
        True if vehicle can handle the additional load
    """
    capacity = VEHICLE_CAPACITIES[vehicle_type]
    
    # Calculate new delivery requirements
    cylinder_type = new_delivery.get('cylinder_type', '20kg')
    quantity = new_delivery.get('quantity', 1)
    specs = CYLINDER_SPECS.get(cylinder_type, CYLINDER_SPECS['20kg'])
    
    new_weight = specs['weight'] * quantity
    new_cylinders = quantity
    
    # Check if adding new delivery exceeds capacity
    total_weight = current_load.get('weight_kg', 0) + new_weight
    total_cylinders = current_load.get('cylinders', 0) + new_cylinders
    
    return (total_weight <= capacity['max_weight_kg'] and 
            total_cylinders <= capacity['max_cylinders'])


def calculate_vehicle_utilization(
    vehicle_type: VehicleType,
    load: Dict[str, float]
) -> Dict[str, float]:
    """
    Calculate vehicle utilization percentages.
    
    Args:
        vehicle_type: Type of vehicle
        load: Current load {'weight_kg': X, 'cylinders': Y}
        
    Returns:
        Dictionary with utilization percentages
    """
    capacity = VEHICLE_CAPACITIES[vehicle_type]
    
    weight_utilization = (load.get('weight_kg', 0) / capacity['max_weight_kg']) * 100
    cylinder_utilization = (load.get('cylinders', 0) / capacity['max_cylinders']) * 100
    
    return {
        'weight_utilization': round(weight_utilization, 2),
        'cylinder_utilization': round(cylinder_utilization, 2),
        'overall_utilization': round(max(weight_utilization, cylinder_utilization), 2)
    }


def estimate_fuel_consumption(
    vehicle_type: VehicleType,
    distance_km: float,
    load_percentage: float = 50.0
) -> Dict[str, float]:
    """
    Estimate fuel consumption for a route.
    
    Args:
        vehicle_type: Type of vehicle
        distance_km: Total distance in kilometers
        load_percentage: Average load percentage (affects fuel efficiency)
        
    Returns:
        Dictionary with fuel consumption metrics
    """
    capacity = VEHICLE_CAPACITIES[vehicle_type]
    base_efficiency = capacity['fuel_efficiency']
    
    # Adjust efficiency based on load
    # Higher load = lower efficiency
    load_factor = 1 + (load_percentage / 100) * 0.2
    actual_efficiency = base_efficiency / load_factor
    
    fuel_required = distance_km / actual_efficiency
    
    # Assume fuel price (could be made configurable)
    fuel_price_per_liter = 95.0  # TWD
    fuel_cost = fuel_required * fuel_price_per_liter
    
    return {
        'fuel_required_liters': round(fuel_required, 2),
        'fuel_cost': round(fuel_cost, 2),
        'efficiency_km_per_liter': round(actual_efficiency, 2)
    }


def calculate_delivery_cost(
    vehicle_type: VehicleType,
    distance_km: float,
    num_stops: int,
    load_percentage: float = 50.0
) -> Dict[str, float]:
    """
    Calculate total delivery cost including fuel and operational costs.
    
    Args:
        vehicle_type: Type of vehicle
        distance_km: Total route distance
        num_stops: Number of delivery stops
        load_percentage: Average load percentage
        
    Returns:
        Dictionary with cost breakdown
    """
    capacity = VEHICLE_CAPACITIES[vehicle_type]
    
    # Distance-based cost
    distance_cost = distance_km * capacity['base_cost_per_km']
    
    # Fuel cost
    fuel_metrics = estimate_fuel_consumption(vehicle_type, distance_km, load_percentage)
    fuel_cost = fuel_metrics['fuel_cost']
    
    # Stop cost (time-based)
    stop_cost_per_location = 50.0  # TWD per stop
    stop_cost = num_stops * stop_cost_per_location
    
    # Total cost
    total_cost = distance_cost + fuel_cost + stop_cost
    
    return {
        'distance_cost': round(distance_cost, 2),
        'fuel_cost': round(fuel_cost, 2),
        'stop_cost': round(stop_cost, 2),
        'total_cost': round(total_cost, 2),
        'cost_per_km': round(total_cost / distance_km if distance_km > 0 else 0, 2),
        'cost_per_stop': round(total_cost / num_stops if num_stops > 0 else 0, 2)
    }


def get_available_vehicles(
    vehicles: List[Dict[str, Any]],
    required_type: VehicleType,
    date: Any
) -> List[Dict[str, Any]]:
    """
    Get available vehicles that meet requirements for a specific date.
    
    Args:
        vehicles: List of all vehicles
        required_type: Minimum required vehicle type
        date: Date to check availability
        
    Returns:
        List of available vehicles
    """
    available = []
    
    # Get type priority (can use larger vehicles if needed)
    type_priority = list(VehicleType)
    min_index = type_priority.index(required_type)
    suitable_types = type_priority[min_index:]
    
    for vehicle in vehicles:
        # Check if vehicle type is suitable
        vehicle_type_str = vehicle.get('type', '').lower()
        try:
            vehicle_type = VehicleType(vehicle_type_str)
            if vehicle_type not in suitable_types:
                continue
        except ValueError:
            continue
        
        # Check if vehicle is active
        if not vehicle.get('is_active', True):
            continue
        
        # Check availability for date (simplified - could check actual schedule)
        # This is where you'd integrate with a scheduling system
        
        available.append(vehicle)
    
    # Sort by efficiency (prefer smaller suitable vehicles)
    available.sort(key=lambda v: type_priority.index(VehicleType(v['type'].lower())))
    
    return available