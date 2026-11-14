export const CATEGORY_KEYS = [
  'daily',
  'food',
  'travel',
  'film',
  'walk',
  'home',
  'gift',
  'festival',
  'music',
  'other',
] as const

export type CategoryKey = (typeof CATEGORY_KEYS)[number]

export function isCategoryKey(v: unknown): v is CategoryKey {
  return typeof v === 'string' && (CATEGORY_KEYS as readonly string[]).includes(v)
}
