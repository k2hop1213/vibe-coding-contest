import type { Reel } from './types'

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
  // 동영상만 올린 날 썸네일 (#20 코멘트 A안) — 서버 반영 전에는 없을 수 있음
  thumbnailType?: 'image' | 'video' | null
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

/** 서버 에러 코드(`{ "error": ... }`)를 담는다. network = 서버에 닿지 못함 */
export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, status: number) {
    super(code)
    this.code = code
    this.status = status
  }
}

export const ERROR_MESSAGES: Record<string, string> = {
  no_media: '사진이나 동영상을 1개 이상 올려 주세요.',
  no_tag: '스타일 태그를 1개 이상 골라 주세요.',
  invalid_date: '날짜가 올바르지 않아요.',
  too_many_media: '사진·동영상은 10개까지 올릴 수 있어요.',
  invalid_media: 'jpg·png·gif·webp·mp4·mov·webm 파일만 올릴 수 있어요.',
  file_too_large: '파일 하나가 50MB를 넘어요.',
  already_exists: '이 날짜엔 이미 릴스가 있어요.',
  not_ready: '릴스가 아직 완성되지 않았어요.',
  invalid_request: '요청 형식이 올바르지 않아요.',
  network: '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
}
export const errorMessage = (code: string) => ERROR_MESSAGES[code] ?? '알 수 없는 오류가 났어요.'

/** 업로드 진행률(0~1)을 받으려고 fetch 대신 XHR을 쓴다 */
export function createEntry(
  draft: EntryDraft,
  onProgress?: (ratio: number) => void,
): Promise<{ id: string; date: string; status: EntryStatus }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/entries`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      let body: { error?: string } & Record<string, unknown> = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        /* 본문이 JSON이 아니면 상태 코드만 사용 */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as never)
      else reject(new ApiError(body.error ?? 'unknown', xhr.status))
    }
    xhr.onerror = () => reject(new ApiError('network', 0))
    xhr.send(toEntryFormData(draft))
  })
}

// GET /api/entries/{id}
export type EntryDetail = {
  id: string
  date: string
  diary: string
  tags: string[]
  status: EntryStatus
  reel: Reel | null
}

export async function getEntry(id: string): Promise<EntryDetail> {
  const res = await fetch(`${API_BASE}/api/entries/${id}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(body.error ?? 'unknown', res.status)
  return body
}

/** 플레이어에 넘기기 전에 /media/.. 상대경로를 배포 환경에서도 서버로 가게 바꾼다 */
export function withMediaUrls(reel: Reel): Reel {
  return {
    ...reel,
    scenes: reel.scenes.map((s) => ({ ...s, mediaUrl: mediaUrl(s.mediaUrl) ?? s.mediaUrl })),
    videoUrl: mediaUrl(reel.videoUrl ?? null),
  }
}

// POST /api/entries/{id}/video — 브라우저에서 합친 릴스 영상 업로드 (#27)
export async function uploadVideo(id: string, video: Blob): Promise<{ videoUrl: string }> {
  const fd = new FormData()
  const ext = video.type.includes('mp4') ? 'mp4' : 'webm'
  fd.append('file', video, `reel.${ext}`)
  const res = await fetch(`${API_BASE}/api/entries/${id}/video`, { method: 'POST', body: fd })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(body.error ?? 'unknown', res.status)
  return body
}
