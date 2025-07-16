import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from datetime import datetime, date, time, timedelta
from typing import List, Dict, Tuple, Optional
import numpy as np
from dataclasses import dataclass
import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models.database_schema import Client, Delivery, Driver, Vehicle, Route, VehicleType, DeliveryStatus
from services.prediction_service import GasPredictionService
from common.geo_utils import calculate_haversine_distance, validate_coordinates
from common.time_utils import parse_client_time_windows, calculate_service_time
from common.vehicle_utils import calculate_required_vehicle_type

logger = logging.getLogger(__name__)


@dataclass
class DeliveryPoint:
    """配送點資料結構"""
    client_id: int
    client_code: str
    name: str
    address: str
    lat: float = 0.0  # 緯度
    lng: float = 0.0  # 經度
    time_windows: List[Tuple[int, int]] = None  # 可配送時段 [(start_hour, end_hour)]
    service_time: int = 15  # 服務時間（分鐘）
    demand: Dict[str, int] = None  # 需求量 {'50kg': 1, '20kg': 2, ...}
    priority: float = 1.0  # 優先度
    vehicle_restriction: VehicleType = VehicleType.ALL  # 車輛限制


@dataclass
class RouteSegment:
    """路線段資料結構"""
    from_point: DeliveryPoint
    to_point: DeliveryPoint
    distance: float  # 距離（公里）
    duration: int  # 時間（分鐘）
    arrival_time: datetime
    departure_time: datetime


