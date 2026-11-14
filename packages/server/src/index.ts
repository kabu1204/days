import path from 'node:path'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadConfig } from './config'
import { openDb } from './db/index'
import { schedulePurge } from './purge'

const config = loadConfig()
const db = openDb(path.join(config.dataDir, 'days.sqlite'))
const app = createApp(db, config)
schedulePurge(db, path.join(config.dataDir, 'files'))

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`days server listening on http://${info.address}:${info.port}`)
  console.log(`data directory: ${config.dataDir}`)
})
