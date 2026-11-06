import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import EntryView from './EntryView'

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const reel = {
  title: '축제 첫날',
  scenes: [{ mediaUrl: '/media/a.jpg', type: 'image', durationMs: 2000, caption: '부스 투어!', transition: 'zoom' }],
}
const entry = (status: string) => ({ id: 'e1', date: '2026-11-06', diary: '', tags: [], status, reel: status === 'done' ? reel : null })

afterEach(() => vi.restoreAllMocks())

test('processing이면 생성 중 화면 → 폴링해서 done이 되면 플레이어를 띄운다', async () => {
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json(entry('processing')))
    .mockResolvedValueOnce(json(entry('processing')))
    .mockResolvedValue(json(entry('done')))
  const onStatus = vi.fn()
  render(<EntryView id="e1" onStatus={onStatus} onRetry={() => {}} pollMs={5} />)

  expect(await screen.findByText('AI가 릴스를 편집하고 있어요')).toBeInTheDocument()
  expect(await screen.findByText('부스 투어!')).toBeInTheDocument()
  expect(fetchSpy).toHaveBeenCalledWith('/api/entries/e1')
  expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(3)
  expect(onStatus).toHaveBeenCalledWith('done')
})

test('failed면 안내와 다시 만들기 버튼', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(entry('failed')))
  const onRetry = vi.fn()
  render(<EntryView id="e1" onStatus={() => {}} onRetry={onRetry} />)
  fireEvent.click(await screen.findByRole('button', { name: '다시 만들기' }))
  expect(onRetry).toHaveBeenCalled()
})

test('오래 걸리면 기다려 달라는 안내를 보여준다', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(entry('processing')))
  render(<EntryView id="e1" onStatus={() => {}} onRetry={() => {}} pollMs={1000} slowMs={10} />)
  expect(await screen.findByText(/조금만 더 기다려 주세요/)).toBeInTheDocument()
})
