/** Badges, the wish list, and the treasure chest (Phase 4). */
import { FLASHBACK_RECENT, badgesEarned, isBadgeKey, pickFlashback, type Badge, type BadgeFacts, type WishItem, type WishKind } from '@days/shared'
import { nowIso, type Db } from './db/index'

const count = (db: Db, sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n

/** Counts over live records, the input of the badge rules. */
export function badgeFacts(db: Db): BadgeFacts {
  const live = 'FROM memory WHERE deleted_at IS NULL'
  const span = db.prepare(`SELECT min(start_date) AS first, max(start_date) AS last ${live}`).get() as { first: string | null; last: string | null }
  return {
    memories: count(db, `SELECT count(*) AS n ${live}`),
    travelMemories: count(db, `SELECT count(*) AS n ${live} AND category = 'travel'`),
    foodMemories: count(db, `SELECT count(*) AS n ${live} AND category = 'food'`),
    places: count(db, 'SELECT count(*) AS n FROM place'),
    cities: count(db, "SELECT count(DISTINCT lower(trim(city))) AS n FROM place WHERE trim(city) != ''"),
    creators: count(db, `SELECT count(DISTINCT created_by) AS n ${live}`),
    photos: count(db, 'SELECT count(*) AS n FROM photo p JOIN memory m ON m.id = p.memory_id WHERE p.deleted_at IS NULL AND m.deleted_at IS NULL'),
    firstDate: span.first,
    lastDate: span.last,
    keyDates: count(db, 'SELECT count(*) AS n FROM key_date'),
    wishesGranted: count(db, 'SELECT count(*) AS n FROM wish_item WHERE done_memory_id IS NOT NULL'),
  }
}

/** Records badges whose rule now holds. Returns the keys unlocked by this call. */
export function evaluateBadges(db: Db): string[] {
  const space = db.prepare('SELECT id FROM space ORDER BY id LIMIT 1').get() as { id: number } | undefined
  if (!space) return []
  const now = nowIso()
  const insert = db.prepare('INSERT OR IGNORE INTO badge_unlock (space_id, badge_key, unlocked_at) VALUES (?, ?, ?)')
  return badgesEarned(badgeFacts(db)).filter((k) => insert.run(space.id, k, now).changes > 0)
}

interface BadgeRow {
  badge_key: string
  unlocked_at: string
}

/** Unlocked badges in album order; `seen` is relative to when the member last opened the album. */
export function listBadges(db: Db, seenAt: string | null): Badge[] {
  const rows = db.prepare('SELECT badge_key, unlocked_at FROM badge_unlock ORDER BY unlocked_at, id').all() as BadgeRow[]
  return rows
    .filter((r) => isBadgeKey(r.badge_key))
    .map((r) => ({ key: r.badge_key as Badge['key'], unlockedAt: r.unlocked_at, seen: !!seenAt && r.unlocked_at <= seenAt }))
}

export function unseenBadgeCount(db: Db, seenAt: string | null): number {
  return listBadges(db, seenAt).filter((b) => !b.seen).length
}

export interface WishRow {
  id: number
  kind: WishKind
  text: string
  created_by: number
  created_at: string
  done_memory_id: number | null
}

export const toWish = (r: WishRow): WishItem => ({
  id: r.id,
  kind: r.kind,
  text: r.text,
  createdBy: r.created_by,
  createdAt: r.created_at,
  doneMemoryId: r.done_memory_id,
})

/** Picks a memory for the treasure chest and remembers it for the member. Returns the memory id or null. */
export function nextFlashback(db: Db, memberId: number, today: string): number | null {
  const candidates = (
    db.prepare("SELECT id, start_date, date_precision FROM memory WHERE deleted_at IS NULL").all() as {
      id: number
      start_date: string
      date_precision: 'day' | 'month'
    }[]
  ).map((m) => ({ id: m.id, startDate: m.start_date, datePrecision: m.date_precision }))
  const row = db.prepare('SELECT flashback_recent FROM member WHERE id = ?').get(memberId) as { flashback_recent: string }
  let recent: number[] = []
  try {
    const parsed: unknown = JSON.parse(row.flashback_recent)
    if (Array.isArray(parsed)) recent = parsed.filter((v): v is number => typeof v === 'number')
  } catch {
    recent = []
  }
  const id = pickFlashback(candidates, recent, today)
  if (id !== null) {
    const next = [...recent.filter((r) => r !== id), id].slice(-FLASHBACK_RECENT)
    db.prepare('UPDATE member SET flashback_recent = ? WHERE id = ?').run(JSON.stringify(next), memberId)
  }
  return id
}
