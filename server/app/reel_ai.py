"""Claude로 릴스 편집 플랜 생성 (#8, #31 — docs/REELS_TEMPLATES.md §3).

일기 + 사진(이미지 입력) + 스타일 태그(분위기 힌트)를 Claude에 보내 편집 플랜 JSON을 받는다.
- 응답 형식은 structured outputs(json_schema)로 고정하고, app/reel_plan.normalize로 한 번 더 검증·보정한다.
- 검증 실패 시 1회 재시도. 그래도 안 되면 ReelAIError → 호출부(entries)가 스텁으로 대체한다.
- 동영상은 프레임을 뽑지 않고 "영상 #n"이라는 텍스트로만 알려준다(ffmpeg 의존성 회피).
"""

import base64
import io
import json
import logging
import os
from pathlib import Path

import anthropic
from PIL import Image, UnidentifiedImageError

from app import reel_plan
from app.config import media_dir
from app.styles import STYLES

logger = logging.getLogger(__name__)

MODEL = "claude-opus-5-5"
MAX_IMAGE_SIDE = 1568  # 긴 변 기준. 이보다 크면 API 쪽에서 어차피 줄이므로 미리 줄여 업로드량 절약
SAMPLE_MEDIA_DIR = Path(__file__).parent / "sample_media"


class ReelAIError(Exception):
    pass


def enabled() -> bool:
    """Anthropic 키(ANTHROPIC_API_KEY) 또는 BAZE 게이트웨이 키(ANTHROPIC_AUTH_TOKEN)가 있으면 Claude 사용.
    BAZE는 ANTHROPIC_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/gateway/claude 와 함께 쓴다(SDK가 자동으로 읽음)."""
    return bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"))


# 스타일 태그 = 분위기 힌트 (템플릿 선택·자막 말투에만 영향. 컷 길이·전환은 템플릿이 정함)
STYLE_HINTS = {
    "vlog": "담담하고 따뜻한 1인칭 독백체(~했다, ~네). 감정·생각 위주면 emotional이 어울림",
    "energetic": "짧고 힘찬 문장, 느낌표 OK. 사진이 많으면 montage가 어울림",
    "exam": "자조적이고 웃픈 말투(~각, ~중). 하루 일과 나열이면 review가 어울림",
    "festival": "들뜬 반말, 이모지 1개까지. 장소·풍경 사진이 많으면 montage, 여러 부스·가게면 review",
    "calm": "시처럼 짧고 여백 있는 문장. emotional이 어울림",
    "meme": "인터넷 밈 말투, 과장과 반전. 음식·물건 하나면 closeup, 여러 곳이면 review",
    "retro": "옛날 일기장·필름카메라 감성의 예스러운 말투. emotional이 어울림",
}

