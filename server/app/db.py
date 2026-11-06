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


def insert_entry(entry: dict) -> None:
    """같은 날짜가 이미 있으면 sqlite3.IntegrityError."""
    with connect() as conn:
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


def date_exists(date: str) -> bool:
    with connect() as conn:
        return conn.execute("SELECT 1 FROM entries WHERE date = ?", (date,)).fetchone() is not None


def list_month(month: str) -> list[dict]:
    """month: YYYY-MM"""
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM entries WHERE date LIKE ? ORDER BY date", (f"{month}-%",)
        ).fetchall()
    return [_row(r) for r in rows]
