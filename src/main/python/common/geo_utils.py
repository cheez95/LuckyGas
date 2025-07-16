"""Geographic utilities for distance calculations and coordinate operations."""
import math
from typing import Tuple, Optional


def calculate_haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate the great circle distance between two points on Earth.
    
    Args:
        lat1: Latitude of first point
        lon1: Longitude of first point
        lat2: Latitude of second point
        lon2: Longitude of second point
        
    Returns:
        Distance in kilometers
    """
    # Radius of the Earth in kilometers
    R = 6371.0
    
    # Convert degrees to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Differences
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    # Haversine formula
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance


def calculate_manhattan_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate Manhattan distance (city block distance) between two points.
    Useful for urban routing where roads follow a grid pattern.
    
    Args:
        lat1: Latitude of first point
        lon1: Longitude of first point
        lat2: Latitude of second point
        lon2: Longitude of second point
        
    Returns:
        Distance in kilometers
    """
    # Approximate degrees to kilometers conversion
    # At equator: 1 degree latitude = 111.32 km, 1 degree longitude = 111.32 km
    # This is simplified and should be adjusted for the actual latitude
    avg_lat = (lat1 + lat2) / 2
    lat_km_per_degree = 111.32
    lon_km_per_degree = 111.32 * math.cos(math.radians(avg_lat))
    
    lat_diff_km = abs(lat2 - lat1) * lat_km_per_degree
    lon_diff_km = abs(lon2 - lon1) * lon_km_per_degree
    
    return lat_diff_km + lon_diff_km


def is_within_radius(
    center_lat: float, 
    center_lon: float, 
    point_lat: float, 
    point_lon: float, 
    radius_km: float
) -> bool:
    """
    Check if a point is within a given radius from a center point.
    
    Args:
        center_lat: Latitude of center point
        center_lon: Longitude of center point
        point_lat: Latitude of point to check
        point_lon: Longitude of point to check
        radius_km: Radius in kilometers
        
    Returns:
        True if point is within radius, False otherwise
    """
    distance = calculate_haversine_distance(
        center_lat, center_lon, point_lat, point_lon
    )
    return distance <= radius_km


def get_bounding_box(
    lat: float, 
    lon: float, 
    radius_km: float
) -> Tuple[float, float, float, float]:
    """
    Calculate a bounding box around a point.
    
    Args:
        lat: Center latitude
        lon: Center longitude
        radius_km: Radius in kilometers
        
    Returns:
        Tuple of (min_lat, min_lon, max_lat, max_lon)
    """
    # Rough approximation: 1 degree latitude = 111 km
    lat_delta = radius_km / 111.0
    
    # Longitude delta depends on latitude
    lon_delta = radius_km / (111.0 * math.cos(math.radians(lat)))
    
    return (
        lat - lat_delta,  # min_lat
        lon - lon_delta,  # min_lon
        lat + lat_delta,  # max_lat
        lon + lon_delta   # max_lon
    )


def validate_coordinates(lat: float, lon: float) -> bool:
    """
    Validate if coordinates are within valid ranges.
    
    Args:
        lat: Latitude
        lon: Longitude
        
    Returns:
        True if valid, False otherwise
    """
    return -90 <= lat <= 90 and -180 <= lon <= 180