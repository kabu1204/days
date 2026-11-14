/** Consecutive photos of one day farther apart than this start a new group. */
export const GROUP_DISTANCE_KM = 2

export interface GroupablePhoto {
  /** `YYYY-MM-DDTHH:mm:ss` or null when the photo has no capture time. */
  takenAt: string | null
  latitude: number | null
  longitude: number | null
}

export interface PhotoGroup<T> {
  /** `YYYY-MM-DD`, or null for photos without a capture time. */
  date: string | null
  items: T[]
}

const EARTH_RADIUS_KM = 6371.0088

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

function hasCoords(p: GroupablePhoto): p is GroupablePhoto & { latitude: number; longitude: number } {
  return typeof p.latitude === 'number' && typeof p.longitude === 'number'
}

/**
 * Proposes memory groups for a bulk import.
 *
 * Photos are ordered by capture time and split by calendar day. Within a day,
 * a new group starts when a photo with coordinates is farther than
 * `distanceKm` from the last photo with coordinates in the current group.
 * Photos without coordinates stay in the current group. Photos without a
 * capture time form one final group with `date: null`.
 */
export function groupPhotos<T extends GroupablePhoto>(
  photos: T[],
  distanceKm: number = GROUP_DISTANCE_KM,
): PhotoGroup<T>[] {
  const dated = photos.filter((p) => p.takenAt)
  const undated = photos.filter((p) => !p.takenAt)
  dated.sort((a, b) => (a.takenAt! < b.takenAt! ? -1 : a.takenAt! > b.takenAt! ? 1 : 0))

  const groups: PhotoGroup<T>[] = []
  let current: PhotoGroup<T> | null = null
  let anchor: { latitude: number; longitude: number } | null = null

  for (const p of dated) {
    const day = p.takenAt!.slice(0, 10)
    let split = !current || current.date !== day
    if (!split && anchor && hasCoords(p)) {
      split = haversineKm(anchor.latitude, anchor.longitude, p.latitude, p.longitude) > distanceKm
    }
    if (split) {
      current = { date: day, items: [] }
      groups.push(current)
      anchor = null
    }
    current!.items.push(p)
    if (hasCoords(p)) anchor = { latitude: p.latitude, longitude: p.longitude }
  }

  if (undated.length) groups.push({ date: null, items: undated })
  return groups
}
