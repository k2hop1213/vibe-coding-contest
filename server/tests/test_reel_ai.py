import base64
import io
import json
import os
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import entries, reel_ai
from app.main import app


def _jpeg_file(name: str, size=(3000, 2000)) -> str:
    """MEDIA_DIR에 큰 JPEG를 만들고 /media URL을 돌려준다"""
    Image.new("RGB", size, (200, 80, 120)).save(os.path.join(os.environ["MEDIA_DIR"], name), "JPEG")
    return f"/media/{name}"


def _entry(media):
    return {
        "id": "e_test",
        "date": "2026-11-06",
        "diary": "축제 첫날! 친구들이랑 공연 봤다.",
        "tags": ["festival", "calm"],
        "media": media,
    }


class FakeClient:
    """client.beta.messages.create(...)만 흉내 낸다. responses를 순서대로 돌려준다."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        r = self.responses.pop(0)
        if isinstance(r, dict):
            r = SimpleNamespace(
                stop_reason="end_turn",
                stop_details=None,
                content=[SimpleNamespace(type="text", text=json.dumps(r, ensure_ascii=False))],
            )
        return r


def _clip(i, caption="공연 시작", caption_en="Show time"):
    return {"mediaIndex": i, "caption": caption, "captionEn": caption_en}


def _plan(*clips, template="review", fixed=None, flash=None, bpm=120):
    if fixed is None and template != "emotional":
        fixed = {"title": "서울 [성수]", "subtitle": "축제 첫날"}
    return {"template": template, "bgmBpm": bpm, "fixedText": fixed, "clips": list(clips), "flashMontage": flash}


def test_builds_plan_in_claude_order():
    media = [{"url": _jpeg_file("a.jpg"), "type": "image"}, {"url": "/media/v.mp4", "type": "video"}]
    client = FakeClient(_plan(_clip(1, "영상 먼저!"), _clip(0, "공연 시작")))

    reel = reel_ai.build_reel(_entry(media), client=client)

    assert reel["template"] == "review" and reel["clipDuration"] == 1.0
    assert reel["fixedText"] == {"title": "서울 [성수]", "subtitle": "축제 첫날"}
    urls = [c["mediaUrl"] for c in reel["clips"]]
    assert [u for i, u in enumerate(urls) if i == 0 or urls[i - 1] != u] == ["/media/v.mp4", media[0]["url"]]
    assert reel["clips"][0] == {"mediaUrl": "/media/v.mp4", "type": "video", "caption": "영상 먼저!", "captionEn": None}
    assert reel["flashMontage"] is None


def test_request_shape_model_schema_fallbacks_and_images():
    media = [{"url": _jpeg_file("big.jpg"), "type": "image"}, {"url": "/media/sample/1.svg", "type": "image"}]
    client = FakeClient(_plan(_clip(0), _clip(1)))
    reel_ai.build_reel(_entry(media), client=client)

    call = client.calls[0]
    assert call["model"] == "claude-opus-5-5"
    schema = call["output_config"]["format"]["schema"]
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert schema["properties"]["template"]["enum"] == ["emotional", "montage", "review", "closeup"]
    assert "transition" not in json.dumps(schema), "하드 컷 고정 — 전환 필드 없음"
    assert call["output_config"]["effort"] == "low"
    assert call["fallbacks"] == "default" and call["betas"] == ["server-side-fallback-2026-07-01"]
    assert "thinking" not in call
    assert "emotional" in call["system"] and "closeup" in call["system"]

    content = call["messages"][0]["content"]
    images = [b for b in content if b["type"] == "image"]
    assert len(images) == 1, "SVG는 Pillow가 못 여니 텍스트로만"
    img = Image.open(io.BytesIO(base64.b64decode(images[0]["source"]["data"])))
    assert img.format == "JPEG" and max(img.size) == reel_ai.MAX_IMAGE_SIDE
    text = " ".join(b["text"] for b in content if b["type"] == "text")
    assert "사진(미리보기 불가)" in text
    assert "분위기 힌트" in text and "축제·MT" in text and "잔잔한 슬라이드쇼" in text
    assert "축제 첫날!" in text


@pytest.mark.parametrize(
    "bad",
    [
        _plan(_clip(0), _clip(5)),  # 범위 밖
        _plan(_clip(0), _clip(1), template="spin"),  # 없는 템플릿
        _plan(),  # clips 없음
        _plan(_clip(0), _clip(1), template="montage", fixed=None) | {"fixedText": None},  # 고정 텍스트 누락
        _plan(_clip(0), _clip(1, caption=None)),  # review인데 자막 없음
    ],
)
def test_invalid_plan_retries_once_then_succeeds(bad):
    media = [{"url": "/media/x.mp4", "type": "video"}, {"url": "/media/y.mp4", "type": "video"}]
    client = FakeClient(bad, _plan(_clip(0), _clip(1)))
    reel = reel_ai.build_reel(_entry(media), client=client)
    assert len(client.calls) == 2
    assert reel["template"] == "review"


def test_invalid_twice_raises():
    media = [{"url": "/media/x.mp4", "type": "video"}]
    client = FakeClient(_plan(), _plan())
    with pytest.raises(reel_ai.ReelAIError):
        reel_ai.build_reel(_entry(media), client=client)
    assert len(client.calls) == 2


def test_refusal_raises():
    refusal = SimpleNamespace(stop_reason="refusal", stop_details=SimpleNamespace(category="bio"), content=[])
    media = [{"url": "/media/x.mp4", "type": "video"}]
    with pytest.raises(reel_ai.ReelAIError):
        reel_ai.build_reel(_entry(media), client=FakeClient(refusal, refusal))


# ── entries 연동: 키가 있으면 Claude, 실패하면 스텁(데모에서 실패 화면 안 뜨게) ──

client = TestClient(app)
JPG = ("files", ("a.jpg", b"\xff\xd8fake", "image/jpeg"))


def _post():
    data = {"date": "2026-11-20", "diary": "첫 문장. 둘째 문장.", "tags": ["festival"]}
    return client.post("/api/entries", data=data, files=[JPG])


def test_uses_claude_when_key_set(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    seen = []

    def fake_build(entry):
        seen.append(entry["id"])
        return {"template": "closeup", "clips": []}

    monkeypatch.setattr(reel_ai, "build_reel", fake_build)
    entry_id = _post().json()["id"]
    detail = client.get(f"/api/entries/{entry_id}").json()
    assert seen == [entry_id]
    assert detail["status"] == "done" and detail["reel"]["template"] == "closeup"


def test_claude_failure_falls_back_to_stub(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")

    def boom(entry):
        raise reel_ai.ReelAIError("검증 실패")

    monkeypatch.setattr(reel_ai, "build_reel", boom)
    entry_id = _post().json()["id"]
    detail = client.get(f"/api/entries/{entry_id}").json()
    assert detail["status"] == "done"
    assert detail["reel"]["template"] == "closeup", "스텁 결과(미디어 1개 → closeup)"
    assert detail["reel"]["fixedText"]["title"].split("\n")[1] == "첫 문장."


def test_no_key_uses_stub_without_calling_claude(monkeypatch):
    monkeypatch.setattr(reel_ai, "build_reel", lambda entry: pytest.fail("키 없으면 호출 금지"))
    entry_id = _post().json()["id"]
    assert client.get(f"/api/entries/{entry_id}").json()["status"] == "done"
    assert entries.reel_ai.enabled() is False


@pytest.mark.parametrize("var", ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"])
def test_enabled_with_anthropic_key_or_baze_token(monkeypatch, var):
    assert reel_ai.enabled() is False
    monkeypatch.setenv(var, "x")
    assert reel_ai.enabled() is True


def test_client_ignores_empty_env_values(monkeypatch):
    """.env에 빈 줄(ANTHROPIC_BASE_URL=)이 남아 있어도 기본 주소를 쓴다"""
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "baze-token")
    c = reel_ai._client()
    assert str(c.base_url).startswith("https://api.anthropic.com")
    assert c.api_key is None and c.auth_token == "baze-token"

    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://factchat-cloud.mindlogic.ai/v1/gateway/claude")
    assert str(reel_ai._client().base_url).startswith("https://factchat-cloud.mindlogic.ai/v1/gateway/claude")


def test_client_prefers_baze_token_when_both_set(monkeypatch, caplog):
    """둘 다 있으면 SDK가 ValueError → 모든 릴스가 조용히 스텁이 되던 문제"""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "old-anthropic-key")
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "baze-token")
    with caplog.at_level("WARNING"):
        c = reel_ai._client()
    assert c.auth_token == "baze-token" and c.api_key is None
    assert "둘 다" in caplog.text
