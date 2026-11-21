import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import exifr from 'exifr'
import { unzipSync, strFromU8 } from 'fflate'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BubbleSources, Comment, KeyDate, Memory, MemoryDetail, Photo, Place, StatusResponse, StickerPlacement, TimelineSummary } from '@days/shared'
import { createApp } from '../src/app'
import type { Config } from '../src/config'
import { openDb, type Db } from '../src/db/index'
import { purgeDeleted } from '../src/purge'
import { sampleJpeg } from './fixtures'

let dir: string
let db: Db
let app: ReturnType<typeof createApp>
let config: Config

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'days-test-'))
  config = {
    port: 0,
    host: '127.0.0.1',
    dataDir: dir,
    clientDist: path.join(dir, 'no-client'),
    cookieSecure: false,
    setupToken: null,
    maxUploadBytes: 60 * 1024 * 1024,
    mapTiles: null,
  }
  db = openDb(path.join(dir, 'days.sqlite'))
  app = createApp(db, config)
})

afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

/** A browser-like client that keeps the session cookie. */
function client() {
  let cookie = ''
  const request = async (method: string, url: string, body?: unknown) => {
    const headers: Record<string, string> = {}
    if (cookie) headers.cookie = cookie
    let payload: BodyInit | undefined
    if (body instanceof FormData) payload = body
    else if (body !== undefined) {
      headers['content-type'] = 'application/json'
      payload = JSON.stringify(body)
    }
    const res = await app.request(url, { method, headers, body: payload })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    return res
  }
  return {
    get: (url: string) => request('GET', url),
    post: (url: string, body?: unknown) => request('POST', url, body),
    patch: (url: string, body?: unknown) => request('PATCH', url, body),
    put: (url: string, body?: unknown) => request('PUT', url, body),
    del: (url: string) => request('DELETE', url),
  }
}

const alice = { username: 'alice', password: 'correct horse', displayName: 'Alice' }
const bob = { username: 'bob', password: 'battery staple', displayName: 'Bob' }

async function pair() {
  const a = client()
  expect((await a.post('/api/setup', alice)).status).toBe(201)
  const { token } = (await (await a.post('/api/invitations')).json()) as { token: string }
  const b = client()
  expect((await b.post(`/api/invitations/${token}/accept`, bob)).status).toBe(201)
  return { a, b, token }
}

async function upload(c: ReturnType<typeof client>, memoryId: number, buf: Buffer, name = 'photo.jpg', extra: Record<string, string> = {}) {
  const form = new FormData()
  form.set('file', new File([new Uint8Array(buf)], name, { type: 'image/jpeg' }))
  for (const [k, v] of Object.entries(extra)) form.set(k, v)
  return c.post(`/api/memories/${memoryId}/photos`, form)
}

