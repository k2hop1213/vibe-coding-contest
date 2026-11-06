import { describe, expect, test } from 'vitest'
import { pickMimeType } from './recordReel'
import { CAPTION_DELAY_MS, TITLE_MS, TRANSITION_MS, framePlan, kenBurns, totalDuration, wrapText } from './reelFrame'
import type { Reel, Scene } from './types'

const scene = (transition: Scene['transition'], caption = '자막'): Scene => ({
  mediaUrl: '/a.jpg',
  type: 'image',
  durationMs: 2000,
  caption,
  transition,
})
const reel: Reel = { title: '축제 첫날', scenes: [scene('fade', '첫 자막'), scene('slide'), scene('zoom')] }

describe('framePlan', () => {
  test('첫 장면은 전환 없이 바로 보이고, 제목이 떴다가 사라진다', () => {
    const start = framePlan(reel, 0)
    expect(start.current).toMatchObject({ index: 0, alpha: 1, dx: 0, scale: 1 })
    expect(start.under).toBeNull()
    expect(start.title?.alpha).toBe(0)
    expect(framePlan(reel, TITLE_MS * 0.5).title?.alpha).toBe(1)
    expect(framePlan(reel, TITLE_MS + 1).title).toBeNull()
  })

  test('자막은 잠깐 뒤에 아래에서 올라오며 나타난다', () => {
    expect(framePlan(reel, CAPTION_DELAY_MS - 1).caption).toBeNull()
    const mid = framePlan(reel, 400).caption!
    expect(mid.text).toBe('첫 자막')
    expect(mid.alpha).toBeGreaterThan(0)
    expect(mid.dy).toBeGreaterThan(0)
    expect(framePlan(reel, 1500).caption).toMatchObject({ alpha: 1, dy: 0 })
  })

  test('slide 전환: 이전 장면을 아래에 깔고 오른쪽에서 밀려 들어온다', () => {
    const p = framePlan(reel, 2000 + 10)
    expect(p.current.index).toBe(1)
    expect(p.under?.index).toBe(0)
    expect(p.current.dx).toBeGreaterThan(0.9)
    const done = framePlan(reel, 2000 + TRANSITION_MS + 1)
    expect(done.current.dx).toBe(0)
    expect(done.under).toBeNull()
  })

  test('zoom 전환: 크게 시작해서 1배로, 투명도는 0→1', () => {
    const p = framePlan(reel, 4000 + 1)
    expect(p.current.index).toBe(2)
    expect(p.current.scale).toBeGreaterThan(1.2)
    expect(p.current.alpha).toBeLessThan(0.1)
    expect(framePlan(reel, 4000 + TRANSITION_MS).current).toMatchObject({ scale: 1, alpha: 1 })
  })

  test('전체 길이', () => {
    expect(totalDuration(reel)).toBe(6000)
  })
})

test('켄번스: 짝수 장면은 줌인, 홀수 장면은 줌아웃', () => {
  expect(kenBurns(0, 0).zoom).toBe(1)
  expect(kenBurns(0, 1).zoom).toBeCloseTo(1.15)
  expect(kenBurns(1, 0).zoom).toBeCloseTo(1.15)
  expect(kenBurns(1, 1).zoom).toBe(1)
})

describe('wrapText', () => {
  const measure = (s: string) => s.length * 10 // 글자당 10px

  test('단어 단위로 줄바꿈', () => {
    expect(wrapText('오늘 축제 첫날 너무 재밌었다', 80, measure)).toEqual(['오늘 축제 첫날', '너무 재밌었다'])
  })

  test('공백이 없으면 글자 단위로', () => {
    expect(wrapText('가나다라마바사', 30, measure)).toEqual(['가나다', '라마바', '사'])
  })

  test('최대 줄 수를 넘으면 말줄임', () => {
    const lines = wrapText('가나다라마바사아자차', 20, measure, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
  })
})

test('녹화 형식은 MP4를 먼저, 없으면 WebM', () => {
  expect(pickMimeType((t) => t.startsWith('video/mp4'))).toBe('video/mp4;codecs=avc1.42E01E')
  expect(pickMimeType((t) => t === 'video/webm;codecs=vp9')).toBe('video/webm;codecs=vp9')
  expect(pickMimeType(() => false)).toBeUndefined()
  expect(
    pickMimeType(() => {
      throw new Error('지원 안 함')
    }),
  ).toBeUndefined()
})
