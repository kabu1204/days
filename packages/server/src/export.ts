import path from 'node:path'
import archiver from 'archiver'
import type { Db } from './db/index'
import type { MemberRow } from './auth'
import { photosByMemory, type CommentRow, type KeyDateRow, type MemoryRow, type PlaceRow, type StickerRow } from './store'

export interface ExportData {
  exportedAt: string
  members: { id: number; displayName: string }[]
  places: { id: number; name: string; city: string; icon: string; latitude: number; longitude: number }[]
  keyDates: { label: string; date: string }[]
  memories: {
    id: number
    title: string
    note: string
    startDate: string
    endDate: string | null
    datePrecision: string
    category: string
    placeId: number | null
    placeName: string | null
    createdBy: number
    createdAt: string
    comments: { authorId: number; text: string; createdAt: string }[]
    stickers: { key: string; placedBy: number; x: number | null; y: number | null }[]
    photos: {
      file: string
      thumb: string
      originalName: string
      takenAt: string | null
      latitude: number | null
      longitude: number | null
      uploadedBy: number
    }[]
  }[]
}

/** Collects everything that is not deleted, with archive paths for each photo. */
export function buildExportData(db: Db): { data: ExportData; files: { source: string; name: string }[] } {
  const members = db.prepare('SELECT * FROM member ORDER BY slot').all() as MemberRow[]
  const rows = db
    .prepare('SELECT * FROM memory WHERE deleted_at IS NULL ORDER BY start_date, id')
    .all() as MemoryRow[]
  const photos = photosByMemory(db, rows.map((r) => r.id))
  const places = db.prepare('SELECT * FROM place ORDER BY name, id').all() as PlaceRow[]
  const placeName = new Map(places.map((p) => [p.id, p.name]))
  const comments = db
    .prepare(
      `SELECT c.* FROM comment c JOIN memory m ON m.id = c.memory_id
       WHERE c.deleted_at IS NULL AND m.deleted_at IS NULL ORDER BY c.created_at, c.id`,
    )
    .all() as CommentRow[]
  const stickers = db.prepare('SELECT * FROM sticker ORDER BY id').all() as StickerRow[]
  const keyDates = db.prepare('SELECT * FROM key_date ORDER BY date, id').all() as KeyDateRow[]
  const files: { source: string; name: string }[] = []

  const memories = rows.map((m) => {
    const folder = `${m.start_date.slice(0, 4)}/${m.start_date.slice(5, 7)}`
    return {
      id: m.id,
      title: m.title,
      note: m.note,
      startDate: m.start_date,
      endDate: m.end_date,
      datePrecision: m.date_precision,
      category: m.category,
      placeId: m.place_id,
      placeName: m.place_id === null ? null : placeName.get(m.place_id) ?? null,
      createdBy: m.created_by,
      createdAt: m.created_at,
      comments: comments.filter((k) => k.memory_id === m.id).map((k) => ({ authorId: k.author_id, text: k.text, createdAt: k.created_at })),
      stickers: stickers.filter((k) => k.memory_id === m.id).map((k) => ({ key: k.sticker_key, placedBy: k.placed_by, x: k.x, y: k.y })),
      photos: (photos.get(m.id) ?? []).map((p, i) => {
        const ext = path.extname(p.original_path)
        const file = `${folder}/${m.start_date}_m${m.id}_${String(i + 1).padStart(3, '0')}${ext}`
        const thumb = `page-files/thumb/${p.id}.jpg`
        files.push({ source: p.original_path, name: file }, { source: p.thumb_path, name: thumb })
        return {
          file,
          thumb,
          originalName: p.original_name,
          takenAt: p.taken_at,
          latitude: p.latitude,
          longitude: p.longitude,
          uploadedBy: p.uploaded_by,
        }
      }),
    }
  })

  return {
    data: {
      exportedAt: new Date().toISOString(),
      members: members.map((m) => ({ id: m.id, displayName: m.display_name })),
      places: places.map((p) => ({ id: p.id, name: p.name, city: p.city, icon: p.icon, latitude: p.latitude, longitude: p.longitude })),
      keyDates: keyDates.map((k) => ({ label: k.label, date: k.date })),
      memories,
    },
    files,
  }
}

