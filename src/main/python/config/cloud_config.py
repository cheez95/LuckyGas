"""
Cloud services configuration management
Handles API keys and service configurations securely
"""

import os
from typing import Optional, Dict, Any
from pathlib import Path
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import logging

logger = logging.getLogger(__name__)

# Load environment variables
env_path = Path(__file__).parent.parent.parent.parent / '.env'
load_dotenv(env_path)


class CloudConfig:
    """Manages cloud service configurations and API keys"""
    
    def __init__(self):
        self._encryption_key = self._get_or_create_encryption_key()
        self._cipher = Fernet(self._encryption_key)
        self._config_cache = {}
        
    def _get_or_create_encryption_key(self) -> bytes:
        """Get or create encryption key for API keys"""
        key_file = Path(__file__).parent / '.key'
        
        if key_file.exists():
            with open(key_file, 'rb') as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            key_file.parent.mkdir(parents=True, exist_ok=True)
            with open(key_file, 'wb') as f:
                f.write(key)
            # Set restrictive permissions
            os.chmod(key_file, 0o600)
            return key
    
    def _encrypt_value(self, value: str) -> str:
        """Encrypt sensitive values"""
        return self._cipher.encrypt(value.encode()).decode()
    
    def _decrypt_value(self, encrypted_value: str) -> str:
        """Decrypt sensitive values"""
        return self._cipher.decrypt(encrypted_value.encode()).decode()
    
    @property
    def google_maps_config(self) -> Dict[str, Any]:
        """Google Maps Platform configuration"""
        return {
            'api_key': os.getenv('GOOGLE_MAPS_API_KEY'),
            'project_id': os.getenv('GOOGLE_CLOUD_PROJECT_ID'),
            'services': {
                'geocoding': True,
                'directions': True,
                'distance_matrix': True,
                'places': True,
                'roads': True,
                'timezone': True
            },
            'defaults': {
                'region': 'TW',
                'language': 'zh-TW',
                'units': 'metric',
                'traffic_model': 'best_guess',
                'avoid': [],  # Can include: tolls, highways, ferries, indoor
                'mode': 'driving'
            }
        }
    
    @property
    def mapbox_config(self) -> Dict[str, Any]:
        """MapBox configuration"""
        return {
            'access_token': os.getenv('MAPBOX_ACCESS_TOKEN'),
            'services': {
                'geocoding': True,
                'directions': True,
                'matrix': True,
                'isochrone': True,
                'optimization': True
            },
            'defaults': {
                'profile': 'mapbox/driving',
                'geometries': 'geojson',
                'overview': 'full',
                'steps': True,
                'annotations': ['duration', 'distance', 'speed']
            }
        }
    
    @property
    def openrouteservice_config(self) -> Dict[str, Any]:
        """OpenRouteService configuration"""
        return {
            'api_key': os.getenv('ORS_API_KEY'),
            'base_url': 'https://api.openrouteservice.org',
            'services': {
                'directions': True,
                'isochrone': True,
                'matrix': True,
                'optimization': True,
                'geocoding': True
            },
            'vehicle_profiles': {
                'driving-car': {
                    'name': '小型車',
                    'max_speed': 90,
                    'vehicle_type': 'car'
                },
                'driving-hgv': {
                    'name': '貨車',
                    'max_speed': 80,
                    'vehicle_type': 'hgv',
                    'weight': 3.5,  # tons
                    'height': 3.0,  # meters
                    'width': 2.0,   # meters
                    'length': 7.0   # meters
                }
            }
        }
    
    @property
    def twilio_config(self) -> Dict[str, Any]:
        """Twilio configuration for SMS/WhatsApp"""
        return {
            'account_sid': os.getenv('TWILIO_ACCOUNT_SID'),
            'auth_token': os.getenv('TWILIO_AUTH_TOKEN'),
            'phone_number': os.getenv('TWILIO_PHONE_NUMBER'),
            'whatsapp_number': os.getenv('TWILIO_WHATSAPP_NUMBER'),
            'messaging_service_sid': os.getenv('TWILIO_MESSAGING_SERVICE_SID'),
            'templates': {
                'delivery_scheduled': '您的瓦斯配送已排定於 {date} {time}，訂單編號：{order_id}',
                'delivery_on_way': '您的瓦斯正在配送中，預計 {eta} 送達。追蹤連結：{tracking_link}',
                'delivery_completed': '您的瓦斯已送達！感謝您的訂購。',
                'delivery_failed': '配送失敗，我們將重新安排配送時間。'
            }
        }
    
    @property
    def sendgrid_config(self) -> Dict[str, Any]:
        """SendGrid configuration for emails"""
        return {
            'api_key': os.getenv('SENDGRID_API_KEY'),
            'from_email': os.getenv('SENDGRID_FROM_EMAIL', 'noreply@luckygas.com'),
            'from_name': os.getenv('SENDGRID_FROM_NAME', 'LuckyGas'),
            'templates': {
                'delivery_confirmation': 'd-xxxxx',  # SendGrid template IDs
                'delivery_reminder': 'd-xxxxx',
                'invoice': 'd-xxxxx',
                'monthly_report': 'd-xxxxx'
            }
        }
    
    @property
    def here_maps_config(self) -> Dict[str, Any]:
        """HERE Maps configuration (optional)"""
        return {
            'app_id': os.getenv('HERE_APP_ID'),
            'app_code': os.getenv('HERE_APP_CODE'),
            'enabled': bool(os.getenv('HERE_APP_ID'))
        }
    
    @property
    def tomtom_config(self) -> Dict[str, Any]:
        """TomTom configuration (optional)"""
        return {
            'api_key': os.getenv('TOMTOM_API_KEY'),
            'enabled': bool(os.getenv('TOMTOM_API_KEY'))
        }
    
    @property
    def app_settings(self) -> Dict[str, Any]:
        """Application-level settings"""
        return {
            'enable_real_time_tracking': os.getenv('ENABLE_REAL_TIME_TRACKING', 'true').lower() == 'true',
            'enable_traffic_data': os.getenv('ENABLE_TRAFFIC_DATA', 'true').lower() == 'true',
            'enable_notifications': os.getenv('ENABLE_NOTIFICATIONS', 'true').lower() == 'true',
            'default_timezone': os.getenv('DEFAULT_TIMEZONE', 'Asia/Taipei'),
            'tracking_update_interval': int(os.getenv('TRACKING_UPDATE_INTERVAL', '30')),  # seconds
            'route_optimization_algorithm': os.getenv('ROUTE_OPTIMIZATION_ALGORITHM', 'or-tools'),  # or-tools, mapbox, custom
            'max_route_calculation_time': int(os.getenv('MAX_ROUTE_CALCULATION_TIME', '60')),  # seconds
        }
    
    def validate_configuration(self) -> Dict[str, bool]:
        """Validate that required API keys are configured"""
        validation = {
            'google_maps': bool(self.google_maps_config['api_key']),
            'mapbox': bool(self.mapbox_config['access_token']),
            'openrouteservice': bool(self.openrouteservice_config['api_key']),
            'twilio': bool(self.twilio_config['account_sid'] and self.twilio_config['auth_token']),
            'sendgrid': bool(self.sendgrid_config['api_key']),
            'here_maps': self.here_maps_config['enabled'],
            'tomtom': self.tomtom_config['enabled']
        }
        
        # Log validation results
        for service, is_valid in validation.items():
            if is_valid:
                logger.info(f"✅ {service} configured")
            else:
                logger.warning(f"⚠️  {service} not configured")
        
        return validation
    
    def get_primary_geocoding_service(self) -> str:
        """Get the primary geocoding service based on configuration"""
        if self.google_maps_config['api_key']:
            return 'google'
        elif self.mapbox_config['access_token']:
            return 'mapbox'
        elif self.openrouteservice_config['api_key']:
            return 'openrouteservice'
        else:
            raise ValueError("No geocoding service configured")
    
    def get_primary_routing_service(self) -> str:
        """Get the primary routing service based on configuration"""
        if self.google_maps_config['api_key']:
            return 'google'
        elif self.mapbox_config['access_token']:
            return 'mapbox'
        elif self.openrouteservice_config['api_key']:
            return 'openrouteservice'
        else:
            raise ValueError("No routing service configured")


# Global configuration instance
cloud_config = CloudConfig()