describe('accounts and pairing', () => {
  it('creates the space once and reports status', async () => {
    const a = client()
    let status = (await (await a.get('/api/status')).json()) as StatusResponse
    expect(status).toMatchObject({ initialized: false, me: null })

    expect((await a.post('/api/setup', { ...alice, password: 'short' })).status).toBe(400)
    expect((await a.post('/api/setup', alice)).status).toBe(201)
    expect((await client().post('/api/setup', bob)).status).toBe(409)

    status = (await (await a.get('/api/status')).json()) as StatusResponse
    expect(status.initialized).toBe(true)
    expect(status.me).toMatchObject({ username: 'alice', slot: 1, displayName: 'Alice' })
    // A visitor without a session learns nothing about the members.
    const anon = (await (await client().get('/api/status')).json()) as StatusResponse
    expect(anon.members).toEqual([])
  })

  it('requires the setup token when one is configured', async () => {
    config.setupToken = 'secret'
    expect((await client().post('/api/setup', alice)).status).toBe(403)
    expect((await client().post('/api/setup', { ...alice, setupToken: 'secret' })).status).toBe(201)
  })

  it('accepts an invitation exactly once and never allows a third member', async () => {
    const { a, token } = await pair()
    expect(await (await client().get(`/api/invitations/${token}`)).json()).toEqual({ valid: false })
    expect((await client().post(`/api/invitations/${token}/accept`, { ...bob, username: 'carol' })).status).toBe(404)
    expect((await a.post('/api/invitations')).status).toBe(409)

    // The limit holds in the database even when the interface is bypassed.
    const insert = (slot: number) =>
      db
        .prepare(
          `INSERT INTO member (space_id, slot, username, password_hash, display_name, sprite_id, created_at)
           VALUES (1, ?, 'carol', 'x', 'Carol', 'partner-a', '2024-01-01')`,
        )
        .run(slot)
    expect(() => insert(3)).toThrow(/CHECK/)
    expect(() => insert(2)).toThrow(/UNIQUE/)
    expect(() => db.prepare("INSERT INTO space (id, created_at) VALUES (2, '2024-01-01')").run()).toThrow(/CHECK/)
  })

  it('invalidates an earlier invitation link when a new one is issued', async () => {
    const a = client()
    await a.post('/api/setup', alice)
    const first = ((await (await a.post('/api/invitations')).json()) as { token: string }).token
    const second = ((await (await a.post('/api/invitations')).json()) as { token: string }).token
    expect(await (await client().get(`/api/invitations/${first}`)).json()).toEqual({ valid: false })
    expect(await (await client().get(`/api/invitations/${second}`)).json()).toEqual({ valid: true })
  })

  it('signs in and out, and limits repeated failures', async () => {
    await pair()
    const c = client()
    expect((await c.post('/api/session', { username: 'alice', password: 'wrong password' })).status).toBe(401)
    expect((await c.post('/api/session', { username: 'ALICE', password: alice.password })).status).toBe(200)
    expect((await c.get('/api/timeline/summary')).status).toBe(200)
    expect((await c.del('/api/session')).status).toBe(200)
    expect((await c.get('/api/timeline/summary')).status).toBe(401)

    for (let i = 0; i < 10; i++) await c.post('/api/session', { username: 'bob', password: 'wrong password' })
    expect((await c.post('/api/session', { username: 'bob', password: bob.password })).status).toBe(429)
  })

  it('rejects state-changing requests from another origin', async () => {
    const res = await app.request('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://other.example', host: 'days.example' },
      body: JSON.stringify({ username: 'alice', password: 'x' }),
    })
    expect(res.status).toBe(403)
  })

  it('updates display name and language', async () => {
    const { b } = await pair()
    const res = await b.patch('/api/me', { lang: 'en', displayName: 'Bobby' })
    expect(await res.json()).toMatchObject({ lang: 'en', displayName: 'Bobby' })
    expect((await b.patch('/api/me', { lang: 'fr' })).status).toBe(400)
  })

  it('gives each partner a default headpiece and lets them choose another', async () => {
    const { a, b } = await pair()
    const status = (await (await a.get('/api/status')).json()) as { members: { slot: number; spriteId: string }[] }
    expect(status.members.map((m) => [m.slot, m.spriteId])).toEqual(expect.arrayContaining([[1, 'rosette'], [2, 'top-hat']]))
    const res = await b.patch('/api/me', { spriteId: 'chef-hat' })
    expect(await res.json()).toMatchObject({ spriteId: 'chef-hat', lang: expect.any(String) })
    expect((await b.patch('/api/me', { spriteId: 'crown' })).status).toBe(400)
  })
})

