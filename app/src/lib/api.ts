// 배포 시에는 VITE_API_BASE(예: https://xxx.onrender.com)를, 개발 중에는 vite proxy를 쓴다.
export const API_BASE = import.meta.env.VITE_API_BASE ?? ''

/** 서버가 주는 "/media/.." 상대경로를 배포 환경에서도 서버로 가게 바꾼다 */
export function mediaUrl(path: string | null): string | null {
  if (!path) return null
  if (/^(https?:|data:|blob:)/.test(path)) return path
  return `${API_BASE}${path}`
}

export async function getHealth(): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/health`)
  if (!res.ok) throw new Error(`health ${res.status}`)
  return res.json()
}

// docs/planning.md API 계약: GET /api/entries?month=
export type EntryStatus = 'processing' | 'done' | 'failed'
export type EntrySummary = {
  id: string
  date: string
  status: EntryStatus
  thumbnailUrl: string | null
}

export async function getEntries(month: string): Promise<EntrySummary[]> {
  const res = await fetch(`${API_BASE}/api/entries?month=${month}`)
  if (!res.ok) throw new Error(`entries ${res.status}`)
  const body: { entries: EntrySummary[] } = await res.json()
  return body.entries
}
