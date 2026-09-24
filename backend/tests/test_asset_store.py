# -*- coding: utf-8 -*-
"""第二批：SQLite 数据层 + 素材沉淀的 mock 测试。"""

import json
import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import core.asset_store as store_mod
from config import settings


@pytest.fixture
def store_env(tmp_path, monkeypatch):
    """临时数据库 + 临时数据目录。"""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.sqlite3'}", connect_args={"check_same_thread": False}
    )
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(store_mod, "SessionLocal", Session)

    from core.models import Base

    Base.metadata.create_all(engine)

    monkeypatch.setattr(settings, "SESSION_DIR", str(tmp_path / "sessions"))
    monkeypatch.setattr(settings, "TASK_DIR", str(tmp_path / "tasks"))
    monkeypatch.setattr(settings, "RESULT_DIR", str(tmp_path / "result"))
    monkeypatch.setattr(settings, "BASE_DIR", str(tmp_path))
    for d in (settings.SESSION_DIR, settings.TASK_DIR, settings.RESULT_DIR):
        os.makedirs(d, exist_ok=True)
    return tmp_path


def _make_session(tmp_path, sid, title="测试短剧", idea="测试创意"):
    session_file = os.path.join(tmp_path, "sessions", f"{sid}.json")
    data = {
        "session_id": sid,
        "created_at": 1700000000,
        "updated_at": 1700000100,
        "current_stage": "video_generation",
        "status": {"script_generation": "completed", "video_generation": "waiting"},
        "meta": {"idea": idea, "style": "realistic", "video_ratio": "16:9", "episodes": 2},
        "artifacts": {"script_generation": {"title": title, "episodes": [{}, {}]}},
    }
    with open(session_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def test_migrate_projects_and_assets(store_env):
    tmp_path = store_env
    sid = "test_session_1"
    _make_session(tmp_path, sid)

    img_dir = os.path.join(tmp_path, "result", "image", sid, "Assets", "characters")
    os.makedirs(img_dir, exist_ok=True)
    open(os.path.join(img_dir, "char_1.png"), "wb").write(b"fake")
    open(os.path.join(img_dir, "char_1_thumb.webp"), "wb").write(b"fake")

    store_mod.migrate_json_to_sqlite()

    projects = store_mod.list_projects()
    assert len(projects) == 1
    assert projects[0]["title"] == "测试短剧"
    assert projects[0]["cover_image"] is not None

    assets = store_mod.list_project_assets(sid)
    assert len(assets) == 1
    assert assets[0]["asset_type"] == "character"
    assert assets[0]["thumb_path"] is not None


def test_migrate_idempotent(store_env):
    tmp_path = store_env
    sid = "test_session_1"
    _make_session(tmp_path, sid)
    img_dir = os.path.join(tmp_path, "result", "image", sid, "Scenes")
    os.makedirs(img_dir, exist_ok=True)
    open(os.path.join(img_dir, "seg_01_01.jpg"), "wb").write(b"fake")

    store_mod.migrate_json_to_sqlite()
    store_mod.migrate_json_to_sqlite()  # 重复迁移

    assert len(store_mod.list_projects()) == 1
    assert len(store_mod.list_project_assets(sid)) == 1


def test_search_and_archive(store_env):
    tmp_path = store_env
    _make_session(tmp_path, "s1", title="反猎局", idea="刑侦")
    _make_session(tmp_path, "s2", title="凡人修仙", idea="修仙")
    store_mod.migrate_json_to_sqlite()

    assert len(store_mod.list_projects(search="修仙")) == 1
    assert len(store_mod.list_projects(search="不存在关键词")) == 0

    store_mod.set_project_archived("s1", True)
    assert len(store_mod.list_projects(archived=True)) == 1
    assert len(store_mod.list_projects(archived=False)) == 1


def test_upload_and_delete_asset(store_env):
    tmp_path = store_env
    sid = "s1"
    _make_session(tmp_path, sid)
    store_mod.migrate_json_to_sqlite()

    asset = store_mod.add_uploaded_asset(
        sid, "自定义图.png", "result/upload/s1/xx.png", "image", thumb_path=None, file_size=123
    )
    assert asset["asset_type"] == "upload"
    assert asset["source"] == "uploaded"

    assert len(store_mod.list_project_assets(sid)) == 1
    assert store_mod.delete_asset(asset["id"], sid) is True
    assert len(store_mod.list_project_assets(sid)) == 0


def test_delete_project(store_env):
    tmp_path = store_env
    sid = "s1"
    _make_session(tmp_path, sid)
    store_mod.migrate_json_to_sqlite()
    store_mod.add_uploaded_asset(sid, "a.png", "result/upload/s1/a.png", "image")

    store_mod.delete_project(sid)
    assert len(store_mod.list_projects()) == 0
    assert len(store_mod.list_project_assets(sid)) == 0