describe('memories', () => {
  it('requires a session for data and files', async () => {
    const anon = client()
    for (const url of ['/api/memories?month=2021-07', '/api/timeline/summary', '/api/export', '/api/trash', '/files/1/original']) {
      expect((await anon.get(url)).status, url).toBe(401)
    }
  })

  it('creates, files by month, edits by either member, deletes and restores', async () => {
    const { a, b } = await pair()
    const created = (await (
      await a.post('/api/memories', { title: '  First trip  ', startDate: '2021-07-15', endDate: '2021-07-18', category: 'travel' })
    ).json()) as Memory
    expect(created).toMatchObject({ title: 'First trip', startDate: '2021-07-15', endDate: '2021-07-18', datePrecision: 'day', category: 'travel' })

    const old = (await (
      await a.post('/api/memories', { title: 'Sometime that spring', startDate: '2019-04-20', datePrecision: 'month' })
    ).json()) as Memory
    expect(old.startDate).toBe('2019-04-01')

    for (const bad of [
      { title: '', startDate: '2021-07-15' },
      { title: 'x', startDate: '2021-02-30' },
      { title: 'x', startDate: '2021-07-15', endDate: '2021-07-01' },
      { title: 'x', startDate: '2021-07-15', category: 'nope' },
    ]) {
      expect((await a.post('/api/memories', bad)).status).toBe(400)
    }

    // The partner edits the same memory; the most recent save is kept.
    const edited = (await (await b.patch(`/api/memories/${created.id}`, { note: 'Rain on day two', title: 'First trip together' })).json()) as Memory
    expect(edited).toMatchObject({ title: 'First trip together', note: 'Rain on day two', startDate: '2021-07-15' })

    const summary = (await (await b.get('/api/timeline/summary')).json()) as TimelineSummary
    expect(summary.years.map((y) => [y.year, y.total])).toEqual([[2019, 1], [2021, 1]])
    expect(summary.years[1].months[6]).toBe(1)
    expect(summary.years[0].months[3]).toBe(1)

    const july = (await (await b.get('/api/memories?month=2021-07')).json()) as { memories: Memory[] }
    expect(july.memories.map((m) => m.id)).toEqual([created.id])
    expect((await b.get('/api/memories?month=2021-7')).status).toBe(400)

    expect((await b.del(`/api/memories/${created.id}`)).status).toBe(200)
    expect((await a.get(`/api/memories/${created.id}`)).status).toBe(404)
    expect(((await (await a.get('/api/memories?month=2021-07')).json()) as { memories: Memory[] }).memories).toEqual([])
    const trash = (await (await a.get('/api/trash')).json()) as { memories: Memory[] }
    expect(trash.memories.map((m) => m.id)).toEqual([created.id])
    expect((await a.post(`/api/memories/${created.id}/restore`)).status).toBe(200)
    expect((await a.get(`/api/memories/${created.id}`)).status).toBe(200)
  })
})

describe('photos', () => {
  it('stores the original unchanged and creates copies without metadata', async () => {
    const { a, b } = await pair()
    const memory = (await (await a.post('/api/memories', { title: 'Harbour', startDate: '2021-07-15' })).json()) as Memory
    const original = await sampleJpeg({ dateTime: '2021:07:15 14:30:00', latitude: 31.2304, longitude: 121.4737 })

    const res = await upload(a, memory.id, original, 'IMG_0001.JPG')
    expect(res.status).toBe(201)
    const photo = (await res.json()) as Photo
    expect(photo).toMatchObject({ takenAt: '2021-07-15T14:30:00', width: 2400, height: 1800, originalName: 'IMG_0001.JPG', uploadedBy: 1 })
    expect(photo.latitude).toBeCloseTo(31.2304, 3)
    expect(photo.longitude).toBeCloseTo(121.4737, 3)

    // The partner can read all three files.
    const fetched = Buffer.from(await (await b.get(`/files/${photo.id}/original`)).arrayBuffer())
    expect(fetched.equals(original)).toBe(true)
    for (const [variant, edge] of [['medium', 1600], ['thumb', 400]] as const) {
      const r = await b.get(`/files/${photo.id}/${variant}`)
      expect(r.status).toBe(200)
      expect(r.headers.get('cache-control')).toContain('private')
      const buf = Buffer.from(await r.arrayBuffer())
      const meta = await sharp(buf).metadata()
      expect(Math.max(meta.width!, meta.height!)).toBe(edge)
      expect(meta.exif).toBeUndefined()
      expect(await exifr.parse(buf, { gps: true }).catch(() => undefined)).toBeUndefined()
    }
    expect((await b.get(`/files/${photo.id}/other`)).status).toBe(404)

    const stored = db.prepare('SELECT * FROM photo WHERE id = ?').get(photo.id) as { original_path: string; medium_path: string; thumb_path: string }
    for (const p of [stored.original_path, stored.medium_path, stored.thumb_path]) {
      expect(fs.existsSync(path.join(dir, 'files', p))).toBe(true)
    }
  })

  it('uses metadata supplied by the client, keeps order, and rejects other files', async () => {
    const { a } = await pair()
    const memory = (await (await a.post('/api/memories', { title: 'Screens', startDate: '2022-01-02' })).json()) as Memory
    const plain = await sampleJpeg({ width: 300, height: 200 })
    const p1 = (await (await upload(a, memory.id, plain, 'a.jpg')).json()) as Photo
    expect(p1).toMatchObject({ takenAt: null, latitude: null, longitude: null, width: 300, height: 200 })
    const p2 = (await (
      await upload(a, memory.id, plain, 'b.jpg', { takenAt: '2022-01-02T08:00:00', latitude: '30.25', longitude: '120.15' })
    ).json()) as Photo
    expect(p2).toMatchObject({ takenAt: '2022-01-02T08:00:00', latitude: 30.25, longitude: 120.15 })

    const reordered = (await (await a.put(`/api/memories/${memory.id}/photos/order`, { photoIds: [p2.id, p1.id] })).json()) as Memory
    expect(reordered.photos.map((p) => p.id)).toEqual([p2.id, p1.id])

    expect((await upload(a, memory.id, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'x.svg')).status).toBe(415)
    expect((await upload(a, memory.id, Buffer.from('not an image'), 'x.jpg')).status).toBe(415)
    expect((await upload(a, 9999, plain)).status).toBe(404)

    expect((await a.del(`/api/photos/${p1.id}`)).status).toBe(200)
    const after = (await (await a.get(`/api/memories/${memory.id}`)).json()) as Memory
    expect(after.photos.map((p) => p.id)).toEqual([p2.id])
    const trash = (await (await a.get('/api/trash')).json()) as { photos: Photo[] }
    expect(trash.photos.map((p) => p.id)).toEqual([p1.id])
    expect((await a.post(`/api/photos/${p1.id}/restore`)).status).toBe(200)
  })

  it('applies the orientation flag to the copies', async () => {
    const { a } = await pair()
    const memory = (await (await a.post('/api/memories', { title: 'Portrait', startDate: '2022-01-02' })).json()) as Memory
    const rotated = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#335' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer()
    const photo = (await (await upload(a, memory.id, rotated)).json()) as Photo
    expect([photo.width, photo.height]).toEqual([600, 800])
    const thumb = await sharp(Buffer.from(await (await a.get(`/files/${photo.id}/thumb`)).arrayBuffer())).metadata()
    expect(thumb.height).toBeGreaterThan(thumb.width!)
  })
})

