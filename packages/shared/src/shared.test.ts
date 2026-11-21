import { describe, expect, it } from 'vitest'
import {
  PLACE_SUGGEST_METERS,
  daysBetween,
  dayPeriod,
  excerpt,
  nextOccurrence,
  planBubbles,
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
  badgesEarned,
  isOnThisDay,
  pickFlashback,
  type BadgeFacts,
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

describe('key dates and speech bubbles', () => {
  it('finds the next yearly occurrence', () => {
    expect(nextOccurrence('2019-05-20', '2026-05-10')).toEqual({ date: '2026-05-20', days: 10, years: 7 })
    expect(nextOccurrence('2019-05-20', '2026-05-20')).toEqual({ date: '2026-05-20', days: 0, years: 7 })
    expect(nextOccurrence('2019-05-20', '2026-05-21')).toEqual({ date: '2027-05-20', days: 364, years: 8 })
    // 29 February falls on 28 February in other years.
    expect(nextOccurrence('2020-02-29', '2026-02-01').date).toBe('2026-02-28')
    expect(nextOccurrence('2020-02-29', '2028-02-01').date).toBe('2028-02-29')
    // A date that has not yet happened is counted down to the date itself.
    expect(nextOccurrence('2027-01-10', '2026-12-31')).toEqual({ date: '2027-01-10', days: 10, years: 0 })
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
  })
  it('shortens a note to its first line', () => {
    expect(excerpt('\n  first line  \nsecond')).toBe('first line')
    expect(excerpt('一二三四五六', 4)).toBe('一二三…')
  })
  it('orders the lines: key date today, this day in earlier years, countdowns, then quotes and everyday lines', () => {
    const bubbles = planBubbles(
      {
        keyDates: [
          { id: 1, label: 'First date', date: '2019-05-20' },
          { id: 2, label: 'Birthday', date: '1995-06-01' },
          { id: 3, label: 'Far away', date: '1995-12-01' },
        ],
        onThisDay: [{ memoryId: 7, title: 'Picnic', startDate: '2021-05-20', createdBy: 2 }],
        quotes: [{ memoryId: 8, text: 'So windy', speakerId: 1, date: '2021-07-15' }],
      },
      '2026-05-20',
      9,
      () => 0,
    )
    expect(bubbles.map((b) => b.kind)).toEqual(['keyDateToday', 'onThisDay', 'keyDateSoon', 'everyday', 'quote', 'everyday'])
    expect(bubbles[0]).toEqual({ kind: 'keyDateToday', label: 'First date', years: 7 })
    expect(bubbles[1]).toMatchObject({ years: 5, speakerId: 2 })
    expect(bubbles[2]).toEqual({ kind: 'keyDateSoon', label: 'Birthday', days: 12 })
    expect(bubbles[3]).toEqual({ kind: 'everyday', period: 'morning', line: 1 })
    expect(dayPeriod(23)).toBe('night')
    expect(dayPeriod(14)).toBe('day')
  })
})

describe('playful features', () => {
  const none: BadgeFacts = {
    memories: 0, travelMemories: 0, foodMemories: 0, places: 0, cities: 0, creators: 0,
    photos: 0, firstDate: null, lastDate: null, keyDates: 0, wishesGranted: 0,
  }

  it('earns badges only when their rule holds', () => {
    expect(badgesEarned(none)).toEqual([])
    expect(badgesEarned({ ...none, memories: 1, creators: 1, firstDate: '2021-01-01', lastDate: '2021-01-01' })).toEqual(['first-memory'])
    const many = badgesEarned({
      ...none, memories: 12, travelMemories: 1, foodMemories: 10, places: 5, cities: 3, creators: 2,
      photos: 100, firstDate: '2020-02-29', lastDate: '2021-02-28', keyDates: 1, wishesGranted: 1,
    })
    expect(many).toEqual([
      'first-memory', 'ten-memories', 'first-trip', 'foodie', 'five-places', 'three-cities', 'both-hands', 'album', 'one-year', 'key-date', 'wish-granted',
    ])
    expect(badgesEarned({ ...none, memories: 2, firstDate: '2020-03-01', lastDate: '2021-02-28' })).not.toContain('one-year')
  })

  it('picks flashbacks, avoiding recent ones and preferring this day', () => {
    const c = [
      { id: 1, startDate: '2021-07-15', datePrecision: 'day' as const },
      { id: 2, startDate: '2022-10-02', datePrecision: 'day' as const },
      { id: 3, startDate: '2020-05-01', datePrecision: 'month' as const },
    ]
    expect(pickFlashback([], [], '2026-07-15')).toBeNull()
    expect(pickFlashback(c, [1, 2], '2026-07-15', () => 0.99)).toBe(3)
    // All shown recently: anything but the last one shown.
    expect(pickFlashback(c, [1, 2, 3], '2026-07-15', () => 0)).toBe(1)
    expect(pickFlashback(c, [2, 3, 1], '2026-07-15', () => 0)).toBe(2)
    // Memory 1 is on this day: weight 5 of 7.
    expect(pickFlashback(c, [], '2026-07-15', () => 0.7)).toBe(1)
    expect(pickFlashback(c, [], '2026-07-15', () => 0.8)).toBe(2)
    expect(isOnThisDay('2021-07-15', 'day', '2021-07-15')).toBe(false)
    expect(isOnThisDay('2020-07-01', 'month', '2026-07-01')).toBe(false)
  })
})