class RouteOptimizationService:
    """路線優化服務"""
    
    def __init__(self, session: Session):
        self.session = session
        self.prediction_service = GasPredictionService(session)
        
        # 台東縣座標範圍（近似值）
        self.taitung_bounds = {
            'min_lat': 22.5,
            'max_lat': 23.5,
            'min_lng': 120.8,
            'max_lng': 121.6
        }
        
        # 區域中心點座標（範例）
        self.area_centers = {
            'A-瑞光': (22.7553, 121.1504),  # 台東市
            'B-四維': (22.7589, 121.1420),
            'C-復國': (22.7961, 121.1267),
            'D-泰東': (22.7469, 121.1001),
            'E-寶桑': (22.7511, 121.1456),
            'F-成功線': (23.0969, 121.3736),  # 成功鎮
            'G-南迴線': (22.5477, 120.9486),  # 南迴地區
        }
        
    def geocode_address(self, address: str) -> Tuple[float, float]:
        """
        地址轉換為座標（簡化版本）
        實際應用應接入 Google Geocoding API
        
        Args:
            address: 地址字串
            
        Returns:
            Tuple[float, float]: (緯度, 經度)
        """
        # 簡化處理：根據地址中的區域關鍵字返回近似座標
        for area, coords in self.area_centers.items():
            area_name = area.split('-')[1]
            if area_name in address:
                # 加入隨機偏移模擬不同地點
                lat = coords[0] + np.random.uniform(-0.05, 0.05)
                lng = coords[1] + np.random.uniform(-0.05, 0.05)
                return (lat, lng)
        
        # 預設返回台東市中心
        return (22.7553 + np.random.uniform(-0.1, 0.1), 
                121.1504 + np.random.uniform(-0.1, 0.1))
    
    def calculate_distance(self, point1: Tuple[float, float], point2: Tuple[float, float]) -> float:
        """
        計算兩點間的距離（公里）
        使用 Haversine 公式計算球面距離
        
        Args:
            point1: (緯度, 經度)
            point2: (緯度, 經度)
            
        Returns:
            float: 距離（公里）
        """
        return calculate_haversine_distance(point1[0], point1[1], point2[0], point2[1])
    
    def estimate_travel_time(self, distance: float, vehicle_type: VehicleType) -> int:
        """
        估算行駛時間（分鐘）
        
        Args:
            distance: 距離（公里）
            vehicle_type: 車輛類型
            
        Returns:
            int: 時間（分鐘）
        """
        # 平均速度（公里/小時）
        avg_speed = {
            VehicleType.CAR: 40,  # 市區平均速度
            VehicleType.MOTORCYCLE: 30,  # 機車較靈活但載重影響速度
            VehicleType.ALL: 35
        }
        
        speed = avg_speed.get(vehicle_type, 35)
        travel_time = (distance / speed) * 60  # 轉換為分鐘
        
        # 加入交通狀況因子（尖峰時段較慢）
        current_hour = datetime.now().hour
        if 7 <= current_hour <= 9 or 17 <= current_hour <= 19:
            travel_time *= 1.3  # 尖峰時段增加30%時間
        
        return int(travel_time)
    
    def get_delivery_points_for_date(self, delivery_date: date) -> List[DeliveryPoint]:
        """
        取得指定日期的配送點
        
        Args:
            delivery_date: 配送日期
            
        Returns:
            List[DeliveryPoint]: 配送點列表
        """
        # 從預測服務取得優先配送清單
        priority_deliveries = self.prediction_service.get_priority_deliveries(delivery_date)
        
        delivery_points = []
        for item in priority_deliveries:
            client = self.session.query(Client).get(item['client_id'])
            if not client:
                continue
            
            # 解析營業時間
            time_windows = [(tw[0].hour, tw[1].hour) for tw in parse_client_time_windows(client)]
            
            # 建立配送點
            lat, lng = self.geocode_address(client.address)
            point = DeliveryPoint(
                client_id=client.id,
                client_code=client.client_code,
                name=client.short_name or client.invoice_title,
                address=client.address,
                lat=lat,
                lng=lng,
                time_windows=time_windows,
                service_time=15 if client.cylinder_50kg else 10,  # 50kg需要更多時間
                demand=self._estimate_demand(client),
                priority=item['priority_score'],
                vehicle_restriction=client.vehicle_type
            )
            delivery_points.append(point)
        
        return delivery_points
    
    def _estimate_demand(self, client: Client) -> Dict[str, int]:
        """估算客戶需求量"""
        demand = {}
        
        # 基於庫存估算需求
        if client.cylinder_50kg > 0:
            demand['50kg'] = 1
        if client.cylinder_20kg + client.cylinder_20kg_business + client.cylinder_20kg_goodluck > 0:
            demand['20kg'] = 2
        if client.cylinder_16kg + client.cylinder_16kg_business + client.cylinder_16kg_goodluck > 0:
            demand['16kg'] = 2
        if client.cylinder_10kg + client.cylinder_10kg_safety > 0:
            demand['10kg'] = 1
        
        return demand
    
    def optimize_routes(self, delivery_date: date, available_vehicles: List[Vehicle], 
                       available_drivers: List[Driver]) -> List[Route]:
        """
        優化路線
        使用最近鄰居演算法的改良版本
        
        Args:
            delivery_date: 配送日期
            available_vehicles: 可用車輛
            available_drivers: 可用司機
            
        Returns:
            List[Route]: 優化後的路線列表
        """
        # 取得配送點
        delivery_points = self.get_delivery_points_for_date(delivery_date)
        if not delivery_points:
            logger.info("No delivery points for optimization")
            return []
        
        # 按區域分組
        area_groups = self._group_by_area(delivery_points)
        
        routes = []
        vehicle_idx = 0
        driver_idx = 0
        
        for area, points in area_groups.items():
            if vehicle_idx >= len(available_vehicles) or driver_idx >= len(available_drivers):
                logger.warning(f"Not enough vehicles/drivers for area {area}")
                break
            
            vehicle = available_vehicles[vehicle_idx]
            driver = available_drivers[driver_idx]
            
            # 建立路線
            route_points = self._optimize_area_route(points, vehicle.vehicle_type)
            
            if route_points:
                route = self._create_route(
                    delivery_date, area, route_points, vehicle, driver
                )
                routes.append(route)
                
                vehicle_idx += 1
                driver_idx += 1
        
        return routes
    
    def _group_by_area(self, points: List[DeliveryPoint]) -> Dict[str, List[DeliveryPoint]]:
        """按區域分組配送點"""
        area_groups = {}
        
        for point in points:
            # 根據座標判斷區域
            area = self._determine_area(point.lat, point.lng)
            if area not in area_groups:
                area_groups[area] = []
            area_groups[area].append(point)
        
        return area_groups
    
    def _determine_area(self, lat: float, lng: float) -> str:
        """根據座標判斷區域"""
        min_distance = float('inf')
        closest_area = 'A-瑞光'  # 預設區域
        
        for area, center in self.area_centers.items():
            distance = self.calculate_distance((lat, lng), center)
            if distance < min_distance:
                min_distance = distance
                closest_area = area
        
        return closest_area
    
    def _optimize_area_route(self, points: List[DeliveryPoint], 
                           vehicle_type: VehicleType) -> List[DeliveryPoint]:
        """
        優化單一區域內的路線
        使用改良的最近鄰居演算法
        """
        if not points:
            return []
        
        # 過濾適合車輛類型的點
        suitable_points = [
            p for p in points 
            if p.vehicle_restriction == VehicleType.ALL or 
               p.vehicle_restriction == vehicle_type
        ]
        
        if not suitable_points:
            return []
        
        # 按優先度排序
        suitable_points.sort(key=lambda p: p.priority, reverse=True)
        
        # 使用最近鄰居演算法建立路線
        route = []
        unvisited = suitable_points.copy()
        
        # 從優先度最高的點開始
        current = unvisited.pop(0)
        route.append(current)
        
        while unvisited:
            # 找最近的未訪問點
            min_distance = float('inf')
            nearest = None
            nearest_idx = -1
            
            for idx, point in enumerate(unvisited):
                distance = self.calculate_distance(
                    (current.lat, current.lng),
                    (point.lat, point.lng)
                )
                
                # 考慮時間窗口
                if self._is_time_window_compatible(current, point):
                    # 時間窗口相容的點有優先權
                    distance *= 0.8
                
                if distance < min_distance:
                    min_distance = distance
                    nearest = point
                    nearest_idx = idx
            
            if nearest:
                current = nearest
                route.append(current)
                unvisited.pop(nearest_idx)
            else:
                break
        
        return route
    
    def _is_time_window_compatible(self, point1: DeliveryPoint, 
                                  point2: DeliveryPoint) -> bool:
        """檢查兩個配送點的時間窗口是否相容"""
        for window1 in point1.time_windows:
            for window2 in point2.time_windows:
                # 檢查是否有重疊
                if not (window1[1] <= window2[0] or window2[1] <= window1[0]):
                    return True
        return False
    
    def _create_route(self, date: date, area: str, points: List[DeliveryPoint],
                     vehicle: Vehicle, driver: Driver) -> Route:
        """建立路線記錄"""
        # 計算路線統計
        total_distance = 0.0
        total_duration = 0
        
        for i in range(len(points) - 1):
            distance = self.calculate_distance(
                (points[i].lat, points[i].lng),
                (points[i+1].lat, points[i+1].lng)
            )
            total_distance += distance
            total_duration += self.estimate_travel_time(distance, vehicle.vehicle_type)
            total_duration += points[i].service_time
        
        # 加上最後一個點的服務時間
        if points:
            total_duration += points[-1].service_time
        
        # 建立路線詳情
        route_details = {
            'points': [
                {
                    'client_id': p.client_id,
                    'name': p.name,
                    'address': p.address,
                    'lat': p.lat,
                    'lng': p.lng,
                    'sequence': idx + 1,
                    'estimated_arrival': (
                        datetime.combine(date, time(8, 0)) + 
                        timedelta(minutes=total_duration * idx / len(points))
                    ).isoformat()
                }
                for idx, p in enumerate(points)
            ]
        }
        
        # 建立路線記錄
        route = Route(
            route_date=date,
            route_name=f"{area}-{driver.name}",
            area=area,
            driver_id=driver.id,
            vehicle_id=vehicle.id,
            total_clients=len(points),
            total_distance_km=total_distance,
            estimated_duration_minutes=total_duration,
            is_optimized=True,
            optimization_score=0.85,  # 簡化的優化分數
            route_details=json.dumps(route_details, ensure_ascii=False)
        )
        
        self.session.add(route)
        
        # 建立對應的配送記錄
        for idx, point in enumerate(points):
            delivery = Delivery(
                client_id=point.client_id,
                scheduled_date=date,
                scheduled_time_start="08:00",
                scheduled_time_end="20:00",
                driver_id=driver.id,
                vehicle_id=vehicle.id,
                status=DeliveryStatus.ASSIGNED,
                route_sequence=idx + 1,
                distance_km=distance if idx > 0 else 0,
                estimated_duration_minutes=point.service_time
            )
            self.session.add(delivery)
        
        self.session.commit()
        return route
    
    def get_route_details(self, route_id: int) -> Dict:
        """取得路線詳細資訊"""
        route = self.session.query(Route).get(route_id)
        if not route:
            return None
        
        details = json.loads(route.route_details) if route.route_details else {}
        
        # 加入司機和車輛資訊
        details['route_info'] = {
            'id': route.id,
            'date': route.route_date.isoformat(),
            'name': route.route_name,
            'area': route.area,
            'driver': route.driver.name if route.driver else None,
            'vehicle': route.vehicle.plate_number if route.vehicle else None,
            'total_distance': route.total_distance_km,
            'total_duration': route.estimated_duration_minutes,
            'total_clients': route.total_clients
        }
        
        return details