describe('export and purge', () => {
  it('exports originals by year and month with data and an offline page', async () => {
    const { a, b } = await pair()
    const m1 = (await (await a.post('/api/memories', { title: 'Harbour </script><b>', note: 'windy', startDate: '2021-07-15' })).json()) as Memory
    const m2 = (await (await b.post('/api/memories', { title: 'Deleted', startDate: '2020-01-01' })).json()) as Memory
    const original = await sampleJpeg({ dateTime: '2021:07:15 14:30:00', latitude: 31.2304, longitude: 121.4737, width: 640, height: 480 })
    await upload(a, m1.id, original, 'IMG_1.JPG')
    await upload(b, m1.id, await sampleJpeg({ width: 320, height: 240 }), 'IMG_2.JPG')
    await upload(b, m2.id, original)
    await b.del(`/api/memories/${m2.id}`)

    const res = await b.get('/api/export')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
    const names = Object.keys(files).sort()
    expect(names.filter((n) => n.startsWith('2021/'))).toEqual([
      `2021/07/2021-07-15_m${m1.id}_001.jpg`,
      `2021/07/2021-07-15_m${m1.id}_002.jpg`,
    ])
    expect(names.some((n) => n.startsWith('2020/'))).toBe(false)
    expect(Buffer.from(files[`2021/07/2021-07-15_m${m1.id}_001.jpg`]).equals(original)).toBe(true)

    const data = JSON.parse(strFromU8(files['data.json']))
    expect(data.members.map((m: { displayName: string }) => m.displayName)).toEqual(['Alice', 'Bob'])
    expect(data.memories).toHaveLength(1)
    expect(data.memories[0]).toMatchObject({ title: 'Harbour </script><b>', note: 'windy' })
    expect(data.memories[0].photos[0]).toMatchObject({ takenAt: '2021-07-15T14:30:00', originalName: 'IMG_1.JPG' })
    for (const p of data.memories[0].photos) {
      expect(files[p.file]).toBeDefined()
      expect(files[p.thumb]).toBeDefined()
    }
    const page = strFromU8(files['index.html'])
    expect(page).toContain('window.DAYS_EXPORT')
    expect(page).not.toContain('</script><b>')
  })

  it('removes deleted items permanently only after 30 days', async () => {
    const { a } = await pair()
    const keep = (await (await a.post('/api/memories', { title: 'Keep', startDate: '2021-07-15' })).json()) as Memory
    const gone = (await (await a.post('/api/memories', { title: 'Gone', startDate: '2021-07-16' })).json()) as Memory
    const jpg = await sampleJpeg({ width: 200, height: 200 })
    const kept = (await (await upload(a, keep.id, jpg)).json()) as Photo
    const removedPhoto = (await (await upload(a, keep.id, jpg)).json()) as Photo
    const inGone = (await (await upload(a, gone.id, jpg)).json()) as Photo
    await a.del(`/api/memories/${gone.id}`)
    await a.del(`/api/photos/${removedPhoto.id}`)
    const filesDir = path.join(dir, 'files')
    const pathOf = (id: number) => (db.prepare('SELECT original_path AS p FROM photo WHERE id = ?').get(id) as { p: string }).p
    const gonePath = pathOf(inGone.id)
    const removedPath = pathOf(removedPhoto.id)

    expect(await purgeDeleted(db, filesDir, new Date(Date.now() + 29 * 86400_000))).toBe(0)
    expect(fs.existsSync(path.join(filesDir, gonePath))).toBe(true)

    await purgeDeleted(db, filesDir, new Date(Date.now() + 31 * 86400_000))
    expect(fs.existsSync(path.join(filesDir, gonePath))).toBe(false)
    expect(fs.existsSync(path.join(filesDir, removedPath))).toBe(false)
    expect(fs.existsSync(path.join(filesDir, pathOf(kept.id)))).toBe(true)
    expect((await a.post(`/api/memories/${gone.id}/restore`)).status).toBe(404)
    expect((await a.get(`/api/memories/${keep.id}`)).status).toBe(200)
  })
})