SYSTEM_PROMPT = f"""너는 대학생의 하루 기록(일기 + 사진/영상)을 인스타그램 릴스로 편집하는 편집자다.
일기와 미디어를 보고 4개 템플릿 중 하나를 골라 지정된 JSON 스키마로 편집 플랜을 만든다.

템플릿 선택 기준:
- 감정·생각 표현이 중심 → emotional (컷 2.5초, 컷마다 한글 자막 + 영어 번역, 중간에 사진 빠르게 넘기는 플래시 몽타주)
- 장소 하나 + 풍경 사진 다수 → montage (컷 1초, 영상 내내 고정 제목: 장소명 영문 대문자 + 한글 부제)
- 여러 장소/가게, 먹거나 한 것 나열 → review (컷 1초, 고정 제목은 "도시 [동네]" 형식 예: 서울 [성수]·수원 [인계동] — "지역"이라는 단어를 그대로 쓰지 말 것, 한 줄 요약 부제, 컷마다 구어체 자막)
- 음식·물건 하나에 집중 → closeup (컷 0.8초, 고정 텍스트 3줄: 장소\n대상\n한마디)

규칙:
- clips에는 미디어 번호(mediaIndex, 0부터)를 순서대로 넣는다. 올린 미디어는 모두 한 번 이상 쓰고, 흐름이 좋게 순서를 바꿔도 된다.
- 총 길이는 10~{int(reel_plan.MAX_TOTAL_S)}초(클립 수 × 컷 길이). 미디어가 적으면 같은 미디어를 반복해도 된다.
- caption은 emotional·review에서만 쓴다. {reel_plan.MAX_CAPTION}자 이내의 자연스러운 구어체로, 일기를 그대로 복사하지 말고 요약한다. 다른 템플릿은 null.
- captionEn은 emotional에서만, caption의 자연스러운 영어 번역({reel_plan.MAX_CAPTION_EN}자 이내). 다른 템플릿은 null.
- fixedText는 montage·review·closeup에서 필수, emotional은 null.
- flashMontage는 emotional이고 사진이 {reel_plan.FLASH_MIN}장 이상일 때만. mediaIndexes에 사진 {reel_plan.FLASH_MIN}~{reel_plan.FLASH_MAX}장, startIndex는 전체 클립의 15~20% 지점. 아니면 null.
- 사진에 없는 사실을 지어내지 않는다. 장소를 모르면 일기에서 추론하고, 그래도 모르면 캠퍼스·학교 등으로 쓴다.
- bgmBpm은 컷 길이에 맞춘다(1초 컷 120, 0.8초 컷 150, 2.5초 컷 90 근처)."""

_NULLABLE_STR = {"type": ["string", "null"]}
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "template": {"type": "string", "enum": list(reel_plan.TEMPLATES)},
        "bgmBpm": {"type": "integer"},
        "fixedText": {
            "anyOf": [
                {
                    "type": "object",
                    "properties": {"title": {"type": "string"}, "subtitle": _NULLABLE_STR},
                    "required": ["title", "subtitle"],
                    "additionalProperties": False,
                },
                {"type": "null"},
            ]
        },
        "clips": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "mediaIndex": {"type": "integer"},
                    "caption": _NULLABLE_STR,
                    "captionEn": _NULLABLE_STR,
                },
                "required": ["mediaIndex", "caption", "captionEn"],
                "additionalProperties": False,
            },
        },
        "flashMontage": {
            "anyOf": [
                {
                    "type": "object",
                    "properties": {
                        "startIndex": {"type": "integer"},
                        "mediaIndexes": {"type": "array", "items": {"type": "integer"}},
                    },
                    "required": ["startIndex", "mediaIndexes"],
                    "additionalProperties": False,
                },
                {"type": "null"},
            ]
        },
    },
    "required": ["template", "bgmBpm", "fixedText", "clips", "flashMontage"],
    "additionalProperties": False,
}


def _media_path(url: str) -> Path:
    name = Path(url).name
    return SAMPLE_MEDIA_DIR / name if url.startswith("/media/sample/") else media_dir() / name


def _image_block(path: Path) -> dict | None:
    """JPEG로 다시 인코딩(긴 변 MAX_IMAGE_SIDE). Pillow가 못 여는 형식(SVG·HEIC 등)은 None."""
    try:
        with Image.open(path) as img:
            img = img.convert("RGB")
            img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
    except (UnidentifiedImageError, OSError):
        return None
    data = base64.standard_b64encode(buf.getvalue()).decode("ascii")
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}}


