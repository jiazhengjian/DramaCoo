# -*- coding: utf-8 -*-
"""素材沉淀 + 项目元数据迁移 + 手动上传写入。

第二批核心：把分散的会话 JSON 与产物文件，沉淀为 SQLite 里可查询、可管理的
项目（projects）、素材（assets）、生成任务（generation_tasks）。
"""

import glob
import json
import os
import logging
import shutil
import uuid
from datetime import datetime

from core.db import SessionLocal
from core.models import Asset, GenerationTask, Project
from config import settings

logger = logging.getLogger(__name__)

# 图片扩展名（不含缩略图后缀 _thumb.webp）
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".bmp")
VIDEO_EXTS = (".mp4", ".mov", ".webm")


def _to_datetime(value):
    """把 epoch 秒数/毫秒数 或 ISO 字符串转成 datetime；失败返回 None。"""
    if value in (None, "", 0):
        return None
    try:
        if isinstance(value, (int, float)):
            if value > 1e12:  # 毫秒
                value = value / 1000.0
            return datetime.fromtimestamp(value)
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, OSError, OverflowError):
        pass
    return None


def _rel(path: str) -> str:
    from config import settings

    return os.path.relpath(path, settings.BASE_DIR)


# ─────────── 迁移 ───────────

def migrate_json_to_sqlite() -> None:
    """幂等迁移：会话 JSON → projects；产物文件 → assets；任务 JSON → generation_tasks。"""
    _migrate_projects()
    _migrate_tasks()
    _migrate_assets()
    _set_all_covers()


def _migrate_projects() -> None:
    from config import settings

    session_dir = settings.SESSION_DIR
    if not os.path.isdir(session_dir):
        return

    with SessionLocal() as db:
        for path in glob.glob(os.path.join(session_dir, "*.json")):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                continue
            _upsert_project(db, data)
        db.commit()


