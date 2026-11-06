import { useState } from 'react'
import { deleteEntry } from '../lib/api'

type Props = { id: string; onDeleted: () => void }

/** 그날 기록 삭제 — 한 번 더 확인한 뒤 지운다 (브라우저 confirm 대신 화면 안에서 확인) */
export default function DeleteEntryButton({ id, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-2 w-full rounded-xl py-2 text-sm font-medium text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
      >
        🗑 기록 삭제하고 다시 올리기
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
    <div className="mt-2 rounded-xl bg-rose-50 p-3 text-center" role="alertdialog" aria-label="기록 삭제 확인">
      <p className="text-sm font-semibold text-rose-700">정말 삭제할까요?</p>
      <p className="mt-0.5 text-xs text-rose-600/80">사진·영상·일기가 모두 지워지고 되돌릴 수 없어요.</p>
      {error && <p className="mt-1 text-xs text-rose-700">삭제하지 못했어요. 다시 시도해 주세요.</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="flex-1 rounded-lg bg-white py-2 text-sm font-medium text-neutral-600"
        >
          취소
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? '삭제 중…' : '삭제'}
        </button>
      </div>
    </div>
  )
}
