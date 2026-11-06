import { useEffect, useRef, useState } from 'react'
import type { Reel, Scene } from '../lib/types'
import { segmentFill, tick, type PlayState } from './reelClock'

const TITLE_MS = 1800 // 첫 장면 위에 제목을 띄우는 시간
const TRANSITION_MS = 500 // 전환 동안 직전 장면을 아래층에 깔아 두는 시간

interface Props {
  reel: Reel
  autoPlay?: boolean
}

/** reel.scenes(JSON)를 9:16 화면에서 자동 재생하는 릴스 플레이어. 탭하면 일시정지/재생. */
export default function ReelPlayer({ reel, autoPlay = true }: Props) {
  const { scenes } = reel
  const [state, setState] = useState<PlayState>({ index: 0, elapsed: 0, loop: 0 })
  const [paused, setPaused] = useState(!autoPlay)

  // requestAnimationFrame 시계: 일시정지 중에는 멈춘다
  useEffect(() => {
    if (paused || scenes.length === 0) return
    const clock = { raf: 0, last: performance.now() }
    const frame = (now: number) => {
      const dt = now - clock.last
      clock.last = now
      setState((s) => tick(s, dt, scenes))
      clock.raf = requestAnimationFrame(frame)
    }
    clock.raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(clock.raf)
  }, [paused, scenes])

  if (scenes.length === 0) {
    return (
      <div className="flex aspect-[9/16] w-full items-center justify-center rounded-2xl bg-neutral-900 text-sm text-neutral-400">
        재생할 장면이 없어요
      </div>
    )
  }

  const { index, elapsed, loop } = state
  const current = scenes[index]
  const hasPrev = index > 0 || loop > 0
  const under = hasPrev && elapsed < TRANSITION_MS ? (index - 1 + scenes.length) % scenes.length : null
  const showTitle = index === 0 && elapsed < TITLE_MS && reel.title
  const toggle = () => setPaused((p) => !p)

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
      className={`reel relative aspect-[9/16] w-full cursor-pointer select-none overflow-hidden rounded-2xl bg-black ${paused ? 'reel-paused' : ''}`}
    >
      {/* 직전 장면을 아래에 깔아서 전환이 검은 화면이 아니라 이전 장면 위에서 일어나게 */}
      {under !== null && (
        <SceneMedia key={`under-${under}-${loop}`} scene={scenes[under]} index={under} paused still />
      )}
      <div key={`cur-${index}-${loop}`} className={`absolute inset-0 reel-enter-${current.transition}`}>
        <SceneMedia scene={current} index={index} paused={paused} />
      </div>

      {/* 위쪽 그라데이션 + 장면별 진행 바 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute inset-x-3 top-3 flex gap-1" aria-hidden>
        {scenes.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
            <div className="h-full bg-white" style={{ width: `${segmentFill(i, state, scenes) * 100}%` }} />
          </div>
        ))}
      </div>

      {showTitle && (
        <div
          key={`title-${loop}`}
          className="reel-title absolute inset-x-6 top-1/3 text-center text-3xl font-extrabold text-white drop-shadow-lg"
        >
          {reel.title}
        </div>
      )}

      {/* 자막 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
      {current.caption && (
        <p
          key={`cap-${index}-${loop}`}
          className="reel-caption absolute inset-x-5 bottom-8 text-center text-lg font-semibold leading-snug text-white drop-shadow"
        >
          {current.caption}
        </p>
      )}

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-3xl text-white">
            ▶
          </span>
        </div>
      )}
    </div>
  )
}

function SceneMedia({
  scene,
  index,
  paused,
  still = false,
}: {
  scene: Scene
  index: number
  paused: boolean
  still?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (paused) v.pause()
    else v.play()?.catch(() => {}) // 자동재생이 막혀도 화면 진행은 계속
  }, [paused])

  if (scene.type === 'video') {
    return (
      <video
        ref={videoRef}
        src={scene.mediaUrl}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        playsInline
        autoPlay={!paused}
        preload="auto"
      />
    )
  }
  // 이미지: 장면 길이 동안 천천히 줌(Ken Burns). 짝수/홀수 장면마다 방향을 바꾼다
  const kenBurns = still ? '' : index % 2 === 0 ? 'reel-kenburns-in' : 'reel-kenburns-out'
  return (
    <img
      src={scene.mediaUrl}
      alt=""
      draggable={false}
      className={`absolute inset-0 h-full w-full object-cover ${kenBurns}`}
      style={{ animationDuration: `${scene.durationMs}ms` }}
    />
  )
}
