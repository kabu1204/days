/** Category, landmark, logo and speech icons on a 12 × 12 grid (docs/asset-spec.md, Section 6). */
import type { CategoryKey, PlaceIconKey } from '@days/shared'
import { type Grid, stamp } from './grid'
import { type Shape, ellipse, mat, minus, poly, rect, render, union } from './render'

export const ICON = 12
const fig = (shapes: Shape[]) => render(shapes, ICON, ICON, { outline: 'k', litOutline: 'K' })

const AMBER = mat('Y', 'y', 'o')
const RED = mat('p', 'r', 'R')
const PAPER = mat('w', 'W', 'V')
const WOOD = mat('l', 'n', 'N')
const GREEN = mat('g', 'g', 'G')
const BLUE = mat('w', 'b', 'B')
const GREY = mat('w', 's', 'S')
const INDIGO = mat('I', 'I', 'i')

const sun = (): Grid => [
  '.....yy.....',
  '.y........y.',
  '..y......y..',
  '....kkkk....',
  '...kwYYyk...',
  'yy.kYYYyk.yy',
  'yy.kYYyok.yy',
  '...kyyook...',
  '....kkkk....',
  '..y......y..',
  '.y........y.',
  '.....yy.....',
]

function bowl(steam: boolean): Grid {
  let g = fig([
    { inside: ellipse(6, 6.5, 4.5, 1.6), mat: PAPER, shade: 0 },
    { inside: minus(ellipse(6, 6.5, 5.5, 5), rect(0, 0, 12, 6.8)), mat: RED, line: 'k', shade: 1.5 },
    { inside: rect(4, 10.8, 8, 12), mat: RED, shade: 0 },
  ])
  if (steam) g = stamp(g, ['.s..s.', 's..s..', '.s..s.'], 3, 0)
  return g
}

const suitcase = (): Grid =>
  stamp(
    fig([
      { inside: rect(4, 1, 8, 4), mat: WOOD, shade: 0, light: 0 },
      { inside: rect(1, 3, 11, 11), mat: WOOD, line: 'k', shade: 1.5 },
      { inside: union(rect(3, 3, 4, 11), rect(8, 3, 9, 11)), mat: AMBER, shade: 0, light: 0 },
    ]).map((r, y) => (y > 0 && y < 3 ? r.slice(0, 5) + '..' + r.slice(7) : r)),
    ['..'],
    5,
    2,
  )

function film(): Grid {
  let g = fig([
    { inside: poly([[1, 4.5], [10.5, 1], [11, 3], [1.5, 6]]), mat: INDIGO, shade: 0 },
    { inside: rect(1, 5, 11, 11), mat: INDIGO, line: 'k', shade: 1 },
  ])
  g = stamp(g, ['w..w', '.w..w'], 3, 2)
  g = stamp(g, ['wwwwww'], 3, 7)
  return g
}

function shoe(): Grid {
  let g = fig([
    { inside: poly([[0.6, 10], [0.8, 3.5], [5, 3.5], [6.2, 6], [10.5, 7], [11.4, 10]]), mat: BLUE, shade: 1.5 },
    { inside: rect(0.4, 9, 11.6, 11.6), mat: PAPER, line: 'k', shade: 0 },
  ])
  g = stamp(g, ['w.w', '.w.'], 3, 5)
  return g
}

function house(roof = RED): Grid {
  let g = fig([
    { inside: rect(2, 5, 10, 11.5), mat: PAPER, shade: 1 },
    { inside: poly([[0.2, 6.2], [6, 0.6], [11.8, 6.2]]), mat: roof, line: 'k', shade: 1 },
    { inside: rect(5, 8, 7, 11.5), mat: WOOD, line: 'k', shade: 0, light: 0 },
  ])
  g = stamp(g, ['bb'], 3, 7)
  return g
}

function gift(): Grid {
  return fig([
    { inside: union(ellipse(4, 2.5, 2, 1.6), ellipse(8, 2.5, 2, 1.6)), mat: AMBER, shade: 0 },
    { inside: rect(1, 4, 11, 6.5), mat: RED, line: 'k', shade: 1 },
    { inside: rect(2, 6.5, 10, 11.5), mat: RED, line: 'k', shade: 1.5 },
    { inside: union(rect(5, 4, 7, 11.5)), mat: AMBER, shade: 0, light: 0 },
  ])
}

function firework(): Grid {
  let g = fig([{ inside: ellipse(6, 6, 1.6, 1.6), mat: AMBER, shade: 0 }])
  g = stamp(g, ['y....p....y', '.y...p...y.', '..y.....y..', '...........', 'pp.......pp', '...........', '..y.....y..', '.y...p...y.', 'y....p....y'], 0, 1)
  return g
}

