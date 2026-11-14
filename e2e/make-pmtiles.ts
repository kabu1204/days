/**
 * Writes a minimal PMTiles (version 3) file with a single tile at zoom 0, in
 * the Protomaps basemap layout (`earth` and `water` layers). It is used only
 * to check the map page end to end; real map data comes from a regional
 * extract (see the README).
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const geojsonvtModule = require('geojson-vt')
const geojsonvt = geojsonvtModule.GeoJSONVT ?? geojsonvtModule.default ?? geojsonvtModule
const vtpbf = require('vt-pbf')

function varint(n: number): number[] {
  const out: number[] = []
  while (n > 127) {
    out.push((n & 127) | 128)
    n = Math.floor(n / 128)
  }
  out.push(n)
  return out
}

const rect = (w: number, s: number, e: number, n: number) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: { type: 'Polygon' as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
})

export function writeSamplePmtiles(file: string): void {
  const layer = (features: unknown[]) =>
    new geojsonvt({ type: 'FeatureCollection', features }, { maxZoom: 0, extent: 4096, buffer: 64 }).getTile(0, 0, 0)
  // Land covering eastern China; a lake inside it.
  const tile = Buffer.from(
    vtpbf.fromGeojsonVt({ earth: layer([rect(100, 15, 135, 45)]), water: layer([rect(119.8, 30.9, 120.6, 31.5)]) }, { version: 2 }),
  )
  const metadata = Buffer.from(JSON.stringify({ vector_layers: [{ id: 'earth', fields: {} }, { id: 'water', fields: {} }] }))
  // Directory with one entry: tile id 0, run length 1, length, offset + 1.
  const directory = Buffer.from([...varint(1), ...varint(0), ...varint(1), ...varint(tile.length), ...varint(1)])

  const HEADER = 127
  const header = Buffer.alloc(HEADER)
  header.write('PMTiles', 0, 'latin1')
  header.writeUInt8(3, 7)
  const u64 = (value: number, at: number) => header.writeBigUInt64LE(BigInt(value), at)
  u64(HEADER, 8) // root directory offset
  u64(directory.length, 16)
  u64(HEADER + directory.length, 24) // metadata offset
  u64(metadata.length, 32)
  u64(0, 40) // leaf directories
  u64(0, 48)
  u64(HEADER + directory.length + metadata.length, 56) // tile data offset
  u64(tile.length, 64)
  u64(1, 72) // addressed tiles
  u64(1, 80) // tile entries
  u64(1, 88) // tile contents
  header.writeUInt8(1, 96) // clustered
  header.writeUInt8(1, 97) // internal compression: none
  header.writeUInt8(1, 98) // tile compression: none
  header.writeUInt8(1, 99) // tile type: vector (MVT)
  header.writeUInt8(0, 100) // minimum zoom
  header.writeUInt8(0, 101) // maximum zoom
  header.writeInt32LE(-180e7, 102)
  header.writeInt32LE(-85e7, 106)
  header.writeInt32LE(180e7, 110)
  header.writeInt32LE(85e7, 114)
  header.writeUInt8(0, 118)
  header.writeInt32LE(120e7, 119)
  header.writeInt32LE(31e7, 123)

  fs.writeFileSync(file, Buffer.concat([header, directory, metadata, tile]))
}
