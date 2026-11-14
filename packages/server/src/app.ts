import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { compress } from 'hono/compress'
import { z } from 'zod'
import {
  CATEGORY_KEYS,
  LANGS,
  isValidDate,
  isValidMonth,
  nextMonthStart,
  normalizeStartDate,
  type Member,
  type StatusResponse,
} from '@days/shared'
import {
  AttemptLimiter,
  currentMember,
  endSession,
  hashPassword,
  hashToken,
  newToken,
  requireMember,
  sameOrigin,
  startSession,
  toMember,
  verifyPassword,
  type AppEnv,
  type MemberRow,
} from './auth'
import type { Config } from './config'
import { nowIso, type Db } from './db/index'
import { createExportArchive } from './export'
import { ImageError, storeImage } from './images'
import { getMemoryRow, timelineSummary, toMemory, toPhoto, withPhotos, type MemoryRow, type PhotoRow } from './store'
import { serveClient } from './static'

const SPRITES = ['partner-a', 'partner-b']

const credentials = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9_.-]{3,32}$/),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(24),
})

const dateString = z.string().refine(isValidDate)

const memoryFields = {
  title: z.string().trim().min(1).max(80),
  note: z.string().max(5000),
  startDate: dateString,
  endDate: dateString.nullable(),
  datePrecision: z.enum(['day', 'month']),
  category: z.enum(CATEGORY_KEYS),
}
const memoryCreate = z.object({
  ...memoryFields,
  note: memoryFields.note.default(''),
  endDate: memoryFields.endDate.default(null),
  datePrecision: memoryFields.datePrecision.default('day'),
  category: memoryFields.category.default('daily'),
})
const memoryPatch = z.object(memoryFields).partial()

function idParam(v: string): number | null {
  return /^\d{1,15}$/.test(v) ? Number(v) : null
}