function musicNote(): Grid {
  return fig([
    { inside: union(rect(4, 2, 5.6, 9), rect(9, 1, 10.6, 8), poly([[4, 2], [10.6, 0.5], [10.6, 2.6], [4, 4]])), mat: INDIGO, shade: 0 },
    { inside: ellipse(3.6, 9.4, 2.1, 1.6), mat: INDIGO, shade: 0 },
    { inside: ellipse(8.6, 8.4, 2.1, 1.6), mat: INDIGO, shade: 0 },
  ])
}

const gem = (): Grid =>
  fig([
    { inside: poly([[1, 4], [3.5, 1], [8.5, 1], [11, 4], [6, 11]]), mat: mat('w', 'b', 'B'), shade: 1.5 },
    { inside: poly([[1, 4], [11, 4], [6, 11]]), mat: mat('b', 'b', 'B'), line: 'B', shade: 1 },
  ])

export const categoryArt: Record<CategoryKey, Grid> = {
  daily: sun(),
  food: bowl(true),
  travel: suitcase(),
  film: film(),
  walk: shoe(),
  home: house(),
  gift: gift(),
  festival: firework(),
  music: musicNote(),
  other: gem(),
}

function pin(): Grid {
  let g = fig([{ inside: union(ellipse(6, 4.6, 4, 4), poly([[2.6, 6.5], [9.4, 6.5], [6, 11.8]])), mat: RED, shade: 1.5 }])
  g = stamp(g, ['ww', 'ww'], 5, 3)
  return g
}

function onigiri(): Grid {
  return fig([
    { inside: poly([[6, 0.6], [11.6, 10.6], [0.4, 10.6]]), mat: PAPER, shade: 1.5 },
    { inside: rect(3.5, 7, 8.5, 11), mat: mat('I', 'i', 'i'), line: 'k', shade: 0, light: 0 },
  ])
}

function tree(): Grid {
  return fig([
    { inside: rect(5, 7, 7, 11.5), mat: WOOD, shade: 0, light: 0 },
    { inside: union(ellipse(6, 4, 4, 3.6), ellipse(3.5, 6.5, 2.6, 2.2), ellipse(8.5, 6.5, 2.6, 2.2)), mat: GREEN, shade: 1.5 },
  ])
}

function mountain(): Grid {
  return fig([
    { inside: poly([[0, 11.5], [6, 1], [12, 11.5]]), mat: GREY, shade: 2 },
    { inside: poly([[3.6, 5.4], [6, 1], [8.4, 5.4], [7, 4.6], [6, 5.6], [5, 4.6]]), mat: PAPER, shade: 0 },
  ])
}

const water = (): Grid =>
  [
    '............',
    '............',
    '..bb....bb..',
    '.b..b..b..b.',
    'b....bb....b',
    '............',
    '..BB....BB..',
    '.B..B..B..B.',
    'B....BB....B',
    '............',
    '............',
    '............',
  ]

function city(): Grid {
  let g = fig([
    { inside: rect(1, 5, 5, 11.5), mat: GREY, shade: 1 },
    { inside: rect(4, 1, 8.5, 11.5), mat: mat('I', 'I', 'i'), line: 'k', shade: 1 },
    { inside: rect(8, 4, 11, 11.5), mat: GREY, line: 'k', shade: 1 },
  ])
  g = stamp(g, ['Y.Y', '...', 'Y.Y', '...', 'Y.Y'], 5, 3)
  return g
}

function train(): Grid {
  let g = fig([
    { inside: union(ellipse(6, 4, 4.6, 3.2), rect(1.4, 4, 10.6, 10)), mat: RED, shade: 1.5 },
    { inside: rect(2.6, 3, 9.4, 6), mat: BLUE, line: 'k', shade: 0, light: 0 },
  ])
  g = stamp(g, ['Y....Y'], 3, 8)
  g = stamp(g, ['k......k', '.k....k.'], 2, 10)
  return g
}

export const placeArt: Record<PlaceIconKey, Grid> = {
  pin: pin(),
  home: house(WOOD),
  food: onigiri(),
  park: tree(),
  mountain: mountain(),
  water: water(),
  city: city(),
  station: train(),
}

/** A paper lantern with a heart. */
export function logoArt(): Grid {
  let g = fig([
    { inside: rect(2.5, 0, 9.5, 2.5), mat: WOOD, shade: 0 },
    { inside: rect(2.5, 9.5, 9.5, 12), mat: WOOD, shade: 0 },
    { inside: ellipse(6, 6, 5.6, 4.2, 2, 2.4), mat: RED, line: 'k', shade: 1.5 },
  ])
  g = stamp(g, ['ww.ww', 'wwwww', '.www.', '..w..'], 4, 4)
  return g
}

export function speechArt(): Grid {
  let g = fig([
    { inside: union(ellipse(6, 5, 5.5, 4.2, 2.6, 2.6), poly([[3, 7], [6, 8.5], [2.5, 11.5]])), mat: PAPER, shade: 1.5 },
  ])
  g = stamp(g, ['K.K.K'], 4, 5)
  return g
}
