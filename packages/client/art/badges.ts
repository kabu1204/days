/**
 * Badge medals, the treasure chest and the wheel pointer (docs/asset-spec.md,
 * Sections 5.4 and 5.5). A medal is a paper disc with a coloured rim and two
 * ribbon tails, with a small emblem in the middle.
 */
import type { BadgeKey } from '@days/shared'
import { type Grid, stamp } from './grid'
import { type Material, type Shape, ellipse, mat, poly, rect, render, union } from './render'

export const BADGE = 16
const fig = (shapes: Shape[], size = BADGE) => render(shapes, size, size, { outline: 'k', litOutline: 'K' })

const AMBER = mat('Y', 'y', 'o')
const RED = mat('p', 'r', 'R')
const PINK = mat('w', 'p', 'P')
const BLUE = mat('w', 'b', 'B')
const GREEN = mat('g', 'g', 'G')
const INDIGO = mat('I', 'I', 'i')
const PAPER = mat('w', 'W', 'V')
const WOOD = mat('l', 'n', 'N')

function medal(rim: Material, emblem: Grid): Grid {
  let g = fig([
    { inside: union(poly([[3.5, 10], [7.5, 11], [6, 15.8], [4.6, 14.4], [3, 15.6]]), poly([[12.5, 10], [8.5, 11], [10, 15.8], [11.4, 14.4], [13, 15.6]])), mat: rim, shade: 1 },
    { inside: ellipse(8, 7, 6.8, 6.8), mat: rim, line: 'k', shade: 1.5 },
    { inside: ellipse(8, 7, 5.1, 5.1), mat: PAPER, line: rim.sh, shade: 1, light: 0 },
  ])
  const w = emblem[0].length
  const h = emblem.length
  g = stamp(g, emblem, Math.floor(8 - w / 2), Math.floor(7 - h / 2))
  return g
}

const EMBLEMS: Record<BadgeKey, [Material, Grid]> = {
  'first-memory': [RED, ['.rr.rr.', 'rwrrrrR', 'rrrrrrR', '.rrrrR.', '..rrR..', '...R...']],
  'ten-memories': [BLUE, ['.i.iii', 'ii.i.i', '.i.i.i', '.i.i.i', 'iiiiii']],
  'hundred-memories': [AMBER, ['y.yyy.y', 'yyYyyoy', '.yYyyo.', '..yyo..', '...o...', '..ooo..']],
  'first-trip': [BLUE, ['..NNN..', '..N.N..', 'nnnnnnN', 'nlllllN', 'nrrrrrN', 'nlllllN', 'NNNNNNN']],
  foodie: [RED, ['....N.N', '..wwN.N', 'rrrrrrr', 'rprrrrR', '.rrrrR.', '..RRR..']],
  'five-places': [GREEN, ['.rrr.', 'rprrR', 'rr.rR', 'rrrrR', '.rrR.', '..R..']],
  'three-cities': [INDIGO, ['.I.....', 'II...B.', 'II.b.BB', 'IIbbbBB', 'IIbbbBB']],
  'both-hands': [GREEN, ['m.m.r.r', 'mmm.rrr', 'mmm.rrr', '.m...r.']],
  album: [INDIGO, ['.SS....', 'sssssss', 'ssBbBsS', 'ssbwbsS', 'ssBbBsS', 'SSSSSSS']],
  'one-year': [PINK, ['...y...', '...r...', 'ppppppp', 'llllllo', 'ppppppP', 'llllllo']],
  'key-date': [RED, ['.K...K.', 'rrrrrrr', 'RRRRRRR', 'w.r.r.w', 'w.rrr.w', 'w..r..w', 'wwwwwww']],
  'wish-granted': [AMBER, ['....Y..', '...YyY.', '..YyyyY', 'b..Yyo.', '.b.y.o.', 'b......']],
}

export const badgeArt: Record<BadgeKey, Grid> = Object.fromEntries(
  Object.entries(EMBLEMS).map(([k, [rim, emblem]]) => [k, medal(rim, emblem)]),
) as Record<BadgeKey, Grid>

/** The treasure chest of the random flashback, closed or open. */
export function chestArt(open: boolean): Grid {
  if (!open) {
    let g = fig([
      { inside: rect(1.5, 8, 14.5, 15), mat: WOOD, shade: 1.5 },
      { inside: union(rect(1.5, 5, 14.5, 8.5), ellipse(8, 5.2, 6.5, 3)), mat: WOOD, line: 'k', shade: 1.5 },
    ])
    for (const x of [3, 11]) g = stamp(g, ['yy', 'yy', 'yy', 'yy', 'yy', 'yy', 'oo', 'yy', 'yy', 'yy', 'oo'], x, 3)
    g = stamp(g, ['kkk', 'kYk', 'kok'], 7 - 0, 7)
    return g
  }
  let g = fig([
    { inside: poly([[2, 1], [14, 1], [14.5, 6], [1.5, 6]]), mat: WOOD, shade: 1 },
    { inside: rect(1.5, 6, 14.5, 9), mat: mat('N', 'N', 'N'), line: 'k', shade: 0, light: 0 },
    { inside: rect(1.5, 9, 14.5, 15), mat: WOOD, line: 'k', shade: 1.5 },
  ])
  for (const x of [3, 11]) g = stamp(g, ['yy', 'yy', 'yy', 'yy'], x, 2)
  for (const x of [3, 11]) g = stamp(g, ['yy', 'yy', 'yy', 'yy', 'oo'], x, 10)
  g = stamp(g, ['.Y..Y.', 'YwY.wY', '.Y.YwY', '...Y..'], 5, 5)
  g = stamp(g, ['kYk', 'kok'], 7, 10)
  return g
}

/** The pointer above the food wheel (12 × 12). */
export function pointerArt(): Grid {
  return fig([{ inside: union(poly([[1.5, 1.5], [10.5, 1.5], [6, 11]]), ellipse(6, 2.5, 4.5, 2)), mat: RED, shade: 1.5 }], 12)
}
