/**
 * The shared palette of all built-in art (docs/asset-spec.md, Section 2).
 * Each colour has a one-character key used in the drawings; '.' is
 * transparent. Digits 1-3 are body tones that are replaced per character
 * (see `TINTS`).
 */
export const PALETTE: Record<string, string> = {
  k: '#2e1f2b', // outline, ink
  K: '#5a3a4a', // soft outline on the lit side, inner lines
  w: '#fff8ec', // highlight, paper white
  W: '#f1dfc0', // paper, cream
  V: '#d6bd98', // paper shade
  r: '#d1453b', // lantern red
  R: '#93302f', // red shade
  y: '#f0a83a', // amber
  Y: '#ffd77e', // amber light
  o: '#bf7426', // amber shade
  g: '#6f9e4c', // leaf green
  G: '#3f6b3a', // green shade
  b: '#6fa8d6', // sky blue
  B: '#3e6a9e', // blue shade
  i: '#2f3363', // night indigo
  I: '#525694', // indigo light
  s: '#b0a3ad', // grey
  S: '#74677a', // grey shade
  n: '#9c5b3b', // wood
  N: '#663a2c', // wood shade
  l: '#cf9259', // wood light
  p: '#f4a8bb', // sakura pink
  P: '#d27590', // pink shade
  m: '#ee8c86', // blush
  e: '#ffe9d6', // peach light
  q: '#f6c6ae', // peach
  Q: '#de9f88', // peach shade
  c: '#fbeedd', // mochi cream
  C: '#e6cbb0', // mochi cream shade
}

/** Body tones per character: 1 highlight, 2 base, 3 shade. */
export const TINTS: Record<'cream' | 'peach', Record<string, string>> = {
  cream: { '1': 'w', '2': 'c', '3': 'C' },
  peach: { '1': 'e', '2': 'q', '3': 'Q' },
}

export function rgba(key: string): [number, number, number, number] {
  const hex = PALETTE[key]
  if (!hex) throw new Error(`colour key "${key}" is not in the palette`)
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255]
}
