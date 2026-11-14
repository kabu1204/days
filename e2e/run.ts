/**
 * End-to-end check of Phase 0 and Phase 1 against the built client.
 *
 *   pnpm build && pnpm e2e
 *
 * Starts the server on a temporary data directory, then drives a browser
 * through setup, invitation, memory creation, timeline, viewer, language
 * switch, bulk import, trash, and export. Screenshots are written to
 * `e2e/out/`. Requires Playwright with Chromium to be installed.
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync, strFromU8 } from 'fflate'
import sharp from 'sharp'
import { sampleJpeg } from '../packages/server/test/fixtures'
import { writeSamplePmtiles } from './make-pmtiles'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright') as typeof import('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'e2e', 'out')
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'days-e2e-'))
const port = 8793
const base = `http://127.0.0.1:${port}`
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
const DESKTOP = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }

type Page = import('playwright').Page
const step = (name: string) => console.log(`- ${name}`)
const tid = (id: string) => `[data-testid="${id}"]`

async function fill(page: Page, name: string, value: string) {
  await page.locator(`.taro_page_show input[name="${name}"], .taro_page_show textarea[name="${name}"]`).fill(value)
}
async function shot(page: Page, name: string) {
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(out, `${name}.png`) })
}
/** Chooses files in the hidden input that the client creates on demand. */
async function choose(page: Page, trigger: string, files: string[]) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator(`.taro_page_show ${trigger}`).click()])
  await chooser.setFiles(files)
}

