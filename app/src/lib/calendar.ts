// 달력 계산 (월요일 시작). 날짜는 시간대 밀림을 피하려고 "YYYY-MM-DD" 문자열로 다룬다.

export type DayCell = {
  date: string // "2026-11-06"
  day: number
  inMonth: boolean
  weekday: number // 0=월 … 6=일
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** month0: 0=1월 */
export function monthKey(year: number, month0: number): string {
  return `${year}-${pad(month0 + 1)}`
}

export function addMonths(year: number, month0: number, delta: number) {
  const d = new Date(year, month0 + delta, 1)
  return { year: d.getFullYear(), month0: d.getMonth() }
}

/** 앞뒤 달 날짜까지 채운 주 단위 칸 (35 또는 42개) */
export function buildMonthGrid(year: number, month0: number): DayCell[] {
  const first = new Date(year, month0, 1)
  const lead = (first.getDay() + 6) % 7 // 월요일 시작 기준 앞쪽 빈칸 수
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const total = Math.ceil((lead + daysInMonth) / 7) * 7

  return Array.from({ length: total }, (_, i) => {
    const d = new Date(year, month0, 1 - lead + i)
    return {
      date: toISODate(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month0,
      weekday: i % 7,
    }
  })
}
