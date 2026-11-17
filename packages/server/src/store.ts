import type { Comment, KeyDate, Memory, Photo, Place, PlaceIconKey, PlaceRef, StickerKey, StickerPlacement, TimelineSummary, YearSummary } from '@days/shared'
import type { CategoryKey, DatePrecision } from '@days/shared'
import type { Db } from './db/index'

export interface MemoryRow {
  id: number
  title: string
  note: string
  start_date: string
  end_date: string | null
  date_precision: DatePrecision
  category: CategoryKey
  created_by: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  place_id: number | null
  updated_by: number | null
}

export interface CommentRow {
  id: number
  memory_id: number
  author_id: number
  text: string
  created_at: string
  deleted_at: string | null
}

export interface StickerRow {
  id: number
  memory_id: number
  sticker_key: StickerKey
  placed_by: number
  x: number | null
  y: number | null
  created_at: string
}

export interface KeyDateRow {
  id: number
  label: string
  date: string
  created_by: number
}

export const toComment = (r: CommentRow): Comment => ({
  id: r.id, memoryId: r.memory_id, authorId: r.author_id, text: r.text, createdAt: r.created_at,
})

export const toSticker = (r: StickerRow): StickerPlacement => ({
  id: r.id, memoryId: r.memory_id, key: r.sticker_key, placedBy: r.placed_by, x: r.x, y: r.y, createdAt: r.created_at,
})

export const toKeyDate = (r: KeyDateRow): KeyDate => ({ id: r.id, label: r.label, date: r.date, createdBy: r.created_by })

export interface PlaceRow {
  id: number
  space_id: number
  name: string
  latitude: number
  longitude: number
  city: string
  icon: PlaceIconKey
  created_by: number
  created_at: string
  updated_at: string
}

export interface PhotoRow {
  id: number
  memory_id: number
  uploaded_by: number
  original_path: string
  medium_path: string
  thumb_path: string
  original_name: string
  mime: string
  size: number
  width: number
  height: number
  taken_at: string | null
  latitude: number | null
  longitude: number | null
  sort_order: number
  created_at: string
  deleted_at: string | null
}

export function toPhoto(r: PhotoRow): Photo {
  return {
    id: r.id,
    memoryId: r.memory_id,
    uploadedBy: r.uploaded_by,
    takenAt: r.taken_at,
    latitude: r.latitude,
    longitude: r.longitude,
    sortOrder: r.sort_order,
    width: r.width,
    height: r.height,
    originalName: r.original_name,
    createdAt: r.created_at,
  }
}

export function toPlaceRef(r: PlaceRow): PlaceRef {
  return { id: r.id, name: r.name, latitude: r.latitude, longitude: r.longitude, icon: r.icon }
}

export interface MemoryExtras {
  stickers: StickerRow[]
  commentCount: number
  unseen: boolean
}

const NO_EXTRAS: MemoryExtras = { stickers: [], commentCount: 0, unseen: false }

export function toMemory(r: MemoryRow, photos: PhotoRow[], place: PlaceRow | null = null, extras: MemoryExtras = NO_EXTRAS): Memory {
  return {
    id: r.id,
    title: r.title,
    note: r.note,
    startDate: r.start_date,
    endDate: r.end_date,
    datePrecision: r.date_precision,
    category: r.category,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    placeId: r.place_id,
    place: place ? toPlaceRef(place) : null,
    photos: photos.map(toPhoto),
    stickers: extras.stickers.map(toSticker),
    commentCount: extras.commentCount,
    unseen: extras.unseen,
  }
}

/** Live photos of the given memories, grouped by memory and in display order. */
export function photosByMemory(db: Db, memoryIds: number[]): Map<number, PhotoRow[]> {
  const map = new Map<number, PhotoRow[]>()
  if (!memoryIds.length) return map
  const rows = db
    .prepare(
      `SELECT * FROM photo WHERE deleted_at IS NULL AND memory_id IN (${memoryIds.map(() => '?').join(',')})
       ORDER BY memory_id, sort_order, id`,
    )
    .all(...memoryIds) as PhotoRow[]
  for (const r of rows) {
    const list = map.get(r.memory_id)
    if (list) list.push(r)
    else map.set(r.memory_id, [r])
  }
  return map
}

