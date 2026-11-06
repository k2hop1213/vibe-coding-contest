import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Reel } from '../lib/types'
import ReelPlayer from './ReelPlayer'

const reel: Reel = {
  title: '축제 첫날',
  scenes: [
    { mediaUrl: '/a.svg', type: 'image', durationMs: 1000, caption: '첫 장면 자막', transition: 'fade' },
    { mediaUrl: '/b.mp4', type: 'video', durationMs: 1000, caption: '두 번째 자막', transition: 'slide' },
  ],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  // jsdom은 video 재생을 구현하지 않으므로 막아 둔다
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('첫 장면에서 제목과 자막을 보여준다', () => {
  render(<ReelPlayer reel={reel} />)
  expect(screen.getByText('축제 첫날')).toBeInTheDocument()
  expect(screen.getByText('첫 장면 자막')).toBeInTheDocument()
})

test('시간이 지나면 다음 장면(동영상)으로 넘어간다', () => {
  const { container } = render(<ReelPlayer reel={reel} />)
  act(() => vi.advanceTimersByTime(1100))
  expect(screen.getByText('두 번째 자막')).toBeInTheDocument()
  expect(container.querySelector('video')).toHaveAttribute('src', '/b.mp4')
})

test('탭하면 일시정지되고, 일시정지 중에는 장면이 넘어가지 않는다', () => {
  render(<ReelPlayer reel={reel} />)
  const player = screen.getByRole('button', { name: '릴스 일시정지' })
  fireEvent.click(player)
  expect(screen.getByRole('button', { name: '릴스 재생' })).toHaveAttribute('aria-pressed', 'true')
  act(() => vi.advanceTimersByTime(3000))
  expect(screen.getByText('첫 장면 자막')).toBeInTheDocument()
})

test('장면이 없으면 안내 문구를 보여준다', () => {
  render(<ReelPlayer reel={{ title: '', scenes: [] }} />)
  expect(screen.getByText('재생할 장면이 없어요')).toBeInTheDocument()
})
