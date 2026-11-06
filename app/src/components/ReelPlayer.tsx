import { useEffect, useMemo, useRef, useState } from 'react'
import { drawFrame, framePlan, textLayout, timeline, totalDuration, VIDEO_H, VIDEO_W, type Drawable } from '../lib/reelFrame'
import { loadMedia } from '../lib/recordReel'
import type { Reel } from '../lib/types'

interface Props {
  reel: Reel
  autoPlay?: boolean
}

/** "영상 없이 미리보기": 합성기와 같은 drawFrame으로 캔버스에 반복 재생한다 (#32). 탭하면 일시정지/재생 */
export default function ReelPlayer({ reel, autoPlay = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const media = useRef<Drawable[]>([])
  const [ms, setMs] = useState(0)
  const [paused, setPaused] = useState(!autoPlay)
  const segs = useMemo(() => timeline(reel), [reel])
  const total = useMemo(() => totalDuration(reel), [reel])

  // 미디어는 불러오는 대로 그린다 (못 불러오면 검은 화면 + 텍스트)
  useEffect(() => {
    const ctrl = new AbortController()
    media.current = []
    loadMedia(reel)
      .then((m) => !ctrl.signal.aborted && (media.current = m))
      .catch(() => undefined)
    return () => {
      ctrl.abort()
      media.current.forEach((m) => m instanceof HTMLVideoElement && m.pause())
    }
  }, [reel])

  // requestAnimationFrame 시계: 일시정지 중에는 멈추고, 끝나면 처음으로
  useEffect(() => {
    if (paused || total === 0) return
    const clock = { raf: 0, last: performance.now() }
    const frame = (now: number) => {
      const dt = now - clock.last
      clock.last = now
      setMs((t) => (t + Math.max(0, dt)) % total)
      clock.raf = requestAnimationFrame(frame)
    }
    clock.raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(clock.raf)
  }, [paused, total])

  const plan = framePlan(reel, ms, segs)

  // 그리기 + 동영상 클립은 클립 안 위치에 맞춰 재생
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!plan) return
    media.current.forEach((m, i) => {
      if (!(m instanceof HTMLVideoElement)) return
      if (i !== plan.media || paused) return m.pause()
      if (Math.abs(m.currentTime - plan.local / 1000) > 0.3) m.currentTime = plan.local / 1000
      if (m.paused) m.play().catch(() => undefined)
    })
    if (ctx) drawFrame(ctx, reel, media.current, ms)
  })

  if (!plan) {
    return (
      <div className="flex aspect-[9/16] w-full items-center justify-center rounded-2xl bg-neutral-900 text-sm text-neutral-400">
        재생할 장면이 없어요
      </div>
    )
  }

  const toggle = () => setPaused((p) => !p)
  const clipCount = reel.clips.length
  const fill = (i: number) => {
    const start = segs.find((s) => s.clip === i)
    if (!start) return 0
    return Math.min(1, Math.max(0, (ms - start.start) / start.duration))
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={paused ? '릴스 재생' : '릴스 일시정지'}
      aria-pressed={paused}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          toggle()
        }
      }}
      className="relative aspect-[9/16] w-full cursor-pointer select-none overflow-hidden rounded-2xl bg-black"
    >
      <canvas ref={canvasRef} width={VIDEO_W} height={VIDEO_H} className="absolute inset-0 h-full w-full" aria-hidden />

      {/* 클립별 진행 바 */}
      <div className="absolute inset-x-3 top-3 flex gap-1" aria-hidden>
        {Array.from({ length: clipCount }, (_, i) => (
          <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
            <div className="h-full bg-white" style={{ width: `${fill(i) * 100}%` }} />
          </div>
        ))}
      </div>

      {/* 캔버스 글자는 화면 읽기 프로그램이 못 읽으므로 같은 텍스트를 숨겨 둔다 */}
      <p className="sr-only" aria-live="off">
        {textLayout(reel, plan.clip).map((t, i) => (
          <span key={i}>{t.text} </span>
        ))}
      </p>

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-3xl text-white">▶</span>
        </div>
      )}
    </div>
  )
}
