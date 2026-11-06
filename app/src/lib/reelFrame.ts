// 릴스 한 프레임을 캔버스에 그린다 (#27). ReelPlayer(CSS 애니메이션)와 같은 연출을 캔버스로 옮긴 것.
// - framePlan(): 시각(ms) → 무엇을 어떻게 그릴지 (순수 함수, 테스트 대상)
// - drawFrame(): framePlan을 실제 캔버스에 그림
import { sceneDuration, tick } from '../components/reelClock'
import type { Reel, Transition } from './types'

export const VIDEO_W = 720
export const VIDEO_H = 1280

export const TRANSITION_MS = 450
export const CAPTION_DELAY_MS = 150
export const CAPTION_IN_MS = 500
export const TITLE_MS = 1800
const KEN_BURNS = 0.15

export const totalDuration = (reel: Reel) => reel.scenes.reduce((sum, s) => sum + sceneDuration(s), 0)

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const easeOut = (t: number) => 1 - (1 - t) ** 3

export interface Layer {
  index: number
  alpha: number
  dx: number // 화면 너비 대비 가로 이동 (0 = 제자리, 1 = 한 화면 오른쪽)
  scale: number // 전환용 배율 (켄번스와 별개)
  progress: number // 장면 안 진행률 0~1 (켄번스·동영상 위치용)
}

export interface FramePlan {
  under: Layer | null
  current: Layer
  caption: { text: string; alpha: number; dy: number } | null
  title: { text: string; alpha: number; scale: number } | null
}

function enter(transition: Transition, t: number) {
  const e = easeOut(clamp01(t))
  if (transition === 'slide') return { alpha: 1, dx: 1 - e, scale: 1 }
  if (transition === 'zoom') return { alpha: e, dx: 0, scale: 1.25 - 0.25 * e }
  return { alpha: e, dx: 0, scale: 1 }
}

/** 릴스 시작부터 ms 지난 시점에 그릴 것 */
export function framePlan(reel: Reel, ms: number): FramePlan {
  const { index, elapsed } = tick({ index: 0, elapsed: 0, loop: 0 }, ms, reel.scenes)
  const scene = reel.scenes[index]
  const dur = sceneDuration(scene)
  // 첫 장면은 전환 없이 바로 보인다(앞 장면이 없으므로)
  const t = index === 0 ? 1 : elapsed / TRANSITION_MS
  const current: Layer = { index, progress: clamp01(elapsed / dur), ...enter(scene.transition, t) }

  const under: Layer | null =
    index > 0 && elapsed < TRANSITION_MS ? { index: index - 1, alpha: 1, dx: 0, scale: 1, progress: 1 } : null

  const c = clamp01((elapsed - CAPTION_DELAY_MS) / CAPTION_IN_MS)
  const caption = scene.caption && c > 0 ? { text: scene.caption, alpha: easeOut(c), dy: (1 - easeOut(c)) * 24 } : null

  let title: FramePlan['title'] = null
  if (index === 0 && reel.title && elapsed < TITLE_MS) {
    const p = elapsed / TITLE_MS // ReelPlayer의 reel-title 키프레임과 같게: 0~20% 등장, 75~100% 퇴장
    const alpha = p < 0.2 ? p / 0.2 : p > 0.75 ? (1 - p) / 0.25 : 1
    const scale = p < 0.2 ? 0.9 + 0.1 * (p / 0.2) : p > 0.75 ? 1 + 0.05 * ((p - 0.75) / 0.25) : 1
    title = { text: reel.title, alpha: clamp01(alpha), scale }
  }
  return { under, current, caption, title }
}

/** 켄번스: 짝수 장면은 줌인, 홀수 장면은 줌아웃 (ReelPlayer와 같은 방향) */
export function kenBurns(index: number, progress: number) {
  const p = clamp01(progress)
  const zoom = index % 2 === 0 ? 1 + KEN_BURNS * p : 1 + KEN_BURNS * (1 - p)
  const shift = index % 2 === 0 ? -0.02 * p : 0.02 * (1 - p) // 화면 대비 살짝 이동
  return { zoom, shift }
}

/** 한 줄 폭을 넘으면 단어 단위(공백 없으면 글자 단위)로 줄바꿈 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 3): string[] {
  const tokens = text.includes(' ') ? text.split(/(\s+)/) : Array.from(text)
  const lines: string[] = []
  let line = ''
  for (const tok of tokens) {
    const next = line + tok
    if (line && measure(next.trimEnd()) > maxWidth) {
      lines.push(line.trim())
      line = tok.trimStart()
    } else {
      line = next
    }
  }
  if (line.trim()) lines.push(line.trim())
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

function drawCover(ctx: CanvasRenderingContext2D, m: Drawable, zoom: number, shift: number, W: number, H: number) {
  const { w, h } = mediaSize(m)
  if (!w || !h) return
  const s = Math.max(W / w, H / h) * zoom
  const dw = w * s
  const dh = h * s
  ctx.drawImage(m, (W - dw) / 2 + shift * W, (H - dh) / 2 + shift * H, dw, dh)
}

const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, media: Drawable[], W: number, H: number) {
  const m = media[layer.index]
  if (!m) return
  ctx.save()
  ctx.globalAlpha = layer.alpha
  ctx.translate(layer.dx * W + W / 2, H / 2)
  ctx.scale(layer.scale, layer.scale)
  ctx.translate(-W / 2, -H / 2)
  const isVideo = m instanceof HTMLVideoElement
  const { zoom, shift } = isVideo ? { zoom: 1, shift: 0 } : kenBurns(layer.index, layer.progress)
  drawCover(ctx, m, zoom, shift, W, H)
  ctx.restore()
}

function gradient(ctx: CanvasRenderingContext2D, y0: number, y1: number, from: string, to: string, W: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, from)
  g.addColorStop(1, to)
  ctx.fillStyle = g
  ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0))
}

/** media[i]는 reel.scenes[i]의 이미지/동영상 요소 */
export function drawFrame(ctx: CanvasRenderingContext2D, reel: Reel, media: Drawable[], ms: number) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const plan = framePlan(reel, ms)

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  if (plan.under) drawLayer(ctx, plan.under, media, W, H)
  drawLayer(ctx, plan.current, media, W, H)

  gradient(ctx, 0, H * 0.14, 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', W)
  gradient(ctx, H, H * 0.7, 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0)', W)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (plan.caption) {
    const size = Math.round(W * 0.06)
    ctx.font = `700 ${size}px ${FONT}`
    const lines = wrapText(plan.caption.text, W * 0.84, (s) => ctx.measureText(s).width)
    const lineH = size * 1.35
    const baseY = H - H * 0.075 - (lines.length - 1) * lineH + plan.caption.dy
    ctx.save()
    ctx.globalAlpha = plan.caption.alpha
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 12
    ctx.fillStyle = '#fff'
    lines.forEach((l, i) => ctx.fillText(l, W / 2, baseY + i * lineH))
    ctx.restore()
  }

  if (plan.title) {
    const size = Math.round(W * 0.095)
    ctx.save()
    ctx.globalAlpha = plan.title.alpha
    ctx.translate(W / 2, H / 3)
    ctx.scale(plan.title.scale, plan.title.scale)
    ctx.font = `800 ${size}px ${FONT}`
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 18
    ctx.fillStyle = '#fff'
    wrapText(plan.title.text, W * 0.85, (s) => ctx.measureText(s).width, 2).forEach((l, i, arr) =>
      ctx.fillText(l, 0, (i - (arr.length - 1) / 2) * size * 1.2),
    )
    ctx.restore()
  }
}
