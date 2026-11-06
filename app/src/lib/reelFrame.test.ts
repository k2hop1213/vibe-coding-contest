import { describe, expect, test } from 'vitest'
import { toPlan } from './api'
import { pickMimeType } from './recordReel'
import {
  clipSpan,
  videoTime,
  EN_COLOR,
  FLASH_MS,
  SAFE_BOTTOM,
  SAFE_TOP,
  framePlan,
  mediaList,
  textLayout,
  timeline,
  totalDuration,
  wrapText,
} from './reelFrame'
import type { Clip, Reel } from './types'

const clip = (caption = '자막', type: Clip['type'] = 'image'): Clip => ({ mediaUrl: `/${caption}.jpg`, type, caption })
const base: Reel = { template: 'montage', clipDuration: 1, clips: [clip('a'), clip('b'), clip('c', 'video')] }

describe('timeline / framePlan', () => {
  test('하드 컷: 클립 경계에서 바로 다음 클립 (겹침 없음)', () => {
    expect(framePlan(base, 999)?.clip).toBe(0)
    expect(framePlan(base, 1000)?.clip).toBe(1)
    expect(totalDuration(base)).toBe(3000)
  })

  test('확대 없음: 프레임 계획에 배율이 없고 구간 안 시간만 진행', () => {
    expect(framePlan(base, 999.9)).not.toHaveProperty('zoom')
    expect(framePlan(base, 2500)).toMatchObject({ clip: 2, local: 500 })
  })

  test('끝을 넘으면 마지막 프레임에 머문다, 클립이 없으면 null', () => {
    expect(framePlan(base, 99999)?.clip).toBe(2)
    expect(framePlan({ ...base, clips: [] }, 0)).toBeNull()
  })

  test('emotional 플래시 몽타주: clips[startIndex] 앞에 0.15초씩, 자막 없음', () => {
    const r: Reel = {
      ...base,
      template: 'emotional',
      clipDuration: 2.5,
      flashMontage: { startIndex: 1, mediaUrls: ['/f1.jpg', '/f2.mp4'] },
    }
    const segs = timeline(r)
    expect(segs.map((s) => s.clip)).toEqual([0, null, null, 1, 2])
    expect(segs[1]).toMatchObject({ start: 2500, duration: FLASH_MS, media: 3 })
    expect(totalDuration(r)).toBe(2500 * 3 + FLASH_MS * 2)
    expect(mediaList(r).map((m) => m.type)).toEqual(['image', 'image', 'video', 'image', 'video'])
    expect(framePlan(r, 2500 + 10)).toMatchObject({ clip: null })
  })

  test('같은 미디어가 연속되면(서버가 0000011111로 늘림, #36) 하나의 긴 컷: 자막은 클립마다, 시간은 이어서', () => {
    const cap = (url: string, caption: string): Clip => ({ ...clip(url), caption })
    const r: Reel = {
      template: 'review',
      clipDuration: 1,
      clips: [cap('a', '하나'), cap('a', '둘'), cap('a', '셋'), cap('b', '넷'), cap('b', '다섯')],
    }
    const segs = timeline(r)
    expect(segs).toHaveLength(2)
    expect(segs[0]).toMatchObject({ start: 0, duration: 3000, clip: 0, clipCount: 3, clipMs: 1000 })
    expect(segs[1]).toMatchObject({ start: 3000, duration: 2000, clip: 3, clipCount: 2 })
    expect(totalDuration(r)).toBe(5000)
    // 자막은 원래 클립 경계마다 바뀐다
    expect([0, 1000, 2000, 3000, 4000].map((t) => framePlan(r, t)!.clip)).toEqual([0, 1, 2, 3, 4])
    // 진행 바용: 합쳐진 구간 안의 클립도 자기 시간대를 안다
    expect(clipSpan(segs, 1)).toEqual({ start: 1000, duration: 1000 })
    expect(clipSpan(segs, 4)).toEqual({ start: 4000, duration: 1000 })
  })

  test('동영상 하나를 늘린 날: 컷마다 처음으로 되감기지 않고 이어서 재생된다', () => {
    const v: Clip = { mediaUrl: '/v.mp4', type: 'video' }
    const r: Reel = { template: 'closeup', clipDuration: 0.8, fixedText: { title: 'a\nb\nc' }, clips: Array(13).fill(v) }
    expect(timeline(r)).toHaveLength(1)
    // 동영상 위치(local)가 컷 경계(0.8초)에서 0으로 돌아가지 않는다
    expect([700, 900, 1700, 5000].map((t) => Math.round(framePlan(r, t)!.local))).toEqual([700, 900, 1700, 5000])
  })

  test('합쳐진 구간이 영상보다 길면 처음부터 반복 재생한다 (마지막 프레임에 멈추지 않음)', () => {
    expect(videoTime(2500, 3)).toBeCloseTo(2.5)
    expect(videoTime(3500, 3)).toBeCloseTo(0.5)
    expect(videoTime(7200, 3)).toBeCloseTo(1.2)
    expect(videoTime(1200, NaN)).toBeCloseTo(1.2) // 길이를 아직 모르면 그대로
    expect(videoTime(1200, 0)).toBeCloseTo(1.2)
  })

  test('플래시 몽타주 경계에서는 같은 사진이어도 합치지 않는다', () => {
    const r: Reel = {
      template: 'emotional',
      clipDuration: 2.5,
      clips: [clip('a'), clip('a'), clip('b')],
      flashMontage: { startIndex: 1, mediaUrls: ['/f1.jpg'] },
    }
    expect(timeline(r).map((s) => s.clip)).toEqual([0, null, 1, 2])
  })

  test('떨어져 있는 같은 사진(0 1 0)은 합치지 않는다', () => {
    const r: Reel = { ...base, clips: [clip('a'), clip('b'), clip('a')] }
    expect(timeline(r)).toHaveLength(3)
  })

  test('플래시 몽타주는 emotional이 아니면 무시', () => {
    const r: Reel = { ...base, flashMontage: { startIndex: 0, mediaUrls: ['/f.jpg'] } }
    expect(timeline(r)).toHaveLength(3)
  })
})

