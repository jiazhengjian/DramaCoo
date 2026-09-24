import asyncio
import logging
import uuid

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse

from api.dependencies import workflow_engine
from api.routers.files import merge_uploaded_file_into_idea
from api.schemas.project import InterventionRequest, ProjectStartRequest
from api.services.project_helpers import (
    make_cancellation,
    make_progress_channel,
    stream_workflow_task,
)
from config import settings
from core.orchestrator import WorkflowStage
from core.tasks import get_task_store
from core import asset_store

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Workflow"])

REQUIRED_MODEL_FIELDS = (
    "llm_model",
    "vlm_model",
    "image_t2i_model",
    "image_it2i_model",
)

VIDEO_MODE_TO_MODEL_FIELD = {
    "first_frame": "video_first_frame_model",
    "start_end_frame": "video_start_end_model",
    "reference": "video_reference_model",
}


def _active_video_model(values: dict) -> str:
    mode = values.get("video_generation_mode") or "first_frame"
    model_field = VIDEO_MODE_TO_MODEL_FIELD.get(mode, "video_first_frame_model")
    default_attr = {
        "video_first_frame_model": "VIDEO_FIRST_FRAME_MODEL",
        "video_start_end_model": "VIDEO_START_END_MODEL",
        "video_reference_model": "VIDEO_REFERENCE_MODEL",
    }.get(model_field, "VIDEO_MODEL")
    # Legacy session compatibility: fall back to the old single video_model field when mode-specific fields are absent.
    return values.get(model_field) or values.get("video_model") or getattr(settings, default_attr, "") or ""


def _require_model_fields(values: dict) -> None:
    missing = [field for field in REQUIRED_MODEL_FIELDS if not values.get(field)]
    if not _active_video_model(values):
        missing.append("video_model")
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required model configuration: {', '.join(missing)}",
        )


@router.post("/api/project/start")
async def start_project(req: ProjectStartRequest):
    final_idea = merge_uploaded_file_into_idea(req.idea, req.file_path)
    _require_model_fields(req.model_dump())

    session_id = uuid.uuid4().hex
    meta = {
        "idea": final_idea,
        "user_textbox_input": req.idea,
        "style": req.style or getattr(settings, "STYLE", None) or "realistic",
        "video_ratio": req.video_ratio or "9:16",
        "video_resolution": req.video_resolution or "720P",
        "expand_idea": req.expand_idea if req.expand_idea is not None else True,
        "llm_model": req.llm_model,
        "vlm_model": req.vlm_model,
        "image_t2i_model": req.image_t2i_model,
        "image_it2i_model": req.image_it2i_model,
        # Legacy request/session compatibility: clients created before the split only send video_model.
        "video_first_frame_model": req.video_first_frame_model or req.video_model or getattr(settings, "VIDEO_FIRST_FRAME_MODEL", ""),
        "video_start_end_model": req.video_start_end_model or getattr(settings, "VIDEO_START_END_MODEL", ""),
        "video_reference_model": req.video_reference_model or getattr(settings, "VIDEO_REFERENCE_MODEL", ""),
        "video_generation_mode": req.video_generation_mode or getattr(settings, "VIDEO_GENERATION_MODE", "first_frame"),
        "video_model": req.video_model,
        "enable_concurrency": req.enable_concurrency if req.enable_concurrency is not None else True,
        "web_search": req.web_search if req.web_search is not None else False,
        "episodes": req.episodes if req.episodes is not None else 4,
    }
    meta["video_model"] = _active_video_model(meta)
    session = workflow_engine.create_session(session_id, meta)
    # 新建项目实时同步到项目库（SQLite）
    asset_store.sync_project(session_id)

    return {
        "session_id": session_id,
        "status": session["status"],
        "params": {
            "idea": final_idea,
            "file_path": req.file_path,
            "style": req.style,
            "llm_model": meta["llm_model"],
            "vlm_model": meta["vlm_model"],
            "image_t2i_model": meta["image_t2i_model"],
            "image_it2i_model": meta["image_it2i_model"],
            "video_first_frame_model": meta["video_first_frame_model"],
            "video_start_end_model": meta["video_start_end_model"],
            "video_reference_model": meta["video_reference_model"],
            "video_generation_mode": meta["video_generation_mode"],
            "video_model": meta["video_model"],
            "episodes": meta["episodes"],
            "video_ratio": meta["video_ratio"],
            "video_resolution": meta["video_resolution"],
        }
    }


