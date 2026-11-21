/** Reaction and decorative stickers on a 16 × 16 grid (docs/asset-spec.md, Section 6). */
import type { StickerKey } from '@days/shared'
import { type Grid, mirror, stamp } from './grid'
import { type Shape, ellipse, mat, minus, poly, rect, render, union } from './render'

export const STICKER = 16
const fig = (shapes: Shape[]) => render(shapes, STICKER, STICKER, { outline: 'k', litOutline: 'K' })

const AMBER = mat('Y', 'y', 'o')
const RED = mat('p', 'r', 'R')
const PINK = mat('w', 'p', 'P')
const PEACH = mat('e', 'q', 'Q')
const PAPER = mat('w', 'W', 'V')
const INDIGO = mat('I', 'I', 'i')
const GREEN = mat('g', 'g', 'G')

const face = () => fig([{ inside: ellipse(8, 8.5, 7.2, 6.8), mat: AMBER, shade: 2 }])

const HEART = ['.kk.kk.', 'krrkrrk', 'kwrrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...']

function heart(): Grid {
  let g = fig([{ inside: union(ellipse(5, 6, 3.6, 3.6), ellipse(11, 6, 3.6, 3.6), poly([[1.6, 7.2], [14.4, 7.2], [8, 14.6]])), mat: RED, shade: 2 }])
  g = stamp(g, ['ww', 'w.'], 3, 4)
  return g
}

function laugh(): Grid {
  let g = face()
  g = stamp(g, ['.k.', 'k.k'], 3, 6)
  g = stamp(g, ['.k.', 'k.k'], 10, 6)
  g = stamp(g, ['kkkkkk', 'kwwwwk', 'krrrrk', '.kkkk.'], 5, 9)
  g = stamp(g, ['mm'], 2, 9)
  g = stamp(g, ['mm'], 12, 9)
  return g
}

function wow(): Grid {
  let g = face()
  g = stamp(g, ['KK'], 4, 4)
  g = stamp(g, ['KK'], 10, 4)
  g = stamp(g, ['kk', 'kw', 'kk'], 4, 6)
  g = stamp(g, ['kk', 'kw', 'kk'], 10, 6)
  g = stamp(g, ['.kk.', 'krrk', '.kk.'], 6, 10)
  return g
}

function tear(): Grid {
  let g = face()
  g = stamp(g, ['..K', 'KK.'], 3, 5)
  g = stamp(g, ['K..', '.KK'], 10, 5)
  g = stamp(g, ['kk', 'kk'], 4, 7)
  g = stamp(g, ['kk', 'kk'], 10, 7)
  g = stamp(g, ['.KK.', 'K..K'], 6, 11)
  g = stamp(g, ['.k.', 'kbk', 'bwB', 'kBk', '.k.'], 2, 9)
  return g
}

function hug(): Grid {
  let g = fig([{ inside: ellipse(8, 7.5, 7, 6.5), mat: AMBER, shade: 2 }])
  g = stamp(g, ['.k.', 'k.k'], 3, 5)
  g = stamp(g, ['.k.', 'k.k'], 10, 5)
  g = stamp(g, ['mm'], 2, 8)
  g = stamp(g, ['mm'], 12, 8)
  g = stamp(g, HEART, 4, 9)
  g = stamp(g, ['kk', 'yk', 'ok'], 2, 11)
  g = stamp(g, ['kk', 'ky', 'ko'], 12, 11)
  return g
}

function clap(): Grid {
  const hand = fig([
    { inside: union(ellipse(4.8, 9.8, 3.2, 5.4), ellipse(2.2, 11, 1.5, 2.6)), mat: PEACH, shade: 1.5 },
  ])
  let g = hand.map((r, i) => r.slice(0, 8) + mirror(hand)[i].slice(8))
  g = stamp(g, ['y.......y', '.y.....y.', '....y....', '....y....'], 3, 0)
  return g
}

