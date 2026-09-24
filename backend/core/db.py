# -*- coding: utf-8 -*-
"""SQLite 数据层入口：engine + SessionLocal + 幂等建表 + 迁移"""

import os
import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config import settings

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(settings.CODE_DIR, "data", "dramacoo.sqlite3")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
    echo=False,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    """幂等建表（CREATE TABLE IF NOT EXISTS）+ WAL + 执行 JSON→SQLite 迁移。"""
    from core.models import Base  # 导入即注册所有表

    Base.metadata.create_all(engine)
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA journal_mode=WAL")
        conn.commit()

    from core.asset_store import migrate_json_to_sqlite

    migrate_json_to_sqlite()
    logger.info("SQLite 数据层初始化完成: %s", DB_PATH)
