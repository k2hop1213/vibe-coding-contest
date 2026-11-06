"""릴스 편집 플랜 — docs/REELS_TEMPLATES.md §3 (#31).

Claude(app/reel_ai.py)와 스텁(app/reel_stub.py)이 만든 "인덱스 기반" 플랜을
여기서 한 번에 검증·보정하고 계약 모양(docs/planning.md `reel`)으로 바꾼다.

입력(인덱스 기반):
  {template, bgmBpm, fixedText: {title, subtitle} | null,
   clips: [{mediaIndex, caption, captionEn}], flashMontage: {startIndex, mediaIndexes} | null}
출력(계약):
  {template, clipDuration, bgmBpm, fixedText, clips: [{mediaUrl, type, caption, captionEn}],
   flashMontage: {startIndex, mediaUrls} | null}

형식이 틀려 고칠 수 없는 경우만 PlanError(→ Claude 재요청), 고칠 수 있는 건 서버가 보정한다.
"""

import math

TEMPLATES = ("emotional", "montage", "review", "closeup")
# 템플릿 기본 컷 길이(초) — 모델이 다른 값을 줘도 이 값을 쓴다
CLIP_DURATION = {"emotional": 2.5, "montage": 1.0, "review": 1.0, "closeup": 0.8}
MIN_TOTAL_S, MAX_TOTAL_S = 10.0, 30.0
FLASH_FRAME_S = 0.15
FLASH_MIN, FLASH_MAX = 6, 10  # 플래시 몽타주 사진 수. 사진이 6장 미만이면 몽타주 생략
MAX_CAPTION = 15  # 스펙: 15자 이내 (한글 기준)
MAX_CAPTION_HARD = 25  # 이보다 길면 재요청, 그 사이는 잘라서 사용
MAX_CAPTION_EN = 30  # planning.md v2 규칙
DEFAULT_BPM = 120
BPM_RANGE = (60, 180)

# 템플릿별로 쓰는 필드
USES_CAPTION = {"emotional", "review"}
NEEDS_FIXED_TEXT = {"montage", "review", "closeup"}


class PlanError(ValueError):
    pass


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _caption(value: object, *, where: str) -> str:
    text = _text(value)
    if len(text) > MAX_CAPTION_HARD:
        raise PlanError(f"{where} 자막이 너무 김({len(text)}자): {text}")
    return text[:MAX_CAPTION]


def _fixed_text(raw: object, template: str) -> dict | None:
    if template not in NEEDS_FIXED_TEXT:
        return None
    if not isinstance(raw, dict) or not _text(raw.get("title")):
        raise PlanError(f"{template}에는 fixedText.title이 필요")
    title = _text(raw["title"])
    if template == "closeup":
        lines = [line.strip() for line in title.split("\n") if line.strip()]
        if len(lines) != 3:
            raise PlanError(f"closeup title은 3줄(장소/대상/한마디)이어야 함: {title!r}")
        return {"title": "\n".join(lines), "subtitle": None}
    return {"title": title, "subtitle": _text(raw.get("subtitle")) or None}


def _flash(raw: object, media: list[dict], clip_count: int) -> dict | None:
    """emotional 전용. 사진(이미지)만, 중복 없이 6~10장. 모자라면 몽타주 생략."""
    if not isinstance(raw, dict):
        return None
    indexes = raw.get("mediaIndexes") or []
    seen: list[int] = []
    for i in indexes:
        if isinstance(i, int) and 0 <= i < len(media) and media[i]["type"] == "image" and i not in seen:
            seen.append(i)
    if len(seen) < FLASH_MIN:
        # 모델이 적게 골랐어도 사진이 충분하면 서버가 채운다
        for i, m in enumerate(media):
            if len(seen) >= FLASH_MIN:
                break
            if m["type"] == "image" and i not in seen:
                seen.append(i)
    if len(seen) < FLASH_MIN:
        return None
    start = raw.get("startIndex")
    start = start if isinstance(start, int) else clip_count // 5
    start = min(max(start, 0), max(clip_count - 1, 0))
    return {"startIndex": start, "mediaUrls": [media[i]["url"] for i in seen[:FLASH_MAX]]}


