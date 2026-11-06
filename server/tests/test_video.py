import os

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
JPG = ("files", ("a.jpg", b"\xff\xd8x", "image/jpeg"))


def _done_entry() -> str:
    res = client.post("/api/entries", data={"date": "2026-11-20", "tags": ["festival"]}, files=[JPG])
    return res.json()["id"]


def _upload(entry_id, content=b"\x00\x00\x00\x18ftypmp42", ctype="video/mp4", name="reel.mp4"):
    return client.post(f"/api/entries/{entry_id}/video", files={"file": (name, content, ctype)})


def test_detail_has_null_video_until_uploaded():
    entry_id = _done_entry()
    assert client.get(f"/api/entries/{entry_id}").json()["reel"]["videoUrl"] is None


@pytest.mark.parametrize("ctype", ["video/mp4", "video/webm;codecs=vp9", "video/mp4;codecs=avc1.42E01E"])
def test_upload_video_sets_video_url_and_serves_it(ctype):
    entry_id = _done_entry()
    res = _upload(entry_id, ctype=ctype)
    assert res.status_code == 200
    url = res.json()["videoUrl"]
    assert url.startswith("/media/") and url.endswith(".webm" if "webm" in ctype else ".mp4")
    assert client.get(f"/api/entries/{entry_id}").json()["reel"]["videoUrl"] == url
    served = client.get(url)
    assert served.status_code == 200 and served.headers["content-type"].startswith(ctype.split(";")[0])


def test_reupload_replaces_old_file():
    entry_id = _done_entry()
    old = _upload(entry_id).json()["videoUrl"]
    new = _upload(entry_id).json()["videoUrl"]
    assert old != new
    assert not os.path.exists(os.path.join(os.environ["MEDIA_DIR"], os.path.basename(old)))


@pytest.mark.parametrize(
    ("kwargs", "status", "code"),
    [
        ({"ctype": "text/html", "name": "x.html"}, 400, "invalid_media"),
        ({"ctype": "image/png", "name": "x.mp4"}, 400, "invalid_media"),
        ({"content": b""}, 400, "no_media"),
    ],
)
def test_upload_rejects_bad_files(kwargs, status, code):
    entry_id = _done_entry()
    before = set(os.listdir(os.environ["MEDIA_DIR"]))
    res = _upload(entry_id, **kwargs)
    assert res.status_code == status and res.json() == {"error": code}
    assert set(os.listdir(os.environ["MEDIA_DIR"])) == before


def test_upload_too_large(monkeypatch):
    from app import entries

    monkeypatch.setattr(entries, "MAX_FILE_BYTES", 10)
    res = _upload(_done_entry(), content=b"x" * 11)
    assert res.status_code == 400 and res.json() == {"error": "file_too_large"}


def test_upload_not_found_and_not_ready(monkeypatch):
    assert _upload("e_nope").json() == {"error": "not_found"}
    from app import entries

    monkeypatch.setattr(entries, "generate_reel", lambda entry_id: None)  # processing에 머무름
    entry_id = client.post(
        "/api/entries", data={"date": "2026-11-21", "tags": ["festival"]}, files=[JPG]
    ).json()["id"]
    res = _upload(entry_id)
    assert res.status_code == 409 and res.json() == {"error": "not_ready"}
