import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Reel } from '../lib/types'
import ReelPlayer from './ReelPlayer'

const reel: Reel = {
  template: 'review',
  clipDuration: 1,
  fixedText: { title: '지역 [성수]', subtitle: '맛집 투어' },
  clips: [
    { mediaUrl: '/a.svg', type: 'image', caption: '첫 장면 자막' },
    { mediaUrl: '/b.mp4', type: 'video', caption: '두 번째 자막' },
  ],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('고정 제목과 첫 클립 자막을 (화면 읽기용으로도) 보여준다', () => {
  render(<ReelPlayer reel={reel} />)
  for (const t of ['지역 [성수]', '맛집 투어', '첫 장면 자막']) expect(screen.getByText(t)).toBeInTheDocument()
})

test('클립 길이가 지나면 하드 컷으로 다음 클립 자막', () => {
  render(<ReelPlayer reel={reel} />)
  act(() => vi.advanceTimersByTime(1100))
  expect(screen.getByText('두 번째 자막')).toBeInTheDocument()
})

test('탭하면 일시정지되고, 일시정지 중에는 넘어가지 않는다', () => {
  render(<ReelPlayer reel={reel} />)
  fireEvent.click(screen.getByRole('button', { name: '릴스 일시정지' }))
  expect(screen.getByRole('button', { name: '릴스 재생' })).toHaveAttribute('aria-pressed', 'true')
  act(() => vi.advanceTimersByTime(3000))
  expect(screen.getByText('첫 장면 자막')).toBeInTheDocument()
})

test('클립이 없으면 안내 문구를 보여준다', () => {
  render(<ReelPlayer reel={{ ...reel, clips: [] }} />)
  expect(screen.getByText('재생할 장면이 없어요')).toBeInTheDocument()
})
