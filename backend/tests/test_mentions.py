# -*- coding: utf-8 -*-
"""@提及 解析与替换的单测。"""

from core.mentions import extract_mentions, resolve_mentions


def test_extract_mentions():
    prompt = "画面中 @林晓 追着 @赵强 跑，路过 @旧怀表"
    assert extract_mentions(prompt) == ["林晓", "赵强", "旧怀表"]


def test_extract_mentions_dedup():
    assert extract_mentions("@林晓 和 @林晓 同时出现") == ["林晓"]


def test_resolve_mentions_hit():
    prompt = "画面中 @林晓 追着 @赵强"
    name_to_path = {"林晓": "/img/char_1.png", "赵强": "/img/char_2.png"}
    new_prompt, paths = resolve_mentions(prompt, name_to_path)
    assert new_prompt == "画面中 @图片1林晓 追着 @图片2赵强"
    assert paths == ["/img/char_1.png", "/img/char_2.png"]


def test_resolve_mentions_unmatched_kept():
    prompt = "画面中 @不存在的人 出现"
    new_prompt, paths = resolve_mentions(prompt, {"林晓": "/img/char_1.png"})
    assert new_prompt == prompt  # 未命中保留原样
    assert paths == []


def test_resolve_mentions_mixed():
    prompt = "@林晓 和 @不存在 和 @旧怀表"
    name_to_path = {"林晓": "/a.png", "旧怀表": "/b.png"}
    new_prompt, paths = resolve_mentions(prompt, name_to_path)
    assert paths == ["/a.png", "/b.png"]
    assert "@图片1林晓" in new_prompt
    assert "@不存在" in new_prompt  # 未命中保留


def test_empty_prompt():
    assert extract_mentions("") == []
    assert resolve_mentions("", {}) == ("", [])
