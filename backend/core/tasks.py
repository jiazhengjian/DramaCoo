# -*- coding: utf-8 -*-
"""生成任务记录 Store（JSON 结构化文件，schema version 1，原子写入）。

第一批用 JSON 文件持久化（SQLite 属第二批），每个会话一个文件：
    code/data/tasks/<session_id>.json

设计要点：
- 线程安全：同会话共享一个 Store 实例（get_task_store 保证），内部用 RLock。
- 原子写入：临时文件 + os.replace。
- 损坏处理：读取失败备份为 .corrupt 并重建，不阻断启动。
- 进程恢复：加载时把残留 processing 任务置为 failed，避免永久卡住。
"""

import copy
import json
import logging
import os
import threading
import time
import uuid

from config import settings

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1

_TASK_DIR = os.path.join(settings.CODE_DIR, "data", "tasks")
os.makedirs(_TASK_DIR, exist_ok=True)

# 会话级单例注册表：同一会话所有线程共享一个 Store 实例（保证并发写入不互相覆盖）
_stores: dict[str, "GenerationTaskStore"] = {}
_stores_lock = threading.Lock()

# 进程内已做过“残留 processing 恢复”的会话集合（避免每次重新加载都误杀进行中的任务）
_recovered_sessions: set[str] = set()
_recovered_lock = threading.Lock()


def _should_recover(session_id: str) -> bool:
    with _recovered_lock:
        if session_id in _recovered_sessions:
            return False
        _recovered_sessions.add(session_id)
        return True


def reset_recovery() -> None:
    """清空恢复标记（供测试模拟进程重启）。"""
    with _recovered_lock:
        _recovered_sessions.clear()


def get_task_store(session_id) -> "GenerationTaskStore":
    with _stores_lock:
        sid = str(session_id)
        if sid not in _stores:
            _stores[sid] = GenerationTaskStore(sid)
        return _stores[sid]


def provider_for_model(model: str) -> str:
    """根据模型名解析厂商（用于任务记录），未知时返回空字符串。"""
    if not model:
        return ""
    try:
        from models.config_model import get_model_config

        return get_model_config(model).get("provider", "") or ""
    except Exception:
        return ""


def create_task_for_generation(
    session_id,
    *,
    type: str,
    stage: str,
    item_type: str,
    item_id: str,
    model: str = "",
    prompt: str = "",
    params: dict | None = None,
) -> tuple[str, "GenerationTaskStore"]:
    """创建（或复用重试中的）生成任务，返回 (task_id, store)。

    重试复用：当同一 (item_type, item_id) 已存在 processing 状态的任务
    （由 retry 流程 mark_retrying 置位）时复用，避免同一次重试产生两条记录。
    """
    store = get_task_store(session_id)
    existing = store.find_processing(item_type=item_type, item_id=item_id)
    if existing:
        return existing, store
    task_id = store.create_task(
        type=type,
        stage=stage,
        item_type=item_type,
        item_id=item_id,
        provider=provider_for_model(model),
        model=model,
        prompt=prompt,
        params=params,
    )
    return task_id, store


