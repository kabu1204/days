/**
 * A small rasteriser for cel-shaded pixel figures. A figure is a list of
 * shapes drawn back to front; each shape has a material of three tones
 * (highlight, base, shade). The silhouette of the whole figure gets a dark
 * outline, shapes marked with `line` get an inner line where they overlap the
 * shapes behind them, and every shape is shaded with light from the upper
 * left: a crescent of shade on the lower right and a rim of highlight on the
 * upper left.
 */
import type { Grid } from './grid'

/** Tests a point in pixel units; pixel (x, y) is sampled at (x + 0.5, y + 0.5). */
export type Inside = (x: number, y: number) => boolean

export interface Material {
  hi: string
  base: string
  sh: string
}

export interface Shape {
  inside: Inside
  mat: Material
  /** Draws an inner line in this colour where the shape covers another shape. */
  line?: string
  /** Width of the shade crescent (default 2; 0 for none). */
  shade?: number
  /** Width of the highlight rim (default 1; 0 for none). */
  light?: number
}

export const mat = (hi: string, base: string, sh: string): Material => ({ hi, base, sh })

/** An ellipse; `top` and `bottom` are superellipse exponents (2 is a true ellipse, larger is squarer). */
export function ellipse(cx: number, cy: number, rx: number, ry: number, top = 2, bottom = top): Inside {
  return (x, y) => {
    const dx = Math.abs(x - cx) / rx
    const dy = (y - cy) / ry
    const p = dy < 0 ? top : bottom
    return dx ** p + Math.abs(dy) ** p < 1
  }
}

export function rect(x0: number, y0: number, x1: number, y1: number): Inside {
  return (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1
}

export function poly(points: [number, number][]): Inside {
  return (x, y) => {
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i]
      const [xj, yj] = points[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
}

export const union =
  (...fs: Inside[]): Inside =>
  (x, y) =>
    fs.some((f) => f(x, y))

export const minus =
  (a: Inside, b: Inside): Inside =>
  (x, y) =>
    a(x, y) && !b(x, y)

export const shift =
  (f: Inside, dx: number, dy: number): Inside =>
  (x, y) =>
    f(x - dx, y - dy)

export interface RenderOptions {
  outline?: string
  /** Outline colour on the upper-left part of the silhouette (default: same as `outline`). */
  litOutline?: string
}

export function render(shapes: Shape[], w: number, h: number, opts: RenderOptions = {}): Grid {
  const outlineKey = opts.outline ?? 'k'
  const litKey = opts.litOutline ?? outlineKey
  const owner: number[][] = []
  for (let y = 0; y < h; y++) {
    owner.push([])
    for (let x = 0; x < w; x++) {
      let o = -1
      shapes.forEach((s, i) => {
        if (s.inside(x + 0.5, y + 0.5)) o = i
      })
      owner[y].push(o)
    }
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : owner[y][x])
  // Bounding box of the figure, to tell the lit side of the silhouette.
  let minX = w
  let maxX = 0
  let minY = h
  let maxY = 0
  owner.forEach((row, y) =>
    row.forEach((o, x) => {
      if (o < 0) return
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }),
  )
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  return owner.map((row, y) =>
    row
      .map((o, x) => {
        if (o < 0) return '.'
        const s = shapes[o]
        const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)]
        if (n.includes(-1)) {
          const lit = x < midX - 1 && y < midY && (at(x, y - 1) === -1 || at(x - 1, y) === -1)
          return lit ? litKey : outlineKey
        }
        if (s.line && n.some((m) => m < o)) return s.line
        const px = x + 0.5
        const py = y + 0.5
        const r = s.shade ?? 2
        if (r > 0 && (!s.inside(px + r, py + r * 0.7) || !s.inside(px, py + r))) return s.mat.sh
        const l = s.light ?? 1
        if (l > 0 && (!s.inside(px - l - 1, py - l - 1) || !s.inside(px - l - 1, py) && !s.inside(px, py - l - 1))) return s.mat.hi
        return s.mat.base
      })
      .join(''),
  )
}

/** Paints `key` over every pixel of `g` that is opaque and inside `f`. */
export function paint(g: Grid, f: Inside, key: string): Grid {
  return g.map((row, y) => [...row].map((ch, x) => (ch !== '.' && f(x + 0.5, y + 0.5) ? key : ch)).join(''))
}
