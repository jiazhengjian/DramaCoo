# -*- coding: utf-8 -*-
"""SQLAlchemy ORM 模型：projects / assets / generation_tasks"""

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # = session_id
    title: Mapped[str] = mapped_column(String, default="")
    idea: Mapped[str] = mapped_column(Text, default="")
    style: Mapped[str] = mapped_column(String, default="")
    video_ratio: Mapped[str] = mapped_column(String, default="16:9")
    current_stage: Mapped[str] = mapped_column(String, default="init")
    status: Mapped[str] = mapped_column(String, default="draft")
    cover_image: Mapped[str | None] = mapped_column(String, nullable=True)
    episode_count: Mapped[int] = mapped_column(Integer, default=0)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)  # None = 全局素材库
    asset_type: Mapped[str] = mapped_column(String, default="upload")
    item_id: Mapped[str | None] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String, default="")
    media_type: Mapped[str] = mapped_column(String, default="image")
    file_path: Mapped[str] = mapped_column(String, default="")
    thumb_path: Mapped[str | None] = mapped_column(String, nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String, default="generated")  # generated / collected / uploaded
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class GenerationTask(Base):
    __tablename__ = "generation_tasks"

    task_id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, index=True)
    type: Mapped[str] = mapped_column(String, default="")
    stage: Mapped[str] = mapped_column(String, default="")
    item_type: Mapped[str] = mapped_column(String, default="")
    item_id: Mapped[str] = mapped_column(String, default="")
    provider: Mapped[str] = mapped_column(String, default="")
    model: Mapped[str] = mapped_column(String, default="")
    prompt: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String, default="processing")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_paths: Mapped[list] = mapped_column(JSON, default=list)
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
