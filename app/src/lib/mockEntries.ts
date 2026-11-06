// 개발용 가짜 데이터 — 서버 #6이 붙기 전, 서버가 응답하지 않을 때만 사용 (DEV 전용)
import type { EntrySummary } from './api'

const thumb = (a: string, b: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 16"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="9" height="16" fill="url(#g)"/></svg>`,
  )

const samples: [day: number, status: EntrySummary['status'], a: string, b: string][] = [
  [2, 'done', '#fb7185', '#f59e0b'],
  [3, 'done', '#38bdf8', '#6366f1'],
  [5, 'done', '#34d399', '#0ea5e9'],
  [9, 'processing', '', ''],
  [12, 'done', '#f472b6', '#a855f7'],
  [14, 'failed', '', ''],
]

export function mockEntries(month: string): EntrySummary[] {
  return samples.map(([day, status, a, b]) => ({
    id: `mock_${month}_${day}`,
    date: `${month}-${String(day).padStart(2, '0')}`,
    status,
    thumbnailUrl: status === 'done' ? thumb(a, b) : null,
  }))
}

// planning.md MVP 1의 스타일 태그 7개 (서버 #6 전 개발용)
export const mockStyles = [
  { id: 'vlog', label: '감성 브이로그', emoji: '🎞️' },
  { id: 'energetic', label: '에너지 넘치는', emoji: '⚡' },
  { id: 'exam', label: '시험기간 생존기', emoji: '📚' },
  { id: 'festival', label: '축제·MT', emoji: '🎉' },
  { id: 'calm', label: '잔잔한 슬라이드쇼', emoji: '🌙' },
  { id: 'meme', label: '밈·유머', emoji: '😂' },
  { id: 'retro', label: '레트로 필름', emoji: '📼' },
]
