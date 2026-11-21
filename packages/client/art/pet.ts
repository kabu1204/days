/**
 * The pet: a cream cat with amber patches and a red collar with a bell.
 * Same sheet layout as the partners; the cat is smaller and stands on the
 * same ground row.
 */
import { type Grid, mirror, sheet, stamp } from './grid'
import { FACINGS, FRAME, type Facing } from './characters'
import { type Inside, type Shape, ellipse, mat, minus, poly, rect, render } from './render'

const FUR = mat('w', 'W', 'V')
const PATCH = mat('Y', 'y', 'o')
const RED = mat('r', 'r', 'R')
const INNER = mat('p', 'p', 'P')

const both = (a: Inside, b: Inside): Inside => (x, y) => a(x, y) && b(x, y)
const down = (f: Inside, d: number): Inside => (x, y) => f(x, y - d)

interface Phase {
  /** Body bob in pixels (positive is up). */
  bob: number
  /** Leg offsets: near front, near back (horizontal), and which pair is lifted. */
  step: number
  /** Tail sway in pixels. */
  tail: number
}

function front(p: Phase, back: boolean): Grid {
  const b = -p.bob
  const head = down(ellipse(16, 18, 7, 5.5, 2, 2.4), b)
  const shapes: Shape[] = [
    { inside: down(poly([[20, 30], [23, 29], [25 + p.tail, 22], [24 + p.tail, 20], [22 + p.tail, 22], [21, 27]]), 0), mat: PATCH, shade: 1 },
    { inside: down(ellipse(16, 26.5, 6.5, 5.5, 2, 3.5), b / 2), mat: FUR, shade: 2 },
    { inside: down(poly([[9.3, 17], [10.3, 9.8], [15, 14]]), b), mat: PATCH, shade: 1 },
    { inside: down(poly([[22.7, 17], [21.7, 9.8], [17, 14]]), b), mat: back ? PATCH : FUR, shade: 1 },
    { inside: head, mat: FUR, line: 'V', shade: 2 },
    { inside: both(head, down(ellipse(11, 13.5, 5.5, 4.5), b)), mat: PATCH, shade: 0, light: 1 },
    { inside: down(rect(11, 22, 21, 23.6), b), mat: RED, line: 'R', shade: 0, light: 0 },
  ]
  if (!back) {
    shapes.splice(5, 0, { inside: down(poly([[10.7, 15.5], [11, 11.8], [13.5, 14.5]]), b), mat: INNER, shade: 0, light: 0 })
    shapes.push({ inside: down(poly([[21.3, 15.5], [21, 11.8], [18.5, 14.5]]), b), mat: INNER, shade: 0, light: 0 })
    shapes.push({ inside: ellipse(13, 30.6 - (p.step > 0 ? 1 : 0), 2.2, 1.6), mat: FUR, line: 'V', shade: 0 })
    shapes.push({ inside: ellipse(19, 30.6 - (p.step < 0 ? 1 : 0), 2.2, 1.6), mat: FUR, line: 'V', shade: 0 })
  }
  let g = render(shapes, FRAME, FRAME, { outline: 'k', litOutline: 'K' })
  const y = Math.round(18 - p.bob)
  if (!back) {
    g = stamp(g, ['kk', 'kw'], 12, y - 1)
    g = stamp(g, ['kk', 'wk'], 18, y - 1)
    g = stamp(g, ['PP'], 15, y + 1)
    g = stamp(g, ['K..K', '.KK.'], 14, y + 2)
    g = stamp(g, ['m'], 11, y + 2)
    g = stamp(g, ['m'], 20, y + 2)
  }
  g = stamp(g, ['YY', 'oo'], 15, Math.round(23 - p.bob))
  return g
}

function side(p: Phase): Grid {
  const b = -p.bob
  const leg = (x: number, lift: number): Inside => rect(x, 25 - lift, x + 3, 31 - lift)
  const near = p.step
  const shapes: Shape[] = [
    { inside: poly([[22, 24], [24.5, 23.5], [27.5 + p.tail, 15], [26 + p.tail, 13], [24.5 + p.tail, 15]]), mat: PATCH, shade: 1 },
    { inside: leg(10 - near, near > 0 ? 1 : 0), mat: mat('W', 'V', 'V'), shade: 0, light: 0 },
    { inside: leg(20 + near, near < 0 ? 1 : 0), mat: mat('W', 'V', 'V'), shade: 0, light: 0 },
    { inside: down(ellipse(17, 22.5, 7.5, 4.5), b), mat: FUR, shade: 2 },
    { inside: both(down(ellipse(17, 22.5, 7.5, 4.5), b), down(ellipse(20, 18.5, 4.5, 3.5), b)), mat: PATCH, shade: 0 },
    { inside: leg(12 + near, near < 0 ? 1 : 0), mat: FUR, line: 'V', shade: 0 },
    { inside: leg(21 - near, near > 0 ? 1 : 0), mat: FUR, line: 'V', shade: 0 },
    { inside: down(poly([[6, 16], [6.5, 9.5], [10.5, 13.5]]), b), mat: PATCH, shade: 1 },
    { inside: down(poly([[10, 14], [13, 9.5], [14.5, 16]]), b), mat: FUR, shade: 1 },
    { inside: down(ellipse(10, 18, 5.5, 4.8), b), mat: FUR, line: 'V', shade: 2 },
    { inside: both(down(ellipse(10, 18, 5.5, 4.8), b), down(ellipse(7, 13.5, 4.5, 4), b)), mat: PATCH, shade: 0 },
    { inside: down(minus(rect(13, 18, 15.5, 26), ellipse(10, 18, 5.6, 4.9)), b), mat: RED, line: 'R', shade: 0, light: 0 },
    { inside: down(poly([[11, 15.5], [12.8, 11.8], [13.5, 15.5]]), b), mat: INNER, shade: 0, light: 0 },
  ]
  let g = render(shapes, FRAME, FRAME, { outline: 'k', litOutline: 'K' })
  const y = Math.round(18 - p.bob)
  g = stamp(g, ['k', 'k'], 7, y - 1)
  g = stamp(g, ['P'], 5, y + 1)
  g = stamp(g, ['m'], 9, y + 2)
  g = stamp(g, ['Y', 'o'], 14, Math.round(23 - p.bob))
  return g
}

const IDLE: Phase[] = [
  { bob: 0, step: 0, tail: 0 },
  { bob: 0, step: 0, tail: 1 },
]
const WALK: Phase[] = [
  { bob: 0, step: 1, tail: 0 },
  { bob: 1, step: 0, tail: 1 },
  { bob: 0, step: -1, tail: 0 },
  { bob: 1, step: 0, tail: -1 },
]

function frames(facing: Facing, phases: Phase[]): Grid[] {
  if (facing === 'right') return frames('left', phases).map(mirror)
  return phases.map((p) => (facing === 'left' ? side(p) : front(p, facing === 'up')))
}

export function catSheet(): Grid {
  const rows: Grid[][] = []
  for (const f of FACINGS) rows.push(frames(f, IDLE))
  for (const f of FACINGS) rows.push(frames(f, WALK))
  return sheet(rows, 4, FRAME, FRAME)
}
