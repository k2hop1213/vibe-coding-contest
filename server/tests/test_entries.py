import pytest
from fastapi.testclient import TestClient

from app import mock
from app.main import app

client = TestClient(app)

SCENE_KEYS = {"mediaUrl", "type", "durationMs", "caption", "transition"}


@pytest.fixture(autouse=True)
def _reset_created():
    mock._created.clear()
    yield
    mock._created.clear()


def _post(data=None, files=None):
    data = {"date": "2026-11-20", "diary": "오늘 축제", "tags": ["festival"]} if data is None else data
    files = [("files", ("a.jpg", b"x", "image/jpeg"))] if files is None else files
    return client.post("/api/entries", data=data, files=files)


def test_styles_has_7_tags_with_contract_fields():
    res = client.get("/api/styles")
    assert res.status_code == 200
    styles = res.json()["styles"]
    assert len(styles) == 7
    assert all(set(s) == {"id", "label", "emoji"} for s in styles)
    assert {"id": "festival", "label": "축제·MT", "emoji": "🎉"} in styles


def test_month_entries_shape_and_thumbnail_only_when_done():
    res = client.get("/api/entries", params={"month": "2026-11"})
    assert res.status_code == 200
    entries = res.json()["entries"]
    assert entries, "샘플 기록이 있어야 한다"
    for e in entries:
        assert set(e) == {"id", "date", "status", "thumbnailUrl"}
        assert e["date"].startswith("2026-11-")
        assert e["status"] in {"processing", "done", "failed"}
        assert (e["thumbnailUrl"] is not None) == (e["status"] == "done")


@pytest.mark.parametrize("month", [None, "2026-13", "2026-1", "abc"])
def test_month_invalid(month):
    res = client.get("/api/entries", params={"month": month} if month else {})
    assert res.status_code == 400
    assert res.json() == {"error": "invalid_date"}


def test_entry_detail_done_has_reel_scenes():
    res = client.get("/api/entries/e_2026-11-03")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"id", "date", "diary", "tags", "status", "reel"}
    assert body["status"] == "done"
    scenes = body["reel"]["scenes"]
    assert scenes and all(set(s) == SCENE_KEYS for s in scenes)
    assert all(s["transition"] in {"fade", "slide", "zoom"} for s in scenes)
    # 샘플 이미지가 실제로 서빙되는지
    assert client.get(scenes[0]["mediaUrl"]).status_code == 200


def test_entry_detail_not_done_has_null_reel():
    assert client.get("/api/entries/e_2026-11-09").json()["reel"] is None


@pytest.mark.parametrize("entry_id", ["nope", "e_2026-11-04", "e_2026-02-30"])
def test_entry_not_found(entry_id):
    res = client.get(f"/api/entries/{entry_id}")
    assert res.status_code == 404
    assert res.json() == {"error": "not_found"}


def test_create_returns_202_then_becomes_done(monkeypatch):
    res = _post()
    assert res.status_code == 202
    body = res.json()
    assert body["date"] == "2026-11-20" and body["status"] == "processing"

    detail = client.get(f"/api/entries/{body['id']}").json()
    assert detail["status"] == "processing" and detail["reel"] is None
    assert detail["tags"] == ["festival"]

    monkeypatch.setattr(mock, "PROCESSING_SECONDS", 0)
    detail = client.get(f"/api/entries/{body['id']}").json()
    assert detail["status"] == "done" and detail["reel"]["scenes"]

    month = client.get("/api/entries", params={"month": "2026-11"}).json()["entries"]
    assert any(e["id"] == body["id"] for e in month)


def test_create_accepts_multiple_tags():
    res = _post({"date": "2026-11-21", "tags": ["festival", "calm"]})
    assert res.status_code == 202
    assert client.get(f"/api/entries/{res.json()['id']}").json()["tags"] == ["festival", "calm"]


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
    ],
)
def test_create_validation_errors(data, files, code):
    res = _post(data, files)
    assert res.status_code == 400
    assert res.json() == {"error": code}


def test_create_conflict_one_per_day():
    assert _post({"date": "2026-11-03", "tags": ["festival"]}).status_code == 409  # 샘플 기록 있는 날
    assert _post().status_code == 202
    res = _post()
    assert res.status_code == 409
    assert res.json() == {"error": "already_exists"}
