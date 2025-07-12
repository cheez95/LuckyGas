"""Delivery schemas for API requests and responses"""
from datetime import datetime, date
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, field_validator, ConfigDict
from decimal import Decimal

from .base import TimestampMixin, PaginatedResponse, TaiwanDateMixin


DeliveryStatus = Literal["pending", "assigned", "in_progress", "completed", "cancelled"]
PaymentMethod = Literal["cash", "transfer", "monthly_billing"]
PaymentStatus = Literal["pending", "paid", "overdue"]


class DeliveryBase(BaseModel):
    """Base delivery schema"""
    client_id: int = Field(..., description="客戶ID")
    scheduled_date: date = Field(..., description="預定配送日期")
    scheduled_time_slot: Optional[str] = Field(None, max_length=50, description="預定時段")
    
    # Order details
    gas_quantity: int = Field(..., ge=1, description="瓦斯桶數")
    unit_price: Decimal = Field(..., gt=0, description="單價")
    delivery_fee: Decimal = Field(default=Decimal("0"), ge=0, description="運費")
    
    # Address
    delivery_address: str = Field(..., min_length=1, max_length=200, description="配送地址")
    delivery_district: Optional[str] = Field(None, max_length=20, description="配送區域")
    delivery_latitude: Optional[Decimal] = Field(None, ge=-90, le=90, description="配送緯度")
    delivery_longitude: Optional[Decimal] = Field(None, ge=-180, le=180, description="配送經度")
    
    # Payment
    payment_method: PaymentMethod = Field(..., description="付款方式")
    
    # Additional info
    notes: Optional[str] = Field(None, max_length=500, description="備註")
    requires_empty_cylinder_return: bool = Field(default=True, description="是否需要回收空桶")
    empty_cylinders_to_return: int = Field(default=0, ge=0, description="回收空桶數")
    
    @field_validator('scheduled_date')
    @classmethod
    def validate_scheduled_date(cls, v: date) -> date:
        """Validate scheduled date is not in the past"""
        if v < date.today():
            raise ValueError('預定配送日期不可為過去日期')
        return v


class DeliveryCreate(DeliveryBase):
    """Schema for creating a delivery"""
    pass


class DeliveryUpdate(BaseModel):
    """Schema for updating a delivery"""
    scheduled_date: Optional[date] = Field(None, description="預定配送日期")
    scheduled_time_slot: Optional[str] = Field(None, max_length=50, description="預定時段")
    
    # Order details
    gas_quantity: Optional[int] = Field(None, ge=1, description="瓦斯桶數")
    unit_price: Optional[Decimal] = Field(None, gt=0, description="單價")
    delivery_fee: Optional[Decimal] = Field(None, ge=0, description="運費")
    
    # Address
    delivery_address: Optional[str] = Field(None, min_length=1, max_length=200, description="配送地址")
    delivery_district: Optional[str] = Field(None, max_length=20, description="配送區域")
    delivery_latitude: Optional[Decimal] = Field(None, ge=-90, le=90, description="配送緯度")
    delivery_longitude: Optional[Decimal] = Field(None, ge=-180, le=180, description="配送經度")
    
    # Status
    status: Optional[DeliveryStatus] = Field(None, description="配送狀態")
    driver_id: Optional[int] = Field(None, description="司機ID")
    vehicle_id: Optional[int] = Field(None, description="車輛ID")
    
    # Payment
    payment_method: Optional[PaymentMethod] = Field(None, description="付款方式")
    payment_status: Optional[PaymentStatus] = Field(None, description="付款狀態")
    paid_at: Optional[datetime] = Field(None, description="付款時間")
    
    # Delivery completion
    delivered_at: Optional[datetime] = Field(None, description="實際配送時間")
    delivery_photo_url: Optional[str] = Field(None, max_length=500, description="配送照片URL")
    customer_signature_url: Optional[str] = Field(None, max_length=500, description="客戶簽名URL")
    
    # Additional info
    notes: Optional[str] = Field(None, max_length=500, description="備註")
    requires_empty_cylinder_return: Optional[bool] = Field(None, description="是否需要回收空桶")
    empty_cylinders_to_return: Optional[int] = Field(None, ge=0, description="回收空桶數")
    empty_cylinders_returned: Optional[int] = Field(None, ge=0, description="實際回收空桶數")


