"""SQLite 저장소. 기록(entry) 하나 = 하루 하나 (date UNIQUE)."""

import json
import sqlite3
from contextlib import contextmanager

from app.config import database_path

SCHEMA = """
CREATE TABLE IF NOT EXISTS entries (
    id         TEXT PRIMARY KEY,
    date       TEXT NOT NULL UNIQUE,          -- YYYY-MM-DD
    diary      TEXT NOT NULL DEFAULT '',
    tags       TEXT NOT NULL,                 -- JSON 배열
    media      TEXT NOT NULL,                 -- JSON 배열 [{url, type}]
    status     TEXT NOT NULL CHECK (status IN ('processing', 'done', 'failed')),
    reel       TEXT,                          -- JSON (done일 때)
    thumbnail  TEXT,                          -- /media/.. (첫 이미지)
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

_JSON_COLUMNS = ("tags", "media", "reel")


@contextmanager
def connect():
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


def _row(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    entry = dict(row)
    for col in _JSON_COLUMNS:
        if entry[col] is not None:
            entry[col] = json.loads(entry[col])
    return entry


def insert_entry(entry: dict, replace_failed_id: str | None = None) -> None:
    """같은 날짜가 이미 있으면 sqlite3.IntegrityError.
    replace_failed_id: 같은 트랜잭션에서 먼저 지울 failed 기록 (실패하면 함께 롤백)."""
    with connect() as conn:
        if replace_failed_id:
            conn.execute("DELETE FROM entries WHERE id = ? AND status = 'failed'", (replace_failed_id,))
        conn.execute(
            "INSERT INTO entries (id, date, diary, tags, media, status, thumbnail)"
            " VALUES (?, ?, ?, ?, ?, 'processing', ?)",
            (
                entry["id"],
                entry["date"],
                entry["diary"],
                json.dumps(entry["tags"], ensure_ascii=False),
                json.dumps(entry["media"], ensure_ascii=False),
                entry["thumbnail"],
            ),
        )


def finish_entry(entry_id: str, status: str, reel: dict | None) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE entries SET status = ?, reel = ? WHERE id = ?",
            (status, json.dumps(reel, ensure_ascii=False) if reel else None, entry_id),
        )


def get_entry(entry_id: str) -> dict | None:
    with connect() as conn:
        return _row(conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone())


def get_by_date(date: str) -> dict | None:
    with connect() as conn:
        return _row(conn.execute("SELECT * FROM entries WHERE date = ?", (date,)).fetchone())


def delete_entry(entry_id: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM entries WHERE id = ?", (entry_id,))


def fail_stale_processing() -> int:
    """서버 시작 시: 백그라운드 작업은 재시작하면 사라지므로 processing으로 남은 기록을 failed로.
    failed는 다시 올리면 덮어쓸 수 있어 그 날짜가 409로 막히지 않는다."""
    with connect() as conn:
        return conn.execute("UPDATE entries SET status = 'failed' WHERE status = 'processing'").rowcount


def list_month(month: str) -> list[dict]:
    """month: YYYY-MM"""
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM entries WHERE date LIKE ? ORDER BY date", (f"{month}-%",)
        ).fetchall()
    return [_row(r) for r in rows]

