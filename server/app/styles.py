from fastapi import APIRouter

router = APIRouter(prefix="/api")

STYLES = [
    {"id": "vlog", "label": "감성 브이로그", "emoji": "🎞️"},
    {"id": "energetic", "label": "에너지 넘치는", "emoji": "⚡"},
    {"id": "exam", "label": "시험기간 생존기", "emoji": "📚"},
    {"id": "festival", "label": "축제·MT", "emoji": "🎉"},
    {"id": "calm", "label": "잔잔한 슬라이드쇼", "emoji": "🌙"},
    {"id": "meme", "label": "밈·유머", "emoji": "😂"},
    {"id": "retro", "label": "레트로 필름", "emoji": "📼"},
]
STYLE_IDS = {s["id"] for s in STYLES}


@router.get("/styles")
def list_styles() -> dict:
    return {"styles": STYLES}
