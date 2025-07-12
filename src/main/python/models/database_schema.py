from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Date, Boolean, ForeignKey, Text, Index, UniqueConstraint, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import enum

Base = declarative_base()


class DeliveryStatus(enum.Enum):
    """配送狀態"""
    PENDING = "pending"  # 待配送
    ASSIGNED = "assigned"  # 已分配
    IN_PROGRESS = "in_progress"  # 配送中
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"  # 配送失敗
    CANCELLED = "cancelled"  # 已取消
    NOT_HOME = "not_home"  # 客戶不在
    REFUSED = "refused"  # 客戶拒收


class PaymentMethod(enum.Enum):
    """結帳方式"""
    CASH = "cash"  # 現金
    MONTHLY = "monthly"  # 月結
    TRANSFER = "transfer"  # 轉帳
    CREDIT = "credit"  # 信用


class VehicleType(enum.Enum):
    """車輛類型"""
    CAR = 1  # 汽車
    MOTORCYCLE = 2  # 機車
    ALL = 0  # 全部


class Client(Base):
    """客戶資料"""
    __tablename__ = 'clients'
    
    id = Column(Integer, primary_key=True)
    client_code = Column(String(20), unique=True, nullable=False, index=True)  # 客戶編號
    invoice_title = Column(String(200), nullable=False)  # 電子發票抬頭
    short_name = Column(String(100))  # 客戶簡稱
    address = Column(String(500), nullable=False)  # 地址
    
    # 鋼瓶庫存
    cylinder_50kg = Column(Integer, default=0)
    cylinder_20kg_business = Column(Integer, default=0)  # 營20
    cylinder_16kg_business = Column(Integer, default=0)  # 營16
    cylinder_20kg = Column(Integer, default=0)
    cylinder_16kg = Column(Integer, default=0)
    cylinder_10kg = Column(Integer, default=0)
    cylinder_4kg = Column(Integer, default=0)
    cylinder_16kg_goodluck = Column(Integer, default=0)  # 好運16
    cylinder_10kg_safety = Column(Integer, default=0)  # 瓶安桶10
    cylinder_happiness = Column(Integer, default=0)  # 幸福丸
    cylinder_20kg_goodluck = Column(Integer, default=0)  # 好運20
    
    # 流量計數器
    flow_50kg = Column(Integer, default=0)
    flow_20kg = Column(Integer, default=0)
    flow_16kg = Column(Integer, default=0)
    flow_20kg_goodluck = Column(Integer, default=0)
    flow_16kg_goodluck = Column(Integer, default=0)
    
    # 商業資訊
    pricing_method = Column(String(50))  # 計價方式
    payment_method = Column(Enum(PaymentMethod))  # 結帳方式
    payment_file = Column(String(100))  # 結帳用檔案
    subscription_member = Column(Boolean, default=False)  # 訂閱式會員
    
    # 配送設定
    needs_same_day_delivery = Column(Boolean, default=False)  # 需要當天配送
    
    # 營業時間設定 (1表示可配送)
    hour_8_9 = Column(Boolean, default=False)
    hour_9_10 = Column(Boolean, default=False)
    hour_10_11 = Column(Boolean, default=False)
    hour_11_12 = Column(Boolean, default=False)
    hour_12_13 = Column(Boolean, default=False)
    hour_13_14 = Column(Boolean, default=False)
    hour_14_15 = Column(Boolean, default=False)
    hour_15_16 = Column(Boolean, default=False)
    hour_16_17 = Column(Boolean, default=False)
    hour_17_18 = Column(Boolean, default=False)
    hour_18_19 = Column(Boolean, default=False)
    hour_19_20 = Column(Boolean, default=False)
    
    time_slot = Column(Integer, default=0)  # 時段早1午2晚3全天0
    holiday = Column(String(50))  # 公休日
    
    # 使用資訊
    status = Column(Integer, default=1)  # 狀態
    monthly_delivery_volume = Column(Float, default=0)  # 月配送量
    gas_return_ratio = Column(Float, default=0)  # 退氣比例
    actual_purchase_kg = Column(Float, default=0)  # 實際購買公斤數
    daily_usage_avg = Column(Float, default=0)  # 平均日使用
    
    # 設備資訊
    series_connection_count = Column(Integer, default=1)  # 串接數量
    reserve_amount = Column(Float, default=0)  # 備用量
    max_cycle_days = Column(Integer, default=30)  # 最大週期
    can_delay_days = Column(Integer, default=0)  # 可延後天數
    needs_same_day = Column(Boolean, default=False)  # 是否需要當天去
    
    # 區域設定
    area = Column(String(50))  # 區域
    vehicle_type = Column(Enum(VehicleType), default=VehicleType.ALL)  # 1汽車/2機車/0全部
    single_area_supply = Column(Boolean, default=True)  # 單一區域供應
    primary_usage_area = Column(String(50))  # 第一使用區域(串接)
    secondary_usage_area = Column(String(50))  # 第二使用區域
    
    # 設備清單
    switch_model = Column(String(100))  # 切替器型號
    has_flow_meter = Column(Boolean, default=False)  # 流量表
    has_switch = Column(Boolean, default=False)  # 切替器
    has_smart_scale = Column(Boolean, default=False)  # 智慧秤
    
    # 其他
    client_type = Column(String(50))  # 類型
    is_terminated = Column(Boolean, default=False)  # 已解約
    
    # 時間戳記
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 關聯
    deliveries = relationship("Delivery", back_populates="client")
    delivery_predictions = relationship("DeliveryPrediction", back_populates="client")
    
    __table_args__ = (
        Index('idx_client_area', 'area'),
        Index('idx_client_status', 'status'),
    )


