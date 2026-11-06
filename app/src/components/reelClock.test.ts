import { describe, expect, test } from 'vitest'
import type { Scene } from '../lib/types'
import { MIN_SCENE_MS, segmentFill, tick } from './reelClock'

const scene = (durationMs: number): Scene => ({
  mediaUrl: '/x.svg',
  type: 'image',
  durationMs,
  caption: '',
  transition: 'fade',
})
const scenes = [scene(1000), scene(2000), scene(500)]
const start = { index: 0, elapsed: 0, loop: 0 }

describe('tick', () => {
  test('장면 길이 안에서는 같은 장면에 머문다', () => {
    expect(tick(start, 999, scenes)).toEqual({ index: 0, elapsed: 999, loop: 0 })
  })

  test('장면 길이를 넘기면 남은 시간을 들고 다음 장면으로 간다', () => {
    expect(tick(start, 1200, scenes)).toEqual({ index: 1, elapsed: 200, loop: 0 })
  })

  test('한 번에 여러 장면을 건너뛸 수 있다', () => {
    expect(tick(start, 3100, scenes)).toEqual({ index: 2, elapsed: 100, loop: 0 })
  })

  test('마지막 장면이 끝나면 처음으로 돌아가고 loop가 늘어난다', () => {
    expect(tick({ index: 2, elapsed: 400, loop: 0 }, 150, scenes)).toEqual({ index: 0, elapsed: 50, loop: 1 })
  })

  test('durationMs가 0이거나 너무 짧아도 최소 길이를 보장해 무한 루프에 빠지지 않는다', () => {
    const broken = [scene(0), scene(-5)]
    expect(tick(start, MIN_SCENE_MS - 1, broken).index).toBe(0)
    expect(tick(start, MIN_SCENE_MS, broken).index).toBe(1)
  })

  test('장면이 없으면 0으로 유지한다', () => {
    expect(tick(start, 1000, [])).toEqual(start)
  })
})

describe('segmentFill', () => {
  const state = { index: 1, elapsed: 500, loop: 0 }
  test('지난 장면은 1, 현재 장면은 진행률, 다음 장면은 0', () => {
    expect(segmentFill(0, state, scenes)).toBe(1)
    expect(segmentFill(1, state, scenes)).toBe(0.25)
    expect(segmentFill(2, state, scenes)).toBe(0)
  })
})
