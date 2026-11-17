import { haversineKm } from './grouping'

/** A new memory within this distance of a saved Place is offered that Place. */
export const PLACE_SUGGEST_METERS = 100

/** Landmark icons available for Places. The art for each key is in the client's asset manifest. */
export const PLACE_ICON_KEYS = ['pin', 'home', 'food', 'park', 'mountain', 'water', 'city', 'station'] as const
export type PlaceIconKey = (typeof PLACE_ICON_KEYS)[number]

/** A position in WGS-84. */
export interface LatLon {
  latitude: number
  longitude: number
}

export function isLatLon(v: { latitude: number | null; longitude: number | null }): v is LatLon {
  return (
    typeof v.latitude === 'number' && typeof v.longitude === 'number' &&
    Number.isFinite(v.latitude) && Number.isFinite(v.longitude) &&
    Math.abs(v.latitude) <= 90 && Math.abs(v.longitude) <= 180
  )
}

export function distanceMeters(a: LatLon, b: LatLon): number {
  return haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000
}

/** Places within `maxMeters` of `point`, nearest first, each with its distance in metres. */
export function nearbyPlaces<T extends LatLon>(
  places: T[],
  point: LatLon,
  maxMeters: number = PLACE_SUGGEST_METERS,
): (T & { distance: number })[] {
  return places
    .map((p) => ({ ...p, distance: distanceMeters(p, point) }))
    .filter((p) => p.distance <= maxMeters)
    .sort((a, b) => a.distance - b.distance)
}

/**
 * The mean position of the points that have coordinates, or null when none
 * has. Suitable for the small areas covered by one memory or one import group.
 */
export function centroid(points: { latitude: number | null; longitude: number | null }[]): LatLon | null {
  const located = points.filter(isLatLon)
  if (!located.length) return null
  return {
    latitude: located.reduce((s, p) => s + p.latitude, 0) / located.length,
    longitude: located.reduce((s, p) => s + p.longitude, 0) / located.length,
  }
}

// ---- grouping of map markers at low zoom levels ----

const TILE_SIZE = 256
const MAX_LAT = 85.05112878

/** Position in Web Mercator pixels at the given zoom level (the projection used by the map). */
export function projectToPixels(p: LatLon, zoom: number): { x: number; y: number } {
  const size = TILE_SIZE * 2 ** zoom
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, p.latitude)) * (Math.PI / 180)
  return {
    x: ((p.longitude + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * size,
  }
}

export interface MarkerCluster<T> extends LatLon {
  items: T[]
}

/**
 * Groups points whose markers would overlap on screen at `zoom`.
 *
 * Points are taken in the given order; each point not yet assigned starts a
 * cluster and collects every unassigned point within `radiusPx` screen
 * pixels of it. The cluster position is the mean of its members. The result
 * depends only on the input order, so markers do not jump between renders.
 */
export function clusterPoints<T extends LatLon>(points: T[], zoom: number, radiusPx = 40): MarkerCluster<T>[] {
  const projected = points.map((p) => ({ item: p, ...projectToPixels(p, zoom) }))
  const used = new Array<boolean>(points.length).fill(false)
  const clusters: MarkerCluster<T>[] = []
  for (let i = 0; i < projected.length; i++) {
    if (used[i]) continue
    used[i] = true
    const seed = projected[i]
    const members = [seed.item]
    for (let j = i + 1; j < projected.length; j++) {
      if (used[j]) continue
      if (Math.hypot(projected[j].x - seed.x, projected[j].y - seed.y) <= radiusPx) {
        used[j] = true
        members.push(projected[j].item)
      }
    }
    clusters.push({ ...centroid(members)!, items: members })
  }
  return clusters
}
