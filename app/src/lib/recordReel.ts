// 릴스를 캔버스에 실시간으로 그리며 MediaRecorder로 녹화해 영상 파일 하나로 만든다 (#27).
// 서버 ffmpeg 합성은 무료 서버에서 너무 느려서(7초 영상에 수 분) 브라우저에서 합친다.
import { sceneDuration } from '../components/reelClock'
import { drawFrame, framePlan, totalDuration, type Drawable } from './reelFrame'
import type { Reel } from './types'

// 앞에 있을수록 우선: 인스타·카톡 등에 바로 올릴 수 있는 MP4(H.264)를 먼저 고른다
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

export function pickMimeType(isSupported: (t: string) => boolean = (t) => MediaRecorder.isTypeSupported(t)) {
  return MIME_CANDIDATES.find((t) => {
    try {
      return isSupported(t)
    } catch {
      return false
    }
  })
}

export function canRecord(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype &&
    !!pickMimeType()
  )
}

/** 캔버스가 오염(tainted)되지 않게 CORS로 불러온다. 일반 <img>로 이미 캐시된 응답과 섞이지 않게 쿼리를 붙인다 */
const corsUrl = (url: string) => (/^(data:|blob:)/.test(url) ? url : url + (url.includes('?') ? '&' : '?') + 'cors=1')

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했어요: ${url}`))
    img.src = corsUrl(url)
  })
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.onloadeddata = () => resolve(v)
    v.onerror = () => reject(new Error(`동영상을 불러오지 못했어요: ${url}`))
    v.src = corsUrl(url)
    v.load()
  })
}

export const loadMedia = (reel: Reel): Promise<Drawable[]> =>
  Promise.all(reel.scenes.map((s) => (s.type === 'video' ? loadVideo(s.mediaUrl) : loadImage(s.mediaUrl))))

export interface RecordResult {
  blob: Blob
  mimeType: string
}

/**
 * canvas에 릴스를 처음부터 끝까지 한 번 그리며 녹화한다(릴스 길이만큼 걸림).
 * 탭이 백그라운드로 가면 브라우저가 그리기를 멈추므로 화면에 띄워 둔 상태에서 호출해야 한다.
 */
export async function recordReel(
  canvas: HTMLCanvasElement,
  reel: Reel,
  { onProgress, signal }: { onProgress?: (ratio: number) => void; signal?: AbortSignal } = {},
): Promise<RecordResult> {
  const mimeType = pickMimeType()
  if (!mimeType) throw new Error('이 브라우저는 영상 녹화를 지원하지 않아요')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 쓸 수 없어요')

  const media = await loadMedia(reel)
  await document.fonts?.load(`700 40px "Pretendard Variable"`).catch(() => undefined)
  drawFrame(ctx, reel, media, 0) // 녹화 시작 전에 첫 프레임을 그려 둔다(검은 첫 프레임 방지)

  const total = totalDuration(reel)
  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()))

  // 동영상 장면: 그 장면이 시작될 때 처음부터 재생
  let playing = -1
  const syncVideo = (index: number) => {
    if (index === playing) return
    const prev = media[playing]
    if (prev instanceof HTMLVideoElement) prev.pause()
    playing = index
    const v = media[index]
    if (v instanceof HTMLVideoElement) {
      v.currentTime = 0
      v.play().catch(() => undefined)
    }
  }

  recorder.start(250)
  const start = performance.now()
  await new Promise<void>((resolve, reject) => {
    const frame = () => {
      if (signal?.aborted) return reject(new DOMException('녹화를 취소했어요', 'AbortError'))
      const ms = performance.now() - start
      if (ms >= total) {
        drawFrame(ctx, reel, media, total - 1)
        return resolve()
      }
      syncVideo(framePlan(reel, ms).current.index)
      drawFrame(ctx, reel, media, ms)
      onProgress?.(ms / total)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }).finally(() => {
    media.forEach((m) => m instanceof HTMLVideoElement && m.pause())
  })
  // 마지막 프레임이 담기도록 잠깐 더 녹화
  await new Promise((r) => setTimeout(r, 200))
  recorder.stop()
  await stopped
  stream.getTracks().forEach((t) => t.stop())
  onProgress?.(1)
  return { blob: new Blob(chunks, { type: mimeType.split(';')[0] }), mimeType }
}

export const reelLengthSeconds = (reel: Reel) =>
  Math.round(reel.scenes.reduce((s, sc) => s + sceneDuration(sc), 0) / 1000)
