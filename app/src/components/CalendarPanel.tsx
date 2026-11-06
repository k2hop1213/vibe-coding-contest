// 출처: 디자인 참고 — "One Page Calendar" by Laude Pirera Ardi (https://freebiesbug.com/figma-freebies/one-page-calendar/)
//       그라데이션 패널 · 큰 연도 · 오늘 날짜 주황 원 구성만 참고, 에셋·코드 미사용
import { buildMonthGrid } from '../lib/calendar'
import { mediaUrl, type EntrySummary } from '../lib/api'

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

type Props = {
  year: number
  month0: number
  today: string
  selected: string
  entries: Record<string, EntrySummary>
  onSelect: (date: string) => void
  onPrev: () => void
  onNext: () => void
}

export default function CalendarPanel({
  year,
  month0,
  today,
  selected,
  entries,
  onSelect,
  onPrev,
  onNext,
}: Props) {
  const cells = buildMonthGrid(year, month0)

  return (
    <section className="relative overflow-hidden bg-linear-to-b from-rose-500 to-fuchsia-700 px-5 pt-8 pb-6 text-white md:px-7">
      {/* 배경에 크게 깔리는 연도 (템플릿의 흐린 워터마크 느낌) */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-4 -bottom-6 text-[7rem] leading-none font-black text-white/10 select-none"
      >
        {year}
      </span>

      <h2 className="text-center text-6xl font-extrabold tracking-tight">{year}</h2>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          aria-label="이전 달"
          className="rounded-full px-3 py-1 text-xl hover:bg-white/15"
        >
          ‹
        </button>
        <p className="text-lg font-semibold" aria-live="polite">
          {month0 + 1}월
        </p>
        <button
          type="button"
          onClick={onNext}
          aria-label="다음 달"
          className="rounded-full px-3 py-1 text-xl hover:bg-white/15"
        >
          ›
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className={`pb-1 text-[10px] font-semibold tracking-wider ${w === 'SUN' ? 'text-orange-200' : 'text-white/70'}`}
          >
            {w}
          </span>
        ))}

        {cells.map((c) => {
          const entry = c.inMonth ? entries[c.date] : undefined
          const thumb = entry?.status === 'done' ? mediaUrl(entry.thumbnailUrl) : null
          const isToday = c.date === today
          const isSelected = c.date === selected

          if (!c.inMonth) return <span key={c.date} aria-hidden />

          return (
            <button
              key={c.date}
              type="button"
              onClick={() => onSelect(c.date)}
              aria-label={`${month0 + 1}월 ${c.day}일${entry ? ` (${statusLabel[entry.status]})` : ''}`}
              aria-pressed={isSelected}
              className={`relative mx-auto flex aspect-[3/4] w-full max-w-12 items-center justify-center rounded-xl text-sm font-medium transition
                ${isSelected ? 'ring-2 ring-white' : 'hover:bg-white/15'}
                ${c.weekday === 6 && !thumb ? 'text-orange-200' : ''}`}
              style={thumb ? { backgroundImage: `url("${thumb}")`, backgroundSize: 'cover' } : undefined}
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full
                  ${isToday ? 'bg-orange-400 text-white shadow' : ''}
                  ${thumb && !isToday ? 'bg-black/25' : ''}`}
              >
                {c.day}
              </span>
              {entry?.status === 'processing' && (
                <span className="absolute bottom-1 size-1.5 animate-pulse rounded-full bg-white" />
              )}
              {entry?.status === 'failed' && (
                <span className="absolute bottom-1 size-1.5 rounded-full bg-orange-300" />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

const statusLabel: Record<EntrySummary['status'], string> = {
  done: '릴스 있음',
  processing: '만드는 중',
  failed: '생성 실패',
}
