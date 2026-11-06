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

// GET /api/styles
export type Style = { id: string; label: string; emoji: string }

export async function getStyles(): Promise<Style[]> {
  const res = await fetch(`${API_BASE}/api/styles`)
  if (!res.ok) throw new Error(`styles ${res.status}`)
  const body: { styles: Style[] } = await res.json()
  return body.styles
}

// POST /api/entries (multipart) — tags는 같은 키를 반복해서 보낸다 (FastAPI List[str] = Form())
export type EntryDraft = { date: string; diary: string; tags: string[]; files: File[] }

export function toEntryFormData({ date, diary, tags, files }: EntryDraft): FormData {
  const fd = new FormData()
  fd.append('date', date)
  fd.append('diary', diary)
  tags.forEach((t) => fd.append('tags', t))
  files.forEach((f) => fd.append('files', f))
  return fd
}

export async function createEntry(
  draft: EntryDraft,
): Promise<{ id: string; date: string; status: EntryStatus }> {
  const res = await fetch(`${API_BASE}/api/entries`, { method: 'POST', body: toEntryFormData(draft) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `entries ${res.status}`)
  return body
}
