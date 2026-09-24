from fastapi import APIRouter, HTTPException, Query, Request

from api.dependencies import workflow_engine
from core import asset_store

router = APIRouter(tags=["Sessions"])


@router.get("/api/sessions")
async def list_sessions(search: str | None = Query(None), archived: bool | None = Query(None)):
    """项目库列表：从 SQLite 读项目元数据（含封面/状态/时间），支持搜索与归档过滤。"""
    projects = asset_store.list_projects(search=search, archived=archived)
    return {"projects": projects, "sessions": projects}  # 保留 sessions 兼容旧前端


@router.patch("/api/sessions/{session_id}/archive")
async def archive_session(session_id: str, request: Request):
    body = {}
    try:
        body = await request.json() or {}
    except Exception:
        body = {}
    archived = bool(body.get("archived", False))
    if not asset_store.set_project_archived(session_id, archived):
        raise HTTPException(404, "Project not found")
    return {"status": "ok", "id": session_id, "archived": archived}


@router.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """删除项目（会话 JSON + 结果文件 + SQLite 元数据）。"""
    deleted = workflow_engine.delete_session(session_id)
    asset_store.delete_project(session_id)
    if not deleted:
        # 会话文件可能已不存在，但 SQLite 里可能还有元数据
        raise HTTPException(404, "Session not found")
    return {"status": "deleted", "session_id": session_id}


@router.delete("/api/sessions")
async def cleanup_orphan_files():
    """清理孤立的结果文件（无密码控制）。"""
    return workflow_engine.cleanup_orphan_results()
