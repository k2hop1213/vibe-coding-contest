import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => vi.restoreAllMocks())

test('서버 헬스체크가 성공하면 "서버 연결됨"을 보여준다', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
  )
  render(<App />)
  expect(screen.getByRole('heading', { name: '하루릴스' })).toBeInTheDocument()
  expect(await screen.findByText('서버 연결됨')).toBeInTheDocument()
})

test('서버가 응답하지 않으면 "서버 연결 안 됨"을 보여준다', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'))
  render(<App />)
  expect(await screen.findByText('서버 연결 안 됨')).toBeInTheDocument()
})
