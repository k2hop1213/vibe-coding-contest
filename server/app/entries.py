"""기록 API — docs/planning.md "API 계약"의 /api/entries.

업로드 파일은 MEDIA_DIR에 랜덤 이름으로 저장하고 /media/{파일명}으로 서빙한다.
릴스 생성은 응답(202) 뒤 백그라운드에서 돈다. Claude(app/reel_ai.py), 키가 없거나 실패하면 스텁(app/reel_stub.py).
"""

import logging
import re
import sqlite3
import time
import uuid
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, UploadFile
from fastapi.responses import JSONResponse, Response

from app import db, reel_ai
from app.config import media_dir, stub_delay_seconds
from app.reel_stub import build_reel
from app.styles import STYLE_IDS

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

MAX_FILES = 10
MAX_FILE_BYTES = 50 * 1024 * 1024
_CHUNK = 1024 * 1024

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
# 저장 확장자는 허용 목록으로 고정한다. 파일명·content_type은 클라이언트가 정하는 값이라
# 그대로 믿으면 x.html을 image/png로 올려 /media에서 text/html로 서빙되는 stored XSS가 된다.
# SVG(스크립트 가능)·HEIC(Chrome <img>가 못 그림)도 받지 않는다.
_ALLOWED_EXT = {
    "image": {".jpg", ".jpeg", ".png", ".gif", ".webp"},
    "video": {".mp4", ".mov", ".webm"},
}


class _UploadError(Exception):
    def __init__(self, code: str):
        self.code = code


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code})


def _parse_date(value: str | None) -> date | None:
    if not value or not _DATE_RE.match(value):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _media_kind(upload: UploadFile) -> tuple[str, str] | None:
    """(종류, 저장 확장자). content_type의 종류와 파일 확장자가 허용 목록에서 서로 맞을 때만."""
    kind = (upload.content_type or "").split("/")[0]
    ext = Path(upload.filename or "").suffix.lower()
    if ext in _ALLOWED_EXT.get(kind, ()):
        return kind, ext
    return None


async def _save_uploads(uploads: list[UploadFile]) -> list[dict]:
    """전부 저장하거나, 하나라도 실패하면 이미 쓴 파일을 지우고 _UploadError."""
    kinds = [_media_kind(u) for u in uploads]
    if None in kinds:
        raise _UploadError("invalid_media")

    folder = media_dir()
    folder.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    media: list[dict] = []
    try:
        for u, (kind, ext) in zip(uploads, kinds, strict=True):
            path = folder / f"{uuid.uuid4().hex}{ext}"
            saved.append(path)
            size = 0
            with path.open("wb") as out:
                while chunk := await u.read(_CHUNK):
                    size += len(chunk)
                    if size > MAX_FILE_BYTES:
                        raise _UploadError("file_too_large")
                    out.write(chunk)
            media.append({"url": f"/media/{path.name}", "type": kind})
    except BaseException:
        for p in saved:
            p.unlink(missing_ok=True)
        raise
    return media


def _delete_media(media: list[dict]) -> None:
    for m in media:
        (media_dir() / Path(m["url"]).name).unlink(missing_ok=True)


def make_reel(entry: dict) -> dict:
    """ANTHROPIC_API_KEY가 있으면 Claude(#8), 없거나 실패하면 스텁.
    데모에서 "실패" 화면이 뜨지 않도록 AI 실패는 스텁으로 대체한다(팀 결정)."""
    if reel_ai.enabled():
        try:
            return reel_ai.build_reel(entry)
        except Exception:  # API 오류·거절·응답 검증 실패 모두 스텁으로
            logger.exception("Claude 장면 생성 실패, 스텁으로 대체: %s", entry["id"])
    else:
        delay = stub_delay_seconds()
        if delay > 0:
            time.sleep(delay)
    return build_reel(entry)


def generate_reel(entry_id: str) -> None:
    """백그라운드 작업: 릴스를 만들고 done/failed로 바꾼다."""
    entry = db.get_entry(entry_id)
    if entry is None:
        return
    try:
        db.finish_entry(entry_id, "done", make_reel(entry))
    except Exception:  # 어떤 오류든 "만드는 중"에 영원히 머물지 않게 failed 처리
        logger.exception("릴스 생성 실패: %s", entry_id)
        db.finish_entry(entry_id, "failed", None)


def _public(entry: dict) -> dict:
    out = {k: entry[k] for k in ("id", "date", "diary", "tags", "status", "reel")}
    if out["reel"] is not None:
        out["reel"] = {**out["reel"], "videoUrl": out["reel"].get("videoUrl")}  # 영상 합치기 전이면 null
    return out


def _summary(entry: dict) -> dict:
    return {
        "id": entry["id"],
        "date": entry["date"],
        "status": entry["status"],
        "thumbnailUrl": entry["thumbnail"] if entry["status"] == "done" else None,
    }


@router.get("/entries", response_model=None)
def list_entries(month: str | None = None) -> dict | JSONResponse:
    if not month or not _MONTH_RE.match(month):
        return _error(400, "invalid_date")
    return {"entries": [_summary(e) for e in db.list_month(month)]}