@router.post("/api/project/{session_id}/execute/{stage}")
async def execute_stage(session_id: str, stage: str, request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    state, input_data = workflow_engine.prepare_stage_execution(session_id, stage, body)
    _require_model_fields(input_data)

    cancellation_check, on_disconnect = make_cancellation(workflow_engine, session_id)
    progress_events, event_trigger, progress_callback = make_progress_channel()

    return StreamingResponse(
        stream_workflow_task(
            request=request,
            workflow_engine=workflow_engine,
            state=state,
            stage=stage,
            input_data=input_data,
            cancellation_check=cancellation_check,
            progress_callback=progress_callback,
            progress_events=progress_events,
            event_trigger=event_trigger,
            include_payload_summary=True,
            on_disconnect=on_disconnect,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/api/project/{session_id}/status")
async def get_project_status(session_id: str):
    snapshot = workflow_engine.get_status_snapshot(session_id)
    if not snapshot:
        raise HTTPException(404, "Session not found")
    return snapshot


@router.get("/api/project/{session_id}/status/from_disk")
async def get_project_status_from_disk(session_id: str):
    # 兼容旧前端路由名；实际读取统一走 WorkflowEngine 的内存状态入口。
    snapshot = workflow_engine.get_status_snapshot(session_id)
    if not snapshot:
        raise HTTPException(404, "Session not found")
    return snapshot


@router.get("/api/project/{session_id}/artifact/{stage}")
async def get_artifact(session_id: str, stage: str):
    try:
        artifact = workflow_engine.get_artifact_snapshot(session_id, stage)
    except KeyError:
        raise HTTPException(404, "Session not found")

    if artifact is not None:
        return {"stage": stage, "artifact": artifact}

    raise HTTPException(404, f"Artifact for stage '{stage}' not found")


@router.patch("/api/project/{session_id}/models")
async def update_models(session_id: str, request: Request):
    body = await request.json()
    allowed_keys = (
        "llm_model",
        "vlm_model",
        "image_t2i_model",
        "image_it2i_model",
        "video_model",
        "video_first_frame_model",
        "video_start_end_model",
        "video_reference_model",
        "video_generation_mode",
        "video_ratio",
        "video_resolution",
        "style",
        "enable_concurrency",
    )
    try:
        return workflow_engine.update_session_meta(session_id, body if isinstance(body, dict) else {}, allowed_keys)
    except KeyError:
        raise HTTPException(404, "Session not found")


@router.post("/api/project/{session_id}/artifact/{stage}/upload_image")
async def upload_artifact_image(
    session_id: str,
    stage: str,
    item_type: str = Form(...),
    item_id: str = Form(...),
    file: UploadFile = File(...),
):
    """Upload a user-provided image into a stage artifact and persist the session."""
    try:
        return workflow_engine.upload_artifact_image(
            session_id=session_id,
            stage=stage,
            item_type=item_type,
            item_id=item_id,
            file_obj=file.file,
            filename=file.filename or "",
        )
    except KeyError:
        raise HTTPException(404, "Session not found")
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(500, detail=str(exc)) from exc


@router.patch("/api/project/{session_id}/artifact/{stage}")
async def update_artifact(session_id: str, stage: str, request: Request):
    """保存用户在某阶段的选择/修改，同时更新内存状态和磁盘快照。"""
    body = await request.json()
    try:
        return workflow_engine.update_artifact(session_id, stage, body if isinstance(body, dict) else {})
    except KeyError:
        raise HTTPException(404, "Session not found")


@router.delete("/api/project/{session_id}/artifact/{stage}/version")
async def delete_artifact_version(session_id: str, stage: str, request: Request):
    """删除资产的一个版本（图片/视频文件 + 缩略图 + versions 列表）。"""
    body = await request.json()
    item_type = body.get("item_type")
    item_id = body.get("item_id")
    path = body.get("path")
    if not item_type or not item_id or not path:
        raise HTTPException(400, "缺少 item_type / item_id / path")
    try:
        return workflow_engine.delete_artifact_version(session_id, stage, item_type, item_id, path)
    except KeyError:
        raise HTTPException(404, "Session not found") from None
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc




@router.post("/api/project/{session_id}/intervene")
async def intervene(session_id: str, req: InterventionRequest, request: Request):
    try:
        state, input_data = workflow_engine.prepare_intervention_execution(
            session_id=session_id,
            stage=req.stage,
            modifications=req.modifications,
        )
    except KeyError:
        raise HTTPException(404, "Session not found")

    cancellation_check, on_disconnect = make_cancellation(workflow_engine, session_id)
    progress_events, event_trigger, progress_callback = make_progress_channel()

    return StreamingResponse(
        stream_workflow_task(
            request=request,
            workflow_engine=workflow_engine,
            state=state,
            stage=req.stage,
            input_data=input_data,
            cancellation_check=cancellation_check,
            progress_callback=progress_callback,
            progress_events=progress_events,
            event_trigger=event_trigger,
            intervention=req.modifications,
            on_disconnect=on_disconnect,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/api/project/{session_id}/continue")
async def continue_workflow(session_id: str):
    if not workflow_engine.get_status_snapshot(session_id):
        raise HTTPException(404, "Session not found")
    return await workflow_engine.continue_workflow(session_id)


@router.post("/api/project/{session_id}/stop")
async def stop_project(session_id: str):
    workflow_engine.stop_session(session_id)
    return {"status": "stopped", "session_id": session_id}


@router.get("/api/project/{session_id}/scene/{scene_number}/assets")
async def check_scene_assets(session_id: str, scene_number: int):
    try:
        return workflow_engine.get_scene_asset_counts(session_id, scene_number)
    except KeyError:
        raise HTTPException(404, "Session not found")


# ──────────── 生成任务与重试 ────────────

_ITEM_TYPE_TO_REGENERATE_KEY = {
    "characters": "regenerate_characters",
    "settings": "regenerate_settings",
    "scenes": "regenerate_scenes",
    "clips": "regenerate_clips",
}


@router.get("/api/project/{session_id}/tasks")
async def list_generation_tasks(session_id: str, status: str | None = Query(None)):
    """列出会话的生成任务；可选 ?status=failed 过滤。"""
    if not workflow_engine.get_status_snapshot(session_id):
        raise HTTPException(404, "Session not found")
    store = get_task_store(session_id)
    return {"tasks": store.list_tasks(status=status)}


async def _run_retry(session_id: str, regen_by_stage: dict) -> None:
    """按阶段顺序重跑失败项；直接调用 execute_stage（进度写入会话状态，前端轮询可见）。"""
    for stage, modifications in regen_by_stage.items():
        try:
            state, input_data = workflow_engine.prepare_intervention_execution(
                session_id=session_id,
                stage=stage,
                modifications=modifications,
            )
            cancellation_check, _ = make_cancellation(workflow_engine, session_id)
            await workflow_engine.execute_stage(
                state=state,
                stage=WorkflowStage(stage),
                input_data=input_data,
                cancellation_check=cancellation_check,
                progress_callback=None,
                intervention=modifications,
            )
        except Exception as exc:
            logger.exception("重试失败 session=%s stage=%s: %s", session_id, stage, exc)


@router.post("/api/project/{session_id}/tasks/retry_failed")
async def retry_failed_tasks(session_id: str, request: Request):
    """重试失败任务；可带 {"stage": "video_generation"} 限定阶段。"""
    if not workflow_engine.get_status_snapshot(session_id):
        raise HTTPException(404, "Session not found")

    body = {}
    try:
        body = await request.json() or {}
    except Exception:
        body = {}
    stage = body.get("stage") if isinstance(body, dict) else None

    store = get_task_store(session_id)
    failed = store.failed_tasks(stage=stage)
    if not failed:
        return {"retried": 0, "tasks": []}

    regen_by_stage: dict = {}
    task_ids = [t["task_id"] for t in failed]
    for t in failed:
        regen_key = _ITEM_TYPE_TO_REGENERATE_KEY.get(t.get("item_type"))
        if not regen_key:
            continue
        regen_by_stage.setdefault(t["stage"], {}).setdefault(regen_key, [])
        if t["item_id"] not in regen_by_stage[t["stage"]][regen_key]:
            regen_by_stage[t["stage"]][regen_key].append(t["item_id"])

    if not regen_by_stage:
        return {"retried": 0, "tasks": [], "message": "失败任务缺少可重试的资产信息"}

    store.mark_retrying(task_ids)

    retry_task = asyncio.create_task(_run_retry(session_id, regen_by_stage))
    workflow_engine.track_background_task(retry_task)

    return {"retried": len(task_ids), "tasks": task_ids}
