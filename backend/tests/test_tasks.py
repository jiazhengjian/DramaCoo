# -*- coding: utf-8 -*-
"""生成任务记录 Store 的 mock 测试（离线，不涉及模型）。"""

import json

import pytest

import core.tasks as tasks_mod
from core.tasks import GenerationTaskStore, create_task_for_generation, get_task_store


@pytest.fixture
def task_env(tmp_path, monkeypatch):
    """把任务目录重定向到临时目录，并清空会话级单例注册表，避免跨测试污染。"""
    monkeypatch.setattr(tasks_mod, "_TASK_DIR", str(tmp_path))
    with tasks_mod._stores_lock:
        tasks_mod._stores.clear()
    tasks_mod.reset_recovery()
    yield tmp_path
    with tasks_mod._stores_lock:
        tasks_mod._stores.clear()
    tasks_mod.reset_recovery()


def test_create_and_complete(task_env):
    s = GenerationTaskStore("s1")
    tid = s.create_task(type="image", stage="character_design", item_type="characters", item_id="char_1")
    assert s.get_task(tid)["status"] == "processing"
    assert s.mark_completed(tid, ["/tmp/a.png"]) is True
    t = s.get_task(tid)
    assert t["status"] == "completed"
    assert t["result_paths"] == ["/tmp/a.png"]
    assert t["completed_at"] is not None


def test_fail_records_error_message_without_stack(task_env):
    s = GenerationTaskStore("s1")
    tid = s.create_task(type="video", stage="video_generation", item_type="clips", item_id="seg_1")
    s.mark_failed(tid, "API 超时")
    t = s.get_task(tid)
    assert t["status"] == "failed"
    assert t["error"] == "API 超时"


def test_list_filter_by_status(task_env):
    s = GenerationTaskStore("s1")
    s.create_task(type="image", stage="a", item_type="x", item_id="i1")
    t2 = s.create_task(type="image", stage="a", item_type="x", item_id="i2")
    s.mark_failed(t2, "err")
    failed = s.failed_tasks()
    assert len(failed) == 1
    assert failed[0]["task_id"] == t2
    assert s.list_tasks(status="failed")[0]["task_id"] == t2


def test_retry_increments_attempt_and_reuses_task(task_env):
    s = get_task_store("s1")
    tid = s.create_task(type="video", stage="video_generation", item_type="clips", item_id="seg_1")
    s.mark_failed(tid, "err")
    assert s.mark_retrying([tid]) == 1
    t = s.get_task(tid)
    assert t["status"] == "processing"
    assert t["attempt"] == 2
    # find-or-create 复用 processing 中的任务，避免同一次重试产生两条记录
    tid2, _ = create_task_for_generation(
        "s1", type="video", stage="video_generation", item_type="clips", item_id="seg_1"
    )
    assert tid2 == tid


def test_stale_processing_recovered_on_load(task_env):
    s = get_task_store("s1")
    tid = s.create_task(type="image", stage="a", item_type="x", item_id="i1")
    # 模拟进程重启：清空单例 + 恢复标记，再重新加载
    with tasks_mod._stores_lock:
        tasks_mod._stores.clear()
    tasks_mod.reset_recovery()
    s2 = get_task_store("s1")
    t = s2.get_task(tid)
    assert t["status"] == "failed"
    assert t["error"] == "进程中断，请重试"


def test_corrupt_file_backed_up(task_env):
    p = task_env / "s1.json"
    p.write_text("{corrupt json", encoding="utf-8")
    s = GenerationTaskStore("s1")
    assert s.list_tasks() == []
    assert (task_env / "s1.json.corrupt").exists()


def test_atomic_write_schema_version(task_env):
    s = GenerationTaskStore("s1")
    s.create_task(type="image", stage="a", item_type="x", item_id="i1")
    data = json.loads((task_env / "s1.json").read_text(encoding="utf-8"))
    assert data["schema_version"] == 1
    assert len(data["tasks"]) == 1


def test_get_task_store_returns_singleton(task_env):
    a = get_task_store("s1")
    b = get_task_store("s1")
    assert a is b