class GenerationTaskStore:
    """单会话的生成任务记录 Store。"""

    def __init__(self, session_id: str):
        self.session_id = str(session_id)
        self._lock = threading.RLock()
        self._path = os.path.join(_TASK_DIR, f"{self.session_id}.json")
        self._data = self._load()

    # ─── 加载与持久化 ───

    def _load(self) -> dict:
        if not os.path.exists(self._path):
            return {"schema_version": SCHEMA_VERSION, "tasks": []}

        try:
            with open(self._path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as exc:
            backup = f"{self._path}.corrupt"
            try:
                os.replace(self._path, backup)
                logger.warning("任务文件损坏，已备份到 %s: %s", backup, exc)
            except Exception:
                pass
            return {"schema_version": SCHEMA_VERSION, "tasks": []}

        if not isinstance(data, dict) or not isinstance(data.get("tasks"), list):
            logger.warning("任务文件结构不合法，重建空任务表: %s", self._path)
            return {"schema_version": SCHEMA_VERSION, "tasks": []}

        data.setdefault("schema_version", SCHEMA_VERSION)
        if _should_recover(self.session_id):
            self._recover_stale(data)
        return data

    def _recover_stale(self, data: dict) -> None:
        """进程重启后，残留 processing 的任务置为 failed，避免永久卡住。"""
        now = time.time()
        changed = False
        for task in data.get("tasks", []):
            if isinstance(task, dict) and task.get("status") == "processing":
                task["status"] = "failed"
                task["error"] = "进程中断，请重试"
                task["updated_at"] = now
                changed = True
        if changed:
            logger.warning("会话 %s 存在进程中断遗留任务，已置为 failed", self.session_id)

    def _persist(self) -> None:
        tmp = f"{self._path}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self._path)

    # ─── 任务操作 ───

    def create_task(
        self,
        *,
        type: str,
        stage: str,
        item_type: str,
        item_id: str,
        provider: str = "",
        model: str = "",
        prompt: str = "",
        params: dict | None = None,
    ) -> str:
        task_id = uuid.uuid4().hex
        now = time.time()
        task = {
            "task_id": task_id,
            "type": type,
            "session_id": self.session_id,
            "stage": stage,
            "item_type": item_type,
            "item_id": item_id,
            "provider": provider or "",
            "model": model or "",
            "prompt": prompt or "",
            "params": copy.deepcopy(params) if isinstance(params, dict) else {},
            "status": "processing",
            "error": None,
            "result_paths": [],
            "attempt": 1,
            "created_at": now,
            "updated_at": now,
            "completed_at": None,
        }
        with self._lock:
            self._data["tasks"].append(task)
            self._persist()
        return task_id

    def _get(self, task_id: str) -> dict | None:
        for t in self._data["tasks"]:
            if t.get("task_id") == task_id:
                return t
        return None

    def mark_completed(self, task_id: str, result_paths: list[str] | None = None) -> bool:
        with self._lock:
            t = self._get(task_id)
            if not t:
                return False
            t["status"] = "completed"
            t["error"] = None
            t["result_paths"] = list(result_paths or [])
            t["updated_at"] = time.time()
            t["completed_at"] = time.time()
            self._persist()
        return True

    def mark_failed(self, task_id: str, error: str) -> bool:
        with self._lock:
            t = self._get(task_id)
            if not t:
                return False
            t["status"] = "failed"
            t["error"] = str(error)[:2000]
            t["updated_at"] = time.time()
            self._persist()
        return True

    def mark_retrying(self, task_ids: list[str]) -> int:
        """重试前将失败任务置为 processing 并 attempt +1，返回实际重置数量。"""
        count = 0
        with self._lock:
            ids = set(task_ids)
            for t in self._data["tasks"]:
                if t.get("task_id") in ids and t.get("status") == "failed":
                    t["status"] = "processing"
                    t["error"] = None
                    t["attempt"] = int(t.get("attempt", 1)) + 1
                    t["updated_at"] = time.time()
                    count += 1
            if count:
                self._persist()
        return count

    def find_processing(self, item_type: str, item_id: str) -> str | None:
        """查找指定 item 当前 processing 状态的任务（重试复用时）。"""
        with self._lock:
            for t in reversed(self._data["tasks"]):
                if (
                    t.get("status") == "processing"
                    and t.get("item_type") == item_type
                    and t.get("item_id") == item_id
                ):
                    return t["task_id"]
            return None

    def get_task(self, task_id: str) -> dict | None:
        with self._lock:
            t = self._get(task_id)
            return copy.deepcopy(t) if t else None

    def list_tasks(self, status: str | None = None) -> list[dict]:
        with self._lock:
            tasks = copy.deepcopy(self._data["tasks"])
        if status:
            tasks = [t for t in tasks if t.get("status") == status]
        return tasks

    def failed_tasks(self, stage: str | None = None) -> list[dict]:
        """返回失败任务（可限定阶段）。"""
        with self._lock:
            failed = [copy.deepcopy(t) for t in self._data["tasks"] if t.get("status") == "failed"]
        if stage:
            failed = [t for t in failed if t.get("stage") == stage]
        return failed
