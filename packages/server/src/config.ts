import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export interface Config {
  port: number
  host: string
  /** Holds the database and all photo files. */
  dataDir: string
  /** Built client served by the server in production; skipped when absent. */
  clientDist: string
  /** Sends the session cookie only over HTTPS. Enable behind HTTPS. */
  cookieSecure: boolean
  /** When set, creating the first account requires this value. */
  setupToken: string | null
  maxUploadBytes: number
  /**
   * File name of the map tile file in `DATA_DIR/tiles/`. When null, the first
   * `.pmtiles` file found there is used.
   */
  mapTiles: string | null
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '0.0.0.0',
    dataDir: path.resolve(env.DATA_DIR ?? path.join(here, '..', 'data')),
    clientDist: path.resolve(env.CLIENT_DIST ?? path.join(here, '..', '..', 'client', 'dist')),
    cookieSecure: env.COOKIE_SECURE === '1' || env.COOKIE_SECURE === 'true',
    setupToken: env.SETUP_TOKEN || null,
    maxUploadBytes: Number(env.MAX_UPLOAD_MB ?? 60) * 1024 * 1024,
    mapTiles: env.MAP_TILES || null,
  }
}
