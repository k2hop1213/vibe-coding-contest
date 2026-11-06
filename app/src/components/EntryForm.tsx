// 출처: 레이아웃 참고 — vStory 앱 작성 화면 (일기 입력 · 스타일 태그 칩 · 사진/동영상 추가), 디자인만 참고·코드 미사용
import { useEffect, useRef, useState } from 'react'
import { getStyles, type EntryDraft, type Style } from '../lib/api'
import { ACCEPT, isAllowed } from '../lib/media'
import { mockStyles } from '../lib/mockEntries'

export const MAX_FILES = 10

type Media = { file: File; url: string }

type Props = {
  date: string
  onSubmit: (draft: EntryDraft) => void
  submitting?: boolean
}

export default function EntryForm({ date, onSubmit, submitting = false }: Props) {
  const [styles, setStyles] = useState<Style[]>([])
  const [diary, setDiary] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [rejected, setRejected] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const mediaRef = useRef(media)
  useEffect(() => {
    mediaRef.current = media
  }, [media])

  useEffect(() => {
    getStyles()
      .catch(() => (import.meta.env.DEV ? mockStyles : []))
      .then(setStyles)
  }, [])

  // 화면을 떠날 때 미리보기 URL 정리
  useEffect(() => () => mediaRef.current.forEach((m) => URL.revokeObjectURL?.(m.url)), [])

  const toggleTag = (id: string) =>
    setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const all = Array.from(list)
    const picked = all.filter(isAllowed)
    setRejected(all.filter((f) => !isAllowed(f)).map((f) => f.name))
    setMedia((m) => [
      ...m,
      ...picked.slice(0, MAX_FILES - m.length).map((file) => ({ file, url: URL.createObjectURL?.(file) ?? '' })),
    ])
  }

  const removeAt = (i: number) =>
    setMedia((m) => {
      URL.revokeObjectURL?.(m[i].url)
      return m.filter((_, j) => j !== i)
    })

  const noMedia = media.length === 0
  const noTag = tags.length === 0
  const hint =
    noMedia && noTag
      ? '사진·동영상과 분위기 힌트를 1개 이상 골라 주세요'
      : noMedia
        ? '사진·동영상을 1개 이상 추가해 주세요'
        : noTag
          ? '분위기 힌트를 1개 이상 골라 주세요'
          : null
  const canSubmit = !hint && !submitting

  return (
    <form
      className="flex flex-1 flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit) onSubmit({ date, diary, tags, files: media.map((m) => m.file) })
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-neutral-700">오늘의 일기</span>
        <textarea
          value={diary}
          onChange={(e) => setDiary(e.target.value)}
          rows={5}
          placeholder="오늘 어떤 하루였나요? 한 줄이어도 좋아요."
          className="resize-none rounded-2xl bg-neutral-100 p-4 text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-rose-400"
        />
      </label>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-sm font-semibold text-neutral-700">분위기 힌트</legend>
        <p className="-mt-1 mb-1 text-xs text-neutral-400">AI가 템플릿과 자막 말투를 고를 때 참고해요</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {styles.map((s) => {
            const on = tags.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(s.id)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition
                  ${on ? 'border-transparent bg-linear-to-r from-rose-500 to-fuchsia-600 text-white shadow' : 'border-neutral-200 bg-white text-neutral-700 hover:border-rose-300'}`}
              >
                {s.emoji} {s.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-neutral-700">
          사진·동영상 <span className="font-normal text-neutral-400">{media.length}/{MAX_FILES}</span>
        </span>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {media.length < MAX_FILES && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 text-neutral-500 hover:border-rose-400 hover:text-rose-500"
            >
              <span className="text-2xl leading-none">＋</span>
              <span className="mt-1 text-[11px]">추가</span>
            </button>
          )}
          {media.map((m, i) => (
            <div key={m.url || i} className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-200">
              {m.file.type.startsWith('video/') ? (
                <video src={m.url} muted playsInline className="size-full object-cover" />
              ) : (
                <img src={m.url} alt={m.file.name} className="size-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`${m.file.name} 삭제`}
                className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {rejected.length > 0 && (
          <p className="text-xs text-rose-600" role="alert">
            {rejected.join(', ')} — 지원하지 않는 형식이에요. jpg·png·gif·webp·mp4·mov·webm만 올릴 수 있어요
            (아이폰 HEIC 사진은 설정 → 카메라 → 포맷 → &apos;높은 호환성&apos;으로 바꾸면 jpg로 저장돼요).
          </p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          data-testid="file-input"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = '' // 같은 파일을 다시 고를 수 있게
          }}
        />
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {hint && <p className="text-center text-xs text-neutral-400">{hint}</p>}
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-2xl bg-linear-to-r from-rose-500 to-fuchsia-600 py-4 text-base font-bold text-white shadow-lg transition disabled:from-neutral-300 disabled:to-neutral-300 disabled:shadow-none"
        >
          {submitting ? '만드는 중…' : '✨ 릴스 만들기'}
        </button>
      </div>
    </form>
  )
}
