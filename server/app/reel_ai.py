"""#8 Claude로 릴스 장면 구성 생성.

일기 + 스타일 태그 + 사진(이미지 입력)을 Claude에 보내 장면 구성 JSON을 받는다.
- 응답 형식은 structured outputs(json_schema)로 고정하고, 서버에서 한 번 더 검증한다.
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

from app.config import media_dir
from app.styles import STYLES

logger = logging.getLogger(__name__)

MODEL = "claude-opus-5-5"
MAX_IMAGE_SIDE = 1568  # 긴 변 기준. 이보다 크면 API 쪽에서 어차피 줄이므로 미리 줄여 업로드량 절약
MIN_SCENE_MS, MAX_SCENE_MS = 800, 6000
MAX_CAPTION = 40
TRANSITIONS = ("fade", "slide", "zoom")
SAMPLE_MEDIA_DIR = Path(__file__).parent / "sample_media"


class ReelAIError(Exception):
    pass


def enabled() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY"))


# 태그별 연출 규칙 — 같은 사진도 태그에 따라 전혀 다른 분위기가 나오게 하는 핵심
STYLE_RULES = {
    "vlog": "감성 브이로그. 담담하고 따뜻한 1인칭 독백체(~했다, ~네). 장면당 2500~3500ms. 전환은 주로 fade, 가끔 slide.",
    "energetic": "에너지 넘치는. 짧고 힘찬 문장, 느낌표, 의성어 OK. 장면당 900~1500ms로 빠르게. 전환은 zoom과 slide를 번갈아.",
    "exam": "시험기간 생존기. 자조적이고 웃픈 말투(~각, ~중, D-day 표현). 장면당 1800~2500ms. 전환은 slide 위주.",
    "festival": "축제·MT. 들뜬 반말, 이모지 1개까지 허용. 장면당 1200~1800ms. 전환은 zoom 위주, 가끔 slide.",
    "calm": "잔잔한 슬라이드쇼. 시처럼 짧고 여백 있는 문장. 장면당 3500~5000ms로 느리게. 전환은 fade만.",
    "meme": "밈·유머. 인터넷 밈 말투, 과장과 반전 드립. 장면당 1200~2000ms. 전환은 zoom과 slide.",
    "retro": "레트로 필름. 옛날 일기장/필름카메라 감성, 조금 예스러운 말투. 장면당 3000~4000ms. 전환은 fade만.",
}

SYSTEM_PROMPT = """너는 대학생의 하루 기록(일기 + 사진/영상)을 세로 릴스로 연출하는 편집자다.
주어진 미디어를 모두 한 번씩 써서 장면 순서를 정하고, 장면마다 화면 하단에 들어갈 한국어 자막을 한 줄씩 쓴다.

규칙:
- scenes에는 미디어 번호(mediaIndex, 0부터)를 빠짐없이 정확히 한 번씩 넣는다. 순서는 이야기 흐름이 좋게 바꿔도 된다.
- 자막은 일기 내용과 사진에 실제로 보이는 것을 엮어 쓴다. 사진에 없는 사실을 지어내지 않는다.
- 자막은 한 줄, 25자 이내. 일기 문장을 그대로 복사하지 말고 스타일에 맞게 다시 쓴다.
- title은 릴스 맨 앞에 크게 뜨는 제목. 15자 이내.
- durationMs와 transition은 스타일 규칙을 따른다. 영상 장면은 3000~5000ms."""

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "scenes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "mediaIndex": {"type": "integer"},
                    "caption": {"type": "string"},
                    "durationMs": {"type": "integer"},
                    "transition": {"type": "string", "enum": list(TRANSITIONS)},
                },
                "required": ["mediaIndex", "caption", "durationMs", "transition"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "scenes"],
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
    tags = entry["tags"]
    rules = "\n".join(f"- {labels[t]}: {STYLE_RULES[t]}" for t in tags if t in STYLE_RULES)
    content.append(
        {
            "type": "text",
            "text": (
                f"날짜: {entry['date']}\n"
                f"일기:\n{entry['diary'] or '(일기 없음 — 사진만 보고 써 줘)'}\n\n"
                f"스타일 (첫 번째가 주 스타일):\n{rules}\n\n"
                f"미디어는 #0 ~ #{len(entry['media']) - 1} 총 {len(entry['media'])}개."
            ),
        }
    )
    return [{"role": "user", "content": content}]


def validate(plan: dict, entry: dict) -> dict:
    """Claude 응답을 계약의 reel 모양으로 바꾼다. 형식이 틀리면 ReelAIError."""
    media = entry["media"]
    scenes = plan.get("scenes")
    if not isinstance(scenes, list):
        raise ReelAIError("scenes 없음")
    indices = [s.get("mediaIndex") for s in scenes]
    if sorted(i for i in indices if isinstance(i, int)) != list(range(len(media))) or len(indices) != len(media):
        raise ReelAIError(f"mediaIndex가 미디어 {len(media)}개를 정확히 한 번씩 쓰지 않음: {indices}")

    out = []
    for s in scenes:
        if s.get("transition") not in TRANSITIONS or not isinstance(s.get("durationMs"), int):
            raise ReelAIError(f"잘못된 장면: {s}")
        m = media[s["mediaIndex"]]
        out.append(
            {
                "mediaUrl": m["url"],
                "type": m["type"],
                "durationMs": min(MAX_SCENE_MS, max(MIN_SCENE_MS, s["durationMs"])),
                "caption": str(s.get("caption", "")).strip()[:MAX_CAPTION],
                "transition": s["transition"],
            }
        )
    title = str(plan.get("title", "")).strip()[:30]
    return {"title": title, "scenes": out}


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(timeout=60.0, max_retries=2)


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
    """장면 구성 생성. 응답 검증 실패는 1회 재시도. API 오류(키·네트워크·429 등)는 SDK가 재시도한 뒤 그대로 올라온다."""
    client = client or _client()
    messages = build_messages(entry)
    last: ReelAIError | None = None
    for attempt in range(2):
        try:
            return validate(_request(client, messages), entry)
        except ReelAIError as e:
            logger.warning("릴스 장면 응답 검증 실패 (%d/2): %s", attempt + 1, e)
            last = e
    raise last  # type: ignore[misc]
