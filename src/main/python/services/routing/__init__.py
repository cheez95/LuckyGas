"""
Route optimization service initialization
Registers available optimizers with the factory
"""
from domain.services.route_optimizer import RouteOptimizerFactory
from .simple_route_optimizer import SimpleRouteOptimizer
from .cloud_route_optimizer import CloudRouteOptimizer

# Register available optimizers
RouteOptimizerFactory.register_optimizer('simple', SimpleRouteOptimizer)
RouteOptimizerFactory.register_optimizer('cloud', CloudRouteOptimizer)

# Default optimizer
DEFAULT_OPTIMIZER = 'simple'

__all__ = [
    'SimpleRouteOptimizer',
    'CloudRouteOptimizer',
    'DEFAULT_OPTIMIZER'
]