function flower(): Grid {
  const petals = [0, 1, 2, 3, 4].map((i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    return ellipse(8 + Math.cos(a) * 3.8, 8.5 + Math.sin(a) * 3.8, 3, 3)
  })
  return fig([
    { inside: union(...petals), mat: PINK, shade: 1.5 },
    { inside: ellipse(8, 8.5, 1.8, 1.8), mat: AMBER, line: 'P', shade: 0 },
  ])
}

function sparkle(): Grid {
  let g = fig([{ inside: poly([[8, 0.3], [10, 6], [15.7, 8], [10, 10], [8, 15.7], [6, 10], [0.3, 8], [6, 6]]), mat: mat('w', 'Y', 'y'), shade: 1.5 }])
  g = stamp(g, ['.k.', 'kYk', '.k.'], 12, 1)
  return g
}

function ribbon(): Grid {
  let g = fig([
    { inside: poly([[7, 8], [4, 15], [6, 14], [7.5, 15.2], [8.5, 9]]), mat: RED, shade: 1 },
    { inside: poly([[9, 8], [12, 15], [10, 14], [8.5, 15.2], [7.5, 9]]), mat: RED, shade: 1 },
    { inside: poly([[8, 7], [1, 2.5], [0.8, 11], [8, 8.5]]), mat: RED, shade: 1.5 },
    { inside: poly([[8, 7], [15, 2.5], [15.2, 11], [8, 8.5]]), mat: RED, shade: 1.5 },
    { inside: ellipse(8, 7.8, 2, 2), mat: RED, line: 'R', shade: 1 },
  ])
  return g
}

function sun(): Grid {
  const rays = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const a = (i * Math.PI) / 4
    const c = Math.cos(a)
    const s = Math.sin(a)
    return poly([[8 + c * 7.6, 8 + s * 7.6], [8 + c * 4 - s * 1.6, 8 + s * 4 + c * 1.6], [8 + c * 4 + s * 1.6, 8 + s * 4 - c * 1.6]])
  })
  let g = fig([
    { inside: union(...rays), mat: AMBER, shade: 0 },
    { inside: ellipse(8, 8, 4.6, 4.6), mat: mat('w', 'Y', 'y'), line: 'o', shade: 1.5 },
  ])
  g = stamp(g, ['m.m'], 6, 9)
  return g
}

function cloud(): Grid {
  return fig([
    { inside: union(ellipse(5, 10, 3.6, 3.2), ellipse(9, 7.5, 4.4, 4.2), ellipse(12.2, 10.2, 3.2, 3), rect(4, 10, 13, 13.2)), mat: mat('w', 'w', 's'), shade: 2 },
  ])
}

function note(): Grid {
  return fig([
    { inside: union(rect(5, 3, 7, 12), rect(11, 2, 13, 11), poly([[5, 3], [13, 1], [13, 3.5], [5, 5.5]])), mat: INDIGO, shade: 0 },
    { inside: ellipse(4.5, 12.5, 2.6, 2), mat: INDIGO, shade: 1 },
    { inside: ellipse(10.5, 11.5, 2.6, 2), mat: INDIGO, shade: 1 },
  ])
}

function leaf(): Grid {
  let g = fig([
    { inside: poly([[2, 14], [3, 13], [4, 14.5]]), mat: mat('l', 'n', 'N'), shade: 0 },
    { inside: (x, y) => ellipse(12.46, 11.46, 9.6, 9.6)(x, y) && ellipse(4.54, 3.54, 9.6, 9.6)(x, y), mat: GREEN, shade: 2 },
  ])
  g = stamp(g, ['.....G', '....G.', '...G..', '..G...', '.G....', 'G.....'], 5, 5)
  return g
}