class Driver(Base):
    """司機資料"""
    __tablename__ = 'drivers'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)  # 姓名
    phone = Column(String(20))  # 電話
    employee_id = Column(String(50), unique=True)  # 員工編號
    license_type = Column(String(50))  # 駕照類型
    
    # 工作狀態
    is_active = Column(Boolean, default=True)  # 是否在職
    is_available = Column(Boolean, default=True)  # 是否可派遣
    
    # 經驗
    experience_years = Column(Integer, default=0)  # 年資
    familiar_areas = Column(Text)  # 熟悉區域 (JSON array)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 關聯
    deliveries = relationship("Delivery", back_populates="driver")
    vehicles = relationship("Vehicle", back_populates="driver")


class Vehicle(Base):
    """車輛資料"""
    __tablename__ = 'vehicles'
    
    id = Column(Integer, primary_key=True)
    plate_number = Column(String(20), unique=True, nullable=False)  # 車牌號碼
    vehicle_type = Column(Enum(VehicleType), nullable=False)  # 車輛類型
    
    # 容量資訊
    max_cylinders_50kg = Column(Integer, default=0)
    max_cylinders_20kg = Column(Integer, default=0)
    max_cylinders_16kg = Column(Integer, default=0)
    max_cylinders_10kg = Column(Integer, default=0)
    max_cylinders_4kg = Column(Integer, default=0)
    
    # 狀態
    is_active = Column(Boolean, default=True)  # 是否可用
    is_available = Column(Boolean, default=True)  # 是否空閒
    
    # 當前司機
    driver_id = Column(Integer, ForeignKey('drivers.id'))
    driver = relationship("Driver", back_populates="vehicles")
    
    # 維護資訊
    last_maintenance = Column(Date)  # 上次保養日期
    next_maintenance = Column(Date)  # 下次保養日期
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 關聯
    deliveries = relationship("Delivery", back_populates="vehicle")


