/**
 * End-to-end check of Phases 0, 1, and 2 against the built client.
 *
 *   pnpm build && pnpm e2e
 *
 * Starts the server on a temporary data directory, then drives a browser
 * through setup, invitation, memory creation, timeline, viewer, language
 * switch, bulk import, trash, export, Places, and the map. Screenshots are written to
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
    // The photos have coordinates and no Place exists yet: a new Place is offered.
    await a.locator(`.taro_page_show ${tid('place-suggest-new')}`).click()
    await fill(a, 'placeName', '外滩')
    await fill(a, 'placeCity', '上海')
    await a.locator(tid('place-icon-water')).click()
    await shot(a, '04a-new-place')
    await a.locator(tid('place-create')).click()
    assert.equal((await a.locator(`.taro_page_show ${tid('chosen-place')}`).innerText()).trim(), '外滩')
    await shot(a, '04-edit')
    await a.locator(`.taro_page_show ${tid('save')}`).click()
    await a.waitForURL(/memory\/detail/)
    assert.equal((await a.locator(`.taro_page_show ${tid('memory-place')}`).innerText()).trim(), '外滩')
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
    // Groups within 100 m of the saved Place are offered it.
    assert.deepEqual((await d.locator(tid('group-place')).allInnerTexts()).map((s) => s.trim()), ['外滩', 'No place', '外滩', 'No place'])
    // The lake group receives a new Place, named during the review.
    await d.locator(tid('group-place')).nth(1).click()
    await d.locator(tid('place-new-at-photos')).click()
    await fill(d, 'placeName', 'West Lake')
    await d.locator(tid('place-create')).click()
    await shot(d, '10-import-review')
    assert.ok((await d.locator(tid('import-start')).getAttribute('class'))!.includes('disabled'))
    // The same-day group that is far away is merged back; the undated group is skipped.
    await d.locator(tid('group-merge')).nth(1).click()
    assert.equal(await d.locator(tid('import-group')).count(), 3)
    assert.equal((await d.locator(tid('group-place')).nth(1).innerText()).trim(), 'West Lake')
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
    assert.deepEqual(data.places.map((p: { name: string }) => p.name), ['West Lake', '外滩'])
    assert.deepEqual(data.memories.map((m: { placeName: string | null }) => m.placeName), [null, '外滩', '外滩', 'West Lake'])
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

    // ---- Places and the map ----
    step('location tag to the map; the selected memory is kept')
    await a.goto(`${base}/#/pages/timeline/index`)
    await a.locator(tid('year-2021')).click()
    await a.locator(`${tid('card-title')} >> text=Harbour`).click()
    await a.waitForURL(/memory\/detail/)
    await a.locator(`.taro_page_show ${tid('memory-place')}`).click()
    await a.waitForURL(/pages\/map/)
    await a.locator(tid('map-place-name')).waitFor({ timeout: 20000 })
    assert.equal((await a.locator(tid('map-place-name')).innerText()).trim(), '外滩')
    // All memories at the Place, oldest first; the one we came from is selected.
    await a.locator(`.taro_page_show ${tid('place-memory-title')} >> nth=1`).waitFor()
    assert.deepEqual(await a.locator(`.taro_page_show ${tid('place-memory-title')}`).allInnerTexts(), ['港口的下午 (Harbour)', '2021.07.15'])
    assert.ok((await a.locator(`.taro_page_show ${tid('place-memory')}`).first().getAttribute('class'))!.includes('selected'))
    // The markers are drawn once the map has loaded.
    await a.locator('.taro_page_show .pixel-marker.selected').first().waitFor({ timeout: 20000 })
    assert.ok(await a.locator('.taro_page_show .pixel-marker.selected').count() === 1)
    await shot(a, '17-map-place')
    assert.equal(await a.evaluate(() => window.scrollX), 0, 'the page is not scrolled sideways')

    step('map memory to its month on the timeline, and back')
    await a.locator(`.taro_page_show ${tid('to-timeline')}`).nth(1).click()
    await a.waitForURL(/pages\/timeline/)
    await a.locator('.taro_page_show .card.selected').waitFor()
    assert.match(await a.locator('.taro_page_show .card.selected').innerText(), /2021\.07\.15 · 外滩/)
    await shot(a, '18-timeline-selected')
    assert.equal(await a.evaluate(() => window.scrollX), 0, 'the page is not scrolled sideways')
    await a.locator(`.taro_page_show ${tid('open-map')}`).click()
    await a.waitForURL(/pages\/map/)
    await a.locator(`.taro_page_show ${tid('place-memory')}.selected`).waitFor({ timeout: 20000 })
    assert.equal((await a.locator(`.taro_page_show ${tid('place-memory')}.selected`).innerText()).split('\n')[0].trim(), '2021.07.15')

    step('Places: separate, merge, rename')
    await a.locator(`.taro_page_show ${tid('open-place')}`).click()
    await a.waitForURL(/pages\/place\//)
    await a.locator(`${tid('place-count')} >> visible=true >> text=2 条记忆`).waitFor()
    await a.locator(`.taro_page_show ${tid('place-split')}`).click()
    await a.locator(`${tid('place-memory')} >> visible=true`).nth(1).click()
    assert.equal((await a.locator(`.taro_page_show ${tid('selected-count')}`).innerText()).trim(), '已选 1 条')
    await a.locator(`.taro_page_show ${tid('split-confirm')}`).click()
    await fill(a, 'splitName', '外滩码头')
    await a.locator(tid('split-save')).click()
    await a.locator(`.taro_page_show .topbar >> text=外滩码头`).waitFor()
    await a.locator(`${tid('place-count')} >> visible=true >> text=1 条记忆`).waitFor()
    await a.locator(`.taro_page_show ${tid('place-merge')}`).click()
    await a.locator(`${tid('merge-target')} >> text=外滩`).first().click()
    await a.locator(tid('confirm-ok')).click()
    await a.locator(`${tid('place-count')} >> visible=true >> text=2 条记忆`).waitFor()
    await a.locator(`.taro_page_show ${tid('edit-place')}`).click()
    await fill(a, 'placeName', '外滩 The Bund')
    await a.locator(tid('place-save')).click()
    await a.locator(`.taro_page_show .topbar >> text=外滩 The Bund`).waitFor()
    await shot(a, '19-place')
    const placeList = await ctxA.request.get(`${base}/api/places`)
    assert.deepEqual(((await placeList.json()).places as { name: string; memoryCount: number }[]).map((p) => [p.name, p.memoryCount]), [
      ['West Lake', 1],
      ['外滩 The Bund', 2],
    ])

    step('a saved Place is offered to a new memory with photos nearby')
    await a.goto(`${base}/#/pages/memory/edit`)
    await choose(a, tid('add-photos'), [file('city-1.jpg')])
    await a.locator(`.taro_page_show ${tid('place-suggest-use')}`).click()
    assert.equal((await a.locator(`.taro_page_show ${tid('chosen-place')}`).innerText()).trim(), '外滩 The Bund')
    await fill(a, 'title', '夜景')
    await a.locator(`.taro_page_show ${tid('save')}`).click()
    await a.waitForURL(/memory\/detail/)
    assert.equal((await a.locator(`.taro_page_show ${tid('memory-place')}`).innerText()).trim(), '外滩 The Bund')

    step('map view of all Places, grouped when zoomed out')
    await a.goto(`${base}/#/pages/places/index`)
    await a.reload() // starts a new page stack
    await a.locator(`${tid('open-map')} >> visible=true`).click()
    await a.waitForURL(/pages\/map/)
    // Without a selection the view is fitted to both Places, which are drawn apart.
    await a.locator('.pixel-marker >> nth=1').waitFor({ timeout: 20000 })
    assert.equal(await a.locator('.pixel-marker').count(), 2)
    await shot(a, '20-map-all')
    // The two Places are 165 km apart; zoomed out, they share one numbered marker.
    for (let i = 0; i < 9; i++) {
      await a.locator('.maplibregl-ctrl-zoom-out >> visible=true').click()
      await a.waitForTimeout(150)
    }
    await a.locator('[data-testid="map-cluster"] >> visible=true').waitFor({ timeout: 10000 })
    assert.equal((await a.locator('[data-testid="map-cluster"] >> visible=true').innerText()).trim(), '2')
    await shot(a, '21-map-grouped')

    // ---- co-creation ----
    step('the partner comments, reacts, and decorates the cover')
    await b.goto(`${base}/#/pages/timeline/index`)
    await b.reload()
    await b.locator(tid('year-2021')).click()
    await b.locator(`${tid('card-title')} >> text=Harbour`).click()
    await b.waitForURL(/memory\/detail/)
    await fill(b, 'comment', 'What a windy day.')
    await b.locator(`.taro_page_show ${tid('comment-send')}`).click()
    await b.locator(`.taro_page_show ${tid('comment-text')} >> text=What a windy day.`).waitFor()
    await b.locator(`.taro_page_show ${tid('reaction-heart')}`).click()
    await b.locator(`.taro_page_show ${tid('reaction-heart')}.mine`).waitFor()
    await b.locator(`.taro_page_show ${tid('decorate')}`).click()
    await b.locator(`.taro_page_show ${tid('tray-flower')}`).click()
    await b.locator(`.taro_page_show ${tid('detail-cover')}`).click({ position: { x: 60, y: 50 } })
    await b.locator(`.taro_page_show ${tid('decor-flower')}`).waitFor()
    await b.locator(`.taro_page_show ${tid('tray-mochi-star')}`).click()
    await b.locator(`.taro_page_show ${tid('detail-cover')}`).click({ position: { x: 150, y: 70 } })
    await b.locator(`.taro_page_show ${tid('decor-mochi-star')}`).waitFor()
    await shot(b, '22-detail-decorating')
    await b.locator(`.taro_page_show ${tid('decorate')}`).click()
    // Uploader portraits appear because both members added photos.
    assert.equal(await b.locator(`.taro_page_show ${tid('photo-uploader')}`).count(), 3)

    step('quiet markers, the party on the timeline, and the conversation')
    await a.goto(`${base}/#/pages/timeline/index`)
    await a.reload()
    await a.locator(tid('year-2021')).click()
    await a.locator(`${tid('card-title')} >> text=Harbour`).waitFor()
    await a.locator(`.taro_page_show ${tid('month-new-7')}`).waitFor()
    await a.locator(`.taro_page_show ${tid('year-new-2021')}`).waitFor()
    await a.locator(`.taro_page_show .card ${tid('new-mark')}`).first().waitFor()
    await a.locator(`.taro_page_show .card ${tid('decor-flower')}`).waitFor()
    assert.match(await a.locator(`.taro_page_show ${tid('comment-count')}`).first().innerText(), /1/)
    assert.equal(await a.locator('.taro_page_show .party .actor').count(), 3)
    const partyX = () => a.locator('.taro_page_show .party').evaluate((el) => (el as HTMLElement).style.transform)
    await a.waitForTimeout(700)
    const before = await partyX()
    await shot(a, '23-timeline-party')
    await a.locator(tid('month-12')).click()
    await a.waitForTimeout(700)
    const after = await partyX()
    assert.notEqual(before, after, 'the party walks to the selected month')
    await a.locator(tid('month-7')).click()
    await a.locator(`${tid('card-title')} >> text=Harbour`).click()
    await a.waitForURL(/memory\/detail/)
    await a.locator(`.taro_page_show ${tid('comment')} ${tid('new-mark')}`).waitFor()
    await fill(a, 'comment', '帽子差点飞走。')
    await a.locator(`.taro_page_show ${tid('comment-send')}`).click()
    await a.locator(`.taro_page_show ${tid('comment-text')} >> text=帽子差点飞走。`).waitFor()
    await a.locator(`.taro_page_show ${tid('reaction-laugh')}`).click()
    await a.locator(`.taro_page_show ${tid('reaction-laugh')}.mine`).waitFor()
    await shot(a, '24-detail-conversation')
    // Only the author can delete a line; it goes to the trash.
    assert.equal(await a.locator(`.taro_page_show ${tid('comment-delete')}`).count(), 1)
    await a.locator(`.taro_page_show ${tid('comment-delete')}`).click()
    await a.locator(tid('confirm-ok')).click()
    await a.waitForFunction(() => document.querySelectorAll('.taro_page_show [data-testid="comment"]').length === 1)
    await a.goto(`${base}/#/pages/trash/index`)
    await a.locator(`${tid('trash-comment')} >> text=帽子差点飞走。`).waitFor()
    await a.locator(tid('restore-comment')).click()
    await a.locator(tid('trash-comment')).waitFor({ state: 'detached' })
    // Once opened, the memory is no longer marked as new.
    await a.goto(`${base}/#/pages/timeline/index`)
    await a.reload()
    await a.locator(tid('year-2021')).click()
    await a.locator(`${tid('card-title')} >> text=Harbour`).waitFor()
    // (The other memory of that month was imported by the partner and stays marked.)
    const harbourCard = a.locator('.taro_page_show .card', { has: a.locator(`${tid('card-title')} >> text=Harbour`) })
    assert.equal(await harbourCard.locator(tid('new-mark')).count(), 0)
    assert.equal(await a.locator(`.taro_page_show .card ${tid('new-mark')}`).count(), 1)

    step('key dates and speech bubbles')
    await a.goto(`${base}/#/pages/settings/index`)
    await fill(a, 'keyDateLabel', '第一次见面')
    await a.locator(`.taro_page_show ${tid('key-date-date')}`).click()
    await a.locator(tid('year-prev')).click()
    await a.locator(tid('date-ok')).click()
    await a.locator(`.taro_page_show ${tid('key-date-add')}`).click()
    await a.locator(`.taro_page_show ${tid('key-date')} >> text=第一次见面`).waitFor()
    await a.goto(`${base}/#/pages/timeline/index`)
    await a.reload()
    const bubble = a.locator(`${tid('bubble')} >> visible=true`)
    await bubble.waitFor()
    assert.equal((await bubble.innerText()).trim(), '今天是第一次见面，已经 1 年了。')
    await shot(a, '25-timeline-bubble')
    // Tapping the party shows the next line.
    await a.locator('.taro_page_show .party').click()
    await a.locator('.taro_page_show .party').click()
    await bubble.waitFor()
    assert.notEqual((await bubble.innerText()).trim(), '今天是第一次见面，已经 1 年了。')

    step('the party stands at the selected Place on the map')
    const bund = ((await (await ctxA.request.get(`${base}/api/places`)).json()).places as { id: number; name: string }[]).find((p) => p.name === '外滩 The Bund')!
    await a.goto(`${base}/#/pages/map/index?place=${bund.id}`)
    await a.locator(`${tid('map-party')} >> visible=true`).waitFor({ timeout: 20000 })
    assert.equal(await a.locator(`${tid('map-party')} .actor`).count(), 3)
    await shot(a, '26-map-party')

    step('each member chooses a body and a headpiece')
    await a.goto(`${base}/#/pages/settings/index`)
    await a.locator(`.taro_page_show ${tid('body-cream')}.selected`).waitFor()
    await a.locator(`.taro_page_show ${tid('headpiece-rosette')}.selected`).waitFor()
    await a.locator(`.taro_page_show ${tid('body-sakura')}`).click()
    await a.locator(`.taro_page_show ${tid('body-sakura')}.selected`).waitFor()
    await a.locator(`.taro_page_show ${tid('headpiece-chef-hat')}`).click()
    await a.locator(`.taro_page_show ${tid('headpiece-chef-hat')}.selected`).waitFor()
    await shot(a, '27-settings-appearance')
    const members = ((await (await ctxA.request.get(`${base}/api/status`)).json()).members as { slot: number; spriteId: string; bodyId: string }[])
    assert.deepEqual(members.map((m) => [m.slot, m.bodyId, m.spriteId]).sort(), [[1, 'sakura', 'chef-hat'], [2, 'peach', 'top-hat']])
    await a.goto(`${base}/#/pages/timeline/index`)
    await a.locator('.taro_page_show .party .actor >> nth=0').waitFor()
    const layers = await a
      .locator('.taro_page_show .party .actor')
      .evaluateAll((els) => els.map((el) => ((el as HTMLElement).style.backgroundImage.match(/url\(/g) ?? []).length))
    assert.deepEqual(layers, [2, 2, 1], 'partners wear a headpiece over the body; the pet has one layer')
    await shot(a, '28-timeline-headpieces')

    step('treasure chest: a random memory, then another')
    await a.goto(`${base}/#/pages/timeline/index`)
    await a.reload()
    // Badges were unlocked along the way and are not yet seen.
    await a.locator(`.taro_page_show ${tid('album-new')}`).waitFor()
    await a.locator(`.taro_page_show ${tid('open-chest')}`).click()
    await a.locator(tid('chest-memory')).waitFor()
    const firstPick = await a.locator(tid('chest-title')).innerText()
    assert.ok((await a.locator(tid('chest-line')).innerText()).length > 0)
    await shot(a, '29-chest')
    await a.locator(tid('chest-another')).click()
    await a.waitForFunction(
      (prev) => {
        const el = document.querySelector('[data-testid="chest-title"]')
        return !!el && el.textContent !== prev
      },
      firstPick,
    )
    await a.locator(tid('chest-open-memory')).click()
    await a.waitForURL(/memory\/detail/)

    step('album: unlocked badges and the quiet marker')
    await a.goto(`${base}/#/pages/timeline/index`)
    await a.reload()
    await a.locator(`.taro_page_show ${tid('open-album')}`).click()
    await a.waitForURL(/album/)
    const earned = ((await (await ctxA.request.get(`${base}/api/badges`)).json()).badges as { key: string }[]).map((x) => x.key)
    for (const key of ['first-memory', 'both-hands', 'key-date']) assert.ok(earned.includes(key), `${key} is unlocked`)
    for (const key of earned) await a.locator(`.taro_page_show ${tid(`badge-${key}`)}`).waitFor()
    assert.equal(await a.locator(`.taro_page_show .badge-cell`).count(), earned.length)
    // Badges that are not yet earned are not shown at all.
    assert.equal(await a.locator(`.taro_page_show ${tid('badge-hundred-memories')}`).count(), 0)
    assert.ok((await a.locator(`.taro_page_show .badge-grid ${tid('new-mark')}`).count()) > 0)
    await shot(a, '30-album')
    await a.goto(`${base}/#/pages/timeline/index`)
    await a.reload()
    await a.locator(`.taro_page_show ${tid('open-album')}`).waitFor()
    assert.equal(await a.locator(`.taro_page_show ${tid('album-new')}`).count(), 0, 'the marker clears once the album is opened')
    // The partner has not opened the album yet.
    await b.goto(`${base}/#/pages/timeline/index`)
    await b.reload()
    await b.locator(`.taro_page_show ${tid('album-new')}`).waitFor()

    step('decision tools: the wish list, the food wheel, and a memory from a wish')
    await a.goto(`${base}/#/pages/decide/index`)
    await a.locator(`.taro_page_show ${tid('tab-food')}`).click()
    await a.locator(`.taro_page_show ${tid('decide-go')}.disabled`).waitFor()
    for (const food of ['火锅', '拉面', '小笼包']) {
      await fill(a, 'wish', food)
      await a.locator(`.taro_page_show ${tid('wish-add')}`).click()
      await a.locator(`.taro_page_show ${tid('wish-text')} >> text=${food}`).waitFor()
    }
    await a.locator(`.taro_page_show ${tid('wish-remove')} >> nth=2`).click()
    await a.locator(`.taro_page_show ${tid('wish-text')} >> text=小笼包`).waitFor({ state: 'detached' })
    await a.locator(`.taro_page_show ${tid('decide-go')}`).click()
    const result = a.locator(`.taro_page_show ${tid('decide-result')}`)
    await result.waitFor({ timeout: 10000 })
    const resultText = await result.innerText()
    const food = ['火锅', '拉面'].find((f) => resultText.includes(f))!
    assert.ok(food, `the wheel lands on a wish: ${resultText}`)
    // The labels turn with the wheel but stay upright.
    const tilts = await a.locator(`.taro_page_show .wheel-label`).evaluateAll((els) =>
      els.map((el) => {
        const wheel = new DOMMatrix(getComputedStyle(el.parentElement!).transform)
        const m = wheel.multiply(new DOMMatrix(getComputedStyle(el).transform))
        return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI)
      }),
    )
    assert.deepEqual(tilts.map((d) => Math.abs(d) % 360), [0, 0], `the wheel labels are upright: ${tilts}`)
    await shot(a, '31-decide-wheel')
    await a.locator(`.taro_page_show ${tid('make-memory')}`).click()
    await a.waitForURL(/memory\/edit/)
    assert.equal(await a.locator('.taro_page_show input[name="title"]').inputValue(), food)
    await a.locator(`.taro_page_show ${tid('category-food')}.selected`).waitFor()
    await a.locator(`.taro_page_show ${tid('save')}`).click()
    await a.waitForURL(/memory\/detail/)
    const wishes = (await (await ctxA.request.get(`${base}/api/wishes`)).json()).wishes as { text: string; doneMemoryId: number | null }[]
    assert.ok(wishes.find((w) => w.text === food)?.doneMemoryId, 'the wish is granted')
    const badges = (await (await ctxA.request.get(`${base}/api/badges`)).json()).badges as { key: string }[]
    assert.ok(badges.some((x) => x.key === 'wish-granted'), 'the wish-granted badge unlocks')
    await a.goto(`${base}/#/pages/decide/index`)
    await a.reload()
    await a.locator(`.taro_page_show ${tid('tab-food')}`).click()
    await a.locator(`.taro_page_show ${tid('wish-granted')} >> text=${food}`).waitFor()
    assert.equal(await a.locator(`.taro_page_show ${tid('wish-item')}`).count(), 1)

    step('decision tools: the destination card draw')
    await a.locator(`.taro_page_show ${tid('tab-destination')}`).click()
    for (const place of ['海边', '山里的温泉']) {
      await fill(a, 'wish', place)
      await a.locator(`.taro_page_show ${tid('wish-add')}`).click()
      await a.locator(`.taro_page_show ${tid('wish-text')} >> text=${place}`).waitFor()
    }
    await a.locator(`.taro_page_show ${tid('decide-go')}`).click()
    await a.locator(`.taro_page_show ${tid('decide-result')}`).waitFor({ timeout: 10000 })
    assert.match(await a.locator(`.taro_page_show ${tid('draw-card')}`).innerText(), /海边|山里的温泉/)
    await shot(a, '32-decide-draw')

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
