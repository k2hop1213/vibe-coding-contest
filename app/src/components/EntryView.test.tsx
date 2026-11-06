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

test('하나로 합친 영상이 있으면 영상으로 재생하고 저장 버튼을 보여준다 (#27)', async () => {
  const withVideo = { ...entry('done'), reel: { ...reel, videoUrl: '/media/v.mp4' } }
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(withVideo))
  render(<EntryView id="e1" onStatus={() => {}} onRetry={() => {}} />)
  const video = await screen.findByLabelText('릴스 영상')
  expect(video).toHaveAttribute('src', '/media/v.mp4')
  expect(screen.getByRole('button', { name: '⬇ 영상 저장' })).toBeInTheDocument()
})

test('녹화를 못 하는 브라우저(jsdom 등)에서 영상이 없으면 미리보기 플레이어로 보여준다', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(entry('done')))
  render(<EntryView id="e1" onStatus={() => {}} onRetry={() => {}} />)
  expect(await screen.findByText('부스 투어!')).toBeInTheDocument()
  expect(screen.queryByLabelText('릴스 영상 합치는 화면')).not.toBeInTheDocument()
})