export function createApp(db: Db, config: Config) {
  const filesDir = path.join(config.dataDir, 'files')
  const app = new Hono<AppEnv>()
  const signInLimiter = new AttemptLimiter()
  const auth = requireMember(db, config)

  app.use('*', async (c, next) => {
    await next()
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('Referrer-Policy', 'no-referrer')
  })
  // Text responses (pages, scripts, JSON) are compressed; images and archives are not.
  app.use('*', compress())
  app.use('/api/*', sameOrigin)
  app.onError((err, c) => {
    console.error(err)
    return c.json({ error: 'internal' }, 500)
  })

  const readJson = async <T extends z.ZodType>(c: { req: { json: () => Promise<unknown> } }, schema: T) => {
    const body = await c.req.json().catch(() => null)
    const parsed = schema.safeParse(body)
    return parsed.success ? (parsed.data as z.infer<T>) : null
  }

  const memberCount = () => (db.prepare('SELECT count(*) AS n FROM member').get() as { n: number }).n
  const allMembers = (): Member[] =>
    (db.prepare('SELECT * FROM member ORDER BY slot').all() as MemberRow[]).map(toMember)

  // ---- status, setup, invitation, session (no session required) ----

  app.get('/api/status', (c) => {
    const me = currentMember(c, db, config)
    const count = memberCount()
    const body: StatusResponse = {
      initialized: count > 0,
      memberCount: count,
      me: me ? toMember(me) : null,
      // Names are shown only to a signed-in member.
      members: me ? allMembers() : [],
    }
    return c.json(body)
  })

  app.post('/api/setup', async (c) => {
    const input = await readJson(c, credentials.extend({ setupToken: z.string().optional() }))
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    if (config.setupToken && input.setupToken !== config.setupToken) return c.json({ error: 'bad_setup_token' }, 403)
    const passwordHash = hashPassword(input.password)
    const memberId = db.transaction(() => {
      if (db.prepare('SELECT 1 FROM space').get()) return null
      const now = nowIso()
      db.prepare('INSERT INTO space (id, created_at) VALUES (1, ?)').run(now)
      return db
        .prepare(
          `INSERT INTO member (space_id, slot, username, password_hash, display_name, sprite_id, created_at)
           VALUES (1, 1, ?, ?, ?, ?, ?)`,
        )
        .run(input.username, passwordHash, input.displayName, SPRITES[0], now).lastInsertRowid as number
    })()
    if (memberId === null) return c.json({ error: 'already_initialized' }, 409)
    startSession(c, db, config, memberId)
    return c.json({ ok: true }, 201)
  })

  const openInvitation = (token: string) =>
    db.prepare('SELECT * FROM invitation WHERE token_hash = ? AND used_at IS NULL').get(hashToken(token)) as
      | { token_hash: string; space_id: number }
      | undefined

  app.get('/api/invitations/:token', (c) => {
    const valid = !!openInvitation(c.req.param('token')) && memberCount() < 2
    return c.json({ valid })
  })

  app.post('/api/invitations/:token/accept', async (c) => {
    const input = await readJson(c, credentials)
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const passwordHash = hashPassword(input.password)
    const result = db.transaction((): { error: string } | { memberId: number } => {
      const inv = openInvitation(c.req.param('token'))
      if (!inv || memberCount() >= 2) return { error: 'invalid_invitation' }
      if (db.prepare('SELECT 1 FROM member WHERE username = ?').get(input.username)) return { error: 'username_taken' }
      const now = nowIso()
      const memberId = db
        .prepare(
          `INSERT INTO member (space_id, slot, username, password_hash, display_name, sprite_id, created_at)
           VALUES (?, 2, ?, ?, ?, ?, ?)`,
        )
        .run(inv.space_id, input.username, passwordHash, input.displayName, SPRITES[1], now).lastInsertRowid as number
      db.prepare('UPDATE invitation SET used_at = ?, used_by = ? WHERE token_hash = ?').run(now, memberId, inv.token_hash)
      return { memberId }
    })()
    if ('error' in result) return c.json({ error: result.error }, result.error === 'username_taken' ? 409 : 404)
    startSession(c, db, config, result.memberId)
    return c.json({ ok: true }, 201)
  })

  app.post('/api/session', async (c) => {
    const input = await readJson(c, z.object({ username: z.string().max(64), password: z.string().max(200) }))
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const key = input.username.trim().toLowerCase()
    if (signInLimiter.blocked(key)) return c.json({ error: 'too_many_attempts' }, 429)
    const row = db.prepare('SELECT * FROM member WHERE username = ?').get(input.username.trim()) as MemberRow | undefined
    if (!row || !verifyPassword(input.password, row.password_hash)) {
      signInLimiter.fail(key)
      return c.json({ error: 'bad_credentials' }, 401)
    }
    signInLimiter.clear(key)
    startSession(c, db, config, row.id)
    return c.json({ ok: true })
  })

  app.delete('/api/session', (c) => {
    endSession(c, db)
    return c.json({ ok: true })
  })

  // Map tiles are public map data, kept as single PMTiles files in the data
  // directory. The PMTiles reader requests byte ranges.
  app.get('/tiles/:name', async (c) => {
    const name = c.req.param('name')
    if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.pmtiles$/.test(name)) return c.json({ error: 'not_found' }, 404)
    const abs = path.join(config.dataDir, 'tiles', name)
    const stat = await fs.stat(abs).catch(() => null)
    if (!stat?.isFile()) return c.json({ error: 'not_found' }, 404)
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    }
    const range = /^bytes=(\d+)-(\d*)$/.exec(c.req.header('range') ?? '')
    if (!range) {
      headers['Content-Length'] = String(stat.size)
      return new Response(Readable.toWeb(createReadStream(abs)) as ReadableStream, { headers })
    }
    const start = Number(range[1])
    const end = Math.min(range[2] ? Number(range[2]) : stat.size - 1, stat.size - 1)
    if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } })
    headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`
    headers['Content-Length'] = String(end - start + 1)
    return new Response(Readable.toWeb(createReadStream(abs, { start, end })) as ReadableStream, { status: 206, headers })
  })

  // ---- everything below requires one of the two members ----

  app.use('/api/*', auth)
  app.use('/files/*', auth)

  app.patch('/api/me', async (c) => {
    const input = await readJson(
      c,
      z.object({ displayName: z.string().trim().min(1).max(24), lang: z.enum(LANGS as [string, ...string[]]) }).partial(),
    )
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const me = c.get('member')
    db.prepare('UPDATE member SET display_name = ?, lang = ? WHERE id = ?').run(
      input.displayName ?? me.display_name,
      input.lang ?? me.lang,
      me.id,
    )
    return c.json(toMember(db.prepare('SELECT * FROM member WHERE id = ?').get(me.id) as MemberRow))
  })

  app.post('/api/invitations', (c) => {
    if (memberCount() >= 2) return c.json({ error: 'space_full' }, 409)
    const me = c.get('member')
    const token = newToken()
    db.transaction(() => {
      // Only the most recent link is valid.
      db.prepare('DELETE FROM invitation WHERE used_at IS NULL').run()
      db.prepare('INSERT INTO invitation (token_hash, space_id, created_by, created_at) VALUES (?, ?, ?, ?)').run(
        hashToken(token),
        me.space_id,
        me.id,
        nowIso(),
      )
    })()
    return c.json({ token }, 201)
  })

  // ---- timeline and memories ----

  app.get('/api/timeline/summary', (c) => c.json(timelineSummary(db)))

  app.get('/api/memories', (c) => {
    const month = c.req.query('month')
    if (!isValidMonth(month)) return c.json({ error: 'invalid_month' }, 400)
    const rows = db
      .prepare(
        `SELECT * FROM memory WHERE deleted_at IS NULL AND start_date >= ? AND start_date < ?
         ORDER BY start_date, id`,
      )
      .all(`${month}-01`, nextMonthStart(month)) as MemoryRow[]
    return c.json({ memories: withPhotos(db, rows) })
  })

  app.post('/api/memories', async (c) => {
    const input = await readJson(c, memoryCreate)
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const start = normalizeStartDate(input.startDate, input.datePrecision)
    if (input.endDate && input.endDate < start) return c.json({ error: 'invalid_input' }, 400)
    const me = c.get('member')
    const now = nowIso()
    const id = db
      .prepare(
        `INSERT INTO memory (space_id, title, note, start_date, end_date, date_precision, category, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(me.space_id, input.title, input.note, start, input.endDate, input.datePrecision, input.category, me.id, now, now)
      .lastInsertRowid as number
    return c.json(toMemory(getMemoryRow(db, id)!, []), 201)
  })

  const liveMemory = (idText: string): MemoryRow | null => {
    const id = idParam(idText)
    const row = id === null ? undefined : getMemoryRow(db, id)
    return row && !row.deleted_at ? row : null
  }

  app.get('/api/memories/:id', (c) => {
    const row = liveMemory(c.req.param('id'))
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json(withPhotos(db, [row])[0])
  })

  // Both members may edit every memory. For text fields the most recent save is kept.
  app.patch('/api/memories/:id', async (c) => {
    const row = liveMemory(c.req.param('id'))
    if (!row) return c.json({ error: 'not_found' }, 404)
    const input = await readJson(c, memoryPatch)
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const precision = input.datePrecision ?? row.date_precision
    const start = normalizeStartDate(input.startDate ?? row.start_date, precision)
    const end = input.endDate === undefined ? row.end_date : input.endDate
    if (end && end < start) return c.json({ error: 'invalid_input' }, 400)
    db.prepare(
      `UPDATE memory SET title = ?, note = ?, start_date = ?, end_date = ?, date_precision = ?, category = ?, updated_at = ?
       WHERE id = ?`,
    ).run(input.title ?? row.title, input.note ?? row.note, start, end, precision, input.category ?? row.category, nowIso(), row.id)
    return c.json(withPhotos(db, [getMemoryRow(db, row.id)!])[0])
  })

  app.delete('/api/memories/:id', (c) => {
    const row = liveMemory(c.req.param('id'))
    if (!row) return c.json({ error: 'not_found' }, 404)
    db.prepare('UPDATE memory SET deleted_at = ? WHERE id = ?').run(nowIso(), row.id)
    return c.json({ ok: true })
  })

  app.post('/api/memories/:id/restore', (c) => {
    const id = idParam(c.req.param('id'))
    const changed = id === null ? 0 : db.prepare('UPDATE memory SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL').run(id).changes
    if (!changed) return c.json({ error: 'not_found' }, 404)
    return c.json(withPhotos(db, [getMemoryRow(db, id!)!])[0])
  })

  app.get('/api/trash', (c) => {
    const memories = db.prepare('SELECT * FROM memory WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all() as MemoryRow[]
    const photos = db
      .prepare(
        `SELECT p.*, m.title AS memory_title FROM photo p JOIN memory m ON m.id = p.memory_id
         WHERE p.deleted_at IS NOT NULL AND m.deleted_at IS NULL ORDER BY p.deleted_at DESC`,
      )
      .all() as (PhotoRow & { memory_title: string })[]
    return c.json({
      memories: withPhotos(db, memories),
      photos: photos.map((p) => ({ ...toPhoto(p), memoryTitle: p.memory_title, deletedAt: p.deleted_at })),
    })
  })

  // ---- photos ----

  app.post(
    '/api/memories/:id/photos',
    bodyLimit({ maxSize: config.maxUploadBytes, onError: (c) => c.json({ error: 'too_large' }, 413) }),
    async (c) => {
      const memory = liveMemory(c.req.param('id'))
      if (!memory) return c.json({ error: 'not_found' }, 404)
      const form = await c.req.parseBody().catch(() => null)
      const file = form?.file
      if (!(file instanceof File)) return c.json({ error: 'invalid_input' }, 400)

      let stored
      try {
        stored = await storeImage(filesDir, Buffer.from(await file.arrayBuffer()))
      } catch (err) {
        if (err instanceof ImageError) return c.json({ error: err.message }, 415)
        throw err
      }

      // Values read by the client are used when given; otherwise the server's own reading.
      const text = (k: string) => (typeof form![k] === 'string' && form![k] !== '' ? (form![k] as string) : null)
      const num = (k: string, limit: number) => {
        const v = text(k) === null ? NaN : Number(text(k))
        return Number.isFinite(v) && Math.abs(v) <= limit ? v : null
      }
      const clientTaken = text('takenAt')
      const takenAt = clientTaken && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(clientTaken) ? clientTaken : stored.takenAt
      const clientLat = num('latitude', 90)
      const clientLon = num('longitude', 180)
      const hasClientCoords = clientLat !== null && clientLon !== null
      const requestedOrder = text('sortOrder')
      const me = c.get('member')

      const id = db.transaction(() => {
        const next = (db.prepare('SELECT coalesce(max(sort_order), -1) + 1 AS n FROM photo WHERE memory_id = ?').get(memory.id) as { n: number }).n
        const order = requestedOrder !== null && /^\d{1,6}$/.test(requestedOrder) ? Number(requestedOrder) : next
        return db
          .prepare(
            `INSERT INTO photo (memory_id, uploaded_by, original_path, medium_path, thumb_path, original_name, mime, size,
               width, height, taken_at, latitude, longitude, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            memory.id, me.id, stored.originalPath, stored.mediumPath, stored.thumbPath,
            path.basename(file.name || 'photo').slice(0, 200), stored.mime, stored.size, stored.width, stored.height,
            takenAt, hasClientCoords ? clientLat : stored.latitude, hasClientCoords ? clientLon : stored.longitude,
            order, nowIso(),
          ).lastInsertRowid as number
      })()
      return c.json(toPhoto(db.prepare('SELECT * FROM photo WHERE id = ?').get(id) as PhotoRow), 201)
    },
  )

  app.put('/api/memories/:id/photos/order', async (c) => {
    const memory = liveMemory(c.req.param('id'))
    if (!memory) return c.json({ error: 'not_found' }, 404)
    const input = await readJson(c, z.object({ photoIds: z.array(z.number().int().positive()).max(2000) }))
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    db.transaction(() => {
      const stmt = db.prepare('UPDATE photo SET sort_order = ? WHERE id = ? AND memory_id = ?')
      input.photoIds.forEach((photoId, i) => stmt.run(i, photoId, memory.id))
    })()
    return c.json(withPhotos(db, [memory])[0])
  })

  app.delete('/api/photos/:id', (c) => {
    const id = idParam(c.req.param('id'))
    const changed = id === null ? 0 : db.prepare('UPDATE photo SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(nowIso(), id).changes
    return changed ? c.json({ ok: true }) : c.json({ error: 'not_found' }, 404)
  })

  app.post('/api/photos/:id/restore', (c) => {
    const id = idParam(c.req.param('id'))
    const changed = id === null ? 0 : db.prepare('UPDATE photo SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL').run(id).changes
    return changed ? c.json({ ok: true }) : c.json({ error: 'not_found' }, 404)
  })

  // Files are private: this route is behind the session check above.
  app.get('/files/:photoId/:variant', async (c) => {
    const id = idParam(c.req.param('photoId'))
    const variant = c.req.param('variant')
    const row = id === null ? undefined : (db.prepare('SELECT * FROM photo WHERE id = ?').get(id) as PhotoRow | undefined)
    if (!row || !['thumb', 'medium', 'original'].includes(variant)) return c.json({ error: 'not_found' }, 404)
    const rel = variant === 'thumb' ? row.thumb_path : variant === 'medium' ? row.medium_path : row.original_path
    const abs = path.join(filesDir, rel)
    const stat = await fs.stat(abs).catch(() => null)
    if (!stat) return c.json({ error: 'not_found' }, 404)
    return new Response(Readable.toWeb(createReadStream(abs)) as ReadableStream, {
      headers: {
        'Content-Type': variant === 'original' ? row.mime : 'image/jpeg',
        'Content-Length': String(stat.size),
        // The content behind a photo id never changes.
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Security-Policy': "default-src 'none'",
      },
    })
  })

  app.get('/api/export', (c) => {
    const zip = createExportArchive(db, filesDir)
    const stamp = nowIso().slice(0, 10).replace(/-/g, '')
    return new Response(Readable.toWeb(zip) as ReadableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="days-export-${stamp}.zip"`,
        'Cache-Control': 'no-store',
      },
    })
  })

  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404))
  app.get('*', serveClient(config.clientDist))

  return app
}