describe('map tiles', () => {
  it('serves byte ranges of PMTiles files without a session', async () => {
    fs.mkdirSync(path.join(dir, 'tiles'))
    fs.writeFileSync(path.join(dir, 'tiles', 'region.pmtiles'), '0123456789')
    const part = await app.request('/tiles/region.pmtiles', { headers: { range: 'bytes=2-5' } })
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe('bytes 2-5/10')
    expect(await part.text()).toBe('2345')
    expect(await (await app.request('/tiles/region.pmtiles')).text()).toBe('0123456789')
    expect((await app.request('/tiles/region.pmtiles', { headers: { range: 'bytes=20-30' } })).status).toBe(416)
    expect((await app.request('/tiles/..%2Fdays.sqlite')).status).toBe(404)
    expect((await app.request('/tiles/days.sqlite')).status).toBe(404)
  })
})

describe('places', () => {
  const harbour = { name: 'Harbour', latitude: 31.2304, longitude: 121.4737, city: 'Shanghai' }
  const createMemory = async (c: ReturnType<typeof client>, title: string, startDate: string, placeId: number | null = null) =>
    (await (await c.post('/api/memories', { title, startDate, placeId })).json()) as Memory

  it('creates a Place, links memories, and lists them oldest first', async () => {
    const { a, b } = await pair()
    const res = await a.post('/api/places', harbour)
    expect(res.status).toBe(201)
    const place = (await res.json()) as Place
    expect(place).toMatchObject({ name: 'Harbour', icon: 'pin', city: 'Shanghai', memoryCount: 0 })

    const later = await createMemory(a, 'Later', '2022-10-02', place.id)
    expect(later.place).toMatchObject({ id: place.id, name: 'Harbour' })
    const earlier = await createMemory(b, 'Earlier', '2021-07-15')
    // The partner sets the Place afterwards; other fields stay as they were.
    const patched = (await (await b.patch(`/api/memories/${earlier.id}`, { placeId: place.id })).json()) as Memory
    expect(patched.placeId).toBe(place.id)
    expect(patched.title).toBe('Earlier')

    const atPlace = (await (await a.get(`/api/places/${place.id}/memories`)).json()) as { memories: Memory[]; place: Place }
    expect(atPlace.memories.map((m) => m.title)).toEqual(['Earlier', 'Later'])
    expect(atPlace.place).toMatchObject({ memoryCount: 2, firstDate: '2021-07-15', lastDate: '2022-10-02' })

    // Deleted memories are not counted; the month list carries the Place too.
    await a.del(`/api/memories/${later.id}`)
    expect(((await (await a.get(`/api/places/${place.id}`)).json()) as Place).memoryCount).toBe(1)
    const month = (await (await a.get('/api/memories?month=2021-07')).json()) as { memories: Memory[] }
    expect(month.memories[0].place?.name).toBe('Harbour')

    expect((await a.post('/api/memories', { title: 'X', startDate: '2021-01-01', placeId: 999 })).status).toBe(400)
    expect((await a.patch(`/api/memories/${earlier.id}`, { placeId: 999 })).status).toBe(400)
    expect((await a.post('/api/places', { ...harbour, latitude: 95 })).status).toBe(400)
    expect((await a.post('/api/places', { ...harbour, icon: 'castle' })).status).toBe(400)
    expect((await client().get('/api/places')).status).toBe(401)
  })

  it('renames, merges, separates, and deletes Places', async () => {
    const { a } = await pair()
    const one = (await (await a.post('/api/places', harbour)).json()) as Place
    const two = (await (await a.post('/api/places', { name: 'Harbor', latitude: 31.2306, longitude: 121.4741 })).json()) as Place
    const m1 = await createMemory(a, 'First', '2021-07-15', one.id)
    const m2 = await createMemory(a, 'Second', '2021-08-01', two.id)
    const m3 = await createMemory(a, 'Third', '2021-09-01', two.id)

    const renamed = (await (await a.patch(`/api/places/${one.id}`, { name: 'The harbour', icon: 'water' })).json()) as Place
    expect(renamed).toMatchObject({ name: 'The harbour', icon: 'water', latitude: harbour.latitude })

    // Merge: every memory moves, the source disappears.
    expect((await a.post(`/api/places/${two.id}/merge`, { into: two.id })).status).toBe(400)
    const merged = (await (await a.post(`/api/places/${two.id}/merge`, { into: one.id })).json()) as Place
    expect(merged.memoryCount).toBe(3)
    expect((await a.get(`/api/places/${two.id}`)).status).toBe(404)

    // Separate: the new Place is placed at the photos of the moved memories.
    const form = new FormData()
    form.set('file', new File([new Uint8Array(await sampleJpeg({ latitude: 30.2431, longitude: 120.1503 }))], 'lake.jpg', { type: 'image/jpeg' }))
    expect((await a.post(`/api/memories/${m3.id}/photos`, form)).status).toBe(201)
    expect((await a.post(`/api/places/${one.id}/split`, { memoryIds: [999], name: 'Lake' })).status).toBe(400)
    const split = await a.post(`/api/places/${one.id}/split`, { memoryIds: [m3.id], name: 'Lake' })
    expect(split.status).toBe(201)
    const lake = (await split.json()) as Place
    expect(lake).toMatchObject({ name: 'Lake', memoryCount: 1, icon: 'water' })
    expect(lake.latitude).toBeCloseTo(30.2431, 3)
    expect(((await (await a.get(`/api/memories/${m3.id}`)).json()) as Memory).placeId).toBe(lake.id)

    // Without photo coordinates the new Place keeps the source position.
    const noPhotos = (await (await a.post(`/api/places/${one.id}/split`, { memoryIds: [m2.id], name: 'Pier' })).json()) as Place
    expect(noPhotos.latitude).toBeCloseTo(harbour.latitude, 6)

    const list = (await (await a.get('/api/places')).json()) as { places: Place[] }
    expect(list.places.map((p) => p.name)).toEqual(['Lake', 'Pier', 'The harbour'])

    // Deleting a Place keeps its memories.
    expect((await a.del(`/api/places/${one.id}`)).status).toBe(200)
    const kept = (await (await a.get(`/api/memories/${m1.id}`)).json()) as Memory
    expect(kept).toMatchObject({ title: 'First', placeId: null, place: null })
  })

  it('exports Places and reports the installed tile file', async () => {
    const { a } = await pair()
    expect(((await (await a.get('/api/status')).json()) as StatusResponse).mapTiles).toBeNull()
    fs.mkdirSync(path.join(dir, 'tiles'))
    fs.writeFileSync(path.join(dir, 'tiles', 'region.pmtiles'), 'x')
    fs.writeFileSync(path.join(dir, 'tiles', 'notes.txt'), 'x')
    expect(((await (await a.get('/api/status')).json()) as StatusResponse).mapTiles).toBe('/tiles/region.pmtiles')

    const place = (await (await a.post('/api/places', harbour)).json()) as Place
    await createMemory(a, 'At the harbour', '2021-07-15', place.id)
    const zip = unzipSync(new Uint8Array(await (await a.get('/api/export')).arrayBuffer()))
    const data = JSON.parse(strFromU8(zip['data.json']))
    expect(data.places).toEqual([{ id: place.id, name: 'Harbour', city: 'Shanghai', icon: 'pin', latitude: harbour.latitude, longitude: harbour.longitude }])
    expect(data.memories[0]).toMatchObject({ placeId: place.id, placeName: 'Harbour' })
  })
})

