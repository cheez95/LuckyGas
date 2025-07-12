"""Vehicle schemas for API requests and responses"""
from datetime import datetime, date
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, field_validator, ConfigDict
from decimal import Decimal

from .base import TimestampMixin, PaginatedResponse, TaiwanDateMixin


VehicleType = Literal["truck", "van", "motorcycle"]
VehicleStatus = Literal["active", "maintenance", "retired"]
FuelType = Literal["gasoline", "diesel", "electric", "hybrid"]


class VehicleBase(BaseModel):
    """Base vehicle schema"""
    plate_number: str = Field(..., min_length=1, max_length=20, description="車牌號碼")
    vehicle_type: VehicleType = Field(..., description="車輛類型")
    brand: str = Field(..., min_length=1, max_length=50, description="品牌")
    model: str = Field(..., min_length=1, max_length=50, description="型號")
    year: int = Field(..., ge=1900, le=2100, description="出廠年份")
    
    # Specifications
    fuel_type: FuelType = Field(..., description="燃料類型")
    engine_number: str = Field(..., min_length=1, max_length=50, description="引擎號碼")
    vin: str = Field(..., min_length=1, max_length=50, description="車身號碼")
    color: str = Field(..., min_length=1, max_length=20, description="顏色")
    
    # Registration & Insurance
    registration_date: date = Field(..., description="登記日期")
    insurance_expiry_date: date = Field(..., description="保險到期日")
    inspection_due_date: date = Field(..., description="驗車到期日")
    
    # Capacity
    max_load_kg: int = Field(..., gt=0, description="最大載重(公斤)")
    max_cylinders: int = Field(..., gt=0, description="最大載瓦斯桶數")
    
    # Cost
    purchase_price: Optional[Decimal] = Field(None, ge=0, description="購買價格")
    purchase_date: Optional[date] = Field(None, description="購買日期")
    
    @field_validator('plate_number')
    @classmethod
    def validate_plate_number(cls, v: str) -> str:
        """Validate Taiwan vehicle plate number format"""
        # Simple validation - actual format varies by vehicle type
        v = v.upper().replace('-', '')
        if len(v) < 5 or len(v) > 7:
            raise ValueError('車牌號碼格式不正確')
        return v


class VehicleCreate(VehicleBase):
    """Schema for creating a vehicle"""
    pass


class VehicleUpdate(BaseModel):
    """Schema for updating a vehicle"""
    vehicle_type: Optional[VehicleType] = Field(None, description="車輛類型")
    
    # Specifications
    fuel_type: Optional[FuelType] = Field(None, description="燃料類型")
    color: Optional[str] = Field(None, min_length=1, max_length=20, description="顏色")
    
    # Registration & Insurance
    insurance_expiry_date: Optional[date] = Field(None, description="保險到期日")
    inspection_due_date: Optional[date] = Field(None, description="驗車到期日")
    
    # Status
    status: Optional[VehicleStatus] = Field(None, description="狀態")
    current_driver_id: Optional[int] = Field(None, description="目前駕駛司機ID")
    
    # Capacity
    max_load_kg: Optional[int] = Field(None, gt=0, description="最大載重(公斤)")
    max_cylinders: Optional[int] = Field(None, gt=0, description="最大載瓦斯桶數")
    
    # Maintenance
    last_maintenance_date: Optional[date] = Field(None, description="最後保養日期")
    next_maintenance_date: Optional[date] = Field(None, description="下次保養日期")
    maintenance_notes: Optional[str] = Field(None, max_length=500, description="保養備註")
    
    # Other
    notes: Optional[str] = Field(None, max_length=500, description="備註")
    retired_date: Optional[date] = Field(None, description="報廢日期")


