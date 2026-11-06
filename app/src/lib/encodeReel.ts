// 릴스를 프레임 단위로 그려서 바로 MP4로 인코딩한다 (#27).
// MediaRecorder(실시간 녹화)는 브라우저가 잠깐만 버벅여도 그 구간이 영상에서 멈추거나 건너뛰어서,
// 각 프레임을 정확한 시각(i / FPS)에 그리고 그 시각을 타임스탬프로 붙여 WebCodecs로 인코딩한다.
// 실시간이 아니라서 보통 릴스 길이보다 빨리 끝나고, 결과는 항상 30fps로 고르다.
// 출처: mp4-muxer (Vanilagy, MIT) https://github.com/Vanilagy/mp4-muxer — MP4 컨테이너 작성
import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { drawFrame, framePlan, timeline, totalDuration, type Drawable, videoTime } from './reelFrame'
import { loadMedia } from './recordReel'
import type { Reel } from './types'

export const FPS = 30
const KEYFRAME_EVERY = FPS * 2
// 인스타·카톡에서 잘 재생되는 H.264. 앞에서부터 지원되는 것을 쓴다 (High 4.0 → Main 4.0 → Baseline 3.1)
const CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42001f']

export function canEncode(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
}

async function pickCodec(width: number, height: number): Promise<string | undefined> {
  for (const codec of CODECS) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate: 6_000_000, framerate: FPS })
      if (supported) return codec
    } catch {
      /* 다음 후보 */
    }
  }
  return undefined
}

/** 브라우저 일을 잠깐 넘겨준다(인코더 출력 콜백·화면 갱신). 백그라운드 탭에서도 setTimeout보다 덜 느려지는 MessageChannel 사용 */
const yieldToBrowser = () =>
  new Promise<void>((resolve) => {
    const ch = new MessageChannel()
    ch.port1.onmessage = () => resolve()
    ch.port2.postMessage(null)
  })

function seek(v: HTMLVideoElement, sec: number): Promise<void> {
  const target = Math.min(Math.max(0, sec), Math.max(0, (v.duration || 0) - 0.05))
  if (Math.abs(v.currentTime - target) < 0.001) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      v.removeEventListener('seeked', done)
      resolve()
    }
    const timer = setTimeout(done, 1000) // 탐색이 안 끝나도 그 프레임은 그대로 그린다
    v.addEventListener('seeked', done)
    v.currentTime = target
  })
}

const FRAME_S = 1 / FPS
const MAX_PLAY_AHEAD_S = 1 // 이보다 멀리 앞이면 재생으로 따라가지 않고 바로 탐색

/**
 * 동영상을 목표 시각으로 옮기는 방법 (순수 함수, 테스트 대상).
 * - draw: 이미 그 프레임 근처 → 그대로 그림
 * - play: 조금 앞 → 짧게 재생해서 따라감 (프레임마다 seek하면 키프레임부터 다시 디코딩해서 매우 느림)
 * - seek: 뒤로 가야 하거나(반복 재생의 처음) 너무 멀리 앞 → 탐색
 */
export function videoStep(current: number, target: number): 'draw' | 'play' | 'seek' {
  const d = target - current
  if (Math.abs(d) < FRAME_S / 2) return 'draw'
  if (d > 0 && d <= MAX_PLAY_AHEAD_S) return 'play'
  return 'seek'
}

/**
 * 재생해서 target까지 따라간 뒤 멈춘다. 화면에 붙지 않은 <video>는 requestVideoFrameCallback이
 * 불리지 않아서, 브라우저에 일을 넘겨 가며 currentTime을 직접 확인한다.
 */
async function playUntil(v: HTMLVideoElement, target: number): Promise<void> {
  const deadline = performance.now() + 1500 // 재생이 막혀도 멈추지 않게
  try {
    await v.play()
  } catch {
    return seek(v, target)
  }
  while (v.currentTime < target - FRAME_S / 2 && !v.ended && performance.now() < deadline) {
    await yieldToBrowser()
  }
  v.pause()
}

/** 동영상을 target초 프레임으로 맞춘다. 대부분 짧은 재생으로 따라가고, 되감기·먼 이동만 탐색 */
async function advanceVideo(v: HTMLVideoElement, target: number): Promise<void> {
  const step = videoStep(v.currentTime, target)
  if (step === 'draw') return
  if (step === 'play') return playUntil(v, target)
  return seek(v, target)
}

export async function encodeReel(
  canvas: HTMLCanvasElement,
  reel: Reel,
  { onProgress, signal }: { onProgress?: (ratio: number) => void; signal?: AbortSignal } = {},
): Promise<{ blob: Blob; mimeType: string }> {
  const { width, height } = canvas
  const codec = await pickCodec(width, height)
  if (!codec) throw new Error('이 브라우저는 영상 인코딩(H.264)을 지원하지 않아요')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 쓸 수 없어요')

  const media: Drawable[] = await loadMedia(reel)
  await document.fonts?.load(`700 40px "Pretendard Variable"`).catch(() => undefined)
  media.forEach((m) => m instanceof HTMLVideoElement && m.pause())

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height, frameRate: FPS },
    fastStart: 'in-memory', // 앞부분에 색인을 둬서 받자마자 재생되게
  })
  let encodeError: unknown = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (encodeError = e),
  })
  encoder.configure({ codec, width, height, bitrate: 6_000_000, framerate: FPS })

  const total = totalDuration(reel)
  const frames = Math.ceil((total / 1000) * FPS)
  const segs = timeline(reel)
  try {
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw new DOMException('영상 만들기를 취소했어요', 'AbortError')
      if (encodeError) throw encodeError
      const ms = (i * 1000) / FPS
      // 동영상 클립은 그 클립 안의 위치로 맞춘다 (앞부분부터 클립 길이만큼 = 자르기)
      const plan = framePlan(reel, ms, segs)
      const v = plan && media[plan.media]
      if (plan && v instanceof HTMLVideoElement) await advanceVideo(v, videoTime(plan.local, v.duration))
      drawFrame(ctx, reel, media, ms)
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) })
      encoder.encode(frame, { keyFrame: i % KEYFRAME_EVERY === 0 })
      frame.close()
      onProgress?.((i + 1) / frames)
      // 인코더가 밀리면 잠깐 기다린다(메모리 폭주 방지), 아니면 몇 프레임마다 화면 갱신 기회를 준다
      while (encoder.encodeQueueSize > 8) await yieldToBrowser()
      if (i % 3 === 0) await yieldToBrowser()
    }
    await encoder.flush()
    if (encodeError) throw encodeError
    muxer.finalize()
  } finally {
    if (encoder.state !== 'closed') encoder.close()
  }
  return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), mimeType: 'video/mp4' }
}