describe('textLayout (스펙 §2)', () => {
  const all = (r: Reel) => r.clips.flatMap((_, i) => textLayout(r, i))

  test('모든 텍스트는 세이프존 안', () => {
    for (const template of ['emotional', 'montage', 'review', 'closeup'] as const) {
      const r: Reel = { ...base, template, fixedText: { title: 'a\nb\nc', subtitle: 's' } }
      for (const t of all(r)) {
        expect(t.y).toBeGreaterThanOrEqual(SAFE_TOP)
        expect(t.y).toBeLessThanOrEqual(SAFE_BOTTOM)
      }
    }
  })

  test('emotional: 노란 영어 윗줄 + 흰 한글, y=0.62 가운데', () => {
    const r: Reel = { ...base, template: 'emotional', clips: [{ ...clip('시험 끝'), captionEn: 'Exams are over' }] }
    const [en, ko] = textLayout(r, 0)
    expect(en).toMatchObject({ text: 'Exams are over', color: EN_COLOR, y: 0.62, align: 'center' })
    expect(ko).toMatchObject({ text: '시험 끝', color: '#fff' })
    expect(ko.y).toBeGreaterThan(en.y)
  })

  test('montage: 제목은 영문 대문자로 y=0.22, 컷 자막 없음', () => {
    const r: Reel = { ...base, fixedText: { title: 'Incheon', subtitle: '중간고사 끝난 날' } }
    expect(textLayout(r, 0).map((t) => t.text)).toEqual(['INCHEON', '중간고사 끝난 날'])
    expect(textLayout(r, 0)[0].y).toBe(0.22)
  })

  test('review: 세리프 제목 + 박스 부제 + 하단 컷 자막 y=0.72', () => {
    const r: Reel = { ...base, template: 'review', fixedText: { title: '지역 [성수]', subtitle: '요약' } }
    const [title, sub, cap] = textLayout(r, 1)
    expect(title).toMatchObject({ serif: true, y: 0.19 })
    expect(sub.box).toBe(true)
    expect(cap).toMatchObject({ text: 'b', y: 0.72 })
    expect(textLayout(r, null)).toHaveLength(2)
  })

  test('closeup: 왼쪽 정렬 3줄 x=0.08 y=0.65부터', () => {
    const r: Reel = { ...base, template: 'closeup', fixedText: { title: '성수동\n간장게장 막국수\n떴다 …' } }
    const lines = textLayout(r, 0)
    expect(lines.map((l) => l.text)).toEqual(['성수동', '간장게장 막국수', '떴다 …'])
    expect(lines.every((l) => l.align === 'left' && l.x === 0.08)).toBe(true)
    expect(lines[0].y).toBe(0.65)
  })
})

test('toPlan: 옛 장면 JSON(v1)을 review 편집 플랜으로, v2는 그대로', () => {
  const plan = toPlan({
    title: '축제 첫날',
    scenes: [
      { mediaUrl: '/a.jpg', type: 'image', durationMs: 2000, caption: '부스', transition: 'fade' },
      { mediaUrl: '/b.mp4', type: 'video', durationMs: 3000, caption: '', transition: 'zoom' },
    ],
    videoUrl: '/v.mp4',
  })
  expect(plan).toEqual({
    template: 'review',
    clipDuration: 2.5,
    fixedText: { title: '축제 첫날' },
    clips: [
      { mediaUrl: '/a.jpg', type: 'image', caption: '부스' },
      { mediaUrl: '/b.mp4', type: 'video', caption: null },
    ],
    flashMontage: null,
    videoUrl: '/v.mp4',
  })
  expect(toPlan(base)).toBe(base)
})

describe('wrapText', () => {
  const measure = (s: string) => s.length * 10

  test('단어 단위로 줄바꿈', () => {
    expect(wrapText('오늘 축제 첫날 너무 재밌었다', 80, measure)).toEqual(['오늘 축제 첫날', '너무 재밌었다'])
  })

  test('공백이 없으면 글자 단위로, 최대 줄 수를 넘으면 말줄임', () => {
    expect(wrapText('가나다라마바사', 30, measure)).toEqual(['가나다', '라마바', '사'])
    const lines = wrapText('가나다라마바사아자차', 20, measure, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
  })
})

test('녹화 형식은 MP4를 먼저, 없으면 WebM', () => {
  expect(pickMimeType((t) => t.startsWith('video/mp4'))).toBe('video/mp4;codecs=avc1.42E01E')
  expect(pickMimeType((t) => t === 'video/webm;codecs=vp9')).toBe('video/webm;codecs=vp9')
  expect(pickMimeType(() => false)).toBeUndefined()
})
