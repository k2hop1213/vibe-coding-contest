import pytest

from app import reel_plan, reel_stub
from app.reel_plan import PlanError, normalize

IMG = [{"url": f"/media/i{i}.jpg", "type": "image"} for i in range(10)]
VID = {"url": "/media/v.mp4", "type": "video"}


def _clip(i, caption="오늘", en="today"):
    return {"mediaIndex": i, "caption": caption, "captionEn": en}


def test_clip_duration_is_template_default_and_bpm_clamped():
    for template, sec in reel_plan.CLIP_DURATION.items():
        fixed = {"title": "가\n나\n다" if template == "closeup" else "TITLE", "subtitle": "부제"}
        plan = {"template": template, "clipDuration": 99, "bgmBpm": 999, "fixedText": fixed, "clips": [_clip(0)]}
        out = normalize(plan, IMG[:1])
        assert out["clipDuration"] == sec
        assert out["bgmBpm"] == reel_plan.DEFAULT_BPM


def test_total_length_10_to_30_seconds():
    # 짧으면 반복해서 10초 이상
    short = normalize({"template": "montage", "fixedText": {"title": "SEOUL"}, "clips": [_clip(0)]}, IMG[:1])
    assert 10 <= reel_plan.total_seconds(short) <= 30
    # 길면 30초 이하로 자름 (emotional 2.5초 × 20클립 = 50초)
    long_plan = {"template": "emotional", "clips": [_clip(i % 10) for i in range(20)]}
    long_out = normalize(long_plan, IMG)
    assert reel_plan.total_seconds(long_out) <= 30


def test_fields_only_for_their_templates():
    plan = {
        "template": "montage",
        "fixedText": {"title": "SEOUL", "subtitle": "캠퍼스"},
        "clips": [_clip(0)],
        "flashMontage": {"startIndex": 0, "mediaIndexes": list(range(8))},
    }
    out = normalize(plan, IMG)
    assert out["flashMontage"] is None
    assert all(c["caption"] is None and c["captionEn"] is None for c in out["clips"])

    emo = normalize({"template": "emotional", "fixedText": {"title": "x"}, "clips": [_clip(0)]}, IMG[:1])
    assert emo["fixedText"] is None and emo["clips"][0]["captionEn"] == "today"


def test_flash_montage_needs_6_photos_images_only():
    flash = {"startIndex": 1, "mediaIndexes": [0, 1, 2]}
    few = normalize({"template": "emotional", "clips": [_clip(0)], "flashMontage": flash}, IMG[:5] + [VID])
    assert few["flashMontage"] is None, "사진 5장 → 몽타주 생략"

    many = normalize({"template": "emotional", "clips": [_clip(0)], "flashMontage": flash}, IMG[:7] + [VID])
    urls = many["flashMontage"]["mediaUrls"]
    assert reel_plan.FLASH_MIN <= len(urls) <= reel_plan.FLASH_MAX and VID["url"] not in urls
    assert 0 <= many["flashMontage"]["startIndex"] < len(many["clips"])


def test_all_uploaded_media_are_used():
    out = normalize({"template": "review", "fixedText": {"title": "x"}, "clips": [_clip(0)]}, IMG[:3])
    assert {c["mediaUrl"] for c in out["clips"]} == {m["url"] for m in IMG[:3]}


def test_caption_trimmed_or_rejected():
    ok = normalize({"template": "review", "fixedText": {"title": "x"}, "clips": [_clip(0, "가" * 20)]}, IMG[:1])
    assert ok["clips"][0]["caption"] == "가" * reel_plan.MAX_CAPTION
    with pytest.raises(PlanError):
        normalize({"template": "review", "fixedText": {"title": "x"}, "clips": [_clip(0, "가" * 40)]}, IMG[:1])


@pytest.mark.parametrize(
    "plan",
    [
        {"template": "closeup", "fixedText": {"title": "한 줄"}, "clips": [_clip(0)]},
        {"template": "montage", "fixedText": None, "clips": [_clip(0)]},
        {"template": "emotional", "clips": [_clip(0, caption="")]},
        {"template": "nope", "clips": [_clip(0)]},
        {"template": "review", "fixedText": {"title": "x"}, "clips": [_clip(3)]},
    ],
)
def test_unfixable_plans_raise(plan):
    with pytest.raises(PlanError):
        normalize(plan, IMG[:1])


@pytest.mark.parametrize(
    ("tags", "media", "template"),
    [
        (["calm"], IMG[:8], "emotional"),
        (["festival"], IMG[:3], "montage"),
        (["exam"], IMG[:3], "review"),
        (["festival"], IMG[:1], "closeup"),
        ([], [VID, IMG[0]], "montage"),
    ],
)
def test_stub_builds_valid_plan_for_every_template(tags, media, template):
    entry = {"id": "e", "date": "2026-11-06", "diary": "축제 첫날! 공연 봤다.\n학식 카레.", "tags": tags, "media": media}
    reel = reel_stub.build_reel(entry)
    assert reel["template"] == template
    assert 10 <= reel_plan.total_seconds(reel) <= 30
    if template == "emotional":
        assert reel["flashMontage"] and len(reel["flashMontage"]["mediaUrls"]) >= 6
