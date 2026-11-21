import { createReadStream, readdirSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { compress } from 'hono/compress'
import { z } from 'zod'
import {
  CATEGORY_KEYS,
  COMMENT_MAX_LENGTH,
  KEY_DATE_LABEL_MAX_LENGTH,
  LANGS,
  MAX_DECOR_STICKERS,
  STICKER_KEYS,
  excerpt,
  isReactionKey,
  PLACE_ICON_KEYS,
  centroid,
  isValidDate,
  isValidMonth,
  nextMonthStart,
  normalizeStartDate,
  type BubbleSources,
  type Member,
  type MemoryDetail,
  type StatusResponse,
  BODY_KEYS,
  HEADPIECE_KEYS,
  defaultBody,
  defaultHeadpiece,
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
import {
  getMemoryRow,
  getPlace,
  listPlaces,
  liveComments,
  markSeen,
  seenAt,
  timelineSummary,
  toComment,
  toKeyDate,
  toPhoto,
  toSticker,
  withPhotos,
  type CommentRow,
  type KeyDateRow,
  type MemoryRow,
  type PhotoRow,
  type StickerRow,
} from './store'
import { serveClient } from './static'


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
  placeId: z.number().int().positive().nullable(),
}
const memoryCreate = z.object({
  ...memoryFields,
  note: memoryFields.note.default(''),
  endDate: memoryFields.endDate.default(null),
  datePrecision: memoryFields.datePrecision.default('day'),
  category: memoryFields.category.default('daily'),
  placeId: memoryFields.placeId.default(null),
})
const memoryPatch = z.object(memoryFields).partial()

const placeFields = {
  name: z.string().trim().min(1).max(40),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  city: z.string().trim().max(40),
  icon: z.enum(PLACE_ICON_KEYS),
}
const placeCreate = z.object({ ...placeFields, city: placeFields.city.default(''), icon: placeFields.icon.default('pin') })
const placePatch = z.object(placeFields).partial()

const TILE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.pmtiles$/

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

  /** The tile file named by MAP_TILES, or else the first one in the tiles directory. */
  const mapTilesUrl = (): string | null => {
    let names: string[]
    try {
      names = readdirSync(path.join(config.dataDir, 'tiles')).filter((n) => TILE_NAME.test(n)).sort()
    } catch {
      return null
    }
    const name = config.mapTiles ? names.find((n) => n === config.mapTiles) : names[0]
    return name ? `/tiles/${name}` : null
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
      mapTiles: mapTilesUrl(),
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
          `INSERT INTO member (space_id, slot, username, password_hash, display_name, sprite_id, body_id, created_at, seen_since)
           VALUES (1, 1, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(input.username, passwordHash, input.displayName, defaultHeadpiece(1), defaultBody(1), now, now).lastInsertRowid as number
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
          `INSERT INTO member (space_id, slot, username, password_hash, display_name, sprite_id, body_id, created_at, seen_since)
           VALUES (?, 2, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(inv.space_id, input.username, passwordHash, input.displayName, defaultHeadpiece(2), defaultBody(2), now, now).lastInsertRowid as number
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
    if (!TILE_NAME.test(name)) return c.json({ error: 'not_found' }, 404)
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
      z
        .object({ displayName: z.string().trim().min(1).max(24), lang: z.enum(LANGS as [string, ...string[]]), spriteId: z.enum(HEADPIECE_KEYS), bodyId: z.enum(BODY_KEYS) })
        .partial(),
    )
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const me = c.get('member')
    db.prepare('UPDATE member SET display_name = ?, lang = ?, sprite_id = ?, body_id = ? WHERE id = ?').run(
      input.displayName ?? me.display_name,
      input.lang ?? me.lang,
      input.spriteId ?? me.sprite_id,
      input.bodyId ?? me.body_id ?? defaultBody(me.slot),
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

  app.get('/api/timeline/summary', (c) => c.json(timelineSummary(db, c.get('member').id)))

  app.get('/api/memories', (c) => {
    const month = c.req.query('month')
    if (!isValidMonth(month)) return c.json({ error: 'invalid_month' }, 400)
    const rows = db
      .prepare(
        `SELECT * FROM memory WHERE deleted_at IS NULL AND start_date >= ? AND start_date < ?
         ORDER BY start_date, id`,
      )
      .all(`${month}-01`, nextMonthStart(month)) as MemoryRow[]
    return c.json({ memories: withPhotos(db, rows, c.get('member').id) })
  })

  app.post('/api/memories', async (c) => {
    const input = await readJson(c, memoryCreate)
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const start = normalizeStartDate(input.startDate, input.datePrecision)
    if (input.endDate && input.endDate < start) return c.json({ error: 'invalid_input' }, 400)
    if (!placeExists(input.placeId)) return c.json({ error: 'invalid_place' }, 400)
    const me = c.get('member')
    const now = nowIso()
    const id = db
      .prepare(
        `INSERT INTO memory (space_id, title, note, start_date, end_date, date_precision, category, place_id, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(me.space_id, input.title, input.note, start, input.endDate, input.datePrecision, input.category, input.placeId, me.id, now, now)
      .lastInsertRowid as number
    return c.json(withPhotos(db, [getMemoryRow(db, id)!], c.get('member').id)[0], 201)
  })

  const placeExists = (id: number | null | undefined) =>
    id === null || id === undefined || !!db.prepare('SELECT 1 FROM place WHERE id = ?').get(id)

  const liveMemory = (idText: string): MemoryRow | null => {
    const id = idParam(idText)
    const row = id === null ? undefined : getMemoryRow(db, id)
    return row && !row.deleted_at ? row : null
  }

  /** The memory with its comments, and when the requesting member last opened it. */
  app.get('/api/memories/:id', (c) => {
    const row = liveMemory(c.req.param('id'))
    if (!row) return c.json({ error: 'not_found' }, 404)
    const me = c.get('member').id
    const detail: MemoryDetail = { ...withPhotos(db, [row], me)[0], comments: liveComments(db, row.id), seenAt: seenAt(db, me, row.id) }
    return c.json(detail)
  })

  /** Records that the requesting member has opened the memory; clears its quiet marker. */
  app.post('/api/memories/:id/seen', (c) => {
    const row = liveMemory(c.req.param('id'))
    if (!row) return c.json({ error: 'not_found' }, 404)
    markSeen(db, c.get('member').id, row.id, nowIso())
    return c.json({ ok: true })
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
    if (!placeExists(input.placeId)) return c.json({ error: 'invalid_place' }, 400)
    const placeId = input.placeId === undefined ? row.place_id : input.placeId
    db.prepare(
      `UPDATE memory SET title = ?, note = ?, start_date = ?, end_date = ?, date_precision = ?, category = ?, place_id = ?,
         updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).run(input.title ?? row.title, input.note ?? row.note, start, end, precision, input.category ?? row.category, placeId, nowIso(), c.get('member').id, row.id)
    return c.json(withPhotos(db, [getMemoryRow(db, row.id)!], c.get('member').id)[0])
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
    return c.json(withPhotos(db, [getMemoryRow(db, id!)!], c.get('member').id)[0])
  })

  app.get('/api/trash', (c) => {
    const memories = db.prepare('SELECT * FROM memory WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all() as MemoryRow[]
    const photos = db
      .prepare(
        `SELECT p.*, m.title AS memory_title FROM photo p JOIN memory m ON m.id = p.memory_id
         WHERE p.deleted_at IS NOT NULL AND m.deleted_at IS NULL ORDER BY p.deleted_at DESC`,
      )
      .all() as (PhotoRow & { memory_title: string })[]
    const comments = db
      .prepare(
        `SELECT c.*, m.title AS memory_title FROM comment c JOIN memory m ON m.id = c.memory_id
         WHERE c.deleted_at IS NOT NULL AND m.deleted_at IS NULL ORDER BY c.deleted_at DESC`,
      )
      .all() as (CommentRow & { memory_title: string })[]
    return c.json({
      memories: withPhotos(db, memories, c.get('member').id),
      photos: photos.map((p) => ({ ...toPhoto(p), memoryTitle: p.memory_title, deletedAt: p.deleted_at })),
      comments: comments.map((k) => ({ ...toComment(k), memoryTitle: k.memory_title, deletedAt: k.deleted_at })),
    })
  })

  // ---- places ----

  app.get('/api/places', (c) => c.json({ places: listPlaces(db) }))

  app.post('/api/places', async (c) => {
    const input = await readJson(c, placeCreate)
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const me = c.get('member')
    const now = nowIso()
    const id = db
      .prepare(
        `INSERT INTO place (space_id, name, latitude, longitude, city, icon, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(me.space_id, input.name, input.latitude, input.longitude, input.city, input.icon, me.id, now, now).lastInsertRowid as number
    return c.json(getPlace(db, id), 201)
  })

  const placeParam = (idText: string) => {
    const id = idParam(idText)
    return id === null ? null : getPlace(db, id)
  }

  app.get('/api/places/:id', (c) => {
    const place = placeParam(c.req.param('id'))
    return place ? c.json(place) : c.json({ error: 'not_found' }, 404)
  })

  app.patch('/api/places/:id', async (c) => {
    const place = placeParam(c.req.param('id'))
    if (!place) return c.json({ error: 'not_found' }, 404)
    const input = await readJson(c, placePatch)
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const next = { ...place, ...input }
    db.prepare('UPDATE place SET name = ?, latitude = ?, longitude = ?, city = ?, icon = ?, updated_at = ? WHERE id = ?').run(
      next.name, next.latitude, next.longitude, next.city, next.icon, nowIso(), place.id,
    )
    return c.json(getPlace(db, place.id))
  })

  // The memories keep everything except their link to this Place.
  app.delete('/api/places/:id', (c) => {
    const place = placeParam(c.req.param('id'))
    if (!place) return c.json({ error: 'not_found' }, 404)
    db.transaction(() => {
      db.prepare('UPDATE memory SET place_id = NULL WHERE place_id = ?').run(place.id)
      db.prepare('DELETE FROM place WHERE id = ?').run(place.id)
    })()
    return c.json({ ok: true })
  })

  /** All memories at one Place, oldest first. */
  app.get('/api/places/:id/memories', (c) => {
    const place = placeParam(c.req.param('id'))
    if (!place) return c.json({ error: 'not_found' }, 404)
    const rows = db
      .prepare('SELECT * FROM memory WHERE place_id = ? AND deleted_at IS NULL ORDER BY start_date, id')
      .all(place.id) as MemoryRow[]
    return c.json({ place, memories: withPhotos(db, rows, c.get('member').id) })
  })

  /** Moves every memory of this Place to another Place and removes this one. */
  app.post('/api/places/:id/merge', async (c) => {
    const place = placeParam(c.req.param('id'))
    if (!place) return c.json({ error: 'not_found' }, 404)
    const input = await readJson(c, z.object({ into: z.number().int().positive() }))
    if (!input || input.into === place.id) return c.json({ error: 'invalid_input' }, 400)
    if (!getPlace(db, input.into)) return c.json({ error: 'invalid_place' }, 400)
    db.transaction(() => {
      db.prepare('UPDATE memory SET place_id = ? WHERE place_id = ?').run(input.into, place.id)
      db.prepare('DELETE FROM place WHERE id = ?').run(place.id)
    })()
    return c.json(getPlace(db, input.into))
  })

  /**
   * Separates some memories of this Place into a new Place. Without given
   * coordinates, the new Place is at the mean position of those memories'
   * photos, or at this Place's position when they have none.
   */
  app.post('/api/places/:id/split', async (c) => {
    const place = placeParam(c.req.param('id'))
    if (!place) return c.json({ error: 'not_found' }, 404)
    const input = await readJson(
      c,
      z.object({
        memoryIds: z.array(z.number().int().positive()).min(1).max(5000),
        name: placeFields.name,
        city: placeFields.city.optional(),
        icon: placeFields.icon.optional(),
        latitude: placeFields.latitude.optional(),
        longitude: placeFields.longitude.optional(),
      }),
    )
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const ids = [...new Set(input.memoryIds)]
    const marks = ids.map(() => '?').join(',')
    const owned = (db.prepare(`SELECT count(*) AS n FROM memory WHERE place_id = ? AND id IN (${marks})`).get(place.id, ...ids) as { n: number }).n
    if (owned !== ids.length) return c.json({ error: 'invalid_input' }, 400)
    let position = input.latitude !== undefined && input.longitude !== undefined ? { latitude: input.latitude, longitude: input.longitude } : null
    if (!position) {
      const photos = db
        .prepare(`SELECT latitude, longitude FROM photo WHERE deleted_at IS NULL AND memory_id IN (${marks})`)
        .all(...ids) as { latitude: number | null; longitude: number | null }[]
      position = centroid(photos) ?? { latitude: place.latitude, longitude: place.longitude }
    }
    const me = c.get('member')
    const id = db.transaction(() => {
      const now = nowIso()
      const newId = db
        .prepare(
          `INSERT INTO place (space_id, name, latitude, longitude, city, icon, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(me.space_id, input.name, position!.latitude, position!.longitude, input.city ?? place.city, input.icon ?? place.icon, me.id, now, now)
        .lastInsertRowid as number
      db.prepare(`UPDATE memory SET place_id = ? WHERE place_id = ? AND id IN (${marks})`).run(newId, place.id, ...ids)
      return newId
    })()
    return c.json(getPlace(db, id), 201)
  })

  // ---- comments ----

  app.post('/api/memories/:id/comments', async (c) => {
    const memory = liveMemory(c.req.param('id'))
    if (!memory) return c.json({ error: 'not_found' }, 404)
    const input = await readJson(c, z.object({ text: z.string().trim().min(1).max(COMMENT_MAX_LENGTH) }))
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const id = db
      .prepare('INSERT INTO comment (memory_id, author_id, text, created_at) VALUES (?, ?, ?, ?)')
      .run(memory.id, c.get('member').id, input.text, nowIso()).lastInsertRowid as number
    return c.json(toComment(db.prepare('SELECT * FROM comment WHERE id = ?').get(id) as CommentRow), 201)
  })

  const commentParam = (idText: string) => {
    const id = idParam(idText)
    return id === null ? undefined : (db.prepare('SELECT * FROM comment WHERE id = ?').get(id) as CommentRow | undefined)
  }

  // A comment is its author's words: only the author removes or restores it.
  app.delete('/api/comments/:id', (c) => {
    const row = commentParam(c.req.param('id'))
    if (!row || row.deleted_at) return c.json({ error: 'not_found' }, 404)
    if (row.author_id !== c.get('member').id) return c.json({ error: 'not_author' }, 403)
    db.prepare('UPDATE comment SET deleted_at = ? WHERE id = ?').run(nowIso(), row.id)
    return c.json({ ok: true })
  })

  app.post('/api/comments/:id/restore', (c) => {
    const row = commentParam(c.req.param('id'))
    if (!row || !row.deleted_at) return c.json({ error: 'not_found' }, 404)
    if (row.author_id !== c.get('member').id) return c.json({ error: 'not_author' }, 403)
    db.prepare('UPDATE comment SET deleted_at = NULL WHERE id = ?').run(row.id)
    return c.json(toComment({ ...row, deleted_at: null }))
  })

  // ---- stickers ----

  /**
   * Places a sticker. A reaction has no position and is placed at most once
   * per member (placing it again returns the existing one); a decorative
   * sticker needs a position on the cover.
   */
  app.post('/api/memories/:id/stickers', async (c) => {
    const memory = liveMemory(c.req.param('id'))
    if (!memory) return c.json({ error: 'not_found' }, 404)
    const input = await readJson(
      c,
      z.object({ key: z.enum(STICKER_KEYS), x: z.number().min(0).max(1).optional(), y: z.number().min(0).max(1).optional() }),
    )
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const me = c.get('member').id
    const reaction = isReactionKey(input.key)
    const hasPosition = input.x !== undefined && input.y !== undefined
    if (reaction === hasPosition) return c.json({ error: 'invalid_input' }, 400)
    if (reaction) {
      const existing = db
        .prepare('SELECT * FROM sticker WHERE memory_id = ? AND sticker_key = ? AND placed_by = ? AND x IS NULL')
        .get(memory.id, input.key, me) as StickerRow | undefined
      if (existing) return c.json(toSticker(existing))
    } else {
      const placed = (db.prepare('SELECT count(*) AS n FROM sticker WHERE memory_id = ? AND x IS NOT NULL').get(memory.id) as { n: number }).n
      if (placed >= MAX_DECOR_STICKERS) return c.json({ error: 'too_many_stickers' }, 409)
    }
    const id = db
      .prepare('INSERT INTO sticker (memory_id, sticker_key, placed_by, x, y, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(memory.id, input.key, me, reaction ? null : input.x, reaction ? null : input.y, nowIso()).lastInsertRowid as number
    return c.json(toSticker(db.prepare('SELECT * FROM sticker WHERE id = ?').get(id) as StickerRow), 201)
  })

  // A reaction belongs to the member who placed it; decorative stickers belong to the memory and either member may remove them.
  app.delete('/api/stickers/:id', (c) => {
    const id = idParam(c.req.param('id'))
    const row = id === null ? undefined : (db.prepare('SELECT * FROM sticker WHERE id = ?').get(id) as StickerRow | undefined)
    if (!row) return c.json({ error: 'not_found' }, 404)
    if (row.x === null && row.placed_by !== c.get('member').id) return c.json({ error: 'not_author' }, 403)
    db.prepare('DELETE FROM sticker WHERE id = ?').run(row.id)
    return c.json({ ok: true })
  })

  // ---- key dates and speech bubbles ----

  const keyDateInput = z.object({ label: z.string().trim().min(1).max(KEY_DATE_LABEL_MAX_LENGTH), date: dateString })

  app.get('/api/key-dates', (c) => {
    const rows = db.prepare('SELECT * FROM key_date ORDER BY substr(date, 6), id').all() as KeyDateRow[]
    return c.json({ keyDates: rows.map(toKeyDate) })
  })

  app.post('/api/key-dates', async (c) => {
    const input = await readJson(c, keyDateInput)
    if (!input) return c.json({ error: 'invalid_input' }, 400)
    const me = c.get('member')
    const id = db
      .prepare('INSERT INTO key_date (space_id, label, date, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(me.space_id, input.label, input.date, me.id, nowIso()).lastInsertRowid as number
    return c.json(toKeyDate(db.prepare('SELECT * FROM key_date WHERE id = ?').get(id) as KeyDateRow), 201)
  })

  app.delete('/api/key-dates/:id', (c) => {
    const id = idParam(c.req.param('id'))
    const changed = id === null ? 0 : db.prepare('DELETE FROM key_date WHERE id = ?').run(id).changes
    return changed ? c.json({ ok: true }) : c.json({ error: 'not_found' }, 404)
  })

  /**
   * Material for the characters' speech bubbles on a given day (the client's
   * local date): key dates, memories on the same day of earlier years, and a
   * random sample of comments and note excerpts.
   */
  app.get('/api/bubbles', (c) => {
    const date = c.req.query('date')
    if (!isValidDate(date)) return c.json({ error: 'invalid_input' }, 400)
    const keyDates = (db.prepare('SELECT * FROM key_date ORDER BY id').all() as KeyDateRow[]).map((k) => ({ id: k.id, label: k.label, date: k.date }))
    const onThisDay = (
      db
        .prepare(
          `SELECT id, title, start_date, created_by FROM memory
           WHERE deleted_at IS NULL AND date_precision = 'day' AND substr(start_date, 6) = ? AND start_date < ?
           ORDER BY start_date DESC, id LIMIT 5`,
        )
        .all(date.slice(5), date) as { id: number; title: string; start_date: string; created_by: number }[]
    ).map((m) => ({ memoryId: m.id, title: m.title, startDate: m.start_date, createdBy: m.created_by }))
    const fromComments = db
      .prepare(
        `SELECT c.memory_id, c.text, c.author_id AS speaker, m.start_date FROM comment c JOIN memory m ON m.id = c.memory_id
         WHERE c.deleted_at IS NULL AND m.deleted_at IS NULL ORDER BY random() LIMIT 3`,
      )
      .all() as { memory_id: number; text: string; speaker: number; start_date: string }[]
    const fromNotes = db
      .prepare(
        `SELECT id AS memory_id, note AS text, created_by AS speaker, start_date FROM memory
         WHERE deleted_at IS NULL AND trim(note) != '' ORDER BY random() LIMIT 3`,
      )
      .all() as { memory_id: number; text: string; speaker: number; start_date: string }[]
    const quotes = [...fromComments, ...fromNotes]
      .map((q) => ({ memoryId: q.memory_id, text: excerpt(q.text), speakerId: q.speaker, date: q.start_date, order: Math.random() }))
      .sort((a, b) => a.order - b.order)
      .slice(0, 3)
      .map(({ order: _order, ...q }) => q)
    const body: BubbleSources = { keyDates, onThisDay, quotes }
    return c.json(body)
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
    return c.json(withPhotos(db, [memory], c.get('member').id)[0])
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
