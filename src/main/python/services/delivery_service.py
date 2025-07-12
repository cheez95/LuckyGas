from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import logging

from models.database_schema import Delivery, DeliveryStatus, Client, Driver, Vehicle
from core.database import get_db
from utils.date_converter import TaiwanDateConverter

logger = logging.getLogger(__name__)


class DeliveryService:
    """配送 CRUD 服務"""
    
    def __init__(self, db: Session):
        self.db = db
        self.date_converter = TaiwanDateConverter()
    
    # CREATE
    def create_delivery(self, delivery_data: Dict[str, Any]) -> Delivery:
        """
        建立新配送記錄
        
        Args:
            delivery_data: 配送資料字典
            
        Returns:
            Delivery: 建立的配送物件
        """
        try:
            # 驗證必要欄位
            required_fields = ['client_id', 'scheduled_date']
            for field in required_fields:
                if field not in delivery_data or delivery_data[field] is None:
                    raise ValueError(f"缺少必要欄位: {field}")
            
            # 驗證客戶存在
            client = self.db.query(Client).filter(Client.id == delivery_data['client_id']).first()
            if not client:
                raise ValueError(f"找不到客戶 ID: {delivery_data['client_id']}")
            
            if client.is_terminated:
                raise ValueError(f"客戶已解約: {client.client_code}")
            
            # 處理日期格式 (支援民國年)
            if isinstance(delivery_data['scheduled_date'], str):
                # 嘗試民國年轉換
                converted_date = self.date_converter.minguo_to_western(delivery_data['scheduled_date'])
                if converted_date:
                    delivery_data['scheduled_date'] = converted_date.date()
                else:
                    # 如果不是民國年，嘗試標準格式
                    delivery_data['scheduled_date'] = datetime.strptime(
                        delivery_data['scheduled_date'], '%Y-%m-%d'
                    ).date()
            
            # 處理狀態枚舉
            if 'status' in delivery_data and isinstance(delivery_data['status'], str):
                delivery_data['status'] = DeliveryStatus(delivery_data['status'])
            else:
                delivery_data['status'] = DeliveryStatus.PENDING
            
            # 驗證司機和車輛（如果有指派）
            if 'driver_id' in delivery_data and delivery_data['driver_id']:
                driver = self.db.query(Driver).filter(Driver.id == delivery_data['driver_id']).first()
                if not driver:
                    raise ValueError(f"找不到司機 ID: {delivery_data['driver_id']}")
                if not driver.is_active:
                    raise ValueError(f"司機未在職: {driver.name}")
            
            if 'vehicle_id' in delivery_data and delivery_data['vehicle_id']:
                vehicle = self.db.query(Vehicle).filter(Vehicle.id == delivery_data['vehicle_id']).first()
                if not vehicle:
                    raise ValueError(f"找不到車輛 ID: {delivery_data['vehicle_id']}")
                if not vehicle.is_active:
                    raise ValueError(f"車輛不可用: {vehicle.plate_number}")
            
            # 建立配送物件
            delivery = Delivery(**delivery_data)
            
            # 加入資料庫
            self.db.add(delivery)
            self.db.commit()
            self.db.refresh(delivery)
            
            logger.info(f"成功建立配送記錄: ID {delivery.id}, 客戶 {client.client_code}, 日期 {delivery.scheduled_date}")
            return delivery
            
        except ValueError as e:
            self.db.rollback()
            logger.error(f"資料驗證失敗: {str(e)}")
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"建立配送記錄失敗: {str(e)}")
            raise
    
    # READ
    def get_delivery_by_id(self, delivery_id: int) -> Optional[Delivery]:
        """根據 ID 取得配送記錄"""
        try:
            delivery = self.db.query(Delivery).filter(Delivery.id == delivery_id).first()
            if not delivery:
                logger.warning(f"找不到配送記錄 ID: {delivery_id}")
            return delivery
        except Exception as e:
            logger.error(f"查詢配送記錄失敗 ID {delivery_id}: {str(e)}")
            raise
    
    def get_all_deliveries(self, 
                          skip: int = 0, 
                          limit: int = 100,
                          start_date: date = None,
                          end_date: date = None) -> List[Delivery]:
        """
        取得所有配送記錄
        
        Args:
            skip: 跳過筆數
            limit: 限制筆數
            start_date: 開始日期
            end_date: 結束日期
        """
        try:
            query = self.db.query(Delivery)
            
            if start_date:
                query = query.filter(Delivery.scheduled_date >= start_date)
            
            if end_date:
                query = query.filter(Delivery.scheduled_date <= end_date)
            
            return query.order_by(Delivery.scheduled_date.desc()).offset(skip).limit(limit).all()
            
        except Exception as e:
            logger.error(f"查詢所有配送記錄失敗: {str(e)}")
            raise
    
    def get_deliveries_by_date(self, delivery_date: date) -> List[Delivery]:
        """取得特定日期的所有配送"""
        try:
            return self.db.query(Delivery).filter(
                Delivery.scheduled_date == delivery_date
            ).order_by(Delivery.route_sequence).all()
        except Exception as e:
            logger.error(f"查詢日期配送失敗 {delivery_date}: {str(e)}")
            raise
    
    def get_deliveries_by_driver(self, 
                                driver_id: int,
                                start_date: date = None,
                                end_date: date = None) -> List[Delivery]:
        """取得特定司機的配送記錄"""
        try:
            query = self.db.query(Delivery).filter(Delivery.driver_id == driver_id)
            
            if start_date:
                query = query.filter(Delivery.scheduled_date >= start_date)
            
            if end_date:
                query = query.filter(Delivery.scheduled_date <= end_date)
            
            return query.order_by(Delivery.scheduled_date.desc()).all()
            
        except Exception as e:
            logger.error(f"查詢司機配送失敗 ID {driver_id}: {str(e)}")
            raise
    
    def get_deliveries_by_client(self, 
                                client_id: int,
                                limit: int = 50) -> List[Delivery]:
        """取得特定客戶的配送記錄"""
        try:
            return self.db.query(Delivery).filter(
                Delivery.client_id == client_id
            ).order_by(Delivery.scheduled_date.desc()).limit(limit).all()
        except Exception as e:
            logger.error(f"查詢客戶配送失敗 ID {client_id}: {str(e)}")
            raise
    
    def search_deliveries(self,
                         status: DeliveryStatus = None,
                         area: str = None,
                         start_date: date = None,
                         end_date: date = None,
                         driver_id: int = None,
                         vehicle_id: int = None,
                         skip: int = 0,
                         limit: int = 100) -> List[Delivery]:
        """
        搜尋配送記錄
        
        Args:
            status: 配送狀態
            area: 區域
            start_date: 開始日期
            end_date: 結束日期
            driver_id: 司機 ID
            vehicle_id: 車輛 ID
            skip: 跳過筆數
            limit: 限制筆數
        """
        try:
            query = self.db.query(Delivery).join(Client)
            
            if status:
                query = query.filter(Delivery.status == status)
            
            if area:
                query = query.filter(Client.area == area)
            
            if start_date:
                query = query.filter(Delivery.scheduled_date >= start_date)
            
            if end_date:
                query = query.filter(Delivery.scheduled_date <= end_date)
            
            if driver_id:
                query = query.filter(Delivery.driver_id == driver_id)
            
            if vehicle_id:
                query = query.filter(Delivery.vehicle_id == vehicle_id)
            
            return query.order_by(Delivery.scheduled_date.desc()).offset(skip).limit(limit).all()
            
        except Exception as e:
            logger.error(f"搜尋配送記錄失敗: {str(e)}")
            raise
    
    # UPDATE
    def update_delivery(self, delivery_id: int, update_data: Dict[str, Any]) -> Optional[Delivery]:
        """
        更新配送記錄
        
        Args:
            delivery_id: 配送 ID
            update_data: 更新資料字典
        """
        try:
            delivery = self.get_delivery_by_id(delivery_id)
            if not delivery:
                raise ValueError(f"找不到配送記錄 ID: {delivery_id}")
            
            # 不允許更新的欄位
            protected_fields = ['id', 'created_at', 'client_id']
            for field in protected_fields:
                update_data.pop(field, None)
            
            # 處理日期格式
            if 'scheduled_date' in update_data and isinstance(update_data['scheduled_date'], str):
                converted_date = self.date_converter.minguo_to_western(update_data['scheduled_date'])
                if converted_date:
                    update_data['scheduled_date'] = converted_date.date()
                else:
                    update_data['scheduled_date'] = datetime.strptime(
                        update_data['scheduled_date'], '%Y-%m-%d'
                    ).date()
            
            # 處理狀態枚舉
            if 'status' in update_data and isinstance(update_data['status'], str):
                update_data['status'] = DeliveryStatus(update_data['status'])
            
            # 驗證司機和車輛
            if 'driver_id' in update_data and update_data['driver_id']:
                driver = self.db.query(Driver).filter(Driver.id == update_data['driver_id']).first()
                if not driver or not driver.is_active:
                    raise ValueError(f"司機不可用: ID {update_data['driver_id']}")
            
            if 'vehicle_id' in update_data and update_data['vehicle_id']:
                vehicle = self.db.query(Vehicle).filter(Vehicle.id == update_data['vehicle_id']).first()
                if not vehicle or not vehicle.is_active:
                    raise ValueError(f"車輛不可用: ID {update_data['vehicle_id']}")
            
            # 更新欄位
            for field, value in update_data.items():
                if hasattr(delivery, field):
                    setattr(delivery, field, value)
            
            # 更新時間戳記
            delivery.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(delivery)
            
            logger.info(f"成功更新配送記錄: ID {delivery.id}")
            return delivery
            
        except ValueError as e:
            self.db.rollback()
            logger.error(f"更新配送記錄失敗: {str(e)}")
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"更新配送記錄失敗 ID {delivery_id}: {str(e)}")
            raise
    
    def update_delivery_status(self, delivery_id: int, status: DeliveryStatus) -> Optional[Delivery]:
        """更新配送狀態"""
        try:
            delivery = self.get_delivery_by_id(delivery_id)
            if not delivery:
                raise ValueError(f"找不到配送記錄 ID: {delivery_id}")
            
            delivery.status = status
            
            # 如果標記為完成，記錄實際配送時間
            if status == DeliveryStatus.COMPLETED and not delivery.actual_delivery_time:
                delivery.actual_delivery_time = datetime.now()
            
            delivery.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(delivery)
            
            logger.info(f"成功更新配送狀態: ID {delivery.id}, 狀態 {status.value}")
            return delivery
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"更新配送狀態失敗: {str(e)}")
            raise
    
    def assign_driver_and_vehicle(self, 
                                 delivery_id: int, 
                                 driver_id: int, 
                                 vehicle_id: int) -> Optional[Delivery]:
        """指派司機和車輛"""
        try:
            delivery = self.get_delivery_by_id(delivery_id)
            if not delivery:
                raise ValueError(f"找不到配送記錄 ID: {delivery_id}")
            
            # 驗證司機
            driver = self.db.query(Driver).filter(Driver.id == driver_id).first()
            if not driver or not driver.is_active:
                raise ValueError(f"司機不可用: ID {driver_id}")
            
            # 驗證車輛
            vehicle = self.db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
            if not vehicle or not vehicle.is_active:
                raise ValueError(f"車輛不可用: ID {vehicle_id}")
            
            delivery.driver_id = driver_id
            delivery.vehicle_id = vehicle_id
            delivery.status = DeliveryStatus.ASSIGNED
            delivery.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(delivery)
            
            logger.info(f"成功指派配送: ID {delivery.id}, 司機 {driver.name}, 車輛 {vehicle.plate_number}")
            return delivery
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"指派司機和車輛失敗: {str(e)}")
            raise
    
    # DELETE (Soft Delete)
    def delete_delivery(self, delivery_id: int, hard_delete: bool = False) -> bool:
        """
        刪除配送記錄
        
        Args:
            delivery_id: 配送 ID
            hard_delete: 是否硬刪除
        """
        try:
            delivery = self.get_delivery_by_id(delivery_id)
            if not delivery:
                raise ValueError(f"找不到配送記錄 ID: {delivery_id}")
            
            # 檢查是否可以刪除
            if delivery.status in [DeliveryStatus.IN_PROGRESS, DeliveryStatus.COMPLETED]:
                if not hard_delete:
                    raise ValueError(f"無法刪除狀態為 {delivery.status.value} 的配送記錄")
            
            if hard_delete:
                # 硬刪除
                self.db.delete(delivery)
                logger.warning(f"硬刪除配送記錄: ID {delivery_id}")
            else:
                # 軟刪除 - 標記為取消
                delivery.status = DeliveryStatus.CANCELLED
                delivery.updated_at = datetime.utcnow()
                logger.info(f"軟刪除配送記錄(標記為取消): ID {delivery_id}")
            
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"刪除配送記錄失敗 ID {delivery_id}: {str(e)}")
            raise
    
    # 其他實用方法
    def get_pending_deliveries(self, date_limit: date = None) -> List[Delivery]:
        """取得待處理的配送"""
        try:
            query = self.db.query(Delivery).filter(
                Delivery.status == DeliveryStatus.PENDING
            )
            
            if date_limit:
                query = query.filter(Delivery.scheduled_date <= date_limit)
            
            return query.order_by(Delivery.scheduled_date).all()
            
        except Exception as e:
            logger.error(f"查詢待處理配送失敗: {str(e)}")
            raise
    
    def get_delivery_statistics(self, start_date: date, end_date: date) -> Dict[str, Any]:
        """取得配送統計"""
        try:
            deliveries = self.db.query(Delivery).filter(
                and_(
                    Delivery.scheduled_date >= start_date,
                    Delivery.scheduled_date <= end_date
                )
            ).all()
            
            stats = {
                "total_deliveries": len(deliveries),
                "completed": sum(1 for d in deliveries if d.status == DeliveryStatus.COMPLETED),
                "pending": sum(1 for d in deliveries if d.status == DeliveryStatus.PENDING),
                "assigned": sum(1 for d in deliveries if d.status == DeliveryStatus.ASSIGNED),
                "in_progress": sum(1 for d in deliveries if d.status == DeliveryStatus.IN_PROGRESS),
                "failed": sum(1 for d in deliveries if d.status == DeliveryStatus.FAILED),
                "cancelled": sum(1 for d in deliveries if d.status == DeliveryStatus.CANCELLED),
                "not_home": sum(1 for d in deliveries if d.status == DeliveryStatus.NOT_HOME),
                "refused": sum(1 for d in deliveries if d.status == DeliveryStatus.REFUSED),
                "completion_rate": 0,
                "total_cylinders_delivered": {
                    "50kg": sum(d.delivered_50kg for d in deliveries),
                    "20kg": sum(d.delivered_20kg for d in deliveries),
                    "16kg": sum(d.delivered_16kg for d in deliveries),
                    "10kg": sum(d.delivered_10kg for d in deliveries),
                    "4kg": sum(d.delivered_4kg for d in deliveries)
                },
                "total_cylinders_returned": {
                    "50kg": sum(d.returned_50kg for d in deliveries),
                    "20kg": sum(d.returned_20kg for d in deliveries),
                    "16kg": sum(d.returned_16kg for d in deliveries),
                    "10kg": sum(d.returned_10kg for d in deliveries),
                    "4kg": sum(d.returned_4kg for d in deliveries)
                }
            }
            
            # 計算完成率
            if stats["total_deliveries"] > 0:
                stats["completion_rate"] = round(
                    stats["completed"] / stats["total_deliveries"] * 100, 2
                )
            
            return stats
            
        except Exception as e:
            logger.error(f"取得配送統計失敗: {str(e)}")
            raise
    
    def get_driver_daily_summary(self, driver_id: int, delivery_date: date) -> Dict[str, Any]:
        """取得司機每日配送摘要"""
        try:
            deliveries = self.db.query(Delivery).filter(
                and_(
                    Delivery.driver_id == driver_id,
                    Delivery.scheduled_date == delivery_date
                )
            ).all()
            
            return {
                "driver_id": driver_id,
                "date": delivery_date,
                "total_deliveries": len(deliveries),
                "completed": sum(1 for d in deliveries if d.status == DeliveryStatus.COMPLETED),
                "total_distance_km": sum(d.distance_km or 0 for d in deliveries),
                "total_duration_minutes": sum(d.estimated_duration_minutes or 0 for d in deliveries),
                "clients_visited": len(set(d.client_id for d in deliveries))
            }
            
        except Exception as e:
            logger.error(f"取得司機每日摘要失敗: {str(e)}")
            raise