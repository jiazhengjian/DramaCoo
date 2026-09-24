# -*- coding: utf-8 -*-
"""ffmpeg 二进制解析器：环境变量 → 系统 → 内置（imageio-ffmpeg）。

第一批落地「ffmpeg 内置」，让 DramaCoo 不再依赖系统安装 ffmpeg。
解析优先级（任一命中即返回，不再尝试后续）：
  1. 环境变量 FFMPEG_BIN 指定的路径
  2. 系统 PATH 中的 ffmpeg
  3. imageio-ffmpeg 内置二进制
"""

import logging
import os
import shutil

logger = logging.getLogger(__name__)

_cached_ffmpeg: str | None = None


def get_ffmpeg_path() -> str:
    """返回可用的 ffmpeg 可执行文件路径；都找不到时抛出带操作指引的 RuntimeError。"""
    global _cached_ffmpeg
    if _cached_ffmpeg and os.path.exists(_cached_ffmpeg):
        return _cached_ffmpeg

    # 1. 环境变量覆盖
    env_bin = os.environ.get("FFMPEG_BIN", "").strip()
    if env_bin and os.path.exists(env_bin):
        _cached_ffmpeg = env_bin
        return _cached_ffmpeg

    # 2. 系统 ffmpeg
    system_bin = shutil.which("ffmpeg")
    if system_bin:
        _cached_ffmpeg = system_bin
        return _cached_ffmpeg

    # 3. 内置二进制（imageio-ffmpeg）
    try:
        import imageio_ffmpeg

        bundled_bin = imageio_ffmpeg.get_ffmpeg_exe()
        if bundled_bin and os.path.exists(bundled_bin):
            _cached_ffmpeg = bundled_bin
            return _cached_ffmpeg
    except Exception as exc:  # pragma: no cover - 依赖缺失时兜底
        logger.warning("imageio-ffmpeg 内置二进制不可用: %s", exc)

    raise RuntimeError(
        "找不到可用的 ffmpeg：请设置 FFMPEG_BIN 环境变量、安装系统 ffmpeg，"
        "或安装 imageio-ffmpeg（pip install imageio-ffmpeg）"
    )


def get_ffprobe_path() -> str:
    """返回 ffprobe 路径；imageio-ffmpeg 不内置 ffprobe，找不到时返回空字符串。"""
    env_bin = os.environ.get("FFPROBE_BIN", "").strip()
    if env_bin and os.path.exists(env_bin):
        return env_bin

    system_bin = shutil.which("ffprobe")
    if system_bin:
        return system_bin

    return ""


def reset_ffmpeg_cache() -> None:
    """清除缓存的 ffmpeg 路径（供测试或环境变化时使用）。"""
    global _cached_ffmpeg
    _cached_ffmpeg = None
