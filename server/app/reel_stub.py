"""편집 플랜 스텁 — Claude 키가 없거나 Claude 호출이 실패했을 때 쓴다(app/reel_ai.py).

AI 없이 규칙만으로 docs/REELS_TEMPLATES.md §3 편집 플랜을 만든다. 검증·보정은 Claude와 같은 reel_plan.normalize.
- 템플릿: 미디어 1개 → closeup, 그 외에는 스타일 태그(분위기 힌트)로 고른다
- 자막: 일기를 문장 단위로 잘라 클립에 순서대로 (영어 번역은 없음)
"""

import re

from app import reel_plan

# 분위기 힌트 → 템플릿 (Claude 프롬프트의 STYLE_HINTS와 같은 방향)
_TEMPLATE_BY_TAG = {
    "vlog": "emotional",
    "calm": "emotional",
    "retro": "emotional",
    "energetic": "montage",
    "festival": "montage",
    "exam": "review",
    "meme": "review",
}
_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def _sentences(diary: str) -> list[str]:
    parts = [s.strip() for s in re.split(r"(?<=[.!?。…])\s+|\n+", diary) if s.strip()]
    return [p[: reel_plan.MAX_CAPTION] for p in parts]


def pick_template(entry: dict) -> str:
    if len(entry["media"]) == 1:
        return "closeup"
    tag = entry["tags"][0] if entry["tags"] else ""
    return _TEMPLATE_BY_TAG.get(tag, "montage")


def build_reel(entry: dict) -> dict:
    media = entry["media"]
    template = pick_template(entry)
    sentences = _sentences(entry["diary"]) or ["오늘의 기록"]
    _, month, day = entry["date"].split("-")
    m, d = int(month), int(day)

    fixed = {
        "montage": {"title": f"{_MONTHS[m - 1]} {d:02d}", "subtitle": sentences[0]},
        "review": {"title": f"오늘 [{m}월 {d}일]", "subtitle": sentences[0]},
        "closeup": {"title": f"{m}월 {d}일\n{sentences[0]}\n오늘의 한 장", "subtitle": None},
    }.get(template)

    clips = [
        {"mediaIndex": i, "caption": sentences[i % len(sentences)], "captionEn": None}
        for i in range(len(media))
    ]
    plan = {
        "template": template,
        "bgmBpm": {"emotional": 90, "closeup": 150}.get(template, 120),
        "fixedText": fixed,
        "clips": clips,
        "flashMontage": {"startIndex": max(1, len(clips) // 5), "mediaIndexes": list(range(len(media)))}
        if template == "emotional"
        else None,
    }
    return reel_plan.normalize(plan, media)
