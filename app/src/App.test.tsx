import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 6, 12))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const reel = {
  title: '축제 첫날',
  scenes: [{ mediaUrl: '/media/a.jpg', type: 'image', durationMs: 2000, caption: '시작!', transition: 'fade' }],
}

function mockServer() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/api/health')) return json({ ok: true })
    if (url.includes('/api/styles')) return json({ styles: [{ id: 'festival', label: '축제·MT', emoji: '🎉' }] })
    if (url.endsWith('/api/entries/e1'))
      return json({ id: 'e1', date: '2026-11-03', diary: '', tags: ['festival'], status: 'done', reel })
    if (url.endsWith('/api/entries/e2'))
      return json({ id: 'e2', date: '2026-11-04', diary: '', tags: ['festival'], status: 'processing', reel: null })
    if (url.includes('month=2026-11'))
      return json({
        entries: [
          { id: 'e1', date: '2026-11-03', status: 'done', thumbnailUrl: '/media/t1.jpg' },
          { id: 'e2', date: '2026-11-04', status: 'processing', thumbnailUrl: null },
        ],
      })
    return json({ entries: [] })
  })
}

test('서버가 정상이면 서버 상태 문구를 보여주지 않는다', async () => {
  mockServer()
  render(<App />)
  expect(screen.getByRole('heading', { name: '하루릴스' })).toBeInTheDocument()
  await screen.findByRole('button', { name: '11월 3일 (릴스 있음)' })
  expect(screen.queryByTestId('server-status')).not.toBeInTheDocument()
  expect(screen.queryByText(/서버 연결됨/)).not.toBeInTheDocument()
})

test('서버가 응답하지 않으면 연결 안 됨을 알려준다 (빈 달력과 구분)', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'))
  render(<App />)
  expect(await screen.findByTestId('server-status')).toHaveTextContent('서버에 연결하지 못했어요')
})

test('이번 달 기록을 달력에 표시하고, 날짜를 누르면 왼쪽 패널이 바뀐다', async () => {
  const fetchSpy = mockServer()
  render(<App />)

  expect(screen.getByTestId('selected-date')).toHaveTextContent('11월 6일 금요일')
  // 기록 없는 날 → 작성 폼
  expect(screen.getByRole('button', { name: '✨ 릴스 만들기' })).toBeDisabled()
  expect(fetchSpy).toHaveBeenCalledWith('/api/entries?month=2026-11')

  fireEvent.click(await screen.findByRole('button', { name: '11월 3일 (릴스 있음)' }))
  expect(await screen.findByRole('button', { name: '릴스 일시정지' })).toBeInTheDocument()
  expect(screen.getByText('시작!')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '11월 4일 (만드는 중)' }))
  expect(await screen.findByText('AI가 릴스를 편집하고 있어요')).toBeInTheDocument()
})

test('다음 달로 넘기면 그 달 기록을 다시 불러온다', async () => {
  const fetchSpy = mockServer()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
  expect(await screen.findByText('12월')).toBeInTheDocument()
  expect(fetchSpy).toHaveBeenCalledWith('/api/entries?month=2026-12')
})

test('기록 있는 날을 선택한 채 다른 달로 넘겨도 왼쪽 패널은 그 기록을 유지한다', async () => {
  mockServer()
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '11월 3일 (릴스 있음)' }))
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
  expect(await screen.findByText('12월')).toBeInTheDocument()
  expect(screen.getByTestId('selected-date')).toHaveTextContent('11월 3일')
  expect(await screen.findByRole('button', { name: '릴스 일시정지' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '✨ 릴스 만들기' })).not.toBeInTheDocument()
})