@router.get("/entries/{entry_id}", response_model=None)
def get_entry(entry_id: str) -> dict | JSONResponse:
    entry = db.get_entry(entry_id)
    if entry is None:
        return _error(404, "not_found")
    return _public(entry)


@router.post("/entries", status_code=202, response_model=None)
async def create_entry(
    background: BackgroundTasks,
    date_: Annotated[str | None, Form(alias="date")] = None,
    diary: Annotated[str, Form()] = "",
    # multipart에서 tags·files는 같은 키를 반복해서 보낸다: tags=festival&tags=calm
    tags: Annotated[list[str] | None, Form()] = None,
    files: Annotated[list[UploadFile] | None, File()] = None,
) -> dict | JSONResponse:
    d = _parse_date(date_)
    if d is None:
        return _error(400, "invalid_date")

    valid_tags = list(dict.fromkeys(t for t in (tags or []) if t in STYLE_IDS))
    if not valid_tags:
        return _error(400, "no_tag")

    uploads = [f for f in (files or []) if f.filename]
    if not uploads:
        return _error(400, "no_media")
    if len(uploads) > MAX_FILES:
        return _error(400, "too_many_media")

    # 하루 하나. 단, 생성에 실패(failed)한 날은 새로 올리면 덮어쓴다
    existing = db.get_by_date(d.isoformat())
    if existing and existing["status"] != "failed":
        return _error(409, "already_exists")

    try:
        media = await _save_uploads(uploads)
    except _UploadError as e:
        return _error(400, e.code)

    entry_id = f"e_{uuid.uuid4().hex[:12]}"
    try:
        # failed 기록 덮어쓰기는 삭제+삽입을 한 트랜잭션으로 (중간에 실패하면 기존 기록 유지)
        db.insert_entry(
            {
                "id": entry_id,
                "date": d.isoformat(),
                "diary": diary,
                "tags": valid_tags,
                "media": media,
                "thumbnail": next((m["url"] for m in media if m["type"] == "image"), None),
            },
            replace_failed_id=existing["id"] if existing else None,
        )
    except sqlite3.IntegrityError:  # 동시에 같은 날짜로 두 번 들어온 경우
        _delete_media(media)
        return _error(409, "already_exists")
    if existing:
        _delete_media(existing["media"])
        _delete_video(existing)

    background.add_task(generate_reel, entry_id)
    return {"id": entry_id, "date": d.isoformat(), "status": "processing"}


# ── 하나로 합친 릴스 영상 (#27) ─────────────────────────────────────────
# 브라우저가 완성된 릴스를 캔버스에 그리며 녹화한 파일을 올린다(서버 ffmpeg 합성은 무료 서버에서 너무 느림).
_VIDEO_EXT = {"video/mp4": ".mp4", "video/webm": ".webm"}


def _delete_video(entry: dict) -> None:
    url = (entry.get("reel") or {}).get("videoUrl")
    if url:
        (media_dir() / Path(url).name).unlink(missing_ok=True)


@router.post("/entries/{entry_id}/video", response_model=None)
async def upload_video(
    entry_id: str,
    file: Annotated[UploadFile | None, File()] = None,
) -> dict | JSONResponse:
    entry = db.get_entry(entry_id)
    if entry is None:
        return _error(404, "not_found")
    if entry["status"] != "done" or not entry["reel"]:
        return _error(409, "not_ready")
    if file is None or not file.filename:
        return _error(400, "no_media")
    # content_type의 코덱 부분(;codecs=...)은 떼고, 확장자는 서버가 정한다
    ext = _VIDEO_EXT.get((file.content_type or "").split(";")[0].strip().lower())
    if ext is None:
        return _error(400, "invalid_media")

    folder = media_dir()
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{uuid.uuid4().hex}{ext}"
    size = 0
    try:
        with path.open("wb") as out:
            while chunk := await file.read(_CHUNK):
                size += len(chunk)
                if size > MAX_FILE_BYTES:
                    raise _UploadError("file_too_large")
                out.write(chunk)
    except BaseException as e:
        path.unlink(missing_ok=True)
        if isinstance(e, _UploadError):
            return _error(400, e.code)
        raise
    if size == 0:
        path.unlink(missing_ok=True)
        return _error(400, "no_media")

    _delete_video(entry)  # 다시 녹화한 경우 예전 파일 정리
    video_url = f"/media/{path.name}"
    db.finish_entry(entry_id, "done", {**entry["reel"], "videoUrl": video_url})
    return {"videoUrl": video_url}


# ── 기록 삭제 — 그날 기록(사진·일기·릴스 영상)을 지우고 다시 올릴 수 있게 ──────────
@router.delete("/entries/{entry_id}", status_code=204, response_model=None)
def delete_entry(entry_id: str) -> Response | JSONResponse:
    entry = db.get_entry(entry_id)
    if entry is None:
        return _error(404, "not_found")
    # 생성 중이어도 지운다. 백그라운드 작업이 끝나도 finish_entry는 없는 id라 아무것도 하지 않는다
    db.delete_entry(entry_id)
    _delete_media(entry["media"])
    _delete_video(entry)
    return Response(status_code=204)
