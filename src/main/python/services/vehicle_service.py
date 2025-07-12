from typing import List, Optional, Dict, Any
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import logging

from models.database_schema import Vehicle, VehicleType, Delivery, Driver
from core.database import get_db
from utils.date_converter import TaiwanDateConverter

logger = logging.getLogger(__name__)


class VehicleService:
    """車輛 CRUD 服務"""
    
    def __init__(self, db: Session):
        self.db = db
        self.date_converter = TaiwanDateConverter()
    
    # CREATE
    def create_vehicle(self, vehicle_data: Dict[str, Any]) -> Vehicle:
        """
        建立新車輛
        
        Args:
            vehicle_data: 車輛資料字典
            
        Returns:
            Vehicle: 建立的車輛物件
        """
        try:
            # 驗證必要欄位
            required_fields = ['plate_number', 'vehicle_type']
            for field in required_fields:
                if field not in vehicle_data or vehicle_data[field] is None:
                    raise ValueError(f"缺少必要欄位: {field}")
            
            # 檢查車牌號碼是否已存在
            existing = self.db.query(Vehicle).filter(
                Vehicle.plate_number == vehicle_data['plate_number']
            ).first()
            if existing:
                raise ValueError(f"車牌號碼已存在: {vehicle_data['plate_number']}")
            
            # 處理車輛類型枚舉
            if isinstance(vehicle_data['vehicle_type'], int):
                vehicle_data['vehicle_type'] = VehicleType(vehicle_data['vehicle_type'])
            elif isinstance(vehicle_data['vehicle_type'], str):
                # 處理字串轉換
                vehicle_map = {'CAR': 1, 'MOTORCYCLE': 2, 'ALL': 0}
                value = vehicle_map.get(vehicle_data['vehicle_type'].upper())
                if value is None:
                    raise ValueError(f"無效的車輛類型: {vehicle_data['vehicle_type']}")
                vehicle_data['vehicle_type'] = VehicleType(value)
            
            # 驗證車牌格式 (台灣車牌格式)
            plate = vehicle_data['plate_number'].upper()
            if not self._validate_plate_number(plate):
                logger.warning(f"車牌格式可能不正確: {plate}")
            
            # 處理維護日期 (支援民國年)
            for date_field in ['last_maintenance', 'next_maintenance']:
                if date_field in vehicle_data and vehicle_data[date_field]:
                    if isinstance(vehicle_data[date_field], str):
                        converted_date = self.date_converter.minguo_to_western(vehicle_data[date_field])
                        if converted_date:
                            vehicle_data[date_field] = converted_date.date()
                        else:
                            vehicle_data[date_field] = datetime.strptime(
                                vehicle_data[date_field], '%Y-%m-%d'
                            ).date()
            
            # 驗證司機（如果有指派）
            if 'driver_id' in vehicle_data and vehicle_data['driver_id']:
                driver = self.db.query(Driver).filter(Driver.id == vehicle_data['driver_id']).first()
                if not driver:
                    raise ValueError(f"找不到司機 ID: {vehicle_data['driver_id']}")
                if not driver.is_active:
                    raise ValueError(f"司機未在職: {driver.name}")
            
            # 設定預設值
            vehicle_data.setdefault('is_active', True)
            vehicle_data.setdefault('is_available', True)
            
            # 建立車輛物件
            vehicle = Vehicle(**vehicle_data)
            
            # 加入資料庫
            self.db.add(vehicle)
            self.db.commit()
            self.db.refresh(vehicle)
            
            logger.info(f"成功建立車輛: {vehicle.plate_number} (ID: {vehicle.id})")
            return vehicle
            
        except ValueError as e:
            self.db.rollback()
            logger.error(f"資料驗證失敗: {str(e)}")
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"建立車輛失敗: {str(e)}")
            raise
    
    def _validate_plate_number(self, plate_number: str) -> bool:
        """驗證台灣車牌號碼格式"""
        # 台灣車牌格式範例: ABC-1234, 1234-AB
        # 這裡只做基本驗證
        plate = plate_number.replace('-', '').replace(' ', '')
        return len(plate) >= 5 and len(plate) <= 8
    
    # READ
    def get_vehicle_by_id(self, vehicle_id: int) -> Optional[Vehicle]:
        """根據 ID 取得車輛"""
        try:
            vehicle = self.db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
            if not vehicle:
                logger.warning(f"找不到車輛 ID: {vehicle_id}")
            return vehicle
        except Exception as e:
            logger.error(f"查詢車輛失敗 ID {vehicle_id}: {str(e)}")
            raise
    
    def get_vehicle_by_plate(self, plate_number: str) -> Optional[Vehicle]:
        """根據車牌號碼取得車輛"""
        try:
            return self.db.query(Vehicle).filter(
                Vehicle.plate_number == plate_number.upper()
            ).first()
        except Exception as e:
            logger.error(f"查詢車輛失敗 車牌 {plate_number}: {str(e)}")
            raise
    
    def get_all_vehicles(self, 
                        skip: int = 0, 
                        limit: int = 100,
                        include_inactive: bool = False) -> List[Vehicle]:
        """
        取得所有車輛
        
        Args:
            skip: 跳過筆數
            limit: 限制筆數
            include_inactive: 是否包含停用車輛
        """
        try:
            query = self.db.query(Vehicle)
            
            if not include_inactive:
                query = query.filter(Vehicle.is_active == True)
            
            return query.offset(skip).limit(limit).all()
        except Exception as e:
            logger.error(f"查詢所有車輛失敗: {str(e)}")
            raise
    
    def get_available_vehicles(self, vehicle_type: VehicleType = None) -> List[Vehicle]:
        """
        取得所有可用車輛
        
        Args:
            vehicle_type: 車輛類型篩選
        """
        try:
            query = self.db.query(Vehicle).filter(
                and_(
                    Vehicle.is_active == True,
                    Vehicle.is_available == True
                )
            )
            
            if vehicle_type and vehicle_type != VehicleType.ALL:
                query = query.filter(Vehicle.vehicle_type == vehicle_type)
            
            return query.all()
        except Exception as e:
            logger.error(f"查詢可用車輛失敗: {str(e)}")
            raise
    
    def search_vehicles(self, 
                       search_term: str = None,
                       vehicle_type: VehicleType = None,
                       driver_id: int = None,
                       needs_maintenance: bool = None,
                       skip: int = 0,
                       limit: int = 100) -> List[Vehicle]:
        """
        搜尋車輛
        
        Args:
            search_term: 搜尋關鍵字 (車牌號碼)
            vehicle_type: 車輛類型
            driver_id: 司機 ID
            needs_maintenance: 是否需要保養
            skip: 跳過筆數
            limit: 限制筆數
        """
        try:
            query = self.db.query(Vehicle).filter(Vehicle.is_active == True)
            
            # 關鍵字搜尋
            if search_term:
                search_pattern = f"%{search_term.upper()}%"
                query = query.filter(Vehicle.plate_number.ilike(search_pattern))
            
            # 車輛類型篩選
            if vehicle_type and vehicle_type != VehicleType.ALL:
                query = query.filter(Vehicle.vehicle_type == vehicle_type)
            
            # 司機篩選
            if driver_id is not None:
                if driver_id == 0:
                    # 未指派司機的車輛
                    query = query.filter(Vehicle.driver_id == None)
                else:
                    query = query.filter(Vehicle.driver_id == driver_id)
            
            # 保養篩選
            if needs_maintenance is not None:
                today = date.today()
                if needs_maintenance:
                    # 需要保養的車輛
                    query = query.filter(
                        or_(
                            Vehicle.next_maintenance <= today,
                            Vehicle.next_maintenance == None
                        )
                    )
                else:
                    # 不需要保養的車輛
                    query = query.filter(Vehicle.next_maintenance > today)
            
            return query.offset(skip).limit(limit).all()
            
        except Exception as e:
            logger.error(f"搜尋車輛失敗: {str(e)}")
            raise
    
    # UPDATE
    def update_vehicle(self, vehicle_id: int, update_data: Dict[str, Any]) -> Optional[Vehicle]:
        """
        更新車輛資料
        
        Args:
            vehicle_id: 車輛 ID
            update_data: 更新資料字典
        """
        try:
            vehicle = self.get_vehicle_by_id(vehicle_id)
            if not vehicle:
                raise ValueError(f"找不到車輛 ID: {vehicle_id}")
            
            # 不允許更新的欄位
            protected_fields = ['id', 'created_at']
            for field in protected_fields:
                update_data.pop(field, None)
            
            # 檢查車牌號碼是否重複
            if 'plate_number' in update_data:
                update_data['plate_number'] = update_data['plate_number'].upper()
                if update_data['plate_number'] != vehicle.plate_number:
                    existing = self.db.query(Vehicle).filter(
                        Vehicle.plate_number == update_data['plate_number']
                    ).first()
                    if existing:
                        raise ValueError(f"車牌號碼已存在: {update_data['plate_number']}")
            
            # 處理車輛類型枚舉
            if 'vehicle_type' in update_data:
                if isinstance(update_data['vehicle_type'], int):
                    update_data['vehicle_type'] = VehicleType(update_data['vehicle_type'])
                elif isinstance(update_data['vehicle_type'], str):
                    vehicle_map = {'CAR': 1, 'MOTORCYCLE': 2, 'ALL': 0}
                    value = vehicle_map.get(update_data['vehicle_type'].upper())
                    if value is None:
                        raise ValueError(f"無效的車輛類型: {update_data['vehicle_type']}")
                    update_data['vehicle_type'] = VehicleType(value)
            
            # 處理維護日期
            for date_field in ['last_maintenance', 'next_maintenance']:
                if date_field in update_data and update_data[date_field]:
                    if isinstance(update_data[date_field], str):
                        converted_date = self.date_converter.minguo_to_western(update_data[date_field])
                        if converted_date:
                            update_data[date_field] = converted_date.date()
                        else:
                            update_data[date_field] = datetime.strptime(
                                update_data[date_field], '%Y-%m-%d'
                            ).date()
            
            # 驗證司機
            if 'driver_id' in update_data and update_data['driver_id']:
                driver = self.db.query(Driver).filter(Driver.id == update_data['driver_id']).first()
                if not driver or not driver.is_active:
                    raise ValueError(f"司機不可用: ID {update_data['driver_id']}")
            
            # 更新欄位
            for field, value in update_data.items():
                if hasattr(vehicle, field):
                    setattr(vehicle, field, value)
            
            # 更新時間戳記
            vehicle.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(vehicle)
            
            logger.info(f"成功更新車輛: {vehicle.plate_number} (ID: {vehicle.id})")
            return vehicle
            
        except ValueError as e:
            self.db.rollback()
            logger.error(f"更新車輛失敗: {str(e)}")
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"更新車輛失敗 ID {vehicle_id}: {str(e)}")
            raise
    
    def update_vehicle_availability(self, vehicle_id: int, is_available: bool) -> Optional[Vehicle]:
        """更新車輛可用狀態"""
        try:
            vehicle = self.get_vehicle_by_id(vehicle_id)
            if not vehicle:
                raise ValueError(f"找不到車輛 ID: {vehicle_id}")
            
            vehicle.is_available = is_available
            vehicle.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(vehicle)
            
            status = "可用" if is_available else "使用中"
            logger.info(f"成功更新車輛狀態: {vehicle.plate_number} - {status}")
            return vehicle
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"更新車輛可用狀態失敗: {str(e)}")
            raise
    
    def assign_driver(self, vehicle_id: int, driver_id: Optional[int]) -> Optional[Vehicle]:
        """指派司機給車輛"""
        try:
            vehicle = self.get_vehicle_by_id(vehicle_id)
            if not vehicle:
                raise ValueError(f"找不到車輛 ID: {vehicle_id}")
            
            if driver_id:
                driver = self.db.query(Driver).filter(Driver.id == driver_id).first()
                if not driver or not driver.is_active:
                    raise ValueError(f"司機不可用: ID {driver_id}")
                
                # 檢查司機是否已有其他車輛
                other_vehicles = self.db.query(Vehicle).filter(
                    and_(
                        Vehicle.driver_id == driver_id,
                        Vehicle.id != vehicle_id
                    )
                ).count()
                
                if other_vehicles > 0:
                    logger.warning(f"司機 {driver.name} 已指派其他車輛")
            
            vehicle.driver_id = driver_id
            vehicle.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(vehicle)
            
            if driver_id:
                logger.info(f"成功指派司機給車輛: {vehicle.plate_number} -> {driver.name}")
            else:
                logger.info(f"成功解除車輛司機指派: {vehicle.plate_number}")
            
            return vehicle
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"指派司機失敗: {str(e)}")
            raise
    
    def record_maintenance(self, vehicle_id: int, maintenance_date: date, next_date: date = None) -> Optional[Vehicle]:
        """記錄車輛保養"""
        try:
            vehicle = self.get_vehicle_by_id(vehicle_id)
            if not vehicle:
                raise ValueError(f"找不到車輛 ID: {vehicle_id}")
            
            vehicle.last_maintenance = maintenance_date
            if next_date:
                vehicle.next_maintenance = next_date
            vehicle.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(vehicle)
            
            logger.info(f"成功記錄車輛保養: {vehicle.plate_number}, 保養日期: {maintenance_date}")
            return vehicle
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"記錄保養失敗: {str(e)}")
            raise
    
    # DELETE (Soft Delete)
    def delete_vehicle(self, vehicle_id: int, hard_delete: bool = False) -> bool:
        """
        刪除車輛 (預設為軟刪除)
        
        Args:
            vehicle_id: 車輛 ID
            hard_delete: 是否硬刪除
        """
        try:
            vehicle = self.get_vehicle_by_id(vehicle_id)
            if not vehicle:
                raise ValueError(f"找不到車輛 ID: {vehicle_id}")
            
            # 檢查是否有進行中的配送
            active_deliveries = self.db.query(Delivery).filter(
                and_(
                    Delivery.vehicle_id == vehicle_id,
                    Delivery.status.in_(['assigned', 'in_progress'])
                )
            ).count()
            
            if active_deliveries > 0:
                raise ValueError(f"車輛有 {active_deliveries} 筆進行中的配送，無法刪除")
            
            if hard_delete:
                # 硬刪除
                self.db.delete(vehicle)
                logger.warning(f"硬刪除車輛: {vehicle.plate_number} (ID: {vehicle_id})")
            else:
                # 軟刪除 - 標記為停用
                vehicle.is_active = False
                vehicle.is_available = False
                vehicle.driver_id = None  # 解除司機指派
                vehicle.updated_at = datetime.utcnow()
                logger.info(f"軟刪除車輛(標記為停用): {vehicle.plate_number} (ID: {vehicle_id})")
            
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"刪除車輛失敗 ID {vehicle_id}: {str(e)}")
            raise
    
    def restore_vehicle(self, vehicle_id: int) -> Optional[Vehicle]:
        """恢復已刪除(停用)的車輛"""
        try:
            vehicle = self.get_vehicle_by_id(vehicle_id)
            if not vehicle:
                raise ValueError(f"找不到車輛 ID: {vehicle_id}")
            
            if vehicle.is_active:
                logger.warning(f"車輛未停用，無需恢復: {vehicle.plate_number}")
                return vehicle
            
            vehicle.is_active = True
            vehicle.is_available = True
            vehicle.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(vehicle)
            
            logger.info(f"成功恢復車輛: {vehicle.plate_number} (ID: {vehicle_id})")
            return vehicle
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"恢復車輛失敗 ID {vehicle_id}: {str(e)}")
            raise
    
    # 其他實用方法
    def get_vehicle_statistics(self, vehicle_id: int) -> Dict[str, Any]:
        """取得車輛統計資訊"""
        try:
            vehicle = self.get_vehicle_by_id(vehicle_id)
            if not vehicle:
                raise ValueError(f"找不到車輛 ID: {vehicle_id}")
            
            # 統計配送數量
            total_deliveries = self.db.query(func.count(Delivery.id)).filter(
                Delivery.vehicle_id == vehicle_id
            ).scalar()
            
            completed_deliveries = self.db.query(func.count(Delivery.id)).filter(
                and_(
                    Delivery.vehicle_id == vehicle_id,
                    Delivery.status == 'completed'
                )
            ).scalar()
            
            # 計算總里程
            total_distance = self.db.query(func.sum(Delivery.distance_km)).filter(
                Delivery.vehicle_id == vehicle_id
            ).scalar() or 0
            
            # 保養狀態
            maintenance_status = "需要保養"
            if vehicle.next_maintenance:
                days_until_maintenance = (vehicle.next_maintenance - date.today()).days
                if days_until_maintenance > 30:
                    maintenance_status = "良好"
                elif days_until_maintenance > 0:
                    maintenance_status = f"{days_until_maintenance} 天後需要保養"
            
            return {
                "vehicle_id": vehicle.id,
                "plate_number": vehicle.plate_number,
                "vehicle_type": vehicle.vehicle_type.name if vehicle.vehicle_type else None,
                "is_active": vehicle.is_active,
                "is_available": vehicle.is_available,
                "driver_id": vehicle.driver_id,
                "driver_name": vehicle.driver.name if vehicle.driver else None,
                "total_deliveries": total_deliveries,
                "completed_deliveries": completed_deliveries,
                "completion_rate": round(completed_deliveries / total_deliveries * 100, 2) if total_deliveries > 0 else 0,
                "total_distance_km": round(total_distance, 2),
                "last_maintenance": vehicle.last_maintenance,
                "next_maintenance": vehicle.next_maintenance,
                "maintenance_status": maintenance_status,
                "capacity": {
                    "50kg": vehicle.max_cylinders_50kg,
                    "20kg": vehicle.max_cylinders_20kg,
                    "16kg": vehicle.max_cylinders_16kg,
                    "10kg": vehicle.max_cylinders_10kg,
                    "4kg": vehicle.max_cylinders_4kg
                }
            }
            
        except Exception as e:
            logger.error(f"取得車輛統計失敗 ID {vehicle_id}: {str(e)}")
            raise
    
    def get_vehicles_needing_maintenance(self, days_ahead: int = 30) -> List[Vehicle]:
        """取得需要保養的車輛"""
        try:
            target_date = date.today() + timedelta(days=days_ahead)
            
            return self.db.query(Vehicle).filter(
                and_(
                    Vehicle.is_active == True,
                    or_(
                        Vehicle.next_maintenance <= target_date,
                        Vehicle.next_maintenance == None
                    )
                )
            ).all()
            
        except Exception as e:
            logger.error(f"查詢需要保養的車輛失敗: {str(e)}")
            raise
    
    def get_vehicle_schedule(self, vehicle_id: int, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        """取得車輛排程"""
        try:
            deliveries = self.db.query(Delivery).filter(
                and_(
                    Delivery.vehicle_id == vehicle_id,
                    Delivery.scheduled_date >= start_date,
                    Delivery.scheduled_date <= end_date
                )
            ).order_by(Delivery.scheduled_date, Delivery.route_sequence).all()
            
            schedule = []
            for delivery in deliveries:
                schedule.append({
                    "delivery_id": delivery.id,
                    "scheduled_date": delivery.scheduled_date,
                    "scheduled_time_start": delivery.scheduled_time_start,
                    "scheduled_time_end": delivery.scheduled_time_end,
                    "driver_id": delivery.driver_id,
                    "driver_name": delivery.driver.name if delivery.driver else None,
                    "client_id": delivery.client_id,
                    "client_code": delivery.client.client_code if delivery.client else None,
                    "client_name": delivery.client.invoice_title if delivery.client else None,
                    "address": delivery.client.address if delivery.client else None,
                    "status": delivery.status.value if delivery.status else None,
                    "route_sequence": delivery.route_sequence
                })
            
            return schedule
            
        except Exception as e:
            logger.error(f"取得車輛排程失敗: {str(e)}")
            raise