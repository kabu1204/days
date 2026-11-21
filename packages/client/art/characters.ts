/**
 * The two partners: original round mochi (rice-cake) creatures with a
 * cel-shaded body and a small face. Sheets use the layout of
 * docs/asset-spec.md, Section 4: 4 columns × 8 rows of 32 × 32 frames; rows
 * 0-3 idle (down, left, right, up; 2 frames), rows 4-7 walk (4 frames).
 */
import { type Grid, blank, mirror, recolor, sheet, stamp } from './grid'
import type { BodyKey } from '@days/shared'
import { BODY_TONES } from './palette'
import { ellipse, mat, paint, render, rotEllipse } from './render'

export const FRAME = 32
export type Facing = 'down' | 'left' | 'right' | 'up'
export const FACINGS: Facing[] = ['down', 'left', 'right', 'up']

/** The body's pose in one frame. */
export interface Pose {
  /** Half width and half height of the body. */
  rx: number
  ry: number
  /** Pixels above the ground row. */
  lift: number
}

export const IDLE: Pose[] = [
  { rx: 10.5, ry: 9.5, lift: 0 },
  { rx: 11, ry: 9, lift: 0 },
]
export const WALK: Pose[] = [
  { rx: 11.5, ry: 8.5, lift: 0 },
  { rx: 10, ry: 10.5, lift: 1 },
  { rx: 10.5, ry: 9.5, lift: 3 },
  { rx: 10.5, ry: 9.5, lift: 1 },
]

/** Where a headpiece sits in a frame. */
export interface Anchor {
  facing: Facing
  pose: Pose
  /** Horizontal centre of the body (between two pixel columns). */
  cx: number
  /** Vertical centre and top row of the body. */
  cy: number
  top: number
  /** First opaque row of the body in column x (the head's surface). */
  surface: (x: number) => number
}

const CX = 16

export function anchorOf(facing: Facing, pose: Pose): Anchor {
  const bottom = FRAME - pose.lift
  const cy = bottom - pose.ry
  const inside = ellipse(CX, cy, pose.rx, pose.ry, 2, 3.2)
  const surface = (x: number) => {
    for (let y = 0; y < FRAME; y++) if (inside(x + 0.5, y + 0.5)) return y
    return FRAME
  }
  return { facing, pose, cx: CX, cy, top: surface(CX), surface }
}

const EYE_OPEN = ['.k.', 'kwk', 'kkk', '.k.']
const EYE_SIDE = ['.k', 'kw', 'kk', '.k']
const MOUTH = ['K..K', '.KK.']

/** Speckle positions as fractions of the half width and half height. */
const SPECKLES: [number, number][] = [
  [-0.55, -0.62], [0.12, -0.78], [0.55, -0.45], [-0.82, 0.05], [0.84, 0.22], [-0.35, 0.72], [0.5, 0.7], [-0.15, -0.4],
]

/**
 * The cherry leaf of a sakura mochi. It is tucked behind the body on the side
 * away from the face (on the back, it wraps over the body), so only its tip shows.
 */
function leaf(a: Anchor): Grid {
  const { pose, cy } = a
  const side = a.facing === 'down' ? -1 : 1
  const behind = a.facing !== 'up'
  const lx = a.cx + side * pose.rx * (behind ? 0.8 : 0.55)
  const ly = cy + pose.ry * (behind ? 0.25 : 0.5)
  const angle = side * (behind ? 0.55 : 0.75)
  let g = render([{ inside: rotEllipse(lx, ly, behind ? 5.5 : 6.5, 3, angle, 1.7), mat: mat('g', 'g', 'G'), shade: 1.5 }], FRAME, FRAME, { outline: 'k', litOutline: 'K' })
  // The leaf never reaches below the body's bottom row.
  g = g.map((row, y) => (y >= FRAME - pose.lift - 1 ? '.'.repeat(FRAME) : row))
  g = paint(g, rotEllipse(lx, ly, 5, 0.55, angle, 2), 'G')
  return g
}

/** A body in tone digits 1 (highlight), 2 (base), 3 (shade), 4 (speckles). */
function body(a: Anchor, kind: BodyKey): Grid {
  const { pose, cy } = a
  let g = render([{ inside: ellipse(CX, cy, pose.rx, pose.ry, 2, 3.2), mat: mat('1', '2', '3'), shade: 2, light: 1 }], FRAME, FRAME, {
    outline: 'k',
    litOutline: 'K',
  })
  // Glossy highlight on the upper left.
  const hx = CX - pose.rx * 0.5
  const hy = cy - pose.ry * 0.5
  g = paint(g, ellipse(hx, hy, 2.6, 1.4), '1')
  g = stamp(g, ['w'], Math.floor(hx - 1), Math.floor(hy - 1))
  for (const [u, v] of SPECKLES) {
    const x = Math.round(CX + u * pose.rx - 0.5)
    const y = Math.round(cy + v * pose.ry - 0.5)
    if ('23'.includes(g[y]?.[x] ?? '.')) g = stamp(g, ['4'], x, y)
  }
  if (kind === 'sakura') g = a.facing === 'up' ? stamp(g, leaf(a), 0, 0) : stamp(leaf(a), g, 0, 0)
  if (a.facing === 'up') return g
  // Face: eyes, blush and mouth, moved towards the facing side.
  const dx = a.facing === 'left' ? -2 : 0
  const ey = Math.round(cy - 2)
  if (a.facing === 'down') {
    g = stamp(g, EYE_OPEN, CX - 6, ey)
    g = stamp(g, EYE_OPEN, CX + 3, ey)
    g = stamp(g, ['mm'], CX - 8, ey + 4)
    g = stamp(g, ['mm'], CX + 6, ey + 4)
    g = stamp(g, MOUTH, CX - 2, ey + 3)
  } else {
    g = stamp(g, EYE_OPEN, CX - 6 + dx, ey)
    g = stamp(g, EYE_SIDE, CX + 2 + dx, ey)
    g = stamp(g, ['mm'], CX - 7 + dx, ey + 4)
    g = stamp(g, MOUTH.map((r) => r.slice(0, 3)), CX - 2 + dx, ey + 3)
  }
  return g
}

/** Frames of one facing for one pose list, with a per-frame drawing function. */
export function frames(facing: Facing, poses: Pose[], draw: (a: Anchor) => Grid): Grid[] {
  if (facing === 'right') return frames('left', poses, draw).map(mirror)
  return poses.map((p) => draw(anchorOf(facing, p)))
}

/** A full sheet (4 × 8 frames) from a per-frame drawing function. */
export function characterSheet(draw: (a: Anchor) => Grid): Grid {
  const rows: Grid[][] = []
  for (const f of FACINGS) rows.push(frames(f, IDLE, draw))
  for (const f of FACINGS) rows.push(frames(f, WALK, draw))
  return sheet(rows, 4, FRAME, FRAME)
}

export function mochiSheet(kind: BodyKey): Grid {
  return recolor(characterSheet((a) => body(a, kind)), BODY_TONES[kind])
}

export const emptyFrame = (): Grid => blank(FRAME, FRAME)
