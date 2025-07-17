"""
Google Maps Platform integration client
Provides geocoding, routing, and traffic-aware services
"""

import googlemaps
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional, Any
import logging
from dataclasses import dataclass
import asyncio
from concurrent.futures import ThreadPoolExecutor

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from config.cloud_config import cloud_config

logger = logging.getLogger(__name__)


@dataclass
class Location:
    """Represents a geographic location"""
    address: str
    lat: float
    lng: float
    place_id: Optional[str] = None
    formatted_address: Optional[str] = None


@dataclass
class RouteSegment:
    """Represents a segment of a route"""
    start_location: Location
    end_location: Location
    distance_meters: int
    duration_seconds: int
    duration_in_traffic_seconds: Optional[int] = None
    polyline: Optional[str] = None
    steps: Optional[List[Dict]] = None


class GoogleMapsClient:
    """Client for Google Maps Platform services"""
    
    def __init__(self):
        self.config = cloud_config.google_maps_config
        self.api_key = self.config['api_key']
        
        if not self.api_key:
            raise ValueError("Google Maps API key not configured")
        
        self.client = googlemaps.Client(key=self.api_key)
        self.executor = ThreadPoolExecutor(max_workers=5)
        
        # Cache for geocoding results
        self._geocode_cache = {}
        
    def geocode(self, address: str, region: str = 'TW') -> Optional[Location]:
        """
        Geocode an address to coordinates
        
        Args:
            address: Address to geocode
            region: Region hint for better results
            
        Returns:
            Location object or None if not found
        """
        # Check cache first
        cache_key = f"{address}:{region}"
        if cache_key in self._geocode_cache:
            return self._geocode_cache[cache_key]
        
        try:
            results = self.client.geocode(
                address,
                region=region,
                language=self.config['defaults']['language']
            )
            
            if results:
                result = results[0]
                location = Location(
                    address=address,
                    lat=result['geometry']['location']['lat'],
                    lng=result['geometry']['location']['lng'],
                    place_id=result.get('place_id'),
                    formatted_address=result.get('formatted_address')
                )
                
                # Cache the result
                self._geocode_cache[cache_key] = location
                
                logger.info(f"Geocoded '{address}' to ({location.lat}, {location.lng})")
                return location
            else:
                logger.warning(f"No geocoding results for '{address}'")
                return None
                
        except Exception as e:
            logger.error(f"Geocoding error for '{address}': {e}")
            return None
    
    def reverse_geocode(self, lat: float, lng: float) -> Optional[str]:
        """
        Reverse geocode coordinates to address
        
        Args:
            lat: Latitude
            lng: Longitude
            
        Returns:
            Formatted address or None
        """
        try:
            results = self.client.reverse_geocode(
                (lat, lng),
                language=self.config['defaults']['language']
            )
            
            if results:
                return results[0]['formatted_address']
            return None
            
        except Exception as e:
            logger.error(f"Reverse geocoding error for ({lat}, {lng}): {e}")
            return None
    
    def calculate_route(
        self,
        origin: Location,
        destination: Location,
        waypoints: Optional[List[Location]] = None,
        departure_time: Optional[datetime] = None,
        optimize_waypoints: bool = True,
        avoid: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Calculate route between locations with optional waypoints
        
        Args:
            origin: Starting location
            destination: End location
            waypoints: Optional intermediate stops
            departure_time: When to depart (for traffic calculation)
            optimize_waypoints: Whether to optimize waypoint order
            avoid: Features to avoid (tolls, highways, ferries)
            
        Returns:
            Route information including distance, duration, and steps
        """
        try:
            # Prepare waypoints
            waypoint_list = []
            if waypoints:
                waypoint_list = [f"{wp.lat},{wp.lng}" for wp in waypoints]
            
            # Set departure time for traffic calculation
            if not departure_time:
                departure_time = datetime.now()
            
            # Make directions request
            directions_result = self.client.directions(
                origin=f"{origin.lat},{origin.lng}",
                destination=f"{destination.lat},{destination.lng}",
                waypoints=waypoint_list,
                optimize_waypoints=optimize_waypoints,
                mode=self.config['defaults']['mode'],
                language=self.config['defaults']['language'],
                region=self.config['defaults']['region'],
                departure_time=departure_time,
                traffic_model=self.config['defaults']['traffic_model'],
                avoid=avoid or self.config['defaults']['avoid']
            )
            
            if directions_result:
                route = directions_result[0]
                legs = route['legs']
                
                # Calculate totals
                total_distance = sum(leg['distance']['value'] for leg in legs)
                total_duration = sum(leg['duration']['value'] for leg in legs)
                total_duration_in_traffic = sum(
                    leg.get('duration_in_traffic', {}).get('value', leg['duration']['value']) 
                    for leg in legs
                )
                
                # Build route segments
                segments = []
                for i, leg in enumerate(legs):
                    segment = RouteSegment(
                        start_location=Location(
                            address=leg['start_address'],
                            lat=leg['start_location']['lat'],
                            lng=leg['start_location']['lng']
                        ),
                        end_location=Location(
                            address=leg['end_address'],
                            lat=leg['end_location']['lat'],
                            lng=leg['end_location']['lng']
                        ),
                        distance_meters=leg['distance']['value'],
                        duration_seconds=leg['duration']['value'],
                        duration_in_traffic_seconds=leg.get('duration_in_traffic', {}).get('value'),
                        steps=leg['steps']
                    )
                    segments.append(segment)
                
                # Get optimized waypoint order if applicable
                waypoint_order = None
                if optimize_waypoints and 'waypoint_order' in route:
                    waypoint_order = route['waypoint_order']
                
                result = {
                    'total_distance_meters': total_distance,
                    'total_duration_seconds': total_duration,
                    'total_duration_in_traffic_seconds': total_duration_in_traffic,
                    'segments': segments,
                    'overview_polyline': route['overview_polyline']['points'],
                    'bounds': route['bounds'],
                    'waypoint_order': waypoint_order,
                    'warnings': route.get('warnings', [])
                }
                
                logger.info(
                    f"Route calculated: {total_distance/1000:.1f}km, "
                    f"{total_duration/60:.0f}min (traffic: {total_duration_in_traffic/60:.0f}min)"
                )
                
                return result
            else:
                logger.warning("No route found")
                return None
                
        except Exception as e:
            logger.error(f"Route calculation error: {e}")
            return None
    
    def calculate_distance_matrix(
        self,
        origins: List[Location],
        destinations: List[Location],
        departure_time: Optional[datetime] = None,
        traffic_model: str = 'best_guess'
    ) -> Optional[Dict[str, Any]]:
        """
        Calculate distance matrix between multiple origins and destinations
        
        Args:
            origins: List of origin locations
            destinations: List of destination locations
            departure_time: When to calculate (for traffic)
            traffic_model: Traffic prediction model
            
        Returns:
            Matrix of distances and durations
        """
        try:
            # Convert locations to coordinates
            origin_coords = [f"{o.lat},{o.lng}" for o in origins]
            dest_coords = [f"{d.lat},{d.lng}" for d in destinations]
            
            if not departure_time:
                departure_time = datetime.now()
            
            # Make distance matrix request
            matrix = self.client.distance_matrix(
                origins=origin_coords,
                destinations=dest_coords,
                mode=self.config['defaults']['mode'],
                language=self.config['defaults']['language'],
                region=self.config['defaults']['region'],
                departure_time=departure_time,
                traffic_model=traffic_model
            )
            
            if matrix['status'] == 'OK':
                # Process results into more usable format
                results = []
                for i, row in enumerate(matrix['rows']):
                    origin_results = []
                    for j, element in enumerate(row['elements']):
                        if element['status'] == 'OK':
                            origin_results.append({
                                'origin_index': i,
                                'destination_index': j,
                                'distance_meters': element['distance']['value'],
                                'distance_text': element['distance']['text'],
                                'duration_seconds': element['duration']['value'],
                                'duration_text': element['duration']['text'],
                                'duration_in_traffic_seconds': element.get('duration_in_traffic', {}).get('value'),
                                'duration_in_traffic_text': element.get('duration_in_traffic', {}).get('text')
                            })
                        else:
                            origin_results.append({
                                'origin_index': i,
                                'destination_index': j,
                                'status': element['status'],
                                'error': 'No route found'
                            })
                    results.append(origin_results)
                
                return {
                    'matrix': results,
                    'origin_addresses': matrix['origin_addresses'],
                    'destination_addresses': matrix['destination_addresses']
                }
            else:
                logger.error(f"Distance matrix error: {matrix['status']}")
                return None
                
        except Exception as e:
            logger.error(f"Distance matrix calculation error: {e}")
            return None
    
    def get_place_details(self, place_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a place
        
        Args:
            place_id: Google Place ID
            
        Returns:
            Place details including opening hours, phone, etc.
        """
        try:
            place = self.client.place(
                place_id,
                language=self.config['defaults']['language']
            )
            
            if place['status'] == 'OK':
                return place['result']
            return None
            
        except Exception as e:
            logger.error(f"Place details error: {e}")
            return None
    
    def find_nearby_places(
        self,
        location: Location,
        radius: int = 5000,
        place_type: str = 'gas_station',
        keyword: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Find nearby places of a specific type
        
        Args:
            location: Center location
            radius: Search radius in meters
            place_type: Type of place to search
            keyword: Optional keyword filter
            
        Returns:
            List of nearby places
        """
        try:
            places = self.client.places_nearby(
                location=(location.lat, location.lng),
                radius=radius,
                type=place_type,
                keyword=keyword,
                language=self.config['defaults']['language']
            )
            
            if places['status'] == 'OK':
                return places['results']
            return []
            
        except Exception as e:
            logger.error(f"Nearby places search error: {e}")
            return []
    
    def get_timezone(self, location: Location) -> Optional[Dict[str, Any]]:
        """
        Get timezone information for a location
        
        Args:
            location: Location to check
            
        Returns:
            Timezone information
        """
        try:
            timezone = self.client.timezone(
                (location.lat, location.lng),
                timestamp=datetime.now()
            )
            
            if timezone['status'] == 'OK':
                return {
                    'timezone_id': timezone['timeZoneId'],
                    'timezone_name': timezone['timeZoneName'],
                    'dst_offset': timezone['dstOffset'],
                    'raw_offset': timezone['rawOffset']
                }
            return None
            
        except Exception as e:
            logger.error(f"Timezone lookup error: {e}")
            return None
    
    async def geocode_batch_async(self, addresses: List[str]) -> List[Optional[Location]]:
        """
        Geocode multiple addresses asynchronously
        
        Args:
            addresses: List of addresses to geocode
            
        Returns:
            List of Location objects (None for failed geocoding)
        """
        loop = asyncio.get_event_loop()
        
        # Create tasks for each address
        tasks = []
        for address in addresses:
            task = loop.run_in_executor(self.executor, self.geocode, address)
            tasks.append(task)
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks)
        
        return results
    
    def validate_api_key(self) -> bool:
        """
        Validate that the API key is working
        
        Returns:
            True if API key is valid
        """
        try:
            # Try a simple geocoding request
            self.client.geocode("Taipei 101, Taiwan")
            return True
        except Exception as e:
            logger.error(f"API key validation failed: {e}")
            return False