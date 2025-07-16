import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from datetime import datetime, timedelta, date
from typing import List, Dict, Optional, Tuple
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
import logging

from models.database_schema import Client, Delivery, DeliveryPrediction, DeliveryStatus

logger = logging.getLogger(__name__)


class GasPredictionService:
    """瓦斯用量預測服務"""
    
    def __init__(self, session: Session):
        self.session = session
        
    def calculate_daily_usage(self, client_id: int, days: int = 90) -> float:
        """
        計算客戶的平均日用量
        
        Args:
            client_id: 客戶ID
            days: 計算天數（預設90天）
            
        Returns:
            float: 平均日用量（公斤）
        """
        # 取得最近的配送記錄
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days)
        
        deliveries = self.session.query(Delivery).filter(
            and_(
                Delivery.client_id == client_id,
                Delivery.scheduled_date >= start_date,
                Delivery.scheduled_date <= end_date,
                Delivery.status == DeliveryStatus.COMPLETED
            )
        ).order_by(Delivery.scheduled_date).all()
        
        if len(deliveries) < 2:
            # 如果配送記錄不足，使用客戶資料中的平均日使用量
            client = self.session.query(Client).get(client_id)
            return client.daily_usage_avg if client else 0.0
        
        # 計算每次配送間隔的用量
        usage_rates = []
        for i in range(1, len(deliveries)):
            prev_delivery = deliveries[i-1]
            curr_delivery = deliveries[i]
            
            # 計算天數間隔
            days_between = (curr_delivery.scheduled_date - prev_delivery.scheduled_date).days
            if days_between <= 0:
                continue
                
            # 計算總配送量（公斤）
            total_kg = (
                curr_delivery.delivered_50kg * 50 +
                curr_delivery.delivered_20kg * 20 +
                curr_delivery.delivered_16kg * 16 +
                curr_delivery.delivered_10kg * 10 +
                curr_delivery.delivered_4kg * 4
            )
            
            if total_kg > 0:
                daily_usage = total_kg / days_between
                usage_rates.append(daily_usage)
        
        if not usage_rates:
            client = self.session.query(Client).get(client_id)
            return client.daily_usage_avg if client else 0.0
            
        # 使用加權平均（最近的資料權重較高）
        weights = np.linspace(0.5, 1.0, len(usage_rates))
        weighted_avg = np.average(usage_rates, weights=weights)
        
        return float(weighted_avg)
    
    def get_seasonal_factor(self, prediction_date: date) -> float:
        """
        取得季節性因子
        冬天用量較高，夏天用量較低
        
        Args:
            prediction_date: 預測日期
            
        Returns:
            float: 季節性因子（0.8-1.2）
        """
        month = prediction_date.month
        
        # 台灣的季節性因子
        seasonal_factors = {
            1: 1.2,   # 一月（冬天）
            2: 1.15,  # 二月
            3: 1.05,  # 三月
            4: 0.95,  # 四月
            5: 0.85,  # 五月
            6: 0.8,   # 六月（夏天）
            7: 0.8,   # 七月
            8: 0.8,   # 八月
            9: 0.85,  # 九月
            10: 0.95, # 十月
            11: 1.05, # 十一月
            12: 1.15  # 十二月
        }
        
        return seasonal_factors.get(month, 1.0)
    
    def get_client_current_inventory(self, client_id: int) -> float:
        """
        估算客戶當前的瓦斯存量
        
        Args:
            client_id: 客戶ID
            
        Returns:
            float: 預估存量（公斤）
        """
        # 取得最後一次配送
        last_delivery = self.session.query(Delivery).filter(
            and_(
                Delivery.client_id == client_id,
                Delivery.status == DeliveryStatus.COMPLETED
            )
        ).order_by(desc(Delivery.scheduled_date)).first()
        
        if not last_delivery:
            return 0.0
        
        # 計算最後配送的總量
        last_delivery_kg = (
            last_delivery.delivered_50kg * 50 +
            last_delivery.delivered_20kg * 20 +
            last_delivery.delivered_16kg * 16 +
            last_delivery.delivered_10kg * 10 +
            last_delivery.delivered_4kg * 4
        )
        
        # 計算已使用天數
        days_since_delivery = (datetime.now().date() - last_delivery.scheduled_date).days
        
        # 取得日用量
        daily_usage = self.calculate_daily_usage(client_id)
        
        # 考慮季節性因子
        seasonal_factor = self.get_seasonal_factor(datetime.now().date())
        adjusted_daily_usage = daily_usage * seasonal_factor
        
        # 計算剩餘量
        used_amount = days_since_delivery * adjusted_daily_usage
        remaining = max(0, last_delivery_kg - used_amount)
        
        # 考慮客戶的備用量
        client = self.session.query(Client).get(client_id)
        if client:
            remaining += client.reserve_amount
        
        return float(remaining)
    
    def predict_depletion_date(self, client_id: int) -> Tuple[date, float]:
        """
        預測客戶瓦斯耗盡日期
        
        Args:
            client_id: 客戶ID
            
        Returns:
            Tuple[date, float]: (預測耗盡日期, 信心分數)
        """
        # 取得當前存量
        current_inventory = self.get_client_current_inventory(client_id)
        
        # 取得日用量
        daily_usage = self.calculate_daily_usage(client_id)
        
        if daily_usage <= 0:
            # 無法預測
            return (datetime.now().date() + timedelta(days=30), 0.0)
        
        # 計算基本耗盡天數
        days_until_depletion = current_inventory / daily_usage
        
        # 考慮未來的季節性變化
        depletion_date = datetime.now().date()
        remaining_inventory = current_inventory
        
        while remaining_inventory > 0:
            seasonal_factor = self.get_seasonal_factor(depletion_date)
            adjusted_usage = daily_usage * seasonal_factor
            remaining_inventory -= adjusted_usage
            depletion_date += timedelta(days=1)
        
        # 計算信心分數（基於歷史資料的穩定性）
        confidence_score = self._calculate_confidence_score(client_id)
        
        return (depletion_date, confidence_score)
    
    def _calculate_confidence_score(self, client_id: int) -> float:
        """
        計算預測的信心分數
        基於歷史資料的穩定性和數量
        
        Args:
            client_id: 客戶ID
            
        Returns:
            float: 信心分數（0-1）
        """
        # 取得最近6個月的配送記錄
        deliveries = self.session.query(Delivery).filter(
            and_(
                Delivery.client_id == client_id,
                Delivery.scheduled_date >= datetime.now().date() - timedelta(days=180),
                Delivery.status == DeliveryStatus.COMPLETED
            )
        ).all()
        
        if len(deliveries) < 3:
            return 0.3  # 資料太少，信心度低
        
        # 計算配送間隔的標準差
        intervals = []
        for i in range(1, len(deliveries)):
            interval = (deliveries[i].scheduled_date - deliveries[i-1].scheduled_date).days
            intervals.append(interval)
        
        if not intervals:
            return 0.3
        
        # 標準差越小，預測越準確
        std_dev = np.std(intervals)
        mean_interval = np.mean(intervals)
        
        if mean_interval == 0:
            return 0.3
        
        # 變異係數（CV）
        cv = std_dev / mean_interval
        
        # 將CV轉換為信心分數
        # CV越小，信心度越高
        if cv < 0.1:
            confidence = 0.95
        elif cv < 0.2:
            confidence = 0.85
        elif cv < 0.3:
            confidence = 0.75
        elif cv < 0.5:
            confidence = 0.60
        else:
            confidence = 0.40
        
        # 根據資料量調整
        data_factor = min(1.0, len(deliveries) / 10.0)
        confidence *= data_factor
        
        return float(confidence)
    
    def generate_delivery_predictions(self, days_ahead: int = 14) -> List[DeliveryPrediction]:
        """
        為所有客戶生成配送預測
        
        Args:
            days_ahead: 預測未來幾天內需要配送的客戶
            
        Returns:
            List[DeliveryPrediction]: 預測列表
        """
        predictions = []
        
        # 取得所有活躍客戶
        active_clients = self.session.query(Client).filter(
            and_(
                Client.is_terminated == False,
                Client.status == 1
            )
        ).all()
        
        prediction_date = datetime.now().date()
        target_date = prediction_date + timedelta(days=days_ahead)
        
        for client in active_clients:
            try:
                # 預測耗盡日期
                depletion_date, confidence = self.predict_depletion_date(client.id)
                
                # 如果預測在目標期間內需要配送
                if depletion_date <= target_date:
                    # 建議在耗盡前2-3天配送
                    safety_days = 2 if client.needs_same_day_delivery else 3
                    recommended_date = depletion_date - timedelta(days=safety_days)
                    
                    # 確保不會建議過去的日期
                    if recommended_date < prediction_date:
                        recommended_date = prediction_date
                    
                    # 檢查是否已有預測
                    existing = self.session.query(DeliveryPrediction).filter(
                        and_(
                            DeliveryPrediction.client_id == client.id,
                            DeliveryPrediction.prediction_date == prediction_date
                        )
                    ).first()
                    
                    if existing:
                        # 更新現有預測
                        existing.predicted_depletion_date = depletion_date
                        existing.recommended_delivery_date = recommended_date
                        existing.average_daily_usage = self.calculate_daily_usage(client.id)
                        existing.current_inventory = self.get_client_current_inventory(client.id)
                        existing.confidence_score = confidence
                        prediction = existing
                    else:
                        # 建立新預測
                        prediction = DeliveryPrediction(
                            client_id=client.id,
                            prediction_date=prediction_date,
                            predicted_depletion_date=depletion_date,
                            recommended_delivery_date=recommended_date,
                            average_daily_usage=self.calculate_daily_usage(client.id),
                            current_inventory=self.get_client_current_inventory(client.id),
                            confidence_score=confidence,
                            prediction_method="weighted_average_seasonal"
                        )
                        self.session.add(prediction)
                    
                    predictions.append(prediction)
                    
            except Exception as e:
                logger.error(f"Error predicting for client {client.id}: {e}")
                continue
        
        self.session.commit()
        logger.info(f"Generated {len(predictions)} delivery predictions")
        
        return predictions
    
    def get_priority_deliveries(self, date: date) -> List[Dict]:
        """
        取得指定日期的優先配送清單
        
        Args:
            date: 查詢日期
            
        Returns:
            List[Dict]: 優先配送清單
        """
        # 取得該日期的預測
        predictions = self.session.query(DeliveryPrediction).join(Client).filter(
            and_(
                DeliveryPrediction.recommended_delivery_date == date,
                DeliveryPrediction.is_scheduled == False
            )
        ).order_by(
            desc(DeliveryPrediction.confidence_score),
            DeliveryPrediction.predicted_depletion_date
        ).all()
        
        priority_list = []
        for pred in predictions:
            client = pred.client
            
            # 計算優先分數
            days_until_depletion = (pred.predicted_depletion_date - date).days
            priority_score = (
                pred.confidence_score * 0.4 +  # 信心度權重
                (1.0 / max(days_until_depletion, 1)) * 0.6  # 緊急程度權重
            )
            
            priority_list.append({
                'client_id': client.id,
                'client_code': client.client_code,
                'client_name': client.short_name or client.invoice_title,
                'address': client.address,
                'area': client.area,
                'predicted_depletion': pred.predicted_depletion_date,
                'days_until_depletion': days_until_depletion,
                'current_inventory': pred.current_inventory,
                'daily_usage': pred.average_daily_usage,
                'confidence_score': pred.confidence_score,
                'priority_score': priority_score,
                'needs_same_day': client.needs_same_day_delivery,
                'vehicle_type': client.vehicle_type.value
            })
        
        # 按優先分數排序
        priority_list.sort(key=lambda x: x['priority_score'], reverse=True)
        
        return priority_list


