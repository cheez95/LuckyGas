import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from pathlib import Path
import logging

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from models.database_schema import Base

logger = logging.getLogger(__name__)


class DatabaseManager:
    """資料庫管理器"""
    
    def __init__(self, database_url=None):
        if database_url is None:
            # 預設使用 SQLite
            db_path = Path(__file__).parent.parent.parent.parent / "data" / "luckygas.db"
            db_path.parent.mkdir(parents=True, exist_ok=True)
            database_url = f"sqlite:///{db_path}"
            
        self.database_url = database_url
        self.engine = None
        self.SessionLocal = None
        
    def initialize(self):
        """初始化資料庫連接"""
        try:
            # 建立引擎
            if self.database_url.startswith("sqlite"):
                # SQLite 特殊設定
                self.engine = create_engine(
                    self.database_url,
                    connect_args={"check_same_thread": False},
                    poolclass=StaticPool,
                    echo=False  # 設為 True 可看到 SQL 語句
                )
            else:
                # PostgreSQL / MySQL
                self.engine = create_engine(
                    self.database_url,
                    pool_pre_ping=True,
                    echo=False
                )
            
            # 建立所有表格
            Base.metadata.create_all(bind=self.engine)
            
            # 建立 Session 工廠
            self.SessionLocal = sessionmaker(
                autocommit=False,
                autoflush=False,
                bind=self.engine
            )
            
            logger.info(f"Database initialized successfully: {self.database_url}")
            
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def get_session(self) -> Session:
        """取得資料庫 Session"""
        if self.SessionLocal is None:
            self.initialize()
        return self.SessionLocal()
    
    def close(self):
        """關閉資料庫連接"""
        if self.engine:
            self.engine.dispose()


# 全域資料庫管理器實例
db_manager = DatabaseManager()


def get_db():
    """FastAPI 依賴注入用的函數"""
    db = db_manager.get_session()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    # 測試資料庫連接
    logging.basicConfig(level=logging.INFO)
    
    db_manager.initialize()
    session = db_manager.get_session()
    
    print("Database tables created successfully!")
    print(f"Database location: {db_manager.database_url}")
    
    # 列出所有表格
    from sqlalchemy import inspect
    inspector = inspect(db_manager.engine)
    tables = inspector.get_table_names()
    print(f"\nCreated tables: {', '.join(tables)}")
    
    session.close()
    db_manager.close()