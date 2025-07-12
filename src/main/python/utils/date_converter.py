from datetime import datetime, date
import re


class TaiwanDateConverter:
    """台灣民國年份轉換工具"""
    
    @staticmethod
    def minguo_to_western(minguo_date):
        """
        將民國日期轉換為西元日期
        
        支援格式:
        - 1140523 (民國114年5月23日)
        - 114/05/23
        - 114-05-23
        - 114年5月23日
        
        Returns:
            datetime object or None if invalid
        """
        if minguo_date is None or minguo_date == '':
            return None
            
        # 如果已經是 datetime 物件，直接返回
        if isinstance(minguo_date, (datetime, date)):
            return minguo_date
            
        # 轉換為字串
        minguo_str = str(minguo_date).strip()
        
        # 處理純數字格式 (e.g., 1140523)
        if minguo_str.isdigit():
            if len(minguo_str) == 7:
                year = int(minguo_str[:3]) + 1911
                month = int(minguo_str[3:5])
                day = int(minguo_str[5:7])
            elif len(minguo_str) == 6:
                # 假設是 2 位數年份
                year = int(minguo_str[:2]) + 1911
                month = int(minguo_str[2:4])
                day = int(minguo_str[4:6])
            else:
                return None
                
            try:
                return datetime(year, month, day)
            except ValueError:
                return None
        
        # 處理其他格式
        # 移除中文字符
        minguo_str = minguo_str.replace('年', '/').replace('月', '/').replace('日', '')
        
        # 嘗試不同的分隔符
        for separator in ['/', '-', '.']:
            if separator in minguo_str:
                parts = minguo_str.split(separator)
                if len(parts) == 3:
                    try:
                        year = int(parts[0]) + 1911
                        month = int(parts[1])
                        day = int(parts[2])
                        return datetime(year, month, day)
                    except (ValueError, IndexError):
                        continue
        
        return None
    
    @staticmethod
    def western_to_minguo(western_date, format_type='slash'):
        """
        將西元日期轉換為民國日期
        
        Args:
            western_date: datetime object
            format_type: 'slash' (114/05/23), 'dash' (114-05-23), 
                        'chinese' (114年5月23日), 'number' (1140523)
        
        Returns:
            str: 民國格式日期
        """
        if not isinstance(western_date, (datetime, date)):
            return None
            
        minguo_year = western_date.year - 1911
        
        if format_type == 'slash':
            return f"{minguo_year:03d}/{western_date.month:02d}/{western_date.day:02d}"
        elif format_type == 'dash':
            return f"{minguo_year:03d}-{western_date.month:02d}-{western_date.day:02d}"
        elif format_type == 'chinese':
            return f"{minguo_year}年{western_date.month}月{western_date.day}日"
        elif format_type == 'number':
            return f"{minguo_year:03d}{western_date.month:02d}{western_date.day:02d}"
        else:
            return f"{minguo_year:03d}/{western_date.month:02d}/{western_date.day:02d}"
    
    @staticmethod
    def get_minguo_year():
        """取得當前民國年"""
        return datetime.now().year - 1911
    
    @staticmethod
    def parse_minguo_datetime(minguo_str):
        """
        解析包含日期時間的民國格式字串
        例如: "114/05/23 14:30"
        """
        if not minguo_str:
            return None
            
        # 分離日期和時間
        parts = str(minguo_str).strip().split(' ')
        if len(parts) == 1:
            # 只有日期
            return TaiwanDateConverter.minguo_to_western(parts[0])
        elif len(parts) == 2:
            # 有日期和時間
            date_part = parts[0]
            time_part = parts[1]
            
            base_date = TaiwanDateConverter.minguo_to_western(date_part)
            if base_date and ':' in time_part:
                time_parts = time_part.split(':')
                try:
                    hour = int(time_parts[0])
                    minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                    second = int(time_parts[2]) if len(time_parts) > 2 else 0
                    return base_date.replace(hour=hour, minute=minute, second=second)
                except ValueError:
                    return base_date
            
            return base_date
        
        return None


# 測試程式碼
if __name__ == "__main__":
    converter = TaiwanDateConverter()
    
    # 測試不同格式
    test_dates = [
        "1140523",
        "114/05/23",
        "114-05-23",
        "114年5月23日",
        "1100102",
        "110/01/02"
    ]
    
    print("民國轉西元測試:")
    for test_date in test_dates:
        result = converter.minguo_to_western(test_date)
        print(f"{test_date} -> {result}")
    
    print("\n西元轉民國測試:")
    today = datetime.now()
    print(f"Today: {today}")
    print(f"Slash format: {converter.western_to_minguo(today, 'slash')}")
    print(f"Dash format: {converter.western_to_minguo(today, 'dash')}")
    print(f"Chinese format: {converter.western_to_minguo(today, 'chinese')}")
    print(f"Number format: {converter.western_to_minguo(today, 'number')}")
    
    print(f"\n當前民國年: {converter.get_minguo_year()}")