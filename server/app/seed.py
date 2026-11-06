"""데모용 시드 데이터 (#13) — 오늘 이전 날짜들에 '완성된' 기록을 채워 달력이 비어 보이지 않게 한다.

사용법 (server/ 에서):
    python -m app.seed                       # 자동 생성한 샘플 사진으로 10일치
    python -m app.seed --photos ../demo      # 팀이 직접 찍은 사진·영상 폴더로 (발표용)
    python -m app.seed --photos ../demo --ai # 장면 구성을 Claude로 (BAZE 토큰 또는 API 키 필요, 기록당 1회 호출)
    python -m app.seed --if-empty            # DB에 기록이 하나도 없을 때만 (배포 서버 시작 명령용)

- 오늘 날짜는 비워 둔다 → 발표 때 오늘 칸에서 바로 새 기록을 만든다.
- 이미 기록이 있는 날짜는 건너뛴다(여러 번 실행해도 안전).
- 사진은 반드시 팀이 직접 찍은 것만 쓴다(출처 문제 없게). 자동 생성 샘플은 직접 그린 그라데이션.
"""

import argparse
import itertools
import random
import shutil
import uuid
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageDraw

from app import db, reel_ai, reel_stub
from app.config import media_dir
from app.entries import _ALLOWED_EXT

# (일기, 태그) — 오늘에서 가까운 날부터 순서대로 쓴다
SEEDS: list[tuple[str, list[str]]] = [
    ("동아리 첫 공연 끝! 떨렸는데 다들 잘했다. 뒤풀이에서 웃다가 목이 쉼.", ["energetic"]),
    ("공강에 혼자 캠퍼스 한 바퀴. 은행나무가 진짜 노랗다.", ["calm"]),
    ("팀플 회의 3시간. 결론은 다음 주에 다시 모이기로 함.", ["meme"]),
    ("축제 둘째 날. 부스 음식 다 먹어보기 성공. 밤에 공연까지 봤다!", ["festival"]),
    ("축제 첫날! 친구들이랑 부스 돌고 사진 엄청 찍었다.", ["festival", "energetic"]),
    ("중간고사 마지막 날. 끝나자마자 학식으로 해방 기념.", ["exam"]),
    ("도서관 4층 창가 자리 사수. 오늘도 밤샘 각.", ["exam"]),
    ("비 오는 날 카페에서 과제하다가 창밖 구경만 한참.", ["vlog"]),
    ("교양 수업에서 필름카메라 써 봤다. 결과물은 다음 주에!", ["retro"]),
    ("개강 첫 주. 새 시간표, 새 강의실, 아직은 다 낯설다.", ["vlog", "calm"]),
]
PHOTOS_PER_ENTRY = 3
_PALETTE = [
    ("#ff7eb3", "#ff758c"), ("#43cea2", "#185a9d"), ("#f7971e", "#ffd200"), ("#654ea3", "#eaafc8"),
    ("#36d1dc", "#5b86e5"), ("#f953c6", "#b91d73"), ("#11998e", "#38ef7d"), ("#fc4a1a", "#f7b733"),
]


def seed_dates(today: date, count: int) -> list[date]:
    """오늘 이전 날짜 중 count개. 매일 꽉 차 보이지 않게 사흘에 하루는 비운다."""
    days: list[date] = []
    d = today - timedelta(days=1)
    while len(days) < count:
        if (today - d).days % 3 != 0:
            days.append(d)
        d -= timedelta(days=1)
    return days


def _hex(c: str) -> tuple[int, int, int]:
    return tuple(int(c[i : i + 2], 16) for i in (1, 3, 5))  # type: ignore[return-value]


