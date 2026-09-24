import os
import uuid

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile

from api.dependencies import workflow_engine
from core import asset_store
from config import settings

router = APIRouter(tags=["Assets"])

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
VIDEO_EXTS = {".mp4", ".mov", ".webm"}
MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_VIDEO_BYTES = 500 * 1024 * 1024
UPLOAD_CHUNK = 1024 * 1024

# 全局素材库存放目录
LIBRARY_DIR = os.path.join(settings.RESULT_DIR, "library")


def _safe_name(filename: str) -> str:
    name = os.path.basename(filename or "").strip()
    if not name:
        raise HTTPException(400, "文件名无效")
    return name.replace("/", "_").replace("\\", "_").replace("..", "_")


# ─────────── 全局素材库（与项目解耦） ───────────

@router.get("/api/library")
async def list_library(
    asset_type: str | None = Query(None),
    media_type: str | None = Query(None),
):
    """全局素材库列表。"""
    return {"assets": asset_store.list_library(asset_type=asset_type, media_type=media_type)}


@router.post("/api/library/collect")
async def collect_asset(request: Request):
    """手动收藏：把项目里的好素材（角色/场景/道具图）复制进全局素材库。"""
    body = await request.json()
    source_path = body.get("source_path") or body.get("file_path") or ""
    asset_type = body.get("asset_type") or "upload"
    name = body.get("name") or ""
    media_type = body.get("media_type") or "image"
    if not source_path:
        raise HTTPException(400, "缺少 source_path")
    try:
        asset = asset_store.collect_to_library(source_path, asset_type, name, media_type)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"status": "ok", "asset": asset}


@router.post("/api/library/upload")
async def upload_to_library(file: UploadFile = File(...)):
    """上传文件到全局素材库。"""
    safe_name = _safe_name(file.filename)
    ext = os.path.splitext(safe_name)[1].lower()
    if ext in IMAGE_EXTS:
        media_type = "image"
        max_bytes = MAX_IMAGE_BYTES
    elif ext in VIDEO_EXTS:
        media_type = "video"
        max_bytes = MAX_VIDEO_BYTES
    else:
        raise HTTPException(400, f"仅支持 {'/'.join(sorted(IMAGE_EXTS | VIDEO_EXTS))} 格式")

    os.makedirs(LIBRARY_DIR, exist_ok=True)
    unique = f"{uuid.uuid4().hex[:12]}_{safe_name}"
    abs_path = os.path.join(LIBRARY_DIR, unique)

    written = 0
    try:
        with open(abs_path, "wb") as f:
            while chunk := file.file.read(UPLOAD_CHUNK):
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(400, f"文件大小超过限制（{max_bytes // (1024 * 1024)}MB）")
                f.write(chunk)
    except HTTPException:
        if os.path.exists(abs_path):
            os.remove(abs_path)
        raise
    except Exception as exc:
        if os.path.exists(abs_path):
            os.remove(abs_path)
        raise HTTPException(500, f"上传保存失败: {exc}") from exc

    thumb_path = None
    if media_type == "image":
        from core.thumbnail import make_image_thumb

        thumb = make_image_thumb(abs_path)
        if thumb:
            thumb_path = os.path.relpath(thumb, settings.BASE_DIR)

    asset = asset_store.save_uploaded_to_library(safe_name, abs_path, media_type, thumb_path, written)
    return {"status": "ok", "asset": asset}


@router.delete("/api/library/{asset_id}")
async def delete_library_asset(asset_id: int):
    if not asset_store.delete_library_asset(asset_id):
        raise HTTPException(404, "Asset not found")
    return {"status": "deleted", "asset_id": asset_id}


@router.post("/api/project/{session_id}/artifact/{stage}/attach_library_asset")
async def attach_library_asset(session_id: str, stage: str, request: Request):
    """从全局素材库选图，复制到项目的资产条目（等价于上传，但来源是素材库）。"""
    body = await request.json()
    item_type = body.get("item_type")
    item_id = body.get("item_id")
    library_asset_id = body.get("library_asset_id")
    if not item_type or not item_id or not library_asset_id:
        raise HTTPException(400, "缺少 item_type / item_id / library_asset_id")

    asset = asset_store.get_library_asset(int(library_asset_id))
    if not asset:
        raise HTTPException(404, "素材不存在")
    fp = os.path.join(settings.BASE_DIR, asset["file_path"]) if not os.path.isabs(asset["file_path"]) else asset["file_path"]
    if not os.path.exists(fp):
        raise HTTPException(404, "素材文件不存在")

    try:
        with open(fp, "rb") as f:
            return workflow_engine.upload_artifact_image(
                session_id=session_id,
                stage=stage,
                item_type=item_type,
                item_id=item_id,
                file_obj=f,
                filename=asset["name"],
            )
    except KeyError:
        raise HTTPException(404, "Session not found") from None
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(500, str(exc)) from exc


# ─────────── 项目产出素材（自动扫描，用于浏览/添加到素材） ───────────

@router.get("/api/project/{session_id}/assets")
async def list_project_assets(
    session_id: str,
    asset_type: str | None = Query(None),
    media_type: str | None = Query(None),
):
    """项目产出的素材列表（自动扫描）。"""
    asset_store.sync_project_assets(session_id)
    assets = asset_store.list_project_assets(session_id, asset_type=asset_type, media_type=media_type)
    return {"assets": assets}