/**
 * Creates the ZIP archive as a stream: originals in `YYYY/MM/`, `data.json`
 * with all text, and `index.html` for browsing without the service.
 */
export function createExportArchive(db: Db, filesDir: string): archiver.Archiver {
  const { data, files } = buildExportData(db)
  // Photos are already compressed; storing them keeps the export fast.
  const zip = archiver('zip', { store: true })
  zip.append(JSON.stringify(data, null, 2), { name: 'data.json' })
  zip.append(offlinePage(data), { name: 'index.html' })
  for (const f of files) zip.file(path.join(filesDir, f.source), { name: f.name })
  void zip.finalize()
  return zip
}

/** A single self-contained page. The data is embedded so that it opens from disk. */
export function offlinePage(data: ExportData): string {
  // "<" is escaped so that no text in the data can end the script element.
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Days</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f4ecd8; color: #2b2233; }
  header { padding: 16px; border-bottom: 4px solid #2b2233; background: #e9d8a6; }
  h1 { margin: 0; font-size: 20px; }
  main { max-width: 960px; margin: 0 auto; padding: 16px; }
  h2 { margin: 32px 0 8px; font-size: 22px; border-bottom: 4px solid #2b2233; }
  h3 { margin: 20px 0 8px; font-size: 16px; color: #7a4e2d; }
  article { margin: 0 0 16px; padding: 12px; background: #fffaf0; border: 3px solid #2b2233; box-shadow: 4px 4px 0 #2b2233; }
  article h4 { margin: 0 0 4px; font-size: 16px; }
  .meta { font-size: 12px; color: #6b5b73; }
  .note { white-space: pre-wrap; margin: 8px 0; }
  .photos { display: flex; flex-wrap: wrap; gap: 6px; }
  .photos img { width: 120px; height: 120px; object-fit: cover; border: 2px solid #2b2233; background: #ddd; }
  .comment { margin: 8px 0 0; padding: 6px 10px; background: #2b2233; color: #fffaf0; white-space: pre-wrap; }
  .comment b { color: #e0a43a; font-weight: normal; }
</style>
</head>
<body>
<header><h1>Days</h1><div class="meta" id="info"></div></header>
<main id="main"></main>
<script>window.DAYS_EXPORT = ${json};</script>
<script>
(function () {
  var data = window.DAYS_EXPORT;
  var names = {};
  data.members.forEach(function (m) { names[m.id] = m.displayName; });
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  document.getElementById('info').textContent =
    data.memories.length + ' memories · exported ' + data.exportedAt.slice(0, 10);
  var main = document.getElementById('main');
  var year = '', month = '';
  data.memories.forEach(function (m) {
    var y = m.startDate.slice(0, 4), mo = m.startDate.slice(0, 7);
    if (y !== year) { year = y; main.appendChild(el('h2', '', y)); }
    if (mo !== month) { month = mo; main.appendChild(el('h3', '', mo)); }
    var a = el('article');
    a.appendChild(el('h4', '', m.title));
    var date = m.datePrecision === 'month' ? m.startDate.slice(0, 7) : m.startDate;
    if (m.endDate) date += ' – ' + m.endDate;
    var meta = [date, m.category];
    if (m.placeName) meta.push('@ ' + m.placeName);
    meta.push(names[m.createdBy] || '');
    a.appendChild(el('div', 'meta', meta.join(' · ')));
    if (m.note) a.appendChild(el('div', 'note', m.note));
    var box = el('div', 'photos');
    m.photos.forEach(function (p) {
      var link = el('a');
      link.href = p.file;
      link.target = '_blank';
      var img = el('img');
      img.loading = 'lazy';
      img.src = p.thumb;
      img.alt = p.originalName;
      link.appendChild(img);
      box.appendChild(link);
    });
    a.appendChild(box);
    m.comments.forEach(function (k) {
      var line = el('div', 'comment');
      line.appendChild(el('b', '', (names[k.authorId] || '') + ': '));
      line.appendChild(document.createTextNode(k.text));
      a.appendChild(line);
    });
    main.appendChild(a);
  });
})();
</script>
</body>
</html>
`
}