async function main() {
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })

  // Sample photos: two days, two locations on the second day, one without metadata.
  const photos = path.join(work, 'photos')
  fs.mkdirSync(photos)
  const samples: [string, Parameters<typeof sampleJpeg>[0]][] = [
    ['harbour-1.jpg', { dateTime: '2021:07:15 10:00:00', latitude: 31.2304, longitude: 121.4737, color: '#c8553d' }],
    ['harbour-2.jpg', { dateTime: '2021:07:15 10:20:00', latitude: 31.2306, longitude: 121.4741, color: '#3d7a6a' }],
    ['lake-1.jpg', { dateTime: '2022:10:02 09:00:00', latitude: 30.2431, longitude: 120.1503, color: '#4a7fb5' }],
    ['lake-2.jpg', { dateTime: '2022:10:02 09:30:00', latitude: 30.2433, longitude: 120.1506, color: '#e0a43a' }],
    ['city-1.jpg', { dateTime: '2022:10:02 19:00:00', latitude: 31.2304, longitude: 121.4737, color: '#8a5a3c' }],
    ['screenshot.jpg', { color: '#9a8fa3', width: 600, height: 1200 }],
  ]
  for (const [name, opts] of samples) fs.writeFileSync(path.join(photos, name), await sampleJpeg(opts))
  const file = (name: string) => path.join(photos, name)

  fs.mkdirSync(path.join(work, 'data', 'tiles'), { recursive: true })
  writeSamplePmtiles(path.join(work, 'data', 'tiles', 'sample.pmtiles'))

  const server = spawn('pnpm', ['--filter', '@days/server', 'start'], {
    cwd: root,
    env: { ...process.env, DATA_DIR: path.join(work, 'data'), PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'inherit'],
    detached: true,
  })
  await new Promise<void>((resolve, reject) => {
    server.stdout.on('data', (d) => String(d).includes('listening') && resolve())
    server.on('exit', (code) => reject(new Error(`server exited with ${code}`)))
  })

  const browser = await chromium.launch()
  try {
    const errors: string[] = []
    const watch = (page: Page) => page.on('pageerror', (e) => errors.push(e.message))

    // ---- first member: setup ----
    step('setup of the first account')
    const ctxA = await browser.newContext(PHONE)
    const a = await ctxA.newPage()
    watch(a)
    const loadedByA: string[] = []
    a.on('request', (r) => loadedByA.push(r.url()))
    await a.goto(base)
    await a.waitForURL(/pages\/setup/)
    await shot(a, '01-setup')
    await fill(a, 'displayName', '小满')
    await fill(a, 'username', 'xiaoman')
    await fill(a, 'password', 'correct horse')
    await a.locator(tid('submit')).click()
    await a.waitForURL(/pages\/settings/)

    step('invitation link and second account')
    await a.locator(tid('create-invite')).click()
    const link = (await a.locator(tid('invite-link')).innerText()).trim()
    assert.match(link, /#\/pages\/invite\/index\?token=/)
    await shot(a, '02-settings-invite')

    const ctxB = await browser.newContext(PHONE)
    const b = await ctxB.newPage()
    watch(b)
    await b.goto(link)
    await b.locator(tid('lang-toggle')).click() // the partner prefers English
    await fill(b, 'displayName', 'Leo')
    await fill(b, 'username', 'leo')
    await fill(b, 'password', 'battery staple')
    await shot(b, '03-invite')
    await b.locator(tid('submit')).click()
    await b.waitForURL(/pages\/timeline/)

    step('the invitation link works only once')
    const ctxC = await browser.newContext(PHONE)
    const c = await ctxC.newPage()
    await c.goto(link)
    await c.locator(tid('invite-invalid')).waitFor()
    assert.equal((await c.request.get(`${base}/api/timeline/summary`)).status(), 401)
    await ctxC.close()

    // ---- memory creation on the phone ----
    step('new memory with photos; date taken from metadata')
    await a.goto(`${base}/#/pages/timeline/index`)
    await a.locator(tid('new-memory')).click()
    await a.waitForURL(/memory\/edit/)
    await choose(a, tid('add-photos'), [file('harbour-2.jpg'), file('harbour-1.jpg')])
    await a.locator('.taro_page_show .photo-grid .cell >> nth=1').waitFor()
    assert.equal((await a.locator(`.taro_page_show ${tid('pick-start')}`).innerText()).trim(), '2021.07.15')
    await fill(a, 'title', '港口的下午')
    await fill(a, 'note', '风很大，\n帽子差点飞走。')
    await a.locator(`.taro_page_show ${tid('category-travel')}`).click()
    await shot(a, '04-edit')
    await a.locator(`.taro_page_show ${tid('save')}`).click()
    await a.waitForURL(/memory\/detail/)
    await a.locator(`.taro_page_show ${tid('photo-cell')} >> nth=1`).waitFor()
    assert.equal(await a.locator(`.taro_page_show ${tid('photo-cell')}`).count(), 2)
    assert.equal((await a.locator(`.taro_page_show ${tid('memory-date')}`).innerText()).trim(), '2021.07.15')
    await shot(a, '05-detail')

    step('image viewer: zoom and original')
    await a.locator(`.taro_page_show ${tid('photo-cell')} >> nth=0`).click()
    await a.locator(tid('viewer')).waitFor()
    assert.match((await a.locator(tid('viewer-image')).locator('img').getAttribute('src'))!, /\/medium$/)
    await a.locator(tid('zoom-in')).click()
    await a.locator(tid('zoom-in')).click()
    assert.equal(await a.locator(tid('viewer-frame')).getAttribute('data-scale'), '2.25')
    await a.waitForFunction(() => /\/original$/.test(document.querySelector('[data-testid="viewer-image"] img')?.getAttribute('src') ?? ''))
    await shot(a, '06-viewer-zoomed')
    await a.locator(tid('zoom-out')).click()
    await a.locator(tid('zoom-out')).click()
    await a.locator(tid('viewer-next')).click()
    await a.locator(tid('viewer-close')).click()

    step('the partner adds a photo and edits the memory')
    await b.reload()
    await b.locator(tid('year-2021')).waitFor()
    await shot(b, '07-timeline-partner-en')
    await b.locator(`${tid('card-title')} >> text=港口的下午`).click()
    await b.waitForURL(/memory\/detail/)
    await choose(b, tid('add-photos'), [file('screenshot.jpg')])
    await b.locator(`.taro_page_show ${tid('photo-cell')} >> nth=2`).waitFor()
    await b.locator(`.taro_page_show ${tid('edit-memory')}`).click()
    await b.waitForURL(/memory\/edit/)
    await b.locator('.taro_page_show input[name="title"]').waitFor()
    await b.waitForFunction(() => (document.querySelector('.taro_page_show input[name="title"]') as HTMLInputElement)?.value !== '')
    await fill(b, 'title', '港口的下午 (Harbour)')
    await b.locator(`.taro_page_show ${tid('pick-end')}`).click()
    await b.locator(tid('date-day-17')).click()
    await b.locator(tid('date-ok')).click()
    await b.locator(`.taro_page_show ${tid('save')}`).click()
    await b.waitForURL(/memory\/detail/)
    await b.waitForFunction(() => document.querySelector('.taro_page_show [data-testid="memory-date"]')?.textContent?.includes('2021.07.17'))

    step('a memory with month precision')
    await a.goto(`${base}/#/pages/memory/edit`)
    await a.locator(`.taro_page_show ${tid('precision-month')}`).click()
    await a.locator(`.taro_page_show ${tid('pick-start')}`).click()
    for (let i = 0; i < 7; i++) await a.locator(tid('year-prev')).click()
    await a.locator(tid('date-month-4')).click()
    await a.locator(tid('date-ok')).click()
    assert.equal((await a.locator(`.taro_page_show ${tid('pick-start')}`).innerText()).trim(), '2019.04')
    await fill(a, 'title', '那年春天')
    await a.locator(`.taro_page_show ${tid('save')}`).click()
    await a.waitForURL(/memory\/detail/)

    step('timeline: years, lit months, quiet months')
    await a.goto(`${base}/#/pages/timeline/index`)
    await a.locator(tid('year-2019')).waitFor()
    await a.locator(tid('year-2021')).click()
    await a.locator(`${tid('card-title')} >> text=Harbour`).waitFor()
    assert.ok((await a.locator(tid('month-7')).getAttribute('class'))!.includes('lit'))
    assert.ok(!(await a.locator(tid('month-8')).getAttribute('class'))!.includes('lit'))
    await shot(a, '08-timeline')
    await a.locator(tid('month-8')).click()
    await a.locator(tid('quiet-month')).waitFor()
    await a.locator(tid('year-2019')).click()
    await a.locator(`${tid('card-title')} >> text=那年春天`).waitFor()

    step('language switch')
    await a.locator(tid('open-settings')).click()
    await a.waitForURL(/pages\/settings/)
    await a.locator(tid('partner-joined')).waitFor()
    await a.locator(tid('lang-en')).click()
    await a.locator(`${tid('signout')} >> text=Sign out`).waitFor()
    await shot(a, '09-settings-en')
    await a.locator(tid('lang-zh')).click()
    await a.locator(`${tid('signout')} >> text=退出登录`).waitFor()

    // ---- bulk import on a desktop ----
    step('desktop bulk import: grouping by day and distance')
    const ctxD = await browser.newContext({ ...DESKTOP, storageState: await ctxB.storageState() })
    const d = await ctxD.newPage()
    watch(d)
    await d.goto(`${base}/#/pages/import/index`)
    await choose(d, tid('import-select'), ['lake-1.jpg', 'lake-2.jpg', 'city-1.jpg', 'harbour-1.jpg', 'screenshot.jpg'].map(file))
    await d.locator(tid('import-summary')).waitFor()
    // 2021-07-15, 2022-10-02 (lake), 2022-10-02 (city, far away), and one group without a date
    assert.equal(await d.locator(tid('import-group')).count(), 4)
    const counts = await d.locator(tid('group-count')).allInnerTexts()
    assert.deepEqual(counts.map((s) => parseInt(s, 10)), [1, 2, 1, 1])
    await shot(d, '10-import-review')
    assert.ok((await d.locator(tid('import-start')).getAttribute('class'))!.includes('disabled'))
    // The same-day group that is far away is merged back; the undated group is skipped.
    await d.locator(tid('group-merge')).nth(1).click()
    assert.equal(await d.locator(tid('import-group')).count(), 3)
    await d.locator(tid('group-skip')).nth(2).click()
    await d.locator('.taro_page_show .title-input input').nth(1).fill('West Lake weekend')
    await d.locator(tid('import-start')).click()
    await d.locator(tid('import-result')).waitFor({ timeout: 30000 })
    assert.match(await d.locator(tid('import-result')).innerText(), /2 memories, 4 photos/)
    await d.locator(tid('import-open-timeline')).click()
    await d.locator(`${tid('card-title')} >> text=West Lake weekend`).waitFor()
    await shot(d, '11-timeline-desktop')

    // ---- trash ----
    step('delete and restore')
    await d.locator(`${tid('card-title')} >> text=West Lake weekend`).click()
    await d.waitForURL(/memory\/detail/)
    await d.locator(`.taro_page_show ${tid('delete-memory')}`).click()
    await d.locator(tid('confirm-ok')).click()
    await d.waitForURL(/pages\/timeline/)
    await d.goto(`${base}/#/pages/trash/index`)
    await d.locator(tid('restore-memory')).click()
    await d.locator(tid('trash-empty')).waitFor()

    // ---- export ----
    step('export archive')
    const res = await ctxD.request.get(`${base}/api/export`)
    assert.equal(res.status(), 200)
    const zip = unzipSync(new Uint8Array(await res.body()))
    const names = Object.keys(zip)
    const data = JSON.parse(strFromU8(zip['data.json']))
    assert.equal(data.memories.length, 4)
    assert.deepEqual(data.memories.map((m: { title: string }) => m.title), ['那年春天', '港口的下午 (Harbour)', '2021.07.15', 'West Lake weekend'])
    assert.equal(names.filter((n) => /^\d{4}\/\d{2}\//.test(n)).length, 7)
    assert.ok(names.includes('index.html'))
    const lake = data.memories[3].photos[0]
    assert.ok(Buffer.from(zip[lake.file]).equals(fs.readFileSync(file('lake-1.jpg'))), 'exported original is byte-identical')
    assert.ok(Math.abs(lake.latitude - 30.2431) < 0.001)
    // The offline page opens from disk and lists every memory.
    const exportDir = path.join(work, 'export')
    for (const [name, bytes] of Object.entries(zip)) {
      fs.mkdirSync(path.dirname(path.join(exportDir, name)), { recursive: true })
      fs.writeFileSync(path.join(exportDir, name), bytes)
    }
    const offline = await ctxD.newPage()
    await offline.goto(`file://${path.join(exportDir, 'index.html')}`)
    assert.equal(await offline.locator('article').count(), 4)
    assert.ok(await offline.locator('article img').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    await shot(offline, '12-export-offline-page')

    // ---- validation pages ----
    assert.ok(!loadedByA.some((u) => /maplib/.test(u)), 'the map library is not loaded by the main pages')

    step('validation page a: photo metadata')
    await a.goto(`${base}/#/pages/lab/exif`)
    await choose(a, tid('lab-select'), [file('harbour-1.jpg'), file('screenshot.jpg')])
    await a.locator(tid('lab-result')).waitFor()
    assert.match(await a.locator(tid('lab-result')).innerText(), /2 张中 1 张有拍摄时间，1 张有坐标/)
    await shot(a, '13-lab-exif')

    step('validation page c: pixel rendering')
    await a.goto(`${base}/#/pages/lab/pixel`)
    await a.locator(tid('sprite-4')).waitFor()
    await shot(a, '14-lab-pixel')

    step('validation page b: map with tiles served by the server')
    const requested: string[] = []
    a.on('request', (r) => requested.push(r.url()))
    await a.goto(`${base}/#/pages/lab/map`)
    await a.locator(tid('map-load-time')).waitFor({ timeout: 20000 })
    assert.equal(await a.locator('.pixel-marker').count(), 2)
    /** Colour of the map canvas at a geographic position, read from a screenshot. */
    const colourAt = async (dx: number, dy: number) => {
      const box = (await a.locator(tid('map')).boundingBox())!
      const x = Math.round(box.x + box.width / 2 + dx)
      const y = Math.round(box.y + box.height / 2 + dy)
      const png = await a.screenshot({ clip: { x, y, width: 2, height: 2 } })
      const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
      return [data[0], data[1], data[2]]
    }
    const near = (c: number[], hex: string) =>
      [1, 3, 5].every((i, k) => Math.abs(c[k] - parseInt(hex.slice(i, i + 2), 16)) <= 6)
    assert.ok(near(await colourAt(0, 0), '#d9c9a3'), 'plain background without tiles')
    await a.locator('.taro_page_show .px-input input').fill('/tiles/sample.pmtiles')
    await a.locator(tid('map-load')).click()
    await a.locator(tid('map-load-time')).waitFor({ timeout: 20000 })
    await a.waitForTimeout(500)
    assert.ok(requested.some((u) => u.endsWith('/tiles/sample.pmtiles')), 'tiles are requested from the server')
    // The view is centred on land at zoom 7; the far corner of the view is still land.
    assert.ok(near(await colourAt(0, 0), '#e9d8a6'), 'land is drawn from the tile file')
    await shot(a, '15-lab-map')
    await a.locator(tid('map-lowres')).click()
    await a.locator(tid('map-load-time')).waitFor({ timeout: 20000 })
    await a.waitForTimeout(500)
    assert.ok(near(await colourAt(0, 0), '#e9d8a6'), 'land is drawn at reduced resolution')
    await shot(a, '16-lab-map-lowres')

    step('sign out')
    await a.goto(`${base}/#/pages/settings/index`)
    await a.locator(tid('signout')).click()
    await a.waitForURL(/pages\/signin/)
    assert.equal((await ctxA.request.get(`${base}/api/timeline/summary`)).status(), 401)
    await fill(a, 'username', 'xiaoman')
    await fill(a, 'password', 'wrong password')
    await a.locator(tid('submit')).click()
    await a.locator(tid('form-error')).waitFor()
    await fill(a, 'password', 'correct horse')
    await a.locator(tid('submit')).click()
    await a.waitForURL(/pages\/timeline/)

    assert.deepEqual(errors, [], 'no uncaught errors in the pages')
    console.log(`\nAll end-to-end checks passed. Screenshots: ${out}`)
  } finally {
    await browser.close()
    try {
      process.kill(-server.pid!)
    } catch {
      /* already stopped */
    }
    fs.rmSync(work, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