def sync_project(session_id: str) -> None:
    """新建/更新项目时实时同步单个项目到 SQLite。"""
    from config import settings

    session_file = os.path.join(settings.SESSION_DIR, f"{session_id}.json")
    if not os.path.exists(session_file):
        return
    try:
        with open(session_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return
    with SessionLocal() as db:
        _upsert_project(db, data)
        db.commit()


def _upsert_project(db, data: dict) -> None:
    sid = data.get("session_id")
    if not sid:
        return

    meta = data.get("meta") or {}
    script_art = (data.get("artifacts") or {}).get("script_generation", {}) or {}
    title = script_art.get("title") or meta.get("idea") or meta.get("user_textbox_input") or ""

    episodes = script_art.get("episodes", [])
    episode_count = len(episodes) if isinstance(episodes, list) else int(meta.get("episodes") or 0)

    status_map = data.get("status") or {}
    current_stage = data.get("current_stage") or "init"
    values = status_map.values() if isinstance(status_map, dict) else []
    if "running" in values:
        status = "running"
    elif "waiting" in values:
        status = "waiting"
    elif status_map.get("post_production") == "completed":
        status = "completed"
    else:
        status = "draft"

    existing = db.get(Project, sid)
    if existing:
        existing.title = title or existing.title
        existing.idea = meta.get("idea") or existing.idea
        existing.style = meta.get("style") or existing.style
        existing.video_ratio = meta.get("video_ratio") or existing.video_ratio
        existing.current_stage = current_stage
        existing.status = status
        existing.episode_count = episode_count
        existing.updated_at = _to_datetime(data.get("updated_at")) or datetime.now()
    else:
        db.add(Project(
            id=sid,
            title=title,
            idea=meta.get("idea") or "",
            style=meta.get("style") or "",
            video_ratio=meta.get("video_ratio") or "16:9",
            current_stage=current_stage,
            status=status,
            episode_count=episode_count,
            created_at=_to_datetime(data.get("created_at")) or datetime.now(),
            updated_at=_to_datetime(data.get("updated_at")) or datetime.now(),
        ))


def _migrate_tasks() -> None:
    from config import settings

    task_dir = settings.TASK_DIR
    if not os.path.isdir(task_dir):
        return

    with SessionLocal() as db:
        for path in glob.glob(os.path.join(task_dir, "*.json")):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                continue

            sid = data.get("tasks") and (os.path.splitext(os.path.basename(path))[0])
            if not sid:
                continue

            for t in data.get("tasks") or []:
                if not isinstance(t, dict) or not t.get("task_id"):
                    continue
                if db.get(GenerationTask, t["task_id"]):
                    continue
                db.add(GenerationTask(
                    task_id=t["task_id"],
                    project_id=t.get("session_id") or sid,
                    type=t.get("type") or "",
                    stage=t.get("stage") or "",
                    item_type=t.get("item_type") or "",
                    item_id=t.get("item_id") or "",
                    provider=t.get("provider") or "",
                    model=t.get("model") or "",
                    prompt=t.get("prompt") or "",
                    status=t.get("status") or "processing",
                    error=t.get("error"),
                    result_paths=t.get("result_paths") or [],
                    attempt=int(t.get("attempt") or 1),
                    created_at=_to_datetime(t.get("created_at")) or datetime.now(),
                    updated_at=_to_datetime(t.get("updated_at")) or datetime.now(),
                    completed_at=_to_datetime(t.get("completed_at")),
                ))
        db.commit()


def _migrate_assets() -> None:
    from config import settings

    image_base = os.path.join(settings.RESULT_DIR, "image")
    for sid in _session_ids():
        _scan_image_assets(sid, image_base)
    video_base = os.path.join(settings.RESULT_DIR, "video")
    for sid in _session_ids():
        _scan_video_assets(sid, video_base)


def _session_ids() -> list[str]:
    from config import settings

    ids: list[str] = []
    if os.path.isdir(settings.SESSION_DIR):
        for fn in os.listdir(settings.SESSION_DIR):
            if fn.endswith(".json"):
                ids.append(fn[:-5])
    # 补充产物目录里出现但会话 JSON 已删的
    for sub in ("image", "video"):
        base = os.path.join(settings.RESULT_DIR, sub)
        if os.path.isdir(base):
            for name in os.listdir(base):
                if name not in ids:
                    ids.append(name)
    return ids


# ─────────── 素材扫描 ───────────

def _scan_image_assets(sid: str, image_base: str) -> None:
    sid_dir = os.path.join(image_base, str(sid))
    if not os.path.isdir(sid_dir):
        return

    with SessionLocal() as db:
        for rel_dir, asset_type in (
            (os.path.join("Assets", "characters"), "character"),
            (os.path.join("Assets", "settings"), "setting"),
            ("Scenes", "scene"),
        ):
            d = os.path.join(sid_dir, rel_dir)
            if not os.path.isdir(d):
                continue
            for fn in sorted(os.listdir(d)):
                if fn.endswith("_thumb.webp"):
                    continue
                if not fn.lower().endswith(IMAGE_EXTS):
                    continue
                fp = os.path.join(d, fn)
                if not os.path.isfile(fp):
                    continue
                rel = _rel(fp)
                thumb_fp = os.path.splitext(fp)[0] + "_thumb.webp"
                thumb = _rel(thumb_fp) if os.path.exists(thumb_fp) else None
                _upsert_asset(db, sid, asset_type, fn, "image", rel, thumb, os.path.getsize(fp), "generated")
        db.commit()


def _scan_video_assets(sid: str, video_base: str) -> None:
    sid_dir = os.path.join(video_base, str(sid))
    if not os.path.isdir(sid_dir):
        return

    with SessionLocal() as db:
        # 片段（不含 output/ 与 _poster）
        for fn in sorted(os.listdir(sid_dir)):
            if fn.endswith("_poster.jpg"):
                continue
            if not fn.lower().endswith(VIDEO_EXTS):
                continue
            fp = os.path.join(sid_dir, fn)
            if not os.path.isfile(fp):
                continue
            rel = _rel(fp)
            poster_fp = os.path.splitext(fp)[0] + "_poster.jpg"
            thumb = _rel(poster_fp) if os.path.exists(poster_fp) else None
            _upsert_asset(db, sid, "video_clip", fn, "video", rel, thumb, os.path.getsize(fp), "generated")

        # 成片
        out_dir = os.path.join(sid_dir, "output")
        if os.path.isdir(out_dir):
            for fn in sorted(os.listdir(out_dir)):
                if not fn.lower().endswith(VIDEO_EXTS):
                    continue
                fp = os.path.join(out_dir, fn)
                if not os.path.isfile(fp):
                    continue
                rel = _rel(fp)
                _upsert_asset(db, sid, "final_video", fn, "video", rel, None, os.path.getsize(fp), "generated")
        db.commit()


def _upsert_asset(db, sid, asset_type, name, media_type, file_path, thumb_path, file_size, source) -> None:
    """按 (project_id, file_path) 幂等去重。"""
    from sqlalchemy import select

    existing = db.execute(
        select(Asset).where(Asset.project_id == sid, Asset.file_path == file_path)
    ).scalar_one_or_none()
    if existing:
        existing.asset_type = asset_type
        existing.thumb_path = thumb_path
        existing.file_size = file_size
        return
    db.add(Asset(
        project_id=sid,
        asset_type=asset_type,
        name=name,
        media_type=media_type,
        file_path=file_path,
        thumb_path=thumb_path,
        file_size=file_size,
        source=source,
    ))


# ─────────── 查询与写入 ───────────

def sync_project_assets(session_id: str) -> int:
    """扫描并同步指定项目的素材（用于项目完成/上传后即时刷新），返回素材数。"""
    from config import settings

    before = _count_assets(session_id)
    _scan_image_assets(str(session_id), os.path.join(settings.RESULT_DIR, "image"))
    _scan_video_assets(str(session_id), os.path.join(settings.RESULT_DIR, "video"))
    return _count_assets(session_id) - before


def _count_assets(session_id: str) -> int:
    from sqlalchemy import func, select

    with SessionLocal() as db:
        return db.execute(
            select(func.count()).select_from(Asset).where(Asset.project_id == str(session_id))
        ).scalar_one()


def list_project_assets(session_id: str, asset_type: str | None = None, media_type: str | None = None) -> list[dict]:
    from sqlalchemy import select

    with SessionLocal() as db:
        q = select(Asset).where(Asset.project_id == str(session_id))
        if asset_type:
            q = q.where(Asset.asset_type == asset_type)
        if media_type:
            q = q.where(Asset.media_type == media_type)
        rows = db.execute(q.order_by(Asset.created_at, Asset.id)).scalars().all()
        return [_asset_dict(a) for a in rows]


def _asset_dict(a: Asset) -> dict:
    return {
        "id": a.id,
        "project_id": a.project_id,
        "asset_type": a.asset_type,
        "name": a.name,
        "media_type": a.media_type,
        "file_path": a.file_path,
        "thumb_path": a.thumb_path,
        "file_size": a.file_size,
        "source": a.source,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def add_uploaded_asset(session_id: str, name: str, file_path: str, media_type: str, thumb_path: str | None = None, file_size: int = 0) -> dict:
    with SessionLocal() as db:
        asset = Asset(
            project_id=str(session_id),
            asset_type="upload",
            name=name,
            media_type=media_type,
            file_path=file_path,
            thumb_path=thumb_path,
            file_size=file_size,
            source="uploaded",
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return _asset_dict(asset)


def delete_asset(asset_id: int, session_id: str) -> bool:
    from config import settings

    with SessionLocal() as db:
        asset = db.get(Asset, asset_id)
        if not asset or asset.project_id != str(session_id):
            return False
        # 清理文件（仅手动上传的素材物理删除；生成的素材只删索引）
        if asset.source == "uploaded" and asset.file_path:
            fp = os.path.join(settings.BASE_DIR, asset.file_path) if not os.path.isabs(asset.file_path) else asset.file_path
            try:
                if os.path.exists(fp):
                    os.remove(fp)
            except OSError:
                pass
            if asset.thumb_path:
                tp = os.path.join(settings.BASE_DIR, asset.thumb_path) if not os.path.isabs(asset.thumb_path) else asset.thumb_path
                try:
                    if os.path.exists(tp):
                        os.remove(tp)
                except OSError:
                    pass
        db.delete(asset)
        db.commit()
        return True


def list_projects(search: str | None = None, archived: bool | None = None) -> list[dict]:
    from sqlalchemy import select

    with SessionLocal() as db:
        q = select(Project)
        if search:
            like = f"%{search}%"
            q = q.where(Project.title.like(like) | Project.idea.like(like))
        if archived is not None:
            q = q.where(Project.archived == archived)
        rows = db.execute(q.order_by(Project.updated_at.desc())).scalars().all()
        return [_project_dict(p) for p in rows]


def _project_dict(p: Project) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "idea": p.idea,
        "style": p.style,
        "video_ratio": p.video_ratio,
        "current_stage": p.current_stage,
        "status": p.status,
        "cover_image": p.cover_image,
        "episode_count": p.episode_count,
        "archived": p.archived,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def set_project_archived(session_id: str, archived: bool) -> bool:
    with SessionLocal() as db:
        p = db.get(Project, str(session_id))
        if not p:
            return False
        p.archived = archived
        p.updated_at = datetime.now()
        db.commit()
        return True


def delete_project(session_id: str) -> None:
    """从 SQLite 删除项目及其素材、任务记录（文件清理由 orchestrator 负责）。"""
    from sqlalchemy import delete

    with SessionLocal() as db:
        db.execute(delete(Asset).where(Asset.project_id == str(session_id)))
        db.execute(delete(GenerationTask).where(GenerationTask.project_id == str(session_id)))
        db.execute(delete(Project).where(Project.id == str(session_id)))
        db.commit()


# ─────────── 全局素材库（与项目解耦，手动收藏/上传） ───────────


def list_library(asset_type: str | None = None, media_type: str | None = None) -> list[dict]:
    """全局素材库列表（project_id 为 NULL 的素材）。"""
    from sqlalchemy import select

    with SessionLocal() as db:
        q = select(Asset).where(Asset.project_id.is_(None))
        if asset_type:
            q = q.where(Asset.asset_type == asset_type)
        if media_type:
            q = q.where(Asset.media_type == media_type)
        rows = db.execute(q.order_by(Asset.created_at.desc(), Asset.id.desc())).scalars().all()
        return [_asset_dict(a) for a in rows]


def _add_library_asset(name: str, file_path: str, media_type: str, asset_type: str, thumb_path: str | None, file_size: int, source: str) -> dict:
    with SessionLocal() as db:
        asset = Asset(
            project_id=None,
            asset_type=asset_type,
            name=name,
            media_type=media_type,
            file_path=file_path,
            thumb_path=thumb_path,
            file_size=file_size,
            source=source,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return _asset_dict(asset)


def collect_to_library(source_path: str, asset_type: str, name: str, media_type: str = "image") -> dict:
    """把项目里的好素材复制到全局素材库（手动收藏）。"""
    src = os.path.join(settings.BASE_DIR, source_path) if not os.path.isabs(source_path) else source_path
    if not os.path.exists(src):
        raise ValueError("源文件不存在")

    lib_dir = os.path.join(settings.RESULT_DIR, "library")
    os.makedirs(lib_dir, exist_ok=True)
    ext = os.path.splitext(src)[1] or (".png" if media_type == "image" else ".mp4")
    dst = os.path.join(lib_dir, f"{uuid.uuid4().hex}{ext}")
    shutil.copy2(src, dst)

    thumb = None
    if media_type == "image":
        from core.thumbnail import make_image_thumb

        t = make_image_thumb(dst)
        if t:
            thumb = os.path.relpath(t, settings.BASE_DIR)
    rel = os.path.relpath(dst, settings.BASE_DIR)
    return _add_library_asset(name, rel, media_type, asset_type, thumb, os.path.getsize(dst), "collected")


def save_uploaded_to_library(name: str, abs_path: str, media_type: str, thumb_path: str | None, file_size: int) -> dict:
    """上传的文件已保存到 library 目录后，登记到全局素材库。"""
    rel = os.path.relpath(abs_path, settings.BASE_DIR)
    return _add_library_asset(name, rel, media_type, "upload", thumb_path, file_size, "uploaded")


def delete_library_asset(asset_id: int) -> bool:
    """删除全局素材库素材（同时清理文件）。"""
    with SessionLocal() as db:
        asset = db.get(Asset, asset_id)
        if not asset or asset.project_id is not None:
            return False
        if asset.file_path:
            fp = os.path.join(settings.BASE_DIR, asset.file_path) if not os.path.isabs(asset.file_path) else asset.file_path
            try:
                if os.path.exists(fp):
                    os.remove(fp)
            except OSError:
                pass
        if asset.thumb_path:
            tp = os.path.join(settings.BASE_DIR, asset.thumb_path) if not os.path.isabs(asset.thumb_path) else asset.thumb_path
            try:
                if os.path.exists(tp):
                    os.remove(tp)
            except OSError:
                pass
        db.delete(asset)
        db.commit()
        return True


def get_library_asset(asset_id: int) -> dict | None:
    """获取全局素材库单条素材（用于复制到项目产物）。"""
    with SessionLocal() as db:
        asset = db.get(Asset, asset_id)
        if not asset or asset.project_id is not None:
            return None
        return _asset_dict(asset)


def set_project_cover(session_id: str) -> str:
    """自动给项目挑一张封面（角色图优先，其次参考图）。"""
    from sqlalchemy import select

    with SessionLocal() as db:
        p = db.get(Project, str(session_id))
        if not p:
            return ""
        asset = db.execute(
            select(Asset)
            .where(Asset.project_id == str(session_id), Asset.media_type == "image")
            .order_by(Asset.id)
        ).scalars().first()
        cover = (asset.thumb_path or asset.file_path) if asset else None
        p.cover_image = cover
        p.updated_at = datetime.now()
        db.commit()
        return cover or ""


def _set_all_covers() -> None:
    """为没有封面的项目自动补封面。"""
    from sqlalchemy import select

    with SessionLocal() as db:
        for p in db.execute(select(Project).where(Project.cover_image.is_(None))).scalars().all():
            asset = db.execute(
                select(Asset)
                .where(Asset.project_id == p.id, Asset.media_type == "image")
                .order_by(Asset.id)
            ).scalars().first()
            if asset:
                p.cover_image = asset.thumb_path or asset.file_path
        db.commit()