# 測試程式
if __name__ == "__main__":
    from core.database import DatabaseManager
    
    logging.basicConfig(level=logging.INFO)
    
    db_manager = DatabaseManager()
    db_manager.initialize()
    session = db_manager.get_session()
    
    service = RouteOptimizationService(session)
    
    # 測試座標轉換
    test_address = "臺東市中興路三段320號"
    lat, lng = service.geocode_address(test_address)
    print(f"Address: {test_address} -> ({lat:.4f}, {lng:.4f})")
    
    # 測試距離計算
    point1 = (22.7553, 121.1504)  # 台東市
    point2 = (23.0969, 121.3736)  # 成功鎮
    distance = service.calculate_distance(point1, point2)
    print(f"Distance: {distance:.2f} km")
    
    # 測試取得配送點
    tomorrow = datetime.now().date() + timedelta(days=1)
    points = service.get_delivery_points_for_date(tomorrow)
    print(f"\nDelivery points for {tomorrow}: {len(points)}")
    
    # 測試路線優化
    # 建立測試車輛和司機
    from services.vehicle_service import VehicleService
    from services.driver_service import DriverService
    
    vehicle_service = VehicleService(session)
    driver_service = DriverService(session)
    
    # 取得可用車輛和司機
    vehicles = vehicle_service.get_available_vehicles()[:3]
    drivers = driver_service.get_available_drivers()[:3]
    
    if vehicles and drivers:
        print(f"\nOptimizing routes with {len(vehicles)} vehicles and {len(drivers)} drivers")
        routes = service.optimize_routes(tomorrow, vehicles, drivers)
        print(f"Created {len(routes)} optimized routes")
        
        for route in routes:
            details = service.get_route_details(route.id)
            print(f"\nRoute: {details['route_info']['name']}")
            print(f"  Clients: {details['route_info']['total_clients']}")
            print(f"  Distance: {details['route_info']['total_distance']:.2f} km")
            print(f"  Duration: {details['route_info']['total_duration']} minutes")
    
    session.close()
    db_manager.close()