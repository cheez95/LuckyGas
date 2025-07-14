"""Route schemas for API requests and responses"""
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal

from .base import TimestampMixin, PaginatedResponse, TaiwanDateMixin


class RoutePointBase(BaseModel):
    """Base schema for route points"""
    client_id: int = Field(..., description="客戶ID")
    sequence: int = Field(..., ge=1, description="路線順序")
    estimated_arrival: datetime = Field(..., description="預估到達時間")
    service_time: int = Field(default=15, ge=1, description="服務時間（分鐘）")
    distance_from_previous: Optional[float] = Field(None, ge=0, description="與前一點距離（公里）")
    notes: Optional[str] = Field(None, max_length=200, description="備註")


class RoutePointResponse(RoutePointBase):
    """Route point response with additional info"""
    client_name: str = Field(..., description="客戶名稱")
    client_code: str = Field(..., description="客戶編號")
    address: str = Field(..., description="地址")
    latitude: Optional[float] = Field(None, description="緯度")
    longitude: Optional[float] = Field(None, description="經度")
    time_windows: Optional[List[Dict[str, int]]] = Field(None, description="可配送時段")
    

class RoutePlanRequest(BaseModel):
    """Request schema for route planning"""
    delivery_date: date = Field(..., description="配送日期")
    area: Optional[str] = Field(None, description="指定區域")
    vehicle_ids: Optional[List[int]] = Field(None, description="可用車輛ID列表")
    driver_ids: Optional[List[int]] = Field(None, description="可用司機ID列表")
    
    # Optimization parameters
    max_distance_km: Optional[float] = Field(None, gt=0, description="最大行駛距離（公里）")
    max_duration_minutes: Optional[int] = Field(None, gt=0, description="最大工作時間（分鐘）")
    start_time: Optional[str] = Field(default="08:00", pattern=r"^\d{2}:\d{2}$", description="開始時間")
    end_time: Optional[str] = Field(default="18:00", pattern=r"^\d{2}:\d{2}$", description="結束時間")
    
    # Advanced options
    use_traffic: bool = Field(default=False, description="考慮即時路況")
    optimize_by: str = Field(default="distance", pattern="^(distance|time|balanced)$", description="優化目標")
    include_break_time: bool = Field(default=True, description="包含休息時間")
    break_duration_minutes: int = Field(default=60, ge=0, description="休息時間（分鐘）")


class RouteCreateRequest(BaseModel):
    """Request schema for creating a route"""
    route_date: date = Field(..., description="路線日期")
    route_name: str = Field(..., min_length=1, max_length=100, description="路線名稱")
    area: str = Field(..., min_length=1, max_length=50, description="區域")
    driver_id: int = Field(..., description="司機ID")
    vehicle_id: int = Field(..., description="車輛ID")
    route_points: List[RoutePointBase] = Field(..., min_items=1, description="路線點列表")


class RouteUpdateRequest(BaseModel):
    """Request schema for updating a route"""
    route_name: Optional[str] = Field(None, min_length=1, max_length=100, description="路線名稱")
    driver_id: Optional[int] = Field(None, description="司機ID")
    vehicle_id: Optional[int] = Field(None, description="車輛ID")
    is_optimized: Optional[bool] = Field(None, description="是否已優化")
    route_points: Optional[List[RoutePointBase]] = Field(None, min_items=1, description="路線點列表")


class RouteResponse(TimestampMixin, TaiwanDateMixin):
    """Response schema for route"""
    id: int = Field(..., description="路線ID")
    route_date: date = Field(..., description="路線日期")
    route_name: str = Field(..., description="路線名稱")
    area: str = Field(..., description="區域")
    
    # Assignment info
    driver_id: Optional[int] = Field(None, description="司機ID")
    driver_name: Optional[str] = Field(None, description="司機姓名")
    vehicle_id: Optional[int] = Field(None, description="車輛ID")
    vehicle_plate: Optional[str] = Field(None, description="車牌號碼")
    vehicle_type: Optional[str] = Field(None, description="車輛類型")
    
    # Statistics
    total_clients: int = Field(default=0, description="總客戶數")
    total_distance_km: float = Field(default=0, description="總距離（公里）")
    estimated_duration_minutes: int = Field(default=0, description="預估總時間（分鐘）")
    
    # Status
    is_optimized: bool = Field(default=False, description="是否已優化")
    optimization_score: Optional[float] = Field(None, ge=0, le=1, description="優化分數")
    
    # Route details
    route_points: Optional[List[RoutePointResponse]] = Field(None, description="路線詳情")
    
    model_config = ConfigDict(from_attributes=True)
    
    @property
    def route_date_taiwan(self) -> str:
        """Get route date in Taiwan format"""
        return self.to_taiwan_date(self.route_date)


class RouteListResponse(PaginatedResponse[RouteResponse]):
    """Schema for paginated route list response"""
    pass


class RouteOptimizationResult(BaseModel):
    """Result of route optimization"""
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="結果訊息")
    routes: List[RouteResponse] = Field(default_factory=list, description="優化後的路線列表")
    
    # Optimization metrics
    total_routes: int = Field(default=0, description="總路線數")
    total_distance_saved_km: Optional[float] = Field(None, description="節省的總距離（公里）")
    total_time_saved_minutes: Optional[int] = Field(None, description="節省的總時間（分鐘）")
    optimization_time_seconds: Optional[float] = Field(None, description="優化耗時（秒）")
    
    # Warnings
    unassigned_clients: Optional[List[Dict[str, Any]]] = Field(None, description="未分配的客戶")
    warnings: Optional[List[str]] = Field(None, description="警告訊息")


class RouteMapData(BaseModel):
    """Map data for route visualization"""
    route_id: int = Field(..., description="路線ID")
    center_lat: float = Field(..., description="地圖中心緯度")
    center_lng: float = Field(..., description="地圖中心經度")
    zoom_level: int = Field(default=13, ge=1, le=20, description="地圖縮放等級")
    
    # Route polyline
    polyline: Optional[str] = Field(None, description="路線折線編碼")
    waypoints: List[Dict[str, Any]] = Field(..., description="路線點座標")
    
    # Markers
    markers: List[Dict[str, Any]] = Field(..., description="標記點資料")
    
    # Area boundaries
    area_boundary: Optional[List[List[float]]] = Field(None, description="區域邊界座標")