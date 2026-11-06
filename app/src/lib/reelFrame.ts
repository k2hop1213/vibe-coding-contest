// 릴스 편집 플랜(v2) 한 프레임을 캔버스에 그린다 — 규칙은 docs/REELS_TEMPLATES.md (#32)
// - timeline(): 하드 컷 타임라인 (클립 + emotional 플래시 몽타주)
// - framePlan(): 시각(ms) → 무엇을 어떻게 그릴지 (순수 함수, 테스트 대상)
// - textLayout(): 템플릿별 텍스트 위치·크기 (화면 비율, 순수 함수)
// - drawFrame(): framePlan을 실제 캔버스에 그림
import type { MediaType, Reel } from './types'

export const VIDEO_W = 720
export const VIDEO_H = 1280

export const FLASH_MS = 150 // 플래시 몽타주 한 장
export const MIN_CLIP_MS = 300
export const SAFE_TOP = 0.1 // 세이프존: 위 10%, 아래 15%에는 텍스트를 넣지 않는다
export const SAFE_BOTTOM = 0.85
export const COLOR_FILTER = 'contrast(1.05) saturate(1.1)' // 모든 클립 공통 색 보정
export const EN_COLOR = '#F5D547'

const isVideoUrl = (url: string) => /\.(mp4|mov|webm)(\?|$)/i.test(url)

/** 그릴 미디어 목록: clips 다음에 플래시 몽타주 사진들. drawFrame의 media[i]가 이 순서 */
export function mediaList(reel: Reel): { url: string; type: MediaType }[] {
  const flash = (reel.flashMontage?.mediaUrls ?? []).map((url) => ({
    url,
    type: (isVideoUrl(url) ? 'video' : 'image') as MediaType,
  }))
  return [...reel.clips.map((c) => ({ url: c.mediaUrl, type: c.type })), ...flash]
}

export interface Segment {
  start: number
  duration: number
  /** mediaList(reel) 안의 위치 */
  media: number
  /** 이 구간의 첫 클립(자막용). 플래시 몽타주 구간은 null */
  clip: number | null
  /** 이 구간에 합쳐진 클립 수 — 같은 미디어가 연속되면 하나의 긴 컷으로 합친다 (#36) */
  clipCount: number
  /** 클립 한 개 길이(ms) — 합쳐진 구간 안에서 자막이 바뀌는 간격 */
  clipMs: number
}

export function timeline(reel: Reel): Segment[] {
  const clipMs = Math.max(MIN_CLIP_MS, (reel.clipDuration || 0) * 1000)
  const flash = reel.template === 'emotional' ? (reel.flashMontage?.mediaUrls ?? []) : []
  const flashAt = Math.min(Math.max(0, reel.flashMontage?.startIndex ?? 0), reel.clips.length)
  const segs: Segment[] = []
  let t = 0
  const push = (duration: number, media: number, clip: number | null) => {
    segs.push({ start: t, duration, media, clip, clipCount: clip === null ? 0 : 1, clipMs: duration })
    t += duration
  }
  reel.clips.forEach((c, i) => {
    if (i === flashAt) flash.forEach((_, j) => push(FLASH_MS, reel.clips.length + j, null))
    // 서버는 미디어가 적은 날 같은 클립을 연속으로 늘린다(0000011111, #36).
    // 컷마다 동영상이 처음으로 되감기지 않도록 바로 앞 구간과 같은 미디어면 하나의 긴 컷으로 이어 붙인다.
    // (자막은 원래 클립 경계마다 바뀌므로 clipMs 간격으로 계산 — framePlan 참고)
    const prev = segs[segs.length - 1]
    if (prev && prev.clip !== null && i !== flashAt && reel.clips[prev.clip].mediaUrl === c.mediaUrl) {
      prev.duration += clipMs
      prev.clipCount += 1
      t += clipMs
      return
    }
    push(clipMs, i, i)
  })
  if (flashAt === reel.clips.length) flash.forEach((_, j) => push(FLASH_MS, reel.clips.length + j, null))
  return segs
}

/** 클립 i가 언제 시작해서 얼마나 보이는지 (합쳐진 구간 안이어도 클립 단위로) */
export function clipSpan(segs: Segment[], i: number): { start: number; duration: number } | null {
  const s = segs.find((x) => x.clip !== null && i >= x.clip && i < x.clip + x.clipCount)
  return s && s.clip !== null ? { start: s.start + (i - s.clip) * s.clipMs, duration: s.clipMs } : null
}

export const totalDuration = (reel: Reel) => timeline(reel).reduce((sum, s) => sum + s.duration, 0)

export interface FramePlan {
  segment: number
  media: number
  clip: number | null
  /** 이 구간 안에서 지난 시간(ms) — 동영상 위치 */
  local: number
}

/** 릴스 시작부터 ms 지난 시점에 그릴 것. 끝을 넘으면 마지막 프레임에 머문다 */
export function framePlan(reel: Reel, ms: number, segs: Segment[] = timeline(reel)): FramePlan | null {
  if (segs.length === 0) return null
  let i = segs.findIndex((s) => ms < s.start + s.duration)
  if (i < 0) i = segs.length - 1
  const s = segs[i]
  const local = Math.min(s.duration, Math.max(0, ms - s.start))
  // 사진·동영상 모두 확대 없이 그대로 (팀 결정 11/06)
  // 같은 미디어가 연속돼 합쳐진 긴 컷(#40)에서는 local이 이어지므로 동영상이 되감기지 않고 계속 재생된다.
  // 자막은 원래 클립 경계마다 바뀐다
  const clip = s.clip === null ? null : s.clip + Math.min(s.clipCount - 1, Math.floor(local / s.clipMs))
  return { segment: i, media: s.media, clip, local }
}

