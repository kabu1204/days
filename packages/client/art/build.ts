/**
 * Builds every built-in image from the drawings in this folder:
 *   pnpm art
 * Writes PNG files to src/assets/art/, a contact sheet to docs/art/preview.png,
 * and then runs the acceptance check (check.ts).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BODY_KEYS, CATEGORY_KEYS, HEADPIECE_KEYS, PLACE_ICON_KEYS, STICKER_KEYS } from '@days/shared'
import { FRAME, mochiSheet } from './characters'
import { type Grid, blank, sheet, stamp } from './grid'
import { headpieceSheet } from './headpieces'
import { ICON, categoryArt, logoArt, placeArt, speechArt } from './icons'
import { catSheet } from './pet'
import { encodePng, gridToImage } from './png'
import { STICKER, stickerArt } from './stickers'
import { checkAll } from './check'

const here = dirname(fileURLToPath(import.meta.url))
export const OUT = join(here, '../src/assets/art')
const PREVIEW = join(here, '../../../docs/art/preview.png')

/** Every output file with its drawing and expected size. */
export function outputs(): { path: string; grid: Grid; w: number; h: number }[] {
  const sheetW = FRAME * 4
  const sheetH = FRAME * 8
  return [
    ...BODY_KEYS.map((k) => ({ path: `bodies/${k}.png`, grid: mochiSheet(k), w: sheetW, h: sheetH })),
    { path: 'characters/pet.png', grid: catSheet(), w: sheetW, h: sheetH },
    ...HEADPIECE_KEYS.map((k) => ({ path: `headpieces/${k}.png`, grid: headpieceSheet(k), w: sheetW, h: sheetH })),
    ...STICKER_KEYS.map((k) => ({ path: `stickers/${k}.png`, grid: stickerArt[k], w: STICKER, h: STICKER })),
    ...CATEGORY_KEYS.map((k) => ({ path: `categories/${k}.png`, grid: categoryArt[k], w: ICON, h: ICON })),
    ...PLACE_ICON_KEYS.map((k) => ({ path: `places/${k}.png`, grid: placeArt[k], w: ICON, h: ICON })),
    { path: 'logo.png', grid: logoArt(), w: ICON, h: ICON },
    { path: 'speech.png', grid: speechArt(), w: ICON, h: ICON },
  ]
}

const pad = (g: Grid, w: number, h: number): Grid => stamp(blank(w, h), g, Math.floor((w - g[0].length) / 2), Math.floor((h - g.length) / 2))

function preview(): Grid {
  const sheetW = FRAME * 4
  const sheetH = FRAME * 8
  const gap = 8
  // Characters: the cream body with each headpiece, then every other body with one
  // headpiece each, then the cat (idle rows, then walk rows of each sheet).
  const half = (g: Grid) => g.slice(0, FRAME * 4)
  const cell = (g: Grid) => pad(g, sheetW + gap, sheetH / 2 + gap)
  const cells: Grid[] = HEADPIECE_KEYS.map((k) => stamp(mochiSheet('cream'), headpieceSheet(k), 0, 0))
  BODY_KEYS.filter((b) => b !== 'cream').forEach((b, i) =>
    cells.push(stamp(mochiSheet(b), headpieceSheet(HEADPIECE_KEYS[(i + 1) % HEADPIECE_KEYS.length]), 0, 0)),
  )
  const cat = catSheet()
  const all = [...cells.map((g) => cell(half(g))), cell(half(cat)), cell(cat.slice(FRAME * 4))]
  const rows: Grid[][] = []
  for (let i = 0; i < all.length; i += 4) rows.push(all.slice(i, i + 4))
  const chars = sheet(rows, 4, sheetW + gap, sheetH / 2 + gap)
  const small = [...STICKER_KEYS.map((k) => stickerArt[k]), ...CATEGORY_KEYS.map((k) => categoryArt[k]), ...PLACE_ICON_KEYS.map((k) => placeArt[k]), logoArt(), speechArt()].map((g) =>
    pad(g, STICKER + 4, STICKER + 4),
  )
  const per = Math.floor(chars[0].length / (STICKER + 4))
  const iconRows: Grid[][] = []
  for (let i = 0; i < small.length; i += per) iconRows.push(small.slice(i, i + per))
  const icons = sheet(iconRows, per, STICKER + 4, STICKER + 4)
  return [...chars, ...icons.map((r) => r.padEnd(chars[0].length, '.'))].map((r) => r.replace(/\./g, 'W'))
}

function main() {
  for (const o of outputs()) {
    const file = join(OUT, o.path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, encodePng(gridToImage(o.grid)))
  }
  writeFileSync(
    join(OUT, 'CREDITS.md'),
    [
      '# Built-in art',
      '',
      'All images in this folder are original work drawn for this project. They are generated',
      'from the drawings in `packages/client/art/` with `pnpm art`; do not edit the PNG files by hand.',
      '',
      'The characters are original round mochi (rice-cake) creatures in six flavours, and a cat. The style is inspired',
      'only in general traits (warm night palette, soft outlines, three-tone shading) by cosy',
      'restaurant-management pixel games; no character, sprite, logo or interface of any existing game is used.',
      '',
    ].join('\n'),
  )
  mkdirSync(dirname(PREVIEW), { recursive: true })
  writeFileSync(PREVIEW, encodePng(gridToImage(preview(), 3)))
  const problems = checkAll()
  if (problems.length) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
  console.log(`art: ${outputs().length} images written and checked`)
}

main()