# 測試程式
if __name__ == "__main__":
    from core.database import DatabaseManager
    
    logging.basicConfig(level=logging.INFO)
    
    db_manager = DatabaseManager()
    db_manager.initialize()
    session = db_manager.get_session()
    
    service = GasPredictionService(session)
    
    # 測試計算日用量
    client_id = 1400103  # 測試客戶
    daily_usage = service.calculate_daily_usage(client_id)
    print(f"Client {client_id} daily usage: {daily_usage:.2f} kg")
    
    # 測試預測耗盡日期
    depletion_date, confidence = service.predict_depletion_date(client_id)
    print(f"Predicted depletion date: {depletion_date}, confidence: {confidence:.2f}")
    
    # 生成預測
    predictions = service.generate_delivery_predictions(days_ahead=7)
    print(f"Generated {len(predictions)} predictions for next 7 days")
    
    # 取得明天的優先配送清單
    tomorrow = datetime.now().date() + timedelta(days=1)
    priority_list = service.get_priority_deliveries(tomorrow)
    print(f"\nPriority deliveries for {tomorrow}:")
    for item in priority_list[:10]:  # 顯示前10筆
        print(f"- {item['client_name']} ({item['area']}): {item['days_until_depletion']} days left, priority: {item['priority_score']:.2f}")
    
    session.close()
    db_manager.close()