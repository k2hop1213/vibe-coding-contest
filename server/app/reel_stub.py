"""AI 장면 생성 스텁 — #8(Claude 장면 생성)이 이 함수를 대체한다.

올린 사진·동영상을 순서대로 장면으로 만들고, 일기를 문장 단위로 잘라 자막으로 붙인다.
반환 모양은 docs/planning.md 계약의 reel과 같다.
"""

import re

from app.styles import STYLES

# 태그별 전환 효과 순서 (분위기 차이를 데모에서 보여주기 위함)
_TRANSITIONS = {
    "energetic": ["zoom", "slide"],
    "festival": ["zoom", "slide"],
    "meme": ["zoom", "slide"],
    "calm": ["fade"],
    "vlog": ["fade", "slide"],
    "retro": ["fade"],
    "exam": ["slide", "fade"],
}
_IMAGE_MS = {"energetic": 1500, "festival": 1500, "meme": 1500, "calm": 3500, "retro": 3000}


def build_reel(entry: dict) -> dict:
    tag = entry["tags"][0] if entry["tags"] else ""
    transitions = _TRANSITIONS.get(tag, ["fade"])
    image_ms = _IMAGE_MS.get(tag, 2500)
    sentences = [s.strip() for s in re.split(r"(?<=[.!?。…])\s+|\n+", entry["diary"]) if s.strip()]

    scenes = []
    for i, m in enumerate(entry["media"]):
        scenes.append(
            {
                "mediaUrl": m["url"],
                "type": m["type"],
                "durationMs": 4000 if m["type"] == "video" else image_ms,
                "caption": sentences[i] if i < len(sentences) else "",
                "transition": transitions[i % len(transitions)],
            }
        )

    _, month, day = entry["date"].split("-")
    label = next((s["label"] for s in STYLES if s["id"] == tag), "")
    title = f"{int(month)}월 {int(day)}일" + (f" · {label}" if label else "")
    return {"title": title, "scenes": scenes}
