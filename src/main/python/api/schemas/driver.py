"""Driver schemas for API requests and responses"""
from datetime import datetime, date
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, field_validator, ConfigDict
from decimal import Decimal

from .base import TimestampMixin, PaginatedResponse, TaiwanDateMixin


DriverStatus = Literal["active", "on_leave", "suspended", "terminated"]


class DriverBase(BaseModel):
    """Base driver schema"""
    name: str = Field(..., min_length=1, max_length=50, description="司機姓名")
    employee_id: str = Field(..., min_length=1, max_length=20, description="員工編號")
    phone: str = Field(..., pattern=r"^0[0-9]{9}$", description="電話號碼")
    
    # Personal info
    id_number: str = Field(..., pattern=r"^[A-Z][0-9]{9}$", description="身分證字號")
    address: str = Field(..., min_length=1, max_length=200, description="地址")
    emergency_contact: str = Field(..., min_length=1, max_length=50, description="緊急聯絡人")
    emergency_phone: str = Field(..., pattern=r"^0[0-9]{9}$", description="緊急聯絡電話")
    
    # License info
    license_number: str = Field(..., min_length=1, max_length=20, description="駕照號碼")
    license_type: str = Field(..., min_length=1, max_length=20, description="駕照類型")
    license_expiry_date: date = Field(..., description="駕照到期日")
    
    # Employment info
    hire_date: date = Field(..., description="到職日期")
    base_salary: Decimal = Field(..., ge=0, description="底薪")
    commission_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100, description="抽成比例(%)")
    
    @field_validator('id_number')
    @classmethod
    def validate_id_number(cls, v: str) -> str:
        """Validate Taiwan ID number format"""
        if len(v) != 10:
            raise ValueError('身分證字號必須為10碼')
        if not v[0].isalpha() or not v[0].isupper():
            raise ValueError('身分證字號第一碼必須為大寫英文字母')
        if not v[1:].isdigit():
            raise ValueError('身分證字號第2-10碼必須為數字')
        return v
    
    @field_validator('license_expiry_date')
    @classmethod
    def validate_license_expiry(cls, v: date) -> date:
        """Validate license is not expired"""
        if v < date.today():
            raise ValueError('駕照已過期')
        return v


class DriverCreate(DriverBase):
    """Schema for creating a driver"""
    pass


class DriverUpdate(BaseModel):
    """Schema for updating a driver"""
    name: Optional[str] = Field(None, min_length=1, max_length=50, description="司機姓名")
    phone: Optional[str] = Field(None, pattern=r"^0[0-9]{9}$", description="電話號碼")
    
    # Personal info
    address: Optional[str] = Field(None, min_length=1, max_length=200, description="地址")
    emergency_contact: Optional[str] = Field(None, min_length=1, max_length=50, description="緊急聯絡人")
    emergency_phone: Optional[str] = Field(None, pattern=r"^0[0-9]{9}$", description="緊急聯絡電話")
    
    # License info
    license_number: Optional[str] = Field(None, min_length=1, max_length=20, description="駕照號碼")
    license_type: Optional[str] = Field(None, min_length=1, max_length=20, description="駕照類型")
    license_expiry_date: Optional[date] = Field(None, description="駕照到期日")
    
    # Employment info
    status: Optional[DriverStatus] = Field(None, description="狀態")
    base_salary: Optional[Decimal] = Field(None, ge=0, description="底薪")
    commission_rate: Optional[Decimal] = Field(None, ge=0, le=100, description="抽成比例(%)")
    termination_date: Optional[date] = Field(None, description="離職日期")
    
    # Notes
    notes: Optional[str] = Field(None, max_length=500, description="備註")


class DriverResponse(DriverBase, TimestampMixin, TaiwanDateMixin):
    """Schema for driver response"""
    id: int = Field(..., description="司機ID")
    status: DriverStatus = Field(default="active", description="狀態")
    termination_date: Optional[date] = Field(None, description="離職日期")
    notes: Optional[str] = Field(None, description="備註")
    
    # Statistics
    total_deliveries: Optional[int] = Field(None, description="總配送次數")
    deliveries_this_month: Optional[int] = Field(None, description="本月配送次數")
    deliveries_today: Optional[int] = Field(None, description="今日配送次數")
    current_vehicle_id: Optional[int] = Field(None, description="目前使用車輛ID")
    current_vehicle_plate: Optional[str] = Field(None, description="目前使用車牌")
    
    model_config = ConfigDict(from_attributes=True)
    
    @property
    def hire_date_taiwan(self) -> str:
        """Get hire date in Taiwan format"""
        if self.hire_date:
            taiwan_year = self.hire_date.year - 1911
            return f"民國{taiwan_year}年{self.hire_date.month}月{self.hire_date.day}日"
        return ""
    
    @property
    def license_expiry_taiwan(self) -> str:
        """Get license expiry date in Taiwan format"""
        if self.license_expiry_date:
            taiwan_year = self.license_expiry_date.year - 1911
            return f"民國{taiwan_year}年{self.license_expiry_date.month}月{self.license_expiry_date.day}日"
        return ""
    
    @property
    def status_display(self) -> str:
        """Get status display in Chinese"""
        status_map = {
            "active": "在職",
            "on_leave": "請假中",
            "suspended": "停職",
            "terminated": "離職"
        }
        return status_map.get(self.status, self.status)
    
    @property
    def is_license_expiring_soon(self) -> bool:
        """Check if license expires within 30 days"""
        if self.license_expiry_date:
            days_until_expiry = (self.license_expiry_date - date.today()).days
            return 0 <= days_until_expiry <= 30
        return False


class DriverListResponse(PaginatedResponse[DriverResponse]):
    """Schema for paginated driver list response"""
    pass


class DriverSearchParams(BaseModel):
    """Search parameters for drivers"""
    keyword: Optional[str] = Field(None, description="搜尋關鍵字（姓名、員工編號、電話）")
    status: Optional[DriverStatus] = Field(None, description="狀態")
    license_expiring_soon: Optional[bool] = Field(None, description="駕照即將到期")
    has_vehicle_assigned: Optional[bool] = Field(None, description="是否有指派車輛")
    order_by: str = Field(default="hire_date", description="排序欄位")
    order_desc: bool = Field(default=True, description="是否降冪排序")