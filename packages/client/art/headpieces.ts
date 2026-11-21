/**
 * Headpieces worn by the partners: overlay sheets with the same layout as the
 * body sheets, placed on the head in every frame so that they follow the
 * body's squash, stretch and hop.
 */
import type { HeadpieceKey } from '@days/shared'
import { type Grid, mirror, stamp } from './grid'
import { type Anchor, characterSheet, emptyFrame } from './characters'
import { ellipse, mat, poly, rect, render, union } from './render'

/** Draws `piece` with its bottom centre at (cx, bottom). */
function place(frame: Grid, piece: Grid, cx: number, bottom: number): Grid {
  return stamp(frame, piece, Math.round(cx - piece[0].length / 2), bottom - piece.length + 1)
}

const RED = mat('p', 'r', 'R')
const AMBER = mat('Y', 'y', 'o')

const rosette = render(
  [
    { inside: poly([[2.5, 7], [4.5, 7], [3.5, 12], [2, 11]]), mat: RED, shade: 0, light: 0 },
    { inside: poly([[6.5, 7], [8.5, 7], [9, 11], [7.5, 12]]), mat: RED, shade: 0, light: 0 },
    {
      inside: union(ellipse(5.5, 5, 4.6, 4.3), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ellipse(5.5 + Math.cos((i * Math.PI) / 4) * 3.6, 5 + Math.sin((i * Math.PI) / 4) * 3.4, 1.6, 1.6))),
      mat: RED,
      shade: 1.5,
    },
    { inside: ellipse(5.5, 5, 2, 2), mat: AMBER, line: 'R', shade: 1, light: 1 },
  ],
  11,
  13,
)

const HAT = mat('I', 'i', 'k')
const topHat = render(
  [
    { inside: rect(3, 0, 12, 9), mat: HAT, shade: 2, light: 1 },
    { inside: rect(3, 6, 12, 8), mat: mat('p', 'r', 'R'), line: 'k', shade: 0, light: 0 },
    { inside: ellipse(7.5, 9.5, 7.6, 2), mat: HAT, line: 'k', shade: 1, light: 0 },
  ],
  15,
  12,
)

const PAPER = mat('w', 'W', 'V')
const chefHat = render(
  [
    { inside: union(ellipse(4, 5.5, 3.6, 3.6), rect(1.5, 5.5, 7, 10)), mat: PAPER, shade: 1, light: 1 },
    { inside: union(ellipse(10, 5.5, 3.6, 3.6), rect(7, 5.5, 12.5, 10)), mat: PAPER, line: 'V', shade: 2, light: 1 },
    { inside: union(ellipse(7, 4, 3.4, 3.6), rect(4.5, 4, 9.5, 10)), mat: PAPER, line: 'V', shade: 1, light: 1 },
    { inside: rect(2, 8, 12, 12), mat: PAPER, line: 'V', shade: 1, light: 0 },
  ],
  14,
  13,
)

const FUR = mat('l', 'n', 'N')
const ear = (inner: boolean) =>
  render(
    [
      { inside: poly([[0.3, 10], [3, 0.3], [9.7, 10]]), mat: FUR, shade: 1.5, light: 1 },
      ...(inner ? [{ inside: poly([[3, 9.5], [3.8, 4.5], [6.8, 9.5]]), mat: mat('p', 'p', 'P'), shade: 0, light: 0 }] : []),
    ],
    10,
    10,
  ).slice(0, -1) // no outline where the ear meets the head

/** Draws a headpiece for one frame (facings other than 'right'; right is mirrored). */
const drawers: Record<HeadpieceKey, (a: Anchor) => Grid> = {
  rosette: (a) => {
    const x = a.facing === 'up' ? a.cx - 5 : a.facing === 'left' ? a.cx + 3 : a.cx + 5
    return place(emptyFrame(), rosette, x, a.surface(Math.floor(x)) + 4)
  },
  'top-hat': (a) => {
    const x = a.facing === 'left' ? a.cx - 1 : a.cx + 1
    return place(emptyFrame(), topHat, x, a.top + 2)
  },
  'chef-hat': (a) => {
    const x = a.facing === 'left' ? a.cx - 1 : a.cx
    return place(emptyFrame(), chefHat, x, a.top + 3)
  },
  'cat-ears': (a) => {
    const dx = a.facing === 'left' ? -2 : 0
    const inner = a.facing !== 'up'
    const lx = a.cx - 6 + dx
    const rx = a.cx + 6 + dx
    let g = place(emptyFrame(), ear(inner), lx, a.surface(Math.floor(lx)) + 3)
    g = place(g, mirror(ear(inner)), rx, a.surface(Math.floor(rx)) + 3)
    return g
  },
}

export function headpieceSheet(key: HeadpieceKey): Grid {
  return characterSheet(drawers[key])
}
