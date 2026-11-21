/**
 * Acceptance check for built-in art (docs/asset-spec.md, Section 8.3): every
 * file exists with the expected size, every pixel is fully transparent or
 * fully opaque, and every colour is in the palette.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BADGE_KEYS, BODY_KEYS, CATEGORY_KEYS, HEADPIECE_KEYS, PLACE_ICON_KEYS, STICKER_KEYS } from '@days/shared'
import { decodePng } from './png'
import { PALETTE } from './palette'

const here = join(import.meta.dirname ?? '.', '../src/assets/art')

export function expected(): { path: string; w: number; h: number }[] {
  return [
    ...BODY_KEYS.map((k) => ({ path: `bodies/${k}.png`, w: 128, h: 256 })),
    { path: 'characters/pet.png', w: 128, h: 256 },
    ...HEADPIECE_KEYS.map((k) => ({ path: `headpieces/${k}.png`, w: 128, h: 256 })),
    ...STICKER_KEYS.map((k) => ({ path: `stickers/${k}.png`, w: 16, h: 16 })),
    ...CATEGORY_KEYS.map((k) => ({ path: `categories/${k}.png`, w: 12, h: 12 })),
    ...PLACE_ICON_KEYS.map((k) => ({ path: `places/${k}.png`, w: 12, h: 12 })),
    { path: 'logo.png', w: 12, h: 12 },
    { path: 'speech.png', w: 12, h: 12 },
    ...BADGE_KEYS.map((k) => ({ path: `badges/${k}.png`, w: 16, h: 16 })),
    { path: 'chest-closed.png', w: 16, h: 16 },
    { path: 'chest-open.png', w: 16, h: 16 },
    { path: 'pointer.png', w: 12, h: 12 },
  ]
}

export function checkAll(dir = here): string[] {
  const colours = new Set(Object.values(PALETTE).map((h) => h.toLowerCase()))
  const problems: string[] = []
  for (const e of expected()) {
    const file = join(dir, e.path)
    if (!existsSync(file)) {
      problems.push(`${e.path}: missing`)
      continue
    }
    const img = decodePng(readFileSync(file))
    if (img.width !== e.w || img.height !== e.h) problems.push(`${e.path}: ${img.width} × ${img.height}, expected ${e.w} × ${e.h}`)
    const bad = new Set<string>()
    for (let i = 0; i < img.data.length; i += 4) {
      const a = img.data[i + 3]
      if (a !== 0 && a !== 255) bad.add(`alpha ${a}`)
      if (a === 255) {
        const hex = '#' + [...img.data.subarray(i, i + 3)].map((v) => v.toString(16).padStart(2, '0')).join('')
        if (!colours.has(hex)) bad.add(`colour ${hex} not in the palette`)
      }
    }
    for (const b of bad) problems.push(`${e.path}: ${b}`)
  }
  return problems
}

if (process.argv[1]?.endsWith('check.ts')) {
  const problems = checkAll()
  console.log(problems.length ? problems.join('\n') : 'art: all images pass')
  process.exit(problems.length ? 1 : 0)
}