export function placesById(db: Db, ids: (number | null)[]): Map<number, PlaceRow> {
  const unique = [...new Set(ids.filter((id): id is number => id !== null))]
  const map = new Map<number, PlaceRow>()
  if (!unique.length) return map
  const rows = db.prepare(`SELECT * FROM place WHERE id IN (${unique.map(() => '?').join(',')})`).all(...unique) as PlaceRow[]
  for (const r of rows) map.set(r.id, r)
  return map
}

const marks = (n: number) => new Array(n).fill('?').join(',')

/** Memories with their photos, Place, stickers, comment count, and, for `viewerId`, the quiet marker. */
export function withPhotos(db: Db, rows: MemoryRow[], viewerId: number | null = null): Memory[] {
  const ids = rows.map((r) => r.id)
  const photos = photosByMemory(db, ids)
  const places = placesById(db, rows.map((r) => r.place_id))
  const stickers = new Map<number, StickerRow[]>()
  const comments = new Map<number, number>()
  if (ids.length) {
    for (const s of db.prepare(`SELECT * FROM sticker WHERE memory_id IN (${marks(ids.length)}) ORDER BY id`).all(...ids) as StickerRow[]) {
      const list = stickers.get(s.memory_id)
      if (list) list.push(s)
      else stickers.set(s.memory_id, [s])
    }
    const counts = db
      .prepare(`SELECT memory_id, count(*) AS n FROM comment WHERE deleted_at IS NULL AND memory_id IN (${marks(ids.length)}) GROUP BY memory_id`)
      .all(...ids) as { memory_id: number; n: number }[]
    for (const c of counts) comments.set(c.memory_id, c.n)
  }
  const unseen = viewerId === null ? new Set<number>() : unseenMemoryIds(db, viewerId, ids)
  return rows.map((r) =>
    toMemory(r, photos.get(r.id) ?? [], r.place_id === null ? null : places.get(r.place_id) ?? null, {
      stickers: stickers.get(r.id) ?? [],
      commentCount: comments.get(r.id) ?? 0,
      unseen: unseen.has(r.id),
    }),
  )
}

/**
 * The condition for the quiet marker: the other member created or changed
 * the memory, or added a photo, comment, or sticker to it, after the viewer
 * last opened it (or, if never opened, after the viewer joined).
 */
const UNSEEN_CONDITION = `(
  (m.created_by != @me AND m.created_at > coalesce(s.seen_at, @since))
  OR (m.updated_by IS NOT NULL AND m.updated_by != @me AND m.updated_at > coalesce(s.seen_at, @since))
  OR EXISTS (SELECT 1 FROM photo p WHERE p.memory_id = m.id AND p.deleted_at IS NULL AND p.uploaded_by != @me AND p.created_at > coalesce(s.seen_at, @since))
  OR EXISTS (SELECT 1 FROM comment c WHERE c.memory_id = m.id AND c.deleted_at IS NULL AND c.author_id != @me AND c.created_at > coalesce(s.seen_at, @since))
  OR EXISTS (SELECT 1 FROM sticker k WHERE k.memory_id = m.id AND k.placed_by != @me AND k.created_at > coalesce(s.seen_at, @since))
)`

const UNSEEN_FROM = `FROM memory m LEFT JOIN memory_seen s ON s.memory_id = m.id AND s.member_id = @me`

function viewerSince(db: Db, viewerId: number): string {
  const row = db.prepare('SELECT seen_since, created_at FROM member WHERE id = ?').get(viewerId) as { seen_since: string | null; created_at: string } | undefined
  return row?.seen_since ?? row?.created_at ?? ''
}

