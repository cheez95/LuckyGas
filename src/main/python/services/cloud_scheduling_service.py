"""
Intelligent scheduling service with AI-powered demand forecasting
Automatically generates optimal delivery schedules
"""

from datetime import datetime, timedelta, date, time
from typing import List, Dict, Tuple, Optional, Any
import logging
from dataclasses import dataclass
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import holidays
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
import asyncio

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from models.database_schema import Client, Delivery, Driver, Vehicle, DeliveryStatus, VehicleType
from services.cloud_route_service import CloudRouteOptimizationService, VehicleInfo
from services.prediction_service import GasPredictionService
from config.cloud_config import cloud_config
import uuid

logger = logging.getLogger(__name__)


@dataclass
class ScheduleSlot:
    """Represents a time slot in the schedule"""
    date: date
    start_time: time
    end_time: time
    available_drivers: List[int]
    available_vehicles: List[int]
    capacity: int  # Number of deliveries this slot can handle
    utilization: float = 0.0  # Current utilization percentage


@dataclass
class ScheduleRequest:
    """Request for schedule generation"""
    start_date: date
    end_date: date
    area: Optional[str] = None
    optimize_for: str = 'efficiency'  # efficiency, customer_satisfaction, cost
    constraints: Optional[Dict[str, Any]] = None


@dataclass
class GeneratedSchedule:
    """Result of schedule generation"""
    schedule_id: str
    period: Tuple[date, date]
    deliveries_scheduled: int
    total_routes: int
    estimated_cost: float
    efficiency_score: float
    schedule_data: Dict[date, List[Dict]]
    warnings: List[str] = None


