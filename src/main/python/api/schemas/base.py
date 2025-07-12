"""Base schemas and common models"""
from datetime import datetime
from typing import Optional, TypeVar, Generic, List
from pydantic import BaseModel, Field, ConfigDict

T = TypeVar('T')


class TimestampMixin(BaseModel):
    """Mixin for created and updated timestamps"""
    created_at: datetime = Field(description="建立時間")
    updated_at: datetime = Field(description="更新時間")


class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = Field(default=1, ge=1, description="頁數")
    page_size: int = Field(default=10, ge=1, le=100, description="每頁筆數")
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response"""
    items: List[T] = Field(description="資料列表")
    total: int = Field(description="總筆數")
    page: int = Field(description="目前頁數")
    page_size: int = Field(description="每頁筆數")
    total_pages: int = Field(description="總頁數")
    
    model_config = ConfigDict(from_attributes=True)


class TaiwanDateMixin(BaseModel):
    """Mixin for Taiwan date formatting"""
    
    @staticmethod
    def to_taiwan_date(date: datetime) -> str:
        """Convert to Taiwan date format (民國年)"""
        if not date:
            return ""
        taiwan_year = date.year - 1911
        return f"民國{taiwan_year}年{date.month}月{date.day}日"
    
    @staticmethod
    def from_taiwan_year(taiwan_year: int) -> int:
        """Convert Taiwan year to western year"""
        return taiwan_year + 1911


class ResponseMessage(BaseModel):
    """Standard response message"""
    success: bool = Field(description="是否成功")
    message: str = Field(description="訊息")
    data: Optional[dict] = Field(default=None, description="回傳資料")