class Delivery(Base):
    """配送記錄"""
    __tablename__ = 'deliveries'
    
    id = Column(Integer, primary_key=True)
    
    # 客戶資訊
    client_id = Column(Integer, ForeignKey('clients.id'), nullable=False)
    client = relationship("Client", back_populates="deliveries")
    
    # 配送資訊
    scheduled_date = Column(Date, nullable=False, index=True)  # 預定配送日期
    scheduled_time_start = Column(String(5))  # 預定開始時間 (HH:MM)
    scheduled_time_end = Column(String(5))  # 預定結束時間 (HH:MM)
    
    actual_delivery_time = Column(DateTime)  # 實際配送時間
    
    # 配送人員與車輛
    driver_id = Column(Integer, ForeignKey('drivers.id'))
    driver = relationship("Driver", back_populates="deliveries")
    
    vehicle_id = Column(Integer, ForeignKey('vehicles.id'))
    vehicle = relationship("Vehicle", back_populates="deliveries")
    
    # 配送狀態
    status = Column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING)
    
    # 配送數量
    delivered_50kg = Column(Integer, default=0)
    delivered_20kg = Column(Integer, default=0)
    delivered_16kg = Column(Integer, default=0)
    delivered_10kg = Column(Integer, default=0)
    delivered_4kg = Column(Integer, default=0)
    
    # 退氣數量
    returned_50kg = Column(Integer, default=0)
    returned_20kg = Column(Integer, default=0)
    returned_16kg = Column(Integer, default=0)
    returned_10kg = Column(Integer, default=0)
    returned_4kg = Column(Integer, default=0)
    
    # 其他資訊
    notes = Column(Text)  # 備註
    signature_url = Column(String(500))  # 簽名圖片URL
    photo_url = Column(String(500))  # 現場照片URL
    
    # 路線資訊
    route_sequence = Column(Integer)  # 在路線中的順序
    distance_km = Column(Float)  # 距離(公里)
    estimated_duration_minutes = Column(Integer)  # 預估時間(分鐘)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_delivery_date_status', 'scheduled_date', 'status'),
        Index('idx_delivery_driver_date', 'driver_id', 'scheduled_date'),
    )


class DeliveryPrediction(Base):
    """配送預測"""
    __tablename__ = 'delivery_predictions'
    
    id = Column(Integer, primary_key=True)
    
    # 客戶資訊
    client_id = Column(Integer, ForeignKey('clients.id'), nullable=False)
    client = relationship("Client", back_populates="delivery_predictions")
    
    # 預測資訊
    prediction_date = Column(Date, nullable=False)  # 預測執行日期
    predicted_depletion_date = Column(Date, nullable=False)  # 預測耗盡日期
    recommended_delivery_date = Column(Date, nullable=False)  # 建議配送日期
    
    # 預測依據
    average_daily_usage = Column(Float)  # 平均日用量
    current_inventory = Column(Float)  # 當前庫存量
    confidence_score = Column(Float)  # 信心分數 (0-1)
    
    # 預測方法
    prediction_method = Column(String(50))  # 使用的預測方法
    
    # 是否已安排
    is_scheduled = Column(Boolean, default=False)
    scheduled_delivery_id = Column(Integer, ForeignKey('deliveries.id'))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_prediction_date', 'prediction_date'),
        Index('idx_prediction_client_date', 'client_id', 'predicted_depletion_date'),
    )


class Route(Base):
    """配送路線"""
    __tablename__ = 'routes'
    
    id = Column(Integer, primary_key=True)
    
    # 路線資訊
    route_date = Column(Date, nullable=False, index=True)  # 路線日期
    route_name = Column(String(100))  # 路線名稱
    area = Column(String(50))  # 區域
    
    # 指派資訊
    driver_id = Column(Integer, ForeignKey('drivers.id'))
    vehicle_id = Column(Integer, ForeignKey('vehicles.id'))
    
    # 路線統計
    total_clients = Column(Integer, default=0)  # 總客戶數
    total_distance_km = Column(Float, default=0)  # 總距離
    estimated_duration_minutes = Column(Integer, default=0)  # 預估總時間
    
    # 狀態
    is_optimized = Column(Boolean, default=False)  # 是否已優化
    optimization_score = Column(Float)  # 優化分數
    
    # 路線詳情 (JSON)
    route_details = Column(Text)  # 包含完整路線順序與細節
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_route_date_area', 'route_date', 'area'),
    )