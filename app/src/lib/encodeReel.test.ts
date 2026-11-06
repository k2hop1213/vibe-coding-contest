import { expect, test } from 'vitest'
import { videoStep } from './encodeReel'

test('동영상 프레임 이동: 가까우면 그대로, 조금 앞이면 재생, 뒤로 가거나 멀면 탐색', () => {
  expect(videoStep(1.0, 1.01)).toBe('draw') // 반 프레임 이내
  expect(videoStep(1.0, 1.0 + 1 / 30)).toBe('play') // 다음 프레임 → 짧게 재생
  expect(videoStep(1.0, 1.9)).toBe('play')
  expect(videoStep(1.0, 2.5)).toBe('seek') // 1초 넘게 앞
  expect(videoStep(2.9, 0.1)).toBe('seek') // 반복 재생으로 처음으로 돌아감
})
