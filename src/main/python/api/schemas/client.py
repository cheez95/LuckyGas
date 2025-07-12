"""Client schemas for API requests and responses"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict
from decimal import Decimal

from .base import TimestampMixin, PaginatedResponse, TaiwanDateMixin


class ClientBase(BaseModel):
    """Base client schema"""
    name: str = Field(..., min_length=1, max_length=100, description="客戶名稱")
    phone: str = Field(..., pattern=r"^0[0-9]{9}$", description="電話號碼")
    address: str = Field(..., min_length=1, max_length=200, description="地址")
    contact_person: Optional[str] = Field(None, max_length=50, description="聯絡人")
    
    # Business info
    tax_id: Optional[str] = Field(None, pattern=r"^[0-9]{8}$", description="統一編號")
    is_corporate: bool = Field(default=False, description="是否為公司戶")
    
    # Location
    district: Optional[str] = Field(None, max_length=20, description="區域")
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90, description="緯度")
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180, description="經度")
    
    # Preferences
    delivery_time_preference: Optional[str] = Field(None, max_length=100, description="配送時間偏好")
    notes: Optional[str] = Field(None, max_length=500, description="備註")
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate Taiwan phone number format"""
        if not v.startswith('0'):
            raise ValueError('電話號碼必須以0開頭')
        if len(v) != 10:
            raise ValueError('電話號碼必須為10碼')
        return v


class ClientCreate(ClientBase):
    """Schema for creating a client"""
    pass


class ClientUpdate(BaseModel):
    """Schema for updating a client"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="客戶名稱")
    phone: Optional[str] = Field(None, pattern=r"^0[0-9]{9}$", description="電話號碼")
    address: Optional[str] = Field(None, min_length=1, max_length=200, description="地址")
    contact_person: Optional[str] = Field(None, max_length=50, description="聯絡人")
    
    # Business info
    tax_id: Optional[str] = Field(None, pattern=r"^[0-9]{8}$", description="統一編號")
    is_corporate: Optional[bool] = Field(None, description="是否為公司戶")
    
    # Location
    district: Optional[str] = Field(None, max_length=20, description="區域")
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90, description="緯度")
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180, description="經度")
    
    # Preferences
    delivery_time_preference: Optional[str] = Field(None, max_length=100, description="配送時間偏好")
    notes: Optional[str] = Field(None, max_length=500, description="備註")
    is_active: Optional[bool] = Field(None, description="是否啟用")


class ClientResponse(ClientBase, TimestampMixin, TaiwanDateMixin):
    """Schema for client response"""
    id: int = Field(..., description="客戶ID")
    is_active: bool = Field(default=True, description="是否啟用")
    
    # Statistics
    total_orders: Optional[int] = Field(None, description="總訂單數")
    last_order_date: Optional[datetime] = Field(None, description="最後訂單日期")
    
    model_config = ConfigDict(from_attributes=True)
    
    @property
    def created_at_taiwan(self) -> str:
        """Get created date in Taiwan format"""
        return self.to_taiwan_date(self.created_at)
    
    @property
    def last_order_date_taiwan(self) -> str:
        """Get last order date in Taiwan format"""
        return self.to_taiwan_date(self.last_order_date) if self.last_order_date else "無"


class ClientListResponse(PaginatedResponse[ClientResponse]):
    """Schema for paginated client list response"""
    pass


class ClientSearchParams(BaseModel):
    """Search parameters for clients"""
    keyword: Optional[str] = Field(None, description="搜尋關鍵字（名稱、電話、地址）")
    district: Optional[str] = Field(None, description="區域")
    is_corporate: Optional[bool] = Field(None, description="是否為公司戶")
    is_active: Optional[bool] = Field(default=True, description="是否啟用")
    order_by: str = Field(default="created_at", description="排序欄位")
    order_desc: bool = Field(default=True, description="是否降冪排序")