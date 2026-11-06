import os
import tempfile

import pytest

# app을 import하기 전에 설정 — 업로드 폴더는 /media 마운트 때문에 세션 전체에서 하나
os.environ["MEDIA_DIR"] = tempfile.mkdtemp(prefix="haru-media-")
os.environ["STUB_DELAY_SECONDS"] = "0"


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    """테스트마다 빈 DB"""
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
