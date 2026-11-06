import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { toEntryFormData } from '../lib/api'
import EntryForm, { MAX_FILES } from './EntryForm'

const styles = [
  { id: 'festival', label: '축제·MT', emoji: '🎉' },
  { id: 'calm', label: '잔잔한 슬라이드쇼', emoji: '🌙' },
]
const img = (name: string) => new File(['x'], name, { type: 'image/jpeg' })
const pick = (files: File[]) => fireEvent.change(screen.getByTestId('file-input'), { target: { files } })

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ styles })))
  let n = 0
  URL.createObjectURL = vi.fn(() => `blob:${++n}`)
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('사진·태그가 없으면 버튼이 꺼지고 안내 문구를 보여준다', async () => {
  render(<EntryForm date="2026-11-06" onSubmit={() => {}} />)
  await screen.findByRole('button', { name: '🎉 축제·MT' })
  expect(screen.getByRole('button', { name: '✨ 릴스 만들기' })).toBeDisabled()
  expect(screen.getByText('사진·동영상과 스타일 태그를 1개 이상 골라 주세요')).toBeInTheDocument()

  pick([img('a.jpg')])
  expect(screen.getByText('스타일 태그를 1개 이상 골라 주세요')).toBeInTheDocument()
})

test('일기·태그·사진을 채우면 제출된다', async () => {
  const onSubmit = vi.fn()
  render(<EntryForm date="2026-11-06" onSubmit={onSubmit} />)
  fireEvent.click(await screen.findByRole('button', { name: '🎉 축제·MT' }))
  fireEvent.click(screen.getByRole('button', { name: '🌙 잔잔한 슬라이드쇼' }))
  fireEvent.click(screen.getByRole('button', { name: '🌙 잔잔한 슬라이드쇼' })) // 다시 누르면 해제
  fireEvent.change(screen.getByPlaceholderText(/오늘 어떤 하루/), { target: { value: '축제 첫날!' } })
  pick([img('a.jpg'), img('b.jpg')])

  fireEvent.click(screen.getByRole('button', { name: '✨ 릴스 만들기' }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ date: '2026-11-06', diary: '축제 첫날!', tags: ['festival'] }),
  )
  expect(onSubmit.mock.calls[0][0].files).toHaveLength(2)
})

test('사진은 최대 10개, 삭제하면 미리보기 URL을 정리한다', async () => {
  render(<EntryForm date="2026-11-06" onSubmit={() => {}} />)
  pick(Array.from({ length: 12 }, (_, i) => img(`p${i}.jpg`)))
  expect(screen.getByText(`${MAX_FILES}/${MAX_FILES}`)).toBeInTheDocument()
  expect(screen.queryByText('추가')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'p0.jpg 삭제' }))
  expect(screen.getByText(`9/${MAX_FILES}`)).toBeInTheDocument()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1')
})

test('multipart 전송 시 tags는 같은 키를 반복한다', () => {
  const fd = toEntryFormData({ date: '2026-11-06', diary: 'hi', tags: ['festival', 'meme'], files: [img('a.jpg')] })
  expect(fd.getAll('tags')).toEqual(['festival', 'meme'])
  expect(fd.getAll('files')).toHaveLength(1)
})

test('HEIC·SVG 같은 미지원 형식은 빼고 안내한다', async () => {
  render(<EntryForm date="2026-11-06" onSubmit={() => {}} />)
  pick([
    new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' }),
    new File(['x'], 'logo.svg', { type: 'image/svg+xml' }),
    img('ok.jpg'),
  ])
  expect(screen.getByText('1/10')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('IMG_0001.HEIC, logo.svg')
})
