import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

export type Db = Database.Database

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')

/** Opens the database and applies migrations that have not yet been applied. */
export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS migration (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
  const applied = new Set(
    (db.prepare('SELECT name FROM migration').all() as { name: string }[]).map((r) => r.name),
  )
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  for (const name of files) {
    if (applied.has(name)) continue
    const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8')
    db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO migration (name, applied_at) VALUES (?, ?)').run(name, nowIso())
    })()
  }
}

export function nowIso(): string {
  return new Date().toISOString()
}
