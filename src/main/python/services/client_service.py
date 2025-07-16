from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
import logging

from models.database_schema import Client, PaymentMethod, VehicleType
from utils.date_converter import TaiwanDateConverter

logger = logging.getLogger(__name__)


class ClientService:
    """客戶 CRUD 服務"""
    
    def __init__(self, db: Session):
        self.db = db
        self.date_converter = TaiwanDateConverter()
    
    # CREATE
    def create_client(self, client_data: Dict[str, Any]) -> Client:
        """
        建立新客戶
        
        Args:
            client_data: 客戶資料字典
            
        Returns:
            Client: 建立的客戶物件
            
        Raises:
            ValueError: 資料驗證失敗
            Exception: 資料庫錯誤
        """
        try:
            # 驗證必要欄位
            required_fields = ['client_code', 'invoice_title', 'address']
            for field in required_fields:
                if field not in client_data or not client_data[field]:
                    raise ValueError(f"缺少必要欄位: {field}")
            
            # 檢查客戶編號是否已存在
            existing = self.db.query(Client).filter(
                Client.client_code == client_data['client_code']
            ).first()
            if existing:
                raise ValueError(f"客戶編號已存在: {client_data['client_code']}")
            
            # 處理支付方式枚舉
            if 'payment_method' in client_data and isinstance(client_data['payment_method'], str):
                try:
                    client_data['payment_method'] = PaymentMethod(client_data['payment_method'])
                except ValueError:
                    logger.warning(f"無效的支付方式: {client_data['payment_method']}")
                    client_data['payment_method'] = PaymentMethod.CASH
            
            # 處理車輛類型枚舉
            if 'vehicle_type' in client_data:
                if isinstance(client_data['vehicle_type'], int):
                    client_data['vehicle_type'] = VehicleType(client_data['vehicle_type'])
                elif isinstance(client_data['vehicle_type'], str):
                    # 處理字串轉換
                    vehicle_map = {'CAR': 1, 'MOTORCYCLE': 2, 'ALL': 0}
                    value = vehicle_map.get(client_data['vehicle_type'].upper(), 0)
                    client_data['vehicle_type'] = VehicleType(value)
            
            # 驗證地址格式 (台灣地址應包含縣市區域)
            address = client_data['address']
            if not any(keyword in address for keyword in ['市', '縣', '區', '鄉', '鎮']):
                logger.warning(f"地址格式可能不完整: {address}")
            
            # 建立客戶物件
            client = Client(**client_data)
            
            # 加入資料庫
            self.db.add(client)
            self.db.commit()
            self.db.refresh(client)
            
            logger.info(f"成功建立客戶: {client.client_code}")
            return client
            
        except ValueError as e:
            self.db.rollback()
            logger.error(f"資料驗證失敗: {str(e)}")
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"建立客戶失敗: {str(e)}")
            raise
    
    # READ
    def get_client_by_id(self, client_id: int) -> Optional[Client]:
        """根據 ID 取得客戶"""
        try:
            client = self.db.query(Client).filter(Client.id == client_id).first()
            if not client:
                logger.warning(f"找不到客戶 ID: {client_id}")
            return client
        except Exception as e:
            logger.error(f"查詢客戶失敗 ID {client_id}: {str(e)}")
            raise
    
    def get_client_by_code(self, client_code: str) -> Optional[Client]:
        """根據客戶編號取得客戶"""
        try:
            return self.db.query(Client).filter(Client.client_code == client_code).first()
        except Exception as e:
            logger.error(f"查詢客戶失敗 編號 {client_code}: {str(e)}")
            raise
    
    def get_all_clients(self, 
                       skip: int = 0, 
                       limit: int = 100,
                       include_terminated: bool = False) -> List[Client]:
        """
        取得所有客戶
        
        Args:
            skip: 跳過筆數
            limit: 限制筆數
            include_terminated: 是否包含已解約客戶
        """
        try:
            query = self.db.query(Client)
            
            if not include_terminated:
                query = query.filter(Client.is_terminated == False)
            
            return query.offset(skip).limit(limit).all()
        except Exception as e:
            logger.error(f"查詢所有客戶失敗: {str(e)}")
            raise
    
    def search_clients(self, 
                      search_term: str = None,
                      area: str = None,
                      payment_method: PaymentMethod = None,
                      vehicle_type: VehicleType = None,
                      needs_same_day_delivery: bool = None,
                      skip: int = 0,
                      limit: int = 100) -> List[Client]:
        """
        搜尋客戶
        
        Args:
            search_term: 搜尋關鍵字 (客戶編號、發票抬頭、簡稱、地址)
            area: 區域
            payment_method: 支付方式
            vehicle_type: 車輛類型
            needs_same_day_delivery: 是否需要當天配送
            skip: 跳過筆數
            limit: 限制筆數
        """
        try:
            query = self.db.query(Client).filter(Client.is_terminated == False)
            
            # 關鍵字搜尋
            if search_term:
                search_pattern = f"%{search_term}%"
                query = query.filter(
                    or_(
                        Client.client_code.ilike(search_pattern),
                        Client.invoice_title.ilike(search_pattern),
                        Client.short_name.ilike(search_pattern),
                        Client.address.ilike(search_pattern)
                    )
                )
            
            # 區域篩選
            if area:
                query = query.filter(Client.area == area)
            
            # 支付方式篩選
            if payment_method:
                query = query.filter(Client.payment_method == payment_method)
            
            # 車輛類型篩選
            if vehicle_type is not None:
                query = query.filter(Client.vehicle_type == vehicle_type)
            
            # 當天配送篩選
            if needs_same_day_delivery is not None:
                query = query.filter(Client.needs_same_day_delivery == needs_same_day_delivery)
            
            return query.offset(skip).limit(limit).all()
            
        except Exception as e:
            logger.error(f"搜尋客戶失敗: {str(e)}")
            raise
    
    def get_clients_by_area(self, area: str) -> List[Client]:
        """取得特定區域的所有客戶"""
        try:
            return self.db.query(Client).filter(
                and_(
                    Client.area == area,
                    Client.is_terminated == False
                )
            ).all()
        except Exception as e:
            logger.error(f"查詢區域客戶失敗 {area}: {str(e)}")
            raise
    
    def get_active_clients_count(self) -> int:
        """取得活躍客戶數量"""
        try:
            return self.db.query(func.count(Client.id)).filter(
                Client.is_terminated == False
            ).scalar()
        except Exception as e:
            logger.error(f"統計活躍客戶失敗: {str(e)}")
            raise
    
    # UPDATE
    def update_client(self, client_id: int, update_data: Dict[str, Any]) -> Optional[Client]:
        """
        更新客戶資料
        
        Args:
            client_id: 客戶 ID
            update_data: 更新資料字典
            
        Returns:
            Client: 更新後的客戶物件
        """
        try:
            client = self.get_client_by_id(client_id)
            if not client:
                raise ValueError(f"找不到客戶 ID: {client_id}")
            
            # 不允許更新的欄位
            protected_fields = ['id', 'created_at', 'client_code']
            for field in protected_fields:
                update_data.pop(field, None)
            
            # 處理支付方式枚舉
            if 'payment_method' in update_data and isinstance(update_data['payment_method'], str):
                try:
                    update_data['payment_method'] = PaymentMethod(update_data['payment_method'])
                except ValueError:
                    logger.warning(f"無效的支付方式: {update_data['payment_method']}")
                    update_data.pop('payment_method')
            
            # 處理車輛類型枚舉
            if 'vehicle_type' in update_data:
                if isinstance(update_data['vehicle_type'], int):
                    update_data['vehicle_type'] = VehicleType(update_data['vehicle_type'])
                elif isinstance(update_data['vehicle_type'], str):
                    vehicle_map = {'CAR': 1, 'MOTORCYCLE': 2, 'ALL': 0}
                    value = vehicle_map.get(update_data['vehicle_type'].upper(), 0)
                    update_data['vehicle_type'] = VehicleType(value)
            
            # 更新欄位
            for field, value in update_data.items():
                if hasattr(client, field):
                    setattr(client, field, value)
            
            # 更新時間戳記
            client.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(client)
            
            logger.info(f"成功更新客戶: {client.client_code}")
            return client
            
        except ValueError as e:
            self.db.rollback()
            logger.error(f"更新客戶失敗: {str(e)}")
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"更新客戶失敗 ID {client_id}: {str(e)}")
            raise
    
    def update_cylinder_inventory(self, client_id: int, cylinder_updates: Dict[str, int]) -> Optional[Client]:
        """更新客戶鋼瓶庫存"""
        try:
            client = self.get_client_by_id(client_id)
            if not client:
                raise ValueError(f"找不到客戶 ID: {client_id}")
            
            # 更新各種鋼瓶庫存
            cylinder_fields = [
                'cylinder_50kg', 'cylinder_20kg_business', 'cylinder_16kg_business',
                'cylinder_20kg', 'cylinder_16kg', 'cylinder_10kg', 'cylinder_4kg',
                'cylinder_16kg_goodluck', 'cylinder_10kg_safety', 'cylinder_happiness',
                'cylinder_20kg_goodluck'
            ]
            
            for field in cylinder_fields:
                if field in cylinder_updates:
                    current_value = getattr(client, field, 0)
                    new_value = current_value + cylinder_updates[field]
                    if new_value < 0:
                        logger.warning(f"鋼瓶庫存不能為負數: {field} = {new_value}")
                        new_value = 0
                    setattr(client, field, new_value)
            
            client.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(client)
            
            logger.info(f"成功更新客戶鋼瓶庫存: {client.client_code}")
            return client
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"更新鋼瓶庫存失敗: {str(e)}")
            raise
    
    # DELETE (Soft Delete)
    def delete_client(self, client_id: int, hard_delete: bool = False) -> bool:
        """
        刪除客戶 (預設為軟刪除)
        
        Args:
            client_id: 客戶 ID
            hard_delete: 是否硬刪除
            
        Returns:
            bool: 是否成功刪除
        """
        try:
            client = self.get_client_by_id(client_id)
            if not client:
                raise ValueError(f"找不到客戶 ID: {client_id}")
            
            if hard_delete:
                # 硬刪除 - 實際從資料庫移除
                self.db.delete(client)
                logger.warning(f"硬刪除客戶: {client.client_code}")
            else:
                # 軟刪除 - 標記為已解約
                client.is_terminated = True
                client.updated_at = datetime.utcnow()
                logger.info(f"軟刪除客戶(標記為已解約): {client.client_code}")
            
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"刪除客戶失敗 ID {client_id}: {str(e)}")
            raise
    
    def restore_client(self, client_id: int) -> Optional[Client]:
        """恢復已刪除(解約)的客戶"""
        try:
            client = self.get_client_by_id(client_id)
            if not client:
                raise ValueError(f"找不到客戶 ID: {client_id}")
            
            if not client.is_terminated:
                logger.warning(f"客戶未被刪除，無需恢復: {client.client_code}")
                return client
            
            client.is_terminated = False
            client.updated_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(client)
            
            logger.info(f"成功恢復客戶: {client.client_code}")
            return client
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"恢復客戶失敗 ID {client_id}: {str(e)}")
            raise
    
    # 其他實用方法
    def get_clients_needing_delivery(self, days_ahead: int = 7) -> List[Client]:
        """取得需要配送的客戶列表"""
        try:
            # 這裡可以根據客戶的日使用量和庫存計算
            # 暫時返回所有需要當天配送的客戶
            return self.db.query(Client).filter(
                and_(
                    Client.needs_same_day_delivery == True,
                    Client.is_terminated == False
                )
            ).all()
        except Exception as e:
            logger.error(f"查詢需要配送的客戶失敗: {str(e)}")
            raise
    
    def get_client_statistics(self, client_id: int) -> Dict[str, Any]:
        """取得客戶統計資訊"""
        try:
            client = self.get_client_by_id(client_id)
            if not client:
                raise ValueError(f"找不到客戶 ID: {client_id}")
            
            # 計算總鋼瓶庫存
            total_cylinders = (
                client.cylinder_50kg + client.cylinder_20kg_business +
                client.cylinder_16kg_business + client.cylinder_20kg +
                client.cylinder_16kg + client.cylinder_10kg +
                client.cylinder_4kg + client.cylinder_16kg_goodluck +
                client.cylinder_10kg_safety + client.cylinder_happiness +
                client.cylinder_20kg_goodluck
            )
            
            # 計算總流量計
            total_flow_meters = (
                client.flow_50kg + client.flow_20kg + client.flow_16kg +
                client.flow_20kg_goodluck + client.flow_16kg_goodluck
            )
            
            return {
                "client_code": client.client_code,
                "invoice_title": client.invoice_title,
                "total_cylinders": total_cylinders,
                "total_flow_meters": total_flow_meters,
                "daily_usage_avg": client.daily_usage_avg,
                "monthly_delivery_volume": client.monthly_delivery_volume,
                "gas_return_ratio": client.gas_return_ratio,
                "area": client.area,
                "payment_method": client.payment_method.value if client.payment_method else None,
                "is_subscription_member": client.subscription_member,
                "needs_same_day_delivery": client.needs_same_day_delivery
            }
            
        except Exception as e:
            logger.error(f"取得客戶統計失敗 ID {client_id}: {str(e)}")
            raise