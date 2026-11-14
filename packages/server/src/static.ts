import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import type { Context } from 'hono'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.pmtiles': 'application/octet-stream',
  '.map': 'application/json; charset=utf-8',
}

/** Serves the built client. Unknown paths receive `index.html`. */
export function serveClient(root: string) {
  return async (c: Context) => {
    let rel: string
    try {
      rel = decodeURIComponent(c.req.path)
    } catch {
      return c.text('Bad request', 400)
    }
    let file = path.join(root, rel)
    // Requests must stay inside the client directory.
    if (file !== root && !file.startsWith(root + path.sep)) return c.text('Not found', 404)
    let stat = await fs.stat(file).catch(() => null)
    if (!stat || stat.isDirectory()) {
      if (path.extname(rel)) return c.text('Not found', 404)
      file = path.join(root, 'index.html')
      stat = await fs.stat(file).catch(() => null)
      if (!stat) return c.text('The client has not been built. Run "pnpm build".', 404)
    }
    const ext = path.extname(file).toLowerCase()
    const hashed = /[.-][0-9a-f]{8,}\./i.test(path.basename(file))
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'Content-Length': String(stat.size),
        'Cache-Control': ext === '.html' ? 'no-cache' : hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      },
    })
  }
}
