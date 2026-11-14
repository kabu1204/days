/**
 * Copies the database and all photo files to a second location.
 *
 *   BACKUP_DIR=/mnt/backup/days pnpm --filter @days/server backup
 *
 * Intended to be run nightly by a scheduler (cron or a systemd timer).
 * The database copy is made with VACUUM INTO, which is consistent even
 * while the server is running. Files are never changed after upload, so
 * only files missing from the destination are copied.
 */
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { loadConfig } from '../src/config'

const target = process.env.BACKUP_DIR
if (!target) {
  console.error('BACKUP_DIR is not set')
  process.exit(1)
}
const config = loadConfig()
const dest = path.resolve(target)
fs.mkdirSync(dest, { recursive: true })

const dbCopy = path.join(dest, 'days.sqlite')
const tmp = `${dbCopy}.tmp`
fs.rmSync(tmp, { force: true })
const db = new Database(path.join(config.dataDir, 'days.sqlite'), { readonly: true, fileMustExist: true })
db.prepare('VACUUM INTO ?').run(tmp)
db.close()
fs.renameSync(tmp, dbCopy)

let copied = 0
const copyMissing = (from: string, to: string) => {
  if (!fs.existsSync(from)) return
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dst = path.join(to, entry.name)
    if (entry.isDirectory()) copyMissing(src, dst)
    else if (!fs.existsSync(dst)) {
      fs.copyFileSync(src, dst)
      copied++
    }
  }
}
copyMissing(path.join(config.dataDir, 'files'), path.join(dest, 'files'))
console.log(`backup complete: database copied, ${copied} new file(s) copied to ${dest}`)
