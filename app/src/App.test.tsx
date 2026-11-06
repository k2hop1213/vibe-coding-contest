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

function mockServer() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/api/health')) return json({ ok: true })
    if (url.includes('/api/styles')) return json({ styles: [{ id: 'festival', label: '축제·MT', emoji: '🎉' }] })
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

test('서버 헬스체크가 성공하면 "서버 연결됨"을 보여준다', async () => {
  mockServer()
  render(<App />)
  expect(screen.getByRole('heading', { name: '하루릴스' })).toBeInTheDocument()
  expect(await screen.findByText('서버 연결됨')).toBeInTheDocument()
})

test('서버가 응답하지 않으면 "서버 연결 안 됨"을 보여준다', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'))
  render(<App />)
  expect(await screen.findByText(/서버 연결 안 됨/)).toBeInTheDocument()
})

test('이번 달 기록을 달력에 표시하고, 날짜를 누르면 왼쪽 패널이 바뀐다', async () => {
  const fetchSpy = mockServer()
  render(<App />)

  expect(screen.getByTestId('selected-date')).toHaveTextContent('11월 6일 금요일')
  // 기록 없는 날 → 작성 폼
  expect(screen.getByRole('button', { name: '✨ 릴스 만들기' })).toBeDisabled()
  expect(fetchSpy).toHaveBeenCalledWith('/api/entries?month=2026-11')

  fireEvent.click(await screen.findByRole('button', { name: '11월 3일 (릴스 있음)' }))
  expect(screen.getByText(/이 날의 릴스/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '11월 4일 (만드는 중)' }))
  expect(screen.getByText(/만드는 중이에요/)).toBeInTheDocument()
})

test('다음 달로 넘기면 그 달 기록을 다시 불러온다', async () => {
  const fetchSpy = mockServer()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
  expect(await screen.findByText('12월')).toBeInTheDocument()
  expect(fetchSpy).toHaveBeenCalledWith('/api/entries?month=2026-12')
})