function cat(): Grid {
  let g = fig([
    { inside: poly([[1.5, 8], [2.5, 1], [7, 5]]), mat: AMBER, shade: 1 },
    { inside: poly([[14.5, 8], [13.5, 1], [9, 5]]), mat: PAPER, shade: 1 },
    { inside: ellipse(8, 9.5, 7, 5.6, 2, 2.4), mat: PAPER, line: 'V', shade: 2 },
    { inside: (x, y) => ellipse(8, 9.5, 7, 5.6, 2, 2.4)(x, y) && ellipse(3, 5, 5, 4.5)(x, y), mat: AMBER, shade: 0 },
    { inside: poly([[3, 6], [3.3, 2.8], [5.5, 5.5]]), mat: mat('p', 'p', 'P'), shade: 0, light: 0 },
    { inside: poly([[13, 6], [12.7, 2.8], [10.5, 5.5]]), mat: mat('p', 'p', 'P'), shade: 0, light: 0 },
  ])
  g = stamp(g, ['kk', 'kw'], 4, 8)
  g = stamp(g, ['kk', 'wk'], 10, 8)
  g = stamp(g, ['PP'], 7, 10)
  g = stamp(g, ['K..K', '.KK.'], 6, 11)
  g = stamp(g, ['m'], 3, 11)
  g = stamp(g, ['m'], 12, 11)
  return g
}

function paw(): Grid {
  const PAD = mat('p', 'p', 'P')
  return fig([
    { inside: ellipse(8, 11, 4.2, 3.4, 2, 2.6), mat: PAD, shade: 1.5 },
    { inside: ellipse(2.8, 6.8, 1.8, 2.2), mat: PAD, shade: 1 },
    { inside: ellipse(6, 3.6, 1.9, 2.3), mat: PAD, shade: 1 },
    { inside: ellipse(10, 3.6, 1.9, 2.3), mat: PAD, shade: 1 },
    { inside: ellipse(13.2, 6.8, 1.8, 2.2), mat: PAD, shade: 1 },
  ])
}

function cake(): Grid {
  let g = fig([
    { inside: rect(1.5, 7, 14.5, 15), mat: mat('Y', 'Y', 'y'), shade: 1.5 },
    { inside: rect(1.5, 6, 14.5, 8), mat: PAPER, line: 'V', shade: 0 },
    { inside: rect(1.5, 10.5, 14.5, 11.5), mat: mat('p', 'r', 'R'), shade: 0, light: 0 },
    { inside: ellipse(8, 4.5, 3, 3), mat: RED, shade: 1.5 },
    { inside: poly([[6.5, 2], [8, 0.5], [9.5, 2], [8, 2.5]]), mat: GREEN, shade: 0, light: 0 },
  ])
  g = stamp(g, ['w'], 7, 3)
  return g
}

function balloon(): Grid {
  let g = fig([
    { inside: ellipse(8, 6.5, 5.2, 6), mat: RED, shade: 2 },
    { inside: poly([[7, 12], [9, 12], [9.5, 13.5], [6.5, 13.5]]), mat: RED, shade: 0, light: 0 },
  ])
  g = stamp(g, ['ww', 'w.'], 5, 3)
  g = stamp(g, ['.S', 'S.', '.S'], 7, 13)
  return g
}

function moon(): Grid {
  let g = fig([{ inside: minus(ellipse(7.5, 8, 6.5, 6.5), ellipse(11, 5.5, 5.5, 5.5)), mat: mat('w', 'Y', 'y'), shade: 1.5 }])
  g = stamp(g, ['.k.', 'kYk', '.k.'], 12, 10)
  g = stamp(g, ['Y'], 14, 4)
  return g
}

export const stickerArt: Record<StickerKey, Grid> = {
  heart: heart(),
  laugh: laugh(),
  wow: wow(),
  tear: tear(),
  hug: hug(),
  clap: clap(),
  flower: flower(),
  sparkle: sparkle(),
  ribbon: ribbon(),
  sun: sun(),
  cloud: cloud(),
  note: note(),
  leaf: leaf(),
  cat: cat(),
  paw: paw(),
  cake: cake(),
  balloon: balloon(),
  moon: moon(),
}
