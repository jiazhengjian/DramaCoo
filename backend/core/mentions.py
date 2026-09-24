# -*- coding: utf-8 -*-
"""@提及 解析与替换：分镜/视频提示词中 @角色名 / @场景名 / @道具名 引用参考素材。"""

import re

# @ 后面跟一个名字：中文/字母/数字/下划线/连字符，遇到空白、标点、@ 停止
MENTION_RE = re.compile(r"@([^\s@，。,.、;；:：()（）【】\[\]]+)")


def extract_mentions(prompt: str) -> list[str]:
    """提取 prompt 中所有 @名字（去重、保序）。"""
    if not prompt:
        return []
    seen: list[str] = []
    for name in MENTION_RE.findall(prompt):
        name = name.strip()
        if name and name not in seen:
            seen.append(name)
    return seen


def resolve_mentions(prompt: str, name_to_path: dict[str, str]) -> tuple[str, list[str]]:
    """替换 prompt 中的 @名字 为参考图标记，返回 (新 prompt, 命中的参考图路径列表)。

    - 命中：把 @名字 替换为 @图片{序号}{名字}（对齐火宝格式，方便前端/模型识别），并收集路径。
    - 未命中：保留原文，不报错。
    """
    if not prompt:
        return prompt, []

    paths: list[str] = []
    counter = {"n": 0}

    def repl(match: re.Match) -> str:
        name = match.group(1).strip()
        path = name_to_path.get(name)
        if path:
            counter["n"] += 1
            paths.append(path)
            return f"@图片{counter['n']}{name}"
        return match.group(0)

    new_prompt = MENTION_RE.sub(repl, prompt)
    return new_prompt, paths
