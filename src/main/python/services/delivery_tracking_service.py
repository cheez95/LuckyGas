"""
Real-time delivery tracking service
Handles GPS tracking, customer notifications, and proof of delivery
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Tuple
import logging
from dataclasses import dataclass
from enum import Enum
import asyncio
import json
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import aioredis
import base64
from io import BytesIO
from PIL import Image

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from models.database_schema import Delivery, Driver, Vehicle, Client, DeliveryStatus, Route
from integrations.google_maps_client import GoogleMapsClient, Location
from config.cloud_config import cloud_config

logger = logging.getLogger(__name__)


class TrackingEventType(Enum):
    """Types of tracking events"""
    ROUTE_STARTED = "route_started"
    LOCATION_UPDATE = "location_update"
    ARRIVAL_AT_CUSTOMER = "arrival_at_customer"
    DELIVERY_STARTED = "delivery_started"
    DELIVERY_COMPLETED = "delivery_completed"
    DELIVERY_FAILED = "delivery_failed"
    ROUTE_DEVIATION = "route_deviation"
    TRAFFIC_DELAY = "traffic_delay"
    VEHICLE_BREAKDOWN = "vehicle_breakdown"
    ROUTE_COMPLETED = "route_completed"


@dataclass
class TrackingUpdate:
    """Real-time tracking update"""
    tracking_id: str
    delivery_id: int
    driver_id: int
    vehicle_id: int
    timestamp: datetime
    location: Location
    speed: float  # km/h
    heading: float  # degrees
    accuracy: float  # meters
    event_type: TrackingEventType
    event_data: Optional[Dict[str, Any]] = None
    eta: Optional[datetime] = None
    distance_remaining: Optional[float] = None  # km


@dataclass
class ProofOfDelivery:
    """Proof of delivery data"""
    delivery_id: int
    timestamp: datetime
    signature_image: Optional[str] = None  # Base64 encoded image
    photo: Optional[str] = None  # Base64 encoded photo
    recipient_name: Optional[str] = None
    recipient_id: Optional[str] = None
    notes: Optional[str] = None
    location: Optional[Location] = None
    cylinders_delivered: Optional[Dict[str, int]] = None


@dataclass
class TrackingSession:
    """Active tracking session for a driver/vehicle"""
    session_id: str
    driver_id: int
    vehicle_id: int
    route_id: int
    start_time: datetime
    last_update: datetime
    current_location: Location
    deliveries_completed: List[int]
    deliveries_remaining: List[int]
    is_active: bool = True
    total_distance: float = 0.0  # km
    average_speed: float = 0.0  # km/h


class DeliveryTrackingService:
    """Manages real-time delivery tracking and proof of delivery"""
    
    def __init__(self, session: Session):
        self.session = session
        self.maps_client = GoogleMapsClient()
        self.config = cloud_config.app_settings
        self._tracking_sessions = {}  # In-memory tracking sessions
        self._redis_client = None  # For real-time updates if Redis available
        
    async def initialize_redis(self):
        """Initialize Redis connection for real-time tracking"""
        try:
            self._redis_client = await aioredis.create_redis_pool(
                'redis://localhost:6379',
                encoding='utf-8'
            )
            logger.info("Redis connected for real-time tracking")
        except Exception as e:
            logger.warning(f"Redis not available: {e}. Using in-memory tracking.")
    
    async def start_tracking_session(
        self,
        driver_id: int,
        vehicle_id: int,
        route_id: int
    ) -> TrackingSession:
        """
        Start a new tracking session for a driver
        
        Args:
            driver_id: Driver ID
            vehicle_id: Vehicle ID
            route_id: Route ID
            
        Returns:
            New tracking session
        """
        try:
            # Get route details
            route = self.session.query(Route).filter(Route.id == route_id).first()
            if not route:
                raise ValueError(f"Route {route_id} not found")
            
            # Get driver's current location (from app or default to depot)
            current_location = await self._get_driver_location(driver_id)
            
            # Create session
            session_id = f"TRACK-{uuid.uuid4().hex[:8]}"
            
            session = TrackingSession(
                session_id=session_id,
                driver_id=driver_id,
                vehicle_id=vehicle_id,
                route_id=route_id,
                start_time=datetime.now(),
                last_update=datetime.now(),
                current_location=current_location,
                deliveries_completed=[],
                deliveries_remaining=[d.id for d in route.deliveries],
                is_active=True
            )
            
            # Store session
            self._tracking_sessions[session_id] = session
            
            # Send start event
            await self._send_tracking_event(
                TrackingUpdate(
                    tracking_id=session_id,
                    delivery_id=0,  # Route-level event
                    driver_id=driver_id,
                    vehicle_id=vehicle_id,
                    timestamp=datetime.now(),
                    location=current_location,
                    speed=0.0,
                    heading=0.0,
                    accuracy=10.0,
                    event_type=TrackingEventType.ROUTE_STARTED,
                    event_data={'route_id': route_id, 'total_deliveries': len(route.deliveries)}
                )
            )
            
            logger.info(f"Tracking session {session_id} started for driver {driver_id}")
            return session
            
        except Exception as e:
            logger.error(f"Failed to start tracking session: {e}")
            raise
    
    async def update_location(
        self,
        session_id: str,
        location: Location,
        speed: float = 0.0,
        heading: float = 0.0,
        accuracy: float = 10.0
    ) -> Optional[Dict[str, Any]]:
        """
        Update driver's location during tracking
        
        Args:
            session_id: Tracking session ID
            location: Current location
            speed: Current speed in km/h
            heading: Direction in degrees
            accuracy: GPS accuracy in meters
            
        Returns:
            Update status with ETA and next delivery info
        """
        try:
            session = self._tracking_sessions.get(session_id)
            if not session or not session.is_active:
                return None
            
            # Update session
            session.last_update = datetime.now()
            session.current_location = location
            
            # Calculate distance traveled
            distance = self._calculate_distance(
                session.current_location,
                location
            )
            session.total_distance += distance
            
            # Update average speed
            duration = (datetime.now() - session.start_time).total_seconds() / 3600
            if duration > 0:
                session.average_speed = session.total_distance / duration
            
            # Check for route deviation
            deviation = await self._check_route_deviation(session, location)
            
            # Get next delivery
            next_delivery = await self._get_next_delivery(session)
            
            # Calculate ETA
            eta = None
            distance_remaining = None
            if next_delivery:
                route_info = self.maps_client.calculate_route(
                    location,
                    next_delivery['location'],
                    departure_time=datetime.now()
                )
                
                if route_info:
                    distance_remaining = route_info['total_distance_meters'] / 1000
                    eta = datetime.now() + timedelta(
                        seconds=route_info['total_duration_in_traffic_seconds']
                    )
            
            # Send location update
            update = TrackingUpdate(
                tracking_id=session_id,
                delivery_id=next_delivery['id'] if next_delivery else 0,
                driver_id=session.driver_id,
                vehicle_id=session.vehicle_id,
                timestamp=datetime.now(),
                location=location,
                speed=speed,
                heading=heading,
                accuracy=accuracy,
                event_type=TrackingEventType.LOCATION_UPDATE,
                eta=eta,
                distance_remaining=distance_remaining,
                event_data={
                    'deviation': deviation,
                    'total_distance': session.total_distance,
                    'deliveries_completed': len(session.deliveries_completed),
                    'deliveries_remaining': len(session.deliveries_remaining)
                }
            )
            
            await self._send_tracking_event(update)
            
            # Check proximity to next delivery
            if next_delivery and distance_remaining and distance_remaining < 0.1:  # Within 100m
                await self._handle_arrival_at_customer(session, next_delivery)
            
            return {
                'session_id': session_id,
                'next_delivery': next_delivery,
                'eta': eta.isoformat() if eta else None,
                'distance_remaining': distance_remaining,
                'deviation': deviation,
                'status': 'on_route'
            }
            
        except Exception as e:
            logger.error(f"Location update error: {e}")
            return None
    
    async def complete_delivery(
        self,
        session_id: str,
        delivery_id: int,
        proof: ProofOfDelivery
    ) -> bool:
        """
        Complete a delivery with proof of delivery
        
        Args:
            session_id: Tracking session ID
            delivery_id: Delivery ID
            proof: Proof of delivery data
            
        Returns:
            Success status
        """
        try:
            session = self._tracking_sessions.get(session_id)
            if not session or not session.is_active:
                return False
            
            # Validate delivery is in session
            if delivery_id not in session.deliveries_remaining:
                logger.warning(f"Delivery {delivery_id} not in session {session_id}")
                return False
            
            # Store proof of delivery
            await self._store_proof_of_delivery(proof)
            
            # Update delivery status
            delivery = self.session.query(Delivery).filter(
                Delivery.id == delivery_id
            ).first()
            
            if delivery:
                delivery.status = DeliveryStatus.COMPLETED
                delivery.actual_delivery_time = datetime.now()
                delivery.proof_of_delivery = {
                    'signature': bool(proof.signature_image),
                    'photo': bool(proof.photo),
                    'recipient': proof.recipient_name,
                    'notes': proof.notes
                }
                
                if proof.cylinders_delivered:
                    delivery.delivered_50kg = proof.cylinders_delivered.get('50kg', 0)
                    delivery.delivered_20kg = proof.cylinders_delivered.get('20kg', 0)
                    delivery.delivered_16kg = proof.cylinders_delivered.get('16kg', 0)
                    delivery.delivered_10kg = proof.cylinders_delivered.get('10kg', 0)
                    delivery.delivered_4kg = proof.cylinders_delivered.get('4kg', 0)
                
                self.session.commit()
            
            # Update session
            session.deliveries_remaining.remove(delivery_id)
            session.deliveries_completed.append(delivery_id)
            
            # Send completion event
            await self._send_tracking_event(
                TrackingUpdate(
                    tracking_id=session_id,
                    delivery_id=delivery_id,
                    driver_id=session.driver_id,
                    vehicle_id=session.vehicle_id,
                    timestamp=datetime.now(),
                    location=session.current_location,
                    speed=0.0,
                    heading=0.0,
                    accuracy=10.0,
                    event_type=TrackingEventType.DELIVERY_COMPLETED,
                    event_data={
                        'recipient': proof.recipient_name,
                        'has_signature': bool(proof.signature_image),
                        'has_photo': bool(proof.photo)
                    }
                )
            )
            
            # Check if route is complete
            if not session.deliveries_remaining:
                await self._complete_route(session)
            
            logger.info(f"Delivery {delivery_id} completed in session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to complete delivery: {e}")
            return False
    
    async def get_live_tracking(
        self,
        tracking_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get live tracking information for customer
        
        Args:
            tracking_id: Public tracking ID
            
        Returns:
            Live tracking data
        """
        try:
            # Find delivery by tracking ID
            delivery = self.session.query(Delivery).filter(
                Delivery.tracking_id == tracking_id
            ).first()
            
            if not delivery:
                return None
            
            # Find active session for this delivery
            session = None
            for s in self._tracking_sessions.values():
                if delivery.id in s.deliveries_remaining and s.is_active:
                    session = s
                    break
            
            if not session:
                return {
                    'status': 'not_started',
                    'delivery_id': delivery.id,
                    'scheduled_date': delivery.scheduled_date.isoformat(),
                    'scheduled_time': f"{delivery.scheduled_time_start} - {delivery.scheduled_time_end}"
                }
            
            # Calculate ETA
            eta = None
            distance_remaining = None
            
            client = self.session.query(Client).filter(
                Client.id == delivery.client_id
            ).first()
            
            if client:
                client_location = self.maps_client.geocode(client.address)
                if client_location:
                    route_info = self.maps_client.calculate_route(
                        session.current_location,
                        client_location,
                        departure_time=datetime.now()
                    )
                    
                    if route_info:
                        distance_remaining = route_info['total_distance_meters'] / 1000
                        eta = datetime.now() + timedelta(
                            seconds=route_info['total_duration_in_traffic_seconds']
                        )
            
            return {
                'status': 'in_transit',
                'delivery_id': delivery.id,
                'driver_location': {
                    'lat': session.current_location.lat,
                    'lng': session.current_location.lng
                },
                'last_update': session.last_update.isoformat(),
                'eta': eta.isoformat() if eta else None,
                'distance_remaining': distance_remaining,
                'deliveries_before': session.deliveries_remaining.index(delivery.id),
                'driver': {
                    'name': delivery.driver.name if delivery.driver else 'Driver',
                    'phone': delivery.driver.phone if delivery.driver else None
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get live tracking: {e}")
            return None
    
    async def handle_delivery_issue(
        self,
        session_id: str,
        delivery_id: int,
        issue_type: str,
        notes: str
    ) -> bool:
        """
        Handle delivery issues (customer not home, wrong address, etc.)
        
        Args:
            session_id: Tracking session ID
            delivery_id: Delivery ID
            issue_type: Type of issue
            notes: Additional notes
            
        Returns:
            Success status
        """
        try:
            session = self._tracking_sessions.get(session_id)
            if not session or not session.is_active:
                return False
            
            # Update delivery status
            delivery = self.session.query(Delivery).filter(
                Delivery.id == delivery_id
            ).first()
            
            if delivery:
                delivery.status = DeliveryStatus.FAILED
                delivery.notes = f"{issue_type}: {notes}"
                self.session.commit()
            
            # Remove from remaining deliveries
            if delivery_id in session.deliveries_remaining:
                session.deliveries_remaining.remove(delivery_id)
            
            # Send event
            await self._send_tracking_event(
                TrackingUpdate(
                    tracking_id=session_id,
                    delivery_id=delivery_id,
                    driver_id=session.driver_id,
                    vehicle_id=session.vehicle_id,
                    timestamp=datetime.now(),
                    location=session.current_location,
                    speed=0.0,
                    heading=0.0,
                    accuracy=10.0,
                    event_type=TrackingEventType.DELIVERY_FAILED,
                    event_data={
                        'issue_type': issue_type,
                        'notes': notes
                    }
                )
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to handle delivery issue: {e}")
            return False
    
    async def get_driver_performance(
        self,
        driver_id: int,
        date_range: Tuple[datetime, datetime]
    ) -> Dict[str, Any]:
        """
        Get driver performance metrics from tracking data
        
        Args:
            driver_id: Driver ID
            date_range: Date range for analysis
            
        Returns:
            Performance metrics
        """
        try:
            # Get completed deliveries
            deliveries = self.session.query(Delivery).filter(
                Delivery.driver_id == driver_id,
                Delivery.scheduled_date >= date_range[0].date(),
                Delivery.scheduled_date <= date_range[1].date(),
                Delivery.status == DeliveryStatus.COMPLETED
            ).all()
            
            # Calculate metrics
            total_deliveries = len(deliveries)
            on_time_deliveries = 0
            total_distance = 0.0
            total_duration = 0.0
            customer_ratings = []
            
            for delivery in deliveries:
                # Check if on time
                if delivery.actual_delivery_time and delivery.scheduled_time_end:
                    actual_time = delivery.actual_delivery_time.time()
                    if actual_time <= delivery.scheduled_time_end:
                        on_time_deliveries += 1
                
                # Get distance and duration from tracking
                if hasattr(delivery, 'tracking_data') and delivery.tracking_data:
                    total_distance += delivery.tracking_data.get('distance', 0)
                    total_duration += delivery.tracking_data.get('duration', 0)
                
                # Get customer rating if available
                if hasattr(delivery, 'customer_rating') and delivery.customer_rating:
                    customer_ratings.append(delivery.customer_rating)
            
            # Calculate averages
            avg_deliveries_per_day = total_deliveries / max(1, (date_range[1] - date_range[0]).days)
            on_time_percentage = (on_time_deliveries / total_deliveries * 100) if total_deliveries > 0 else 0
            avg_rating = sum(customer_ratings) / len(customer_ratings) if customer_ratings else 0
            
            return {
                'driver_id': driver_id,
                'period': {
                    'start': date_range[0].isoformat(),
                    'end': date_range[1].isoformat()
                },
                'metrics': {
                    'total_deliveries': total_deliveries,
                    'avg_deliveries_per_day': round(avg_deliveries_per_day, 1),
                    'on_time_percentage': round(on_time_percentage, 1),
                    'total_distance_km': round(total_distance, 1),
                    'total_hours': round(total_duration / 3600, 1),
                    'avg_speed_kmh': round(total_distance / (total_duration / 3600), 1) if total_duration > 0 else 0,
                    'customer_rating': round(avg_rating, 1),
                    'rating_count': len(customer_ratings)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get driver performance: {e}")
            return {}
    
    async def _get_driver_location(self, driver_id: int) -> Location:
        """Get driver's current or default location"""
        # In real implementation, this would get from driver's mobile app
        # For now, return depot location
        return Location(
            address="台北市信義區基隆路一段333號",
            lat=25.0330,
            lng=121.5654
        )
    
    async def _send_tracking_event(self, update: TrackingUpdate):
        """Send tracking event to interested parties"""
        # Store in Redis if available
        if self._redis_client:
            await self._redis_client.publish(
                f'tracking:{update.tracking_id}',
                json.dumps({
                    'event_type': update.event_type.value,
                    'timestamp': update.timestamp.isoformat(),
                    'location': {
                        'lat': update.location.lat,
                        'lng': update.location.lng
                    },
                    'data': update.event_data
                })
            )
        
        # Log event
        logger.info(f"Tracking event: {update.event_type.value} for session {update.tracking_id}")
    
    async def _check_route_deviation(
        self,
        session: TrackingSession,
        current_location: Location
    ) -> Optional[float]:
        """Check if driver has deviated from planned route"""
        # In real implementation, would compare with planned route polyline
        # For now, return None (no deviation)
        return None
    
    async def _get_next_delivery(self, session: TrackingSession) -> Optional[Dict[str, Any]]:
        """Get next delivery in the route"""
        if not session.deliveries_remaining:
            return None
        
        delivery_id = session.deliveries_remaining[0]
        delivery = self.session.query(Delivery).filter(
            Delivery.id == delivery_id
        ).first()
        
        if not delivery:
            return None
        
        client = delivery.client
        location = self.maps_client.geocode(client.address)
        
        return {
            'id': delivery.id,
            'client_name': client.name,
            'address': client.address,
            'location': location,
            'phone': client.phone,
            'cylinders': {
                '50kg': delivery.delivered_50kg,
                '20kg': delivery.delivered_20kg,
                '16kg': delivery.delivered_16kg,
                '10kg': delivery.delivered_10kg,
                '4kg': delivery.delivered_4kg
            }
        }
    
    async def _handle_arrival_at_customer(
        self,
        session: TrackingSession,
        next_delivery: Dict[str, Any]
    ):
        """Handle arrival at customer location"""
        await self._send_tracking_event(
            TrackingUpdate(
                tracking_id=session.session_id,
                delivery_id=next_delivery['id'],
                driver_id=session.driver_id,
                vehicle_id=session.vehicle_id,
                timestamp=datetime.now(),
                location=session.current_location,
                speed=0.0,
                heading=0.0,
                accuracy=10.0,
                event_type=TrackingEventType.ARRIVAL_AT_CUSTOMER,
                event_data={
                    'client_name': next_delivery['client_name'],
                    'address': next_delivery['address']
                }
            )
        )
    
    async def _store_proof_of_delivery(self, proof: ProofOfDelivery):
        """Store proof of delivery data"""
        # In real implementation, would store images to cloud storage
        # For now, just log
        logger.info(f"Proof of delivery stored for delivery {proof.delivery_id}")
    
    async def _complete_route(self, session: TrackingSession):
        """Complete the tracking session"""
        session.is_active = False
        
        # Update route status
        route = self.session.query(Route).filter(
            Route.id == session.route_id
        ).first()
        
        if route:
            route.status = 'completed'
            route.completed_at = datetime.now()
            self.session.commit()
        
        # Send completion event
        await self._send_tracking_event(
            TrackingUpdate(
                tracking_id=session.session_id,
                delivery_id=0,
                driver_id=session.driver_id,
                vehicle_id=session.vehicle_id,
                timestamp=datetime.now(),
                location=session.current_location,
                speed=0.0,
                heading=0.0,
                accuracy=10.0,
                event_type=TrackingEventType.ROUTE_COMPLETED,
                event_data={
                    'total_deliveries': len(session.deliveries_completed),
                    'total_distance': session.total_distance,
                    'duration': (datetime.now() - session.start_time).total_seconds() / 60
                }
            )
        )
    
    def _calculate_distance(self, loc1: Location, loc2: Location) -> float:
        """Calculate distance between two locations in km"""
        from math import radians, sin, cos, sqrt, atan2
        
        R = 6371  # Earth's radius in kilometers
        
        lat1, lon1 = radians(loc1.lat), radians(loc1.lng)
        lat2, lon2 = radians(loc2.lat), radians(loc2.lng)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        return R * c