def normalize(plan: dict, media: list[dict]) -> dict:
    """인덱스 기반 플랜 → 계약 모양. 고칠 수 없는 오류는 PlanError."""
    if not media:
        raise PlanError("미디어 없음")
    template = plan.get("template")
    if template not in TEMPLATES:
        raise PlanError(f"알 수 없는 template: {template!r}")

    raw_clips = plan.get("clips")
    if not isinstance(raw_clips, list) or not raw_clips:
        raise PlanError("clips 없음")
    clips: list[dict] = []
    for n, c in enumerate(raw_clips):
        if not isinstance(c, dict):
            raise PlanError(f"clips[{n}] 형식 오류")
        i = c.get("mediaIndex")
        if not isinstance(i, int) or not 0 <= i < len(media):
            raise PlanError(f"clips[{n}].mediaIndex 범위 밖: {i!r} (미디어 {len(media)}개)")
        caption = _caption(c.get("caption"), where=f"clips[{n}]") if template in USES_CAPTION else ""
        if template in USES_CAPTION and not caption:
            raise PlanError(f"{template}에는 clips[{n}].caption이 필요")
        caption_en = _text(c.get("captionEn"))[:MAX_CAPTION_EN] if template == "emotional" else ""
        clips.append(
            {
                "mediaUrl": media[i]["url"],
                "type": media[i]["type"],
                "caption": caption or None,
                "captionEn": caption_en or None,
            }
        )

    # 올린 미디어가 하나도 빠지지 않게: 모델이 빠뜨린 미디어는 뒤에 붙인다(자막은 비움 → 템플릿이 caption을 쓰면 직전 자막 재사용)
    used = {c["mediaUrl"] for c in clips}
    for m in media:
        if m["url"] not in used:
            clips.append({"mediaUrl": m["url"], "type": m["type"], "caption": clips[-1]["caption"], "captionEn": None})

    duration = CLIP_DURATION[template]
    flash = _flash(plan.get("flashMontage"), media, len(clips)) if template == "emotional" else None
    flash_s = len(flash["mediaUrls"]) * FLASH_FRAME_S if flash else 0.0

    # 총 길이 10~30초: 길면 뒤에서 자르고, 짧으면 각 클립을 "제자리에서" 늘린다.
    # 0101.. 처럼 번갈아 반복하면 사진이 1초마다 깜빡이므로 0000011111처럼 같은 클립을 연속으로 둔다
    # → 합성기는 연속된 같은 미디어를 하나의 긴 컷(확대도 이어서)으로 그릴 수 있다.
    max_clips = max(1, int((MAX_TOTAL_S - flash_s) // duration))
    clips = clips[:max_clips]
    need = min(max_clips, max(len(clips), math.ceil((MIN_TOTAL_S - flash_s) / duration - 1e-9)))
    repeats = [need // len(clips) + (1 if i < need % len(clips) else 0) for i in range(len(clips))]
    block_start = [sum(repeats[:i]) for i in range(len(clips))]
    clips = [dict(c) for c, r in zip(clips, repeats, strict=True) for _ in range(r)]
    if flash:
        orig = min(flash["startIndex"], len(block_start) - 1)
        flash["startIndex"] = block_start[orig]  # 원래 가리키던 클립 묶음의 시작

    bpm = plan.get("bgmBpm")
    bpm = bpm if isinstance(bpm, int) and BPM_RANGE[0] <= bpm <= BPM_RANGE[1] else DEFAULT_BPM

    return {
        "template": template,
        "clipDuration": duration,
        "bgmBpm": bpm,
        "fixedText": _fixed_text(plan.get("fixedText"), template),
        "clips": clips,
        "flashMontage": flash,
    }


def total_seconds(reel: dict) -> float:
    flash = reel.get("flashMontage")
    return len(reel["clips"]) * reel["clipDuration"] + (len(flash["mediaUrls"]) * FLASH_FRAME_S if flash else 0.0)
