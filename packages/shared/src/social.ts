import { daysInMonth, pad2 } from './dates'

/** Stickers placed under a memory; at most one of each kind per member. */
export const REACTION_KEYS = ['heart', 'laugh', 'wow', 'tear', 'hug', 'clap'] as const
/** Stickers placed anywhere on a memory's cover. */
export const DECOR_KEYS = [
  'flower', 'sparkle', 'ribbon', 'sun', 'cloud', 'note', 'leaf', 'cat', 'paw', 'cake', 'balloon', 'moon',
] as const
export const STICKER_KEYS = [...REACTION_KEYS, ...DECOR_KEYS] as const

export type ReactionKey = (typeof REACTION_KEYS)[number]
export type DecorKey = (typeof DECOR_KEYS)[number]
export type StickerKey = ReactionKey | DecorKey

export function isReactionKey(v: unknown): v is ReactionKey {
  return typeof v === 'string' && (REACTION_KEYS as readonly string[]).includes(v)
}

/** Upper limit of decorative stickers on one cover. */
export const MAX_DECOR_STICKERS = 20
export const COMMENT_MAX_LENGTH = 500
export const KEY_DATE_LABEL_MAX_LENGTH = 24
/** Key dates closer than this are counted down in speech bubbles. */
export const KEY_DATE_NOTICE_DAYS = 30

const dayNumber = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86400_000

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from))
}

/**
 * The next yearly occurrence of a date on or after `today`. A date on
 * 29 February falls on 28 February in other years. `years` is the number of
 * years since the original date.
 */
export function nextOccurrence(date: string, today: string): { date: string; days: number; years: number } {
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const on = (year: number) => `${year}-${pad2(month)}-${pad2(Math.min(day, daysInMonth(year, month)))}`
  // A date that has not yet happened occurs first on the date itself.
  if (date >= today) return { date, days: daysBetween(today, date), years: 0 }
  let year = Number(today.slice(0, 4))
  if (on(year) < today) year++
  const next = on(year)
  return { date: next, days: daysBetween(today, next), years: year - Number(date.slice(0, 4)) }
}

/** The first non-empty line of a text, shortened to `max` characters. */
export function excerpt(text: string, max = 60): string {
  const line = text.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  const chars = [...line]
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : line
}

export type DayPeriod = 'morning' | 'day' | 'evening' | 'night'
/** Number of everyday lines per period; the texts are in the client's language tables. */
export const EVERYDAY_LINE_COUNT: Record<DayPeriod, number> = { morning: 3, day: 3, evening: 3, night: 3 }

export function dayPeriod(hour: number): DayPeriod {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'day'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

export interface BubbleKeyDate {
  id: number
  label: string
  date: string
}

/** Material for speech bubbles, collected by the server for one day. */
export interface BubbleSources {
  keyDates: BubbleKeyDate[]
  /** Memories on the same day of an earlier year. */
  onThisDay: { memoryId: number; title: string; startDate: string; createdBy: number }[]
  /** A random sample of comments and note excerpts. */
  quotes: { memoryId: number; text: string; speakerId: number; date: string }[]
}

export type Bubble =
  | { kind: 'keyDateToday'; label: string; years: number }
  | { kind: 'keyDateSoon'; label: string; days: number }
  | { kind: 'onThisDay'; memoryId: number; title: string; years: number; speakerId: number }
  | { kind: 'quote'; memoryId: number; text: string; date: string; speakerId: number }
  | { kind: 'everyday'; period: DayPeriod; line: number }

/**
 * Orders the lines the characters say. Key dates of today come first, then
 * memories from this day in earlier years, then key dates within 30 days,
 * then quotes and everyday lines alternately. Nothing in the list refers to
 * missing entries or to time since the last entry.
 */
export function planBubbles(sources: BubbleSources, today: string, hour: number, random: () => number = Math.random): Bubble[] {
  const out: Bubble[] = []
  const occurrences = sources.keyDates
    .map((k) => ({ k, next: nextOccurrence(k.date, today) }))
    .sort((a, b) => a.next.days - b.next.days)
  for (const { k, next } of occurrences) if (next.days === 0) out.push({ kind: 'keyDateToday', label: k.label, years: next.years })
  for (const m of sources.onThisDay.slice(0, 2)) {
    out.push({ kind: 'onThisDay', memoryId: m.memoryId, title: m.title, years: Number(today.slice(0, 4)) - Number(m.startDate.slice(0, 4)), speakerId: m.createdBy })
  }
  for (const { k, next } of occurrences.filter((o) => o.next.days > 0 && o.next.days <= KEY_DATE_NOTICE_DAYS).slice(0, 2)) {
    out.push({ kind: 'keyDateSoon', label: k.label, days: next.days })
  }
  const period = dayPeriod(hour)
  const count = EVERYDAY_LINE_COUNT[period]
  const first = Math.floor(random() * count)
  const everyday: Bubble[] = [0, 1].slice(0, Math.min(2, count)).map((i) => ({ kind: 'everyday', period, line: ((first + i) % count) + 1 }))
  const quotes: Bubble[] = sources.quotes.slice(0, 3).map((q) => ({ kind: 'quote', ...q }))
  while (quotes.length || everyday.length) {
    const e = everyday.shift()
    if (e) out.push(e)
    const q = quotes.shift()
    if (q) out.push(q)
  }
  return out
}
