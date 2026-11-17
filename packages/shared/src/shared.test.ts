import { describe, expect, it } from 'vitest'
import {
  PLACE_SUGGEST_METERS,
  centroid,
  clusterPoints,
  nearbyPlaces,
  projectToPixels,
  daysInMonth,
  filingMonth,
  groupPhotos,
  haversineKm,
  isValidDate,
  isValidMonth,
  nextMonthStart,
  normalizeStartDate,
} from './index'

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isValidDate('2024-02-29')).toBe(true)
    expect(isValidDate('2023-02-29')).toBe(false)
    expect(isValidDate('2023-13-01')).toBe(false)
    expect(isValidDate('2023-1-1')).toBe(false)
    expect(isValidDate(20230101)).toBe(false)
    expect(isValidMonth('2023-12')).toBe(true)
    expect(isValidMonth('2023-00')).toBe(false)
  })
  it('files a memory under the month of its start date', () => {
    expect(filingMonth('2021-07-31')).toBe('2021-07')
    expect(normalizeStartDate('2021-07-31', 'month')).toBe('2021-07-01')
    expect(normalizeStartDate('2021-07-31', 'day')).toBe('2021-07-31')
  })
  it('computes month boundaries', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(nextMonthStart('2023-12')).toBe('2024-01-01')
    expect(nextMonthStart('2023-04')).toBe('2023-05-01')
  })
})

describe('grouping', () => {
  it('measures distance', () => {
    // Shanghai People's Square to Hangzhou West Lake: about 165 km
    const d = haversineKm(31.2304, 121.4737, 30.2431, 120.1503)
    expect(d).toBeGreaterThan(155)
    expect(d).toBeLessThan(175)
  })
  it('splits by day, then by distance, and keeps undated photos apart', () => {
    const p = (id: string, takenAt: string | null, latitude: number | null = null, longitude: number | null = null) => ({
      id,
      takenAt,
      latitude,
      longitude,
    })
    const groups = groupPhotos([
      p('e', '2022-05-02T09:00:00', 31.23, 121.47),
      p('x', null),
      p('b', '2022-05-01T10:05:00', 31.2305, 121.4739),
      p('a', '2022-05-01T10:00:00', 31.2304, 121.4737),
      p('c', '2022-05-01T12:00:00'),
      p('d', '2022-05-01T18:00:00', 30.2431, 120.1503),
    ])
    expect(groups.map((g) => [g.date, g.items.map((i) => i.id).join('')])).toEqual([
      ['2022-05-01', 'abc'],
      ['2022-05-01', 'd'],
      ['2022-05-02', 'e'],
      [null, 'x'],
    ])
  })
})

describe('places', () => {
  const harbour = { id: 1, latitude: 31.2304, longitude: 121.4737 }
  const pier = { id: 2, latitude: 31.2311, longitude: 121.4737 } // about 78 m north
  const lake = { id: 3, latitude: 30.2431, longitude: 120.1503 }

  it('offers saved Places within 100 m, nearest first', () => {
    const found = nearbyPlaces([lake, pier, harbour], { latitude: 31.2305, longitude: 121.4737 })
    expect(found.map((p) => p.id)).toEqual([1, 2])
    expect(found[0].distance).toBeLessThan(15)
    expect(nearbyPlaces([lake], harbour)).toEqual([])
    expect(PLACE_SUGGEST_METERS).toBe(100)
  })

  it('computes the mean position of located points only', () => {
    expect(centroid([{ latitude: null, longitude: null }])).toBeNull()
    const c = centroid([harbour, pier, { latitude: null, longitude: 5 }])!
    expect(c.latitude).toBeCloseTo(31.23075, 5)
    expect(c.longitude).toBeCloseTo(121.4737, 5)
  })

  it('groups markers that would overlap at low zoom and separates them when zoomed in', () => {
    const far = clusterPoints([harbour, pier, lake], 5)
    expect(far).toHaveLength(1)
    expect(far[0].items).toHaveLength(3)
    const city = clusterPoints([harbour, pier, lake], 10)
    expect(city.map((c) => c.items.map((p) => p.id))).toEqual([[1, 2], [3]])
    expect(clusterPoints([harbour, pier, lake], 18)).toHaveLength(3)
  })

  it('projects positions like the map does', () => {
    expect(projectToPixels({ latitude: 0, longitude: 0 }, 0)).toEqual({ x: 128, y: 128 })
    expect(projectToPixels({ latitude: 0, longitude: 180 }, 1).x).toBe(512)
  })
})