def build_messages(entry: dict) -> list[dict]:
    content: list[dict] = []
    for i, m in enumerate(entry["media"]):
        block = _image_block(_media_path(m["url"])) if m["type"] == "image" else None
        if block:
            content.append({"type": "text", "text": f"[미디어 #{i}] 사진"})
            content.append(block)
        else:
            kind = "영상" if m["type"] == "video" else "사진(미리보기 불가)"
            content.append({"type": "text", "text": f"[미디어 #{i}] {kind}"})

    labels = {s["id"]: f'{s["emoji"]} {s["label"]}' for s in STYLES}
    hints = "\n".join(f"- {labels[t]}: {STYLE_HINTS[t]}" for t in entry["tags"] if t in STYLE_HINTS)
    photos = sum(1 for m in entry["media"] if m["type"] == "image")
    content.append(
        {
            "type": "text",
            "text": (
                f"날짜: {entry['date']}\n"
                f"일기:\n{entry['diary'] or '(일기 없음 — 사진만 보고 써 줘)'}\n\n"
                f"분위기 힌트(사용자가 고른 스타일 태그, 첫 번째가 주 분위기):\n{hints or '- (없음)'}\n\n"
                f"미디어는 #0 ~ #{len(entry['media']) - 1} 총 {len(entry['media'])}개 (사진 {photos}장)."
            ),
        }
    )
    return [{"role": "user", "content": content}]


def validate(plan: dict, entry: dict) -> dict:
    """Claude 응답 → 계약의 reel 모양. 고칠 수 없는 형식 오류는 ReelAIError(재요청)."""
    try:
        return reel_plan.normalize(plan, entry["media"])
    except reel_plan.PlanError as e:
        raise ReelAIError(str(e)) from e


def _client() -> anthropic.Anthropic:
    # 데모 중 "만드는 중"이 길어지지 않게: 최악(30초 × 2회 × 검증 재시도 2회)에도 2분 안에 스텁으로 넘어간다.
    # 실측(BAZE 게이트웨이, 사진 2장): 약 5초
    # .env에 빈 값(ANTHROPIC_BASE_URL=)이 있으면 SDK가 주소를 ""로 쓰므로 빈 값은 기본값/None으로 바꾼다.
    # SDK는 api_key와 auth_token을 동시에 받지 않으므로(ValueError) 하나만 넘긴다: BAZE 토큰 우선.
    token = os.getenv("ANTHROPIC_AUTH_TOKEN") or None
    key = os.getenv("ANTHROPIC_API_KEY") or None
    if token and key:
        logger.warning("ANTHROPIC_AUTH_TOKEN과 ANTHROPIC_API_KEY가 둘 다 있어 AUTH_TOKEN(BAZE)만 씁니다")
        key = None
    return anthropic.Anthropic(
        base_url=os.getenv("ANTHROPIC_BASE_URL") or "https://api.anthropic.com",
        api_key=key,
        auth_token=token,
        timeout=30.0,
        max_retries=1,
    )


def _request(client: anthropic.Anthropic, messages: list[dict]) -> dict:
    response = client.beta.messages.create(
        model=os.getenv("CLAUDE_MODEL") or MODEL,
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=messages,
        # 짧은 창작 작업이라 effort는 low — 데모에서 생성 대기 시간을 줄인다
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": RESPONSE_SCHEMA}},
        # 안전 분류기가 거절하면 서버가 대체 모델로 다시 실행 (거절 범주에 맞춰 자동 선택)
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        raise ReelAIError(f"거절됨: {getattr(response.stop_details, 'category', None)}")
    if response.stop_reason == "max_tokens":
        raise ReelAIError("max_tokens에서 잘림")
    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is None:
        raise ReelAIError("text 블록 없음")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ReelAIError(f"JSON 아님: {e}") from e


def build_reel(entry: dict, client: anthropic.Anthropic | None = None) -> dict:
    """편집 플랜 생성. 응답 검증 실패는 1회 재시도. API 오류(키·네트워크·429 등)는 SDK가 재시도한 뒤 그대로 올라온다."""
    client = client or _client()
    messages = build_messages(entry)
    last: ReelAIError | None = None
    for attempt in range(2):
        try:
            return validate(_request(client, messages), entry)
        except ReelAIError as e:
            logger.warning("릴스 편집 플랜 검증 실패 (%d/2): %s", attempt + 1, e)
            last = e
    raise last  # type: ignore[misc]
