"""
Unified route optimization interface
Provides a consistent API for different route optimization strategies
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
from datetime import date, datetime
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class OptimizationRequest:
    """Standard request format for route optimization"""
    date: date
    deliveries: List[Dict[str, Any]]
    drivers: List[Dict[str, Any]]
    vehicles: List[Dict[str, Any]]
    constraints: Optional[Dict[str, Any]] = None
    optimization_mode: str = 'balanced'  # balanced, cost, speed, quality


@dataclass 
class OptimizationResult:
    """Standard result format for route optimization"""
    success: bool
    routes: List[Dict[str, Any]]
    metrics: Dict[str, float]
    errors: List[str]
    optimization_time: float


class IRouteOptimizer(ABC):
    """Abstract interface for route optimization strategies"""
    
    @abstractmethod
    async def optimize(self, request: OptimizationRequest) -> OptimizationResult:
        """Optimize routes based on the request"""
        pass
    
    @abstractmethod
    def get_capabilities(self) -> Dict[str, Any]:
        """Return optimizer capabilities and limitations"""
        pass
    
    @abstractmethod
    def validate_request(self, request: OptimizationRequest) -> Tuple[bool, List[str]]:
        """Validate if the request can be processed"""
        pass


class RouteOptimizerFactory:
    """Factory for creating route optimizers based on configuration"""
    
    _optimizers = {}
    
    @classmethod
    def register_optimizer(cls, name: str, optimizer_class: type):
        """Register a new optimizer implementation"""
        cls._optimizers[name] = optimizer_class
    
    @classmethod
    def create_optimizer(cls, name: str, session: Any, config: Optional[Dict] = None) -> IRouteOptimizer:
        """Create an optimizer instance"""
        if name not in cls._optimizers:
            raise ValueError(f"Unknown optimizer: {name}")
        
        optimizer_class = cls._optimizers[name]
        return optimizer_class(session, config or {})
    
    @classmethod
    def list_optimizers(cls) -> List[str]:
        """List available optimizer names"""
        return list(cls._optimizers.keys())


class RouteOptimizationService:
    """
    Main service for route optimization
    Delegates to appropriate optimizer based on configuration
    """
    
    def __init__(self, session: Any, config: Optional[Dict] = None):
        self.session = session
        self.config = config or {}
        self.default_optimizer = self.config.get('default_optimizer', 'simple')
        
    async def optimize_routes(
        self,
        date: date,
        deliveries: List[Dict[str, Any]],
        optimization_mode: str = 'balanced'
    ) -> OptimizationResult:
        """
        Optimize routes for given deliveries
        
        This method:
        1. Determines the best optimizer to use
        2. Prepares the optimization request
        3. Delegates to the appropriate optimizer
        4. Returns standardized results
        """
        start_time = datetime.now()
        
        # Determine which optimizer to use
        optimizer_name = self._select_optimizer(deliveries, optimization_mode)
        
        try:
            # Get available resources
            drivers = await self._get_available_drivers(date)
            vehicles = await self._get_available_vehicles(date)
            
            # Create optimization request
            request = OptimizationRequest(
                date=date,
                deliveries=deliveries,
                drivers=drivers,
                vehicles=vehicles,
                optimization_mode=optimization_mode,
                constraints=self.config.get('constraints', {})
            )
            
            # Create and run optimizer
            optimizer = RouteOptimizerFactory.create_optimizer(
                optimizer_name,
                self.session,
                self.config
            )
            
            # Validate request
            is_valid, errors = optimizer.validate_request(request)
            if not is_valid:
                return OptimizationResult(
                    success=False,
                    routes=[],
                    metrics={},
                    errors=errors,
                    optimization_time=(datetime.now() - start_time).total_seconds()
                )
            
            # Run optimization
            result = await optimizer.optimize(request)
            
            # Add optimization time
            result.optimization_time = (datetime.now() - start_time).total_seconds()
            
            logger.info(
                f"Route optimization completed using {optimizer_name}: "
                f"{len(result.routes)} routes created in {result.optimization_time:.2f}s"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Route optimization failed: {str(e)}")
            return OptimizationResult(
                success=False,
                routes=[],
                metrics={},
                errors=[str(e)],
                optimization_time=(datetime.now() - start_time).total_seconds()
            )
    
    def _select_optimizer(
        self,
        deliveries: List[Dict[str, Any]],
        optimization_mode: str
    ) -> str:
        """Select the best optimizer based on the request characteristics"""
        
        # Check if advanced features are needed
        needs_advanced = False
        
        # Check for complex constraints
        if len(deliveries) > 50:
            needs_advanced = True
        
        # Check for time windows
        if any(d.get('time_window') for d in deliveries):
            needs_advanced = True
        
        # Check for special vehicle requirements
        if any(d.get('vehicle_type_required') for d in deliveries):
            needs_advanced = True
        
        # Check optimization mode
        if optimization_mode in ['cost', 'quality']:
            needs_advanced = True
        
        # Return appropriate optimizer
        if needs_advanced and 'cloud' in RouteOptimizerFactory.list_optimizers():
            return 'cloud'
        
        return self.default_optimizer
    
    async def _get_available_drivers(self, date: date) -> List[Dict[str, Any]]:
        """Get available drivers for the given date"""
        from models.database_schema import Driver
        
        drivers = self.session.query(Driver).filter(
            Driver.is_active == True
        ).all()
        
        return [
            {
                'id': d.id,
                'name': d.name,
                'code': d.code,
                'max_weight': 1000,  # Default capacity
                'hourly_cost': 200  # TWD per hour
            }
            for d in drivers
        ]
    
    async def _get_available_vehicles(self, date: date) -> List[Dict[str, Any]]:
        """Get available vehicles for the given date"""
        from models.database_schema import Vehicle
        
        vehicles = self.session.query(Vehicle).filter(
            Vehicle.is_active == True
        ).all()
        
        return [
            {
                'id': v.id,
                'code': v.code,
                'type': v.type.name if v.type else 'CAR',
                'capacity': 20,  # Default cylinder capacity
                'cost_per_km': 10  # TWD per km
            }
            for v in vehicles
        ]