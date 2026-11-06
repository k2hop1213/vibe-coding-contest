"""환경변수 설정. 테스트에서 바꿀 수 있게 호출할 때마다 읽는다."""

import os
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent


def database_path() -> Path:
    return Path(os.getenv("DATABASE_PATH") or SERVER_DIR / "haru.db")


def media_dir() -> Path:
    return Path(os.getenv("MEDIA_DIR") or SERVER_DIR / "media")


def stub_delay_seconds() -> float:
    """AI 생성 스텁(#8 전)이 done이 되기까지 기다리는 시간. 프론트의 '만드는 중' 화면 확인용."""
    return float(os.getenv("STUB_DELAY_SECONDS") or "2")  # .env에 빈 값이어도 기본값
