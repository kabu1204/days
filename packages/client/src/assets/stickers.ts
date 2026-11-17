/**
 * Placeholder stickers on a 16 × 16 grid (docs/asset-spec.md, Section 6).
 * Each drawing is centred in the grid. Final art replaces these through
 * `manifest.ts`.
 */
import type { StickerKey } from '@days/shared'
import { pixelSvg } from './pixel'

const SIZE = 16

/** Centres a smaller drawing in the 16 × 16 grid. */
function fit(rows: string[]): string {
  const w = Math.max(...rows.map((r) => r.length))
  const left = Math.floor((SIZE - w) / 2)
  const top = Math.floor((SIZE - rows.length) / 2)
  const line = (r: string) => ('.'.repeat(left) + r.padEnd(w, '.')).padEnd(SIZE, '.')
  const empty = '.'.repeat(SIZE)
  const out = [...new Array(top).fill(empty), ...rows.map(line)]
  while (out.length < SIZE) out.push(empty)
  return pixelSvg(out)
}

const FACE_TOP = ['....kkkkkk....', '..kkyyyyyykk..', '.kyyyyyyyyyyk.', '.kyyyyyyyyyyk.']
const FACE_BOTTOM = ['.kyyyyyyyyyyk.', '..kkyyyyyykk..', '....kkkkkk....']

export const stickerArt: Record<StickerKey, string> = {
  heart: fit([
    '.kkk...kkk.', 'kmmmk.kmmmk', 'kmwmmkmmmmk', 'kmmmmmmmmmk', 'kmmmmmmmmmk', '.kmmmmmmmk.', '..kmmmmmk..', '...kmmmk...', '....kmk....', '.....k.....',
  ]),
  laugh: fit([...FACE_TOP, 'kyykkyyyykkyyk', 'kyyyyyyyyyyyyk', 'kyykkkkkkkkyyk', 'kyyykrrrrkyyyk', ...FACE_BOTTOM]),
  wow: fit([...FACE_TOP, 'kyykyyyyyykyyk', 'kyykyyyyyykyyk', 'kyyyyykkyyyyyk', 'kyyyykrrkyyyyk', 'kyyyyykkyyyyyk', ...FACE_BOTTOM]),
  tear: fit([...FACE_TOP, 'kyykkyyyykkyyk', 'kybyyyyyyyyyyk', 'kybyyyyyyyyyyk', 'kyyyykkkkyyyyk', ...FACE_BOTTOM]),
  hug: fit([
    '..kk......kk..', '.kmmk....kmmk.', '.kmmmk..kmmmk.', '..kmmmkkmmmk..', '...kmmmmmmk...', '..kyykmmkyyk..', '.kyyyykkyyyyk.', '.kyyyyyyyyyyk.', '..kkkkkkkkkk..',
  ]),
  clap: fit([
    '.k.......k.', '..k.kkk.k..', '....kppk...', '...kpppk.k.', '..kppppk.k.', '..kpppppk..', '..kpppppk..', '...kpppk...', '....kkk....',
  ]),
  flower: fit([
    '....kkk....', '...kmmmk...', '.kkkmmmkkk.', 'kmmmkyykmmmk'.slice(0, 11), 'kmmkyyykmmk', '.kkkmmmkkk.', '...kmmmk...', '....kgk....', '..kk.kg.kk.', '..kgkgkgk..', '....kgk....',
  ]),
  sparkle: fit([
    '.....k.....', '....kyk....', '....kyk....', '...kyyyk...', 'kkkyywyykkk', 'kyyywwwyyyk', 'kkkyywyykkk', '...kyyyk...', '....kyk....', '....kyk....', '.....k.....',
  ]),
  ribbon: fit([
    'kk.......kk', 'krk.....krk', 'krrk...krrk', 'krrrkkkrrrk', 'krrrkrkrrrk', 'krrrkkkrrrk', 'krrk.k.krrk', 'kk..krk..kk', '...krk.krk.', '..krk...krk', '..kk.....kk',
  ]),
  sun: fit([
    '.....k.....', '.k...k...k.', '..k.kkk.k..', '...kyyyk...', '..kyyyyyk..', 'kkkyyyyykkk', '..kyyyyyk..', '...kyyyk...', '..k.kkk.k..', '.k...k...k.', '.....k.....',
  ]),
  cloud: fit([
    '....kkk.......', '...kwwwk.kk...', '.kkwwwwwkwwk..', 'kwwwwwwwwwwwk.', 'kwwwwwwwwwwwwk', 'kwwwwwwwwwwwwk', '.kkkkkkkkkkkk.',
  ]),
  note: fit([
    '....kkkkkk', '....kbbbbk', '....kkkkkk', '....k....k', '....k....k', '.kkkk.kkkk', 'kbbbkkbbbk', 'kbbbkkbbbk', '.kkk..kkk.',
  ]),
  leaf: fit([
    '......kkk', '....kkggk', '...kgggk.', '..kgggwgk', '.kggwgggk', '.kgwgggk.', 'kgwgggk..', 'kwkkkk...', 'k........',
  ]),
  cat: fit([
    'k.......k', 'kk.....kk', 'kyk...kyk', 'kyykkkyyk', 'kyyyyyyyk', 'kykyyykyk', 'kyyymyyyk', '.kyyyyyk.', '..kkkkk..',
  ]),
  paw: fit([
    '.kk...kk.', 'knnk.knnk', '.kk.k.kk.', '...knk...', '.kkknkkk.', 'knnnnnnnk', 'knnnnnnnk', '.knnnnnk.', '..kkkkk..',
  ]),
  cake: fit([
    '.....k.....', '....kyk.....', '.....k.....', '..kkkkkkk..', '.kwwwwwwwk.', '.kmwmwmwmk.', 'kkkkkkkkkkk', 'knnnnnnnnnk', 'kwwwwwwwwwk', 'knnnnnnnnnk', 'kkkkkkkkkkk',
  ].map((r) => r.slice(0, 11))),
  balloon: fit([
    '..kkkkk..', '.krrrrrk.', 'krwrrrrrk', 'krwrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...kkk...', '....k....', '...k.....', '....k....', '.....k...',
  ]),
  moon: fit([
    '...kkkk...', '..kyyyk....', '.kyyyk.....', 'kyyyk......', 'kyyyk......', 'kyyyk......', 'kyyyyk.....', '.kyyyykkk..', '..kyyyyyyk.', '...kkkkkk..',
  ].map((r) => r.slice(0, 10))),
}

/** Speech icon for comment counts (12 × 12). */
export const speechIcon = pixelSvg([
  '............', '.kkkkkkkkkk.', 'kwwwwwwwwwwk', 'kwkkwkkwkkwk', 'kwwwwwwwwwwk', 'kwkkkkwkkwwk', 'kwwwwwwwwwwk', '.kkkwkkkkkk.', '...kwk......', '...kk.......', '............', '............',
])
