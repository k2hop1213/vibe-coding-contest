import { expect, test } from 'vitest'
import { addMonths, buildMonthGrid, monthKey, toISODate } from './calendar'

test('2026년 11월은 일요일 시작 → 월요일 기준 앞칸 6개, 총 42칸', () => {
  const grid = buildMonthGrid(2026, 10)
  expect(grid).toHaveLength(42)
  expect(grid[0]).toMatchObject({ date: '2026-10-26', inMonth: false })
  expect(grid[6]).toMatchObject({ date: '2026-11-01', day: 1, inMonth: true, weekday: 6 })
  expect(grid.filter((c) => c.inMonth)).toHaveLength(30)
})

test('2021년 2월(월요일 시작, 28일)은 딱 4주', () => {
  expect(buildMonthGrid(2021, 1)).toHaveLength(28)
})

test('월 이동은 연도를 넘어간다', () => {
  expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month0: 0 })
  expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month0: 11 })
})

test('날짜 포맷', () => {
  expect(monthKey(2026, 10)).toBe('2026-11')
  expect(toISODate(new Date(2026, 10, 6))).toBe('2026-11-06')
})
