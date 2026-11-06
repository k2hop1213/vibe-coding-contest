import { useEffect, useState } from 'react'
import CalendarPanel from './components/CalendarPanel'
import EntryForm from './components/EntryForm'
import { getEntries, getHealth, type EntryDraft, type EntrySummary } from './lib/api'
import { addMonths, monthKey, toISODate } from './lib/calendar'
import { mockEntries } from './lib/mockEntries'

type ServerState = 'checking' | 'ok' | 'down'
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function App() {
  const [now] = useState(() => new Date())
  const today = toISODate(now)
  const [server, setServer] = useState<ServerState>('checking')
  const [view, setView] = useState({ year: now.getFullYear(), month0: now.getMonth() })
  const [selected, setSelected] = useState(today)
  const [entries, setEntries] = useState<Record<string, EntrySummary>>({})
  const [usingMock, setUsingMock] = useState(false)
  const [draft, setDraft] = useState<EntryDraft | null>(null)

  useEffect(() => {
    getHealth()
      .then((h) => setServer(h.ok ? 'ok' : 'down'))
      .catch(() => setServer('down'))
  }, [])

  useEffect(() => {
    const month = monthKey(view.year, view.month0)
    let cancelled = false
    getEntries(month)
      .then((list) => ({ list, mock: false }))
      // 서버 #6 전까지 개발 중에는 가짜 데이터로 화면 확인
      .catch(() => ({ list: import.meta.env.DEV ? mockEntries(month) : [], mock: import.meta.env.DEV }))
      .then(({ list, mock }) => {
        if (cancelled) return
        setEntries(Object.fromEntries(list.map((e) => [e.date, e])))
        setUsingMock(mock)
      })
    return () => {
      cancelled = true
    }
  }, [view.year, view.month0])

  const move = (delta: number) => setView((v) => addMonths(v.year, v.month0, delta))
  const entry = entries[selected]
  const [, m, d] = selected.split('-').map(Number)
  const weekday = WEEKDAY_KO[new Date(selected + 'T00:00').getDay()]

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl items-center md:p-8">
      <div className="flex w-full flex-col overflow-hidden bg-white md:min-h-[600px] md:flex-row md:rounded-3xl md:shadow-xl">
        {/* 왼쪽: 선택한 날짜 — 기록 있으면 릴스(#11), 없으면 작성 폼(#10) */}
        <main className="order-last flex min-w-0 flex-1 flex-col px-5 py-6 md:order-first md:px-10 md:py-8">
          <header className="flex items-center justify-between">
            <h1 className="text-xl font-bold">하루릴스</h1>
            <span className="text-xs text-neutral-500" data-testid="server-status">
              {server === 'checking' && '서버 확인 중…'}
              {server === 'ok' && '서버 연결됨'}
              {server === 'down' && '서버 연결 안 됨'}
              {usingMock && ' · 샘플 데이터'}
            </span>
          </header>

          <h2 className="mt-6 text-2xl font-bold" data-testid="selected-date">
            {m}월 {d}일 <span className="text-neutral-400">{weekday}요일</span>
          </h2>

          {!entry && (
            <div className="mt-5 flex flex-1 flex-col">
              {/* key: 날짜를 바꾸면 입력 내용 초기화 */}
              <EntryForm key={selected} date={selected} onSubmit={setDraft} />
              {draft?.date === selected && (
                // TODO(#12): createEntry로 전송 → 생성 중 화면 → 완료 시 플레이어
                <p className="mt-3 text-center text-xs text-neutral-400" data-testid="draft-ready">
                  입력 완료: 파일 {draft.files.length}개 · 태그 {draft.tags.length}개 (서버 전송은 #12)
                </p>
              )}
            </div>
          )}
          {entry && (
          <div className="mt-4 flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 p-6 text-center text-neutral-500">
            {entry.status === 'processing' && <p>릴스를 만드는 중이에요…</p>}
            {entry.status === 'failed' && <p>릴스를 만들지 못했어요.</p>}
            {entry.status === 'done' && (
              <p>
                이 날의 릴스
                <br />
                <span className="text-xs text-neutral-400">(플레이어 #11)</span>
              </p>
            )}
          </div>
          )}
        </main>

        <div className="md:w-[420px] md:shrink-0">
          <CalendarPanel
            year={view.year}
            month0={view.month0}
            today={today}
            selected={selected}
            entries={entries}
            onSelect={setSelected}
            onPrev={() => move(-1)}
            onNext={() => move(1)}
          />
        </div>
      </div>
    </div>
  )
}

export default App
