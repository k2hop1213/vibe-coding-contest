import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import entries
from app.main import app

client = TestClient(app)

CLIP_KEYS = {"mediaUrl", "type", "caption", "captionEn"}
REEL_KEYS = {"template", "clipDuration", "bgmBpm", "fixedText", "clips", "flashMontage", "videoUrl"}
JPG = ("files", ("a.jpg", b"\xff\xd8fakejpeg", "image/jpeg"))
MP4 = ("files", ("b.MP4", b"fakemp4", "video/mp4"))


def _runs(clips):
    """연속으로 반복된 같은 미디어를 하나로 (서버는 짧은 릴스를 0000011111처럼 늘린다)"""
    return [c for i, c in enumerate(clips) if i == 0 or clips[i - 1]["mediaUrl"] != c["mediaUrl"]]


def _post(data=None, files=None):
    if data is None:
        data = {"date": "2026-11-20", "diary": "축제 첫날! 공연까지 봤다.", "tags": ["festival"]}
    return client.post("/api/entries", data=data, files=[JPG] if files is None else files)


def _media_files() -> set[str]:
    return set(os.listdir(os.environ["MEDIA_DIR"]))


def test_styles_has_7_tags_with_contract_fields():
    res = client.get("/api/styles")
    assert res.status_code == 200
    styles = res.json()["styles"]
    assert len(styles) == 7
    assert all(set(s) == {"id", "label", "emoji"} for s in styles)
    assert {"id": "festival", "label": "축제·MT", "emoji": "🎉"} in styles


def test_create_saves_media_and_builds_reel_from_uploads():
    res = _post(files=[JPG, MP4])
    assert res.status_code == 202
    body = res.json()
    assert set(body) == {"id", "date", "status"}
    assert body["date"] == "2026-11-20" and body["status"] == "processing"

    # TestClient는 백그라운드 작업까지 끝낸 뒤 돌려준다 (스텁 대기 0초)
    detail = client.get(f"/api/entries/{body['id']}").json()
    assert set(detail) == {"id", "date", "diary", "tags", "status", "reel"}
    assert detail["status"] == "done"
    assert detail["tags"] == ["festival"]
    assert detail["diary"] == "축제 첫날! 공연까지 봤다."

    reel = detail["reel"]
    assert set(reel) == REEL_KEYS
    assert reel["template"] == "montage"  # 스텁: festival 힌트 → montage
    clips = reel["clips"]
    assert all(set(c) == CLIP_KEYS for c in clips)
    shots = _runs(clips)  # 연속된 같은 미디어는 한 컷
    assert [c["type"] for c in shots] == ["image", "video"]
    assert shots[1]["mediaUrl"].endswith(".mp4")
    assert len(clips) * reel["clipDuration"] >= 10, "총 길이 10초 이상"
    scenes = clips

    # 올린 파일이 /media로 그대로 서빙된다
    served = client.get(scenes[0]["mediaUrl"])
    assert served.status_code == 200 and served.content == b"\xff\xd8fakejpeg"


def test_month_list_from_db_with_thumbnail():
    assert client.get("/api/entries", params={"month": "2026-11"}).json() == {"entries": []}
    a = _post().json()
    _post({"date": "2026-12-01", "tags": ["calm"]})

    listed = client.get("/api/entries", params={"month": "2026-11"}).json()["entries"]
    assert len(listed) == 1
    e = listed[0]
    assert set(e) == {"id", "date", "status", "thumbnailUrl"}
    assert e["id"] == a["id"] and e["status"] == "done"
    assert e["thumbnailUrl"].startswith("/media/")


def test_thumbnail_null_while_processing_and_for_video_only(monkeypatch):
    monkeypatch.setattr(entries, "generate_reel", lambda entry_id: None)  # 생성 안 끝난 상태
    _post()
    e = client.get("/api/entries", params={"month": "2026-11"}).json()["entries"][0]
    assert e["status"] == "processing" and e["thumbnailUrl"] is None
    assert client.get(f"/api/entries/{e['id']}").json()["reel"] is None


def test_generation_failure_marks_failed(monkeypatch):
    def boom(entry):
        raise RuntimeError("AI 실패")

    monkeypatch.setattr(entries, "build_reel", boom)
    entry_id = _post().json()["id"]
    detail = client.get(f"/api/entries/{entry_id}").json()
    assert detail["status"] == "failed" and detail["reel"] is None


def test_entries_survive_new_connection():
    """메모리가 아니라 SQLite에 저장된다"""
    entry_id = _post().json()["id"]
    assert Path(os.environ["DATABASE_PATH"]).exists()
    assert TestClient(app).get(f"/api/entries/{entry_id}").status_code == 200


@pytest.mark.parametrize("month", [None, "2026-13", "2026-00", "2026-1", "abc"])
def test_month_invalid(month):
    res = client.get("/api/entries", params={"month": month} if month else {})
    assert res.status_code == 400
    assert res.json() == {"error": "invalid_date"}


def test_entry_not_found():
    res = client.get("/api/entries/e_nope")
    assert res.status_code == 404
    assert res.json() == {"error": "not_found"}


def test_create_conflict_one_per_day():
    assert _post().status_code == 202
    before = _media_files()
    res = _post()
    assert res.status_code == 409
    assert res.json() == {"error": "already_exists"}
    assert _media_files() == before, "409면 파일을 저장하지 않는다"


