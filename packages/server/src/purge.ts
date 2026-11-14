import { removeImageFiles } from './images'
import type { Db } from './db/index'
import type { PhotoRow } from './store'

export const RECOVERY_DAYS = 30

/** Permanently removes memories and photos deleted more than 30 days ago. */
export async function purgeDeleted(db: Db, filesDir: string, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RECOVERY_DAYS * 86400_000).toISOString()
  const photos = db
    .prepare(
      `SELECT p.* FROM photo p JOIN memory m ON m.id = p.memory_id
       WHERE (p.deleted_at IS NOT NULL AND p.deleted_at < ?) OR (m.deleted_at IS NOT NULL AND m.deleted_at < ?)`,
    )
    .all(cutoff, cutoff) as PhotoRow[]
  const removed = db.transaction(() => {
    const del = db.prepare('DELETE FROM photo WHERE id = ?')
    for (const p of photos) del.run(p.id)
    return db.prepare('DELETE FROM memory WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff).changes
  })()
  await removeImageFiles(filesDir, photos.flatMap((p) => [p.original_path, p.medium_path, p.thumb_path]))
  return removed + photos.length
}

export function schedulePurge(db: Db, filesDir: string): NodeJS.Timeout {
  const run = () => purgeDeleted(db, filesDir).catch((err) => console.error('purge failed', err))
  run()
  const timer = setInterval(run, 86400_000)
  timer.unref()
  return timer
}