def make_sample_photo(path: Path, seed: int) -> None:
    """직접 그린 세로 그라데이션 샘플 사진(720×1280 JPEG) — 외부 출처 없음"""
    rnd = random.Random(seed)
    top, bottom = (_hex(c) for c in _PALETTE[seed % len(_PALETTE)])
    img = Image.new("RGB", (720, 1280))
    draw = ImageDraw.Draw(img)
    for y in range(1280):
        t = y / 1279
        draw.line([(0, y), (720, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    for _ in range(4):
        x, y, r = rnd.randint(0, 720), rnd.randint(0, 1280), rnd.randint(80, 260)
        draw.ellipse([x - r, y - r, x + r, y + r], outline=(255, 255, 255), width=6)
    img.save(path, "JPEG", quality=85)


def _media_kind(path: Path) -> str | None:
    ext = path.suffix.lower()
    return next((k for k, exts in _ALLOWED_EXT.items() if ext in exts), None)


def _copy_media(src: Path, kind: str) -> dict:
    folder = media_dir()
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / f"{uuid.uuid4().hex}{src.suffix.lower()}"
    shutil.copyfile(src, dest)
    return {"url": f"/media/{dest.name}", "type": kind}


def _photo_source(photos_dir: Path | None, work_dir: Path):
    """사진 경로를 끝없이 돌려준다. 폴더가 없으면 샘플을 만들어서."""
    if photos_dir:
        files = sorted(p for p in photos_dir.iterdir() if p.is_file() and _media_kind(p))
        if not files:
            raise SystemExit(f"{photos_dir}에 jpg·png·webp·gif·mp4·mov·webm 파일이 없습니다")
        yield from itertools.cycle(files)
    for n in itertools.count():
        p = work_dir / f"sample_{n}.jpg"
        make_sample_photo(p, n)
        yield p


def seed(
    today: date | None = None,
    count: int = len(SEEDS),
    photos_dir: Path | None = None,
    use_ai: bool = False,
    if_empty: bool = False,
    work_dir: Path | None = None,
) -> int:
    """만든 기록 수를 돌려준다."""
    today = today or date.today()
    if if_empty and db.count_entries() > 0:
        return 0
    if use_ai and not reel_ai.enabled():
        raise SystemExit("--ai를 쓰려면 server/.env에 Claude 설정(ANTHROPIC_AUTH_TOKEN 또는 ANTHROPIC_API_KEY)이 필요합니다")

    work_dir = work_dir or media_dir() / ".seed_tmp"
    work_dir.mkdir(parents=True, exist_ok=True)
    photos = _photo_source(photos_dir, work_dir)
    created = 0
    try:
        for d, (diary, tags) in zip(seed_dates(today, count), itertools.cycle(SEEDS)):
            if db.get_by_date(d.isoformat()):
                continue
            media = []
            for _ in range(PHOTOS_PER_ENTRY):
                src = next(photos)
                media.append(_copy_media(src, _media_kind(src) or "image"))
            entry = {
                "id": f"e_{uuid.uuid4().hex[:12]}",
                "date": d.isoformat(),
                "diary": diary,
                "tags": tags,
                "media": media,
                "thumbnail": next((m["url"] for m in media if m["type"] == "image"), None),
            }
            reel = reel_ai.build_reel(entry) if use_ai else reel_stub.build_reel(entry)
            db.insert_entry(entry)
            db.finish_entry(entry["id"], "done", reel)
            created += 1
            print(f"  {d.isoformat()}  {tags[0]:<9} {reel['title']}")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
    return created


def main() -> None:
    from dotenv import load_dotenv

    load_dotenv()
    p = argparse.ArgumentParser(description="하루릴스 데모 시드 데이터")
    p.add_argument("--photos", type=Path, help="팀이 직접 찍은 사진·영상 폴더 (없으면 샘플 생성)")
    p.add_argument("--count", type=int, default=len(SEEDS), help="채울 날짜 수 (기본 10)")
    p.add_argument("--ai", action="store_true", help="장면 구성을 Claude로 (API 비용 발생)")
    p.add_argument("--if-empty", action="store_true", help="기록이 하나도 없을 때만 실행")
    args = p.parse_args()
    n = seed(count=args.count, photos_dir=args.photos, use_ai=args.ai, if_empty=args.if_empty)
    print(f"시드 완료: 기록 {n}개 추가")


if __name__ == "__main__":
    main()