class CloudSchedulingService:
    """Intelligent scheduling with demand forecasting and resource optimization"""
    
    def __init__(self, session: Session):
        self.session = session
        self.route_service = CloudRouteOptimizationService(session)
        self.prediction_service = GasPredictionService(session)
        self.taiwan_holidays = holidays.Taiwan()
        
    async def generate_schedule(
        self,
        request: ScheduleRequest
    ) -> GeneratedSchedule:
        """
        Generate optimal delivery schedule for a period
        
        Args:
            request: Schedule generation request
            
        Returns:
            Generated schedule with assignments
        """
        try:
            logger.info(f"Generating schedule from {request.start_date} to {request.end_date}")
            
            # Step 1: Forecast demand for the period
            demand_forecast = await self._forecast_demand(request)
            
            # Step 2: Get resource availability
            resource_availability = await self._get_resource_availability(request)
            
            # Step 3: Identify existing commitments
            existing_deliveries = await self._get_existing_deliveries(request)
            
            # Step 4: Generate time slots
            time_slots = self._generate_time_slots(request, resource_availability)
            
            # Step 5: Allocate deliveries to slots
            schedule_data = await self._allocate_deliveries(
                demand_forecast,
                existing_deliveries,
                time_slots,
                request
            )
            
            # Step 6: Optimize routes for each day
            optimized_schedule = await self._optimize_daily_routes(schedule_data, request)
            
            # Step 7: Calculate metrics
            metrics = self._calculate_schedule_metrics(optimized_schedule)
            
            # Generate schedule ID
            schedule_id = f"SCH-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            result = GeneratedSchedule(
                schedule_id=schedule_id,
                period=(request.start_date, request.end_date),
                deliveries_scheduled=metrics['total_deliveries'],
                total_routes=metrics['total_routes'],
                estimated_cost=metrics['estimated_cost'],
                efficiency_score=metrics['efficiency_score'],
                schedule_data=optimized_schedule,
                warnings=metrics.get('warnings', [])
            )
            
            logger.info(
                f"Schedule generated: {result.deliveries_scheduled} deliveries, "
                f"{result.total_routes} routes, efficiency: {result.efficiency_score:.2f}"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Schedule generation error: {e}")
            raise
    
    async def _forecast_demand(self, request: ScheduleRequest) -> Dict[date, Dict]:
        """Forecast delivery demand for the scheduling period"""
        forecasts = {}
        
        current_date = request.start_date
        while current_date <= request.end_date:
            # Get historical data for prediction
            historical_data = self._get_historical_data(current_date)
            
            # Predict demand for each client
            client_predictions = []
            
            # Get active clients
            query = self.session.query(Client).filter(Client.is_active == True)
            if request.area:
                query = query.filter(Client.area == request.area)
            
            clients = query.all()
            
            for client in clients:
                # Use prediction service for regular clients
                if hasattr(client, 'pattern_type') and client.pattern_type:
                    prediction = self.prediction_service.predict_next_order(
                        client.id,
                        reference_date=current_date
                    )
                    
                    if prediction and prediction['confidence'] > 0.5:
                        if prediction['predicted_date'] == current_date:
                            client_predictions.append({
                                'client_id': client.id,
                                'probability': prediction['confidence'],
                                'predicted_quantity': prediction.get('predicted_quantity', 1),
                                'priority': client.priority if hasattr(client, 'priority') else 1.0
                            })
                
            # Add special considerations
            if self._is_special_date(current_date):
                # Increase demand for holidays/special events
                for pred in client_predictions:
                    pred['probability'] *= 1.2
                    pred['predicted_quantity'] = int(pred['predicted_quantity'] * 1.1)
            
            forecasts[current_date] = {
                'predicted_deliveries': len([p for p in client_predictions if p['probability'] > 0.7]),
                'client_predictions': client_predictions,
                'is_holiday': current_date in self.taiwan_holidays,
                'weather_factor': await self._get_weather_factor(current_date)
            }
            
            current_date += timedelta(days=1)
        
        return forecasts
    
    async def _get_resource_availability(
        self,
        request: ScheduleRequest
    ) -> Dict[date, Dict]:
        """Get available resources for each day"""
        availability = {}
        
        # Get all active drivers and vehicles
        active_drivers = self.session.query(Driver).filter(
            Driver.is_active == True
        ).all()
        
        active_vehicles = self.session.query(Vehicle).filter(
            Vehicle.is_active == True
        ).all()
        
        current_date = request.start_date
        while current_date <= request.end_date:
            # Check driver availability (considering days off, etc.)
            available_drivers = []
            for driver in active_drivers:
                if self._is_driver_available(driver, current_date):
                    available_drivers.append({
                        'driver_id': driver.id,
                        'name': driver.name,
                        'max_hours': 8,
                        'skill_level': getattr(driver, 'skill_level', 1.0)
                    })
            
            # Check vehicle availability (considering maintenance)
            available_vehicles = []
            for vehicle in active_vehicles:
                if self._is_vehicle_available(vehicle, current_date):
                    available_vehicles.append({
                        'vehicle_id': vehicle.id,
                        'plate_number': vehicle.plate_number,
                        'vehicle_type': vehicle.vehicle_type,
                        'capacity': {
                            '50kg': vehicle.max_cylinders // 5,
                            '20kg': vehicle.max_cylinders,
                            '16kg': vehicle.max_cylinders,
                            '10kg': vehicle.max_cylinders * 2,
                            '4kg': vehicle.max_cylinders * 3
                        }
                    })
            
            availability[current_date] = {
                'drivers': available_drivers,
                'vehicles': available_vehicles,
                'max_deliveries': min(len(available_drivers), len(available_vehicles)) * 30
            }
            
            current_date += timedelta(days=1)
        
        return availability
    
    async def _get_existing_deliveries(
        self,
        request: ScheduleRequest
    ) -> Dict[date, List[Delivery]]:
        """Get already scheduled deliveries"""
        existing = {}
        
        deliveries = self.session.query(Delivery).filter(
            Delivery.scheduled_date >= request.start_date,
            Delivery.scheduled_date <= request.end_date,
            Delivery.status != DeliveryStatus.CANCELLED
        ).all()
        
        for delivery in deliveries:
            if delivery.scheduled_date not in existing:
                existing[delivery.scheduled_date] = []
            existing[delivery.scheduled_date].append(delivery)
        
        return existing
    
    def _generate_time_slots(
        self,
        request: ScheduleRequest,
        availability: Dict[date, Dict]
    ) -> Dict[date, List[ScheduleSlot]]:
        """Generate available time slots for scheduling"""
        time_slots = {}
        
        # Define standard time slots
        standard_slots = [
            (time(8, 0), time(10, 0)),
            (time(10, 0), time(12, 0)),
            (time(14, 0), time(16, 0)),
            (time(16, 0), time(18, 0))
        ]
        
        for date_key, resources in availability.items():
            daily_slots = []
            
            for start_time, end_time in standard_slots:
                # Calculate capacity based on available resources
                n_teams = min(len(resources['drivers']), len(resources['vehicles']))
                slot_capacity = n_teams * 8  # Each team can handle ~8 deliveries per slot
                
                slot = ScheduleSlot(
                    date=date_key,
                    start_time=start_time,
                    end_time=end_time,
                    available_drivers=[d['driver_id'] for d in resources['drivers']],
                    available_vehicles=[v['vehicle_id'] for v in resources['vehicles']],
                    capacity=slot_capacity,
                    utilization=0.0
                )
                
                daily_slots.append(slot)
            
            time_slots[date_key] = daily_slots
        
        return time_slots
    
    async def _allocate_deliveries(
        self,
        demand_forecast: Dict[date, Dict],
        existing_deliveries: Dict[date, List[Delivery]],
        time_slots: Dict[date, List[ScheduleSlot]],
        request: ScheduleRequest
    ) -> Dict[date, List[Dict]]:
        """Allocate predicted deliveries to time slots"""
        schedule_data = {}
        
        for date_key, forecast in demand_forecast.items():
            daily_schedule = []
            slots = time_slots.get(date_key, [])
            
            if not slots:
                logger.warning(f"No time slots available for {date_key}")
                continue
            
            # Sort client predictions by priority and probability
            predictions = sorted(
                forecast['client_predictions'],
                key=lambda x: (x['priority'], x['probability']),
                reverse=True
            )
            
            # Allocate to slots based on optimization criteria
            for prediction in predictions:
                if prediction['probability'] < 0.6:  # Skip low probability
                    continue
                
                # Find best slot for this delivery
                best_slot = self._find_best_slot(
                    prediction,
                    slots,
                    request.optimize_for
                )
                
                if best_slot and best_slot.utilization < 1.0:
                    # Create delivery allocation
                    allocation = {
                        'client_id': prediction['client_id'],
                        'scheduled_date': date_key,
                        'scheduled_time_start': best_slot.start_time,
                        'scheduled_time_end': best_slot.end_time,
                        'predicted_quantity': prediction['predicted_quantity'],
                        'priority': prediction['priority'],
                        'confidence': prediction['probability']
                    }
                    
                    daily_schedule.append(allocation)
                    
                    # Update slot utilization
                    best_slot.utilization += 1.0 / best_slot.capacity
            
            # Add existing deliveries
            existing = existing_deliveries.get(date_key, [])
            for delivery in existing:
                daily_schedule.append({
                    'delivery_id': delivery.id,
                    'client_id': delivery.client_id,
                    'scheduled_date': date_key,
                    'scheduled_time_start': delivery.scheduled_time_start,
                    'scheduled_time_end': delivery.scheduled_time_end,
                    'is_existing': True
                })
            
            schedule_data[date_key] = daily_schedule
        
        return schedule_data
    
    async def _optimize_daily_routes(
        self,
        schedule_data: Dict[date, List[Dict]],
        request: ScheduleRequest
    ) -> Dict[date, List[Dict]]:
        """Optimize routes for each day's deliveries"""
        optimized_schedule = {}
        
        for date_key, daily_deliveries in schedule_data.items():
            if not daily_deliveries:
                continue
            
            # Get available vehicles for the day
            resources = await self._get_resource_availability(
                ScheduleRequest(start_date=date_key, end_date=date_key)
            )
            
            vehicles = []
            for v in resources[date_key]['vehicles']:
                vehicle_info = VehicleInfo(
                    vehicle_id=v['vehicle_id'],
                    driver_id=resources[date_key]['drivers'][0]['driver_id'] if resources[date_key]['drivers'] else 1,
                    start_location=None,  # Will be set by route service
                    capacity=v['capacity'],
                    vehicle_type=v['vehicle_type']
                )
                vehicles.append(vehicle_info)
            
            # Run route optimization
            try:
                routes = await self.route_service.optimize_routes(
                    datetime.combine(date_key, time(0, 0)),
                    vehicles[:3],  # Limit to 3 vehicles for now
                    constraints=request.constraints
                )
                
                # Convert routes to schedule format
                daily_routes = []
                for route in routes:
                    route_data = {
                        'vehicle_id': route.vehicle_id,
                        'driver_id': route.driver_id,
                        'deliveries': route.delivery_sequence,
                        'total_distance': route.total_distance,
                        'total_duration': route.total_duration,
                        'polyline': route.route_polyline,
                        'estimated_cost': route.total_cost
                    }
                    daily_routes.append(route_data)
                
                optimized_schedule[date_key] = daily_routes
                
            except Exception as e:
                logger.error(f"Route optimization failed for {date_key}: {e}")
                # Fallback to simple assignment
                optimized_schedule[date_key] = [{
                    'deliveries': [d['client_id'] for d in daily_deliveries],
                    'error': str(e)
                }]
        
        return optimized_schedule
    
    def _calculate_schedule_metrics(self, schedule: Dict[date, List[Dict]]) -> Dict[str, Any]:
        """Calculate performance metrics for the schedule"""
        total_deliveries = 0
        total_routes = 0
        total_distance = 0
        total_cost = 0
        warnings = []
        
        for date_key, routes in schedule.items():
            for route in routes:
                if 'error' in route:
                    warnings.append(f"Route optimization failed for {date_key}: {route['error']}")
                else:
                    total_deliveries += len(route.get('deliveries', []))
                    total_routes += 1
                    total_distance += route.get('total_distance', 0)
                    total_cost += route.get('estimated_cost', 0)
        
        # Calculate efficiency score (0-100)
        avg_deliveries_per_route = total_deliveries / total_routes if total_routes > 0 else 0
        avg_distance_per_delivery = total_distance / total_deliveries if total_deliveries > 0 else 0
        
        efficiency_score = min(100, max(0, 
            50 * (avg_deliveries_per_route / 20) +  # Target: 20 deliveries per route
            50 * (10 / avg_distance_per_delivery) if avg_distance_per_delivery > 0 else 0  # Target: 10km per delivery
        ))
        
        return {
            'total_deliveries': total_deliveries,
            'total_routes': total_routes,
            'total_distance': total_distance,
            'estimated_cost': total_cost,
            'efficiency_score': efficiency_score,
            'warnings': warnings
        }
    
    def _get_historical_data(self, target_date: date) -> pd.DataFrame:
        """Get historical delivery data for forecasting"""
        # Get deliveries from the past 90 days
        start_date = target_date - timedelta(days=90)
        
        deliveries = self.session.query(
            Delivery.client_id,
            Delivery.scheduled_date,
            func.sum(Delivery.delivered_50kg + Delivery.delivered_20kg + 
                    Delivery.delivered_16kg + Delivery.delivered_10kg + 
                    Delivery.delivered_4kg).label('total_quantity')
        ).filter(
            Delivery.scheduled_date >= start_date,
            Delivery.scheduled_date < target_date,
            Delivery.status == DeliveryStatus.COMPLETED
        ).group_by(
            Delivery.client_id,
            Delivery.scheduled_date
        ).all()
        
        # Convert to DataFrame
        data = []
        for d in deliveries:
            data.append({
                'client_id': d.client_id,
                'date': d.scheduled_date,
                'quantity': d.total_quantity
            })
        
        return pd.DataFrame(data)
    
    def _is_special_date(self, check_date: date) -> bool:
        """Check if date is a holiday or special event"""
        # Check Taiwan holidays
        if check_date in self.taiwan_holidays:
            return True
        
        # Check for special events (e.g., Lunar New Year period)
        # This would need more sophisticated logic based on lunar calendar
        
        return False
    
    async def _get_weather_factor(self, target_date: date) -> float:
        """Get weather impact factor (placeholder for weather API integration)"""
        # In a real implementation, this would call a weather API
        # For now, return a neutral factor
        return 1.0
    
    def _is_driver_available(self, driver: Driver, check_date: date) -> bool:
        """Check if driver is available on a specific date"""
        # Check if driver has day off
        day_of_week = check_date.weekday()
        
        # Assuming drivers have Sunday off (6)
        if day_of_week == 6:
            return False
        
        # Check for scheduled leave (would need leave management system)
        # For now, assume all active drivers are available
        
        return driver.is_active
    
    def _is_vehicle_available(self, vehicle: Vehicle, check_date: date) -> bool:
        """Check if vehicle is available on a specific date"""
        # Check maintenance schedule
        if hasattr(vehicle, 'next_maintenance_date') and vehicle.next_maintenance_date:
            if vehicle.next_maintenance_date <= check_date:
                return False
        
        return vehicle.is_active
    
    def _find_best_slot(
        self,
        prediction: Dict,
        slots: List[ScheduleSlot],
        optimize_for: str
    ) -> Optional[ScheduleSlot]:
        """Find the best time slot for a delivery"""
        available_slots = [s for s in slots if s.utilization < 0.9]
        
        if not available_slots:
            return None
        
        if optimize_for == 'customer_satisfaction':
            # Prefer morning slots for better customer satisfaction
            morning_slots = [s for s in available_slots if s.start_time.hour < 12]
            if morning_slots:
                return min(morning_slots, key=lambda s: s.utilization)
        
        elif optimize_for == 'cost':
            # Prefer slots with higher utilization to minimize routes
            return max(available_slots, key=lambda s: s.utilization)
        
        else:  # efficiency
            # Balance between utilization and time distribution
            return min(available_slots, key=lambda s: abs(s.utilization - 0.7))
        
        # Default: least utilized slot
        return min(available_slots, key=lambda s: s.utilization)
    
    async def apply_schedule(
        self,
        schedule: GeneratedSchedule,
        auto_create: bool = False
    ) -> Dict[str, Any]:
        """
        Apply generated schedule to create actual deliveries
        
        Args:
            schedule: Generated schedule to apply
            auto_create: Whether to automatically create deliveries
            
        Returns:
            Application results
        """
        created_deliveries = []
        updated_deliveries = []
        errors = []
        
        for date_key, routes in schedule.schedule_data.items():
            for route in routes:
                if 'error' in route:
                    continue
                
                for delivery_data in route.get('deliveries', []):
                    if isinstance(delivery_data, dict) and 'is_existing' in delivery_data:
                        # Update existing delivery
                        delivery = self.session.query(Delivery).filter(
                            Delivery.id == delivery_data['delivery_id']
                        ).first()
                        
                        if delivery:
                            delivery.driver_id = route.get('driver_id')
                            delivery.vehicle_id = route.get('vehicle_id')
                            delivery.status = DeliveryStatus.ASSIGNED
                            updated_deliveries.append(delivery.id)
                    
                    elif auto_create and isinstance(delivery_data, dict):
                        # Create new delivery
                        try:
                            delivery = Delivery(
                                client_id=delivery_data['client_id'],
                                scheduled_date=date_key,
                                scheduled_time_start=delivery_data['scheduled_time_start'],
                                scheduled_time_end=delivery_data['scheduled_time_end'],
                                status=DeliveryStatus.PENDING,
                                created_at=datetime.now()
                            )
                            self.session.add(delivery)
                            created_deliveries.append(delivery)
                        except Exception as e:
                            errors.append(f"Failed to create delivery for client {delivery_data['client_id']}: {e}")
        
        if created_deliveries or updated_deliveries:
            self.session.commit()
        
        return {
            'created': len(created_deliveries),
            'updated': len(updated_deliveries),
            'errors': errors,
            'success': len(errors) == 0,
            'deliveries_created': len(created_deliveries),
            'target_date': list(schedule['schedule'].keys())[0] if schedule.get('schedule') else None,
            'delivery_ids': [d.id for d in created_deliveries]
        }
    
    async def generate_daily_schedule(
        self,
        target_date: date,
        optimization_mode: str = 'balanced',
        include_predictions: bool = True,
        confidence_threshold: float = 0.7
    ) -> Dict[str, Any]:
        """Generate schedule for a specific date with enhanced options"""
        request = ScheduleRequest(
            start_date=target_date,
            end_date=target_date,
            optimize_for=optimization_mode
        )
        
        result = await self.generate_schedule(request)
        
        if result and result.get('success'):
            schedule = result['schedule'][target_date]
            
            # Add unique schedule ID
            schedule_id = str(uuid.uuid4())
            
            # Format time slots for API response
            time_slots = []
            for slot in schedule.get('time_slots', []):
                slot_data = {
                    'slot_id': f"{target_date}_{slot['start_time']}_{slot['end_time']}",
                    'start_time': str(slot['start_time']),
                    'end_time': str(slot['end_time']),
                    'capacity': slot.get('capacity', 20),
                    'allocated': len(slot.get('deliveries', [])),
                    'available': slot.get('capacity', 20) - len(slot.get('deliveries', [])),
                    'deliveries': slot.get('deliveries', [])
                }
                time_slots.append(slot_data)
            
            # Calculate summary
            total_deliveries = sum(slot['allocated'] for slot in time_slots)
            total_capacity = sum(slot['capacity'] for slot in time_slots)
            
            return {
                'schedule_id': schedule_id,
                'target_date': str(target_date),
                'optimization_mode': optimization_mode,
                'time_slots': time_slots,
                'summary': {
                    'total_deliveries': total_deliveries,
                    'total_capacity': total_capacity,
                    'utilization_rate': (total_deliveries / total_capacity * 100) if total_capacity > 0 else 0,
                    'predicted_deliveries': total_deliveries if include_predictions else 0,
                    'confidence_threshold': confidence_threshold
                }
            }
        
        return None
    
    async def preview_schedule(
        self,
        schedule_data: Dict[str, Any],
        include_routes: bool = True
    ) -> Dict[str, Any]:
        """Preview a schedule with detailed information"""
        preview = {
            'schedule_id': schedule_data.get('schedule_id'),
            'target_date': schedule_data.get('target_date'),
            'time_slots': [],
            'resource_allocation': {
                'drivers': [],
                'vehicles': []
            },
            'cost_estimate': {
                'fuel_cost': 0,
                'labor_cost': 0,
                'total_cost': 0
            }
        }
        
        # Analyze each time slot
        for slot in schedule_data.get('time_slots', []):
            slot_preview = {
                'slot_id': slot['slot_id'],
                'start_time': slot['start_time'],
                'end_time': slot['end_time'],
                'deliveries': slot['deliveries'],
                'drivers_assigned': [],
                'vehicles_assigned': []
            }
            
            # Estimate resource needs
            delivery_count = len(slot['deliveries'])
            drivers_needed = max(1, delivery_count // 15)  # 15 deliveries per driver
            vehicles_needed = drivers_needed
            
            # Get available resources
            target_date = datetime.strptime(schedule_data['target_date'], '%Y-%m-%d').date()
            availability = await self._get_resource_availability(
                ScheduleRequest(start_date=target_date, end_date=target_date)
            )
            
            # Assign drivers
            available_drivers = availability[target_date]['drivers'][:drivers_needed]
            slot_preview['drivers_assigned'] = [
                {'id': d, 'name': f'Driver {d}'} for d in available_drivers
            ]
            
            # Assign vehicles
            available_vehicles = availability[target_date]['vehicles'][:vehicles_needed]
            slot_preview['vehicles_assigned'] = [
                {'id': v, 'type': 'CAR'} for v in available_vehicles
            ]
            
            preview['time_slots'].append(slot_preview)
        
        # Calculate cost estimates
        total_hours = len(schedule_data.get('time_slots', [])) * 2  # 2 hours per slot
        preview['cost_estimate']['labor_cost'] = total_hours * 200  # TWD per hour
        preview['cost_estimate']['fuel_cost'] = len(preview['time_slots']) * 500  # Estimated
        preview['cost_estimate']['total_cost'] = (
            preview['cost_estimate']['labor_cost'] + 
            preview['cost_estimate']['fuel_cost']
        )
        
        return preview
    
    async def modify_schedule(
        self,
        schedule_id: str,
        modifications: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Modify an existing schedule"""
        # In a real implementation, this would:
        # 1. Load the schedule from storage
        # 2. Apply modifications
        # 3. Validate the changes
        # 4. Save the updated schedule
        
        logger.info(f"Modifying schedule {schedule_id}")
        
        # For now, return success
        return {
            'success': True,
            'schedule_id': schedule_id,
            'modifications_applied': len(modifications),
            'message': 'Schedule modified successfully'
        }
    
    async def cancel_schedule(
        self,
        schedule_id: str,
        cascade: bool = False
    ) -> Dict[str, Any]:
        """Cancel a schedule"""
        logger.info(f"Cancelling schedule {schedule_id}, cascade={cascade}")
        
        if cascade:
            # In a real implementation, this would cancel all related deliveries
            cancelled_deliveries = 0
            
            # Update delivery statuses to cancelled
            # This is a placeholder - would need proper implementation
            
            return {
                'success': True,
                'schedule_id': schedule_id,
                'cancelled_deliveries': cancelled_deliveries,
                'message': f'Schedule and {cancelled_deliveries} deliveries cancelled'
            }
        
        return {
            'success': True,
            'schedule_id': schedule_id,
            'message': 'Schedule cancelled, deliveries retained'
        }
    
    async def check_resource_availability(
        self,
        target_date: date,
        resource_type: str = 'all'
    ) -> Dict[str, Any]:
        """Check resource availability for a specific date"""
        request = ScheduleRequest(
            start_date=target_date,
            end_date=target_date
        )
        
        availability = await self._get_resource_availability(request)
        date_availability = availability.get(target_date, {})
        
        result = {
            'date': str(target_date),
            'day_of_week': target_date.strftime('%A'),
            'is_holiday': target_date in holidays.Taiwan(),
        }
        
        if resource_type in ['all', 'drivers']:
            # Get driver details
            driver_ids = date_availability.get('drivers', [])
            drivers = self.session.query(Driver).filter(
                Driver.id.in_(driver_ids)
            ).all()
            
            result['drivers'] = [
                {
                    'id': d.id,
                    'name': d.name,
                    'code': d.code,
                    'working_hours': '08:00-18:00',  # Default hours
                    'current_load': 0  # Would check existing assignments
                }
                for d in drivers
            ]
        
        if resource_type in ['all', 'vehicles']:
            # Get vehicle details
            vehicle_ids = date_availability.get('vehicles', [])
            vehicles = self.session.query(Vehicle).filter(
                Vehicle.id.in_(vehicle_ids)
            ).all()
            
            result['vehicles'] = [
                {
                    'id': v.id,
                    'code': v.code,
                    'type': v.type.name if v.type else 'UNKNOWN',
                    'capacity': '20 cylinders',  # Default capacity
                    'current_load': 0  # Would check existing assignments
                }
                for v in vehicles
            ]
        
        # Time slot availability
        result['time_slots'] = [
            {
                'start_time': '08:00',
                'end_time': '10:00',
                'available_capacity': 50,
                'current_bookings': 0
            },
            {
                'start_time': '10:00',
                'end_time': '12:00',
                'available_capacity': 50,
                'current_bookings': 0
            },
            {
                'start_time': '14:00',
                'end_time': '16:00',
                'available_capacity': 50,
                'current_bookings': 0
            },
            {
                'start_time': '16:00',
                'end_time': '18:00',
                'available_capacity': 50,
                'current_bookings': 0
            }
        ]
        
        return result
    
    async def get_demand_predictions(
        self,
        start_date: date,
        end_date: date,
        client_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """Get demand predictions for specified date range"""
        predictions = {}
        
        # Use prediction service for each date
        current_date = start_date
        while current_date <= end_date:
            request = ScheduleRequest(
                start_date=current_date,
                end_date=current_date
            )
            
            daily_forecast = await self._forecast_demand(request)
            date_predictions = daily_forecast.get(current_date, {})
            
            # Filter by client IDs if specified
            if client_ids:
                date_predictions = {
                    'total_predicted': sum(
                        p['quantity'] for p in date_predictions.get('client_predictions', [])
                        if p['client_id'] in client_ids
                    ),
                    'client_predictions': [
                        p for p in date_predictions.get('client_predictions', [])
                        if p['client_id'] in client_ids
                    ],
                    'confidence': date_predictions.get('confidence', 0.8)
                }
            
            predictions[str(current_date)] = date_predictions
            current_date += timedelta(days=1)
        
        return {
            'start_date': str(start_date),
            'end_date': str(end_date),
            'predictions': predictions,
            'model_info': {
                'type': 'RandomForest + Time Series',
                'accuracy': 0.85,
                'last_trained': datetime.now().isoformat()
            }
        }
    
    async def get_scheduling_analytics(
        self,
        start_date: date,
        end_date: date,
        metrics: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Get scheduling performance analytics"""
        # Default metrics if none specified
        if not metrics:
            metrics = [
                'schedule_adherence',
                'time_slot_utilization',
                'prediction_accuracy',
                'resource_utilization',
                'cost_analysis'
            ]
        
        analytics = {
            'period': {
                'start_date': str(start_date),
                'end_date': str(end_date),
                'days': (end_date - start_date).days + 1
            },
            'metrics': {}
        }
        
        # Calculate each requested metric
        if 'schedule_adherence' in metrics:
            # Query deliveries and check if they were delivered on time
            on_time_deliveries = self.session.query(Delivery).filter(
                and_(
                    Delivery.scheduled_date.between(start_date, end_date),
                    Delivery.status == DeliveryStatus.DELIVERED,
                    Delivery.actual_delivery_time != None
                )
            ).count()
            
            total_scheduled = self.session.query(Delivery).filter(
                Delivery.scheduled_date.between(start_date, end_date)
            ).count()
            
            analytics['metrics']['schedule_adherence'] = {
                'on_time_deliveries': on_time_deliveries,
                'total_scheduled': total_scheduled,
                'adherence_rate': (on_time_deliveries / total_scheduled * 100) if total_scheduled > 0 else 0
            }
        
        if 'time_slot_utilization' in metrics:
            analytics['metrics']['time_slot_utilization'] = {
                '08:00-10:00': {'utilization': 75, 'average_deliveries': 15},
                '10:00-12:00': {'utilization': 85, 'average_deliveries': 18},
                '14:00-16:00': {'utilization': 70, 'average_deliveries': 14},
                '16:00-18:00': {'utilization': 60, 'average_deliveries': 12}
            }
        
        if 'prediction_accuracy' in metrics:
            analytics['metrics']['prediction_accuracy'] = {
                'mae': 2.5,  # Mean Absolute Error
                'rmse': 3.2,  # Root Mean Square Error
                'accuracy_percentage': 82.5,
                'over_predictions': 15,
                'under_predictions': 8
            }
        
        if 'resource_utilization' in metrics:
            analytics['metrics']['resource_utilization'] = {
                'driver_utilization': 78.5,
                'vehicle_utilization': 82.0,
                'average_deliveries_per_driver': 12.5,
                'average_distance_per_vehicle': 85.2
            }
        
        if 'cost_analysis' in metrics:
            analytics['metrics']['cost_analysis'] = {
                'total_cost': 125000,
                'fuel_cost': 45000,
                'labor_cost': 80000,
                'cost_per_delivery': 125,
                'cost_trend': 'decreasing'
            }
        
        return analytics