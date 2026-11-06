"""#6 고정(mock) 데이터 API — docs/planning.md "API 계약"과 같은 모양으로 응답한다.

실제 저장(#7)·Claude 장면 생성(#8)이 붙기 전까지 프론트가 바로 개발할 수 있게 하는 용도.
- 어느 달을 조회해도 같은 날짜들(2·3·5·12일 done, 9일 processing, 14일 failed)에 기록이 있다.
- POST로 만든 기록은 메모리에만 저장되고, PROCESSING_SECONDS 뒤 done(샘플 릴스)으로 바뀐다.
"""

import re
import time
import uuid
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api")

SAMPLE_MEDIA_DIR = Path(__file__).parent / "sample_media"
MAX_FILES = 10
PROCESSING_SECONDS = 3.0

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

# 일(day) → (상태, 태그, 일기)
MOCK_DAYS: dict[int, tuple[str, str, str]] = {
    2: ("done", "vlog", "비 오는 날 카페에서 과제하다가 창밖 구경"),
    3: ("done", "festival", "축제 첫날! 친구들이랑 부스 돌고 공연까지 봤다"),
    5: ("done", "exam", "중간고사 D-1, 도서관에서 밤샘"),
    9: ("processing", "energetic", "동아리 첫 공연 연습"),
    12: ("done", "calm", "공강 시간에 혼자 캠퍼스 산책"),
    14: ("failed", "meme", "학식 메뉴가 또 카레"),
}

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")

# POST로 만든 기록 (서버 재시작 시 사라짐). id → 기록
_created: dict[str, dict] = {}


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code})


def _parse_date(value: str | None) -> date | None:
    if not value or not _DATE_RE.match(value):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def sample_reel(title: str) -> dict:
    captions = [
        "오늘 하루, 시작!",
        "잠깐 쉬어가는 시간",
        "에너지 충전 완료",
        "오늘도 릴스로 남겨둘게",
    ]
    transitions = ["fade", "slide", "zoom", "fade"]
    return {
        "title": title,
        "scenes": [
            {
                "mediaUrl": f"/media/sample/{i + 1}.svg",
                "type": "image",
                "durationMs": 2500,
                "caption": captions[i],
                "transition": transitions[i],
            }
            for i in range(4)
        ],
    }


def _mock_entry(d: date) -> dict | None:
    if d.day not in MOCK_DAYS:
        return None
    status, tag, diary = MOCK_DAYS[d.day]
    return {
        "id": f"e_{d.isoformat()}",
        "date": d.isoformat(),
        "diary": diary,
        "tags": [tag],
        "status": status,
        "reel": sample_reel(f"{d.month}월 {d.day}일의 기록") if status == "done" else None,
    }


def _refresh(entry: dict) -> dict:
    """POST로 만든 기록은 일정 시간이 지나면 done으로 바뀐다."""
    if entry["status"] == "processing" and time.monotonic() - entry["_created_at"] >= PROCESSING_SECONDS:
        entry["status"] = "done"
        entry["reel"] = sample_reel(entry["diary"][:20] or "오늘의 릴스")
    return entry


def _public(entry: dict) -> dict:
    return {k: v for k, v in entry.items() if not k.startswith("_")}


def _summary(entry: dict) -> dict:
    reel = entry["reel"]
    return {
        "id": entry["id"],
        "date": entry["date"],
        "status": entry["status"],
        "thumbnailUrl": reel["scenes"][0]["mediaUrl"] if entry["status"] == "done" and reel else None,
    }


def _find_by_date(d: date) -> dict | None:
    for e in _created.values():
        if e["date"] == d.isoformat():
            return _refresh(e)
    return _mock_entry(d)


@router.get("/styles")
def list_styles() -> dict:
    return {"styles": STYLES}


@router.get("/entries", response_model=None)
def list_entries(month: str | None = None) -> dict | JSONResponse:
    if not month or not _MONTH_RE.match(month):
        return _error(400, "invalid_date")
    year, mon = map(int, month.split("-"))
    if not 1 <= mon <= 12:
        return _error(400, "invalid_date")

    entries = []
    for day in range(1, 32):
        try:
            d = date(year, mon, day)
        except ValueError:
            break
        entry = _find_by_date(d)
        if entry:
            entries.append(_summary(entry))
    return {"entries": entries}


@router.get("/entries/{entry_id}", response_model=None)
def get_entry(entry_id: str) -> dict | JSONResponse:
    if entry_id in _created:
        return _public(_refresh(_created[entry_id]))
    if entry_id.startswith("e_"):
        d = _parse_date(entry_id[2:])
        entry = _mock_entry(d) if d else None
        if entry:
            return entry
    return _error(404, "not_found")


@router.post("/entries", status_code=202, response_model=None)
async def create_entry(
    date_: Annotated[str | None, Form(alias="date")] = None,
    diary: Annotated[str, Form()] = "",
    # multipart에서 tags는 같은 키를 반복해서 보낸다: tags=festival&tags=calm
    tags: Annotated[list[str] | None, Form()] = None,
    files: Annotated[list[UploadFile] | None, File()] = None,
) -> dict | JSONResponse:
    d = _parse_date(date_)
    if d is None:
        return _error(400, "invalid_date")

    valid_tags = [t for t in (tags or []) if t in STYLE_IDS]
    if not valid_tags:
        return _error(400, "no_tag")

    media = [f for f in (files or []) if f.filename]
    if not media:
        return _error(400, "no_media")
    if len(media) > MAX_FILES:
        return _error(400, "too_many_media")

    if _find_by_date(d):
        return _error(409, "already_exists")

    entry_id = f"e_{uuid.uuid4().hex[:8]}"
    _created[entry_id] = {
        "id": entry_id,
        "date": d.isoformat(),
        "diary": diary,
        "tags": valid_tags,
        "status": "processing",
        "reel": None,
        "_created_at": time.monotonic(),
    }
    return {"id": entry_id, "date": d.isoformat(), "status": "processing"}
