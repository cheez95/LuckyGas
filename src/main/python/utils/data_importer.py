import pandas as pd
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from datetime import datetime
import logging
from sqlalchemy.orm import Session

from models.database_schema import Client, Delivery, DeliveryStatus, PaymentMethod, VehicleType
from core.database import DatabaseManager
from utils.date_converter import TaiwanDateConverter

logger = logging.getLogger(__name__)


class ExcelDataImporter:
    """Excel 資料匯入器"""
    
    def __init__(self, db_session: Session):
        self.session = db_session
        self.date_converter = TaiwanDateConverter()
        self.imported_clients = 0
        self.imported_deliveries = 0
        
    def import_client_data(self, excel_file_path):
        """匯入客戶資料"""
        logger.info(f"Starting to import client data from {excel_file_path}")
        
        # 讀取客戶資料表
        df = pd.read_excel(excel_file_path, sheet_name='客戶資料')
        
        for index, row in df.iterrows():
            try:
                # 檢查客戶是否已存在
                client_code = str(row['客戶']).strip()
                existing_client = self.session.query(Client).filter_by(
                    client_code=client_code
                ).first()
                
                if existing_client:
                    # 更新現有客戶
                    client = existing_client
                else:
                    # 建立新客戶
                    client = Client()
                    client.client_code = client_code
                
                # 基本資料
                client.invoice_title = str(row['電子發票抬頭']) if pd.notna(row['電子發票抬頭']) else ''
                client.short_name = str(row['客戶簡稱']) if pd.notna(row['客戶簡稱']) else ''
                client.address = str(row['地址']) if pd.notna(row['地址']) else ''
                
                # 鋼瓶庫存
                client.cylinder_50kg = int(row['50KG']) if pd.notna(row['50KG']) else 0
                client.cylinder_20kg_business = int(row['營20']) if pd.notna(row['營20']) else 0
                client.cylinder_16kg_business = int(row['營16']) if pd.notna(row['營16']) else 0
                client.cylinder_20kg = int(row['20KG']) if pd.notna(row['20KG']) else 0
                client.cylinder_16kg = int(row['16KG']) if pd.notna(row['16KG']) else 0
                client.cylinder_10kg = int(row['10KG']) if pd.notna(row['10KG']) else 0
                client.cylinder_4kg = int(row['4KG']) if pd.notna(row['4KG']) else 0
                client.cylinder_16kg_goodluck = int(row['好運16']) if pd.notna(row['好運16']) else 0
                client.cylinder_10kg_safety = int(row['瓶安桶10']) if pd.notna(row['瓶安桶10']) else 0
                client.cylinder_happiness = int(row['幸福丸']) if pd.notna(row['幸福丸']) else 0
                client.cylinder_20kg_goodluck = int(row['好運20']) if pd.notna(row['好運20']) else 0
                
                # 流量計數器
                client.flow_50kg = int(row['流量50公斤']) if pd.notna(row['流量50公斤']) else 0
                client.flow_20kg = int(row['流量20公斤']) if pd.notna(row['流量20公斤']) else 0
                client.flow_16kg = int(row['流量16公斤']) if pd.notna(row['流量16公斤']) else 0
                client.flow_20kg_goodluck = int(row['流量好運20公斤']) if pd.notna(row['流量好運20公斤']) else 0
                client.flow_16kg_goodluck = int(row['流量好運16公斤']) if pd.notna(row['流量好運16公斤']) else 0
                
                # 商業資訊
                client.pricing_method = str(row['計價方式']) if pd.notna(row['計價方式']) else None
                
                # 處理結帳方式
                payment_str = str(row['結帳方式']) if pd.notna(row['結帳方式']) else ''
                if '現金' in payment_str:
                    client.payment_method = PaymentMethod.CASH
                elif '月結' in payment_str:
                    client.payment_method = PaymentMethod.MONTHLY
                elif '轉帳' in payment_str:
                    client.payment_method = PaymentMethod.TRANSFER
                else:
                    client.payment_method = PaymentMethod.CASH  # 預設現金
                
                client.payment_file = str(row['結帳用檔案']) if pd.notna(row['結帳用檔案']) else None
                client.subscription_member = self._parse_boolean(row.get('訂閱式會員'))
                
                # 配送設定
                client.needs_same_day_delivery = self._parse_boolean(row.get('需要當天配送'))
                
                # 營業時間設定
                client.hour_8_9 = self._parse_time_slot(row.get('8~9'))
                client.hour_9_10 = self._parse_time_slot(row.get('9~10'))
                client.hour_10_11 = self._parse_time_slot(row.get('10~11'))
                client.hour_11_12 = self._parse_time_slot(row.get('11~12'))
                client.hour_12_13 = self._parse_time_slot(row.get('12~13'))
                client.hour_13_14 = self._parse_time_slot(row.get('13~14'))
                client.hour_14_15 = self._parse_time_slot(row.get('14~15'))
                client.hour_15_16 = self._parse_time_slot(row.get('15~16'))
                client.hour_16_17 = self._parse_time_slot(row.get('16~17'))
                client.hour_17_18 = self._parse_time_slot(row.get('17~18'))
                client.hour_18_19 = self._parse_time_slot(row.get('18~19'))
                client.hour_19_20 = self._parse_time_slot(row.get('19~20'))
                
                client.time_slot = int(row['時段早1午2晚3全天0']) if pd.notna(row['時段早1午2晚3全天0']) else 0
                client.holiday = str(row['公休日']) if pd.notna(row['公休日']) else None
                
                # 使用資訊
                client.status = int(row['狀態']) if pd.notna(row['狀態']) else 1
                client.monthly_delivery_volume = float(row['月配送量']) if pd.notna(row['月配送量']) else 0
                client.gas_return_ratio = float(row['退氣比例']) if pd.notna(row['退氣比例']) else 0
                client.actual_purchase_kg = float(row['實際購買公斤數']) if pd.notna(row['實際購買公斤數']) else 0
                client.daily_usage_avg = float(row['平均日使用']) if pd.notna(row['平均日使用']) else 0
                
                # 設備資訊
                client.series_connection_count = int(row['串接數量']) if pd.notna(row['串接數量']) else 1
                client.reserve_amount = float(row['備用量']) if pd.notna(row['備用量']) else 0
                client.max_cycle_days = int(row['最大週期']) if pd.notna(row['最大週期']) else 30
                client.can_delay_days = int(row['可延後天數']) if pd.notna(row['可延後天數']) else 0
                client.needs_same_day = self._parse_boolean(row.get('是否需要當天去'))
                
                # 區域設定
                client.area = str(row['區域']) if pd.notna(row['區域']) else None
                
                # 車輛類型
                vehicle_type_val = row.get('1汽車/2機車/0全部')
                if pd.notna(vehicle_type_val):
                    if int(vehicle_type_val) == 1:
                        client.vehicle_type = VehicleType.CAR
                    elif int(vehicle_type_val) == 2:
                        client.vehicle_type = VehicleType.MOTORCYCLE
                    else:
                        client.vehicle_type = VehicleType.ALL
                else:
                    client.vehicle_type = VehicleType.ALL
                
                client.single_area_supply = self._parse_boolean(row.get('單一區域供應'), default=True)
                client.primary_usage_area = str(row['第一使用區域(串接)']) if pd.notna(row['第一使用區域(串接)']) else None
                client.secondary_usage_area = str(row['第二使用區域']) if pd.notna(row['第二使用區域']) else None
                
                # 設備清單
                client.switch_model = str(row['切替器型號']) if pd.notna(row['切替器型號']) else None
                client.has_flow_meter = self._parse_boolean(row.get('流量表'))
                client.has_switch = self._parse_boolean(row.get('切替器'))
                client.has_smart_scale = self._parse_boolean(row.get('智慧秤'))
                
                # 其他
                client.client_type = str(row['類型']) if pd.notna(row['類型']) else None
                client.is_terminated = self._parse_boolean(row.get('已解約'))
                
                if not existing_client:
                    self.session.add(client)
                    self.imported_clients += 1
                
            except Exception as e:
                logger.error(f"Error importing client {row.get('客戶', 'Unknown')}: {e}")
                continue
        
        self.session.commit()
        logger.info(f"Imported {self.imported_clients} new clients")
    
    def import_delivery_history(self, excel_file_path):
        """匯入配送歷史"""
        logger.info(f"Starting to import delivery history from {excel_file_path}")
        
        # 讀取配送歷史
        df = pd.read_excel(excel_file_path, sheet_name='Sheet1')
        
        # 按客戶分組處理
        grouped = df.groupby('客戶')
        
        for client_code, group in grouped:
            try:
                # 查找客戶
                client = self.session.query(Client).filter_by(
                    client_code=str(client_code)
                ).first()
                
                if not client:
                    logger.warning(f"Client {client_code} not found, skipping deliveries")
                    continue
                
                # 處理該客戶的配送記錄
                for index, row in group.iterrows():
                    try:
                        # 轉換民國日期
                        minguo_date = row['最後十次日期']
                        delivery_date = self.date_converter.minguo_to_western(minguo_date)
                        
                        if not delivery_date:
                            logger.warning(f"Invalid date {minguo_date} for client {client_code}")
                            continue
                        
                        # 檢查是否已存在該配送記錄
                        existing_delivery = self.session.query(Delivery).filter_by(
                            client_id=client.id,
                            scheduled_date=delivery_date.date()
                        ).first()
                        
                        if existing_delivery:
                            continue
                        
                        # 建立配送記錄
                        delivery = Delivery(
                            client_id=client.id,
                            scheduled_date=delivery_date.date(),
                            status=DeliveryStatus.COMPLETED,  # 歷史記錄都是已完成
                            actual_delivery_time=delivery_date,
                            notes="Imported from historical data"
                        )
                        
                        self.session.add(delivery)
                        self.imported_deliveries += 1
                        
                    except Exception as e:
                        logger.error(f"Error importing delivery for client {client_code}: {e}")
                        continue
                
            except Exception as e:
                logger.error(f"Error processing client {client_code}: {e}")
                continue
        
        self.session.commit()
        logger.info(f"Imported {self.imported_deliveries} delivery records")
    
    def _parse_boolean(self, value, default=False):
        """解析布林值"""
        if pd.isna(value):
            return default
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            return value.lower() in ['true', 'yes', '是', '1', 'y']
        return default
    
    def _parse_time_slot(self, value):
        """解析時段值 (1表示可配送)"""
        if pd.isna(value):
            return False
        try:
            return float(value) == 1
        except:
            return False
    
    def import_all_data(self, client_file_path, delivery_file_path):
        """匯入所有資料"""
        logger.info("Starting full data import...")
        
        # 匯入客戶資料
        self.import_client_data(client_file_path)
        
        # 匯入配送歷史
        self.import_delivery_history(delivery_file_path)
        
        logger.info(f"Data import completed. Imported {self.imported_clients} clients and {self.imported_deliveries} deliveries")


def main():
    """測試資料匯入"""
    logging.basicConfig(level=logging.INFO)
    
    # 初始化資料庫
    db_manager = DatabaseManager()
    db_manager.initialize()
    session = db_manager.get_session()
    
    # 建立匯入器
    importer = ExcelDataImporter(session)
    
    # 匯入資料
    project_root = Path(__file__).parent.parent.parent.parent
    client_file = project_root / "main" / "resources" / "assets" / "2025-05 client list.xlsx"
    delivery_file = project_root / "main" / "resources" / "assets" / "2025-05 deliver history.xlsx"
    
    try:
        importer.import_all_data(client_file, delivery_file)
        print("\n✅ Data import completed successfully!")
        
        # 顯示統計
        client_count = session.query(Client).count()
        delivery_count = session.query(Delivery).count()
        print(f"Total clients in database: {client_count}")
        print(f"Total deliveries in database: {delivery_count}")
        
    except Exception as e:
        logger.error(f"Import failed: {e}")
        session.rollback()
    finally:
        session.close()
        db_manager.close()


if __name__ == "__main__":
    main()