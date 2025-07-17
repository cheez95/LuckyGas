from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import json
import logging

from models.database_schema import Driver, Delivery, Vehicle

logger = logging.getLogger(__name__)


class DriverService:
    """司機 CRUD 服務"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # CREATE
    def create_driver(self, driver_data: Dict[str, Any]) -> Driver:
        """
        建立新司機
        
        Args:
            driver_data: 司機資料字典
            
        Returns:
            Driver: 建立的司機物件
        """
        try:
            # 驗證必要欄位
            required_fields = ['name']
            for field in required_fields:
                if field not in driver_data or not driver_data[field]:
                    raise ValueError(f"缺少必要欄位: {field}")
            
            # 檢查員工編號是否已存在
            if 'employee_id' in driver_data and driver_data['employee_id']:
                existing = self.db.query(Driver).filter(
                    Driver.employee_id == driver_data['employee_id']
                ).first()
                if existing:
                    raise ValueError(f"員工編號已存在: {driver_data['employee_id']}")
            
            # 處理熟悉區域 (轉換為 JSON)
            if 'familiar_areas' in driver_data:
                if isinstance(driver_data['familiar_areas'], list):
                    driver_data['familiar_areas'] = json.dumps(
                        driver_data['familiar_areas'], ensure_ascii=False
                    )
                elif isinstance(driver_data['familiar_areas'], str):
                    # 驗證是否為有效的 JSON
                    try:
                        json.loads(driver_data['familiar_areas'])
                    except json.JSONDecodeError:
                        # 如果不是 JSON，視為單一區域
                        driver_data['familiar_areas'] = json.dumps(
                            [driver_data['familiar_areas']], ensure_ascii=False
                        )
            
            # 設定預設值
            driver_data.setdefault('is_active', True)
            driver_data.setdefault('is_available', True)
            driver_data.setdefault('experience_years', 0)
            
            # 建立司機物件
            driver = Driver(**driver_data)
            
            # 加入資料庫
            self.db.add(driver)
            self.db.commit()
            self.db.refresh(driver)
            
            logger.info(f"成功建立司機: {driver.name} (ID: {driver.id})")
            return driver
            
        except ValueError as e:
            self.db.rollback()
            logger.error(f"資料驗證失敗: {str(e)}")
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"建立司機失敗: {str(e)}")
            raise
    
    # READ
    def get_driver_by_id(self, driver_id: int) -> Optional[Driver]:
        """根據 ID 取得司機"""
        try:
            driver = self.db.query(Driver).filter(Driver.id == driver_id).first()
            if not driver:
                logger.warning(f"找不到司機 ID: {driver_id}")
            return driver
        except Exception as e:
            logger.error(f"查詢司機失敗 ID {driver_id}: {str(e)}")
            raise
    
    def get_driver_by_employee_id(self, employee_id: str) -> Optional[Driver]:
        """根據員工編號取得司機"""
        try:
            return self.db.query(Driver).filter(Driver.employee_id == employee_id).first()
        except Exception as e:
            logger.error(f"查詢司機失敗 員工編號 {employee_id}: {str(e)}")
            raise
    
    def get_all_drivers(self, 
                       skip: int = 0, 
                       limit: int = 100,
                       include_inactive: bool = False) -> List[Driver]:
        """
        取得所有司機
        
        Args:
            skip: 跳過筆數
            limit: 限制筆數
            include_inactive: 是否包含離職司機
        """
        try:
            query = self.db.query(Driver)
            
            if not include_inactive:
                query = query.filter(Driver.is_active == True)
            
            return query.offset(skip).limit(limit).all()
        except Exception as e:
            logger.error(f"查詢所有司機失敗: {str(e)}")
            raise
    
    def get_available_drivers(self) -> List[Driver]:
        """取得所有可派遣的司機"""
        try:
            return self.db.query(Driver).filter(
                and_(
                    Driver.is_active == True,
                    Driver.is_available == True
                )
            ).all()
        except Exception as e:
            logger.error(f"查詢可派遣司機失敗: {str(e)}")
            raise
    
    def search_drivers(self, 
                      search_term: str = None,
                      license_type: str = None,
                      min_experience_years: int = None,
                      familiar_area: str = None,
                      skip: int = 0,
                      limit: int = 100) -> List[Driver]:
        """
        搜尋司機
        
        Args:
            search_term: 搜尋關鍵字 (姓名、電話、員工編號)
            license_type: 駕照類型
            min_experience_years: 最少年資
            familiar_area: 熟悉區域
            skip: 跳過筆數
            limit: 限制筆數
        """
        try:
            query = self.db.query(Driver).filter(Driver.is_active == True)
            
            # 關鍵字搜尋
            if search_term:
                search_pattern = f"%{search_term}%"
                query = query.filter(
                    or_(
                        Driver.name.ilike(search_pattern),
                        Driver.phone.ilike(search_pattern),
                        Driver.employee_id.ilike(search_pattern)
                    )
                )
            
            # 駕照類型篩選
            if license_type:
                query = query.filter(Driver.license_type == license_type)
            
            # 年資篩選
            if min_experience_years is not None:
                query = query.filter(Driver.experience_years >= min_experience_years)
            
            # 熟悉區域篩選
            if familiar_area:
                # 使用 JSON 搜尋
                query = query.filter(
                    Driver.familiar_areas.contains(f'"{familiar_area}"')
                )
            
            return query.offset(skip).limit(limit).all()
            
        except Exception as e:
            logger.error(f"搜尋司機失敗: {str(e)}")
            raise
    
    # UPDATE
    def update_driver(self, driver_id: int, update_data: Dict[str, Any]) -> Optional[Driver]:
        """
        更新司機資料
        
        Args:
            driver_id: 司機 ID
            update_data: 更新資料字典
        """
        try:
            driver = self.get_driver_by_id(driver_id)
            if not driver:
                raise ValueError(f"找不到司機 ID: {driver_id}")
            
            # 不允許更新的欄位
            protected_fields = ['id', 'created_at']
            for field in protected_fields:
                update_data.pop(field, None)
            
            # 檢查員工編號是否重複
            if 'employee_id' in update_data and update_data['employee_id']:
                if update_data['employee_id'] != driver.employee_id:
                    existing = self.db.query(Driver).filter(
                        Driver.employee_id == update_data['employee_id']
                    ).first()
                    if existing:
                        raise ValueError(f"員工編號已存在: {update_data['employee_id']}")
            
            # 處理熟悉區域
            if 'familiar_areas' in update_data:
                if isinstance(update_data['familiar_areas'], list):
                    update_data['familiar_areas'] = json.dumps(
                        update_data['familiar_areas'], ensure_ascii=False
                    )
                elif isinstance(update_data['familiar_areas'], str):
                    try:
                        json.loads(update_data['familiar_areas'])
                    except json.JSONDecodeError:
                        update_data['familiar_areas'] = json.dumps(
                            [update_data['familiar_areas']], ensure_ascii=False
                        )
            
            # 更新欄位
            for field, value in update_data.items():
                if hasattr(driver, field):
                    setattr(driver, field, value)
            
            # 更新時間戳記
            driver.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(driver)
            
            logger.info(f"成功更新司機: {driver.name} (ID: {driver.id})")
            return driver
            
        except ValueError as e:
            self.db.rollback()
            logger.error(f"更新司機失敗: {str(e)}")
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"更新司機失敗 ID {driver_id}: {str(e)}")
            raise
    
    def update_driver_availability(self, driver_id: int, is_available: bool) -> Optional[Driver]:
        """更新司機可用狀態"""
        try:
            driver = self.get_driver_by_id(driver_id)
            if not driver:
                raise ValueError(f"找不到司機 ID: {driver_id}")
            
            driver.is_available = is_available
            driver.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(driver)
            
            status = "可派遣" if is_available else "不可派遣"
            logger.info(f"成功更新司機狀態: {driver.name} - {status}")
            return driver
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"更新司機可用狀態失敗: {str(e)}")
            raise
    
    def add_familiar_area(self, driver_id: int, area: str) -> Optional[Driver]:
        """新增司機熟悉區域"""
        try:
            driver = self.get_driver_by_id(driver_id)
            if not driver:
                raise ValueError(f"找不到司機 ID: {driver_id}")
            
            # 解析現有區域
            familiar_areas = []
            if driver.familiar_areas:
                try:
                    familiar_areas = json.loads(driver.familiar_areas)
                except json.JSONDecodeError:
                    familiar_areas = []
            
            # 新增區域（避免重複）
            if area not in familiar_areas:
                familiar_areas.append(area)
                driver.familiar_areas = json.dumps(familiar_areas, ensure_ascii=False)
                driver.updated_at = datetime.utcnow()
                
                self.db.commit()
                self.db.refresh(driver)
                
                logger.info(f"成功新增司機熟悉區域: {driver.name} - {area}")
            
            return driver
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"新增熟悉區域失敗: {str(e)}")
            raise
    
    # DELETE (Soft Delete)
    def delete_driver(self, driver_id: int, hard_delete: bool = False) -> bool:
        """
        刪除司機 (預設為軟刪除)
        
        Args:
            driver_id: 司機 ID
            hard_delete: 是否硬刪除
        """
        try:
            driver = self.get_driver_by_id(driver_id)
            if not driver:
                raise ValueError(f"找不到司機 ID: {driver_id}")
            
            # 檢查是否有進行中的配送
            active_deliveries = self.db.query(Delivery).filter(
                and_(
                    Delivery.driver_id == driver_id,
                    Delivery.status.in_(['assigned', 'in_progress'])
                )
            ).count()
            
            if active_deliveries > 0:
                raise ValueError(f"司機有 {active_deliveries} 筆進行中的配送，無法刪除")
            
            if hard_delete:
                # 硬刪除 - 解除車輛關聯
                vehicles = self.db.query(Vehicle).filter(Vehicle.driver_id == driver_id).all()
                for vehicle in vehicles:
                    vehicle.driver_id = None
                
                self.db.delete(driver)
                logger.warning(f"硬刪除司機: {driver.name} (ID: {driver_id})")
            else:
                # 軟刪除 - 標記為離職
                driver.is_active = False
                driver.is_available = False
                driver.updated_at = datetime.utcnow()
                logger.info(f"軟刪除司機(標記為離職): {driver.name} (ID: {driver_id})")
            
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"刪除司機失敗 ID {driver_id}: {str(e)}")
            raise
    
    def restore_driver(self, driver_id: int) -> Optional[Driver]:
        """恢復已刪除(離職)的司機"""
        try:
            driver = self.get_driver_by_id(driver_id)
            if not driver:
                raise ValueError(f"找不到司機 ID: {driver_id}")
            
            if driver.is_active:
                logger.warning(f"司機未離職，無需恢復: {driver.name}")
                return driver
            
            driver.is_active = True
            driver.is_available = True
            driver.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(driver)
            
            logger.info(f"成功恢復司機: {driver.name} (ID: {driver_id})")
            return driver
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"恢復司機失敗 ID {driver_id}: {str(e)}")
            raise
    
    # 其他實用方法
    def get_driver_statistics(self, driver_id: int) -> Dict[str, Any]:
        """取得司機統計資訊"""
        try:
            driver = self.get_driver_by_id(driver_id)
            if not driver:
                raise ValueError(f"找不到司機 ID: {driver_id}")
            
            # 統計配送數量
            total_deliveries = self.db.query(func.count(Delivery.id)).filter(
                Delivery.driver_id == driver_id
            ).scalar()
            
            completed_deliveries = self.db.query(func.count(Delivery.id)).filter(
                and_(
                    Delivery.driver_id == driver_id,
                    Delivery.status == 'completed'
                )
            ).scalar()
            
            # 取得指派的車輛
            assigned_vehicles = self.db.query(Vehicle).filter(
                Vehicle.driver_id == driver_id
            ).all()
            
            # 解析熟悉區域
            familiar_areas = []
            if driver.familiar_areas:
                try:
                    familiar_areas = json.loads(driver.familiar_areas)
                except json.JSONDecodeError:
                    familiar_areas = []
            
            return {
                "driver_id": driver.id,
                "name": driver.name,
                "employee_id": driver.employee_id,
                "phone": driver.phone,
                "license_type": driver.license_type,
                "experience_years": driver.experience_years,
                "is_active": driver.is_active,
                "is_available": driver.is_available,
                "total_deliveries": total_deliveries,
                "completed_deliveries": completed_deliveries,
                "completion_rate": round(completed_deliveries / total_deliveries * 100, 2) if total_deliveries > 0 else 0,
                "assigned_vehicles": [v.plate_number for v in assigned_vehicles],
                "familiar_areas": familiar_areas
            }
            
        except Exception as e:
            logger.error(f"取得司機統計失敗 ID {driver_id}: {str(e)}")
            raise
    
    def get_driver_schedule(self, driver_id: int, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        """取得司機排程"""
        try:
            deliveries = self.db.query(Delivery).filter(
                and_(
                    Delivery.driver_id == driver_id,
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
                    "client_id": delivery.client_id,
                    "client_code": delivery.client.client_code if delivery.client else None,
                    "client_name": delivery.client.invoice_title if delivery.client else None,
                    "address": delivery.client.address if delivery.client else None,
                    "status": delivery.status.value if delivery.status else None,
                    "route_sequence": delivery.route_sequence
                })
            
            return schedule
            
        except Exception as e:
            logger.error(f"取得司機排程失敗: {str(e)}")
            raise
    
    def get_drivers_by_area(self, area: str) -> List[Driver]:
        """取得熟悉特定區域的司機"""
        try:
            return self.db.query(Driver).filter(
                and_(
                    Driver.is_active == True,
                    Driver.familiar_areas.contains(f'"{area}"')
                )
            ).all()
        except Exception as e:
            logger.error(f"查詢區域司機失敗 {area}: {str(e)}")
            raise