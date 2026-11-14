import type { Memory, Photo, TimelineSummary, YearSummary } from '@days/shared'
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
  }
}

export function toMemory(r: MemoryRow, photos: PhotoRow[]): Memory {
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
    photos: photos.map(toPhoto),
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

export function withPhotos(db: Db, rows: MemoryRow[]): Memory[] {
  const photos = photosByMemory(db, rows.map((r) => r.id))
  return rows.map((r) => toMemory(r, photos.get(r.id) ?? []))
}

export function getMemoryRow(db: Db, id: number): MemoryRow | undefined {
  return db.prepare('SELECT * FROM memory WHERE id = ?').get(id) as MemoryRow | undefined
}

export function timelineSummary(db: Db): TimelineSummary {
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
  return { years: [...years.values()] }
}
