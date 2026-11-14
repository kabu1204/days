import type { DatePrecision } from './types'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_RE = /^(\d{4})-(\d{2})$/

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = DATE_RE.exec(s)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false
  return d <= daysInMonth(y, mo)
}

export function isValidMonth(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = MONTH_RE.exec(s)
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** The month (`YYYY-MM`) a memory is filed under: the month of its start date. */
export function filingMonth(startDate: string): string {
  return startDate.slice(0, 7)
}

/** Stored form of a start date: month precision is normalised to the first day. */
export function normalizeStartDate(date: string, precision: DatePrecision): string {
  return precision === 'month' ? `${date.slice(0, 7)}-01` : date
}

/** First day of the month after `YYYY-MM`. */
export function nextMonthStart(month: string): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  return m === 12 ? `${y + 1}-01-01` : `${y}-${pad2(m + 1)}-01`
}

/**
 * Converts a capture time into `YYYY-MM-DDTHH:mm:ss` using the wall-clock
 * fields of the given Date object. Photo metadata has no time zone, and
 * metadata readers return it as if it were local time, so local getters
 * reproduce the time shown on the camera.
 */
export function toLocalIso(d: Date): string {
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  )
}

export function todayLocal(): string {
  return toLocalIso(new Date()).slice(0, 10)
}