export interface TextLine {
  text: string
  /** 화면 너비 대비. align이 center면 무시하고 가운데 */
  x: number
  /** 화면 높이 대비, 첫 줄 가운데 */
  y: number
  /** 화면 너비 대비 글자 크기 */
  size: number
  weight: number
  color: string
  align: 'center' | 'left'
  serif?: boolean
  /** 반투명 검은 배경 박스 (review 부제) */
  box?: boolean
}

const line = (t: Omit<TextLine, 'x' | 'weight' | 'color' | 'align'> & Partial<TextLine>): TextLine => ({
  x: 0.5,
  weight: 600,
  color: '#fff',
  align: 'center',
  ...t,
  y: Math.min(SAFE_BOTTOM, Math.max(SAFE_TOP, t.y)),
})

/** 스펙 §2 템플릿별 텍스트. clip이 null(플래시 몽타주)이면 컷마다 바뀌는 자막은 없다 */
export function textLayout(reel: Reel, clip: number | null): TextLine[] {
  const c = clip === null ? null : reel.clips[clip]
  const title = reel.fixedText?.title?.trim()
  const subtitle = reel.fixedText?.subtitle?.trim()
  const out: TextLine[] = []
  switch (reel.template) {
    case 'emotional':
      if (c?.captionEn) out.push(line({ text: c.captionEn, y: 0.62, size: 0.03, weight: 500, color: EN_COLOR }))
      if (c?.caption) out.push(line({ text: c.caption, y: c.captionEn ? 0.655 : 0.62, size: 0.045 }))
      break
    case 'montage':
      if (title) out.push(line({ text: title.toUpperCase(), y: 0.22, size: 0.06, weight: 800 }))
      if (subtitle) out.push(line({ text: subtitle, y: 0.26, size: 0.035, weight: 500 }))
      break
    case 'review':
      if (title) out.push(line({ text: title, y: 0.19, size: 0.055, weight: 700, serif: true }))
      if (subtitle) out.push(line({ text: subtitle, y: 0.235, size: 0.035, weight: 500, box: true }))
      if (c?.caption) out.push(line({ text: c.caption, y: 0.72, size: 0.045 }))
      break
    case 'closeup':
      ;(title ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3)
        .forEach((text, i) => out.push(line({ text, x: 0.08, y: 0.65 + i * 0.04, size: 0.045, weight: 700, align: 'left' })))
      break
  }
  return out
}

/** 한 줄 폭을 넘으면 단어 단위(공백 없으면 글자 단위)로 줄바꿈 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 3): string[] {
  const tokens = text.includes(' ') ? text.split(/(\s+)/) : Array.from(text)
  const lines: string[] = []
  let cur = ''
  for (const tok of tokens) {
    const next = cur + tok
    if (cur && measure(next.trimEnd()) > maxWidth) {
      lines.push(cur.trim())
      cur = tok.trimStart()
    } else {
      cur = next
    }
  }
  if (cur.trim()) lines.push(cur.trim())
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.?$/, '…')
    return kept
  }
  return lines
}

export type Drawable = HTMLImageElement | HTMLVideoElement

function mediaSize(m: Drawable) {
  return m instanceof HTMLVideoElement ? { w: m.videoWidth, h: m.videoHeight } : { w: m.naturalWidth, h: m.naturalHeight }
}

/** object-fit: cover (가운데 기준, 확대 없음) */
function drawCover(ctx: CanvasRenderingContext2D, m: Drawable, W: number, H: number) {
  const { w, h } = mediaSize(m)
  if (!w || !h) return
  const s = Math.max(W / w, H / h)
  const dw = w * s
  const dh = h * s
  ctx.drawImage(m, (W - dw) / 2, (H - dh) / 2, dw, dh)
}

const SANS = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
const SERIF = '"Nanum Myeongjo", "AppleMyungjo", "Batang", serif'

function drawText(ctx: CanvasRenderingContext2D, t: TextLine, W: number, H: number) {
  const size = Math.round(W * t.size)
  const px = W / 360 // 스펙의 CSS px(폰 너비 360 기준)을 캔버스 크기로
  ctx.save()
  ctx.font = `${t.weight} ${size}px ${t.serif ? SERIF : SANS}`
  ctx.textAlign = t.align
  ctx.textBaseline = 'middle'
  const maxW = t.align === 'left' ? W * (1 - t.x - 0.08) : W * 0.84
  const lines = wrapText(t.text, maxW, (s) => ctx.measureText(s).width, 2)
  const lineH = size * 1.3
  const x = t.align === 'left' ? W * t.x : W / 2
  const y0 = H * t.y
  if (t.box) {
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(x - w / 2, y0 - lineH / 2 - size * 0.15, w, lineH * lines.length + size * 0.3)
  }
  // 흰색 + 약한 그림자 0 1px 4px rgba(0,0,0,0.5)
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowOffsetY = 1 * px
  ctx.shadowBlur = 4 * px
  ctx.fillStyle = t.color
  lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * lineH))
  ctx.restore()
}

/** media[i]는 mediaList(reel)[i]의 이미지/동영상 요소 (아직 없으면 검은 화면) */
export function drawFrame(ctx: CanvasRenderingContext2D, reel: Reel, media: (Drawable | undefined)[], ms: number) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  const plan = framePlan(reel, ms)
  if (!plan) return
  const m = media[plan.media]
  if (m) {
    ctx.save()
    ctx.filter = COLOR_FILTER
    drawCover(ctx, m, W, H)
    ctx.restore()
  }
  textLayout(reel, plan.clip).forEach((t) => drawText(ctx, t, W, H))
}