/** Timestamps have millisecond resolution; this keeps successive actions in order. */
const tick = () => new Promise((r) => setTimeout(r, 5))

describe('co-creation', () => {
  it('marks memories with new items from the partner until opened', async () => {
    const { a, b } = await pair()
    const m = (await (await a.post('/api/memories', { title: 'Harbour', startDate: '2021-07-15' })).json()) as Memory
    expect(m.unseen).toBe(false) // one's own memory is never new
    const monthOf = async (c: ReturnType<typeof client>) =>
      ((await (await c.get('/api/memories?month=2021-07')).json()) as { memories: Memory[] }).memories[0]
    expect((await monthOf(b)).unseen).toBe(true)
    expect(((await (await b.get('/api/timeline/summary')).json()) as TimelineSummary).unseenMonths).toEqual(['2021-07'])
    expect(((await (await a.get('/api/timeline/summary')).json()) as TimelineSummary).unseenMonths).toEqual([])

    // Reading the memory does not clear the marker; opening it does.
    const detail = (await (await b.get(`/api/memories/${m.id}`)).json()) as MemoryDetail
    expect(detail.comments).toEqual([])
    expect(detail.seenAt <= m.createdAt).toBe(true)
    expect((await monthOf(b)).unseen).toBe(true)
    expect((await b.post(`/api/memories/${m.id}/seen`)).status).toBe(200)
    expect((await monthOf(b)).unseen).toBe(false)

    // A comment, a photo, a sticker, or an edit by the partner marks it again.
    await tick()
    const comment = (await (await a.post(`/api/memories/${m.id}/comments`, { text: '  Windy!  ' })).json()) as Comment
    expect(comment.text).toBe('Windy!')
    expect((await monthOf(b)).unseen).toBe(true)
    expect((await monthOf(a)).unseen).toBe(false)
    await b.post(`/api/memories/${m.id}/seen`)
    await tick()
    await a.patch(`/api/memories/${m.id}`, { title: 'Harbour afternoon' })
    expect((await monthOf(b)).unseen).toBe(true)
    await b.post(`/api/memories/${m.id}/seen`)
    await tick()
    await a.post(`/api/memories/${m.id}/stickers`, { key: 'heart' })
    expect((await monthOf(b)).unseen).toBe(true)
    expect((await monthOf(b)).commentCount).toBe(1)
  })

  it('keeps comments as their authors wrote them, with recovery', async () => {
    const { a, b } = await pair()
    const m = (await (await a.post('/api/memories', { title: 'Picnic', startDate: '2022-05-01' })).json()) as Memory
    expect((await a.post(`/api/memories/${m.id}/comments`, { text: '   ' })).status).toBe(400)
    expect((await a.post(`/api/memories/${m.id}/comments`, { text: 'x'.repeat(501) })).status).toBe(400)
    const first = (await (await a.post(`/api/memories/${m.id}/comments`, { text: 'Sunny' })).json()) as Comment
    await tick()
    await b.post(`/api/memories/${m.id}/comments`, { text: 'And the cake' })
    const detail = (await (await b.get(`/api/memories/${m.id}`)).json()) as MemoryDetail
    expect(detail.comments.map((k) => k.text)).toEqual(['Sunny', 'And the cake'])

    expect((await b.del(`/api/comments/${first.id}`)).status).toBe(403)
    expect((await a.del(`/api/comments/${first.id}`)).status).toBe(200)
    const trash = (await (await a.get('/api/trash')).json()) as { comments: (Comment & { memoryTitle: string })[] }
    expect(trash.comments.map((k) => [k.text, k.memoryTitle])).toEqual([['Sunny', 'Picnic']])
    expect((await b.post(`/api/comments/${first.id}/restore`)).status).toBe(403)
    expect((await a.post(`/api/comments/${first.id}/restore`)).status).toBe(200)
    expect(((await (await a.get(`/api/memories/${m.id}`)).json()) as MemoryDetail).comments).toHaveLength(2)

    // Exported with the memory; removed for good 30 days after deletion.
    const files = unzipSync(new Uint8Array(await (await a.get('/api/export')).arrayBuffer()))
    expect(JSON.parse(strFromU8(files['data.json'])).memories[0].comments.map((k: { text: string }) => k.text)).toEqual(['Sunny', 'And the cake'])
    await a.del(`/api/comments/${first.id}`)
    await a.del(`/api/memories/${m.id}`)
    expect(await purgeDeleted(db, path.join(dir, 'files'), new Date(Date.now() + 31 * 86400_000))).toBe(2)
    expect((db.prepare('SELECT count(*) AS n FROM comment').get() as { n: number }).n).toBe(0)
  })

  it('places reactions once per member and decorative stickers at a position', async () => {
    const { a, b } = await pair()
    const m = (await (await a.post('/api/memories', { title: 'Film', startDate: '2022-05-01' })).json()) as Memory
    const heart = await a.post(`/api/memories/${m.id}/stickers`, { key: 'heart' })
    expect(heart.status).toBe(201)
    const again = await a.post(`/api/memories/${m.id}/stickers`, { key: 'heart' })
    expect(again.status).toBe(200)
    expect(((await again.json()) as StickerPlacement).id).toBe(((await heart.json()) as StickerPlacement).id)
    expect((await b.post(`/api/memories/${m.id}/stickers`, { key: 'heart' })).status).toBe(201)
    expect((await a.post(`/api/memories/${m.id}/stickers`, { key: 'heart', x: 0.5, y: 0.5 })).status).toBe(400)
    expect((await a.post(`/api/memories/${m.id}/stickers`, { key: 'flower' })).status).toBe(400)
    expect((await a.post(`/api/memories/${m.id}/stickers`, { key: 'flower', x: 1.5, y: 0.5 })).status).toBe(400)
    expect((await a.post(`/api/memories/${m.id}/stickers`, { key: 'dragon', x: 0.5, y: 0.5 })).status).toBe(400)
    const flower = (await (await a.post(`/api/memories/${m.id}/stickers`, { key: 'flower', x: 0.25, y: 0.75 })).json()) as StickerPlacement
    expect(flower).toMatchObject({ key: 'flower', x: 0.25, y: 0.75 })

    const stickers = ((await (await b.get(`/api/memories/${m.id}`)).json()) as Memory).stickers
    expect(stickers.map((s) => s.key)).toEqual(['heart', 'heart', 'flower'])
    // A reaction belongs to its member; a decorative sticker belongs to the memory.
    const aliceHeart = stickers.find((s) => s.key === 'heart' && s.placedBy === stickers[0].placedBy)!
    expect((await b.del(`/api/stickers/${aliceHeart.id}`)).status).toBe(403)
    expect((await b.del(`/api/stickers/${flower.id}`)).status).toBe(200)

    for (let i = 0; i < 20; i++) await a.post(`/api/memories/${m.id}/stickers`, { key: 'sparkle', x: i / 20, y: 0.5 })
    expect((await a.post(`/api/memories/${m.id}/stickers`, { key: 'sparkle', x: 0.1, y: 0.1 })).status).toBe(409)
  })

  it('collects material for speech bubbles', async () => {
    const { a, b } = await pair()
    expect((await a.post('/api/key-dates', { label: 'First date', date: '2019-05-20' })).status).toBe(201)
    expect((await a.post('/api/key-dates', { label: '', date: '2019-05-20' })).status).toBe(400)
    expect((await a.post('/api/key-dates', { label: 'Bad', date: '2019-02-30' })).status).toBe(400)
    const keyDates = ((await (await b.get('/api/key-dates')).json()) as { keyDates: KeyDate[] }).keyDates
    expect(keyDates.map((k) => k.label)).toEqual(['First date'])

    const picnic = (await (await a.post('/api/memories', { title: 'Picnic', note: '\nSunny day.\nMore', startDate: '2021-05-20' })).json()) as Memory
    await a.post('/api/memories', { title: 'Same day, month only', startDate: '2022-05-20', datePrecision: 'month' })
    await a.post('/api/memories', { title: 'Today', startDate: '2026-05-20' })
    await b.post(`/api/memories/${picnic.id}/comments`, { text: 'Best cake' })

    expect((await a.get('/api/bubbles?date=2026-13-01')).status).toBe(400)
    const sources = (await (await a.get('/api/bubbles?date=2026-05-20')).json()) as BubbleSources
    expect(sources.keyDates).toEqual([{ id: keyDates[0].id, label: 'First date', date: '2019-05-20' }])
    expect(sources.onThisDay.map((m) => m.title)).toEqual(['Picnic'])
    expect(sources.quotes.map((q) => q.text).sort()).toEqual(['Best cake', 'Sunny day.'])
    expect((await a.del(`/api/key-dates/${keyDates[0].id}`)).status).toBe(200)
  })
})