@pytest.mark.parametrize(
    ("data", "files", "code"),
    [
        ({"tags": ["festival"]}, None, "invalid_date"),
        ({"date": "2026-02-30", "tags": ["festival"]}, None, "invalid_date"),
        ({"date": "20261120", "tags": ["festival"]}, None, "invalid_date"),
        ({"date": "2026-11-20"}, None, "no_tag"),
        ({"date": "2026-11-20", "tags": ["unknown"]}, None, "no_tag"),
        ({"date": "2026-11-20", "tags": ["festival"]}, [], "no_media"),
        (
            {"date": "2026-11-20", "tags": ["festival"]},
            [("files", (f"{i}.jpg", b"x", "image/jpeg")) for i in range(11)],
            "too_many_media",
        ),
        (
            {"date": "2026-11-20", "tags": ["festival"]},
            [JPG, ("files", ("x.pdf", b"%PDF", "application/pdf"))],
            "invalid_media",
        ),
    ],
)
def test_create_validation_errors(data, files, code):
    before = _media_files()
    res = _post(data, files)
    assert res.status_code == 400
    assert res.json() == {"error": code}
    assert _media_files() == before


def test_file_too_large_removes_partial_files(monkeypatch):
    monkeypatch.setattr(entries, "MAX_FILE_BYTES", 10)
    before = _media_files()
    files = [("files", ("ok.jpg", b"small", "image/jpeg")), ("files", ("big.jpg", b"x" * 11, "image/jpeg"))]
    res = _post(files=files)
    assert res.status_code == 400
    assert res.json() == {"error": "file_too_large"}
    assert _media_files() == before
    # 실패한 날짜는 다시 올릴 수 있다
    assert _post().status_code == 202


def test_failed_day_can_be_recreated(monkeypatch):
    """failed인 날은 409가 아니라 새로 만든다 (예전 파일은 지움)"""
    real_build = entries.build_reel
    fail = {"on": True}

    def flaky(entry):
        if fail["on"]:
            raise RuntimeError("AI 실패")
        return real_build(entry)

    monkeypatch.setattr(entries, "build_reel", flaky)
    old_id = _post().json()["id"]
    assert client.get(f"/api/entries/{old_id}").json()["status"] == "failed"
    files_after_fail = _media_files()

    fail["on"] = False
    res = _post()
    assert res.status_code == 202
    new_id = res.json()["id"]
    assert new_id != old_id
    assert client.get(f"/api/entries/{old_id}").status_code == 404
    assert client.get(f"/api/entries/{new_id}").json()["status"] == "done"
    month = client.get("/api/entries", params={"month": "2026-11"}).json()["entries"]
    assert [e["id"] for e in month] == [new_id]
    assert len(_media_files()) == len(files_after_fail), "예전 파일 1개 삭제 + 새 파일 1개"


def test_wrong_field_type_returns_contract_error_format():
    res = client.post("/api/entries", data={"date": "2026-11-20", "tags": ["festival"], "files": "notafile"})
    assert res.status_code == 400
    assert res.json() == {"error": "invalid_request"}


@pytest.mark.parametrize(
    ("name", "ctype"),
    [
        ("x.html", "image/png"),  # 확장자 위조 → stored XSS (리뷰 재현 케이스)
        ("x.svg", "image/svg+xml"),  # SVG는 스크립트 실행 가능
        ("x.heic", "image/heic"),  # Chrome <img>가 못 그림
        ("noext", "image/jpeg"),
        ("x.mp4", "image/jpeg"),  # 종류와 확장자 불일치
    ],
)
def test_rejects_unsafe_or_unsupported_media(name, ctype):
    before = _media_files()
    res = _post(files=[("files", (name, b"<script>alert(1)</script>", ctype))])
    assert res.status_code == 400
    assert res.json() == {"error": "invalid_media"}
    assert _media_files() == before


def test_media_served_with_nosniff_and_allowed_ext_kept():
    res = _post(files=[("files", ("photo.JPEG", b"\xff\xd8x", "image/jpeg")), MP4])
    scenes = _runs(client.get(f"/api/entries/{res.json()['id']}").json()["reel"]["clips"])
    assert scenes[0]["mediaUrl"].endswith(".jpeg") and scenes[1]["mediaUrl"].endswith(".mp4")
    served = client.get(scenes[0]["mediaUrl"])
    assert served.headers["x-content-type-options"] == "nosniff"
    assert served.headers["content-type"] == "image/jpeg"


def test_startup_marks_stale_processing_as_failed(monkeypatch):
    """서버가 생성 도중 재시작되면 processing에 갇히지 않고 failed → 다시 올릴 수 있다"""
    monkeypatch.setattr(entries, "generate_reel", lambda entry_id: None)
    entry_id = _post().json()["id"]
    with TestClient(app):  # lifespan(시작 처리) 실행
        pass
    assert client.get(f"/api/entries/{entry_id}").json()["status"] == "failed"
    assert _post().status_code == 202, "failed가 됐으니 같은 날 다시 올릴 수 있다"


def test_replace_failed_is_atomic(monkeypatch):
    """삭제+삽입 중 삽입이 실패하면 기존 failed 기록은 그대로 남는다(롤백)"""
    import sqlite3

    from app import db

    monkeypatch.setattr(entries, "build_reel", lambda entry: (_ for _ in ()).throw(RuntimeError("x")))
    failed_id = _post().json()["id"]
    row = {"id": "e_dup", "date": "2026-11-20", "diary": "", "tags": ["festival"], "media": [], "thumbnail": None}
    db.insert_entry({**row, "id": "e_other", "date": "2026-11-21"})
    with pytest.raises(sqlite3.IntegrityError):  # PK 충돌로 삽입 실패
        db.insert_entry({**row, "id": "e_other"}, replace_failed_id=failed_id)
    assert db.get_entry(failed_id)["status"] == "failed"
