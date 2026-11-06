from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import db, seed
from app.main import app

client = TestClient(app)
TODAY = date(2026, 11, 20)


def test_seed_dates_skip_today_and_every_third_day():
    days = seed.seed_dates(TODAY, 4)
    assert TODAY not in days
    assert days == [date(2026, 11, 19), date(2026, 11, 18), date(2026, 11, 16), date(2026, 11, 15)]


def test_seed_creates_done_entries_with_served_thumbnails(tmp_path):
    assert seed.seed(today=TODAY, work_dir=tmp_path / "w") == len(seed.SEEDS)

    listed = client.get("/api/entries", params={"month": "2026-11"}).json()["entries"]
    assert listed and all(e["status"] == "done" for e in listed)
    assert "2026-11-20" not in {e["date"] for e in listed}, "오늘은 발표 때 직접 만든다"

    thumb = client.get(listed[0]["thumbnailUrl"])
    assert thumb.status_code == 200 and thumb.headers["content-type"] == "image/jpeg"

    detail = client.get(f"/api/entries/{listed[0]['id']}").json()
    assert len(detail["reel"]["scenes"]) == seed.PHOTOS_PER_ENTRY
    assert detail["reel"]["title"]


def test_seed_is_idempotent_and_if_empty(tmp_path):
    seed.seed(today=TODAY, count=3, work_dir=tmp_path / "w")
    assert seed.seed(today=TODAY, count=3, work_dir=tmp_path / "w") == 0, "같은 날짜는 건너뛴다"
    assert seed.seed(today=TODAY, if_empty=True, work_dir=tmp_path / "w") == 0
    assert db.count_entries() == 3


def test_seed_uses_team_photos_folder(tmp_path):
    photos = tmp_path / "demo"
    photos.mkdir()
    seed.make_sample_photo(photos / "a.JPG", 1)
    (photos / "clip.mp4").write_bytes(b"fakemp4")
    (photos / "notes.txt").write_text("무시돼야 함")

    seed.seed(today=TODAY, count=1, photos_dir=photos, work_dir=tmp_path / "w")
    entry = db.list_month("2026-11")[0]
    assert [m["type"] for m in entry["media"]] == ["image", "video", "image"]  # a.JPG, clip.mp4 반복
    assert entry["thumbnail"].endswith(".jpg")


def test_seed_ai_requires_key(tmp_path):
    with pytest.raises(SystemExit):
        seed.seed(today=TODAY, use_ai=True, work_dir=tmp_path / "w")
