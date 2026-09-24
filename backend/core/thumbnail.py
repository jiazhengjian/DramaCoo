# -*- coding: utf-8 -*-
"""缩略图 + 视频海报帧生成（确定性工程逻辑，不涉及模型）。

- 图片缩略图：长边 400px、WEBP、quality 80，命名 <原名>_thumb.webp
- 视频海报帧：抽首帧，命名 <原名>_poster.jpg
两者均幂等（已存在则跳过）、失败返回空字符串且不阻断主流程。
"""

import logging
import os
import subprocess

from PIL import Image

from core.ffmpeg_bin import get_ffmpeg_path

logger = logging.getLogger(__name__)

THUMB_MAX_SIZE = 400
THUMB_QUALITY = 80


def _thumb_path(image_path: str) -> str:
    base, _ = os.path.splitext(image_path)
    return f"{base}_thumb.webp"


def _poster_path(video_path: str) -> str:
    base, _ = os.path.splitext(video_path)
    return f"{base}_poster.jpg"


def make_image_thumb(image_path: str) -> str:
    """为图片生成 400px webp 缩略图；幂等；失败返回空字符串。"""
    if not image_path or not os.path.exists(image_path):
        return ""

    out = _thumb_path(image_path)
    if os.path.exists(out):
        return out

    try:
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            img.thumbnail((THUMB_MAX_SIZE, THUMB_MAX_SIZE), Image.Resampling.LANCZOS)
            img.save(out, "WEBP", quality=THUMB_QUALITY)
        return out if os.path.exists(out) else ""
    except Exception as exc:
        logger.warning("生成缩略图失败 %s: %s", image_path, exc)
        return ""


def extract_video_poster(video_path: str) -> str:
    """为视频抽首帧海报帧；幂等；失败返回空字符串。"""
    if not video_path or not os.path.exists(video_path):
        return ""

    out = _poster_path(video_path)
    if os.path.exists(out):
        return out

    try:
        ffmpeg = get_ffmpeg_path()
        cmd = [ffmpeg, "-y", "-i", video_path, "-frames:v", "1", "-q:v", "3", out]
        subprocess.run(cmd, check=True, capture_output=True, timeout=120)
        return out if os.path.exists(out) else ""
    except Exception as exc:
        logger.warning("抽取视频海报帧失败 %s: %s", video_path, exc)
        return ""
