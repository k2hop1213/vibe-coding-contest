import { useEffect, useRef, useState } from 'react'
import { mediaUrl, uploadVideo } from '../lib/api'
import { VIDEO_H, VIDEO_W } from '../lib/reelFrame'
import { canEncode, encodeReel } from '../lib/encodeReel'
import { recordReel } from '../lib/recordReel'
import type { Reel } from '../lib/types'

type Phase = { kind: 'recording'; progress: number } | { kind: 'uploading' } | { kind: 'error'; message: string }

type Props = {
  entryId: string
  /** mediaUrl이 이미 절대 경로로 바뀐 릴스 (withMediaUrls) */
  reel: Reel
  onDone: (videoUrl: string) => void
  /** 영상 대신 기존 플레이어로 보기 */
  onSkip: () => void
}

/** 완성된 릴스를 캔버스에 그려 영상 하나(MP4)로 만들고 → 서버에 올려 저장한다 (#27).
 *  WebCodecs가 있으면 프레임 단위 인코딩(빠르고 끊김 없음), 없으면 실시간 녹화(MediaRecorder) */
export default function ReelVideoMaker({ entryId, reel, onDone, onSkip }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'recording', progress: 0 })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctrl = new AbortController()
    const encode = canEncode()
    // 실시간 녹화는 탭을 떠나면 브라우저가 그리기를 멈춰 영상이 끊기므로 취소한다 (프레임 인코딩은 느려질 뿐 괜찮음)
    const onHide = () => !encode && document.hidden && ctrl.abort()
    document.addEventListener('visibilitychange', onHide)

    setPhase({ kind: 'recording', progress: 0 })
    const opts = { signal: ctrl.signal, onProgress: (p: number) => setPhase({ kind: 'recording', progress: p }) }
    ;(encode ? encodeReel(canvas, reel, opts) : recordReel(canvas, reel, opts))
      .then(async ({ blob }) => {
        if (ctrl.signal.aborted) return
        setPhase({ kind: 'uploading' })
        const { videoUrl } = await uploadVideo(entryId, blob)
        if (!ctrl.signal.aborted) onDone(mediaUrl(videoUrl) ?? videoUrl)
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted && !document.hidden) return // 화면 전환·StrictMode 재실행으로 인한 취소
        setPhase({
          kind: 'error',
          message: document.hidden ? '다른 화면으로 가서 영상 합치기가 멈췄어요.' : e instanceof Error ? e.message : '영상을 만들지 못했어요.',
        })
      })
    return () => {
      ctrl.abort()
      document.removeEventListener('visibilitychange', onHide)
    }
    // onDone은 매 렌더 새 함수라 제외 — 릴스·기록·재시도 횟수가 바뀔 때만 다시 녹화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, reel, attempt])

  const percent = phase.kind === 'recording' ? Math.round(phase.progress * 100) : 100

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={VIDEO_W}
        height={VIDEO_H}
        className="aspect-[9/16] w-full rounded-2xl bg-black"
        aria-label="릴스 영상 합치는 화면"
      />
      {phase.kind !== 'error' ? (
        <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/60 px-3 py-2 text-white" role="status">
          <p className="text-xs font-semibold">
            {phase.kind === 'uploading' ? '영상 저장하는 중…' : `하나의 영상으로 합치는 중 ${percent}%`}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full bg-white transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-white/70">이 화면을 띄워 둔 채로 잠시만 기다려 주세요</p>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-black/70 p-5 text-center text-white">
          <p className="text-sm font-semibold">{phase.message}</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-neutral-900"
          >
            다시 합치기
          </button>
          <button type="button" onClick={onSkip} className="text-xs text-white/80 underline">
            영상 없이 미리보기로 보기
          </button>
        </div>
      )}
    </div>
  )
}
