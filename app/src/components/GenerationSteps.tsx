type Step = 'plan' | 'video' | 'done'

const STEPS: { id: Step; label: string }[] = [
  { id: 'plan', label: 'AI 편집' },
  { id: 'video', label: '영상 합치기' },
  { id: 'done', label: '완성' },
]

/** 릴스 만드는 단계: ① AI 편집 → ② 영상 합치기 → ③ 완성 */
export default function GenerationSteps({ current, dark = false }: { current: Step; dark?: boolean }) {
  const at = STEPS.findIndex((s) => s.id === current)
  return (
    <ol className="flex items-center justify-center gap-1.5 text-[11px]" aria-label="릴스 만드는 단계">
      {STEPS.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'todo'
        return (
          <li key={s.id} className="flex items-center gap-1.5" aria-current={state === 'now' ? 'step' : undefined}>
            {i > 0 && <span className={dark ? 'text-white/40' : 'text-neutral-300'}>→</span>}
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                state === 'now'
                  ? 'bg-linear-to-r from-rose-500 to-fuchsia-600 text-white'
                  : state === 'done'
                    ? dark
                      ? 'text-white/80'
                      : 'text-rose-500'
                    : dark
                      ? 'text-white/40'
                      : 'text-neutral-400'
              }`}
            >
              {state === 'done' ? '✓ ' : `${i + 1} `}
              {s.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
