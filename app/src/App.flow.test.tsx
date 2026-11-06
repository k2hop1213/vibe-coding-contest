// #12 생성 흐름: 작성 → 업로드 → 생성 중 → 재생 / 에러 메시지 / 실패 → 다시 만들기
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { ApiError, createEntry } from './lib/api'

vi.mock('./lib/api', async (orig) => ({ ...(await orig<typeof import('./lib/api')>()), createEntry: vi.fn() }))

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
let entries: unknown[] = []
let detail: Record<string, unknown> = {}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 6, 12))
  entries = []
  detail = {}
  URL.createObjectURL = vi.fn(() => 'blob:1')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/api/health')) return json({ ok: true })
    if (url.includes('/api/styles')) return json({ styles: [{ id: 'festival', label: '축제·MT', emoji: '🎉' }] })
    if (url.includes('?month=')) return json({ entries })
    const id = url.split('/').pop()!
    return json(detail[id])
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.mocked(createEntry).mockReset()
})

async function fillAndSubmit() {
  fireEvent.click(await screen.findByRole('button', { name: '🎉 축제·MT' }))
  fireEvent.change(screen.getByTestId('file-input'), {
    target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] },
  })
  fireEvent.click(screen.getByRole('button', { name: '✨ 릴스 만들기' }))
}

test('제출하면 업로드 → 생성 중 화면 → 완료되면 플레이어', async () => {
  detail.e9 = {
    id: 'e9', date: '2026-11-06', diary: '', tags: ['festival'], status: 'done',
    reel: { title: '오늘', scenes: [{ mediaUrl: '/media/a.jpg', type: 'image', durationMs: 2000, caption: '완성!', transition: 'fade' }] },
  }
  vi.mocked(createEntry).mockImplementation(async (_d, onProgress) => {
    onProgress?.(0.5)
    return { id: 'e9', date: '2026-11-06', status: 'processing' }
  })
  render(<App />)
  await fillAndSubmit()

  expect(createEntry).toHaveBeenCalledWith(
    expect.objectContaining({ date: '2026-11-06', tags: ['festival'] }),
    expect.any(Function),
  )
  expect(await screen.findByText('완성!')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '11월 6일 (릴스 있음)' })).toBeInTheDocument()
})

test('서버 에러 코드를 한국어 메시지로 보여준다', async () => {
  vi.mocked(createEntry).mockRejectedValue(new ApiError('file_too_large', 400))
  render(<App />)
  await fillAndSubmit()
  expect(await screen.findByRole('alert')).toHaveTextContent('50MB')
  expect(screen.getByRole('button', { name: '✨ 릴스 만들기' })).toBeEnabled() // 입력은 그대로
})

test('생성 실패한 날 → 다시 만들기 → 작성 폼으로 다시 제출', async () => {
  entries = [{ id: 'e1', date: '2026-11-06', status: 'failed', thumbnailUrl: null }]
  detail.e1 = { id: 'e1', date: '2026-11-06', diary: '', tags: [], status: 'failed', reel: null }
  vi.mocked(createEntry).mockResolvedValue({ id: 'e2', date: '2026-11-06', status: 'processing' })
  detail.e2 = { id: 'e2', date: '2026-11-06', diary: '', tags: [], status: 'processing', reel: null }
  render(<App />)

  fireEvent.click(await screen.findByRole('button', { name: '다시 만들기' }))
  await fillAndSubmit()
  expect(await screen.findByText('AI가 릴스를 편집하고 있어요')).toBeInTheDocument()
})

test('동영상 썸네일은 1초 지점 장면으로, 썸네일 없는 완료일은 🎬', async () => {
  entries = [
    { id: 'v1', date: '2026-11-02', status: 'done', thumbnailUrl: '/media/v.mp4', thumbnailType: 'video' },
    { id: 'v2', date: '2026-11-03', status: 'done', thumbnailUrl: null },
  ]
  render(<App />)
  const thumb = await screen.findByTestId('video-thumb')
  expect(thumb.getAttribute('src')).toBe('/media/v.mp4#t=1')
  expect(screen.getByRole('button', { name: '11월 3일 (릴스 있음)' })).toHaveTextContent('🎬')
})
