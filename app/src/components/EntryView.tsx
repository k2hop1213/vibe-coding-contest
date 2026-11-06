import { useEffect, useState } from 'react'
import { getEntry, withMediaUrls, type EntryDetail, type EntryStatus } from '../lib/api'
import ReelPlayer from './ReelPlayer'

export const POLL_MS = 2000 // planning.md: 생성 후 2초 간격으로 확인
export const SLOW_MS = 20000 // 이 시간이 넘으면 "조금 더 걸려요" 안내

type Props = {
  id: string
  /** 상태가 바뀌면 달력 칸도 갱신하도록 알려준다 */
  onStatus: (status: EntryStatus) => void
  onRetry: () => void
  pollMs?: number
  slowMs?: number
}

/** 기록 있는 날: processing이면 생성 중 화면(폴링) → done이면 플레이어 → failed면 다시 만들기 */
export default function EntryView({ id, onStatus, onRetry, pollMs = POLL_MS, slowMs = SLOW_MS }: Props) {
  const [detail, setDetail] = useState<EntryDetail | null>(null)
  const [error, setError] = useState(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    const slowTimer = setTimeout(() => setSlow(true), slowMs)

    const load = async () => {
      try {
        const d = await getEntry(id)
        if (stop) return
        setDetail(d)
        setError(false)
        if (d.status === 'processing') timer = setTimeout(load, pollMs)
        else onStatus(d.status)
      } catch {
        if (stop) return
        setError(true)
        timer = setTimeout(load, pollMs) // 잠깐 끊겨도 계속 확인
      }
    }
    load()
    return () => {
      stop = true
      clearTimeout(timer)
      clearTimeout(slowTimer)
    }
    // onStatus는 매 렌더 새 함수라 의존성에서 제외 (id가 바뀔 때만 다시 시작)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pollMs, slowMs])

  if (detail?.status === 'done' && detail.reel) {
    return (
      <div className="mx-auto w-full max-w-[280px]">
        <ReelPlayer reel={withMediaUrls(detail.reel)} />
      </div>
    )
  }

  if (detail?.status === 'failed') {
    return (
      <Card>
        <p className="text-3xl">😢</p>
        <p className="mt-3 font-semibold text-neutral-700">릴스를 만들지 못했어요</p>
        <p className="mt-1 text-sm text-neutral-500">같은 날짜로 다시 만들 수 있어요.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-xl bg-linear-to-r from-rose-500 to-fuchsia-600 px-5 py-3 font-bold text-white"
        >
          다시 만들기
        </button>
      </Card>
    )
  }

  // 처음 불러오는 중이거나 processing
  return (
    <Card>
      <div className="relative flex aspect-[9/16] w-32 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-b from-rose-400 to-fuchsia-600">
        <div className="absolute inset-0 animate-pulse bg-white/20" />
        <span className="text-4xl">🎬</span>
      </div>
      <p className="mt-5 font-semibold text-neutral-700" role="status">
        {detail ? 'AI가 릴스를 편집하고 있어요' : '불러오는 중…'}
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        {error
          ? '서버 응답을 기다리는 중이에요…'
          : slow
            ? '생각보다 오래 걸리네요. 조금만 더 기다려 주세요!'
            : '장면 순서와 자막을 고르는 중…'}
      </p>
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-neutral-50 p-6 text-center">
      {children}
    </div>
  )
}
