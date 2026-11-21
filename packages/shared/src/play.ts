import { daysBetween } from './social'

/** Badges, in album order. A badge is shown only once it is unlocked. */
export const BADGE_KEYS = [
  'first-memory',
  'ten-memories',
  'hundred-memories',
  'first-trip',
  'foodie',
  'five-places',
  'three-cities',
  'both-hands',
  'album',
  'one-year',
  'key-date',
  'wish-granted',
] as const
export type BadgeKey = (typeof BADGE_KEYS)[number]

export function isBadgeKey(v: unknown): v is BadgeKey {
  return typeof v === 'string' && (BADGE_KEYS as readonly string[]).includes(v)
}

/** Counts over the live (not deleted) records of a space, read when data is saved. */
export interface BadgeFacts {
  memories: number
  travelMemories: number
  foodMemories: number
  places: number
  /** Distinct non-empty city names of Places. */
  cities: number
  /** Distinct members who created at least one memory. */
  creators: number
  photos: number
  /** Start date of the earliest and the latest memory, or null without memories. */
  firstDate: string | null
  lastDate: string | null
  keyDates: number
  wishesGranted: number
}

const RULES: Record<BadgeKey, (f: BadgeFacts) => boolean> = {
  'first-memory': (f) => f.memories >= 1,
  'ten-memories': (f) => f.memories >= 10,
  'hundred-memories': (f) => f.memories >= 100,
  'first-trip': (f) => f.travelMemories >= 1,
  foodie: (f) => f.foodMemories >= 10,
  'five-places': (f) => f.places >= 5,
  'three-cities': (f) => f.cities >= 3,
  'both-hands': (f) => f.creators >= 2,
  album: (f) => f.photos >= 100,
  'one-year': (f) => !!f.firstDate && !!f.lastDate && daysBetween(f.firstDate, f.lastDate) >= 365,
  'key-date': (f) => f.keyDates >= 1,
  'wish-granted': (f) => f.wishesGranted >= 1,
}

/** The badges whose rule holds for these facts. Unlocks are permanent; the caller only adds. */
export function badgesEarned(facts: BadgeFacts): BadgeKey[] {
  return BADGE_KEYS.filter((k) => RULES[k](facts))
}

/** Lists the date decision tools draw from. */
export const WISH_KINDS = ['destination', 'food'] as const
export type WishKind = (typeof WISH_KINDS)[number]
export const WISH_TEXT_MAX_LENGTH = 40

/** How many recently shown memories the treasure chest avoids. */
export const FLASHBACK_RECENT = 5

/**
 * Picks a memory for the treasure chest. Memories shown recently are skipped
 * while others remain; memories from this day in an earlier year are five
 * times as likely as the rest. `random` returns a number in [0, 1).
 */
export function pickFlashback(
  candidates: { id: number; startDate: string; datePrecision: 'day' | 'month' }[],
  recent: number[],
  today: string,
  random: () => number = Math.random,
): number | null {
  if (!candidates.length) return null
  const fresh = candidates.filter((c) => !recent.includes(c.id))
  const pool = fresh.length ? fresh : candidates.filter((c) => c.id !== recent[recent.length - 1])
  const list = pool.length ? pool : candidates
  const weights = list.map((c) => (isOnThisDay(c.startDate, c.datePrecision, today) ? 5 : 1))
  let r = random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < list.length; i++) {
    r -= weights[i]
    if (r < 0) return list[i].id
  }
  return list[list.length - 1].id
}

/** True for a day-precision date with the same month and day as `today`, in an earlier year. */
export function isOnThisDay(date: string, precision: 'day' | 'month', today: string): boolean {
  return precision === 'day' && date.slice(5) === today.slice(5) && date.slice(0, 4) < today.slice(0, 4)
}
