/**
 * The two partners: original round mochi (rice-cake) creatures with a
 * cel-shaded body and a small face. Sheets use the layout of
 * docs/asset-spec.md, Section 4: 4 columns × 8 rows of 32 × 32 frames; rows
 * 0-3 idle (down, left, right, up; 2 frames), rows 4-7 walk (4 frames).
 */
import { type Grid, blank, mirror, recolor, sheet, stamp } from './grid'
import { TINTS } from './palette'
import { ellipse, mat, paint, render } from './render'

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

/** A body in tint digits 1 (highlight), 2 (base), 3 (shade). */
function body(a: Anchor): Grid {
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

export function mochiSheet(tint: keyof typeof TINTS): Grid {
  return recolor(characterSheet(body), TINTS[tint])
}

export const emptyFrame = (): Grid => blank(FRAME, FRAME)
