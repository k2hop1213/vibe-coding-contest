import { useEffect, useState } from 'react'
import CalendarPanel from './components/CalendarPanel'
import EntryForm from './components/EntryForm'
import EntryView from './components/EntryView'
import {
  createEntry,
  errorMessage,
  getEntries,
  getHealth,
  ApiError,
  type EntryDraft,
  type EntrySummary,
} from './lib/api'
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
  // 월별 캐시: 다른 달로 넘겨도 선택한 날짜의 기록을 잃지 않도록 (month → date → entry)
  const [byMonth, setByMonth] = useState<Record<string, Record<string, EntrySummary>>>({})
  const [usingMock, setUsingMock] = useState(false)
  const [upload, setUpload] = useState<{ date: string; progress: number } | null>(null)
  const [submitError, setSubmitError] = useState<{ date: string; message: string } | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null) // failed 날짜를 다시 만드는 중
  const [reload, setReload] = useState(0) // 달력 다시 불러오기

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
        setByMonth((b) => ({ ...b, [month]: Object.fromEntries(list.map((e) => [e.date, e])) }))
        setUsingMock(mock)
      })
    return () => {
      cancelled = true
    }
  }, [view.year, view.month0, reload])

  const move = (delta: number) => setView((v) => addMonths(v.year, v.month0, delta))
  const entry = byMonth[selected.slice(0, 7)]?.[selected]
  const showForm = !entry || retrying === selected

  const putEntry = (e: EntrySummary) =>
    setByMonth((b) => ({ ...b, [e.date.slice(0, 7)]: { ...b[e.date.slice(0, 7)], [e.date]: e } }))

  const submit = async (draft: EntryDraft) => {
    setSubmitError(null)
    setUpload({ date: draft.date, progress: 0 })
    try {
      const res = await createEntry(draft, (p) => setUpload({ date: draft.date, progress: p }))
      setRetrying(null)
      putEntry({ id: res.id, date: res.date, status: res.status, thumbnailUrl: null })
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'network'
      setSubmitError({ date: draft.date, message: errorMessage(code) })
      if (code === 'already_exists') setReload((n) => n + 1) // 다른 곳에서 먼저 만든 경우 → 달력 갱신
    } finally {
      setUpload(null)
    }
  }
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

          {showForm && (
            <div className="mt-5 flex flex-1 flex-col">
              {/* key: 날짜를 바꾸면 입력 내용 초기화 */}
              <EntryForm
                key={selected}
                date={selected}
                onSubmit={submit}
                submitting={upload?.date === selected}
              />
              {upload?.date === selected && (
                <div className="mt-3" data-testid="upload-progress">
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className="h-full bg-linear-to-r from-rose-500 to-fuchsia-600 transition-[width]"
                      style={{ width: `${Math.round(upload.progress * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-center text-xs text-neutral-500">
                    업로드 중 {Math.round(upload.progress * 100)}%
                  </p>
                </div>
              )}
              {submitError?.date === selected && (
                <p className="mt-3 text-center text-sm text-rose-600" role="alert">
                  {submitError.message}
                </p>
              )}
            </div>
          )}
          {entry && !showForm && (
            <div className="mt-5 flex flex-1 flex-col">
              <EntryView
                key={entry.id}
                id={entry.id}
                onStatus={(status) => {
                  putEntry({ ...entry, status })
                  if (status === 'done') setReload((n) => n + 1) // 썸네일 받아오기
                }}
                onRetry={() => setRetrying(selected)}
              />
            </div>
          )}
        </main>

        <div className="md:w-[420px] md:shrink-0">
          <CalendarPanel
            year={view.year}
            month0={view.month0}
            today={today}
            selected={selected}
            entries={byMonth[monthKey(view.year, view.month0)] ?? {}}
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
