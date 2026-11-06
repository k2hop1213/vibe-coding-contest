from fastapi.testclient import TestClient

from app import db, entries
from app.config import media_dir
from app.main import app

client = TestClient(app)
JPG = ("files", ("a.jpg", b"\xff\xd8x", "image/jpeg"))


def _create(date="2026-11-20"):
    res = client.post("/api/entries", data={"date": date, "tags": ["festival"]}, files=[JPG])
    assert res.status_code == 202
    return res.json()["id"]


def _files() -> set[str]:
    return {p.name for p in media_dir().glob("*")} if media_dir().exists() else set()


def test_delete_removes_entry_media_and_video_then_date_is_free():
    before = _files()
    entry_id = _create()
    video = client.post(
        f"/api/entries/{entry_id}/video", files={"file": ("r.mp4", b"\x00\x00\x00\x18ftypmp42", "video/mp4")}
    )
    assert video.status_code == 200
    assert len(_files() - before) == 2  # 사진 + 합친 영상

    res = client.delete(f"/api/entries/{entry_id}")
    assert res.status_code == 204
    assert client.get(f"/api/entries/{entry_id}").status_code == 404
    assert client.get("/api/entries?month=2026-11").json()["entries"] == []
    assert _files() - before == set()  # 파일도 지워짐

    # 같은 날짜로 다시 올릴 수 있다 (409 아님)
    assert client.post("/api/entries", data={"date": "2026-11-20", "tags": ["calm"]}, files=[JPG]).status_code == 202


def test_delete_unknown_is_404():
    res = client.delete("/api/entries/e_nope")
    assert res.status_code == 404
    assert res.json() == {"error": "not_found"}


def test_generation_finishing_after_delete_does_not_resurrect(monkeypatch):
    # 생성 중에 지운 뒤 백그라운드 작업이 끝나도 기록이 다시 생기지 않는다
    monkeypatch.setattr(entries, "generate_reel", lambda _id: None)  # 202 직후 자동 생성 막기
    entry_id = _create("2026-11-21")
    entry = db.get_entry(entry_id)
    assert client.delete(f"/api/entries/{entry_id}").status_code == 204
    db.finish_entry(entry_id, "done", entries.make_reel(entry))
    assert db.get_entry(entry_id) is None