class VehicleResponse(VehicleBase, TimestampMixin, TaiwanDateMixin):
    """Schema for vehicle response"""
    id: int = Field(..., description="車輛ID")
    status: VehicleStatus = Field(default="active", description="狀態")
    
    # Current assignment
    current_driver_id: Optional[int] = Field(None, description="目前駕駛司機ID")
    current_driver_name: Optional[str] = Field(None, description="目前駕駛司機姓名")
    
    # Maintenance
    last_maintenance_date: Optional[date] = Field(None, description="最後保養日期")
    next_maintenance_date: Optional[date] = Field(None, description="下次保養日期")
    maintenance_notes: Optional[str] = Field(None, description="保養備註")
    
    # Statistics
    total_deliveries: Optional[int] = Field(None, description="總配送次數")
    total_mileage: Optional[int] = Field(None, description="總里程數")
    deliveries_this_month: Optional[int] = Field(None, description="本月配送次數")
    mileage_this_month: Optional[int] = Field(None, description="本月里程數")
    
    # Other
    notes: Optional[str] = Field(None, description="備註")
    retired_date: Optional[date] = Field(None, description="報廢日期")
    
    model_config = ConfigDict(from_attributes=True)
    
    @property
    def vehicle_type_display(self) -> str:
        """Get vehicle type display in Chinese"""
        type_map = {
            "truck": "貨車",
            "van": "廂型車",
            "motorcycle": "機車"
        }
        return type_map.get(self.vehicle_type, self.vehicle_type)
    
    @property
    def fuel_type_display(self) -> str:
        """Get fuel type display in Chinese"""
        fuel_map = {
            "gasoline": "汽油",
            "diesel": "柴油",
            "electric": "電動",
            "hybrid": "油電混合"
        }
        return fuel_map.get(self.fuel_type, self.fuel_type)
    
    @property
    def status_display(self) -> str:
        """Get status display in Chinese"""
        status_map = {
            "active": "使用中",
            "maintenance": "保養中",
            "retired": "已報廢"
        }
        return status_map.get(self.status, self.status)
    
    @property
    def registration_date_taiwan(self) -> str:
        """Get registration date in Taiwan format"""
        if self.registration_date:
            taiwan_year = self.registration_date.year - 1911
            return f"民國{taiwan_year}年{self.registration_date.month}月{self.registration_date.day}日"
        return ""
    
    @property
    def insurance_expiry_taiwan(self) -> str:
        """Get insurance expiry date in Taiwan format"""
        if self.insurance_expiry_date:
            taiwan_year = self.insurance_expiry_date.year - 1911
            return f"民國{taiwan_year}年{self.insurance_expiry_date.month}月{self.insurance_expiry_date.day}日"
        return ""
    
    @property
    def inspection_due_taiwan(self) -> str:
        """Get inspection due date in Taiwan format"""
        if self.inspection_due_date:
            taiwan_year = self.inspection_due_date.year - 1911
            return f"民國{taiwan_year}年{self.inspection_due_date.month}月{self.inspection_due_date.day}日"
        return ""
    
    @property
    def is_insurance_expiring_soon(self) -> bool:
        """Check if insurance expires within 30 days"""
        if self.insurance_expiry_date:
            days_until_expiry = (self.insurance_expiry_date - date.today()).days
            return 0 <= days_until_expiry <= 30
        return False
    
    @property
    def is_inspection_due_soon(self) -> bool:
        """Check if inspection is due within 30 days"""
        if self.inspection_due_date:
            days_until_due = (self.inspection_due_date - date.today()).days
            return 0 <= days_until_due <= 30
        return False
    
    @property
    def is_maintenance_due(self) -> bool:
        """Check if maintenance is due"""
        if self.next_maintenance_date:
            return self.next_maintenance_date <= date.today()
        return False


class VehicleListResponse(PaginatedResponse[VehicleResponse]):
    """Schema for paginated vehicle list response"""
    pass


class VehicleSearchParams(BaseModel):
    """Search parameters for vehicles"""
    keyword: Optional[str] = Field(None, description="搜尋關鍵字（車牌、品牌、型號）")
    vehicle_type: Optional[VehicleType] = Field(None, description="車輛類型")
    fuel_type: Optional[FuelType] = Field(None, description="燃料類型")
    status: Optional[VehicleStatus] = Field(None, description="狀態")
    has_driver_assigned: Optional[bool] = Field(None, description="是否有指派司機")
    insurance_expiring_soon: Optional[bool] = Field(None, description="保險即將到期")
    inspection_due_soon: Optional[bool] = Field(None, description="驗車即將到期")
    maintenance_due: Optional[bool] = Field(None, description="需要保養")
    order_by: str = Field(default="plate_number", description="排序欄位")
    order_desc: bool = Field(default=False, description="是否降冪排序")