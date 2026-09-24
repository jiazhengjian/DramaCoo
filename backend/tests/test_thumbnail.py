# -*- coding: utf-8 -*-
"""缩略图 + 视频海报帧 + ffmpeg 内置解析器的 mock 测试。"""

import os
import subprocess

import pytest
from PIL import Image

from core.ffmpeg_bin import get_ffmpeg_path, reset_ffmpeg_cache
from core.thumbnail import extract_video_poster, make_image_thumb


def _make_image(path, size=(800, 600), color=(255, 0, 0)):
    Image.new("RGB", size, color).save(path)


def test_make_image_thumb_creates_webp(tmp_path):
    img = tmp_path / "a.png"
    _make_image(str(img))
    thumb = make_image_thumb(str(img))
    assert thumb.endswith("_thumb.webp")
    assert os.path.exists(thumb)
    with Image.open(thumb) as t:
        assert max(t.size) <= 400


def test_make_image_thumb_idempotent(tmp_path):
    img = tmp_path / "a.png"
    _make_image(str(img))
    t1 = make_image_thumb(str(img))
    mtime = os.path.getmtime(t1)
    t2 = make_image_thumb(str(img))
    assert t1 == t2
    assert os.path.getmtime(t2) == mtime  # 幂等：不重复生成


def test_make_image_thumb_missing_file(tmp_path):
    assert make_image_thumb(str(tmp_path / "nope.png")) == ""


def test_get_ffmpeg_path_returns_existing_binary(monkeypatch):
    monkeypatch.delenv("FFMPEG_BIN", raising=False)
    reset_ffmpeg_cache()
    p = get_ffmpeg_path()
    assert os.path.exists(p)


def test_ffmpeg_env_override(monkeypatch, tmp_path):
    fake = tmp_path / "fake_ffmpeg"
    fake.write_text("")
    monkeypatch.setenv("FFMPEG_BIN", str(fake))
    reset_ffmpeg_cache()
    assert get_ffmpeg_path() == str(fake)


def test_list_versions_excludes_thumbnail(tmp_path, monkeypatch):
    """版本列表不得把 _thumb.webp 缩略图当成历史版本。"""
    from core.agents.character_agent import CharacterDesignerAgent

    agent = CharacterDesignerAgent()
    char_dir = tmp_path / "characters"
    char_dir.mkdir()
    (char_dir / "char_1.png").write_bytes(b"x")
    (char_dir / "char_1_thumb.webp").write_bytes(b"y")
    (char_dir / "char_1_v2.png").write_bytes(b"z")

    monkeypatch.setattr(
        CharacterDesignerAgent, "_asset_base", staticmethod(lambda sid: str(tmp_path))
    )
    versions = agent._list_versions("s1", "characters", "char_1")
    basenames = [os.path.basename(v) for v in versions]
    assert "char_1.png" in basenames
    assert "char_1_v2.png" in basenames
    assert "char_1_thumb.webp" not in basenames


def test_extract_video_poster(tmp_path, monkeypatch):
    # 用内置 ffmpeg 生成一个 1 秒纯色视频，再抽海报帧，验证「免系统 ffmpeg」链路
    monkeypatch.delenv("FFMPEG_BIN", raising=False)
    reset_ffmpeg_cache()
    try:
        ffmpeg = get_ffmpeg_path()
    except RuntimeError:
        pytest.skip("无 ffmpeg 可用")

    video = tmp_path / "v.mp4"
    subprocess.run(
        [
            ffmpeg, "-y", "-f", "lavfi", "-i",
            "color=c=blue:s=320x240:d=1", "-pix_fmt", "yuv420p", str(video),
        ],
        check=True, capture_output=True, timeout=60,
    )
    assert os.path.exists(video)

    poster = extract_video_poster(str(video))
    assert poster.endswith("_poster.jpg")
    assert os.path.exists(poster)

    # 幂等
    poster2 = extract_video_poster(str(video))
    assert poster2 == poster