export function unseenMemoryIds(db: Db, viewerId: number, ids: number[]): Set<number> {
  if (!ids.length) return new Set()
  const params: Record<string, unknown> = { me: viewerId, since: viewerSince(db, viewerId) }
  ids.forEach((id, i) => (params[`id${i}`] = id))
  const rows = db
    .prepare(`SELECT m.id ${UNSEEN_FROM} WHERE m.id IN (${ids.map((_, i) => `@id${i}`).join(',')}) AND ${UNSEEN_CONDITION}`)
    .all(params) as { id: number }[]
  return new Set(rows.map((r) => r.id))
}

/** When the viewer last opened a memory; before the first time, the time the viewer joined. */
export function seenAt(db: Db, viewerId: number, memoryId: number): string {
  const row = db.prepare('SELECT seen_at FROM memory_seen WHERE member_id = ? AND memory_id = ?').get(viewerId, memoryId) as { seen_at: string } | undefined
  return row?.seen_at ?? viewerSince(db, viewerId)
}

export function markSeen(db: Db, viewerId: number, memoryId: number, at: string): void {
  db.prepare(
    `INSERT INTO memory_seen (member_id, memory_id, seen_at) VALUES (?, ?, ?)
     ON CONFLICT (member_id, memory_id) DO UPDATE SET seen_at = excluded.seen_at`,
  ).run(viewerId, memoryId, at)
}

export function liveComments(db: Db, memoryId: number): Comment[] {
  return (db.prepare('SELECT * FROM comment WHERE memory_id = ? AND deleted_at IS NULL ORDER BY created_at, id').all(memoryId) as CommentRow[]).map(toComment)
}

const PLACE_SELECT = `SELECT p.*, count(m.id) AS memory_count, min(m.start_date) AS first_date, max(m.start_date) AS last_date
  FROM place p LEFT JOIN memory m ON m.place_id = p.id AND m.deleted_at IS NULL`

type PlaceStatsRow = PlaceRow & { memory_count: number; first_date: string | null; last_date: string | null }

function toPlace(r: PlaceStatsRow): Place {
  return { ...toPlaceRef(r), city: r.city, memoryCount: r.memory_count, firstDate: r.first_date, lastDate: r.last_date }
}

/** All Places with the number and date range of their memories, by name. */
export function listPlaces(db: Db): Place[] {
  const rows = db.prepare(`${PLACE_SELECT} GROUP BY p.id ORDER BY p.name COLLATE NOCASE, p.id`).all() as PlaceStatsRow[]
  return rows.map(toPlace)
}

export function getPlace(db: Db, id: number): Place | null {
  const row = db.prepare(`${PLACE_SELECT} WHERE p.id = ? GROUP BY p.id`).get(id) as PlaceStatsRow | undefined
  return row ? toPlace(row) : null
}

export function getMemoryRow(db: Db, id: number): MemoryRow | undefined {
  return db.prepare('SELECT * FROM memory WHERE id = ?').get(id) as MemoryRow | undefined
}

export function timelineSummary(db: Db, viewerId: number | null = null): TimelineSummary {
  const rows = db
    .prepare(
      `SELECT substr(start_date, 1, 4) AS y, substr(start_date, 6, 2) AS m, count(*) AS n
       FROM memory WHERE deleted_at IS NULL GROUP BY y, m ORDER BY y, m`,
    )
    .all() as { y: string; m: string; n: number }[]
  const years = new Map<number, YearSummary>()
  for (const r of rows) {
    const year = Number(r.y)
    let entry = years.get(year)
    if (!entry) {
      entry = { year, total: 0, months: new Array(12).fill(0) }
      years.set(year, entry)
    }
    entry.months[Number(r.m) - 1] = r.n
    entry.total += r.n
  }
  let unseenMonths: string[] = []
  if (viewerId !== null) {
    const rows = db
      .prepare(`SELECT DISTINCT substr(m.start_date, 1, 7) AS month ${UNSEEN_FROM} WHERE m.deleted_at IS NULL AND ${UNSEEN_CONDITION} ORDER BY month`)
      .all({ me: viewerId, since: viewerSince(db, viewerId) }) as { month: string }[]
    unseenMonths = rows.map((r) => r.month)
  }
  return { years: [...years.values()], unseenMonths }
}
