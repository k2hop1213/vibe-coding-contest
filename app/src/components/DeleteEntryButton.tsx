import { useState } from 'react'
import { deleteEntry } from '../lib/api'

type Props = { id: string; onDeleted: () => void }

/** 그날 기록 삭제 — 날짜 줄 오른쪽의 작은 버튼. 한 번 더 확인한 뒤 지운다 (브라우저 confirm 대신 그 자리에서) */
export default function DeleteEntryButton({ id, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="기록 삭제"
        className="shrink-0 rounded-lg px-2.5 py-1 text-sm text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
      >
        🗑 삭제
      </button>
    )
  }

  const remove = async () => {
    setBusy(true)
    setError(false)
    try {
      await deleteEntry(id)
      onDeleted()
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 text-sm" role="group" aria-label="기록 삭제 확인">
      <span className={error ? 'text-rose-600' : 'text-neutral-500'}>{error ? '실패, 다시?' : '모두 지울까요?'}</span>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="rounded-lg px-2 py-1 text-neutral-500 hover:bg-neutral-100"
      >
        취소
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white disabled:opacity-60"
      >
        {busy ? '삭제 중…' : '삭제'}
      </button>
    </div>
  )
}