class DeliveryResponse(DeliveryBase, TimestampMixin, TaiwanDateMixin):
    """Schema for delivery response"""
    id: int = Field(..., description="配送單ID")
    order_number: str = Field(..., description="訂單編號")
    
    # Status
    status: DeliveryStatus = Field(default="pending", description="配送狀態")
    driver_id: Optional[int] = Field(None, description="司機ID")
    vehicle_id: Optional[int] = Field(None, description="車輛ID")
    
    # Payment
    payment_status: PaymentStatus = Field(default="pending", description="付款狀態")
    paid_at: Optional[datetime] = Field(None, description="付款時間")
    
    # Calculated fields
    total_amount: Decimal = Field(..., description="總金額")
    
    # Delivery completion
    delivered_at: Optional[datetime] = Field(None, description="實際配送時間")
    delivery_photo_url: Optional[str] = Field(None, description="配送照片URL")
    customer_signature_url: Optional[str] = Field(None, description="客戶簽名URL")
    empty_cylinders_returned: int = Field(default=0, description="實際回收空桶數")
    
    # Relations
    client_name: Optional[str] = Field(None, description="客戶名稱")
    client_phone: Optional[str] = Field(None, description="客戶電話")
    driver_name: Optional[str] = Field(None, description="司機名稱")
    vehicle_plate: Optional[str] = Field(None, description="車牌號碼")
    
    model_config = ConfigDict(from_attributes=True)
    
    @property
    def scheduled_date_taiwan(self) -> str:
        """Get scheduled date in Taiwan format"""
        if self.scheduled_date:
            taiwan_year = self.scheduled_date.year - 1911
            return f"民國{taiwan_year}年{self.scheduled_date.month}月{self.scheduled_date.day}日"
        return ""
    
    @property
    def delivered_at_taiwan(self) -> str:
        """Get delivered date in Taiwan format"""
        return self.to_taiwan_date(self.delivered_at) if self.delivered_at else "未配送"
    
    @property
    def status_display(self) -> str:
        """Get status display in Chinese"""
        status_map = {
            "pending": "待處理",
            "assigned": "已指派",
            "in_progress": "配送中",
            "completed": "已完成",
            "cancelled": "已取消"
        }
        return status_map.get(self.status, self.status)
    
    @property
    def payment_status_display(self) -> str:
        """Get payment status display in Chinese"""
        status_map = {
            "pending": "待付款",
            "paid": "已付款",
            "overdue": "逾期"
        }
        return status_map.get(self.payment_status, self.payment_status)


class DeliveryListResponse(PaginatedResponse[DeliveryResponse]):
    """Schema for paginated delivery list response"""
    pass


class DeliverySearchParams(BaseModel):
    """Search parameters for deliveries"""
    keyword: Optional[str] = Field(None, description="搜尋關鍵字（訂單編號、客戶名稱、地址）")
    client_id: Optional[int] = Field(None, description="客戶ID")
    driver_id: Optional[int] = Field(None, description="司機ID")
    status: Optional[DeliveryStatus] = Field(None, description="配送狀態")
    payment_status: Optional[PaymentStatus] = Field(None, description="付款狀態")
    scheduled_date_from: Optional[date] = Field(None, description="預定配送日期起")
    scheduled_date_to: Optional[date] = Field(None, description="預定配送日期迄")
    district: Optional[str] = Field(None, description="配送區域")
    order_by: str = Field(default="scheduled_date", description="排序欄位")
    order_desc: bool = Field(default=False, description="是否降冪排序")